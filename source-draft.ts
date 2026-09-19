import { ALL_FIELDS, EMPTY_FORM } from './fields';
import { initialState, withDerived, type AppState, type ValueRecord } from './logic';
import type { PlanDrawing } from './registration-plan';
import { newPayment, type Payment } from './payments';
import { definitionFor, instrumentIdForLegacyType, type InstrumentId } from './instruments';

export const EXTRACTION_VERSION = 'evidence-v9-full-document-verification';
export type Role = 'property' | 'executant' | 'claimant' | 'payment' | 'link' | 'unassigned';
export type Candidate = {
  id: string; field: string; value: string; role: Role; record: string;
  quote: string; page: number; region: string; handwritten: boolean;
  status: 'accepted' | 'uncertain'; historical: boolean;
};
export type SourcePlan = { record: string; drawing: PlanDrawing; linked: boolean; page: number };
export type SourceResult = {
  candidates: Candidate[]; plans: SourcePlan[]; notes: string[];
  /** Browser-side timings make slow source pages visible without logging evidence. */
  timing?: { totalMs: number; pagesMs: Record<string, number> };
};
export type Source = {
  id: string; revision: number; name: string; hash: string; status: 'queued' | 'reading' | 'done' | 'error';
  /**
   * `fromRecord` scopes the assignment to the one AI-provided record identifier
   * the user actually confirmed (e.g. one person's name on a page that shows
   * several). Omitted, it applies to every unassigned candidate in the source —
   * correct for the common single-person document, but a composite scan with
   * several unassigned people needs one assignment per person, made one at a
   * time; assigning a second person from the same source replaces the first.
   */
  assignment?: { role: Role; record: string; fromRecord?: string; /** Property schedule this source bundle may populate. */ propertyRecord?: string };
  result?: SourceResult; error?: string; durationMs?: number;
};
export type Draft = {
  id: string; revision: number; sources: Source[];
  manual: Record<string, string>; choices: Record<string, string>;
  step: number; manualEdits: number;
  /** Explicitly created blank schedules, in addition to Property 1. */
  propertyIds: string[];
  /** The schedule currently receiving its own Step 2 document bundle. */
  activePropertyId: string;
  /** Link/supporting-document cards remain in the property bundle that created them. */
  linkPropertyRecords: Record<string, string>;
  /** Instrument identity is part of the draft snapshot and cannot be inferred from its fields. */
  instrumentId: InstrumentId;
  variantId: string;
  definitionVersion: string;
};
const draftId = () => globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const newDraft = (): Draft => ({ id: draftId(), revision: 0, sources: [], manual: {}, choices: {}, step: 0, manualEdits: 0, propertyIds: [], activePropertyId: 'primary', linkPropertyRecords: {}, instrumentId: 'sale', variantId: definitionFor('sale').variants[0].id, definitionVersion: definitionFor('sale').version });
export type Action =
  | { type: 'reset' }
  | { type: 'step'; step: number }
  | { type: 'add'; source: Source }
  | { type: 'replace'; id: string; name: string }
  | { type: 'remove'; id: string }
  | { type: 'unassign'; id: string }
  | { type: 'assign'; id: string; role: Role; record: string; fromRecord?: string }
  | { type: 'add-property'; id: string }
  | { type: 'active-property'; id: string }
  | { type: 'link-property'; record: string; propertyId: string }
  | { type: 'instrument'; instrumentId: InstrumentId; variantId?: string }
  | { type: 'manual'; key: string; value: string }
  | { type: 'choose'; key: string; candidateId: string }
  | { type: 'job'; draftId: string; sourceId: string; sourceRevision: number; patch: Partial<Source> };

export function draftReducer(draft: Draft, action: Action): Draft {
  if (action.type === 'reset') return newDraft();
  if (action.type === 'step') return { ...draft, step: action.step };
  let next = draft;
  if (action.type === 'add') next = { ...draft, sources: [...draft.sources, action.source] };
  if (action.type === 'remove') next = { ...draft, sources: draft.sources.filter(s => s.id !== action.id) };
  if (action.type === 'replace') next = { ...draft, sources: draft.sources.map(s => s.id === action.id ? { id: s.id, name: action.name, revision: s.revision + 1, hash: '', status: 'queued' } : s) };
  if (action.type === 'unassign') next = { ...draft, sources: draft.sources.map(s => s.id === action.id ? { ...s, assignment: undefined } : s) };
  if (action.type === 'assign') next = { ...draft, sources: draft.sources.map(s => s.id === action.id ? { ...s, assignment: { role: action.role, record: action.record, fromRecord: action.fromRecord } } : s) };
  if (action.type === 'add-property') next = { ...draft, propertyIds: draft.propertyIds.includes(action.id) || action.id === 'primary' ? draft.propertyIds : [...draft.propertyIds, action.id], activePropertyId: action.id };
  if (action.type === 'active-property') next = { ...draft, activePropertyId: action.id };
  if (action.type === 'link-property') next = { ...draft, linkPropertyRecords: { ...draft.linkPropertyRecords, [action.record]: action.propertyId } };
  if (action.type === 'instrument') {
    const definition = definitionFor(action.instrumentId);
    next = { ...draft, instrumentId: action.instrumentId, variantId: action.variantId || definition.variants[0].id, definitionVersion: definition.version };
  }
  if (action.type === 'manual') next = { ...draft, manual: { ...draft.manual, [action.key]: action.value }, manualEdits: draft.manualEdits + 1 };
  if (action.type === 'choose') {
    const manual = { ...draft.manual }; delete manual[action.key];
    next = { ...draft, manual, choices: { ...draft.choices, [action.key]: action.candidateId } };
  }
  if (action.type === 'job') {
    if (action.draftId !== draft.id || !draft.sources.some(s => s.id === action.sourceId && s.revision === action.sourceRevision)) return draft;
    next = { ...draft, sources: draft.sources.map(s => s.id === action.sourceId ? { ...s, ...action.patch, id: s.id, revision: s.revision } : s) };
  }
  return next === draft ? draft : { ...next, revision: draft.revision + 1 };
}

export const fieldKey = (role: Role, record: string, field: string) => `${role}|${record}|${field}`;
export type Evidence = Candidate & { sourceId: string; sourceName: string; sourceRevision: number };
const exact = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
/** Facts that describe a moment in time, not an identity — never trusted from a historical read. */
const CURRENT_STATE_ONLY = /Age$|Mobile$|Occupation$|^govtRate$|^consid$|^executionDate$|^stampValue$/;

/** A projection, never an incremental merge: deleting evidence deletes its values. */
export function resolveDraft(draft: Draft) {
  const groups: Record<string, Evidence[]> = {};
  const unassigned: Evidence[] = [];
  const all: Evidence[] = [];
  // A prior registered deed recites ITS OWN vendor and vendee, not the parties to
  // today's sale — the buyer of that earlier deed is usually today's seller, and
  // its seller is a stranger to this transaction. The model is asked to mark
  // that recital historical and re-attribute the roles, but does not reliably do
  // so (a plain VENDOR/VENDEE paragraph reads as straightforwardly current).
  // Any source that also yields link/title-deed evidence has its party
  // candidates held back as unassigned instead, so a name from a decade-old
  // deed can never silently become today's executant or claimant; the popup
  // lets the drafter confirm the real current parties from their own ID proof.
  // This only needs the source to be RECOGNIZABLE as a link deed, not for its
  // own registration particulars to have survived the separate two-read
  // agreement check — a noisy scan can easily fail that consensus on one field
  // while still being unmistakably a registered title deed, and this guard
  // must not depend on an unrelated extraction succeeding.
  const linkSourceIds = new Set(
    draft.sources.filter(s => (s.result?.candidates || []).some(c => c.role === 'link')).map(s => s.id)
  );
  for (const source of draft.sources) for (const candidate of source.result?.candidates || []) {
    if (candidate.status !== 'accepted') continue;
    const c: Evidence = { ...candidate, sourceId: source.id, sourceName: source.name, sourceRevision: source.revision, id: `${source.id}:${source.revision}:${candidate.id}` };
    if (linkSourceIds.has(source.id)) {
      if (c.role === 'executant' || c.role === 'claimant') {
        c.role = 'unassigned';
        c.field = c.field.replace(/^(executant|claimant)/, 'party');
      }
      // The link deed's own age/mobile/occupation and its own consideration,
      // stamp value, rate and execution date describe THAT transaction, not
      // today's — even once a drafter confirms its buyer as today's seller,
      // those specific facts must still be re-supplied from a current source.
      if (CURRENT_STATE_ONLY.test(c.field)) c.historical = true;
    }
    if (
      (c.role === 'unassigned' || c.role === source.assignment?.role) && source.assignment &&
      (!source.assignment.fromRecord || source.assignment.fromRecord === candidate.record)
    ) {
      c.role = source.assignment.role; c.record = source.assignment.record;
      c.field = c.field.replace(/^party/, c.role);
    }
    all.push(c);
  }
  const aliases = new Map<string, string>();
  const local = new Map<string, Evidence[]>();
  for (const c of all) { const key = `${c.sourceId}|${c.role}|${c.record}`; local.set(key, [...(local.get(key) || []), c]); }
  for (const [key, items] of local) {
    const first = items[0]; const source = draft.sources.find(s => s.id === first.sourceId)!;
    if (source.assignment?.role === 'link' && first.role === 'property' && first.record === 'primary') {
      aliases.set(key, source.assignment.propertyRecord || 'primary'); continue;
    }
    if (source.assignment && first.role === source.assignment.role) { aliases.set(key, source.assignment.record); continue; }
    const value = (field: string) => items.find(c => c.field === field)?.value;
    let identity = '';
    if (first.role === 'executant' || first.role === 'claimant') identity = value(first.role + 'Name') || (first.record !== 'primary' ? first.record : '');
    if (first.role === 'property') identity = value('plotNo') ? `Plot ${value('plotNo')}${value('surveyNo') ? ' · Survey ' + value('surveyNo') : ''}` : value('bearingHNo') ? `House ${value('bearingHNo')}` : first.record !== 'primary' ? first.record : '';
    if (first.role === 'link') identity = value('linkDocNo') || (first.record !== 'primary' ? first.record : `link-${source.hash || source.id}`);
    if (first.role === 'payment') identity = value('refNo') || (first.record !== 'primary' ? first.record : `payment-${source.hash || source.id}`);
    if (identity) aliases.set(key, identity.trim().toLowerCase().replace(/\s+/g, ' '));
  }
  for (const [key, items] of local) {
    const role = items[0].role;
    if (!aliases.has(key) && role !== 'unassigned') {
      const identities = [...new Set([...local].filter(([, v]) => v[0].role === role).map(([k]) => aliases.get(k)).filter(Boolean))];
      if (identities.length <= 1) aliases.set(key, identities[0] || 'primary');
    }
    for (const c of items) {
      if (['consid','executionDate','stampValue'].includes(c.field)) { c.role = 'property'; c.record = 'transaction'; }
      else if (role === 'unassigned' || !aliases.has(key)) { unassigned.push(c); continue; }
      else c.record = aliases.get(key)!;
      const field = fieldKey(c.role, c.record, c.field);
      (groups[field] ??= []).push(c);
    }
  }
  const values: Record<string, string> = {};
  const evidence: Record<string, Evidence[]> = {};
  const conflicts: Record<string, Evidence[]> = {};
  for (const [key, candidates] of Object.entries(groups)) {
    // Historical mutable facts may support title, but must not become current facts.
    const usable = candidates.filter(c => !c.historical || !CURRENT_STATE_ONLY.test(c.field));
    if (!usable.length) continue;
    const selected = usable.find(c => c.id === draft.choices[key]);
    if (selected) { values[key] = selected.value; evidence[key] = [selected]; continue; }
    const byValue = new Map<string, Evidence[]>();
    for (const c of usable) {
      const k = exact(c.value);
      const bucket = byValue.get(k);
      if (bucket) bucket.push(c); else byValue.set(k, [c]);
    }
    if (byValue.size === 1) { values[key] = usable[0].value; evidence[key] = usable; continue; }
    // A single document read across several pages/regions rarely reproduces a
    // value byte-for-byte (a full name vs. an abbreviated signature, "Business"
    // vs. "BUSINESS"). Requiring unanimous agreement blanked the field on any
    // one dissenting read; a clear plurality is trusted instead, and only a
    // genuine split (no value with more support than every other) is surfaced.
    const ranked = [...byValue.values()].sort((a, b) => b.length - a.length);
    const winner = ranked[0];
    const runnerUp = ranked[1];
    if (winner.length > usable.length / 2 && winner.length > (runnerUp?.length ?? 0)) {
      values[key] = winner[0].value; evidence[key] = winner;
    } else { values[key] = ''; conflicts[key] = usable; }
  }
  for (const [key, value] of Object.entries(draft.manual)) {
    values[key] = value;
    if (groups[key]?.some(c => exact(c.value) !== exact(value))) conflicts[key] = groups[key];
  }
  return { values, evidence, conflicts, unassigned };
}

export function appStateFor(draft: Draft): AppState {
  const { values, conflicts } = resolveDraft(draft);
  const records = new Map<string, Record<string, string>>();
  for (const [key, value] of Object.entries(values)) {
    const [role, record, field] = key.split('|');
    const id = `${role}|${record}`;
    const fields = records.get(id) || {};
    fields[field] = value; records.set(id, fields);
  }
  const forRole = (role: Role): ValueRecord[] => [...records].filter(([id]) => id.startsWith(role + '|')).map(([id, fields]) => ({ id: id.split('|')[1], values: fields, docNames: [] }));
  const extractedProperties = forRole('property').filter(r => r.id !== 'transaction');
  // A newly added schedule must remain visible before any manual field or
  // upload has populated it. Preserve IDs discovered in older multi-property
  // sources too, so existing drafts remain readable.
  const propertyIds = ['primary', ...draft.propertyIds, ...extractedProperties.map(record => record.id)]
    .filter((id, index, all) => all.indexOf(id) === index);
  const byPropertyId = new Map(extractedProperties.map(record => [record.id, record]));
  const properties = propertyIds.map(id => byPropertyId.get(id) || ({ id, values: {}, docNames: [] }));
  const transaction = forRole('property').find(r => r.id === 'transaction');
  const sellers = forRole('executant'); const buyers = forRole('claimant'); const links = forRole('link');
  const linkScheduleId = (record: ValueRecord) => draft.linkPropertyRecords[record.id]
    || draft.sources.find(source => source.assignment?.role === 'link' && source.assignment.record === record.id)?.assignment?.propertyRecord
    || 'primary';
  const linkRecordsBySchedule: Record<string, ValueRecord[]> = {};
  for (const link of links) (linkRecordsBySchedule[linkScheduleId(link)] ??= []).push(link);
  const registeredLinks = links.filter(r => r.values.linkOption === 'linkDoc' || (!r.values.linkOption && ['linkDocNo','linkDocType','linkDocDate','linkSro'].some(f=>r.values[f])));
  const supportingLinks = links.filter(r=>!registeredLinks.includes(r));
  const primaryLinks = linkRecordsBySchedule.primary || [];
  const primaryRegisteredLink = primaryLinks.find(r => r.values.linkOption === 'linkDoc' || (!r.values.linkOption && ['linkDocNo','linkDocType','linkDocDate','linkSro'].some(f=>r.values[f])));
  const form = { ...EMPTY_FORM, ...properties[0]?.values, ...sellers[0]?.values, ...buyers[0]?.values, ...primaryRegisteredLink?.values, ...transaction?.values };
  const paymentRecords = forRole('payment');
  const payments: Payment[] = paymentRecords.filter(r => Object.keys(r.values).some(k => !['consid', 'executionDate', 'stampValue'].includes(k))).map(r => ({ ...newPayment(), mode: '' as Payment['mode'], ...r.values, id: r.id,
    filled: (r.values.filled || '').split(',').filter(Boolean), advance: r.values.advance === 'true', tds: r.values.tds === 'true' }));
  const unresolvedFields = Object.keys(conflicts).filter(key => !(key in draft.manual)).map(key => key.split('|')[2]);
  const derived = withDerived(form);
  for (const field of unresolvedFields) derived[field] = '';
  // Most parties are individuals related as S/o, and nearly every deed is
  // registered in Telangana — default to the common answer instead of
  // blocking generation on a pick most drafters would make anyway. Never
  // overrides a field left blank because of a genuine unresolved conflict.
  const defaultIfUnset = (field: string, value: string) => { if (!derived[field] && !unresolvedFields.includes(field)) derived[field] = value; };
  defaultIfUnset('propState', 'Telangana');
  for (const side of ['executant', 'claimant']) {
    defaultIfUnset(`${side}PartyType`, 'Individual');
    defaultIfUnset(`${side}Relation`, 'S/o');
  }
  const partyDefaults = (side: 'executant' | 'claimant', values: Record<string, string>) => ({
    ...values,
    [`${side}PartyType`]: values[`${side}PartyType`] || 'Individual',
    [`${side}Relation`]: values[`${side}Relation`] || 'S/o',
  });
  return {
    ...initialState, step: draft.step,
    deedType: definitionFor(draft.instrumentId || instrumentIdForLegacyType('Sale')).legacyType,
    draft: definitionFor(draft.instrumentId || 'sale').variants.find(v => v.id === draft.variantId)?.label || definitionFor(draft.instrumentId || 'sale').variants[0].label,
    category: properties[0]?.values.category || '', unit: properties[0]?.values.unit || '',
    form: derived, payments, docs: [], fieldSource: {}, fieldEvidence: {}, conflicts: {}, unresolvedFields,
    linkRecordsBySchedule,
    additionalExecutants: sellers.slice(1).map(r => ({ ...r, values: withDerived(partyDefaults('executant', { ...r.values, executionDate: form.executionDate })) })),
    additionalClaimants: buyers.slice(1).map(r => ({ ...r, values: withDerived(partyDefaults('claimant', { ...r.values, executionDate: form.executionDate })) })),
    additionalLinkDocuments: registeredLinks.slice(1),
    additionalSchedules: properties.slice(1).map(r => ({ ...r, category: r.values.category || '', unit: r.values.unit || '' })),
    supportingRecords: supportingLinks.map(r=>({id:r.id,scheduleId:draft.sources.find(s=>s.assignment?.record===r.id)?.assignment?.propertyRecord || 'primary',docName:draft.sources.find(s=>s.assignment?.record===r.id)?.name || '',values:r.values})),
  };
}

export function plansFor(draft: Draft, record: string): SourcePlan[] {
  const resolved = resolveDraft(draft);
  const candidates = draft.sources.flatMap(source => (source.result?.plans || []).filter(p => {
    if (source.assignment?.role === 'property') return source.assignment.record === record;
    if (source.assignment?.propertyRecord) return source.assignment.propertyRecord === record;
    const planCandidateIds = new Set(source.result?.candidates.filter(c => c.role === 'property' && c.record === p.record).map(c => `${source.id}:${source.revision}:${c.id}`));
    const related = Object.entries(resolved.evidence).filter(([key, values]) => key.startsWith('property|') && values.some(v => v.sourceId === source.id && (!planCandidateIds.size || planCandidateIds.has(v.id))));
    const records = [...new Set(related.map(([key]) => key.split('|')[1]).filter(r => r !== 'transaction'))];
    const localRecords = new Set(source.result?.candidates.filter(c => c.role === 'property' && !['consid','executionDate','stampValue'].includes(c.field)).map(c => c.record));
    return p.record.toLowerCase() === record || ((planCandidateIds.size > 0 || localRecords.size <= 1) && records.length === 1 && records[0] === record) || (records.length === 0 && p.record === 'primary' && record === 'primary');
  }));
  const supplied = candidates.filter(p => !p.linked);
  return supplied.length ? supplied : candidates.filter(p => p.linked);
}

export const labelFor = (field: string) => ALL_FIELDS.find(f => f.id === field)?.label || field.replace(/([A-Z])/g, ' $1');

/** Shared limiter bounds actual API requests, including nested verification calls. */
export class WorkQueue {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private limit = 3) {}
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>(resolve => this.waiting.push(resolve));
    else this.active++;
    try { return await work(); }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}
