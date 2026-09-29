import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const out = fileURLToPath(new URL('../tmp/manual-entry-qa/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const categories = ['Vacant Plot', 'Open Place', 'Residential', 'Flat', 'Demolished', 'Commercial', 'Agricultural land', 'Part open place'];
const titleValues = {
  linkDoc: { 'Document type': 'Sale Deed', 'Document number': 'LINK-101', 'Link deed execution date': '2020-05-14', 'Sub-Registrar Office': 'LINK SRO', 'SRO code': 'LS1' },
  landLayoutLrs: { 'V.L.T. number': 'VLT-101', 'Approved layout file number': 'LAY-101', 'LRS 2020 application number': 'LRS-APP-101', 'Application date': '2023-08-23', 'LRS proceeding number': 'LRS-PROC-101', 'Proceeding date': '2024-09-24' },
  titleDeed: { 'Title deed number': 'TITLE-101', 'Khata number': 'KHATA-101' },
  nala: { 'NALA order number': 'NALA-101', 'Proceeding date': '2021-06-20' },
  houseTax: { 'House tax receipt number': 'RECEIPT-101', 'Assessment / PTIN number': 'ASSESS-101', 'Local body': 'TEST MUNICIPALITY', 'Tax paid date': '2025-07-21' },
  permissions: { 'Permission number': 'PERMIT-101', 'Permission date': '2022-07-22', 'Issuing local authority': 'TEST MUNICIPALITY' },
};

async function scenario(name, category, { titles = false, extraLink = false, parties = false, executantCount = parties ? 2 : 1, claimantCount = parties ? 2 : 1, floors = false, second = false, incomplete = false, noLink = false, partialTitles = false } = {}) {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const step = async (number) => page.locator('.rail-step').nth(number - 1).click();
  const fill = async (scope, label, value, index = 0) => {
    let input = label === 'Sale deed execution month and year' ? scope.locator('input[type="month"]') : scope.getByLabel(label, { exact: true });
    if (!(await input.count())) input = scope.locator('label').filter({ hasText: new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') }).locator('input, select, textarea');
    assert.ok(await input.count(), `${name}: expected ${label} field`);
    input = input.nth(index);
    if (await input.evaluate(element => element.tagName === 'SELECT')) await input.selectOption(value);
    else await input.fill(value);
    assert.equal((await input.inputValue()).replaceAll(',', ''), value, `${name}: ${label} did not retain typed value`);
  };
  const title = id => page.locator(`[data-title-point="${id}"]`).first();
  const chooseCategory = async value => {
    const selector = page.locator('[aria-label^="Schedule "][aria-label$="property type"] select');
    if (await selector.count()) await selector.selectOption(value);
    else {
      await page.getByRole('button', { name: 'Change type' }).click();
      await selector.selectOption(value);
    }
  };
  const addAllTitleSections = async () => {
    if (await page.locator('[data-title-point]').count() === 6) return;
    await page.getByRole('button', { name: '+ Add / upload document' }).click();
    for (const label of [
      'Link Document No.', 'Vacant Land Tax / Approved Layout / LRS', 'Title Deed No.',
      'Nala Order No.', 'Property Tax / Assessment', 'Permissions / Approved details',
    ]) await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('button', { name: 'Continue with 6 documents', exact: true }).click();
  };
  const fillTitle = async (suffix = '101') => {
    for (const [id, fields] of Object.entries(titleValues)) {
      for (const [label, raw] of Object.entries(fields)) {
        const value = raw.replaceAll('101', suffix);
        await fill(title(id), label, value);
      }
    }
  };
  const fillJurisdiction = async suffix => {
    await fill(page, 'State', 'Telangana');
    await fill(page, 'District Registrar', `REGISTRAR-${suffix}`);
    await fill(page, 'Sub-Registrar Office', `SRO-${suffix}`);
    await fill(page, 'District', `DISTRICT-${suffix}`);
    await fill(page, 'Mandal', `MANDAL-${suffix}`);
    await fill(page, 'Village', `VILLAGE-${suffix}`);
    await fill(page, 'Sale deed execution month and year', '2026-10');
  };
  const fillProperty = async (suffix, propertyCategory = category) => {
    for (const [label, value] of Object.entries({ 'Plot number': `PLOT-${suffix}`, 'Extent (Sq. Yards)': '100.33', 'Survey no(s).': `SURVEY-${suffix}`, 'Locality': `LOCALITY-${suffix}`, 'PIN code': '505301', North: `NORTH-${suffix}`, South: `SOUTH-${suffix}`, East: `EAST-${suffix}`, West: `WEST-${suffix}` })) await fill(page, label, value);
    if (!['Residential', 'Commercial', 'Flat'].includes(propertyCategory)) {
      if (['Demolished', 'Part open place'].includes(propertyCategory)) await fill(page, 'Subject property H.No.', `SUBJECT-${suffix}`);
      else { await fill(page, 'Landmark relation', 'Near'); await fill(page, 'Near / adjacent H.No.', `ADJACENT-${suffix}`); }
    }
    if (['Residential', 'Commercial', 'Flat'].includes(propertyCategory)) {
      const houseFields = { 'Bearing H.No.': `HOUSE-${suffix}`, 'Nature of roof': 'R.C.C.', 'Type of structure / construction': 'Framed with pillars and columns', 'PTIN number': `PTIN-${suffix}`, 'Tax per annum (₹)': '1672', 'Annual rental value (₹)': '4000', 'Tap connection no(s).': `TAP-${suffix}`, 'Electricity S.C. no(s).': `SC-${suffix}` };
      if (partialTitles) delete houseFields['PTIN number'];
      for (const [label, value] of Object.entries(houseFields)) await fill(page, label, value);
      const rows = page.locator('table tbody tr');
      await rows.first().locator('input').nth(0).fill(floors ? '2' : '1');
      await rows.first().locator('select').nth(0).selectOption('Ground');
      await rows.first().locator('select').nth(1).selectOption('R.C.C. Building');
      await rows.first().locator('select').nth(2).selectOption('Finished');
      await rows.first().locator('input').nth(1).fill('25');
      await rows.first().locator('input').nth(2).fill('700');
      if (floors) {
        await rows.first().getByRole('button', { name: '+' }).click();
        await rows.nth(1).locator('select').nth(0).selectOption('First Floor');
        await rows.nth(1).locator('select').nth(1).selectOption('R.C.C. Building');
        await rows.nth(1).locator('select').nth(2).selectOption('Finished');
        await rows.nth(1).locator('input').nth(1).fill('25');
        await rows.nth(1).locator('input').nth(2).fill('700');
      }
    }
  };
  const fillParty = async (side, suffix, index = 0) => {
    const section = page.locator('main');
    for (const [label, value] of Object.entries({ 'Full name': `${side.toUpperCase()}-${suffix}`, "Father's / relative's name": `PARENT-${suffix}`, Age: '40', 'Date of birth': '1986-01-01', Occupation: 'Business', 'Aadhaar number': suffix === '1' ? '111122223333' : '444455556666', 'House no.': `1-2-${suffix}`, Village: 'Sircilla', Mandal: 'Sircilla', District: 'Rajanna Sircilla', State: 'Telangana', 'PIN code': '505301' })) await fill(section, label, value, index);
  };
  try {
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173');
    await step(2);
    await chooseCategory(category);
    await addAllTitleSections();
    assert.equal(await page.locator('[data-title-point]').count(), 6, `${name}: expected six title sections`);
    assert.equal(await page.getByLabel('Assessment / PTIN number', { exact: true }).count(), 1, `${name}: assessment/PTIN should have one editable field in Step 2`);
    if (titles) await fillTitle();
    if (extraLink) {
      await page.getByRole('button', { name: '+ Add / upload document' }).click();
      await page.getByRole('button', { name: 'Link Document No.', exact: true }).click();
      await page.getByRole('button', { name: 'Continue with 1 document', exact: true }).click();
      const secondDeed = page.locator('[data-title-point="linkDoc"]').nth(1);
      for (const [label, value] of Object.entries({ 'Document type': 'Gift Deed', 'Document number': 'LINK-102', 'Link deed execution date': '2022-02-12', 'Sub-Registrar Office': 'GIFT SRO', 'SRO code': 'GS2' })) await fill(secondDeed, label, value);
    }
    if (!titles && !noLink && !incomplete) {
      for (const [label, value] of Object.entries(titleValues.linkDoc)) await fill(title('linkDoc'), label, value);
    }
    if (partialTitles) {
      await fill(title('nala'), 'NALA order number', 'NALA-PARTIAL');
      await fill(title('houseTax'), 'House tax receipt number', 'RECEIPT-PARTIAL');
      await fill(title('houseTax'), 'Local body', 'PARTIAL MUNICIPALITY');
      await fill(title('houseTax'), 'Assessment / PTIN number', 'PTIN-PARTIAL');
      await fill(title('permissions'), 'Permission number', 'PERMIT-INCOMPLETE');
    }
    await step(3); await fillJurisdiction('101');
    if (titles) { await step(2); assert.equal(await title('linkDoc').getByLabel('Sub-Registrar Office', { exact: true }).inputValue(), 'LINK SRO'); }
    await step(4); await fillProperty('101');
    if (partialTitles) assert.equal(await page.getByLabel('PTIN number', { exact: true }).inputValue(), 'PTIN-PARTIAL');
    if (second) {
      await page.getByRole('button', { name: '+ Add another property' }).click();
      await step(2); await chooseCategory('Vacant Plot'); await addAllTitleSections(); await fill(title('linkDoc'), 'Document number', 'LINK-202');
      await fill(title('linkDoc'), 'Document type', 'Gift Deed');
      await fill(title('linkDoc'), 'Link deed execution date', '2021-04-13');
      await fill(title('linkDoc'), 'Sub-Registrar Office', 'SRO-202');
      await fill(title('landLayoutLrs'), 'V.L.T. number', 'VLT-202');
      await step(3); await fillJurisdiction('202');
      await step(4); await fillProperty('202', 'Vacant Plot');
    }
    await step(5);
    await fill(page, 'Basic rate per Sq. Yard (₹)', '5700');
    if (second) await fill(page, 'Basic rate per Sq. Yard (₹)', '6200', 1);
    await fill(page, 'Structure valuation (₹)', ['Residential', 'Commercial', 'Flat'].includes(category) ? '100000' : '0');
    if (second) await fill(page, 'Structure valuation (₹)', '0', 1);
    await fill(page, 'Sale consideration (₹)', '3407000');
    await fill(page, 'Stamp paper value (₹)', '100');
    assert.equal((await page.getByLabel('Calculated market value (extent × basic rate)', { exact: false }).first().inputValue()).replaceAll(',', ''), '571881');
    if (!incomplete) {
      await step(6);
      await page.getByRole('button', { name: '+ Cash' }).click();
      await fill(page, 'Amount (₹)', '3407000');
      await fill(page, 'Date', '2026-10-01');
      await fill(page, 'Payer (purchaser)', 'CLAIMANT-1');
      await fill(page, 'Payee (vendor)', 'EXECUTANT-1');
      if (name === 'all-title-points') {
        const amount = page.getByLabel('Amount (₹)', { exact: true }).first();
        await amount.fill('3407001');
        assert.equal((await amount.inputValue()).replaceAll(',', ''), '3407000', 'payment must not exceed consideration');
      }
      await step(7); await fillParty('executant', '1');
      for (let index = 1; index < executantCount; index++) { await page.getByRole('button', { name: 'Add blank executant instead' }).click(); await fillParty('executant', String(index + 1), index); }
      await step(8); await fillParty('claimant', '1');
      for (let index = 1; index < claimantCount; index++) { await page.getByRole('button', { name: 'Add blank claimant instead' }).click(); await fillParty('claimant', String(index + 1), index); }
      if (claimantCount > 1) {
        for (const [schedule, one, two] of second ? [[1, '60', '40'], [2, '45', '55']] : [[1, '60', '40']]) {
          await fill(page, `Schedule ${schedule} Vendee 1 undivided share percent`, one);
          await fill(page, `Schedule ${schedule} Vendee 2 undivided share percent`, two);
        }
      }
    }
    await step(9);
    const readiness = await page.locator('main').innerText();
    const outstandingDetails = await page.locator('main details').allTextContents();
    if (!incomplete && !noLink) assert.equal(outstandingDetails.length, 0, `${name}: unexpected outstanding items: ${outstandingDetails.join(' ')}`);
    await step(10);
    const download = page.waitForEvent('download', { timeout: 30000 });
    await page.getByRole('button', { name: 'Download Word 2007 deed (.docx)' }).click();
    const artifact = await download;
    const path = join(out, `${name}.docx`);
    await artifact.saveAs(path);
    assert.deepEqual(errors, [], `${name}: browser errors`);
    console.log(JSON.stringify({ scenario: name, category, path, outstanding: readiness.match(/\d+ outstanding items/)?.[0] || '', details: outstandingDetails.join(' ').slice(0, 1200) }));
  } finally { await page.close(); }
}

try {
  if (!process.env.MANUAL_SCENARIO || process.env.MANUAL_SCENARIO === 'categories')
    for (const category of categories.filter(category => !process.env.MANUAL_CATEGORY || category === process.env.MANUAL_CATEGORY)) await scenario(category.toLowerCase().replaceAll(' ', '-'), category, { floors: category === 'Residential' });
  if (!process.env.MANUAL_SCENARIO || process.env.MANUAL_SCENARIO === 'titles')
    await scenario('all-title-points', 'Vacant Plot', { titles: true });
  if (!process.env.MANUAL_SCENARIO || process.env.MANUAL_SCENARIO === 'multiple-links')
    await scenario('multiple-links', 'Vacant Plot', { titles: true, extraLink: true });
  if (!process.env.MANUAL_SCENARIO || process.env.MANUAL_SCENARIO === 'two')
    await scenario('two-schedules', 'Residential', { titles: true, floors: true, second: true, parties: true });
  if (!process.env.MANUAL_SCENARIO || process.env.MANUAL_SCENARIO === 'party-cardinality')
    await scenario('one-executant-two-claimants', 'Vacant Plot', { executantCount: 1, claimantCount: 2 });
  if (!process.env.MANUAL_SCENARIO || process.env.MANUAL_SCENARIO === 'incomplete')
    await scenario('incomplete', 'Vacant Plot', { incomplete: true });
  if (!process.env.MANUAL_SCENARIO || process.env.MANUAL_SCENARIO === 'partial')
    await scenario('partial-title', 'Residential', { noLink: true, partialTitles: true, floors: true });
} finally { await browser.close(); }
