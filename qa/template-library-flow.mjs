import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';

const directory = await mkdtemp(join(tmpdir(), 'deedcraft-library-browser-'));
const port = 5197;
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: new URL('../', import.meta.url), env: { ...process.env, TEMPLATE_STORAGE_BACKEND: 'disk', TEMPLATE_STORAGE_DIR: directory, TEMPLATE_ADMIN_PASSWORD: 'browser-test-password' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let logs = ''; child.stdout.on('data', chunk => { logs += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error('Test server exited: ' + logs);
    try { if ((await fetch(origin + '/api/templates')).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 200));
  }
  assert.ok(ready, 'Test server did not become ready: ' + logs);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const admin = await browser.newContext(); const client = await browser.newContext();
  const page = await admin.newPage(); const customer = await client.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message)); customer.on('pageerror', error => errors.push(error.message));
  await customer.goto(origin);
  await customer.getByRole('button', { name: /New deed/ }).first().click();
  await customer.locator('.template-context summary').click();
  await customer.locator('.template-context strong').filter({ hasText: 'sale-deed-template-v6.docx' }).waitFor();
  const oldPin = await customer.evaluate(async () => {
    const { listSavedDeeds } = await import('/saved-deeds.ts');
    for (let i = 0; i < 50; i++) {
      const deeds = await listSavedDeeds();
      if (deeds[0]?.libraryTemplate) return deeds[0].libraryTemplate.versionId;
      await new Promise(done => setTimeout(done, 100));
    }
    throw new Error('New deed was not saved with a template pin.');
  });
  assert.equal(oldPin, 'sale-deed-v6');
  await page.goto(origin);
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByLabel('Administrator password').fill('browser-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Upload revised Word template', exact: true }).waitFor();
  const runtime = await loadTemplateRuntime();
  const entries = await runtime.readZip(await readFile(new URL('../sale-deed-template-v6.docx', import.meta.url)));
  const document = entries.find(item => item.name === 'word/document.xml');
  document.data = new TextEncoder().encode(new TextDecoder().decode(document.data).replace('<w:body>', '<w:body><w:p><w:r><w:rPr><w:sz w:val="30"/></w:rPr><w:t>Maintenance charges of &lt;Maintenance Amount&gt; start on &lt;Maintenance Start Date&gt;.</w:t></w:r></w:p><w:p><w:r><w:t>Warranty note: &lt;Warranty Note&gt;. Access note: &lt;Access Note&gt;. Vendor consent: &lt;Vendor Consent&gt;.</w:t></w:r></w:p>'));
  const bytes = await runtime.writeZip(entries);
  await page.locator('.template-library input[type=file]').setInputFiles({ name: 'revised-library.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
  const card = page.locator('.template-panel').filter({ has: page.getByRole('heading', { level: 2, name: 'revised-library.docx', exact: true }) });
  await card.getByRole('button', { name: 'Configure fields', exact: true }).click();
  await card.getByRole('button', { name: 'Delete revision', exact: true }).click();
  await card.getByRole('button', { name: 'Cancel deletion', exact: true }).click();
  assert.equal(await card.count(), 1);
  await card.getByRole('button', { name: 'Delete revision', exact: true }).click();
  await card.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await page.getByText('Revision moved to Trash. The active template is unchanged.', { exact: true }).waitFor();
  assert.equal(await card.count(), 0);
  await page.getByText('Trash (1)', { exact: true }).click();
  await page.getByRole('button', { name: 'Restore revision', exact: true }).click();
  await card.getByRole('button', { name: 'Configure fields', exact: true }).click();
  const warranty = card.locator('fieldset').filter({ has: page.locator('legend').filter({ hasText: 'Warranty Note' }) });
  await warranty.getByRole('checkbox', { name: /Required when/ }).uncheck();
  for (const name of ['Maintenance Amount', 'Maintenance Start Date', 'Warranty Note']) {
    await card.getByLabel(`${name} dashboard step`, { exact: true }).selectOption('property-schedules');
    await card.getByLabel(`${name} section`, { exact: true }).selectOption(name === 'Warranty Note' ? 'flat-particulars' : 'property-identification');
    await card.getByLabel(`${name} position`, { exact: true }).selectOption(name === 'Warranty Note' ? 'after:flatNo' : name === 'Maintenance Amount' ? 'after:plotNo' : 'before:plotNo');
  }
  for (const [name, scope] of [['Access Note', 'property'], ['Vendor Consent', 'vendor']]) {
    const field = card.locator('fieldset').filter({ has: page.locator('legend').filter({ hasText: name }) });
    await field.getByRole('checkbox', { name: /Required when/ }).uncheck();
    if (name === 'Vendor Consent') await card.getByLabel(`${name} field type`, { exact: true }).selectOption('boolean');
    await card.getByLabel(`${name} scope`, { exact: true }).selectOption(scope);
    await card.getByLabel(`${name} dashboard step`, { exact: true }).selectOption('executant-details');
    await card.getByLabel(`${name} section`, { exact: true }).selectOption('executant-personal');
    await card.getByLabel(`${name} position`, { exact: true }).selectOption('after:executantName');
  }
  await card.getByRole('button', { name: 'Save field configuration', exact: true }).click();
  await page.getByText('Field configuration saved. Revalidate and rebuild samples, then review them before publishing.', { exact: true }).waitFor();
  await card.getByRole('button', { name: 'Revalidate and rebuild samples', exact: true }).click();
  await card.getByText('Structural validation passed', { exact: true }).waitFor();
  await card.locator('.template-samples a').first().waitFor();
  const screenshots = fileURLToPath(new URL('../tmp/template-library-qa/', import.meta.url));
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: join(screenshots, 'library.png'), fullPage: true });
  assert.equal(await card.locator('.template-samples a').count(), 9);
  assert.equal(await card.getByRole('button', { name: 'Publish version', exact: true }).isDisabled(), true);
  const download = page.waitForEvent('download');
  await card.getByRole('link', { name: 'Sample: Multiple parties and properties', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'SAMPLE-multiple.docx');
  await card.getByRole('checkbox', { name: /I reviewed every sample/ }).check();
  await card.getByRole('button', { name: 'Publish version', exact: true }).click();
  await page.getByText('Published. New and saved deeds will use this version.', { exact: true }).waitFor();
  assert.equal(await card.getByRole('button', { name: 'Delete revision', exact: true }).count(), 0);
  const active = (await (await fetch(origin + '/api/templates')).json()).active.sale;
  assert.notEqual(active, oldPin);
  await customer.reload();
  await customer.getByRole('button', { name: 'Continue / Edit', exact: true }).click();
  await customer.locator('.template-context summary').click();
  await customer.locator('.template-context strong').filter({ hasText: 'revised-library.docx' }).waitFor();
  // A customer has not opened Templates: placement styles must already be loaded.
  await customer.getByRole('button', { name: /^01\s*Deed setup/ }).click();
  for (const width of [1280, 900, 390]) {
    await customer.setViewportSize({ width, height: 900 });
    const layout = await customer.evaluate(() => {
      const fields = [...document.querySelectorAll('.setup-fields > .setup-field')].map(field => field.getBoundingClientRect());
      const property = document.querySelector('.setup-step .field');
      const label = property.querySelector('span').getBoundingClientRect();
      const select = property.querySelector('select').getBoundingClientRect();
      return {
        slots: [...document.querySelectorAll('.template-placement-slot')].map(slot => getComputedStyle(slot).display),
        sameRow: Math.abs(fields[0].top - fields[1].top) < 1,
        stacked: fields[1].top > fields[0].bottom,
        labelAligned: Math.abs(label.left - select.left) < 1,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert(layout.slots.length > 0);
    assert(layout.slots.every(display => display === 'contents'), `Placement hosts consume cells at ${width}px`);
    assert(width > 620 ? layout.sameRow : layout.stacked, `Setup fields misaligned at ${width}px`);
    assert(layout.labelAligned, `Property label misaligned at ${width}px`);
    assert.equal(layout.overflow, false, `Page overflows at ${width}px`);
    assert.equal(await customer.locator('.template-placement-fallback').isVisible(), false);
  }
  await customer.setViewportSize({ width: 1280, height: 900 });
  await customer.getByRole('button', { name: /^04\s*Property Schedules/ }).click();
  await customer.locator('[aria-label="Schedule 1 property type"] select').selectOption({ label: 'Vacant Plot' });
  await customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }).waitFor();
  assert.equal(await customer.getByRole('heading', { name: 'Additional template fields', exact: true }).count(), 0);
  await customer.locator('.template-placement-fallback').getByLabel('Whole deed — Warranty Note', { exact: true }).waitFor();
  assert(await customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }).evaluate(input => {
    const grid = input.closest('.deed-field-grid');
    const plot = [...grid.querySelectorAll('label')].find(label => label.textContent.includes('Plot number'));
    return !!plot && !!(plot.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING);
  }));
  const contract = (await (await fetch(origin + '/api/templates')).json()).versions.find(item => item.id === active).fieldContract;
  await customer.route('**/api/anthropic/v1/messages', async route => {
    const body = route.request().postDataJSON();
    const ids = body.tools[0].input_schema.properties.candidates.items.properties.field.enum;
    const values = { 'Vendor Consent': ['false', 'Vendor consent: false'], 'Maintenance Amount': ['2500', 'Maintenance amount: 2500'], 'Maintenance Start Date': ['2026-11-01', 'Maintenance start: 2026-11-01'] };
    const candidates = contract.fields.filter(field => ids.includes(field.id) && values[field.placeholder]).map(field => ({ field: field.id, value: values[field.placeholder][0], quote: values[field.placeholder][1], region: 'Printed label', role: 'property', record: 'primary', historical: false, handwritten: false }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'fixture', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'tool_use', id: 'fixture', name: 'record_transcription', input: { candidates } }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }) });
  });
  await customer.locator('.placed-template-field').filter({ has: customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }) }).locator('summary').click();
  await customer.locator('.placed-template-field input[type=file]').first().setInputFiles({ name: 'maintenance.txt', mimeType: 'text/plain', buffer: Buffer.from('Maintenance amount: 2500\nMaintenance start: 2026-11-01') });
  await customer.getByText('2 proposed values need your review.', { exact: true }).waitFor();
  assert.equal(await customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }).inputValue(), '');
  for (const name of ['Maintenance Amount', 'Maintenance Start Date']) {
    const field = customer.locator('.placed-template-field').filter({ has: customer.getByLabel(`Whole deed — ${name}`, { exact: true }) });
    if (await field.locator('details').getAttribute('open') === null) await field.locator('summary').click();
    await field.getByRole('button', { name: 'Accept value', exact: true }).click();
  }
  assert.equal(await customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }).inputValue(), '2,500');
  await customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }).fill('3000');
  await customer.getByRole('button', { name: 'Clear manual override and use reviewed evidence', exact: true }).click();
  assert.equal(await customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }).inputValue(), '2,500');
  await customer.screenshot({ path: join(screenshots, 'placed-fields-desktop.png'), fullPage: true });
  await customer.setViewportSize({ width: 390, height: 844 });
  assert(await customer.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile layout overflows horizontally.');
  await customer.screenshot({ path: join(screenshots, 'placed-fields-mobile.png'), fullPage: true });
  await customer.setViewportSize({ width: 1280, height: 900 });
  await customer.getByRole('button', { name: /^10\s*Generate Deed/ }).click();
  const deedDownload = customer.waitForEvent('download');
  await customer.getByRole('button', { name: 'Download Word 2007 deed (.docx)', exact: true }).click();
  const deedPath = join(screenshots, 'custom-fields-deed.docx'); await (await deedDownload).saveAs(deedPath);
  const generatedText = await runtime.docxToText(new Uint8Array(await readFile(deedPath)));
  assert(generatedText.includes('Maintenance charges of 2,500 start on 01-11-2026.'));
  assert(generatedText.includes('Warranty note: ____.'));
  assert(!generatedText.includes('\uE100'));
  await customer.getByRole('button', { name: 'Saved deeds', exact: true }).click(); await customer.reload();
  await customer.getByRole('button', { name: 'Continue / Edit', exact: true }).first().click();
  await customer.getByRole('button', { name: /^04\s*Property Schedules/ }).click();
  assert.equal(await customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }).inputValue(), '2,500');
  const restoredField = customer.locator('.placed-template-field').filter({ has: customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }) });
  await restoredField.locator('summary').click();
  await customer.getByRole('button', { name: 'Remove evidence source', exact: true }).first().click();
  assert.equal(await customer.getByLabel('Whole deed — Maintenance Amount', { exact: true }).inputValue(), '');
  await customer.getByRole('button', { name: /^10\s*Generate Deed/ }).click();
  assert.equal(await customer.getByRole('button', { name: 'Download Word 2007 deed (.docx)', exact: true }).isDisabled(), true);
  await customer.getByRole('button', { name: 'New deed', exact: false }).first().click();
  await customer.locator('.template-context summary').click();
  await customer.locator('.template-context strong').filter({ hasText: 'revised-library.docx' }).waitFor();
  await customer.getByRole('button', { name: /^04\s*Property Schedules/ }).click();
  await customer.getByRole('button', { name: '+ Add another property', exact: true }).click();
  await customer.getByRole('button', { name: /^01\s*Deed setup/ }).click();
  await customer.locator('[aria-label="Schedule 2 property type"] select').selectOption({ label: 'Vacant Plot' });
  await customer.getByRole('button', { name: /^07\s*Executant Details/ }).click();
  await customer.getByLabel('Property 1 — Access Note', { exact: true }).fill('Property one');
  await customer.getByLabel('Property 2 — Access Note', { exact: true }).fill('Property two');
  await customer.locator('.party-record-card').first().getByLabel('Vendor 1 — Vendor Consent', { exact: true }).selectOption('true');
  await customer.getByRole('button', { name: 'Add blank executant instead', exact: true }).click();
  await customer.locator('.party-record-card').nth(1).getByLabel('Vendor 2 — Vendor Consent', { exact: true }).selectOption('false');
  assert.equal(await customer.getByLabel('Property 1 — Access Note', { exact: true }).count(), 1);
  assert.equal(await customer.getByLabel('Property 2 — Access Note', { exact: true }).count(), 1);
  assert.equal(await customer.getByLabel('Property 1 — Access Note', { exact: true }).inputValue(), 'Property one');
  assert.equal(await customer.getByLabel('Vendor 1 — Vendor Consent', { exact: true }).inputValue(), 'true');
  const primaryConsent = customer.locator('.party-record-card').first().locator('.placed-template-field').filter({ has: customer.getByLabel('Vendor 1 — Vendor Consent', { exact: true }) });
  await primaryConsent.getByRole('button', { name: 'Clear manual override and use reviewed evidence', exact: true }).click();
  await primaryConsent.locator('summary').click();
  await primaryConsent.locator('input[type=file]').setInputFiles({ name: 'consent.txt', mimeType: 'text/plain', buffer: Buffer.from('Vendor consent: false') });
  await customer.getByText('1 proposed values need your review.', { exact: true }).waitFor();
  assert.equal(await customer.getByLabel('Vendor 1 — Vendor Consent', { exact: true }).inputValue(), '');
  await primaryConsent.getByRole('button', { name: 'Accept value', exact: true }).click();
  assert.equal(await customer.getByLabel('Vendor 1 — Vendor Consent', { exact: true }).inputValue(), 'false');
  assert.equal(await customer.getByLabel('Vendor 2 — Vendor Consent', { exact: true }).inputValue(), 'false');
  await customer.getByLabel('Property 2 — Access Note', { exact: true }).focus();
  await customer.keyboard.press('Tab');
  assert(await customer.evaluate(() => document.activeElement !== document.body));
  await customer.screenshot({ path: join(screenshots, 'cross-scope-fields.png'), fullPage: true });
  await customer.getByRole('button', { name: /^09\s*Reverify/ }).click();
  await customer.getByRole('region', { name: 'Configured template fields' }).getByText('Property two', { exact: true }).waitFor();
  assert.equal(await customer.locator('.template-field-summary input').count(), 0);
  await card.getByRole('link', { name: 'Download Word', exact: true }).waitFor();
  const seeded = page.locator('.template-panel').filter({ has: page.getByRole('heading', { name: 'sale-deed-template-v6.docx', exact: true }) });
  await seeded.getByRole('button', { name: 'Restore this published version', exact: true }).click();
  await page.getByText('Previous version activated for new deeds.', { exact: true }).waitFor();
  assert.equal((await (await fetch(origin + '/api/templates')).json()).active.sale, oldPin);
  // Vite must not expose storage through its static file mechanism.
  const storageResponse = await fetch(origin + '/@fs/' + join(directory, 'library.json').replace(/\\/g, '/'));
  assert.equal(storageResponse.status, 403);
  assert.deepEqual(errors, []);
  console.log('Template field configuration, samples, publishing, scoped AI proposals, explicit review, Word generation, optional blanks, save/reopen, source removal, rollback and storage access passed.');
} finally {
  if (browser) await browser.close();
  child.kill();
  if (child.exitCode === null) await new Promise(done => child.once('exit', done));
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected test directory.');
  await rm(directory, { recursive: true, force: true });
}
