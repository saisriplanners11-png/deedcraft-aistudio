import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const bytes = new Uint8Array(await readFile(new URL('../agreement-sale-gpa-template-v2.docx', import.meta.url)));
assert.equal(createHash('sha256').update(bytes).digest('hex'), 'ded0b46a86d88806947d76f03a4ca785a8c906ee58e8881f75ee45eaa32f99e5');
const validation = await rt.validateAgreementSaleGpaTemplate(bytes);
assert(validation.valid, validation.errors.join(' '));
const reference = await rt.readZip(bytes);
await mkdir('tmp/agreement-sale-gpa-qa', { recursive: true });
const xmlOf = entries => new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml').data);
const checkSignatureBlocks = entries => {
  const xml = xmlOf(entries);
  assert.doesNotMatch(xml, /rIdSection32A/, 'Signature areas belong below tables, not in page footers');
  const tables = [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)].filter(match => match[0].includes('FINGER PRINT'));
  assert(tables.length, 'Section 32A has at least one page table');
  for (const [index, table] of tables.entries()) {
    const following = xml.slice(table.index + table[0].length, tables[index + 1]?.index ?? xml.length);
    const text = [...following.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(match => match[1]).join('');
    assert.equal((text.match(/SIGNATURES OF WITNESSES/g) || []).length, 1);
    assert.match(text, /SIGNATURES? OF EXECUTANTS?/);
    assert.match(text, /1\.\s+2\./);
    assert.match(following.slice(0, 350), /w:line="360"/, '18-point gap directly follows the table');
    assert.match(table[0], /<w:cantSplit\/>/);
  }
};
const customize = async edit => {
  const entries = await rt.readZip(bytes);
  entries.find(entry => entry.name === 'word/document.xml').data = new TextEncoder().encode(edit(xmlOf(entries)));
  return rt.writeZip(entries);
};
let count = 0;
for (const property of ['plot', 'open', 'dismantled', 'part', 'house-finished', 'house-semi', 'flat-finished', 'flat-semi']) {
  const state = rt.sampleState(`ordinary-${property}`);
  state.deedType = 'Agreement of Sale Cum GPA';
  state.form = { ...state.form, executionDate: '2026-10-24', nearAdjacent: 'Adjacent', nearHNo: 'LANDMARK-99', landmarkHNo: 'LANDMARK-99', govtRate: '5000', consid: '765432', executantPan: 'ABCDE1234F', claimantPan: 'PQRST5678L', claimantAadhaar: '123412341234', claimantDob: '1991-01-01' };
  const values = rt.mergeValues(state), rewrites = rt.rewritesFor(state), schedules = rt.scheduleMergesFor(state);
  for (const variant of ['with-possession', 'without-possession']) for (const source of [{ kind: 'built-in' }, { kind: 'custom', name: 'custom agreement.docx', hash: 'synthetic', bytes, validation }]) {
    const compiled = rt.compileDeed({ instrumentId: 'agreement_of_sale', variantId: variant, snapshotHash: 'synthetic', values, schedules, rewrites, unresolvedWarnings: [] }, source);
    const artifact = await rt.renderArtifact(compiled, 'docx');
    const output = new Uint8Array(await artifact.result.blob.arrayBuffer());
    const entries = await rt.readZip(output), xml = xmlOf(entries), text = await rt.docxToText(output);
    assert.deepEqual(artifact.result.unmapped, []);
    assert.match(text, new RegExp(variant === 'with-possession' ? '^AGREEMENT OF SALE-CUM-GPA WITH POSSESSION' : '^AGREEMENT OF SALE-CUM-GPA WITHOUT POSSESION'));
    if (variant === 'with-possession') {
      assert.match(text, /5\. POSSESSION/);
      assert.match(text, /already delivered and handed over the peaceful, vacant and physical possession/);
      assert.match(text, /6\. APPOINTMENT OF ATTORNEY/);
      assert.match(text, /14\. GENERAL AUTHORITY/);
    } else {
      assert.doesNotMatch(text, /5\. POSSESSION|already delivered and handed over the peaceful, vacant and physical possession/);
      assert.match(text, /5\. APPOINTMENT OF ATTORNEY/);
      assert.match(text, /13\. GENERAL AUTHORITY/);
      assert.doesNotMatch(text, /14\. GENERAL AUTHORITY/);
    }
    assert.equal((text.match(/NOW THIS DEED WITNESSETH/g) || []).length, 1);
    assert.equal((text.match(/1\. AGREEMENT OF SALE/g) || []).length, 1);
    assert.doesNotMatch(text, /<WITHOUT POSSESSION>|Gundlapelli Sampath/);
    assert.match(text, /24-10-2026/);
    assert.doesNotMatch(text, /DD-MM-YYYY|2026-10-24|<IF |FAMILY MEMBERS|OUTRIGHT SALE/);
    assert.match(text, /Rs.7,65,432/);
    assert.match(text, /ABCDE1234F/); assert.match(text, /PQRST5678L/);
    assert.equal((text.match(/SCHEDULE OF PROPERTY/g) || []).length, 1);
    const schedule = text.slice(text.indexOf('SCHEDULE OF PROPERTY'));
    assert.match(schedule, /adjacent house No.[\s:]*LANDMARK-99/i);
    assert.doesNotMatch(schedule, /near\s*\/\s*adjacent/i);
    if (property.startsWith('flat')) assert.match(schedule, /30 Sq.yds equivalent to 25.08 square meters/);
    assert.doesNotMatch(xml, /<w:txbxContent\b/);
    assert((xml.match(/<w:tblHeader\/>/g) || []).length >= 2);
    assert.equal((xml.match(/<w:trHeight w:val="2800"/g) || []).length, 2);
    assert.match(xml, /w:top="8208"/);
    checkSignatureBlocks(entries);
    for (const entry of reference.filter(entry => entry.name !== 'word/document.xml')) assert.deepEqual(entries.find(item => item.name === entry.name)?.data, entry.data, entry.name);
    if (source.kind === 'built-in') {
      assert.equal(artifact.manifest.templateVersionId, 'agreement-sale-gpa-v2');
      if (['plot', 'house-finished', 'flat-finished'].includes(property)) await writeFile(`tmp/agreement-sale-gpa-qa/${property}-${variant}.docx`, output);
    }
    count++;
  }
}
// Unequal groups and long addresses must generate complete, ordered rows, without inherited first-party details.
const state = rt.sampleState('multiple');
state.deedType = 'Agreement of Sale Cum GPA';
state.form.executantName = 'PRINCIPAL 1'; state.form.claimantName = 'ATTORNEY 1';
state.form.executantLocality = 'Long locality with several streets and identifying landmarks '.repeat(5);
state.additionalExecutants = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, values: { ...state.form, executantName: `PRINCIPAL ${i + 2}`, executantHNo: `P-HOUSE-${i + 2}` }, docNames: [] }));
state.additionalClaimants = Array.from({ length: 3 }, (_, i) => ({ id: `a${i}`, values: { ...state.form, claimantName: `ATTORNEY ${i + 2}`, claimantHNo: `A-HOUSE-${i + 2}` }, docNames: [] }));
const result = await rt.fillAgreementSaleGpaDeed({ ...rt.mergeValues(state), 'Agreement Possession Variant': 'with-possession' }, rt.rewritesFor(state), rt.scheduleMergesFor(state));
const output = new Uint8Array(await result.blob.arrayBuffer());
const text = await rt.docxToText(output), form = text.slice(text.indexOf('PHOTOGRAPHS AND FINGERPRINTS'));
assert.equal((text.match(/SCHEDULE OF PROPERTY/g) || []).length, 2);
const expected = [...Array.from({ length: 7 }, (_, i) => `PRINCIPAL ${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `ATTORNEY ${i + 1}`)];
let previous = -1;
for (const person of expected) { const position = form.indexOf(person); assert(position > previous, person); assert.equal(form.split(person).length - 1, 1); previous = position; }
assert.match(form, /P-HOUSE-7/); assert.match(form, /A-HOUSE-4/);
checkSignatureBlocks(await rt.readZip(output));
await writeFile('tmp/agreement-sale-gpa-qa/many-parties.docx', output);
assert.match(rt.deedFilename(state), /^Agreement-of-Sale-Cum-GPA-/);
// All payment methods retain their own references and dates; unused source samples disappear.
for (const mode of ['rtgs', 'cheque', 'dd', 'upi', 'cash', 'housing-loan', 'through-bank']) {
  const sample = rt.sampleState('ordinary-plot'); sample.deedType = 'Agreement of Sale Cum GPA';
  sample.payments = [{ ...rt.newPayment(mode), amount: '1500000', refNo: 'REF-9988', bank: 'PAYMENT BANK', branch: 'PAYMENT BRANCH', date: '2026-10-23' }];
  const result = await rt.fillAgreementSaleGpaDeed({ ...rt.mergeValues(sample), 'Agreement Possession Variant': 'with-possession' }, rt.rewritesFor(sample), rt.scheduleMergesFor(sample));
  const output = await rt.docxToText(new Uint8Array(await result.blob.arrayBuffer()));
  if (['rtgs','cheque','dd','upi','housing-loan'].includes(mode)) { assert.match(output, /REF-9988/, mode); assert.match(output, /23-10-2026/, mode); }
  if (mode === 'housing-loan') assert.match(output, /PAYMENT BRANCH/, mode);
  assert.equal((output.match(/paid (?:by|through|via|in)/g) || []).length, 1, mode);
}
const damaged = await customize(xml => xml.replaceAll('&lt;EXECUTANT NAME&gt;', 'REMOVED BINDING'));
assert.equal((await rt.validateAgreementSaleGpaTemplate(damaged)).valid, false);
const unknown = await customize(xml => xml.replace('<w:body>', '<w:body><w:p><w:r><w:t>&lt;Unsupported Secret&gt;</w:t></w:r></w:p>'));
assert.equal((await rt.validateAgreementSaleGpaTemplate(unknown)).valid, false);
const unsupported = rt.scheduleMergesFor(rt.sampleState('ordinary-plot')); unsupported[0].variant = 'IF AGRICULTURAL';
await assert.rejects(() => rt.fillAgreementSaleGpaDeed({ ...rt.mergeValues(state), 'Agreement Possession Variant': 'with-possession' }, rt.rewritesFor(state), unsupported), /No Agreement.*schedule/);


const legacyBytes = new Uint8Array(await readFile(new URL('../agreement-sale-gpa-template-v1.docx', import.meta.url)));
assert.equal((await rt.validateAgreementSaleGpaTemplate(legacyBytes)).valid, true, 'Retain compatibility with explicitly selected v1 custom templates');
const missingBoundary = await customize(xml => xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => rt.replaceRunText(paragraph, /<WITHOUT POSSESSION>/g, () => '')));
assert.equal((await rt.validateAgreementSaleGpaTemplate(missingBoundary)).valid, false, 'Reject lost possession boundaries');
const brokenWithout = await customize(xml => xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => rt.replaceRunText(paragraph, /13\. GENERAL AUTHORITY/g, () => 'REMOVED')));
assert.equal((await rt.validateAgreementSaleGpaTemplate(brokenWithout)).valid, false, 'Reject an incomplete Without Possession block');

// Template replacement must preserve the previously requested output policies.
for (const variant of ['with-possession', 'without-possession']) {
  const sample = rt.sampleState('ordinary-plot');
  sample.deedType = 'Agreement of Sale Cum GPA';
  Object.assign(sample.form, { executionDate: '2026-10', stampPaperMargin: '100', executantGender: 'Female', claimantGender: 'Male' });
  sample.additionalExecutants = [{ id: 'blank-share', values: { ...sample.form, executantName: 'NO SHARE PRINCIPAL' }, docNames: [] }];
  sample.vendorSharesBySchedule = { primary: { primary: '25' } };
  const generated = await rt.fillAgreementSaleGpaDeed({ ...rt.mergeValues(sample), 'Agreement Possession Variant': variant }, rt.rewritesFor(sample), rt.scheduleMergesFor(sample));
  const rendered = new Uint8Array(await generated.blob.arrayBuffer()), renderedText = await rt.docxToText(rendered);
  const renderedXml = xmlOf(await rt.readZip(rendered));
  assert.match(renderedText, /__-10-2026/, variant + ': preserve blank signing day');
  assert.match(renderedXml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/)[0], /w:top="8352"/, variant + ': preserve selected stamp space');
  assert.match(renderedText, /25%/, variant + ': preserve optional entered share');
  const noShareIdentity = renderedText.split('\n').find(line => line.includes('NO SHARE PRINCIPAL') && line.includes('Aged'));
  assert(noShareIdentity);
  assert.doesNotMatch(noShareIdentity, /share of|%/i, variant + ': do not invent shares for blank parties');
  checkSignatureBlocks(await rt.readZip(rendered));
}
console.log(`PASS: Agreement of Sale Cum GPA ${count} property/variant/template cases, separate possession clauses and numbering, 11 ordered Section 32A entries, all payment modes, and incompatible-template rejection.`);
