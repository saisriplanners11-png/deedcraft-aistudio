import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';

const directory = await mkdtemp(join(tmpdir(), 'deedcraft-poa-browser-'));
const origin = 'http://127.0.0.1:5198';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { cwd: new URL('../', import.meta.url), env: { ...process.env, TEMPLATE_STORAGE_BACKEND: 'disk', TEMPLATE_STORAGE_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
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
    const rt = await import('/template-runtime.ts');
    const { saveDeed } = await import('/saved-deeds.ts');
    let draft = rt.draftReducer(rt.newDraft(), { type: 'instrument', instrumentId: 'power_of_attorney', variantId: 'general-power-of-attorney-family' });
    const sample = rt.sampleState('ordinary-plot');
    for (const [field, value] of Object.entries(sample.form)) {
      const role = field.startsWith('executant') ? 'executant' : field.startsWith('claimant') ? 'claimant' : 'property';
      const record = ['consid', 'executionDate', 'stampValue'].includes(field) ? 'transaction' : 'primary';
      draft.manual[`${role}|${record}|${field}`] = value;
    }
    draft.manual['property|primary|category'] = sample.category;
    draft.manual['claimant|primary|claimantName'] = 'ATTORNEY ONE';
    for (const [field, value] of Object.entries(sample.form).filter(([field]) => field.startsWith('claimant'))) draft.manual[`claimant|attorney-two|${field}`] = value;
    draft.manual['claimant|attorney-two|claimantName'] = 'ATTORNEY TWO';
    draft.step = 7;
    await saveDeed({ id: draft.id, updatedAt: new Date().toISOString(), claimantNames: ['POA BROWSER QA'], deedType: 'GPA/Power of Attorney', draft, sourceFiles: {}, planDrafts: {}, referencePlanDrafts: {}, selectedPlanSvgs: {}, extraPartyRecords: { executant: [], claimant: [] }, templateMode: 'built-in', customTemplate: null });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Continue / Edit' }).first().click();
  const relationships = page.getByLabel('Relationship to principal(s)', { exact: true });
  await relationships.first().waitFor();
  assert.equal(await relationships.count(), 2);
  await relationships.nth(0).selectOption('son'); await relationships.nth(1).selectOption('daughter');
  await page.getByRole('region', { name: 'GPA appointment recital' }).getByText(/appoint my son ATTORNEY ONE and daughter ATTORNEY TWO as/).waitFor();
  await mkdir('tmp/general-poa-qa', { recursive: true });
  await page.screenshot({ path: 'tmp/general-poa-qa/family-dashboard.png', fullPage: true });
  await page.locator('.rail-step').nth(0).click();
  const variant = page.locator('.setup-fields select').nth(1);
  assert.deepEqual(await variant.locator('option').evaluateAll(options => options.map(option => option.value)), ['general-power-of-attorney', 'general-power-of-attorney-family', 'special-power-of-attorney', 'property-power-of-attorney']);
  await variant.selectOption('general-power-of-attorney');
  await page.locator('.rail-step').nth(7).click();
  assert.equal(await relationships.count(), 0);
  await page.getByRole('region', { name: 'GPA appointment recital' }).getByText(/appoint my friend ATTORNEY ONE and friend ATTORNEY TWO as/).waitFor();
  await page.locator('.rail-step').nth(0).click(); await variant.selectOption('general-power-of-attorney-family');
  await page.locator('.rail-step').nth(7).click();
  assert.equal(await relationships.nth(0).inputValue(), 'son'); assert.equal(await relationships.nth(1).inputValue(), 'daughter');
  await relationships.nth(1).selectOption('other');
  await page.locator('.rail-step').nth(9).click();
  assert(await page.getByRole('button', { name: 'Download Word 2007 deed (.docx)' }).isDisabled());
  await page.locator('.rail-step').nth(7).click();
  await page.getByLabel('Family relationship wording', { exact: true }).fill('niece');
  await page.locator('.rail-step').nth(9).click();
  assert(await page.getByRole('button', { name: 'Download Word 2007 deed (.docx)' }).isEnabled());
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Word 2007 deed (.docx)' }).click();
  await (await downloadEvent).saveAs('tmp/general-poa-qa/browser-family.docx');
  const runtime = await loadTemplateRuntime();
  const text = await runtime.docxToText(new Uint8Array(await readFile('tmp/general-poa-qa/browser-family.docx')));
  assert.match(text, /appoint my son ATTORNEY ONE and niece ATTORNEY TWO as/);
  await page.reload(); await page.getByRole('button', { name: 'Continue / Edit' }).first().click();
  await page.locator('.rail-step').nth(7).click();
  assert.equal(await relationships.nth(0).inputValue(), 'son');
  assert.equal(await page.getByLabel('Family relationship wording', { exact: true }).inputValue(), 'niece');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await relationships.nth(0).isVisible());
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: 'tmp/general-poa-qa/family-dashboard-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: GPA dashboard selectors, separate attorney relationships, recital preview, variant switching, missing-relationship download gate, Word download and saved reload.');
} finally {
  if (browser) await browser.close();
  server.kill();
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected test directory.');
  await rm(directory, { recursive: true, force: true });
}
