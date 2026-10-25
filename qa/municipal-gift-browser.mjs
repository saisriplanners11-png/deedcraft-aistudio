import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt=await loadTemplateRuntime(), browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5197');await page.getByRole('heading',{name:'Saved deeds',exact:true}).waitFor();
 const sample=rt.sampleState('ordinary-dismantled');Object.assign(sample.form,{extentSqYards:'30',extentSqMeters:'999',claimantName:'ORIGINAL CLAIMANT',claimantDob:'1985-01-02',claimantAadhaar:'123456789012'});
 await page.evaluate(async(form)=>{
  const {newDraft}=await import('/source-draft.ts');const {saveDeed}=await import('/saved-deeds.ts');const draft=newDraft();draft.step=7;draft.instrumentId='gift';draft.variantId='municipal-gift';
  for(const[field,value]of Object.entries(form)){const role=field.startsWith('executant')?'executant':field.startsWith('claimant')?'claimant':'property';draft.manual[`${role}|${['consid','stampValue','executionDate'].includes(field)?'transaction':'primary'}|${field}`]=value;}
  draft.manual['property|primary|category']='Demolished';
  await saveDeed({id:draft.id,updatedAt:new Date().toISOString(),claimantNames:['MUNICIPAL QA'],deedType:'Gift',draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:[]},templateMode:'built-in',customTemplate:null});
 },sample.form);
 await page.reload();await page.getByRole('button',{name:'Continue / Edit'}).first().click();
 const name=page.getByLabel(/^Full name/);await name.waitFor();assert.equal(await name.inputValue(),'ORIGINAL CLAIMANT');
 await name.fill('ENTERED MUNICIPAL CLAIMANT');await page.getByLabel('Gender',{exact:true}).selectOption('Female');
 assert.equal(await page.getByLabel(/^Aadhaar number/).inputValue(),'123456789012');
 assert.equal(await page.getByRole('region',{name:'Municipal donee'}).count(),0);
 await page.waitForTimeout(1500);await page.reload();await page.getByRole('heading',{name:'Saved deeds',exact:true}).waitFor();await page.getByRole('button',{name:'Continue / Edit'}).first().click();
 await name.waitFor();assert.equal(await name.inputValue(),'ENTERED MUNICIPAL CLAIMANT');
 await page.locator('.rail-step').filter({hasText:'Generate Deed'}).click();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download Word 2007 deed (.docx)',exact:true}).click();const download=await downloading;
 assert.match(download.suggestedFilename(),/Municipal-Gift-ENTERED-MUNICIPAL-CLAIMANT/);
 const text=await rt.docxToText(new Uint8Array(await readFile(await download.path())));
 assert.match(text,/30 square yards equivalent to 25\.08 square meters/);
 const claimant=text.split('IN FAVOUR OF')[1].split('WHEREAS')[0];assert.match(claimant,/ENTERED MUNICIPAL CLAIMANT/);assert.match(claimant,/123456789012/);
 assert.doesNotMatch(claimant,/Commissioner|Municipal Council|Hyderabad Municipal Corporation Act/i);assert.deepEqual(errors,[]);
 console.log('PASS: Municipal Gift Sale-style claimant fields, saved identity/gender, recipient-based filename and actual Word download with calculated square metres.');
} finally {await browser.close();}
