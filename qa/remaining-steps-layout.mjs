import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const out = new URL('../tmp/remaining-steps/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.log('Browser error:', error.message); });
  const bytes = await readFile(new URL('../sale-deed-template-v6.docx', import.meta.url));
  const version = { id: 'compact-v6', filename: 'Sale deed v6', instrumentId: 'sale', hash: createHash('sha256').update(bytes).digest('hex') };
  await page.route('**/api/templates', route => route.fulfill({ json: { active: { sale: version.id }, versions: [version] } }));
  await page.route('**/api/templates/versions/*/download', route => route.fulfill({ body: bytes, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5198');
  await page.getByRole('button', { name: 'Create your first deed' }).click();
  const go = async step => {
    if (page.viewportSize().width <= 900) await page.locator('#mobile-step').selectOption(String(step));
    else await page.locator('.rail-step').nth(step).click();
    await page.locator(`.workflow-step-${step}`).waitFor();
    if (step === 10) await page.frameLocator('iframe[title="Property Plan — Exact Reference"]').locator('#input-survey-no').waitFor();
  };
  await page.locator('.rail-step').first().click();
  await page.getByLabel('What is this property?').selectOption('Residential');
  const capture = async name => page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true });
  await go(4);
  await page.getByRole('textbox', { name: /sale consideration/i }).fill('1000000');
  await go(5);
  await page.getByRole('button', { name: '+ Cash', exact: true }).click();
  const payment = page.locator('.payment-record').last();
  await payment.getByRole('textbox', { name: 'Amount (₹)', exact: true }).fill('1000');
  for (const step of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    await go(step);
    await capture(`step${step + 1}-desktop.png`);
  }
  const frame = page.frameLocator('iframe[title="Property Plan — Exact Reference"]');
  await frame.locator('#input-survey-no').waitFor();
  await frame.locator('#input-survey-no').fill('PLAN/123');
  await page.getByRole('button', { name: 'Review and refresh from deed', exact: true }).click();
  await page.locator('.plan-refresh-review').waitFor();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (let step = 2; step <= 10; step++) {
      await go(step);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Step ${step + 1} overflows at ${width}px`);
      const rects = await page.locator('.workflow-step .deed-field :is(input,select,textarea)').evaluateAll(nodes => nodes.map(node => ({ ...node.getBoundingClientRect().toJSON(), fontSize: parseFloat(getComputedStyle(node).fontSize) })));
      assert(rects.every(rect => rect.width > 80 && rect.height >= 36 && rect.fontSize <= 14), `Compact fields missing at step ${step + 1}, width ${width}`);
      if (width === 375 && [2, 5, 6, 8, 9, 10].includes(step)) await capture(`step${step + 1}-mobile.png`);
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await go(6);
  await page.getByRole('combobox', { name: /party type/i }).selectOption('Company');
  await page.getByRole('button', { name: '+ Add representative', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Company representative overflows');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await capture('company-dark-mobile.png');
  await go(9);
  await page.getByRole('radio', { name: /my template/i }).check();
  await page.getByRole('button', { name: 'Upload .docx template', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await capture('download-custom-dark-mobile.png');
  await go(5);
  assert.equal(await page.locator('.payment-record').last().getByRole('textbox', { name: 'Amount (₹)', exact: true }).inputValue(), '1,000');
  assert.deepEqual(errors, []);
  console.log('PASS: all remaining steps at 320–1440px, compact fields, payment editing, entity representatives, custom-template controls, plan iframe, light/dark screenshots.');
} catch (error) {
  if (page) await page.screenshot({ path: fileURLToPath(new URL('failure.png', out)), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
