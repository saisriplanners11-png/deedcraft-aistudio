import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const templateBytes = new Uint8Array(await readFile(new URL('../sale-deed-template-v10.docx', import.meta.url)));
const validation = await rt.validateSaleDeedTemplate(templateBytes);
const input = (suffix, date) => ({ developmentDocNo: `DEVELOPMENT-${suffix}`, developmentDocDate: date, developmentSro: `DEVELOPMENT OFFICE ${suffix}`, developmentSroCode: `DEV-CODE-${suffix}`, supplementalDocNo: `ALLOTMENT-${suffix}`, supplementalSro: `ALLOTMENT OFFICE ${suffix}`, supplementalSroCode: `SUP-CODE-${suffix}`, stiltFloors: '2', upperFloors: '7' });
for (const mode of ['ordinary', 'gpa', 'agpa']) {
 const state = rt.sampleState(`${mode}-flat-semi`);
 state.form = { ...state.form, ...input('ONE', '2024-02-03') };
 state.additionalSchedules = [{ id: 'other-flat', category: 'Flat', unit: 'Sq. Yards', docNames: [], values: { ...state.form, flatNo: '204', ...input('TWO', '2025-04-05') } }];
 const schedules = rt.scheduleMergesFor(state);
 for (const source of [{ kind: 'built-in' }, { kind: 'custom', name: 'Replacement.docx', bytes: templateBytes, hash: 'qa', validation }]) {
  const output = await rt.fillSaleDeed(rt.mergeValues(state), schedules[0].variant, rt.rewritesFor(state), schedules, source);
  assert.deepEqual(output.unmapped, []);
  const text = await rt.docxToText(new Uint8Array(await output.blob.arrayBuffer()));
  const flows = text.split(/FLOW OF TITLE & LINK DEED DETAILS[^\n]*/).slice(1);
  assert.equal(flows.length, 2);
  for (const [index, suffix] of ['ONE', 'TWO'].entries()) {
   const block = flows[index].split('CONSIDERATION & PAYMENT TERMS')[0];
   for (const value of Object.values(input(suffix, index ? '05-04-2025' : '03-02-2024'))) assert(block.includes(value), `${mode}/${source.kind}/${suffix}: missing ${value}`);
   assert(!block.includes(index ? 'DEVELOPMENT-ONE' : 'DEVELOPMENT-TWO'), 'Agreement values must not leak between properties');
   assert.match(block, /2 Stilt \+ 7 Upper Floors/);
  }
 }
}
let draft = rt.newDraft();
for (const [id, value] of Object.entries({ category: 'Flat', flatStage: 'Semi-Finished', ...input('SAVED', '2024-02-03') })) draft = rt.draftReducer(draft, { type: 'manual', key: `property|primary|${id}`, value });
const restored = rt.appStateFor(rt.draftReducer(rt.newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) }));
for (const [id, value] of Object.entries(input('SAVED', '2024-02-03'))) assert.equal(restored.form[id], value);
assert.equal(rt.scheduleMergesFor(restored)[0].titleValues['Document Date'], '03-02-2024');
console.log('PASS: development and separate allotment agreement values/dates in ordinary/GPA/AGPA semi-finished flat recitals, default/replacement templates, multiple properties and saved drafts.');


