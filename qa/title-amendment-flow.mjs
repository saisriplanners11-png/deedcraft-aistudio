import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from '../template-runtime-loader.mjs';
const rt = await loadTemplateRuntime();
const cases = [
  ['sale', 'outright-absolute-sale-deed', 'Sale', 'Outright Absolute Sale Deed', 'ordinary', 'sale-deed-template-v11.docx'],
  ['sale', 'sale-deed-by-gpa-holder', 'Sale', 'Sale Deed by GPA Holder', 'gpa', 'sale-deed-template-v11.docx'],
  ['sale', 'sale-through-existing-agpa', 'Sale', 'Sale through Existing AGPA', 'agpa', 'sale-deed-template-v11.docx'],
  ['gift', 'family-gift', 'Gift', 'Gift Settlement Family', 'ordinary', 'gift-deed-template-v6.docx'],
  ['gift', 'municipal-gift', 'Gift', 'Municipal Gift', 'ordinary', 'gift-municipal-template-v3.docx'],
  ['agreement_of_sale', 'with-possession', 'Agreement of Sale Cum GPA', 'With Possession', 'ordinary', 'agreement-sale-gpa-template-v4.docx'],
  ['agreement_of_sale', 'without-possession', 'Agreement of Sale Cum GPA', 'Without Possession', 'ordinary', 'agreement-sale-gpa-template-v4.docx'],
  ['power_of_attorney', 'general-power-of-attorney', 'GPA/Power of Attorney', 'General Power of Attorney', 'ordinary', 'general-poa-template-v3.docx'],
  ['power_of_attorney', 'general-power-of-attorney-family', 'GPA/Power of Attorney', 'General Power of Attorney Family', 'ordinary', 'general-poa-template-v3.docx'],
];
let count = 0;
for (const [instrument, variant, deedType, draft, mode, file] of cases) {
  const bytes = new Uint8Array(await readFile(new URL('../' + file, import.meta.url)));
  const validation = await rt.validateDeedTemplate(bytes, instrument, variant);
  assert(validation.valid, validation.errors.join(' '));
  const source = { kind: 'custom', bytes, validation, hash: 'typed-amendment', name: file };
  const templates = await rt.loadTitleAmendmentTemplates(instrument, variant, source);
  for (const kind of ['rectification', 'supplemental']) {
    const label = kind === 'rectification' ? 'Rectification Deed' : 'Supplemental Deed';
    const record = { linkOption: 'linkDoc', linkDocType: label, linkDocNo: 'OWN-AMEND-42', linkDocDate: '2024-03-04', linkSro: 'OWN AMEND OFFICE', linkSroCode: 'OWN-CODE-42' };
    const state = rt.sampleState(mode + '-plot'); Object.assign(state, { deedType, draft });
    Object.assign(state.form, { giftRelationship: 'daughter', poaRelationship: 'son', supplementalDocNo: 'UNRELATED-FLAT-ALLOTMENT' });
    state.linkRecordsBySchedule = { primary: [{ id: 'amendment', docNames: [], values: record }, { id: 'base', docNames: [], values: { linkDocType: 'Sale Deed', linkDocNo: 'ORIGINAL-TITLE', linkDocDate: '2020-01-02', linkSro: 'BASE OFFICE', linkSroCode: 'BASE-CODE' } }] };
    const before = JSON.stringify(state);
    const render = async selected => rt.renderArtifact(rt.compileDeed({ instrumentId: instrument, variantId: variant, values: rt.mergeValues(state), schedules: rt.scheduleMergesFor(state), rewrites: rt.rewritesFor(state), snapshotHash: 'typed', unresolvedWarnings: [] }, selected), 'docx');
    const preview = rt.titleAmendmentPreview(templates[kind], record, kind);
    for (const value of ['OWN-AMEND-42', '04-03-2024', 'OWN AMEND OFFICE', 'OWN-CODE-42']) assert(preview.includes(value), file + ': ' + value);
    assert.doesNotMatch(preview, /BASE OFFICE|ORIGINAL-TITLE|UNRELATED-FLAT/);
    for (const selected of [source, { kind: 'built-in' }]) {
      const output = await render(selected), text = await rt.docxToText(new Uint8Array(await output.result.blob.arrayBuffer()));
      assert(text.includes(preview), file + ': the live source recital must match Word output');
      assert.equal(text.split('OWN-AMEND-42').length - 1, 1);
      assert(text.includes('ORIGINAL-TITLE'));
      assert.equal(JSON.stringify(state), before);
      count++;
    }
    // Cached approval cannot hide a missing paragraph or its own office binding.
    for (const remove of ['paragraph', 'office']) {
      const entries = await rt.readZip(bytes), document = entries.find(entry => entry.name === 'word/document.xml');
      document.data = new TextEncoder().encode(new TextDecoder().decode(document.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
        const text = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match => match[1]).join('');
        if (!new RegExp('^' + kind + ' Deed:', 'i').test(text)) return paragraph;
        return remove === 'paragraph' ? '' : rt.replaceRunText(paragraph, /<Sub Registrar>|<(?:Rectification|Supplemental) Deed SRO>/g, () => 'STATIC OFFICE');
      }));
      const damaged = { ...source, bytes: await rt.writeZip(entries) };
      await assert.rejects(() => render(damaged), /would omit.*deed details/i);
    }
    record.linkDocNo = '';
    const blank = await render(source), text = await rt.docxToText(new Uint8Array(await blank.result.blob.arrayBuffer()));
    assert(!text.includes(label + ':'), 'a missing amendment number must omit its paragraph');
  }
}
console.log(`PASS: ${count} typed-amendment default/custom downloads match source-based live previews across nine deed variants; original titles stay separate, blank amendments disappear, and missing paragraphs/bindings block silent data loss.`);
