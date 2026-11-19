import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1140, height: 900 } });
  const cloud = [];
  const external = [];
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && /ocr|tesseract|traineddata|worker\.min/i.test(response.url())) browserErrors.push(response.status() + ' ' + response.url());
  });
  const port = process.env.BASE_URL || 'http://127.0.0.1:5224';
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(port).origin) {
      if (!['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) external.push(url.origin);
      return route.abort();
    }
    if (/^\/api\/(?:anthropic|analyze-sketch|parse-document)/.test(url.pathname)) {
      cloud.push(url.pathname);
      return route.fulfill({ status: 429, json: { error: { message: 'Synthetic credit limit for toggle verification' } } });
    }
    return route.continue();
  });
  await page.goto(port);
  await page.getByRole('button', { name: /New deed/ }).first().click();
  const step = label => page.getByRole('navigation', { name: 'Deed steps' }).getByRole('button', { name: label }).click();
  await step(/^1\s+Deed setup/i);
  await page.getByLabel('Schedule 1 property type').locator('select').selectOption({ label: 'Part Open Place' });
  await step(/^2\s+Link Deed & Enclosures/i);
  const mode = page.getByRole('switch', { name: 'AI extraction' });
  await expect(mode).toBeChecked();
  await mode.uncheck();
  await expect(page.getByText('Off · Local reading uses no AI credits')).toBeVisible();
  assert.equal(await page.evaluate(() => localStorage.getItem('deedcraft-ai-extraction')), 'off');

  await page.getByRole('button', { name: '+ Add / upload document' }).click();
  await page.getByRole('button', { name: /Link Document No\./i }).click();
  await page.getByRole('button', { name: /Property Tax \/ Assessment/i }).click();
  await page.getByRole('button', { name: 'Continue with 2 documents' }).click();
  const deedInput = page.locator('[data-title-point="linkDoc"] input[type=file]');
  const pdf = await PDFDocument.create();
  const pdfPage = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  [
    'SALE DEED', 'Document No: 1263/2016', 'Execution Date: 27-02-2016', 'SRO: Sircilla',
    'SCHEDULE OF THE PROPERTY', 'Mandal: Sircilla', 'Survey No: 795/B&D',
    'Extent: 157.22 Sq. Yards', 'North: Neighbour road', 'Market Value per Sq.Yard: Rs. 1,000',
  ].forEach((line, index) => pdfPage.drawText(line, { font, size: 15, x: 48, y: 770 - 24 * index }));
  const linkFile = { name: 'Synthetic link deed.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) };
  await deedInput.setInputFiles(linkFile);
  const review = page.getByRole('dialog', { name: 'Review local extraction' });
  const linkCard = page.locator('[data-title-point="linkDoc"]');
  await expect(linkCard.locator('[data-deed-field="linkDocNo"] input')).toHaveValue('1263/2016', { timeout: 30000 });
  await expect(linkCard.locator('[data-deed-field="linkDocType"] input')).toHaveValue('SALE DEED');
  await expect(review).toHaveCount(0);
  await step(/^3\s+Jurisdiction/i);
  await expect(page.locator('[data-deed-field="mandal"] input')).toHaveValue('Sircilla');
  await step(/^4\s+Property Schedules/i);
  await expect(page.locator('[data-deed-field="surveyNo"] input')).toHaveValue('795/B&D');
  await step(/^2\s+Link Deed & Enclosures/i);

  // Exercise the production OCR assets with a real raster image and no cloud mocks.
  const scanText = lines => page.evaluate(lines => {
    const canvas = document.createElement('canvas');
    canvas.width = 1250;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.font = '36px Arial';
    lines.forEach((line, index) => ctx.fillText(line, 60, 78 + index * 65));
    return canvas.toDataURL('image/png').split(',')[1];
  }, lines);
  const scan = await scanText(['GHMC Property Tax Receipt', 'H.No.: 6-2-24', 'PTIN: 1105008210', 'Receipt No: 42/2026',
    'Transaction Date: 19/11/2026']);
  await page.locator('[data-title-point="houseTax"] input[type=file]').setInputFiles({
    name: 'Synthetic scanned receipt.png', mimeType: 'image/png', buffer: Buffer.from(scan, 'base64'),
  });
  await expect(page.locator('[data-deed-field="houseTaxReceiptNo"] input')).toHaveValue('42/2026', { timeout: 120000 });
  await expect(page.getByLabel('H.No. for PTIN pair 1')).toHaveValue('6-2-24');
  await expect(page.getByLabel('PTIN for H.No. 2')).toHaveValue('1105008210');
  assert.deepEqual(browserErrors, []);

  const textFile = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
  const enclosures = [
    ['rectificationDeed', /^Rectification Deed/, 'RECTIFICATION DEED\nDocument No: 32/2025', 'rectificationDeedNo', '32/2025'],
    ['supplementalDeed', /^Supplemental Deed/, 'SUPPLEMENTAL DEED\nDocument No: 45/2025', 'supplementalDeedNo', '45/2025'],
    ['landLayoutLrs', /^Vacant Land Tax \/ Approved Layout/, 'Layout File No: LP-28\nLRS Application No: 9501', 'layoutFileNo', 'LP-28'],
    ['titleDeed', /^Title Deed No\./, 'Title Deed No: PPB42\nKhata No: 60770', 'titleDeedNo', 'PPB42'],
    ['nala', /^Nala Order No\./, 'NALA Order No: NALA42\nProceeding Date: 06/07/2021\nExtent (Acre-Guntas): 00-02', 'nalaOrderNo', 'NALA42'],
    ['permissions', /^Permissions \/ Approved details/, 'Building Permit No: PERMIT22\nPermission Date: 01/09/2023\nIssuing Authority: Sircilla', 'permBuildingPermitNo', 'PERMIT22'],
  ];
  await page.getByRole('button', { name: '+ Add / upload document' }).click();
  for (const [, label] of enclosures) await page.getByRole('button', { name: label }).click();
  await page.getByRole('button', { name: 'Continue with 6 documents' }).click();
  for (const [option, , text, field, value] of enclosures) {
    const card = page.locator('[data-title-point="' + option + '"]');
    let upload = textFile(option + '.txt', text);
    if (option === 'permissions') {
      const mixed = await PDFDocument.create();
      const sheet = mixed.addPage();
      const digitalFont = await mixed.embedFont(StandardFonts.Helvetica);
      sheet.drawText('This digital cover header is not the scanned permit body.', { x: 40, y: 775, font: digitalFont, size: 14 });
      const image = await mixed.embedPng(Buffer.from(await scanText(text.split('\n')), 'base64'));
      sheet.drawImage(image, { x: 40, y: 445, width: 510, height: 184 });
      upload = { name: 'Hybrid scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await mixed.save()) };
    }
    await card.locator('input[type=file]').setInputFiles(upload);
    await expect(card.locator('[data-deed-field="' + field + '"] input')).toHaveValue(value, { timeout: 35000 });
  }

  await step(/^3\s+Jurisdiction/i);
  await page.locator('.document-upload input[type=file]').first().setInputFiles(textFile('Unseen layout.txt', 'Village | District | Mandal\nKothapalli | Karimnagar | Kothapalli'));
  await expect(page.locator('[data-deed-field="district"] input')).toHaveValue('Karimnagar');
  await step(/^4\s+Property Schedules/i);
  await page.locator('.document-upload input[type=file]').first().setInputFiles({
    name: 'Additional schedule facts.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await Packer.toBuffer(new Document({ sections: [{ children: [new Table({ rows: [
      new TableRow({ children: ['South', 'Public road'].map(text => new TableCell({ children: [new Paragraph(text)] })) }),
    ] })] }] })),
  });
  await expect(page.locator('[data-deed-field="boundarySouth"] :is(input,textarea)')).toHaveValue('Public road');
  await step(/^5\s+Market Value/i);
  await expect(page.locator('[data-deed-field="govtRate"] input')).toHaveValue('1,000');
  await step(/^6\s+Payment Details/i);
  await page.getByRole('button', { name: '+ Cheque' }).click();
  const proof = await PDFDocument.create();
  const proofPage = proof.addPage();
  const proofFont = await proof.embedFont(StandardFonts.Helvetica);
  ['Cheque No: 123456', 'Payment Amount: 1500', 'Cheque Date: 07-09-2026'].forEach((text, index) =>
    proofPage.drawText(text, { x: 40, y: 760 - index * 25, font: proofFont, size: 16 }));
  await page.locator('.payment-upload input[type=file]').setInputFiles({
    name: 'payment-proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await proof.save()),
  });
  await expect(page.locator('.payment-fields').getByLabel(/Cheque no\./i)).toHaveValue('123456');
  const uploads = page.locator('.local-upload-list');
  await expect(uploads.getByText('payment-proof.pdf', { exact: true })).toHaveCount(1);
  await uploads.locator('summary').click();
  await expect(uploads.getByRole('button', { name: 'Download payment-proof.pdf' })).toBeVisible();
  for (const [stepNumber, side, name] of [[7, 'executant', 'Synthetic Seller'], [8, 'claimant', 'Synthetic Buyer']]) {
    await step(new RegExp('^' + stepNumber + '\\s+'));
    const id = 'Government of India\nTo\n' + name + '\nSample Parent,\n1-2-3,\nPIN Code: 505301\nMobile: 91234 56789\nYour Aadhaar No. :\n2233 4455 6677';
    await page.locator('.party-identity-upload input[type=file]').first().setInputFiles([
      textFile(side + '-id.txt', id), textFile(side + '-contact.txt', 'Mobile: 98765 43210\nOccupation: Business'),
    ]);
    await expect(page.locator('[data-deed-field="' + side + 'Name"] input').first()).toHaveValue(name.toUpperCase());
    await expect(page.locator('[data-deed-field="' + side + 'RelativeName"] input').first()).toHaveValue('SAMPLE PARENT');
    await expect(page.locator('[data-deed-field="' + side + 'Mobile"] input').first()).toHaveValue(/^98765 ?43210$/);
    await expect(page.locator('[data-deed-field="' + side + 'Occupation"] input').first()).toHaveValue('Business');
    await expect(review).toHaveCount(0);
  }
  await step(/^1\s+Deed setup/i);
  const propertyType = page.getByLabel('Schedule 1 property type');
  await propertyType.getByRole('button', { name: 'Change type' }).click();
  await propertyType.locator('select').selectOption({ label: 'Finished Flat' });
  await step(/^2\s+Link Deed & Enclosures/i);
  const agreements = page.getByRole('region', { name: 'Landowner–developer agreements' });
  await agreements.locator('input[type=file]').setInputFiles(textFile('Flat agreements.txt', 'Development Agreement Document No: 78/2025\nSupplemental Agreement No: 84/2025'));
  await expect(agreements.locator('[data-deed-field="developmentDocNo"] input')).toHaveValue('78/2025');
  await expect(agreements.locator('[data-deed-field="supplementalDocNo"] input')).toHaveValue('84/2025');
  assert.deepEqual(cloud, [], 'Local readings make zero cloud extraction requests');
  assert.deepEqual(external, [], 'OCR imports its assets from DeedCraft');
  await step(/^2\s+Link Deed & Enclosures/i);
  await mode.check();
  await deedInput.setInputFiles(linkFile);
  await expect.poll(() => cloud.length).toBeGreaterThan(0);
  console.log('PASS: eight Step 2 cards, a PDF with a searchable header and scanned body, table-form jurisdiction, schedule, flat agreements, party and payment autofill. Local PDF, DOCX, text and PNG made zero cloud calls. Re-enabling AI routed the same picker to cloud extraction.');
} finally {
  await browser.close();
}
