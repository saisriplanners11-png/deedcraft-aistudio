import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
await mkdir('tmp/assessment-identification-qa', { recursive: true });
const variants = [
  ['sale', 'outright-absolute-sale-deed', 'Sale'],
  ['gift', 'family-gift', 'Gift'],
  ['power_of_attorney', 'general-power-of-attorney', 'GPA/Power of Attorney'],
  ['power_of_attorney', 'general-power-of-attorney-family', 'GPA/Power of Attorney'],
  ['agreement_of_sale', 'with-possession', 'Agreement of Sale Cum GPA'],
];
for (const count of [1, 2, 3]) for (const [instrumentId, variantId, deedType] of variants) {
  const state = rt.sampleState('ordinary-part');
  state.deedType = deedType;
  const pairs = Array.from({ length: count }, (_, index) => ({ id: `pair-${index}`, houseNo: `6-2-${24 + index}`, ptin: `${1105008210 + index}` }));
  Object.assign(state.form, { housePtinPairs: JSON.stringify(pairs), giftRelationship: 'daughter', poaRelationship: 'daughter' });
  const compiled = rt.compileDeed({ instrumentId, variantId, snapshotHash: 'assessment-identification', values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] }, { kind: 'built-in' });
  const { result } = await rt.renderArtifact(compiled, 'docx');
  assert.deepEqual(result.unmapped, []);
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const text = await rt.docxToText(output);
  const point = text.split('\n').find(line => line.includes('Tax/Assessment & Identification Particulars:'));
  assert(point, `${variantId}: keep the original identification point`);
  assert.match(point, /The Schedule Property.*identified.*concerned.*Authority.*Assessment No\./i);
  for (const pair of pairs) assert(point.includes(`${pair.ptin} bearing H.No.${pair.houseNo}`), `${variantId}: retain each source-supported pair`);
  assert.equal((point.match(/bearing H\.No\./g) || []).length, count);
  if (instrumentId === 'sale') await writeFile(`tmp/assessment-identification-qa/${count}-pairs.docx`, output);
}
console.log('PASS: 1, 2 and 3 H.No./PTIN pairs retain the source identification point with only bearing H.No. additions in Sale, Gift, General/Family GPA and Agreement downloads.');
