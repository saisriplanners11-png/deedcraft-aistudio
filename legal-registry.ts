import type { DeedDefinition, InstrumentId, LegalReferenceStatus } from './instruments';
import { DEED_DEFINITIONS } from './instruments';

export interface LegalReference {
  id: string;
  instrumentId: InstrumentId;
  variantIds: string[];
  jurisdiction: 'Telangana';
  effectiveFrom: string;
  version: string;
  status: LegalReferenceStatus;
  templateVersionId?: string;
  approvedBy?: string;
  approvedAt?: string;
  supersedes?: string;
  propertyCategories: string[];
  requiredSchedules: string[];
  requiredAnnexures: string[];
  witnessCount: number;
}

export interface TemplateVersion {
  id: string;
  referenceId: string;
  instrumentId: InstrumentId;
  version: string;
  asset: string;
  sha256?: string;
  immutable: true;
}

const saleDefinition = DEED_DEFINITIONS.sale;
export const LEGAL_REFERENCES: LegalReference[] = [{
  id: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  variantIds: [saleDefinition.variants[0].id], jurisdiction: 'Telangana',
  effectiveFrom: '2026-09-01', version: '1.0.0', status: 'approved',
  templateVersionId: 'sale-deed-v1', approvedBy: 'Existing supplied reference',
  propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Agricultural land','Part open place'],
  requiredSchedules: ['property'], requiredAnnexures: ['annexure-i-a-when-structure'], witnessCount: 2,
}];

export const TEMPLATE_VERSIONS: TemplateVersion[] = [{
  id: 'sale-deed-v1', referenceId: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  version: '1.0.0', asset: 'sale-deed-template.docx', immutable: true,
}];

export type ReleaseGate = { ready: boolean; reasons: string[]; reference?: LegalReference };
export function releaseGate(instrumentId: InstrumentId, variantId?: string, on = new Date().toISOString().slice(0, 10)): ReleaseGate {
  const candidates = LEGAL_REFERENCES.filter(r =>
    r.instrumentId === instrumentId && r.status === 'approved' && r.effectiveFrom <= on &&
    (!variantId || r.variantIds.includes(variantId))
  ).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const reference = candidates[0];
  const reasons: string[] = [];
  if (!reference) reasons.push('No effective advocate-approved legal reference is registered for this instrument and variant.');
  if (reference && !reference.templateVersionId) reasons.push('The approved legal reference has no immutable template version.');
  if (reference?.templateVersionId && !TEMPLATE_VERSIONS.some(t => t.id === reference.templateVersionId && t.instrumentId === instrumentId)) reasons.push('The referenced template version is not registered.');
  return { ready: reasons.length === 0, reasons, reference };
}

export function validateRegistry(definitions: Record<string, DeedDefinition> = DEED_DEFINITIONS): string[] {
  const errors: string[] = [];
  for (const [id, definition] of Object.entries(definitions)) {
    if (definition.id !== id) errors.push(`${id}: definition id differs from its registry key.`);
    if (!definition.variants.length) errors.push(`${id}: at least one variant is required.`);
    if (!definition.roles.length) errors.push(`${id}: at least one party role is required.`);
    if (!definition.sections.includes('review') || !definition.sections.includes('generate')) errors.push(`${id}: review and generation sections are required.`);
    const duplicates = definition.fieldSchema.map(x => x.id).filter((value, index, all) => all.indexOf(value) !== index);
    if (duplicates.length) errors.push(`${id}: duplicate field ids: ${[...new Set(duplicates)].join(', ')}.`);
  }
  return errors;
}
