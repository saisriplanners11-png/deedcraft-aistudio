import { localAuthorityName, type StructureDetail, type StructureDetails } from './fields';
import { moneyPaise } from './deed-money';

export const HOUSE_ROOFS = ['R.C.C.', 'Tin Shed', 'Tiled Roof', 'Compound Wall'];
export const isHouseCategory = (category: string) => ['Residential', 'Commercial'].includes(category);
export const isCompoundWall = (row: StructureDetail) => row.structureType === 'Compound Wall';
export const structureMeasurement = (row: StructureDetail) => isCompoundWall(row) ? row.runningFeet || '' : row.builtUpAreaSqFt;
export const structureUnit = (row: StructureDetail) => isCompoundWall(row) ? 'R.Fts.' : 'Sq. Ft.';

export function houseStructureRate(row: StructureDetail, authority: string, fallbackRoof = ''): string {
  if (row.rateOverride !== undefined) return row.rateOverride;
  const localBody = localAuthorityName(authority);
  const rural = localBody === 'Gram Panchayat';
  if (!rural && !['Municipal Corporation', 'Municipal Council'].includes(localBody)) return '';
  const roof = row.structureType || fallbackRoof;
  if (/^R\.C\.C\.(?: Building| Roof House)?$/i.test(roof)) return rural ? '1100' : '1350';
  if (/^(?:Tin Shed|Tiled Roof|Tiled House)$/i.test(roof)) return rural ? '750' : '900';
  return '';
}

export function houseStructurePaise(row: StructureDetail, authority: string, fallbackRoof = ''): bigint | null {
  const measurement = /^(\d+)(?:\.(\d*))?$/.exec(structureMeasurement(row).trim().replace(/,/g, ''));
  const rate = moneyPaise(houseStructureRate(row, authority, fallbackRoof));
  if (!measurement || rate === null) return null;
  const fraction = measurement[2] || '';
  const scale = 10n ** BigInt(fraction.length);
  return (BigInt(measurement[1] + fraction) * rate + scale / 2n) / scale;
}

export function structureAmount(paise: bigint): string {
  return `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`.replace(/\.00$/, '');
}

export function houseStructureTotal(details: StructureDetails | undefined, authority: string, fallbackRoof = ''): string {
  const amounts = details?.rows.map(row => houseStructurePaise(row, authority, fallbackRoof)).filter((value): value is bigint => value !== null) || [];
  return amounts.length ? structureAmount(amounts.reduce((sum, value) => sum + value, 0n)) : '';
}
