import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = new URL('../tmp/entity-party-qa/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/anthropic/v1/messages', async route => {
    const body = route.request().postDataJSON();
    const text = body.messages[0].content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    const fields = body.tools[0].input_schema.properties.candidates?.items.properties.field.enum || [];
    const side = fields.some(f => f.startsWith('executant')) ? 'executant' : 'claimant';
    let values;
    if (text.includes('PERSON ALPHA')) values = { personName: 'ALPHA SIGNER', personDob: '1980-01-01', personHNo: '11-22', personVillage: 'Alpha Town', personDesignation: 'Manager' };
    else if (text.includes('PERSON BETA')) values = { personName: 'BETA SIGNER', personDob: '1990-01-01', personHNo: '33-44', personVillage: 'Beta Town', personDesignation: 'Director' };
    else if (text.includes('ENTITY FILE')) values = { [side + 'EntityName']: side === 'executant' ? 'Test Firm LLP' : 'Test Society', [side + 'EntityAddress']: 'Registered Office, Test City', [side + 'EntityHNo']: '99-1' };
    else values = {};
    const data = { candidates: Object.entries(values).filter(([field]) => fields.includes(field)).map(([field, value]) => ({ field, value, role: field.startsWith('person') ? 'party-person' : side, record: 'primary', quote: `${field}: ${value}`, region: 'Printed label', page: 0, handwritten: false, historical: false })), plan: null, notes: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'fixture', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'tool_use', id: 'fixture', name: 'record_transcription', input: data }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }) });
  });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5184');
  await page.getByRole('heading', { name: 'Saved deeds', exact: true }).waitFor();
  await page.evaluate(async () => {
    const { newDraft } = await import('/source-draft.ts'); const draft = newDraft();
    draft.step = 6; draft.revision = 1;
    const property = { category: 'Residential', unit: 'Sq. Yards', propState: 'Telangana', district: 'Test District', mandal: 'Test Mandal', village: 'Test Town', locality: 'Test Locality', pinCode: '505301', sro: 'Test SRO', districtRegistrar: 'Test District', bearingHNo: '2-6-91', surveyNo: '1475/B', extentSqYards: '124.55', roofMaterial: 'R.C.C. Building', constructionDescription: 'Framed with pillars & columns only', boundaryNorth: 'North neighbour', boundarySouth: 'South road', boundaryEast: 'East road', boundaryWest: 'West neighbour', govtRate: '6200', structValue: '100000', bltNo: 'TEST-PTIN', taxesPerAnnum: '1000', annualRentalValue: '6000', tapConnectionNo: 'Nil', metersNo: '36664' };
    for (const [k, v] of Object.entries(property)) draft.manual['property|primary|' + k] = v;
    for (const [k, v] of Object.entries({ consid: '1494000', stampValue: '50', executionDate: '2026-10' })) draft.manual['property|transaction|' + k] = v;
    draft.structureDetailsBySchedule.primary = { totalFloors: '1', rows: [{ id: 'floor', floorNo: 'Ground Floor', structureType: 'R.C.C. Building', customStructureType: '', stage: 'Finished', buildingAge: '29', builtUpAreaSqFt: '532' }] };
    draft.manual['executant|primary|executantPartyType'] = 'Firm / LLP'; draft.manual['claimant|primary|claimantPartyType'] = 'Society / Association';
    const saved = { id: draft.id, updatedAt: new Date().toISOString(), claimantNames: ['Entity QA'], deedType: 'Sale', draft, sourceFiles: {}, planDrafts: {}, referencePlanDrafts: {}, selectedPlanSvgs: {}, extraPartyRecords: { executant: [], claimant: [] }, templateMode: 'built-in', customTemplate: null };
    await new Promise((resolve, reject) => { const open = indexedDB.open('deedcraft-saved-deeds', 1); open.onsuccess = () => { const db = open.result; const tx = db.transaction('deeds', 'readwrite'); tx.objectStore('deeds').put(saved); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
  });
  await page.reload(); await page.getByRole('button', { name: 'Continue / Edit' }).click();
  const close = async () => { const button = page.getByRole('button', { name: 'Close', exact: true }); if (await button.isVisible()) await button.click(); };
  const step = async n => { await close(); await page.locator('.rail-step').filter({ hasText: n }).click(); };
  const payload = (marker, values) => ({ name: marker + '.txt', mimeType: 'text/plain', buffer: Buffer.from(marker + '\n' + Object.entries(values).map(([k,v]) => `${k}: ${v}`).join('\n')) });
  const idle = async () => { await page.waitForFunction(() => !document.querySelector('.document-upload[aria-busy="true"]')); await close(); };
  for (const [side, nav] of [['executant', '07'], ['claimant', '08']]) {
    await step(nav);
    assert.equal(await page.getByLabel('Full name', { exact: true }).count(), 0);
    const entityFile = page.locator('.document-upload').filter({ hasText: 'entity particulars' }).locator('input[type=file]');
    await entityFile.setInputFiles(payload('ENTITY FILE', { [side + 'EntityName']: side === 'executant' ? 'Test Firm LLP' : 'Test Society', [side + 'EntityAddress']: 'Registered Office, Test City', [side + 'EntityHNo']: '99-1' }));
    await idle(); assert.equal(await page.getByLabel('Entity name (English)', { exact: true }).inputValue(), side === 'executant' ? 'TEST FIRM LLP' : 'TEST SOCIETY');
    for (const [marker, name, village] of [['PERSON ALPHA', 'ALPHA SIGNER', 'Alpha Town'], ['PERSON BETA', 'BETA SIGNER', 'Beta Town']]) {
      await page.getByRole('button', { name: '+ Add representative', exact: true }).click();
      const card = page.locator('.representative-card').last();
      await card.locator('input[type=file]').setInputFiles(payload(marker, { personName: name, personDob: marker.includes('ALPHA') ? '1980-01-01' : '1990-01-01', personHNo: marker.includes('ALPHA') ? '11-22' : '33-44', personVillage: village, personDesignation: marker.includes('ALPHA') ? 'Manager' : 'Director' }));
      await idle(); assert.equal(await card.getByLabel('Name *', { exact: true }).inputValue(), name);
      assert.equal(await card.getByLabel('Village / city / town', { exact: true }).inputValue(), village);
      assert(Number(await card.getByLabel('Age', { exact: true }).inputValue()) > 30);
    }
    const cards = page.locator('.representative-card');
    await cards.first().getByLabel('Age', { exact: true }).fill('44');
    assert.equal(await cards.nth(1).getByLabel('Name *', { exact: true }).inputValue(), 'BETA SIGNER');
    await page.getByLabel('Same as registered office address', { exact: true }).check();
    assert.equal(await page.getByLabel('Communication address', { exact: true }).count(), 0);
    await page.getByLabel('Same as registered office address', { exact: true }).uncheck();
    if (side === 'claimant') {
      await page.getByRole('button', { name: '+ Add member', exact: true }).click();
      await page.locator('.representative-card').last().getByLabel('Name *', { exact: true }).fill('COMMITTEE ONLY');
      await page.getByLabel('Registered under act', { exact: true }).fill('Custom Society Act');
    }
    const originalType = side === 'executant' ? 'Firm / LLP' : 'Society / Association';
    await page.getByLabel('Party type', { exact: false }).selectOption('Company');
    assert.equal(await page.getByLabel('Corporate Identification Number (CIN)', { exact: true }).count(), 1);
    await page.getByLabel('Party type', { exact: false }).selectOption(originalType);
    assert.equal(await page.locator('.representative-card').count(), side === 'executant' ? 2 : 3);
    await page.getByRole('button', { name: 'Add blank ' + side + ' instead', exact: true }).click();
    await page.getByLabel('Party type', { exact: false }).last().selectOption('Company');
    await page.getByLabel('Entity name (English)', { exact: true }).last().fill('Additional Entity');
    assert.equal(await page.getByLabel('Entity name (English)', { exact: true }).first().inputValue(), side === 'executant' ? 'TEST FIRM LLP' : 'TEST SOCIETY');
    await page.getByRole('button', { name: 'Delete this ' + side, exact: true }).click();
    await page.screenshot({ path: new URL(side + '-form.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  }
  await step('10');
  let event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download Word 2007 deed (.docx)', exact: true }).click();
  const download = await event; assert(download.suggestedFilename().includes('TEST-SOCIETY'));
  await download.saveAs(new URL('entity-deed.docx', out).pathname.replace(/^\/(\w:)/, '$1'));
  await page.getByRole('radio', { name: /My template/ }).check();
  await page.locator('.custom-template input[type=file]').setInputFiles({ name: 'custom.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await readFile(new URL('../sale-deed-template.docx', import.meta.url)) });
  await page.locator('.template-status.valid').waitFor();
  event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download Word 2007 deed (.docx)', exact: true }).click();
  await (await event).saveAs(new URL('custom-entity-deed.docx', out).pathname.replace(/^\/(\w:)/, '$1'));
  await page.getByRole('radio', { name: /Published \/ pinned template/ }).check();
  await page.getByRole('button', { name: 'Overview', exact: false }).first().click();
  const summaries = page.getByRole('region', { name: 'Party summaries' });
  assert((await summaries.innerText()).includes('TEST FIRM LLP')); assert((await summaries.innerText()).includes('2 representative(s)'));
  await page.getByRole('button', { name: 'Saved deeds', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Continue / Edit' }).click();
  await step('07'); assert.equal(await page.locator('.representative-card').count(), 2);
  assert.equal(await page.locator('.representative-card').first().getByLabel('Age', { exact: true }).inputValue(), '44');
  await page.getByLabel('Party type', { exact: false }).selectOption('Individual');
  assert.equal(await page.getByLabel('Full name', { exact: true }).count(), 1);
  await page.getByLabel('Party type', { exact: false }).selectOption('Firm / LLP');
  assert.equal(await page.locator('.representative-card').count(), 2);
  await page.locator('.representative-card').first().getByRole('button', { name: 'Remove representative', exact: true }).click();
  assert.equal(await page.locator('.representative-card').count(), 1);
  assert.equal(await page.locator('.representative-card').getByLabel('Name *', { exact: true }).inputValue(), 'BETA SIGNER');
  assert.deepEqual(errors, []);
  console.log('Entity forms, isolated uploads, age correction, committee separation, download, overview and save/reopen passed.');
} finally { await browser.close(); }
