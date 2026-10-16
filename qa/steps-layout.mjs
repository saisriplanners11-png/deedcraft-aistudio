import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const out = new URL('../tmp/steps-layout/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const bytes = await readFile(new URL('../sale-deed-template-v6.docx', import.meta.url));
  const version = { id: 'layout-v6', filename: 'Sale deed v6', instrumentId: 'sale', hash: createHash('sha256').update(bytes).digest('hex') };
  await page.route('**/api/templates', route => route.fulfill({ json: { active: { sale: version.id }, versions: [version] } }));
  await page.route('**/api/templates/versions/*/download', route => route.fulfill({ body: bytes, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5198');
  await page.getByRole('button', { name: 'Create your first deed' }).click();
  await page.locator('.rail-step').first().click();
  await page.getByLabel('What is this property?').selectOption('Residential');
  const instrument = page.locator('.setup-fields select').first();
  await instrument.selectOption('gift');
  assert.match(await page.locator('.setup-reference').innerText(), /Legal reference required/);
  await instrument.selectOption('sale');
  assert.match(await page.locator('.setup-reference').innerText(), /Approved reference available/);
  const rects = await page.locator('.setup-fields select').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
  assert.equal(rects[0].top, rects[1].top, 'Setup controls must share a baseline');
  assert.equal(rects[0].width, rects[1].width);
  const capture = async name => page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true });
  await capture('step1-desktop.png');
  await page.locator('.rail-step').nth(1).click();
  await capture('step2-empty-desktop.png');
  await page.getByRole('button', { name: '+ Add / upload document', exact: true }).click();
  await capture('step2-picker-desktop.png');
  await page.locator('.document-picker .picker-tile').first().click();
  await page.locator('.document-picker .primary').click();
  const card = page.locator('[data-title-point=linkDoc]');
  await card.waitFor();
  const input = card.getByRole('textbox', { name: /document number/i });
  await input.fill('LAYOUT-123');
  await capture('step2-filled-desktop.png');
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const step of [0, 1]) {
      if (width <= 900) await page.locator('#mobile-step').selectOption(String(step));
      else await page.locator('.rail-step').nth(step).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Step ${step + 1} overflows at ${width}px`);
      const controls = await page.locator('.setup-step select,.documents-step .deed-field input').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
      assert(controls.every(rect => rect.width > 80 && rect.height >= 36));
      if (width === 375) await capture(`step${step + 1}-mobile.png`);
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.locator('#mobile-step').selectOption('0');
  await capture('step1-dark-mobile.png');
  await page.locator('#mobile-step').selectOption('1');
  await capture('step2-dark-mobile.png');
  assert.equal(await input.inputValue(), 'LAYOUT-123');
  assert.deepEqual(errors, []);
  console.log('PASS: aligned setup fields, instrument changes, document selection and editing, responsive layouts at 320–1440px, light/dark screenshots.');
} finally {
  await browser.close();
}
