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
 * Parses inches string with whole numbers, fractions (like 011/2, 01 1/2, 11 1/2, 1/2),
 * or unicode fractions (like ½, ¼, ¾).
 */
export function parseInchesWithFraction(str: string): { totalInches: number; displayInch: string } {
  let clean = str.trim().replace(/["”″“']/g, '').trim();

  // Normalize unicode fractions to slash notation with a space for reliable numeric parsing
  clean = clean.replace(/½/g, ' 1/2').replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4')
               .replace(/⅛/g, ' 1/8').replace(/⅜/g, ' 3/8').replace(/⅝/g, ' 5/8').replace(/⅞/g, ' 7/8');
  clean = clean.replace(/\s+/g, ' ').trim();

  const slashIdx = clean.indexOf('/');
  if (slashIdx !== -1) {
    const denomPart = clean.slice(slashIdx + 1).trim();
    const denom = parseInt(denomPart, 10);
    const beforeSlash = clean.slice(0, slashIdx).trim();

    if (!isNaN(denom) && denom > 0) {
      const lastSpaceIdx = beforeSlash.lastIndexOf(' ');
      let wholeStr = '';
      let numStr = '';

      if (lastSpaceIdx !== -1) {
        wholeStr = beforeSlash.slice(0, lastSpaceIdx).trim();
        numStr = beforeSlash.slice(lastSpaceIdx + 1).trim();
      } else {
        if (beforeSlash.length === 1) {
          wholeStr = '';
          numStr = beforeSlash;
        } else {
          // In standard civil dimensions without space e.g. "011/2" or "111/2"
          const numDigits = (denom >= 10 && beforeSlash.length >= 3 && parseInt(beforeSlash.slice(-2), 10) < denom) ? 2 : 1;
          numStr = beforeSlash.slice(-numDigits);
          wholeStr = beforeSlash.slice(0, -numDigits);
        }
      }

      const num = parseInt(numStr, 10);
      const whole = parseInt(wholeStr, 10) || 0;
      const isZeroWhole = wholeStr === '0' || wholeStr === '00';
      const hasLeadingZero = wholeStr.startsWith('0') && wholeStr.length > 1;

      if (!isNaN(num) && num > 0 && num < denom) {
        const totalInches = whole + num / denom;

        let fracSymbol = '';
        if (num === 1 && denom === 2) fracSymbol = '½';
        else if (num === 1 && denom === 4) fracSymbol = '¼';
        else if (num === 3 && denom === 4) fracSymbol = '¾';
        else if (num === 1 && denom === 8) fracSymbol = '⅛';
        else if (num === 3 && denom === 8) fracSymbol = '⅜';
        else if (num === 5 && denom === 8) fracSymbol = '⅝';
        else if (num === 7 && denom === 8) fracSymbol = '⅞';

        let displayInch = '';
        if (fracSymbol) {
          if (whole > 0) {
            const formattedWhole = hasLeadingZero ? `0${whole}` : `${whole}`;
            displayInch = `${formattedWhole}${fracSymbol}`;
          } else if (isZeroWhole) {
            displayInch = `0${fracSymbol}`;
          } else {
            displayInch = fracSymbol;
          }
        } else {
          if (whole > 0) {
            const formattedWhole = hasLeadingZero ? `0${whole}` : `${whole}`;
            displayInch = `${formattedWhole} ${num}/${denom}`;
          } else if (isZeroWhole) {
            displayInch = `0 ${num}/${denom}`;
          } else {
            displayInch = `${num}/${denom}`;
          }
        }
        return { totalInches, displayInch };
      }
    }
  }

  const dec = parseFloat(clean);
  if (!isNaN(dec)) {
    return { totalInches: dec, displayInch: clean };
  }

  return { totalInches: 0, displayInch: clean };
}

/**
 * Format fractional inches nicely (e.g. 1.5 -> "1½", 0.5 -> "½", 1.25 -> "1¼")
 */
export function formatFractionInches(inchesVal: number): string {
  const whole = Math.floor(inchesVal);
  const frac = inchesVal - whole;
  if (frac < 0.03) {
    return `${whole}`;
  }
  let symbol = '';
  if (Math.abs(frac - 0.5) < 0.05) symbol = '½';
  else if (Math.abs(frac - 0.25) < 0.05) symbol = '¼';
  else if (Math.abs(frac - 0.75) < 0.05) symbol = '¾';
  else if (Math.abs(frac - 0.125) < 0.04) symbol = '⅛';
  else if (Math.abs(frac - 0.375) < 0.04) symbol = '⅜';
  else if (Math.abs(frac - 0.625) < 0.04) symbol = '⅝';
  else if (Math.abs(frac - 0.875) < 0.04) symbol = '⅞';

  if (symbol) {
    return whole > 0 ? `${whole}${symbol}` : symbol;
  }
  return `${Math.round(inchesVal * 100) / 100}`;
}

/**
 * Parse any user entered dimension string like:
 * "68'-0\"", "45'-011/2\"", "45'-01 1/2\"", "45'-111/2\"", "45'-01/2\"", "45-011/2",
 * "68' 0\"", "68'0\"", "68'-6\"", "40-5", "40.5", "40'", "40", "12.35m", "12.35"
 * into a normalized numeric value (feet or metres) and normalized representation.
 */
export function parseDimension(rawInput: string | number | undefined, unit: DimensionUnit = 'Feet'): DimensionValue {
  if (rawInput === undefined || rawInput === null) {
    return { raw: '', normalized: 0, unit, display: "0'-0\"" };
  }
  if (typeof rawInput === 'number') {
    return {
      raw: String(rawInput),
      normalized: Math.round(rawInput * 1000) / 1000,
      unit,
      display: `${rawInput}'-0"`,
    };
  }

  const trimmed = String(rawInput).trim();
  if (!trimmed) {
    return { raw: '', normalized: 0, unit, display: "0'-0\"" };
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
    const norm = !isNaN(parsedNum) ? Math.round(parsedNum * 1000) / 1000 : 0;
    return {
      raw: trimmed,
      normalized: norm,
      unit: 'Metres',
      display: `${norm} Mtrs`,
    };
  }

  // Unit is Feet:
  // Normalize unicode fractions first
  const cleanInput = trimmed.replace(/½/g, ' 1/2').replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4')
                            .replace(/⅛/g, ' 1/8').replace(/⅜/g, ' 3/8').replace(/⅝/g, ' 5/8').replace(/⅞/g, ' 7/8');

  // Pattern 1: Feet and Inches with prime / hyphen / ft separator and optional fraction:
  // e.g. 45'-011/2", 45'-01 1/2", 45'-111/2", 45'-01/2", 45'-1 1/2", 68'-0", 68'-6", 45-011/2, 45'-011/2
  const ftInMatch = cleanInput.match(
    /^(\d+(?:\.\d+)?)\s*(?:['’′`]\s*[-‐‑–—]?|[-‐‑–—]|(?:ft|feet)\.?\s*[-‐‑–—]?)\s*(\d+(?:\s*\d+)?(?:\s*\/\s*\d+)?|\d+(?:\.\d+)?)\s*(?:["”″“]|''|in(?:ch(?:es)?)?)?$/i
  );
  if (ftInMatch) {
    const feet = parseFloat(ftInMatch[1]) || 0;
    const inchInfo = parseInchesWithFraction(ftInMatch[2]);
    const normalizedFeet = Math.round((feet + inchInfo.totalInches / 12) * 1000) / 1000;
    const display = `${feet}'-${inchInfo.displayInch}"`;
    return {
      raw: trimmed,
      normalized: normalizedFeet,
      unit: 'Feet',
      display,
    };
  }

  // Pattern 2: Space-separated feet and inches with fraction: e.g. "45 011/2\"", "45 01 1/2\"", "68 6\""
  const spaceFtInMatch = cleanInput.match(
    /^(\d+(?:\.\d+)?)\s+(\d+(?:\s*\d+)?(?:\s*\/\s*\d+)?|\d+(?:\.\d+)?)\s*(?:["”″“]|''|in(?:ch(?:es)?)?)?$/i
  );
  if (spaceFtInMatch) {
    const feet = parseFloat(spaceFtInMatch[1]) || 0;
    const inchInfo = parseInchesWithFraction(spaceFtInMatch[2]);
    const normalizedFeet = Math.round((feet + inchInfo.totalInches / 12) * 1000) / 1000;
    const display = `${feet}'-${inchInfo.displayInch}"`;
    return {
      raw: trimmed,
      normalized: normalizedFeet,
      unit: 'Feet',
      display,
    };
  }

  // Pattern 3: Feet only with fraction: e.g. "45 1/2'"
  const ftFracMatch = cleanInput.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(?:['’′`]|ft|feet)?$/i);
  if (ftFracMatch && detectedUnit === 'Feet') {
    const whole = parseFloat(ftFracMatch[1]) || 0;
    const num = parseFloat(ftFracMatch[2]) || 0;
    const denom = parseFloat(ftFracMatch[3]) || 1;
    const totalFt = Math.round((whole + num / denom) * 1000) / 1000;
    const remInches = Math.round((totalFt - whole) * 12);
    return {
      raw: trimmed,
      normalized: totalFt,
      unit: 'Feet',
      display: remInches > 0 ? `${whole}'-${remInches}"` : `${whole}'-0"`,
    };
  }

  // Pattern 4: Feet only with prime / ft / feet / trailing dash:
  // e.g. "68'", "68 ft", "68 feet", "68.5'", "68'-", "68''"
  const ftOnlyMatch = cleanInput.match(/^(\d+(?:\.\d+)?)\s*(?:['’′`]|ft|feet|["”″“]|'')?\s*[-‐‑–—]?$/i);
  if (ftOnlyMatch && detectedUnit === 'Feet') {
    const feet = parseFloat(ftOnlyMatch[1]) || 0;
    return {
      raw: trimmed,
      normalized: Math.round(feet * 1000) / 1000,
      unit: 'Feet',
      display: `${feet}'-0"`,
    };
  }

  // Pattern 5: Special Feet and Inches with dot separator: e.g. "68.6" -> "68'-6\""
  const dotFtInMatch = cleanInput.match(/^(\d+)\.(\d+)$/);
  if (dotFtInMatch && detectedUnit === 'Feet') {
    const feet = parseFloat(dotFtInMatch[1]) || 0;
    const inches = parseFloat(dotFtInMatch[2]) || 0;
    const normalizedFeet = feet + inches / 12;
    return {
      raw: `${feet}'-${inches}"`,
      normalized: Math.round(normalizedFeet * 1000) / 1000,
      unit: 'Feet',
      display: `${feet}'-${inches}"`,
    };
  }

  // Pattern 6: Pure decimal or integer number: e.g. "68", "68.5", "68.0"
  const parsedNum = parseFloat(cleanInput);
  if (!isNaN(parsedNum)) {
    return {
      raw: trimmed,
      normalized: Math.round(parsedNum * 1000) / 1000,
      unit: detectedUnit,
      display: `${Math.round(parsedNum * 1000) / 1000}'-0"`,
    };
  }

  return {
    raw: trimmed,
    normalized: 0,
    unit: detectedUnit,
    display: trimmed,
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
 * If raw or display exists with fraction, preserves clean fraction representation.
 */
export function formatDimensionDisplay(dim: DimensionValue, targetUnit?: DimensionUnit): string {
  const unit = targetUnit || dim.unit;
  if (!dim.normalized && !dim.raw) return '0';

  if (unit === 'Metres') {
    const meters = dim.unit === 'Feet' ? dim.normalized * 0.3048 : dim.normalized;
    return `${Math.round(meters * 100) / 100} Mtrs`;
  } else {
    // If display is already prepared and matches feet unit
    if (dim.display && unit === 'Feet') {
      return dim.display;
    }
    // If raw was a feet-inch string with fraction or prime/quotes, re-parse and display cleanly
    if (dim.raw && unit === 'Feet') {
      const parsed = parseDimension(dim.raw, 'Feet');
      if (parsed.display) {
        return parsed.display;
      }
    }
    const feetValue = dim.unit === 'Metres' ? dim.normalized / 0.3048 : dim.normalized;
    const feet = Math.floor(feetValue);
    const totalInches = (feetValue - feet) * 12;
    if (Math.round(totalInches * 100) / 100 === 0) {
      return `${feet}'-0"`;
    }
    const inchStr = formatFractionInches(totalInches);
    return `${feet}'-${inchStr}"`;
  }
}

/**
 * Converts a dimension value between units.
 */
export function convertDimension(dim: DimensionValue, targetUnit: DimensionUnit): DimensionValue {
  if (dim.unit === targetUnit) return dim;

  const feetValue = dim.unit === 'Feet' ? dim.normalized : dim.normalized / 0.3048;
  const metersValue = feetValue * 0.3048;

  if (targetUnit === 'Feet') {
    return {
      raw: formatDimensionDisplay({ normalized: feetValue, unit: 'Feet', raw: '' }),
      normalized: Math.round(feetValue * 1000) / 1000,
      unit: 'Feet',
    };
  } else {
    // Target Metres
    return {
      raw: `${Math.round(metersValue * 100) / 100}`,
      normalized: Math.round(metersValue * 100) / 100,
      unit: 'Metres',
    };
  }
}

/**

 * Extracts road width from a boundary string like "30'-0\" Wide Road", "40 Ft Road", "33' Road", "9 Mtrs Road", etc.
 * Ignores House numbers (H.No.), Door numbers, Plot numbers, Survey numbers, and non-road boundaries.
 */
export function extractRoadWidthFromBoundary(boundaryText?: string): string {
  if (!boundaryText) return '';
  const text = boundaryText.trim();
  if (!text) return '';

  // 1. If text does not contain road keywords or width/wide, check if the text itself is solely a dimension (e.g. "30'-0\"" or "40 Ft" or "45'-11½\"")
  const hasRoadKeyword = /\b(road|rasta|street|lane|way|passage|galli|sandhu|bypass|highway|wide|width|cc\s*road|bt\s*road)\b/i.test(text);
  const isPureDimension = /^\s*(\d+(?:\.\d+)?)\s*(?:['’′`]\s*[-‐‑–—]?\s*([0-9½¼¾⅛⅜⅝⅞]+(?:\s*[0-9½¼¾⅛⅜⅝⅞]+)?(?:\s*\/\s*\d+)?|\d+(?:\.\d+)?)\s*["”″“]?|(?:['’′`]|ft\.?|feet|mtrs?|meters?|m\b))\s*$/i.test(text);

  if (!hasRoadKeyword && !isPureDimension) {
    // Definitely not a road boundary (e.g. "H.No.9-7-Ga0008 of Vemula Shekar", "Open plot no.26 of others")
    return '';
  }

  // 2. Remove house number / plot number / survey number patterns so door/plot numbers don't get misidentified as road width
  // e.g. "H.No. 9-7-Ga0008", "Door No. 12-4", "Plot No. 24", "Sy.No. 45/A"
  const sanitized = text
    .replace(/(?:h\.?no\.?|house\s*no\.?|door\s*no\.?|d\.?no\.?)\s*[:.-]?\s*[a-zA-Z0-9/_-]+/gi, ' ')
    .replace(/(?:plot\s*no\.?|p\.?no\.?|sy\.?no\.?|survey\s*no\.?)\s*[:.-]?\s*[a-zA-Z0-9/_-]+/gi, ' ');

  // Pattern 1: Explicit Feet & Inches with prime or quotes (supports fractions like 11½, 0½, ½, 011/2):
  // e.g. 45'-11½" Wide Road, 45'-0½" Road, 45'-½" Road, 30'-0" Wide Road, 30' 0" Road, 40'-6", 21'-0" Road
  const ftInMatch = sanitized.match(
    /(\d+(?:\.\d+)?)\s*(?:['’′`]\s*[-‐‑–—]?|[-‐‑–—])\s*([0-9½¼¾⅛⅜⅝⅞]+(?:\s*[0-9½¼¾⅛⅜⅝⅞]+)?(?:\s*\/\s*\d+)?|\d+(?:\.\d+)?)\s*(?:["”″“]|''|in(?:ch(?:es)?)?)?/i
  );
  if (ftInMatch) {
    const parsed = parseDimension(`${ftInMatch[1]}'-${ftInMatch[2]}"`, 'Feet');
    return parsed.display || `${ftInMatch[1]}'-${ftInMatch[2]}"`;
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
 * Checks if a boundary name represents a road.
 */
export function isRoadSegment(name?: string): boolean {
  if (!name) return false;
  return /\b(road|rasta|street|lane|way|passage|galli|sandhu|bypass|highway)\b|రోడ్డు|రస్తా|వీధి|సందు|దారి/i.test(name.trim());
}

/**
 * Sanitizes boundary text so that if it is a ROAD boundary,
 * any segment dimensions like (34') & (34') or (34') are removed,
 * ensuring ONLY ROAD is shown without entered dimensions and without brackets.
 */
export function sanitizeRoadBoundaryString(boundaryStr?: string): string {
  if (!boundaryStr) return '';
  let str = boundaryStr.trim();

  // 1. "ROAD (34') & (34')" or "ROAD (34') & ROAD (34')" or "ROAD (...) & (...)" -> "ROAD"
  str = str.replace(/\b(ROAD|RASTA|STREET|LANE|WAY|PASSAGE|HIGHWAY)\s*\([^)]*\)\s*&\s*(?:\1\s*)?\([^)]*\)/gi, '$1');

  // 2. "... & ROAD (34')" -> "... & ROAD"
  str = str.replace(/(&\s*)(ROAD|RASTA|STREET|LANE|WAY|PASSAGE|HIGHWAY)\s*\([^)]*\)/gi, '$1$2');

  // 3. "ROAD (34') & ..." -> "ROAD & ..."
  str = str.replace(/\b(ROAD|RASTA|STREET|LANE|WAY|PASSAGE|HIGHWAY)\s*\([^)]*\)(\s*&)/gi, '$1$2');

  // 4. Pure "ROAD (34')" -> "ROAD"
  str = str.replace(/^\s*(ROAD|RASTA|STREET|LANE|WAY|PASSAGE|HIGHWAY)\s*\([^)]*\)\s*$/gi, '$1');

  return str;
}

/**
 * Formats boundary text from 2 segments.
 * When either or both segments represent ROAD, displays ONLY ROAD without entered dimensions and without brackets.
 */
export function formatSegmentBoundaryText(
  seg0?: { name?: string; dimension?: string },
  seg1?: { name?: string; dimension?: string }
): string {
  const n0 = (seg0?.name || '').trim();
  const n1 = (seg1?.name || '').trim();
  const d0 = (seg0?.dimension || '').trim();
  const d1 = (seg1?.dimension || '').trim();

  const isRoad0 = isRoadSegment(n0);
  const isRoad1 = isRoadSegment(n1);

  // If BOTH are road, OR one is road and the other is empty or road:
  if ((isRoad0 && isRoad1) || (isRoad0 && !n1) || (isRoad1 && !n0)) {
    // Pure road side - user requirement: ONLY ROAD, without entered dimensions, without any brackets!
    const roadName = isRoad0 ? n0 : n1;
    const cleanRoadName = roadName.replace(/\s*\([^)]*\)/g, '').trim() || 'ROAD';
    return cleanRoadName.toUpperCase();
  }

  // Format non-road or mixed segments
  const formatPiece = (name: string, dim: string, isRoad: boolean): string => {
    if (!name && !dim) return '';
    if (!name) return dim ? `(${dim})` : '';
    if (isRoad) {
      // User requirement: For road, ONLY ROAD should come, NO entered dimension and NO brackets!
      const cleanRoad = name.replace(/\s*\([^)]*\)/g, '').trim() || 'ROAD';
      return cleanRoad.toUpperCase();
    }
    // Non-road property:
    const cleanName = name.trim();
    if (dim) {
      if (/\([^)]+\)$/.test(cleanName)) {
        return cleanName.toUpperCase();
      }
      return `${cleanName.toUpperCase()} (${dim})`;
    }
    return cleanName.toUpperCase();
  };

  const p0 = formatPiece(n0, d0, isRoad0);
  const p1 = formatPiece(n1, d1, isRoad1);

  if (p0 && p1) {
    return `${p0} & ${p1}`;
  }
  return p0 || p1 || '';
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
    dimensionUnit?: DimensionUnit;
    northSegments?: Array<{ name: string; dimension: string }>;
    southSegments?: Array<{ name: string; dimension: string }>;
    eastSegments?: Array<{ name: string; dimension: string }>;
    westSegments?: Array<{ name: string; dimension: string }>;
  }
): string {
  const rawBoundaryText = (
    side === 'North' ? boundaries.northBoundary :
    side === 'South' ? boundaries.southBoundary :
    side === 'East' ? boundaries.eastBoundary :
    boundaries.westBoundary
  )?.trim() || '';

  // Clean any dimensions or brackets like ROAD (34') & (34')
  const cleanBoundary = sanitizeRoadBoundaryString(rawBoundaryText);
  const isMeters = boundaries.dimensionUnit === 'Metres';

  // If the user has entered boundary text for this side:
  if (cleanBoundary) {
    const isRoadKeywordPresent = /\b(road|rasta|street|lane|way|passage|galli|sandhu|bypass|highway)\b/i.test(cleanBoundary);
    
    // 1. If user explicitly wrote the road description
    if (isRoadKeywordPresent) {
      if (isMeters) {
        let converted = cleanBoundary.replace(/(\d+(?:\.\d+)?)\s*(?:['’′`]|ft\.?|feet)/gi, (match, p1) => {
          const ft = parseFloat(p1);
          const m = Math.round(ft * 0.3048 * 100) / 100;
          return `${m} Mtrs`;
        });
        return converted.toUpperCase();
      }
      return cleanBoundary.toUpperCase();
    }

    // 2. If user entered only a dimension
    const extractedWidth = extractRoadWidthFromBoundary(cleanBoundary);
    if (extractedWidth) {
      if (isMeters) {
        const parsed = parseDimension(extractedWidth, 'Feet');
        const m = Math.round(parsed.normalized * 0.3048 * 100) / 100;
        return `${m} Mtrs WIDE ROAD`;
      }
      return `${extractedWidth} WIDE ROAD`;
    }

    // 3. User entered any custom text / name for this boundary side
    return cleanBoundary.toUpperCase();
  }

  // If boundary text is empty for this side:
  if (boundaries.roadWidth && boundaries.roadWidth.trim()) {
    const customWidth = boundaries.roadWidth.trim();
    if (
      customWidth.toUpperCase() !== '33\'-0"' &&
      customWidth.toUpperCase() !== '30\'-0"' &&
      customWidth.toUpperCase() !== '33\'-0" WIDE ROAD' &&
      customWidth.toUpperCase() !== '30\'-0" WIDE ROAD'
    ) {
      if (isMeters) {
        const parsed = parseDimension(customWidth, 'Feet');
        const m = Math.round(parsed.normalized * 0.3048 * 100) / 100;
        return `${m} Mtrs WIDE ROAD`;
      }
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
    plinthBreakdown?: { structureType: string; plinthSqFt: string }[];
    hasMultipleHouses?: boolean;
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

  let houseBuildingDesc = '';
  if (activeHouses.length > 1) {
    const structNames = activeHouses
      .map(h => (h.structureType?.trim() || 'R.C.C. Building').replace(/\s+with\s+open\s+place$/i, '').trim())
      .filter(Boolean);
    if (structNames.length === 2) {
      houseBuildingDesc = `${structNames[0]} and ${structNames[1]} with open place`;
    } else if (structNames.length > 2) {
      houseBuildingDesc = `${structNames.slice(0, -1).join(', ')} and ${structNames[structNames.length - 1]} with open place`;
    } else {
      houseBuildingDesc = `${structNames[0] || 'R.C.C. Building'} with open place`;
    }
  } else {
    const rawStruct = primaryHouse?.structureType?.trim() || 'R.C.C. Building';
    if (rawStruct.toLowerCase().includes('with open place')) {
      houseBuildingDesc = rawStruct;
    } else {
      houseBuildingDesc = `${rawStruct} with open place`;
    }
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
  const plinthBreakdown: { structureType: string; plinthSqFt: string }[] = [];

  if (isHouse || activeHouses.length > 0) {
    if (activeHouses.length > 1) {
      const items = activeHouses.map((h, idx) => {
        const typeName = (h.structureType?.trim() || h.plinthPrefix?.trim() || `Structure ${idx + 1}`)
          .replace(/\s+with\s+open\s+place$/i, '')
          .trim();
        const v = typeof h.plinthAreaSqFt === 'number' ? h.plinthAreaSqFt : (parseFloat(String(h.plinthAreaSqFt)) || 0);
        const sqFtStr = v > 0 ? v.toFixed(2) : (String(h.plinthAreaSqFt || '').trim() || '0.00');
        return {
          structureType: typeName,
          plinthSqFt: sqFtStr,
          text: `${typeName.toUpperCase()}: ${sqFtStr} SQ.FT`,
        };
      });

      items.forEach(i => plinthBreakdown.push({ structureType: i.structureType, plinthSqFt: i.plinthSqFt }));

      const totalSqFt = activeHouses.reduce((sum, h) => {
        const v = typeof h.plinthAreaSqFt === 'number' ? h.plinthAreaSqFt : (parseFloat(String(h.plinthAreaSqFt)) || 0);
        return sum + v;
      }, 0);
      plinthSqFt = totalSqFt.toFixed(2);

      let breakdownText = '';
      if (items.length === 2) {
        breakdownText = `${items[0].text} AND ${items[1].text}`;
      } else {
        breakdownText = `${items.slice(0, -1).map(i => i.text).join(', ')} AND ${items[items.length - 1].text}`;
      }

      plinthPart = `having plinth area of ${breakdownText} (total plinth area: ${plinthSqFt} sq.ft)`;
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
  const isTeluguLang = doc.boundaries.documentLanguage === 'te';

  if (isPlot) {
    // Open Plot identification logic
    const tmpl = p.locationTemplateType || (
      nearHNo.toUpperCase().startsWith('NEAR/ADJACENT') || nearHNo.includes('సమీపమున') ? 'near_adjacent_hno' :
      nearHNo.toUpperCase().startsWith('ADJACENT') || nearHNo.includes('ఆనుకొని') ? 'adjacent_hno' :
      nearHNo.toUpperCase().startsWith('OPP') || nearHNo.includes('ఎదురుగా') ? 'opp_hno' :
      nearHNo.toUpperCase().startsWith('BESIDE') || nearHNo.includes('పక్కన') ? 'beside_hno' :
      'near_hno'
    );
    const rawH = p.houseNo && p.houseNo.trim() ? p.houseNo.trim() : nearHNo;
    const hClean = rawH.replace(/^(NEAR\/ADJACENT|NEAR|ADJACENT|OPP\.?|BESIDE|BEARING|H\.NO\.?|సమీపమున\/ఆనుకొని ఉన్న|సమీపమున|ఆనుకొని ఉన్న|ఆనుకొని|ఎదురుగా ఉన్న|ఎదురుగా|పక్కన ఉన్న|పక్కన|ఇంటి\s*నం\.?|\s)+/gi, '').trim();

    if (hClean) {
      if (tmpl === 'near_adjacent_hno') {
        nearHNo = isTeluguLang ? `సమీపమున/ఆనుకొని ఉన్న ఇంటి నం. ${hClean}` : `NEAR/ADJACENT H.NO. ${hClean}`;
      } else if (tmpl === 'near_hno') {
        nearHNo = isTeluguLang ? `సమీప ఇంటి నం. ${hClean}` : `NEAR H.NO. ${hClean}`;
      } else if (tmpl === 'adjacent_hno') {
        nearHNo = isTeluguLang ? `ఆనుకొని ఉన్న ఇంటి నం. ${hClean}` : `ADJACENT H.NO. ${hClean}`;
      } else if (tmpl === 'opp_hno') {
        nearHNo = isTeluguLang ? `ఎదురుగా ఉన్న ఇంటి నం. ${hClean}` : `OPP. H.NO. ${hClean}`;
      } else if (tmpl === 'beside_hno') {
        nearHNo = isTeluguLang ? `పక్కన ఉన్న ఇంటి నం. ${hClean}` : `BESIDE H.NO. ${hClean}`;
      } else {
        nearHNo = isTeluguLang ? `సమీప ఇంటి నం. ${hClean}` : `NEAR H.NO. ${hClean}`;
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

    if ((isHouse || activeHouses.length > 0) && plinthPart) {
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

  const isTelugu = doc.boundaries.documentLanguage === 'te';

  let teluguDescription = '';
  if (isTelugu) {
    const vText = vilClean ? `${vilClean} గ్రామం` : '';
    const mText = mandalClean ? `${mandalClean} మండలం` : '';
    const dText = distClean ? `${distClean} జిల్లా` : '';
    const locText = locClean ? `'${locClean}' ప్రాంతంలో గల` : '';
    
    let locationPrefix = [vText, mText, dText].filter(Boolean).join(', ');
    if (locationPrefix) {
      locationPrefix = `${locationPrefix} పరిధిలోని ${locText}`;
    } else if (locText) {
      locationPrefix = `${locText}`;
    }

    let plotSurveyStr = '';
    if (plotNo && surveyNo) {
      plotSurveyStr = `ప్లాట్ నంబర్ ${plotNo} మరియు సర్వే నంబర్ ${surveyNo} నందు ఉన్న`;
    } else if (plotNo) {
      plotSurveyStr = `ప్లాట్ నంబర్ ${plotNo} నందు ఉన్న`;
    } else if (surveyNo) {
      plotSurveyStr = `సర్వే నంబర్ ${surveyNo} నందు ఉన్న`;
    } else if (isPlot) {
      plotSurveyStr = `ఓపెన్ ప్లాట్ నందు ఉన్న`;
    }

    let buildingStr = '';
    if (isHouseLike) {
      const authStr = authority ? authority : 'మున్సిపల్ కౌన్సిల్ ఇంటి నంబర్';
      const hNoStr = rawHNo ? ` ${rawHNo}` : '';
      const structName = primaryHouse?.structureType ? primaryHouse.structureType : 'ఆర్.సి.సి. భవనము';
      buildingStr = `${authStr}${hNoStr} కలిగి ఉన్న ${structName} మరియు ఖాళీ స్థలము`;
    } else if (isPlot) {
      buildingStr = `ఖాళీ స్థలము`;
    } else {
      buildingStr = `${propType} మరియు ఖాళీ స్థలము`;
    }

    let areaStr = '';
    if (areaYardsFormatted && areaMtrsFormatted) {
      areaStr = `మొత్తం విస్తీర్ణము ${areaYardsFormatted} చదరపు గజములు, అనగా ${areaMtrsFormatted} చదరపు మీటర్లు`;
    } else if (areaYardsFormatted) {
      areaStr = `మొత్తం విస్తీర్ణము ${areaYardsFormatted} చదరపు గజములు`;
    }

    let plinthStr = '';
    if (plinthSqFt && plinthSqFt !== '0' && plinthSqFt !== '0.00') {
      plinthStr = `మరియు భవనము యొక్క ప్లింత్ ఏరియా ${plinthSqFt} చదరపు అడుగులు`;
    }

    const sentenceParts = [locationPrefix, plotSurveyStr, buildingStr, areaStr, plinthStr].filter(Boolean);
    teluguDescription = `${sentenceParts.join(' ')} కలిగి ఉన్న ఆస్తి.`;
  }

  const formatPartyTelugu = (parties: PartyDetails[], defaultRole: string) => {
    if (!parties || parties.length === 0 || !parties[0].name.trim()) return `[${defaultRole} వివరాలు నమోదు కాలేదు]`;
    
    return parties.map((party, index) => {
      const parts: string[] = [];
      const prefix = parties.length > 1 ? `${index + 1}) ` : '';
      parts.push(prefix + party.name.trim());
      if (party.relativeName.trim()) {
        const rel = party.relation?.toLowerCase() === 'w/o' ? 'భర్త పేరు' : 'తండ్రి పేరు';
        parts.push(`${rel} ${party.relativeName.trim()}`);
      }
      if (party.age.trim()) {
        parts.push(`వయస్సు ${party.age.trim()} సంవత్సరములు`);
      }
      if (party.occupation.trim()) {
        parts.push(`వృత్తి: ${party.occupation.trim()}`);
      }
      if (party.address.trim()) {
        const addr = party.address.trim();
        parts.push(addr.startsWith('నివాసము') ? addr : `నివాసము: ${addr}`);
      }
      return parts.join(', ');
    }).join('\n');
  };

  return {
    title: isTelugu ? 'ప్లాన్ ఫర్ రిజిస్ట్రేషన్ (PLAN FOR REGISTRATION)' : 'PLAN FOR REGISTRATION',
    propertyDescription: isTelugu ? teluguDescription : propertyDescription,
    executantText: isTelugu ? formatPartyTelugu(doc.executant, 'EXECUTANT') : formatParty(doc.executant, 'EXECUTANT'),
    claimantText: isTelugu ? formatPartyTelugu(doc.claimant, 'CLAIMANT') : formatParty(doc.claimant, 'CLAIMANT'),
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
      plinthBreakdown,
      hasMultipleHouses: activeHouses.length > 1,
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
