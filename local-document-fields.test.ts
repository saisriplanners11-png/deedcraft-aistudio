import { describe, expect, it } from 'vitest';
import { readLocalDocumentFields } from './local-document-fields';
import { draftReducer, fieldKey, newDraft, resolveDraft, type Source } from './source-draft';

const page = (text: string, number = 1) => ({ text, number, region: 'Synthetic document · Page ' + number });

describe('local document reading', () => {
  it('maps an OCR birth-date label to the assigned identity and blocks a conflicting person', () => {
    const result = readLocalDocumentFields([page('Government of India\nSample Resident\n5/D0B: 02/11/1979\n/FEMALE\n2233 4455 6677')], 'party:executant');
    const source: Source = {
      id: 'local-card', revision: 0, name: 'Identity', hash: 'fixture', status: 'reading', readMode: 'local',
      profile: 'party:executant', assignment: { role: 'executant', record: 'second-person' },
    };
    const draft = draftReducer(newDraft(), { type: 'add', source });
    const read = (target: typeof draft) => draftReducer(target, { type: 'job', draftId: target.id, sourceId: source.id, sourceRevision: 0, patch: { status: 'done', result } });
    expect(resolveDraft(read(draft)).values).toMatchObject({
      'executant|second-person|executantDob': '1979-11-02',
      'executant|second-person|executantGender': 'Female',
      'executant|second-person|executantAadhaar': '223344556677',
    });
    const edited = draftReducer(draft, { type: 'manual', key: 'executant|second-person|executantName', value: 'Different Person' });
    expect(resolveDraft(read(edited)).values).toEqual({ 'executant|second-person|executantName': 'DIFFERENT PERSON' });
  });

  it('keeps each tax row and chooses the printed PTIN over assessment and demand numbers', () => {
    const result = readLocalDocumentFields([page(`CURE Property Tax Receipt Details
H.No. | PTIN | Assessment No. | Demand No.
6-2-24 | 1105008210 | 3002 | 4002
6-2-25 | 1105008211 | 3003 | 4003
Receipt No. | Transaction Date
4/25B | 7/9/2026 11:04 AM
Assessment Date: 08-10-2025`)], 'phase1:houseTax');
    expect(result.candidates.map(({ field, value }) => [field, value])).toEqual(expect.arrayContaining([
      ['housePtinPairs', '[{"houseNo":"6-2-24","ptin":"1105008210"}]'],
      ['housePtinPairs', '[{"houseNo":"6-2-25","ptin":"1105008211"}]'],
      ['houseTaxReceiptNo', '4/25B'], ['taxPaidDate', '2026-09-07'], ['localAuthorityType', 'GHMC'],
    ]));
    expect(result.candidates.some(({ value }) => /300[23]|400[23]|2025/.test(value))).toBe(false);
    expect(result.candidates.every(({ status, quote }) => status === 'accepted' && !!quote)).toBe(true);
  });

  it('keeps unpaired labels separate, rejects malformed dates and does not read land tax as house tax', () => {
    const result = readLocalDocumentFields([page(`H.No. 6-2-24
Receipt No: 581/2025
Assessment No: 1177
V.L.T No: 542
Transaction Date: 30/02/2026`)], 'phase1:houseTax');
    expect(result.candidates.map(({ field, value }) => [field, value])).toEqual([
      ['houseTaxReceiptNo', '581/2025'],
      ['housePtinPairs', '[{"houseNo":"6-2-24","ptin":""}]'],
      ['housePtinPairs', '[{"houseNo":"","ptin":"1177"}]'],
    ]);
  });

  it('projects one link deed across the selected schedule and original claimant without copying historical transaction facts', () => {
    const result = readLocalDocumentFields([
      page(`SALE DEED
Document No: 1263/2016
Execution Date: 27-02-2016
SRO: Sircilla
SRO Code: 2010
Purchaser Name: Test Purchaser
Vendor Name: Test Vendor
Whereas the vendor acquired title
Document No: 891/2001`),
      page(`SCHEDULE OF THE PROPERTY
Mandal: Sircilla
Survey No: 795/B&D
Extent: 157.22 Sq. Yards
North: House of R. Raju
Boundaries of Flat
North: Corridor
Market Value per Sq.Yard: Rs. 12,500
Structure Valuation: 1,10,000
Sale Consideration: 10,00,000`, 2),
    ], 'phase1:linkDoc');
    let draft = newDraft();
    const source: Source = {
      id: 'source', revision: 0, name: 'Link deed', hash: 'fixture', status: 'done', result, readMode: 'local', profile: 'phase1:linkDoc',
      assignment: { role: 'link', record: 'link-two', propertyRecord: 'schedule-two' },
    };
    draft = draftReducer(draft, { type: 'add', source });
    const manual = fieldKey('property', 'schedule-two', 'boundaryNorth');
    draft = draftReducer(draft, { type: 'manual', key: manual, value: 'Entered boundary' });
    const resolved = resolveDraft(draft);
    expect(resolved.values).toMatchObject({
      'link|link-two|linkDocNo': '1263/2016',
      'link|link-two|linkDocDate': '2016-02-27',
      'link|link-two|linkSroCode': '2010',
      'property|schedule-two|mandal': 'Sircilla',
      'property|schedule-two|surveyNo': '795/B&D',
      'property|schedule-two|flatBoundaryNorth': 'Corridor',
      'property|schedule-two|govtRate': '12500',
      'property|schedule-two|structValue': '110000',
      [manual]: 'Entered boundary',
    });
    expect(Object.entries(resolved.values).some(([key, value]) => key.endsWith('|executantName') && value === 'TEST PURCHASER')).toBe(true);
    expect(resolved.values['property|transaction|consid']).toBeUndefined();
    expect(resolveDraft(draftReducer(draft, { type: 'remove', id: source.id })).values).toEqual({ [manual]: 'Entered boundary' });
  });

  it('does not mix two schedules, infer the source title or apply an unrelated amendment', () => {
    const contents = page('SALE DEED\nDocument No: 101/2021\nSCHEDULE A\nPlot No: 34\nSCHEDULE B\nPlot No: 35');
    const result = readLocalDocumentFields([contents], 'phase1:linkDoc');
    expect(result.notes[0]).toMatch(/several deed or schedule headings/i);
    expect(result.candidates.some(candidate => candidate.role === 'property')).toBe(false);
    expect(readLocalDocumentFields([contents], 'phase1:rectificationDeed').candidates).toEqual([]);
    expect(readLocalDocumentFields([page('RECTIFICATION DEED\nDocument No: 32/2025')], 'phase1:rectificationDeed').candidates.map(candidate => candidate.field)).toEqual(['rectificationDeedType', 'rectificationDeedNo']);
  });

  it('reads an Aadhaar letter and card without treating handwritten notes or unrelated identifiers as facts', () => {
    const result = readLocalDocumentFields([page(
      'Government of India\nUnique Identification Authority of India\nEnrolment No.: 4321/10101/00111\n' +
      'To\nనమూనా పేరు\nSample Person      Plot 18\nUnlabelled relative,\n' +
      '19-2-13, North Colony,\nVTC: Sample Town,\nSub District: A Different Place,\n' +
      'District: Sample District,\nState: Telangana;\nPIN Code: 505301,\nMobile: 9900112233\n' +
      'Your Aadhaar No. :\n2233 4455 6677\nVID: 1010 2233 4455 6677\n' +
      'Government of India\nSample Person\nపుట్టిన తేదీ / DOB : 12/03/1988\nపురుషుడు / Male\n' +
      'Aadhaar no. issued: 15/11/2010',
    ), page('Name: Another Document\nSurvey No: 1/2\nMasked Aadhaar: XXXX XXXX 6677', 2)], 'party:claimant');
    const fields = Object.fromEntries(result.candidates.map(({ field, value }) => [field, value]));
    expect(fields).toEqual({
      claimantAadhaar: '223344556677',
      claimantName: 'Sample Person',
      claimantRelativeName: 'Unlabelled relative',
      claimantHNo: '19-2-13',
      claimantLocality: 'North Colony',
      claimantVillage: 'Sample Town',
      claimantDistrict: 'Sample District',
      claimantState: 'Telangana',
      claimantPinCode: '505301',
      claimantMobile: '9900112233',
      claimantDob: '1988-03-12',
      claimantGender: 'Male',
    });
    expect(result.candidates.every(candidate => candidate.page === 1 && candidate.status === 'accepted' && !!candidate.quote)).toBe(true);
  });

  it('maps an explicit relationship and ignores a locality on the same unlabelled address line', () => {
    const letter = (line: string) => page(
      'Government of India\nTo\nSample Person\n' + line + '\n8-4-10,\nPIN Code: 505301\nYour Aadhaar No. :\n2233 4455 6677',
    );
    const explicit = readLocalDocumentFields([letter('Daughter of: Sample Parent,')], 'party:claimant').candidates;
    expect(explicit).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'claimantRelation', value: 'D/O' }),
      expect.objectContaining({ field: 'claimantRelativeName', value: 'Sample Parent' }),
    ]));
    expect(readLocalDocumentFields([letter('Sample Colony,')], 'party:claimant').candidates
      .some(candidate => candidate.field === 'claimantRelativeName' || candidate.field === 'claimantRelation')).toBe(false);
  });

  it('uses an explicitly written mobile before the printed Aadhaar mobile and keeps occupation separate', () => {
    const letter = page('Government of India\nTo\nSample Person\nPIN Code: 505301\nMobile: 91234 56789\nYour Aadhaar No.:\n2233 4455 6677');
    const combined = { ...letter, text: letter.text + '\nWritten Mobile: +91 98765-43210\nOccupation: Private Employee' };
    const contact = (pages: ReturnType<typeof page>[]) => readLocalDocumentFields(pages, 'party:executant').candidates
      .filter(candidate => /Mobile|Occupation/.test(candidate.field));
    expect(contact([combined])).toEqual([
      expect.objectContaining({ field: 'executantMobile', value: '9876543210', writtenContact: true }),
      expect.objectContaining({ field: 'executantOccupation', value: 'Private Employee' }),
    ]);
    const note = { ...page('Mobile: 99887 76655\nProfession: Agriculture', 2), separateContactNote: true };
    expect(contact([letter, note])).toEqual([
      expect.objectContaining({ field: 'executantMobile', value: '9988776655', page: 2, writtenContact: true }),
      expect.objectContaining({ field: 'executantOccupation', value: 'Agriculture', page: 2 }),
    ]);
    const ambiguous = { ...note, text: note.text + '\nMobile: 88776 65544' };
    expect(contact([letter, ambiguous]).map(candidate => candidate.field)).toEqual(['executantOccupation']);
    expect(contact([note]).map(candidate => candidate.value)).toEqual(['9988776655', 'Agriculture']);
    const unreadable = { ...note, text: 'Mobile: 99887 766?5\nOccupation: Business' };
    expect(contact([letter, unreadable]).map(candidate => candidate.value)).toEqual(['9123456789', 'Business']);
  });

  it('reads alternate labelled forms with values beneath their labels and no Aadhaar heading', () => {
    const forms = [page('Identity particulars\nName of applicant\nSample Resident\nFather’s Name: Sample Parent\n' +
      'Birth Date\n17/02/1992\nCell phone: +91 98900 11000\nProfession\nTeacher\nDistrict:\nSample District')];
    const result = readLocalDocumentFields(forms, 'party:claimant');
    expect(Object.fromEntries(result.candidates.map(c => [c.field, c.value]))).toEqual({
      claimantName: 'Sample Resident', claimantRelativeName: 'Sample Parent', claimantDob: '1992-02-17',
      claimantMobile: '9890011000', claimantOccupation: 'Teacher', claimantDistrict: 'Sample District',
    });
    expect(readLocalDocumentFields([page('Name of Applicant'), page('Different Document', 2)], 'party:claimant').candidates).toEqual([]);
  });

  it('binds aligned form cells by their labels and holds back a table with several properties', () => {
    const labels = 'జిల్లా | గ్రామం | మండలం';
    const row = 'సిద్దిపేట | కొత్తపల్లి | దుబ్బాక';
    const read = (input: string) => readLocalDocumentFields([page(input)], 'jurisdiction').candidates;
    expect(read(labels + '\n' + row).map(c => [c.field, c.value])).toEqual([
      ['district', 'సిద్దిపేట'], ['village', 'కొత్తపల్లి'], ['mandal', 'దుబ్బాక'],
    ]);
    expect(read(labels + '\n' + row + '\nసిద్దిపేట | రామాపూర్ | తొగుట')).toEqual([]);
    const schedule = readLocalDocumentFields([page('సర్వే నంబరు | 45/2B\nఉత్తరం:\nVillage road')], 'property-schedule');
    expect(schedule.candidates.map(c => [c.field, c.value])).toEqual([['surveyNo', '45/2B'], ['boundaryNorth', 'Village road']]);
  });

  it('assigns labelled identity fields only to the guardian or representative that received the upload', () => {
    const source = page('Name | Permanent Account Number Card | Mobile\nSample Person | ABCDE1234F | 9890011000');
    const reads = ['guardian:claimant', 'party-person'].map(profile => readLocalDocumentFields([source], profile).candidates);
    expect(reads[0].map(c => c.field)).toEqual(['claimantGuardianName', 'claimantGuardianPan', 'claimantGuardianMobile']);
    expect(reads[1].map(c => c.field)).toEqual(['personName', 'personPan', 'personMobile']);
    expect(reads[1].every(c => c.role === 'party-person')).toBe(true);
  });

  it('reads one labelled payment and holds back a failure or proof for a different instrument', () => {
    const proof = page('Bank transfer\nUTR: TEST123456789ABC\nAmount Paid: Rs. 1,500.25\nTransaction Date: 07/09/2026\nStatus: Success');
    const result = readLocalDocumentFields([proof], 'payment:rtgs');
    expect(result.candidates.map(({ role, field, value }) => [role, field, value])).toEqual([
      ['payment', 'refNo', 'TEST123456789ABC'], ['payment', 'amount', '1500.25'], ['payment', 'date', '2026-09-07'],
    ]);
    expect(readLocalDocumentFields([proof], 'payment:cheque').candidates).toEqual([]);
    expect(readLocalDocumentFields([{ ...proof, text: proof.text.replace('Success', 'Pending') }], 'payment:rtgs').candidates).toEqual([]);
    expect(readLocalDocumentFields([proof, page('UTR: TEST987654321XYZ', 2)], 'payment:rtgs').candidates).toEqual([]);
  });

  it('reads a birth year only from a labelled card and holds back a batch with more than one Aadhaar', () => {
    const front = (name: string, aadhaar: string, number = 1) => page(
      'Government of India\n' + name + '\nYear of Birth: 1980\nFemale\n' + aadhaar, number,
    );
    const first = front('Sample Person', '2233 4455 6677');
    expect(readLocalDocumentFields([first], 'party:executant').candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'executantDob', value: '1980-01-01' }),
      expect.objectContaining({ field: 'executantGender', value: 'Female' }),
    ]));
    const conflict = readLocalDocumentFields([first, front('Second Person', '9988 7766 5544', 2)], 'party:executant');
    expect(conflict.candidates).toEqual([]);
    expect(conflict.notes[0]).toMatch(/conflicting identities/i);
  });

  it('reads a masked card without supplying a full Aadhaar number and scopes separate address pages to a matching card', () => {
    const front = (id: string) => page(`Government of India\nSample Person\nDOB: 21/10/1990\nFemale\n${id}`);
    const back = (id: string, number: number) => page(`Unique Identification Authority of India\nAddress:\nHouse No: 6-2-24\nPIN Code: 505301\n${id}`, number);
    const masked = readLocalDocumentFields([front('XXXX XXXX 6677'), back('2233 4455 6677', 2)], 'party:claimant');
    expect(masked.candidates.map(candidate => candidate.field)).toEqual(['claimantDob', 'claimantName', 'claimantGender']);
    const matched = readLocalDocumentFields([front('2233 4455 6677'), back('2233 4455 6677', 2)], 'party:claimant');
    expect(matched.candidates.filter(candidate => candidate.page === 2)).toEqual([
      expect.objectContaining({ field: 'claimantHNo', value: '6-2-24' }),
      expect.objectContaining({ field: 'claimantPinCode', value: '505301' }),
    ]);
    const mismatched = readLocalDocumentFields([front('2233 4455 6677'), back('9988 7766 5544', 2)], 'party:claimant');
    expect(mismatched.candidates.every(candidate => candidate.page === 1)).toBe(true);
  });
});
