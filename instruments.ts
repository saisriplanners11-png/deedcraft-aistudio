/**
 * Versioned legal-product catalogue.  This is deliberately data, not UI logic:
 * workflow, extraction and rendering code may inspect a definition, but must
 * never infer legal wording for an instrument whose approved reference is absent.
 */
export type InstrumentId =
  | 'sale' | 'gift' | 'will' | 'mortgage' | 'partition' | 'release'
  | 'exchange' | 'lease' | 'power_of_attorney' | 'rectification'
  | 'cancellation' | 'trust' | 'settlement' | 'agreement_of_sale'
  | 'development_agreement_agpa' | 'family_arrangement';

export type LegalReferenceStatus = 'reference-required' | 'under-review' | 'approved' | 'superseded';
export type WorkflowSectionId =
  | 'instrument' | 'sources' | 'jurisdiction' | 'parties' | 'property'
  | 'terms' | 'duties' | 'review' | 'generate';

export interface DeedVariant { id: string; label: string }
export interface PartyRoleDefinition { id: string; label: string; multiple: boolean }
export interface FieldDefinition {
  id: string;
  label: string;
  kind: 'text' | 'date' | 'money' | 'number' | 'boolean' | 'long-text';
  required: boolean;
  legalChoice?: boolean;
}
export interface EvidenceRule { sourceClass: SourceClass; fields: string[] }
export interface ValidationRule { id: string; message: string; severity: 'blocking' | 'review' }
export interface TemplateBinding { field: string; placeholder: string; repeat?: 'party' | 'property' | 'item' }
export interface DeedDefinition {
  id: InstrumentId;
  legacyType: string;
  label: string;
  version: string;
  variants: DeedVariant[];
  roles: PartyRoleDefinition[];
  sections: WorkflowSectionId[];
  fieldSchema: FieldDefinition[];
  evidenceRules: EvidenceRule[];
  validationRules: ValidationRule[];
  templateBindings: TemplateBinding[];
  dutyRuleSetId?: string;
  requiresProperty: boolean;
  requiresConsideration: boolean;
}

export type SourceClass =
  | 'title-record' | 'identity-or-entity' | 'family-record' | 'encumbrance-record'
  | 'tax-or-revenue-record' | 'court-order' | 'prior-instrument'
  | 'financial-record' | 'approval' | 'handwritten-instruction';

const sections: WorkflowSectionId[] = ['instrument', 'sources', 'jurisdiction', 'parties', 'property', 'terms', 'duties', 'review', 'generate'];
const propertyEvidence: EvidenceRule[] = [
  { sourceClass: 'title-record', fields: ['titleChain', 'property'] },
  { sourceClass: 'identity-or-entity', fields: ['parties'] },
  { sourceClass: 'tax-or-revenue-record', fields: ['property', 'marketValue'] },
  { sourceClass: 'handwritten-instruction', fields: [] },
];
const gate: ValidationRule[] = [
  { id: 'approved-reference', message: 'An effective, advocate-approved reference template is required.', severity: 'blocking' },
  { id: 'unresolved-evidence', message: 'Evidence conflicts must be resolved or explicitly accepted before final generation.', severity: 'blocking' },
];
const f = (id: string, label: string, kind: FieldDefinition['kind'] = 'text', required = true, legalChoice = false): FieldDefinition => ({ id, label, kind, required, legalChoice });
const d = (
  id: InstrumentId, legacyType: string, label: string, variants: string[], roles: [string, string, boolean][],
  fields: FieldDefinition[], options: { property?: boolean; consideration?: boolean; duty?: string } = {},
): DeedDefinition => ({
  id, legacyType, label, version: '2026.09.1',
  variants: variants.map(label => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), label })),
  roles: roles.map(([id, label, multiple]) => ({ id, label, multiple })),
  sections: options.property === false ? sections.filter(x => x !== 'property') : sections,
  fieldSchema: fields, evidenceRules: propertyEvidence, validationRules: gate,
  templateBindings: [], dutyRuleSetId: options.duty,
  requiresProperty: options.property !== false, requiresConsideration: !!options.consideration,
});

export const DEED_DEFINITIONS: Record<InstrumentId, DeedDefinition> = {
  sale: d('sale', 'Sale', 'Sale Deed', ['Outright Absolute Sale Deed', 'Sale Deed by GPA Holder', 'Tripartite Sale Deed', 'Staged Consideration', 'Agreement of Sale cum GPA', 'Court Auction Sale'], [['vendor','Vendor / Executant',true],['purchaser','Purchaser / Claimant',true]], [f('consideration','Sale consideration','money'),f('possession','Delivery of possession')], { consideration: true, duty: 'ts.sale' }),
  gift: d('gift', 'Gift', 'Gift Deed', ['Family Gift', 'Non-family Gift', 'Gift to Trust or Charity'], [['donor','Donor',true],['donee','Donee',true]], [f('relationship','Relationship'),f('acceptance','Acceptance by donee'),f('possession','Possession'),f('lifeInterest','Reserved life interest','boolean',false,true),f('revocation','Revocation conditions','long-text',false,true)], { duty: 'ts.gift' }),
  will: d('will', 'Will', 'Will / Testament', ['Individual Will', 'Will with Minor Beneficiary', 'Will with Testamentary Trust'], [['testator','Testator',false],['beneficiary','Beneficiary',true],['executor','Executor',true],['witness','Attesting Witness',true]], [f('capacity','Testamentary capacity'),f('bequests','Specific bequests','long-text'),f('residuaryEstate','Residuary estate','long-text'),f('guardian','Guardian','text',false,true),f('priorWillRevocation','Revocation of prior wills','boolean',true,true)], { property: false }),
  mortgage: d('mortgage', 'Mortgage', 'Mortgage Deed', ['Simple Mortgage', 'Usufructuary Mortgage', 'Deposit of Title Deeds'], [['mortgagor','Mortgagor',true],['mortgagee','Mortgagee',true]], [f('securedAmount','Secured amount','money'),f('interest','Interest'),f('repayment','Repayment terms','long-text'),f('possession','Possession'),f('redemption','Redemption terms','long-text')], { consideration: true, duty: 'ts.mortgage' }),
  partition: d('partition', 'Partition', 'Partition Deed', ['Family Partition', 'Co-owner Partition'], [['coparcener','Co-owner / Coparcener',true]], [f('familyTree','Family tree','long-text'),f('existingShares','Pre-existing shares','long-text'),f('allotments','Allotments','long-text'),f('owelty','Balancing consideration','money',false)], { duty: 'ts.partition' }),
  release: d('release', 'Release', 'Release / Relinquishment Deed', ['Family Release', 'Co-owner Release'], [['releasor','Releasor',true],['releasee','Releasee',true]], [f('sharedRight','Source of shared right','long-text'),f('releasedShare','Released share'),f('releaseConsideration','Consideration','money',false)], { duty: 'ts.release' }),
  exchange: d('exchange', 'Exchange', 'Exchange Deed', ['Property Exchange'], [['firstParty','First Party',true],['secondParty','Second Party',true]], [f('reciprocalProperties','Reciprocal properties','long-text'),f('equalisation','Value equalisation','money',false),f('possession','Possession')], { duty: 'ts.exchange' }),
  lease: d('lease', 'Lease', 'Lease Deed', ['Residential Lease', 'Commercial Lease', 'Agricultural Lease'], [['lessor','Lessor',true],['lessee','Lessee',true]], [f('term','Lease term'),f('rent','Rent','money'),f('deposit','Security deposit','money',false),f('escalation','Escalation', 'text',false),f('permittedUse','Permitted use'),f('termination','Termination','long-text')], { consideration: true, duty: 'ts.lease' }),
  power_of_attorney: d('power_of_attorney', 'GPA/Power of Attorney', 'GPA / Power of Attorney', ['General Power of Attorney', 'Special Power of Attorney', 'Property Power of Attorney'], [['principal','Principal',true],['agent','Agent / Attorney',true]], [f('powers','Enumerated powers','long-text'),f('duration','Duration','text',false),f('delegation','Delegation permitted','boolean',false,true),f('revocation','Revocation','long-text',false,true)], { duty: 'ts.poa' }),
  rectification: d('rectification', 'Rectification', 'Rectification Deed', ['Mutual Rectification'], [['confirmingParty','Confirming Party',true]], [f('originalInstrument','Original registered instrument'),f('erroneousRecital','Erroneous recital','long-text'),f('correctedRecital','Corrected recital','long-text'),f('unchangedConfirmation','Other provisions unchanged','boolean',true,true)], { duty: 'ts.rectification' }),
  cancellation: d('cancellation', 'Cancellation', 'Cancellation Deed', ['Mutual Cancellation', 'Legally Authorized Unilateral Cancellation'], [['cancellingParty','Cancelling / Confirming Party',true]], [f('originalInstrument','Original registered instrument'),f('legalBasis','Legal basis','long-text',true,true),f('refund','Refund consequences','long-text',false),f('possession','Possession consequences','long-text',false)], { duty: 'ts.cancellation' }),
  trust: d('trust', 'Trust', 'Trust Deed', ['Private Family Trust', 'Public Charitable Trust', 'Religious Trust'], [['settlor','Settlor',true],['trustee','Trustee',true],['beneficiary','Beneficiary',true]], [f('objects','Trust objects','long-text'),f('corpus','Initial corpus','money'),f('governance','Governance','long-text'),f('succession','Trustee succession','long-text'),f('dissolution','Dissolution','long-text',false)], { property: false, duty: 'ts.trust' }),
  settlement: d('settlement', 'Settlement', 'Settlement Deed', ['Family Settlement', 'Settlement with Life Interest'], [['settlor','Settlor',true],['beneficiary','Beneficiary',true]], [f('relationship','Relationship'),f('acceptance','Acceptance'),f('lifeInterest','Reserved life interest','boolean',false,true),f('possession','Possession')], { duty: 'ts.settlement' }),
  agreement_of_sale: d('agreement_of_sale', 'Agreement of Sale', 'Agreement of Sale', ['Without Possession', 'With Possession'], [['vendor','Vendor',true],['purchaser','Purchaser',true]], [f('price','Sale price','money'),f('advance','Advance','money'),f('balance','Balance','money'),f('conditionsPrecedent','Conditions precedent','long-text',false),f('completionDate','Completion date','date'),f('default','Default consequences','long-text')], { consideration: true, duty: 'ts.agreement-sale' }),
  development_agreement_agpa: d('development_agreement_agpa', 'Development Agreement/AGPA', 'Development Agreement / AGPA', ['Development Agreement', 'Development Agreement cum GPA'], [['landowner','Landowner',true],['developer','Developer',true]], [f('developmentShare','Development share'),f('areaAllocation','Constructed-area allocation','long-text'),f('milestones','Milestones','long-text'),f('approvals','Approval responsibilities','long-text'),f('salePowers','Sale powers','long-text',false,true)], { consideration: true, duty: 'ts.development-agpa' }),
  family_arrangement: d('family_arrangement', 'Family Arrangement', 'Family Arrangement', ['Memorandum of Family Arrangement', 'Registered Family Arrangement'], [['familyMember','Family Member',true]], [f('familyTree','Family tree','long-text'),f('antecedentRights','Antecedent rights','long-text'),f('allotments','Agreed allotments','long-text'),f('disputeResolution','Dispute resolution','long-text',false)], { duty: 'ts.family-arrangement' }),
};

export const INSTRUMENT_IDS = Object.keys(DEED_DEFINITIONS) as InstrumentId[];
export const definitionFor = (id: InstrumentId) => DEED_DEFINITIONS[id];
export const instrumentIdForLegacyType = (type: string): InstrumentId =>
  INSTRUMENT_IDS.find(id => DEED_DEFINITIONS[id].legacyType === type) || 'sale';
