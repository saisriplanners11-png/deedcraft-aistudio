const PLACE_NAME_FIELDS = new Set([
  'locality', 'village', 'mandal', 'sro', 'linkSro',
  'rectificationDeedSro', 'supplementalDeedSro',
  'developmentSro', 'supplementalSro',
  'localBodyName', 'permissionAuthorityName',
]);

const ACRONYMS = new Set(['AP', 'GHMC', 'GP', 'HMDA', 'MRO', 'NH', 'PIN', 'SRO', 'TS', 'ULB']);

/** Normalize only the requested property/place labels; source quotes stay untouched. */
export function titleCasePlaceName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[\p{L}\p{M}]+/gu, word => {
    const upper = word.toLocaleUpperCase('en-IN');
    if (ACRONYMS.has(upper)) return upper;
    return word.toLocaleLowerCase('en-IN').replace(/^\p{L}/u, first => first.toLocaleUpperCase('en-IN'));
  });
}

export function isPropertyPlaceNameField(field: string): boolean {
  return PLACE_NAME_FIELDS.has(field);
}

export function normalizePropertyPlaceName(field: string, value: string): string {
  return isPropertyPlaceNameField(field) ? titleCasePlaceName(value) : value;
}
