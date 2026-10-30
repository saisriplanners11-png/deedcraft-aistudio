import offices from './sro-directory.json';

// Lookup data only, transcribed from the user's S.R.O CODES.xlsx (30-10-2026).
export const SRO_OFFICES = offices;
export const sroLabel = (office: { name: string; code: string }) => `${office.name} [${office.code}]`;
const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
export function findSro(value: string) {
  const key = normalized(value);
  const matches = offices.filter(office => [office.name, office.code, sroLabel(office)].some(candidate => normalized(candidate) === key));
  return matches.length === 1 ? matches[0] : undefined;
}
export const isSroField = (id: string) => /sro(?:code)?$/i.test(id);
export function sroFieldPair(id: string) {
  const name = id.replace(/Code$/i, '');
  return { name, code: name + 'Code' };
}
export const displaySro = (value: string) => { const office = findSro(value); return office ? sroLabel(office) : value; };
