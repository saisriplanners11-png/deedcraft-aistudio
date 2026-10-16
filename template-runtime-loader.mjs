import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let runtime;
export function loadTemplateRuntime() {
  return runtime ??= (async () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const result = await build({
      entryPoints: [join(root, 'template-runtime.ts')], bundle: true, platform: 'node', format: 'esm', write: false,
      plugins: [{ name: 'server-template-assets', setup(builder) {
        // Sample rendering needs payment formatting, never extraction or PDF workers.
        builder.onLoad({ filter: /[/\\]extract\.ts$/ }, () => ({ loader: 'js', contents: 'export async function fileToVisualParts() { throw new Error("Extraction is unavailable in template validation."); }' }));
        builder.onLoad({ filter: /[/\\]template\.ts$/ }, () => ({ loader: 'js', contents: `
          import { readFile } from 'node:fs/promises';
          const root = ${JSON.stringify(root)};
          export async function loadSaleDeedTemplate() { return new Uint8Array(await readFile(root + '/sale-deed-template-v7.docx')); }
          export async function loadTemplate(id) {
            const files = { 'sale-deed-v7': 'sale-deed-template-v7.docx', 'sale-deed-v6': 'sale-deed-template-v6.docx', 'sale-deed-v5': 'sale-deed-template-v5.docx', 'sale-deed-v4': 'sale-deed-template-v4.docx', 'sale-deed-v3': 'sale-deed-template.docx', 'sale-deed-v2': 'sale-deed-template-v2.docx' };
            if (!files[id]) throw new Error('Unknown bundled template.');
            return new Uint8Array(await readFile(root + '/' + files[id]));
          }
        ` }));
      } }],
    });
    return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  })();
}
