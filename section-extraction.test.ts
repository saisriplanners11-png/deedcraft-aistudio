import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acreGuntasToSqYards, cleanCandidate, extractSections, extractUpload, prepare, profileFields, requiresFullVisualConfirmation, sameTranscription, sectionFields, structuredArray, type ExtractionProgress } from './upload-extraction';
import { appStateFor, newDraft, resolveDraft, type Candidate, type SourceResult } from './source-draft';

it('retains source name qualifiers without absorbing separate identity details', () => {
  const evidence = { role: 'claimant', region: 'Main parties', historical: false, handwritten: false };
  expect(cleanCandidate({ ...evidence, field: 'claimantEntityName', value: 'IKF Bank Ltd', quote: 'IKF Bank Ltd (Finance Bank), represented by its manager' }, 1, 1)?.value)
    .toBe('IKF Bank Ltd (Finance Bank)');
  expect(cleanCandidate({ ...evidence, field: 'claimantName', value: 'Anil Kumar', quote: 'Anil Kumar (DOB: 01-01-1980)' }, 1, 2)?.value)
    .toBe('Anil Kumar');
  expect(cleanCandidate({ ...evidence, field: 'claimantPartyType', value: 'Bank', quote: 'IKF Bank Ltd' }, 1, 3)?.value)
    .toBe('Bank');
});

const api = vi.hoisted(() => ({ calls: [] as any[], active: 0, peak: 0, truncateOnce: false, transientOnce:false, step2Gate: undefined as Promise<void> | undefined, extraReads: [] as Record<string, unknown>[] }));
vi.mock('./claude', () => ({
  EXTRACT_MODEL: 'read', VISION_MODEL: 'verify', VERIFY_MODEL: 'verify', readableError: (e: Error) => e,
  getClient: () => ({ messages: { create: async (body: any) => {
    api.calls.push(body); api.active++; api.peak = Math.max(api.peak, api.active);
    try {
      await new Promise(resolve => setTimeout(resolve, 3));
      if(api.transientOnce){api.transientOnce=false;throw Object.assign(new Error('API error 500'),{status:500});}
      const schema = body.tools[0].input_schema.properties;
      let input;
      if (schema.pages) {
        const numbers = body.messages[0].content.flatMap((p: any) => p.type === 'text' ? [...p.text.matchAll(/SOURCE PAGE (\d+):/g)].map((m: any) => Number(m[1])) : []);
        input = { pages: numbers.map((number: number) => ({ number, text: `Page ${number}: SALE DEED; document 1263/2016; CS 1323/2016; prior title 6028/2012; executed 27 February 2016; plot 16; Sircilla; extent 157.22 sq.yards.`, kind: number === 1 ? 'deed' : 'schedule', drawing: false })) };
      } else {
        const fields = schema.candidates.items.properties.field.enum;
        if (fields.some((field: string) => field.startsWith('link'))) await api.step2Gate;
        if (api.truncateOnce && fields.includes('linkDocNo') && fields.length > 2) {
          api.truncateOnce = false;
          return { stop_reason: 'max_tokens', content: [] };
        }
        const values: Record<string,string> = { linkDocNo: '1263/2016', linkDocType: 'Sale Deed', linkDocDate: '2016-02-27', sro: 'SIRCILLA SRO', district: 'RAJANNA SIRCILLA', mandal: 'SIRCILLA', village: 'KOTHAPETA', locality: 'LAKSHMI NAGAR', plotNo: '16', extentSqYards: '157.22', boundaryNorth: 'ROAD', boundarySouth: 'PLOT 15', boundaryEast: 'PLOT 17', boundaryWest: 'OPEN LAND', govtRate: '1200', structValue: '0' };
        input = { candidates: fields.filter((f: string) => values[f]).map((field: string) => ({ field, value: values[field], role: field.startsWith('link') ? 'link' : 'property', record: 'primary', page: 1, quote: values[field], region: 'Source label', historical: false, handwritten: false })).concat(api.extraReads.filter(candidate => fields.includes(candidate.field))), plan: null, notes: [] };
      }
      return { stop_reason: 'end_turn', content: [{ type: 'tool_use', name: 'record_transcription', input }] };
    } finally { api.active--; }
  } } }),
}));

const pages = (count: number) => Array.from({length: count}, (_,i) => ({number:i+1,region:`Page ${i+1}`,parts:[{type:'text' as const,text:`source page ${i+1}`}]}));
beforeEach(() => { api.calls=[]; api.active=0; api.peak=0; api.truncateOnce=false; api.transientOnce=false; api.step2Gate=undefined; api.extraReads=[]; });

describe('shared document section extraction', () => {
  it('projects the original parties by instrument while retaining their independent evidence', async () => {
    const fact = (role: string, record: string, field: string, value: string, historical = false) =>
      ({ role, record, field: role + field, value, page: 1, quote: value, region: 'Opening', historical, handwritten: false });
    api.extraReads = [
      fact('executant', 'old-seller', 'Name', 'Original Seller'),
      fact('claimant', 'buyer-one', 'Name', 'Shared Name'),
      fact('claimant', 'buyer-one', 'HNo', '1-1'),
      fact('claimant', 'buyer-two', 'Name', 'Shared Name'),
      fact('claimant', 'buyer-two', 'HNo', '2-2'),
      fact('claimant', 'older-title', 'Name', 'Historical Owner', true),
      fact('claimant', 'unmatched', 'HNo', '3-3'),
    ];
    const result = await extractSections(pages(1), [], new AbortController().signal, () => {}, undefined, 'phase1:linkDoc');
    const draft = newDraft();
    draft.sources = [{ id: 'link', revision: 0, name: 'Title deed', hash: 'test', status: 'done',
      profile: 'phase1:linkDoc', assignment: { role: 'link', record: 'title', propertyRecord: 'primary' }, result }];
    const sale = appStateFor(draft);
    expect(sale.form.executantName).toBe('SHARED NAME');
    expect(sale.form.executantHNo).toBe('1-1');
    expect(sale.additionalExecutants.map(r => r.values.executantHNo)).toEqual(['2-2']);
    expect(sale.form.claimantName).toBeFalsy();
    draft.manual['claimant|primary|claimantName'] = 'Manual Buyer';
    expect(appStateFor(draft).form.claimantName).toBe('MANUAL BUYER');
    const reconveyance = appStateFor({ ...draft, manual: {}, instrumentId: 'reconveyance' });
    expect(reconveyance.form.claimantName).toBe('ORIGINAL SELLER');
    expect(reconveyance.form.executantHNo).toBe('1-1');
    expect(result.candidates.find(c => c.value === 'Original Seller')?.role).toBe('executant');
    expect(result.candidates.find(c => c.value === 'Shared Name')?.role).toBe('claimant');
  });
  it('prepares several land and LRS documents for one merged card in order', async () => {
    const files = [
      Object.assign(new Blob(['V.L.T. No. VLT-101'], { type: 'text/plain' }), { name: 'vacant-tax.txt' }),
      Object.assign(new Blob(['Approved Layout File No. LAY-202'], { type: 'text/plain' }), { name: 'layout.txt' }),
    ] as File[];
    const prepared = await prepare(files, new AbortController().signal, 'phase1:landLayoutLrs');
    expect(prepared.pages.map(page => page.region)).toEqual(['vacant-tax.txt · Uploaded text', 'layout.txt · Uploaded text']);
    expect(prepared.pages.map(page => page.text)).toEqual(['V.L.T. No. VLT-101', 'Approved Layout File No. LAY-202']);
  });
  it('uses the value labelled Doct No. instead of a neighbouring CS number', () => {
    const candidate = cleanCandidate({
      field: 'linkDocNo', value: '1323/2016', role: 'link', record: 'primary',
      quote: 'Book 1: CS No. 1323/2016 & Doct No. 1263/2016', region: 'Registration margin',
      historical: true, handwritten: false,
    }, 2, 0);
    expect(candidate).toMatchObject({ value: '1263/2016', page: 2 });
  });

  it('normalizes property place names to Title Case while retaining source quotations', () => {
    for (const [field, value, expected] of [
      ['locality', 'LAKSHMI NAGAR', 'Lakshmi Nagar'],
      ['village', 'KOTHAPETA', 'Kothapeta'],
      ['mandal', 'SIRCILLA', 'Sircilla'],
      ['sro', 'BANJARA HILLS', 'Banjara Hills'],
      ['localBodyName', 'GRAM PANCHAYAT KOTHAPETA', 'Gram Panchayat Kothapeta'],
      ['permissionAuthorityName', 'GHMC CIRCLE 4', 'GHMC Circle 4'],
    ] as const) {
      const quote = `Source: ${value}`;
      const candidate = cleanCandidate({ field, value, role: 'property', record: 'primary', quote, region: 'Schedule', historical: false, handwritten: false }, 1, 0);
      expect(candidate).toMatchObject({ value: expected, quote });
    }
    const boundary = cleanCandidate({ field: 'boundaryNorth', value: 'SIRCILLA ROAD', role: 'property', record: 'primary', quote: 'SIRCILLA ROAD', region: 'Schedule', historical: false, handwritten: false }, 1, 1);
    expect(boundary?.value).toBe('SIRCILLA ROAD');
  });


  it('keeps PTIN, vacant-land tax and receipt evidence separate in every upload profile', async () => {
    const quote = 'H.No.6-2-24; P.T.I. No. 001105008210; V.L.T. No. 0077; Assessment No. 0099; Receipt No. 0248; Demand No. 0310';
    const read = (field: string, value: string, profile: Parameters<typeof cleanCandidate>[3], evidence = quote) =>
      cleanCandidate({ field, value, role: 'link', record: 'primary', quote: evidence, region: 'Tax details', historical: false, handwritten: false }, 1, 0, profile);
    for (const profile of ['phase1:linkDoc', 'property-schedule', 'general'] as const) {
      expect(read('bltNo', '001105008210', profile)).toMatchObject({ role: 'property', value: '001105008210' });
      expect(read('assessmentPtinNo', '0077', profile)).toMatchObject({ role: 'property', value: '0077' });
      expect(read('assessmentPtinNo', '001105008210', profile)).toBeNull();
      expect(read('bltNo', '0077', profile)).toBeNull();
    }
    for (const profile of ['phase1:landLayoutLrs', 'phase1:vacantTax'] as const) {
      expect(read('vltNo', '0077', profile)).toMatchObject({ role: 'link', value: '0077' });
      expect(read('vltNo', '001105008210', profile)).toBeNull();
      expect(read('vltNo', '0099', profile)).toBeNull();
    }
    for (const profile of ['phase1:houseTax', 'phase1:assessment'] as const) {
      expect(profileFields(profile)).not.toContain('assessmentPtinNo');
      expect(read('bltNo', '001105008210', profile)).toMatchObject({ role: 'link', value: '001105008210' });
      expect(read('bltNo', '0099', profile)).toBeNull();
      expect(read('bltNo', '0099', profile, 'Assessment No. 0099')).toMatchObject({ value: '0099' });
      expect(read('bltNo', '0099', profile, 'Vacant Land Tax Assessment No. 0099')).toBeNull();
      expect(read('bltNo', '0248', profile)).toBeNull();
      expect(read('bltNo', '0310', profile)).toBeNull();
      expect(read('houseTaxReceiptNo', '001105008210', profile)).toBeNull();
      expect(read('houseTaxReceiptNo', '0248', profile)).toMatchObject({ value: '0248' });
      for (const label of ['PTIN', 'P.T.I.N.', 'Property Tax Identification Number', 'PTIN No.']) {
        expect(read('bltNo', '001105008210', profile, label + ': 001105008210')).toMatchObject({ value: '001105008210' });
      }
      expect(read('houseTaxReceiptNo', '0248', profile, 'G.H.M.C. (CURE) Reciept No.: 0248')).toMatchObject({ value: '0248' });
    }

    const pairs = read('housePtinPairs', JSON.stringify([
      { houseNo: '6-2-24', ptin: '0077' },
      { ptin: '001105008210' },
    ]), 'phase1:linkDoc');
    expect(JSON.parse(pairs!.value)).toMatchObject([
      { houseNo: '6-2-24', ptin: '' },
      { houseNo: '', ptin: '001105008210' },
    ]);

    api.extraReads = [
      { field: 'bltNo', value: '001105008210', quote },
      { field: 'assessmentPtinNo', value: '0077', quote },
      { field: 'assessmentPtinNo', value: '001105008210', quote },
      { field: 'bltNo', value: '9999', quote: 'PTIN No. 9999' },
    ].map(read => ({ ...read, role: 'link', record: 'primary', page: 1, region: 'Tax details', historical: false, handwritten: false }));
    const source = { ...pages(1)[0], text: quote, parts: [{ type: 'text' as const, text: quote }] };
    const result = await extractSections([source], [], new AbortController().signal, () => {}, undefined, 'phase1:linkDoc');
    expect(result.candidates.filter(candidate => ['bltNo', 'assessmentPtinNo'].includes(candidate.field))).toHaveLength(2);

    const draft = newDraft();
    draft.manual['property|secondary|category'] = 'Part open place';
    draft.sources = [{
      id: 'tax-link', name: 'Link deed', hash: 'test', revision: 0, status: 'done', profile: 'phase1:linkDoc',
      assignment: { role: 'link', record: 'title', propertyRecord: 'secondary' },
      result,
    }];
    const { values } = resolveDraft(draft);
    expect(values['property|secondary|bltNo']).toBe('001105008210');
    expect(values['property|secondary|assessmentPtinNo']).toBe('0077');
    expect(values['property|primary|bltNo']).toBeUndefined();
  });

  it('preserves full survey subdivisions from the source quote and selected property upload', async () => {
    const survey = '30/1/1/1/1/1/1/1/1/1/2';
    const read = (value: string, quote: string) => ({
      field: 'surveyNo', value, quote, role: 'property', record: 'primary', page: 1,
      region: 'Schedule', historical: true, handwritten: false,
    });
    for (const number of ['30', '30/1', survey, '030 / 01 / 01A']) {
      expect(cleanCandidate(read(number.replace(/ /g, ''), 'Survey No. ' + number), 1, 0)?.value).toBe(number);
    }
    expect(cleanCandidate(read('30/1', 'Sy. No. ' + survey), 1, 0)?.value).toBe(survey);
    expect(cleanCandidate(read('30/1, 31/2', 'Sy. Nos. 30/1, 31/2'), 1, 0)?.value).toBe('30/1, 31/2');
    expect(cleanCandidate(read('30/1', 'Plot No. 30/1/2'), 1, 0)?.value).toBe('30/1');

    api.extraReads = [read('30/1', 'Sy. No. 30/1')];
    const text = 'Sy. No. ' + survey + ', measuring 157 sq. yards.';
    const source = { ...pages(1)[0], text, parts: [{ type: 'text' as const, text }] };
    const result = await extractSections([source], [], new AbortController().signal, () => {}, undefined, 'phase1:linkDoc');
    const draft = newDraft();
    draft.sources = [{
      id: 'survey-link', name: 'Link deed', hash: 'survey', revision: 0, status: 'done', profile: 'phase1:linkDoc',
      assignment: { role: 'link', record: 'title', propertyRecord: 'secondary' }, result,
    }];
    expect(resolveDraft(draft).values['property|secondary|surveyNo']).toBe(survey);
  });

  it('uses independent original-image confirmation for every Step 2 upload type', () => {
    for (const profile of ['phase1:houseTax', 'phase1:titleDeed', 'phase1:nala', 'phase1:permissions'] as const) {
      expect(requiresFullVisualConfirmation(profile)).toBe(true);
    }
    expect(requiresFullVisualConfirmation('phase1:linkDoc')).toBe(false);
    expect(requiresFullVisualConfirmation('party:executant')).toBe(false);
  });

  it('converts NALA Acre-Gunta notation to square yards', () => {
    expect(acreGuntasToSqYards('0.0144')).toBe(174.24);
    expect(acreGuntasToSqYards('1.0200')).toBe(5082);
    expect(acreGuntasToSqYards('0.0144 Acre-Guntas')).toBe(174.24);
    expect(acreGuntasToSqYards('0-14.4')).toBe(1742.4);
    expect(acreGuntasToSqYards('0 Acres 14.4 Guntas')).toBe(1742.4);
    expect(acreGuntasToSqYards('0.50')).toBeNull();
  });
  it('recovers a transient provider failure without losing the document details',async()=>{
    const sections=sectionFields('phase1:linkDoc');
    const scheduleFieldCount=sections.filter(s=>['step3','step4','step5'].includes(s.id)).reduce((n,s)=>n+s.fields.length,0);
    const expectedChunks=2+Math.ceil(scheduleFieldCount/10);
    api.transientOnce=true;
    const result=await extractSections(pages(3),[],new AbortController().signal,()=>{},undefined,'phase1:linkDoc');
    // Whichever chunk's first attempt eats the injected 500 retries once and
    // succeeds; every other chunk is unaffected — one extra call overall.
    expect(api.calls.filter(c=>c.tools[0].input_schema.properties.candidates)).toHaveLength(expectedChunks+1);
    expect(result.candidates.find(c=>c.field==='linkDocNo')).toMatchObject({value:'1263/2016',status:'accepted'});
    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'govtRate', value: '1200', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'structValue', value: '0', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'sro', value: 'Sircilla SRO', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'locality', value: 'Lakshmi Nagar', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'village', value: 'Kothapeta', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'mandal', value: 'Sircilla', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'boundaryNorth', value: 'ROAD', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'boundarySouth', value: 'PLOT 15', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'boundaryEast', value: 'PLOT 17', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'boundaryWest', value: 'OPEN LAND', role: 'property', status: 'accepted' }),
    ]));
    expect(profileFields('phase1:linkDoc')).toEqual(expect.arrayContaining(['govtRate', 'structValue']));
    expect(profileFields('phase1:linkDoc')).not.toEqual(expect.arrayContaining(['consid', 'stampValue', 'stampPaperMargin']));
    expect(result.notes).toContain('No native schedule heading was found; examined pages 3 visually.');
  });
  it('accepts serialized, singleton and page-keyed evidence responses without discarding source text', () => {
    expect(structuredArray('[{"number":5,"text":"Schedule"}]')).toEqual([{number:5,text:'Schedule'}]);
    expect(structuredArray({pageNumber:5,text:'Schedule'})).toEqual([{pageNumber:5,text:'Schedule'}]);
    expect(structuredArray({'5':{text:'Schedule'}})).toEqual([{number:5,text:'Schedule'}]);
    expect(structuredArray('invalid JSON')).toEqual([]);
  });
  it('falls back to every later page when a scanned link deed has no native schedule index', async () => {
    const events: ExtractionProgress[]=[]; const partial: SourceResult[]=[];
    const result=await extractSections(pages(81),[],new AbortController().signal,e=>events.push(e),r=>partial.push(r),'phase1:linkDoc');
    // The opening remains fast, while a scan with no native text gets a bounded
    // all-later-pages schedule pass so a schedule on page 5/20/81 is not lost.
    expect(api.calls.filter(c=>c.tools[0].input_schema.properties.pages)).toHaveLength(0);
    const calls=api.calls.filter(c=>c.tools[0].input_schema.properties.candidates && !c.tools[0].input_schema.properties.candidates.items.properties.field.enum.includes('executantName'));
    expect(calls.every(c=>c.model==='read')).toBe(true);
    expect(calls.every(c=>c.tools[0].input_schema.properties.candidates.items.properties.field.enum.length<=10)).toBe(true);
    expect(api.peak).toBeGreaterThan(1);
    const step2Call=calls.find(c=>c.tools[0].input_schema.properties.candidates.items.properties.field.enum.includes('linkDocNo'))!;
    const pageMentions=(call:any)=>[...new Set(call.messages[0].content.flatMap((p:any)=>p.type==='text'?[...p.text.matchAll(/SOURCE PAGE (\d+):/g)].map((m:any)=>Number(m[1])):[]))];
    const scheduleCalls=calls.filter(c=>pageMentions(c).some((n:number)=>n>=3));
    expect(scheduleCalls.length).toBeGreaterThan(1);
    expect(pageMentions(step2Call)).toEqual([1,2]);
    expect(scheduleCalls.every(c=>pageMentions(c).length && pageMentions(c).every((n:number)=>n>=3))).toBe(true);
    expect(api.calls.some(c=>c.messages[0].content.some((p:any)=>p.text?.includes('SOURCE PAGE 81:')))).toBe(true);
    const fields=[step2Call,...scheduleCalls].flatMap(c=>c.tools[0].input_schema.properties.candidates.items.properties.field.enum);
    expect(fields).not.toContain('consid'); expect(fields).not.toContain('executantName');
    expect(result.candidates.every(c=>c.status==='accepted')).toBe(true);
    const states=events.filter((e): e is Exclude<ExtractionProgress,string>=>typeof e!=='string');
    expect(states.filter(e=>e.state==='running').map(e=>e.id)).toEqual(expect.arrayContaining(['step2','step3','step4']));
    expect(partial.length).toBeGreaterThan(1);
    expect(new Set(result.candidates.map(c=>c.id)).size).toBe(result.candidates.length);
    expect(result.candidates.find(c=>c.field==='linkDocNo')).toMatchObject({value:'1263/2016',status:'accepted',page:1});
  });

  it('publishes jurisdiction and property while the document-details worker is still waiting on the provider', async () => {
    let releaseStep2!: () => void;
    api.step2Gate = new Promise<void>(resolve => { releaseStep2 = resolve; });
    const events: ExtractionProgress[] = [];
    const partial: SourceResult[] = [];
    const extraction = extractSections(pages(3), [], new AbortController().signal, e => events.push(e), r => partial.push(r), 'phase1:linkDoc');
    let earlyEvents: ExtractionProgress[] = [];
    let earlyCandidates: Candidate[] = [];
    try {
      // Step 2 remains explicitly gated, not merely slower by a timing assumption.
      // Let independently runnable workers finish before taking a snapshot.
      const deadline = Date.now() + 250;
      while (Date.now() < deadline && !partial.some(r => r.candidates.some(c => c.field === 'plotNo' && c.status === 'accepted'))) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      earlyEvents = [...events];
      earlyCandidates = partial.flatMap(r => r.candidates);
    } finally {
      releaseStep2();
      await extraction;
    }
    const states = earlyEvents.filter((e): e is Exclude<ExtractionProgress, string> => typeof e !== 'string');
    expect(states.filter(e => e.state === 'running').map(e => e.id)).toEqual(expect.arrayContaining(['step2','step3','step4']));
    expect(states.some(e => e.id === 'step2' && e.state === 'done')).toBe(false);
    expect(states.some(e => e.id === 'step3' && e.state === 'done')).toBe(true);
    expect(states.some(e => e.id === 'step4' && e.state === 'done')).toBe(true);
    expect(earlyCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'mandal', value: 'Sircilla', status: 'accepted' }),
      expect.objectContaining({ field: 'plotNo', value: '16', status: 'accepted' }),
    ]));
    expect(earlyCandidates.some(c => c.field === 'linkDocNo' && c.status === 'accepted')).toBe(false);
  });

  it('automatically splits a truncated field response without losing the document fields', async () => {
    api.truncateOnce=true;
    const result=await extractSections(pages(3),[],new AbortController().signal,()=>{},undefined,'phase1:linkDoc');
    expect(result.candidates.filter(c=>c.role==='link').map(c=>c.field)).toEqual(expect.arrayContaining(['linkDocNo','linkDocType','linkDocDate']));
    expect(result.notes).toContain('No native schedule heading was found; examined pages 3 visually.');
  });

  it('reads jurisdiction, schedule and valuation from a short link deed when its schedule is on page 1', async () => {
    const result = await extractSections(pages(1), [], new AbortController().signal, () => {}, undefined, 'phase1:linkDoc');
    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'linkDocNo', value: '1263/2016', role: 'link', status: 'accepted' }),
      expect.objectContaining({ field: 'mandal', value: 'Sircilla', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'boundaryNorth', value: 'ROAD', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'govtRate', value: '1200', role: 'property', status: 'accepted' }),
      expect.objectContaining({ field: 'structValue', value: '0', role: 'property', status: 'accepted' }),
    ]));
    expect(result.notes).toContain('No native schedule heading was found; examined pages 1 visually.');
  });

  it('keeps Phase 1 property projection on the existing primary property across all document cards', () => {
    const c = (field:string,value:string): Candidate=>({id:field,field,value,role:'property',record:'primary',page:1,quote:value,region:'Schedule',historical:false,handwritten:false,status:'accepted'});
    const draft={...newDraft(),manual:{'property|primary|category':'Part open place'},sources:[
      {id:'deed',revision:0,name:'deed.pdf',hash:'deed',status:'done' as const,assignment:{role:'link' as const,record:'deed'},result:{candidates:[c('plotNo','16'),c('boundaryNorth','North neighbour'),c('govtRate','1200'),c('structValue','0')],plans:[],notes:[]}},
      {id:'nala',revision:0,name:'nala.jpg',hash:'nala',status:'done' as const,assignment:{role:'link' as const,record:'nala'},result:{candidates:[c('mandal','Sircilla')],plans:[],notes:[]}},
    ]};
    const state=appStateFor(draft);
    expect(state.form).toMatchObject({plotNo:'16',boundaryNorth:'North neighbour',govtRate:'1200',structValue:'0',mandal:'Sircilla'});
    expect(state.additionalSchedules).toEqual([]);
    expect(state.category).toBe('Part open place');
  });

  it('keeps a manually selected category on each property schedule independently', () => {
    const draft = {
      ...newDraft(),
      propertyIds: ['house', 'flat', 'open'],
      manual: {
        'property|primary|category': 'Vacant Plot',
        'property|house|category': 'Residential',
        'property|flat|category': 'Flat',
        'property|open|category': 'Part open place',
      },
    };
    const state = appStateFor(draft);
    expect(state.category).toBe('Vacant Plot');
    expect(state.additionalSchedules.map(record => record.category)).toEqual(['Residential', 'Flat', 'Part open place']);
  });

  it('uses the appropriate own-record fields for every Phase 1 document type', () => {
    expect(sectionFields('phase1:nala')[0].fields).toContain('nalaOrderNo');
    expect(sectionFields('phase1:titleDeed')[0].fields).toContain('titleDeedNo');
    expect(sectionFields('phase1:permissions')[0].fields).not.toContain('linkDocNo');
  });

  it('gives each Step 2 upload its own dedicated extraction section', () => {
    expect(sectionFields('phase1:linkDoc')[0].title).toBe('Link document details');
    expect(sectionFields('phase1:landLayoutLrs')[0].title).toBe('Vacant land tax, layout and LRS details');
    expect(sectionFields('phase1:houseTax')[0].title).toBe('Property tax and assessment details');
    expect(sectionFields('phase1:titleDeed')[0].title).toBe('Title deed details');
    expect(sectionFields('phase1:nala')[0].title).toBe('NALA order details');
    expect(sectionFields('phase1:permissions')[0].title).toBe('Permissions and approvals details');
  });

  it('includes V.L.T. number in the property-schedule AI extraction schema', () => {
    expect(sectionFields('property-schedule')[0].fields).toContain('assessmentPtinNo');
  });

  it('does not show or run Phase 2+ extraction for non-link document cards', () => {
    for (const profile of ['phase1:houseTax', 'phase1:titleDeed', 'phase1:nala', 'phase1:permissions'] as const) {
      expect(sectionFields(profile)).toHaveLength(1);
      expect(sectionFields(profile)[0].id).toBe('step2');
    }
    expect(sectionFields('phase1:linkDoc').map(section => section.id)).toEqual(['step2', 'link-parties', 'step3', 'step4', 'step5']);
  });

  it('creates an identity extraction worker for Aadhaar/party uploads', () => {
    expect(sectionFields('party:executant')).toHaveLength(1);
    expect(sectionFields('party:executant')[0].id).toBe('identity');
    expect(sectionFields('party:executant')[0].title).toBe('Executant identity details');
    expect(sectionFields('party:executant')[0].fields).toContain('executantRelativeName');
    expect(sectionFields('party:claimant')[0].title).toBe('Claimant identity details');
    expect(sectionFields('party:claimant')[0].fields).toContain('claimantRelativeName');
  });

  it('creates one strictly scoped worker for each direct section upload', () => {
    expect(sectionFields('jurisdiction')).toEqual([{ id: 'jurisdiction', title: 'Jurisdiction details', fields: expect.arrayContaining(['sro', 'district']) }]);
    expect(sectionFields('property-schedule')).toEqual([{ id: 'property-schedule', title: 'Property schedule details', fields: expect.arrayContaining(['plotNo', 'boundaryNorth']) }]);
  });

  it('limits agreement uploads to their own development and supplemental registration fields', () => {
    const sections = sectionFields('flat-agreements');
    expect(sections).toHaveLength(1);
    expect(sections[0].fields).toEqual(expect.arrayContaining(['developmentDocNo', 'developmentDocDate', 'developmentSro', 'developmentSroCode', 'supplementalDocNo', 'supplementalSro', 'supplementalSroCode', 'stiltFloors', 'upperFloors']));
    expect(sections[0].fields).not.toContain('linkDocNo');
    expect(sections[0].fields).not.toContain('consid');
    expect(sections[0].fields).not.toContain('executantName');
    expect(profileFields('flat-agreements')).toEqual(expect.arrayContaining(['developmentDocNo', 'developmentDocDate', 'developmentSro', 'developmentSroCode', 'supplementalDocNo', 'supplementalSro', 'supplementalSroCode', 'stiltFloors', 'upperFloors']));
  });

  it('offers link uploads every jurisdiction, schedule, boundary and market-value field without old transaction values', () => {
    const fields = profileFields('phase1:linkDoc');
    expect(fields).toEqual(expect.arrayContaining(['sro', 'district', 'mandal', 'village', 'locality', 'boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest', 'govtRate', 'structValue']));
    expect(fields).not.toEqual(expect.arrayContaining(['consid', 'stampValue', 'stampPaperMargin']));
  });

  it('projects one Step 2 Link Document upload into its link record and the same property schedule', () => {
    const candidates = [
      ['linkDocNo', '1263/2016', 'link'], ['linkDocType', 'Sale Deed', 'link'], ['linkSro', 'SIRCILLA SRO', 'link'],
      ['sro', 'SIRCILLA SRO', 'property'], ['district', 'RAJANNA SIRCILLA', 'property'], ['mandal', 'SIRCILLA', 'property'],
      ['village', 'SIRCILLA', 'property'], ['locality', 'GANESHNAGAR', 'property'], ['plotNo', '16', 'property'],
      ['surveyNo', '795/B&D', 'property'], ['extentSqYards', '157.22', 'property'], ['boundaryNorth', 'NORTH ROAD', 'property'],
      ['boundarySouth', '21 Road', 'property'], ['boundaryEast', 'PLOT 17', 'property'], ['boundaryWest', 'OPEN LAND', 'property'],
      ['govtRate', '1200', 'property'], ['structValue', '0', 'property'],
    ].map(([field, value, role], index) => {
      const candidate = cleanCandidate({ field, value, role, record: 'primary', quote: `${field}: ${value}`, region: 'Link deed', handwritten: false, historical: false }, 1, index);
      expect(candidate).not.toBeNull();
      return { ...candidate!, status: 'accepted' as const };
    });
    const draft = {
      ...newDraft(),
      sources: [{ id: 'one-link-deed', revision: 0, name: 'link.docx', hash: 'link', status: 'done' as const, profile: 'phase1:linkDoc',
        assignment: { role: 'link' as const, record: 'title-primary', propertyRecord: 'primary' },
        result: { candidates, plans: [], notes: [] } }],
    };
    const state = appStateFor(draft);
    expect(state.linkRecordsBySchedule.primary[0].values).toMatchObject({ linkDocNo: '1263/2016', linkDocType: 'Sale Deed', linkSro: 'Sircilla SRO' });
    expect(state.form).toMatchObject({ sro: 'Sircilla SRO', district: 'RAJANNA SIRCILLA', mandal: 'Sircilla', village: 'Sircilla', locality: 'Ganeshnagar', plotNo: '16', surveyNo: '795/B&D', extentSqYards: '157.22', boundaryNorth: 'NORTH ROAD', boundarySouth: '21 Road', boundaryEast: 'PLOT 17', boundaryWest: 'OPEN LAND', govtRate: '1200', structValue: '0' });
    expect(state.additionalSchedules).toEqual([]);
  });

  it('tolerates typography and case while preserving identifier and extent differences', () => {
    const c={field:'boundarySouth',value:"21' Road",role:'property',record:'primary'} as Candidate;
    expect(sameTranscription(c,{...c,value:'21’ ROAD.'})).toBe(true);
    expect(sameTranscription(c,{...c,value:"22' Road"})).toBe(false);
    expect(sameTranscription({...c,field:'surveyNo',value:'795/B&D'},{...c,field:'surveyNo',value:'795/B/D'})).toBe(false);
    expect(sameTranscription({...c,field:'nearHNo',value:'10-1-36/1'},{...c,field:'nearHNo',value:'H.No.10-1-36/1'})).toBe(true);
    expect(sameTranscription({...c,field:'nearHNo',value:'10-1-36/1'},{...c,field:'nearHNo',value:'H.No.10-1-36/2'})).toBe(false);
  });
});

it('requests every H.No./PTIN pair in the Step 2 house-tax and assessment workers', () => {
  for (const profile of ['phase1:houseTax', 'phase1:assessment'] as const) {
    expect(profileFields(profile)).toContain('housePtinPairs');
    expect(sectionFields(profile)).toHaveLength(1);
    expect(sectionFields(profile)[0].fields).toContain('housePtinPairs');
  }
});

it('requests all four dimensions as well as the four boundaries from a property map upload', () => {
  const fields = profileFields('property-schedule');
  for (const side of ['North', 'South', 'East', 'West']) {
    expect(fields).toContain('dimension' + side);
    expect(fields).toContain('boundary' + side);
  }
});

it('accepts the labelled cells in the three Step 2 tax layouts', () => {
  const read = (field: string, value: string, quote: string) => cleanCandidate({
    field, value, quote, role: 'link', record: 'primary', region: 'Tax table',
    historical: false, handwritten: false,
  }, 1, 0, 'phase1:houseTax');
  expect(read('bltNo', '001234', 'Assessment No 17; PTIN (Property Tax Identification Number) 001234')?.value).toBe('001234');
  expect(read('bltNo', '17', 'Assessment No 17; PTIN (Property Tax Identification Number) 001234')).toBeNull();
  expect(read('houseTaxReceiptNo', '8212P00618/0', 'Book No./Receipt No. 8212P00618 / 0')?.value).toBe('8212P00618/0');
  expect(read('taxPaidDate', '2026-06-16', 'Date of Payment 16/06/2026')?.value).toBe('2026-06-16');
  expect(read('taxPaidDate', '2026-04-18', 'Transaction Date 18-04-2026 01:11 PM')?.value).toBe('2026-04-18');
  expect(read('taxPaidDate', '0026-11-04', 'Dt. of Collection 04/11/0026')).toBeNull();
  expect(read('taxPaidDate', '2026-10-28', 'Dt. of Asmt. 28/10/2026')).toBeNull();
  expect(read('localAuthorityType', 'Municipality', 'ULB: Example Municipality')).toMatchObject({ role: 'property', value: 'Municipal Council' });
  expect(read('localAuthorityType', 'Gram Panchayat', 'Panchayat: Example')).toMatchObject({ role: 'property', value: 'Gram Panchayat' });
  expect(read('localAuthorityType', 'GHMC', 'Core Urban Region Economy (CURE) Property Tax Receipt Details')).toMatchObject({ role: 'property', value: 'GHMC' });
  expect(read('localAuthorityType', 'Example Board', 'ULB: Example Board')).toMatchObject({ role: 'property', value: 'Example Board' });
});
