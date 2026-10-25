import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5197');await page.getByRole('heading',{name:'Saved deeds',exact:true}).waitFor();
 await page.evaluate(async()=>{
  const {newDraft}=await import('/source-draft.ts');const {saveDeed}=await import('/saved-deeds.ts');
  const draft=newDraft();draft.step=2;draft.manual['property|primary|executionDate']='2026-10-22';
  await saveDeed({id:draft.id,updatedAt:new Date().toISOString(),claimantNames:['DATE QA'],deedType:'Sale',draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:[]},templateMode:'built-in',customTemplate:null});
 });
 await page.reload();await page.getByRole('button',{name:'Continue / Edit'}).first().click();
 const input=page.getByLabel('Deed execution date',{exact:true});await input.waitFor();assert.equal(await input.inputValue(),'2026-10-22');
 await page.getByRole('button',{name:'Leave day blank',exact:true}).click();assert.equal(await input.getAttribute('type'),'month');assert.equal(await input.inputValue(),'2026-10');
 await input.fill('2026-11');await page.waitForTimeout(1500);await page.reload();
 await page.getByRole('heading',{name:'Saved deeds',exact:true}).waitFor();await page.getByRole('button',{name:'Continue / Edit'}).first().click();
 await input.waitFor();assert.equal(await input.inputValue(),'2026-11');assert.equal(await input.getAttribute('type'),'month');
 await page.getByRole('button',{name:'Enter a full date',exact:true}).click();assert.equal(await input.getAttribute('type'),'date');assert.equal(await input.inputValue(),'');
 await input.fill('2026-11-25');assert.equal(await input.inputValue(),'2026-11-25');assert.deepEqual(errors,[]);
 console.log('PASS: execution day toggle, month/year entry, save/reload and return to complete date in browser.');
} finally {await browser.close();}




