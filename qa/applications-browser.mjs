import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const origin = process.env.BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(origin);
  await page.getByRole('heading', { name: 'Start a draft' }).waitFor();
  await page.getByRole('link', { name: /^Applications/ }).click();
  await page.getByRole('heading', { name: /Certified Copy \/ Personal Search/ }).waitFor();
  const applicant = page.getByRole('textbox', { name: 'From — Name & Address' });
  assert.equal(await applicant.inputValue(), '');
  await applicant.fill('TEST APPLICANT');
  await page.getByRole('button', { name: 'Save Application', exact: true }).click();
  await page.getByLabel('Reference Title').fill('Application QA Draft');
  await page.getByRole('button', { name: 'Confirm Save' }).click();
  await page.getByRole('button', { name: 'Status Report (1)' }).click();
  const status = page.getByLabel('Status for Application QA Draft');
  await status.selectOption('complete');
  await page.getByText('Complete', { exact: true }).first().waitFor();

  await page.reload();
  await page.getByRole('button', { name: 'Status Report (1)' }).click();
  assert.equal(await status.inputValue(), 'complete');
  await page.getByRole('button', { name: 'Saved Entries', exact: true }).click();
  await page.getByRole('button', { name: 'Load Form' }).click();
  assert.equal(await applicant.inputValue(), 'TEST APPLICANT');

  async function checkPrint(title) {
    await page.getByRole('heading', { name: title, level: 1 }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'Mobile form must fit the viewport');
    const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
    assert.equal(pdf.getPageCount(), 1);
    const { width, height } = pdf.getPage(0).getSize();
    assert.ok(Math.abs(width - 595) < 2 && Math.abs(height - 842) < 2, 'Print output should be A4');
  }
  await checkPrint(/Certified Copy \/ Personal Search/);
  await page.getByRole('button', { name: 'Market Value', exact: true }).click();
  await checkPrint(/Open Plot \/ House Site/);
  await page.getByLabel('Property Type').selectOption('mvHouse');
  await checkPrint(/House & Plinth Area/);
  await page.getByRole('button', { name: 'EC Application', exact: true }).click();
  await checkPrint(/Application for Encumbrance Certificate/);
  await page.getByRole('button', { name: 'Stamp Indent', exact: true }).click();
  await checkPrint(/Indent for Stamps/);

  const invalidUpload = await page.request.post(new URL('/api/applications/extract', origin).href, { data: {} });
  assert.equal(invalidUpload.status(), 400);
  await page.route('**/api/applications/extract', async route => {
    assert.equal(route.request().postDataJSON().targetForm, 'indent');
    await route.fulfill({ json: { formType: 'indent', fields: { purchaserDetails: 'TEST AI PURCHASER' } } });
  });
  await page.getByRole('button', { name: 'Upload & AI Fill' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await page.getByRole('status').filter({ hasText: 'synthetic.pdf' }).waitFor();
  assert.ok(await page.getByRole('textbox').evaluateAll(inputs => inputs.some(input => input.value === 'TEST AI PURCHASER')));

  await page.getByRole('link', { name: 'Draft options' }).click();
  await page.getByRole('button', { name: /^Documents/ }).click();
  await page.getByRole('heading', { name: 'Deed setup' }).waitFor();
  assert.deepEqual(pageErrors, []);
  console.log('PASS: draft options, all five A4 forms on mobile, application save/reload/status, mocked AI autofill, and deed setup.');
} finally {
  await browser.close();
}
