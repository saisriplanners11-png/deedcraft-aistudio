import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const bytes = new Uint8Array(await readFile(new URL('../sale-deed-template-v10.docx', import.meta.url)));
const validation = await rt.validateSaleDeedTemplate(bytes);
assert(validation.valid, validation.errors.join('\n'));
const source = { kind: 'custom', name: 'Sale v10', bytes, hash: '', validation };
async function render(state) {
  const schedules = rt.scheduleMergesFor(state);
  const result = await rt.fillSaleDeed(rt.mergeValues(state), schedules[0].variant, rt.rewritesFor(state), schedules, source);
  assert.deepEqual(result.unmapped, []);
  return rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
}
for (const mode of ['ordinary', 'gpa', 'agpa']) for (const vendors of [1, 2]) for (const vendees of [1, 2]) {
  const state = rt.sampleState(mode + '-plot');
  if (vendors > 1) state.additionalExecutants = [{ id: 'vendor-2', values: { ...state.form, executantName: 'SECOND VENDOR' }, docNames: [] }];
  if (vendees > 1) state.additionalClaimants = [{ id: 'vendee-2', values: { ...state.form, claimantName: 'SECOND VENDEE' }, docNames: [] }];
  // Deliberately retain an old 50% allocation on single parties to exercise saved drafts.
  state.vendorSharesBySchedule = { primary: { primary: '50', 'vendor-2': '50' } };
  state.vendeeSharesBySchedule = { primary: { primary: '50', 'vendee-2': '50' } };
  if (mode !== 'ordinary' && vendors > 1) state.saleAuthority.attorneys[0].principalIds.push('vendor-2');
  const text = await render(state);
  const [vendorBlock, remaining] = text.split('IN FAVOUR OF');
  assert(remaining, 'Missing party boundary');
  const vendeeBlock = remaining.split('FLOW OF TITLE')[0];
  const share = /holding\s+(?:an\s+)?undivided share of/i;
  assert.equal(share.test(vendorBlock), vendors > 1, `${mode}: ${vendors} vendor(s), ${vendees} vendee(s) — vendor clause`);
  assert.equal(share.test(vendeeBlock), vendees > 1, `${mode}: ${vendors} vendor(s), ${vendees} vendee(s) — vendee clause`);
  if (vendors > 1) assert.match(vendorBlock, /50%/);
  if (vendees > 1) assert.match(vendeeBlock, /50%/);
  if (vendors === 1 && vendees === 1) assert.doesNotMatch(text, /holding\s+(?:an\s+)?undivided share of/i);
}
const singleFlat = await render(rt.sampleState('ordinary-flat-finished'));
assert.match(singleFlat, /undivided share of land/i, 'Flat land-area UDS is independent of party ownership allocation');
const multiSchedule = await render(rt.sampleState('multiple'));
assert.match(multiSchedule, /Schedule 1: 50%; Schedule 2: 50%/);
const entity = rt.sampleState('entity');
assert.doesNotMatch(await render(entity), /holding\s+(?:an\s+)?undivided share of/i);
console.log('PASS: independent vendor/vendee share clauses in 12 ordinary/GPA/AGPA combinations, saved single-party shares, multiple schedules, entities and flat land UDS.');
