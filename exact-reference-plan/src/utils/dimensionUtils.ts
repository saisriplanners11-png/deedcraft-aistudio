import { DimensionUnit, DimensionValue, PlanDocument, ValidationIssue, PartyDetails, HouseDetails, BoundaryDimensions, RoadSideOption } from '../types';

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
 * "68'-0\"", "68' 0\"", "68'0\"", "68'-6\"", "40-5", "40.5", "40'", "40", "12.35m", "12.35"
 * into a normalized numeric value (feet or metres) and normalized representation.
 */
export function parseDimension(rawInput: string | number | undefined, unit: DimensionUnit = 'Feet'): DimensionValue {
  if (rawInput === undefined || rawInput === null) {
    return { raw: '', normalized: 0, unit };
  }
  if (typeof rawInput === 'number') {
    return {
      raw: String(rawInput),
      normalized: Math.round(rawInput * 1000) / 1000,
      unit,
    };
  }

  const trimmed = String(rawInput).trim();
  if (!trimmed) {
    return { raw: '', normalized: 0, unit };
  }

  // Check if user explicitly wrote unit
  let detectedUnit = unit;
  if (/m(tr|eter|etres|trs)?$/i.test(trimmed)) {
    detectedUnit = 'Metres';
  } else if (/(ft|feet|['’′`])/i.test(trimmed)) {
    detectedUnit = 'Feet';
  }

  // If detected unit is Metres:
  if (detectedUnit === 'Metres') {
    const cleanNumber = trimmed.replace(/[^\d.]/g, '');
    const parsedNum = parseFloat(cleanNumber);
    return {
      raw: trimmed,
      normalized: !isNaN(parsedNum) ? Math.round(parsedNum * 1000) / 1000 : 0,
      unit: 'Metres',
    };
  }

  // Unit is Feet:
  // Pattern 1: Feet and Inches with prime / hyphen / ft separator:
  // e.g. 68'-0", 68'-6", 68' - 0", 68'0", 68' 6", 68-0", 68-6, 68 ft 6 in, 68'-0, 68 ft - 0 in
  // Separator matches ['’′`] with optional [-‐‑–—], or just [-‐‑–—], or ft/feet with optional [-‐‑–—]
  const ftInMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(?:['’′`]\s*[-‐‑–—]?|[-‐‑–—]|(?:ft|feet)\.?\s*[-‐‑–—]?)\s*(\d+(?:\.\d+)?)\s*(?:["”″“]|''|in(?:ch(?:es)?)?)?$/i
  );
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

  // Pattern 2: Space-separated feet and inches with inch quote: e.g. "68 0\"", "68 6\""
  const spaceFtInMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(?:["”″“]|''|in(?:ch(?:es)?)?)$/i
  );
  if (spaceFtInMatch) {
    const feet = parseFloat(spaceFtInMatch[1]) || 0;
    const inches = parseFloat(spaceFtInMatch[2]) || 0;
    const normalizedFeet = feet + inches / 12;
    return {
      raw: trimmed,
      normalized: Math.round(normalizedFeet * 1000) / 1000,
      unit: 'Feet',
    };
  }

  // Pattern 3: Feet only with prime / ft / feet / trailing dash:
  // e.g. "68'", "68 ft", "68 feet", "68.5'", "68'-", "68''"
  const ftOnlyMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:['’′`]|ft|feet|["”″“]|'')?\s*[-‐‑–—]?$/i);
  if (ftOnlyMatch && detectedUnit === 'Feet') {
    const feet = parseFloat(ftOnlyMatch[1]) || 0;
    return {
      raw: trimmed,
      normalized: Math.round(feet * 1000) / 1000,
      unit: 'Feet',
    };
  }

  // Pattern 4: Pure decimal or integer number: e.g. "68", "68.5", "68.0"
  const parsedNum = parseFloat(trimmed);
  if (!isNaN(parsedNum)) {
    return {
      raw: trimmed,
      normalized: Math.round(parsedNum * 1000) / 1000,
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
 * Safely parse any dimension representation (string, number) directly to a normalized number,
 * with fallback if invalid or zero.
 */
export function parseDimensionToNumber(
  val: string | number | undefined,
  isMeters: boolean = false,
  fallback: number = 0
): number {
  if (typeof val === 'number') {
    return val > 0 ? val : fallback;
  }
  if (!val) return fallback;
  const parsed = parseDimension(String(val), isMeters ? 'Metres' : 'Feet');
  return parsed.normalized > 0 ? parsed.normalized : fallback;
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
 * Extracts road width from a boundary string like "30'-0\" Wide Road", "40 Ft Road", "33' Road", "9 Mtrs Road", etc.
 * Ignores House numbers (H.No.), Door numbers, Plot numbers, Survey numbers, and non-road boundaries.
 */
export function extractRoadWidthFromBoundary(boundaryText?: string): string {
  if (!boundaryText) return '';
  const text = boundaryText.trim();
  if (!text) return '';

  // 1. If text does not contain road keywords or width/wide, check if the text itself is solely a dimension (e.g. "30'-0\"" or "40 Ft")
  const hasRoadKeyword = /\b(road|rasta|street|lane|way|passage|galli|sandhu|bypass|highway|wide|width|cc\s*road|bt\s*road)\b/i.test(text);
  const isPureDimension = /^\s*(\d+(?:\.\d+)?)\s*(?:['’′`]\s*[-‐‑–—]?\s*(\d+(?:\.\d+)?)\s*["”″“]?|(?:['’′`]|ft\.?|feet|mtrs?|meters?|m\b))\s*$/i.test(text);

  if (!hasRoadKeyword && !isPureDimension) {
    // Definitely not a road boundary (e.g. "H.No.9-7-Ga0008 of Vemula Shekar", "Open plot no.26 of others")
    return '';
  }

  // 2. Remove house number / plot number / survey number patterns so door/plot numbers don't get misidentified as road width
  // e.g. "H.No. 9-7-Ga0008", "Door No. 12-4", "Plot No. 24", "Sy.No. 45/A"
  const sanitized = text
    .replace(/(?:h\.?no\.?|house\s*no\.?|door\s*no\.?|d\.?no\.?)\s*[:.-]?\s*[a-zA-Z0-9/_-]+/gi, ' ')
    .replace(/(?:plot\s*no\.?|p\.?no\.?|sy\.?no\.?|survey\s*no\.?)\s*[:.-]?\s*[a-zA-Z0-9/_-]+/gi, ' ');

  // Pattern 1: Explicit Feet & Inches with prime or quotes:
  // e.g. 30'-0" Wide Road, 30' 0" Road, 40'-6", 21'-0" Road
  const ftInMatch = sanitized.match(
    /(\d+(?:\.\d+)?)\s*['’′`]\s*[-‐‑–—]?\s*(\d+(?:\.\d+)?)\s*(?:["”″“]|''|in(?:ch(?:es)?)?)?/i
  );
  if (ftInMatch) {
    const feet = ftInMatch[1];
    const inches = ftInMatch[2];
    return `${feet}'-${inches}"`;
  }

  // Pattern 2: Feet with prime or 'ft' or 'feet':
  // e.g. 30' Wide Road, 21' Road, 40 Ft Road, 33 Feet Road
  const ftMatch = sanitized.match(/(\d+(?:\.\d+)?)\s*(?:['’′`]|ft\.?|feet)\b/i);
  if (ftMatch) {
    return `${ftMatch[1]}'-0"`;
  }

  // Pattern 3: Meters / Mtrs:
  // e.g. 9 Mtrs Road, 9.14 Metres, 9m Road
  const mtrsMatch = sanitized.match(/(\d+(?:\.\d+)?)\s*(?:mtrs?|meters?|m\b)/i);
  if (mtrsMatch) {
    return `${mtrsMatch[1]} Mtrs`;
  }

  // Pattern 4: Number followed by Wide / Width / Road:
  // e.g. "30 Wide Road", "40 Road", "30 CC Road", "30 BT Road"
  const numRoadMatch = sanitized.match(/(\d+(?:\.\d+)?)\s*(?:wide|width|wide\s*bt|wide\s*cc)?\s*(?:bt\s*|cc\s*|tar\s*)?road/i);
  if (numRoadMatch) {
    return `${numRoadMatch[1]}'-0"`;
  }

  return '';
}

/**
 * Returns the exact road label to display on a given road strip (North, South, East, West).
 * Directly displays whatever the user entered in that side's boundary field in the
 * Boundary & Dimension Details section.
 */
export function getRoadLabelForSide(
  side: 'North' | 'South' | 'East' | 'West',
  boundaries: {
    northBoundary?: string;
    southBoundary?: string;
    eastBoundary?: string;
    westBoundary?: string;
    roadWidth?: string;
  }
): string {
  const rawBoundaryText = (
    side === 'North' ? boundaries.northBoundary :
    side === 'South' ? boundaries.southBoundary :
    side === 'East' ? boundaries.eastBoundary :
    boundaries.westBoundary
  )?.trim() || '';

  // If the user has entered boundary text for this side:
  if (rawBoundaryText) {
    const isRoadKeywordPresent = /\b(road|rasta|street|lane|way|passage|galli|sandhu|bypass|highway)\b/i.test(rawBoundaryText);
    
    // 1. If user explicitly wrote the road description (e.g. "30'-0\" Wide Road", "21' Road", "CC Road", "Village Road", "Gram Panchayat Rasta", "10.00 Mtrs Wide Road")
    if (isRoadKeywordPresent) {
      return rawBoundaryText.toUpperCase();
    }

    // 2. If user entered only a dimension (e.g. "30'-0\"", "21'", "9 Mtrs", "40 Ft")
    const extractedWidth = extractRoadWidthFromBoundary(rawBoundaryText);
    if (extractedWidth) {
      return `${extractedWidth} WIDE ROAD`;
    }

    // 3. User entered any custom text / name for this boundary side
    return rawBoundaryText.toUpperCase();
  }

  // If boundary text is empty for this side:
  // Fallback to boundaries.roadWidth ONLY if explicitly provided and not default
  if (boundaries.roadWidth && boundaries.roadWidth.trim()) {
    const customWidth = boundaries.roadWidth.trim();
    if (
      customWidth.toUpperCase() !== '33\'-0"' &&
      customWidth.toUpperCase() !== '30\'-0"' &&
      customWidth.toUpperCase() !== '33\'-0" WIDE ROAD' &&
      customWidth.toUpperCase() !== '30\'-0" WIDE ROAD'
    ) {
      return customWidth.toUpperCase().includes('ROAD')
        ? customWidth.toUpperCase()
        : `${customWidth.toUpperCase()} WIDE ROAD`;
    }
  }

  // Clean default when no boundary text has been entered yet
  return 'ROAD';
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
    isPlot: boolean;
    isHouse: boolean;
    isHouseLike: boolean;
    isPartOpenPlace: boolean;
    isDemolishedHouse: boolean;
    mainDesc: string;
    houseBuildingDesc: string;
    houseBearingPart: string;
    plinthPrefix: string;
    plinthSqFt: string;
    plinthPart: string;
    plotSurveyPart: string;
    plotHeader: string;
    areaYards: string | number;
    areaMtrs: string | number;
    areaUnitsYards: string;
    areaUnitsMtrs: string;
    surveyNo: string;
    plotNo: string;
    surveyPrefix: string;
    situatedPrefix: string;
    nearHNo: string;
    locality: string;
    village: string;
    mandal: string;
    district: string;
    locClean: string;
    vilClean: string;
    vilDisplay: string;
    distClean: string;
    mandalClean: string;
    mandalDisplay: string;
    houseDesc: string;
    situatedPart: string;
  };
} {
  const p = doc.property;
  const isHouse = p.propertyType === 'House';
  const isPartOpenPlace = p.propertyType === 'Part Open Place';
  const isDemolishedHouse = p.propertyType === 'Demolished House';
  const isHouseLike = isHouse || isPartOpenPlace || isDemolishedHouse;
  const isPlot = 
    p.propertyType === 'Plot' || 
    p.propertyType === 'Open Plot' || 
    p.propertyType === 'Open Place';
  const propType = (p.propertyType === 'Other' && p.customPropertyType 
    ? p.customPropertyType 
    : p.propertyType).toUpperCase();

  const areaYardsNum = typeof p.areaSqYards === 'number' ? p.areaSqYards : parseFloat(String(p.areaSqYards || ''));
  const areaMtrsNum = typeof p.areaSqMtrs === 'number' ? p.areaSqMtrs : parseFloat(String(p.areaSqMtrs || ''));
  const areaYardsFormatted = !isNaN(areaYardsNum) && areaYardsNum > 0 
    ? areaYardsNum.toFixed(2) 
    : (p.areaSqYards !== '' && p.areaSqYards !== undefined ? String(p.areaSqYards).trim() : '');
  const areaMtrsFormatted = !isNaN(areaMtrsNum) && areaMtrsNum > 0 
    ? areaMtrsNum.toFixed(2) 
    : (p.areaSqMtrs !== '' && p.areaSqMtrs !== undefined ? String(p.areaSqMtrs).trim() : '');

  const surveyNo = (p.surveyNo || '').trim();
  const plotNo = (p.plotNo || '').trim();

  // House-specific model variables
  const housesList: HouseDetails[] = (p.houses && p.houses.length > 0)
    ? p.houses
    : (p.house ? [p.house] : []);
  const activeHouses = housesList.filter(h => h.enabled !== false);
  const primaryHouse = activeHouses[0] || p.house;

  const rawStruct = primaryHouse?.structureType?.trim() || 'R.C.C. Building';
  let houseBuildingDesc = rawStruct;
  if (rawStruct.toLowerCase().includes('with open place')) {
    houseBuildingDesc = rawStruct;
  } else {
    houseBuildingDesc = `${rawStruct} with open place`;
  }

  const authority = (p.houseAuthority || primaryHouse?.houseAuthority || 'Municipal Council House No.').trim();
  const rawHNo = (p.houseNo || '').trim();
  let houseBearingPart = '';
  if (rawHNo) {
    if (rawHNo.toLowerCase().startsWith('bearing ')) {
      houseBearingPart = rawHNo;
    } else if (
      rawHNo.toLowerCase().startsWith('municipal council') ||
      rawHNo.toLowerCase().startsWith('gram panchayat') ||
      rawHNo.toLowerCase().startsWith('municipal corporation') ||
      rawHNo.toLowerCase().startsWith('house no') ||
      rawHNo.toLowerCase().startsWith('h.no')
    ) {
      houseBearingPart = `bearing ${rawHNo}`;
    } else {
      let authPrefix = authority;
      if (!authPrefix.toLowerCase().startsWith('bearing ')) {
        authPrefix = `bearing ${authPrefix}`;
      }
      let cleanHNo = rawHNo;
      if (cleanHNo.startsWith('.')) cleanHNo = cleanHNo.substring(1).trim();
      if (authPrefix.endsWith('.')) {
        houseBearingPart = `${authPrefix}${cleanHNo}`;
      } else {
        houseBearingPart = `${authPrefix}.${cleanHNo}`;
      }
    }
  }

  let mainDesc = '';
  if (isHouse) {
    mainDesc = `ALL THAT THE ${houseBuildingDesc.toUpperCase()}`;
    if (houseBearingPart) {
      mainDesc += ` ${houseBearingPart.toUpperCase()}`;
    }
  } else if (isPartOpenPlace) {
    mainDesc = `ALL THAT THE OPEN PLACE`;
    if (houseBearingPart) {
      mainDesc += ` ${houseBearingPart.toUpperCase()} (PART)`;
    } else {
      mainDesc += ` (PART)`;
    }
  } else if (isDemolishedHouse) {
    mainDesc = `ALL THAT THE OPEN PLACE TOGETHER WITH THE DISMANTLED HOUSE`;
    if (houseBearingPart) {
      mainDesc += ` ${houseBearingPart.toUpperCase()}`;
    }
  } else {
    mainDesc = `ALL THAT THE ${propType}`;
  }

  const plinthPrefix = primaryHouse?.plinthPrefix?.trim() || '';
  let plinthSqFt = '';
  let plinthPart = '';
  if (isHouse) {
    if (activeHouses.length > 1) {
      const totalSqFt = activeHouses.reduce((sum, h) => {
        const v = typeof h.plinthAreaSqFt === 'number' ? h.plinthAreaSqFt : (parseFloat(String(h.plinthAreaSqFt)) || 0);
        return sum + v;
      }, 0);
      if (totalSqFt > 0) {
        plinthSqFt = totalSqFt.toFixed(2);
        plinthPart = `having total plinth area of ${plinthSqFt} square feets`;
      }
    } else if (primaryHouse && primaryHouse.plinthAreaSqFt !== undefined && primaryHouse.plinthAreaSqFt !== '') {
      const pNum = typeof primaryHouse.plinthAreaSqFt === 'number' ? primaryHouse.plinthAreaSqFt : parseFloat(String(primaryHouse.plinthAreaSqFt));
      const pStr = !isNaN(pNum) && pNum > 0 ? pNum.toFixed(2) : String(primaryHouse.plinthAreaSqFt).trim();
      if (pStr && pStr !== '0' && pStr !== '0.00') {
        plinthSqFt = pStr;
        const prefixStr = plinthPrefix ? `${plinthPrefix}:` : '';
        plinthPart = prefixStr ? `having plinth area of ${prefixStr}${plinthSqFt} square feets` : `having plinth area of ${plinthSqFt} square feets`;
      }
    }
  }

  let plotSurveyPart = '';
  if (plotNo && surveyNo) {
    plotSurveyPart = `in plot no.${plotNo} and survey no.${surveyNo}`;
  } else if (plotNo) {
    plotSurveyPart = `in plot no.${plotNo}`;
  } else if (surveyNo) {
    plotSurveyPart = `in survey no.${surveyNo}`;
  }

  const locClean = (p.locality || '').trim().replace(/^['"‘“]+|['"’”]+$/g, '');
  const vilClean = (p.village || '').trim().replace(/\s+VILLAGE$/i, '');
  const vilDisplay = vilClean ? (vilClean.toLowerCase().endsWith('village') ? vilClean : `${vilClean} Village`) : '';

  const mandalClean = (p.mandal || '').trim().replace(/\s+MANDAL$/i, '');
  const mandalDisplay = mandalClean ? (mandalClean.toLowerCase().endsWith('mandal') ? mandalClean : `${mandalClean} Mandal`) : '';

  const distClean = (p.district || '').trim();

  let situatedPart = '';
  if (locClean && vilDisplay) {
    situatedPart = `situated at ‘${locClean}’ locality of ${vilDisplay}`;
  } else if (locClean) {
    situatedPart = `situated at ‘${locClean}’ locality`;
  } else if (vilDisplay) {
    situatedPart = `situated at ${vilDisplay}`;
  }

  if (mandalDisplay) {
    if (situatedPart) {
      situatedPart += `, ${mandalDisplay}`;
    } else {
      situatedPart = `situated in ${mandalDisplay}`;
    }
  }

  if (distClean) {
    if (situatedPart) {
      situatedPart += `, District:${distClean}`;
    } else {
      situatedPart = `District:${distClean}`;
    }
  }

  let nearHNo = p.nearHNo.trim();
  if (isPlot) {
    // Open Plot identification logic
    if (nearHNo && (
      nearHNo.toUpperCase().startsWith('NEAR/ADJACENT') ||
      nearHNo.toUpperCase().startsWith('NEAR') ||
      nearHNo.toUpperCase().startsWith('ADJACENT') ||
      nearHNo.toUpperCase().startsWith('OPP') ||
      nearHNo.toUpperCase().startsWith('BESIDE') ||
      nearHNo.toUpperCase().startsWith('BEARING')
    )) {
      // Already formatted with plot template
    } else if (p.houseNo && p.houseNo.trim()) {
      const hClean = p.houseNo.trim();
      const tmpl = p.locationTemplateType || 'near_adjacent_hno';
      if (tmpl === 'near_adjacent_hno') {
        nearHNo = `NEAR/ADJACENT H.NO.${hClean}`;
      } else if (tmpl === 'adjacent_hno') {
        nearHNo = `ADJACENT H.NO.${hClean}`;
      } else if (tmpl === 'opp_hno') {
        nearHNo = `OPP. H.NO.${hClean}`;
      } else if (tmpl === 'beside_hno') {
        nearHNo = `BESIDE H.NO.${hClean}`;
      } else {
        nearHNo = `NEAR H.NO.${hClean}`;
      }
    } else {
      nearHNo = '';
    }
  } else if (isHouseLike) {
    nearHNo = '';
  } else {
    if (nearHNo) {
      if (!nearHNo.toUpperCase().startsWith('NEAR') && !nearHNo.toUpperCase().startsWith('PLOT') && !nearHNo.toUpperCase().startsWith('BEARING')) {
        if (!nearHNo.toUpperCase().startsWith('H.NO')) {
          nearHNo = `NEAR H.NO.${nearHNo}`;
        } else {
          nearHNo = `NEAR ${nearHNo}`;
        }
      }
      if (p.plotNo && !nearHNo.toUpperCase().includes('PLOT')) {
        nearHNo = `PLOT NO. ${p.plotNo.trim()}, ${nearHNo}`;
      }
    } else if (p.plotNo) {
      nearHNo = `PLOT NO. ${p.plotNo.trim()}`;
    } else {
      nearHNo = '';
    }
  }

  let locality = locClean ? `'${locClean.toUpperCase()}' LOCALITY OF ` : '';
  let village = vilDisplay ? `${vilDisplay.toUpperCase()}` : '';
  let mandal = mandalDisplay ? `${mandalDisplay.toUpperCase()}` : '';
  const district = distClean ? `, ${distClean.toUpperCase()}` : '';

  let houseDesc = '';
  if (activeHouses.length > 1) {
    const totalSqFt = activeHouses.reduce((sum, h) => {
      const v = typeof h.plinthAreaSqFt === 'number' ? h.plinthAreaSqFt : (parseFloat(String(h.plinthAreaSqFt)) || 0);
      return sum + v;
    }, 0);
    const houseDescriptions = activeHouses.map((h, i) => {
      const isGeneric = !h.name ||
        /^(structure|house|bldg|building)[\s#\-_]*\d*$/i.test(h.name.trim()) ||
        /^main\s*house$/i.test(h.name.trim());
      const hName = (!isGeneric && h.name) ? `${h.name.trim().toUpperCase()}: ` : '';
      const struct = (h.structureType || 'CONSTRUCTED R.C.C. HOUSE').toUpperCase();
      const dims = (h.widthRaw && h.lengthRaw) ? ` (${h.widthRaw} × ${h.lengthRaw})` : '';
      const plinth = h.plinthAreaSqFt ? ` PLINTH: ${h.plinthAreaSqFt} SQ.FT.` : '';
      return `${i+1}) ${hName}${struct}${dims}${plinth}`;
    }).join('; ');
    houseDesc = ` TOGETHER WITH CONSTRUCTED STRUCTURES: ${houseDescriptions}, TOTAL PLINTH AREA: ${totalSqFt.toFixed(2)} SQ.FT.,`;
  } else if (activeHouses.length === 1 && activeHouses[0].enabled) {
    const single = activeHouses[0];
    const struct = (single.structureType || 'CONSTRUCTED R.C.C. HOUSE').toUpperCase();
    const plinth = single.plinthAreaSqFt ? ` HAVING A PLINTH AREA OF ${single.plinthAreaSqFt} SQ.FT.` : '';
    const dims = (single.widthRaw && single.lengthRaw) ? ` (MEASURING ${single.widthRaw} × ${single.lengthRaw})` : '';
    houseDesc = ` TOGETHER WITH ${struct}${dims}${plinth},`;
  }

  // Formatting units & headers
  let plotHeader = '';
  if (isPlot) {
    if (p.propertyType === 'Open Place') {
      plotHeader = `THE OPEN PLACE,`;
    } else if (p.plotNo && p.plotNo.trim()) {
      plotHeader = `THE OPEN PLOT NO.${p.plotNo.trim()},`;
    } else {
      plotHeader = `THE OPEN PLOT,`;
    }
  } else {
    plotHeader = `THE ${propType},${houseDesc}`;
  }

  const areaUnitsYards = isPlot ? 'SQUARE YARDS' : 'SQ.YARDS';
  const areaUnitsMtrs = isPlot ? 'SQUARE METERS' : 'SQ.MTRS';
  const surveyPrefix = isPlot ? 'IN SURVEY NO/S.' : 'IN SURVEY NO.';

  const upperNear = nearHNo.toUpperCase().trim();
  let situatedPrefix = 'SITUATED AT ';
  if (
    upperNear.startsWith('NEAR/ADJACENT') ||
    upperNear.startsWith('NEAR') ||
    upperNear.startsWith('ADJACENT') ||
    upperNear.startsWith('OPP') ||
    upperNear.startsWith('BESIDE')
  ) {
    situatedPrefix = 'SITUATED ';
  } else if (upperNear.startsWith('AT ')) {
    situatedPrefix = 'SITUATED ';
  }

  let propertyDescription = '';
  if (isHouseLike) {
    // Exact registration deed format requested by user (in full CAPITAL LETTERS):
    const clauses: string[] = [];

    clauses.push(mainDesc.toUpperCase());

    if (areaYardsFormatted && areaMtrsFormatted) {
      clauses.push(`ADMEASURING A TOTAL AREA OF ${areaYardsFormatted} SQUARE YARDS EQUIVALENT TO ${areaMtrsFormatted} SQUARE METERS`);
    } else if (areaYardsFormatted) {
      clauses.push(`ADMEASURING A TOTAL AREA OF ${areaYardsFormatted} SQUARE YARDS`);
    }

    if (isHouse && plinthPart) {
      clauses.push(plinthPart.toUpperCase());
    }

    if (plotSurveyPart) {
      clauses.push(plotSurveyPart.toUpperCase());
    }

    if (situatedPart) {
      clauses.push(situatedPart.toUpperCase());
    }

    propertyDescription = clauses.join(', ').toUpperCase();
  } else if (isPlot) {
    const areaClause = areaYardsFormatted
      ? `ADMEASURING A TOTAL AREA OF ${areaYardsFormatted} ${areaUnitsYards}${areaMtrsFormatted ? ` EQUIVALENT TO ${areaMtrsFormatted} ${areaUnitsMtrs}` : ''}, `
      : '';
    const surveyClause = surveyNo ? `${surveyPrefix}${surveyNo}, ` : '';
    let cleanNear = nearHNo;
    const activeSitPrefix = cleanNear ? situatedPrefix : 'SITUATED AT ';

    let sitClause = '';
    if (cleanNear && locality) {
      sitClause = `${activeSitPrefix}${cleanNear} OF ${locality}${village ? `${village}, ` : ''}${mandal ? `${mandal}` : ''}${district}.`;
    } else if (cleanNear) {
      sitClause = `${activeSitPrefix}${cleanNear}, ${village ? `${village}, ` : ''}${mandal ? `${mandal}` : ''}${district}.`;
    } else if (locality || village) {
      sitClause = `SITUATED AT ${locality}${village ? `${village}, ` : ''}${mandal ? `${mandal}` : ''}${district}.`;
    }
    propertyDescription = `${plotHeader} ${areaClause}${surveyClause}${sitClause}`.trim().toUpperCase();
  } else {
    const areaClause = areaYardsFormatted
      ? `ADMEASURING A TOTAL AREA OF ${areaYardsFormatted} SQ.YARDS${areaMtrsFormatted ? ` EQUIVALENT TO ${areaMtrsFormatted} SQ.MTRS` : ''}, `
      : '';
    const surveyClause = surveyNo ? `IN SURVEY NO.${surveyNo}, ` : '';
    const sitClause = nearHNo
      ? `SITUATED AT ${nearHNo} OF ${locality}${village ? `${village}, ` : ''}${mandal ? `${mandal}` : ''}${district}.`
      : `SITUATED AT ${locality}${village ? `${village}, ` : ''}${mandal ? `${mandal}` : ''}${district}.`;
    propertyDescription = `THE ${propType},${houseDesc} ${areaClause}${surveyClause}${sitClause}`.trim().toUpperCase();
  }

  // Format party details: NAME RELATION RELATIVE, AGED XX YEARS, OCCU: XX, R/O ADDRESS
  const formatParty = (parties: PartyDetails[], defaultRole: string) => {
    if (!parties || parties.length === 0 || !parties[0].name.trim()) return `[${defaultRole} DETAILS NOT ENTERED]`;
    
    return parties.map((party, index) => {
      const parts: string[] = [];
      const prefix = parties.length > 1 ? `${index + 1}) ` : '';
      parts.push(prefix + party.name.trim().toUpperCase());
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
    }).join('\n');
  };

  return {
    title: 'PLAN FOR REGISTRATION',
    propertyDescription,
    executantText: formatParty(doc.executant, 'EXECUTANT'),
    claimantText: formatParty(doc.claimant, 'CLAIMANT'),
    details: {
      propType,
      isPlot,
      isHouse,
      isHouseLike,
      isPartOpenPlace,
      isDemolishedHouse,
      mainDesc,
      houseBuildingDesc,
      houseBearingPart,
      plinthPrefix,
      plinthSqFt,
      plinthPart,
      plotSurveyPart,
      plotHeader,
      areaYards: areaYardsFormatted,
      areaMtrs: areaMtrsFormatted,
      areaUnitsYards,
      areaUnitsMtrs,
      surveyNo,
      plotNo,
      surveyPrefix,
      situatedPrefix,
      nearHNo,
      locality,
      village,
      mandal,
      district,
      locClean,
      vilClean,
      vilDisplay,
      distClean,
      mandalClean,
      mandalDisplay,
      houseDesc,
      situatedPart,
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

  // Survey No is optional (not mandatory) - user can enter if available or leave blank

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
  if (!doc.executant || doc.executant.length === 0 || !doc.executant[0].name.trim()) {
    issues.push({
      field: 'executant.name',
      message: 'Executant Name is required.',
      severity: 'error',
    });
  }
  if (!doc.executant || doc.executant.length === 0 || !doc.executant[0].relativeName.trim()) {
    issues.push({
      field: 'executant.relativeName',
      message: 'Executant Relative Name is required.',
      severity: 'warning',
    });
  }

  // Claimant details validation
  if (!doc.claimant || doc.claimant.length === 0 || !doc.claimant[0].name.trim()) {
    issues.push({
      field: 'claimant.name',
      message: 'Claimant Name is required.',
      severity: 'error',
    });
  }
  if (!doc.claimant || doc.claimant.length === 0 || !doc.claimant[0].relativeName.trim()) {
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

/**
 * Calculates upright screen angle for SVG text inside a rotated parent group.
 * If text would be upside-down (angle in screen space between 90 and 270 degrees),
 * flips by 180 degrees so text is always readable from left-to-right / bottom-to-top.
 */
export function getUprightAngle(localAngle: number, mapRotation: number = 0): number {
  const normMapRot = ((mapRotation % 360) + 360) % 360;
  const netAngle = (((localAngle + normMapRot) % 360) + 360) % 360;
  if (netAngle > 90 && netAngle <= 270) {
    return localAngle + 180;
  }
  return localAngle;
}

/**
 * Rotates boundaries, dimensions and road assignments by quarter turns (90 deg clockwise steps).
 * e.g. 1 quarter turn clockwise (90°):
 * - Physical Top (North) receives what was on the Left (West)
 * - Physical Right (East) receives what was on the Top (North)
 * - Physical Bottom (South) receives what was on the Right (East)
 * - Physical Left (West) receives what was on the Bottom (South)
 */
export function rotateBoundariesByQuarterTurns(
  boundaries: BoundaryDimensions,
  quarterTurnsClockwise: number
): BoundaryDimensions {
  const turns = ((quarterTurnsClockwise % 4) + 4) % 4;
  if (turns === 0) return boundaries;

  let current = { ...boundaries };

  const roadSideMap: Record<RoadSideOption, RoadSideOption> = {
    'North': 'East',
    'East': 'South',
    'South': 'West',
    'West': 'North',
    'None': 'None',
  };

  for (let i = 0; i < turns; i++) {
    const oldNorthB = current.northBoundary;
    const oldNorthD = current.northDim;
    const oldEastB = current.eastBoundary;
    const oldEastD = current.eastDim;
    const oldSouthB = current.southBoundary;
    const oldSouthD = current.southDim;
    const oldWestB = current.westBoundary;
    const oldWestD = current.westDim;

    const oldNCont = current.northRoadContinuity;
    const oldECont = current.eastRoadContinuity;
    const oldSCont = current.southRoadContinuity;
    const oldWCont = current.westRoadContinuity;

    const nextRoadSides = (current.roadSides || []).map((side) => roadSideMap[side] || side);

    // Map continuity correctly across 90-degree quarter turns
    const mapVertToHoriz = (val?: string): 'both' | 'left' | 'right' | 'none' | undefined => {
      if (!val || val === 'both' || val === 'none') return val as any;
      if (val === 'top') return 'right';
      if (val === 'bottom') return 'left';
      return val as any;
    };

    const mapHorizToVert = (val?: string): 'both' | 'top' | 'bottom' | 'none' | undefined => {
      if (!val || val === 'both' || val === 'none') return val as any;
      if (val === 'left') return 'top';
      if (val === 'right') return 'bottom';
      return val as any;
    };

    current = {
      ...current,
      northBoundary: oldWestB,
      northDim: oldWestD,
      eastBoundary: oldNorthB,
      eastDim: oldNorthD,
      southBoundary: oldEastB,
      southDim: oldEastD,
      westBoundary: oldSouthB,
      westDim: oldSouthD,
      roadSides: nextRoadSides,
      northRoadContinuity: mapVertToHoriz(oldWCont),
      eastRoadContinuity: mapHorizToVert(oldNCont),
      southRoadContinuity: mapVertToHoriz(oldECont),
      westRoadContinuity: mapHorizToVert(oldSCont),
    };
  }

  return current;
}
