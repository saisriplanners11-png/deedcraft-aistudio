import { localAuthorityName, STRUCTURE_TYPE_OPTIONS, type StructureDetail, type StructureDetails } from './fields';
import { moneyPaise } from './deed-money';

export const HOUSE_ROOFS = ['R.C.C.', 'Bangalore Tiles', 'Tin Shed', 'Tiled Roof', 'Compound Wall'];
export const HOUSE_VALUATION_STAGES = [
  { value: 'Foundation', label: 'Upto Foundation', percent: 25 },
  { value: 'Upto Slab/Roof level', label: 'Upto Slab', percent: 65 },
  { value: 'Semi-Finished', label: 'Upto Finishing', percent: 85 },
  { value: 'Finished', label: 'Finished', percent: 100 },
];
export const STRUCTURE_VALUATION_OVERRIDE = 'structureValuationOverride';
export const isHouseCategory = (category: string) => ['Residential', 'Commercial'].includes(category);
export const isCompoundWall = (row: StructureDetail) => row.structureType === 'Compound Wall';
export const structureMeasurement = (row: StructureDetail) => isCompoundWall(row) ? row.runningFeet || '' : row.builtUpAreaSqFt;
export const structureUnit = (row: StructureDetail) => isCompoundWall(row) ? 'R.Fts.' : 'Sq. Ft.';

export function houseStructureRate(row: StructureDetail, authority: string, fallbackRoof = ''): string {
  if (row.rateOverride !== undefined) return row.rateOverride;
  const localBody = localAuthorityName(authority);
  const rural = localBody === 'Gram Panchayat';
  if (!rural && !['Municipal Corporation', 'Municipal Council', 'GHMC'].includes(localBody)) return '';
  const roof = (!row.structureType || STRUCTURE_TYPE_OPTIONS.includes(row.structureType)
    ? fallbackRoof
    : row.structureType === 'Other / Custom Structure' ? row.customStructureType || '' : row.structureType).trim();
  if (/^R\.?\s*C\.?\s*C\.?(?: Building| Roof(?: House)?)?$/i.test(roof)) return rural ? '1100' : '1350';
  if (/^(?:Tin Shed|Bangalore Tiles|Tiled Roof|Tiled House)$/i.test(roof)) return rural ? '750' : '900';
  return '';
}

export function houseValuationStage(value: string) {
  const stage = value?.trim().toLowerCase();
  return HOUSE_VALUATION_STAGES.find(option => option.value.toLowerCase() === stage || option.label.toLowerCase() === stage);
}

export function houseStagePercent(row: StructureDetail): number | null {
  // Older priced rows without a stage were valued at full cost.
  if (isCompoundWall(row) || !row.stage?.trim()) return 100;
  return houseValuationStage(row.stage)?.percent ?? null;
}

export function houseStageRate(row: StructureDetail, authority: string, fallbackRoof = ''): string {
  const rate = houseStructureRate(row, authority, fallbackRoof);
  const percent = houseStagePercent(row);
  return rate && percent !== null ? String(Number(rate) * percent / 100) : '';
}

export function houseStructurePaise(row: StructureDetail, authority: string, fallbackRoof = ''): bigint | null {
  const measurement = /^(\d+)(?:\.(\d*))?$/.exec(structureMeasurement(row).trim().replace(/,/g, ''));
  const rate = moneyPaise(houseStructureRate(row, authority, fallbackRoof));
  const percent = houseStagePercent(row);
  if (!measurement || rate === null || percent === null) return null;
  const fraction = measurement[2] || '';
  const scale = 100n * 10n ** BigInt(fraction.length);
  return (BigInt(measurement[1] + fraction) * rate * BigInt(percent) + scale / 2n) / scale;
}

export function structureAmount(paise: bigint): string {
  return `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`.replace(/\.00$/, '');
}

export function houseStructureTotal(details: StructureDetails | undefined, authority: string, fallbackRoof = ''): string {
  const amounts = details?.rows.map(row => houseStructurePaise(row, authority, fallbackRoof)).filter((value): value is bigint => value !== null) || [];
  return amounts.length ? structureAmount(amounts.reduce((sum, value) => sum + value, 0n)) : '';
}
