import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { docxToText, fillSaleDeed, scheduleText, replaceRunText, readZip } from './docx';
import { ALL_FIELDS } from './fields';
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

  it('replaces split-run fields without losing the surrounding bold or line break', () => {
    const paragraph = '<w:p><w:r><w:t>Before &lt;Na</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>me&gt; bold</w:t><w:br/><w:t>tail &lt;Name&gt;</w:t></w:r></w:p>';
    const result = replaceRunText(paragraph, /<Name>/g, () => 'A & B');
    expect(result).toContain('<w:t xml:space="preserve">Before A &amp; B</w:t>');
    expect(result).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> bold</w:t><w:br/>');
    expect(result).toContain('tail A &amp; B');
  });

  it('exports blanks without sample data and preserves template styles and numbering', async () => {
    const result = await fillSaleDeed(mergeValues(initialState), 'IF OPEN PLOT', rewritesFor(initialState));
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const text = await docxToText(bytes);
    expect(text).not.toMatch(/2026|Kailash|<EXECUTANT|<Claimant|undefined|NaN/);
    expect(text).toContain('made and executed on __________ at Sircilla');
    expect(text).toContain('Cell No: __________');
    // No execution date was entered, so the signature block gets its own
    // fill-in-by-hand line instead of repeating "the afore mentioned date".
    expect(text).toContain('on this the ____________ day of ____________, 20____.');
    expect(text).not.toContain('on the afore mentioned date.');
    for (let n = 1; n <= 8; n++) expect(text).toContain(`${n}. THE`);
    const original = await readZip(new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url))));
    const generated = await readZip(bytes);
    for (const name of ['word/styles.xml','word/numbering.xml','word/footer1.xml']) {
      expect(generated.find(e => e.name === name)?.data).toEqual(original.find(e => e.name === name)?.data);
    }
  });

  it('prints the sale consideration, not the calculated basic-rate market value, on the first page', async () => {
    const state = { ...initialState, form: { ...initialState.form, extentValue:'100', govtRate:'10000', consid:'800000', executionDate:'2026-09-11' } };
    const result = await fillSaleDeed(mergeValues(state), 'IF OPEN PLOT', rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).not.toContain('10,00,000');
    expect(text).toContain('Market Value of Rs.8,00,000');
    expect(text).toContain('total sale consideration of Rs.8,00,000');
    expect(text).toContain('made and executed on 11-09-2026');
    // A real execution date was entered, so the signature block still refers
    // back to it rather than growing its own fill-in-by-hand line.
    expect(text).toContain('on the afore mentioned date.');
  });

  it('appends plans without moving deed paragraphs inside a section property', async () => {
    const png = new Uint8Array([137,80,78,71]); // Package structure check, not image rendering.
    const result = await fillSaleDeed(mergeValues(initialState), 'IF OPEN PLOT', rewritesFor(initialState), [], [png]);
    const entries = await readZip(new Uint8Array(await result.blob.arrayBuffer()));
    const xml = new TextDecoder().decode(entries.find(e=>e.name==='word/document.xml')!.data);
    const sections = [...xml.matchAll(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/g)];
    expect(sections).toHaveLength(3);
    for (const section of sections) expect(section[0]).not.toContain('<w:p>');
    expect(xml).toContain('w:top="8208"');
    expect(xml).toContain('DECLARATION');
    expect(entries.find(e=>e.name==='word/media/deedcraft-plan-0.png')).toBeDefined();
  });

  it('keeps the house annexure consideration distinct from market value', async () => {
    const state = { ...initialState, category:'Residential', form:{...initialState.form,extentValue:'100',govtRate:'10000',consid:'800000'} };
    const result=await fillSaleDeed(mergeValues(state),'IF HOUSE',rewritesFor(state),scheduleMergesFor(state));
    const text=await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toMatch(/Consideration\s+: Rs\.8,00,000/);
    expect(text).toMatch(/estimate M\.V\.\s+: Rs\.10,00,000/);
  });

  it('uses the new Open Place schedule and omits optional title recitals without source details', async () => {
    const state = { ...initialState, category: 'Open Place' };
    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state));
    const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text).toContain('All that the open place, admeasuring');
    expect(text).not.toContain('Vacant Land Tax/Assessment');
    expect(text).not.toContain('L.R.S.-2020 Application');
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
    expect(text.match(/\(a\) Registered Deed:/g)).toHaveLength(2);
    expect(text).toContain('Document No.OPEN/101');
    expect(text).toContain('Document No.HOUSE/202');
    expect(text).toContain('TAX-OPEN');
    expect(text).toContain('PERMIT-HOUSE');
    const firstFlow = text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 1');
    const secondFlow = text.indexOf('FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE 2');
    expect(firstFlow).toBeLessThan(secondFlow);
    expect(text.indexOf('TAX-OPEN')).toBeLessThan(secondFlow);
    expect(text.indexOf('PERMIT-HOUSE')).toBeGreaterThan(secondFlow);
  });

  it('does not borrow missing secondary party details from the first party', async () => {
    const state={...initialState,form:{...initialState.form,executantName:'First',executantMobile:'9876543210'},additionalExecutants:[{id:'second',docNames:[],values:{executantName:'Second'}}]};
    const result=await fillSaleDeed(mergeValues(state),'IF OPEN PLOT',rewritesFor(state));
    const text=await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
    expect(text.match(/9876543210/g)).toHaveLength(1);
    expect(text).toMatch(/Second,[\s\S]*Cell No: __________/);
  });

  it('fills every mapped placeholder in the selected house schedule', async () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.type === 'date' ? '2026-01-02' : '1']));
    form.executantName = 'Vendor Name';
    form.claimantName = 'Purchaser Name';
    form.executantAadhaar = '1111 1111 1111';
    form.claimantAadhaar = '2222 2222 2222';
    const payment = { ...newPayment('cheque'), amount: '100000', refNo: '123456', bank: 'Test Bank', branch: 'Main', date: '2026-01-02', payer: 'Purchaser Name', payee: 'Vendor Name' };
    const state = { ...initialState, deedType: 'Sale', category: 'Residential', draft: 'Outright Absolute Sale Deed', form, payments: [payment] };

    const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state));
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

    expect(text).toContain('Amount of Rs.5,00,000/- paid through Cheque');
    expect(text).toContain('Amount of Rs.1,00,000/- paid via cash');
    expect(text).not.toContain('Amount of Rs.6,00,000/- paid through Cheque');
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

    expect(text).toContain('Document No.100/2020');
    expect(text).toContain('Document No.200/2021');
    expect(text).toContain('Vendor One');
    expect(text).toContain('Vendor Two');
    expect(text).toContain('1111 1111 1111');
    expect(text).toContain('3333 3333 3333');
    expect(text).toContain('Purchaser Two');
    expect(text).toContain('SCHEDULE OF PROPERTY - 1');
    expect(text).toContain('SCHEDULE OF PROPERTY - 2');
    expect(text.match(/DECLARATION/g)).toHaveLength(1);
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
});
