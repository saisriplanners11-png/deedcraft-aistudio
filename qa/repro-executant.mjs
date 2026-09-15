import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
  await page.goto('http://localhost:5173');
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node qa/repro-executant.mjs /path/to/plan-for-registration.jpeg');
  const bytes = [...await readFile(file)];
  const result = await page.evaluate(async bytes => {
    const { extractUpload } = await import('/upload-extraction.ts');
    const s = await import('/source-draft.ts');
    const start = performance.now();
    const data = await extractUpload(new File([new Uint8Array(bytes)], 'plan-for-registration.jpeg', { type: 'image/jpeg' }), new AbortController().signal, () => {});
    const draft = { ...s.newDraft(), sources: [{ id: 'reference', revision: 0, hash: 'reference', status: 'done', name: 'plan-for-registration.jpeg', result: data }] };
    const resolved = s.resolveDraft(draft);
    const state = s.appStateFor(draft);
    return { data, resolved, state, ms: performance.now() - start };
  }, bytes);
  await mkdir('tmp/upload-first-qa', { recursive: true });
  await writeFile('tmp/upload-first-qa/repro-executant-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    seconds: Math.round(result.ms / 1000),
    candidates: result.data.candidates.map(c => ({ field: c.field, role: c.role, record: c.record, value: c.value, status: c.status })),
    notes: result.data.notes,
    resolvedValues: result.resolved.values,
    unassigned: result.resolved.unassigned.map(c => ({ field: c.field, role: c.role, record: c.record, value: c.value })),
    conflicts: result.resolved.conflicts,
    executantName: result.state.form.executantName,
    claimantName: result.state.form.claimantName,
  }, null, 2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
