import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const base = process.env.AUTHORITY_QA_BASE || 'http://127.0.0.1:5179';
const real = process.env.AUTHORITY_QA_REAL === '1';
const text = `SYNTHETIC GENERAL POWER OF ATTORNEY — QA ONLY. This GPA is registered as Document No. AUTH-QA-2026, Book 1, on 2026-10-01 at TEST SRO, code TEST-01. Principals: OWNER ONE, W/O PARENT ONE, age 45, occupation Business, residing at 1-1, SOURCE VILLAGE, TEST MANDAL, TEST DISTRICT, Telangana, PIN 500001. OWNER TWO, S/O PARENT TWO, age 46, occupation Business, residing at 2-2, SECOND VILLAGE, TEST MANDAL, TEST DISTRICT, Telangana, PIN 500002. Attorney / GPA holder: AGENT ONE, S/O AGENT PARENT, age 40, occupation Business, residing at 3-3, AGENT VILLAGE, TEST MANDAL, TEST DISTRICT, Telangana, PIN 500003. AGENT ONE explicitly represents both OWNER ONE and OWNER TWO. Witness: WITNESS PERSON, not a principal or attorney. All names and facts in this file are synthetic test data.`;
const response = { kind: 'authority', details: { documentNo: 'AUTH-QA-2026', bookNumber: '1', documentDate: '2026-10-01', sro: 'TEST SRO', sroCode: 'TEST-01' }, people: [
  { role: 'principal', values: { Name: 'OWNER ONE', Relation: 'W/O', RelativeName: 'PARENT ONE', Village: 'SOURCE VILLAGE' }, principalNames: [], quote: 'Principals: OWNER ONE, W/O PARENT ONE' },
  { role: 'principal', values: { Name: 'OWNER TWO', Relation: 'S/O', RelativeName: 'PARENT TWO', Village: 'SECOND VILLAGE' }, principalNames: [], quote: 'Principals: OWNER TWO, S/O PARENT TWO' },
  { role: 'attorney', values: { Name: 'AGENT ONE', Relation: 'S/O', RelativeName: 'AGENT PARENT', Village: 'AGENT VILLAGE' }, principalNames: ['OWNER ONE'], quote: 'Attorney / GPA holder: AGENT ONE. AGENT ONE explicitly represents both OWNER ONE and OWNER TWO.' },
], notes: [] };
// Repeat a holder appearance to verify one card per distinct individual.
response.people.push({ ...response.people[2] }, { role: 'attorney', values: { Name: 'AGENT TWO', Relation: 'S/O', RelativeName: 'SECOND PARENT' }, principalNames: ['OWNER TWO'], quote: 'AGENT TWO represents OWNER TWO.' });
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
    assert.match(await page.locator('.party-type-selector select').first().inputValue(),/^Principal/);
    if(mode==='gpa') await panel.getByLabel('Upload GPA documents',{exact:true}).setInputFiles({name:'synthetic-gpa.txt',mimeType:'text/plain',buffer:Buffer.from(text)});
    else {const transfer=await page.evaluateHandle(text=>{const data=new DataTransfer();data.items.add(new File([text],'synthetic-agpa.txt',{type:'text/plain'}));return data;},text);await panel.locator('.authority-uploads').first().dispatchEvent('drop',{dataTransfer:transfer});}
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
    await panel.getByText('GPA/AGPA authority details and Principal executants filled.',{exact:false}).waitFor({timeout:180000});
    const attorneys = page;
    assert.equal(await page.getByRole('button',{name:'Add attorney',exact:true}).count(),0);
    assert.equal(await page.locator('[aria-label="Sale attorney details"]').count(),0);
    assert.equal(await page.locator('details[aria-label="Authority extraction review"]').getAttribute('open'),null);
    assert.equal(await page.locator('.party-record-card').first().evaluate(el => !!(document.querySelector('[aria-label="Sale authority details"]').compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(el.compareDocumentPosition(document.querySelector('[aria-label="Executant 3 Attorney"]')) & Node.DOCUMENT_POSITION_FOLLOWING)),true);
    assert.equal(await panel.getByLabel('Authority document number',{exact:true}).inputValue(),'AUTH-QA-2026');
    for (const [label, value] of Object.entries({ 'Authority book number': '1', 'Authority document date': '2026-10-01', 'Authority Sub-Registrar Office': 'TEST SRO', 'Authority SRO code': 'TEST-01' })) assert.equal(await panel.getByLabel(label,{exact:true}).inputValue(),value);
    assert.equal(await attorneys.getByRole('region',{name:'Executant 3 Attorney',exact:true}).getByLabel(/^Full name/).inputValue(),'AGENT ONE');
    assert.equal(await page.locator('.party-record-card').first().getByLabel(/^Full name/).inputValue(),'OWNER ONE');
    assert.match(await page.locator('.party-type-selector select').first().inputValue(),/^Principal/);
    await page.waitForFunction(id=>new Promise(resolve=>{const request=indexedDB.open('deedcraft-saved-deeds',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('deeds').objectStore('deeds').get(id);get.onsuccess=()=>{const draft=get.result?.draft;db.close();resolve(draft?.manual?.['executant|primary|executantName']==='OWNER ONE' && draft?.saleAuthority?.attorneys?.length===2 && draft.saleAuthority.attorneys[0].principalIds.length===1 && draft.saleAuthority.executantOrder?.length===4);};};}),draft.id,{timeout:20000});
    assert.equal(await attorneys.locator('.party-record-card[aria-label$=" Attorney"]').count(),2);
    for (const [index, principalName] of [[1,'OWNER ONE'],[2,'OWNER TWO']]) {
      const card=attorneys.getByRole('region',{name:'Executant '+(index+2)+' Attorney',exact:true});
      assert.equal(await card.getByLabel(principalName,{exact:true}).isChecked(),true);
      assert.equal(await card.getByLabel(index===1?'OWNER TWO':'OWNER ONE',{exact:true}).isChecked(),false);
    }
    console.log('Selected roles saved:',mode);
    const stored=await page.evaluate(id=>new Promise(resolve=>{const request=indexedDB.open('deedcraft-saved-deeds',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('deeds').objectStore('deeds').get(id);get.onsuccess=()=>{db.close();resolve(get.result);};};}),draft.id);
    assert.equal(stored.draft.manual['executant|primary|executantName'],'OWNER ONE');assert.equal(stored.draft.manual['executant|primary|executantRelation'],'W/O');assert.equal(stored.draft.manual['executant|primary|executantVillage'],'SOURCE VILLAGE');assert.match(stored.draft.manual['executant|primary|executantPartyType'],/^Principal/);assert.equal(stored.draft.saleAuthority.attorneys[0].values.Name,'AGENT ONE');assert.equal(stored.draft.saleAuthority.extractions[0].people.length,5);assert.equal(stored.draft.saleAuthority.documents.length,1);
    await page.reload();await page.getByRole('button',{name:'Continue / Edit',exact:true}).click();await page.locator('details[aria-label="Authority extraction review"] > summary').click();await page.getByRole('group',{name:'OWNER ONE — extracted individual',exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:'Sale authority details',exact:true}).getByLabel('Authority document number',{exact:true}).inputValue(),'AUTH-QA-2026');
    if (!real) {
      const currentPanel=page.getByRole('region',{name:'Sale authority details',exact:true});
      await attorneys.getByLabel('Upload Attorney 3 identity / supporting documents',{exact:true}).setInputFiles({name:'agent-id.txt',mimeType:'text/plain',buffer:Buffer.from('SYNTHETIC ID ONLY: AGENT ONE, Mobile 9876543210.')});
      await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
      console.log('Attorney identity uploaded:',mode);
      const identity=page.getByRole('group',{name:'AGENT ONE — extracted individual',exact:true}).last();await identity.getByText('Detected role: unknown',{exact:false}).waitFor();
      await identity.getByLabel('Assign role for AGENT ONE',{exact:true}).selectOption('attorney');await identity.getByRole('button',{name:'Fill selected role',exact:true}).click();
      await page.waitForFunction(id=>new Promise(resolve=>{const request=indexedDB.open('deedcraft-saved-deeds',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('deeds').objectStore('deeds').get(id);get.onsuccess=()=>{db.close();resolve(get.result?.draft?.saleAuthority?.attorneys?.[0]?.values.Mobile==='9876543210');};};}),draft.id);
      assert.equal(await currentPanel.getByLabel('Authority document number',{exact:true}).inputValue(),'AUTH-QA-2026');
      await currentPanel.getByRole('button',{name:'Extract details from attached authority documents',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await currentPanel.getByText('GPA/AGPA authority details and Principal executants filled.',{exact:false}).waitFor();
      assert.equal(requests,6);
    }
    await page.getByRole('button',{name:'Add blank executant instead',exact:true}).click();
    const added = page.locator('.party-record-card').last();
    await added.getByLabel(/^Full name/).fill('MANUAL AGENT');
    await added.locator('.party-type-selector select').selectOption({label:'Attorney / Agent (ఏజెంట్)'});
    const newAttorney = page.getByRole('region',{name:'Executant 5 Attorney',exact:true});
    await newAttorney.waitFor();
    assert.equal(await newAttorney.getByLabel(/^Full name/).inputValue(),'MANUAL AGENT');
    if (!real) {
      await newAttorney.getByLabel('Upload Attorney 5 identity / supporting documents',{exact:true}).setInputFiles({name:'manual-agent-id.txt',mimeType:'text/plain',buffer:Buffer.from('SYNTHETIC ID ONLY: AGENT ONE, Mobile 9876543210.')});
      const reading = page.getByRole('dialog');
      await reading.getByText('Found 1 people.',{exact:false}).waitFor();
      await reading.getByRole('button',{name:'Close',exact:true}).click();
    }
    await newAttorney.locator('.party-type-selector select').selectOption({label:'Principal (పవర్ ఆఫ్ అటార్నీ ఇచ్చేవారు)'});
    const restored = page.locator('.party-record-card').last();
    assert.equal(await restored.getByLabel(/^Full name/).inputValue(),'MANUAL AGENT');
    await restored.locator('.party-type-selector select').selectOption({label:'Attorney / Agent (ఏజెంట్)'});
    await newAttorney.waitFor();
    if (!real) assert.equal(await newAttorney.getByRole('link',{name:'manual-agent-id.txt',exact:true}).count(),1);
    await page.getByRole('button',{name:'Add blank executant instead',exact:true}).click();
    await page.locator('.party-record-card').last().getByLabel(/^Full name/).fill('LATE OWNER');
    await page.waitForFunction(id=>new Promise(resolve=>{const request=indexedDB.open('deedcraft-saved-deeds',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('deeds').objectStore('deeds').get(id);get.onsuccess=()=>{const draft=get.result?.draft;db.close();resolve(draft?.saleAuthority?.executantOrder?.length===6 && Object.values(draft.manual).includes('LATE OWNER'));};};}),draft.id);
    await page.reload();await page.getByRole('button',{name:'Continue / Edit',exact:true}).click();
    assert.deepEqual(await page.locator('.party-record-card h2').filter({hasText:/^Executant \d/}).allTextContents(),['Executant 1 — Principal','Executant 2 — Principal','Executant 3 — Attorney','Executant 4 — Attorney','Executant 5 — Attorney','Executant 6 — Principal']);
    await mkdir('tmp/authority-combined-qa',{recursive:true});
    await page.getByRole('region',{name:'Executant 3 Attorney',exact:true}).screenshot({path:`tmp/authority-combined-qa/${mode}-attorney.png`});
    await page.locator('.party-record-card').last().getByRole('button',{name:/^Delete Executant 6/}).click();
    await newAttorney.getByRole('button',{name:'Remove Executant 5',exact:true}).click();
    assert.equal(await attorneys.locator('.party-record-card[aria-label$=" Attorney"]').count(),2);
    if (!real) {
      await page.route('**/api/anthropic/**', route => route.fulfill({ status:400, contentType:'application/json', body:JSON.stringify({error:{type:'invalid_request_error',message:'Synthetic extraction failure'}}) }));
      await panel.getByRole('button',{name:'Extract details from attached authority documents',exact:true}).click();
      const failed=page.getByRole('dialog');await failed.getByText(/Synthetic extraction failure/).waitFor();
      await failed.getByRole('button',{name:'Close',exact:true}).click();
      assert.equal(await page.locator('.party-record-card').first().getByLabel(/^Full name/).inputValue(),'OWNER ONE');
      assert.equal(await attorneys.locator('.party-record-card[aria-label$=" Attorney"]').count(),2);
      await page.route('**/api/anthropic/**', async route => { await new Promise(resolve=>setTimeout(resolve,1000)); await route.abort().catch(()=>{}); });
      await panel.getByRole('button',{name:'Extract details from attached authority documents',exact:true}).click();
      const cancelled=page.getByRole('dialog');await cancelled.getByRole('button',{name:'Cancel',exact:true}).click();
      await cancelled.getByText(/Reading was cancelled/).waitFor();
      await cancelled.getByRole('button',{name:'Close',exact:true}).click();
      assert.equal(await panel.getByLabel('Authority document number',{exact:true}).inputValue(),'AUTH-QA-2026');
    }
    assert.deepEqual(errors,[]);console.log(`PASS: ${mode.toUpperCase()} ${mode==='gpa'?'picker':'drag-drop'} upload → independent extraction/verification → role selection → separate principal/holder records and links → save/reopen; Principal records filled automatically${real?' (real AI provider)':''}.`);
    await context.close();
  }
} finally { await browser.close(); }
