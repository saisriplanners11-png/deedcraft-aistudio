import { ageFrom, deedDate, partyRecords, scheduleRecords, vendeeShareCents, type AppState } from './logic';
import { flatStage } from './flat-options';

export const SALE_DOCUMENT_OPTIONS = [
  { id: 'ordinary', label: 'Ordinary Sale' },
  { id: 'gpa', label: 'Sale through GPA' },
  { id: 'agpa', label: 'Sale through AGPA' },
] as const;
export type SaleDocument = typeof SALE_DOCUMENT_OPTIONS[number]['id'];
export type AuthorityDocument = { id: string; name: string; dataUrl: string; size: number };
export type AuthorityPerson = { id: string; role: 'principal' | 'attorney' | 'unknown'; values: Record<string, string>; principalNames: string[]; quote: string; page: number; sourceName: string };
export type AuthorityExtraction = { incomplete?: boolean; id: string; documentIds: string[]; people: AuthorityPerson[]; details: Record<string, string>; notes: string[] };
export type SaleAttorney = { id: string; principalIds: string[]; extractedPersonId?: string; values: Record<string, string>; documents?: AuthorityDocument[] };
export type SaleAuthority = { documentNo: string; bookNumber?: string; documentDate: string; sro: string; sroCode: string; adjustedAmount: string; attorneys: SaleAttorney[]; documents?: AuthorityDocument[]; extractions?: AuthorityExtraction[] };
export const emptySaleAuthority = (): SaleAuthority => ({ documentNo: '', documentDate: '', sro: '', sroCode: '', adjustedAmount: '', attorneys: [] });
export const saleDocumentLabel = (mode: SaleDocument = 'ordinary') => SALE_DOCUMENT_OPTIONS.find(option => option.id === mode)?.label || 'Ordinary Sale';
export const saleDocumentForVariant = (variant = ''): SaleDocument => variant === 'sale-deed-by-gpa-holder' ? 'gpa' : variant === 'sale-through-existing-agpa' ? 'agpa' : 'ordinary';
export const saleVariant = (mode: SaleDocument) => mode === 'gpa' ? 'sale-deed-by-gpa-holder' : mode === 'agpa' ? 'sale-through-existing-agpa' : 'outright-absolute-sale-deed';

export function salePropertyErrors(state: AppState): string[] {
  return scheduleRecords(state).flatMap((record, index) => {
    if (!record.category) return [`Schedule ${index + 1}: choose the property type in Deed setup.`];
    const field = record.category === 'Flat' ? 'flatStage' : record.category === 'Residential' ? 'houseStage' : '';
    return field && !flatStage(record.values[field]) ? [`Schedule ${index + 1}: choose Finished or Semi-finished ${field === 'flatStage' ? 'Flat' : 'House'} in Deed setup.`] : [];
  });
}

export function authorityPartyValues(values: Record<string, string>, prefix: 'Principal' | 'Attorney'): Record<string, string> {
  const result: Record<string, string> = {};
  const suffixes: Record<string, string> = { Name: 'NAME', Age: 'Age', Dob: 'Dob', Occupation: 'Occupation', HNo: 'H.No.', Locality: 'Locality', Village: 'Village', Mandal: 'Mandal', District: 'District', State: 'State', PinCode: 'Pin Code', Aadhaar: 'Adhar Number', Mobile: 'Cell.No.', Pan: 'PAN' };
  for (const [field, tag] of Object.entries(suffixes)) result[`${prefix} ${tag}`] = field === 'Dob' ? deedDate(values[field] || '') : values[field] || '';
  result[`${prefix} Age`] = values.Age || ageFrom(values.Dob || '');
  result[`${prefix.toUpperCase()} RELATION NAME`] = [values.Relation, values.RelativeName].filter(Boolean).join(' ');
  return result;
}

export function saleAuthorityErrors(state: AppState): string[] {
  if (!state.saleDocument || state.saleDocument === 'ordinary') return [];
  const authority = state.saleAuthority || emptySaleAuthority();
  const errors: string[] = [];
  for (const key of ['documentNo', 'documentDate', 'sro', 'sroCode'] as const) if (!authority[key].trim()) errors.push(`Authority ${key === 'documentNo' ? 'document number' : key === 'documentDate' ? 'document date' : key === 'sro' ? 'Sub-Registrar Office' : 'SRO code'} is required.`);
  if (authority.documentDate && !/^\d{4}-\d{2}-\d{2}$/.test(authority.documentDate)) errors.push('Enter a valid authority document date.');
  if (state.saleDocument === 'agpa' && (!authority.adjustedAmount.trim() || !Number.isFinite(Number(authority.adjustedAmount)) || Number(authority.adjustedAmount) < 0)) errors.push('Enter the AGPA adjusted stamp-duty amount (zero is allowed).');
  const principals = partyRecords(state, 'executant').map((record, index) => ({ ...record, id: index ? record.id : state.primaryExecutantId || 'primary' }));
  if (!principals.length) errors.push('Add at least one principal in Executants.');
  const required: Record<string, string> = { Name: 'full name', Relation: 'relation', RelativeName: 'relative’s name', Dob: 'date of birth', Occupation: 'occupation', HNo: 'house number', Village: 'village', Mandal: 'mandal', District: 'district', State: 'state', PinCode: 'PIN code', Aadhaar: 'Aadhaar number' };
  for (const [index, principal] of principals.entries()) {
    const missing = Object.entries(required).filter(([key]) => !principal.values['executant' + key]?.trim()).map(([, label]) => label);
    if (missing.length) errors.push(`Principal ${index + 1}: enter ${missing.join(', ')} in Executants.`);
    if (!authority.attorneys.some(attorney => attorney.principalIds.includes(principal.id))) errors.push(`Assign an attorney to principal ${index + 1}.`);
  }
  if (!authority.attorneys.length) errors.push('Add at least one attorney.');
  for (const [index, attorney] of authority.attorneys.entries()) {
    if (attorney.values.SharePercentage?.trim() && vendeeShareCents(attorney.values.SharePercentage) === null) errors.push(`Attorney ${index + 1}: enter a share percentage greater than 0 and no more than 100, with up to two decimal places.`);
    const missing = Object.entries(required).filter(([key]) => !attorney.values[key]?.trim()).map(([, label]) => label);
    if (missing.length) errors.push(`Attorney ${index + 1}: enter ${missing.join(', ')}.`);
    if (!attorney.principalIds.length) errors.push(`Attorney ${index + 1}: select the represented principals.`);
    if (attorney.principalIds.some(id => !principals.some(principal => principal.id === id))) errors.push(`Attorney ${index + 1}: reassign the removed principal.`);
  }
  return errors;
}
