import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const bytes = new Uint8Array(await readFile(new URL('../sale-deed-template-v10.docx', import.meta.url)));
const validation = await rt.validateSaleDeedTemplate(bytes);
assert(validation.valid, validation.errors.join('\n'));
const source = { kind: 'custom', name: 'Sale v10', hash: '', bytes, validation };
const out = new URL('../tmp/v10-qa/', import.meta.url);
await mkdir(out, { recursive: true });
for (const [id] of rt.saleMatrixCases) {
  const output = await rt.renderSample(id, source);
  const text = await rt.docxToText(output);
  const tail = text.slice(text.lastIndexOf('DECLARATION'));
  assert.equal((text.match(/^DECLARATION$/gm) || []).length, 1, id);
  assert.doesNotMatch(text, /<[^<>]+>/, id);
  if (id.startsWith('ordinary')) assert.doesNotMatch(tail, /HOLDER OF|SAMPLE VENDOR/, id);
  else {
    assert.match(tail, id.startsWith('agpa') ? /A\.G\.P\.A\. HOLDER OF/ : /G\.P\.A\. HOLDER OF/, id);
    assert.match(tail, /SAMPLE VENDOR/, id);
    assert(tail.indexOf('HOLDER OF') < tail.indexOf('SIGN/S OF VENDOR/S'), id);
  }
  if (id.endsWith('-plot')) await writeFile(new URL(id + '.docx', out), output);
}
const state = rt.sampleState('gpa-plot');
state.additionalExecutants = [{ id: 'second', docNames: [], values: { ...state.form, executantName: 'SECOND PRINCIPAL' } }];
const values = rt.mergeValues(state);
const schedules = rt.scheduleMergesFor(state);
const result = await rt.fillSaleDeed(values, schedules[0].variant, rt.rewritesFor(state), schedules, source);
const tail = (await rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()))).split('DECLARATION').pop();
assert.match(tail, /SAMPLE VENDOR, SECOND PRINCIPAL/);
assert.deepEqual(result.unmapped, []);
const entries = await rt.readZip(bytes);
const doc = entries.find(entry => entry.name === 'word/document.xml');
doc.data = new TextEncoder().encode(new TextDecoder().decode(doc.data).replace('END GPA AGPA DECLARATION', 'MISSING END'));
const broken = await rt.validateSaleDeedTemplate(await rt.writeZip(entries));
assert.equal(broken.valid, false);
assert(broken.errors.some(error => /matching end marker/.test(error)));
console.log('PASS: v10 declaration conditions for 24 sale/property combinations, multiple principals and incomplete-condition rejection.');

// Entire blocks can disappear when a replacement Word draft is uploaded.
const replacementEntries = await rt.readZip(bytes);
const replacementDoc = replacementEntries.find(entry => entry.name === 'word/document.xml');
let inside = false;
replacementDoc.data = new TextEncoder().encode(new TextDecoder().decode(replacementDoc.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
  const text = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match => match[1]).join('').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  if (text === '<IF GPA AGPA DECLARATION>') { inside = true; return ''; }
  if (text === '<END GPA AGPA DECLARATION>') { inside = false; return ''; }
  return inside ? '' : paragraph;
}));
const replacementSource = { ...source, bytes: await rt.writeZip(replacementEntries) };
for (const mode of ['ordinary', 'gpa', 'agpa']) {
  const sample = rt.sampleState(mode + '-plot');
  const schedules = rt.scheduleMergesFor(sample);
  const result = await rt.fillSaleDeed(rt.mergeValues(sample), schedules[0].variant, rt.rewritesFor(sample), schedules, replacementSource);
  const tail = (await rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()))).split('DECLARATION').pop();
  if (mode === 'ordinary') assert.doesNotMatch(tail, /HOLDER OF/);
  else { assert.match(tail, /HOLDER OF/); assert.match(tail, /SAMPLE VENDOR/); assert(tail.indexOf('HOLDER OF') < tail.indexOf('SIGN/S OF VENDOR/S')); }
}
const incompleteEntries = await rt.readZip(bytes);
const incompleteDoc = incompleteEntries.find(entry => entry.name === 'word/document.xml');
incompleteDoc.data = new TextEncoder().encode(new TextDecoder().decode(incompleteDoc.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => rt.replaceRunText(paragraph, /<Authority Principal Names>/g, () => 'REMOVED')));
const incompleteBytes = await rt.writeZip(incompleteEntries);
const incompleteValidation = await rt.validateSaleDeedTemplate(incompleteBytes);
assert.equal(incompleteValidation.valid, false);
assert(incompleteValidation.errors.some(error => /must retain Authority Holder Label/.test(error)));
console.log('PASS: replacing a Word file cannot remove the approved GPA/AGPA declaration; incomplete authority bindings are rejected.');
