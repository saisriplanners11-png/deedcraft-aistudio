import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
try {
 const page=await browser.newPage(); await page.goto('http://127.0.0.1:5173');
 const output=await page.evaluate(async()=>{
  const {initialState,partyRecords,scheduleRecords}=await import('/logic.ts');
  const {mergeValues,propertyForm,rewritesFor,scheduleMergesFor,variantFor}=await import('/merge.ts');
  const {registrationPlanSvg,planPng,planPdf}=await import('/registration-plan.tsx');
  const {fillSaleDeed,docxToText}=await import('/docx.ts');
  const state={...initialState,category:'Residential',unit:'Sq. Yards',form:{...initialState.form,executantName:'QA Seller with a deliberately long family name for layout verification',claimantName:'QA Buyer with a deliberately long family name for layout verification',executantRelationName:'S/O QA Parent',claimantRelationName:'D/O QA Parent',executantLocality:'QA Address',claimantLocality:'QA Address',plotNo:'101',bearingHNo:'1-2-3',surveyNo:'41/3',extentSqYards:'200',govtRate:'10000',consid:'3000000'},additionalExecutants:[{id:'seller-2',docNames:[],values:{executantName:'QA Second Seller'}}],additionalClaimants:[{id:'buyer-2',docNames:[],values:{claimantName:'QA Second Buyer'}}],additionalSchedules:[{id:'second',docNames:[],category:'Vacant Plot',unit:'Sq. Yards',values:{plotNo:'202',extentSqYards:'100',govtRate:'10000'}}]};
  const pngs=await Promise.all(scheduleRecords(state).map(async record=>{
   const form={...propertyForm(state,record.values),category:record.category};
   const values=mergeValues({...state,form,unit:record.unit,additionalSchedules:[]});
   return planPng(registrationPlanSvg({...form,extentSqYards:values['Extent in Sq.yards'],extentSqMeters:values['Extent in Sq.Meters']},null,{vendors:partyRecords(state,'executant').map(r=>r.values),buyers:partyRecords(state,'claimant').map(r=>r.values)}));
  }));
  const docx=await fillSaleDeed(mergeValues(state),variantFor(state.category),rewritesFor(state),scheduleMergesFor(state),pngs);
  const bytes=new Uint8Array(await docx.blob.arrayBuffer());
  const text=await docxToText(bytes);
  for(const item of ['QA Second Seller','QA Second Buyer','SCHEDULE OF PROPERTY - 2','ANNEXURE-IA','Prepared By']) if(!text.includes(item)) throw new Error('Missing '+item);
  return {docx:[...bytes],pdf:[...new Uint8Array(await (await planPdf(pngs)).arrayBuffer())]};
 });
 await mkdir('tmp/upload-first-qa',{recursive:true});
 for(const [ext,bytes] of Object.entries(output)) await writeFile('tmp/upload-first-qa/multiple-records.'+ext,Buffer.from(bytes));
 console.log('PASS: long names, two sellers, two claimants, two property schedules and two appended plan pages.');
}finally{await browser.close();}
