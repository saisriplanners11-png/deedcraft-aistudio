import { ageFrom } from './party-age';
import { deedDate } from './deed-format';
import type { AppState } from './logic';


const CLAIMANT_IDENTITY = ['Name', 'Gender', 'Relation', 'RelativeName', 'Dob', 'Occupation', 'Aadhaar', 'Pan', 'Mobile', 'HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'] as const;

/** Rendering view only: a saved Guardian card still stores the adult's details
 * in its original fields, while the ward remains the recipient in the deed. */
export function minorClaimantValues(values: Record<string, string>): Record<string, string> {
  if (!(values.claimantPartyType || '').startsWith('Guardian') || !values.claimantWardName) return values;
  const out: Record<string, string> = { ...values, claimantPartyType: 'Minor' };
  for (const suffix of CLAIMANT_IDENTITY) {
    out['claimant' + suffix] = values['claimantWard' + suffix] || '';
    out['claimantGuardian' + suffix] = values['claimant' + suffix] || '';
  }
  out.claimantAge = ageFrom(out.claimantDob || '');
  return out;
}

function minorVendeeGuardianRecital(values: Record<string, string>): string {
  const v = (key: string) => (values['claimantGuardian' + key] || '').trim();
  const gender = (values.claimantGender || '').toLowerCase();
  const possessive = gender === 'female' ? 'her' : gender === 'male' ? 'his' : 'their';
  const relationship = v('Relationship') || 'guardian';
  const family: Record<string, string> = { father: 'Father', mother: 'Mother', grandfather: 'Grand Father', grandmother: 'Grand Mother' };
  const normalized = relationship.toLowerCase().replace(/[\s-]+/g, '');
  const guardian = family[normalized] ? 'natural ' + family[normalized] : relationship;
  const relation = [v('Relation'), v('RelativeName').toLocaleUpperCase('en-IN')].filter(Boolean).join(' ');
  const parts = [`is under guardianship of ${possessive} ${guardian} ${v('Name').toLocaleUpperCase('en-IN')}${relation ? ' ' + relation : ''}`];
  const age = ageFrom(v('Dob'));
  if (age) parts.push(`Aged ${age} years${v('Dob') ? ' (DOB:' + deedDate(v('Dob')) + ')' : ''}`);
  if (v('Occupation')) parts.push('occu:' + v('Occupation'));
  const address = [v('HNo') ? 'H.No.' + v('HNo') : '', v('Locality'), v('Village') ? v('Village') + ' Village' : '', v('Mandal') ? v('Mandal') + ' Mandal' : '', v('District') ? 'Dist:' + v('District') : '', v('State') ? 'State:' + v('State') : '', v('PinCode') ? 'Pin Code:' + v('PinCode') : ''].filter(Boolean).join(', ');
  if (address) parts.push('R/o ' + address);
  if (v('Mobile')) parts.push('Cell No:' + v('Mobile'));
  if (v('Aadhaar')) parts.push('Aadhaar No:' + v('Aadhaar'));
  if (v('Pan')) parts.push('PAN:' + v('Pan'));
  return parts.join(', ');
}

export function isMinorParty(values: Record<string, string>, side: string): boolean {
  if (['Firm / LLP', 'Company', 'Society / Association', 'Society / Trust', 'Others / HUF'].includes(values[side + 'PartyType'])) return false;
  const age = ageFrom(values[side + 'Dob'] || '');
  return values[side + 'PartyType'] === 'Minor' || (age !== '' && Number(age) < 18);
}
export function minorPartyErrors(values: Record<string, string>, side: string): string[] {
  if ((values[side + 'PartyType'] || '').startsWith('Guardian')) {
    const errors = minorPartyErrors({ ...values, [side + 'PartyType']: 'Minor', [side + 'Name']: values[side + 'WardName'] || '', [side + 'Dob']: values[side + 'WardDob'] || '', [side + 'GuardianName']: values[side + 'Name'] || '', [side + 'GuardianDob']: values[side + 'Dob'] || '', [side + 'GuardianAadhaar']: values[side + 'Aadhaar'] || '' }, side);
    if (!values[side + 'WardName']?.trim()) errors.unshift('Enter the represented minor’s full name.');
    return errors;
  }
  if (!isMinorParty(values, side)) return [];
  const get = (key: string) => values[side + key]?.trim() || '';
  const errors: string[] = [];
  const minorAge = ageFrom(get('Dob'));
  if (minorAge === '' || Number(minorAge) >= 18) errors.push('Enter a valid date of birth below 18 years for the minor.');
  for (const key of ['GuardianName', 'GuardianRelationship', 'GuardianDob', 'GuardianAadhaar']) if (!get(key)) errors.push('Enter ' + key.replace(/([A-Z])/g, ' $1').trim().toLowerCase() + ' for the minor.');
  const guardianAge = ageFrom(get('GuardianDob'));
  if (get('GuardianDob') && (guardianAge === '' || Number(guardianAge) < 18)) errors.push('The guardian must have a valid adult date of birth.');
  if (get('GuardianAadhaar') && !/^\d{12}$/.test(get('GuardianAadhaar').replace(/[\s-]/g, ''))) errors.push('Enter a complete guardian Aadhaar number.');
  if (side === 'executant') {
    for (const key of ['CourtOrderNo', 'CourtName', 'CourtOrderDate']) if (!get(key)) errors.push('Enter ' + key.replace(/([A-Z])/g, ' $1').trim().toLowerCase() + ' for the minor executant.');
    if (get('CourtOrderDate') && !deedDate(get('CourtOrderDate'))) errors.push('Enter a valid court permission date.');
    if (get('CourtOrderPermitsExecution') !== 'Yes') errors.push('Confirm that the court order permits this guardian to execute this deed for the minor.');
  }
  return errors;
}
export function minorGuardianRecital(values: Record<string, string>, side: string): string {
  if (side === 'claimant') {
    const minor = minorClaimantValues(values);
    if (isMinorParty(minor, side)) return minorVendeeGuardianRecital(minor);
  }
  if ((values[side + 'PartyType'] || '').startsWith('Guardian') && values[side + 'WardName']) {
    let recital = 'acting as ' + (values[side + 'GuardianRelationship'] || 'guardian') + ' and guardian of minor ' + values[side + 'WardName'].toLocaleUpperCase('en-IN') + (values[side + 'WardDob'] ? ', DOB: ' + deedDate(values[side + 'WardDob']) : '');
    if (side === 'executant' && values[side + 'CourtOrderNo']) recital += ', acting under permission of ' + (values[side + 'CourtName'] || '') + ', order ' + values[side + 'CourtOrderNo'] + ' dated ' + deedDate(values[side + 'CourtOrderDate'] || '');
    return recital;
  }
  if (!isMinorParty(values, side)) return '';
  const v = (key: string) => (values[side + key] || '').trim();
  const parts = ['a minor represented by ' + (v('GuardianRelationship') || 'guardian') + ': ' + v('GuardianName').toLocaleUpperCase('en-IN')];
  const relation = [v('GuardianRelation'), v('GuardianRelativeName').toLocaleUpperCase('en-IN')].filter(Boolean).join(' ');
  if (relation) parts.push(relation);
  const age = ageFrom(v('GuardianDob')); if (age) parts.push('aged ' + age + ' years');
  if (v('GuardianDob')) parts.push('DOB: ' + deedDate(v('GuardianDob')));
  const address = ['HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'].map(key => v('Guardian' + key)).filter(Boolean).join(', ');
  if (address) parts.push('R/o ' + address);
  if (v('GuardianAadhaar')) parts.push('Aadhaar No. ' + v('GuardianAadhaar'));
  if (v('GuardianMobile')) parts.push('Mobile No. ' + v('GuardianMobile'));
  if (side === 'executant' && v('CourtOrderNo')) parts.push('acting under permission of ' + v('CourtName') + ', order ' + v('CourtOrderNo') + ' dated ' + deedDate(v('CourtOrderDate')));
  return parts.join(', ');
}

/** Explicit stable claimant IDs; names and array positions never establish links. */
export function guardianIds(values: Record<string, string>): string[] {
  return [...new Set((values.claimantGuardianIds || '').split(',').map(id => id.trim()).filter(Boolean))];
}

export function claimantRepresentationForOutput(state: Pick<AppState, 'form' | 'primaryClaimantId' | 'additionalClaimants'>) {
  const records = [{ id: state.primaryClaimantId || 'primary', values: state.form }, ...state.additionalClaimants];
  const guardianRecordIds = new Set(records.filter(({ values }) =>
    (values.claimantPartyType || '').startsWith('Guardian')).map(({ id }) => id));
  const minorsByGuardian = new Map<string, string[]>();
  for (const { id, values } of records) {
    if (!isMinorParty(values, 'claimant') || guardianRecordIds.has(id)) continue;
    for (const guardianId of guardianIds(values)) {
      if (guardianRecordIds.has(guardianId)) {
        const minors = minorsByGuardian.get(guardianId) || [];
        minors.push(id);
        minorsByGuardian.set(guardianId, minors);
      }
    }
  }
  return { records, recipients: records.filter(({ id, values }) => !minorsByGuardian.has(id) || values.claimantWardName), minorsByGuardian };
}

export function linkedClaimantRepresentation(values: Record<string, string>, records: { id: string; values: Record<string, string> }[], formatGuardian?: (id: string, recital: string) => string): { errors: string[]; recital: string } {
  if (!values.claimantGuardianIds && (values.claimantGuardianName || values.claimantWardName)) return { errors: minorPartyErrors(values, 'claimant'), recital: minorGuardianRecital(values, 'claimant') };
  if ((values.claimantPartyType || '').startsWith('Guardian') && !values.claimantWardName) {
    const age = ageFrom(values.claimantDob || '');
    return { errors: age === '' || Number(age) < 18 ? ['Enter a valid adult date of birth for the guardian.'] : [], recital: '' };
  }
  if (!isMinorParty(values, 'claimant')) return { errors: [], recital: '' };
  const ids = guardianIds(values);
  const errors: string[] = [];
  const age = ageFrom(values.claimantDob || '');
  if (age === '' || Number(age) >= 18) errors.push('Enter a valid date of birth below 18 years for the minor.');
  if (!ids.length) errors.push('Assign at least one Guardian claimant to this minor.');
  const recitals: string[] = [];
  for (const id of ids) {
    const guardian = records.find(record => record.id === id)?.values;
    if (!guardian || !(guardian.claimantPartyType || '').startsWith('Guardian')) {
      errors.push('An assigned guardian was removed or changed party type. Select a Guardian claimant.');
      continue;
    }
    const view = { ...values };
    for (const suffix of [...CLAIMANT_IDENTITY, 'Relationship'] as const) view['claimantGuardian' + suffix] = guardian['claimant' + (suffix === 'Relationship' ? 'GuardianRelationship' : suffix)] || '';
    errors.push(...minorPartyErrors(view, 'claimant'));
    const recital = minorVendeeGuardianRecital(view).replace(/^is under guardianship of/, 'Under the Guardianship of');
    const formatted = formatGuardian ? formatGuardian(id, recital) : recital;
    if (formatted) recitals.push(formatted);
  }
  return { errors: [...new Set(errors)], recital: recitals.join('; ') };
}
