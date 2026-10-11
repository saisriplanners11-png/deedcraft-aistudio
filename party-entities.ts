import { partyEntityFields, type PartyPeople, type PartyType } from './fields';

export type PartySide = 'executant' | 'claimant';
export const isEntity = (values: Record<string, string>, side: PartySide) => ['Firm / LLP', 'Company', 'Society / Association', 'Society / Trust', 'Others / HUF'].includes(values[side + 'PartyType']);
export function partyDisplayName(values: Record<string, string>, side: PartySide): string {
  const name = values[side + (isEntity(values, side) ? 'EntityName' : 'Name')] || '';
  return isEntity(values, side) ? name.toLocaleUpperCase('en-IN') : name;
}
export function entityRequiredFields(side: PartySide, type: PartyType): string[] {
  const suffixes = ['EntityName', 'EntityMobile', 'EntityNature', 'EntityAddress', 'EntityState', 'EntityDistrict', 'EntityMandal', 'EntityVillage', 'EntityHNo', 'EntityPinCode'];
  if (type === 'Society / Association' || type === 'Society / Trust') suffixes.push('SocietyRegistrationNo', 'SocietyRegistrationDate', 'SocietyClassification', 'SocietyRegisteredAct', 'SocietyRegistrarOffice', 'SocietyTenureFrom', 'SocietyTenureTo');
  else if (type === 'Firm / LLP' || type === 'Company') suffixes.push('EntityIdProof', 'EntityIdProofNo');
  return suffixes.map(s => side + s);
}
export function activePartyFields(values: Record<string, string>, side: PartySide): string[] {
  return isEntity(values, side) ? partyEntityFields(side, values[side + 'PartyType'] as PartyType).filter(f => !f.hidden).map(f => f.id) : [];
}
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('-') : value;
export function entityRecital(values: Record<string, string>, side: PartySide, people: PartyPeople): string {
  const v = (suffix: string) => (values[side + suffix] || '').trim();
  const type = v('PartyType');
  const company = type === 'Company'; const firm = type === 'Firm / LLP'; const society = type === 'Society / Association' || type === 'Society / Trust';
  const parts = [partyDisplayName(values, side) || '____'];
  const add = (label: string, value: string) => { if (value) parts.push(label + value); };
  add('(CIN No. ', (company ? v('CompanyCin') : firm ? v('FirmCin') : '') ? (company ? v('CompanyCin') : v('FirmCin')) + ')' : '');
  add('DIN No. ', company ? v('CompanyDin') : firm ? v('FirmDin') : '');
  add('Registration No. ', firm ? v('FirmRegistrationNo') : society ? v('SocietyRegistrationNo') : type === 'Others / HUF' ? v('OtherRegistrationNo') : '');
  add('registered under ', society ? v('SocietyRegisteredAct') : '');
  add('registered on ', date(society ? v('SocietyRegistrationDate') : v('EntityIncorporationDate')));
  add('with ', society ? v('SocietyRegistrarOffice') : firm ? v('FirmRegistrarOffice') : '');
  add('PAN No. ', v('EntityPan'));
  add('having its registered / principal office at ', v('EntityAddress') || ['EntityHNo', 'EntityLocality', 'EntityVillage', 'EntityMandal', 'EntityDistrict', 'EntityState', 'EntityPinCode'].map(v).filter(Boolean).join(', '));
  if (v('EntityCommunicationSame') !== 'Yes' && v('EntityCommunicationAddress') !== v('EntityAddress')) add('communication address: ', v('EntityCommunicationAddress'));
  add('having a branch office at ', v('EntityBranchOffice'));
  add('nature of business / society: ', v('EntityNature'));
  add('partnership deed No. ', firm ? v('FirmDeedNo') : '');
  add('partnership deed dated ', firm ? date(v('FirmDeedDate')) : '');
  add('GSTIN ', firm ? v('FirmGstin') : '');
  add('acting under authorization ', company ? v('CompanyBoardResolution') : firm ? v('FirmAuthority') : society ? v('SocietyResolutionNo') : v('OtherAuthority'));
  const reps = people.representatives.map(p => {
    const text = [p.designation, p.name.toLocaleUpperCase('en-IN') || '____'];
    if (p.relationName) text.push([p.relation, p.relationName.toLocaleUpperCase('en-IN')].filter(Boolean).join(' '));
    if (p.age) text.push('aged ' + p.age + ' years');
    if (p.dob) text.push('(DOB: ' + date(p.dob) + ')');
    const address = [p.hNo, p.locality, p.village, p.mandal, p.district, p.state, p.pinCode].filter(Boolean).join(', ');
    if (address) text.push('R/o ' + address);
    if (p.aadhaar) text.push('Aadhaar No. ' + p.aadhaar);
    if (p.pan) text.push('PAN No. ' + p.pan);
    if (p.mobile) text.push('Mobile No. ' + p.mobile);
    return text.filter(Boolean).join(', ');
  });
  parts.push('represented by ' + (reps.join('; and ') || '____'));
  return parts.join(', ');
}
