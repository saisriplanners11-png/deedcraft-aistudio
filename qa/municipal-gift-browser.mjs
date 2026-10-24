import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5209');
  await page.getByRole('button', { name: 'Create your first deed' }).click();
  await page.getByRole('button', { name: /01\s*Deed setup/ }).click();
  await page.getByLabel(/Deed type/).selectOption('gift');
  await expect(page.getByRole('region', { name: 'Gift relationship' })).toBeVisible();
  await page.getByLabel(/Draft form/).selectOption({ label: 'Gift to Local Bodies' });
  await expect(page.getByRole('region', { name: 'Gift relationship' })).toHaveCount(0);
  const property = page.getByLabel('What is this property?');
  assert.equal(await property.locator('option').count(), 5);
  await property.selectOption('Open Place');
  await page.getByRole('button', { name: /Jurisdiction/ }).click();
  await page.getByLabel('Village', { exact: true }).fill('MUNICIPAL BROWSER VILLAGE');
  await page.locator('.rail-step').filter({ hasText: 'Property Schedules' }).click();
  await page.getByLabel(/ULB \/ municipality/).selectOption('Municipal Council');
  await page.getByRole('button', { name: /Claimant Details/ }).click();
  await expect(page.getByRole('region', { name: 'Municipal donee' })).toContainText('Municipal Council, MUNICIPAL BROWSER VILLAGE');
  await expect(page.getByRole('region', { name: 'Municipal donee' }).locator('input')).toHaveCount(0);
  await page.getByRole('button', { name: 'Saved deeds', exact: true }).click();
  // Seed verified source facts to exercise the same stored-draft download path without AI calls.
  await page.evaluate(async () => {
    const { listSavedDeeds, saveDeed } = await import('/saved-deeds.ts');
    const deed = (await listSavedDeeds())[0];
    Object.assign(deed.draft.manual, {
      'executant|primary|executantName': 'MUNICIPAL BROWSER DONOR',
      'property|primary|executionDate': '2026-10-24',
      'property|primary|extentSqYards': '100',
      'link|title-primary|linkOption': 'linkDoc',
      'link|title-primary|linkDocType': 'Sale Deed',
      'link|title-primary|linkDocNo': 'BROWSER-TITLE-42',
      'link|title-primary|linkDocDate': '2020-01-02',
      'link|title-primary|linkSro': 'BROWSER TITLE OFFICE',
      'link|title-primary|linkSroCode': '42',
    });
    await saveDeed(deed);
  });
  await page.reload();
  await expect(page.locator('.saved-deed-card')).toContainText('Municipal Gift v1');
  await page.getByRole('button', { name: 'Continue / Edit', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Municipal donee' })).toContainText('Municipal Council, MUNICIPAL BROWSER VILLAGE');
  await page.screenshot({ path: 'tmp/municipal-gift/qa/municipal-donee.png', fullPage: true });
  await page.getByRole('button', { name: /Generate Deed/ }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Word 2007 deed (.docx)', exact: true }).click();
  const download = await downloaded;
  assert.match(download.suggestedFilename(), /^Municipal-Gift-Municipal-Council/);
  const rt = await loadTemplateRuntime();
  const text = await rt.docxToText(new Uint8Array(await readFile(await download.path())));
  for (const value of ['MUNICIPAL BROWSER DONOR', 'Municipal Council, MUNICIPAL BROWSER VILLAGE', 'BROWSER-TITLE-42', '02-01-2020', 'BROWSER TITLE OFFICE (42)']) assert.ok(text.includes(value), value);
  assert.doesNotMatch(text, /natural love|FAMILY MEMBER|<ULB>|<VILLAGE>/);
  // Switching back restores the unchanged regular Gift default and relationship flow.
  await page.getByRole('button', { name: /01\s*Deed setup/ }).click();
  await page.getByLabel(/Draft form/).selectOption({ label: 'Others' });
  await expect(page.getByLabel(/Draft form/)).toHaveValue('non-family-gift');
  await page.getByLabel(/Draft form/).selectOption('family-gift');
  await expect(page.getByRole('region', { name: 'Gift relationship' })).toBeVisible();
  await page.locator('.template-context summary').click();
  await expect(page.locator('.template-context')).toContainText('gift-deed-v4');
  assert.deepEqual(errors, []);
  await page.goto('about:blank');
  await page.close();
  console.log('PASS: Municipal Gift option, four land choices, automatic municipal recipient, saved reload, Word download with title facts, and regular Gift restoration.');
} finally { await browser.close(); }
