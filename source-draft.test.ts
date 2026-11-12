import { describe, it, expect } from 'vitest';
import { appStateFor, draftReducer, newDraft, plansFor, resolveDraft, type Candidate, type Draft, type Source, WorkQueue } from './source-draft';
import { cleanCandidate, cleanDrawing } from './upload-extraction';
import { ageFrom, buildViewModel, todayISO } from './logic';
import { newStructureDetail } from './fields';
import { houseStructurePaise, STRUCTURE_VALUATION_OVERRIDE } from './house-valuation';
import { parsePropertyHousePtinPairs, serializePropertyHousePtinPairs } from './property-house-ptin';

const candidate = (field: string, value: string, patch: Partial<Candidate> = {}): Candidate => ({ id: field, field, value, role: 'executant', record: 'primary', quote: value, page: 1, region: 'Seller handwritten particulars', handwritten: true, historical: false, status: 'accepted', ...patch });
const source = (id: string, candidates: Candidate[]): Source => ({ id, name: `${id}.jpg`, revision: 0, hash: id, status: 'done', result: { candidates, plans: [], notes: [] } });
const draftWith = (...sources: Source[]): Draft => ({ ...newDraft(), sources });

describe('source-backed drafts', () => {
  it('deletes a property with its documents and allocations while keeping other schedules', () => {
    let draft = newDraft();
    draft = draftReducer(draft, { type: 'add-property', id: 'second' });
    draft = draftReducer(draft, { type: 'manual', key: 'property|second|surveyNo', value: '22' });
    draft = draftReducer(draft, { type: 'manual', key: 'property|primary|surveyNo', value: '11' });
    draft = draftReducer(draft, { type: 'link-property', record: 'second-title', propertyId: 'second' });
    draft = draftReducer(draft, { type: 'manual', key: 'link|second-title|linkOption', value: 'linkDoc' });
    draft = draftReducer(draft, { type: 'vendor-share', scheduleId: 'second', executantId: 'primary', value: '100' });
    draft = draftReducer(draft, { type: 'remove-record', role: 'property', record: 'second' });
    expect(appStateFor(JSON.parse(JSON.stringify(draft))).additionalSchedules).toEqual([]);
    expect(appStateFor(draft).form.surveyNo).toBe('11');
    expect(draft.activePropertyId).toBe('primary');
    expect(draft.vendorSharesBySchedule).toEqual({});
    expect(Object.keys(draft.manual)).toEqual(['property|primary|surveyNo']);
  });
  it('removes an uploaded payment completely and ignores its late extraction result', () => {
    const upload = { ...source('payment-upload', [candidate('amount', '500', { role: 'payment' })]), assignment: { role: 'payment' as const, record: 'payment-1' } };
    let draft = draftWith(upload);
    draft = draftReducer(draft, { type: 'remove-record', role: 'payment', record: 'payment-1' });
    expect(appStateFor(draft).payments).toEqual([]);
    expect(draftReducer(draft, { type: 'job', draftId: draft.id, sourceId: upload.id, sourceRevision: 0, patch: upload })).toBe(draft);
  });
  it('removes an unassigned extracted party without deleting unrelated source facts', () => {
    const draft = draftWith(source('mixed', [candidate('executantName', 'First Vendor'), candidate('surveyNo', '123', { role: 'property' })]));
    const deleted = draftReducer(draft, { type: 'remove-party', role: 'executant', record: appStateFor(draft).primaryExecutantId });
    expect(appStateFor(deleted).form.executantName).toBe('');
    expect(appStateFor(deleted).form.surveyNo).toBe('123');
  });
  it('opens saved legacy plan steps in the retained editor without changing deed facts', () => {
    for (const step of [10, 11, 12]) {
      const saved = { ...newDraft(), workflowVersion: undefined, step, manual: { 'property|primary|surveyNo': '123/A' } };
      const restored = draftReducer(newDraft(), { type: 'load', draft: saved });
      expect(restored.step).toBe(10);
      expect(restored.manual).toEqual(saved.manual);
      expect(restored.revision).toBe(saved.revision);
    }
    const latest = { ...newDraft(), step: 11 };
    expect(draftReducer(newDraft(), { type: 'load', draft: latest }).step).toBe(11);
    expect(draftReducer(newDraft(), { type: 'load', draft: { ...latest, workflowVersion: 2 } }).step).toBe(10);
    const saved = { ...newDraft(), step: 3 };
    expect(draftReducer(newDraft(), { type: 'load', draft: saved }).step).toBe(3);
  });
  it('restores instrument field markers as arrays so extracted payments remain editable', () => {
    const draft={...newDraft(),manual:{'payment|one|mode':'cheque','payment|one|filled':'payer,payee','payment|one|payer':'Original'}};
    expect(appStateFor(draft).payments[0].filled).toEqual(['payer','payee']);
    const edited=draftReducer(draft,{type:'manual',key:'payment|one|payer',value:'Edited'});
    expect(appStateFor(edited).payments[0].payer).toBe('Edited');
  });
  it('starts with no customer facts, payment instruments, plan or stamp defaults beyond the party/jurisdiction defaults', () => {
    const state = appStateFor(newDraft());
    expect(state.form).toMatchObject({
      propState: 'Telangana', executantPartyType: 'Individual', executantRelation: 'S/O',
      claimantPartyType: 'Individual', claimantRelation: 'S/O',
    });
    const withoutDefaults = { ...state.form, propState: '', executantPartyType: '', executantRelation: '', claimantPartyType: '', claimantRelation: '' };
    expect(Object.values(withoutDefaults).filter(Boolean)).toEqual([]);
    expect(state.payments).toEqual([]); expect(state.category).toBe(''); expect(state.unit).toBe('');
  });
  it('prefills each house PTIN from its own title assessment or tax receipt', () => {
    let draft = newDraft();
    const set = (key: string, value: string) => { draft = draftReducer(draft, { type: 'manual', key, value }); };
    set('property|primary|category', 'Residential');
    set('link|tax-one|linkOption', 'houseTax');
    set('link|tax-one|assessmentPtinNo', 'PTIN-ONE');
    draft = draftReducer(draft, { type: 'add-property', id: 'second' });
    set('property|second|category', 'Commercial');
    draft = draftReducer(draft, { type: 'link-property', record: 'tax-two', propertyId: 'second' });
    set('link|tax-two|linkOption', 'houseTax');
    set('link|tax-two|assessmentPtinNo', 'PTIN-TWO');
    expect(appStateFor(draft).form.bltNo).toBe('PTIN-ONE');
    expect(appStateFor(draft).additionalSchedules[0].values.bltNo).toBe('PTIN-TWO');
    set('property|primary|bltNo', 'MANUAL-PTIN');
    expect(appStateFor(draft).form.bltNo).toBe('MANUAL-PTIN');
  });
  it('prefills an uploaded PTIN for Part open place and keeps every house/PTIN row through save and reload', () => {
    const sourceOne = source('link-one', [candidate('housePtinPairs', '[{"houseNo":"6-1-142","ptin":"PTIN-142"}]', { role: 'property' })]);
    const sourceTwo = source('link-two', [candidate('housePtinPairs', '[{"houseNo":"6-1-143","ptin":"PTIN-143"}]', { role: 'property' })]);
    let draft = draftWith(sourceOne, sourceTwo);
    draft = draftReducer(draft, { type: 'manual', key: 'property|primary|category', value: 'Part open place' });
    const extracted = parsePropertyHousePtinPairs(appStateFor(draft).form.housePtinPairs);
    expect(extracted?.map(row => [row.houseNo, row.ptin])).toEqual([
      ['6-1-142', 'PTIN-142'], ['6-1-143', 'PTIN-143'],
    ]);

    const editedRows = [...(extracted || []), { id: 'manual-row-3', houseNo: '6-1-144', ptin: 'PTIN-144' }];
    draft = draftReducer(draft, { type: 'manual', key: 'property|primary|housePtinPairs', value: serializePropertyHousePtinPairs(editedRows) });
    draft = draftReducer(draft, { type: 'add-property', id: 'second' });
    draft = draftReducer(draft, { type: 'manual', key: 'property|second|category', value: 'Part open place' });
    draft = draftReducer(draft, { type: 'manual', key: 'property|second|housePtinPairs', value: '[{"id":"second-row","houseNo":"2-1-4","ptin":"SECOND-PTIN"}]' });
    const restored = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) });
    const state = appStateFor(restored);
    expect(parsePropertyHousePtinPairs(state.form.housePtinPairs)?.map(row => row.ptin)).toEqual(['PTIN-142', 'PTIN-143', 'PTIN-144']);
    expect(parsePropertyHousePtinPairs(state.additionalSchedules[0].values.housePtinPairs)?.map(row => row.ptin)).toEqual(['SECOND-PTIN']);
  });
  it('keeps legacy one-value PTIN extraction available for Part open place', () => {
    let draft = newDraft();
    draft = draftReducer(draft, { type: 'manual', key: 'property|primary|category', value: 'Part open place' });
    draft = draftReducer(draft, { type: 'manual', key: 'link|tax|linkOption', value: 'houseTax' });
    draft = draftReducer(draft, { type: 'manual', key: 'link|tax|bltNo', value: 'LEGACY-PTIN' });
    expect(appStateFor(draft).form.bltNo).toBe('LEGACY-PTIN');
  });
  it('accepts structured house/PTIN extraction rows and rejects malformed pair payloads', () => {
    const make = (value: string) => cleanCandidate({
      field: 'housePtinPairs', value, role: 'property', record: 'primary',
      quote: 'H.No. 6-1-142 PTIN PTIN-142', page: 1, region: 'Schedule',
      historical: false, handwritten: false,
    }, 1, 0);
    expect(make('[{"houseNo":"6-1-142","ptin":"PTIN-142"}]')?.value)
      .toContain('PTIN-142');
    expect(make('not a pair list')).toBeNull();
  });
  it('keeps repeatable Annexure I-A rows isolated by property schedule', () => {
    const primary = { totalFloors: '1', rows: [{ ...newStructureDetail(), floorNo: 'Ground', structureType: 'R.C.C. Building', stage: 'Finished', buildingAge: '5' }] };
    const secondary = { totalFloors: '2', rows: [{ ...newStructureDetail(), floorNo: 'Floor No. 1', structureType: 'Shed Structure', stage: 'Foundation', buildingAge: '1' }] };
    let draft = draftReducer(newDraft(), { type: 'structure-details', propertyId: 'primary', value: primary });
    draft = draftReducer(draft, { type: 'add-property', id: 'second' });
    draft = draftReducer(draft, { type: 'manual', key: 'property|second|category', value: 'Commercial' });
    draft = draftReducer(draft, { type: 'structure-details', propertyId: 'second', value: secondary });
    const state = appStateFor(draft);
    expect(state.structureDetailsBySchedule.primary).toEqual(primary);
    expect(state.structureDetailsBySchedule.second).toEqual(secondary);
  });
  it('recalculates each house valuation from its ULB, measurement and saved rate overrides', () => {
    const rcc = { ...newStructureDetail(), structureType: 'R.C.C.', builtUpAreaSqFt: '100' };
    const tin = { ...newStructureDetail(), structureType: 'Tin Shed', builtUpAreaSqFt: '10', rateOverride: '800' };
    const wall = { ...newStructureDetail(), structureType: 'Compound Wall', builtUpAreaSqFt: '999', runningFeet: '40.5', rateOverride: '200.01' };
    const tiled = { ...newStructureDetail(), structureType: 'Tiled Roof', builtUpAreaSqFt: '20' };
    let draft = draftReducer(newDraft(), { type: 'add-property', id: 'second' });
    const set = (key: string, value: string) => { draft = draftReducer(draft, { type: 'manual', key, value }); };
    set('property|primary|category', 'Residential');
    set('property|primary|localAuthorityType', 'Municipal Corporation');
    set('property|primary|structValue', '123');
    set('property|second|category', 'Residential');
    set('property|second|localAuthorityType', 'Gram Panchayat');
    draft = draftReducer(draft, { type: 'structure-details', propertyId: 'primary', value: { totalFloors: '1', rows: [rcc, tin, wall] } });
    draft = draftReducer(draft, { type: 'structure-details', propertyId: 'second', value: { totalFloors: '1', rows: [tiled] } });
    expect(appStateFor(draft).form.structValue).toBe('151100.41');
    expect(appStateFor(draft).additionalSchedules[0].values.structValue).toBe('15000');
    set('property|primary|localAuthorityType', 'Gram Panchayat');
    expect(appStateFor(JSON.parse(JSON.stringify(draft))).form.structValue).toBe('126100.41');
    draft = draftReducer(draft, { type: 'structure-details', propertyId: 'primary', value: { totalFloors: '1', rows: [{ ...rcc, builtUpAreaSqFt: '10' }, tin] } });
    expect(appStateFor(draft).form.structValue).toBe('19000');
    expect(resolveDraft(draft).values['property|primary|structValue']).toBe('123');
  });
  it.each([
    ['RCC', 1350], ['Bangalore Tiles', 900], ['Tin Shed', 900],
  ] as const)('prices %s consistently across construction stages', (roof, rate) => {
    const stages = [
      ['Foundation', 'Foundation', 25], ['First Floor', 'Upto Slab/Roof level', 65],
      ['Second Floor', 'Semi-Finished', 85], ['Ground', 'Finished', 100],
    ] as const;
    for (const [floorNo, stage, percent] of stages) {
      const row = { ...newStructureDetail(), floorNo, stage, structureType: roof, builtUpAreaSqFt: '100' };
      expect(houseStructurePaise(row, 'Municipal Council')).toBe(BigInt(rate * percent * 100));
    }
  });
  it('keeps schedule overrides through reload and uses them in the combined market value', () => {
    let draft = draftReducer(newDraft(), { type: 'add-property', id: 'second' });
    const set = (record: string, field: string, value: string) => {
      draft = draftReducer(draft, { type: 'manual', key: `property|${record}|${field}`, value });
    };
    for (const record of ['primary', 'second']) {
      for (const [field, value] of Object.entries({ category: 'Residential', localAuthorityType: 'Municipal Corporation', roofMaterial: 'R.C.C. Roof House', extentSqYards: '100', govtRate: '1000' })) set(record, field, value);
      const row = { ...newStructureDetail(), floorNo: 'First Floor', stage: 'Foundation', structureType: 'Framed with walls only', builtUpAreaSqFt: '100' };
      draft = draftReducer(draft, { type: 'structure-details', propertyId: record, value: { totalFloors: '1', rows: [row] } });
    }
    const combined = () => buildViewModel(appStateFor(draft), () => {}).persayINR;
    expect(combined()).toBe('₹2,67,500');
    set('primary', STRUCTURE_VALUATION_OVERRIDE, '0');
    set('second', STRUCTURE_VALUATION_OVERRIDE, '50000.50');
    draft = JSON.parse(JSON.stringify(draft));
    expect(appStateFor(draft).form.structValue).toBe('0');
    expect(combined()).toBe('₹2,50,000.50');
    set('second', STRUCTURE_VALUATION_OVERRIDE, '');
    expect(combined()).toBe('₹2,33,750');
  });
  it('keeps vendee shares by schedule and removes them with a deleted claimant', () => {
    let draft = newDraft();
    draft = draftReducer(draft, { type: 'add-property', id: 'second' });
    draft = draftReducer(draft, { type: 'manual', key: 'claimant|buyer-2|claimantName', value: 'Second Buyer' });
    draft = draftReducer(draft, { type: 'vendee-share', scheduleId: 'primary', claimantId: 'buyer-2', value: '40' });
    draft = draftReducer(draft, { type: 'vendee-share', scheduleId: 'second', claimantId: 'buyer-2', value: '75' });
    expect(appStateFor(draft).vendeeSharesBySchedule).toEqual({ primary: { 'buyer-2': '40' }, second: { 'buyer-2': '75' } });
    draft = draftReducer(draft, { type: 'remove-party', role: 'claimant', record: 'buyer-2' });
    expect(appStateFor(draft).additionalClaimants).toEqual([]);
    expect(draft.vendeeSharesBySchedule).toEqual({ primary: {}, second: {} });
    expect(appStateFor({ ...newDraft(), vendeeSharesBySchedule: undefined }).vendeeSharesBySchedule).toEqual({});
  });
  it('restores vendor shares and removes only the deleted vendor’s allocations', () => {
    let draft = draftWith(source('vendor-upload', [candidate('executantName', 'First Vendor', { record: 'uploaded-vendor' })]));
    draft = draftReducer(draft, { type: 'assign', id: 'vendor-upload', role: 'executant', record: 'uploaded-vendor' });
    draft = draftReducer(draft, { type: 'manual', key: 'executant|vendor-2|executantName', value: 'Second Vendor' });
    draft = draftReducer(draft, { type: 'vendor-share', scheduleId: 'primary', executantId: 'uploaded-vendor', value: '60' });
    draft = draftReducer(draft, { type: 'vendor-share', scheduleId: 'primary', executantId: 'vendor-2', value: '40' });
    draft = draftReducer(draft, { type: 'vendee-share', scheduleId: 'primary', claimantId: 'primary', value: '100' });
    const reopened = appStateFor(JSON.parse(JSON.stringify(draft)));
    expect(reopened.primaryExecutantId).toBe('uploaded-vendor');
    expect(reopened.form.executantName).toBe('FIRST VENDOR');
    expect(reopened.vendorSharesBySchedule?.primary).toEqual({ 'uploaded-vendor': '60', 'vendor-2': '40' });
    draft = draftReducer(draft, { type: 'remove-party', role: 'executant', record: 'vendor-2' });
    expect(draft.vendorSharesBySchedule?.primary).toEqual({ 'uploaded-vendor': '60' });
    expect(draft.vendeeSharesBySchedule?.primary).toEqual({ primary: '100' });
    expect(appStateFor({ ...newDraft(), vendorSharesBySchedule: undefined }).vendorSharesBySchedule).toEqual({});
  });
  it('keeps a newly added blank claimant in the saved party order', () => {
    let draft = newDraft();
    draft = draftReducer(draft, { type: 'manual', key: 'claimant|primary|claimantName', value: '' });
    draft = draftReducer(draft, { type: 'manual', key: 'claimant|buyer-2|claimantName', value: '' });
    draft = draftReducer(draft, { type: 'vendee-share', scheduleId: 'primary', claimantId: 'primary', value: '60' });
    draft = draftReducer(draft, { type: 'vendee-share', scheduleId: 'primary', claimantId: 'buyer-2', value: '40' });
    const reopened = appStateFor(JSON.parse(JSON.stringify(draft)));
    expect(reopened.primaryClaimantId).toBe('primary');
    expect(reopened.additionalClaimants.map(claimant => claimant.id)).toEqual(['buyer-2']);
    expect(reopened.vendeeSharesBySchedule.primary).toEqual({ primary: '60', 'buyer-2': '40' });
  });
  it('reads handwritten phone and occupation into their own fields', () => {
    const draft = draftWith(source('a', [candidate('executantMobile', '9876543210'), candidate('executantOccupation', 'Business')]));
    expect(appStateFor(draft).form).toMatchObject({ executantMobile: '9876543210', executantOccupation: 'Business' });
  });
  it('clears removed evidence, including derived age', () => {
    let draft = draftWith(source('a', [candidate('executantDob', '1990-01-01'), candidate('executionDate', '2026-01-02', { role: 'property' })]));
    expect(appStateFor(draft).form.executantAge).toBe('36');
    draft = draftReducer(draft, { type: 'remove', id: 'a' });
    expect(appStateFor(draft).form.executantDob).toBe(''); expect(appStateFor(draft).form.executantAge).toBe('');
  });
  it('exposes Aadhaar DOB age directly to the Executant and Claimant dashboards', () => {
    let draft = draftWith(source('ids', [
      candidate('executantDob', '1990-01-02'),
      candidate('claimantDob', '1995-03-04', { role: 'claimant' }),
    ]));
    expect(resolveDraft(draft).values['executant|primary|executantAge']).toBe(ageFrom('1990-01-02', todayISO()));
    expect(resolveDraft(draft).values['claimant|primary|claimantAge']).toBe(ageFrom('1995-03-04', todayISO()));
    draft = draftReducer(draft, { type: 'manual', key: 'executant|primary|executantAge', value: '29' });
    expect(resolveDraft(draft).values['executant|primary|executantAge']).toBe(ageFrom('1990-01-02', todayISO()));
  });
  it('replacement clears omitted values and rejects old in-flight responses', () => {
    let draft = draftWith(source('a', [candidate('executantMobile','9876543210')]));
    draft = draftReducer(draft, { type: 'replace', id: 'a', name: 'replacement.jpg' });
    expect(appStateFor(draft).form.executantMobile).toBe('');
    const old = draftReducer(draft, { type: 'job', draftId: draft.id, sourceId: 'a', sourceRevision: 0, patch: { result: source('old', [candidate('executantMobile','1111111111')]).result } });
    expect(old).toBe(draft);
    draft = draftReducer(draft, { type: 'job', draftId: draft.id, sourceId: 'a', sourceRevision: 1, patch: { status: 'done', result: source('new', [candidate('executantOccupation','Teacher')]).result } });
    expect(appStateFor(draft).form).toMatchObject({ executantMobile: '', executantOccupation: 'Teacher' });
  });
  it('does not restore deleted sources or another draft from late results', () => {
    const original = draftWith(source('a', []));
    const reset = draftReducer(original, { type: 'reset' });
    expect(draftReducer(reset, { type: 'job', draftId: original.id, sourceId: 'a', sourceRevision: 0, patch: { result: source('a', [candidate('executantName','Old Customer')]).result } })).toBe(reset);
    const removed = draftReducer(original, { type: 'remove', id: 'a' });
    expect(draftReducer(removed, { type: 'job', draftId: original.id, sourceId: 'a', sourceRevision: 0, patch: { status: 'done' } })).toBe(removed);
  });
  it('restores a saved draft without merging values from the current deed', () => {
    const saved = draftReducer(newDraft(), { type: 'manual', key: 'claimant|primary|claimantName', value: 'Saved Buyer' });
    const current = draftReducer(newDraft(), { type: 'manual', key: 'claimant|primary|claimantName', value: 'Current Buyer' });
    const restored = draftReducer(current, { type: 'load', draft: saved });
    expect(restored).toBe(saved);
    expect(appStateFor(restored).form.claimantName).toBe('SAVED BUYER');
  });
  it('blanks conflicting extractions, then recovers from remaining evidence', () => {
    let draft = draftWith(source('a', [candidate('executantMobile','9876543210')]), source('b', [candidate('executantMobile','9876543211')]));
    expect(appStateFor(draft).form.executantMobile).toBe('');
    expect(Object.keys(resolveDraft(draft).conflicts)).toHaveLength(1);
    draft = draftReducer(draft, { type: 'remove', id: 'b' });
    expect(appStateFor(draft).form.executantMobile).toBe('9876543210');
  });
  it('preserves manual entries while showing contrary evidence', () => {
    let draft = draftWith(source('a', [candidate('executantOccupation', 'Business')]));
    draft = draftReducer(draft, { type: 'manual', key: 'executant|primary|executantOccupation', value: 'Teacher' });
    expect(appStateFor(draft).form.executantOccupation).toBe('Teacher');
    expect(Object.keys(resolveDraft(draft).conflicts)).toHaveLength(1);
    draft = draftReducer(draft, { type: 'remove', id: 'a' });
    expect(appStateFor(draft).form.executantOccupation).toBe('Teacher');
  });
  it('separates named sellers and payment instruments', () => {
    const draft = draftWith(source('a', [candidate('executantName','Seller One'), candidate('executantMobile','9876543210'), candidate('amount','200', { role: 'payment' })]), source('b', [candidate('executantName','Seller Two'), candidate('executantMobile','9876543211'), candidate('amount','300', { role: 'payment' })]));
    const state = appStateFor(draft);
    expect(state.additionalExecutants).toHaveLength(1);
    expect(state.form.executantName).toBe('SELLER ONE');
    expect(state.additionalExecutants[0].values.executantName).toBe('SELLER TWO');
    expect(state.payments.map(p => p.amount)).toEqual(['200','300']);
  });
  it('does not blend current transaction values from different payment uploads', () => {
    const draft = draftWith(source('a', [candidate('consid','200', { role: 'payment' })]), source('b', [candidate('consid','300', { role: 'payment' })]));
    expect(appStateFor(draft).form.consid).toBe(''); expect(Object.keys(resolveDraft(draft).conflicts)).toHaveLength(1);
  });
  it('keeps non-link Phase 1 record details out of Phase 2 property fields', () => {
    const draft = draftWith(source('tax', [
      candidate('assessmentPtinNo', 'PTIN-42', { role: 'link' }),
      candidate('permBuildingPermitNo', 'BP-99', { role: 'link' }),
    ]));
    const state = appStateFor(draft);
    expect(state.form).toMatchObject({ bltNo: '', buildingPermitNo: '' });
    expect(state.supportingRecords[0].values).toMatchObject({ assessmentPtinNo: 'PTIN-42', permBuildingPermitNo: 'BP-99' });
  });
  it('keeps a newly created property visible before it has uploads or manual values', () => {
    const draft = draftReducer(newDraft(), { type: 'add-property', id: 'property-2' });
    const state = appStateFor(draft);
    expect(draft.activePropertyId).toBe('property-2');
    expect(state.additionalSchedules).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'property-2', values: {}, category: '' }),
    ]));
  });
  it('projects a property-scoped link upload into only its target schedule', () => {
    const property = candidate('plotNo', '22', { role: 'property', record: 'primary' });
    const scoped = source('property-2-deed', [property]);
    scoped.assignment = { role: 'link', record: 'property-2-deed', propertyRecord: 'property-2' };
    scoped.result!.plans = [{ record: 'primary', linked: true, page: 1, drawing: { lines: [], labels: [], scale: '1:100' } }];
    const draft: Draft = { ...newDraft(), propertyIds: ['property-2'], activePropertyId: 'property-2', sources: [scoped] };
    const state = appStateFor(draft);
    expect(state.form.plotNo).toBe('');
    expect(state.additionalSchedules).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'property-2', values: expect.objectContaining({ plotNo: '22' }) }),
    ]));
    expect(plansFor(draft, 'property-2')).toHaveLength(1);
    expect(plansFor(draft, 'primary')).toHaveLength(0);
  });
  it('reassigns an unlabelled note and removes its old contribution', () => {
    let draft = draftWith(source('a', [candidate('partyMobile','9876543210', { role: 'unassigned' })]));
    expect(appStateFor(draft).form.claimantMobile).toBe('');
    draft = draftReducer(draft, { type: 'assign', id: 'a', role: 'claimant', record: 'primary' });
    expect(appStateFor(draft).form.claimantMobile).toBe('9876543210');
    draft = draftReducer(draft, { type: 'assign', id: 'a', role: 'executant', record: 'primary' });
    expect(appStateFor(draft).form.claimantMobile).toBe(''); expect(appStateFor(draft).form.executantMobile).toBe('9876543210');
    draft = draftReducer(draft, { type: 'unassign', id: 'a' });
    expect(appStateFor(draft).form.executantMobile).toBe('');
    expect(resolveDraft(draft).unassigned).toHaveLength(1);
  });
  it('selects the current property plan and returns to valid linked evidence after removal', () => {
    const drawing = { lines: [{points:[[0,0],[100,500]] as [number,number][]}], labels:[], scale:'' };
    const linked = source('linked',[]); linked.result!.plans=[{record:'primary',linked:true,page:1,drawing}];
    const fresh = source('new',[]); fresh.result!.plans=[{record:'primary',linked:false,page:1,drawing:{...drawing,scale:'1:100'}}];
    let draft=draftWith(linked,fresh);
    expect(plansFor(draft,'primary').map(p=>p.linked)).toEqual([false]);
    draft=draftReducer(draft,{type:'assign',id:'new',role:'property',record:'second'});
    expect(plansFor(draft,'primary').map(p=>p.linked)).toEqual([true]);
    expect(plansFor(draft,'second')).toHaveLength(1);
    draft=draftReducer(draft,{type:'remove',id:'new'});
    expect(plansFor(draft,'second')).toHaveLength(0);
  });

  it('keeps two plans in one bundle associated with their own property records', () => {
    const bundle=source('bundle',[candidate('plotNo','1',{role:'property',record:'A',id:'a'}),candidate('plotNo','2',{role:'property',record:'B',id:'b'})]);
    const drawing={lines:[],labels:[],scale:''};
    bundle.result!.plans=[{record:'A',linked:false,page:1,drawing},{record:'B',linked:false,page:2,drawing}];
    const draft=draftWith(bundle);
    expect(plansFor(draft,'plot 1').map(p=>p.page)).toEqual([1]);
    expect(plansFor(draft,'plot 2').map(p=>p.page)).toEqual([2]);
  });

  it('does not silently attach a seller note when several sellers exist', () => {
    const draft = draftWith(source('a', [candidate('executantName','One')]), source('b', [candidate('executantName','Two')]), source('c', [candidate('executantMobile','9876543210')]));
    expect(resolveDraft(draft).unassigned).toHaveLength(1);
    expect(appStateFor(draft).form.executantMobile).toBe('');
  });
  it('resolves a name from several regions of one document despite case and abbreviation drift', () => {
    // A real multi-page bundle rarely reads back byte-identical across pages: the
    // opening recital, presentation endorsement and a signature page can each
    // transcribe the same person slightly differently (full name vs. initial,
    // upper vs. title case). Three of four reads agreeing should not blank the
    // field just because a signature abbreviated the first name.
    const draft = draftWith(source('bundle', [
      candidate('executantName', 'ALIGETI RAJU'),
      candidate('executantName', 'ALIGETI RAJU', { id: 'executantName-2' }),
      candidate('executantName', 'Aligeti Raju', { id: 'executantName-3' }),
      candidate('executantName', 'A. Raju', { id: 'executantName-4' }),
      candidate('executantOccupation', 'Business'),
      candidate('executantOccupation', 'BUSINESS', { id: 'executantOccupation-2' }),
    ]));
    const state = appStateFor(draft);
    expect(state.form.executantName).toBe('ALIGETI RAJU');
    expect(state.form.executantOccupation).toBe('Business');
    expect(resolveDraft(draft).conflicts).toEqual({});
  });
  it('still surfaces a genuine even split as a conflict rather than guessing', () => {
    const draft = draftWith(source('bundle', [
      candidate('executantName', 'Aligeti Raju'),
      candidate('executantName', 'Aligeti Raju', { id: 'executantName-2' }),
      candidate('executantName', 'Yeligate Raju', { id: 'executantName-3' }),
      candidate('executantName', 'Yeligate Raju', { id: 'executantName-4' }),
    ]));
    expect(appStateFor(draft).form.executantName).toBe('');
    expect(Object.keys(resolveDraft(draft).conflicts)).toHaveLength(1);
  });
  it('assigns one unassigned person from a composite source without pulling in the others', () => {
    // A single scanned page can carry several unrelated identity cards (e.g. two
    // witnesses alongside the actual party). Confirming the role for one of them
    // must not silently reassign the others into the same record.
    const draft = draftWith(source('composite', [
      candidate('partyName', 'Gangula Rajender', { role: 'unassigned', record: 'Gangula Rajender' }),
      candidate('partyAadhaar', '4345 1375 8505', { role: 'unassigned', record: 'Gangula Rajender', id: 'gr-aadhaar' }),
      candidate('partyName', 'Sriramula Venkatesham', { role: 'unassigned', record: 'Sriramula Venkatesham', id: 'sv-name' }),
      candidate('partyAadhaar', '6293 7535 2208', { role: 'unassigned', record: 'Sriramula Venkatesham', id: 'sv-aadhaar' }),
    ]));
    const assigned = draftReducer(draft, { type: 'assign', id: 'composite', role: 'executant', record: 'gangula rajender', fromRecord: 'Gangula Rajender' });
    const state = appStateFor(assigned);
    expect(state.form.executantName).toBe('GANGULA RAJENDER');
    expect(state.form.executantAadhaar).toBe('4345 1375 8505');
    expect(resolveDraft(assigned).unassigned.map(c => c.record)).toEqual(['Sriramula Venkatesham', 'Sriramula Venkatesham']);
  });
  it('holds back a prior deed\'s own vendor and vendee instead of trusting them as today\'s parties', () => {
    // A registered title deed recites ITS OWN sale: an old vendor who is a
    // stranger to today's transaction, and an old vendee who is typically
    // today's seller. The model does not reliably flag this recital historical,
    // so a source that also carries link/title-deed evidence must never let its
    // executant/claimant candidates through automatically.
    const linkDeed = source('linkDeed', [
      candidate('linkDocType', 'Registered Sale Deed', { role: 'link', id: 'link-type' }),
      candidate('linkDocNo', '1263/2016', { role: 'link', id: 'link-no' }),
      candidate('executantName', 'OLD SELLER', { role: 'executant', record: 'OLD SELLER', id: 'old-seller' }),
      candidate('claimantName', 'GANGULA RAJENDER', { role: 'claimant', record: 'GANGULA RAJENDER', id: 'old-buyer' }),
    ]);
    let draft = draftWith(linkDeed);
    const resolved = resolveDraft(draft);
    expect(appStateFor(draft).form.executantName).toBe('');
    expect(appStateFor(draft).form.claimantName).toBe('');
    expect(resolved.unassigned.map(c => c.record).sort()).toEqual(['GANGULA RAJENDER', 'OLD SELLER']);
    // Confirming the old vendee as today's seller (the common real-world case)
    // must not resurrect the old vendor as well.
    draft = draftReducer(draft, { type: 'assign', id: 'linkDeed', role: 'executant', record: 'primary', fromRecord: 'GANGULA RAJENDER' });
    const state = appStateFor(draft);
    expect(state.form.executantName).toBe('GANGULA RAJENDER');
    expect(resolveDraft(draft).unassigned.map(c => c.record)).toEqual(['OLD SELLER']);
  });
  it('never lets a link deed\'s own price, stamp value or execution date become today\'s, even for a confirmed party', () => {
    // The 2016 deed's ₹1,58,000 price, its stamp paper and its execution date
    // describe THAT sale. A fresh sale between the same land and a new buyer
    // needs its own consideration, stamp paper and date — these must stay blank
    // until supplied, never inherited silently. Static identity (relation, house
    // number) is different: it legitimately carries forward with the confirmed party.
    // A linked property's government rate is a property valuation and remains available.
    const linkDeed = source('linkDeed', [
      candidate('linkDocType', 'Registered Sale Deed', { role: 'link', id: 'link-type' }),
      candidate('linkDocNo', '1263/2016', { role: 'link', id: 'link-no' }),
      candidate('claimantName', 'GANGULA RAJENDER', { role: 'claimant', record: 'GANGULA RAJENDER', id: 'old-buyer-name' }),
      candidate('claimantRelationName', 'S/O NARSAIAH', { role: 'claimant', record: 'GANGULA RAJENDER', id: 'old-buyer-rel' }),
      candidate('claimantHNo', '11-1-138', { role: 'claimant', record: 'GANGULA RAJENDER', id: 'old-buyer-hno' }),
      candidate('claimantOccupation', 'Business', { role: 'claimant', record: 'GANGULA RAJENDER', id: 'old-buyer-occ' }),
      candidate('consid', '158000', { role: 'property', id: 'old-consid' }),
      candidate('stampValue', '100', { role: 'property', id: 'old-stamp' }),
      candidate('executionDate', '2016-02-27', { role: 'property', id: 'old-date' }),
      candidate('govtRate', '1000', { role: 'property', id: 'old-rate' }),
    ]);
    const assigned = draftReducer(draftWith(linkDeed), { type: 'assign', id: 'linkDeed', role: 'executant', record: 'primary', fromRecord: 'GANGULA RAJENDER' });
    const form = appStateFor(assigned).form;
    expect(form.executantName).toBe('GANGULA RAJENDER');
    expect(form.executantRelationName).toBe('S/O NARSAIAH');
    expect(form.executantHNo).toBe('11-1-138');
    expect(form.executantOccupation).toBe('');
    expect(form.consid).toBe(''); expect(form.stampValue).toBe(''); expect(form.executionDate).toBe(''); expect(form.govtRate).toBe('1000');
  });
  it('deduplicates identical payment uploads by content, not filename', () => {
    const a = source('a', [candidate('amount','200', { role: 'payment' })]);
    const b = { ...source('b', [candidate('amount','200', { role: 'payment' })]), hash: a.hash, name: 'different-name.jpg' };
    expect(appStateFor(draftWith(a,b)).payments).toHaveLength(1);
    expect(appStateFor(draftWith(a,{ ...b, hash: 'different-content', name: a.name })).payments).toHaveLength(2);
  });
});

describe('evidence validation', () => {
  it('rejects unclear IDs, missing evidence, role leakage and old mutable facts', () => {
    expect(cleanCandidate(candidate('executantAadhaar','1234 5678 901?'),1,0)).toBeNull();
    expect(cleanCandidate(candidate('executantMobile','9876543210',{ quote: '' }),1,0)).toBeNull();
    expect(cleanCandidate(candidate('claimantName','Wrong role'),1,0)).toBeNull();
    expect(cleanCandidate(candidate('executantAge','37',{ historical:true }),1,0)).toBeNull();
    expect(cleanCandidate(candidate('amount','400',{ role:'payment', historical:true }),1,0)).toBeNull();
  });
  it('preserves punctuation and zeroes, Telugu names and relation selections', () => {
    expect(cleanCandidate(candidate('surveyNo','001/2-A',{ role:'property' }),1,0)?.value).toBe('001/2-A');
    expect(cleanCandidate(candidate('executantRelativeName','లక్ష్మణ్'),1,0)?.value).toBe('లక్ష్మణ్');
    expect(cleanCandidate(candidate('executantRelation','W/o'),1,0)?.value).toBe('W/O');
  });
  it('rejects invalid dates and dangerous or invalid drawing coordinates', () => {
    expect(cleanCandidate(candidate('executantDob','2026-02-30'),1,0)).toBeNull();
    expect(cleanDrawing({ lines:[{points:[[0,0],[NaN,3]]}], labels:[] })).toBeNull();
  });
  it('snaps a select field read to its exact dropdown option instead of dropping or leaving it unselected', () => {
    expect(cleanCandidate(candidate('propState','Telangana State',{ role:'property' }),1,0)?.value).toBe('Telangana');
    expect(cleanCandidate(candidate('propState','TELANGANA',{ role:'property' }),1,0)?.value).toBe('Telangana');
    expect(cleanCandidate(candidate('propState','Kerala',{ role:'property' }),1,0)).toBeNull();
  });
  it('bounds concurrent requests and retains a slot after failure', async () => {
    const queue = new WorkQueue(2); let active=0; let max=0;
    const results = await Promise.allSettled(Array.from({length:8},(_,i) => queue.run(async () => { active++; max=Math.max(max,active); await new Promise(r=>setTimeout(r,2)); active--; if(i===0) throw Error('test'); return i; })));
    expect(max).toBe(2); expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(7);
  });
});

it('restores every separate Step 2 tax-receipt pair without duplicating inferred scalar values', () => {
  let draft = newDraft();
  const set = (key: string, value: string) => { draft = draftReducer(draft, { type: 'manual', key, value }); };
  set('property|primary|category', 'Part open place');
  for (const [record, houseNo, ptin] of [['tax-one', '6-2-24', '1105008210'], ['tax-two', '6-2-25', '1105008211']]) {
    set(`link|${record}|linkOption`, 'houseTax');
    set(`link|${record}|bearingHNo`, houseNo);
    set(`link|${record}|bltNo`, ptin);
  }
  const restored = appStateFor(draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) }));
  expect(parsePropertyHousePtinPairs(restored.form.housePtinPairs)?.map(row => [row.houseNo, row.ptin]))
    .toEqual([['6-2-24', '1105008210'], ['6-2-25', '1105008211']]);
  expect(restored.form.bearingHNo).toBe('6-2-24, 6-2-25');
});
