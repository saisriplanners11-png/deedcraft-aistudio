import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.DEEDCRAFT_URL || 'http://127.0.0.1:5190');
 await page.evaluate(async()=>{const {newDraft,draftReducer}=await import('/source-draft.ts');let draft=draftReducer(newDraft(),{type:'instrument',instrumentId:'reconveyance'});draft.step=4;
 for(const [field,value] of Object.entries({category:'Vacant Plot',interestAmount:'0',bankName:'QA BANK',bankBranch:'Main',officialDesignation:'Manager'}))draft.manual[`property|primary|${field}`]=value;
 for(const [field,value] of Object.entries({linkOption:'linkDoc',linkDocNo:'100/2025',linkDocDate:'2025-01-01',linkSro:'Office',linkSroCode:'1000',mortgageAmount:'0.30'}))draft.manual[`link|loan|${field}`]=value;
 const saved={id:draft.id,updatedAt:new Date().toISOString(),claimantNames:['Reconveyance UI QA'],deedType:'Deed Of Reconvayance',draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:[]},templateMode:'built-in',customTemplate:null};
 await new Promise((resolve,reject)=>{const open=indexedDB.open('deedcraft-saved-deeds',1);open.onsuccess=()=>{const db=open.result;const tx=db.transaction('deeds','readwrite');tx.objectStore('deeds').put(saved);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}});
 });
 await page.reload();await page.getByRole('button',{name:'Continue / Edit'}).click();
 await page.getByLabel('Principal Amount (₹)',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Principal Amount (₹)',{exact:true}).inputValue(),'0.30');
 assert.equal(await page.getByLabel('Total Amount (₹)',{exact:true}).inputValue(),'0.30');
 assert.equal(await page.getByLabel('Basic rate per Sq. Yard (₹)',{exact:true}).count(),0);
 assert.equal(await page.getByLabel('Sale consideration (₹)',{exact:true}).count(),0);
 await page.getByLabel('Principal Amount (₹)',{exact:true}).fill('10.10');
 await page.getByLabel('Interest Amount (₹)',{exact:true}).fill('0.20');
 assert.equal(await page.getByLabel('Total Amount (₹)',{exact:true}).inputValue(),'10.30');
 await page.getByRole('button',{name:'Saved deeds',exact:true}).click();
 await page.getByRole('button',{name:'Continue / Edit'}).click();
 assert.equal(await page.getByLabel('Principal Amount (₹)',{exact:true}).inputValue(),'10.10');
 assert.equal(await page.getByLabel('Total Amount (₹)',{exact:true}).inputValue(),'10.30');
 await page.getByRole('button',{name:'Use link-document total'}).click();
 assert.equal(await page.getByLabel('Total Amount (₹)',{exact:true}).inputValue(),'0.50');
 assert.deepEqual(errors,[]);console.log('PASS: Reconveyance UI automatic amounts, manual override, reset, exact total and hidden valuation fields.');
}finally{await browser.close()}
