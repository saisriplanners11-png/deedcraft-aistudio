import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import { sendStatic } from '../static-response.mjs';

const names = await readdir(new URL('../dist/assets/', import.meta.url));
const bodies = await Promise.all(names.filter(name => /\.(js|mjs|css)$/.test(name)).map(async name => ({ name, body: await readFile(new URL('../dist/assets/' + name, import.meta.url)) })));
let selected = bodies[0];
const server = createServer((req, res) => { sendStatic(req, res, selected.body, { type: 'text/javascript', immutable: req.url !== '/' }).catch(error => res.destroy(error)); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const get = (headers = {}, method = 'GET', path = '/asset') => new Promise((resolve, reject) => {
  const req = request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers }, res => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
  });
  req.on('error', reject); req.end();
});
try {
  selected = bodies.reduce((a, b) => a.body.length > b.body.length ? a : b);
  const plain = await get();
  assert.deepEqual(plain.body, selected.body);
  assert.match(plain.headers['cache-control'], /immutable/);
  for (const [encoding, decode] of [['br', brotliDecompressSync], ['gzip', gunzipSync]]) {
    const compressed = await get({ 'accept-encoding': encoding });
    assert.equal(compressed.headers['content-encoding'], encoding);
    assert.deepEqual(decode(compressed.body), selected.body);
    assert.ok(compressed.body.length < plain.body.length);
  }
  const disabled = await get({ 'accept-encoding': 'br;q=0, gzip;q=0' });
  assert.equal(disabled.headers['content-encoding'], undefined);
  const cached = await get({ 'if-none-match': plain.headers.etag });
  assert.equal(cached.status, 304); assert.equal(cached.body.length, 0);
  const head = await get({}, 'HEAD');
  assert.equal(head.body.length, 0); assert.equal(Number(head.headers['content-length']), plain.body.length);
  assert.equal((await get({}, 'GET', '/')).headers['cache-control'], 'no-cache');
  let raw = 0, compressed = 0;
  for (const asset of bodies) {
    selected = asset;
    const response = await get({ 'accept-encoding': 'br' });
    raw += asset.body.length; compressed += response.body.length;
  }
  console.log(`Static JS/CSS corpus: ${raw} -> ${compressed} bytes (${(100 * (1 - compressed / raw)).toFixed(1)}% less with Brotli).`);
  console.log('Passed compression integrity, encoding opt-out, immutable caching, HTML revalidation, 304 and HEAD checks.');
} finally { await new Promise(resolve => server.close(resolve)); }
