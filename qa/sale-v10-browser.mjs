import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5202');
  await page.getByRole('button', { name: 'Create your first deed' }).click();
  await page.getByRole('button', { name: 'Saved deeds', exact: true }).click();
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('deedcraft-saved-deeds', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const rows = await new Promise((resolve, reject) => { const request = db.transaction('deeds').objectStore('deeds').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const old = structuredClone(rows[0]);
    old.id = 'qa-older-v9'; old.draft.id = old.id;
    old.libraryTemplate = { versionId: 'sale-deed-v9', hash: 'ea509739595087cc5632189516c527a852c93b1d5207cf614f32276e76d42bd5', name: 'Built-in Sale v9', saleOpenings: true };
    old.generationManifest = null;
    await new Promise((resolve, reject) => { const tx = db.transaction('deeds', 'readwrite'); tx.objectStore('deeds').put(old); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.reload();
  await expect(page.locator('.saved-deed-card').filter({ hasText: 'sale-deed-v10' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Update this draft', exact: true })).toHaveCount(0);
  const pins = await page.evaluate(async () => {
    const db = await new Promise(resolve => { const request = indexedDB.open('deedcraft-saved-deeds', 1); request.onsuccess = () => resolve(request.result); });
    const rows = await new Promise(resolve => { const request = db.transaction('deeds').objectStore('deeds').getAll(); request.onsuccess = () => resolve(request.result); });
    db.close(); return rows.map(row => row.libraryTemplate.versionId);
  });
  assert.deepEqual(pins, ['sale-deed-v10', 'sale-deed-v10']);
  assert.deepEqual(errors, []);
  console.log('PASS: v10 default, automatic saved v9 migration and persisted current defaults.');
} finally { await browser.close(); }
