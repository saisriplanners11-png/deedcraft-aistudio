import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const xmlText = xml => xml.replace(/<[^>]*>/g, '');

// A replacement can contain wording removed in an earlier session. The saved
// rules must still win, including when that wording is literal rather than a tag.
async function replacement(version, share = '50%', unsupported = false) {
  const entries = await rt.readZip(new Uint8Array(await readFile(new URL(`../gift-deed-template-${version}.docx`, import.meta.url))));
  const document = entries.find(entry => entry.name === 'word/document.xml');
  document.data = new TextEncoder().encode(new TextDecoder().decode(document.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const text = xmlText(paragraph);
    if (/EXECUTANT NAME/.test(text)) paragraph = rt.replaceRunText(paragraph, /<Executant Adhar Number>/gi, match => match[0] + (unsupported ? ', holding undivided shares as half of the property' : `, holding an undivided share of ${share} in the schedule property`));
    if (/CLAIMANT NAME/.test(text)) paragraph = rt.replaceRunText(paragraph, /<\s*Claimant Adhar Number>/gi, match => match[0] + ', holding 60% ownership share in the schedule property');
    if (/SCHEDULE OF PROPERTY/.test(text)) paragraph += '<w:p><w:r><w:t>The Donors gift this Schedule Property in the following undivided shares: OWNER A 50%; OWNER B 50%.</w:t></w:r></w:p>';
    if (/^\s*All that/i.test(text)) paragraph = rt.replaceRunText(paragraph, /[\s\S]+/, match => match[0] + ' NALA converted extent: 242 Sq. Yards.');
    // Existing application-owned title/category and relationship rules must
    // work even if the new draft has a stale category and no relationship line.
    if (/WHEREAS the Donee\/s is\/are the/i.test(text)) paragraph = rt.replaceRunText(paragraph, /[\s\S]+/, () => '');
    return paragraph;
  }));
  const bytes = await rt.writeZip(entries);
  const validation = await rt.validateGiftDeedTemplate(bytes);
  return { kind: 'custom', name: `Replacement ${version}.docx`, hash: `preserve-${version}`, bytes, validation };
}

let cases = 0;
for (const version of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) for (const property of ['plot', 'house-finished', 'flat-finished']) {
  const source = await replacement(version, version === 'v5' ? '<Executant Share>' : '50%');
  assert(source.validation.valid, source.validation.errors.join(' '));
  const state = rt.sampleState('ordinary-' + property); state.deedType = 'Gift';
  Object.assign(state.form, { giftRelationship: 'friend', executionDate: '2026-10', stampPaperMargin: '100', executantGender: 'Female', claimantGender: 'Male', consid: '765432', nearAdjacent: 'Adjacent', nearHNo: 'LANDMARK-99', executantPan: 'ABCDE1234F', claimantPan: 'PQRST5678L' });
  state.vendorSharesBySchedule = { primary: { primary: '100' } };
  state.vendeeSharesBySchedule = { primary: { primary: '100' } };
  state.linkRecordsBySchedule = { primary: [{ id: 'nala', docNames: [], values: { linkOption: 'nala', nalaOrderNo: 'NALA-42', nalaExtent: '00-02' } }] };
  const before = JSON.stringify(state);
  const values = { ...rt.mergeValues(state), 'Gift Variant': 'non-family-gift' };
  const result = await rt.fillGiftDeed(values, rt.rewritesFor(state), rt.scheduleMergesFor(state), source);
  const bytes = new Uint8Array(await result.blob.arrayBuffer()), text = await rt.docxToText(bytes);
  const entries = await rt.readZip(bytes), xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml').data);
  assert.deepEqual(result.unmapped, []);
  assert.match(text, /GIFT SETTLEMENT DEED IN FAVOUR OF OTHERS/);
  assert.match(text, /WHEREAS the Donee is the friend of the Donor\./);
  assert.match(text, /__-10-2026/); assert.match(xml, /w:top="8352"/);
  assert.match(text, /ABCDE1234F/); assert.match(text, /PQRST5678L/);
  assert.match(text, /7,65,432/); assert.match(text, /without any monetary consideration/);
  assert.match(text, /NALA-42/); assert.match(text, /through her\./);
  assert.doesNotMatch(text, /holding (?:an? )?undivided share|holding 60%|following undivided shares|NALA converted extent:|50%|60%|100%/i);
  assert.match(text, /adjacent house No\.\s*LANDMARK-99/i);
  const valuation = text.slice(text.search(/STATEMENT OF MARKET VALUE|ANNEXURE/));
  if (property !== 'plot') assert.doesNotMatch(valuation, /(?:near|adjacent)\s+(?:house\s*no|h\.no)/i);
  if (property.includes('flat')) assert.match(text, /30 Sq.yds equivalent to 25.08 square meters/);
  assert.equal(JSON.stringify(state), before, 'Rendering must not erase saved facts or share allocations');
  cases++;
}
const unsupported = await replacement('v5', '50%', true);
assert.equal(unsupported.validation.valid, false);
assert(unsupported.validation.errors.some(error => /unsupported party share wording/.test(error)));

// Guardians and their court/ward details must survive both new sources, for
// both roles, and for both ways of entering a minor's representation.
for (const municipal of [false, true]) for (const side of ['executant', 'claimant']) for (const type of ['Guardian', 'Minor']) {
  const state = rt.sampleState('ordinary-plot'); state.deedType = 'Gift'; state.draft = municipal ? 'Municipal Gift' : 'Gift Settlement Family';
  Object.assign(state.form, { giftRelationship: 'daughter', village: 'mixed case village', localAuthorityType: 'Municipal Council', extentSqYards: '30', [side + 'PartyType']: type, [side + 'Name']: type === 'Guardian' ? 'guardian person' : 'minor child', [side + 'Dob']: type === 'Guardian' ? '1980-01-02' : '2015-01-02', [side + 'Aadhaar']: '123456789012', [side + 'WardName']: 'minor child', [side + 'WardDob']: '2015-01-02', [side + 'GuardianName']: 'guardian person', [side + 'GuardianDob']: '1980-01-02', [side + 'GuardianAadhaar']: '123456789012', [side + 'GuardianRelationship']: 'Mother', [side + 'CourtOrderNo']: 'COURT-42', [side + 'CourtName']: 'District Court', [side + 'CourtOrderDate']: '2026-01-02', [side + 'CourtOrderPermitsExecution']: 'Yes' });
  const variantId = municipal ? 'municipal-gift' : 'family-gift';
  const compiled = rt.compileDeed({ instrumentId: 'gift', variantId, snapshotHash: 'preservation', values: rt.mergeValues(state), rewrites: rt.rewritesFor(state), schedules: rt.scheduleMergesFor(state), unresolvedWarnings: [] });
  const { result } = await rt.renderArtifact(compiled, 'docx');
  const text = await rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
  assert.deepEqual(result.unmapped, []);
  assert.match(text, /GUARDIAN PERSON/); assert.match(text, /MINOR CHILD/); assert.match(text, /Mother/);
  if (side === 'executant') assert.match(text, /COURT-42 dated 02-01-2026/);
  if (municipal) {
    assert.match(text, /MIXED CASE VILLAGE/); assert.match(text, /30 square yards equivalent to 25.08 square meters/);
    assert.doesNotMatch(text, /Represented by its Commissioner|MUNICIPAL COUNCIL, SIRCILLA|FAMILY MEMBER|ANNEXURE|WHEREAS the Donee is the/);
  }
  cases++;
}
console.log(`PASS: ${cases} Gift preservation cases: replacement sources cannot restore omitted shares/NALA; titles, relationships, dates, margins, values, genders, PANs, land UDS, saved facts and Municipal/Guardian output survive.`);
