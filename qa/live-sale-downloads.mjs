import { chromium } from 'playwright';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const rt = await loadTemplateRuntime(), browser = await chromium.launch({ channel: 'chrome', headless: true });
const failures = [];
try {
  for (const [id] of rt.saleMatrixCases) {
    const context = await browser.newContext({ acceptDownloads: true }), page = await context.newPage();
    try {
      await page.goto(process.env.QA_ORIGIN || 'https://deedcraft-aistudio.onrender.com/');
      const state = rt.sampleState(id), draft = rt.newDraft();
      draft.step = 9; draft.variantId = rt.saleVariant(state.saleDocument); draft.saleAuthority = state.saleAuthority;
      draft.structureDetailsBySchedule = state.structureDetailsBySchedule || {};
      for (const [field, value] of Object.entries({ ...state.form, category: state.category })) {
        const role = field.startsWith('executant') ? 'executant' : field.startsWith('claimant') ? 'claimant' : 'property';
        draft.manual[`${role}|primary|${field}`] = value;
      }
      await page.evaluate(async draft => {
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('deedcraft-saved-deeds', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('deeds', { keyPath: 'id' });
          request.onsuccess = () => {
            const tx = request.result.transaction('deeds', 'readwrite');
            tx.objectStore('deeds').put({ id: draft.id, updatedAt: new Date().toISOString(), claimantNames: ['SALE QA'], deedType: 'Sale', draft, sourceFiles: {}, planDrafts: {}, referencePlanDrafts: {}, selectedPlanSvgs: {}, extraPartyRecords: { executant: [], claimant: [] }, templateMode: 'built-in', customTemplate: null });
            tx.oncomplete = resolve; tx.onerror = reject;
          };
        });
      }, draft);
      await page.reload(); await page.getByRole('button', { name: 'Continue / Edit' }).first().click();
      const downloaded = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
      await page.getByRole('button', { name: 'Download Word 2007 deed (.docx)' }).click();
      const file = await downloaded;
      if (!file) throw new Error((await page.locator('body').innerText()).slice(-2500));
      if (await file.failure()) throw new Error(await file.failure());
      await mkdir('tmp/live-sale-verified', { recursive: true });
      const path = `tmp/live-sale-verified/${id}.docx`;
      await file.saveAs(path);
      const text = await rt.docxToText(new Uint8Array(await readFile(path)));
      for (const value of ['SAMPLE VENDOR', 'SAMPLE PURCHASER', 'SAMPLE PARENT', 'DECLARATION', 'SCHEDULE OF PROPERTY']) assert(text.includes(value), `${id}: missing ${value}`);
      assert.match(text, /_{16}/, 'Signature writing lines required');
      assert.doesNotMatch(text, /<[^<>]+>/, 'Unfilled template tags');
      if (state.saleDocument !== 'ordinary') {
        for (const value of ['SAMPLE ATTORNEY', 'AUTH-42', 'AUTHORITY SRO']) assert(text.includes(value), `${id}: missing ${value}`);
        assert.match(text, state.saleDocument === 'agpa' ? /A\.G\.P\.A\. HOLDER OF/ : /G\.P\.A\. HOLDER OF/);
      }
      console.log('PASS live ' + id);
    } catch (error) { failures.push(id); console.log('FAIL ' + id + ': ' + error.message); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ failures }));
if (failures.length) process.exitCode = 1;
