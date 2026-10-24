import assert from 'node:assert/strict';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
for (const gift of [false, true]) for (const mode of ['ordinary-plot', 'ordinary-house-finished', 'ordinary-flat-finished']) for (const side of ['executant', 'claimant']) for (const type of ['Firm / LLP', 'Society / Association', 'Company']) for (const count of [1, 2]) {
  const state = rt.sampleState(mode);
  if (gift) { state.deedType = 'Gift'; state.form.giftRelationship = 'daughter'; }
  state.form[side + 'PartyType'] = type;
  state.form[side + 'EntityName'] = 'TEST ORGANISATION';
  const representatives = Array.from({ length: count }, (_, i) => ({ id: 'rep-' + i, designation: i ? 'Secretary' : 'President', name: i ? 'SECOND PERSON' : 'FIRST PERSON', relation: 'S/O', relationName: 'PARENT', age: '40', dob: '', hNo: '', locality: '', village: '', mandal: '', district: '', state: '', pinCode: '', aadhaar: '', pan: '', mobile: '' }));
  state.partyPeopleByParty = { [side + '|primary']: { representatives, members: [] } };
  const schedules = rt.scheduleMergesFor(state);
  const result = gift ? await rt.fillGiftDeed(rt.mergeValues(state), rt.rewritesFor(state), schedules) : await rt.fillSaleDeed(rt.mergeValues(state), schedules[0].variant, rt.rewritesFor(state), schedules);
  const entries = await rt.readZip(new Uint8Array(await result.blob.arrayBuffer()));
  const xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml').data);
  const label = `${gift ? 'Gift' : 'Sale'} ${mode} ${side} ${type} ${count}`;
  assert.equal((xml.match(/represented by/g) || []).length, 1, label);
  assert.match(xml, /represented by<\/w:t><w:br\s*\/><w:t[^>]*>President: FIRST PERSON, S\/O PARENT/, label);
  if (count > 1) assert.match(xml, /<w:br\s*\/><w:t[^>]*>Secretary: SECOND PERSON, S\/O PARENT/, label);
}
console.log('PASS: single represented-by heading and separate representative lines in 72 Sale/Gift entity/property/party combinations.');
