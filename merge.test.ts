import { describe, expect, it } from 'vitest';
import { initialState } from './logic';
import { deedFilename } from './merge';

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
