import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  docxToText, fillSaleDeed, scheduleText, replaceRunText, readZip, writeZip,
  validateSaleDeedTemplate, MAX_CUSTOM_TEMPLATE_BYTES, type DeedTemplateSource,
} from './docx';
import { ALL_FIELDS, newStructureDetail } from './fields';
import { initialState } from './logic';
import { mergeValues, rewritesFor, scheduleMergesFor, variantFor } from './merge';
import { newPayment } from './payments';

describe('sale deed template merge', () => {
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    const bytes = await readFile(new URL('./sale-deed-template.docx', import.meta.url));
    globalThis.fetch = async () => new Response(bytes);
  });

  afterAll(() => { globalThis.fetch = originalFetch; });

  async function customizedTemplate(edit: (xml: string) => string): Promise<Uint8Array> {
    const original = new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url)));
    const entries = await readZip(original);
    const document = entries.find(entry => entry.name === 'word/document.xml')!;
    document.data = new TextEncoder().encode(edit(new TextDecoder().decode(document.data)));
    return writeZip(entries);
  }

  it('validates the starter contract and renders from custom template bytes', async () => {
    const reference = new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url)));
    const bytes = await customizedTemplate(xml => replaceRunText(xml, /SALE DEED/g, () => 'CUSTOM SALE DEED'));
    const validation = await validateSaleDeedTemplate(bytes, 'customer-template.docx', reference);
    expect(validation.valid).toBe(true);
    expect(validation.detectedPlaceholders.length).toBeGreaterThan(40);
    expect(validation.omittedPlaceholders).toEqual([]);

    const source: DeedTemplateSource = { kind: 'custom', name: 'customer-template.docx', hash: 'custom-hash', bytes, validation };
    const result = await fillSaleDeed(mergeValues(initialState), 'IF OPEN PLOT', rewritesFor(initialState), [], source);
    expect(await docxToText(new Uint8Array(await result.blob.arrayBuffer()))).toContain('CUSTOM SALE DEED');
  });

  it('accepts the previous default as a compatible custom template', async () => {
    const legacy = new Uint8Array(await readFile(new URL('./sale-deed-template-v2.docx', import.meta.url)));
    const validation = await validateSaleDeedTemplate(legacy, 'previous-default.docx');
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('rejects corrupt, wrongly named, structurally incomplete, and unknown-tag templates', async () => {
    const reference = new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url)));
    expect((await validateSaleDeedTemplate(new Uint8Array([1, 2, 3]), 'template.docx', reference)).errors.join(' ')).toMatch(/readable/i);
    expect((await validateSaleDeedTemplate(reference, 'template.pdf', reference)).errors.join(' ')).toMatch(/\.docx/i);

    const missingMarker = await customizedTemplate(xml => replaceRunText(xml, /<IF OPEN PLOT>/g, () => 'REMOVED SCHEDULE MARKER'));
    expect((await validateSaleDeedTemplate(missingMarker, 'missing.docx', reference)).errors.join(' ')).toContain('<IF OPEN PLOT>');

    const missingClauseMarker = await customizedTemplate(xml => xml.replace(/>HOUSE<\/w:t>/, '>REMOVED HOUSE CLAUSES</w:t>'));
    expect((await validateSaleDeedTemplate(missingClauseMarker, 'missing-clause.docx', reference)).errors.join(' ')).toMatch(/operative-clause marker pair/i);

    const unknownTag = await customizedTemplate(xml => xml.replace('</w:body>', '<w:p><w:r><w:t>&lt;Mystery Field&gt;</w:t></w:r></w:p></w:body>'));
    expect((await validateSaleDeedTemplate(unknownTag, 'unknown.docx', reference)).errors.join(' ')).toContain('<Mystery Field>');

    const oversized = new Uint8Array(MAX_CUSTOM_TEMPLATE_BYTES + 1);
    expect((await validateSaleDeedTemplate(oversized, 'large.docx', reference)).errors.join(' ')).toContain('larger than 20 MB');

    const unsafeEntries = await readZip(reference);
    unsafeEntries.push({ name: '../unsafe.xml', data: new TextEncoder().encode('unsafe') });
    const unsafe = await writeZip(unsafeEntries);
    expect((await validateSaleDeedTemplate(unsafe, 'unsafe.docx', reference)).errors.join(' ')).toContain('unsafe file path');
  });

  it('refuses to render an invalid custom template instead of falling back', async () => {
    const source: DeedTemplateSource = {
      kind: 'custom', name: 'invalid.docx', hash: 'invalid', bytes: new Uint8Array([1]),
      validation: { valid: false, errors: ['Template is invalid.'], detectedPlaceholders: [], omittedPlaceholders: [] },
    };
    await expect(fillSaleDeed(mergeValues(initialState), 'IF OPEN PLOT', [], [], source)).rejects.toThrow('Template is invalid.');
  });

  it('replaces split-run fields without losing the surrounding bold or line break', () => {
    const paragraph = '<w:p><w:r><w:t>Before &lt;Na</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>me&gt; bold</w:t><w:br/><w:t>tail &lt;Name&gt;</w:t></w:r></w:p>';
    const result = replaceRunText(paragraph, /<Name>/g, () => 'A & B');
    expect(result).toContain('<w:t xml:space="preserve">Before A &amp; B</w:t>');
    expect(result).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> bold</w:t><w:br/>');
    expect(result).toContain('tail A &amp; B');
  });

  it('writes legacy-valid ZIP timestamps for Word 2007 compatibility', async () => {
    const zip = await writeZip([{ name: 'word/document.xml', data: new TextEncoder().encode('<document/>') }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(10, true)).toBe(0x00210000);
    const central = [...zip].findIndex((_, index) => index + 4 <= zip.length && view.getUint32(index, true) === 0x02014b50);
    expect(central).toBeGreaterThan(0);
    expect(view.getUint32(central + 12, true)).toBe(0x00210000);
  });

  it('omits unprovided fields and preserves template styles and numbering', async () => {
    const result = await fillSaleDeed(mergeValues(initialState), 'IF OPEN PLOT', rewritesFor(initialState));
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const text = await docxToText(bytes);
    expect(text).not.toMatch(/2026|Kailash|<[^>]+>|__________|undefined|NaN/);
    expect(text).toContain('THIS SALE DEED is made');
    expect(text).toContain('in the presence of the following witnesses.');
    expect(text).toContain('1. THE VENDOR/S');
    expect(text).toContain('8. THE VENDOR/S');
    const original = await readZip(new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url))));
    const generated = await readZip(bytes);
    for (const name of ['word/styles.xml','word/numbering.xml','word/footer1.xml']) {
      expect(generated.find(e => e.name === name)?.data).toEqual(original.find(e => e.name === name)?.data);
    }
  });

  it('prints the selected execution month and year with a blank day for handwriting', async () => {
    const state = { ...initialState, form: { ...initialState.form, extentSqYards:'100', govtRate:'10000', consid:'800000', executionDate:'2026-10' } };
    const result = await fillSaleDeed(mergeValues(state), 'IF OPEN PLOT', rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).not.toContain('10,00,000');
    expect(text).toContain('Market Value of Rs.8,00,000');
    expect(text).toContain('total sale consideration of Rs.8,00,000');
    expect(text).toContain('made and executed on     -10-2026');
    expect(text).toContain('on the afore mentioned date.');

    const legacyState = { ...state, form: { ...state.form, executionDate: '2026-09-11' } };
    const legacy = await fillSaleDeed(mergeValues(legacyState), 'IF OPEN PLOT', rewritesFor(legacyState));
    const legacyText = await docxToText(new Uint8Array(await legacy.blob.arrayBuffer()));
    expect(legacyText).toContain('made and executed on     -09-2026');

    const blank = await fillSaleDeed(mergeValues(initialState), 'IF OPEN PLOT', rewritesFor(initialState));
    const blankText = await docxToText(new Uint8Array(await blank.blob.arrayBuffer()));
    expect(blankText).toContain('THIS SALE DEED is made and');
    expect(blankText).not.toMatch(/made and executed on\s+-\s*-\d{4}/);
    expect(blankText).not.toContain('on the afore mentioned date.');
  });

  it('never embeds registration-plan media or appends plan sections to a deed', async () => {
    const result = await fillSaleDeed(mergeValues(initialState), 'IF OPEN PLOT', rewritesFor(initialState));
    const entries = await readZip(new Uint8Array(await result.blob.arrayBuffer()));
    const xml = new TextDecoder().decode(entries.find(e=>e.name==='word/document.xml')!.data);
    const original = await readZip(new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url))));
    const originalXml = new TextDecoder().decode(original.find(e=>e.name==='word/document.xml')!.data);
    expect([...xml.matchAll(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/g)]).toHaveLength([...originalXml.matchAll(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/g)].length);
    expect(xml).toContain('DECLARATION');
    expect(entries.some(entry => /deedcraft-plan|word\/media\//i.test(entry.name))).toBe(false);
    expect(new TextDecoder().decode(entries.find(e=>e.name==='word/_rels/document.xml.rels')!.data)).not.toContain('DeedCraftPlan');
  });

  it('uses consideration for the estimate and total market value while retaining the per-yard rate', async () => {
    const state = { ...initialState, category:'Residential', form:{...initialState.form,extentSqYards:'100',govtRate:'10000',consid:'800000'} };
    const result=await fillSaleDeed(mergeValues(state),'IF HOUSE',rewritesFor(state),scheduleMergesFor(state));
    const text=await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toMatch(/Consideration\s+: Rs\.8,00,000/);
    expect(text).toMatch(/estimate M\.V\.\s+: Rs\.8,00,000/);
    expect(text).toMatch(/Market Value per Sq\.yds\s+: Rs\.10,000/);
    const plotState = { ...initialState, category:'Vacant Plot', form:{...initialState.form,extentSqYards:'100',govtRate:'10000',consid:'800000'} };
    const plotResult = await fillSaleDeed(mergeValues(plotState), 'IF OPEN PLOT', rewritesFor(plotState), scheduleMergesFor(plotState));
    const plotText = await docxToText(new Uint8Array(await plotResult.blob.arrayBuffer()));
    expect(plotText).toMatch(/Total Market Value\s+: Rs\.8,00,000/);
  });

  it('uses agreed consideration in the Statement of Market Value', async () => {
    const state = { ...initialState, category:'Vacant Plot', form:{...initialState.form,extentSqYards:'100',govtRate:'10000',consid:'800000'} };
    const result = await fillSaleDeed(mergeValues(state), 'IF OPEN PLOT', rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toMatch(/Total Market Value\s+: Rs\.8,00,000/);
  });

  it('renders the selected landmark relationship while retaining the separate house number', async () => {
    const state = { ...initialState, category: 'Vacant Plot', form: { ...initialState.form, nearAdjacent: 'Adjacent', nearHNo: '10-1-36/1' } };
    const result = await fillSaleDeed(mergeValues(state), 'IF OPEN PLOT', rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text.toLowerCase()).toContain('situated adjacent h.no.10-1-36/1');
    expect(text.toLowerCase()).not.toContain('situated near/adjacent h.no.10-1-36/1');
  });

  it('writes consideration words in parentheses in both sale recitals', async () => {
    const state = { ...initialState, form: { ...initialState.form, consid: '800000' } };
    const result = await fillSaleDeed(mergeValues(state), 'IF OPEN PLOT', rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('consideration amount of Rs.8,00,000/-');
    expect(text).toContain('(Eight Lakh Rupees Only)');
    expect(text.match(/\(Eight Lakh Rupees Only\)/g)).toHaveLength(2);
    expect(text).not.toMatch(/,\s*Eight Lakh Rupees Only/);
    expect(text).toContain('total sale consideration of Rs.8,00,000/-');
  });

  it('keeps only the operative clauses applicable to the selected property type', async () => {
    const house = await fillSaleDeed(mergeValues(initialState), 'IF HOUSE', rewritesFor(initialState));
    const open = await fillSaleDeed(mergeValues(initialState), 'IF OPEN PLOT', rewritesFor(initialState));
    const houseText = await docxToText(new Uint8Array(await house.blob.arrayBuffer()));
    const openText = await docxToText(new Uint8Array(await open.blob.arrayBuffer()));
    expect(houseText).toContain('house/building standing thereon');
    expect(houseText).not.toContain('IF VACANT PLOT');
    expect(openText).toContain('1. THE VENDOR/S hereby sell/s');
    expect(openText).not.toContain('house/building standing thereon');
    expect(openText).not.toContain('IF HOUSE');
  });

  it('uses the new Open Place schedule and omits optional title recitals without source details', async () => {
    const state = { ...initialState, category: 'Open Place' };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('All that the open place, admeasuring');
    expect(text).not.toContain('Vacant Land Tax/Assessment');
    expect(text).not.toContain('L.R.S.-2020 Application');
  });

  it('recites entered plot and survey identifiers in non-house schedules and their preview', async () => {
    for (const category of ['Open Place', 'Demolished', 'Part open place']) {
      const state = { ...initialState, category, form: { ...initialState.form, plotNo: 'PLOT-42', surveyNo: 'SURVEY-42', nearHNo: 'HOUSE-42' } };
      const schedules = scheduleMergesFor(state);
      const result = await fillSaleDeed(mergeValues(state), variantFor(category), rewritesFor(state), schedules);
      const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
      const preview = await scheduleText(schedules[0].variant, schedules[0].values);
      for (const output of [text, preview]) {
        expect(output).toContain('plot no.PLOT-42');
        expect(output).toContain('Survey No/s.SURVEY-42');
      }
    }
  });

  it('prints independently sourced flow-of-title blocks for each property schedule', async () => {
    const state = {
      ...initialState,
      category: 'Open Place',
      form: { ...initialState.form, plotNo: 'OPEN-1' },
      additionalSchedules: [{ id: 'house-2', docNames: [], category: 'Residential', unit: 'Sq. Yards', values: { plotNo: 'HOUSE-2' } }],
      linkRecordsBySchedule: {
        primary: [
          { id: 'primary-link', docNames: [], values: { linkOption: 'linkDoc', linkDocType: 'Sale Deed', linkDocNo: 'OPEN/101', linkDocDate: '2026-01-02', linkSro: 'Open SRO' } },
          { id: 'primary-tax', docNames: [], values: { linkOption: 'houseTax', houseTaxReceiptNo: 'TAX-OPEN', taxPaidDate: '2026-01-03', localBodyName: 'Open Municipality' } },
        ],
        'house-2': [
          { id: 'house-link', docNames: [], values: { linkOption: 'linkDoc', linkDocType: 'Gift Deed', linkDocNo: 'HOUSE/202', linkDocDate: '2025-02-03', linkSro: 'House SRO' } },
          { id: 'house-permission', docNames: [], values: { linkOption: 'permissions', permBuildingPermitNo: 'PERMIT-HOUSE', permissionDate: '2025-02-03', permissionAuthorityName: 'House Municipality' } },
        ],
      },
    };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));

    expect(text.match(/FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE \d/g)).toHaveLength(2);
    expect(text.match(/Registered Deed:/g)).toHaveLength(2);
    expect(text).toContain('Document No. OPEN/101');
    expect(text).toContain('Document No. HOUSE/202');
    expect(text).toContain('TAX-OPEN');
    expect(text).toContain('PERMIT-HOUSE');
    const firstFlow = text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 1');
    const secondFlow = text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 2');
    expect(firstFlow).toBeLessThan(secondFlow);
    expect(text.indexOf('TAX-OPEN')).toBeLessThan(secondFlow);
    expect(text.indexOf('PERMIT-HOUSE')).toBeGreaterThan(secondFlow);
  });

  it('uses a house-tax receipt without leaving an empty registered-deed recital', async () => {
    const state = {
      ...initialState, category: 'Residential',
      linkRecordsBySchedule: { primary: [{ id: 'tax', docNames: [], values: {
        linkOption: 'houseTax', houseTaxReceiptNo: 'TAX-10817', assessmentPtinNo: 'PTIN-42',
        taxPaidDate: '2026-02-03', localBodyName: 'Sircilla Municipality',
      } }] },
    };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).not.toContain('Registered Deed:');
    expect(text).toContain('Property Tax:');
    expect(text).toContain('TAX-10817');
    expect(text).toContain('Sircilla Municipality');
    expect(text).toContain('Tax/Assessment & Identification Particulars:');
    expect(text).toContain('Assessment No. PTIN-42');
  });

  it('includes only supported tax recitals and never substitutes a receipt or demand number for PTIN', async () => {
    const state = {
      ...initialState, category: 'Residential',
      linkRecordsBySchedule: { primary: [{ id: 'tax', docNames: [], values: {
        linkOption: 'houseTax', houseTaxReceiptNo: 'RECEIPT-7', demandNo: 'DEMAND-8',
      } }] },
    };
    const incomplete = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const incompleteText = await docxToText(new Uint8Array(await incomplete.blob.arrayBuffer()));
    expect(incompleteText).not.toContain('Registered Deed:');
    expect(incompleteText).not.toContain('Property Tax:');
    expect(incompleteText).not.toContain('Tax/Assessment & Identification Particulars:');
    const assessmentState = { ...state, linkRecordsBySchedule: { primary: [{ id: 'tax', docNames: [], values: {
      linkOption: 'houseTax', assessmentPtinNo: 'PTIN-ONLY',
    } }] } };
    const assessment = await fillSaleDeed(mergeValues(assessmentState), variantFor(state.category), rewritesFor(state), scheduleMergesFor(assessmentState));
    const assessmentText = await docxToText(new Uint8Array(await assessment.blob.arrayBuffer()));
    expect(assessmentText).toContain('Assessment No. PTIN-ONLY');
    expect(assessmentText).not.toContain('Property Tax:');
    const splitReceiptState = { ...state, linkRecordsBySchedule: { primary: [
      { id: 'receipt', docNames: [], values: { linkOption: 'houseTax', houseTaxReceiptNo: 'RECEIPT-7' } },
      { id: 'date', docNames: [], values: { linkOption: 'houseTax', taxPaidDate: '2026-02-03', localBodyName: 'Another Municipality' } },
    ] } };
    const splitReceipt = await fillSaleDeed(mergeValues(splitReceiptState), variantFor(state.category), rewritesFor(state), scheduleMergesFor(splitReceiptState));
    const splitText = await docxToText(new Uint8Array(await splitReceipt.blob.arrayBuffer()));
    expect(splitText).not.toContain('Property Tax:');
  });

  it('keeps title and tax recitals within their own property schedule', async () => {
    const state = {
      ...initialState, category: 'Residential',
      additionalSchedules: [{ id: 'second', docNames: [], category: 'Residential', unit: 'Sq. Yards', values: {} }],
      linkRecordsBySchedule: {
        primary: [{ id: 'tax-1', docNames: [], values: { linkOption: 'houseTax', houseTaxReceiptNo: 'RECEIPT-ONE', assessmentPtinNo: 'PTIN-ONE', taxPaidDate: '2026-02-03', localBodyName: 'First Municipality' } }],
        second: [{ id: 'link-2', docNames: [], values: { linkOption: 'linkDoc', linkDocType: 'Gift Deed', linkDocNo: 'DOC-TWO', linkDocDate: '2020-01-02', linkSro: 'Second SRO' } }],
      },
    };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const first = text.slice(text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 1'), text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 2'));
    const second = text.slice(text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 2'), text.indexOf('2. CONSIDERATION'));
    expect(first).toContain('RECEIPT-ONE');
    expect(first).toContain('PTIN-ONE');
    expect(first).not.toContain('Registered Deed:');
    expect(second).toContain('DOC-TWO');
    expect(second).toContain('Registered Deed:');
    expect(second).not.toContain('RECEIPT-ONE');
    expect(second).not.toContain('PTIN-ONE');
  });

  it('prints all ten completed title points with the supplied Page 2 wording and link date', async () => {
    const state = { ...initialState, category: 'Residential', linkRecordsBySchedule: { primary: [
      { id: 'registered', docNames: [], values: { linkOption: 'linkDoc', linkDocType: 'Sale Deed', linkDocNo: 'DOC-1', linkDocDate: '2020-04-05', linkSro: 'Sircilla', linkSroCode: 'SRO-1' } },
      { id: 'vlt', docNames: [], values: { linkOption: 'vacantTax', vltNo: 'VLT-1' } },
      { id: 'layout', docNames: [], values: { linkOption: 'approvedLayout', layoutFileNo: 'LAYOUT-1' } },
      { id: 'title', docNames: [], values: { linkOption: 'titleDeed', titleDeedNo: 'TITLE-1', khataNo: 'KHATA-1' } },
      { id: 'nala', docNames: [], values: { linkOption: 'nala', nalaOrderNo: 'NALA-1', nalaProceedingDate: '2024-01-01' } },
      { id: 'tax', docNames: [], values: { linkOption: 'houseTax', houseTaxReceiptNo: 'TAX-1', taxPaidDate: '2025-01-01', localBodyName: 'Sircilla Municipality' } },
      { id: 'assessment', docNames: [], values: { linkOption: 'assessment', bltNo: 'PTIN-1' } },
      { id: 'permission', docNames: [], values: { linkOption: 'permissions', permBuildingPermitNo: 'PERMIT-1', permissionDate: '2022-01-02', permissionAuthorityName: 'Municipality' } },
      { id: 'application', docNames: [], values: { linkOption: 'lrsApplication', lrsApplicationNo: 'APP-1', lrsApplicationDate: '2021-02-03' } },
      { id: 'proceeding', docNames: [], values: { linkOption: 'lrsProceeding', lrsProceedingNo: 'PROC-1', lrsProceedingDate: '2021-03-04' } },
    ] } };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const pageTwo = text.slice(text.indexOf('FLOW OF TITLE'), text.indexOf('CONSIDERATION & PAYMENT TERMS'));
    for (const label of ['Registered Deed:', 'Vacant Land Tax/Assessment:', 'Approved Layout:', 'Title Deed:', 'Nala Order:', 'Property Tax:', 'Tax/Assessment & Identification Particulars:', 'House Permission:', 'L.R.S.-2020 Application:', 'L.R.S. Proceeding:']) {
      expect(pageTwo).toContain(label);
    }
    for (const value of ['DOC-1', 'VLT-1', 'LAYOUT-1', 'TITLE-1', 'KHATA-1', 'NALA-1', 'TAX-1', 'PTIN-1', 'PERMIT-1', 'APP-1', 'PROC-1']) expect(pageTwo).toContain(value);
    expect(pageTwo).toContain('were derived under and by virtue');
    expect(pageTwo).toContain('ownership/title of the concerned parties');
    expect(pageTwo.match(/dated 05-04-2020/g)).toHaveLength(1);
    expect(pageTwo).toContain('Nala Order No. NALA-1, dated 01-01-2024');
    expect(pageTwo).toContain('Property Tax Receipt No. TAX-1, dated 01-01-2025');
  });

  it('keeps identified title records without dates in every property category', async () => {
    for (const category of ['Vacant Plot', 'Open Place', 'Residential', 'Flat', 'Demolished', 'Commercial', 'Agricultural land', 'Part open place']) {
      const state = { ...initialState, category, linkRecordsBySchedule: { primary: [
        { id: 'link', docNames: [], values: { linkOption: 'linkDoc', linkDocType: 'Sale Deed', linkDocNo: 'UNDATED-LINK', linkSro: 'Sircilla' } },
        { id: 'nala', docNames: [], values: { linkOption: 'nala', nalaOrderNo: 'UNDATED-NALA' } },
        { id: 'tax', docNames: [], values: { linkOption: 'houseTax', houseTaxReceiptNo: 'UNDATED-TAX', localBodyName: 'Sircilla Municipality' } },
        { id: 'permission', docNames: [], values: { linkOption: 'permissions', permBuildingPermitNo: 'UNDATED-PERMIT', permissionAuthorityName: 'Sircilla Municipality' } },
        { id: 'application', docNames: [], values: { linkOption: 'lrsApplication', lrsApplicationNo: 'UNDATED-APP' } },
        { id: 'proceeding', docNames: [], values: { linkOption: 'lrsProceeding', lrsProceedingNo: 'UNDATED-PROC' } },
      ] } };
      const result = await fillSaleDeed(mergeValues(state), variantFor(category), rewritesFor(state), scheduleMergesFor(state));
      const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
      for (const number of ['UNDATED-LINK', 'UNDATED-NALA', 'UNDATED-TAX', 'UNDATED-PERMIT', 'UNDATED-APP', 'UNDATED-PROC']) expect(text).toContain(number);
      expect(text).not.toMatch(/\bdated\s*(?:[,.;]|_{2,}|\n|$)/i);
      expect(text).not.toContain('dated __________');
    }
  });

  it('keeps each date with its own record across schedules', async () => {
    const state = { ...initialState, category: 'Open Place',
      additionalSchedules: [{ id: 'second', docNames: [], category: 'Demolished', unit: 'Sq. Yards', values: {} }],
      linkRecordsBySchedule: {
        primary: [
          { id: 'link-1', docNames: [], values: { linkOption: 'linkDoc', linkDocType: 'Sale Deed', linkDocNo: 'LINK-ONE', linkDocDate: '2020-01-02', linkSro: 'Sircilla' } },
          { id: 'tax-1', docNames: [], values: { linkOption: 'houseTax', houseTaxReceiptNo: 'TAX-ONE', localBodyName: 'First Municipality' } },
        ],
        second: [
          { id: 'nala-2', docNames: [], values: { linkOption: 'nala', nalaOrderNo: 'NALA-TWO', nalaProceedingDate: '2024-03-04' } },
          { id: 'tax-2', docNames: [], values: { linkOption: 'houseTax', houseTaxReceiptNo: 'TAX-TWO', taxPaidDate: '2025-05-06', localBodyName: 'Second Municipality' } },
        ],
      },
    };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const first = text.slice(text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 1'), text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 2'));
    const second = text.slice(text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 2'), text.indexOf('2. CONSIDERATION'));
    expect(first).toContain('Sale Deed dated 02-01-2020, registered as Document No. LINK-ONE');
    expect(first).toContain('Property Tax Receipt No. TAX-ONE, issued');
    expect(first).not.toContain('04-03-2024');
    expect(first).not.toContain('06-05-2025');
    expect(second).toContain('Nala Order No. NALA-TWO, dated 04-03-2024');
    expect(second).toContain('Property Tax Receipt No. TAX-TWO, dated 06-05-2025');
    expect(second).not.toContain('02-01-2020');
  });

  it('prints separate title recitals from merged records without mixing schedules', async () => {
    const state = { ...initialState, category: 'Residential',
      additionalSchedules: [{ id: 'second', docNames: [], category: 'Residential', unit: 'Sq. Yards', values: {} }],
      linkRecordsBySchedule: {
        primary: [
          { id: 'land-1', docNames: [], values: { linkOption: 'landLayoutLrs', vltNo: 'VLT-ONE', layoutFileNo: 'LAYOUT-ONE', lrsApplicationNo: 'APP-ONE', lrsApplicationDate: '2024-01-02', lrsProceedingNo: 'PROC-ONE', lrsProceedingDate: '2024-03-04' } },
          { id: 'tax-1', docNames: [], values: { linkOption: 'houseTax', houseTaxReceiptNo: 'RECEIPT-ONE', bltNo: 'PTIN-ONE', localBodyName: 'First Municipality', taxPaidDate: '2025-01-02' } },
        ],
        second: [
          { id: 'land-2', docNames: [], values: { linkOption: 'landLayoutLrs', vltNo: 'VLT-TWO', layoutFileNo: 'LAYOUT-TWO' } },
          { id: 'tax-2', docNames: [], values: { linkOption: 'houseTax', bltNo: 'PTIN-TWO' } },
        ],
      },
    };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const first = text.slice(text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 1'), text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 2'));
    const second = text.slice(text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 2'), text.indexOf('2. CONSIDERATION'));
    for (const value of ['VLT-ONE', 'LAYOUT-ONE', 'APP-ONE', 'PROC-ONE', 'RECEIPT-ONE', 'PTIN-ONE']) expect(first).toContain(value);
    for (const value of ['VLT-TWO', 'LAYOUT-TWO', 'PTIN-TWO']) expect(second).toContain(value);
    for (const value of ['APP-ONE', 'PROC-ONE', 'RECEIPT-ONE', 'PTIN-ONE']) expect(second).not.toContain(value);
    expect(second).not.toContain('L.R.S.-2020 Application:');
    expect(second).not.toContain('Property Tax:');
  });

  it('keeps old Layout / LRS fields alongside separate vacant tax and assessment records', async () => {
    const state = { ...initialState, category: 'Residential', linkRecordsBySchedule: { primary: [
      { id: 'old-layout', docNames: [], values: { linkOption: 'layoutLrs', layoutFileNo: 'OLD-LAYOUT', lrsApplicationNo: 'OLD-APP', lrsApplicationDate: '2023-02-03', lrsProceedingNo: 'OLD-PROC', lrsProceedingDate: '2023-04-05' } },
      { id: 'old-vlt', docNames: [], values: { linkOption: 'vacantTax', vltNo: 'OLD-VLT' } },
      { id: 'old-assessment', docNames: [], values: { linkOption: 'assessment', bltNo: 'OLD-PTIN' } },
    ] } };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    for (const value of ['OLD-LAYOUT', 'OLD-APP', 'OLD-PROC', 'OLD-VLT', 'OLD-PTIN']) expect(text).toContain(value);
  });

  it('does not borrow missing secondary party details from the first party', async () => {
    const state={...initialState,form:{...initialState.form,executantName:'First',executantMobile:'9876543210'},additionalExecutants:[{id:'second',docNames:[],values:{executantName:'Second'}}]};
    const result=await fillSaleDeed(mergeValues(state),'IF OPEN PLOT',rewritesFor(state));
    const text=await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text.match(/9876543210/g)).toHaveLength(1);
    expect(text).toMatch(/SECOND,[\s\S]*\(Hereinafter called the "VENDOR\/S"\)/);
    expect(text).not.toMatch(/SECOND,[\s\S]*Cell No:/);
  });

  it('removes empty claimant mobile, PAN and locality recitals without disturbing nearby details', async () => {
    const state = { ...initialState, form: {
      ...initialState.form,
      claimantName: 'Purchaser', claimantRelation: 'S/O', claimantRelativeName: 'Parent', claimantAge: '30', claimantDob: '1996-01-02',
      claimantOccupation: 'Business', claimantHNo: '1-2-3', claimantLocality: '', claimantVillage: 'Sircilla', claimantMandal: 'Sircilla',
      claimantDistrict: 'Rajanna', claimantState: 'Telangana', claimantPinCode: '505301', claimantAadhaar: '1234 5678 9012', claimantMobile: '', claimantPan: '',
    } };
    const result = await fillSaleDeed(mergeValues(state), 'IF OPEN PLOT', rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const recital = text.match(/PURCHASER,[\s\S]*?OTHER PART\./)?.[0] || '';
    expect(recital).toContain('R/o H.No.1-2-3, Sircilla Village');
    expect(recital).toContain('Aadhaar No: 1234 5678 9012,');
    expect(recital).not.toContain('Cell No:');
    expect(recital).not.toContain('PAN:');
    expect(recital).not.toMatch(/,\s*,|\s{2,}|\s+[,.]|:\s*[,.]/);
  });

  it('keeps populated party mobile, PAN and locality recitals', async () => {
    const state = { ...initialState, form: { ...initialState.form, claimantName: 'Purchaser', claimantLocality: 'BY Nagar', claimantVillage: 'Sircilla', claimantMobile: '9876543210', claimantPan: 'ABCDE1234F' } };
    const result = await fillSaleDeed(mergeValues(state), 'IF OPEN PLOT', rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('BY Nagar, Sircilla Village');
    expect(text).toContain('Cell No: 9876543210');
    expect(text).toContain('PAN: ABCDE1234F');
  });

  it('fills the new PAN slots from the correct party', async () => {
    const state = { ...initialState, form: { ...initialState.form,
      executantName: 'Vendor One', executantPan: 'VENDO1234R',
      claimantName: 'Buyer One', claimantPan: 'BUYER1234P',
    } };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const vendor = text.split('IN FAVOUR OF')[0];
    const buyer = text.split('IN FAVOUR OF')[1].split('FLOW OF TITLE')[0];
    expect(vendor).toContain('PAN: VENDO1234R');
    expect(vendor).not.toContain('BUYER1234P');
    expect(buyer).toContain('PAN: BUYER1234P');
    expect(buyer).not.toContain('VENDO1234R');
  });

  it('uses the part assessment recital only for part open place', async () => {
    for (const category of ['Open Place', 'Part open place']) {
      const state = { ...initialState, category, form: { ...initialState.form, bltNo: 'PTIN-77' } };
      const result = await fillSaleDeed(mergeValues(state), variantFor(category), rewritesFor(state), scheduleMergesFor(state));
      const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
      expect(text.match(/Tax\/Assessment & Identification Particulars:/g)).toHaveLength(1);
      expect(text).toContain('Assessment No. PTIN-77');
      expect(text.includes('Assessment No. PTIN-77 (Part).')).toBe(category === 'Part open place');
    }
  });

  it('cleans opted-in empty fields across split Word runs in a custom template', async () => {
    const bytes = await customizedTemplate(xml => xml.replace(
      '&lt;Claimant Locality&gt;',
      '&lt;Claimant Lo</w:t></w:r><w:r><w:t>cality&gt;',
    ));
    const validation = await validateSaleDeedTemplate(bytes, 'split-custom.docx');
    expect(validation.valid).toBe(true);
    const source: DeedTemplateSource = { kind: 'custom', name: 'split-custom.docx', hash: 'split', bytes, validation };
    const state = { ...initialState, form: { ...initialState.form, claimantName: 'Purchaser', claimantHNo: '5', claimantLocality: '', claimantVillage: 'Town' } };
    const result = await fillSaleDeed(mergeValues(state), 'IF OPEN PLOT', rewritesFor(state), [], source);
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('R/o H.No.5, Town Village');
    expect(text).not.toContain(', ,');
  });

  it('fills every mapped placeholder in the selected house schedule', async () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.type === 'date' ? '2026-01-02' : '1']));
    form.executantName = 'Vendor Name';
    form.claimantName = 'Purchaser Name';
    form.executantAadhaar = '1111 1111 1111';
    form.claimantAadhaar = '2222 2222 2222';
    form.roofMaterial = 'R.C.C.';
    form.constructionDescription = 'Framed with pillars & columns only';
    const payment = { ...newPayment('cheque'), amount: '100000', refNo: '123456', bank: 'Test Bank', branch: 'Main', date: '2026-01-02', payer: 'Purchaser Name', payee: 'Vendor Name' };
    const state = { ...initialState, deedType: 'Sale', category: 'Residential', draft: 'Outright Absolute Sale Deed', form, payments: [payment],
      linkRecordsBySchedule: { primary: [{ id: 'link-1', values: form, docNames: [] }] },
      structureDetailsBySchedule: { primary: { totalFloors: '1', rows: [{ ...newStructureDetail(), floorNo: 'Ground', structureType: 'R.C.C. Building', stage: 'Finished', buildingAge: '5', builtUpAreaSqFt: '700' }] } } };

    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    expect(result.missing).toEqual([]);
    expect(result.unmapped).toEqual([]);
    expect(result.blob.size).toBeGreaterThan(0);
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('DECLARATION');
    expect(text).toContain('SIGN/S OF VENDOR/S');
    expect(text).toContain('WITNESSES:');
  });

  it('recites each payment amount instead of assigning the combined total to the cheque', async () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.type === 'date' ? '2026-01-02' : '1']));
    form.executantName = 'Vendor Name';
    form.claimantName = 'Purchaser Name';
    form.saleConsideration = '600000';
    const cheque = {
      ...newPayment('cheque'),
      amount: '500000',
      refNo: '02002408',
      bank: 'Union Bank of India',
      branch: 'Gopal Nagar, Siricilla Branch',
      date: '2026-08-26',
      payer: 'Purchaser Name',
      payee: 'Vendor Name',
    };
    const cash = {
      ...newPayment('cash'),
      amount: '100000',
      date: '2026-09-11',
      payer: 'Purchaser Name',
      payee: 'Vendor Name',
    };
    const state = {
      ...initialState,
      deedType: 'Sale',
      category: 'Residential',
      draft: 'Outright Absolute Sale Deed',
      form,
      payments: [cheque, cash],
    };

    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));

    expect(text).toContain('Cheque: Amount of Rs.5,00,000/-');
    expect(text).toContain('Cash: Amount of Rs.1,00,000/-');
    expect(text).not.toContain('Cheque: Amount of Rs.6,00,000/-');
  });

  it('omits missing payment dates from every generated payment paragraph', async () => {
    const payments = (['rtgs', 'cheque', 'dd', 'upi', 'cash'] as const).map((mode, index) => ({
      ...newPayment(mode), amount: '100', refNo: `REF-${index}`, bank: 'Test Bank', date: '',
    }));
    const state = { ...initialState, payments };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    for (const label of ['RTGS/NEFT:', 'Cheque:', 'Demand Draft:', 'UPI/Online:', 'Cash:']) expect(text).toContain(label);
    expect(text).not.toMatch(/\bdated\s*(?:[,.;]|_{2,}|\n|$)/i);
    expect(text).not.toContain('dated __________');
  });

  it('keeps RTGS reference and bank fields in the updated draft', async () => {
    const state = { ...initialState, payments: [{
      ...newPayment('rtgs'), amount: '125000', refNo: 'UTR-987654', bank: 'Union Bank', date: '2026-09-18',
    }] };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('Transaction No./UTR No. UTR-987654, dated 18-09-2026, from Union Bank.');
  });

  it('generates every linked deed, party and property schedule', async () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.type === 'date' ? '2026-01-02' : '1']));
    form.executantName = 'Vendor One';
    form.executantAadhaar = '1111 1111 1111';
    form.claimantName = 'Purchaser One';
    form.claimantAadhaar = '2222 2222 2222';
    form.linkDocNo = '100/2020';
    form.linkDocType = 'Registered Sale Deed';
    form.linkSro = 'Sircilla';
    const state = {
      ...initialState,
      deedType: 'Sale',
      category: 'Residential',
      draft: 'Outright Absolute Sale Deed',
      form,
      additionalLinkDocuments: [{ id: 'link-2', docNames: ['link2.pdf'], values: { linkDocType: 'Gift Deed', linkDocNo: '200/2021', linkDocDate: '2021-03-04', linkSro: 'Sircilla' } }],
      additionalExecutants: [{ id: 'vendor-2', docNames: ['vendor2.jpg'], values: { ...form, executantName: 'Vendor Two', executantAadhaar: '3333 3333 3333' } }],
      additionalClaimants: [{ id: 'buyer-2', docNames: ['buyer2.jpg'], values: { ...form, claimantName: 'Purchaser Two', claimantAadhaar: '4444 4444 4444' } }],
      additionalSchedules: [{ id: 'schedule-2', docNames: ['plan2.pdf'], category: 'Vacant Plot', unit: 'Sq. Yards', values: { ...form, plotNo: '2', extentValue: '200', extentSqYards: '200' } }],
    };

    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));

    expect(text).toContain('Document No. 100/2020');
    expect(text).toContain('Document No. 200/2021');
    expect(text).toContain('VENDOR ONE');
    expect(text).toContain('VENDOR TWO');
    expect(text).toContain('1111 1111 1111');
    expect(text).toContain('3333 3333 3333');
    expect(text).toContain('PURCHASER TWO');
    expect(text).toContain('SCHEDULE OF PROPERTY - 1');
    expect(text).toContain('SCHEDULE OF PROPERTY - 2');
    expect(text.match(/DECLARATION/g)).toHaveLength(1);
  });

  it('numbers multiple parties at the opening and signatures and isolates vendee shares by schedule', async () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.type === 'date' ? '2026-01-02' : '1']));
    form.executantName = 'Vendor One';
    form.claimantName = 'Purchaser One';
    const state = {
      ...initialState, deedType: 'Sale', category: 'Vacant Plot', form,
      additionalExecutants: [{ id: 'vendor-2', docNames: [], values: { ...form, executantName: 'Vendor Two' } }],
      additionalClaimants: [{ id: 'buyer-2', docNames: [], values: { ...form, claimantName: 'Purchaser Two' } }],
      additionalSchedules: [{ id: 'schedule-2', docNames: [], category: 'Open Place', unit: 'Sq. Yards', values: { ...form, plotNo: '2' } }],
      vendeeSharesBySchedule: { primary: { primary: '60', 'buyer-2': '40' }, 'schedule-2': { primary: '25', 'buyer-2': '75' } },
    };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const opening = text.slice(0, text.indexOf('FLOW OF TITLE'));
    expect(opening).toContain('1. VENDOR ONE');
    expect(opening).toContain('2. VENDOR TWO');
    expect(opening).toContain('1. PURCHASER ONE');
    expect(opening).toContain('2. PURCHASER TWO');
    const partyLines = opening.split('\n');
    for (const [first, last, closing] of [
      ['1. VENDOR ONE', '2. VENDOR TWO', '(Hereinafter called the "VENDOR/S") of the ONE PART.'],
      ['1. PURCHASER ONE', '2. PURCHASER TWO', '(Hereinafter called the "VENDEE/S") of the OTHER PART.'],
    ]) {
      const firstLine = partyLines.find(line => line.startsWith(first))!;
      const lastLine = partyLines.find(line => line.startsWith(last))!;
      expect(firstLine).toMatch(/\.$/);
      expect(firstLine).not.toMatch(/[,;.]\.$/);
      expect(firstLine).not.toContain('Hereinafter called');
      expect(firstLine).not.toContain('of the ONE PART');
      expect(firstLine).not.toContain('of the OTHER PART');
      expect(lastLine).toContain(closing);
      expect(opening.split(closing)).toHaveLength(2);
    }
    const first = text.slice(text.indexOf('SCHEDULE OF PROPERTY - 1'), text.indexOf('SCHEDULE OF PROPERTY - 2'));
    const second = text.slice(text.indexOf('SCHEDULE OF PROPERTY - 2'), text.indexOf('DECLARATION'));
    expect(first).toContain('(1) PURCHASER ONE — 60%; (2) PURCHASER TWO — 40%');
    expect(second).toContain('(1) PURCHASER ONE — 25%; (2) PURCHASER TWO — 75%');
    expect(first).not.toContain('PURCHASER ONE — 25%');
    expect(second).not.toContain('PURCHASER ONE — 60%');
    const signatures = text.slice(text.indexOf('SIGN/S OF VENDOR/S'));
    expect(signatures).toMatch(/1\.[^\n]*VENDOR ONE[^\n]*\n1\.[^\n]*PURCHASER ONE/);
    expect(signatures).toMatch(/2\.[^\n]*VENDOR TWO[^\n]*\n2\.[^\n]*PURCHASER TWO/);
  });

  it('keeps a single vendor unnumbered and shows blank shares in an incomplete multi-vendee draft', async () => {
    const state = {
      ...initialState, deedType: 'Sale', category: 'Vacant Plot',
      form: { ...initialState.form, executantName: 'Only Vendor', claimantName: 'First Buyer' },
      additionalClaimants: [{ id: 'buyer-2', docNames: [], values: { claimantName: 'Second Buyer' } }],
      vendeeSharesBySchedule: { primary: { primary: '70' } },
    };
    const result = await fillSaleDeed(mergeValues(state), 'IF OPEN PLOT', rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const opening = text.slice(0, text.indexOf('FLOW OF TITLE'));
    expect(opening).toContain('ONLY VENDOR');
    expect(opening).not.toContain('1. ONLY VENDOR');
    expect(opening).toContain('(Hereinafter called the "VENDOR/S") of the ONE PART.');
    expect(opening).toContain('1. FIRST BUYER');
    expect(opening).toContain('2. SECOND BUYER');
    expect(opening.split('(Hereinafter called the "VENDEE/S") of the OTHER PART.')).toHaveLength(2);
    expect(opening.split('\n').find(line => line.startsWith('1. FIRST BUYER'))).not.toContain('Hereinafter called');
    expect(opening.split('\n').find(line => line.startsWith('2. SECOND BUYER'))).toContain('(Hereinafter called the "VENDEE/S") of the OTHER PART.');
    expect(text).toContain('(1) FIRST BUYER — 70%; (2) SECOND BUYER — ____%');
    const signatures = text.slice(text.indexOf('SIGN/S OF VENDOR/S'));
    expect(signatures).toContain('ONLY VENDOR');
    expect(signatures).toContain('2. ________________ (SECOND BUYER)');
  });

  it('puts the party closing clauses only after the third person on each side', async () => {
    const state = { ...initialState,
      form: { ...initialState.form, executantName: 'Vendor One', claimantName: 'Buyer One' },
      additionalExecutants: [
        { id: 'vendor-2', docNames: [], values: { executantName: 'Vendor Two' } },
        { id: 'vendor-3', docNames: [], values: { executantName: 'Vendor Three' } },
      ],
      additionalClaimants: [
        { id: 'buyer-2', docNames: [], values: { claimantName: 'Buyer Two' } },
        { id: 'buyer-3', docNames: [], values: { claimantName: 'Buyer Three' } },
      ],
    };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const opening = text.slice(0, text.indexOf('FLOW OF TITLE'));
    const lines = opening.split('\n');
    for (const [prefix, role, part] of [['VENDOR', 'VENDOR/S', 'ONE'], ['BUYER', 'VENDEE/S', 'OTHER']]) {
      const partyLines = [1, 2, 3].map(index => lines.find(line => line.startsWith(`${index}. ${prefix} ${['ONE', 'TWO', 'THREE'][index - 1]}`))!);
      expect(partyLines.every(Boolean)).toBe(true);
      expect(partyLines[0]).not.toContain('Hereinafter called');
      expect(partyLines[1]).not.toContain('Hereinafter called');
      expect(partyLines[0]).toMatch(/\.$/);
      expect(partyLines[1]).toMatch(/\.$/);
      expect(partyLines[0]).not.toMatch(/[,;.]\.$/);
      expect(partyLines[1]).not.toMatch(/[,;.]\.$/);
      expect(partyLines[2]).toContain(`(Hereinafter called the "${role}") of the ${part} PART.`);
      expect(opening.match(new RegExp(`Hereinafter called the "${role.replace('/', '\\/')}"`, 'g'))).toHaveLength(1);
    }
  });

  it('keeps both closing clauses for a single vendor and vendee', async () => {
    const state = { ...initialState, form: { ...initialState.form, executantName: 'Only Vendor', claimantName: 'Only Buyer' } };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const opening = text.slice(0, text.indexOf('FLOW OF TITLE'));
    expect(opening).toContain('(Hereinafter called the "VENDOR/S") of the ONE PART.');
    expect(opening).toContain('(Hereinafter called the "VENDEE/S") of the OTHER PART.');
    expect(opening).not.toContain('1. ONLY VENDOR');
    expect(opening).not.toContain('1. ONLY BUYER');
  });

  it('removes the blank trailing market-value row that can repeat an orphaned header', async () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.type === 'date' ? '2026-01-02' : '1']));
    const state = {
      ...initialState, deedType: 'Sale', category: 'Residential', form,
      additionalSchedules: [{ id: 'plot-2', docNames: [], category: 'Vacant Plot', unit: 'Sq. Yards', values: { ...form, plotNo: 'PLOT-2' } }],
    };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const document = (await readZip(new Uint8Array(await result.blob.arrayBuffer()))).find(entry => entry.name === 'word/document.xml')!;
    const xml = new TextDecoder().decode(document.data);
    const marketTable = (xml.match(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g) || [])
      .find(table => /Market Value per Sq\.\s*Yard/i.test(table.replace(/<[^>]+>/g, '')));
    expect(marketTable).toBeDefined();
    const rows = marketTable!.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) || [];
    expect(rows).toHaveLength(7);
    expect(rows.at(-1)).toContain('Total Market Value');
  });

  it('does not add supporting-record prose to the reference template', async () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.type === 'date' ? '2026-01-02' : '1']));
    const state = {
      ...initialState,
      deedType: 'Sale',
      category: 'Vacant Plot',
      draft: 'Outright Absolute Sale Deed',
      form,
      supportingRecords: [
        { id: 'tax', scheduleId: 'primary', docName: 'House Tax.jpeg', values: { supportingDocType: 'House Tax Receipt', supportingAssessmentNo: '10817', supportingHouseNo: '4-5-69/2' } },
        { id: 'ppb', scheduleId: 'primary', docName: 'PPB.jpeg', values: { supportingDocType: 'Pattadar Passbook', supportingPassbookNo: 'T19130081677', supportingKhataNo: '60770' } },
        { id: 'nala', scheduleId: 'primary', docName: 'NALA.jpeg', values: { supportingDocType: 'NALA Conversion Order', supportingNalaOrderNo: '2100567803', supportingSurveyNo: '1164D/2/1/1/1/1/2', supportingExtent: '0.0193' } },
        { id: 'permit', scheduleId: 'primary', docName: 'permission.pdf', values: { supportingDocType: 'Building Permit Order', supportingPermitNo: '3016/W20/2020/2108', supportingSurveyNo: '795/B&D', supportingPlotNo: '16' } },
        { id: 'power', scheduleId: 'primary', docName: 'ELECTRICITY.jpeg', values: { supportingDocType: 'Electricity Bill', supportingElectricityScNo: '60612 00100', supportingElectricityUscNo: '20112026' } },
      ],
    };

    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));

    expect(text).not.toContain('SUPPORTING PROPERTY RECORDS');
    expect(text).not.toContain('Passbook No. T19130081677');

    const preview = await scheduleText(
      scheduleMergesFor(state)[0].variant,
      scheduleMergesFor(state)[0].values,
      scheduleMergesFor(state)[0].supportingRecords,
    );
    expect(preview).not.toContain('SUPPORTING PROPERTY RECORDS');
    expect(preview).not.toContain('Passbook No. T19130081677');
  });

  it('renders three house floors in the schedule and original Annexure I-A without an added table', async () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.type === 'date' ? '2026-01-02' : '1']));
    form.roofMaterial = 'R.C.C.';
    form.constructionDescription = 'Framed with pillars & columns only';
    form.bearingHNo = '6-5-62/1';
    form.boundaryNorth = "33' Road";
    form.boundarySouth = 'House of Gudla Babu';
    form.boundaryEast = "26' Road";
    form.boundaryWest = 'House of Adepu Krishahari';
    const rows = [
      { ...newStructureDetail(), floorNo: 'Ground', structureType: 'R.C.C. Building', stage: 'Finished', buildingAge: '5', builtUpAreaSqFt: '700' },
      { ...newStructureDetail(), floorNo: 'Floor No. 1', structureType: 'Other / Custom Structure', customStructureType: 'Stone masonry', stage: 'Semi-Finished', buildingAge: '3', builtUpAreaSqFt: '750' },
      { ...newStructureDetail(), floorNo: 'Floor No. 2', structureType: 'R.C.C. Building', stage: 'Finished', buildingAge: '2', builtUpAreaSqFt: '800' },
    ];
    const state = { ...initialState, deedType: 'Sale', category: 'Residential', draft: 'Outright Absolute Sale Deed', form, structureDetailsBySchedule: { primary: { totalFloors: '3', rows } } };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const text = await docxToText(bytes);
    expect(text).toContain('All that the R.C.C. Building with the open place bearing H.No.6-5-62/1');
    expect(text).toContain('BUILDING / FLOOR DETAILS:');
    expect(text).toContain('Ground Floor\nR.C.C. Building\nFinished\n5 Years\n700 Sq.Ft.');
    expect(text).toContain('First Floor\nStone masonry\nSemi-Finished\n3 Years\n750 Sq.Ft.');
    expect(text).toContain('Second Floor\nR.C.C. Building\nFinished\n2 Years\n800 Sq.Ft.');
    expect(text).toContain('TOTAL\n2,250 Sq.Ft.');
    expect(text).toContain("33' Road");
    expect(text).toContain('House of Gudla Babu');
    expect(text).toContain("26' Road");
    expect(text).toContain('House of Adepu Krishahari');
    expect(text).toContain('ANNEXURE – 1A');
    expect(text).toContain('Nature of roof\n: R.C.C.');
    expect(text).toContain('Type of structure\n: Framed with pillars & columns only');
    expect(text).not.toContain('Age of the house\n:');
    expect(text).toContain('3.\nGround Floor\n: 700 sq.fts\nFirst Floor\n: 750 sq.fts (Semi-Finished)\nSecond Floor\n: 800 sq.fts');
    expect(text).not.toContain('Total built-up area of the property');
    expect(text).toContain('R.C.C. Building');
    expect(text).toContain('Stone masonry');
    expect(text).not.toContain('Semi-Finished — 3 years — 750 sq.fts');
    expect(text).toContain('First Floor');
    expect(text).toContain('750');
    expect(text).not.toContain('ANNEXURE I-A — STRUCTURE DETAILS');
    expect(text).not.toContain('Built-up Area (Sq. Ft.)');
    const document = (await readZip(bytes)).find(entry => entry.name === 'word/document.xml')!;
    const xml = new TextDecoder().decode(document.data);
    const houseBlock = xml.slice(xml.indexOf('SCHEDULE OF PROPERTY'), xml.indexOf('DECLARATION'));
    expect(houseBlock.match(/<w:tbl>/g)).toHaveLength(3); // building details, boundaries, and Annexure 1A
    const buildingRows = (houseBlock.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) || [])
      .filter(row => /(?:Ground|First|Second) Floor/.test(row) && (row.match(/<w:tc(?:\s[^>]*)?>/g) || []).length === 5);
    expect(buildingRows).toHaveLength(3);
    const floorTableRows = (houseBlock.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) || [])
      .filter(row => /(?:Ground|First|Second) Floor/.test(row) && (row.match(/<w:tc(?:\s[^>]*)?>/g) || []).length === 3);
    expect(floorTableRows).toHaveLength(3);
    const cellTexts = floorTableRows.map(row => (row.match(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g) || [])
      .map(cell => [...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match => match[1]).join('').trim()));
    expect(cellTexts).toEqual([
      ['3.', 'Ground Floor', ': 700 sq.fts'],
      ['', 'First Floor', ': 750 sq.fts (Semi-Finished)'],
      ['', 'Second Floor', ': 800 sq.fts'],
    ]);
    for (const row of floorTableRows) expect(row).toContain('<w:cantSplit/>');
    const preview = await scheduleText('IF HOUSE', scheduleMergesFor(state)[0].values, [], state.structureDetailsBySchedule.primary);
    expect(preview).toContain('Ground Floor\n\nR.C.C. Building\n\nFinished\n\n5 Years\n\n700 Sq.Ft.');
    expect(preview).toContain('Ground Floor\n\n: 700 sq.fts');
    expect(preview).toContain('First Floor\n\n: 750 sq.fts (Semi-Finished)');
    expect(preview).toContain('Second Floor\n\n: 800 sq.fts');
  });

  it('shows every unfinished stage beside its Annexure I-A floor area', async () => {
    const stages = ['Foundation', 'Upto Lintel level', 'Upto Slab/Roof level', 'Semi-Finished', 'Finished'];
    const rows = stages.map((stage, index) => ({
      ...newStructureDetail(), floorNo: index ? `Floor No. ${index}` : 'Ground',
      structureType: 'R.C.C. Building', stage, buildingAge: '1', builtUpAreaSqFt: String(101 + index),
    }));
    const details = { totalFloors: '5', rows };
    const state = { ...initialState, category: 'Residential', structureDetailsBySchedule: { primary: details } };
    const preview = await scheduleText('IF HOUSE', scheduleMergesFor(state)[0].values, [], details);
    expect(preview).toContain('Ground Floor\n\n: 101 sq.fts (Foundation)');
    expect(preview).toContain('First Floor\n\n: 102 sq.fts (Upto Lintel level)');
    expect(preview).toContain('Second Floor\n\n: 103 sq.fts (Upto Slab/Roof level)');
    expect(preview).toContain('Third Floor\n\n: 104 sq.fts (Semi-Finished)');
    expect(preview).toContain('Fourth Floor\n\n: 105 sq.fts');
    expect(preview).not.toContain('105 sq.fts (Finished)');
  });

  it('retains item 4 without invented floors in an incomplete house draft', async () => {
    const state = { ...initialState, category: 'Residential', structureDetailsBySchedule: { primary: { totalFloors: '', rows: [] } } };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('3.\nTotal built-up area of the property');
    expect(text).not.toContain('Ground Floor\n:');
    expect(text).not.toContain('<Plinth Area>');
  });

  it('does not render Annexure I-A for an open-plot schedule with stale structure rows', async () => {
    const rows = [{ ...newStructureDetail(), floorNo: 'Ground', structureType: 'R.C.C. Building', stage: 'Finished', buildingAge: '4', builtUpAreaSqFt: '900' }];
    const state = { ...initialState, category: 'Vacant Plot', form: { ...initialState.form, plotNo: '1' }, structureDetailsBySchedule: { primary: { totalFloors: '1', rows } } };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).not.toContain('ANNEXURE I-A â€” STRUCTURE DETAILS');
    expect(text).not.toContain('Built-up Area (Sq. Ft.)');
  });

  it('keeps house floor and roof details scoped to their own schedules', async () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.type === 'date' ? '2026-01-02' : '1']));
    Object.assign(form, { bearingHNo: 'HOUSE-A', roofMaterial: 'R.C.C.', constructionDescription: 'Pillars and columns', extentSqYards: '100' });
    const primary = { totalFloors: '1', rows: [{ ...newStructureDetail(), floorNo: 'Ground', structureType: 'R.C.C. Building', stage: 'Finished', buildingAge: '5', builtUpAreaSqFt: '700' }] };
    const second = { totalFloors: '1', rows: [{ ...newStructureDetail(), floorNo: 'Ground', structureType: 'Tiled House', stage: 'Semi-Finished', buildingAge: '8', builtUpAreaSqFt: '450' }] };
    const state = { ...initialState, category: 'Residential', form, structureDetailsBySchedule: { primary, houseB: second }, additionalSchedules: [
      { id: 'houseB', docNames: [], category: 'Residential', unit: 'Sq. Yards', values: { ...form, bearingHNo: 'HOUSE-B', roofMaterial: 'Clay tiles', constructionDescription: 'Load bearing walls', extentSqYards: '80' } },
      { id: 'plotC', docNames: [], category: 'Vacant Plot', unit: 'Sq. Yards', values: { ...form, plotNo: 'PLOT-C', extentSqYards: '60' } },
    ] };
    const merges = scheduleMergesFor(state);
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), merges);
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    const first = text.slice(text.indexOf('SCHEDULE OF PROPERTY - 1'), text.indexOf('SCHEDULE OF PROPERTY - 2'));
    const next = text.slice(text.indexOf('SCHEDULE OF PROPERTY - 2'), text.indexOf('SCHEDULE OF PROPERTY - 3'));
    const plot = text.slice(text.indexOf('SCHEDULE OF PROPERTY - 3'), text.indexOf('DECLARATION'));
    expect(first).toContain('HOUSE-A');
    expect(first).toContain('R.C.C.');
    expect(first).toContain('700 sq.fts');
    expect(first).not.toContain('Clay tiles');
    expect(next).toContain('HOUSE-B');
    expect(next).toContain('Clay tiles');
    expect(next).toContain('Load bearing walls');
    expect(next).toContain('450 sq.fts');
    expect(next).not.toContain('700 sq.fts');
    expect(plot).toContain('PLOT-C');
    expect(plot).not.toContain('ANNEXURE-IA');
    expect(plot).not.toContain('Clay tiles');
  });

  it('keeps the PTIN preamble in a house deed and its live document preview', async () => {
    const state = { ...initialState, category: 'Residential', form: { ...initialState.form, bltNo: 'PTIN-88' } };
    const merge = scheduleMergesFor(state)[0];
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), [merge]);
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('Tax/Assessment & Identification Particulars:');
    expect(text).toContain('Assessment No. PTIN-88');
  });
});
