import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const bytes = new Uint8Array(await readFile(new URL('../sale-deed-template-v10.docx', import.meta.url)));
const validation = await rt.validateSaleDeedTemplate(bytes);
assert(validation.valid, validation.errors.join('\n'));
const source = { kind: 'custom', name: 'Sale v10', bytes, hash: '', validation };
async function render(state, selectedSource = source) {
  const schedules = rt.scheduleMergesFor(state);
  const result = await rt.fillSaleDeed(rt.mergeValues(state), schedules[0].variant, rt.rewritesFor(state), schedules, selectedSource);
  assert.deepEqual(result.unmapped, []);
  return rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
}
for (const mode of ['ordinary', 'gpa', 'agpa']) for (const vendors of [1, 2]) for (const vendees of [1, 2]) {
  const state = rt.sampleState(mode + '-plot');
  if (vendors > 1) state.additionalExecutants = [{ id: 'vendor-2', values: { ...state.form, executantName: 'SECOND VENDOR' }, docNames: [] }];
  if (vendees > 1) state.additionalClaimants = [{ id: 'vendee-2', values: { ...state.form, claimantName: 'SECOND VENDEE' }, docNames: [] }];
  // Explicit percentages appear even for a single party.
  state.vendorSharesBySchedule = { primary: { primary: '50', 'vendor-2': '50' } };
  state.vendeeSharesBySchedule = { primary: { primary: '50', 'vendee-2': '50' } };
  if (mode !== 'ordinary' && vendors > 1) state.saleAuthority.attorneys[0].principalIds.push('vendor-2');
  const text = await render(state);
  const [vendorBlock, remaining] = text.split('IN FAVOUR OF');
  assert(remaining, 'Missing party boundary');
  const vendeeBlock = remaining.split('FLOW OF TITLE')[0];
  const share = /holding\s+(?:an\s+)?undivided share of/i;
  assert.equal(share.test(vendorBlock), true, `${mode}: ${vendors} vendor(s), ${vendees} vendee(s) — vendor clause`);
  assert.equal(share.test(vendeeBlock), true, `${mode}: ${vendors} vendor(s), ${vendees} vendee(s) — vendee clause`);
  if (vendors > 1) assert.match(vendorBlock, /50%/);
  if (vendees > 1) assert.match(vendeeBlock, /50%/);
  if (vendors === 1 && vendees === 1) assert.match(text, /50%/);
}
const singleFlat = await render(rt.sampleState('ordinary-flat-finished'));
assert.match(singleFlat, /undivided share of land/i, 'Flat land-area UDS is independent of party ownership allocation');
const multiSchedule = await render(rt.sampleState('multiple'));
assert.match(multiSchedule, /Schedule 1: 50%; Schedule 2: 50%/);
const entity = rt.sampleState('entity');
assert.doesNotMatch(await render(entity), /holding\s+(?:an\s+)?undivided share of/i);
console.log('PASS: independent vendor/vendee share clauses in 12 ordinary/GPA/AGPA combinations, saved single-party shares, multiple schedules, entities and flat land UDS.');

for (const wording of ['50%', 'short', 'unsupported']) {
  const entries = await rt.readZip(bytes);
  const document = entries.find(entry => entry.name === 'word/document.xml');
  let xml = new TextDecoder().decode(document.data);
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    paragraph = rt.replaceRunText(paragraph, /<(?:Executant|Claimant|Attorney) Share>/gi, () => wording === 'unsupported' ? 'half' : '50%');
    if (wording === 'short') paragraph = rt.replaceRunText(paragraph, /holding an undivided share of 50%/gi, () => 'holding 50% shares');
    return paragraph;
  });
  document.data = new TextEncoder().encode(xml);
  const replacement = { ...source, bytes: await rt.writeZip(entries) };
  for (const mode of ['ordinary', 'gpa', 'agpa']) {
    const state = rt.sampleState(mode + '-plot');
    state.vendorSharesBySchedule = { primary: { primary: '50' } };
    state.vendeeSharesBySchedule = { primary: { primary: '50' } };
    if (wording === 'unsupported') {
      await assert.rejects(() => render(state, replacement), /share clause.*not supported/);
      continue;
    }
    assert.match(await render(state, replacement), /50%/);
    state.additionalExecutants = [{ id: 'vendor-2', values: { ...state.form, executantName: 'SECOND VENDOR' }, docNames: [] }];
    state.additionalClaimants = [{ id: 'vendee-2', values: { ...state.form, claimantName: 'SECOND VENDEE' }, docNames: [] }];
    state.vendorSharesBySchedule = { primary: { primary: '40', 'vendor-2': '60' } };
    state.vendeeSharesBySchedule = { primary: { primary: '40', 'vendee-2': '60' } };
    if (mode !== 'ordinary') state.saleAuthority.attorneys[0].principalIds.push('vendor-2');
    const output = await render(state, replacement);
    assert.match(output, /40%/); assert.match(output, /60%/);
    assert.doesNotMatch(output, /50%/);
    assert.equal(state.vendorSharesBySchedule.primary.primary, '40');
  }
}
console.log('PASS: replacement templates with fixed 50%, alternate wording, 40/60 allocations, stale saved shares and unsupported-clause rejection.');

for (const mode of ['ordinary', 'gpa', 'agpa']) {
  const state = rt.sampleState(mode + '-plot');
  state.additionalExecutants = [{ id: 'vendor-2', values: { ...state.form, executantName: 'SECOND VENDOR' }, docNames: [] }];
  state.additionalClaimants = [{ id: 'vendee-2', values: { ...state.form, claimantName: 'SECOND VENDEE' }, docNames: [] }];
  if (mode !== 'ordinary') state.saleAuthority.attorneys[0].principalIds.push('vendor-2');
  assert.doesNotMatch(await render(state), /holding.*undivided share|following undivided shares|____%/i);
  state.vendeeSharesBySchedule = { primary: { primary: '40', 'vendee-2': '60' } };
  const text = await render(state);
  assert.doesNotMatch(text.split('IN FAVOUR OF')[0], /holding.*undivided share/i);
  assert.match(text.split('IN FAVOUR OF')[1], /40%/);
}
console.log('PASS: blank percentages omit all share clauses for multiple ordinary/GPA/AGPA parties; vendor and vendee entry are independent.');

for (const mode of ['gpa', 'agpa']) {
  const state = rt.sampleState(mode + '-plot');
  state.saleAuthority.attorneys[0].values.SharePercentage = '37.25';
  const text = await render(state);
  assert.match(text, /holding an undivided share of 37\.25%/i);
  state.saleAuthority.attorneys[0].values.SharePercentage = '';
  assert.doesNotMatch(await render(state), /37\.25%|holding.*undivided share/i);
}
console.log('PASS: explicit attorney percentages appear independently of principal count and blank values omit the clause in GPA and AGPA.');

for (const category of ['ordinary-plot', 'ordinary-house-finished', 'ordinary-flat-finished']) {
  const state = rt.sampleState(category); state.deedType = 'Gift'; state.form.giftRelationship = 'daughter';
  state.vendorSharesBySchedule = { primary: { primary: '100' } };
  state.vendeeSharesBySchedule = { primary: { primary: '100' } };
  const output = await rt.fillGiftDeed(rt.mergeValues(state), rt.rewritesFor(state), rt.scheduleMergesFor(state));
  const text = await rt.docxToText(new Uint8Array(await output.blob.arrayBuffer()));
  assert.match(text, /undivided share of 100%/i);
  delete state.vendorSharesBySchedule; delete state.vendeeSharesBySchedule;
  const blank = await rt.fillGiftDeed(rt.mergeValues(state), rt.rewritesFor(state), rt.scheduleMergesFor(state));
  assert.doesNotMatch(await rt.docxToText(new Uint8Array(await blank.blob.arrayBuffer())), /holding.*undivided share|100%/i);
}
console.log('PASS: explicit single-party Gift shares appear for plot, house and flat; blank shares are omitted.');
