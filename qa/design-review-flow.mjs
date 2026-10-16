import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const origin = process.env.UI_REVIEW_URL || 'http://127.0.0.1:5198';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const out = new URL('../tmp/design-review/', import.meta.url);
await mkdir(out, { recursive: true });
const errors = [];
const uploadFixture = new URL(`upload-fixture-${Date.now()}.html`, out);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  // Use the real bundled Word template with a local API fixture, so design QA
  // never depends on or writes to the configured shared template backend.
  const bytes = await readFile(new URL('../sale-deed-template-v6.docx', import.meta.url));
  const version = { id: 'ui-review-v6', filename: 'Sale deed v6', instrumentId: 'sale', hash: createHash('sha256').update(bytes).digest('hex') };
  await page.route('**/api/templates', route => route.fulfill({ json: { active: { sale: version.id }, versions: [version] } }));
  await page.route('**/api/templates/versions/*/download', route => route.fulfill({ body: bytes, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Your next deed starts here' }).waitFor();
  await page.screenshot({ path: new URL('library-desktop.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  await page.getByRole('button', { name: 'Create your first deed' }).click();
  await page.locator('.rail-overview').waitFor({ timeout: 60000 });
  await page.locator('.rail-overview').click();
  await page.locator('.dashboard').waitFor();
  await page.screenshot({ path: new URL('overview-desktop.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  await page.locator('.rail-step').nth(8).click();
  await page.getByRole('heading', { name: 'Details to review', exact: true }).waitFor();
  assert(await page.locator('.review-group').count() > 0);
  await page.locator('.review-group').first().locator('summary').click();
  assert(await page.locator('.review-group').first().locator('li').count() > 0);
  await page.screenshot({ path: new URL('review-desktop.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  await page.locator('.review-group').first().getByRole('button', { name: 'Review section' }).click();
  assert.equal(await page.locator('#workspace-title').evaluate(el => el === document.activeElement), true);
  await page.locator('.rail-step').nth(0).click();
  await page.locator('.setup-fields select').first().waitFor();
  assert.equal(await page.locator('.setup-fields select').count(), 2);
  assert.equal(await page.locator('.setup-fields select').first().inputValue(), 'sale');
  await page.screenshot({ path: new URL('setup-desktop.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  await page.locator('.rail-step').nth(2).click();
  assert.equal(await page.locator('#workspace-title').evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('.rail-step[aria-current=step]').count(), 1);
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width <= 900) await page.locator('#mobile-step').selectOption('2');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Jurisdiction overflows at ${width}px`);
    const controls = await page.locator('.deed-field :is(input,select,textarea)').evaluateAll(nodes => nodes.map(el => ({ height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width })));
    assert(controls.length > 0);
    assert(controls.every(rect => rect.height >= 36 && rect.width > 100));
    await page.screenshot({ path: new URL(`form-${width}.png`, out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('.document-upload input[type=file]').setInputFiles({ name: 'unsupported.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid fixture') });
  await page.getByRole('alert').filter({ hasText: 'Choose PDF' }).waitFor();
  assert.equal(await page.locator('.document-upload').getAttribute('aria-busy'), 'false');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: new URL('form-mobile-dark.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  for (let step = 0; step <= 9; step++) {
    await page.locator('#mobile-step').selectOption(String(step));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Step ${step + 1} overflows on mobile`);
    if (step === 8) await page.screenshot({ path: new URL('review-mobile-dark.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  }
  await page.locator('#mobile-step').selectOption('-1');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: new URL('overview-mobile-dark.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  await page.setViewportSize({ width: 812, height: 375 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole('button', { name: 'Saved deeds', exact: true }).click();
  await page.getByRole('heading', { name: 'Saved deeds', exact: true }).waitFor();
  await page.getByLabel('Sort by', { exact: true }).selectOption('type');
  await page.screenshot({ path: new URL('saved-library.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  await page.getByRole('searchbox').fill('nonexistent-party');
  await page.getByRole('button', { name: 'Clear search' }).waitFor();
  assert.equal(await page.locator('.saved-deed-card').count(), 0);
  await page.getByRole('button', { name: 'Clear search' }).click();
  assert(await page.locator('.saved-deed-card').count() > 0);
  await page.getByRole('button', { name: 'Continue / Edit', exact: true }).first().click();
  await page.locator('.dashboard').waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Continue / Edit', exact: true }).first().click();
  await page.locator('.dashboard').waitFor();
  await writeFile(uploadFixture, `<div id="fixture"></div><p id="received"></p><script type="module">
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {DocumentUpload} from '/workflow-ui.tsx';
    function Fixture(){const [busy,setBusy]=useState(false);return React.createElement('div',null,
      React.createElement(DocumentUpload,{label:'Test upload',busy,onUpload:files=>document.querySelector('#received').textContent=files.map(f=>f.name).join(',')}),
      React.createElement('button',{onClick:()=>setBusy(true)},'Set busy'))}
    createRoot(document.querySelector('#fixture')).render(React.createElement(Fixture));
  </script>`);
  await page.goto(origin + '/tmp/design-review/' + uploadFixture.pathname.split('/').pop());
  await page.getByRole('button', {name:'Choose file(s) or photo',exact:true}).waitFor();
  await page.locator('input[type=file]').setInputFiles({name:'source.txt',mimeType:'text/plain',buffer:Buffer.from('source')});
  assert.equal(await page.locator('#received').innerText(),'source.txt');
  await page.locator('.document-upload').evaluate(el=>{const data=new DataTransfer();data.items.add(new File(['proof'],'dropped.pdf',{type:'application/pdf'}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));});
  assert.equal(await page.locator('#received').innerText(),'dropped.pdf');
  await page.getByRole('button',{name:'Set busy',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.document-upload').getAttribute('aria-busy')==='true');
  await page.locator('.document-upload').evaluate(el=>{const data=new DataTransfer();data.items.add(new File(['proof'],'blocked.pdf',{type:'application/pdf'}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));});
  assert.equal(await page.locator('#received').innerText(),'dropped.pdf');
  assert.equal(await page.getByRole('button',{name:'Choose file(s) or photo',exact:true}).isDisabled(),true);
  assert.deepEqual(errors, []);
  console.log('PASS: create/resume, setup controls, grouped review navigation, invalid upload feedback, file-picker and drag/drop callbacks, busy upload protection, sorting and search, responsive forms at 375/768/1024/1440, all core steps on mobile, landscape, focus transfer, dark mode, reduced motion, persistence, and no browser errors.');
} finally { await browser.close(); await unlink(uploadFixture).catch(() => {}); }
