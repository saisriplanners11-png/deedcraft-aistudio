import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DOCS_DIR = '/Users/gangulapremsagar/Desktop/ai-projects/DEEDVS/docs';
const OUT_DIR = 'tmp/upload-first-qa/real-case';
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
    const m = await import('/merge.ts');
    const d = await import('/docx.ts');
    const p = await import('/registration-plan.tsx');
    const l = await import('/logic.ts');

    const sources = [];
    for (const item of payload) {
      const file = new File([new Uint8Array(item.bytes)], item.name, { type: item.type });
      try {
        const data = await extractUpload(file, new AbortController().signal, () => {});
        sources.push({ id: item.name, revision: 0, hash: item.name, status: 'done', name: item.name, result: data });
      } catch (e) {
        sources.push({ id: item.name, revision: 0, hash: item.name, status: 'error', name: item.name, error: String(e && e.message || e) });
      }
    }
    // Manual resolutions a real drafter would make in the Claimants screen, via
    // the new "who are these people?" pop-up: the 2016 link deed's own vendor
    // (a stranger to this sale) and vendee (Gangula Rajender, who bought the
    // land then and is selling it now) are both held back as unassigned by
    // design; the drafter confirms Gangula Rajender as today's executant and
    // Gangula Premsagar (from his own Aadhaar, also unassigned until confirmed)
    // as today's claimant. The old vendor is left unassigned and unused.
    let draft = { ...s.newDraft(), sources };
    const resolvedBefore = s.resolveDraft(draft);
    const assignments = [
      { record: 'GANGULA RAJENDER', role: 'executant' },
      { record: 'Gangula Rajender', role: 'executant' },
      { record: 'Gangula Premsagar', role: 'claimant' },
    ];
    for (const { record, role } of assignments) {
      const match = resolvedBefore.unassigned.find(c => c.record === record);
      if (match) draft = { ...draft, sources: draft.sources.map(src => src.id === match.sourceId ? { ...src, assignment: { role, record: 'primary', fromRecord: match.record } } : src) };
    }
    const resolved = s.resolveDraft(draft);
    // Category conflict: NALA (2021, still agricultural) vs. building permit
    // (2020 sanctioned construction) vs. link deed (2016, vacant). The permit is
    // the most recent evidence that the plot now carries a house.
    const categoryKey = Object.keys(resolved.conflicts).find(k => k.endsWith('|category'));
    if (categoryKey) draft = { ...draft, manual: { ...draft.manual, [categoryKey]: 'Residential' } };
    const finalResolved = s.resolveDraft(draft);
    const state = s.appStateFor(draft);

    const propertyRecords = l.scheduleRecords(state);
    const propertyIds = [...new Set(Object.keys(finalResolved.values).filter(k => k.startsWith('property|') && !k.startsWith('property|transaction|')).map(k => k.split('|')[1]))];
    const previews = propertyRecords.map((record, i) => {
      const id = propertyIds[i] || 'primary';
      const plans = s.plansFor(draft, id);
      const unique = [...new Map(plans.map(plan => [JSON.stringify(plan.drawing), plan])).values()];
      const form = { ...m.propertyForm(state, record.values), category: record.category };
      const values = m.mergeValues({ ...state, form, unit: record.unit, additionalSchedules: [] });
      form.extentSqYards = values['Extent in Sq.yards']; form.extentSqMeters = values['Extent in Sq.Meters'];
      try {
        return { id, svg: p.registrationPlanSvg(form, unique.length === 1 ? unique[0].drawing : null, { vendors: l.partyRecords(state, 'executant').map(r => r.values), buyers: l.partyRecords(state, 'claimant').map(r => r.values) }), error: '' };
      } catch (error) { return { id, svg: '', error: error.message }; }
    });
    const errors = previews.filter(pr => pr.error).map(pr => pr.error);
    const pngs = errors.length ? [] : await Promise.all(previews.map(pr => p.planPng(pr.svg)));
    const merged = errors.length ? null : await d.fillSaleDeed(m.mergeValues(state), m.variantFor(state.category), m.rewritesFor(state), m.scheduleMergesFor(state), pngs);
    const pdf = errors.length ? null : await p.planPdf(pngs);
    const blockers = l.generationBlockers(state);

    return {
      form: state.form,
      unassignedBefore: resolvedBefore.unassigned.map(c => ({ record: c.record, field: c.field, value: c.value, source: c.sourceName })),
      conflictsBefore: Object.fromEntries(Object.entries(resolvedBefore.conflicts).map(([k, v]) => [k, v.map(c => c.value)])),
      finalConflicts: Object.fromEntries(Object.entries(finalResolved.conflicts).map(([k, v]) => [k, v.map(c => c.value)])),
      previewErrors: errors,
      docxMissing: merged ? merged.missing : null,
      docxUnmapped: merged ? merged.unmapped : null,
      docxBytes: merged ? [...new Uint8Array(await merged.blob.arrayBuffer())] : null,
      pdfBytes: pdf ? [...new Uint8Array(await pdf.arrayBuffer())] : null,
      blockers: blockers.map(b => b.label),
    };
  }, payload);

  await mkdir(OUT_DIR, { recursive: true });
  if (result.docxBytes) await writeFile(path.join(OUT_DIR, 'Sale-Deed-Gangula-Rajender-to-Premsagar.docx'), Buffer.from(result.docxBytes));
  if (result.pdfBytes) await writeFile(path.join(OUT_DIR, 'Sale-Deed-Gangula-Rajender-to-Premsagar-plan.pdf'), Buffer.from(result.pdfBytes));
  delete result.docxBytes; delete result.pdfBytes;
  await writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(e.stack || e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
