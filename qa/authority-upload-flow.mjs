import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const base = process.env.AUTHORITY_QA_BASE || 'http://127.0.0.1:5179';
const real = process.env.AUTHORITY_QA_REAL === '1';
const text = `SYNTHETIC GENERAL POWER OF ATTORNEY — QA ONLY. This GPA is registered as Document No. AUTH-QA-2026, Book 1, on 2026-10-01 at TEST SRO, code TEST-01. Principals: OWNER ONE, W/O PARENT ONE, age 45, occupation Business, residing at 1-1, SOURCE VILLAGE, TEST MANDAL, TEST DISTRICT, Telangana, PIN 500001. OWNER TWO, S/O PARENT TWO, age 46, occupation Business, residing at 2-2, SECOND VILLAGE, TEST MANDAL, TEST DISTRICT, Telangana, PIN 500002. Attorney / GPA holder: AGENT ONE, S/O AGENT PARENT, age 40, occupation Business, residing at 3-3, AGENT VILLAGE, TEST MANDAL, TEST DISTRICT, Telangana, PIN 500003. AGENT ONE explicitly represents both OWNER ONE and OWNER TWO. Witness: WITNESS PERSON, not a principal or attorney. All names and facts in this file are synthetic test data.`;
const response = { kind: 'authority', details: { documentNo: 'AUTH-QA-2026', bookNumber: '1', documentDate: '2026-10-01', sro: 'TEST SRO', sroCode: 'TEST-01' }, people: [
  { role: 'principal', values: { Name: 'OWNER ONE', Relation: 'W/O', RelativeName: 'PARENT ONE', Village: 'SOURCE VILLAGE' }, principalNames: [], quote: 'Principals: OWNER ONE, W/O PARENT ONE' },
  { role: 'principal', values: { Name: 'OWNER TWO', Relation: 'S/O', RelativeName: 'PARENT TWO', Village: 'SECOND VILLAGE' }, principalNames: [], quote: 'Principals: OWNER TWO, S/O PARENT TWO' },
  { role: 'attorney', values: { Name: 'AGENT ONE', Relation: 'S/O', RelativeName: 'AGENT PARENT', Village: 'AGENT VILLAGE' }, principalNames: ['OWNER ONE','OWNER TWO'], quote: 'Attorney / GPA holder: AGENT ONE. AGENT ONE explicitly represents both OWNER ONE and OWNER TWO.' },
], notes: [] };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  for (const mode of real ? ['gpa'] : ['gpa','agpa']) {
    const context = await browser.newContext(); const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message)); let requests = 0;
    if (!real) await page.route('**/api/anthropic/**', route => { requests++; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id:'qa',type:'message',role:'assistant',model:'qa',content:[{type:'tool_use',id:'qa-tool',name:'record_authority',input:route.request().postData()?.includes('SYNTHETIC ID ONLY') ? {kind:'identity',details:{documentNo:'NOT-A-GPA'},people:[{role:'unknown',values:{Name:'AGENT ONE',Mobile:'9876543210'},quote:'SYNTHETIC ID ONLY: AGENT ONE, Mobile 9876543210.',principalNames:[]}],notes:[]} : response}],stop_reason:'tool_use',stop_sequence:null,usage:{input_tokens:1,output_tokens:1} }) }); });
    await page.goto(base); await page.getByRole('button',{name:'Create your first deed'}).waitFor();
    const draft = rt.newDraft(); draft.step=6;draft.variantId=rt.saleVariant(mode);draft.manual['executant|primary|executantVillage']='MANUAL VILLAGE';
    const saved={id:draft.id,updatedAt:new Date().toISOString(),claimantNames:[],deedType:'Sale',draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:[]},templateMode:'built-in',customTemplate:null,libraryTemplate:null};
    await page.evaluate(saved=>new Promise((resolve,reject)=>{const open=indexedDB.open('deedcraft-saved-deeds',1);open.onsuccess=()=>{const db=open.result;const tx=db.transaction('deeds','readwrite');tx.objectStore('deeds').put(saved);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),saved);
    await page.reload(); await page.getByRole('button',{name:'Continue / Edit',exact:true}).click();
    const panel=page.getByRole('region',{name:'Sale authority details',exact:true});
    if(mode==='gpa') await panel.getByLabel('Upload GPA documents',{exact:true}).setInputFiles({name:'synthetic-gpa.txt',mimeType:'text/plain',buffer:Buffer.from(text)});
    else {const transfer=await page.evaluateHandle(text=>{const data=new DataTransfer();data.items.add(new File([text],'synthetic-agpa.txt',{type:'text/plain'}));return data;},text);await panel.locator('.authority-uploads').first().dispatchEvent('drop',{dataTransfer:transfer});}
    const owner=panel.getByRole('group',{name:'OWNER ONE — extracted individual',exact:true});await Promise.race([owner.waitFor({timeout:180000}),panel.getByRole('alert').first().waitFor().then(async()=>{throw new Error(await panel.getByRole('alert').first().innerText());})]);console.log('Authority people ready:',mode,real?'real':'mock');
    assert.equal(await panel.getByLabel('Authority document number',{exact:true}).inputValue(),'AUTH-QA-2026');
    for(const name of ['OWNER ONE','OWNER TWO','AGENT ONE']) await panel.getByRole('group',{name:`${name} — extracted individual`,exact:true}).getByRole('button',{name:'Fill selected role',exact:true}).click();
    await page.waitForFunction(id=>new Promise(resolve=>{const request=indexedDB.open('deedcraft-saved-deeds',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('deeds').objectStore('deeds').get(id);get.onsuccess=()=>{const draft=get.result?.draft;db.close();resolve(draft?.saleAuthority?.attorneys?.[0]?.principalIds?.length===2);};};}),draft.id,{timeout:20000});
    console.log('Selected roles saved:',mode);
    const stored=await page.evaluate(id=>new Promise(resolve=>{const request=indexedDB.open('deedcraft-saved-deeds',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('deeds').objectStore('deeds').get(id);get.onsuccess=()=>{db.close();resolve(get.result);};};}),draft.id);
    assert.equal(stored.draft.manual['executant|primary|executantName'],'OWNER ONE');assert.equal(stored.draft.manual['executant|primary|executantRelation'],'W/O');assert.equal(stored.draft.manual['executant|primary|executantVillage'],'MANUAL VILLAGE');assert.equal(stored.draft.saleAuthority.attorneys[0].values.Name,'AGENT ONE');assert.equal(stored.draft.saleAuthority.extractions[0].people.length,3);assert.equal(stored.draft.saleAuthority.documents.length,1);
    await page.reload();await page.getByRole('button',{name:'Continue / Edit',exact:true}).click();await page.getByRole('group',{name:'OWNER ONE — extracted individual',exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:'Sale authority details',exact:true}).getByLabel('Authority document number',{exact:true}).inputValue(),'AUTH-QA-2026');
    if (!real) {
      const currentPanel=page.getByRole('region',{name:'Sale authority details',exact:true});
      await currentPanel.getByLabel('Upload Attorney 1 identity / supporting documents',{exact:true}).setInputFiles({name:'agent-id.txt',mimeType:'text/plain',buffer:Buffer.from('SYNTHETIC ID ONLY: AGENT ONE, Mobile 9876543210.')});
      console.log('Attorney identity uploaded:',mode);
      const identity=currentPanel.getByRole('group',{name:'AGENT ONE — extracted individual',exact:true}).last();await identity.getByText('Detected role: unknown',{exact:false}).waitFor();
      await identity.getByLabel('Assign role for AGENT ONE',{exact:true}).selectOption('attorney');await identity.getByRole('button',{name:'Fill selected role',exact:true}).click();
      await page.waitForFunction(id=>new Promise(resolve=>{const request=indexedDB.open('deedcraft-saved-deeds',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('deeds').objectStore('deeds').get(id);get.onsuccess=()=>{db.close();resolve(get.result?.draft?.saleAuthority?.attorneys?.[0]?.values.Mobile==='9876543210');};};}),draft.id);
      assert.equal(await currentPanel.getByLabel('Authority document number',{exact:true}).inputValue(),'AUTH-QA-2026');
      await currentPanel.getByRole('button',{name:'Extract details from attached authority documents',exact:true}).click();await currentPanel.getByText('Found 3 people.',{exact:false}).waitFor();
      assert.equal(requests,6);
    }
    assert.deepEqual(errors,[]);console.log(`PASS: ${mode.toUpperCase()} ${mode==='gpa'?'picker':'drag-drop'} upload → independent extraction/verification → role selection → separate principal/holder records and links → save/reopen; manual values retained${real?' (real AI provider)':''}.`);
    await context.close();
  }
} finally { await browser.close(); }
