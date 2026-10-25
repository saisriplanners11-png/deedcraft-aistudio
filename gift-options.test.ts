import { describe, expect, it } from 'vitest';
import { initialState, generationBlockers, type AppState } from './logic';
import { giftRelationshipValues } from './gift-options';
import { mergeValues } from './merge';
import { appStateFor, draftReducer, newDraft } from './source-draft';

const gift = (donors: number, donees: number): AppState => ({
  ...initialState, deedType: 'Gift', form: { ...initialState.form, giftRelationship: 'daughter' },
  additionalExecutants: Array.from({ length: donors - 1 }, (_, i) => ({ id: `donor-${i}`, values: { executantName: `Donor ${i}` }, docNames: [] })),
  additionalClaimants: Array.from({ length: donees - 1 }, (_, i) => ({ id: `donee-${i}`, values: { claimantName: `Donee ${i}` }, docNames: [] })),
});

describe('Gift relationship recital', () => {
  it.each([
    [1, 1, 'WHEREAS the Donee is the daughter of the Donor.'],
    [2, 1, 'WHEREAS the Donee is the daughter of the Donors.'],
    [1, 2, 'WHEREAS the Donees are the daughters of the Donor.'],
    [2, 2, 'WHEREAS the Donees are the daughters of the Donors.'],
  ])('agrees for %i donors and %i donees', (donors, donees, expected) => {
    expect(mergeValues(gift(donors as number, donees as number))['Gift Relationship Recital']).toBe(expected);
  });
  it('uses irregular plurals and preserves mixed relationship wording', () => {
    const state = gift(2, 2);
    state.form.giftRelationship = 'daughter-in-law';
    expect(giftRelationshipValues(state).Relationship).toBe('daughters-in-law');
    state.form.giftRelationship = 'other';
    state.form.giftRelationshipCustom = 'son and daughter';
    expect(giftRelationshipValues(state)['Gift Relationship Recital']).toBe('WHEREAS the Donees are the son and daughter of the Donors.');
  });
  it('keeps missing relationships blank and excludes Gift wording from Sale', () => {
    const state = gift(1, 1);
    state.form.giftRelationship = '';
    expect(giftRelationshipValues(state).Relationship).toBe('');
    expect(giftRelationshipValues({ ...state, deedType: 'Sale' })).toEqual({});
  });
  it('retains the selected relationship and custom wording through draft save/load', () => {
    let draft = draftReducer(newDraft(), { type: 'instrument', instrumentId: 'gift' });
    draft = draftReducer(draft, { type: 'manual', key: 'property|primary|giftRelationship', value: 'other' });
    draft = draftReducer(draft, { type: 'manual', key: 'property|primary|giftRelationshipCustom', value: 'son and daughter' });
    const restored = draftReducer(newDraft(), { type: 'load', draft: JSON.parse(JSON.stringify(draft)) });
    expect(appStateFor(restored).form.giftRelationship).toBe('other');
    expect(appStateFor(restored).form.giftRelationshipCustom).toBe('son and daughter');
  });
});

it('restores Municipal Gift without individual donee requirements or erasing regular Gift data', () => {
  let draft = draftReducer(newDraft(), { type: 'instrument', instrumentId: 'gift', variantId: 'family-gift' });
  draft = draftReducer(draft, { type: 'manual', key: 'claimant|primary|claimantName', value: 'ORIGINAL DONEE' });
  draft = draftReducer(draft, { type: 'manual', key: 'property|primary|giftRelationship', value: 'daughter' });
  draft = draftReducer(draft, { type: 'manual', key: 'property|primary|localAuthorityType', value: 'Municipal Council' });
  draft = draftReducer(draft, { type: 'manual', key: 'property|primary|village', value: 'PROPERTY VILLAGE' });
  draft = draftReducer(draft, { type: 'instrument', instrumentId: 'gift', variantId: 'municipal-gift' });
  const restored = JSON.parse(JSON.stringify(draft));
  const state = appStateFor(restored);
  expect(state.draft).toBe('Gift to Local Bodies');
  expect(mergeValues(state).ULB).toBe('MUNICIPAL COUNCIL');
  expect(mergeValues(state).VILLAGE).toBe('PROPERTY VILLAGE');
  expect(generationBlockers(state).filter(item => item.step === 7)).toEqual([]);
  const regular = appStateFor(draftReducer(restored, { type: 'instrument', instrumentId: 'gift', variantId: 'family-gift' }));
  expect(regular.form.claimantName).toBe('ORIGINAL DONEE');
  expect(regular.form.giftRelationship).toBe('daughter');
});
