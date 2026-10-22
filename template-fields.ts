import { deedDate } from './deed-format';
import { validatePlacement, type FieldPlacement } from './template-placement';
export type TemplateFieldScope = 'transaction' | 'property' | 'party';
export type TemplateFieldType = 'text' | 'multiline' | 'number' | 'currency' | 'date' | 'dropdown' | 'boolean';
export interface TemplateField {
  id: string; placeholder: string; label: string; help: string;
  type: TemplateFieldType; scope: TemplateFieldScope; roleId?: string;
  required: boolean; options: string[]; sampleValue: string;
  extractionEnabled: boolean; extractionDescription: string; evidenceContext: 'current' | 'historical';
  existingPlaceholder?: string;
  placement?: FieldPlacement;
  /** Computed from Word section occurrences, never supplied by the administrator. */
  variants?: string[];
}
export interface TemplateFieldContract { version: 1; fields: TemplateField[] }
export const EMPTY_FIELD_CONTRACT: TemplateFieldContract = { version: 1, fields: [] };
export interface PlaceholderOccurrence { placeholder: string; text: string; part: string; variants: string[]; supported: boolean }
export interface TemplateFieldInspection { occurrences: PlaceholderOccurrence[]; unresolved: string[]; structureErrors: string[] }
export interface BindingCatalogItem { placeholder: string; label: string; scope: TemplateFieldScope; roleId?: string; type: TemplateFieldType }
export type TemplateFieldValues = Record<string, Record<string, string>>;
export interface TemplateFieldCandidate {
  id: string; fieldId: string; recordId: string; value: string; quote: string; page: number; region: string;
  historical: boolean; verified: boolean; fingerprint: string; issue?: string;
}
export const fieldName = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase();
export const canonicalContract = (contract: TemplateFieldContract = EMPTY_FIELD_CONTRACT) => JSON.stringify({ version: 1, fields: [...contract.fields].sort((a, b) => a.id.localeCompare(b.id)).map(field => Object.fromEntries(Object.entries(field).sort(([a], [b]) => a.localeCompare(b)))) });
export const fieldFingerprint = (field: TemplateField) => JSON.stringify([field.id, field.type, field.scope, field.roleId || '', field.options, field.existingPlaceholder || '', field.extractionEnabled, field.extractionDescription, field.evidenceContext]);
export const recordScope = (field: TemplateField) => field.scope === 'party' ? field.roleId === 'vendor' ? 'executant' : 'claimant' : field.scope;

export function validateFieldValue(field: TemplateField, raw: string): string | null {
  const value = raw.trim();
  if (!value) return field.required ? `${field.label} is required.` : null;
  if (value.length > 10000) return `${field.label} is too long.`;
  if (field.type === 'number' && !/^-?\d+(?:\.\d+)?$/.test(value)) return `${field.label} must be a number.`;
  if (field.type === 'currency' && !/^\d+(?:\.\d{1,2})?$/.test(value.replace(/,/g, ''))) return `${field.label} must be a non-negative amount with at most two decimals.`;
  if (['number', 'currency'].includes(field.type) && (!Number.isFinite(Number(value.replace(/,/g, ''))) || Math.abs(Number(value.replace(/,/g, ''))) > Number.MAX_SAFE_INTEGER)) return `${field.label} exceeds the supported numeric range.`;
  if (field.type === 'boolean' && !['true', 'false'].includes(value)) return `${field.label} must be Yes or No.`;
  if (field.type === 'dropdown' && !field.options.includes(value)) return `${field.label} must match a configured choice.`;
  if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value)) return `${field.label} needs a valid date in YYYY-MM-DD format.`;
  return null;
}
export function formatFieldValue(field: TemplateField, value: string): string {
  if (!value.trim()) return '____';
  if (field.type === 'currency') return Number(value.replace(/,/g, '')).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (field.type === 'date') return deedDate(value);
  if (field.type === 'boolean') return value === 'true' ? 'Yes' : 'No';
  return value;
}

export function validateFieldContract(input: unknown, catalog: BindingCatalogItem[], occurrences: PlaceholderOccurrence[], previous: TemplateFieldContract = EMPTY_FIELD_CONTRACT, requirePlacement = false): TemplateFieldContract {
  const fields = (input as any)?.fields;
  if ((input as any)?.version !== 1 || !Array.isArray(fields) || fields.length > 100) throw new Error('Choose a valid field contract with at most 100 fields.');
  const names = new Set<string>(), ids = new Set<string>();
  const normalized = fields.map((item: any) => {
    if (!item || typeof item.placeholder !== 'string' || typeof item.label !== 'string' || typeof item.id !== 'string') throw new Error('Every field needs an ID, placeholder and label.');
    const placeholder = item.placeholder.replace(/\s+/g, ' ').trim();
    if (!/^[^<>\r\n|]{2,60}$/.test(placeholder) || /^(?:IF\b|FOR\b|END\b|\d+$)/i.test(placeholder)) throw new Error(`Invalid or reserved placeholder: ${placeholder}`);
    if (names.has(fieldName(placeholder)) || ids.has(item.id) || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ['__proto__', 'constructor', 'prototype'].includes(item.id)) throw new Error('Field names and IDs must be unique and non-reserved.');
    if (catalog.some(entry => fieldName(entry.placeholder) === fieldName(placeholder))) throw new Error(`Existing placeholder <${placeholder}> cannot be redefined.`);
    names.add(fieldName(placeholder)); ids.add(item.id);
    const locations = occurrences.filter(location => fieldName(location.placeholder) === fieldName(placeholder));
    if (!locations.length || locations.some(location => !location.supported)) throw new Error(`<${placeholder}> is unused or is in an unsupported Word location.`);
    if (!['text', 'multiline', 'number', 'currency', 'date', 'dropdown', 'boolean'].includes(item.type) || !['transaction', 'property', 'party'].includes(item.scope)) throw new Error('Choose a supported field type and scope.');
    if (item.scope === 'party' && !['vendor', 'purchaser'].includes(item.roleId)) throw new Error('Choose Vendor or Purchaser for this Sale template.');
    if (typeof item.required !== 'boolean' || typeof item.extractionEnabled !== 'boolean' || !['current', 'historical'].includes(item.evidenceContext)) throw new Error('Required, extraction and evidence settings are invalid.');
    for (const key of ['label', 'help', 'sampleValue', 'extractionDescription']) if (typeof item[key] !== 'string' || item[key].length > (key === 'sampleValue' ? 10000 : 1000)) throw new Error(`Invalid ${key}.`);
    if (!item.label.trim()) throw new Error('Enter a field label.');
    const options = Array.isArray(item.options) && item.options.every((v: any) => typeof v === 'string' && v.length <= 200) ? [...new Set<string>(item.options.map((v: string) => v.trim()).filter(Boolean))] : [];
    if (options.length > 100 || (item.type === 'dropdown' && !options.length)) throw new Error('Dropdowns need between 1 and 100 choices.');
    const target = item.existingPlaceholder ? catalog.find(entry => fieldName(entry.placeholder) === fieldName(item.existingPlaceholder)) : undefined;
    if (item.existingPlaceholder && !target) throw new Error('Choose a supported existing-field mapping.');
    const old = previous.fields.find(field => field.id === item.id);
    if (old && (old.type !== item.type || old.scope !== item.scope || old.roleId !== (item.scope === 'party' ? item.roleId : undefined) || old.existingPlaceholder !== target?.placeholder || fieldName(old.placeholder) !== fieldName(placeholder))) throw new Error('Changing a field meaning, type or scope requires a new field ID.');
    const variants = locations.some(location => !location.variants.length) ? [] : [...new Set(locations.flatMap(location => location.variants))];
    const field: TemplateField = { id: item.id, placeholder, label: item.label.trim(), help: item.help, type: target?.type || item.type, scope: target?.scope || item.scope, roleId: target?.roleId || (item.scope === 'party' ? item.roleId : undefined), required: item.required, options, sampleValue: item.sampleValue, extractionEnabled: !target && item.extractionEnabled, extractionDescription: item.extractionDescription, evidenceContext: item.evidenceContext, existingPlaceholder: target?.placeholder, variants };
    if (requirePlacement && !item.placement) throw new Error(`Choose a dashboard step, section and position for ${field.label}.`);
    if (item.placement) field.placement = validatePlacement(item.placement);
    if (!target && (validateFieldValue({ ...field, required: true }, field.sampleValue))) throw new Error(`Enter a valid sample value for ${field.label}.`);
    return field;
  });
  return { version: 1, fields: normalized };
}
