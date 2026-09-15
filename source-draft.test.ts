import { describe, it, expect } from 'vitest';
import { appStateFor, draftReducer, newDraft, plansFor, resolveDraft, type Candidate, type Draft, type Source, WorkQueue } from './source-draft';
import { cleanCandidate, cleanDrawing } from './upload-extraction';

const candidate = (field: string, value: string, patch: Partial<Candidate> = {}): Candidate => ({ id: field, field, value, role: 'executant', record: 'primary', quote: value, page: 1, region: 'Seller handwritten particulars', handwritten: true, historical: false, status: 'accepted', ...patch });
const source = (id: string, candidates: Candidate[]): Source => ({ id, name: `${id}.jpg`, revision: 0, hash: id, status: 'done', result: { candidates, plans: [], notes: [] } });
const draftWith = (...sources: Source[]): Draft => ({ ...newDraft(), sources });

describe('source-backed drafts', () => {
  it('restores instrument field markers as arrays so extracted payments remain editable', () => {
    const draft={...newDraft(),manual:{'payment|one|mode':'cheque','payment|one|filled':'payer,payee','payment|one|payer':'Original'}};
    expect(appStateFor(draft).payments[0].filled).toEqual(['payer','payee']);
    const edited=draftReducer(draft,{type:'manual',key:'payment|one|payer',value:'Edited'});
    expect(appStateFor(edited).payments[0].payer).toBe('Edited');
  });
  it('starts with no customer facts, payment instruments, plan or stamp defaults beyond the party/jurisdiction defaults', () => {
    const state = appStateFor(newDraft());
    expect(state.form).toMatchObject({
      propState: 'Telangana', executantPartyType: 'Individual', executantRelation: 'S/o',
      claimantPartyType: 'Individual', claimantRelation: 'S/o',
    });
    const withoutDefaults = { ...state.form, propState: '', executantPartyType: '', executantRelation: '', claimantPartyType: '', claimantRelation: '' };
    expect(Object.values(withoutDefaults).filter(Boolean)).toEqual([]);
    expect(state.payments).toEqual([]); expect(state.category).toBe(''); expect(state.unit).toBe('');
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
    expect(state.form.executantName).toBe('Seller One');
    expect(state.additionalExecutants[0].values.executantName).toBe('Seller Two');
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
    expect(state.form.executantName).toBe('Gangula Rajender');
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
    expect(form.consid).toBe(''); expect(form.stampValue).toBe(''); expect(form.executionDate).toBe(''); expect(form.govtRate).toBe('');
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
    expect(cleanCandidate(candidate('executantRelation','W/o'),1,0)?.value).toBe('W/o');
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
