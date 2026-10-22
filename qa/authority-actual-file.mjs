import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const base = process.env.AUTHORITY_QA_BASE || 'http://127.0.0.1:5179';
// Live provider check for the visually reviewed three-page authority scan. No response mocking.
const browser = await chromium.launch({headless:true,channel:'chrome'});
try {
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto(base);await page.getByRole('button',{name:'Create your first deed'}).waitFor();
 const draft=rt.newDraft();draft.step=6;draft.variantId=rt.saleVariant(process.env.AUTHORITY_QA_MODE || 'gpa');
 const saved={id:draft.id,updatedAt:new Date().toISOString(),claimantNames:[],deedType:'Sale',draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:[]},templateMode:'built-in',customTemplate:null,libraryTemplate:null};
 await page.evaluate(saved=>new Promise((resolve,reject)=>{const open=indexedDB.open('deedcraft-saved-deeds',1);open.onsuccess=()=>{const db=open.result;const tx=db.transaction('deeds','readwrite');tx.objectStore('deeds').put(saved);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),saved);
 await page.reload();await page.getByRole('button',{name:'Continue / Edit',exact:true}).click();
 const panel=page.getByRole('region',{name:'Sale authority details',exact:true});
 await panel.getByLabel('Upload '+(process.env.AUTHORITY_QA_MODE || 'gpa').toUpperCase()+' documents',{exact:true}).setInputFiles(process.env.AUTHORITY_QA_FILE);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=status],[role=alert]')).some(el=>/Principal executants filled|Extraction could not finish/.test(el.textContent)),{},{timeout:360000});
 const alert=await panel.getByRole('alert').allTextContents();if(alert.length) throw new Error(alert.join(' '));
 const stored=await page.evaluate(id=>new Promise(resolve=>{const req=indexedDB.open('deedcraft-saved-deeds',1);req.onsuccess=()=>{const db=req.result;const get=db.transaction('deeds').objectStore('deeds').get(id);get.onsuccess=()=>{db.close();resolve(get.result);};};}),draft.id);
 const values={};for(const label of ['Authority document number','Authority book number','Authority document date','Authority Sub-Registrar Office','Authority SRO code']) values[label]=await panel.getByLabel(label,{exact:true}).inputValue();
 console.log(JSON.stringify({mode:process.env.AUTHORITY_QA_MODE || 'gpa',values,manual:stored.draft.manual,notes:stored.draft.saleAuthority.extractions.flatMap(e=>e.notes)},null,2));
 assert.match(stored.draft.manual['executant|primary|executantName'],/MALAVATH SARITHA/i);
 assert.match(stored.draft.manual['executant|primary|executantPartyType'],/^Principal/);
 assert.equal(Object.keys(stored.draft.manual).filter(k=>k.endsWith('|executantName')).length,1);
 assert.equal(values['Authority document number'],'6003/2023');assert.equal(values['Authority document date'],'2023-07-18');
 assert.equal(values['Authority book number'],'');assert.equal(values['Authority SRO code'],'');assert.equal(values['Authority Sub-Registrar Office'],'');
 await page.reload();await page.getByRole('button',{name:'Continue / Edit',exact:true}).click();assert.equal(await page.getByRole('region',{name:'Sale authority details',exact:true}).getByLabel('Authority document number',{exact:true}).inputValue(),'6003/2023');
 console.log('PASS: actual PDF upload, verified principal and five authority fields, saved and reloaded.');
} finally {await browser.close();}
