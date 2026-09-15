import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DOCS_DIR = '/Users/gangulapremsagar/Desktop/ai-projects/DEEDVS/docs';
const files = [
  '1-2016-1263.pdf',
  'Dad Aadhar.PDF',
  'Adhar.jpg',
  'House Tax.jpeg',
  'NALA.jpeg',
  'PPB.jpeg',
  'permission.pdf',
  'ELECTRICITY.jpeg',
  'cheq.jpeg',
  'plan.jpeg',
];

const mime = name => {
  const ext = name.toLowerCase().split('.').pop();
  return { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[ext] || 'application/octet-stream';
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
  page.on('pageerror', err => console.error('[pageerror]', err.message));
  await page.goto('http://localhost:5173');

  const payload = await Promise.all(files.map(async name => ({
    name,
    type: mime(name),
    bytes: [...await readFile(path.join(DOCS_DIR, name))],
  })));

  console.error('Uploading', payload.length, 'files, extracting sequentially...');

  const result = await page.evaluate(async payload => {
    const { extractUpload } = await import('/upload-extraction.ts');
    const s = await import('/source-draft.ts');
    const sources = [];
    for (const item of payload) {
      const file = new File([new Uint8Array(item.bytes)], item.name, { type: item.type });
      const t0 = performance.now();
      try {
        const data = await extractUpload(file, new AbortController().signal, () => {});
        sources.push({ id: item.name, revision: 0, hash: item.name, status: 'done', name: item.name, result: data, ms: performance.now() - t0 });
      } catch (e) {
        sources.push({ id: item.name, revision: 0, hash: item.name, status: 'error', name: item.name, error: String(e && e.message || e), ms: performance.now() - t0 });
      }
    }
    const draft = { ...s.newDraft(), sources };
    const resolved = s.resolveDraft(draft);
    const state = s.appStateFor(draft);
    return { sources, resolved, state };
  }, payload);

  await mkdir('tmp/upload-first-qa', { recursive: true });
  await writeFile('tmp/upload-first-qa/repro-full-bundle-result.json', JSON.stringify(result, null, 2));

  const summary = {
    perFile: result.sources.map(s => ({
      name: s.name, status: s.status, seconds: Math.round((s.ms || 0) / 1000),
      accepted: s.result ? s.result.candidates.filter(c => c.status === 'accepted').length : 0,
      uncertain: s.result ? s.result.candidates.filter(c => c.status !== 'accepted').length : 0,
      plans: s.result ? s.result.plans.length : 0,
      notes: s.result ? s.result.notes : s.error,
    })),
    resolvedValues: result.resolved.values,
    unassigned: result.resolved.unassigned.map(c => ({ field: c.field, role: c.role, record: c.record, value: c.value, source: c.sourceName })),
    conflicts: Object.fromEntries(Object.entries(result.resolved.conflicts).map(([k, v]) => [k, v.map(c => ({ value: c.value, source: c.sourceName }))])),
    form: result.state.form,
    additionalExecutants: result.state.additionalExecutants,
    additionalClaimants: result.state.additionalClaimants,
  };
  console.log(JSON.stringify(summary, null, 2));
} catch (e) {
  console.error(e.stack || e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
