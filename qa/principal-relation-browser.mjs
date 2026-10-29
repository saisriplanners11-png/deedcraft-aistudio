import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
const directory = await mkdtemp(join(tmpdir(), 'deedcraft-principal-relation-'));
const origin = 'http://127.0.0.1:5215';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5215', '--strictPort'], { cwd: new URL('../', import.meta.url), env: { ...process.env, TEMPLATE_STORAGE_BACKEND: 'disk', TEMPLATE_STORAGE_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
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
  for (const mode of ['gpa', 'agpa']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.evaluate(async mode => {
      const { newDraft, draftReducer } = await import('/source-draft.ts');
      const { sampleState } = await import('/template-runtime.ts');
      const { saveDeed } = await import('/saved-deeds.ts');
      const sample = sampleState(mode + '-plot');
      const draft = draftReducer(newDraft(), { type: 'instrument', instrumentId: 'sale', variantId: mode === 'gpa' ? 'sale-deed-by-gpa-holder' : 'sale-through-existing-agpa' });
      draft.step = 9; draft.saleAuthority = sample.saleAuthority; draft.gpaExecutantsReplaced = true;
      draft.saleAuthority.attorneys[0].principalIds = ['imported-owner', 'owner-two'];
      for (const [field, value] of Object.entries({ ...sample.form, category: sample.category })) {
        if (field === 'executantRelation') continue;
        const role = field.startsWith('executant') ? 'executant' : field.startsWith('claimant') ? 'claimant' : 'property';
        draft.manual[`${role}|${role === 'executant' ? 'imported-owner' : 'primary'}|${field}`] = value;
        if (role === 'executant') draft.manual[`executant|owner-two|${field}`] = field === 'executantName' ? 'SECOND PRINCIPAL' : value;
      }
      await saveDeed({ id: draft.id, updatedAt: new Date().toISOString(), claimantNames: ['PRINCIPAL RELATION QA'], deedType: 'Sale', draft, sourceFiles: {}, planDrafts: {}, referencePlanDrafts: {}, selectedPlanSvgs: {}, extraPartyRecords: { executant: [], claimant: [] }, templateMode: 'built-in', customTemplate: null });
    }, mode);
    await page.reload();
    await page.getByRole('button', { name: 'Continue / Edit' }).first().click();
    const download = page.getByRole('button', { name: 'Download Word 2007 deed (.docx)' });
    await download.waitFor();
    assert(await download.isDisabled());
    assert.match(await page.locator('#word-download-state').innerText(), /Principal 1: enter relation/);
    await page.getByRole('button', { name: 'Open Executants and authority' }).click();
    const principal = page.locator('.party-record-card').filter({ has: page.getByRole('heading', { name: /Executant 1.*Principal/ }) });
    const relation = principal.getByRole('combobox', { name: /^Relation/ });
    await relation.waitFor();
    assert.equal(await relation.inputValue(), '', 'Unentered relation must show a blank choice, not an unsaved S/O default.');
    assert.equal(await relation.getAttribute('aria-required'), 'true');
    assert(await principal.locator('.field-required-guidance').isVisible(), 'Missing required relation guidance stays visible even when optional hints are hidden.');
    await relation.selectOption('S/O');
    assert.equal(await relation.inputValue(), 'S/O');
    const second = page.locator('.party-record-card').filter({ has: page.getByRole('heading', { name: /Executant 2.*Principal/ }) });
    const secondRelation = second.getByRole('combobox', { name: /^Relation/ });
    assert.equal(await secondRelation.inputValue(), '');
    await secondRelation.selectOption('W/O');
    assert.equal(await relation.inputValue(), 'S/O', 'Each principal retains an independent relation.');
    await page.waitForFunction(async () => {
      const { listSavedDeeds } = await import('/saved-deeds.ts');
      const manual = (await listSavedDeeds())[0]?.draft.manual;
      return manual?.['executant|imported-owner|executantRelation'] === 'S/O' && manual?.['executant|owner-two|executantRelation'] === 'W/O';
    });
    if (mode === 'gpa') {
      await mkdir('tmp/principal-relation-qa', { recursive: true });
      await principal.screenshot({ path: 'tmp/principal-relation-qa/desktop.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      assert(await relation.isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await principal.screenshot({ path: 'tmp/principal-relation-qa/mobile.png' });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.reload();
    await page.getByRole('button', { name: 'Continue / Edit' }).first().click();
    assert.equal(await relation.inputValue(), 'S/O', 'The selected principal relation survives reload.');
    assert.equal(await secondRelation.inputValue(), 'W/O');
    await page.getByRole('button', { name: /10\s*Generate Deed/ }).click();
    await download.waitFor();
    assert(await download.isEnabled(), await page.locator('#word-download-state').innerText());
    const downloaded = page.waitForEvent('download');
    await download.click();
    const file = await downloaded;
    assert.match(file.suggestedFilename(), /\.docx$/i);
    assert.equal(await file.failure(), null);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: GPA/AGPA missing principal relation is visible and selectable, persists on reload, and unblocks actual Word downloads; desktop/mobile verified.');
} finally {
  if (browser) await browser.close();
  server.kill();
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected test directory.');
  await rm(directory, { recursive: true, force: true });
}
