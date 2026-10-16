// Set PLAYWRIGHT_MODULE to a newer runner when system Edge is incompatible with the project's Playwright 1.48.
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const origin=process.env.BASE_URL||'http://127.0.0.1:5198';
const out=new URL('../tmp/finish-workflow/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const bytes=await readFile(new URL('../sale-deed-template-v6.docx',import.meta.url));
 const version={id:'finish-review-v6',filename:'Sale deed v6',instrumentId:'sale',hash:createHash('sha256').update(bytes).digest('hex')};
 await page.route('**/api/templates',r=>r.fulfill({json:{active:{sale:version.id},versions:[version]}}));
 await page.route('**/api/templates/versions/*/download',r=>r.fulfill({body:bytes,contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
 await page.goto(origin);await page.getByRole('button',{name:'Create your first deed'}).click();await page.locator('.rail-step').first().waitFor();
 const go=async step=>{if(page.viewportSize().width<=900)await page.locator('#mobile-step').selectOption(String(step));else await page.locator('.rail-step').nth(step).click();await page.locator(`.workflow-step-${step}`).waitFor();};
 await go(4);await page.getByRole('textbox',{name:/sale consideration/i}).fill('100000');
 await go(5);await page.getByRole('button',{name:'+ Cheque',exact:true}).click();const first=page.locator('.payment-record').first();
 await first.getByRole('textbox',{name:'Amount (₹)',exact:true}).fill('25000');
 await first.getByRole('button',{name:'Cash',exact:true}).click();
 assert.equal(await first.getByRole('textbox',{name:'Amount (₹)',exact:true}).inputValue(),'25,000');
 await page.getByRole('button',{name:'+ Cash',exact:true}).click();
 const second=page.locator('.payment-record').last();
 assert.equal(await second.getByRole('textbox',{name:'Amount (₹)',exact:true}).inputValue(),'75,000');
 await second.getByRole('textbox',{name:'Amount (₹)',exact:true}).fill('80000');
 await second.getByRole('alert').filter({hasText:'previous value'}).waitFor();
 assert.equal(await second.getByRole('textbox',{name:'Amount (₹)',exact:true}).getAttribute('aria-invalid'),'true');
 assert.equal(await second.getByRole('textbox',{name:'Amount (₹)',exact:true}).inputValue(),'75,000');
 await second.getByRole('textbox',{name:'Amount (₹)',exact:true}).fill('70000');
 assert.equal(await second.getByRole('textbox',{name:'Amount (₹)',exact:true}).getAttribute('aria-invalid'),null);
 assert((await page.locator('.payment-summary-grid').innerText()).includes('5,000'));
 await first.getByRole('button',{name:'Cheque',exact:true}).click();
 await first.getByRole('checkbox',{name:/1% TDS/}).check();
 await first.getByRole('checkbox',{name:/1% TDS/}).uncheck();
 for(const theme of ['light','dark']){
   if(theme==='dark')await page.getByRole('button',{name:'Switch to dark mode'}).click();
   for(const width of [320,375,768,1024,1440]){
     await page.setViewportSize({width,height:1000});
     for(const step of [5,8,9]){
       await go(step);
       assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow ${step} ${width} ${theme}`);
       if(width===375||width===1440)await page.screenshot({path:fileURLToPath(new URL(`step-${step}-${width}-${theme}.png`,out)),fullPage:true});
     }
   }
 }
 await page.setViewportSize({width:1440,height:1000});await go(8);
 const group=page.locator('.review-group').first();await group.locator('summary').click();assert(await group.locator('li').count()>0);
 await group.getByRole('button',{name:'Review section'}).click();await page.waitForFunction(()=>document.activeElement?.id==='workspace-title');
 await go(9);await page.getByRole('radio',{name:/my template/i}).check();
 const word=page.getByRole('button',{name:'Download Word 2007 deed (.docx)',exact:true});
 assert(await word.isDisabled());await page.getByText('Choose a compatible Word template to enable this download.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Upload .docx template',exact:true}).waitFor();
 await page.getByRole('radio',{name:/published \/ pinned template/i}).check();
 assert.equal(await word.isEnabled(),true);
 const downloaded=page.waitForEvent('download');await word.click();const artifact=await downloaded;assert(artifact.suggestedFilename().endsWith('.docx'));await artifact.saveAs(fileURLToPath(new URL('verified-draft.docx',out)));
 await page.getByRole('status').filter({hasText:/download|saved|prepared/i}).last().waitFor();
 await page.locator('.download-outstanding>summary').click();assert(await page.locator('.download-outstanding .review-group').first().isVisible());
 await page.getByRole('button',{name:'Back to final review'}).click();await page.locator('.workflow-step-8').waitFor();
 await page.goto('about:blank');

 assert.deepEqual(errors,[]);
 console.log('PASS: payment mode retention, balance arithmetic, rejected overpayment with linked inline error, TDS controls, review navigation, custom-template gating, real Word download, and 320–1440px layouts in both themes.');
}finally{await browser.close();}
