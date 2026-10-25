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
    const packageEntries = await rt.readZip(output);
    const xml = new TextDecoder().decode(packageEntries.find(entry => entry.name === 'word/document.xml').data);
    const sections = xml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g) || [];
    assert(sections.length >= 2, `${context}: separate stamp and continuation sections`);
    assert.match(sections[0], /<w:pgMar\b[^>]*\bw:top="8208"/, `${context}: mandatory Sale-sized stamp space`);
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
    if (['plot', 'open'].includes(property)) assert.match(schedule.slice(valuationAt), new RegExp(`${relation} house No\.[\\s:]*LANDMARK-99`, 'i'), context);
    else assert.doesNotMatch(schedule.slice(valuationAt), /(?:near|adjacent)\s+(?:house\s*no\.?|h\.?no\.?)/i, context);
    assert.doesNotMatch(schedule, /near\s*\/\s*adjacent/i, context);
    if (subject) assert.match(schedule, /SUBJECT-42/, context);
    if (mode === 'gift') assert.match(text, /Consideration\s*: Nil|without any monetary consideration/, context);
    if (source.kind === 'built-in' && relation === 'Adjacent' && ['plot','house-finished','flat-finished'].includes(property)) await writeFile(`tmp/output-format-qa/${mode}-${property}.docx`, output);
    count++;
  }
}
console.log(`PASS: stamp-space, date, entered-value and landmark output policies in ${count} Sale/GPA/AGPA/Gift property/replacement combinations.`);

// An agricultural schedule shares the plot template but is not an Open Plot.
const agricultural = rt.sampleState('ordinary-plot'); agricultural.category = 'Agricultural land';
Object.assign(agricultural.form, { nearAdjacent: 'Near', nearHNo: 'AGRI-LANDMARK-77' });
const agriculturalSchedules = rt.scheduleMergesFor(agricultural);
const agriculturalOutput = await rt.fillSaleDeed(rt.mergeValues(agricultural), agriculturalSchedules[0].variant, rt.rewritesFor(agricultural), agriculturalSchedules);
const agriculturalText = await rt.docxToText(new Uint8Array(await agriculturalOutput.blob.arrayBuffer()));
assert.match(agriculturalText.split('STATEMENT OF MARKET VALUE')[0], /near house No\.AGRI-LANDMARK-77/i);
assert.doesNotMatch(agriculturalText.split('STATEMENT OF MARKET VALUE')[1], /near\s+house/i);

// Replacement templates may already contain a fixed landmark row in Annexure I-A.
const giftSource = new Uint8Array(await readFile(new URL('../gift-deed-template-v4.docx', import.meta.url)));
const giftEntries = await rt.readZip(giftSource), giftDocument = giftEntries.find(entry => entry.name === 'word/document.xml');
giftDocument.data = new TextEncoder().encode(new TextDecoder().decode(giftDocument.data).replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, table => table.includes('Annual Rental Value') ? table.replace('</w:tbl>', '<w:tr><w:tc><w:p><w:r><w:t>near house No.</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>FIXED-LANDMARK-999</w:t></w:r></w:p></w:tc></w:tr></w:tbl>') : table));
const customGiftBytes = await rt.writeZip(giftEntries);
const flatGift = rt.sampleState('ordinary-flat-finished'); flatGift.deedType = 'Gift';
Object.assign(flatGift.form, { giftRelationship: 'daughter', nearAdjacent: '', nearHNo: '' });
const flatGiftOutput = await rt.fillGiftDeed(rt.mergeValues(flatGift), rt.rewritesFor(flatGift), rt.scheduleMergesFor(flatGift), { kind: 'custom', name: 'Gift with existing Annexure row.docx', bytes: customGiftBytes, hash: 'fixed-landmark', validation: await rt.validateGiftDeedTemplate(customGiftBytes) });
const flatGiftText = await rt.docxToText(new Uint8Array(await flatGiftOutput.blob.arrayBuffer()));
assert.doesNotMatch(flatGiftText, /FIXED-LANDMARK-999/);
assert.match(flatGiftText, /Annual Rental Value/); assert.match(flatGiftText, /estimate M\.V\./i);
console.log('PASS: agricultural valuation exclusions and removal of pre-existing replacement-template landmark rows while retaining Annexure I-A valuation points.');
