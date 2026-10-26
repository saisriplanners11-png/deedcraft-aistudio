import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';

// Exercise the actual compiler and DOCX renderer without spending extraction credits.
const bundled = await build({ stdin: { contents: "export {DEED_DEFINITIONS} from './instruments'; export {releaseGate} from './legal-registry';", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { DEED_DEFINITIONS, releaseGate } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const rt = await loadTemplateRuntime();
const properties = ['plot', 'open', 'part', 'dismantled', 'house-finished', 'house-semi', 'flat-finished', 'flat-semi', 'commercial-finished', 'commercial-semi', 'agricultural'];
const rows = [];
let generated = 0, blocked = 0;
for (const definition of Object.values(DEED_DEFINITIONS)) for (const variant of definition.variants) {
  const gate = releaseGate(definition.id, variant.id);
  const row = { instrument: definition.id, variant: variant.id, label: variant.label, status: gate.ready ? 'generated' : 'reference-required', properties: [] };
  if (!gate.ready) {
    assert.throws(() => rt.compileDeed({ instrumentId: definition.id, variantId: variant.id, values: {}, schedules: [], snapshotHash: 'synthetic', unresolvedWarnings: [] }), /approved legal reference|immutable template/);
    blocked++;
  } else for (const property of properties) {
    const mode = variant.id === 'sale-deed-by-gpa-holder' ? 'gpa' : variant.id === 'sale-through-existing-agpa' ? 'agpa' : 'ordinary';
    const state = rt.sampleState(mode + '-' + (property === 'agricultural' ? 'plot' : property.replace('commercial-', 'house-')));
    if (property.startsWith('commercial-')) state.category = 'Commercial';
    if (property === 'agricultural') state.category = 'Agricultural land';
    if (!gate.reference.propertyCategories.includes(state.category)) continue;
    state.deedType = definition.legacyType;
    state.draft = variant.id === 'municipal-gift' ? 'Municipal Gift' : variant.label;
    Object.assign(state.form, { giftRelationship: 'daughter', poaRelationship: 'son', localAuthorityType: 'Municipal Council', govtRate: '5000', executantPan: 'ABCDE1234F', claimantPan: 'PQRST5678L' });
    state.linkRecordsBySchedule = { primary: [{ id: 'title', docNames: [], values: { linkDocType: 'Sale Deed', linkDocNo: 'TITLE-111', linkDocDate: '2020-01-02', linkSro: 'TITLE OFFICE', linkSroCode: '111' } }] };
    const compiled = rt.compileDeed({ instrumentId: definition.id, variantId: variant.id, snapshotHash: 'synthetic', values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] });
    const { result, manifest } = await rt.renderArtifact(compiled, 'docx');
    assert.deepEqual(result.unmapped, [], variant.id + '/' + property);
    assert.equal(manifest.templateVersionId, gate.reference.templateVersionId);
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    assert((await rt.readZip(bytes)).some(entry => entry.name === 'word/document.xml'));
    const text = await rt.docxToText(bytes);
    assert.match(text, /SAMPLE VENDOR/);
    assert.match(text, /SAMPLE PURCHASER/);
    row.properties.push(property); generated++;
  }
  rows.push(row);
}
await mkdir('tmp/dashboard-qa', { recursive: true });
await writeFile('tmp/dashboard-qa/deed-matrix.json', JSON.stringify({ instruments: Object.keys(DEED_DEFINITIONS).length, variants: rows.length, generated, blocked, rows }, null, 2));
console.log(`PASS: ${Object.keys(DEED_DEFINITIONS).length} instruments, ${rows.length} catalogue variants, ${generated} generated DOCX cases, ${blocked} missing-reference variants safely blocked.`);
