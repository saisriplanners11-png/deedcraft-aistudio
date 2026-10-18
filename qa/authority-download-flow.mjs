import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const bytes = new Uint8Array(await readFile(new URL('../sale-deed-template-v10.docx', import.meta.url)));
const source = { kind: 'custom', name: 'Updated Word draft', hash: '', bytes, validation: await rt.validateSaleDeedTemplate(bytes) };
for (const mode of ['gpa', 'agpa']) {
  let draft = rt.draftReducer(rt.newDraft(), { type: 'instrument', instrumentId: 'sale', variantId: mode === 'gpa' ? 'sale-deed-by-gpa-holder' : 'sale-through-existing-agpa' });
  const sample = rt.sampleState(mode + '-plot');
  const extracted = rt.cleanAuthorityRead({ kind: 'authority', details: {}, people: [
    ...['ONE', 'TWO'].map((suffix, index) => ({ role: 'principal', values: { Name: `OWNER ${suffix}`, Relation: 'W/O', RelativeName: `OWNER PARENT ${suffix}`, Age: '45', Aadhaar: index ? '222233334444' : '333344445555', Village: `OWNER VILLAGE ${suffix}` }, quote: `Principal OWNER ${suffix}` })),
    ...['ONE', 'TWO'].map((suffix, index) => ({ role: 'attorney', values: { Name: `AGENT ${suffix}`, Relation: 'S/O', RelativeName: `AGENT PARENT ${suffix}`, Age: '40', Aadhaar: index ? '555566667777' : '666677778888', Village: `AGENT VILLAGE ${suffix}` }, principalNames: [`OWNER ${suffix}`], quote: `AGENT ${suffix} represents OWNER ${suffix}` })),
  ] }, 'Synthetic authority', 1);
  draft.saleAuthority = { ...sample.saleAuthority, attorneys: [], extractions: [{ ...extracted, id: 'read', documentIds: ['authority'] }] };
  for (const [index, person] of extracted.people.entries()) draft = rt.applyAuthorityPerson(draft, person, person.role, index === 0 ? 'primary' : index === 1 ? 'owner-two' : `agent-${index}`);
  draft = rt.draftReducer(draft, { type: 'manual', key: 'executant|primary|executantVillage', value: 'MANUAL OWNER VILLAGE' });
  draft = rt.draftReducer(draft, { type: 'add', source: { id: 'support', name: 'old.pdf', hash: 'old', revision: 0, status: 'queued' } });
  const before = structuredClone(draft);
  draft = rt.draftReducer(draft, { type: 'replace', id: 'support', name: 'replacement.pdf' });
  draft = rt.draftReducer(rt.newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) });
  assert.deepEqual(draft.manual, before.manual);
  assert.deepEqual(draft.saleAuthority, before.saleAuthority);
  const restored = rt.appStateFor(draft);
  const state = { ...sample, ...restored, form: { ...sample.form, ...restored.form }, saleAuthority: restored.saleAuthority };
  const render = async template => {
    const schedules = rt.scheduleMergesFor(state);
    const result = await rt.fillSaleDeed(rt.mergeValues(state), schedules[0].variant, rt.rewritesFor(state), schedules, template);
    assert.deepEqual(result.unmapped, []);
    return rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
  };
  for (const template of [source, { kind: 'built-in' }]) {
    const text = await render(template);
    for (const expected of ['OWNER ONE', 'OWNER TWO', 'AGENT ONE', 'AGENT TWO', 'OWNER PARENT ONE', 'AGENT PARENT TWO', '333344445555', '555566667777', 'MANUAL OWNER VILLAGE', 'AGENT VILLAGE TWO', 'AUTH-42', 'AUTHORITY SRO']) assert(text.includes(expected), `${mode}: missing ${expected}`);
    assert.match(text, /AGENT ONE \(representing OWNER ONE\)/);
    assert.match(text, /AGENT TWO \(representing OWNER TWO\)/);
    const declaration = text.slice(text.lastIndexOf('DECLARATION'));
    assert(declaration.includes(mode === 'gpa' ? 'G.P.A. HOLDER OF' : 'A.G.P.A. HOLDER OF'));
    assert(declaration.includes('OWNER ONE, OWNER TWO'));
    assert.doesNotMatch(text, /(?:Holding Undivided Share|share of)\s*50%/i);
    assert.doesNotMatch(text, /<[^<>]+>/);
  }
  // Simulate a new Word draft accidentally replacing dynamic identity fields with static wording.
  for (const tag of ['PRINCIPAL NAME', 'ATTORNEY NAME', 'Principal Occupation', 'Attorney Village']) {
    const entries = await rt.readZip(bytes);
    const doc = entries.find(entry => entry.name === 'word/document.xml');
    doc.data = new TextEncoder().encode(rt.replaceRunText(new TextDecoder().decode(doc.data), new RegExp(`<${tag}>`, 'gi'), () => 'REMOVED FIELD'));
    const replacement = { ...source, bytes: await rt.writeZip(entries) };
    const validation = await rt.validateSaleDeedTemplate(replacement.bytes);
    assert.equal(validation.valid, false);
    assert(validation.errors.some(error => /would omit GPA\/AGPA details/.test(error)));
    await assert.rejects(() => render(replacement), /would omit GPA\/AGPA details/);
  }
}
console.log('PASS: extracted GPA/AGPA principals, holders, individual representation links and declaration survive source replacement and reload into default/custom downloads; missing identity bindings fail safely.');

