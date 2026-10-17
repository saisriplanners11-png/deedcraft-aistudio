import { access, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

let runtime;
export async function buildTemplateRuntime() {
    const { build } = await import('esbuild');
    const root = dirname(fileURLToPath(import.meta.url));
    const result = await build({
      entryPoints: [join(root, 'template-runtime.ts')], bundle: true, platform: 'node', format: 'esm', write: false,
      plugins: [{ name: 'server-template-assets', setup(builder) {
        // Sample rendering needs payment formatting, never extraction or PDF workers.
        builder.onLoad({ filter: /[/\\]claude\.ts$/ }, () => ({ loader: 'js', contents: 'export const EXTRACT_MODEL = "unused"; export function getClient() { throw new Error("Extraction is unavailable in template validation."); } export const readableError = String;' }));
        builder.onLoad({ filter: /[/\\]extract\.ts$/ }, () => ({ loader: 'js', contents: 'export async function fileToVisualParts() { throw new Error("Extraction is unavailable in template validation."); }' }));
        builder.onLoad({ filter: /[/\\]template\.ts$/ }, () => ({ loader: 'js', contents: `
          import { readFile } from 'node:fs/promises';
          const root = ${JSON.stringify(root)};
          export async function loadSaleDeedTemplate() { return new Uint8Array(await readFile(root + '/sale-deed-template-v9.docx')); }
          export async function loadTemplate(id) {
            const files = { 'sale-deed-v7': 'sale-deed-template-v7.docx', 'sale-deed-v9': 'sale-deed-template-v9.docx', 'sale-deed-v6': 'sale-deed-template-v6.docx', 'sale-deed-v5': 'sale-deed-template-v5.docx', 'sale-deed-v4': 'sale-deed-template-v4.docx', 'sale-deed-v3': 'sale-deed-template.docx', 'sale-deed-v2': 'sale-deed-template-v2.docx' };
            if (!files[id]) throw new Error('Unknown bundled template.');
            return new Uint8Array(await readFile(root + '/' + files[id]));
          }
        ` }));
      } }],
    });
    const directory = join(root, '.runtime');
    await mkdir(directory, { recursive: true });
    const output = join(directory, 'template-runtime.mjs');
    await writeFile(output, result.outputFiles[0].text);
    return output;
}
export function loadTemplateRuntime() {
  return runtime ??= (async () => {
    const output = join(dirname(fileURLToPath(import.meta.url)), '.runtime', 'template-runtime.mjs');
    if (process.env.NODE_ENV === 'production') {
      try { await access(output); } catch { throw new Error('Template runtime is missing. Run npm run build before starting production.'); }
    } else { await buildTemplateRuntime(); }
    return import(pathToFileURL(output).href);
  })().catch(error => { runtime = undefined; throw error; });
}
