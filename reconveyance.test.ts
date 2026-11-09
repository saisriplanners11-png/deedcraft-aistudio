import { newPartyRepresentative } from './fields';
import { describe, expect, it } from 'vitest';
import { mortgagePaise, reconveyanceAmounts } from './reconveyance';

const record = (id: string, mortgageAmount: string) => ({ id, values: { mortgageAmount } });
describe('Reconveyance repayment amounts', () => {
  it('adds decimal amounts exactly and counts each mortgage record once', () => {
    const result = reconveyanceAmounts([record('a', '0.10'), record('b', '0.20'), record('a', '0.10')], '', '0');
    expect(result.total).toBe('0.30');
    expect(result.errors).toEqual([]);
  });
  it('retains a manual principal independently of updated links', () => {
    expect(reconveyanceAmounts([record('a', '200')], '100', '25.05')).toMatchObject({ linkTotal: '200.00', principal: '100.00', total: '125.05', overridden: true });
    expect(reconveyanceAmounts([record('a', '200')], '', '0').principal).toBe('200.00');
  });
  it('blocks missing mortgage amounts even with a principal override', () => {
    expect(reconveyanceAmounts([record('a', '')], '100', '0').errors.length).toBeGreaterThan(0);
    expect(reconveyanceAmounts([], '100', '0').errors.length).toBeGreaterThan(0);
  });
  it('rejects invalid money and requires explicit interest', () => {
    for (const value of ['', '-1', 'NaN', '1.001', '1e3']) expect(mortgagePaise(value)).toBeNull();
    expect(reconveyanceAmounts([record('a', '10')], '', '').total).toBe('');
  });
});

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { docxToText, fillReconveyanceDeed, readZip, validateReconveyanceTemplate, writeZip, replaceRunText, type DeedTemplateSource } from './docx';
import { sampleState } from './template-runtime';
import { mergeValues, scheduleMergesFor, rewritesFor } from './merge';
import { appStateFor, draftReducer, fieldKey, newDraft } from './source-draft';
import { reconveyanceErrors, repaymentFor } from './reconveyance';
import { generationBlockers, buildViewModel } from './logic';
import { stepsFor } from './workflow-steps';
import { compileDeed, renderArtifact } from './deed-compiler';
import { DEED_DEFINITIONS } from './instruments';
import { cleanCandidate, profileFields, sectionFields } from './upload-extraction';

const bytes = new Uint8Array(await readFile(new URL('./reconveyance-deed-template-v1.docx', import.meta.url)));
const source: DeedTemplateSource = { kind: 'custom', bytes, hash: 'test', name: 'reconveyance.docx', validation: await validateReconveyanceTemplate(bytes) };
function mortgageState(count = 1, mode = 'bank-to-person', title = true, property = 'plot') {
  const state = sampleState(property);
  state.deedType = 'Deed Of Reconvayance'; state.draft = title ? 'TITLE DEED' : DEED_DEFINITIONS.reconveyance.variants[1].label;
  Object.assign(state.form, { bankName: 'SAMPLE BANK', bankBranch: 'Central', officialDesignation: 'Manager', mortgagePartyMode: mode, interestAmount: '0', nearAdjacent: 'near', claimantDob: '1991-01-01' });
  state.linkRecordsBySchedule = { primary: Array.from({length: count}, (_, i) => ({ id: `mortgage-${i}`, docNames: [], values: { linkOption: 'linkDoc', linkDocNo: `DOC-${i+1}`, linkDocDate: `2025-01-0${i+1}`, linkSro: `OFFICE-${i+1}`, linkSroCode: `CODE-${i+1}`, mortgageAmount: `${(i+1)*100}.10` } })) };
  return state;
}
async function generate(state: ReturnType<typeof mortgageState>) {
  const compiled = compileDeed({ instrumentId: 'reconveyance', variantId: state.draft === 'TITLE DEED' ? 'title-deed' : DEED_DEFINITIONS.reconveyance.variants[1].id, snapshotHash: 'test', values: mergeValues(state), schedules: scheduleMergesFor(state), rewrites: rewritesFor(state), unresolvedWarnings: [] }, source);
  return (await renderArtifact(compiled, 'docx')).result;
}
describe('Reconveyance source rendering and workflow', () => {
  it('registers the exact immutable source and accepts its bindings', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('313d04bd3de1eb11949e6c9e3721ae5073250c43ea969330168b8801a98ba62b');
    expect(source.kind === 'custom' && source.validation.errors).toEqual([]);
    expect(profileFields('phase1:linkDoc')).toContain('mortgageAmount');
    expect(sectionFields('phase1:linkDoc').find(s=>s.id==='step2')?.fields).toContain('mortgageAmount');
  });
  for (const [title,mode] of [[true,'bank-to-person'],[false,'bank-to-person'],[false,'person-to-person']] as const) for (const count of [1,2,3]) {
    it(`renders ${title ? 'title' : 'mortgage'} ${mode}, ${count} mortgages`, async () => {
      const state = mortgageState(count,mode,title);
      const result = await generate(state);
      const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
      expect(text).toContain('DEED OF RECONVEYANCE');
      expect(text).toContain(`Value of Rs.${repaymentFor(state).total}`);
      expect(text).toMatch(/interest of Rs\.0(?![.][0-9])/);
      expect(text.match(/additional mortgage/g)?.length || 0).toBe(count - 1);
      for(let i=1;i<=count;i++) expect(text).toContain(`Document No.DOC-${i}, dated:0${i}-01-2025`);
      for(let i=1;i<=count;i++) { expect(text).toContain(`Sub-Registrar, OFFICE-${i} (CODE-${i})`); expect(text).toContain(`amount of Rs.${i*100}.10/-`); }
      expect(text).not.toMatch(/<IF |<Principal|<Intrest|DD-MM-YYYY/);
      if(mode==='person-to-person') expect(text).not.toContain('SAMPLE BANK'); else expect(text).toContain('SAMPLE BANK');
      expect(text).toContain(title ? 'Deposit of Title Deeds' : 'Mortgage Deeds');
      expect(text).toContain('near house No.3-4');
    });
  }
  for (const property of ['plot','open','part','dismantled','house-finished','house-semi','flat-finished','flat-semi']) it(`renders source property block ${property}`, async () => {
    const state=mortgageState(1,'bank-to-person',true,property==='house-finished' ? 'ordinary-house-finished' : property==='house-semi' ? 'ordinary-house-semi' : property);
    const result=await generate(state);
    const text=await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text.match(/SCHEDULE OF PROPERTY/g)).toHaveLength(1);
    expect(text).not.toMatch(/<IF |<[^>]+>/);
    const original=await readZip(bytes), generated=await readZip(new Uint8Array(await result.blob.arrayBuffer()));
    for(const entry of original.filter(e=>e.name!=='word/document.xml')) expect(generated.find(e=>e.name===entry.name)?.data).toEqual(entry.data);
  });
  it('validates bank fields, unsupported properties, positive mortgage/principal and explicit interest', async () => {
    const state=mortgageState(); state.form.bankName='';
    expect(reconveyanceErrors(state).join(' ')).toContain('bankName');
    await expect(generate(state)).rejects.toThrow(/bank name/);
    state.draft=DEED_DEFINITIONS.reconveyance.variants[1].label; state.form.mortgagePartyMode='person-to-person';
    expect(reconveyanceErrors(state)).toEqual([]);
    state.category='Agricultural land'; expect(reconveyanceErrors(state).join(' ')).toContain('does not support');
    await expect(generate(state)).rejects.toThrow(/Unsupported/);
  });
  it('uses per-property links once and preserves overrides and saved draft data', () => {
    let draft=draftReducer(newDraft(),{type:'instrument',instrumentId:'reconveyance'});
    const set=(role:'property'|'link',record:string,field:string,value:string)=>{draft=draftReducer(draft,{type:'manual',key:fieldKey(role,record,field),value});};
    for(const [id,property,amount] of [['a','primary','0.10'],['b','second','0.20'],['c','second','100']]) {
      draft=draftReducer(draft,{type:'link-property',record:id,propertyId:property});
      set('link',id,'linkOption','linkDoc'); set('link',id,'mortgageAmount',amount);
    }
    for(const [field,value] of Object.entries({ interestAmount:'0',bankName:'Bank',bankBranch:'Branch',officialDesignation:'Manager',mortgagePartyMode:'bank-to-person' })) set('property','primary',field,value);
    expect(repaymentFor(appStateFor(draft)).principal).toBe('100.30');
    set('property','primary','principalOverride','50.05'); set('link','a','mortgageAmount','10');
    draft=draftReducer(draft,{type:'load',draft:JSON.parse(JSON.stringify(draft))});
    expect(repaymentFor(appStateFor(draft))).toMatchObject({principal:'50.05',linkTotal:'110.20'});
    expect(appStateFor(draft).form.bankName).toBe('Bank');
    set('property','primary','principalOverride',''); expect(repaymentFor(appStateFor(draft)).principal).toBe('110.20');
    set('link','c','mortgageAmount',''); expect(repaymentFor(appStateFor(draft)).errors.length).toBeGreaterThan(0);
    set('link','c','linkOption',''); expect(repaymentFor(appStateFor(draft)).principal).toBe('10.20');
  });
  it('skips payment and valuation requirements and duty estimates', () => {
    const state=mortgageState(); state.payments=[];
    expect(stepsFor(state.deedType).some(step=>step.id===5)).toBe(false);
    expect(generationBlockers(state).some(item=>/consid|payment|govtRate|structValue/i.test(item.id))).toBe(false);
    const vm=buildViewModel(state,()=>{}); expect(vm.dutyRows).toEqual([]); expect(vm.dutyINR).toBe('');
  });
  it('rejects a replacement missing a repayment binding', async () => {
    const entries=await readZip(bytes), doc=entries.find(e=>e.name==='word/document.xml')!;
    doc.data=new TextEncoder().encode(replaceRunText(new TextDecoder().decode(doc.data), /<Intrest Amount>/g,()=>''));
    expect((await validateReconveyanceTemplate(await writeZip(entries))).valid).toBe(false);
  });
});

it('extracts the uploaded mortgage loan amount and rejects older recited amounts', () => {
  const candidate={field:'mortgageAmount',value:'Rs.1,234.50/-',role:'link',record:'primary',quote:'Mortgage Loan Amount: Rs.1,234.50/-',region:'opening',historical:false,handwritten:false};
  expect(cleanCandidate(candidate,1,0)?.value).toBe('1234.50');
  expect(cleanCandidate({...candidate,historical:true,quote:'Earlier mortgage for Rs.1234.50'},1,0)).toBeNull();
  let draft=draftReducer(newDraft(),{type:'instrument',instrumentId:'reconveyance'});
  for (const id of ['front','back']) draft=draftReducer(draft,{type:'add',source:{id,revision:0,name:id,hash:id,status:'done',assignment:{role:'link',record:'same-mortgage'},result:{candidates:[{...cleanCandidate(candidate,1,0)!,status:'accepted'}],plans:[],notes:[]}}});
  draft=draftReducer(draft,{type:'manual',key:fieldKey('property','primary','interestAmount'),value:'0'});
  expect(repaymentFor(appStateFor(draft))).toMatchObject({principal:'1234.50',total:'1234.50'});
});
it('orders mortgages by displayed property order and renders multiple schedules', async () => {
  const state=mortgageState(1); const second=mortgageState(2).linkRecordsBySchedule.primary[1];
  state.additionalSchedules=[{id:'second',values:{...state.form,plotNo:'22'},category:'Vacant Plot',unit:'Sq. Yards',docNames:[]}];
  const primary=state.linkRecordsBySchedule.primary;
  state.linkRecordsBySchedule={second:[second],primary};
  const output=await generate(state), text=await docxToText(new Uint8Array(await output.blob.arrayBuffer()));
  expect(text.match(/SCHEDULE OF PROPERTY/g)).toHaveLength(2);
  expect(text.indexOf('DOC-1')).toBeLessThan(text.indexOf('DOC-2'));
  expect(text).toContain('open plot no.22'); expect(text).toContain('Value of Rs.300.20');
});
it('preserves combined-address compatibility and rejects dropped identity/property bindings', async () => {
  const entries=await readZip(bytes), doc=entries.find(e=>e.name==='word/document.xml')!;
  const original=new TextDecoder().decode(doc.data);
  const replace=(find:RegExp,replacement:string)=>original.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,p=>replaceRunText(p,find,()=>replacement));
  for (const find of [/<Executant PAN>/g,/<Claimant Dob>/g,/<North Boundary>/g,/<Unknown Custom Detail>/g]) {
    doc.data=new TextEncoder().encode(find.source.includes('Unknown') ? replace(/<Branch>/g,'<Unknown Custom Detail>') : replace(find,''));
    expect((await validateReconveyanceTemplate(await writeZip(entries))).valid).toBe(false);
  }
  doc.data=new TextEncoder().encode(replace(/R\/o H.No\.<Executant H.No.>, <Executant Locality>, <Executant Village> Village, <Executant Mandal> Mandal, District:<Executant District>, State:<Executant State>, Pin Code:<Executant Pin Code>/g,'R/o <Executant Address>'));
  const revised=await writeZip(entries), validation=await validateReconveyanceTemplate(revised);
  expect(validation.errors).toEqual([]);
  const state=mortgageState();
  const result=await fillReconveyanceDeed(mergeValues(state),rewritesFor(state),scheduleMergesFor(state),{kind:'custom',name:'combined.docx',hash:'test',bytes:revised,validation});
  expect(await docxToText(new Uint8Array(await result.blob.arrayBuffer()))).toContain('R/o 1-1, Sample Village, Sample Mandal, Sample District, Telangana, 500001');
});

it('sums independent mortgage interest once across schedules and retains manual principal', async () => {
  const state=mortgageState(3); state.form.interestAmount='999';
  state.linkRecordsBySchedule.primary.forEach((record,i)=>record.values.mortgageInterestAmount=['0.10','0.20','0'][i]);
  expect(repaymentFor(state)).toMatchObject({principal:'600.30',interest:'0.30',total:'600.60',errors:[]});
  state.form.principalOverride='2000.00';
  expect(repaymentFor(state)).toMatchObject({principal:'2000.00',interest:'0.30',total:'2000.30'});
  const result=await generate(state), text=await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
  expect(text).toContain('interest of Rs.0.30');expect(text).toContain('Value of Rs.2,000.30');
  expect(text).toContain('Rs.2,000/-');
  expect(text).not.toContain('2,000.00');
  state.linkRecordsBySchedule.primary[1].values.mortgageInterestAmount='';
  expect(repaymentFor(state).errors.join(' ')).toContain('interest amount');
  state.linkRecordsBySchedule.primary[1].values.mortgageInterestAmount='-1';
  expect(repaymentFor(state).errors.length).toBeGreaterThan(0);
});
it('keeps bank-only releasors separate from person-to-person identities', async () => {
  const state=mortgageState(); state.form.executantPartyType='Bank';
  for(const field of Object.keys(state.form)) if(field.startsWith('executant') && field!=='executantPartyType') state.form[field]='';
  expect(generationBlockers(state).filter(item=>item.step===6)).toEqual([]);
  const output=await generate(state),text=await docxToText(new Uint8Array(await output.blob.arrayBuffer()));
  expect(text).toContain('SAMPLE BANK, Central Branch');expect(text).toContain('Manager');expect(text).not.toContain('Aged  years');
  expect(text).not.toContain('Authorised official of the Branch');
  state.partyPeopleByParty = { 'executant|primary': { members: [], representatives: [
    { ...newPartyRepresentative(), name: 'Bank Representative', designation: 'Authorised Signatory', dob: '1985-05-09', hNo: '17', village: 'Sample Village' },
  ] } };
  const represented = await generate(state);
  const representedText = await docxToText(new Uint8Array(await represented.blob.arrayBuffer()));
  expect(representedText).toContain('Authorised Signatory: BANK REPRESENTATIVE');
  expect(representedText).toContain('09-05-1985');
  expect(representedText).toContain('R/o 17, Sample Village');
  state.draft=DEED_DEFINITIONS.reconveyance.variants[1].label;state.form.mortgagePartyMode='person-to-person';
  expect(reconveyanceErrors(state).join(' ')).toContain('Bank releasors require');
});
it('preserves independently entered link interest through save/reopen', () => {
  let draft=draftReducer(newDraft(),{type:'instrument',instrumentId:'reconveyance'});
  for(const [field,value] of Object.entries({linkOption:'linkDoc',mortgageAmount:'20.15',mortgageInterestAmount:'0.05'})) draft=draftReducer(draft,{type:'manual',key:fieldKey('link','loan',field),value});
  draft=draftReducer(draft,{type:'load',draft:JSON.parse(JSON.stringify(draft))});
  expect(repaymentFor(appStateFor(draft))).toMatchObject({principal:'20.15',interest:'0.05',total:'20.20',errors:[]});
});
