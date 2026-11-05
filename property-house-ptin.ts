export type PropertyHousePtinPair = {
  id: string;
  houseNo: string;
  ptin: string;
};

let pairSequence = 0;
export const newPropertyHousePtinPair = (): PropertyHousePtinPair => ({
  id: `house-ptin-${Date.now()}-${pairSequence++}`,
  houseNo: '',
  ptin: '',
});

const cleanPart = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

/** Parse the schedule-scoped repeatable pair field. null means legacy/invalid data. */
export function parsePropertyHousePtinPairs(value: string): PropertyHousePtinPair[] | null {
  if (!value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(row => row && typeof row === 'object').map((row: any, index) => ({
      id: cleanPart(row.id) || `imported-${index + 1}`,
      houseNo: cleanPart(row.houseNo),
      ptin: cleanPart(row.ptin),
    }));
  } catch {
    return null;
  }
}

export function propertyHousePtinPairsForEditor(
  value: string,
  legacyHouseNo = '',
  legacyPtin = '',
): PropertyHousePtinPair[] {
  const saved = parsePropertyHousePtinPairs(value);
  if (saved) return saved.length ? saved : [{ id: 'empty-house-ptin-row', houseNo: '', ptin: '' }];
  if (legacyHouseNo.trim() || legacyPtin.trim()) return [{
    id: 'legacy-house-ptin', houseNo: legacyHouseNo, ptin: legacyPtin,
  }];
  return [{ id: 'empty-house-ptin-row', houseNo: '', ptin: '' }];
}

export function serializePropertyHousePtinPairs(rows: PropertyHousePtinPair[]): string {
  return JSON.stringify(rows.map(row => ({
    id: row.id,
    houseNo: row.houseNo,
    ptin: row.ptin,
  })));
}

/** Validate an extractor-provided JSON array, discarding wholly empty rows. */
export function canonicalPropertyHousePtinPairs(value: string): string | null {
  const parsed = parsePropertyHousePtinPairs(value);
  if (!parsed) return null;
  const populated = parsed.filter(row => row.houseNo || row.ptin).map((row, index) => ({
    id: row.id || `extracted-${index + 1}`,
    houseNo: row.houseNo,
    ptin: row.ptin,
  }));
  return populated.length ? serializePropertyHousePtinPairs(populated) : null;
}

/** Union repeated source reads without dropping distinct or conflicting pairs. */
export function mergePropertyHousePtinPairValues(values: string[]): string | null {
  const merged: PropertyHousePtinPair[] = [];
  const pairKeys = new Set<string>();
  for (const value of values) {
    const rows = parsePropertyHousePtinPairs(value);
    if (!rows) return null;
    for (const row of rows) {
      if (!row.houseNo && !row.ptin) continue;
      const key = `${row.houseNo.toLocaleLowerCase()}\u0000${row.ptin.toLocaleLowerCase()}`;
      if (pairKeys.has(key)) continue;
      pairKeys.add(key);
      merged.push({ ...row, id: `source-pair-${merged.length + 1}` });
    }
  }
  return serializePropertyHousePtinPairs(merged);
}

/** Map paired rows into the existing schedule placeholders in row order. */
export function propertyHousePtinOutput(
  value: string,
  legacyHouseNo = '',
  legacyPtin = '',
): { houseNos: string; ptins: string } {
  const parsed = parsePropertyHousePtinPairs(value);
  const rows = parsed === null
    ? (legacyHouseNo.trim() || legacyPtin.trim() ? [{ houseNo: legacyHouseNo.trim(), ptin: legacyPtin.trim() }] : [])
    : parsed;
  return {
    houseNos: rows.map(row => row.houseNo.trim()).filter(Boolean).join(', '),
    ptins: rows.filter(row => row.ptin.trim()).map(row => row.houseNo.trim()
      ? `${row.ptin.trim()} bearing H.No.${row.houseNo.trim()}`
      : row.ptin.trim()).join('; '),
  };
}

/** Resolve Step 2 identifiers without combining unrelated source records. Explicit
 * repeatable rows (including an intentionally empty list) remain authoritative. */
export function housePtinPairsForSources(property: Record<string, string>, records: { values: Record<string, string> }[]): string {
  if (parsePropertyHousePtinPairs(property.housePtinPairs || '') !== null) return property.housePtinPairs;
  const legacyHouseNo = ['Part open place', 'Demolished'].includes(property.category) ? property.nearHNo || property.bearingHNo || '' : property.bearingHNo || '';
  if (property.bltNo) return serializePropertyHousePtinPairs([{ id: 'legacy-property-pair', houseNo: legacyHouseNo, ptin: property.bltNo }]);
  const values: string[] = [];
  for (const { values: record } of records) {
    if (!['houseTax', 'assessment'].includes(record.linkOption || '')) continue;
    if (parsePropertyHousePtinPairs(record.housePtinPairs || '') !== null) values.push(record.housePtinPairs);
    else if (record.bearingHNo || record.bltNo || record.assessmentPtinNo) values.push(serializePropertyHousePtinPairs([{
      id: 'legacy-source-pair', houseNo: record.bearingHNo || '', ptin: record.bltNo || record.assessmentPtinNo || '',
    }]));
  }
  // A house number alone still belongs to its original schedule binding.
  if (!values.length) return '';
  // Avoid repeating a legacy scalar copied from the same supporting record.
  const rows = values.flatMap(value => parsePropertyHousePtinPairs(value) || []);
  const houseNo = legacyHouseNo;
  const ptin = property.bltNo || '';
  if ((houseNo || ptin) && !rows.some(row => (!houseNo || row.houseNo === houseNo) && (!ptin || row.ptin === ptin))) values.unshift(serializePropertyHousePtinPairs([{ id: 'legacy-property-pair', houseNo, ptin }]));
  return values.length ? mergePropertyHousePtinPairValues(values) || '' : '';
}
