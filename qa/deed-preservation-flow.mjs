import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const previews = new URL('../tmp/deed-preservation/', import.meta.url);
await mkdir(previews, { recursive: true });
const modes = [
  ['sale', 'outright-absolute-sale-deed', 'Sale', 'Outright Absolute Sale Deed', 'sale-deed-template-v11.docx', 'ordinary'],
  ['sale', 'sale-deed-by-gpa-holder', 'Sale', 'Sale Deed by GPA Holder', 'sale-deed-template-v11.docx', 'gpa'],
  ['sale', 'sale-through-existing-agpa', 'Sale', 'Sale through Existing AGPA', 'sale-deed-template-v11.docx', 'agpa'],
  ...['family-gift', 'non-family-gift', 'gift-to-trust-or-charity'].map(variant => ['gift', variant, 'Gift', 'Gift Settlement Family', 'gift-deed-template-v6.docx', 'ordinary']),
  ['gift', 'municipal-gift', 'Gift', 'Municipal Gift', 'gift-municipal-template-v3.docx', 'ordinary'],
  ...['with-possession', 'without-possession'].map(variant => ['agreement_of_sale', variant, 'Agreement of Sale Cum GPA', variant === 'with-possession' ? 'With Possession' : 'Without Possession', 'agreement-sale-gpa-template-v4.docx', 'ordinary']),
  ...['general-power-of-attorney', 'general-power-of-attorney-family'].map(variant => ['power_of_attorney', variant, 'GPA/Power of Attorney', variant.endsWith('-family') ? 'General Power of Attorney Family' : 'General Power of Attorney', 'general-poa-template-v3.docx', 'ordinary']),
];
const properties = ['plot', 'open', 'dismantled', 'part', 'house-finished', 'house-semi', 'flat-finished', 'flat-semi'];
const paragraphText = paragraph => paragraph.replace(/<[^>]*>/g, '');
async function changedSource(file, edit) {
  const entries = await rt.readZip(new Uint8Array(await readFile(new URL('../' + file, import.meta.url))));
  const part = entries.find(entry => entry.name === 'word/document.xml');
  part.data = new TextEncoder().encode(edit(new TextDecoder().decode(part.data)));
  return rt.writeZip(entries);
}
const editedSources = new Map();
for (const file of new Set(modes.map(mode => mode[4]))) editedSources.set(file, await changedSource(file, xml => {
  let section = 0;
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const text = paragraphText(paragraph);
    if (file.startsWith('sale-') && /jointly executed a Registered Development Agreement|was allotted to the share of the Vendor/i.test(text)) return '';
    if (/^\s*THIS\b/i.test(text)) paragraph = rt.replaceRunText(paragraph, /DD[-/.]?MM[-/.]?YYYY/g, () => '01-01-2000');
    if (/Market Value of Rs\./i.test(text)) paragraph = rt.replaceRunText(paragraph, /<Market of Value Rs\.\/->/g, () => '99,99,999');
    if (/RELATION NAME/.test(text) && /(?:EXECUTANT|CLAIMANT|PRINCIPAL|ATTORNEY) NAME/.test(text)) {
      paragraph = rt.replaceRunText(paragraph, /,?\s*holding\s+(?:an?\s+)?undivided\s+share\s+of\s*<[^<>]+>(?:\s+in the schedule property)?/gi, () => '');
      paragraph = rt.replaceRunText(paragraph, /(<\s*(Executant|Claimant|Principal|Attorney) Adhar Number>)/gi, match => match[0] + ', holding an undivided share of 88% in the schedule property');
      paragraph = rt.replaceRunText(paragraph, /,?\s*PAN:\s*<\s*(Executant|Claimant|Principal|Attorney) PAN>/gi, () => '');
    }
    if (/SCHEDULE OF PROPERTY/.test(text)) paragraph += '<w:p><w:r><w:t>The vendors convey this Schedule Property in the following undivided shares: STALE OWNER 88%.</w:t></w:r></w:p>';
    if (/^\s*All that/i.test(text)) paragraph = rt.replaceRunText(paragraph, /[\s\S]+/, match => match[0] + ' NALA converted extent: 9999 Sq. Yards.');
    return paragraph;
  }).replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, sectionXml => section++ === 0 ? sectionXml : sectionXml.replace(/w:top="\d+"/g, 'w:top="9600"'));
}));

let cases = 0;
for (const [instrumentId, variantId, deedType, draft, file, mode] of modes) {
  const municipal = variantId === 'municipal-gift', regularGift = instrumentId === 'gift' && !municipal;
  const bytes = editedSources.get(file);
  const validation = await rt.validateDeedTemplate(bytes, instrumentId, variantId, file);
  assert(validation.valid, `${variantId}: ${validation.errors.join(' ')}`);
  assert.equal(validation.preservationVersion, rt.DEED_PRESERVATION_VERSION);
  const source = { kind: 'custom', bytes, hash: 'replacement-' + variantId, name: file, validation };
  for (const property of properties) {
    if (municipal && !['plot', 'open', 'dismantled', 'part'].includes(property)) continue;
    const state = rt.sampleState(mode + '-' + property); state.deedType = deedType; state.draft = draft;
    Object.assign(state.form, { executionDate: '2026-10', stampPaperMargin: '50', giftRelationship: 'friend', poaRelationship: 'son', consid: '765432', executantPan: 'ABCDE1234F', claimantPan: 'PQRST5678L', executantGender: 'Female', claimantGender: 'Male', localAuthorityType: 'Municipal Council', village: 'mixed village', nearAdjacent: 'Adjacent', nearHNo: 'SUBJECT-42', landmarkHNo: 'LANDMARK-99', developmentDocNo: 'DGPA-42', developmentDocDate: '', supplementalDocNo: 'ALLOTMENT-42' });
    if (!['part', 'dismantled'].includes(property)) state.form.nearHNo = 'LANDMARK-99';
    state.additionalClaimants = [{ id: 'second', values: { ...state.form, claimantName: 'second recipient', claimantGender: 'Female', poaRelationship: 'daughter' }, docNames: [] }];
    state.vendorSharesBySchedule = { primary: { primary: '30' } };
    state.vendeeSharesBySchedule = { primary: { primary: '', second: '20' } };
    state.linkRecordsBySchedule = { primary: [{ id: 'nala', docNames: [], values: { linkOption: 'nala', nalaOrderNo: 'NALA-42', nalaExtent: '00-02' } }, { id: 'title', docNames: [], values: { linkDocType: 'Sale Deed', linkDocNo: 'TITLE-42', linkDocDate: '2020-01-02', linkSro: 'TITLE OFFICE', linkSroCode: '101' } }] };
    const before = JSON.stringify(state), context = `${variantId}/${property}`;
    const compiled = rt.compileDeed({ instrumentId, variantId, snapshotHash: context, values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] }, source);
    const { result, manifest } = await rt.renderArtifact(compiled, 'docx');
    const output = new Uint8Array(await result.blob.arrayBuffer()), text = await rt.docxToText(output);
    if (variantId === 'sale-through-existing-agpa' && property === 'flat-finished' || variantId === 'without-possession' && property === 'plot' || variantId === 'general-power-of-attorney-family' && property === 'plot') await writeFile(new URL(variantId + '-' + property + '.docx', previews), output);
    const entries = await rt.readZip(output), xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml').data);
    assert.deepEqual(result.unmapped, [], context);
    assert.equal(manifest.preservationVersion, rt.DEED_PRESERVATION_VERSION);
    assert.equal(JSON.stringify(state), before, context + ': saved facts must not change');
    for (const value of ['__-10-2026', 'ABCDE1234F', 'PQRST5678L', 'SECOND RECIPIENT', 'TITLE-42']) assert(text.includes(value), context + ': ' + value);
    assert.doesNotMatch(text, /88%|STALE OWNER|9999 Sq\. Yards|01-01-2000|99,99,999/, context);
    const sections = [...xml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)].map(match => match[0]);
    assert.match(sections[0], /w:top="8640"/, context);
    for (const section of sections.slice(1)) assert.doesNotMatch(section, /w:top="(?:9600|8640)"/, context);
    if (regularGift) { assert.doesNotMatch(text, /following undivided shares|NALA converted extent:|30%|20%/i, context); assert.match(text, /WHEREAS the Donees are the friends of the Donor\./); }
    else { assert.match(text, /NALA converted extent: 242 Sq\. Yards\./, context); assert.match(text, /30%/, context); }
    if (!municipal) assert.match(text, /7,65,432/, context);
    else { assert.match(text, /MIXED VILLAGE/); assert.doesNotMatch(text, /Represented by its Commissioner|MUNICIPAL COUNCIL, SIRCILLA|FAMILY MEMBER|ANNEXURE/); }
    if (instrumentId === 'sale' && mode !== 'ordinary') { assert.match(text, /AUTH-42/); assert.match(text, /AUTHORITY SRO/); }
    if (instrumentId === 'sale' && property.startsWith('flat')) { assert.match(text, /DGPA-42/); assert.match(text, /ALLOTMENT-42/); assert(text.indexOf('DGPA-42') < text.indexOf('after duly satisfying')); }
    if (instrumentId === 'agreement_of_sale') { assert.doesNotMatch(text, /<WITHOUT POSSESSION>/); assert.match(text, variantId === 'with-possession' ? /WITH POSSESSION/ : /WITHOUT POSSESION/); }
    if (instrumentId === 'agreement_of_sale' || instrumentId === 'power_of_attorney') { assert.match(text, /FINGERPRINTS AS PER SECTION 32A/); assert.match(text, /SIGNATURES OF WITNESSES/); }
    if (variantId === 'general-power-of-attorney-family') assert.match(text, /son SAMPLE PURCHASER and daughter second recipient/i);
    cases++;
  }
  // Cached valid metadata must never authorize bytes missing a party identity.
  const damaged = await changedSource(file, xml => xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => /EXECUTANT NAME/.test(paragraphText(paragraph)) && /RELATION NAME/.test(paragraphText(paragraph)) ? rt.replaceRunText(paragraph, /<EXECUTANT NAME>/gi, () => 'FIXED EXAMPLE PERSON') : paragraph));
  const rejected = await rt.validateDeedTemplate(damaged, instrumentId, variantId, file);
  assert.equal(rejected.valid, false, variantId + ': identity removal must block upload');
  const state = rt.sampleState(mode + '-plot'); state.deedType = deedType; state.draft = draft;
  Object.assign(state.form, { giftRelationship: 'friend', poaRelationship: 'son' });
  const compiled = rt.compileDeed({ instrumentId, variantId, snapshotHash: 'damaged', values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] }, { ...source, bytes: damaged, validation: { ...validation, valid: true } });
  await assert.rejects(() => rt.renderArtifact(compiled, 'docx'), /Executant identity|executant identity/i);
}
for (const instrument of ['will', 'mortgage', 'partition', 'release', 'exchange', 'lease', 'rectification', 'cancellation', 'trust', 'settlement', 'development_agreement_agpa', 'family_arrangement']) {
  const checked = await rt.validateDeedTemplate(editedSources.get('sale-deed-template-v11.docx'), instrument, '', 'replacement.docx');
  assert.equal(checked.valid, false, instrument + ': no unregistered preservation/renderer fallback');
}
console.log(`PASS: ${cases} replacement downloads across every supported deed/property variant preserve source-independent rules; missing identities and unregistered instruments fail safely.`);
