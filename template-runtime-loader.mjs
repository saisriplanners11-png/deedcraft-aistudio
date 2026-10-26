import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
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
          export async function loadSaleDeedTemplate() { return new Uint8Array(await readFile(root + '/sale-deed-template-v10.docx')); }
          export async function loadTemplate(id) {
            const files = { 'general-poa-v1': 'general-poa-template-v1.docx', 'agreement-sale-gpa-v1': 'agreement-sale-gpa-template-v1.docx', 'agreement-sale-gpa-v2': 'agreement-sale-gpa-template-v2.docx', 'gift-municipal-v1': 'gift-municipal-template-v1.docx', 'gift-deed-v4': 'gift-deed-template-v4.docx', 'gift-deed-v3': 'gift-deed-template-v3.docx', 'gift-deed-v2': 'gift-deed-template-v2.docx', 'gift-deed-v1': 'gift-deed-template-v1.docx', 'sale-deed-v10': 'sale-deed-template-v10.docx', 'sale-deed-v7': 'sale-deed-template-v7.docx', 'sale-deed-v9': 'sale-deed-template-v9.docx', 'sale-deed-v6': 'sale-deed-template-v6.docx', 'sale-deed-v5': 'sale-deed-template-v5.docx', 'sale-deed-v4': 'sale-deed-template-v4.docx', 'sale-deed-v3': 'sale-deed-template.docx', 'sale-deed-v2': 'sale-deed-template-v2.docx' };
            if (!files[id]) throw new Error('Unknown bundled template.');
            return new Uint8Array(await readFile(root + '/' + files[id]));
          }
        ` }));
      } }],
    });
    const directory = join(root, '.runtime');
    await mkdir(directory, { recursive: true });
    const output = join(directory, 'template-runtime.mjs');
    // Validators and the development server may rebuild concurrently. Readers
    // must see a complete module, never a file truncated by another writer.
    const temporary = join(directory, `template-runtime-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, result.outputFiles[0].text);
      for (let attempt = 0; ; attempt++) {
        try { await rename(temporary, output); break; }
        catch (error) {
          // Windows briefly locks an ESM file while another process imports it.
          if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 39) throw error;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } finally { await rm(temporary, { force: true }); }
    return output;
}
export function loadTemplateRuntime() {
  return runtime ??= (async () => {
    const output = join(dirname(fileURLToPath(import.meta.url)), '.runtime', 'template-runtime.mjs');
    if (process.env.NODE_ENV === 'production') {
      try { await access(output); } catch { throw new Error('Template runtime is missing. Run npm run build before starting production.'); }
    } else { await buildTemplateRuntime(); }
    // Vite reloads this loader when validator sources change, but Node retains
    // dynamic imports by URL. Give each compiled version its own module identity.
    const digest = createHash('sha256').update(await readFile(output)).digest('hex');
    const url = pathToFileURL(output);
    url.searchParams.set('version', digest);
    return import(url.href);
  })().catch(error => { runtime = undefined; throw error; });
}
