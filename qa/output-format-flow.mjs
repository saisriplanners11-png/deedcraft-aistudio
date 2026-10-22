import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
await mkdir('tmp/output-format-qa', { recursive: true });
const properties = ['plot','open','dismantled','part','house-finished','house-semi','flat-finished','flat-semi'];
let count = 0;
for (const mode of ['ordinary','gpa','agpa','gift']) for (const property of properties) for (const relation of ['Near','Adjacent']) {
  const state = rt.sampleState(`${mode === 'gift' ? 'ordinary' : mode}-${property}`);
  if (mode === 'gift') state.deedType = 'Gift';
  const subject = ['dismantled','part'].includes(property);
  state.form = { ...state.form, executionDate: '2026-10-22', giftRelationship: 'daughter', consid: '765432', govtRate: '5000', extentSqYards: '200', nearAdjacent: relation, nearHNo: subject ? 'SUBJECT-42' : 'LANDMARK-99', landmarkHNo: 'LANDMARK-99' };
  const values = rt.mergeValues(state), schedules = rt.scheduleMergesFor(state);
  assert.equal(values['Market of Value Rs./-'], '7,65,432');
  const filename = mode === 'gift' ? 'gift-deed-template-v4.docx' : 'sale-deed-template-v10.docx';
  const bytes = new Uint8Array(await readFile(new URL(`../${filename}`, import.meta.url)));
  const validation = mode === 'gift' ? await rt.validateGiftDeedTemplate(bytes) : await rt.validateSaleDeedTemplate(bytes);
  assert(validation.valid, validation.errors.join(' '));
  for (const source of [{ kind: 'built-in' }, { kind: 'custom', name: filename, hash: 'synthetic', bytes, validation }]) {
    const result = mode === 'gift' ? await rt.fillGiftDeed(values, rt.rewritesFor(state), schedules, source) : await rt.fillSaleDeed(values, schedules[0].variant, rt.rewritesFor(state), schedules, source);
    const output = new Uint8Array(await result.blob.arrayBuffer());
    const text = await rt.docxToText(output);
    const context = `${mode}/${property}/${relation}/${source.kind}`;
    assert.deepEqual(result.unmapped, [], context);
    assert.match(text, /22-10-2026/, context);
    assert.doesNotMatch(text, /2026-10-22|DD-MM-YYYY|22102026/, context);
    assert.match(text, /7,65,432/, context);
    assert.doesNotMatch(text, /Rs\.\s*10,00,000/, context);
    const start = text.indexOf('SCHEDULE OF PROPERTY');
    const schedule = text.slice(start);
    const valuationAt = schedule.search(/STATEMENT OF MARKET VALUE|ANNEXURE/);
    assert(valuationAt >= 0, context);
    assert.match(schedule.slice(0, valuationAt), new RegExp(`${relation} house No\.\\s*LANDMARK-99`, 'i'), context);
    assert.match(schedule.slice(valuationAt), new RegExp(`${relation} house No\.[\\s:]*LANDMARK-99`, 'i'), context);
    assert.doesNotMatch(schedule, /near\s*\/\s*adjacent/i, context);
    if (subject) assert.match(schedule, /SUBJECT-42/, context);
    if (mode === 'gift') assert.match(text, /Consideration\s*: Nil|without any monetary consideration/, context);
    if (source.kind === 'built-in' && relation === 'Adjacent' && ['plot','house-finished','flat-finished'].includes(property)) await writeFile(`tmp/output-format-qa/${mode}-${property}.docx`, output);
    count++;
  }
}
console.log(`PASS: date, entered-value and landmark output policies in ${count} Sale/GPA/AGPA/Gift property/replacement combinations.`);
