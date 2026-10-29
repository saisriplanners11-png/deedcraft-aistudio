import assert from 'node:assert/strict';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const instruments = [
  ['sale', 'outright-absolute-sale-deed', 'Sale', 'Outright Absolute Sale Deed'],
  ['sale', 'sale-deed-by-gpa-holder', 'Sale', 'Sale Deed by GPA Holder'],
  ['sale', 'sale-through-existing-agpa', 'Sale', 'Sale through Existing AGPA'],
  ['gift', 'gift-settlement-family', 'Gift', 'Gift Settlement Family'],
  ['gift', 'municipal-gift', 'Gift', 'Municipal Gift'],
  ['agreement_of_sale', 'agreement-of-sale-with-possession', 'Agreement of Sale Cum GPA', 'With Possession'],
  ['agreement_of_sale', 'without-possession', 'Agreement of Sale Cum GPA', 'Without Possession'],
  ['power_of_attorney', 'general-power-of-attorney', 'GPA/Power of Attorney', 'General Power of Attorney'],
];
let cases = 0;
for (const [instrumentId, candidateVariant, deedType, draft] of instruments) for (const property of ['plot', 'house-finished', 'flat-finished']) for (const margin of ['100', '50', '20', 'None']) {
  if (candidateVariant === 'municipal-gift' && property !== 'plot') continue;
  const state = rt.sampleState((candidateVariant === 'sale-deed-by-gpa-holder' ? 'gpa-' : candidateVariant === 'sale-through-existing-agpa' ? 'agpa-' : 'ordinary-') + property);
  Object.assign(state, { deedType, draft });
  Object.assign(state.form, { stampPaperMargin: margin, giftRelationship: 'daughter', poaRelationship: 'son' });
  // One vendor and two vendees test independent agreement on both sides.
  state.additionalClaimants = [{ id: 'second-buyer', docNames: [], values: { ...state.form, claimantName: 'SECOND BUYER' } }];
  state.linkRecordsBySchedule = { primary: [{ id: 'nala', docNames: [], values: { linkOption: 'nala', nalaOrderNo: 'NALA-42', nalaExtent: '00-02' } }] };
  if (candidateVariant === 'municipal-gift') { state.additionalClaimants = []; Object.assign(state.form, { village: 'Municipal Village', localAuthorityType: 'Municipal Council' }); }
  const values = rt.mergeValues(state), schedules = rt.scheduleMergesFor(state), rewrites = rt.rewritesFor(state);
  // The renderer receives the selected variant explicitly, as the compiler does.
  values['Gift Variant'] = candidateVariant;
  values['Agreement Possession Variant'] = candidateVariant === 'without-possession' ? 'without-possession' : 'with-possession';
  values['Poa Variant'] = candidateVariant;
  const result = instrumentId === 'gift' ? await rt.fillGiftDeed(values, rewrites, schedules) : instrumentId === 'agreement_of_sale' ? await rt.fillAgreementSaleGpaDeed(values, rewrites, schedules) : instrumentId === 'power_of_attorney' ? await rt.fillGeneralPoaDeed(values, rewrites, schedules) : await rt.fillSaleDeed(values, schedules[0].variant, rewrites, schedules);
  const bytes = new Uint8Array(await result.blob.arrayBuffer()), entries = await rt.readZip(bytes);
  const xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml').data);
  const text = await rt.docxToText(bytes), label = `${candidateVariant} ${property} ${margin}`;
  assert.deepEqual(result.unmapped, [], label);
  const tops = [...xml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)].map(section => section[0].match(/w:top="(\d+)"/)?.[1]);
  assert.equal(tops[0], ({ '100': '8352', '50': '8640', '20': '8640', None: '1080' })[margin], label);
  assert(!tops.slice(1).includes('8352') && !tops.slice(1).includes('8640'), label + ': continuation margins');
  if (instrumentId === 'gift' && candidateVariant !== 'municipal-gift') assert.doesNotMatch(text.slice(text.indexOf('SCHEDULE OF PROPERTY')), /NALA converted extent:/i, label);
  else assert.match(text.slice(text.indexOf('SCHEDULE OF PROPERTY')), /NALA converted extent: 242 Sq\. Yards\./, label);
  assert.doesNotMatch(text, /\b(?:Vendor|Vendee|Executant|Principal|Attorney|First Party|Second Party)\/s\b|\bhas\/have\b|\bis\/are\b|\bI\/We\b/i, label);
  if (candidateVariant === 'municipal-gift') { assert.match(text, /SAMPLE PURCHASER/, label); assert.doesNotMatch(text, /MUNICIPAL COUNCIL, SIRCILLA|Represented by its Commissioner/, label); }
  if (instrumentId === 'sale') { assert.match(text, /Vendor has agreed/, label); assert.match(text, /Vendees have agreed/, label); }
  cases++;
}
// Guardian identity and court permission must survive the party-repeat machinery.
for (const minorSide of ['executant', 'claimant']) {
  const state = rt.sampleState('ordinary-plot');
  Object.assign(state.form, { [minorSide + 'PartyType']: 'Minor', [minorSide + 'Dob']: '2015-01-02', [minorSide + 'GuardianName']: 'GUARDIAN PERSON', [minorSide + 'GuardianRelationship']: 'Mother', [minorSide + 'GuardianDob']: '1980-01-02', [minorSide + 'GuardianAadhaar']: '123456789012', [minorSide + 'CourtOrderNo']: 'COURT-42', [minorSide + 'CourtName']: 'District Court', [minorSide + 'CourtOrderDate']: '2026-01-02', [minorSide + 'CourtOrderPermitsExecution']: 'Yes' });
  const result = await rt.fillSaleDeed(rt.mergeValues(state), 'IF OPEN PLOT', rt.rewritesFor(state), rt.scheduleMergesFor(state));
  const text = await rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
  assert.equal((text.match(/a minor represented by Mother: GUARDIAN PERSON/g) || []).length, 1);
  if (minorSide === 'executant') assert.match(text, /COURT-42 dated 02-01-2026/);
}
console.log(`PASS: ${cases} deed/property/margin combinations, per-side grammar, NALA schedule conversion, municipal capitals and minor guardian/court recitals.`);
