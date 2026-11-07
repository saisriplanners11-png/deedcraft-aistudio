import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { releaseShare, releasedExtent, releasedSquareMetres, releasedTotal, releaseValues } from './release';
import { validateReleaseTemplate, validateDeedTemplate, docxToText, readZip, writeZip, replaceRunText, type DeedTemplateSource } from './docx';
import { sampleState, renderSample } from './template-runtime';
import { compileDeed, renderArtifact } from './deed-compiler';
import { mergeValues, rewritesFor, scheduleMergesFor } from './merge';
import { appStateFor, draftReducer, newDraft, fieldKey } from './source-draft';
import { updateSavedDeedTemplate } from './template-version-status';
import type { SavedDeed } from './saved-deeds';
const bytes=new Uint8Array(await readFile(new URL('./release-deed-template-v1.docx',import.meta.url)));
const source:DeedTemplateSource={kind:'custom',bytes,hash:'test',name:'Release.docx',validation:await validateReleaseTemplate(bytes)};
const make=(sellers=1,buyers=1,family=false)=>{
  const state=sampleState('ordinary-plot'); state.deedType='Release';state.draft=family?'Family Release':'Co-owner Release';
  Object.assign(state.form,{totalPropertyValue:'3000000',consid:'1500000',executantName:'Alice',executantGender:'Female',claimantName:'Bob',claimantGender:'Male',claimantDob:'1990-01-01',executantPan:'ABCDE1234F',claimantPan:'ABCDE5678G'});
  state.additionalExecutants=Array.from({length:sellers-1},(_,i)=>({id:'seller-'+i,docNames:[],values:{...state.form,executantName:'Seller '+i,executantGender:'Male'}}));
  state.additionalClaimants=Array.from({length:buyers-1},(_,i)=>({id:'buyer-'+i,docNames:[],values:{...state.form,claimantName:'Buyer '+i,claimantGender:'Female'}}));
  state.releaseData={releasedBySchedule:{primary:{primary:'1/3'}},relationships:family?[{id:'relation-1',releasorId:'primary',releaseeId:'primary',wording:'sister'}]:[]};
  return state;
};
async function generate(state:ReturnType<typeof make>,custom:DeedTemplateSource=source){
  const snapshot={instrumentId:'release' as const,variantId:state.draft==='Family Release'?'family-release':'co-owner-release',snapshotHash:'test',values:mergeValues(state),schedules:scheduleMergesFor(state),rewrites:rewritesFor(state),unresolvedWarnings:[]};
  const {result,manifest}=await renderArtifact(compileDeed(snapshot,custom),'docx');
  const output=new Uint8Array(await result.blob.arrayBuffer());return {text:await docxToText(output),output,manifest};
}
describe('Release exact shares',()=>{
  it('calculates fractions exactly and rounds only displayed extents',()=>{
    expect(releasedExtent('200','1/3')).toBe('66.67'); expect(releasedSquareMetres('200','1/3')).toBe('55.74');
    expect(releasedTotal([{id:'a',name:'A',share:'1/3'},{id:'b',name:'B',share:'1/3'},{id:'c',name:'C',share:'1/3'}])).toBe('1/1');
    expect(releasedExtent('200','25%')).toBe('50.00');
    for(const value of ['0','0/2','1/0','4/3','101','-1','NaN','1e2']) expect(releaseShare(value)).toBeNull();
  });
  it('does not fabricate complete totals from partial entries or combine legacy and named shares',()=>{
    expect(releasedTotal([{id:'a',name:'A',share:'1/3'},{id:'b',name:'B',share:''}],'1/2')).toBe('');
    expect(releasedTotal([{id:'a',name:'A',share:''}],'1/2')).toBe('1/2');
  });
});
describe('Release source, parties and preservation',()=>{
  it('retains the exact immutable uploaded asset and rejects missing source bindings',async()=>{
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('d3077f53109780af91f60d77299737ce5f190198d8a46a126e03eb7237db33f1');
    expect(source.kind==='custom'&&source.validation.errors).toEqual([]);
    const entries=await readZip(bytes),entry=entries.find(e=>e.name==='word/document.xml')!;
    entry.data=new TextEncoder().encode(new TextDecoder().decode(entry.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>replaceRunText(p,/<Shared UDS>/g,()=>'')));
    const broken=await writeZip(entries);
    expect((await validateDeedTemplate(broken,'release')).valid).toBe(false);
    const stale={...source,bytes:broken} as DeedTemplateSource;
    await expect(generate(make(),stale)).rejects.toThrow(/Shared UDS/);
  });
  for(const [a,b] of [[1,1],[3,1],[1,3],[3,3]]) it(`renders ${a} releasors and ${b} releasees separately`,async()=>{
    const state=make(a,b), {text,output,manifest}=await generate(state);
    expect(text).toContain('RELEASE DEED BETWEEN CO-OWNERS');
    expect(text).toContain('Alice HAS RELEASED HER UNDIVIDED 1/3');
    expect((text.match(/SIGNATURE OF THE RELEASOR/g)||[]).length).toBe(a);
    expect((text.match(/SIGNATURE OF THE RELEASEE/g)||[]).length).toBe(b);
    expect(text.match(/Hereinafter called the "RELEASORS?"/g)?.length).toBe(1);
    expect(text.match(/Hereinafter called the "RELEASEES?"/g)?.length).toBe(1);
    expect(text).toContain(b===1?'in his name':'in their names');
    expect(text).not.toMatch(/<[^>]+>|Vendor\/s|Vendee\/s|HAS\/HAVE/);
    expect(manifest.instrumentId).toBe('release');
    const original=await readZip(bytes), generated=await readZip(output);
    for(const part of original.filter(e=>/footer|styles.xml/.test(e.name))) expect(generated.find(e=>e.name===part.name)?.data).toEqual(part.data);
  });
  it('prints named family relationships and recipient allocations',async()=>{
    const state=make(1,2,true);state.releaseData!.allocatedBySchedule={primary:{primary:'1/6','buyer-0':'1/6'}};
    const {text}=await generate(state);expect(text).toContain('Alice is sister of Bob.');
    expect(text).toContain('Bob: received share 1/6');expect(text).toContain('Buyer 0: received share 1/6');
  });
  it('omits blank figures and shared areas without changing the total property',async()=>{
    const state=make();state.releaseData={};const {text}=await generate(state);
    expect(text).toContain('total area of 200 square yards');expect(text).not.toContain('The details are: an area');
    expect(text).not.toMatch(/UNDIVIDED|<Share>|undefined|NaN/);
  });
  it('prints partial named shares without representing their sum as a complete released share',async()=>{
    const {text}=await generate(make(2));expect(text).toContain('Alice HAS RELEASED HER UNDIVIDED 1/3');
    expect(text).toContain('Value of Releasors Share');expect(text).not.toContain('Value of Releasors 1/3');
  });
  it('keeps saved ownership percentages distinct from newly entered released shares',async()=>{
    const state=make();state.vendorSharesBySchedule={primary:{primary:'50'}};
    const {text}=await generate(state);
    expect(text).toContain('Holding Undivided Share of 50%');
    expect(text).toContain('Alice HAS RELEASED HER UNDIVIDED 1/3');
    expect(state.vendorSharesBySchedule.primary.primary).toBe('50');
  });
  it('blocks unsupported categories, invalid amounts and incomplete relationships',async()=>{
    const state=make(2,1,true);await expect(generate(state)).rejects.toThrow(/family relationship/);
    state.draft='Co-owner Release';state.category='Agricultural land';await expect(generate(state)).rejects.toThrow(/unsupported property category/i);
    state.category='Vacant Plot';state.form.consid='0';await expect(generate(state)).rejects.toThrow(/consideration/);
  });
  it('retains each payment mode, reference and loan branch',async()=>{
    const state=make();state.payments=['rtgs','cheque','dd','upi','cash','housing-loan','through-bank'].map((mode,i)=>({ ...state.payments[0],id:'pay-'+i,mode:mode as typeof state.payments[0]['mode'],amount:'100',refNo:'REF-'+i,bank:'BANK-'+i,branch:'BRANCH-'+i,date:i%2?'2026-10-02':'',payer:'Bob',payee:'Alice'}));
    const {text}=await generate(state);
    for(let i=0;i<4;i++) expect(text).toContain('REF-'+i);
    expect(text).toContain('REF-5');expect(text).toContain('BRANCH-5 Branch');
    expect(text).toContain('02-10-2026');expect(text).not.toMatch(/dated:\s*[.,]|<Date>/);
    expect((text.match(/Housing Loan:/g)||[]).length).toBe(1);
  });
  it('keeps property and amendment record offices independent',async()=>{
    const state=make();state.linkRecordsBySchedule={primary:[
      {id:'title',docNames:[],values:{linkOption:'linkDoc',linkDocType:'Sale Deed',linkDocNo:'TITLE-1',linkDocDate:'2020-01-01',linkSro:'Title Office',linkSroCode:'1001'}},
      {id:'amend',docNames:[],values:{linkOption:'linkDoc',linkDocType:'Rectification Deed',linkDocNo:'AMEND-1',linkDocDate:'2021-02-03',linkSro:'Amendment Office',linkSroCode:'1002'}},
    ]};
    const {text}=await generate(state);expect(text).toContain('TITLE-1');expect(text).toContain('AMEND-1');expect(text).toContain('Amendment Office (1002)');expect(text).toContain('03-02-2021');
  });
  for(const [selection,twips] of [['100','8352'],['50','8640'],['20','8640'],['None','1080'],['Legacy','8208']]) it(`honors ${selection} stamp margin`,async()=>{
    const state=make();state.form.stampPaperMargin=selection;const {output}=await generate(state);
    const xml=new TextDecoder().decode((await readZip(output)).find(e=>e.name==='word/document.xml')!.data);
    const margins=[...xml.matchAll(/<w:pgMar\b[^>]*w:top="(\d+)"/g)].map(m=>m[1]);
    expect(margins[0]).toBe(twips);expect(margins.slice(1).every(m=>m==='1080')).toBe(true);
  });
  it('uses the Release renderer for fresh replacement publication samples',async()=>{
    const output=await renderSample('plot',source);expect(await docxToText(output)).toContain('RELEASE DEED BETWEEN CO-OWNERS');
  });
});
describe('Release saved data',()=>{
  it('retains named shares, legacy shares and relationships on restore and isolates removal',()=>{
    let draft=draftReducer(newDraft(),{type:'instrument',instrumentId:'release',variantId:'family-release'});
    for(const [role,id,name] of [['executant','a','Alice'],['executant','b','Second'],['claimant','c','Bob']] as const) draft=draftReducer(draft,{type:'manual',key:fieldKey(role,id,role+'Name'),value:name});
    draft.releaseData={releasedBySchedule:{primary:{a:'1/3',b:'25%'}},relationships:[{id:'r',releasorId:'a',releaseeId:'c',wording:'sister'}]};
    draft=draftReducer(draft,{type:'manual',key:fieldKey('property','primary','releasedShare'),value:'1/2'});
    const restored=draftReducer(newDraft(),{type:'load',draft:JSON.parse(JSON.stringify(draft))});
    expect(appStateFor(restored).releaseData).toEqual(draft.releaseData);expect(appStateFor(restored).form.releasedShare).toBe('1/2');
    const removed=draftReducer(restored,{type:'remove-party',role:'executant',record:'b'});
    expect(removed.releaseData?.releasedBySchedule?.primary).toEqual({a:'1/3'});expect(removed.releaseData?.relationships).toEqual(draft.releaseData.relationships);
  });
  it('refreshes default metadata and leaves explicit custom sources selected',()=>{
    const deed={draft:{...newDraft(),instrumentId:'release',variantId:'co-owner-release'},templateMode:'built-in',updatedAt:'unchanged',generationManifest:{templateVersionId:'old'}} as SavedDeed;
    const migrated=updateSavedDeedTemplate(deed,{});expect(migrated.libraryTemplate?.versionId).toBe('release-deed-v1');expect(migrated.generationManifest).toBeNull();expect(migrated.updatedAt).toBe('unchanged');expect(migrated.draft).toBe(deed.draft);
    const custom=updateSavedDeedTemplate({...deed,templateMode:'custom',customTemplate:source as SavedDeed['customTemplate']},{});expect(custom.customTemplate).toBe(source);expect(custom.templateMode).toBe('custom');
  });
});
