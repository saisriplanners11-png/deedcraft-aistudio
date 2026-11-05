import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { enclosureFixture } from './repeated-enclosures-fixtures.mjs';

const directory = await mkdtemp(join(tmpdir(), 'deedcraft-repeat-browser-'));
const origin = 'http://127.0.0.1:5197';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5197', '--strictPort'], { cwd: new URL('../', import.meta.url), env: { ...process.env, TEMPLATE_STORAGE_BACKEND: 'disk', TEMPLATE_STORAGE_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
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
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(60000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const trace = [];
  const uploaded = enclosureFixture('upload', 3);
  await page.route('**/api/anthropic/v1/messages', async route => {
    const body = route.request().postDataJSON();
    const text = body.messages[0].content.filter(part => part.type === 'text').map(part => part.text).join('\n');
    const fixture = uploaded.find(record => text.includes(`EVIDENCE-${record.values.linkOption}-3`));
    const schema = body.tools[0].input_schema.properties;
    trace.push({ fixture: fixture?.values.linkOption, pages: !!schema.pages, fields: schema.candidates?.items?.properties?.field?.enum });
    let data;
    if (schema.pages) data = { pages: [...new Set([...text.matchAll(/SOURCE PAGE (\d+):/g)].map(match => Number(match[1])))].map(number => ({ number, text, kind: 'deed', drawing: false })) };
    else {
      const fields = schema.candidates.items.properties.field.enum;
      data = { candidates: Object.entries(fixture?.values || {}).filter(([field]) => fields.includes(field)).map(([field, value]) => ({ field, value, role: 'link', record: 'primary', quote: `${field}: ${value}`, region: 'Printed source label', page: 0, historical: false, handwritten: false })), plan: null, notes: [] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'repeat-test', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'tool_use', id: 'repeat-tool', name: 'record_transcription', input: data }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }) });
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { newDraft } = await import('/source-draft.ts');
    const { saveDeed } = await import('/saved-deeds.ts');
    const draft = newDraft(); draft.step = 1;
    draft.manual = { 'property|primary|category': 'Open Place', 'property|primary|unit': 'Sq. Yards', 'claimant|primary|claimantName': 'REPEATED ENCLOSURES QA' };
    await saveDeed({ id: draft.id, updatedAt: new Date().toISOString(), claimantNames: ['REPEATED ENCLOSURES QA'], deedType: 'Sale', draft, sourceFiles: {}, planDrafts: {}, referencePlanDrafts: {}, selectedPlanSvgs: {}, extraPartyRecords: { executant: [], claimant: [] }, templateMode: 'built-in', customTemplate: null });
  });
  await page.reload(); await page.getByRole('button', { name: 'Continue / Edit' }).first().click();
  await page.getByRole('button', { name: '+ Add / upload document', exact: true }).click();
  const options = await page.evaluate(async () => {
    const { TITLE_SECTION_IDS, LINK_OPTIONS } = await import('/fields.ts');
    return TITLE_SECTION_IDS.map(id => LINK_OPTIONS.find(option => option.id === id));
  });
  for (const option of options) await page.locator('.picker-tile').filter({ hasText: option.label }).click();
  await page.getByRole('button', { name: 'Continue with 8 documents', exact: true }).click();
  for (const option of options) {
    const cards = page.locator(`[data-title-point="${option.id}"]`);
    for (const index of [1, 2]) {
      if (index === 2) await page.getByRole('button', { name: '+ Add another ' + option.label, exact: true }).click();
      const values = enclosureFixture('manual', index).find(record => record.values.linkOption === option.id).values;
      for (const field of option.fields.filter(field => !field.hidden && values[field.id] && !field.derived)) await cards.nth(index - 1).getByLabel(field.label, { exact: false }).fill(values[field.id]);
    }
    await page.getByRole('button', { name: '+ Add another ' + option.label, exact: true }).click();
    console.log('Checking upload', option.id);
    const record = uploaded.find(record => record.values.linkOption === option.id);
    const text = `EVIDENCE-${option.id}-3\n` + Object.entries(record.values).map(([key, value]) => `${key}: ${value}`).join('\n');
    await cards.nth(2).locator('input[type=file]').first().setInputFiles({ name: `${option.id}-3.txt`, mimeType: 'text/plain', buffer: Buffer.from(text) });
    const primaryField = option.fields.find(field => !field.hidden && !field.derived && record.values[field.id]);
    await page.waitForFunction(({ id, label, value }) => {
      const card = [...document.querySelectorAll(`[data-title-point="${id}"]`)][2];
      return [...card.querySelectorAll('input')].some(input => input.value === value);
    }, { id: option.id, label: primaryField.label, value: record.values[primaryField.id] }, { timeout: 30000 }).catch(async error => {
      console.log(JSON.stringify(trace));
      console.log((await cards.nth(2).innerText()).slice(0, 1800));
      console.log(await page.evaluate(async () => { const { listSavedDeeds } = await import('/saved-deeds.ts'); return (await listSavedDeeds())[0]?.draft.sources; }));
      throw error;
    });
    await page.waitForFunction(() => !document.querySelector('.document-upload[aria-busy="true"]'));
    const close = page.getByRole('button', { name: 'Close', exact: true }); if (await close.isVisible()) await close.click();
    assert.equal(await cards.count(), 3, option.id);
    for (const index of [1, 2]) {
      const value = enclosureFixture('manual', index).find(record => record.values.linkOption === option.id).values[primaryField.id];
      assert.equal(await cards.nth(index - 1).getByLabel(primaryField.label, { exact: false }).inputValue(), value);
    }
  }
  await page.waitForFunction(async () => {
    const { listSavedDeeds } = await import('/saved-deeds.ts');
    const saved = (await listSavedDeeds())[0];
    return saved?.draft.sources.length === 8 && Object.values(saved.draft.manual).includes('PERMIT-manual-2');
  });
  await page.reload(); await page.getByRole('button', { name: 'Continue / Edit' }).first().click();
  for (const option of options) assert.equal(await page.locator(`[data-title-point="${option.id}"]`).count(), 3);
  const removedIds = [];
  for (const id of ['landLayoutLrs', 'houseTax']) {
    const cards = page.locator(`[data-title-point="${id}"]`);
    const retainedIds = [await cards.nth(0).getAttribute('data-record-id'), await cards.nth(2).getAttribute('data-record-id')];
    removedIds.push(await cards.nth(1).getAttribute('data-record-id'));
    await cards.nth(1).getByRole('button', { name: /Delete .* details/ }).click();
    assert.equal(await cards.count(), 2);
    assert.deepEqual(await cards.evaluateAll(cards => cards.map(card => card.getAttribute('data-record-id'))), retainedIds);
    const fieldId = id === 'houseTax' ? 'houseTaxReceiptNo' : 'vltNo';
    const label = options.find(option => option.id === id).fields.find(field => field.id === fieldId).label;
    assert.equal(await cards.nth(1).getByLabel(label, { exact: false }).inputValue(), uploaded.find(record => record.values.linkOption === id).values[fieldId]);
  }
  await page.waitForFunction(async ids => {
    const { listSavedDeeds } = await import('/saved-deeds.ts');
    const saved = (await listSavedDeeds())[0];
    return saved.draft.sources.length === 8 && ids.every(id => !Object.keys(saved.draft.manual).some(key => key.startsWith('link|' + id + '|')));
  }, removedIds);
  await mkdir('tmp/repeated-enclosures-qa', { recursive: true });
  await page.locator('[data-title-point="landLayoutLrs"]').first().screenshot({ path: 'tmp/repeated-enclosures-qa/independent-land-card.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: all eight Step 2 options accept two independent manual cards plus an uploaded third record; save/reopen preserves all cards and deleting a middle tax/land card keeps both neighbours and their uploads.');
} finally {
  if (browser) await browser.close();
  server.kill();
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep) || !directory.includes('deedcraft-repeat-browser-')) throw new Error('Unexpected test directory.');
  await rm(directory, { recursive: true, force: true });
}
