import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import assert from 'node:assert/strict';

// Synthetic evidence keeps the integration test independent of external APIs.
const property = {propState:'Telangana',district:'Karimnagar',mandal:'Sircilla',village:'Sircilla',locality:'Ganeshnagar',pinCode:'505301',sro:'Sircilla',districtRegistrar:'Karimnagar',plotNo:'16',nearHNo:'10-1-36/1',surveyNo:'795/B&D',extentValue:'157.22',extentSqYards:'157.22',extentSqMeters:'132.06',unit:'Sq. Yards',category:'Part open place',housePtinPairs:JSON.stringify([{houseNo:'6-1-142',ptin:'PTIN-142'},{houseNo:'6-1-143',ptin:'PTIN-143'}]),boundaryNorth:'North neighbour',boundarySouth:"21' Road",boundaryEast:'East neighbour',boundaryWest:'West neighbour',govtRate:'1000',structValue:'0'};
const own = {
  DEED:{linkDocType:'Sale Deed',linkDocNo:'1263/2016',linkDocDate:'2016-02-27',linkSro:'Sircilla',linkRegisteredVolume:'1',linkPriorOwner:'Historical Vendor',linkNature:'Sale Deed'},
  PASSBOOK:{titleDeedNo:'PPB42',khataNo:'60770',pattadarName:'Recorded Holder',revenueMandal:'Sircilla'},
  NALA:{nalaOrderNo:'NALA42',nalaProceedingDate:'2021-07-06',rdoAuthorityOffice:'Sircilla',surveyNosCovered:'795/B&D'},
  PERMISSION:{layoutApprovalNo:'LAYOUT42',layoutAuthority:'DTCP'},
};
const party = (side,name,aadhaar) => Object.fromEntries(Object.entries({Name:name,Relation:'S/o',RelativeName:'Test Parent',Dob:'1990-01-01',Occupation:'Teacher',Aadhaar:aadhaar,HNo:'1-2-3',Locality:'Ganeshnagar',Village:'Sircilla',Mandal:'Sircilla',District:'Karimnagar',State:'Telangana',PinCode:'505301'}).map(([k,v])=>[side+k,v]));
const fixtures={...Object.fromEntries(Object.entries(own).map(([k,v])=>[k,{...v,...(k==='DEED'?property:{})}])),SELLER:party('executant','Current Seller','2345 6789 0123'),BUYER:party('claimant','Current Buyer','3456 7890 1234')};
const payment = {amount:['100000','Amount: 100000'],refNo:['123456','Cheque No. 123456'],bank:['Test Bank','Bank: Test Bank'],branch:['Sircilla','Branch: Sircilla'],date:['2026-09-12','DATE: 12/09/2026'],payer:['Current Buyer','Drawer: Current Buyer'],payee:['Current Seller','PAY: Current Seller']};
const quoteFor=(field,value)=>field==='housePtinPairs' ? 'H.No. 6-1-142 PTIN PTIN-142; H.No. 6-1-143 PTIN PTIN-143' : field.endsWith('Aadhaar') ? 'Aadhaar: '+value : `${field}: ${value}`;
const payload=key=>({name:key+'.txt',mimeType:'text/plain',buffer:Buffer.from(key+' fixture\n'+Object.entries(fixtures[key]||{}).map(([k,v])=>quoteFor(k,v)).join('\n'))});
const browser=await chromium.launch({headless:true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
try {
  const p=await browser.newPage({viewport:{width:1280,height:1000}}); const errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/api/anthropic/v1/messages',async route=>{
    const body=route.request().postDataJSON(); const text=body.messages[0].content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
    let data;
    if(body.output_config) data={...Object.fromEntries(Object.entries(payment).map(([field,[value]])=>[field,value])),evidence:Object.fromEntries(Object.entries(payment).map(([field,[,quote]])=>[field,{page:1,quote}])),chequeLeaf:true,detectedMode:'cheque',_unreadable:''};
    else {
      const schema=body.tools[0].input_schema.properties;
      if(schema.pages) data={pages:[...new Set([...text.matchAll(/SOURCE PAGE (\d+):/g)].map(m=>Number(m[1])))].map(number=>({number,text,kind:'deed',drawing:false}))};
      else {
        const key=Object.keys(fixtures).find(k=>text.includes(k+' fixture')); const values=fixtures[key]||{};
        const fields=schema.candidates.items.properties.field.enum;
        data={candidates:Object.entries(values).filter(([field])=>fields.includes(field)).map(([field,value])=>({field,value,role:field.startsWith('executant')?'executant':field.startsWith('claimant')?'claimant':Object.keys(own[key]||{}).includes(field)?'link':'property',record:'primary',quote:quoteFor(field,value),region:'Printed source label',page:1,historical:false,handwritten:false})),plan:null,notes:[]};
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
      return p.getByRole('navigation',{name:'Deed steps'}).getByRole('button',{name:new RegExp('^'+Number(label.slice(0,2))+'\\s+'+escaped,'i')}).click();
    }
    return p.getByRole('button',{name:label,exact:false}).click();
  };
  const idle=async()=>{
    await expect(p.locator('.link-upload input:disabled, .document-upload input:disabled')).toHaveCount(0, {timeout:15000});
    const close=p.getByRole('button',{name:'Close',exact:true});
    if(await close.isVisible()) await close.click();
  };
  const value=label=>label==='Full name' ? p.getByLabel(/^Full name/i).inputValue() : p.getByLabel(label,{exact:false}).inputValue();
  await p.goto(process.env.BASE_URL||'http://127.0.0.1:5173');
  await p.getByRole('button',{name:/New deed/}).first().click();
  await step('01 Deed setup');
  await p.locator('[aria-label="Schedule 1 property type"] select').selectOption({ label: 'Part Open Place' });
  await step('02 Link Deed & Enclosures');
  await step('+ Add / upload document');
  const types=[['DEED','Link Document No. రిజిస్టర్డ్ లింక్ దస్తావేజు'],['PASSBOOK','Title Deed No. పట్టాదారు పాస్ పుస్తకం'],['NALA','Nala Order No. నాలా ఉత్తర్వు'],['PERMISSION','Permissions / Approved details అనుమతులు']];
  for(const [,title] of types) await step(title); await step('Continue with 4 documents');
  for(const [key,title] of types) await p.locator('.link-record').filter({has:p.getByRole('heading',{name:key==='DEED'?'Registered Deed':key==='PERMISSION'?'House Permission':english(title),exact:false})}).locator('input[type=file]').setInputFiles(payload(key));
  // Accepted extraction rows now appear as populated form fields; `.source` is
  // reserved for uncertain review candidates, so assert the extracted values.
  await idle();
  assert.equal(await value('Document number'),'1263/2016'); assert.equal(await value('Document type'),'Sale Deed');
  assert.equal(await value('Title deed number'),'PPB42'); assert.equal(await value('NALA order number'),'NALA42');
  await step('03 Jurisdiction');
  await expect(p.getByLabel('Mandal',{exact:false})).toHaveValue('Sircilla', { timeout: 30000 });
  await expect(p.getByLabel('Village',{exact:false})).toHaveValue('Sircilla');
  await expect(p.getByLabel('Sub-Registrar Office',{exact:false})).toHaveValue(/^Sircilla(?: \[2010\])?$/);
  await step('04 Property Schedules');
  await expect(p.getByLabel('Survey no(s).',{exact:false})).toHaveValue('795/B&D', { timeout: 30000 });
  await expect(p.getByLabel('Locality',{exact:false})).toHaveValue('Ganeshnagar');
  for (const boundary of ['North neighbour', "21' Road", 'East neighbour', 'West neighbour']) {
    await expect.poll(() => p.locator('.property-schedule-card input, .property-schedule-card textarea').evaluateAll(fields => fields.map(field => field.value))).toContain(boundary);
  }
  await step('02 Link Deed & Enclosures');
  await expect(p.getByLabel('H.No. for PTIN pair 1')).toHaveValue('6-1-142');
  await expect(p.getByLabel('PTIN for H.No. 1')).toHaveValue('PTIN-142');
  await expect(p.getByLabel('H.No. for PTIN pair 2')).toHaveValue('6-1-143');
  await expect(p.getByLabel('PTIN for H.No. 2')).toHaveValue('PTIN-143');
  await p.getByRole('button',{name:'+ Add H.No./PTIN pair'}).click();
  await expect(p.getByLabel('PTIN for H.No. 1')).toHaveValue('PTIN-142');
  await expect(p.getByLabel('PTIN for H.No. 2')).toHaveValue('PTIN-143');
  await p.getByLabel('H.No. for PTIN pair 3').fill('6-1-144');
  await p.getByLabel('PTIN for H.No. 3').fill('PTIN-144');
  await expect(p.getByLabel('PTIN for H.No. 1')).toHaveValue('PTIN-142');
  await step('05 Market Value');
  await expect(p.getByLabel('Basic rate per Sq. Yard (₹)',{exact:false})).toHaveValue('1,000');
  await expect(p.getByLabel('Structure valuation (₹)',{exact:false})).toHaveValue('0');
  for(const [name,key] of [['06 Executant Details','SELLER'],['07 Claimant Details','BUYER']]) {
    await step(name); assert.equal(await value('Full name'),''); await p.locator('input[type=file]').first().setInputFiles(payload(key)); await idle(); assert.equal(await value('Full name'),key==='SELLER'?'CURRENT SELLER':'CURRENT BUYER');
    const role = key === 'SELLER' ? 'executant' : 'claimant';
    await p.getByRole('button', { name: `Add blank ${role} instead`, exact: true }).click();
    await p.getByLabel(/^Full name/i).last().fill(`Second ${key}`);
  }
  await step('05 Market Value'); await p.getByLabel('Basic rate per Sq. Yard (₹)',{exact:false}).fill('1000'); await p.getByLabel('Sale consideration (₹)',{exact:false}).fill('100000');
  await expect(p.getByLabel('Calculated market value (extent × basic rate)', { exact: false })).toHaveValue('1,57,220');
  await step('08 Payment Details'); await step('+ Cheque');
  const amount=p.getByLabel('Amount (₹)',{exact:true}); await amount.fill('100001'); assert.equal(await amount.inputValue(),'1,00,000');
  await p.locator('input[type=file]').first().setInputFiles({name:'cheque.txt',mimeType:'text/plain',buffer:Buffer.from(Object.values(payment).map(([,quote])=>quote).join('\n'))});
  await p.waitForFunction(()=>document.querySelector('input[value="123456"]')!==null);
  await p.getByRole('button',{name:'Close',exact:true}).click();
  for (const [label, first, second] of [
    ['Vendee (purchaser)', 'Current Buyer', 'Second Buyer'],
    ['Vendor (seller)', 'Current Seller', 'Second Seller'],
  ]) {
    const group = p.getByRole('group', { name: label, exact: true });
    await group.getByRole('checkbox', { name: first, exact: true }).check();
    const secondParty = group.getByRole('checkbox', { name: second, exact: true });
    await secondParty.check();
    await secondParty.uncheck();
    await expect(group.getByRole('checkbox', { name: first, exact: true })).toBeChecked();
    await secondParty.check();
    await expect(group.getByRole('checkbox', { checked: true })).toHaveCount(2);
  }
  await step('10 Generate Deed');
  await p.getByRole('button', { name: 'Download English (.docx)', exact: true }).click();
  const downloadAnyway = p.getByRole('button', { name: 'Download Anyway', exact: true });
  await downloadAnyway.waitFor();
  const [download] = await Promise.all([p.waitForEvent('download'), downloadAnyway.click()]);
  assert.equal(await download.failure(), null);

  await p.waitForFunction(async () => {
    const { listSavedDeeds } = await import('/saved-deeds.ts');
    return (await listSavedDeeds()).some(({ draft }) =>
      Object.entries(draft.manual).some(([key, value]) => key.endsWith('|payer') && value === 'Current Buyer and Second Buyer') &&
      Object.entries(draft.manual).some(([key, value]) => key.endsWith('|payee') && value === 'Current Seller and Second Seller'));
  });
  await p.reload();
  await p.getByRole('button', { name: 'Continue / Edit' }).first().click();
  await step('05 Market Value');
  const consideration = p.getByRole('textbox', { name: 'Sale consideration (₹)', exact: true });
  await consideration.fill('');
  await consideration.pressSequentially('90000');
  await expect(consideration).toHaveValue('90,000');
  await expect(p.getByText(/Recorded payments exceed the consideration/)).toBeVisible();
  await p.getByRole('button', { name: 'Review payments', exact: true }).click();
  for (const label of ['Vendee (purchaser)', 'Vendor (seller)']) {
    await expect(p.getByRole('group', { name: label, exact: true }).getByRole('checkbox', { checked: true })).toHaveCount(2);
  }
  const vendeeGroup = p.getByRole('group', { name: 'Vendee (purchaser)', exact: true });
  await vendeeGroup.getByRole('button', { name: 'Enter names manually', exact: true }).click();
  const manualVendee = vendeeGroup.getByRole('textbox', { name: 'Vendee (purchaser) name', exact: true });
  await expect(manualVendee).toHaveValue('Current Buyer and Second Buyer');
  await manualVendee.fill('Edited Buyer');
  await expect(manualVendee).toHaveValue('Edited Buyer');
  await amount.fill('90000');
  await expect(p.getByText('Reconciled with consideration', { exact: true })).toBeVisible();
  assert.deepEqual(errors,[]);
  console.log('PASS: one Link Document upload fills jurisdiction, property schedule, boundaries, market value and multiple Part open place H.No./PTIN pairs; adding a pair preserves earlier values and does not require another upload.');
} finally {await browser.close();}
