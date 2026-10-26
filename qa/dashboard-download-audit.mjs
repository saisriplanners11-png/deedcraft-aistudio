import assert from 'node:assert/strict';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';

// Inspect only these synthetic files produced by the documented browser audit.
const directory = process.argv[2];
if (!directory) throw new Error('Pass the browser download directory.');
const files = ['Ordinary-Sale-Vacant-Plot-QA-BUYER.docx', 'Gift-QA-BUYER.docx', 'Gift-QA-BUYER (1).docx', 'Gift-QA-BUYER (2).docx', 'Municipal-Gift-QA-BUYER.docx', 'Agreement-of-Sale-Cum-GPA-QA-BUYER.docx', 'Agreement-of-Sale-Cum-GPA-QA-BUYER (1).docx', 'GPA-Power-of-Attorney-QA-BUYER.docx', 'GPA-Power-of-Attorney-QA-BUYER (1).docx', 'Sale-through-GPA-Vacant-Plot-QA-BUYER.docx', 'Sale-through-AGPA-Vacant-Plot-QA-BUYER.docx'];
const rt = await loadTemplateRuntime();
const out = 'tmp/dashboard-qa/downloads';
await mkdir(out, { recursive: true });
const results = [];
for (const name of files) {
  const bytes = new Uint8Array(await readFile(join(directory, name)));
  const entries = await rt.readZip(bytes);
  assert(entries.some(entry => entry.name === 'word/document.xml'));
  assert(entries.some(entry => entry.name === 'word/styles.xml'));
  const text = await rt.docxToText(bytes);
  assert.match(text, /QA SELLER ONE/);
  assert.match(text, /QA BUYER/);
  assert.match(text, /QA-100/);
  assert.match(text, /240/);
  if (name.startsWith('Sale-through-')) {
    assert.match(text, /QA SELLER TWO/);
    assert.match(text, /AUTH-QA-42/);
  }
  results.push({ name, bytes: bytes.length, validPackage: true, uploadedNamesAndProperty: true });
  await rename(join(directory, name), join(out, name));
}
await writeFile('tmp/dashboard-qa/browser-downloads.json', JSON.stringify(results, null, 2));
console.log(`PASS: ${results.length} dashboard downloads contain the uploaded parties/property and valid Word packages; moved synthetic downloads to ${out}.`);
