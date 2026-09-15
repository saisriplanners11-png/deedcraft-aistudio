import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import assert from 'node:assert/strict';
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
for (let n=1;n<=10;n++) pdf.addPage().drawText(n===9?'SCHEDULE: Plot 42; North: Road':'Document page '+n,{font,size:14,x:40,y:700});
const bytes=[...await pdf.save()];
const browser=await chromium.launch();
try {
 const page=await browser.newPage(); const readPages=new Set();
 await page.route('**/api/anthropic/v1/messages',async route=>{
  const body=route.request().postDataJSON();const text=body.messages[0].content.filter(p=>p.type==='text').map(p=>p.text).join('\n');
  const schema=body.tools[0].input_schema.properties;let data;
  if(schema.pages){const ns=[...text.matchAll(/SOURCE PAGE (\d+):/g)].map(m=>Number(m[1]));ns.forEach(n=>readPages.add(n));data={pages:ns.map(number=>({number,text:number===9?'SCHEDULE: Plot 42; North: Road':'Document page '+number,kind:number===9?'schedule':'other',drawing:false}))};}
  else { const found=text.includes('SCHEDULE: Plot 42')||text.includes('ORIGINAL SOURCE PAGE 9');const fields=schema.candidates.items.properties.field.enum;
   data={candidates:found?Object.entries({plotNo:'42',boundaryNorth:'Road'}).filter(([field])=>fields.includes(field)).map(([field,value])=>({field,value,role:'property',record:'primary',page:9,quote:field==='plotNo'?'Plot 42':'North: Road',region:'Schedule',historical:false,handwritten:false})):[],plan:null,notes:[]};}
  await route.fulfill({json:{id:'test',type:'message',role:'assistant',model:body.model,content:[{type:'tool_use',id:'read',name:'record_transcription',input:data}],stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1}}});
 });
 await page.goto('http://localhost:5173');
 const result=await page.evaluate(async bytes=>{
  const {extractUpload}=await import('/upload-extraction.ts');const {newDraft,appStateFor}=await import('/source-draft.ts');const partial=[];
  const result=await extractUpload(new File([new Uint8Array(bytes)],'late.pdf',{type:'application/pdf'}),new AbortController().signal,()=>{},r=>partial.push(r),'phase1:linkDoc');
  const state=appStateFor({...newDraft(),propertyIds:['property-2'],sources:[{id:'late',revision:0,name:'late.pdf',hash:'late',status:'done',assignment:{role:'link',record:'deed-2',propertyRecord:'property-2'},result}]});
  return {result,state,partialCount:partial.length};
 },bytes);
 assert.equal(readPages.size,10);assert(result.partialCount>0);
 assert(result.result.candidates.some(c=>c.field==='plotNo'&&c.page===9&&c.status==='accepted'));
 assert.equal(result.state.form.plotNo,'');
 assert.equal(result.state.additionalSchedules.find(s=>s.id==='property-2').values.plotNo,'42');
 console.log('PASS: actual PDF upload reads page 9, verifies its schedule, publishes partial results and isolates Property 2.');
} finally {await browser.close();}
