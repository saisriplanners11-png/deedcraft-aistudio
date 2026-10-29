import { describe, expect, it } from 'vitest';
import { initialState, generationBlockers } from './logic';
import { deedFilename, mergeValues, scheduleMergesFor } from './merge';
import { appStateFor, draftReducer, newDraft } from './source-draft';
import { deedDate } from './deed-format';

it('restores separate title amendments without turning them into the original title or a flat allotment agreement', () => {
  let draft = newDraft();
  const records = [
    ['rect', { linkOption: 'linkDoc', linkDocType: 'Rectification Deed', linkDocNo: 'RECT-1', linkDocDate: '2021-02-03', linkSro: 'RECT SRO' }],
    ['base', { linkOption: 'linkDoc', linkDocType: 'Sale Deed', linkDocNo: 'TITLE-1', linkDocDate: '2020-01-02', linkSro: 'TITLE SRO' }],
    ['supp', { linkOption: 'supplementalDeed', supplementalDeedNo: 'SUPP-1', supplementalDeedDate: '2022-03-04', supplementalDeedSro: 'SUPP SRO' }],
  ] as const;
  for (const [record, values] of records) {
    draft = draftReducer(draft, { type: 'link-property', record, propertyId: 'primary' });
    for (const [key, value] of Object.entries(values)) draft = draftReducer(draft, { type: 'manual', key: `link|${record}|${key}`, value });
  }
  draft = draftReducer(draft, { type: 'manual', key: 'property|primary|supplementalDocNo', value: 'FLAT-ALLOTMENT' });
  const restored = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) });
  const state = appStateFor(restored), schedule = scheduleMergesFor(state)[0];
  expect(state.form.linkDocNo).toBe('TITLE-1');
  expect(schedule.titleLinkRecords?.map(record => record['Link Doct.No.'])).toEqual(['TITLE-1']);
  expect(schedule.amendmentRecords?.rectification[0]['Rectification Deed No.']).toBe('RECT-1');
  expect(schedule.amendmentRecords?.rectification[0]['Rectification Deed Date']).toBe('03-02-2021');
  expect(schedule.amendmentRecords?.supplemental[0]['Supplemental Deed SRO']).toBe('SUPP SRO');
  expect(schedule.values['Supplemental Agreement No.']).toBe('FLAT-ALLOTMENT');
  expect(restored.manual).toEqual(draft.manual);
});

describe('Printed deed date policy', () => {
  it('formats ISO and restored local dates as DD-MM-YYYY without changing day/month order', () => {
    for (const value of ['2026-10-22', '22-10-2026', '22/10/2026', '22102026']) expect(deedDate(value)).toBe('22-10-2026');
    expect(deedDate('2024-02-29')).toBe('29-02-2024');
    for (const value of ['', '2026-10', '2026-02-29', '2026-13-01', '31/04/2026']) expect(deedDate(value)).toBe('');
  });
  it('uses the entered value for Gift totals, not the calculated basic-rate market value', () => {
    const values = mergeValues({ ...initialState, deedType: 'Gift', form: { ...initialState.form, consid: '765432', govtRate: '5000', extentSqYards: '200', structValue: '100000' } });
    expect(values['Market of Value Rs./-']).toBe('7,65,432');
    expect(values['Statement of Market Value Consideration']).toBe('7,65,432');
  });
});

describe('deed download filename', () => {
  it('uses the deed type and primary claimant name', () => {
    expect(deedFilename({ ...initialState, deedType: 'Sale', form: { ...initialState.form, claimantName: 'Ravi Kumar', executantName: 'Seller Name', plotNo: '42' } }))
      .toBe('Sale-Ravi-Kumar.docx');
  });

  it('uses another claimant when the primary name is blank and handles unnamed drafts', () => {
    const state = { ...initialState, deedType: 'Gift', additionalClaimants: [{ id: 'second', values: { claimantName: 'Sita Devi' }, docNames: [] }] };
    expect(deedFilename(state)).toBe('Gift-Sita-Devi.docx');
    expect(deedFilename({ ...initialState, deedType: 'Sale' })).toBe('Sale-Unnamed-deed.docx');
    expect(deedFilename({ ...initialState, deedType: 'Gift', saleDocument: 'ordinary' })).toBe('Gift-Unnamed-deed.docx');
  });

  it('removes characters that cannot be used in a filename', () => {
    expect(deedFilename({ ...initialState, deedType: 'Sale', form: { ...initialState.form, claimantName: 'A/B: C' } }))
      .toBe('Sale-A-B-C.docx');
  });
});

describe('Optional party percentages', () => {
  it('allows independent optional percentages without requiring other parties or a 100% total', () => {
    const state = { ...initialState, additionalExecutants: [{ id: 'second', values: { executantName: 'SECOND' }, docNames: [] }], vendorSharesBySchedule: {} as Record<string, Record<string, string>> };
    expect(mergeValues(state)['Executant Share']).toBe('');
    expect(generationBlockers(state).filter(item => item.id.startsWith('vendor-share'))).toEqual([]);
    state.vendorSharesBySchedule = { primary: { primary: '40' } };
    expect(generationBlockers(state).filter(item => item.id.startsWith('vendor-share'))).toEqual([]);
    state.vendorSharesBySchedule.primary.second = '60';
    expect(generationBlockers(state).filter(item => item.id.startsWith('vendor-share'))).toEqual([]);
    expect(mergeValues(state)['Executant Share']).toBe('40%');
    state.vendorSharesBySchedule.primary.second = '30';
    expect(generationBlockers(state).filter(item => item.id.startsWith('vendor-share'))).toEqual([]);
    state.vendorSharesBySchedule.primary.second = '101';
    expect(generationBlockers(state).filter(item => item.id.startsWith('vendor-share')).map(item => item.id)).toEqual(['vendor-share-primary-second']);
  });
});
