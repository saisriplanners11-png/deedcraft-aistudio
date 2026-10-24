import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { newPartyRepresentative, type PartyPeople } from './fields';
import { appStateFor, draftReducer, fieldKey, migratePartyPeople, newDraft, peopleFor, resolveDraft, type Candidate, type Source } from './source-draft';
import { entityRecital, partyDisplayName, representativeDesignationOptions } from './party-entities';
import { generationBlockers, initialState, type AppState } from './logic';
import { deedFilename, mergeValues, rewritesFor, scheduleMergesFor } from './merge';
import { readZip, docxToText, fillSaleDeed, type DeedTemplateSource, validateSaleDeedTemplate } from './docx';
import { cleanCandidate, profileFields } from './upload-extraction';

const person = (id: string, name: string) => ({ ...newPartyRepresentative(), id, name, relationName: 'TEST PARENT', designation: 'Branch Manager', dob: '1986-08-06', age: '40', mobile: '9000000001', hNo: '1-2-3', locality: 'Test Street', village: 'Test Town', mandal: 'Test Mandal', district: 'Test District', state: 'Telangana', pinCode: '505301', aadhaar: '1234 5678 9012' });
const people: PartyPeople = { representatives: [person('rep1', 'FIRST SIGNATORY'), person('rep2', 'SECOND SIGNATORY')], members: [person('member', 'COMMITTEE ONLY')] };
const entityValues = (side: string) => Object.fromEntries(Object.entries({ PartyType: 'Company', EntityName: 'Example Finance Limited', EntityAddress: 'Corporate Office, Test City', EntityMobile: '9000000000', EntityNature: 'Finance', EntityIdProof: 'Registration certificate', EntityIdProofNo: 'TEST-CERT', EntityHNo: '4-5', EntityVillage: 'Test City', EntityMandal: 'Test Mandal', EntityDistrict: 'Test District', EntityState: 'Telangana', EntityPinCode: '505301', EntityBranchOffice: 'Branch Office, Test Town', CompanyCin: 'TEST-CIN', CompanyBoardResolution: 'BR-42 dated 01-10-2026' }).map(([k,v]) => [side + k, v]));
const stateFor = (side: 'executant' | 'claimant'): AppState => ({ ...initialState, deedType: 'Sale', category: 'Residential', form: { ...initialState.form, ...entityValues(side), executantName: 'OLD PERSONAL VALUE', claimantName: 'OTHER INDIVIDUAL', consid: '100000', roofMaterial: 'R.C.C. Building', constructionDescription: 'Framed with pillars & columns only', extentSqYards: '124.55', bearingHNo: '2-6-91', taxesPerAnnum: '1000', annualRentalValue: '6000', metersNo: '36664', tapConnectionNo: 'Nil' }, partyPeopleByParty: { [side + '|primary']: people }, structureDetailsBySchedule: { primary: { totalFloors: '1', rows: [{ id: 'floor', floorNo: 'Ground Floor', structureType: 'R.C.C. Building', customStructureType: '', stage: 'Finished', buildingAge: '29', builtUpAreaSqFt: '532' }] } } });
function source(id: string, record: string, value: string): Source {
  const candidate: Candidate = { id: 'name', field: 'personName', value, role: 'party-person', record: 'primary', quote: 'Name: ' + value, page: 1, region: 'name label', handwritten: false, historical: false, status: 'accepted' };
  return { id, revision: 0, name: id + '.png', hash: id, status: 'done', profile: 'party-person', assignment: { role: 'party-person', record }, result: { candidates: [candidate], plans: [], notes: [] } };
}

describe('entity parties and their people', () => {
  beforeAll(async () => { const bytes = await readFile(new URL('./sale-deed-template.docx', import.meta.url)); globalThis.fetch = async () => new Response(bytes); });
  it('isolates evidence and manual corrections by selected representative', () => {
    let draft = newDraft();
    for (const id of ['one', 'two']) draft = draftReducer(draft, { type: 'add-person', side: 'executant', record: 'primary', id, kind: 'representativeIds' });
    draft.sources = [source('a', 'one', 'Alice'), source('b', 'two', 'Bob'), source('c', 'one', 'Alicia')];
    let resolved = resolveDraft(draft);
    expect(resolved.values[fieldKey('party-person', 'two', 'personName')]).toBe('BOB');
    expect(resolved.conflicts[fieldKey('party-person', 'one', 'personName')]).toHaveLength(2);
    draft = draftReducer(draft, { type: 'manual', key: fieldKey('party-person', 'one', 'personName'), value: 'Manual Alice' });
    expect(peopleFor(draft, 'executant|primary').representatives.map(p => p.name)).toEqual(['MANUAL ALICE', 'BOB']);
    draft = draftReducer(draft, { type: 'remove-person', side: 'executant', record: 'primary', id: 'one' });
    draft = draftReducer(draft, { type: 'job', draftId: draft.id, sourceId: 'a', sourceRevision: 0, patch: { result: source('a', 'one', 'Late result').result } });
    expect(draft.sources.map(s => s.id)).toEqual(['b']);
    expect(peopleFor(draft, 'executant|primary').representatives.map(p => p.name)).toEqual(['BOB']);
  });
  it('migrates legacy arrays and personal signatories exactly once across save/reload', () => {
    const draft = newDraft(); draft.manual = { [fieldKey('claimant', 'extra', 'claimantPartyType')]: 'Company', [fieldKey('claimant', 'extra', 'claimantRepresentatives')]: JSON.stringify(people.representatives), [fieldKey('executant', 'primary', 'executantPartyType')]: 'Firm / LLP', [fieldKey('executant', 'primary', 'executantName')]: 'Legacy Signer' };
    const migrated = migratePartyPeople(draft);
    expect(peopleFor(migrated, 'claimant|extra').representatives).toHaveLength(2);
    expect(peopleFor(migrated, 'executant|primary').representatives[0].name).toBe('LEGACY SIGNER');
    expect(migratePartyPeople(migrated)).toBe(migrated);
    expect(draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(migrated)) }).partyPeople).toEqual(migrated.partyPeople);
    expect(appStateFor(migrated).partyPeopleByParty?.['claimant|extra'].representatives).toHaveLength(2);
  });
  it('derives age from DOB and retains manual age correction', () => {
    const draft = newDraft(); draft.manual[fieldKey('party-person', 'rep', 'personDob')] = '1990-01-01';
    expect(Number(resolveDraft(draft).values[fieldKey('party-person', 'rep', 'personAge')])).toBeGreaterThan(30);
    draft.manual[fieldKey('party-person', 'rep', 'personAge')] = '35';
    expect(resolveDraft(draft).values[fieldKey('party-person', 'rep', 'personAge')]).toBe('35');
  });
  it('uses active entity readiness and names, excluding inactive personal fields', () => {
    const state = stateFor('executant');
    expect(generationBlockers(state).filter(n => n.step === 6)).toEqual([]);
    expect(partyDisplayName(state.form, 'executant')).toBe('EXAMPLE FINANCE LIMITED');
    const claimant = stateFor('claimant'); expect(deedFilename(claimant)).toContain('EXAMPLE-FINANCE-LIMITED');
    expect(generationBlockers({ ...state, partyPeopleByParty: {} }).some(n => n.id.endsWith('representatives'))).toBe(true);
  });
  it('restricts entity, authorization and person extraction to their own fields', () => {
    expect(profileFields('entity:executant')).toContain('executantCompanyCin');
    expect(profileFields('entity:executant')).not.toContain('executantName');
    expect(profileFields('entity:executant:Company')).toContain('executantCompanyCin');
    expect(profileFields('entity:executant:Company')).not.toContain('executantFirmCin');
    expect(profileFields('entity:claimant:Society / Association')).not.toContain('claimantCompanyCin');
    expect(profileFields('authorization:claimant')).toContain('claimantCompanyBoardResolution');
    expect(profileFields('authorization:claimant')).not.toContain('claimantEntityName');
    expect(profileFields('party-person')).toContain('personDesignation');
    expect(profileFields('party-person')).not.toContain('claimantName');
    const raw = { field: 'personDob', value: '1990-01-01', role: 'party-person', record: 'primary', quote: 'DOB 1990-01-01', region: 'DOB', handwritten: false, historical: false };
    expect(cleanCandidate(raw, 1, 0)?.field).toBe('personDob');
    expect(cleanCandidate({ ...raw, value: '1990-02-30' }, 1, 0)).toBeNull();
    expect(cleanCandidate({ ...raw, role: 'executant' }, 1, 0)).toBeNull();
  });
  it('suggests designations appropriate to each entity type', () => {
    expect(representativeDesignationOptions('Firm / LLP')).toContain('Designated Partner');
    expect(representativeDesignationOptions('Society / Association')).toContain('President');
    expect(representativeDesignationOptions('Company')).toContain('Managing Director');
    expect(representativeDesignationOptions('Company')).not.toContain('Partner');
  });
  it.each(['Firm / LLP', 'Society / Association', 'Company'])('prints each %s representative as Designation: NAME', type => {
    const values = { ...entityValues('executant'), executantPartyType: type };
    const representatives = [{ ...person('one', 'Alice'), designation: 'President: ' }, { ...person('two', 'Bob'), designation: 'Custom Officer' }];
    const text = entityRecital(values, 'executant', { representatives, members: [] });
    expect(text).toContain('represented by\nPresident: ALICE, S/O TEST PARENT');
    expect(text).toContain('\nCustom Officer: BOB, S/O TEST PARENT');
    expect(text).not.toContain('President::');
    expect(text.match(/represented by/g)).toHaveLength(1);
    expect(text).not.toContain('; and');
    const blank = entityRecital(values, 'executant', { representatives: [{ ...person('one', 'Alice'), designation: '' }], members: [] });
    expect(blank).toContain('represented by\nALICE, S/O TEST PARENT');
  });
  it('recites representatives in order, excluding committee and optional empty fields', () => {
    const text = entityRecital(entityValues('executant'), 'executant', people);
    expect(text.indexOf('FIRST SIGNATORY')).toBeLessThan(text.indexOf('SECOND SIGNATORY'));
    expect(text).toContain('represented by\nBranch Manager: FIRST SIGNATORY'); expect(text).toContain('Corporate Office'); expect(text).toContain('Branch Office');
    expect(text).not.toContain('COMMITTEE ONLY'); expect(text).not.toContain('PAN No.');
  });
  it('excludes inactive legal particulars after switching entity type', () => {
    const values = { ...entityValues('executant'), executantPartyType: 'Firm / LLP', executantFirmRegistrationNo: 'FIRM-42', executantSocietyRegisteredAct: 'INACTIVE ACT', executantSocietyResolutionNo: 'INACTIVE AUTHORITY' };
    const text = entityRecital(values, 'executant', people);
    expect(text).toContain('FIRM-42');
    expect(text).not.toContain('TEST-CIN');
    expect(text).not.toContain('BR-42');
    expect(text).not.toContain('INACTIVE');
  });
  it('removes subordinate people and evidence when their parent party is deleted', () => {
    let draft = newDraft();
    draft = draftReducer(draft, { type: 'add-person', side: 'claimant', record: 'extra', id: 'child', kind: 'representativeIds' });
    draft.sources = [source('child-source', 'child', 'Child Name')];
    draft.manual[fieldKey('party-person', 'child', 'personDob')] = '1990-01-01';
    draft = draftReducer(draft, { type: 'remove-party', role: 'claimant', record: 'extra' });
    expect(draft.partyPeople?.['claimant|extra']).toBeUndefined();
    expect(draft.sources).toEqual([]);
    expect(Object.keys(draft.manual)).not.toContain(fieldKey('party-person', 'child', 'personDob'));
  });
  for (const side of ['executant', 'claimant'] as const) it('renders single ' + side + ' entity and the reference floor table with built-in and custom templates', async () => {
    const state = stateFor(side);
    const bytes = new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url)));
    const custom: DeedTemplateSource = { kind: 'custom', name: 'custom.docx', hash: 'test', bytes, validation: await validateSaleDeedTemplate(bytes, 'custom.docx', bytes) };
    for (const template of [{ kind: 'built-in' } as DeedTemplateSource, custom]) {
      const result = await fillSaleDeed(mergeValues(state), 'IF HOUSE', rewritesFor(state), scheduleMergesFor(state), template);
      const outputBytes = new Uint8Array(await result.blob.arrayBuffer());
      const entries = await readZip(outputBytes);
      const xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml')!.data);
      expect(xml).toMatch(/represented by<\/w:t><w:br\s*\/><w:t[^>]*>Branch Manager: FIRST SIGNATORY/);
      expect(xml).toMatch(/<w:br\s*\/><w:t[^>]*>Branch Manager: SECOND SIGNATORY/);
      const text = await docxToText(outputBytes);
      expect(text.match(/represented by/g)).toHaveLength(1);
      expect(text).toContain('EXAMPLE FINANCE LIMITED'); expect(text).toContain('represented byBranch Manager: FIRST SIGNATORY');
      expect(text).toContain('SECOND SIGNATORY'); expect(text).not.toContain('COMMITTEE ONLY');
      if (side === 'executant') expect(text).not.toContain('OLD PERSONAL VALUE,'); expect(text).toContain('Ground Floor'); expect(text).toContain('532');
      expect(text).not.toContain('1. EXAMPLE FINANCE LIMITED');
    }
  });
  it('renders mixed parties with ownership shares belonging to the organisation', async () => {
    const state: AppState = { ...stateFor('executant'), additionalExecutants: [{ id: 'other', values: { executantName: 'SECOND VENDOR' }, docNames: [] }], vendorSharesBySchedule: { primary: { primary: '60', other: '40' } } };
    const result = await fillSaleDeed(mergeValues(state), 'IF HOUSE', rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('1. EXAMPLE FINANCE LIMITED'); expect(text).toContain('2. SECOND VENDOR');
    expect(text).toContain('60%'); expect(text).toContain('40%');
    expect(text).not.toContain('COMMITTEE ONLY');
  });
});
