import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acreGuntasToSqYards, cleanCandidate, extractSections, extractUpload,  requiresFullVisualConfirmation, sameTranscription, sectionFields, structuredArray, type ExtractionProgress } from './upload-extraction';
import { appStateFor, newDraft, type Candidate, type SourceResult } from './source-draft';

const api = vi.hoisted(() => ({ calls: [] as any[], active: 0, peak: 0, truncateOnce: false, transientOnce:false, step2Gate: undefined as Promise<void> | undefined }));
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
        const values: Record<string,string> = { linkDocNo: '1263/2016', linkDocType: 'Sale Deed', linkDocDate: '2016-02-27', mandal: 'Sircilla', plotNo: '16', extentSqYards: '157.22' };
        input = { candidates: fields.filter((f: string) => values[f]).map((field: string) => ({ field, value: values[field], role: field.startsWith('link') ? 'link' : 'property', record: 'primary', page: 1, quote: values[field], region: 'Source label', historical: false, handwritten: false })), plan: null, notes: [] };
      }
      return { stop_reason: 'end_turn', content: [{ type: 'tool_use', name: 'record_transcription', input }] };
    } finally { api.active--; }
  } } }),
}));

const pages = (count: number) => Array.from({length: count}, (_,i) => ({number:i+1,region:`Page ${i+1}`,parts:[{type:'text' as const,text:`source page ${i+1}`}]}));
beforeEach(() => { api.calls=[]; api.active=0; api.peak=0; api.truncateOnce=false; api.transientOnce=false; api.step2Gate=undefined; });

describe('shared document section extraction', () => {
  it('uses the value labelled Doct No. instead of a neighbouring CS number', () => {
    const candidate = cleanCandidate({
      field: 'linkDocNo', value: '1323/2016', role: 'link', record: 'primary',
      quote: 'Book 1: CS No. 1323/2016 & Doct No. 1263/2016', region: 'Registration margin',
      historical: true, handwritten: false,
    }, 2, 0);
    expect(candidate).toMatchObject({ value: '1263/2016', page: 2 });
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
    const scheduleFieldCount=sections.filter(s=>s.id==='step3'||s.id==='step4').reduce((n,s)=>n+s.fields.length,0);
    const expectedChunks=1+Math.ceil(scheduleFieldCount/10);
    api.transientOnce=true;
    const result=await extractSections(pages(3),[],new AbortController().signal,()=>{},undefined,'phase1:linkDoc');
    // Whichever chunk's first attempt eats the injected 500 retries once and
    // succeeds; every other chunk is unaffected — one extra call overall.
    expect(api.calls.filter(c=>c.tools[0].input_schema.properties.candidates)).toHaveLength(expectedChunks+1);
    expect(result.candidates.find(c=>c.field==='linkDocNo')).toMatchObject({value:'1263/2016',status:'accepted'});
    expect(result.notes).toEqual([]);
  });
  it('accepts serialized, singleton and page-keyed evidence responses without discarding source text', () => {
    expect(structuredArray('[{"number":5,"text":"Schedule"}]')).toEqual([{number:5,text:'Schedule'}]);
    expect(structuredArray({pageNumber:5,text:'Schedule'})).toEqual([{pageNumber:5,text:'Schedule'}]);
    expect(structuredArray({'5':{text:'Schedule'}})).toEqual([{number:5,text:'Schedule'}]);
    expect(structuredArray('invalid JSON')).toEqual([]);
  });
  it('reads only pages 1-3 of a link deed, chunking the schedule fields into small concurrent calls', async () => {
    const events: ExtractionProgress[]=[]; const partial: SourceResult[]=[];
    const result=await extractSections(pages(81),[],new AbortController().signal,e=>events.push(e),r=>partial.push(r),'phase1:linkDoc');
    // No OCR pre-pass and no independent re-check: one call for the
    // document-details fields (pages 1-2); jurisdiction+schedule (page 3) is
    // split into same-sized chunks so no single request pairs 30+ fields
    // with their values, all dispatched together.
    expect(api.calls.filter(c=>c.tools[0].input_schema.properties.pages)).toHaveLength(0);
    const calls=api.calls.filter(c=>c.tools[0].input_schema.properties.candidates);
    expect(calls.every(c=>c.model==='read')).toBe(true);
    expect(calls.every(c=>c.tools[0].input_schema.properties.candidates.items.properties.field.enum.length<=10)).toBe(true);
    expect(api.peak).toBeGreaterThan(1);
    const step2Call=calls.find(c=>c.tools[0].input_schema.properties.candidates.items.properties.field.enum.includes('linkDocNo'))!;
    const scheduleCalls=calls.filter(c=>c!==step2Call);
    expect(scheduleCalls.length).toBeGreaterThan(1);
    const pageMentions=(call:any)=>[...new Set(call.messages[0].content.flatMap((p:any)=>p.type==='text'?[...p.text.matchAll(/SOURCE PAGE (\d+):/g)].map((m:any)=>Number(m[1])):[]))];
    expect(pageMentions(step2Call)).toEqual([1,2]);
    expect(scheduleCalls.every(c=>pageMentions(c).length && pageMentions(c).every((n:number)=>n===3))).toBe(true);
    expect(api.calls.every(c=>!c.messages[0].content.some((p:any)=>p.text?.includes('SOURCE PAGE 4:')))).toBe(true);
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
    expect(result.notes).toEqual([]);
  });

  it('keeps Phase 1 property projection on the existing primary property across all document cards', () => {
    const c = (field:string,value:string): Candidate=>({id:field,field,value,role:'property',record:'primary',page:1,quote:value,region:'Schedule',historical:false,handwritten:false,status:'accepted'});
    const draft={...newDraft(),manual:{'property|primary|category':'Part open place'},sources:[
      {id:'deed',revision:0,name:'deed.pdf',hash:'deed',status:'done' as const,assignment:{role:'link' as const,record:'deed'},result:{candidates:[c('plotNo','16')],plans:[],notes:[]}},
      {id:'nala',revision:0,name:'nala.jpg',hash:'nala',status:'done' as const,assignment:{role:'link' as const,record:'nala'},result:{candidates:[c('mandal','Sircilla')],plans:[],notes:[]}},
    ]};
    const state=appStateFor(draft);
    expect(state.form).toMatchObject({plotNo:'16',mandal:'Sircilla'});
    expect(state.additionalSchedules).toEqual([]);
    expect(state.category).toBe('Part open place');
  });

  it('uses the appropriate own-record fields for every Phase 1 document type', () => {
    expect(sectionFields('phase1:nala')[0].fields).toContain('nalaOrderNo');
    expect(sectionFields('phase1:titleDeed')[0].fields).toContain('titleDeedNo');
    expect(sectionFields('phase1:permissions')[0].fields).not.toContain('linkDocNo');
  });

  it('gives each Step 2 upload its own dedicated extraction section', () => {
    expect(sectionFields('phase1:linkDoc')[0].title).toBe('Link document details');
    expect(sectionFields('phase1:houseTax')[0].title).toBe('House tax receipt details');
    expect(sectionFields('phase1:titleDeed')[0].title).toBe('Title deed details');
    expect(sectionFields('phase1:nala')[0].title).toBe('NALA order details');
    expect(sectionFields('phase1:permissions')[0].title).toBe('Permissions and approvals details');
  });

  it('does not show or run Phase 2+ extraction for non-link document cards', () => {
    for (const profile of ['phase1:houseTax', 'phase1:titleDeed', 'phase1:nala', 'phase1:permissions'] as const) {
      expect(sectionFields(profile)).toHaveLength(1);
      expect(sectionFields(profile)[0].id).toBe('step2');
    }
    expect(sectionFields('phase1:linkDoc').map(section => section.id)).toEqual(['step2', 'step3', 'step4']);
  });

  it('creates an identity extraction worker for Aadhaar/party uploads', () => {
    expect(sectionFields('party:executant')).toHaveLength(1);
    expect(sectionFields('party:executant')[0].id).toBe('identity');
    expect(sectionFields('party:executant')[0].title).toBe('Executant identity details');
    expect(sectionFields('party:executant')[0].fields).toContain('executantRelativeName');
    expect(sectionFields('party:claimant')[0].title).toBe('Claimant identity details');
    expect(sectionFields('party:claimant')[0].fields).toContain('claimantRelativeName');
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
