import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  const source = process.argv[2] || '/Users/gangulapremsagar/Desktop/ai-projects/DEEDVS/docs/1-2016-1263.pdf';
  const profile = process.argv[3] || 'phase1:linkDoc';
  const bytes = [...await readFile(source)];
  const name = path.basename(source);
  const type = /\.pdf$/i.test(name) ? 'application/pdf' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : /\.webp$/i.test(name) ? 'image/webp' : 'image/png';
  const result = await page.evaluate(async ({ bytes, name, type, profile }) => {
    const file = new File([new Uint8Array(bytes)], name, { type });
    if (profile.startsWith('payment:')) {
      const { extractPayment } = await import('/payments.ts');
      return { payment: await extractPayment(profile.slice('payment:'.length), [file]) };
    }
    const { extractUpload } = await import('/upload-extraction.ts');
    const data = await extractUpload(file, new AbortController().signal, () => {}, undefined, profile);
    return {
      totalCandidates: data.candidates.length,
      linkCandidates: data.candidates.filter(c => c.role === 'link').map(c => ({ field: c.field, value: c.value, status: c.status, page: c.page })),
      propertyCandidates: data.candidates.filter(c => c.role === 'property').map(c => ({ field: c.field, value: c.value, status: c.status, page: c.page })),
      executantClaimantCandidates: data.candidates.filter(c => c.role === 'executant' || c.role === 'claimant').map(c => ({ field: c.field, role: c.role, record: c.record, status: c.status, historical: c.historical })),
    };
  }, { bytes, name, type, profile });
  await writeFile(`tmp/upload-first-qa/live-${name.replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '')}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(e.stack || e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
