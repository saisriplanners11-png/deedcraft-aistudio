import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const reference = new Uint8Array(await readFile(new URL('../gift-municipal-template-v3.docx', import.meta.url)));
const sourceEntries = await rt.readZip(reference);
assert.deepEqual((await rt.validateMunicipalGiftTemplate(reference)).errors, []);
await mkdir('tmp/municipal-gift/qa', { recursive: true });
function stateFor(id) {
  const state = rt.sampleState(id);
  state.deedType = 'Gift'; state.draft = 'Municipal Gift';
  state.form = { ...state.form, localAuthorityType: 'Municipal Council', village: 'MUNICIPAL VILLAGE', giftRelationship: '', executantPan: 'ABCDE1234F' };
  state.linkRecordsBySchedule = { primary: [{ id: 'title-primary', docNames: [], values: { linkDocType: 'Sale Deed', linkDocNo: 'TITLE-111', linkDocDate: '2020-01-02', linkSro: 'TITLE OFFICE', linkSroCode: '111' } }] };
  return state;
}
for (const id of ['ordinary-plot', 'ordinary-open', 'ordinary-dismantled', 'ordinary-part']) for (const donors of [1, 2]) {
  const state = stateFor(id);
  if (donors === 2) state.additionalExecutants = [{ id: 'donor-2', values: { ...state.form, executantName: 'SECOND DONOR' }, docNames: [] }];
  const compiled = rt.compileDeed({ instrumentId: 'gift', variantId: 'municipal-gift', snapshotHash: 'qa', values: rt.mergeValues(state), rewrites: rt.rewritesFor(state), schedules: rt.scheduleMergesFor(state), unresolvedWarnings: [] });
  const { result, manifest } = await rt.renderArtifact(compiled, 'docx');
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const text = await rt.docxToText(bytes);
  assert.equal(manifest.templateVersionId, 'gift-municipal-v3');
  assert.deepEqual(result.unmapped, []);
  assert.match(text, /SAMPLE PURCHASER/);
  assert.doesNotMatch(text, /Represented by its Commissioner|constitute under Hyderabad Municipal Corporation Act/);
  assert.match(text, /public purpose free of any cost and consideration/);
  assert.match(text, /Sale Deed dated 02-01-2020/);
  assert.match(text, /TITLE-111/); assert.match(text, /TITLE OFFICE \(111\)/);
  assert.match(text, /13-10-2026/); assert.match(text, /ABCDE1234F/);
  assert.doesNotMatch(text, /natural love|Relationship|STATEMENT OF MARKET VALUE|ANNEXURE|FAMILY MEMBER|DD-MM-YYYY|Donor\/s|has\/have|is\/are/);
  assert.equal((text.match(/SCHEDULE OF PROPERTY/g) || []).length, 1);
  if (donors === 2) assert.match(text, /SECOND DONOR/);
  const entries = await rt.readZip(bytes);
  for (const entry of sourceEntries.filter(entry => entry.name !== 'word/document.xml')) assert.deepEqual(entries.find(item => item.name === entry.name)?.data, entry.data, entry.name);
  const xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml').data);
  assert.match(xml, /w:top="8208"/); assert.match(xml, /w:top="1440"/);
  const signature = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(match => match[0]).find(paragraph => /SIGNATURES? OF (?:THE )?DONORS?/i.test(paragraph.replace(/<[^>]*>/g, '')));
  assert(signature); assert.match(signature, /<w:jc w:val="right"\/>/);
  assert.doesNotMatch(signature.replace(/<[^>]*>/g, ''), /^\s|\s{2,}/);
  for (const section of [...xml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)].slice(1)) assert.doesNotMatch(section[0], /<w:pgNumType\b[^>]*w:start=/);

  await writeFile(`tmp/municipal-gift/qa/${id}-${donors}.docx`, bytes);
}
const state = stateFor('ordinary-plot');
state.additionalSchedules = [{ id: 'property-2', category: 'Open Place', unit: 'Sq. Yards', values: { ...state.form, surveyNo: 'SECOND-SURVEY' }, docNames: [] }];
state.linkRecordsBySchedule.primary.push({ id: 'title-extra', docNames: [], values: { linkDocType: 'Gift Deed', linkDocNo: 'TITLE-222', linkDocDate: '2021-03-04', linkSro: 'SECOND TITLE OFFICE', linkSroCode: '222' } });
state.linkRecordsBySchedule['property-2'] = [{ id: 'title-third', docNames: [], values: { linkDocType: 'Partition Deed', linkDocNo: 'TITLE-333', linkDocDate: '2022-05-06', linkSro: 'THIRD TITLE OFFICE', linkSroCode: '333' } }];
const render = state => rt.fillGiftDeed({ ...rt.mergeValues(state), 'Gift Variant': 'municipal-gift' }, rt.rewritesFor(state), rt.scheduleMergesFor(state));
const multiple = await render(state);
const text = await rt.docxToText(new Uint8Array(await multiple.blob.arrayBuffer()));
for (const title of ['TITLE-111', 'TITLE-222', 'TITLE-333', 'SECOND-SURVEY']) assert.ok(text.includes(title), title);
assert.equal((text.match(/Hereinafter called the .Donor/g) || []).length, 1);
assert.equal((text.match(/SCHEDULE OF PROPERTY/g) || []).length, 2);
state.additionalSchedules[0].values.village = 'OTHER VILLAGE';
assert.match(await rt.docxToText(new Uint8Array(await (await render(state)).blob.arrayBuffer())), /OTHER VILLAGE/);
await assert.rejects(() => render(stateFor('ordinary-flat-finished')), /supports open place/);
const missingUlb = stateFor('ordinary-plot'); missingUlb.form.localAuthorityType = '';
await assert.rejects(() => render(missingUlb), /property ULB/);
const damaged = await rt.readZip(reference);
const document = damaged.find(entry => entry.name === 'word/document.xml');
document.data = new TextEncoder().encode(rt.replaceRunText(new TextDecoder().decode(document.data), /<Village>/g, () => 'Unknown recipient'));
assert.equal((await rt.validateMunicipalGiftTemplate(await rt.writeZip(damaged))).valid, false);
for (const id of ['ordinary-plot', 'ordinary-open', 'ordinary-dismantled', 'ordinary-part']) {
 const state = stateFor(id);Object.assign(state.form,{extentSqYards:'30',claimantName:'ENTERED CLAIMANT',claimantPan:'PQRST5678L'});
 state.unresolvedFields=['extentSqMeters'];
 state.additionalClaimants=[{id:'second',values:{...state.form,claimantName:'SECOND CLAIMANT'},docNames:[]}];
 const output=await render(state),text=await rt.docxToText(new Uint8Array(await output.blob.arrayBuffer()));
 assert.match(text,/30 square yards equivalent to 25\.08 square meters/);
 assert.match(text,/ENTERED CLAIMANT/);assert.match(text,/SECOND CLAIMANT/);assert.match(text,/PQRST5678L/);
 assert.doesNotMatch(text,/Represented by its Commissioner|constitute under Hyderabad Municipal Corporation Act/);
}
console.log('PASS: Municipal Gift full claimant identities, four land schedules with calculated square metres, multiple recipients/properties and independent linked titles; source package formatting preserved.');

for (const version of ['v1', 'v2', 'v3']) for (const entity of [false, true]) for (const mixed of [false, true]) {
 const bytes = new Uint8Array(await readFile(new URL(`../gift-municipal-template-${version}.docx`, import.meta.url)));
 const state = stateFor('ordinary-plot');
 Object.assign(state.form, entity ? { claimantPartyType: 'Firm / LLP', claimantEntityName: 'THE MUNICIPAL COUNCIL, SIRCILLA', claimantName: 'INACTIVE PERSONAL NAME' } : { claimantName: 'THE MUNICIPAL COUNCIL, SIRCILLA' });
 state.additionalClaimants = mixed ? [{ id: 'other', docNames: [], values: { ...state.form, claimantPartyType: 'Individual', claimantName: 'OTHER RECIPIENT', claimantRelativeName: 'OTHER PARENT' } }] : [];
 const before = JSON.stringify(state);
 const source = { kind: 'custom', name: version, bytes, hash: '', validation: await rt.validateMunicipalGiftTemplate(bytes) };
 const result = await rt.fillGiftDeed({ ...rt.mergeValues(state), 'Gift Variant': 'municipal-gift' }, rt.rewritesFor(state), rt.scheduleMergesFor(state), source);
 const text = await rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
 assert.match(text, /THE MUNICIPAL COUNCIL, SIRCILLA, constitute under Hyderabad Municipal Corporation Act 1965\. Represented by its Commissioner/);
 assert.match(text, /include its successors in office and permitted assigns, of the OTHER PART/);
 assert.equal((text.match(/Represented by its Commissioner/g) || []).length, 1);
 if (mixed) { assert.match(text, /OTHER RECIPIENT/); assert.match(text, /OTHER PARENT/); }
 assert.doesNotMatch(text, /INACTIVE PERSONAL NAME|<[^<>]+>/);
 assert.equal(JSON.stringify(state), before);
 if (version === 'v3' && entity) await writeFile('tmp/municipal-gift/qa/council-recipient.docx', new Uint8Array(await result.blob.arrayBuffer()));
}
console.log('PASS: 12 single/mixed council/entity/historical-source cases retain entered council name and fixed definition; mixed recipients and saved facts stay independent.');

for (const version of ['v1', 'v2', 'v3']) {
 const bytes = new Uint8Array(await readFile(new URL(`../gift-municipal-template-${version}.docx`, import.meta.url)));
 const validation = await rt.validateMunicipalGiftTemplate(bytes);
 assert.equal(validation.valid, true, validation.errors.join(' '));
 const state = stateFor('ordinary-open'); state.form.claimantName = 'PRESERVED RECIPIENT';
 const custom = { kind: 'custom', name: `Municipal ${version}`, bytes, hash: version, validation };
 const output = await rt.fillGiftDeed({ ...rt.mergeValues(state), 'Gift Variant': 'municipal-gift' }, rt.rewritesFor(state), rt.scheduleMergesFor(state), custom);
 const text = await rt.docxToText(new Uint8Array(await output.blob.arrayBuffer()));
 assert.deepEqual(output.unmapped, []);
 assert.match(text, /PRESERVED RECIPIENT/);
 assert.doesNotMatch(text, /MUNICIPAL COUNCIL, SIRCILLA|Represented by its Commissioner|FAMILY MEMBER|ANNEXURE/);
}
console.log('PASS: Municipal v1, v2 and v3 custom sources retain entered recipients and remain separate from regular Gift.');
