import { describe, expect, it } from 'vitest';
import { minorClaimantValues, minorGuardianRecital, minorPartyErrors } from './minor-parties';
import { partyDisplayName } from './party-entities';
import { ageFrom } from './party-age';

const child = { claimantPartyType: 'Minor', claimantName: 'MINOR ONE', claimantGender: 'Female', claimantDob: '2016-08-04', claimantGuardianRelationship: 'Grandfather', claimantGuardianName: 'GUARDIAN ONE', claimantGuardianRelation: 'S/O', claimantGuardianRelativeName: 'ELDER ONE', claimantGuardianDob: '1967-01-01', claimantGuardianOccupation: 'Agriculture', claimantGuardianHNo: '6-8', claimantGuardianLocality: 'Guardian Locality', claimantGuardianVillage: 'Guardian Village', claimantGuardianMandal: 'Guardian Mandal', claimantGuardianDistrict: 'Guardian District', claimantGuardianState: 'Telangana', claimantGuardianPinCode: '505303', claimantGuardianMobile: '9000000001', claimantGuardianAadhaar: '111122223333' };

describe('minor vendee guardianship wording', () => {
  it('prints the selected relationship and complete guardian identity in photo order', () => {
    const recital = minorGuardianRecital(child, 'claimant');
    expect(recital).toContain('is under guardianship of her natural Grand Father GUARDIAN ONE S/O ELDER ONE');
    expect(recital).toContain(`Aged ${ageFrom(child.claimantGuardianDob)} years (DOB:01-01-1967), occu:Agriculture`);
    expect(recital).toContain('R/o H.No.6-8, Guardian Locality, Guardian Village Village, Guardian Mandal Mandal, Dist:Guardian District, State:Telangana, Pin Code:505303');
    expect(recital).toContain('Cell No:9000000001, Aadhaar No:111122223333');
    expect(minorPartyErrors(child, 'claimant')).toEqual([]);
  });

  it.each([['Male', 'his'], ['Female', 'her'], ['Other', 'their'], ['', 'their']])('uses explicit gender %s independently of relation or name', (gender, pronoun) => {
    expect(minorGuardianRecital({ ...child, claimantGender: gender, claimantRelation: 'D/O' }, 'claimant')).toContain(`guardianship of ${pronoun} natural Grand Father`);
  });

  it('keeps court-appointed and custom relationships without calling them natural', () => {
    expect(minorGuardianRecital({ ...child, claimantGuardianRelationship: 'Court-appointed Guardian' }, 'claimant')).toContain('her Court-appointed Guardian GUARDIAN ONE');
    expect(minorGuardianRecital({ ...child, claimantGuardianRelationship: 'maternal uncle' }, 'claimant')).toContain('her maternal uncle GUARDIAN ONE');
  });

  it('renders an older Guardian entry with its ward first without changing saved adult or ward fields', () => {
    const saved = { claimantPartyType: 'Guardian', claimantName: 'ADULT GUARDIAN', claimantGender: 'Male', claimantDob: '1967-01-01', claimantAadhaar: '444455556666', claimantOccupation: 'Agriculture', claimantHNo: 'GUARDIAN-HOUSE', claimantGuardianRelationship: 'Grandfather', claimantWardName: 'WARD CHILD', claimantWardDob: '2016-08-04', claimantWardGender: 'Female', claimantWardRelation: 'D/O', claimantWardRelativeName: 'CHILD PARENT', claimantWardAadhaar: '777788889999', claimantWardHNo: 'CHILD-HOUSE' };
    const before = JSON.stringify(saved);
    const rendered = minorClaimantValues(saved);
    expect(rendered.claimantName).toBe('WARD CHILD');
    expect(rendered.claimantAadhaar).toBe('777788889999');
    expect(rendered.claimantHNo).toBe('CHILD-HOUSE');
    expect(rendered.claimantGuardianName).toBe('ADULT GUARDIAN');
    expect(rendered.claimantGuardianAadhaar).toBe('444455556666');
    expect(rendered.claimantGuardianOccupation).toBe('Agriculture');
    expect(minorGuardianRecital(saved, 'claimant')).toContain('her natural Grand Father ADULT GUARDIAN');
    expect(partyDisplayName(saved, 'claimant')).toBe('WARD CHILD');
    expect(JSON.stringify(saved)).toBe(before);
  });
});
