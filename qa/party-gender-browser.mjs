import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5197');await page.getByRole('heading',{name:'Saved deeds',exact:true}).waitFor();
 await page.evaluate(async()=>{
  const {newDraft}=await import('/source-draft.ts');const {saveDeed}=await import('/saved-deeds.ts');
  const draft=newDraft();draft.step=6;draft.additionalExecutantIds=['second'];
  Object.assign(draft.manual,{'executant|primary|executantName':'FIRST MALE OWNER','executant|primary|executantGender':'Male','executant|second|executantName':'SECOND FEMALE OWNER','executant|second|executantGender':'Female'});
  await saveDeed({id:draft.id,updatedAt:new Date().toISOString(),claimantNames:['GENDER QA'],deedType:'Sale',draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:[]},templateMode:'built-in',customTemplate:null});
 });
 await page.reload();await page.getByRole('button',{name:'Continue / Edit'}).first().click();
 const gender=page.getByLabel('Gender',{exact:true});await gender.first().waitFor();
 assert.equal(await gender.first().inputValue(),'Male');assert.equal(await gender.nth(1).inputValue(),'Female');
 assert.deepEqual(await gender.first().locator('option').allTextContents(),['Choose an option…','Male','Female','Other']);
 await gender.first().selectOption('Other');await page.waitForTimeout(1500);await page.reload();
 await page.getByRole('heading',{name:'Saved deeds',exact:true}).waitFor();await page.getByRole('button',{name:'Continue / Edit'}).first().click();await gender.first().waitFor();
 assert.equal(await gender.first().inputValue(),'Other');assert.equal(await gender.nth(1).inputValue(),'Female');assert.deepEqual(errors,[]);
 console.log('PASS: per-party gender dropdown options and independent saved selections in browser.');
} finally {await browser.close();}
