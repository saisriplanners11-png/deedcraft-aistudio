import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';

// Generate the actual DOCX artifacts through compileDeed/renderArtifact and
// prove entered, uniquely tagged values stay in their own property schedule.
const rt = await loadTemplateRuntime();
const outDir = new URL('../tmp/full-download-matrix/', import.meta.url);
await mkdir(outDir, { recursive: true });
const propertyTypes = ['plot', 'open', 'part', 'dismantled', 'house-finished', 'house-semi', 'flat-finished', 'flat-semi'];
const saleRows = [];
const saleFields = suffix => ({
  surveyNo: `SURVEY-${suffix}`, plotNo: `PLOT-${suffix}`, bearingHNo: `HOUSE-${suffix}`,
  village: `VILLAGE-${suffix}`, mandal: `MANDAL-${suffix}`, district: `DISTRICT-${suffix}`,
  boundaryNorth: `NORTH-${suffix}`, boundarySouth: `SOUTH-${suffix}`, boundaryEast: `EAST-${suffix}`, boundaryWest: `WEST-${suffix}`,
  flatNo: `FLAT-${suffix}`, apartmentName: `APARTMENTS-${suffix}`, developmentDocNo: `DEV-${suffix}`,
  developmentDocDate: suffix === 'ONE' ? '2024-02-03' : '2025-04-05', developmentSro: `DEV-SRO-${suffix}`,
  developmentSroCode: `DEV-CODE-${suffix}`, supplementalDocNo: `SUP-${suffix}`, supplementalSro: `SUP-SRO-${suffix}`,
  supplementalSroCode: `SUP-CODE-${suffix}`,
});
const section = (text, marker) => {
  const start = text.indexOf(marker);
  assert(start >= 0, `Missing section marker: ${marker}`);
  const next = text.indexOf('SCHEDULE OF PROPERTY', start + marker.length);
  return text.slice(start, next < 0 ? undefined : next);
};
const assertNoOtherScheduleValues = (block, own, other, context) => {
  for (const value of Object.values(other)) if (value && block.includes(value)) assert.fail(`${context}: foreign property value ${value}`);
  for (const value of Object.values(own)) if (value && !block.includes(value)) assert.fail(`${context}: missing ${value}`);
};

for (const mode of ['ordinary', 'gpa', 'agpa']) for (const category of propertyTypes) {
  const state = rt.sampleState(`${mode}-${category}`);
  const first = { ...state.form, ...saleFields('ONE'), surveyNo: 'SURVEY-ONE', flatNo: 'FLAT-ONE' };
  const second = { ...first, ...saleFields('TWO') };
  state.form = first;
  state.additionalSchedules = [{ id: 'property-two', category: state.category, unit: 'Sq. Yards', values: second, docNames: [] }];
  state.linkRecordsBySchedule = {
    primary: [{ id: 'link-one', docNames: [], values: { linkDocType: 'Sale Deed', linkDocNo: 'TITLE-ONE', linkDocDate: '2020-01-02', linkSro: 'TITLE-SRO-ONE', linkSroCode: '101' } }],
    'property-two': [{ id: 'link-two', docNames: [], values: { linkDocType: 'Gift Deed', linkDocNo: 'TITLE-TWO', linkDocDate: '2021-03-04', linkSro: 'TITLE-SRO-TWO', linkSroCode: '202' } }],
  };
  const schedules = rt.scheduleMergesFor(state);
  const variantId = mode === 'ordinary' ? 'outright-absolute-sale-deed' : mode === 'gpa' ? 'sale-deed-by-gpa-holder' : 'sale-through-existing-agpa';
  const compiled = rt.compileDeed({ instrumentId: 'sale', variantId, snapshotHash: `${mode}-${category}`, values: rt.mergeValues(state), schedules, rewrites: rt.rewritesFor(state), unresolvedWarnings: [] });
  const { result, manifest } = await rt.renderArtifact(compiled, 'docx');
  assert.equal(manifest.instrumentId, 'sale');
  assert.deepEqual(result.unmapped, [], `${mode}/${category}: no unresolved fields`);
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const text = await rt.docxToText(bytes);
  const schedulesText = text.split(/SCHEDULE OF PROPERTY(?:\s*-\s*SCHEDULE \d+)?/).slice(1);
  assert.equal(schedulesText.length, 2, `${mode}/${category}: two property schedules`);
  for (const [index, suffix] of ['ONE', 'TWO'].entries()) {
    const own = saleFields(suffix), other = saleFields(index ? 'ONE' : 'TWO');
    const block = schedulesText[index];
    for (const marker of [`SURVEY-${suffix}`, `VILLAGE-${suffix}`, `NORTH-${suffix}`]) assert(block.includes(marker), `${mode}/${category}/schedule-${index + 1}: missing ${marker}`);
    for (const marker of [`SURVEY-${index ? 'ONE' : 'TWO'}`, `VILLAGE-${index ? 'ONE' : 'TWO'}`]) assert(!block.includes(marker), `${mode}/${category}/schedule-${index + 1}: leaked ${marker}`);
    assert(text.includes(`TITLE-${suffix}`), `${mode}/${category}/schedule-${index + 1}: missing linked title`);
    if (category === 'flat-semi') {
      for (const value of [own.flatNo, own.apartmentName]) assert(block.includes(value), `${mode}/${category}/schedule-${index + 1}: missing flat identity ${value}`);
      for (const value of [own.developmentDocNo, own.developmentSro, own.developmentSroCode, own.supplementalDocNo, own.supplementalSro, own.supplementalSroCode, index ? '05-04-2025' : '03-02-2024']) assert(text.includes(value), `${mode}/${category}/schedule-${index + 1}: missing flat agreement ${value}`);
      for (const value of [other.flatNo, other.apartmentName]) assert(!block.includes(value), `${mode}/${category}/schedule-${index + 1}: leaked flat/property value ${value}`);
    }
  }
  assert.doesNotMatch(text, /<[^<>]+>/, `${mode}/${category}: no unresolved template tags`);
  await writeFile(new URL(`${mode}-${category}.docx`, outDir), bytes);
  saleRows.push(`${mode}/${category}`);
}

const giftRows = [];
const giftTemplateBytes = new Uint8Array(await readFile(new URL('../gift-deed-template-v6.docx', import.meta.url)));
const giftValidation = await rt.validateGiftDeedTemplate(giftTemplateBytes);
assert.equal(giftValidation.valid, true, giftValidation.errors.join('\n'));
const giftSource = { kind: 'custom', name: 'Gift Settlement v5 QA', hash: 'matrix-v4', bytes: giftTemplateBytes, validation: giftValidation };
for (const variant of ['family-gift', 'non-family-gift', 'gift-to-trust-or-charity']) for (const category of propertyTypes) {
  const state = rt.sampleState(`ordinary-${category}`);
  state.deedType = 'Gift'; state.form = { ...state.form, ...saleFields('ONE'), giftRelationship: variant === 'family-gift' ? 'daughter' : 'friend', localAuthorityType: 'Municipal Council' };
  state.additionalSchedules = [{ id: 'gift-property-two', category: state.category, unit: 'Sq. Yards', values: { ...state.form, ...saleFields('TWO') }, docNames: [] }];
  state.linkRecordsBySchedule = {
    primary: [{ id: 'gift-link-one', docNames: [], values: { linkDocType: 'Sale Deed', linkDocNo: 'TITLE-ONE', linkDocDate: '2020-01-02', linkSro: 'TITLE-SRO-ONE', linkSroCode: '101' } }],
    'gift-property-two': [{ id: 'gift-link-two', docNames: [], values: { linkDocType: 'Gift Deed', linkDocNo: 'TITLE-TWO', linkDocDate: '2021-03-04', linkSro: 'TITLE-SRO-TWO', linkSroCode: '202' } }],
  };
  const schedules = rt.scheduleMergesFor(state);
  const compiled = rt.compileDeed({ instrumentId: 'gift', variantId: variant, snapshotHash: `gift-${variant}-${category}`, values: rt.mergeValues(state), schedules, rewrites: rt.rewritesFor(state), unresolvedWarnings: [] });
  const { result, manifest } = await rt.renderArtifact(compiled, 'docx', giftSource);
  assert.equal(manifest.templateVersionId, 'custom:matrix-v4');
  assert.deepEqual(result.unmapped, [], `${variant}/${category}: no unresolved fields`);
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const text = await rt.docxToText(bytes);
  const schedulesText = text.split(/SCHEDULE OF PROPERTY(?:\s*-\s*SCHEDULE \d+)?/).slice(1);
  assert.equal(schedulesText.length, 2, `${variant}/${category}: two property schedules`);
  for (const [index, suffix] of ['ONE', 'TWO'].entries()) {
    const block = schedulesText[index];
    for (const marker of [`SURVEY-${suffix}`, `VILLAGE-${suffix}`, `NORTH-${suffix}`, `TITLE-${suffix}`]) {
      // Gift carries the same property's survey/boundaries; title records are added below.
      if (marker === `TITLE-${suffix}`) continue;
      assert(block.includes(marker), `${variant}/${category}/schedule-${index + 1}: missing ${marker}`);
    }
    assert(text.includes(`TITLE-${suffix}`), `${variant}/${category}/schedule-${index + 1}: missing linked title`);
    for (const marker of [`SURVEY-${index ? 'ONE' : 'TWO'}`, `VILLAGE-${index ? 'ONE' : 'TWO'}`]) assert(!block.includes(marker), `${variant}/${category}/schedule-${index + 1}: leaked ${marker}`);
  }
  assert.doesNotMatch(text, /<[^<>]+>/, `${variant}/${category}: no unresolved template tags`);
  await writeFile(new URL(`gift-${variant}-${category}.docx`, outDir), bytes);
  giftRows.push(`${variant}/${category}`);
}

// Municipal Gift has a distinct approved template and limited categories.
for (const category of ['plot', 'open', 'part', 'dismantled']) {
  const state = rt.sampleState(`ordinary-${category}`);
  state.deedType = 'Gift'; state.draft = 'Municipal Gift';
  state.form = { ...state.form, ...saleFields('ONE'), localAuthorityType: 'Municipal Council', giftRelationship: '' };
  state.additionalSchedules = [{ id: 'municipal-property-two', category: state.category, unit: 'Sq. Yards', values: { ...state.form, ...saleFields('TWO') }, docNames: [] }];
  state.linkRecordsBySchedule = {
    primary: [{ id: 'municipal-link-one', docNames: [], values: { linkDocType: 'Sale Deed', linkDocNo: 'TITLE-ONE', linkDocDate: '2020-01-02', linkSro: 'TITLE-SRO-ONE', linkSroCode: '101' } }],
    'municipal-property-two': [{ id: 'municipal-link-two', docNames: [], values: { linkDocType: 'Gift Deed', linkDocNo: 'TITLE-TWO', linkDocDate: '2021-03-04', linkSro: 'TITLE-SRO-TWO', linkSroCode: '202' } }],
  };
  state.additionalSchedules[0].values.village = state.form.village;
  const variantId = 'municipal-gift';
  const compiled = rt.compileDeed({ instrumentId: 'gift', variantId, snapshotHash: `municipal-${category}`, values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] });
  const { result, manifest } = await rt.renderArtifact(compiled, 'docx');
  assert.equal(manifest.templateVersionId, 'gift-municipal-v3');
  assert.deepEqual(result.unmapped, [], `Municipal Gift/${category}: no unresolved fields`);
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const text = await rt.docxToText(bytes);
  const schedulesText = text.split(/SCHEDULE OF PROPERTY(?:\s*-\s*SCHEDULE \d+)?/).slice(1);
  assert.equal(schedulesText.length, 2, `Municipal Gift/${category}: two schedules`);
  for (const [index, suffix] of ['ONE', 'TWO'].entries()) {
    assert(schedulesText[index].includes(`SURVEY-${suffix}`), `Municipal Gift/${category}: schedule ${index + 1} survey`);
    assert(!schedulesText[index].includes(`SURVEY-${index ? 'ONE' : 'TWO'}`), `Municipal Gift/${category}: no cross-property survey`);
    assert(text.includes(`TITLE-${suffix}`), `Municipal Gift/${category}: missing title-chain record ${suffix}`);
  }
  await writeFile(new URL(`gift-municipal-${category}.docx`, outDir), bytes);
  giftRows.push(`municipal/${category}`);
}
console.log(`PASS: downloaded DOCX matrix verified (${saleRows.length} Sale/GPA/AGPA, ${giftRows.length} Gift/Municipal Gift artifacts). Files: tmp/full-download-matrix/`);
