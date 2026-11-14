import offices from './sro-directory.json';
import { titleCasePlaceName } from './place-names';

// Lookup data only, transcribed from the user's S.R.O CODES.xlsx (30-10-2026).
export const SRO_OFFICES = offices;
export const sroLabel = (office: { name: string; code: string }) => `${titleCasePlaceName(office.name)} [${office.code}]`;
const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
export function findSro(value: string) {
  const key = normalized(value);
  const matches = offices.filter(office => [office.name, office.code, sroLabel(office)].some(candidate => normalized(candidate) === key));
  return matches.length === 1 ? matches[0] : undefined;
}
// Jurisdiction uses its original manual office field. Linked records use the directory.
export const isSroField = (id: string) => id !== 'sro' && /sro(?:code)?$/i.test(id);
export function sroFieldPair(id: string) {
  const name = id.replace(/Code$/i, '');
  return { name, code: name + 'Code' };
}
export const displaySro = (value: string) => { const office = value === value.trim() ? findSro(value) : undefined; return office ? sroLabel(office) : value; };

/** Resolve one combined selector value into the existing separate name/code fields. */
export function resolveSroSelection(id: string, value: string) {
  if (!isSroField(id) || /Code$/i.test(id)) return null;
  const pair = sroFieldPair(id);
  const office = value === value.trim() ? findSro(value) : undefined;
  if (office) return { nameField: pair.name, name: office.name, codeField: pair.code, code: office.code };
  const customPair = value.trim().match(/^(.*?)\s*\[([^\]]+)\]$/);
  return {
    nameField: pair.name,
    name: titleCasePlaceName(customPair?.[1] ?? value, !customPair),
    codeField: pair.code,
    code: customPair?.[2].trim() ?? '',
  };
}
