import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({channel:'chrome',headless:true});
const output = 'tmp/workspace-redesign';
await mkdir(output,{recursive:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.DEEDCRAFT_URL || 'http://127.0.0.1:5190';
async function seed(instrument = 'sale', variant = '') {
  await page.goto(base);
  await page.evaluate(async ({instrument,variant}) => {
    const {newDraft,draftReducer} = await import('/source-draft.ts');
    let draft = draftReducer(newDraft(),{type:'instrument',instrumentId:instrument});
    if (variant) draft = draftReducer(draft,{type:'variant',variantId:variant});
    draft.step=0;
    Object.assign(draft.manual,{
      'property|primary|category':'Residential:Finished',
      'property|primary|extentSqYards':'200',
      'property|primary|consid':'3000000',
      'property|primary|bankName':'Example Bank',
      'property|primary|bankBranch':'Main Branch',
      'property|primary|officialDesignation':'Manager',
      'property|primary|village':'Hyderabad',
      'property|primary|bearingHNo':'1-2-3',
      'property|primary|north':'Neighbouring property',
      'property|primary|south':'Road',
      'executant|primary|executantName':'A PERSON WITH A LONG FAMILY NAME',
      'claimant|primary|claimantName':'ANOTHER PERSON WITH A LONG FAMILY NAME',
    });
    const deed = {id:draft.id,updatedAt:new Date().toISOString(),name:'Design review',claimantNames:['Design review'],deedType:instrument,draft,sourceFiles:{},planDrafts:{},referencePlanDrafts:{},selectedPlanSvgs:{},extraPartyRecords:{executant:[],claimant:[]},templateMode:'built-in',customTemplate:null};
    await new Promise((resolve,reject) => {
      const open = indexedDB.open('deedcraft-saved-deeds',1);
      open.onsuccess=()=>{const db=open.result;const tx=db.transaction('deeds','readwrite');const store=tx.objectStore('deeds');store.clear();store.put(deed);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};
    });
  },{instrument,variant});
  await page.reload();
  await page.getByRole('button',{name:'Continue / Edit'}).click();
}
async function overflow(context) {
  const failures = await page.evaluate(() => {
    const width=innerWidth;
    return [...document.querySelectorAll('.wizard-app *')].filter(el=>{
      if(el.closest('.registration-steps') || !el.getClientRects().length) return false;
      const r=el.getBoundingClientRect();
      return r.width>0 && (r.right>width+2 || r.left< -2);
    }).slice(0,8).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}));
  });
  assert.deepEqual(failures,[],context+' overflow');
}
try {
  await seed();
  for (const mode of ['classic','registration']) {
    await page.getByLabel('Dashboard version',{exact:true}).selectOption(mode);
    await page.locator('.wizard-app').evaluate((el,mode)=>new Promise(resolve=>{
      const check=()=>{if(el.classList.contains('registration-workspace') === (mode==='registration'))resolve();else requestAnimationFrame(check)};check();
    }),mode);
    for (const width of [390,768,1024,1440,1920]) {
      await page.setViewportSize({width,height:1000});
      for (const theme of ['light','dark']) {
        if(await page.locator('.wizard-app').getAttribute('data-theme') !== theme) await page.getByRole('button',{name:'Switch to '+theme+' mode',exact:true}).click();
        await page.getByRole('button',{name:'Draft overview',exact:true}).click();
        await overflow(mode+' '+width+' '+theme+' overview');
        for (const id of [0,1,2,3,4,5,6,7,8,9,10]) {
          const button=page.locator('.registration-steps button').nth(id);
          await button.click();
          assert.equal(await button.getAttribute('aria-current'),'step');
          await overflow(mode+' '+width+' '+theme+' step '+id);
          if ((mode==='classic' && width===1440 && theme==='light') || (mode==='registration' && width===390 && theme==='dark')) {
            await page.screenshot({path:output+'/'+mode+'-'+width+'-'+theme+'-'+id+'.png',fullPage:true});
          }
        }
        await page.getByRole('button',{name:'Saved deeds',exact:true}).click();
        await overflow(mode+' '+width+' '+theme+' library');
        await page.getByRole('button',{name:'Continue / Edit'}).click();
      }
    }
  }
  console.log('PASS: both layouts, both themes, five widths, every workflow screen and saved-deed library.');
  for (const [instrument,variant] of [['gift',''],['gift','municipal-gift'],['power_of_attorney',''],['power_of_attorney','general-power-of-attorney-family'],['agreement_of_sale',''],['release',''],['reconveyance','']]) {
    await seed(instrument,variant);
    const labels=await page.locator('.registration-steps button').allTextContents();
    if(['gift','power_of_attorney','reconveyance'].includes(instrument)) assert(!labels.some(label=>label.includes('Payments')));
    if(['release','reconveyance'].includes(instrument)) assert(labels.some(label=>label.includes('Releasor')));
    for (const width of [390,1440]) {
      await page.setViewportSize({width,height:1000});
      const count=await page.locator('.registration-steps button').count();
      for(let index=0;index<count;index++) {
        await page.locator('.registration-steps button').nth(index).click();
        await overflow(instrument+' '+variant+' '+width+' section '+index);
      }
    }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: Gift/Municipal Gift, General/Family GPA, Agreement, Release and Reconveyance navigation and responsive screens.');
} finally {await browser.close()}
