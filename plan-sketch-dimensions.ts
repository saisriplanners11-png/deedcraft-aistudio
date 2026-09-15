import { DimensionUnit, DimensionValue, PlanDocument, ValidationIssue } from './plan-sketch-types';

/**
 * Standard factor given in registration guidelines:
 * 1 Sq.Yard = 0.836127 Sq.Metres
 */
export const SQ_YARDS_TO_SQ_MTRS_FACTOR = 0.836127;

export function calculateSqMtrs(sqYards: number | ''): number | '' {
  if (sqYards === '' || isNaN(sqYards) || sqYards <= 0) return '';
  const val = sqYards * SQ_YARDS_TO_SQ_MTRS_FACTOR;
  return Math.round(val * 1000) / 1000;
}

/**
 * Parse any user entered dimension string like:
 * "40'-5\"", "40' 5\"", "40-5", "40.5", "40", "12.35m", "12.35"
 * into a normalized numeric value (feet or metres) and normalized representation.
 */
export function parseDimension(rawInput: string, unit: DimensionUnit = 'Feet'): DimensionValue {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return { raw: '', normalized: 0, unit };
  }

  // Check if user explicitly wrote unit
  let detectedUnit = unit;
  if (/m(tr|eter|etres|trs)?$/i.test(trimmed)) {
    detectedUnit = 'Metres';
  } else if (/(ft|feet|')/i.test(trimmed)) {
    detectedUnit = 'Feet';
  }

  // Regex for feet and inches: 40'-5", 40'5", 40' 5", 40-5 (when unit is feet)
  // Check for standard 40'-5" or 40' 6" or 40-5.5" — the foot mark and the
  // hyphen before inches are each optional and may appear together, so they
  // are matched as one non-capturing separator rather than a single character
  // class (which would only ever consume one of the two).
  const ftInMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:['’]\s*-?|-)\s*(\d+(?:\.\d+)?)\s*["”]?$/);
  if (ftInMatch) {
    const feet = parseFloat(ftInMatch[1]) || 0;
    const inches = parseFloat(ftInMatch[2]) || 0;
    const normalizedFeet = feet + inches / 12;
    return {
      raw: trimmed,
      normalized: Math.round(normalizedFeet * 1000) / 1000,
      unit: 'Feet',
    };
  }

  // Feet only with prime: 40' or 40 ft
  const ftOnlyMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:['’]|ft|feet)?$/i);
  if (ftOnlyMatch && detectedUnit === 'Feet') {
    const feet = parseFloat(ftOnlyMatch[1]) || 0;
    return {
      raw: trimmed,
      normalized: feet,
      unit: 'Feet',
    };
  }

  // Meters: 12.5 or 12.5m or 12.5 mtrs
  const cleanNumber = trimmed.replace(/[^\d.]/g, '');
  const parsedNum = parseFloat(cleanNumber);

  if (!isNaN(parsedNum)) {
    return {
      raw: trimmed,
      normalized: parsedNum,
      unit: detectedUnit,
    };
  }

  return {
    raw: trimmed,
    normalized: 0,
    unit: detectedUnit,
  };
}

/**
 * Format a dimension value nicely for display.
 * If raw exists, use raw; otherwise format normalized value.
 */
export function formatDimensionDisplay(dim: DimensionValue): string {
  if (dim.raw) return dim.raw;
  if (!dim.normalized) return '0';

  if (dim.unit === 'Feet') {
    const totalInches = Math.round(dim.normalized * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return inches > 0 ? `${feet}'-${inches}"` : `${feet}'-0"`;
  }
  return `${dim.normalized} Mtrs`;
}

/**
 * Generates the official sample output text format:
 * PLAN FOR REGISTRATION
 * THE [PROPERTY_TYPE], ADMEASURING A TOTAL AREA OF [AREA_SQ_YARDS] SQ.YARDS EQUIVALENT TO [AREA_SQ_MTRS] SQ.MTRS, IN SURVEY NO.[SURVEY_NO], SITUATED AT [NEAR_HNO] OF [LOCALITY] LOCALITY OF [VILLAGE], [MANDAL].
 * EXECUTANT/S: [EXECUTANT_DETAILS].
 * CLAIMANT/S: [CLAIMANT_DETAILS].
 */
export function generateLegalDescription(doc: PlanDocument): {
  title: string;
  propertyDescription: string;
  executantText: string;
  claimantText: string;
  details: {
    propType: string;
    areaYards: string | number;
    areaMtrs: string | number;
    surveyNo: string;
    nearHNo: string;
    locality: string;
    village: string;
    mandal: string;
    district: string;
    houseDesc: string;
  };
} {
  const p = doc.property;
  const propType = (p.propertyType === 'Other' && p.customPropertyType
    ? p.customPropertyType
    : p.propertyType).toUpperCase();

  const areaYards = p.areaSqYards !== '' ? p.areaSqYards : '_______';
  const areaMtrs = p.areaSqMtrs !== '' ? p.areaSqMtrs : '_______';
  const surveyNo = p.surveyNo.trim() || '_______';

  let nearHNo = p.nearHNo.trim();
  if (nearHNo) {
    if (!nearHNo.toUpperCase().startsWith('NEAR')) {
      if (!nearHNo.toUpperCase().startsWith('H.NO')) {
        nearHNo = `NEAR H.NO.${nearHNo}`;
      } else {
        nearHNo = `NEAR ${nearHNo}`;
      }
    }
  } else {
    nearHNo = 'NEAR H.NO. _______';
  }

  let locality = p.locality.trim() ? p.locality.trim().toUpperCase() : '';
  if (locality) {
    if (!locality.startsWith("'") && !locality.startsWith('"')) {
      locality = `'${locality}'`;
    }
    locality = `${locality} LOCALITY OF `;
  }

  let village = p.village.trim() ? p.village.trim().toUpperCase() : '_______';
  if (village !== '_______' && !village.endsWith('VILLAGE')) {
    village = `${village} VILLAGE`;
  }

  let mandal = p.mandal.trim() ? p.mandal.trim().toUpperCase() : '_______';
  if (mandal !== '_______' && !mandal.endsWith('MANDAL')) {
    mandal = `${mandal} MANDAL`;
  }

  const district = p.district.trim() ? `, ${p.district.trim().toUpperCase()}` : '';

  let houseDesc = '';
  if (p.propertyType === 'House' || p.house?.enabled) {
    const struct = (p.house?.structureType || 'CONSTRUCTED R.C.C. HOUSE').toUpperCase();
    const plinth = p.house?.plinthAreaSqFt ? ` HAVING A PLINTH AREA OF ${p.house.plinthAreaSqFt} SQ.FT.` : '';
    const dims = (p.house?.widthRaw && p.house?.lengthRaw) ? ` (MEASURING ${p.house.widthRaw} × ${p.house.lengthRaw})` : '';
    houseDesc = ` TOGETHER WITH ${struct}${dims}${plinth},`;
  }

  const propertyDescription = `THE ${propType},${houseDesc} ADMEASURING A TOTAL AREA OF ${areaYards} SQ.YARDS EQUIVALENT TO ${areaMtrs} SQ.MTRS, IN SURVEY NO.${surveyNo}, SITUATED AT ${nearHNo} OF ${locality}${village}, ${mandal}${district}.`;

  // Format party details: NAME RELATION RELATIVE, AGED XX YEARS, OCCU: XX, R/O ADDRESS
  const formatParty = (party: PlanDocument['executant'], defaultRole: string) => {
    if (!party.name.trim()) return `[${defaultRole} DETAILS NOT ENTERED]`;
    const parts: string[] = [];
    parts.push(party.name.trim().toUpperCase());
    if (party.relativeName.trim()) {
      const rel = (party.relation || 'S/o').toUpperCase();
      parts.push(`${rel} ${party.relativeName.trim().toUpperCase()}`);
    }
    if (party.age.trim()) {
      parts.push(`AGED ${party.age.trim()} YEARS`);
    }
    if (party.occupation.trim()) {
      parts.push(`OCCU: ${party.occupation.trim().toUpperCase()}`);
    }
    if (party.address.trim()) {
      const addr = party.address.trim().toUpperCase();
      parts.push(addr.startsWith('R/O') ? addr : `R/O ${addr}`);
    }
    return parts.join(', ');
  };

  return {
    title: 'PLAN FOR REGISTRATION',
    propertyDescription,
    executantText: formatParty(doc.executant, 'EXECUTANT'),
    claimantText: formatParty(doc.claimant, 'CLAIMANT'),
    details: {
      propType,
      areaYards,
      areaMtrs,
      surveyNo,
      nearHNo,
      locality,
      village,
      mandal,
      district,
      houseDesc,
    },
  };
}

/**
 * Validates document against Section 8 validation rules.
 */
export function validatePlanDocument(doc: PlanDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Area cannot be blank or negative
  if (doc.property.areaSqYards === '' || isNaN(Number(doc.property.areaSqYards))) {
    issues.push({
      field: 'property.areaSqYards',
      message: 'Total Area (Sq.Yards) cannot be blank.',
      severity: 'error',
    });
  } else if (Number(doc.property.areaSqYards) <= 0) {
    issues.push({
      field: 'property.areaSqYards',
      message: 'Total Area (Sq.Yards) must be greater than zero.',
      severity: 'error',
    });
  }

  // Survey No mandatory
  if (!doc.property.surveyNo.trim()) {
    issues.push({
      field: 'property.surveyNo',
      message: 'Survey No. is required for registration plan.',
      severity: 'error',
    });
  }

  // Village and Mandal should not be blank
  if (!doc.property.village.trim()) {
    issues.push({
      field: 'property.village',
      message: 'Village name cannot be blank.',
      severity: 'error',
    });
  }
  if (!doc.property.mandal.trim()) {
    issues.push({
      field: 'property.mandal',
      message: 'Mandal name cannot be blank.',
      severity: 'error',
    });
  }

  // Executant details validation
  if (!doc.executant.name.trim()) {
    issues.push({
      field: 'executant.name',
      message: 'Executant Name is required.',
      severity: 'error',
    });
  }
  if (!doc.executant.relativeName.trim()) {
    issues.push({
      field: 'executant.relativeName',
      message: 'Executant Relative Name is required.',
      severity: 'warning',
    });
  }

  // Claimant details validation
  if (!doc.claimant.name.trim()) {
    issues.push({
      field: 'claimant.name',
      message: 'Claimant Name is required.',
      severity: 'error',
    });
  }
  if (!doc.claimant.relativeName.trim()) {
    issues.push({
      field: 'claimant.relativeName',
      message: 'Claimant Relative Name is required.',
      severity: 'warning',
    });
  }

  // Boundaries & Dimensions validation
  const b = doc.boundaries;
  if (!b.northBoundary.trim()) {
    issues.push({
      field: 'boundaries.northBoundary',
      message: 'North Boundary / Adjacent property is required.',
      severity: 'warning',
    });
  }
  if (!b.northDim.raw.trim() || b.northDim.normalized <= 0) {
    issues.push({
      field: 'boundaries.northDim',
      message: 'North Dimension must be specified.',
      severity: 'warning',
    });
  }

  if (!b.southBoundary.trim()) {
    issues.push({
      field: 'boundaries.southBoundary',
      message: 'South Boundary / Adjacent property is required.',
      severity: 'warning',
    });
  }
  if (!b.southDim.raw.trim() || b.southDim.normalized <= 0) {
    issues.push({
      field: 'boundaries.southDim',
      message: 'South Dimension must be specified.',
      severity: 'warning',
    });
  }

  if (!b.eastBoundary.trim()) {
    issues.push({
      field: 'boundaries.eastBoundary',
      message: 'East Boundary / Adjacent property is required.',
      severity: 'warning',
    });
  }
  if (!b.eastDim.raw.trim() || b.eastDim.normalized <= 0) {
    issues.push({
      field: 'boundaries.eastDim',
      message: 'East Dimension must be specified.',
      severity: 'warning',
    });
  }

  if (!b.westBoundary.trim()) {
    issues.push({
      field: 'boundaries.westBoundary',
      message: 'West Boundary / Adjacent property is required.',
      severity: 'warning',
    });
  }
  if (!b.westDim.raw.trim() || b.westDim.normalized <= 0) {
    issues.push({
      field: 'boundaries.westDim',
      message: 'West Dimension must be specified.',
      severity: 'warning',
    });
  }

  return issues;
}

/**
 * Calculates standard residential house dimensions and setbacks for plot
 */
export function getDefaultHouseDimensions(
  northDimVal: number,
  southDimVal: number,
  eastDimVal: number,
  westDimVal: number
) {
  const avgW = (northDimVal + southDimVal) / 2 || 40;
  const avgL = (eastDimVal + westDimVal) / 2 || 60;

  // Standard setback recommendations for residential houses in Telangana / AP:
  // House width ~60-65% of plot width, length ~60% of plot length
  const houseW = Math.max(10, Math.round(avgW * 0.65));
  const houseL = Math.max(12, Math.round(avgL * 0.60));

  const setbackSide = Math.max(2, Math.round(((avgW - houseW) / 2) * 10) / 10);
  const setbackRear = Math.max(3, Math.round(((avgL - houseL) * 0.45) * 10) / 10);
  const setbackFront = Math.max(3, Math.round((avgL - houseL - setbackRear) * 10) / 10);

  const plinthSqFt = houseW * houseL;
  const plinthSqYds = Math.round((plinthSqFt / 9) * 100) / 100;

  return {
    widthFeet: houseW,
    lengthFeet: houseL,
    widthRaw: `${houseW}'-0"`,
    lengthRaw: `${houseL}'-0"`,
    plinthAreaSqFt: plinthSqFt,
    plinthAreaSqYds: plinthSqYds,
    setbackNorth: `${setbackRear}'-0"`,
    setbackSouth: `${setbackFront}'-0"`,
    setbackEast: `${setbackSide}'-0"`,
    setbackWest: `${setbackSide}'-0"`,
  };
}
