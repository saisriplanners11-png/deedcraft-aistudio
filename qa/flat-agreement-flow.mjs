import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const flatInputs = rt.groupsForStep(3, 'Flat').flatMap(group => group.fields.map(field => field.id));
for (const field of ['developmentDocNo','developmentDocDate','developmentSro','supplementalDocNo','supplementalSro','stiltFloors','upperFloors']) assert(flatInputs.includes(field), `${field} remains available in the flat property inputs`);
for (const field of ['developmentSroCode','supplementalSroCode']) assert(!flatInputs.includes(field) && rt.ALL_FIELDS.find(item => item.id === field)?.hidden, `${field} remains stored for its Word binding without a separate visible input`);
const linkSroCode = rt.LINK_OPTIONS.find(item => item.id === 'linkDoc')?.fields.find(field => field.id === 'linkSroCode');
assert(linkSroCode?.hidden, 'link document SRO code remains separate in storage without a second visible field');
for (const optionId of ['rectificationDeed','supplementalDeed']) {
 const option = rt.LINK_OPTIONS.find(item => item.id === optionId);
 assert(option?.fields.some(field => field.id === optionId + 'Sro'), `${optionId} SRO name remains available in its enclosure`);
 assert(option?.fields.find(field => field.id === optionId + 'SroCode')?.hidden, `${optionId} code is stored for its existing template placeholder without a separate visible box`);
}
const templateBytes = new Uint8Array(await readFile(new URL('../sale-deed-template-v10.docx', import.meta.url)));
const validation = await rt.validateSaleDeedTemplate(templateBytes);
const input = (suffix, date) => { const titleSuffix = suffix[0] + suffix.slice(1).toLowerCase(); return { developmentDocNo: `DEVELOPMENT-${suffix}`, developmentDocDate: date, developmentSro: `Development Office ${titleSuffix}`, developmentSroCode: `DEV-CODE-${suffix}`, supplementalDocNo: `ALLOTMENT-${suffix}`, supplementalSro: `Allotment Office ${titleSuffix}`, supplementalSroCode: `SUP-CODE-${suffix}`, stiltFloors: '2', upperFloors: '7' }; };
for (const mode of ['ordinary', 'gpa', 'agpa']) for (const stage of ['semi', 'finished']) for (const numberOnly of [false, true]) {
 const state = rt.sampleState(`${mode}-flat-${stage}`);
 state.form = { ...state.form, ...input('ONE', numberOnly ? '' : '2024-02-03') };
 state.additionalSchedules = [{ id: 'other-flat', category: 'Flat', unit: 'Sq. Yards', docNames: [], values: { ...state.form, flatNo: '204', ...input('TWO', numberOnly ? '' : '2025-04-05') } }];
 const schedules = rt.scheduleMergesFor(state);
 for (const source of [{ kind: 'built-in' }, { kind: 'custom', name: 'Replacement.docx', bytes: templateBytes, hash: 'qa', validation }]) {
  const output = await rt.fillSaleDeed(rt.mergeValues(state), schedules[0].variant, rt.rewritesFor(state), schedules, source);
  assert.deepEqual(output.unmapped, []);
  const text = await rt.docxToText(new Uint8Array(await output.blob.arrayBuffer()));
  const flows = text.split(/FLOW OF TITLE & LINK DEED DETAILS[^\n]*/).slice(1);
  assert.equal(flows.length, 2);
  for (const [index, suffix] of ['ONE', 'TWO'].entries()) {
   const block = flows[index].split('CONSIDERATION & PAYMENT TERMS')[0];
   for (const value of Object.values(input(suffix, numberOnly ? '' : index ? '05-04-2025' : '03-02-2024'))) assert(block.includes(value), `${mode}/${stage}/${source.kind}/${suffix}: missing ${value}`);
   assert(!block.includes(index ? 'DEVELOPMENT-ONE' : 'DEVELOPMENT-TWO'), 'Agreement values must not leak between properties');
   assert.match(block, /2 Stilt \+ 7 Upper Floors/);
   assert.equal((block.match(/jointly executed a Registered Development Agreement/g) || []).length, 1);
   assert.equal((block.match(/was allotted to the share of the Vendor/g) || []).length, 1);
   assert(block.indexOf(`DEVELOPMENT-${suffix}`) < block.indexOf(`ALLOTMENT-${suffix}`));
   assert(block.indexOf(`ALLOTMENT-${suffix}`) < block.indexOf('after duly satisfying'));
   if (numberOnly) assert.doesNotMatch(block.match(/[^\n]*jointly executed[^\n]*/)?.[0] || '', /dated\s*:\s*[,\.]/i);
  }
 }
}
let draft = rt.newDraft();
for (const [id, value] of Object.entries({ category: 'Flat', flatStage: 'Semi-Finished', ...input('SAVED', '2024-02-03') })) draft = rt.draftReducer(draft, { type: 'manual', key: `property|primary|${id}`, value });
const restored = rt.appStateFor(rt.draftReducer(rt.newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) }));
for (const [id, value] of Object.entries(input('SAVED', '2024-02-03'))) assert.equal(restored.form[id], value);
assert.equal(rt.scheduleMergesFor(restored)[0].titleValues['Document Date'], '03-02-2024');
for (const stage of ['semi', 'finished']) for (const present of ['development', 'supplemental', 'neither']) {
 const state = rt.sampleState(`ordinary-flat-${stage}`);
 Object.assign(state.form, { developmentDocNo: present === 'development' ? 'DGPA-NUMBER-ONLY' : '', developmentDocDate: '', supplementalDocNo: present === 'supplemental' ? 'SUP-NUMBER-ONLY' : '', stiltFloors: '', upperFloors: '' });
 const schedules = rt.scheduleMergesFor(state);
 const result = await rt.fillSaleDeed(rt.mergeValues(state), schedules[0].variant, rt.rewritesFor(state), schedules);
 const text = await rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
 assert.equal(text.includes('jointly executed a Registered Development Agreement'), present === 'development');
 assert.equal(text.includes('was allotted to the share of the Vendor'), present === 'supplemental');
 assert.doesNotMatch(text, /construction of\s+Stilt\s*\+/);
}
console.log('PASS: independent DGPA/supplemental recitals in finished and semi-finished Sale/GPA/AGPA flats, numbers without dates, default/replacement templates, multiple properties and saved drafts.');


