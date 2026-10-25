import { GIFT_RELATIONSHIPS } from './gift-options';
import { partyRecords, type AppState } from './logic';
import { partyDisplayName } from './party-entities';

export const GENERAL_POA_VARIANTS = ['general-power-of-attorney', 'general-power-of-attorney-family'];
export const POA_RELATIONSHIPS = GIFT_RELATIONSHIPS.filter(([id]) => id !== 'friend');
export const isGeneralPoa = (instrument: string, variant: string) => instrument === 'power_of_attorney' && GENERAL_POA_VARIANTS.includes(variant);
export const isFamilyPoa = (state: AppState) => state.draft === 'General Power of Attorney Family';

// partyRecords deliberately picks only identity fields for the primary party.
// Restore the independent, manually chosen GPA relationship for that record.
const attorneysFor = (state: AppState) => partyRecords(state, 'claimant').map((record, index) => index ? record : {
  ...record, values: { ...record.values, poaRelationship: state.form.poaRelationship || '', poaRelationshipCustom: state.form.poaRelationshipCustom || '' },
});

export function poaRelationship(values: Record<string, string>): string {
  return values.poaRelationship === 'other' ? (values.poaRelationshipCustom || '').trim()
    : POA_RELATIONSHIPS.find(([id]) => id === values.poaRelationship)?.[1].toLowerCase() || '';
}

export function poaRelationshipErrors(state: AppState): string[] {
  if (state.deedType !== 'GPA/Power of Attorney' || !isFamilyPoa(state)) return [];
  return attorneysFor(state).flatMap((record, index) => poaRelationship(record.values) ? []
    : [`Choose the family relationship to principal(s) for ${partyDisplayName(record.values, 'claimant') || `Attorney ${index + 1}`}.`]);
}

export function poaValues(state: AppState): Record<string, string> {
  if (state.deedType !== 'GPA/Power of Attorney') return {};
  const phrases = attorneysFor(state).map(record => `${isFamilyPoa(state) ? poaRelationship(record.values) || '________' : 'friend'} ${partyDisplayName(record.values, 'claimant') || '________'}`);
  const attorneys = phrases.length <= 2 ? phrases.join(' and ') : `${phrases.slice(0, -1).join(', ')} and ${phrases.at(-1)}`;
  const manyPrincipals = partyRecords(state, 'executant').length > 1;
  const manyAttorneys = attorneysFor(state).length > 1;
  const subject = manyPrincipals ? 'We' : 'I', possessive = manyPrincipals ? 'our' : 'my', object = manyPrincipals ? 'us' : 'me';
  return {
    'Poa Relationship Complete': String(!poaRelationshipErrors(state).length),
    'Poa Attorney Appointment': attorneys,
    'Poa Appointment Recital': `WHEREAS, ${subject} have full confidence and trust in the above-named Attorney ${manyAttorneys ? 'Holders' : 'Holder'} and therefore, ${subject} hereby nominate, constitute and appoint ${possessive} ${attorneys} as ${possessive} true and lawful GENERAL POWER OF ATTORNEY ${manyAttorneys ? 'HOLDERS' : 'HOLDER'}, to act for ${object}, in ${possessive} name and on ${possessive} behalf, in respect of the Schedule Property and to exercise the following powers:`,
  };
}
