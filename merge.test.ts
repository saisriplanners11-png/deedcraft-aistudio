import { describe, expect, it } from 'vitest';
import { initialState, generationBlockers } from './logic';
import { deedFilename, mergeValues } from './merge';

describe('deed download filename', () => {
  it('uses the deed type and primary claimant name', () => {
    expect(deedFilename({ ...initialState, deedType: 'Sale', form: { ...initialState.form, claimantName: 'Ravi Kumar', executantName: 'Seller Name', plotNo: '42' } }))
      .toBe('Sale-Ravi-Kumar.docx');
  });

  it('uses another claimant when the primary name is blank and handles unnamed drafts', () => {
    const state = { ...initialState, deedType: 'Gift', additionalClaimants: [{ id: 'second', values: { claimantName: 'Sita Devi' }, docNames: [] }] };
    expect(deedFilename(state)).toBe('Gift-Sita-Devi.docx');
    expect(deedFilename({ ...initialState, deedType: 'Sale' })).toBe('Sale-Unnamed-deed.docx');
  });

  it('removes characters that cannot be used in a filename', () => {
    expect(deedFilename({ ...initialState, deedType: 'Sale', form: { ...initialState.form, claimantName: 'A/B: C' } }))
      .toBe('Sale-A-B-C.docx');
  });
});

describe('Optional party percentages', () => {
  it('omits unspecified percentages but validates a partially entered allocation', () => {
    const state = { ...initialState, additionalExecutants: [{ id: 'second', values: { executantName: 'SECOND' }, docNames: [] }], vendorSharesBySchedule: {} as Record<string, Record<string, string>> };
    expect(mergeValues(state)['Executant Share']).toBe('');
    expect(generationBlockers(state).filter(item => item.id.startsWith('vendor-share'))).toEqual([]);
    state.vendorSharesBySchedule = { primary: { primary: '40' } };
    expect(generationBlockers(state).some(item => item.id === 'vendor-share-primary-second')).toBe(true);
    state.vendorSharesBySchedule.primary.second = '60';
    expect(generationBlockers(state).filter(item => item.id.startsWith('vendor-share'))).toEqual([]);
    expect(mergeValues(state)['Executant Share']).toBe('40%');
  });
});
