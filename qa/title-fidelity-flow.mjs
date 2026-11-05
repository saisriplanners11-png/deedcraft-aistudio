import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const xmlOf = async bytes => new TextDecoder().decode((await rt.readZip(bytes)).find(entry => entry.name === 'word/document.xml').data);
const heading = xml => xml.slice(xml.indexOf('<w:body>') + 8).match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g).find(p => { const text = p.replace(/<[^>]*>/g, '').trim(); return text && !/^&lt;IF /.test(text); });
const cases = [
  ['sale', 'outright-absolute-sale-deed', 'sale-deed-template-v11.docx', 'Sale'],
  ['gift', 'family-gift', 'gift-deed-template-v6.docx', 'Gift'],
  ['gift', 'non-family-gift', 'gift-deed-template-v6.docx', 'Gift'],
  ['gift', 'gift-to-trust-or-charity', 'gift-deed-template-v6.docx', 'Gift'],
  ['gift', 'municipal-gift', 'gift-municipal-template-v3.docx', 'Gift'],
  ['power_of_attorney', 'general-power-of-attorney', 'general-poa-template-v3.docx', 'GPA/Power of Attorney'],
  ['power_of_attorney', 'general-power-of-attorney-family', 'general-poa-template-v3.docx', 'GPA/Power of Attorney'],
  ['agreement_of_sale', 'with-possession', 'agreement-sale-gpa-template-v4.docx', 'Agreement of Sale Cum GPA'],
  ['agreement_of_sale', 'without-possession', 'agreement-sale-gpa-template-v4.docx', 'Agreement of Sale Cum GPA'],
];
for (const [instrumentId, variantId, file, deedType] of cases) {
  const bytes = new Uint8Array(await readFile(new URL('../' + file, import.meta.url)));
  const state = rt.sampleState('ordinary-plot');
  state.deedType = deedType;
  if (variantId === 'municipal-gift') state.draft = 'Municipal Gift';
  Object.assign(state.form, { giftRelationship: 'daughter', poaRelationship: 'daughter', localAuthorityType: 'Municipal Council', village: 'Sample Village' });
  const compiled = rt.compileDeed({ instrumentId, variantId, snapshotHash: 'title-fidelity', values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] }, { kind: 'built-in' });
  const artifact = await rt.renderArtifact(compiled, 'docx');
  const actual = heading(await xmlOf(new Uint8Array(await artifact.result.blob.arrayBuffer())));
  let expected = heading(await xmlOf(bytes));
  if (variantId === 'without-possession') expected = rt.replaceRunText(expected, /WITH POSSESSION/, () => 'WITHOUT POSSESSION');
  assert.equal(actual, expected, `${instrumentId}/${variantId}: preserve title text and complete paragraph/run formatting`);
}
console.log(`PASS: ${cases.length} deed/variant headings retain exact source paragraph/run XML; only source-defined possession choice is resolved.`);
