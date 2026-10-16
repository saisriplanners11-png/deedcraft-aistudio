import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const out='tmp/v7-browser-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5179/');
await page.getByRole('button',{name:'Create your first deed'}).click();
await page.getByLabel('Sale document').selectOption('sale-deed-by-gpa-holder');
await page.getByLabel('What is this property?').selectOption('Residential:Semi-Finished');
await page.locator('.rail-step').filter({hasText:'Executant Details'}).click();
await page.getByRole('button',{name:'Add attorney',exact:true}).click();
await page.getByLabel('Full name',{exact:true}).first().fill('UI AGENT');
await page.getByLabel('Authority document number',{exact:true}).fill('UI-42');
await page.screenshot({path:out+'/authority-form.png',fullPage:true});
assert.equal(await page.getByLabel('Authority document number',{exact:true}).inputValue(),'UI-42');

async function seed(id,legacy=false){
 await page.evaluate(async({id,legacy})=>{
  const runtime=await import('/template-runtime.ts');
  const {currentSaleTemplate}=await import('/template-library-client.ts');
  const pin=await currentSaleTemplate();const state=runtime.sampleState(id);let draft=runtime.newDraft();draft.step=9;
  draft.variantId=runtime.saleVariant(state.saleDocument);draft.saleAuthority=state.saleAuthority;draft.structureDetailsBySchedule=state.structureDetailsBySchedule;
  for(const [key,value] of Object.entries(state.form)){
   const role=key.startsWith('executant')?'executant':key.startsWith('claimant')?'claimant':'property';
   const record=['consid','stampValue','executionDate'].includes(key)?'transaction':'primary';
   draft.manual[`${role}|${record}|${key}`]=value;
  }
  draft.manual['property|primary|category']=state.category;draft.manual['property|primary|unit']='Sq. Yards';
  for(const payment of state.payments)for(const [key,value] of Object.entries(payment))draft.manual[`payment|${payment.id}|${key}`]=Array.isArray(value)?value.join(','):String(value);
  const saved={id:draft.id,updatedAt:new Date().toISOString(),claimantNames:['Browser QA'],deedType:'Sale',draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:[]},templateMode:'built-in',customTemplate:null,...(!legacy?{libraryTemplate:pin}:{})};
  await new Promise((resolve,reject)=>{const open=indexedDB.open('deedcraft-saved-deeds',1);open.onsuccess=()=>{const db=open.result;const tx=db.transaction('deeds','readwrite');const store=tx.objectStore('deeds');store.clear();store.put(saved);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
 },{id,legacy});
 await page.reload();await page.getByRole('button',{name:'Continue / Edit'}).click();
}
for(const id of ['ordinary:plot','gpa:house-semi','agpa:flat-finished']){
 await seed(id);
 const button=page.getByRole('button',{name:'Download Word 2007 deed (.docx)'});
 assert.equal(await button.isEnabled(),true,await page.locator('body').innerText());
 const downloadEvent=page.waitForEvent('download');await button.click();const download=await downloadEvent;await download.saveAs(out+'/'+download.suggestedFilename());
 assert(download.suggestedFilename().includes(id.startsWith('gpa:')?'GPA':id.startsWith('agpa:')?'AGPA':'Ordinary-Sale'));
 await page.screenshot({path:out+'/'+id.replace(':','-')+'.png',fullPage:true});
}
await seed('ordinary:plot',true);
await page.locator('.template-context summary').click();
assert.match(await page.locator('.template-context').innerText(),/v6/);
await page.getByRole('button',{name:/New template available/}).click();
await page.locator('.template-context').getByText('sale-deed-v7',{exact:true}).waitFor();
assert.match(await page.locator('.template-context').innerText(),/v7/);
assert.match(await page.locator('body').innerText(),/Existing values are retained/);
assert.deepEqual(errors,[]);
await browser.close();
console.log('PASS: browser selectors, attorney form edits, all three DOCX downloads and explicit v6-to-v7 upgrade.');
