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
  sourceDocument?: string;
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
  id: 'ts-gift-municipal-2026-10-v3', instrumentId: 'gift', variantIds: ['municipal-gift'], jurisdiction: 'Telangana', effectiveFrom: '2026-10-29', version: '3.0.0', status: 'approved', templateVersionId: 'gift-municipal-v3', sourceDocument: 'GIFT DEED FOR MUNCIPAL (2).docx', propertyCategories: ['Vacant Plot', 'Open Place', 'Demolished', 'Part open place'], requiredSchedules: ['property'], requiredAnnexures: [], witnessCount: 2,
}, {
  id: 'ts-gift-2026-10-v3', instrumentId: 'gift', variantIds: DEED_DEFINITIONS.gift.variants.filter(variant => variant.id !== 'municipal-gift').map(variant => variant.id), jurisdiction: 'Telangana', effectiveFrom: '2026-10-29', version: '3.0.0', status: 'approved', templateVersionId: 'gift-deed-v6', sourceDocument: 'GIFT SETTLEMENT (2).docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-agreement-sale-gpa-2026-10-v4', instrumentId: 'agreement_of_sale', variantIds: DEED_DEFINITIONS.agreement_of_sale.variants.map(variant => variant.id), jurisdiction: 'Telangana', effectiveFrom: '2026-10-29', version: '4.0.0', status: 'approved', templateVersionId: 'agreement-sale-gpa-v4', sourceDocument: 'AGREEMENT OF SALE CUM GPA (3).docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['section-32a', 'annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-general-poa-2026-10-v3', instrumentId: 'power_of_attorney', variantIds: ['general-power-of-attorney', 'general-power-of-attorney-family'], jurisdiction: 'Telangana', effectiveFrom: '2026-10-29', version: '3.0.0', status: 'approved', templateVersionId: 'general-poa-v3', sourceDocument: 'G.P.A FOR CONSIDERATION (2).docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['section-32a', 'annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-sale-2026-10-v2', instrumentId: 'sale', variantIds: [saleDefinition.variants[0].id, 'sale-deed-by-gpa-holder', 'sale-through-existing-agpa'], jurisdiction: 'Telangana', effectiveFrom: '2026-10-29', version: '2.0.0', status: 'approved', templateVersionId: 'sale-deed-v11', sourceDocument: 'SALE DEED (7).docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Agricultural land','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-general-poa-2026-10-v2', instrumentId: 'power_of_attorney', variantIds: ['general-power-of-attorney', 'general-power-of-attorney-family'], jurisdiction: 'Telangana', effectiveFrom: '2026-10-28', version: '2.0.0', status: 'approved', templateVersionId: 'general-poa-v2', sourceDocument: 'G.P.A FOR CONSIDERATION (1).docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['section-32a', 'annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-agreement-sale-gpa-2026-10-v3', instrumentId: 'agreement_of_sale', variantIds: DEED_DEFINITIONS.agreement_of_sale.variants.map(variant => variant.id), jurisdiction: 'Telangana', effectiveFrom: '2026-10-28', version: '3.0.0', status: 'approved', templateVersionId: 'agreement-sale-gpa-v3', sourceDocument: 'AGREEMENT OF SALE CUM GPA (2).docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['section-32a', 'annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-agreement-sale-gpa-2026-10-v2', instrumentId: 'agreement_of_sale', variantIds: DEED_DEFINITIONS.agreement_of_sale.variants.map(variant => variant.id), jurisdiction: 'Telangana', effectiveFrom: '2026-10-26', version: '2.0.0', status: 'approved', templateVersionId: 'agreement-sale-gpa-v2', sourceDocument: 'AGREEMENT OF SALE CUM GPA (1).docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['section-32a', 'annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-general-poa-2026-10-v1', instrumentId: 'power_of_attorney', variantIds: ['general-power-of-attorney', 'general-power-of-attorney-family'], jurisdiction: 'Telangana', effectiveFrom: '2026-10-24', version: '1.0.0', status: 'approved', templateVersionId: 'general-poa-v1', sourceDocument: 'G.P.A FOR CONSIDERATION.docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['section-32a', 'annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-agreement-sale-gpa-2026-10-v1', instrumentId: 'agreement_of_sale', variantIds: DEED_DEFINITIONS.agreement_of_sale.variants.map(variant => variant.id), jurisdiction: 'Telangana', effectiveFrom: '2026-10-24', version: '1.0.0', status: 'approved', templateVersionId: 'agreement-sale-gpa-v1', sourceDocument: 'AGREEMENT OF SALE CUM GPA.docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['section-32a', 'annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-gift-municipal-2026-10-v2', instrumentId: 'gift', variantIds: ['municipal-gift'], jurisdiction: 'Telangana', effectiveFrom: '2026-10-28', version: '2.0.0', status: 'approved', templateVersionId: 'gift-municipal-v2', sourceDocument: 'GIFT DEED FOR MUNCIPAL (1).docx', propertyCategories: ['Vacant Plot', 'Open Place', 'Demolished', 'Part open place'], requiredSchedules: ['property'], requiredAnnexures: [], witnessCount: 2,
}, {
  id: 'ts-gift-2026-10-v2', instrumentId: 'gift', variantIds: DEED_DEFINITIONS.gift.variants.filter(variant => variant.id !== 'municipal-gift').map(variant => variant.id), jurisdiction: 'Telangana', effectiveFrom: '2026-10-28', version: '2.0.0', status: 'approved', templateVersionId: 'gift-deed-v5', sourceDocument: 'GIFT SETTLEMENT (1).docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-gift-municipal-2026-10-v1', instrumentId: 'gift', variantIds: ['municipal-gift'], jurisdiction: 'Telangana', effectiveFrom: '2026-10-24', version: '1.0.0', status: 'approved', templateVersionId: 'gift-municipal-v1', sourceDocument: 'GIFT DEED FOR MUNCIPAL.docx', propertyCategories: ['Vacant Plot', 'Open Place', 'Demolished', 'Part open place'], requiredSchedules: ['property'], requiredAnnexures: [], witnessCount: 2,
}, {
  id: 'ts-gift-2026-10-v1', instrumentId: 'gift', variantIds: DEED_DEFINITIONS.gift.variants.filter(variant => variant.id !== 'municipal-gift').map(variant => variant.id), jurisdiction: 'Telangana', effectiveFrom: '2026-10-18', version: '1.0.0', status: 'approved', templateVersionId: 'gift-deed-v4', sourceDocument: 'GIFT SETTLEMENT (4).docx', propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Part open place'], requiredSchedules: ['property'], requiredAnnexures: ['annexure-i-a-when-structure'], witnessCount: 2,
}, {
  id: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  variantIds: [saleDefinition.variants[0].id, 'sale-deed-by-gpa-holder', 'sale-through-existing-agpa'], jurisdiction: 'Telangana',
  effectiveFrom: '2026-09-01', version: '1.0.0', status: 'approved',
  templateVersionId: 'sale-deed-v10', sourceDocument: 'SALE DEED-1610.docx',
  propertyCategories: ['Vacant Plot','Open Place','Residential','Flat','Demolished','Commercial','Agricultural land','Part open place'],
  requiredSchedules: ['property'], requiredAnnexures: ['annexure-i-a-when-structure'], witnessCount: 2,
}];

export const TEMPLATE_VERSIONS: TemplateVersion[] = [{
  id: 'gift-municipal-v3', referenceId: 'ts-gift-municipal-2026-10-v3', instrumentId: 'gift', version: '3.0.0', asset: 'gift-municipal-template-v3.docx', sha256: '507c06be8e45f9e091c2298d9736425b3a926c7f6237cf9d4c2a6bf37dfd9b49', immutable: true,
}, {
  id: 'gift-deed-v6', referenceId: 'ts-gift-2026-10-v3', instrumentId: 'gift', version: '6.0.0', asset: 'gift-deed-template-v6.docx', sha256: 'a12d0d963dff594b4bbc1920d07c698603133bd4a94f45f91bcad22cb49b1edd', immutable: true,
}, {
  id: 'agreement-sale-gpa-v4', referenceId: 'ts-agreement-sale-gpa-2026-10-v4', instrumentId: 'agreement_of_sale', version: '4.0.0', asset: 'agreement-sale-gpa-template-v4.docx', sha256: '0a39e5635d04ba03b2db91d53f9c056eb9947db5d16188b0a94e4237c20b07e5', immutable: true,
}, {
  id: 'general-poa-v3', referenceId: 'ts-general-poa-2026-10-v3', instrumentId: 'power_of_attorney', version: '3.0.0', asset: 'general-poa-template-v3.docx', sha256: '88cb8180abd6257a82a94888db4abda301012986fab37833110adb4c1965cb4c', immutable: true,
}, {
  id: 'sale-deed-v11', referenceId: 'ts-sale-2026-10-v2', instrumentId: 'sale', version: '11.0.0', asset: 'sale-deed-template-v11.docx', sha256: '44862d1d352a577c3e2802698f05fa3c1ecefafef7e3c0deeff381ec82842c51', immutable: true,
}, {
  id: 'general-poa-v2', referenceId: 'ts-general-poa-2026-10-v2', instrumentId: 'power_of_attorney', version: '2.0.0', asset: 'general-poa-template-v2.docx', sha256: 'a7575814f0d3bcfe5d7ac1824d5d4dd027526fef117c72b3d0971ab33f416b6e', immutable: true,
}, {
  id: 'agreement-sale-gpa-v3', referenceId: 'ts-agreement-sale-gpa-2026-10-v3', instrumentId: 'agreement_of_sale', version: '3.0.0', asset: 'agreement-sale-gpa-template-v3.docx', sha256: '7ec70b84c8500e1cc684a8543ce8518ef21b5f5351279c000aa13a026be291b5', immutable: true,
}, {
  id: 'gift-deed-v5', referenceId: 'ts-gift-2026-10-v2', instrumentId: 'gift', version: '5.0.0', asset: 'gift-deed-template-v5.docx', sha256: '7c6d481ce7265a68fdbadb0e240c9cf5f663360ce52c0a5773a3b3bec7fe5b4d', immutable: true,
}, {
  id: 'gift-municipal-v2', referenceId: 'ts-gift-municipal-2026-10-v2', instrumentId: 'gift', version: '2.0.0', asset: 'gift-municipal-template-v2.docx', sha256: '99415b8cb24233b54ec5d3e2537ac900c803b8052c63b1a68c8ba94e509b6cc1', immutable: true,
}, {
  id: 'agreement-sale-gpa-v2', referenceId: 'ts-agreement-sale-gpa-2026-10-v2', instrumentId: 'agreement_of_sale', version: '2.0.0', asset: 'agreement-sale-gpa-template-v2.docx', sha256: 'ded0b46a86d88806947d76f03a4ca785a8c906ee58e8881f75ee45eaa32f99e5', immutable: true,
}, {
  id: 'general-poa-v1', referenceId: 'ts-general-poa-2026-10-v1', instrumentId: 'power_of_attorney', version: '1.0.0', asset: 'general-poa-template-v1.docx', sha256: '5981ef17f8b5f0a7162226a1415bd30a71fd42f505214f31aa41b9d6de999a21', immutable: true,
}, {
  id: 'agreement-sale-gpa-v1', referenceId: 'ts-agreement-sale-gpa-2026-10-v1', instrumentId: 'agreement_of_sale', version: '1.0.0', asset: 'agreement-sale-gpa-template-v1.docx', sha256: '599755d4942b9e4c7b7ae5ae747fd2a91a2c7e6360f651436972f1dec5a9e3c7', immutable: true,
}, {
  id: 'gift-municipal-v1', referenceId: 'ts-gift-municipal-2026-10-v1', instrumentId: 'gift', version: '1.0.0', asset: 'gift-municipal-template-v1.docx', sha256: '071791b4e82118beb8d1c26a1fbeebc408ff125d23baed3364986e1915f76fd0', immutable: true,
}, {
  id: 'gift-deed-v4', referenceId: 'ts-gift-2026-10-v1', instrumentId: 'gift', version: '4.0.0', asset: 'gift-deed-template-v4.docx', sha256: 'aa3a7b364bd408393b5611ab13578c0b8a1d2d9b21a52030f8eea009bec161be', immutable: true,
}, {
  id: 'gift-deed-v3', referenceId: 'ts-gift-2026-10-v1', instrumentId: 'gift', version: '3.0.0', asset: 'gift-deed-template-v3.docx', sha256: 'd9ca6d2cf0a686b43364f5298c0de172b46b26346a8cfce71ab60630a6d107c9', immutable: true,
}, {
  id: 'gift-deed-v2', referenceId: 'ts-gift-2026-10-v1', instrumentId: 'gift', version: '2.0.0', asset: 'gift-deed-template-v2.docx', sha256: '61c41669cd57c290ccaf2651fa2f641455069260e12509d04e40b7875b390513', immutable: true,
}, {
  id: 'gift-deed-v1', referenceId: 'ts-gift-2026-10-v1', instrumentId: 'gift', version: '1.0.0', asset: 'gift-deed-template-v1.docx', sha256: 'e1b7eb99701e65ac54716df596056e5437f7832e424982ee387453d8e4df941a', immutable: true,
}, {
  id: 'sale-deed-v10', referenceId: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  version: '10.0.0', asset: 'sale-deed-template-v10.docx', sha256: '24642e1d3c1b4fb94729a9f7eef9cf62bcead225519fb06bd8b7e24eaf10201a', immutable: true,
}, {
  id: 'sale-deed-v9', referenceId: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  version: '9.0.0', asset: 'sale-deed-template-v9.docx', sha256: 'ea509739595087cc5632189516c527a852c93b1d5207cf614f32276e76d42bd5', immutable: true,
}, {
  id: 'sale-deed-v7', referenceId: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  version: '7.0.0', asset: 'sale-deed-template-v7.docx', sha256: 'acde154b7639b1c11048d50d4afe08ca08a2ef341d994e17f933eeab64eaf5a4', immutable: true,
}, {
  id: 'sale-deed-v6', referenceId: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  version: '6.0.0', asset: 'sale-deed-template-v6.docx', sha256: '450ae86e1c327a1cdf6d9525e4b5044bef15c58099f5b8e021b54c5beee85a23', immutable: true,
}, {
  id: 'sale-deed-v5', referenceId: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  version: '5.0.0', asset: 'sale-deed-template-v5.docx', sha256: 'c80aae72d6a01a9004022e78b8df0ad16b35ee739564bb49de39cba8cfce158e', immutable: true,
}, {
  id: 'sale-deed-v4', referenceId: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  version: '4.0.0', asset: 'sale-deed-template-v4.docx', sha256: '2438d11326af53b9e19c8a2b2fb5ce0780e20e6a9b4840b46e01bddced437462', immutable: true,
}, {
  id: 'sale-deed-v3', referenceId: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  version: '3.0.0', asset: 'sale-deed-template.docx', sha256: '1b90862161006e6505b5ad013642b2548169b300e065eb66f1cb9cda507ab9f4', immutable: true,
}, {
  id: 'sale-deed-v2', referenceId: 'ts-sale-2026-09-v1', instrumentId: 'sale',
  version: '2.0.0', asset: 'sale-deed-template-v2.docx', sha256: 'e8b3f35ed6aa8596a01a24ad798c5c17a4dbb5bb5d9713ba2ba101666a5afeb7', immutable: true,
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
