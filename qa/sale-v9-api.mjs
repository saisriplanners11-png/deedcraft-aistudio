import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createTemplateApi } from '../template-api.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(root + 'tmp', { recursive: true });
const directory = await mkdtemp(root + 'tmp/v7-api-');
const oldBytes = await readFile(root + 'sale-deed-template-v6.docx');
const old = { id: 'sale-deed-v6', instrumentId: 'sale', filename: 'sale-deed-template-v6.docx', hash: createHash('sha256').update(oldBytes).digest('hex'), publishedAt: '2026-10-01', validation: { valid: true }, samples: [] };
await writeFile(directory + '/sale-deed-v6.docx', oldBytes);
await writeFile(directory + '/library.json', JSON.stringify({ active: { sale: old.id }, versions: [old], history: [] }));
let server;
async function start() {
  const api = createTemplateApi({ backend: 'disk', password: 'isolated-v7-test', storageDir: directory });
  server = createServer((request, response) => void api(request, response));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}/api/templates`;
}
async function close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
let base = await start();
try {
  let listing = await (await fetch(base)).json();
  assert.equal(listing.active.sale, 'sale-deed-v10');
  assert(listing.versions.some(version => version.id === old.id && version.hash === old.hash));
  assert.equal(listing.versions.find(version => version.id === 'sale-deed-v10').saleOpenings, true);
  assert.deepEqual(Buffer.from(await (await fetch(base + '/versions/sale-deed-v6/download')).arrayBuffer()), oldBytes);
  const login = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'isolated-v7-test' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const { csrf } = await login.json();
  const response = await fetch(base + '/upload?filename=updated-sale-v7.docx', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: new Uint8Array(await readFile(root + 'sale-deed-template-v9.docx')) });
  const version = await response.json();
  assert.equal(response.status, 201, JSON.stringify(version));
  assert.equal(version.expectedSampleCount, 25);
  assert.equal(version.samples.length, 25);
  assert.deepEqual(version.samples.filter(sample => sample.error), []);
  const sample = await fetch(base + `/versions/${version.id}/samples/gpa-house-semi`, { headers: { Cookie: cookie } });
  assert.equal(sample.status, 200);
  assert((await sample.arrayBuffer()).byteLength > 10000);
  // Existing custom publication must remain the library default on restart.
  const data = JSON.parse(await readFile(directory + '/library.json', 'utf8'));
  data.active.sale = version.id;
  await writeFile(directory + '/library.json', JSON.stringify(data));
  await close(); base = await start();
  listing = await (await fetch(base)).json();
  assert.equal(listing.active.sale, version.id);
  console.log('PASS: v6 seed migration, retained v6 bytes, 25 library samples and downloads, existing custom default retained.');
} finally { await close(); }
