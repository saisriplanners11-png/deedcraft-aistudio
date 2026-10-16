import { partyRecords, scheduleRecords, type AppState } from './logic';
import { mergeValues, rewritesFor, scheduleMergesFor } from './merge';
import type { Draft, Source } from './source-draft';
import { EMPTY_FIELD_CONTRACT, fieldFingerprint, formatFieldValue, recordScope, validateFieldValue, type TemplateField, type TemplateFieldContract } from './template-fields';
import type { Rewrite, ScheduleMerge } from './docx';
import { ALL_FIELDS } from './fields';

export interface TemplateRecord { scope: string; id: string; sourceRecordId?: string; label: string; variant?: string; values: Record<string, string> }
export interface TemplateFieldInstance { field: TemplateField; record: TemplateRecord; value: string; error?: string; conflict: boolean }
export interface TemplateFieldData { records: TemplateRecord[]; values: Record<string, Record<string, string>> }
export const appliesTo = (field: TemplateField, variant: string) => !field.variants?.length || field.variants.includes(variant) || (variant.startsWith('IF FLAT') && field.variants.includes('IF FLAT'));
export const templateSourceActive = (draft: Draft, source: Source) => source.status === 'done' && (!source.templateParent || draft.sources.some(parent => parent.id === source.templateParent.id && parent.revision === source.templateParent.revision && parent.status === 'done'));

export function templateRecords(state: AppState): TemplateRecord[] {
  const schedules = scheduleMergesFor(state);
  return [
    { scope: 'transaction', id: 'deed', label: 'Whole deed', values: mergeValues(state) },
    ...scheduleRecords(state).map((record, index) => ({ scope: 'property', id: record.id, label: `Property ${index + 1}`, variant: schedules[index]?.variant, values: schedules[index]?.values || {} })),
    ...(['executant', 'claimant'] as const).flatMap(scope => partyRecords(state, scope).map((record, index) => ({ scope, id: record.id, sourceRecordId: index === 0 ? (scope === 'executant' ? state.primaryExecutantId : state.primaryClaimantId) || 'primary' : record.id, label: record.values[scope + 'EntityName'] || record.values[scope + 'Name'] || `${scope === 'executant' ? 'Vendor' : 'Purchaser'} ${index + 1}`, values: mergeValues({ ...state, form: { ...state.form, ...Object.fromEntries(ALL_FIELDS.filter(field => field.id.startsWith(scope)).map(field => [field.id, record.values[field.id] || ''])) } }) }))),
  ];
}

export function fieldInstances(contract: TemplateFieldContract, data: TemplateFieldData): TemplateFieldInstance[] {
  const selectedVariants = data.records.filter(record => record.scope === 'property').map(record => record.variant || '');
  return contract.fields.flatMap(field => {
    if (field.variants?.length && !selectedVariants.some(variant => appliesTo(field, variant))) return [];
    return data.records.filter(record => record.scope === recordScope(field) && (record.scope !== 'property' || appliesTo(field, record.variant || ''))).map(record => {
      const value = field.existingPlaceholder ? Object.entries(record.values).find(([key]) => key.trim().toLowerCase() === field.existingPlaceholder!.trim().toLowerCase())?.[1] || '' : data.values[field.id]?.[record.id] || '';
      return { field, record, value, error: field.existingPlaceholder ? field.required && (!value.trim() || /^[_\s]+$/.test(value)) ? `${field.label} is required.` : undefined : validateFieldValue(field, value) || undefined, conflict: false };
    });
  });
}

export function resolveTemplateFieldData(draft: Draft, state: AppState, contract: TemplateFieldContract = EMPTY_FIELD_CONTRACT) {
  const values: TemplateFieldData['values'] = Object.create(null);
  const conflicts = new Set<string>();
  const records = templateRecords(state);
  for (const field of contract.fields.filter(field => !field.existingPlaceholder)) {
    values[field.id] = Object.create(null);
    for (const record of records.filter(record => record.scope === recordScope(field))) {
      const proposals = draft.sources.filter(source => templateSourceActive(draft, source)).flatMap(source => (source.templateCandidates || []).filter(candidate => candidate.fieldId === field.id && candidate.recordId === record.id && candidate.fingerprint === fieldFingerprint(field) && !candidate.issue && (!candidate.historical || field.evidenceContext === 'historical') && draft.templateFieldReviews?.[`${source.id}:${source.revision}:${candidate.id}`] === 'accepted'));
      const unique = [...new Set(proposals.map(candidate => candidate.value))];
      if (unique.length > 1) conflicts.add(field.id + '|' + record.id);
      const manual = draft.templateFieldValues?.[field.id];
      const manualKey = record.scope + ':' + record.id;
      if (manual && Object.prototype.hasOwnProperty.call(manual, manualKey)) {
        values[field.id][record.id] = manual[manualKey];
        if (unique.some(value => value !== manual[manualKey])) conflicts.add(field.id + '|' + record.id);
      } else values[field.id][record.id] = unique.length === 1 ? unique[0] : '';
    }
  }
  const data = { records, values };
  const instances = fieldInstances(contract, data).map(instance => ({ ...instance, conflict: conflicts.has(instance.field.id + '|' + instance.record.id) }));
  return { data, instances };
}

/** Augment existing merge maps; custom bindings never overwrite legacy placeholders. */
export function bindTemplateFields(contract: TemplateFieldContract = EMPTY_FIELD_CONTRACT, data: TemplateFieldData, values: Record<string, string>, schedules: ScheduleMerge[], rewrites: Rewrite[]) {
  const instances = fieldInstances(contract, data);
  const errors = instances.filter(instance => instance.error).map(instance => `${instance.record.label}: ${instance.error}`);
  const markers: string[] = [];
  const valueFor = (instance: TemplateFieldInstance) => {
    const marker = `\uE100${instance.field.id}:${instance.record.scope}:${encodeURIComponent(instance.record.id).replace(/'/g, '%27')}\uE101`;
    markers.push(marker);
    // Existing data is already formatted by the standard merge.
    return (instance.field.existingPlaceholder ? instance.value || '____' : formatFieldValue(instance.field, instance.value)) + marker;
  };
  const global = { ...values };
  for (const field of contract.fields) {
    const matches = instances.filter(instance => instance.field.id === field.id);
    global[field.placeholder] = matches.length === 1 ? valueFor(matches[0]) : matches.length ? matches.map(instance => `${instance.record.label}: ${valueFor(instance)}`).join('; ') : '____';
  }
  const propertyRecords = data.records.filter(record => record.scope === 'property');
  const localSchedules = schedules.map((schedule, index) => {
    const local: Record<string, string> = { ...global, ...schedule.values };
    for (const instance of instances.filter(instance => instance.record.scope === 'property' && instance.record.id === propertyRecords[index]?.id)) local[instance.field.placeholder] = valueFor(instance);
    const titleValues = { ...global, ...schedule.titleValues, ...Object.fromEntries(contract.fields.map(field => [field.placeholder, local[field.placeholder]])) };
    return { ...schedule, values: local, titleValues };
  });
  const partyCounters = new Map<string, number>();
  const localRewrites = rewrites.map(rewrite => {
    if (!rewrite.partyRole || !rewrite.records) return rewrite;
    const records = data.records.filter(record => record.scope === rewrite.partyRole);
    return { ...rewrite, records: rewrite.records.map((record, index) => ({ ...global, ...record, ...Object.fromEntries(instances.filter(instance => instance.record.scope === rewrite.partyRole && instance.record.id === records[index]?.id).map(instance => [instance.field.placeholder, valueFor(instance)])) })) };
  });
  return { values: global, schedules: localSchedules, rewrites: localRewrites, markers: [...new Set(markers)], errors };
}
