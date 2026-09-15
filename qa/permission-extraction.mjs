import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', msg => console.log('[console]', msg.text()));
  await page.goto('http://localhost:5173');
  const file = process.argv[2] || '/Users/gangulapremsagar/Desktop/ai-projects/DEEDVS/docs/permission.pdf';
  const bytes = [...await readFile(file)];
  const result = await page.evaluate(async bytes => {
    const { extractUpload } = await import('/upload-extraction.ts');
    const data = await extractUpload(
      new File([new Uint8Array(bytes)], 'permission.pdf', { type: 'application/pdf' }),
      new AbortController().signal,
      () => {},
      undefined,
      'phase1:permissions'
    );
    return data;
  }, bytes);
  await mkdir('tmp/upload-first-qa', { recursive: true });
  await writeFile('tmp/upload-first-qa/permission-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    total: result.candidates.length,
    accepted: result.candidates.filter(c => c.status === 'accepted').map(c => ({ field: c.field, value: c.value })),
    uncertain: result.candidates.filter(c => c.status !== 'accepted').map(c => ({ field: c.field, value: c.value, status: c.status })),
    notes: result.notes,
  }, null, 2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
