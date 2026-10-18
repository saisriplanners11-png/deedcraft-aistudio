import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';

const rt = await loadTemplateRuntime();
const root = fileURLToPath(new URL('../', import.meta.url));
const out = root + 'tmp/v7-qa/';
await mkdir(out, { recursive: true });
const bytes = new Uint8Array(await readFile(root + 'sale-deed-template-v7.docx'));
const validation = await rt.validateSaleDeedTemplate(bytes);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.equal(validation.saleOpenings, true);
const source = { kind: 'custom', name: 'v7', hash: 'sample', bytes, validation };
const report = [];
const texts = {};
for (const [id, label, category, stage] of rt.saleMatrixCases) {
  const data = await rt.renderSample(id, source);
  const text = await rt.docxToText(data);
  texts[id] = text;
  assert.equal((text.match(/THIS SALE DEED is made/g) || []).length, 1, id);
  assert.equal((text.match(/^DECLARATION$/gm) || []).length, 1, id);
  assert.equal((text.match(/^SCHEDULE OF PROPERTY$/gm) || []).length, 1, id);
  assert.doesNotMatch(text, /<[^<>]+>|2026 at S\.R\.O\. .*2026 at S\.R\.O\./, id);
  assert.match(text, /15,00,000/, id);
  assert.doesNotMatch(text, /holding an undivided share of in/, id);
  assert.doesNotMatch(text, /holding an undivided share of 100%/, id);
  assert.match(text, /-10-2026/, id);
  assert.equal(text.includes('SAMPLE ATTORNEY'), !id.startsWith('ordinary-'), id);
  assert.equal(text.includes('AUTHORITY SRO'), !id.startsWith('ordinary-'), id);
  assert.equal(text.includes('Stamp Duty of Rs.50,000 adjusted'), id.startsWith('agpa-'), id);
  if (id.startsWith('gpa-')) assert.doesNotMatch(text, /A\.G\.P\.A\. Document|Agreement of Sale Cum General Power of Attorney Holder/i, id);
  const annexure = /ANNEXURE/.test(text);
  assert.equal(annexure, ['Residential', 'Flat'].includes(category), id);
  if (category === 'Flat') {
    assert.match(text, new RegExp(stage === 'Finished' ? 'All that a Finished Residential Flat' : 'All that a Semi-Finished Residential Flat'), id);
    assert.match(text, /Corridor/);
    assert.match(text, /Road/);
    assert.match(text, /75 sq.fts/i);
    assert.match(text, /5 years/);
  }
  if (category === 'Residential') assert.match(text, /800/);
  await writeFile(out + id.replace(':', '-') + '.docx', data);
  report.push({ id, label, bytes: data.length, passed: true });
}
for (const mode of ['ordinary', 'gpa', 'agpa']) assert.notEqual(texts[mode + '-house-finished'], texts[mode + '-house-semi'], 'House stage must select different source clauses');

async function render(state, selectedSource = source, filename) {
  const values = rt.mergeValues(state);
  const schedules = rt.scheduleMergesFor(state);
  const result = await rt.fillSaleDeed(values, schedules[0].variant, rt.rewritesFor(state), schedules, selectedSource);
  assert.deepEqual(result.unmapped, []);
  if (filename) await writeFile(out + filename + '.docx', new Uint8Array(await result.blob.arrayBuffer()));
  return rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
}
const multi = rt.sampleState('gpa-plot');
multi.additionalExecutants = [{ id: 'second-principal', docNames: [], values: { ...multi.form, executantName: 'SECOND PRINCIPAL' } }];
multi.additionalClaimants = [{ id: 'second-buyer', docNames: [], values: { ...multi.form, claimantName: 'SECOND BUYER' } }];
multi.saleAuthority.attorneys.push({ id: 'second-attorney', principalIds: ['second-principal'], values: { ...multi.saleAuthority.attorneys[0].values, Name: 'SECOND ATTORNEY' } });
multi.vendorSharesBySchedule = { primary: { primary: '50', 'second-principal': '50' } };
multi.vendeeSharesBySchedule = { primary: { primary: '50', 'second-buyer': '50' } };
assert.deepEqual(rt.saleAuthorityErrors(multi), []);
let text = await render(multi, source, 'linked-multiple-attorneys');
assert.match(text, /SECOND ATTORNEY \(representing SECOND PRINCIPAL\)/);
assert.match(text, /SAMPLE ATTORNEY \(representing SAMPLE VENDOR\)/);
assert.match(text, /SECOND BUYER/);
assert.equal((text.match(/the Principal owner\/s being alive/g) || []).length, 1);
const bad = structuredClone(multi);
bad.saleAuthority.attorneys[0].principalIds = ['deleted-principal'];
assert(rt.saleAuthorityErrors(bad).some(error => /removed principal/.test(error)));
assert(rt.saleAuthorityErrors({ ...bad, saleAuthority: undefined }).length > 0);
assert.deepEqual(rt.saleAuthorityErrors({ ...bad, saleDocument: 'ordinary' }), []);
const agpa = rt.sampleState('agpa-plot');
agpa.saleAuthority.adjustedAmount = '0';
assert.deepEqual(rt.saleAuthorityErrors(agpa), []);
agpa.saleAuthority.adjustedAmount = '-1';
assert(rt.saleAuthorityErrors(agpa).some(error => /adjusted/.test(error)));

const payments = rt.sampleState('ordinary-plot');
payments.payments = rt.MODES.map((mode, index) => ({ ...rt.newPayment(mode.key), amount: String(10000 + index), date: '2026-10-10', bank: 'TEST BANK', branch: 'DISTINCT BRANCH', refNo: 'REF-' + mode.key }));
text = await render(payments, source, 'all-payment-methods');
for (const mode of rt.MODES.filter(mode => mode.key !== 'cash' && mode.key !== 'through-bank')) assert(text.includes('REF-' + mode.key), mode.key);
assert.match(text, /TEST BANK, DISTINCT BRANCH Branch/);
assert.match(text, /REF-rtgs/);
assert.doesNotMatch(text, /Cell No:\s*[,.)]|PAN:\s*[,.)]/);

const mixed = rt.sampleState('multiple');
text = await render(mixed, source, 'mixed-multiple-parties-properties');
assert.equal((text.match(/SCHEDULE OF PROPERTY -/g) || []).length, 2);
assert.match(text, /holding an undivided share of Schedule 1: 50%; Schedule 2: 50%/i);
assert.doesNotMatch(text, /Holding Undivided Share of/);
assert.equal((text.match(/^DECLARATION$/gm) || []).length, 1);
const oldBytes = new Uint8Array(await readFile(root + 'sale-deed-template-v6.docx'));
const oldValidation = await rt.validateSaleDeedTemplate(oldBytes);
assert(oldValidation.valid, oldValidation.errors.join('\n'));
const oldSource = { ...source, name: 'v6', bytes: oldBytes, validation: oldValidation };
await render(rt.sampleState('ordinary-plot'), oldSource);
await assert.rejects(() => render(rt.sampleState('gpa-plot'), oldSource), /does not support/);
await assert.rejects(() => render(rt.sampleState('ordinary-house-semi'), oldSource), /Upgrade the draft/);

let draft = rt.newDraft();
draft = rt.draftReducer(draft, { type: 'instrument', instrumentId: 'sale', variantId: rt.saleVariant('agpa') });
draft = rt.draftReducer(draft, { type: 'sale-authority', value: multi.saleAuthority });
const restored = rt.appStateFor(JSON.parse(JSON.stringify(draft)), rt.resolveDraft(draft));
assert.equal(restored.saleDocument, 'agpa');
assert.deepEqual(restored.saleAuthority, multi.saleAuthority);
assert.match(rt.deedFilename(multi), /Sale-through-GPA-Vacant-Plot/);
await writeFile(out + 'report.json', JSON.stringify({ combinations: report, scenarios: ['multi-party linked authority', 'missing and stale authority', 'all payments', 'mixed schedules', 'v6 compatibility', 'draft round-trip'], passed: true }, null, 2));
console.log('PASS: all 24 sale/property combinations; linked parties, payments, missing details, mixed schedules, legacy compatibility and draft persistence.');
