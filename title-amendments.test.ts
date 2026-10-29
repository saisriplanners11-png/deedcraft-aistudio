import { expect, it } from 'vitest';
import { titleAmendmentKind, titleAmendmentValues } from './title-amendments';
import { appStateFor, draftReducer, newDraft } from './source-draft';
import { scheduleMergesFor } from './merge';

it('routes typed amendment names while leaving normal titles and flat-allotment agreements distinct', () => {
  for (const [type, kind] of [['Rectification Deed', 'rectification'], [' registered   RECTIFICATION deed ', 'rectification'], ['Supplemental Deed', 'supplemental'], ['REGISTERED supplemental DEED', 'supplemental']] as const) {
    expect(titleAmendmentKind({ linkDocType: type })).toBe(kind);
  }
  for (const type of ['', 'Rectificat', 'Sale Deed', 'Gift Settlement', 'Supplemental Agreement', 'Development Agreement Cum GPA']) expect(titleAmendmentKind({ linkDocType: type })).toBeUndefined();
  for (const linkOption of ['nala', 'houseTax', 'titleDeed', 'permissions']) expect(titleAmendmentKind({ linkOption, linkDocType: 'Rectification Deed', linkDocNo: 'INACTIVE-OLD-VALUE' })).toBeUndefined();
});

it('uses the active link card values and never the original title, flat agreement or another record', () => {
  const input = { linkOption: 'linkDoc', linkDocType: 'Rectification Deed', linkDocNo: 'CURRENT-42', linkDocDate: '2024-03-04', linkSro: 'OWN OFFICE', linkSroCode: 'OWN-CODE', rectificationDeedNo: 'OLDER-HIDDEN', rectificationDeedSro: 'OLDER OFFICE', supplementalDocNo: 'FLAT-ONLY', sro: 'PROPERTY OFFICE' };
  expect(titleAmendmentValues(input, 'rectification')).toEqual({ 'Rectification Deed Type': 'Rectification Deed', 'Rectification Deed No.': 'CURRENT-42', 'Rectification Deed Date': '04-03-2024', 'Rectification Deed SRO': 'OWN OFFICE', 'Rectification Deed SRO Code': 'OWN-CODE' });
  expect(input.rectificationDeedNo).toBe('OLDER-HIDDEN');
  expect(titleAmendmentValues({ linkDocType: 'Supplemental Deed', supplementalDocNo: 'FLAT-ONLY', sro: 'PROPERTY OFFICE' }, 'supplemental')['Supplemental Deed No.']).toBe('');
});

it('keeps the same saved record and entered details when the document type changes and after reload', () => {
  let draft = newDraft();
  draft = draftReducer(draft, { type: 'link-property', record: 'typed', propertyId: 'primary' });
  for (const [field, value] of Object.entries({ linkOption: 'linkDoc', linkDocType: 'Sale Deed', linkDocNo: 'SAVED-44', linkDocDate: '2024-02-03', linkSro: 'SAVED OFFICE', linkSroCode: '44' })) draft = draftReducer(draft, { type: 'manual', key: `link|typed|${field}`, value });
  const original = { ...draft.manual };
  for (const [type, kind] of [['Rectification Deed', 'rectification'], ['Supplemental Deed', 'supplemental']] as const) {
    draft = draftReducer(draft, { type: 'manual', key: 'link|typed|linkDocType', value: type });
    const state = appStateFor(draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) }));
    const schedule = scheduleMergesFor(state)[0];
    const record = state.linkRecordsBySchedule.primary.find(record => record.id === 'typed')!;
    expect(record.values.linkDocNo).toBe('SAVED-44');
    expect(record.values.linkSroCode).toBe('44');
    expect(schedule.amendmentRecords?.[kind]).toHaveLength(1);
    expect(schedule.titleLinkRecords).toEqual([]);
    expect(draft.manual).toEqual({ ...original, 'link|typed|linkDocType': type });
  }
  draft = draftReducer(draft, { type: 'manual', key: 'link|typed|linkDocType', value: 'Sale Deed' });
  const schedule = scheduleMergesFor(appStateFor(draft))[0];
  expect(schedule.amendmentRecords?.rectification).toEqual([]);
  expect(schedule.amendmentRecords?.supplemental).toEqual([]);
  expect(schedule.titleLinkRecords?.[0]['Link Doct.No.']).toBe('SAVED-44');
});
