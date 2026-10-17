import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:5201';
const folder = new URL('../tmp/file-drop-qa/', import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(new URL('index.html', folder), '<html><body><div id="root"></div><script type="module" src="./fixture.tsx"></script></body></html>');
await writeFile(new URL('fixture.tsx', folder), `
import React, {useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {FileDropZone} from '/file-drop-zone';
import {DocumentUpload} from '/workflow-ui';
function Fixture() {
  const single = useRef(null);
  const [events, setEvents] = useState([]);
  const record = (name, files) => setEvents(old => [...old, name + ':' + Array.from(files || []).map(f => f.name).join(',')]);
  return <>
    <FileDropZone className="multi"><input type="file" accept=".pdf" multiple onChange={e => {record('multi', e.target.files); e.target.value='';}} /></FileDropZone>
    <FileDropZone className="single" inputRef={single}><button onClick={() => single.current.click()}>Upload template</button></FileDropZone>
    <input ref={single} type="file" accept=".docx" hidden onChange={e => {record('single', e.target.files); e.target.value='';}} />
    <FileDropZone className="busy" disabled><input type="file" accept=".pdf" onChange={e => record('busy', e.target.files)} /></FileDropZone>
    <FileDropZone className="outer"><input type="file" onChange={e => record('outer', e.target.files)} />
      <FileDropZone className="inner"><input type="file" onChange={e => record('inner', e.target.files)} /></FileDropZone>
    </FileDropZone>
    <DocumentUpload label="Existing shared uploader" onUpload={files => record('shared', files)} />
    <output>{JSON.stringify(events)}</output>
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
`);

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function drop(target, files) {
    const transfer = await page.evaluateHandle(files => {
      const transfer = new DataTransfer();
      files.forEach(file => transfer.items.add(new File([file.base64 ? Uint8Array.from(atob(file.base64), character => character.charCodeAt(0)) : file.text || 'synthetic evidence'], file.name, { type: file.type || '' })));
      return transfer;
    }, files);
    await target.dispatchEvent('dragover', { dataTransfer: transfer });
    await target.dispatchEvent('drop', { dataTransfer: transfer });
    await transfer.dispose();
  }
  await page.goto(base + '/tmp/file-drop-qa/index.html');
  await drop(page.locator('.multi'), [{ name: 'one.pdf' }, { name: 'two.pdf' }]);
  await expect(page.locator('output')).toHaveText('["multi:one.pdf,two.pdf"]');
  await drop(page.locator('.multi'), [{ name: 'bad.exe' }]);
  await expect(page.locator('.multi [role=alert]')).toContainText('supported file');
  await expect(page.locator('output')).toHaveText('["multi:one.pdf,two.pdf"]');
  // A failed drop must not break the picker or uploading the same file again.
  await page.locator('.multi input').setInputFiles({ name: 'one.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic') });
  await expect(page.locator('.multi [role=alert]')).toHaveCount(0);
  await drop(page.locator('.single'), [{ name: 'one.docx' }, { name: 'two.docx' }]);
  await expect(page.locator('.single [role=alert]')).toContainText('one file');
  await drop(page.locator('.single button'), [{ name: 'template.docx' }]);
  await drop(page.locator('.busy'), [{ name: 'ignored.pdf' }]);
  await drop(page.locator('.inner'), [{ name: 'nested.txt' }]);
  await drop(page.locator('.document-upload'), [{ name: 'shared.txt' }]);
  await expect(page.locator('output')).toHaveText('["multi:one.pdf,two.pdf","multi:one.pdf","single:template.docx","inner:nested.txt","shared:shared.txt"]');
  assert.equal(await page.evaluate(() => {
    const transfer = new DataTransfer(); transfer.items.add(new File(['test'], 'outside.txt'));
    const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer });
    document.body.dispatchEvent(event); return event.defaultPrevented;
  }), true, 'Dropping outside an uploader must not navigate away');

  // Exercise the actual wizard, including the authority and each attorney's own upload path.
  const bytes = await readFile(new URL('../sale-deed-template-v9.docx', import.meta.url));
  const version = { id: 'drop-test-v9', filename: 'Sale v9', instrumentId: 'sale', hash: createHash('sha256').update(bytes).digest('hex') };
  await page.route('**/api/templates', route => route.fulfill({ json: { active: { sale: version.id }, versions: [version] } }));
  await page.route('**/api/templates/versions/*/download', route => route.fulfill({ body: bytes }));
  await page.route('**/api/anthropic/**', route => route.fulfill({ status: 503, json: { error: { message: 'Synthetic test: AI disabled' } } }));
  await page.goto(base);
  await page.getByRole('button', { name: 'Create your first deed' }).click();
  await page.locator('.rail-step').first().click();
  await page.locator('.setup-fields select').nth(1).selectOption('sale-deed-by-gpa-holder');
  await page.locator('.rail-step').nth(6).click();
  await drop(page.locator('.authority-uploads').first(), [{ name: 'gpa.txt', type: 'text/plain' }]);
  await expect(page.getByRole('link', { name: 'gpa.txt', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add attorney', exact: true }).click();
  await drop(page.locator('.authority-uploads').nth(1), [{ name: 'attorney.txt', type: 'text/plain' }]);
  await expect(page.getByRole('link', { name: 'attorney.txt', exact: true })).toBeVisible();
  await expect(page.locator('.authority-uploads').first().getByRole('link')).toHaveCount(1);
  await expect(page.locator('.authority-uploads').nth(1).getByRole('link')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove attorney.txt', exact: true }).click();
  await expect(page.getByRole('link', { name: 'attorney.txt', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'gpa.txt', exact: true })).toHaveCount(1);
  await page.setViewportSize({ width: 375, height: 850 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: new URL('authority-mobile.png', folder).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.locator('.rail-step').nth(9).click();
  await page.locator('.template-choices input[type=radio]').nth(1).check();
  await drop(page.locator('.custom-template'), [{ name: 'custom-v9.docx', base64: bytes.toString('base64') }]);
  await expect(page.locator('.template-status.valid')).toContainText('custom-v9.docx');

  // Use mocked authenticated endpoints so testing a shared template drop writes nothing externally.
  await page.route('**/api/templates/session', route => route.fulfill({ json: { configured: true, authenticated: true, csrf: 'synthetic' } }));
  await page.route('**/api/templates/guide', route => route.fulfill({ json: { placeholders: [] } }));
  let revisions = 0;
  await page.route('**/api/templates/upload?**', route => { revisions++; return route.fulfill({ json: {} }); });
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await drop(page.locator('.template-actions[data-file-drop-zone]'), [{ name: 'shared-v9.docx', base64: bytes.toString('base64') }]);
  await expect(page.getByText(/Revision uploaded\. Review its validation report/)).toBeVisible();
  assert.equal(revisions, 1, 'Shared template drop must upload exactly once');

  for (const editor of ['reference-plan', 'exact-reference-plan']) {
    await page.goto(base + '/' + editor + '/index.html');
    const sample = await page.evaluate(async editor => {
      const module = await import('/' + editor + '/src/components/SavedPlansModal.tsx');
      return JSON.stringify({ ...module.SAMPLE_TEMPLATES[0], id: 'drop-import-' + editor, title: 'DROP IMPORT QA ' + editor });
    }, editor);
    if (editor === 'reference-plan') await page.locator('#btn-app-library').click();
    else await page.getByRole('button', { name: /^Saved \(/ }).click();
    await drop(page.locator('[data-file-drop-zone]').filter({ hasText: 'Import Plans JSON' }), [{ name: 'plans.json', type: 'application/json', text: sample }]);
    await expect(page.getByText('DROP IMPORT QA ' + editor, { exact: true })).toBeVisible();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: multiple drops, validation, picker fallback, busy state, nested drops, existing uploader, GPA/attorney isolation, mobile layout, custom/shared templates and JSON imports in both plan editors.');
} finally { await browser.close(); }
