import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5224';
await mkdir('tmp/release/browser',{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5224','--strictPort'],{cwd:new URL('../',import.meta.url),env:{...process.env,TEMPLATE_STORAGE_BACKEND:'disk',TEMPLATE_STORAGE_DIR:'tmp/release/browser/templates'},stdio:'ignore',windowsHide:true});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);
 await page.evaluate(async()=>{
  const {newDraft,draftReducer}=await import('/source-draft.ts');const {sampleState}=await import('/template-runtime.ts');const {saveDeed}=await import('/saved-deeds.ts');
  const s=sampleState('ordinary-plot');let draft=draftReducer(newDraft(),{type:'instrument',instrumentId:'release',variantId:'co-owner-release'});draft.step=4;
  for(const [f,v]of Object.entries({...s.form,category:s.category,totalPropertyValue:'3000000',claimantDob:'1990-01-01'})){const role=f.startsWith('executant')?'executant':f.startsWith('claimant')?'claimant':'property';draft.manual[`${role}|primary|${f}`]=v;}
  for(const [f,v]of Object.entries(s.form).filter(([f])=>f.startsWith('executant')))draft.manual[`executant|second|${f}`]=f==='executantName'?'SECOND RELEASOR':v;
  draft.releaseData={releasedBySchedule:{primary:{primary:'1/3',second:''}}};
  await saveDeed({id:draft.id,updatedAt:new Date().toISOString(),claimantNames:['RELEASE UI QA'],deedType:'Release',draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:[]},templateMode:'built-in',customTemplate:null});
 });
 await page.reload();await page.getByRole('button',{name:'Continue / Edit'}).first().click();
 const panel=page.getByRole('region',{name:'Release particulars'});await panel.waitFor();
 assert.equal(await panel.getByLabel('Total value of the whole property (₹)').inputValue(),'3000000');
 const fields=panel.locator('input');assert.equal(await fields.count(),6);
 await panel.getByLabel(/Releasor 2:.*released share/).fill('1/6');
 assert.equal(await panel.getByLabel(/Releasor 1:.*released share/).inputValue(),'1/3');
 await page.waitForFunction(async()=>{const{listSavedDeeds}=await import('/saved-deeds.ts');return(await listSavedDeeds())[0]?.draft.releaseData?.releasedBySchedule?.primary?.second==='1/6';});
 await panel.screenshot({path:'tmp/release/browser/desktop.png'});
 await page.setViewportSize({width:390,height:844});assert(await panel.isVisible());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await panel.screenshot({path:'tmp/release/browser/mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('Release default UI, independent share editing, saved persistence and desktop/mobile layout passed.');
}finally{if(browser)await browser.close();server.kill();}
