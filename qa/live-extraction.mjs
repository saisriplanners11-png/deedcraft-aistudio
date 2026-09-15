import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 let verificationIndex=0;
 page.on('request',async request=>{ try { const body=request.postDataJSON(); const content=body?.messages?.[0]?.content; if(Array.isArray(content) && content.some(c=>c.type==='text' && c.text?.includes('THE LAST IMAGE IS'))) { const last=content.filter(c=>c.type==='image').at(-1); if(last?.source?.data) await writeFile(`tmp/upload-first-qa/proposed-drawing-${++verificationIndex}.png`,Buffer.from(last.source.data,'base64')); } } catch {} });
 page.on('response',async response=>{ if(response.url().includes('/api/')) { try { const body=await response.json(); for(const block of body.content || []) if(block.input && ('planVerified' in block.input || 'regions' in block.input)) console.log(JSON.stringify(block.input)); } catch {} } });
 await page.goto('http://127.0.0.1:5173');
 const file=process.argv[2];
 if(!file) throw new Error('Usage: node qa/live-extraction.mjs /path/to/reference-plan.jpeg');
 const bytes=[...await readFile(file)];
 const result=await page.evaluate(async bytes=>{
  const {extractUpload}=await import('/upload-extraction.ts');
  const start=performance.now();
  const data=await extractUpload(new File([new Uint8Array(bytes)],'reference-plan.jpeg',{type:'image/jpeg'}),new AbortController().signal,()=>{});
  return {data,ms:performance.now()-start};
 },bytes);
 await mkdir('tmp/upload-first-qa',{recursive:true});
 await writeFile('tmp/upload-first-qa/live-plan-result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({accepted:result.data.candidates.filter(c=>c.status==='accepted').length,uncertain:result.data.candidates.filter(c=>c.status!=='accepted').length,plans:result.data.plans.length,seconds:Math.round(result.ms/1000),notes:result.data.notes}));
 const generated=await page.evaluate(async result=>{
   const s=await import('/source-draft.ts');const m=await import('/merge.ts');const d=await import('/docx.ts');const p=await import('/registration-plan.tsx');
   const draft={...s.newDraft(),sources:[{id:'reference',revision:0,hash:'reference',status:'done',name:'reference-plan.jpeg',result:result.data}]};
   const state=s.appStateFor(draft);const v=m.mergeValues(state);
   const form={...state.form,extentSqYards:v['Extent in Sq.yards'],extentSqMeters:v['Extent in Sq.Meters']};
   const png=await p.planPng(p.registrationPlanSvg(form,result.data.plans[0]?.drawing));
   const docx=await d.fillSaleDeed(v,m.variantFor(state.category),m.rewritesFor(state),m.scheduleMergesFor(state),[png]);
   return {docx:[...new Uint8Array(await docx.blob.arrayBuffer())],pdf:[...new Uint8Array(await (await p.planPdf([png])).arrayBuffer())],png:[...png]};
 },result);
 for(const [ext,bytes] of Object.entries(generated)) await writeFile('tmp/upload-first-qa/reference-output.'+ext,Buffer.from(bytes));
 console.log('Generated live-reference Word and plan PDF for visual QA.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await browser.close();}
