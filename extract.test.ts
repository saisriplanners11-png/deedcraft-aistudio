import { describe, expect, it } from 'vitest';
import { ALL_FIELDS } from './fields';
import { EXTRACTION_PROMPTS, STAGES, TARGETS, aadhaarFromDocumentText, agreeFieldReads, classificationSelections, linkDocumentNumberFromFilename, majorityFieldReads, normalize, parseIdentityAddress, schemaForIds, supportingDocumentTypeFromFilename, supportingStagesForFilename } from './extract';
import { profileFields } from './upload-extraction';

describe('link deed extraction mapping', () => {
  it('limits a Phase 1 link deed to its title, jurisdiction and property-schedule facts', () => {
    const fields = profileFields('phase1:linkDoc');
    expect(fields).toEqual(expect.arrayContaining(['linkDocNo', 'district', 'surveyNo', 'boundaryNorth', 'extentSqYards']));
    expect(fields).not.toContain('govtRate');
    expect(fields).not.toContain('structValue');
    expect(fields).not.toContain('executantAadhaar');
    expect(fields).not.toContain('claimantAadhaar');
  });

  it('limits a party upload to that current party only', () => {
    expect(profileFields('party:executant')).toEqual(expect.arrayContaining(['executantName', 'executantAadhaar', 'executantPinCode']));
    expect(profileFields('party:executant')).not.toContain('claimantName');
    expect(profileFields('party:claimant')).not.toContain('executantName');
  });

  it('scopes jurisdiction and property-schedule uploads to their own fields', () => {
    expect(profileFields('jurisdiction')).toEqual(expect.arrayContaining(['districtRegistrar', 'sro', 'district', 'mandal', 'village']));
    expect(profileFields('jurisdiction')).not.toContain('plotNo');
    expect(profileFields('property-schedule')).toEqual(expect.arrayContaining(['plotNo', 'boundaryNorth', 'extentSqYards', 'category', 'unit']));
    expect(profileFields('property-schedule')).not.toContain('districtRegistrar');
  });

  it('includes every legal-entity and authorized-signatory field in the scoped party read', () => {
    expect(profileFields('party:executant')).toEqual(expect.arrayContaining([
      'executantPartyType', 'executantEntityName', 'executantFirmRegistrationNo',
      'executantSocietyRegistrationNo', 'executantCompanyCin', 'executantCompanyBoardResolution',
      'executantOtherEntityKind', 'executantSignatoryDesignation',
    ]));
    expect(profileFields('party:claimant')).toEqual(expect.arrayContaining([
      'claimantEntityName', 'claimantFirmAuthority', 'claimantSocietyResolutionNo', 'claimantCompanyDin',
    ]));
  });
  it('targets adjacent house numbers and explicitly forbids subject-number copying', () => {
    expect(TARGETS['link-deed']).toContain('nearHNo');
    expect(EXTRACTION_PROMPTS['link-deed']).toContain('nearby, adjacent or neighbouring');
    expect(EXTRACTION_PROMPTS['link-deed']).toContain('Never copy the subject property house number');
  });

  it('applies deed/category classification in regular uploads without overwriting choices', () => {
    const classification = {
      kind: 'link-deed' as const,
      paymentMode: null,
      deedType: 'Sale' as const,
      category: 'Part open place',
      reason: 'Registered sale deed for a part open plot.',
    };
    expect(classificationSelections({ deedType: '', category: '', draft: '' }, classification)).toEqual({
      deedType: 'Sale', category: 'Part open place', draft: 'Outright Absolute Sale Deed',
    });
    expect(classificationSelections({ deedType: 'Sale', category: 'Vacant Plot', draft: 'chosen' }, classification)).toEqual({});
  });

  it('distinguishes the uploaded link deed number from an older recital number', () => {
    const schema = schemaForIds(['linkDocNo'], 'link-deed');
    const description = (schema.properties as Record<string, { description: string }>).linkDocNo.description;
    expect(description).toContain('uploaded deed');
    expect(description).toContain('earlier title deed number');
  });

  it('reads the uploaded deed number from an official registrar filename', () => {
    expect(linkDocumentNumberFromFilename('1-2016-1263.pdf')).toBe('1263/2016');
    expect(linkDocumentNumberFromFilename('scan.pdf')).toBeNull();
  });
});

describe('supporting property extraction mapping', () => {
  it('extracts each uploaded supporting record into dedicated evidence fields', () => {
    expect(TARGETS.supporting).toEqual(expect.arrayContaining([
      'supportingDocType',
      'supportingAssessmentNo',
      'supportingPassbookNo',
      'supportingKhataNo',
      'supportingNalaOrderNo',
      'supportingPermitNo',
      'supportingElectricityScNo',
      'supportingElectricityUscNo',
    ]));
    expect(EXTRACTION_PROMPTS.supporting).toContain('one independent uploaded record');
    expect(STAGES.supporting.every(stage => stage.ids.length <= 5)).toBe(true);
  });

  it('rejects shifted supporting values and normalizes full electricity identifiers', () => {
    const supporting = (id: string) => ({ id, label: id } as any);
    expect(normalize(supporting('supportingHouseNo'), 'HARIDAS PALLY YELLAREDDYPET')).toBeNull();
    expect(normalize(supporting('supportingHouseNo'), '30/5/26')).toBeNull();
    expect(normalize(supporting('supportingHouseNo'), '4-5-69/2')).toBe('4-5-69/2');
    expect(normalize(supporting('supportingExtent'), '4-5-69')).toBeNull();
    expect(normalize(supporting('supportingElectricityScNo'), '60612')).toBeNull();
    expect(normalize(supporting('supportingElectricityScNo'), '60612 00100')).toBe('60612 00100');
    expect(normalize(supporting('supportingElectricityUscNo'), '2011 2026')).toBe('20112026');
    expect(normalize(supporting('supportingPassbookNo'), 'T19130081677')).toBe('T19130081677');
  });

  it('uses filenames only to classify known supporting-document types', () => {
    expect(supportingDocumentTypeFromFilename('PPB.jpeg')).toBe('Pattadar Passbook');
    expect(supportingDocumentTypeFromFilename('NALA.jpeg')).toBe('NALA Conversion Order');
    expect(supportingDocumentTypeFromFilename('permission.pdf')).toBe('Building Permit Order');
    expect(supportingDocumentTypeFromFilename('scan-10817.jpeg')).toBeNull();
  });

  it('does not ask one supporting document for another document type\'s fields', () => {
    expect(supportingStagesForFilename('House Tax.jpeg')[1].ids).toEqual(['supportingAssessmentNo', 'supportingHouseNo']);
    expect(supportingStagesForFilename('PPB.jpeg')[1].ids).toEqual(['supportingPassbookNo', 'supportingKhataNo']);
    expect(supportingStagesForFilename('ELECTRICITY.jpeg')[1].ids).toEqual([
      'supportingElectricityScNo', 'supportingElectricityUscNo', 'supportingDetails',
    ]);
  });

  it('limits a Phase 1 permission upload to the three deed-recital details', () => {
    expect(profileFields('phase1:permissions')).toEqual([
      'permBuildingPermitNo', 'permissionDate', 'permissionAuthorityName',
    ]);
  });
});

describe('identity extraction mapping', () => {
  it('uses a dedicated Aadhaar verification pass', () => {
    expect(STAGES['executant-id'].some(stage => stage.ids.length === 1 && stage.ids[0] === 'executantAadhaar')).toBe(true);
    expect(STAGES['claimant-id'].some(stage => stage.ids.length === 1 && stage.ids[0] === 'claimantAadhaar')).toBe(true);
  });

  it('rejects labels, gender and incomplete identity values', () => {
    const field = (id: string) => ALL_FIELDS.find(item => item.id === id)!;
    expect(normalize(field('claimantOccupation'), 'MALE')).toBeNull();
    expect(normalize(field('claimantRelativeName'), 'S/o')).toBeNull();
    expect(normalize(field('claimantRelativeName'), 'Rajender')).toBe('Rajender');
    expect(normalize(field('claimantRelativeName'), 'S/O Rajender')).toBe('Rajender');
    expect(normalize(field('claimantMobile'), '-')).toBeNull();
    expect(normalize(field('claimantMobile'), '98765 43210')).toBe('9876543210');
    expect(normalize(field('claimantLocality'), 'Andhra Pradesh - 505301')).toBeNull();
  });

  it('keeps identity values only when independent reads agree', () => {
    const result = agreeFieldReads(
      'claimant-id',
      ['claimantName', 'claimantVillage'],
      { claimantName: 'Gangula PremSagar', claimantVillage: 'Sircilla' },
      { claimantName: ' gangula  premsagar ', claimantVillage: 'Narsapur' },
    );
    expect(result.values).toEqual({ claimantName: 'Gangula PremSagar' });
    expect(result.rejected).toEqual(['claimantVillage']);
  });

  it('accepts a field only when two of three OCR reads agree', () => {
    const result = majorityFieldReads(
      'claimant-id',
      ['claimantName', 'claimantDistrict'],
      [
        { claimantName: 'Gangula PremSagar', claimantDistrict: 'Karim Nagar' },
        { claimantName: 'Gosaula Premnagar', claimantDistrict: 'Medak' },
        { claimantName: ' gangula  premsagar ', claimantDistrict: 'Siddipet' },
      ],
    );
    expect(result.values).toEqual({ claimantName: 'Gangula PremSagar' });
    expect(result.rejected).toEqual(['claimantDistrict']);
  });

  it('keeps a visible Aadhaar number when OCR passes use different spacing', () => {
    const result = majorityFieldReads(
      'claimant-id',
      ['claimantAadhaar'],
      [
        { claimantAadhaar: '2209 6933 9467' },
        { claimantAadhaar: '220969339467' },
        { claimantAadhaar: '2209-6933-9467' },
      ],
    );
    expect(result.values.claimantAadhaar).toBe('2209 6933 9467');
  });

  it('requires three matching Aadhaar reads when five focused reads are used', () => {
    const result = majorityFieldReads('claimant-id', ['claimantAadhaar'], [
      { claimantAadhaar: '2209 6933 9467' },
      { claimantAadhaar: '220969339467' },
      { claimantAadhaar: '2209-6933-9467' },
      { claimantAadhaar: '2209 6933 9461' },
      { claimantAadhaar: '2209 6933 9468' },
    ]);
    expect(result.values.claimantAadhaar).toBe('2209 6933 9467');
  });

  it('accepts repeated PDF text-layer Aadhaar digits but rejects a VID', () => {
    const text = 'Your Aadhaar No.: 4345 1375 8505 VID: 9148 3803 0961 2673 Address ... 4345 1375 8505';
    expect(aadhaarFromDocumentText(text)).toBe('4345 1375 8505');
    expect(aadhaarFromDocumentText('VID: 9148 3803 0961 2673')).toBeNull();
  });

  it('does not ask identity OCR to extract a derived age', () => {
    expect(TARGETS['executant-id']).not.toContain('executantAge');
    expect(TARGETS['claimant-id']).not.toContain('claimantAge');
  });

  it('maps a literal Aadhaar address without inventing a mandal', () => {
    const address = parseIdentityAddress(
      'S/O: Parent Name, 11-1-138, B Y NAGAR, Example Town, Example District, Telangana - 500001',
      'claimant',
    );
    expect(address).toMatchObject({
      claimantRelationName: 'S/O Parent Name',
      claimantHNo: '11-1-138',
      claimantLocality: 'B Y NAGAR',
      claimantVillage: 'Example Town',
      claimantDistrict: 'Example District',
      claimantState: 'Telangana',
      claimantPinCode: '500001',
    });
    expect(address.claimantMandal).toBeUndefined();
  });

  it('recovers locality, town and a two-word district when one comma is lost', () => {
    const address = parseIdentityAddress(
      'S/O: Parent Name, 11-1-138, B Y NAGAR, Exampletown Example District, Telangana - 500001',
      'claimant',
    );
    expect(address.claimantLocality).toBe('B Y NAGAR');
    expect(address.claimantVillage).toBe('Exampletown');
    expect(address.claimantDistrict).toBe('Example District');
  });
});
