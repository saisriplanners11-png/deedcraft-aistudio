import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const cases = [
  ['sale', 'outright-absolute-sale-deed', 'Sale', 'Outright Absolute Sale Deed', 'ordinary', 'sale-deed-v11', 'sale-deed-template-v11.docx'],
  ['sale', 'sale-deed-by-gpa-holder', 'Sale', 'Sale Deed by GPA Holder', 'gpa', 'sale-deed-v11', 'sale-deed-template-v11.docx'],
  ['sale', 'sale-through-existing-agpa', 'Sale', 'Sale through Existing AGPA', 'agpa', 'sale-deed-v11', 'sale-deed-template-v11.docx'],
  ['gift', 'family-gift', 'Gift', 'Gift Settlement Family', 'ordinary', 'gift-deed-v6', 'gift-deed-template-v6.docx'],
  ['gift', 'municipal-gift', 'Gift', 'Municipal Gift', 'ordinary', 'gift-municipal-v3', 'gift-municipal-template-v3.docx'],
  ['agreement_of_sale', 'with-possession', 'Agreement of Sale Cum GPA', 'With Possession', 'ordinary', 'agreement-sale-gpa-v4', 'agreement-sale-gpa-template-v4.docx'],
  ['agreement_of_sale', 'without-possession', 'Agreement of Sale Cum GPA', 'Without Possession', 'ordinary', 'agreement-sale-gpa-v4', 'agreement-sale-gpa-template-v4.docx'],
  ['power_of_attorney', 'general-power-of-attorney', 'GPA/Power of Attorney', 'General Power of Attorney', 'ordinary', 'general-poa-v3', 'general-poa-template-v3.docx'],
  ['power_of_attorney', 'general-power-of-attorney-family', 'GPA/Power of Attorney', 'General Power of Attorney Family', 'ordinary', 'general-poa-v3', 'general-poa-template-v3.docx'],
];
await mkdir('tmp/master-template-refresh', { recursive: true });
const record = (id, values) => ({ id, values, docNames: [] });
const links = suffix => [
  record('title-' + suffix, { linkOption: 'linkDoc', linkDocType: 'Sale Deed', linkDocNo: 'TITLE-' + suffix, linkDocDate: '2020-01-02', linkSro: 'TITLE OFFICE ' + suffix, linkSroCode: '10' + suffix }),
  record('rect-' + suffix, { linkOption: 'rectificationDeed', rectificationDeedType: 'Rectification Deed', rectificationDeedNo: 'RECT-' + suffix, rectificationDeedDate: '2021-02-03', rectificationDeedSro: 'RECT OFFICE ' + suffix, rectificationDeedSroCode: '20' + suffix }),
  record('supp-' + suffix, { linkOption: 'supplementalDeed', supplementalDeedType: 'Supplemental Deed', supplementalDeedNo: 'SUPP-' + suffix, supplementalDeedDate: '2022-03-04', supplementalDeedSro: 'SUPP OFFICE ' + suffix, supplementalDeedSroCode: '30' + suffix }),
  // Older saved generic link records are also recognized without mutating them.
  record('rect-legacy-' + suffix, { linkOption: 'linkDoc', linkDocType: 'Rectification Deed', linkDocNo: 'RECT-LEGACY-' + suffix, linkDocDate: '2023-04-05', linkSro: 'LEGACY RECT OFFICE ' + suffix, linkSroCode: '40' + suffix }),
];
let count = 0;
for (const [instrument, variant, deedType, draft, mode, version, file] of cases) {
  const bytes = new Uint8Array(await readFile(new URL('../' + file, import.meta.url)));
  const hash = createHash('sha256').update(bytes).digest('hex');
  const validation = await rt.validateDeedTemplate(bytes, instrument, variant, file);
  assert(validation.valid, file + ': ' + validation.errors.join(' '));
  for (const property of (variant === 'municipal-gift' ? ['plot'] : ['plot', 'house-semi', 'flat-finished', 'flat-semi'])) for (const amendments of [false, true]) for (const custom of [false, true]) {
    const state = rt.sampleState(mode + '-' + property); Object.assign(state, { deedType, draft });
    Object.assign(state.form, { executionDate: '2026-10', stampPaperMargin: '100', giftRelationship: 'daughter', poaRelationship: 'son', consid: '765432', claimantPan: 'NEWPAN1234Z', executantGender: 'Female', claimantGender: 'Male' });
    if (mode !== 'ordinary') state.saleAuthority.bookNumber = 'BOOK-777';
    state.additionalSchedules = [{ id: 'second', category: 'Open Place', docNames: [], values: { ...state.form, village: 'SECOND VILLAGE' } }];
    state.linkRecordsBySchedule = { primary: amendments ? links('ONE') : [links('ONE')[0]], second: amendments ? links('TWO') : [links('TWO')[0]] };
    const before = JSON.stringify(state);
    const source = custom ? { kind: 'custom', bytes, hash, name: file, validation } : { kind: 'built-in' };
    const schedules = rt.scheduleMergesFor(state);
    const artifact = await rt.renderArtifact(rt.compileDeed({ instrumentId: instrument, variantId: variant, values: rt.mergeValues(state), schedules, rewrites: rt.rewritesFor(state), snapshotHash: 'refresh', unresolvedWarnings: [] }, source), 'docx');
    const output = new Uint8Array(await artifact.result.blob.arrayBuffer()), text = await rt.docxToText(output);
    assert.deepEqual(artifact.result.unmapped, []);
    assert.equal(artifact.manifest.templateVersionId, custom ? 'custom:' + hash : version);
    assert.equal(artifact.manifest.preservationVersion, rt.DEED_PRESERVATION_VERSION);
    assert.match(text, /__-10-2026/); assert.match(text, /NEWPAN1234Z/);
    if (property.startsWith('flat')) assert.match(text, /30 Sq\.yds equivalent to 25\.08 square meters/, 'flat UDS square metres must not use the total plot extent');
    assert.doesNotMatch(text, /<[^<>]+>|WITNESSES\/S|SIGN\/S/);
    assert.match(text, /TITLE-ONE/); assert.match(text, /TITLE-TWO/);
    if (amendments) {
      for (const suffix of ['ONE', 'TWO']) {
        for (const marker of ['RECT-' + suffix, 'RECT-LEGACY-' + suffix, 'SUPP-' + suffix]) assert.equal(text.split(marker).length - 1, 1, variant + ': ' + marker);
        const rect = text.slice(text.indexOf('Rectification Deed:')); assert.match(rect, /03-02-2021/);
        for (const marker of ['RECT OFFICE ' + suffix, 'SUPP OFFICE ' + suffix, 'LEGACY RECT OFFICE ' + suffix]) assert(text.includes(marker), variant + ': ' + marker);
      }
      assert.equal((text.match(/Rectification Deed:/g) || []).length, 4);
      assert.equal((text.match(/Supplemental Deed:/g) || []).length, 2);
    } else assert.doesNotMatch(text, /Rectification Deed:|Supplemental Deed:/);
    if (instrument === 'sale' && mode !== 'ordinary') {
      assert.match(text, /representing SAMPLE VENDOR/); assert.match(text, /AUTHORITY SRO/);
      assert.match(text, mode === 'gpa' ? /G\.P\.A\. HOLDER OF/ : /A\.G\.P\.A\. HOLDER OF/);
      if (mode === 'gpa') assert.match(text, /Book BOOK-777/);
    }
    if (variant === 'municipal-gift') assert.equal((text.match(/DONOR[S]?\W.*of the ONE PART/gi) || []).length, 1);
    if (variant === 'municipal-gift' || mode !== 'ordinary') {
      const entries = await rt.readZip(output), xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml').data);
      assert(xml.indexOf('<w:sectPr') < xml.indexOf('TITLE-ONE'), 'expanded title records must follow the first-page section boundary');
    }
    assert.equal(JSON.stringify(state), before, 'generation must not change saved facts');
    if (!custom && amendments && ['plot', 'flat-finished'].includes(property)) await writeFile(`tmp/master-template-refresh/${variant}-${property}.docx`, output);
    count++;
  }
}
console.log(`PASS: ${count} new-default/custom downloads preserve master rules, independent repeated amendment identities, dates/offices, blank amendment omission, authority declarations, immutable sources and saved facts.`);
