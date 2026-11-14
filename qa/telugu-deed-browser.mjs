import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  if (!process.env.LIVE_TRANSLATION) {
    await page.route('**/api/anthropic/v1/messages', route => {
      const source = JSON.parse(route.request().postDataJSON().messages[0].content);
      const translations = source.map(text =>
        text.replace(/⟦\/?[FSV]\d+⟧|[A-Za-z]+/g, token => token.startsWith('⟦') ? token : 'తెలుగు'));
      return route.fulfill({ json: {
        id: 'translation-test', type: 'message', role: 'assistant', model: 'test', stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify({ translations }) }],
      } });
    });
  }
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5198');
  await page.getByRole('button', { name: 'Create your first deed' }).click();
  await page.locator('.registration-steps button').nth(9).click();
  await page.getByLabel(/include typed by stamp/i).check();
  const stamp = page.locator('.typing-stamp-fields');
  await stamp.getByLabel('Name', { exact: true }).fill('Demo Typist');
  await stamp.getByLabel('Place (optional)', { exact: true }).fill('Sircilla');
  await stamp.getByLabel(/mobile number/i).fill('9876543210');
  const download = async name => {
    await page.getByRole('button', { name, exact: true }).click();
    const warning = page.getByRole('button', { name: 'Download Anyway' });
    await warning.waitFor();
    const downloaded = page.waitForEvent('download', { timeout: 180_000 });
    const failed = page.getByText(/^Telugu Word download could not be prepared:/).waitFor({ timeout: 180_000 })
      .then(async () => { throw new Error(await page.getByText(/^Telugu Word download could not be prepared:/).textContent()); });
    const outcome = Promise.race([downloaded, failed]);
    await warning.click();
    const file = await outcome;
    const bytes = await readFile(await file.path());
    return { name: file.suggestedFilename(), bytes: Array.from(bytes) };
  };
  const english = await download('Download Word 2007 deed (.docx)');
  const telugu = await download('Download Telugu Word deed (.docx)');
  assert.match(telugu.name, /[ -]Telugu\.docx$/);
  assert.notEqual(english.name, telugu.name);
  const output = await page.evaluate(async ([english, telugu]) => {
    const { readZip, writeZip } = await import('/docx.ts');
    const { translateDeedToTelugu } = await import('/telugu-deed.ts');
    const decode = bytes => new TextDecoder().decode(bytes);
    const document = async bytes => decode((await readZip(new Uint8Array(bytes))).find(p => p.name === 'word/document.xml').data);
    const parts = await writeZip([
      { name: 'word/document.xml', data: new TextEncoder().encode('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Anu Devi of Sircilla transferred the property numbered </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>123/A</w:t></w:r></w:p></w:body></w:document>') },
      { name: 'word/media/plan.png', data: new Uint8Array([1, 2, 3]) },
    ]);
    let calls = 0;
    const test = await translateDeedToTelugu(new Blob([parts]), [], async ([source]) => {
      if (++calls === 1) return ['తెలుగు'];
      if (!source.includes('⟦V0⟧') || !source.includes('⟦F1⟧⟦V2⟧⟦/F1⟧')) throw new Error('Lost protected identifiers before translation');
      return ['ఆస్తి సంఖ్య ⟦F1⟧⟦V2⟧⟦/F1⟧ ను ⟦V1⟧ నివాసి ⟦V0⟧ బదిలీ చేశారు.'];
    }, ['Anu Devi', 'Sircilla']);
    const entries = await readZip(new Uint8Array(await test.arrayBuffer()));
    return {
      english: await document(english), telugu: await document(telugu),
      fixture: decode(entries[0].data), media: Array.from(entries[1].data), calls,
    };
  }, [english.bytes, telugu.bytes]);
  assert.match(output.english, /SALE DEED/i);
  assert.match(output.telugu, /[\u0c05-\u0c39]/u);
  for (const xml of [output.english, output.telugu]) {
    assert.match(xml, /98765 43210/);
  }
  assert.match(output.english, /DEMO TYPIST/);
  assert.match(output.english, /Sircilla/);
  assert.doesNotMatch(output.telugu, /DEMO TYPIST|Sircilla/i);
  assert.match(output.telugu, /సిరిసిల్ల/);
  assert.equal((output.telugu.match(/<w:sectPr\b/g) || []).length, (output.english.match(/<w:sectPr\b/g) || []).length);
  assert.match(output.fixture, /<w:b\s*\/>.*?123\/A.*?అను దేవి/s);
  assert.doesNotMatch(output.fixture, /Anu Devi|Sircilla/);
  assert.match(output.fixture, /సిరిసిల్ల నివాసి అను దేవి/);
  assert.match(output.fixture, /w:cs="Times New Roman"/);
  assert.match(output.fixture, /w:hint="cs"/);
  assert.deepEqual(output.media, [1, 2, 3]);
  assert.equal(output.calls, 2);
  console.log('PASS: separate English and Telugu Word downloads, formatting and protected values, retry, plan media.');
  await page.close();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
