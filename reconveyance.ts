import { representativeRecital } from './party-entities';
import { flatStage } from './flat-options';
import { formatDeedAmount, moneyPaise as mortgagePaise } from './deed-money';
export { moneyPaise as mortgagePaise } from './deed-money';

export function paiseAmount(value: bigint): string {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

export interface MortgageRecord {
  id: string;
  values: Record<string, string>;
}

export function reconveyanceAmounts(records: MortgageRecord[], principalOverride: string, interest: string) {
  const errors: string[] = [];
  const seen = new Set<string>();
  let sum = 0n;
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    const amount = mortgagePaise(record.values.mortgageAmount || '');
    if (amount === null || amount <= 0n) errors.push(`Mortgage document ${seen.size}: enter a positive mortgage loan amount.`);
    else sum += amount;
  }
  if (!seen.size) errors.push('Add at least one mortgage document.');
  const principal = principalOverride.trim() ? mortgagePaise(principalOverride) : errors.length ? null : sum;
  const interestValue = mortgagePaise(interest);
  if (principal === null || principal <= 0n) errors.push('Enter a positive principal amount.');
  if (interestValue === null) errors.push('Enter interest, including zero when no interest applies.');
  return {
    linkTotal: errors.some(error => error.startsWith('Mortgage document')) || !seen.size ? '' : paiseAmount(sum),
    principal: principal === null ? '' : paiseAmount(principal),
    interest: interestValue === null ? '' : paiseAmount(interestValue),
    total: principal === null || interestValue === null ? '' : paiseAmount(principal + interestValue),
    overridden: !!principalOverride.trim(),
    errors,
  };
}

import type { AppState } from './logic';
import { deedDate } from './deed-format';
export function reconveyanceRecords(state: AppState): MortgageRecord[] {
  const order = [...new Set(['primary', ...state.additionalSchedules.map(record => record.id), ...Object.keys(state.linkRecordsBySchedule)])];
  return order.flatMap(id => state.linkRecordsBySchedule[id] || []).filter(record => record.values.linkOption === 'linkDoc' || (!record.values.linkOption && ['mortgageAmount','linkDocNo','linkDocDate','linkSro'].some(field => !!record.values[field]?.trim())));
}
export function mortgageInterestTotal(records: MortgageRecord[], legacyInterest = '') {
  // Older saved drafts retain their deed-level interest until a link interest is entered.
  if (legacyInterest.trim() && !records.some(record => Object.prototype.hasOwnProperty.call(record.values, 'mortgageInterestAmount'))) return { interest: legacyInterest, errors: [] as string[] };
  const errors: string[] = [], seen = new Set<string>(); let total = 0n;
  for (const record of records) {
    if (seen.has(record.id)) continue; seen.add(record.id);
    const amount = mortgagePaise(record.values.mortgageInterestAmount || '');
    if (amount === null) errors.push('Mortgage document ' + seen.size + ': enter a valid interest amount, including zero.'); else total += amount;
  }
  return { interest: errors.length || !seen.size ? '' : paiseAmount(total), errors };
}
export function repaymentFor(state: AppState) {
  const records = reconveyanceRecords(state), interest = mortgageInterestTotal(records, state.form.interestAmount || '');
  const amounts = reconveyanceAmounts(records, state.form.principalOverride || '', interest.interest);
  return { ...amounts, errors: [...amounts.errors, ...interest.errors] };
}
export const isBankReconveyance = (state: AppState) => state.deedType === 'Deed Of Reconvayance' && (
  state.draft === 'TITLE DEED' || state.form.executantPartyType === 'Bank' || state.form.mortgagePartyMode === 'bank-to-person' ||
  (state.form.mortgagePartyMode !== 'person-to-person' && !!state.form.bankName?.trim())
);
export function reconveyanceErrors(state: AppState): string[] {
  const errors = [...repaymentFor(state).errors];
  const records = reconveyanceRecords(state);
  records.forEach((record, index) => {
    for (const field of ['linkDocNo','linkSro','linkSroCode']) if (!record.values[field]?.trim()) errors.push(`Mortgage ${index + 1}: complete ${field}.`);
    if (!deedDate(record.values.linkDocDate || '')) errors.push(`Mortgage ${index + 1}: enter a complete valid execution date.`);
  });
  if (isBankReconveyance(state)) {
    for (const field of ['bankName','bankBranch','officialDesignation']) if (!state.form[field]?.trim()) errors.push(`Complete ${field} for the bank opening.`);
  }
  for (const schedule of [{ category: state.category, values: state.form }, ...state.additionalSchedules]) {
    if (['Residential','Flat'].includes(schedule.category) && !flatStage(schedule.values[schedule.category === 'Flat' ? 'flatStage' : 'houseStage'])) errors.push('Choose Finished or Semi-finished for each house or flat.');
  }
  for (const schedule of [{ category: state.category }, ...state.additionalSchedules]) if (!['Vacant Plot','Open Place','Residential','Flat','Demolished','Part open place'].includes(schedule.category)) errors.push(`The supplied Reconveyance template does not support ${schedule.category || 'an unselected property category'}.`);
  return errors;
}
export function reconveyanceValues(state: AppState): Record<string, string> {
  const amount = repaymentFor(state);
  const representatives = state.partyPeopleByParty?.['executant|' + (state.primaryExecutantId || 'primary')]?.representatives || [];
  return {
    'Principal Amount': formatDeedAmount(amount.principal), 'Intrest Amount': formatDeedAmount(amount.interest), 'Interest Amount': formatDeedAmount(amount.interest),
    'Total Amount': formatDeedAmount(amount.total), 'Market of Value Rs./-': formatDeedAmount(amount.total),
    'Reconveyance Draft': state.draft === 'TITLE DEED' ? 'title-deed' : 'mortgage-deed',
    'Mortgage Party Mode': isBankReconveyance(state) ? 'bank-to-person' : 'person-to-person',
    'BANK NAME': state.form.bankName || '', Branch: state.form.bankBranch || '', Designation: state.form.officialDesignation || '',
    'Mortgage Records': JSON.stringify(reconveyanceRecords(state)),
    'Bank Representative Details': representatives.filter(person => person.name.trim()).map(representativeRecital).join('; '),
    'Bank Releasor': isBankReconveyance(state) && (state.form.executantPartyType === 'Bank' || !state.form.executantName?.trim()) ? 'true' : '',
  };
}

/** Validate the serialized compiler boundary as well as the live form. */
export function reconveyanceBindingErrors(values: Record<string,string>): string[] {
  let records: MortgageRecord[];
  try {
    records = JSON.parse(values['Mortgage Records'] || '[]');
    if (!Array.isArray(records) || records.some(record => !record || typeof record.id !== 'string' || !record.values || typeof record.values !== 'object')) return ['Invalid mortgage records.'];
  } catch { return ['Invalid mortgage records.']; }
  const interest = mortgageInterestTotal(records, values['Intrest Amount'] ?? values['Interest Amount'] ?? '');
  const errors = [...reconveyanceAmounts(records, values['Principal Amount'] || '', interest.interest).errors, ...interest.errors];
  for (const record of records) {
    if (!record.values.linkDocNo || !deedDate(record.values.linkDocDate || '') || !record.values.linkSro || !record.values.linkSroCode) errors.push('Complete every mortgage number, execution date, SRO and SRO code.');
  }
  if (!['title-deed','mortgage-deed'].includes(values['Reconveyance Draft'])) errors.push('Select the Reconveyance draft form.');
  if (!['bank-to-person','person-to-person'].includes(values['Mortgage Party Mode'])) errors.push('Select the mortgage party mode.');
  if (values['Reconveyance Draft'] === 'title-deed' && values['Mortgage Party Mode'] !== 'bank-to-person') errors.push('TITLE DEED requires the bank opening.');
  if (values['Mortgage Party Mode'] === 'bank-to-person' && ['BANK NAME','Branch','Designation'].some(key => !values[key]?.trim())) errors.push('Complete bank name, branch and official designation.');
  return errors;
}
