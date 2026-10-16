import { GROUPS, LINK_OPTIONS, TITLE_SECTION_IDS, PERSON_FIELDS, partyEntityFields, type Group } from './fields';
import { STEPS } from './reference';
export interface FieldPlacement { stepId: string; sectionId: string; anchorFieldId?: string; position: 'before' | 'after' | 'end'; order: number }
export interface PlacementSection { id: string; label: string; scope: string; anchors: { id: string; label: string }[] }
export interface PlacementStep { id: string; index: number; label: string; sections: PlacementSection[] }
const stepIds = ['deed-setup', 'title-enclosures', 'jurisdiction', 'property-schedules', 'market-value', 'payment-details', 'executant-details', 'claimant-details'];
const anchors = (fields: { id: string; label: string; hidden?: boolean }[]) => [...new Map(fields.filter(field => !field.hidden).map(field => [field.id, { id: field.id, label: field.label }])).values()];
const groupIds: Record<string, string> = { 'Jurisdiction': 'jurisdiction', 'Property identification': 'property-identification', 'Boundaries': 'property-boundaries', 'Boundaries of Flat': 'flat-boundaries', 'Structure & Annexure I-A': 'structure-annexure', 'Flat / apartment particulars': 'flat-particulars', 'Market value, consideration & stamp paper': 'market-values' };
const address = (id: string) => /(?:HNo|Locality|Village|Mandal|District|State|PinCode)$/.test(id);
const sections: PlacementSection[][] = stepIds.map(() => []);
sections[0] = [
  { id: 'setup-property', label: 'Property type', scope: 'property', anchors: [{ id: 'category', label: 'Property type' }, { id: 'flatStage', label: 'Flat completion stage' }] },
  { id: 'setup-deed', label: 'Deed & draft form', scope: 'transaction', anchors: [{ id: 'instrumentId', label: 'Deed type' }, { id: 'variantId', label: 'Draft form' }] },
];
sections[1] = TITLE_SECTION_IDS.map(id => LINK_OPTIONS.find(option => option.id === id)!).map(option => ({ id: 'link-' + option.id, label: option.label, scope: 'property', anchors: anchors(option.fields) }));
for (const group of GROUPS) if (groupIds[group.title]) sections[group.step].push({ id: groupIds[group.title], label: group.title, scope: 'property', anchors: anchors(group.fields) });
sections[5] = [{ id: 'payment-records', label: 'Payment records', scope: 'transaction', anchors: anchors([{ id: 'amount', label: 'Amount' }, { id: 'refNo', label: 'Reference number' }, { id: 'bank', label: 'Bank' }, { id: 'branch', label: 'Branch' }, { id: 'date', label: 'Payment date' }, { id: 'payer', label: 'Purchaser' }, { id: 'payee', label: 'Vendor' }]) }];
for (const [role, step] of [['executant', 6], ['claimant', 7]] as const) {
  const fields = GROUPS.find(group => group.step === step)!.fields;
  const entityFields = ['Firm / LLP', 'Society / Association', 'Company', 'Others / HUF'].flatMap(type => partyEntityFields(role, type as any));
  sections[step] = [
    { id: role + '-type', label: 'Party type', scope: role, anchors: anchors(fields.filter(field => field.id.endsWith('PartyType'))) },
    { id: role + '-personal', label: 'Personal details', scope: role, anchors: anchors(fields.filter(field => !address(field.id) && !field.id.endsWith('PartyType'))) },
    { id: role + '-address', label: 'Residential address', scope: role, anchors: anchors(fields.filter(field => address(field.id))) },
    { id: role + '-organisation', label: 'Organisation particulars', scope: role, anchors: anchors(entityFields.filter(field => !/Address/.test(field.id))) },
    { id: role + '-office', label: 'Office and communication addresses', scope: role, anchors: anchors(entityFields.filter(field => /Address/.test(field.id))) },
    { id: role + '-people', label: 'Representatives / members', scope: role, anchors: anchors(PERSON_FIELDS) },
  ];
}
export const PLACEMENT_CATALOG: PlacementStep[] = stepIds.map((id, index) => ({ id, index, label: `Step ${index + 1} — ${STEPS[index].label}`, sections: sections[index] }));
export const placementStepIndex = (placement?: FieldPlacement) => PLACEMENT_CATALOG.find(step => step.id === placement?.stepId)?.index;
export const placementSection = (id: string) => PLACEMENT_CATALOG.flatMap(step => step.sections).find(section => section.id === id);
export function sectionForGroup(group: Group): string | undefined {
  if (group.placementSection) return group.placementSection;
  if (groupIds[group.title]) return groupIds[group.title];
  if (group.step === 6 || group.step === 7) {
    const role = group.step === 6 ? 'executant' : 'claimant';
    if (group.title === 'Party type') return role + '-type';
    if (group.title.startsWith('Residential address')) return role + '-address';
    if (group.title === 'Organisation particulars') return role + '-organisation';
    if (group.title === 'Office and communication addresses') return role + '-office';
    if (group.fields.some(field => field.id.startsWith('person'))) return role + '-people';
    return role + '-personal';
  }
}
export function validatePlacement(input: any): FieldPlacement {
  const step = PLACEMENT_CATALOG.find(step => step.id === input?.stepId);
  const section = step?.sections.find(section => section.id === input?.sectionId);
  if (!section) throw new Error('Choose a valid dashboard step and section for this field.');
  if (!['before', 'after', 'end'].includes(input.position) || !Number.isSafeInteger(input.order) || input.order < 0 || input.order > 10000) throw new Error('Choose a valid field position and display order.');
  if (input.position !== 'end' && !section.anchors.some(anchor => anchor.id === input.anchorFieldId)) throw new Error('Choose an existing field in the selected section as the placement anchor.');
  if (input.position === 'end' && input.anchorFieldId) throw new Error('End-of-section placement cannot have an anchor.');
  return { stepId: step!.id, sectionId: section.id, position: input.position, order: input.order, ...(input.position !== 'end' ? { anchorFieldId: input.anchorFieldId } : {}) };
}
export const placementOrder = (a: { id: string; placement?: FieldPlacement }, b: { id: string; placement?: FieldPlacement }) => (a.placement?.order || 0) - (b.placement?.order || 0) || a.id.localeCompare(b.id);
export interface PlacementHost { sectionId: string; anchorFieldId?: string; position: 'before' | 'after' | 'end'; scope: string; recordId: string }
export function matchingHosts<T extends PlacementHost>(hosts: T[], placement: FieldPlacement, record: { scope: string; id: string; sourceRecordId?: string }): T[] {
  const matches = hosts.filter(host => host.sectionId === placement.sectionId && host.position === placement.position && host.anchorFieldId === placement.anchorFieldId);
  return placementSection(placement.sectionId)?.scope === record.scope ? matches.filter(host => host.scope === record.scope && (host.recordId === record.id || host.recordId === record.sourceRecordId)) : matches;
}
