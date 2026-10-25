import assert from 'node:assert/strict';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
for (const gender of ['Male', 'Female', 'Other']) for (const plural of [false, true]) {
  const state = rt.sampleState('ordinary-plot');
  Object.assign(state.form, { executantGender: gender, claimantGender: gender, giftRelationship: 'friend' });
  if (plural) {
    state.additionalExecutants = [{ id: 'second', values: { ...state.form, executantName: 'SECOND OWNER' }, docNames: [] }];
    state.additionalClaimants = [{ id: 'second', values: { ...state.form, claimantName: 'SECOND RECIPIENT' }, docNames: [] }];
  }
  const possessive = plural || gender === 'Other' ? 'their' : gender === 'Female' ? 'her' : 'his';
  const object = plural || gender === 'Other' ? 'them' : gender === 'Female' ? 'her' : 'him';
  let schedules = rt.scheduleMergesFor(state);
  let output = await rt.fillSaleDeed(rt.mergeValues(state), schedules[0].variant, rt.rewritesFor(state), schedules);
  let text = await rt.docxToText(new Uint8Array(await output.blob.arrayBuffer()));
  assert.match(text, new RegExp(`all ${possessive} rights`, 'i'));
  assert.match(text, new RegExp(`through ${object}\\.`, 'i'));
  assert.doesNotMatch(text, /his\/her|him\/her|he\/she/);
  state.deedType = 'Gift';
  schedules = rt.scheduleMergesFor(state);
  output = await rt.fillGiftDeed(rt.mergeValues(state), rt.rewritesFor(state), schedules);
  text = await rt.docxToText(new Uint8Array(await output.blob.arrayBuffer()));
  assert.match(text, new RegExp(`through ${object}\\.`, 'i'));
  assert.match(text, plural || gender === 'Other' ? /that they have not previously/ : gender === 'Female' ? /that she has not previously/ : /that he has not previously/);
}
// Each repeated identity must resolve its own pronoun despite the plural group.
const state = rt.sampleState('ordinary-plot');
state.deedType = 'GPA/Power of Attorney';
Object.assign(state.form, { executantGender: 'Male', claimantGender: 'Female', poaRelationship: 'friend' });
state.additionalExecutants = [{ id: 'female-owner', values: { ...state.form, executantName: 'SECOND FEMALE OWNER', executantGender: 'Female' }, docNames: [] }];
const output = await rt.fillGeneralPoaDeed({ ...rt.mergeValues(state), 'Poa Variant': 'general-power-of-attorney' }, rt.rewritesFor(state), rt.scheduleMergesFor(state));
const text = await rt.docxToText(new Uint8Array(await output.blob.arrayBuffer()));
assert.match(text, /SECOND FEMALE OWNER[^\n]*include her legal heirs/);
assert.match(text, /upon her by virtue/);
for (const mode of ['gpa', 'agpa']) {
  const state = rt.sampleState(mode + '-plot');
  Object.assign(state.form, { executantGender: 'Female', claimantGender: 'Male' });
  state.saleAuthority.attorneys[0].values.Gender = 'Male';
  const schedules = rt.scheduleMergesFor(state);
  const output = await rt.fillSaleDeed(rt.mergeValues(state), schedules[0].variant, rt.rewritesFor(state), schedules);
  const text = await rt.docxToText(new Uint8Array(await output.blob.arrayBuffer()));
  assert.match(text, /represented herein by her/);
  assert.match(text, /all her rights/);
}
const agreement = rt.sampleState('ordinary-plot');
Object.assign(agreement, { deedType: 'Agreement of Sale Cum GPA' });
Object.assign(agreement.form, { executantGender: 'Female', claimantGender: 'Male' });
const agreed = await rt.fillAgreementSaleGpaDeed({ ...rt.mergeValues(agreement), 'Agreement Possession Variant': 'with-possession' }, rt.rewritesFor(agreement), rt.scheduleMergesFor(agreement));
const agreementText = await rt.docxToText(new Uint8Array(await agreed.blob.arrayBuffer()));
assert.match(agreementText, /her sole and absolute property/);
assert.match(agreementText, /as her true and lawful/);
console.log('PASS: selected genders and plural pronouns in Sale/Gift deeds; distinct genders in repeated GPA identities and attorney powers.');
