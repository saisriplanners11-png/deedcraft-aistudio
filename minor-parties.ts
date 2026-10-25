import { ageFrom } from './party-age';
import { deedDate } from './deed-format';

export function isMinorParty(values: Record<string, string>, side: string): boolean {
  if (['Firm / LLP', 'Company', 'Society / Association', 'Society / Trust', 'Others / HUF'].includes(values[side + 'PartyType'])) return false;
  const age = ageFrom(values[side + 'Dob'] || '');
  return values[side + 'PartyType'] === 'Minor' || (age !== '' && Number(age) < 18);
}
export function minorPartyErrors(values: Record<string, string>, side: string): string[] {
  if ((values[side + 'PartyType'] || '').startsWith('Guardian') && (values[side + 'WardName'] || values[side + 'WardDob'])) return minorPartyErrors({ ...values, [side + 'PartyType']: 'Minor', [side + 'Name']: values[side + 'WardName'] || '', [side + 'Dob']: values[side + 'WardDob'] || '', [side + 'GuardianName']: values[side + 'Name'] || '', [side + 'GuardianDob']: values[side + 'Dob'] || '', [side + 'GuardianAadhaar']: values[side + 'Aadhaar'] || '' }, side);
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
  if ((values[side + 'PartyType'] || '').startsWith('Guardian') && values[side + 'WardName']) return 'acting as ' + (values[side + 'GuardianRelationship'] || 'guardian') + ' and guardian of minor ' + values[side + 'WardName'].toLocaleUpperCase('en-IN') + (values[side + 'WardDob'] ? ', DOB: ' + deedDate(values[side + 'WardDob']) : '');
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
