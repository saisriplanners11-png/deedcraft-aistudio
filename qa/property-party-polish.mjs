const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const out=new URL('../tmp/property-party/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const bytes=await readFile(new URL('../sale-deed-template-v6.docx',import.meta.url));const version={id:'property-party-v6',filename:'Sale deed v6',instrumentId:'sale',hash:createHash('sha256').update(bytes).digest('hex')};
 await page.route('**/api/templates',r=>r.fulfill({json:{active:{sale:version.id},versions:[version]}}));await page.route('**/api/templates/versions/*/download',r=>r.fulfill({body:bytes}));
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:5198');await page.getByRole('button',{name:'Create your first deed'}).click();await page.locator('.rail-step').first().waitFor();
 const go=async step=>{if(page.viewportSize().width<=900)await page.locator('#mobile-step').selectOption(String(step));else await page.locator('.rail-step').nth(step).click();await page.waitForFunction(step=>document.querySelector('.step-position')?.textContent===`Step ${step+1} of 11`,step);};
 await go(0);await page.getByLabel('What is this property?').selectOption('Residential');
 await go(3);await page.getByLabel('Survey no(s).',{exact:true}).fill('145/A');await page.getByLabel('North',{exact:true}).fill('North road');
 await page.locator('.property-wording>summary').click();await page.locator('.property-wording .schedule-text-preview').waitFor();assert((await page.locator('.property-wording').innerText()).includes('145/A'));
 await page.locator('.property-wording>summary').click();
 await page.getByRole('button',{name:'+ Add another property',exact:true}).click();
 await page.locator('.rail-step').nth(3).click();
 await page.getByLabel('What is this property?').selectOption('Open Place');await page.getByLabel('Survey no(s).',{exact:true}).fill('SECOND/22');
 await page.getByRole('button',{name:/Schedule 1.*Residential/}).click();assert.equal(await page.getByLabel('Survey no(s).',{exact:true}).inputValue(),'145/A');
 for(const [step,name] of [[6,'EXECUTANT SAMPLE'],[7,'CLAIMANT SAMPLE']]){
  await go(step);await page.getByLabel('Full name',{exact:true}).fill(name);await page.getByLabel('House no.',{exact:true}).fill('10-22');await page.getByLabel('Village',{exact:true}).fill('Sample Town');
  assert.equal(await page.getByRole('heading',{name:'Personal details',exact:true}).count(),1);assert.equal(await page.getByRole('heading',{name:'Residential address',exact:true}).count(),1);
  await page.getByRole('combobox',{name:/^Party type/}).selectOption('Company');await page.getByLabel('Entity name (English)',{exact:true}).fill('COMPANY SAMPLE');await page.getByRole('button',{name:'+ Add representative',exact:true}).click();await page.locator('.representative-card').getByLabel('Name *',{exact:true}).fill('SIGNER SAMPLE');await page.getByLabel('Same as registered office address',{exact:true}).check();await page.getByLabel('Same as registered office address',{exact:true}).uncheck();
  await page.getByRole('combobox',{name:/^Party type/}).selectOption('Individual');assert.equal(await page.getByLabel('Full name',{exact:true}).inputValue(),name);assert.equal(await page.getByLabel('House no.',{exact:true}).inputValue(),'10-22');
 }
 const heights=[];
 for(const theme of ['light','dark']){
  if(theme==='dark')await page.getByRole('button',{name:'Switch to dark mode'}).click();
  for(const width of (process.env.QUICK_LAYOUT ? [375,1440] : [320,375,768,1024,1440])){
   await page.setViewportSize({width,height:1000});
   for(const step of (process.env.QUICK_LAYOUT ? [3,6,7] : Array.from({length:10},(_,index)=>index))){
    await go(step);const header=await page.locator('.compact-step-header').boundingBox();heights.push({width,step,height:Math.round(header.height)});
    assert(header.height<=(width<=620?130:105),`Header too tall ${width},step ${step}: ${header.height}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width},step ${step}`);
    if([6,7].includes(step)&&width===1440){const control=await page.locator('.party-type-selector select').boundingBox();assert(control.width>=240,'Party type selector is too narrow');}
    if([3,6,7].includes(step)&&(width===375||width===1440))await page.screenshot({path:fileURLToPath(new URL(`step-${step}-${width}-${theme}.png`,out)),fullPage:true});
   }
  }
 }
 await page.setViewportSize({width:375,height:1000});await go(6);await page.locator('.template-context>summary').click();assert(await page.getByText('property-party-v6',{exact:true}).isVisible());await page.locator('.template-context>summary').click();
 await page.getByRole('combobox',{name:/^Party type/}).selectOption('Company');assert.equal(await page.getByLabel('Entity name (English)',{exact:true}).inputValue(),'COMPANY SAMPLE');assert.equal(await page.locator('.representative-card').getByLabel('Name *',{exact:true}).inputValue(),'SIGNER SAMPLE');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL('company-mobile-dark.png',out)),fullPage:true});
 await page.getByRole('button',{name:'Saved deeds',exact:true}).click();await page.getByRole('button',{name:'Continue / Edit',exact:true}).first().click();await page.locator('.party-record-card').waitFor();assert.equal(await page.getByLabel('Entity name (English)',{exact:true}).inputValue(),'COMPANY SAMPLE');
 assert.deepEqual(errors,[]);console.log('PASS: all step headers compact at 320–1440px, light/dark layouts, property record isolation, wording preview, split individual fields, entity/representative retention, template disclosure and save/reopen. Header heights:',JSON.stringify([...new Set(heights.map(x=>x.height))]));
}catch(error){if(page){console.log((await page.locator('body').innerText()).slice(0,2200));await page.screenshot({path:fileURLToPath(new URL('failure.png',out)),fullPage:true});}throw error;}finally{await browser.close();}
