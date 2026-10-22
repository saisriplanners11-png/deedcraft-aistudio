import { PARTY_CAPACITY_OPTIONS } from './fields';
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
    return [{ id: `${page}-${index}`, role: raw?.kind === 'authority' && ['principal', 'attorney'].includes(person.role) ? person.role : 'unknown', values: fields, principalNames: Array.isArray(person.principalNames) ? person.principalNames.filter((name: unknown) => typeof name === 'string' && name.trim()) : [], quote: person.quote.trim(), page, sourceName }];
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
    if (!existing?.executantPartyType) manual[`executant|${targetId}|executantPartyType`] = PARTY_CAPACITY_OPTIONS.find(p => p.startsWith('Principal'))!;
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

/** Apply a verified GPA as the exclusive source of executant identities. */
export function applyGpaExtraction(draft: Draft, authority: import('./sale-options').SaleAuthority, result: AuthorityExtraction): Draft {
  if (result.incomplete) throw new Error('Some GPA/AGPA pages could not be read. Existing executants were retained; retry extraction.');
  const collect = (role: 'principal' | 'attorney') => {
    const principals: AuthorityPerson[] = [];
    for (const person of result.people.filter(p => p.role === role && p.values.Name && p.quote)) {
      const match = principals.find(p => nameKey(p.values.Name) === nameKey(person.values.Name) && !['Aadhaar', 'Pan', 'Dob'].some(k => p.values[k] && person.values[k] && p.values[k] !== person.values[k]));
      if (match) {
        match.principalNames = [...new Set([...match.principalNames, ...person.principalNames])];
        for (const [key, value] of Object.entries(person.values)) {
          if (match.values[key] && match.values[key] !== value) throw new Error('Conflicting principal details. Existing executants were retained; review the GPA/AGPA.');
          match.values[key] = value;
        }
      } else principals.push({ ...person, values: { ...person.values } });
    }
    return principals;
  };
  const principals = collect('principal');
  const holders = collect('attorney');
  if (!principals.length) throw new Error('No verified GPA/AGPA principals found. Existing executants were retained.');
  const manual = Object.fromEntries(Object.entries(draft.manual).filter(([key]) => !key.startsWith('executant|')));
  const ids = principals.map((_, i) => i ? crypto.randomUUID() : 'primary');
  principals.forEach((person, i) => {
    for (const key of AUTHORITY_PERSON_FIELDS) manual['executant|' + ids[i] + '|executant' + key] = person.values[key] || '';
    manual['executant|' + ids[i] + '|executantPartyType'] = PARTY_CAPACITY_OPTIONS.find(p => p.startsWith('Principal'))!;
  });
  const state = appStateFor(draft);
  const previous = partyRecords(state, 'executant');
  const nextAuthority = { ...authority, attorneys: authority.attorneys.map(attorney => {
    const evidence = authority.extractions?.flatMap(e => e.people).find(p => p.id === attorney.extractedPersonId);
    const names = evidence?.principalNames || previous.filter((p, i) => attorney.principalIds.includes(i ? p.id : state.primaryExecutantId || 'primary')).map(p => p.values.executantName);
    return { ...attorney, principalIds: ids.filter((_, i) => names.some(name => name && nameKey(name) === nameKey(principals[i].values.Name))) };
  }) };
  if (holders.length) nextAuthority.attorneys = holders.map(holder => {
    const existing = authority.attorneys.find(attorney => nameKey(attorney.values.Name || '') === nameKey(holder.values.Name) && !['Aadhaar', 'Pan', 'Dob'].some(key => attorney.values[key] && holder.values[key] && attorney.values[key] !== holder.values[key]));
    return { id: existing?.id || crypto.randomUUID(), documents: existing?.documents, extractedPersonId: holder.id,
      values: Object.fromEntries(AUTHORITY_PERSON_FIELDS.map(key => [key, holder.values[key] || ''])),
      principalIds: ids.filter((_, index) => holder.principalNames.some(name => nameKey(name) === nameKey(principals[index].values.Name))) };
  });
  for (const key of ['documentNo', 'bookNumber', 'documentDate', 'sro', 'sroCode'] as const) nextAuthority[key] = result.details[key] || '';
  return { ...draft, manual, gpaExecutantsReplaced: true, saleAuthority: nextAuthority, vendorSharesBySchedule: {},
    templateFieldValues: Object.fromEntries(Object.entries(draft.templateFieldValues || {}).map(([key, values]) => [key, Object.fromEntries(Object.entries(values).filter(([record]) => !record.startsWith('executant:')))])),
    choices: Object.fromEntries(Object.entries(draft.choices).filter(([key]) => !key.startsWith('executant|'))),
    partyPeople: Object.fromEntries(Object.entries(draft.partyPeople || {}).filter(([key]) => !key.startsWith('executant'))), revision: draft.revision + 1 };
}
