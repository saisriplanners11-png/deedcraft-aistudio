import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
const directory = await mkdtemp(join(tmpdir(), 'deedcraft-amendment-browser-'));
const origin = 'http://127.0.0.1:5214';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5214', '--strictPort'], { cwd: new URL('../', import.meta.url), env: { ...process.env, TEMPLATE_STORAGE_BACKEND: 'disk', TEMPLATE_STORAGE_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let logs = '', browser;
server.stdout.on('data', chunk => { logs += chunk; }); server.stderr.on('data', chunk => { logs += chunk; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(origin + '/api/templates')).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 250));
  }
  assert(ready, logs);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.evaluate(async () => {
    const { newDraft } = await import('/source-draft.ts');
    const { saveDeed } = await import('/saved-deeds.ts');
    const draft = newDraft(); draft.step = 1;
    draft.manual['property|primary|category'] = 'Vacant Plot';
    draft.manual['claimant|primary|claimantName'] = 'AMENDMENT BROWSER QA';
    for (const [record, values] of [
      ['base', { linkOption: 'linkDoc', linkDocType: 'Sale Deed', linkDocNo: 'BASE-11', linkDocDate: '2020-01-02', linkSro: 'BASE OFFICE', linkSroCode: 'BASE-CODE' }],
      ['typed', { linkOption: 'linkDoc', linkDocType: '', linkDocNo: 'AMEND-44', linkDocDate: '2024-03-04', linkSro: 'OWN OFFICE', linkSroCode: 'OWN-CODE' }],
    ]) {
      draft.linkPropertyRecords[record] = 'primary';
      for (const [field, value] of Object.entries(values)) draft.manual[`link|${record}|${field}`] = value;
    }
    await saveDeed({ id: draft.id, updatedAt: new Date().toISOString(), claimantNames: ['AMENDMENT BROWSER QA'], deedType: 'Sale', draft, sourceFiles: {}, planDrafts: {}, referencePlanDrafts: {}, selectedPlanSvgs: {}, extraPartyRecords: { executant: [], claimant: [] }, templateMode: 'built-in', customTemplate: null });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Continue / Edit' }).first().click();
  const card = page.locator('[data-title-point="linkDoc"]').filter({ has: page.locator('input[value="AMEND-44"]') });
  await card.waitFor();
  const type = card.getByRole('textbox', { name: /^Document type/ });
  await type.fill('Rectification Deed');
  assert(await type.evaluate(element => document.activeElement === element), 'typing must retain focus');
  const preview = card.locator('[aria-label="Applicable deed recital"]');
  await card.locator('.title-amendment-prose').waitFor();
  assert.match(await preview.innerText(), /Rectification Deed recital selected/);
  for (const value of ['AMEND-44', '04-03-2024', 'OWN OFFICE', 'OWN-CODE']) assert((await preview.innerText()).includes(value), value);
  assert.doesNotMatch(await preview.innerText(), /BASE-11|BASE OFFICE|BASE-CODE/);
  await card.getByRole('textbox', { name: /^SRO code/ }).fill('UPDATED-CODE');
  assert((await preview.innerText()).includes('UPDATED-CODE'));
  await type.fill('Supplemental Deed');
  assert(await type.evaluate(element => document.activeElement === element));
  assert.match(await preview.innerText(), /Supplemental Deed recital selected/);
  assert((await preview.innerText()).includes('AMEND-44'));
  assert.doesNotMatch(await preview.innerText(), /Rectification Deed recital selected/);
  await type.fill('Sale Deed');
  assert.equal(await card.locator('[aria-label="Applicable deed recital"]').count(), 0);
  assert.equal(await card.getByRole('textbox', { name: /^Document number/ }).inputValue(), 'AMEND-44');
  await type.fill('Rectification Deed');
  await card.locator('.title-amendment-prose').waitFor();
  await page.waitForFunction(async () => {
    const { listSavedDeeds } = await import('/saved-deeds.ts');
    return (await listSavedDeeds()).some(deed => deed.draft.manual['link|typed|linkDocType'] === 'Rectification Deed' && deed.draft.manual['link|typed|linkSroCode'] === 'UPDATED-CODE');
  });
  await mkdir('tmp/title-amendment-qa', { recursive: true });
  await card.screenshot({ path: 'tmp/title-amendment-qa/desktop-card.png' });
  await page.reload(); await page.getByRole('button', { name: 'Continue / Edit' }).first().click();
  await card.locator('.title-amendment-prose').waitFor();
  assert.equal(await type.inputValue(), 'Rectification Deed');
  assert.equal(await card.getByRole('textbox', { name: /^SRO code/ }).inputValue(), 'UPDATED-CODE');
  await page.setViewportSize({ width: 390, height: 844 });
  await type.focus();
  assert(await type.isVisible());
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await card.screenshot({ path: 'tmp/title-amendment-qa/mobile-card.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: typed amendment recital preview, own field updates, preserved focus, type switching, separate base title, save/reload and mobile layout.');
} finally {
  if (browser) await browser.close();
  server.kill();
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected test directory.');
  await rm(directory, { recursive: true, force: true });
}
