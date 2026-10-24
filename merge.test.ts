import { describe, expect, it } from 'vitest';
import { initialState, generationBlockers } from './logic';
import { deedFilename, mergeValues } from './merge';
import { deedDate } from './deed-format';

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
