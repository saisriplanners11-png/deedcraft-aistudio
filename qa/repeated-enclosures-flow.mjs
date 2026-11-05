import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
await mkdir('tmp/repeated-enclosures-qa', { recursive: true });
import { enclosureFixture } from './repeated-enclosures-fixtures.mjs';
const variants = [
  ['sale', 'outright-absolute-sale-deed', 'Sale'],
  ['gift', 'family-gift', 'Gift'],
  ['power_of_attorney', 'general-power-of-attorney', 'GPA/Power of Attorney'],
  ['power_of_attorney', 'general-power-of-attorney-family', 'GPA/Power of Attorney'],
  ['agreement_of_sale', 'with-possession', 'Agreement of Sale Cum GPA'],
  ['agreement_of_sale', 'without-possession', 'Agreement of Sale Cum GPA'],
];
for (const [instrumentId, variantId, deedType] of variants) {
  const state = rt.sampleState('ordinary-open');
  state.deedType = deedType;
  Object.assign(state.form, { giftRelationship: 'daughter', poaRelationship: 'son' });
  state.additionalSchedules = [{ id: 'second', docNames: [], category: state.category, unit: 'Sq. Yards', values: { ...state.form, plotNo: 'SECOND-PLOT' } }];
  state.linkRecordsBySchedule = Object.fromEntries(['primary', 'second'].map(scope => [scope, [1, 2, 3].flatMap(index => enclosureFixture(scope, index))]));
  const before = JSON.stringify(state);
  const compiled = rt.compileDeed({ instrumentId, variantId, snapshotHash: 'repeated-enclosures', values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] }, { kind: 'built-in' });
  const { result } = await rt.renderArtifact(compiled, 'docx');
  assert.deepEqual(result.unmapped, []);
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const text = await rt.docxToText(output);
  for (const scope of ['primary', 'second']) for (const index of [1, 2, 3]) for (const prefix of ['TITLE', 'RECT', 'SUPP', 'VLT', 'LAYOUT', 'APP', 'PROC', 'PASSBOOK', 'KHATA', 'NALA', 'RECEIPT', 'PERMIT']) {
    assert(text.includes(`${prefix}-${scope}-${index}`), `${variantId}: retain ${prefix}-${scope}-${index}`);
  }
  for (const prefix of ['VLT', 'LAYOUT', 'APP', 'PROC', 'PASSBOOK', 'NALA', 'RECEIPT', 'PERMIT']) for (const scope of ['primary', 'second']) for (const index of [1, 2, 3]) {
    const line = text.split('\n').find(line => line.includes(`${prefix}-${scope}-${index}`));
    const other = index === 1 ? 2 : 1;
    assert(!line.includes(`${prefix}-${scope}-${other}`), `${variantId}: keep independent source recitals`);
    if (['APP', 'PROC', 'NALA', 'RECEIPT', 'PERMIT'].includes(prefix)) assert(line.includes(`03-02-202${index}`), `${prefix}: retain own date`);
  }
  assert.equal(JSON.stringify(state), before);
  if (instrumentId === 'sale') await writeFile('tmp/repeated-enclosures-qa/all-options.docx', output);
}
console.log('PASS: every Step 2 option retains three separate records in two properties across six deed variants, with each enclosure’s own values and dates in source-styled download recitals.');
