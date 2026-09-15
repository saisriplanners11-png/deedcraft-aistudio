import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ALL_FIELDS } from './fields';
import { docxToText, fillSaleDeed } from './docx';
import { initialState } from './logic';
import { mergeValues, rewritesFor, scheduleMergesFor, variantFor } from './merge';
import { newPayment } from './payments';

const template = await readFile(new URL('./sale-deed-template.docx', import.meta.url));
globalThis.fetch = async () => new Response(template);

const form = Object.fromEntries(ALL_FIELDS.map(field => [
  field.id,
  field.type === 'date' ? '2026-08-26' : field.type === 'number' || field.type === 'money' ? '1' : `QA ${field.label}`,
]));

Object.assign(form, {
  linkDocType: 'Registered Sale Deed',
  linkDocNo: '1263/2016',
  linkDocDate: '2016-02-27',
  linkSro: 'Sircilla',
  executionDate: '2026-08-26',
  propState: 'Telangana',
  district: 'Karimnagar',
  mandal: 'Sircilla',
  village: 'Sircilla',
  locality: 'Thukkaraopally/Ganeshnagar',
  pinCode: '505301',
  sro: 'Sircilla',
  districtRegistrar: 'Karimnagar',
  plotNo: '16',
  nearHNo: '10-1-36/1',
  surveyNo: '795/B&D',
  extentValue: '157.22',
  extentSqYards: '157.22',
  extentSqMeters: '132.06',
  boundaryNorth: 'Open place of North Owner',
  boundarySouth: "21' Road",
  boundaryEast: 'Remaining open plot no.16',
  boundaryWest: 'Open place of West Owner',
  govtRate: '1000',
  structValue: '0',
  consid: '600000',
  stampValue: '100',
  executantName: 'QA Vendor',
  executantRelation: 'S/o',
  executantRelativeName: 'QA Parent',
  executantAge: '55',
  executantDob: '1971-01-08',
  executantOccupation: 'Business',
  executantAadhaar: '1111 1111 1111',
  executantMobile: '9000000001',
  executantHNo: '11-1-138',
  executantLocality: 'B Y Nagar',
  executantVillage: 'Sircilla',
  executantMandal: 'Sircilla',
  executantDistrict: 'Karimnagar',
  executantState: 'Telangana',
  executantPinCode: '505301',
  claimantName: 'QA Purchaser',
  claimantRelation: 'S/o',
  claimantRelativeName: 'QA Parent',
  claimantAge: '30',
  claimantDob: '1996-05-12',
  claimantOccupation: 'Employee',
  claimantAadhaar: '2222 2222 2222',
  claimantMobile: '9000000002',
  claimantHNo: '11-1-138',
  claimantLocality: 'B Y Nagar',
  claimantVillage: 'Sircilla',
  claimantMandal: 'Sircilla',
  claimantDistrict: 'Karimnagar',
  claimantState: 'Telangana',
  claimantPinCode: '505301',
});

const payment = {
  ...newPayment('cheque'),
  amount: '500000',
  refNo: '02002408',
  bank: 'Union Bank of India',
  branch: 'GOPAL NAGAR, SIRICILLA BRANCH',
  date: '2026-08-26',
  payer: 'QA Purchaser',
  payee: 'QA Vendor',
};

const cash = {
  ...newPayment('cash'),
  amount: '100000',
  date: '2026-09-11',
  payer: 'QA Purchaser',
  payee: 'QA Vendor',
};

const state = {
  ...initialState,
  deedType: 'Sale',
  category: 'Part open place',
  draft: 'Outright Absolute Sale Deed',
  form,
  payments: [payment, cash],
  additionalLinkDocuments: [{
    id: 'qa-link-2', docNames: ['QA-Link-2.pdf'],
    values: { linkDocType: 'Gift Deed', linkDocNo: '200/2021', linkDocDate: '2021-03-04', linkSro: 'Sircilla' },
  }],
  additionalExecutants: [{ id: 'qa-vendor-2', docNames: ['QA-Vendor-2.jpg'], values: { ...form, executantName: 'QA Vendor Two', executantAadhaar: '3333 3333 3333' } }],
  additionalClaimants: [{ id: 'qa-purchaser-2', docNames: ['QA-Purchaser-2.jpg'], values: { ...form, claimantName: 'QA Purchaser Two', claimantAadhaar: '4444 4444 4444' } }],
  supportingRecords: [
    { id: 'qa-tax', scheduleId: 'primary', docName: 'House Tax.jpeg', values: { supportingDocType: 'House Tax Receipt', supportingDate: '2026-05-30', supportingAssessmentNo: '10817', supportingHouseNo: '4-5-69/2' } },
    { id: 'qa-nala', scheduleId: 'primary', docName: 'NALA.jpeg', values: { supportingDocType: 'NALA Conversion Order', supportingDate: '2021-07-06', supportingAuthority: 'Tahsildar & Jt. Sub Registrar Office, Sirsilla', supportingNalaOrderNo: '2100567803', supportingSurveyNo: '1164D/2/1/1/1/2', supportingExtent: '0.0193' } },
    { id: 'qa-ppb', scheduleId: 'primary', docName: 'PPB.jpeg', values: { supportingDocType: 'Pattadar Passbook', supportingAuthority: 'Government of Telangana', supportingPassbookNo: 'T19130081677', supportingKhataNo: '60770' } },
    { id: 'qa-permit', scheduleId: 'primary', docName: 'permission.pdf', values: { supportingDocType: 'Building Permit Order', supportingDate: '2020-12-24', supportingPermitNo: '3016/W20/2020/2108', supportingSurveyNo: '795/B&D', supportingPlotNo: '16', supportingExtent: '261.86 m2' } },
    { id: 'qa-electric', scheduleId: 'primary', docName: 'ELECTRICITY.jpeg', values: { supportingDocType: 'Electricity Bill', supportingDate: '2026-02-09', supportingAuthority: 'CESS LTD.', supportingHolder: 'T.RAJAIAH', supportingElectricityScNo: '60612 00100', supportingElectricityUscNo: '20112026' } },
  ],
  additionalSchedules: [{ id: 'qa-schedule-2', docNames: ['QA-Plan-2.pdf'], category: 'Vacant Plot', unit: 'Sq. Yards', values: { ...form, plotNo: '17', extentValue: '100', extentSqYards: '100', extentSqMeters: '83.61' } }],
};

const result = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
if (result.missing.length || result.unmapped.length) {
  throw new Error(`Unresolved template fields: ${[...result.missing, ...result.unmapped].join(', ')}`);
}

const output = resolve('output/QA-DeedCraft-Multiple-Records-Payments.docx');
await mkdir(resolve('output'), { recursive: true });
await writeFile(output, new Uint8Array(await result.blob.arrayBuffer()));

const text = await docxToText(new Uint8Array(await result.blob.arrayBuffer()));
for (const marker of ['SCHEDULE OF PROPERTY', 'DECLARATION', 'WITNESSES:', 'Prepared By']) {
  if (!text.includes(marker)) throw new Error(`Generated document is missing ${marker}`);
}
if (!/SIGN\/?S?\s+OF VENDOR\/S/i.test(text)) throw new Error('Generated document is missing the vendor signature line');
for (const expected of ['Rs. 5,00,000/- through Cheque', 'Rs. 1,00,000/- in cash', 'Document No.200/2021', 'QA Vendor Two', 'QA Purchaser Two', 'SCHEDULE OF PROPERTY - 2', 'Stamp of Rs.100/-']) {
  if (!text.includes(expected)) throw new Error(`Generated document is missing ${expected}`);
}
if (text.includes('SUPPORTING PROPERTY RECORDS')) throw new Error('Supporting evidence added an unauthorized paragraph');
if (text.includes('Rs. 6,00,000/- through Cheque')) throw new Error('Combined payment total was incorrectly assigned to the cheque');
console.log(output);
