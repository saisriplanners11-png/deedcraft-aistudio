import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);
const directory = 'ocr/v7/';
const languages = ['eng'];
const cores = ['lstm', 'simd-lstm', 'relaxedsimd-lstm'].map(variant => 'tesseract-core-' + variant + '.wasm.js');

/** Tesseract requests each language by its fixed filename from one directory. */
export function localOcrAssets(): Plugin {
  const files = new Map(languages.map(language => [
    directory + language + '.traineddata.gz',
    require.resolve('@tesseract.js-data/' + language + '/4.0.0_best_int/' + language + '.traineddata.gz'),
  ]));
  for (const core of cores) files.set(directory + 'core/' + core, require.resolve('tesseract.js-core/' + core));
  for (const variant of ['', '.jsep']) {
    for (const extension of ['mjs', 'wasm']) {
      const filename = 'ort-wasm-simd-threaded' + variant + '.' + extension;
      files.set('ocr/paddle-v5/wasm/' + filename, resolve(dirname(require.resolve('onnxruntime-web')), filename));
    }
  }
  return {
    name: 'local-ocr-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const filename = files.get((request.url || '').slice(1).split('?')[0]);
        if (!filename) return next();
        try {
          const data = await readFile(filename);
          const type = /\.m?js$/.test(filename) ? 'text/javascript; charset=utf-8'
            : filename.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
          response.setHeader('Content-Type', type);
          response.end(data);
        } catch (error) { next(error); }
      });
    },
    async generateBundle() {
      const assets = await Promise.all([...files].map(async ([fileName, filename]) => ({ fileName, source: await readFile(filename) })));
      for (const asset of assets) this.emitFile({ type: 'asset', ...asset });
    },
  };
}
