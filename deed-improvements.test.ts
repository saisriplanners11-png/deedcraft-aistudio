import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ageFrom } from './party-age';
import { acreGuntasToSqYards } from './land-area';
import { partyWording } from './party-wording';
import { minorPartyErrors, minorGuardianRecital } from './minor-parties';
import { initialState, withDerived } from './logic';
import { mergeValues, scheduleMergesFor } from './merge';
import { draftReducer, newDraft, resolveDraft, appStateFor } from './source-draft';
import { ensureStampPaperSpace } from './docx';
import { extractUpload, sameTranscription, scopedIdentityCandidate } from './upload-extraction';
import { authorityPartyValues } from './sale-options';
import { deedDate, executionDeedDate } from './deed-format';
import { partyPronouns } from './party-pronouns';
import { compileDeed } from './deed-compiler';

it('derives square metres from the entered yards even when an older derived value disagrees', () => {
  let draft = newDraft();
  for (const [field, value] of Object.entries({ category: 'Demolished', extentSqYards: '30', extentSqMeters: '999' })) draft = draftReducer(draft, { type: 'manual', key: `property|primary|${field}`, value });
  expect(resolveDraft(draft).values['property|primary|extentSqMeters']).toBe('25.08');
  const state = appStateFor(JSON.parse(JSON.stringify(draft)));
  state.unresolvedFields = ['extentSqMeters'];
  expect(scheduleMergesFor(state)[0].values['Extent in Sq.Meters']).toBe('25.08');
  state.unresolvedFields = ['extentSqYards'];
  expect(mergeValues(state)['Extent in Sq.Meters']).toBe('');
});

it('identifies a claimant guardian omission precisely and retains guardian court particulars', () => {
  const form = { ...initialState.form, claimantPartyType: 'Guardian (సంరక్షకుడు)', claimantName: 'PARENT', claimantDob: '1980-01-02', claimantAadhaar: '', claimantWardName: 'CHILD', claimantWardDob: '2015-01-02', claimantGuardianRelationship: 'Father' };
  const state = { ...initialState, form };
  const values = mergeValues(state);
  expect(values['Minor Representation Errors']).toContain('Claimant 1: Enter guardian aadhaar');
  expect(() => compileDeed({ instrumentId: 'sale', variantId: 'outright-absolute-sale-deed', snapshotHash: 'test', values, schedules: [], unresolvedWarnings: [] })).toThrow(/Claimant 1: Enter guardian aadhaar/);
  form.claimantAadhaar = '123456789012';
  expect(mergeValues(state)['Minor Representation Complete']).toBe('true');
  expect(minorPartyErrors({ claimantPartyType: 'Guardian (సంరక్షకుడు)' }, 'claimant')).toContain('Enter the represented minor’s full name.');
  expect(minorGuardianRecital({ executantPartyType: 'Guardian', executantWardName: 'CHILD', executantWardDob: '2015-01-02', executantCourtOrderNo: 'COURT-42', executantCourtName: 'District Court', executantCourtOrderDate: '2026-01-02' }, 'executant')).toContain('District Court, order COURT-42 dated 02-01-2026');
});

describe('selected party genders', () => {
  const values = { 'Executant Gender': 'Female', 'Claimant Gender': 'Male', 'Ownership Vendor Count': '1', 'Ownership Vendee Count': '1' };
  it('uses the grantor for rights and claims through that grantor, and the recipient for recipient obligations', () => {
    expect(partyPronouns('The Vendor conveys unto the Vendee all his/her/their rights.', values)).toContain('all her rights');
    expect(partyPronouns('The Donee shall enjoy without hindrance from the Donor or any person claiming through her/him.', values)).toContain('through her.');
    expect(partyPronouns('The Vendee agrees that he/she shall pay his/her taxes.', values)).toContain('he shall pay his taxes');
    expect(partyPronouns('The Donor declares that she/he has title.', values)).toContain('she has title');
  });
  it('keeps identity placeholders intact, uses their for groups and supports Other', () => {
    expect(partyPronouns('The Vendor conveys his/her/their rights.', { ...values, 'Ownership Vendor Count': '2' })).toContain('their rights');
    expect(partyPronouns('The Vendor declares that he/she/they has title.', { ...values, 'Executant Gender': 'Other' })).toContain('they have title');
    expect(partyPronouns('<EXECUTANT NAME> includes his/her heirs.', { ...values, 'Ownership Vendor Count': '2' })).toBe('<EXECUTANT NAME> includes her heirs.');
    expect(partyPronouns('The Vendor conveys his/her rights.', {})).toContain('his/her rights');
  });
  it('preserves per-party gender on save and reload', () => {
    let draft = newDraft();
    draft = draftReducer(draft, { type: 'manual', key: 'executant|primary|executantGender', value: 'Female' });
    draft = draftReducer(draft, { type: 'manual', key: 'claimant|primary|claimantGender', value: 'Male' });
    const state = appStateFor(JSON.parse(JSON.stringify(draft)));
    expect(mergeValues(state)['Executant Gender']).toBe('Female');
    expect(mergeValues(state)['Claimant Gender']).toBe('Male');
  });
});

it('prints deliberate month-only execution dates without accepting partial record dates', () => {
  expect(executionDeedDate('2026-10')).toBe('__-10-2026');
  expect(executionDeedDate('2026-10-22')).toBe('22-10-2026');
  for (const value of ['', '2026-13', '2026-00', '0000-10', '2026-02-30']) expect(executionDeedDate(value)).toBe('');
  expect(deedDate('2026-10')).toBe('');
  let draft = newDraft();
  draft = draftReducer(draft, { type: 'manual', key: 'property|transaction|executionDate', value: '2026-10' });
  const state = appStateFor(JSON.parse(JSON.stringify(draft)));
  expect(state.form.executionDate).toBe('2026-10');
  expect(mergeValues(state).Date).toBe('__-10-2026');
  expect(mergeValues(state)['Execution Date']).toBe('__-10-2026');
});

const mock = vi.hoisted(() => ({ calls: [] as any[], active: 0, peak: 0, disagree: false }));
vi.mock('./claude', () => ({ VISION_MODEL: 'vision', VERIFY_MODEL: 'verify', EXTRACT_MODEL: 'extract', readableError: (error: unknown) => error,
  getClient: () => ({ messages: { create: async (request: any) => {
    mock.calls.push(request); mock.active++; mock.peak = Math.max(mock.peak, mock.active);
    await new Promise(resolve => setTimeout(resolve, 5)); mock.active--;
    const fields = request.tools[0].input_schema.properties.candidates.items.properties.field.enum as string[];
    const prefix = fields.some(field => field === 'personName') ? 'person' : fields.some(field => field === 'claimantGuardianName') ? 'claimantGuardian' : fields.some(field => field === 'claimantName') ? 'claimant' : 'executant';
    const candidate = (suffix: string, value: string) => ({ field: prefix + suffix, value, role: 'executant', record: 'random-ai-id', quote: suffix === 'Dob' ? '02/01/2000' : value, region: 'ID holder', page: 1, handwritten: false, historical: false });
    return { stop_reason: 'end_turn', content: [{ type: 'tool_use', name: 'record_transcription', input: { candidates: [candidate('Name', mock.disagree && request.model === 'verify' ? 'OTHER PERSON' : 'RAVI KUMAR'), candidate('Aadhaar', '1234-5678-9012'), candidate('Dob', '2000-01-02')], plan: null } }] };
  } } }) }));
beforeEach(() => { mock.calls = []; mock.active = 0; mock.peak = 0; mock.disagree = false; });
const minor = { claimantPartyType: 'Minor', claimantName: 'CHILD', claimantDob: '2015-01-02', claimantGuardianName: 'PARENT', claimantGuardianRelationship: 'Mother', claimantGuardianDob: '1980-01-02', claimantGuardianAadhaar: '123456789012' };

describe('requested deed improvements', () => {
  it('calculates completed ages today and rejects impossible, partial and future dates', () => {
    expect(ageFrom('2000-10-25', '2026-10-24')).toBe('25'); expect(ageFrom('2000-10-25', '2026-10-25')).toBe('26');
    for (const value of ['2000', '2000-02-30', '2999-01-01', '']) expect(ageFrom(value, '2026-10-25')).toBe('');
    expect(withDerived({ claimantDob: '2000-01-02', claimantAge: '9' }).claimantAge).toBe(ageFrom('2000-01-02'));
    expect(authorityPartyValues({ Dob: '2000-01-02', Age: '9' }, 'Attorney')['Attorney Age']).toBe(ageFrom('2000-01-02'));
  });
  it('updates ages and NALA conversion after restoring or editing a draft', () => {
    let draft = newDraft();
    for (const [key, value] of Object.entries({ 'claimant|primary|claimantDob': '2000-01-02', 'claimant|primary|claimantAge': '9', 'link|nala-1|nalaExtent': '00-02', 'link|nala-1|linkOption': 'nala', 'property|transaction|stampPaperMargin': '100' })) draft = draftReducer(draft, { type: 'manual', key, value });
    expect(resolveDraft(draft).values['claimant|primary|claimantAge']).toBe(ageFrom('2000-01-02'));
    expect(resolveDraft(draft).values['link|nala-1|convertedExtentText']).toBe('242');
    expect(appStateFor(JSON.parse(JSON.stringify(draft))).form.stampPaperMargin).toBe('100');
    expect(acreGuntasToSqYards('00-02')).toBe(242); expect(acreGuntasToSqYards('1-02')).toBe(5082); expect(acreGuntasToSqYards('00-40')).toBeNull();
  });
  it('keeps NALA conversion local to its schedule and retains the independently entered property extent', () => {
    const state = { ...initialState, form: { ...initialState.form, extentSqYards: '100' }, additionalLinkDocuments: [{ id: 'nala-1', values: { linkOption: 'nala', nalaOrderNo: 'N-1', nalaExtent: '00-02' }, docNames: [] }] };
    const schedule = scheduleMergesFor(state)[0];
    expect(schedule.values['NALA Converted Extent']).toBe('242'); expect(schedule.values['Extent in Sq.yards']).toBe('100');
  });
  it('capitalizes municipal donee and village names in merge values', () => {
    const state = { ...initialState, deedType: 'Gift', draft: 'Municipal Gift', form: { ...initialState.form, localAuthorityType: 'Municipality', village: 'Sircilla' } };
    // Municipal mode is selected by its explicit flag/variant in the application.
    const values = mergeValues(state);
    expect(values.ULB).toBe('MUNICIPAL COUNCIL'); expect(values.VILLAGE).toBe('SIRCILLA');
  });
  it('resolves vendor and vendee grammar independently, without changing identity placeholders', () => {
    const text = partyWording('The Vendor/s has/have agreed and the Vendee/s has/have accepted. <EXECUTANT NAME> <CLAIMANT NAME>', 1, 2);
    expect(text).toContain('Vendor has agreed and the Vendees have accepted'); expect(text).toContain('<EXECUTANT NAME> <CLAIMANT NAME>');
    expect(partyWording('I/We am/are the absolute owner/s.', 2, 1)).toBe('We are the absolute owners.');
    expect(partyWording('The First Party/s hereby nominate/s the Second Party/s.', 2, 1)).toContain('First Parties hereby nominate the Second Party');
  });
  it.each([['100', '8352'], ['50', '8640'], ['20', '8640'], ['None', '1080'], ['Legacy', '8208']])('applies %s margins only to the opening section', (selection, top) => {
    const section = '<w:sectPr><w:pgMar w:top="1080" w:left="1080"/></w:sectPr>';
    const xml = '<w:document><w:body><w:p><w:pPr>' + section + '</w:pPr></w:p><w:p/><w:sectPr><w:pgMar w:top="1080"/></w:sectPr></w:body></w:document>';
    const output = ensureStampPaperSpace(xml, selection);
    expect(output.match(/w:top="(\d+)"/g)).toEqual([`w:top="${top}"`, 'w:top="1080"']);
  });
  it('ignores inactive minor identity fields on organisations and municipal donees', () => {
    const company = { ...initialState, form: { ...initialState.form, executantPartyType: 'Company', executantDob: '2015-01-02' } };
    expect(mergeValues(company)['Minor Representation Complete']).toBe('true');
    const municipal = { ...initialState, deedType: 'Gift', draft: 'Municipal Gift', form: { ...initialState.form, ...minor, claimantGuardianName: '' } };
    expect(mergeValues(municipal)['Minor Representation Complete']).toBe('false');
  });
  it('requires guardian particulars for a minor and court permission for a minor executant', () => {
    expect(minorPartyErrors(minor, 'claimant')).toEqual([]);
    const vendor = Object.fromEntries(Object.entries(minor).map(([key, value]) => [key.replace('claimant', 'executant'), value]));
    expect(minorPartyErrors(vendor, 'executant').length).toBeGreaterThan(0);
    Object.assign(vendor, { executantCourtOrderNo: 'CASE-1', executantCourtName: 'District Court', executantCourtOrderDate: '2026-01-02', executantCourtOrderPermitsExecution: 'Yes' });
    expect(minorPartyErrors(vendor, 'executant')).toEqual([]);
    expect(minorGuardianRecital(vendor, 'executant')).toContain('a minor represented by Mother: PARENT');
    expect(minorGuardianRecital(vendor, 'executant')).toContain('CASE-1 dated 02-01-2026');
  });
  it.each(['party:claimant', 'party:executant', 'party-person', 'guardian:claimant'] as const)('verifies %s IDs in two parallel reads and normalizes Aadhaar digits', async profile => {
    const file = Object.assign(new Blob(['RAVI KUMAR DOB 02/01/2000 Aadhaar 1234-5678-9012'], { type: 'text/plain' }), { name: 'identity.txt' }) as File;
    const output = await extractUpload(file, new AbortController().signal, () => {}, undefined, profile);
    expect(mock.calls).toHaveLength(2); expect(mock.peak).toBe(2);
    expect(mock.calls.every(call => call.tools[0].input_schema.properties.candidates.items.properties.field.enum.length <= 17)).toBe(true);
    expect(output.candidates.find(candidate => /Aadhaar$/.test(candidate.field))?.value).toBe('123456789012');
    expect(output.candidates.every(candidate => candidate.status === 'accepted')).toBe(true);
    expect(output.candidates.find(candidate => /Name$/.test(candidate.field))?.role).toBe(profile === 'party-person' ? 'party-person' : profile.split(':')[1]);
  });
  it('treats equivalent printed C/O relation spellings as the same transcription', () => {
    const candidate = (value: string) => ({ field: 'claimantRelation', value, role: 'claimant' as const, record: 'primary', page: 1, region: 'ID', quote: value, handwritten: false, historical: false, status: 'uncertain' as const, id: value });
    expect(sameTranscription(candidate('C/O:'), candidate('Care of'))).toBe(true);
    expect(sameTranscription(candidate('S/O'), candidate('D/O'))).toBe(false);
  });
  it('keeps disputed claimant names unaccepted', async () => {
    mock.disagree = true;
    const file = Object.assign(new Blob(['identity'], { type: 'text/plain' }), { name: 'id.txt' }) as File;
    const result = await extractUpload(file, new AbortController().signal, () => {}, undefined, 'party:claimant');
    expect(result.candidates.find(candidate => candidate.field === 'claimantName')?.status).toBe('uncertain');
  });
});
