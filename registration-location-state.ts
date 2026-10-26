export const LOCATION_FIELDS = ['district', 'mandal', 'village', 'locality', 'registrationPropertyLocation', 'registrationUlbName', 'sro'] as const;
export type LocationField = typeof LOCATION_FIELDS[number];
export type LookupOption = { code: string; label: string; value?: string; ward?: string; block?: string; sroCode?: string };
export type JurisdictionLookupState = {
  codes?: Partial<Record<LocationField, string>>;
  labels?: Partial<Record<LocationField, string>>;
  needsReview?: LocationField[];
  manual?: LocationField[];
};
export const EMPTY_LOOKUP: JurisdictionLookupState = {};
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
export function dependentLocations(field: LocationField): LocationField[] {
  if (field === 'district') return LOCATION_FIELDS.slice(1);
  if (field === 'mandal') return LOCATION_FIELDS.slice(2);
  if (field === 'village') return LOCATION_FIELDS.slice(3);
  if (field === 'locality') return ['sro'];
  return [];
}
/** Names from uploads are matched only inside the currently selected parent. No writes on load. */
export function matchingOption(options: LookupOption[], value: string, field: LocationField, state: JurisdictionLookupState): LookupOption | undefined {
  if (!value || state.needsReview?.includes(field) || state.manual?.includes(field)) return undefined;
  const explicit = options.find(option => option.code === state.codes?.[field]);
  if (explicit && normalize(state.labels?.[field] || '') === normalize(value)
    && normalize(explicit.value || explicit.label) === normalize(value)) return explicit;
  const matches = options.filter(option => normalize(option.value || option.label) === normalize(value) || normalize(option.label) === normalize(value));
  // Even an older saved code is untrusted when its canonical name has changed.
  return matches.length === 1 ? matches[0] : undefined;
}
export function changeLocation(state: JurisdictionLookupState, field: LocationField, option?: LookupOption, manual = false): JurisdictionLookupState {
  const descendants = dependentLocations(field);
  const codes = { ...state.codes }; const labels = { ...state.labels };
  for (const id of [field, ...descendants]) { delete codes[id]; delete labels[id]; }
  if (option) { codes[field] = option.code; labels[field] = option.value || option.label; }
  const manualFields = (state.manual || []).filter(id => id !== field && !descendants.includes(id));
  if (manual) manualFields.push(field);
  return { codes, labels, manual: manualFields, needsReview: [...new Set([...(state.needsReview || []).filter(id => id !== field), ...descendants])] };
}
