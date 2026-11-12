import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
await mkdir('tmp/minor-vendee-qa', { recursive: true });
const cases = [
  ['sale', 'outright-absolute-sale-deed', 'Sale', 'ordinary', 'sale-deed-template-v11.docx'],
  ['sale', 'sale-deed-by-gpa-holder', 'Sale', 'gpa', 'sale-deed-template-v11.docx'],
  ['sale', 'sale-through-existing-agpa', 'Sale', 'agpa', 'sale-deed-template-v11.docx'],
  ['gift', 'family-gift', 'Gift', 'ordinary', 'gift-deed-template-v6.docx'],
  ['gift', 'municipal-gift', 'Gift', 'ordinary', 'gift-municipal-template-v3.docx'],
  ['power_of_attorney', 'general-power-of-attorney', 'GPA/Power of Attorney', 'ordinary', 'general-poa-template-v3.docx'],
  ['power_of_attorney', 'general-power-of-attorney-family', 'GPA/Power of Attorney', 'ordinary', 'general-poa-template-v3.docx'],
  ['agreement_of_sale', 'with-possession', 'Agreement of Sale Cum GPA', 'ordinary', 'agreement-sale-gpa-template-v4.docx'],
  ['agreement_of_sale', 'without-possession', 'Agreement of Sale Cum GPA', 'ordinary', 'agreement-sale-gpa-template-v4.docx'],
  ['release', 'co-owner-release', 'Release', 'ordinary', 'release-deed-template-v1.docx'],
  ['reconveyance', 'title-deed', 'Deed Of Reconvayance', 'ordinary', 'reconveyance-deed-template-v1.docx'],
];
const minor = (base, index = 1) => ({ ...base,
  claimantPartyType: 'Minor', claimantName: `MINOR CHILD ${index}`, claimantGender: index === 1 ? 'Female' : 'Male', claimantDob: '2016-08-04', claimantRelation: 'D/O', claimantRelativeName: `PARENT ${index}`, claimantOccupation: 'Study', claimantHNo: `CHILD-HOUSE-${index}`, claimantAadhaar: index === 1 ? '111122223333' : '222233334444', claimantMobile: '', claimantPan: '',
  claimantGuardianName: `GUARDIAN PERSON ${index}`, claimantGuardianRelationship: index === 1 ? 'Grandfather' : 'Grandmother', claimantGuardianRelation: 'S/O', claimantGuardianRelativeName: `ELDER ${index}`, claimantGuardianDob: '1967-01-01', claimantGuardianOccupation: index === 1 ? 'Agriculture' : 'Engineer', claimantGuardianHNo: `GUARDIAN-HOUSE-${index}`, claimantGuardianLocality: `Guardian Locality ${index}`, claimantGuardianVillage: `Guardian Village ${index}`, claimantGuardianMandal: `Guardian Mandal ${index}`, claimantGuardianDistrict: `Guardian District ${index}`, claimantGuardianState: 'Telangana', claimantGuardianPinCode: '505303', claimantGuardianMobile: index === 1 ? '9000000001' : '9000000002', claimantGuardianAadhaar: index === 1 ? '555566667777' : '666677778888',
});
const guardianEntry = values => {
  const result = { ...values, claimantPartyType: 'Guardian' };
  for (const suffix of ['Name', 'Gender', 'Relation', 'RelativeName', 'Dob', 'Occupation', 'Aadhaar', 'Pan', 'Mobile', 'HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode']) {
    delete result['claimantWard' + suffix];
    result['claimant' + suffix] = values['claimantGuardian' + suffix] || '';
  }
  return result;
};
const paragraphText = p => p.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
let count = 0;
for (const [instrumentId, variantId, deedType, mode, file] of cases) {
  const bytes = new Uint8Array(await readFile(new URL('../' + file, import.meta.url)));
  const validation = await rt.validateDeedTemplate(bytes, instrumentId, variantId);
  assert(validation.valid, validation.errors.join(' '));
  for (const entry of ['Separate guardians', 'Shared guardian']) for (const custom of [false, true]) {
    const state = rt.sampleState(mode + '-plot'); state.deedType = deedType;
    if (variantId === 'municipal-gift') state.draft = 'Municipal Gift';
    if (instrumentId === 'release') {
      state.draft = 'Co-owner Release';
      state.form.totalPropertyValue = '2000000';
    }
    if (instrumentId === 'reconveyance') {
      state.draft = 'TITLE DEED';
      Object.assign(state.form, { bankName: 'SAMPLE BANK', bankBranch: 'Central', officialDesignation: 'Manager', interestAmount: '25.05' });
      state.linkRecordsBySchedule = { primary: [{ id: 'mortgage', docNames: [], values: {
        linkOption: 'linkDoc', linkDocNo: '1000/2025', linkDocDate: '2025-01-01',
        linkSro: 'Sample SRO', linkSroCode: '1010', mortgageAmount: '100000.10',
      } }] };
    }
    Object.assign(state.form, { giftRelationship: 'daughter', poaRelationship: 'son', localAuthorityType: 'Municipal Council', village: 'Sample Village' });
    state.form = { ...minor(state.form), claimantGuardianIds: 'guardian-1' };
    const shared = entry === 'Shared guardian';
    const guardians = (shared ? [1] : [1, 2]).map(index => ({
      id: 'guardian-' + index, docNames: [], values: guardianEntry(minor(state.form, index)),
    }));
    const firstMinor = { id: 'first-minor', docNames: [], values: state.form };
    const secondMinor = { id: 'second-minor', docNames: [], values: { ...minor(state.form, 2), claimantGuardianIds: shared ? 'guardian-1' : 'guardian-2' } };
    if (shared && custom) {
      state.primaryClaimantId = guardians[0].id;
      state.form = guardians[0].values;
      state.additionalClaimants = [firstMinor, secondMinor];
    } else {
      state.additionalClaimants = [secondMinor, ...guardians];
    }
    const before = JSON.stringify(state);
    const source = custom ? { kind: 'custom', bytes, validation, name: file, hash: 'minor-vendee' } : { kind: 'built-in' };
    const { result } = await rt.renderArtifact(rt.compileDeed({ instrumentId, variantId, snapshotHash: 'minor-vendee', values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] }, source), 'docx');
    assert.deepEqual(result.unmapped, []);
    const output = new Uint8Array(await result.blob.arrayBuffer());
    const xml = new TextDecoder().decode((await rt.readZip(output)).find(e => e.name === 'word/document.xml').data);
    const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g).map(paragraphText);
    for (const index of [1, 2]) {
      const paragraph = paragraphs.find(p => p.includes(`MINOR CHILD ${index}`) && p.includes('(MINOR)'));
      assert(paragraph, `${variantId}/${entry}: minor and guardian remain in one identity paragraph`);
      assert.match(paragraph, /DOB:\s*04-08-2016\), \(MINOR\)/);
      assert(paragraph.indexOf(`MINOR CHILD ${index}`) < paragraph.indexOf('(MINOR)'));
      assert(paragraph.trimStart().startsWith(`${index}. `), paragraph);
      if (shared && index === 1) {
        assert.doesNotMatch(paragraph, /Under the Guardianship|GUARDIAN PERSON/);
        continue;
      }
      const guardian = shared ? 1 : index;
      assert(paragraph.indexOf('(MINOR)') < paragraph.indexOf('Under the Guardianship'));
      assert(paragraph.includes(`Under the Guardianship of ${index === 1 ? 'her' : 'his'} natural Grand ${guardian === 1 ? 'Father' : 'Mother'} GUARDIAN PERSON ${guardian} S/O ELDER ${guardian}`));
      assert(paragraph.includes(guardian === 1 ? 'occu:Agriculture' : 'occu:Engineer'));
      assert(paragraph.includes(`GUARDIAN-HOUSE-${guardian}`));
      assert(paragraph.includes(guardian === 1 ? 'Cell No:9000000001, Aadhaar No:555566667777' : 'Cell No:9000000002, Aadhaar No:666677778888'));
      assert(!paragraph.includes('GUARDIAN PERSON ' + (guardian === 1 ? 2 : 1)));
      if (shared) assert.match(paragraph, /representing the minors at Points 1 and 2/);
    }
    const guardianParagraphs = paragraphs.filter(p => /GUARDIAN PERSON [12]/.test(p));
    assert.equal(guardianParagraphs.length, shared ? 1 : 2, `${variantId}/${entry}/custom=${custom}: ${guardianParagraphs.join('\n')}`);
    assert(!paragraphs.some(p => /GUARDIAN PERSON [12]/.test(p) && !p.includes('(MINOR)')), 'No separate guardian point');
    assert.equal(JSON.stringify(state), before);
    if (instrumentId === 'sale' && mode === 'ordinary' && !custom) await writeFile(`tmp/minor-vendee-qa/${entry.toLowerCase()}-entry.docx`, output);
    count++;
  }
}
console.log(`PASS: ${count} default/custom downloads place each guardian once under the last assigned minor, retain minor identity and numbering, and preserve saved assignments.`);
