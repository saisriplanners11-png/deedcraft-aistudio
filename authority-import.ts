import { appStateFor, resolveDraft, type Draft } from './source-draft';
import { partyRecords } from './logic';
import { emptySaleAuthority, type AuthorityExtraction, type AuthorityPerson } from './sale-options';

export const AUTHORITY_PERSON_FIELDS = ['Name', 'Relation', 'RelativeName', 'Dob', 'Age', 'Occupation', 'HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode', 'Aadhaar', 'Mobile', 'Pan'];
export const AUTHORITY_DETAIL_FIELDS = ['documentNo', 'bookNumber', 'documentDate', 'sro', 'sroCode', 'adjustedAmount'];
const nameKey = (name: string) => name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function cleanAuthorityRead(raw: any, sourceName: string, page: number): Omit<AuthorityExtraction, 'id' | 'documentIds'> {
  const notes: string[] = [];
  const values = (input: any, allowed: string[]) => Object.fromEntries(allowed.flatMap(key => {
    let value = typeof input?.[key] === 'string' ? input[key].trim() : '';
    if (['Dob', 'documentDate'].includes(key) && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) value = '';
    if (key === 'Aadhaar') { value = value.replace(/[\s-]/g, ''); if (value && !/^\d{12}$/.test(value)) value = ''; }
    if (key === 'Pan') { value = value.toUpperCase(); if (value && !/^[A-Z]{5}\d{4}[A-Z]$/.test(value)) value = ''; }
    if (key === 'adjustedAmount') { value = value.replace(/^(?:Rs\.?|₹)\s*/i, '').replace(/,/g, ''); if (!/^\d+(?:\.\d{1,2})?$/.test(value)) value = ''; }
    if (key === 'Age' && !/^(?:[1-9]\d?|1[01]\d|12[0-5])$/.test(value)) value = '';
    if (key === 'Relation') { value = value.toUpperCase(); if (!['S/O', 'W/O', 'D/O', 'C/O', 'REP. BY'].includes(value)) value = ''; }
    return value ? [[key, value]] : [];
  }));
  const people: AuthorityPerson[] = (Array.isArray(raw?.people) ? raw.people : []).flatMap((person: any, index: number) => {
    const fields = values(person?.values, AUTHORITY_PERSON_FIELDS);
    if (!fields.Name || typeof person.quote !== 'string' || !person.quote.trim()) return [];
    return [{ id: `${page}-${index}`, role: raw?.kind !== 'identity' && ['principal', 'attorney'].includes(person.role) ? person.role : 'unknown', values: fields, principalNames: Array.isArray(person.principalNames) ? person.principalNames.filter((name: unknown) => typeof name === 'string' && name.trim()) : [], quote: person.quote.trim(), page, sourceName }];
  });
  if (!people.length) notes.push(`${sourceName}, page ${page}: no clearly evidenced individual identities found.`);
  return { people, details: raw?.kind === 'authority' ? values(raw?.details, AUTHORITY_DETAIL_FIELDS) : {}, notes: [...notes, ...(Array.isArray(raw?.notes) ? raw.notes.filter((note: unknown) => typeof note === 'string') : [])] };
}

/** A deliberate selection fills blanks; it cannot mix two named identities. */
export function applyAuthorityPerson(draft: Draft, person: AuthorityPerson, role: 'principal' | 'attorney', targetId: string): Draft {
  const state = appStateFor(draft);
  const authority = draft.saleAuthority || emptySaleAuthority();
  const manual = { ...draft.manual };
  const resolved = resolveDraft(draft).values;
  const existing = role === 'principal'
    ? partyRecords(state, 'executant').find((record, index) => (index ? record.id : state.primaryExecutantId || 'primary') === targetId)?.values
    : authority.attorneys.find(attorney => attorney.id === targetId)?.values;
  const existingName = existing?.[role === 'principal' ? 'executantName' : 'Name'];
  if (existingName && nameKey(existingName) !== nameKey(person.values.Name)) throw new Error('This record already contains a different person. Choose a new record to keep their details separate.');
  for (const key of ['Aadhaar', 'Pan', 'Dob']) {
    const previous = existing?.[role === 'principal' ? 'executant' + key : key];
    if (previous && person.values[key] && nameKey(previous) !== nameKey(person.values[key])) throw new Error('This person has a different identity number or birth date in the selected record. Choose a new record or correct the existing details first.');
  }
  if (role === 'principal') {
    for (const key of AUTHORITY_PERSON_FIELDS) if (person.values[key] && !resolved[`executant|${targetId}|executant${key}`]) manual[`executant|${targetId}|executant${key}`] = person.values[key];
    if (!existing?.executantPartyType) manual[`executant|${targetId}|executantPartyType`] = 'Individual';
  }
  let attorneys = authority.attorneys;
  if (role === 'attorney') {
    const current = attorneys.find(attorney => attorney.id === targetId);
    const fields = { ...current?.values };
    for (const key of AUTHORITY_PERSON_FIELDS) if (person.values[key] && !fields[key]) fields[key] = person.values[key];
    const updated = { ...current, id: targetId, values: fields, principalIds: current?.principalIds || [], extractedPersonId: person.id };
    attorneys = current ? attorneys.map(attorney => attorney.id === targetId ? updated : attorney) : [...attorneys, updated];
  }
  const next = { ...draft, manual, saleAuthority: { ...authority, attorneys }, revision: draft.revision + 1 };
  const principals = partyRecords(appStateFor(next), 'executant');
  next.saleAuthority.attorneys = attorneys.map(attorney => {
    const evidence = authority.extractions?.flatMap(extraction => extraction.people).find(candidate => candidate.id === attorney.extractedPersonId);
    const linked = principals.flatMap((principal, index) => evidence?.principalNames.some(name => nameKey(name) === nameKey(principal.values.executantName || '')) ? [index ? principal.id : state.primaryExecutantId || 'primary'] : []);
    return { ...attorney, principalIds: [...new Set([...attorney.principalIds, ...linked])] };
  });
  return next;
}
