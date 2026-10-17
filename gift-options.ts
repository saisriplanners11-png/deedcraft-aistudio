import { partyRecords, type AppState } from './logic';

export const GIFT_RELATIONSHIPS = [
  ['son', 'Son', 'sons'], ['daughter', 'Daughter', 'daughters'],
  ['father', 'Father', 'fathers'], ['mother', 'Mother', 'mothers'],
  ['husband', 'Husband', 'husbands'], ['wife', 'Wife', 'wives'],
  ['brother', 'Brother', 'brothers'], ['sister', 'Sister', 'sisters'],
  ['grandson', 'Grandson', 'grandsons'], ['granddaughter', 'Granddaughter', 'granddaughters'],
  ['grandfather', 'Grandfather', 'grandfathers'], ['grandmother', 'Grandmother', 'grandmothers'],
  ['son-in-law', 'Son-in-law', 'sons-in-law'], ['daughter-in-law', 'Daughter-in-law', 'daughters-in-law'],
  ['friend', 'Friend', 'friends'],
] as const;

export function giftRelationshipValues(state: AppState): Record<string, string> {
  if (state.deedType !== 'Gift') return {};
  const donors = partyRecords(state, 'executant').length;
  const donees = partyRecords(state, 'claimant').length;
  const selected = state.form.giftRelationship || '';
  const option = GIFT_RELATIONSHIPS.find(([id]) => id === selected);
  // Custom text is the complete relationship phrase, allowing mixed donees.
  const relationship = selected === 'other' ? (state.form.giftRelationshipCustom || '').trim()
    : option ? (donees > 1 ? option[2] : option[1].toLowerCase()) : '';
  const donor = donors > 1 ? 'Donors' : 'Donor';
  const donee = donees > 1 ? 'Donees' : 'Donee';
  const verb = donees > 1 ? 'are' : 'is';
  return {
    Relationship: relationship,
    'Donor/s': donor,
    'Donee/s': donee,
    'is/are': verb,
    'Gift Relationship Recital': `WHEREAS the ${donee} ${verb} the ${relationship || '________'} of the ${donor}.`,
  };
}
