import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const out = fileURLToPath(new URL('../tmp/flat-browser-qa/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.DEEDCRAFT_URL || 'http://127.0.0.1:5184');
  await page.evaluate(async () => {
    const { newDraft } = await import('/source-draft.ts');
    const draft = newDraft(); draft.step = 0;
    const fields = { category: 'Flat', flatStage: 'legacy undecided', flatNo: '103', flatFloorNo: 'First', apartmentName: 'QA COMPLEX', superBuiltUpAreaSqFt: '1020', parkingAreaSqFt: '75', udsSqYards: '30', extentSqYards: '139.25', plotNo: 'A', surveyNo: '688', bearingHNo: '12-6-43', nearHNo: '12-6-40', nearAdjacent: 'Near', roofMaterial: 'R.C.C. Building', constructionDescription: 'Framed with pillars & beams', taxesPerAnnum: '1000', annualRentalValue: '6000', stiltFloors: '2', upperFloors: '4', developmentDocNo: 'DEV-55', developmentDocDate: '2025-01-02', supplementalDocNo: 'SUP-66', village: 'Sircilla', mandal: 'Sircilla', district: 'Rajanna Sircilla', districtRegistrar: 'Karimnagar', propState: 'Telangana', locality: 'Shivanagar', pinCode: '505301', sro: 'Sircilla', boundaryNorth: 'North apartment', boundarySouth: 'South apartment', boundaryEast: 'East apartment', boundaryWest: 'West apartment', flatBoundaryNorth: 'open to sky', flatBoundarySouth: 'South flat', flatBoundaryEast: 'East flat', flatBoundaryWest: 'West flat' };
    for (const [key, value] of Object.entries(fields)) draft.manual[`property|primary|${key}`] = value;
    draft.manual['property|transaction|consid'] = '1494000'; draft.manual['property|transaction|stampValue'] = '50'; draft.manual['property|transaction|executionDate'] = '2026-10-11';
    for (const side of ['executant', 'claimant']) { draft.manual[`${side}|primary|${side}Name`] = side === 'executant' ? 'QA SELLER' : 'QA BUYER'; draft.manual[`${side}|primary|${side}PartyType`] = 'Individual'; }
    const saved = { id: draft.id, updatedAt: new Date().toISOString(), claimantNames: ['Flat QA'], deedType: 'Sale', draft, sourceFiles: {}, planDrafts: {}, referencePlanDrafts: {}, selectedPlanSvgs: {}, extraPartyRecords: { executant: [], claimant: [] }, templateMode: 'built-in', customTemplate: null };
    await new Promise((resolve, reject) => { const open = indexedDB.open('deedcraft-saved-deeds', 1); open.onsuccess = () => { const db = open.result; const tx = db.transaction('deeds', 'readwrite'); tx.objectStore('deeds').put(saved); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
  });
  await page.reload(); await page.getByRole('button', { name: 'Continue / Edit' }).click();
  const close = async () => { const button = page.getByRole('button', { name: 'Close', exact: true }); if (await button.isVisible()) await button.click(); };
  const step = async n => { await close(); await page.locator('.rail-step').filter({ hasText: n }).click(); };
  const type = () => page.getByLabel('What is this property?');
  await step('01');
  assert.equal(await type().inputValue(), '');
  assert.equal(await type().locator('option', { hasText: 'Flat / Apartment Unit' }).count(), 0);
  await type().selectOption({ label: 'Finished Flat' });
  await step('04');
  assert.equal(await page.getByLabel('Flat number', { exact: true }).inputValue(), '103');
  assert.equal(await page.getByLabel('Flat stage').inputValue(), 'Finished');
  assert.equal(await page.getByLabel('Car parking area (Sq. Ft.)', { exact: true }).inputValue(), '75');
  await page.screenshot({ path: out + '/finished-form.png', fullPage: true });
  const download = async name => { await step('10'); const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download Word 2007 deed (.docx)', exact: true }).click(); await (await event).saveAs(out + '/' + name); };
  await download('Finished.docx');
  await step('01'); await page.getByRole('button', { name: 'Change type', exact: true }).click(); await type().selectOption({ label: 'Semi-finished Flat' });
  await step('04'); assert.equal(await page.getByLabel('Flat stage').inputValue(), 'Semi-Finished'); assert.equal(await page.getByLabel('Flat number', { exact: true }).inputValue(), '103');
  await download('Semi-Finished.docx');
  await page.getByRole('radio', { name: /My template/ }).check();
  await page.locator('.custom-template input[type=file]').setInputFiles({ name: 'final.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await readFile(new URL('../sale-deed-template-v4.docx', import.meta.url)) });
  await page.locator('.template-status.valid').waitFor(); await download('Custom-Semi-Finished.docx');
  await page.getByRole('radio', { name: /Built-in template/ }).check();
  await step('04'); await page.getByRole('button', { name: '+ Add another property', exact: true }).click();
  await type().selectOption({ label: 'Finished Flat' });
  await step('04'); await page.getByLabel('Flat number', { exact: true }).fill('204');
  assert.equal(await page.getByLabel('Flat stage').inputValue(), 'Finished');
  await page.getByRole('button', { name: 'Saved deeds', exact: true }).click(); await page.reload(); await page.getByRole('button', { name: 'Continue / Edit' }).click(); await step('04');
  assert.equal(await page.getByLabel('Flat number', { exact: true }).inputValue(), '204');
  await page.getByRole('button', { name: /Schedule 1/ }).first().click();
  assert.equal(await page.getByLabel('Flat number', { exact: true }).inputValue(), '103'); assert.equal(await page.getByLabel('Flat stage').inputValue(), 'Semi-Finished');
  await download('Mixed-Flats.docx');
  assert.deepEqual(errors, []);
  console.log('Flat choices, legacy selection, stage switching, additional schedules, save/reopen and built-in/custom downloads passed.');
} catch (error) { await page.screenshot({ path: out + '/failure.png', fullPage: true }); console.log((await page.locator('body').innerText()).slice(0,5000)); throw error; } finally { await browser.close(); }
