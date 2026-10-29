import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const bytes = new Uint8Array(await readFile(new URL('../general-poa-template-v3.docx', import.meta.url)));
assert.equal(createHash('sha256').update(bytes).digest('hex'), '88cb8180abd6257a82a94888db4abda301012986fab37833110adb4c1965cb4c');
const validation = await rt.validateGeneralPoaTemplate(bytes);
assert.equal(validation.valid, true, validation.errors.join('\n'));
const reference = await rt.readZip(bytes);
await mkdir('tmp/general-poa-qa', { recursive: true });
const variants = ['general-power-of-attorney', 'general-power-of-attorney-family'];
const properties = ['plot', 'open', 'part', 'dismantled', 'house-finished', 'house-semi', 'flat-finished', 'flat-semi', 'commercial-finished', 'commercial-semi'];
const sample = (property, family = false) => {
  const state = rt.sampleState('ordinary-' + property.replace('commercial-', 'house-'));
  if (property.startsWith('commercial-')) state.category = 'Commercial';
  state.deedType = 'GPA/Power of Attorney';
  state.draft = family ? 'General Power of Attorney Family' : 'General Power of Attorney';
  Object.assign(state.form, { poaRelationship: family ? 'son' : '', executionDate: '2026-10-24', consid: '765432', nearAdjacent: 'Adjacent', nearHNo: 'LANDMARK-99', landmarkHNo: 'LANDMARK-99', bearingHNo: 'SUBJECT-42', executantPan: 'ABCDE1234F', claimantPan: 'PQRST5678L', linkDocNo: 'TITLE-44', linkDocDate: '2026-10-01', linkDocType: 'Sale Deed', linkSro: 'TITLE SRO', govtRate: '5000' });
  return state;
};
const render = async (state, variantId, source = { kind: 'built-in' }) => rt.renderArtifact(rt.compileDeed({ instrumentId: 'power_of_attorney', variantId, snapshotHash: 'synthetic', values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] }, source), 'docx');
let count = 0;
for (const property of properties) for (const variant of variants) for (const custom of [false, true]) {
  const state = sample(property, variant === variants[1]);
  const source = custom ? { kind: 'custom', bytes, hash: 'synthetic-source', name: 'replacement.docx', validation } : { kind: 'built-in' };
  const { result, manifest } = await render(state, variant, source);
  assert.deepEqual(result.unmapped, []);
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const entries = await rt.readZip(output);
  const xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml').data);
  const text = await rt.docxToText(output);
  assert.match(text, /^GENERAL POWER OF ATTORNEY/);
  assert.match(text, new RegExp(`appoint my ${variant === variants[1] ? 'son' : 'friend'} SAMPLE PURCHASER as`));
  assert.equal((text.match(/WHEREAS, (?:I|We) have full confidence/g) || []).length, 1);
  assert.match(text, /24-10-2026/); assert.match(text, /01-10-2026/); assert.match(text, /TITLE-44/);
  assert.match(text, /Rs.7,65,432/); assert.match(text, /ABCDE1234F/); assert.match(text, /PQRST5678L/);
  assert.doesNotMatch(text, /DD-MM-YYYY|<IF |<Friend|VENDOR\/S|VENDEE\/S|AGREEMENT OF SALE-CUM/);
  assert.equal((text.match(/SCHEDULE OF PROPERTY/g) || []).length, 1);
  assert.match(text.slice(text.indexOf('SCHEDULE OF PROPERTY')), /adjacent house No.[\s:]*LANDMARK-99/i);
  assert.match(xml, /w:top="8208"/);
  assert.equal((xml.match(/<w:trHeight w:val="2800"/g) || []).length, 2);
  const form = text.slice(text.indexOf('PHOTOGRAPHS AND FINGERPRINTS'));
  assert(form.indexOf('SAMPLE VENDOR') < form.indexOf('SAMPLE PURCHASER'));
  for (const entry of reference.filter(entry => !['word/document.xml', 'word/_rels/document.xml.rels', '[Content_Types].xml'].includes(entry.name))) assert.deepEqual(entries.find(item => item.name === entry.name)?.data, entry.data, entry.name);
  if (!custom) {
    assert.equal(manifest.templateVersionId, 'general-poa-v3');
    if (['plot', 'house-finished', 'flat-finished'].includes(property)) await writeFile(`tmp/general-poa-qa/${property}-${variant === variants[1] ? 'family' : 'friend'}.docx`, output);
  }
  count++;
}
const state = sample('plot', true);
state.form.claimantName = 'ATTORNEY ONE';
state.additionalClaimants = [{ id: 'attorney-two', docNames: [], values: { ...state.form, claimantName: 'ATTORNEY TWO', poaRelationship: 'daughter' } }, { id: 'attorney-three', docNames: [], values: { ...state.form, claimantName: 'ATTORNEY THREE', poaRelationship: 'other', poaRelationshipCustom: 'nephew' } }];
state.additionalExecutants = [{ id: 'principal-two', docNames: [], values: { ...state.form, executantName: 'PRINCIPAL TWO' } }];
state.additionalSchedules = [{ id: 'schedule-two', docNames: [], category: 'Open Place', values: { ...state.form, village: 'SECOND VILLAGE' } }];
const { result } = await render(state, variants[1]);
const output = new Uint8Array(await result.blob.arrayBuffer()), text = await rt.docxToText(output);
const outputEntries = await rt.readZip(output);
const outputXml = new TextDecoder().decode(outputEntries.find(entry => entry.name === 'word/document.xml').data);
const closingTable = [...outputXml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)].map(match => match[0]).find(table => /EXECUTANTS/.test(table) && /WITNESSES/.test(table) && !/PHOTOGRAPHS/.test(table));
assert(closingTable, 'retain the supplied deed signature and witness table');
const closingParagraphs = [...closingTable.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(match => match[0]);
assert(closingParagraphs.slice(0, -1).every(paragraph => /<w:keepNext\b/.test(paragraph)), 'keep witness numbers with their heading and deed signature');
assert.doesNotMatch(closingParagraphs.at(-1), /<w:keepNext\b/, 'do not attach deed witnesses to the next Section 32A page');
assert.match(text, /appoint my son ATTORNEY ONE, daughter ATTORNEY TWO and nephew ATTORNEY THREE as/);
assert.equal((text.match(/WHEREAS, (?:I|We) have full confidence/g) || []).length, 1);
assert.equal((text.match(/SCHEDULE OF PROPERTY/g) || []).length, 2);
assert.doesNotMatch(text, /VENDOR\/S|VENDEE\/S/);
const form = text.slice(text.indexOf('PHOTOGRAPHS AND FINGERPRINTS'));
let previous = -1;
for (const person of ['SAMPLE VENDOR', 'PRINCIPAL TWO', 'ATTORNEY ONE', 'ATTORNEY TWO', 'ATTORNEY THREE']) { assert(form.indexOf(person) > previous, person); previous = form.indexOf(person); assert.equal(form.split(person).length - 1, 1); }
await writeFile('tmp/general-poa-qa/multiple-family.docx', output);
state.additionalClaimants[1].values.poaRelationshipCustom = '';
await assert.rejects(() => render(state, variants[1]), /family relationship/);
state.draft = 'General Power of Attorney';
const ordinary = await render(state, variants[0]);
assert.match(await rt.docxToText(new Uint8Array(await ordinary.result.blob.arrayBuffer())), /appoint my friend ATTORNEY ONE, friend ATTORNEY TWO and friend ATTORNEY THREE as/);
for (const removed of ['Friend/Relationship', 'Executant PAN', 'TO SELL AND CONVEY', 'TO RECEIVE', 'Registered Deed:']) {
  const damaged = await rt.readZip(bytes), document = damaged.find(entry => entry.name === 'word/document.xml');
  document.data = new TextEncoder().encode(new TextDecoder().decode(document.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => rt.replaceRunText(paragraph, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), () => 'REMOVED')));
  const incompatible = await rt.writeZip(damaged);
  assert.equal((await rt.validateGeneralPoaTemplate(incompatible)).valid, false, removed);
}
console.log(`PASS: General/Family GPA ${count} property and template combinations, mixed attorney relationships, ordered Section 32A, multiple properties, source package preservation and incompatible-template rejection.`);
