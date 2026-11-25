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
  await page.getByRole('button', { name: 'Print Preview', exact: true }).click();
  await page.getByRole('dialog', { name: 'Print Preview' }).getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByLabel('Reference Title').fill('Application QA Draft');
  await page.getByRole('button', { name: 'Confirm Save' }).click();
  await page.getByRole('button', { name: 'Back from print preview' }).click();
  await page.getByRole('button', { name: 'Status Report (1)' }).click();
  const status = page.getByLabel('Status for Application QA Draft');
  await status.selectOption('complete');
  await page.getByText('Complete', { exact: true }).first().waitFor();

  await page.reload();
  await page.getByRole('button', { name: 'Status Report (1)' }).click();
  assert.equal(await status.inputValue(), 'complete');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await applicant.waitFor();
  await page.getByRole('button', { name: 'Saved Entries', exact: true }).click();
  await page.getByRole('button', { name: 'Back from saved entries' }).click();
  await page.getByRole('button', { name: 'Saved Entries', exact: true }).click();
  await page.getByRole('button', { name: 'Load Form' }).click();
  assert.equal(await applicant.inputValue(), 'TEST APPLICANT');

  async function checkPrint(title) {
    await page.getByRole('heading', { name: title, level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Print Preview', exact: true }).click();
    await page.getByRole('dialog', { name: 'Print Preview' }).waitFor();
    await page.getByRole('button', { name: 'Back from print preview' }).click();
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
    const request = route.request().postDataJSON();
    if (request.targetForm === 'allA4') {
      assert.equal(request.files.length, 1);
      await route.fulfill({ json: {
        mode: 'allA4',
        marketValueMode: 'mvHouse',
        forms: {
          ccCopy: { fromNameAddress: 'COMBINED APPLICANT' },
          mvOpen: {},
          mvHouse: { plaintiffNameAddress: 'COMBINED PLAINTIFF' },
          ec: { applicantName: 'COMBINED EC APPLICANT' },
        },
      } });
      return;
    }
    assert.equal(request.targetForm, 'indent');
    assert.deepEqual(request.files.map(file => file.name), ['synthetic.pdf', 'page-two.pdf']);
    await route.fulfill({ json: { formType: 'indent', fields: { purchaserDetails: 'TEST AI PURCHASER' } } });
  });
  await page.getByRole('button', { name: 'Upload & AI Fill' }).click();
  await page.getByRole('button', { name: 'Back to form' }).click();
  await page.getByRole('button', { name: 'Upload & AI Fill' }).click();
  await page.getByRole('button', { name: 'Fill Only Stamp Indent' }).click();
  await page.locator('input[type=file]').setInputFiles(['synthetic.pdf', 'page-two.pdf'].map(name => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })));
  await page.getByRole('button', { name: 'Extract & Fill (2 files)' }).click();
  await page.getByRole('status').filter({ hasText: '2 files' }).waitFor();
  assert.ok(await page.getByRole('textbox').evaluateAll(inputs => inputs.some(input => input.value === 'TEST AI PURCHASER')));

  await page.getByRole('button', { name: 'Upload & AI Fill' }).click();
  await page.getByRole('button', { name: 'Fill CC, Market Value & EC' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'combined.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await page.getByRole('button', { name: 'Extract & Fill (1 file)' }).click();
  await page.getByRole('status').filter({ hasText: 'combined.pdf' }).waitFor();
  assert.equal(await applicant.inputValue(), 'COMBINED APPLICANT');
  await page.getByRole('button', { name: 'Market Value', exact: true }).click();
  await page.getByRole('heading', { name: /House & Plinth Area/, level: 1 }).waitFor();
  assert.ok(await page.getByRole('textbox').evaluateAll(inputs => inputs.some(input => input.value === 'COMBINED PLAINTIFF')));
  await page.getByRole('button', { name: 'EC Application', exact: true }).click();
  assert.ok(await page.getByRole('textbox').evaluateAll(inputs => inputs.some(input => input.value === 'COMBINED EC APPLICANT')));

  await page.evaluate(async () => {
    const { newDraft } = await import('/source-draft.ts');
    const { saveDeed } = await import('/saved-deeds.ts');
    const draft = newDraft();
    draft.propertyIds = ['primary', 'second'];
    draft.linkPropertyRecords = { deed2: 'second' };
    draft.manual = {
      'claimant|primary|claimantName': 'PICKER CLAIMANT',
      'claimant|primary|claimantMobile': '9000000001',
      'executant|primary|executantName': 'PICKER EXECUTANT',
      'property|primary|category': 'Open Place',
      'property|primary|village': 'FIRST VILLAGE',
      'property|primary|surveyNo': '111/1',
      'property|second|category': 'Residential',
      'property|second|village': 'SECOND VILLAGE',
      'property|second|surveyNo': '222/2',
      'property|second|plotNo': '45',
      'property|second|bearingHNo': '7-4-22',
      'property|second|extentSqYards': '120',
      'link|deed2|linkOption': 'linkDoc',
      'link|deed2|linkDocNo': '715/2024',
    };
    await saveDeed({
      id: draft.id, name: 'Picker Test Deed', deedType: 'Sale', draft,
      updatedAt: new Date().toISOString(), claimantNames: ['PICKER CLAIMANT'],
      sourceFiles: {}, planDrafts: {}, referencePlanDrafts: {}, selectedPlanSvgs: {},
      extraPartyRecords: { executant: [], claimant: [] }, templateMode: 'built-in', customTemplate: null,
    });
  });

  async function fillFromSavedDeed() {
    await page.getByRole('button', { name: 'Fill from Saved Deed', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Fill from a saved deed' });
    const search = picker.getByRole('searchbox', { name: 'Search saved deeds' });
    await search.fill('claimant no-match');
    await picker.getByText('No saved deeds match your search.').waitFor();
    await search.fill('picker 222/2 9000000001 715/2024');
    await picker.getByRole('radio', { name: /Picker Test Deed/ }).check();
    await picker.getByLabel('Property schedule').selectOption('second');
    await picker.getByRole('button', { name: 'Fill current form' }).click();
    await picker.waitFor({ state: 'hidden' });
  }

  await fillFromSavedDeed();
  assert.equal(await page.getByLabel('Name of the Applicant', { exact: true }).inputValue(), 'PICKER CLAIMANT');
  assert.equal(await page.getByLabel('Survey No.', { exact: true }).inputValue(), '222/2');
  await page.getByRole('button', { name: 'Certified Copy', exact: true }).click();
  await fillFromSavedDeed();
  assert.equal(await applicant.inputValue(), 'PICKER CLAIMANT');
  assert.equal(await page.getByLabel('Document No.', { exact: true }).inputValue(), '715/2024');
  await page.getByRole('button', { name: 'Market Value', exact: true }).click();
  for (const mode of ['mvOpen', 'mvHouse']) {
    await page.getByLabel('Property Type').selectOption(mode);
    await fillFromSavedDeed();
    assert.equal(await page.getByLabel('Plot.No/s.', { exact: true }).first().inputValue(), '45');
  }
  await page.getByRole('button', { name: 'Stamp Indent', exact: true }).click();
  await fillFromSavedDeed();
  assert.equal(await page.getByLabel('Purchaser Name', { exact: true }).inputValue(), 'PICKER CLAIMANT');

  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: /^Documents/ }).click();
  await page.getByRole('heading', { name: 'Deed setup' }).waitFor();
  const workflow = page.getByRole('navigation', { name: 'Deed steps' });
  await workflow.getByRole('button', { name: 'Expand deed steps' }).click();
  const steps = await workflow.locator('.workflow-steps button').all();
  const titles = await Promise.all(steps.map(button => button.locator('strong').textContent()));
  const section = workflow.getByLabel('Jump to section');
  const heading = page.locator('#workspace-title');
  const back = page.getByRole('button', { name: 'Back', exact: true });
  const stepIds = await section.locator('option').evaluateAll(options => options.map(option => option.value).filter(value => value !== '-1'));
  await section.selectOption(stepIds[6]);
  assert.equal(await heading.textContent(), titles[6]);
  await back.click();
  assert.equal(await heading.textContent(), titles[0]);

  await section.selectOption(stepIds[6]);
  await section.selectOption(stepIds[9]);
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  assert.equal(await heading.textContent(), titles[6]);
  await workflow.getByRole('button', { name: 'Back to last viewed step' }).click();
  assert.equal(await heading.textContent(), titles[0]);

  for (const id of stepIds.slice(1)) await section.selectOption(id);
  for (const title of titles.reverse()) {
    assert.equal(await heading.textContent(), title);
    await back.click();
  }
  await page.getByRole('heading', { name: 'Start a draft' }).waitFor();
  assert.deepEqual(pageErrors, []);
  console.log('PASS: draft options, all five printable forms on mobile, application save/reload/status, mocked AI autofill, saved-deed search and autofill, and Back navigation through every deed step.');
} finally {
  await browser.close();
}
