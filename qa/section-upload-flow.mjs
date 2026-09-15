import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Synthetic evidence keeps the integration test independent of external APIs.
const out = new URL('../tmp/upload-first-qa/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const property = {propState:'Telangana',district:'Karimnagar',mandal:'Sircilla',village:'Sircilla',locality:'Ganeshnagar',pinCode:'505301',sro:'Sircilla',districtRegistrar:'Karimnagar',plotNo:'16',nearHNo:'10-1-36/1',surveyNo:'795/B&D',extentValue:'157.22',extentSqYards:'157.22',extentSqMeters:'132.06',unit:'Sq. Yards',category:'Part open place',boundaryNorth:'North neighbour',boundarySouth:"21' Road",boundaryEast:'East neighbour',boundaryWest:'West neighbour'};
const own = {
  DEED:{linkDocType:'Sale Deed',linkDocNo:'1263/2016',linkDocDate:'2016-02-27',linkSro:'Sircilla',linkRegisteredVolume:'1',linkPriorOwner:'Historical Vendor',linkNature:'Sale Deed'},
  PASSBOOK:{titleDeedNo:'PPB42',khataNo:'60770',pattadarName:'Recorded Holder',revenueMandal:'Sircilla'},
  NALA:{nalaOrderNo:'NALA42',nalaProceedingDate:'2021-07-06',rdoAuthorityOffice:'Sircilla',surveyNosCovered:'795/B&D'},
  PERMISSION:{layoutApprovalNo:'LAYOUT42',layoutAuthority:'DTCP'},
};
const party = (side,name,aadhaar) => Object.fromEntries(Object.entries({Name:name,Relation:'S/o',RelativeName:'Test Parent',Dob:'1990-01-01',Occupation:'Teacher',Aadhaar:aadhaar,HNo:'1-2-3',Locality:'Ganeshnagar',Village:'Sircilla',Mandal:'Sircilla',District:'Karimnagar',State:'Telangana',PinCode:'505301'}).map(([k,v])=>[side+k,v]));
const fixtures={...Object.fromEntries(Object.entries(own).map(([k,v])=>[k,{...v,...(k==='DEED'?property:{})}])),SELLER:party('executant','Current Seller','2345 6789 0123'),BUYER:party('claimant','Current Buyer','3456 7890 1234')};
const payload=key=>({name:key+'.txt',mimeType:'text/plain',buffer:Buffer.from(key+' fixture\n'+Object.entries(fixtures[key]||{}).map(([k,v])=>`${k}: ${v}`).join('\n'))});
const browser=await chromium.launch({headless:true});
try {
  const p=await browser.newPage({viewport:{width:1280,height:1000}}); const errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/api/anthropic/v1/messages',async route=>{
    const body=route.request().postDataJSON(); const text=body.messages[0].content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
    let data;
    if(body.output_config) data={amount:'100000',refNo:'123456',bank:'Test Bank',branch:'Sircilla',date:'2026-09-12',payer:'Current Buyer',payee:'Current Seller',detectedMode:'cheque',_unreadable:''};
    else {
      const schema=body.tools[0].input_schema.properties;
      if(schema.pages) data={pages:[...new Set([...text.matchAll(/SOURCE PAGE (\d+):/g)].map(m=>Number(m[1])))].map(number=>({number,text,kind:'deed',drawing:false}))};
      else {
        const key=Object.keys(fixtures).find(k=>text.includes(k+' fixture')); const values=fixtures[key]||{};
        const fields=schema.candidates.items.properties.field.enum;
        data={candidates:Object.entries(values).filter(([field])=>fields.includes(field)).map(([field,value])=>({field,value,role:field.startsWith('executant')?'executant':field.startsWith('claimant')?'claimant':Object.keys(own[key]||{}).includes(field)?'link':'property',record:'primary',quote:`${field}: ${value}`,region:'Printed source label',page:0,historical:false,handwritten:false})),plan:null,notes:[]};
      }
    }
    const content=body.output_config?[{type:'text',text:JSON.stringify(data)}]:[{type:'tool_use',id:'tool_test',name:'record_transcription',input:data}];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'test',type:'message',role:'assistant',model:body.model,content,stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})});
  });
  const english=name=>name.replace(/[^\x00-\x7F].*$/,'').trim();
  const dismissUploadDialog=async()=>{ const close=p.getByRole('button',{name:'Close',exact:true}); if(await close.isVisible()) await close.click(); };
  const step=async name=>{
    await dismissUploadDialog();
    const label=english(name);
    if (/^\d\d /.test(label)) {
      const escaped=label.slice(3).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      return p.getByRole('button',{name:new RegExp('^'+label.slice(0,2)+'\\s*'+escaped)}).click();
    }
    return p.getByRole('button',{name:label,exact:false}).click();
  };
  const idle=async()=>{ await p.waitForFunction(()=>!Array.from(document.querySelectorAll('.link-upload')).some(x=>x.textContent.includes('Reading…'))); const close=p.getByRole('button',{name:'Close',exact:true}); if(await close.isVisible()) await close.click(); };
  const value=label=>p.getByLabel(label,{exact:false}).inputValue();
  await p.goto(process.env.BASE_URL||'http://127.0.0.1:5173');
  await step('02 Link Deed & Enclosures'); await step('+ Add / upload document');
  const types=[['DEED','Link Document No. రిజిస్టర్డ్ లింక్ దస్తావేజు'],['PASSBOOK','Title Deed No. పట్టాదారు పాస్ పుస్తకం'],['NALA','Nala Order No. నాలా ఉత్తర్వు'],['PERMISSION','Permissions / Approved details అనుమతులు']];
  for(const [,title] of types) await step(title); await step('Continue with 4 documents');
  for(const [key,title] of types) await p.locator('.link-record').filter({has:p.getByRole('heading',{name:english(title),exact:false})}).locator('input[type=file]').setInputFiles(payload(key));
  await idle(); assert.equal(await p.locator('.source').count(),4);
  assert.equal(await value('Document number'),'1263/2016'); assert.equal(await value('Document type'),'Sale Deed');
  assert.equal(await value('Title deed number'),'PPB42'); assert.equal(await value('NALA order number'),'NALA42');
  await step('03 Jurisdiction'); assert.equal(await value('Mandal'),'Sircilla');
  await step('04 Property Schedules');
  await step('10 Generate Deed'); assert.equal(await p.getByRole('button',{name:'Download Word deed + plan',exact:true}).isEnabled(),true);
  const incompleteDownload=p.waitForEvent('download'); await step('Download Word deed + plan');
  await (await incompleteDownload).saveAs(out+'incomplete-flow.docx');
  assert((await p.getByRole('status').innerText()).includes('incomplete draft'));
  for(const [name,key] of [['07 Executant Details','SELLER'],['08 Claimant Details','BUYER']]) {
    await step(name); assert.equal(await value('Full name'),''); await p.locator('input[type=file]').first().setInputFiles(payload(key)); await idle(); assert.equal(await value('Full name'),key==='SELLER'?'Current Seller':'Current Buyer');
  }
  await step('05 Market Value'); await p.getByLabel('Basic rate per Sq. Yard (₹)',{exact:true}).fill('1000'); await p.getByLabel('Sale consideration (₹)',{exact:true}).fill('100000'); await p.getByLabel('Stamp paper value (₹)',{exact:false}).fill('100');
  assert((await p.locator('main').innerText()).includes('1,57,220'));
  await step('06 Payment Details'); await step('+ Cheque');
  const amount=p.getByLabel('Amount (₹)',{exact:true}); await amount.fill('100001'); assert.equal(await amount.inputValue(),'1,00,000');
  await p.locator('input[type=file]').first().setInputFiles({name:'cheque.txt',mimeType:'text/plain',buffer:Buffer.from('CHEQUE fixture')});
  await p.waitForFunction(()=>document.querySelector('input[value="123456"]')!==null);
  await p.getByRole('button',{name:'Close',exact:true}).click();
  await p.getByLabel('Payer (purchaser)',{exact:true}).fill('Edited Buyer');
  await p.getByLabel('Payee (vendor)',{exact:true}).fill('Edited Seller');
  assert.equal(await p.getByLabel('Payer (purchaser)',{exact:true}).inputValue(),'Edited Buyer');
  assert.equal(await p.getByLabel('Payee (vendor)',{exact:true}).inputValue(),'Edited Seller');
  await amount.fill('50000'); await step('10 Generate Deed'); assert.equal(await p.getByRole('button',{name:'Download Word deed + plan',exact:true}).isEnabled(),true);
  await step('06 Payment Details'); await p.getByLabel('Amount (₹)',{exact:true}).fill('100000'); await step('10 Generate Deed');
  assert.equal(await p.getByRole('button',{name:'Download Word deed + plan',exact:true}).isEnabled(),true);
  const download=p.waitForEvent('download'); await step('Download Word deed + plan'); await (await download).saveAs(out+'verified-flow.docx');
  assert.deepEqual(errors,[]);
  console.log('PASS: four Phase 1 uploads, separate current parties, market calculation, overage rejection, editable extracted payer/payee, incomplete draft downloads and successful Word generation.');
} finally {await browser.close();}
