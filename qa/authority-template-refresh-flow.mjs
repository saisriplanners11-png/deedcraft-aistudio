import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const groups = [
  ['power_of_attorney', 'general-power-of-attorney-family', 'General Power of Attorney Family', ['general-poa-template-v1.docx', 'general-poa-template-v2.docx', 'general-poa-template-v3.docx']],
  ...['with-possession', 'without-possession'].map(variant => ['agreement_of_sale', variant, variant === 'with-possession' ? 'With Possession' : 'Without Possession', ['agreement-sale-gpa-template-v1.docx', 'agreement-sale-gpa-template-v2.docx', 'agreement-sale-gpa-template-v3.docx', 'agreement-sale-gpa-template-v4.docx']]),
];
let count = 0;
for (const [instrumentId, variantId, draft, files] of groups) for (const file of files) {
  const bytes = new Uint8Array(await readFile(new URL('../' + file, import.meta.url)));
  const validation = await rt.validateDeedTemplate(bytes, instrumentId, variantId, file);
  assert(validation.valid, file + ': ' + validation.errors.join(' '));
  const state = rt.sampleState('ordinary-plot'); state.deedType = instrumentId === 'power_of_attorney' ? 'GPA/Power of Attorney' : 'Agreement of Sale Cum GPA'; state.draft = draft;
  Object.assign(state.form, { giftRelationship: 'friend', poaRelationship: 'son', claimantName: 'CLAIMANT ONE', claimantState: 'FIRST STATE', claimantPinCode: '500111', claimantPan: 'FIRST1234A', claimantAadhaar: '111122223333', claimantGender: 'Male' });
  state.additionalClaimants = [{ id: 'second', values: { ...state.form, claimantName: 'CLAIMANT TWO', claimantState: 'SECOND STATE', claimantPinCode: '500222', claimantPan: 'SECOND1234B', claimantAadhaar: '444455556666', claimantGender: 'Female', poaRelationship: 'daughter' }, docNames: [] }];
  const before = JSON.stringify(state);
  const source = { kind: 'custom', name: file, hash: file, bytes, validation };
  const compiled = rt.compileDeed({ instrumentId, variantId, snapshotHash: 'split-party-source', values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), unresolvedWarnings: [] }, source);
  const { result, manifest } = await rt.renderArtifact(compiled, 'docx');
  assert.equal(manifest.templateVersionId, 'custom:' + file);
  assert.deepEqual(result.unmapped, []);
  const entries = await rt.readZip(new Uint8Array(await result.blob.arrayBuffer()));
  const xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml').data);
  const texts = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(match => [...match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(run => run[1]).join(''));
  const first = texts.find(text => text.includes('CLAIMANT ONE') && /Aged/.test(text));
  const second = texts.find(text => text.includes('CLAIMANT TWO') && /Aged/.test(text));
  assert(first && second, file + ': every repeated claimant has one complete identity recital');
  for (const value of ['FIRST STATE', '500111', 'FIRST1234A', '111122223333']) { assert(first.includes(value), file + ': first claimant ' + value); assert(!second.includes(value), file + ': first claimant detail leaked'); }
  for (const value of ['SECOND STATE', '500222', 'SECOND1234B', '444455556666']) { assert(second.includes(value), file + ': second claimant ' + value); assert(!first.includes(value), file + ': second claimant detail leaked'); }
  assert.doesNotMatch(first, /Hereinafter|hereinafter/);
  assert.match(second, /[Hh]ereinafter/);
  assert.equal(JSON.stringify(state), before);
  count++;
}
console.log(`PASS: ${count} historical/current authority-source cases retain separate claimant addresses, PANs, Aadhaar, gender, final definitions and explicit custom versions across split source paragraphs.`);
