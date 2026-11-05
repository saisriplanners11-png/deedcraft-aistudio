import { describe, expect, it } from 'vitest';
import { enclosureRecordsFor } from './enclosure-records';
import { appStateFor, draftReducer, newDraft } from './source-draft';
import { scheduleMergesFor } from './merge';

describe('independent Step 2 enclosures', () => {
  it('keeps dates and local authorities with their own permissions and tax receipts', () => {
    const result = enclosureRecordsFor([
      { values: { linkOption: 'permissions', permBuildingPermitNo: 'P1', permissionAuthorityName: 'FIRST OFFICE', permissionDate: '2021-02-03' } },
      { values: { linkOption: 'permissions', permBuildingPermitNo: 'P2', permissionAuthorityName: 'SECOND OFFICE' } },
      { values: { linkOption: 'houseTax', houseTaxReceiptNo: 'R1', localBodyName: 'FIRST BODY', taxPaidDate: '2022-03-04' } },
      { values: { linkOption: 'houseTax', houseTaxReceiptNo: 'R2', localBodyName: 'SECOND BODY', taxPaidDate: '2023-04-05' } },
    ]);
    expect(result.permissions?.map(row => [row['House Permission No.'], row['Permission Date'], row['Municipality/Gram Panchayat Name']]))
      .toEqual([['P1', '03-02-2021', 'First Office'], ['P2', '', 'Second Office']]);
    expect(result.houseTax?.map(row => [row['House Tax Receipt'], row['Tax Paid Date'], row['Local Body Name']]))
      .toEqual([['R1', '04-03-2022', 'First Body'], ['R2', '05-04-2023', 'Second Body']]);
  });

  it('does not combine partial passbooks or permissions into invented complete records', () => {
    expect(enclosureRecordsFor([
      { values: { linkOption: 'titleDeed', titleDeedNo: 'P1' } },
      { values: { linkOption: 'titleDeed', khataNo: 'K2' } },
      { values: { linkOption: 'permissions', permBuildingPermitNo: 'PERMIT1' } },
      { values: { linkOption: 'permissions', permissionAuthorityName: 'AUTHORITY2' } },
    ])).toEqual({});
  });

  it('preserves combined and legacy narrow cards across reload and removes only the selected record', () => {
    let draft = newDraft();
    const set = (record: string, field: string, value: string) => { draft = draftReducer(draft, { type: 'manual', key: `link|${record}|${field}`, value }); };
    draft = draftReducer(draft, { type: 'manual', key: 'property|primary|category', value: 'Open Place' });
    for (const [id, type, no] of [['first', 'landLayoutLrs', 'V1'], ['second', 'vacantTax', 'V2'], ['third', 'landLayoutLrs', 'V3']]) {
      draft = draftReducer(draft, { type: 'link-property', record: id, propertyId: 'primary' });
      set(id, 'linkOption', type); set(id, 'vltNo', no);
    }
    const restored = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) });
    expect(scheduleMergesFor(appStateFor(restored))[0].enclosureRecords?.vacantTax?.map(row => row['V.L.T.No.'])).toEqual(['V1', 'V2', 'V3']);
    const removed = draftReducer(restored, { type: 'remove-record', role: 'link', record: 'second' });
    expect(scheduleMergesFor(appStateFor(removed))[0].enclosureRecords?.vacantTax?.map(row => row['V.L.T.No.'])).toEqual(['V1', 'V3']);
  });
});

it('keeps card and output order stable when the third record receives uploaded values', () => {
  let draft = newDraft();
  draft = draftReducer(draft, { type: 'manual', key: 'property|primary|category', value: 'Open Place' });
  for (const record of ['first', 'second', 'third']) {
    draft = draftReducer(draft, { type: 'link-property', record, propertyId: 'primary' });
    draft = draftReducer(draft, { type: 'manual', key: `link|${record}|linkOption`, value: 'landLayoutLrs' });
    if (record !== 'third') draft = draftReducer(draft, { type: 'manual', key: `link|${record}|vltNo`, value: record });
  }
  draft.sources = [{ id: 'upload-third', name: 'third.txt', hash: 'third', revision: 0, status: 'done', profile: 'phase1:landLayoutLrs', assignment: { role: 'link', record: 'third', propertyRecord: 'primary' }, result: { plans: [], notes: [], candidates: [{ id: 'vlt', field: 'vltNo', value: 'third', role: 'link', record: 'primary', quote: 'VLT third', page: 1, region: 'Source label', historical: false, handwritten: false, status: 'accepted' }] } }];
  const state = appStateFor(draft);
  expect(state.linkRecordsBySchedule.primary.map(record => record.id)).toEqual(['first', 'second', 'third']);
  expect(scheduleMergesFor(state)[0].enclosureRecords?.vacantTax?.map(record => record['V.L.T.No.'])).toEqual(['first', 'second', 'third']);
});

it('honours newly entered grouped fields on retained legacy narrow cards', () => {
  const records = enclosureRecordsFor([
    { values: { linkOption: 'vacantTax', vltNo: 'VLT-OLD', lrsApplicationNo: 'APP-NEW', lrsApplicationDate: '2025-01-02' } },
    { values: { linkOption: 'assessment', houseTaxReceiptNo: 'RECEIPT-NEW', localBodyName: 'MUNICIPAL OFFICE' } },
  ]);
  expect(records.lrsApplication?.[0]).toEqual({ 'LRS Application No.': 'APP-NEW', 'Application Date': '02-01-2025' });
  expect(records.houseTax?.[0]['House Tax Receipt']).toBe('RECEIPT-NEW');
});
