import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true, channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5191');
 await page.getByRole('heading',{name:'Saved deeds',exact:true}).waitFor();
 await page.evaluate(async()=>{
  const {newDraft}=await import('/source-draft.ts');const draft=newDraft();draft.step=7;draft.revision=1;
  const people={primary:{claimantPartyType:'Minor',claimantName:'CHILD ONE',claimantDob:'2016-01-01'},m2:{claimantPartyType:'Minor',claimantName:'CHILD TWO',claimantDob:'2017-01-01'},g1:{claimantPartyType:'Guardian',claimantName:'ADULT ONE',claimantDob:'1980-01-01',claimantGuardianRelationship:'Mother',claimantAadhaar:'123456789012'},g2:{claimantPartyType:'Guardian',claimantName:'ADULT TWO',claimantDob:'1970-01-01',claimantGuardianRelationship:'Father',claimantAadhaar:'234567890123'}};
  for(const [id,values] of Object.entries(people))for(const[k,v]of Object.entries(values))draft.manual['claimant|'+id+'|'+k]=v;
  const saved={id:draft.id,updatedAt:new Date().toISOString(),claimantNames:['Guardian QA'],deedType:'Sale',draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:['m2','g1','g2']},templateMode:'built-in',customTemplate:null};
  await new Promise((resolve,reject)=>{const open=indexedDB.open('deedcraft-saved-deeds',1);open.onsuccess=()=>{const db=open.result;const tx=db.transaction('deeds','readwrite');tx.objectStore('deeds').put(saved);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}});
 });
 await page.reload();await page.getByRole('button',{name:'Continue / Edit'}).click();
 const close=page.getByRole('button',{name:'Close',exact:true});if(await close.isVisible())await close.click();
 await page.locator('.registration-steps button').filter({hasText:'Claimant'}).click();
 await page.getByRole('heading',{name:'Assigned guardians',exact:true}).first().waitFor();
 assert.equal(await page.getByLabel('Guardian full name',{exact:true}).count(),0);
 assert.equal(await page.getByLabel('Represented minor’s full name',{exact:true}).count(),0);
 const boxes=page.getByRole('checkbox',{name:'ADULT ONE',exact:true});assert.equal(await boxes.count(),2);
 await boxes.nth(0).check();await boxes.nth(1).check();
 await page.getByRole('checkbox',{name:'ADULT TWO',exact:true}).first().check();
 assert(await boxes.nth(0).isChecked());assert(await boxes.nth(1).isChecked());
 await page.locator('input[value="ADULT ONE"]').fill('ADULT UPDATED');
 assert.equal(await page.getByRole('checkbox',{name:'ADULT UPDATED',exact:true}).count(),2);
 assert(await page.getByRole('checkbox',{name:'ADULT UPDATED',exact:true}).first().isChecked());
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 console.log('PASS: two minors, two separate guardians, shared and multiple links, live guardian edits, no nested identity fields, mobile width.');
}finally{await browser.close()}
