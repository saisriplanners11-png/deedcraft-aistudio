import { isMinorParty, minorPartyErrors } from './minor-parties';
import { ageFrom, todayISO } from './party-age';
import { acreGuntasToSqYards } from './land-area';
import { isMunicipalGift } from './municipal-gift';
import { stepsFor, adjacentWorkflowStep, normalizeWorkflowStep } from './workflow-steps';
import { isEntity, entityRequiredFields, activePartyFields, partyDisplayName } from './party-entities';
import { flatStage, flatLabel } from './flat-options';
// Derives everything the UI shows from what the user has actually entered.
// There is no seeded record: a field is blank until someone types into it, and
// anything computed from a blank field reads as blank too, never as zero.

import { STEPS, DEEDS, DRAFTS, CATEGORIES, RULES } from './reference';
import { placementStepIndex } from './template-placement';
import type { TemplateFieldInstance } from './template-field-values';
import { ALL_FIELDS, EMPTY_FORM, FLAT_BOUNDARY_FIELDS, FLAT_SCHEDULE_FIELDS, SCHEDULE_VARIANT, groupsForStep, type PartyPeople, type PartyType, type StructureDetails } from './fields';
import type { DocKind } from './extract';
import { newPayment, totalOf, netTotalOf, tdsTotalOf, recitalFor, type Payment } from './payments';
import { instrumentIdForLegacyType } from './instruments';
import { releaseGate } from './legal-registry';


export type UploadedDoc = {
  id: string;
  name: string;
  ext: string;
  sizeLabel: string;
  addedAt: string;
  kind: string;
  /** What the document contributed, once it has been read. */
  summary?: string;
};

/** A value the document disagrees with the user about. The typed value stands. */
export type Conflict = { value: string; kind: DocKind; docName: string };
export type FieldEvidence = { kind: DocKind; docName: string; verification: 'transcribed' | 'manual' };
export type MissingDetail = {
  id: string;
  label: string;
  reason: string;
  source: string;
  step: number;
};

export type ValueRecord = {
  id: string;
  values: Record<string, string>;
  docNames: string[];
};

export type ScheduleRecord = ValueRecord & {
  category: string;
  unit: string;
  structureDetails?: StructureDetails;
};

export type SupportingRecord = {
  id: string;
  /** `primary` or the id of an additional property schedule. */
  scheduleId: string;
  docName: string;
  values: Record<string, string>;
};

/** Manually assigned ownership percentages, by schedule and party id. */
export type VendeeSharesBySchedule = Record<string, Record<string, string>>;

/** Percentages are stored to two decimal places so totals can be exact. */
export function vendeeShareCents(value: string): number | null {
  const clean = value.trim();
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents > 0 && cents <= 10000 ? cents : null;
}

import type { SaleDocument, SaleAuthority } from './sale-options';

export type AppState = {
  saleDocument?: SaleDocument;
  saleAuthority?: SaleAuthority;
  /** Explicitly unresolved fields must never be silently reconstructed by a fallback. */
  unresolvedFields?: string[];
  step: number;
  statePreset: string;
  deedType: string;
  category: string;
  draft: string;
  unit: string;
  form: Record<string, string>;
  docs: UploadedDoc[];
  /** Schedule prose, when the user has composed or generated one. */
  scheduleText: string;
  /** Which uploaded document supplied each field, for provenance tags. */
  fieldSource: Record<string, DocKind>;
  /** Exact accepted source behind each field, used by the final field audit. */
  fieldEvidence: Record<string, FieldEvidence>;
  /** Fields where a document disagrees with something already typed. */
  conflicts: Record<string, Conflict>;
  /** The instruments discharging the consideration, in the order recited. */
  payments: Payment[];
  /** Additional records; the original form remains record 1 for compatibility. */
  additionalLinkDocuments: ValueRecord[];
  /** Link/title records grouped by their owning property schedule. */
  linkRecordsBySchedule: Record<string, ValueRecord[]>;
  additionalExecutants: ValueRecord[];
  additionalClaimants: ValueRecord[];
  partyPeopleByParty?: Record<string, PartyPeople>;
  primaryClaimantId?: string;
  primaryExecutantId?: string;
  additionalSchedules: ScheduleRecord[];
  vendeeSharesBySchedule?: VendeeSharesBySchedule;
  vendorSharesBySchedule?: VendeeSharesBySchedule;
  /** Uploaded evidence recited only in the property schedule it supports. */
  supportingRecords: SupportingRecord[];
  /** Repeatable Annexure I-A structure rows, keyed by property schedule id. */
  structureDetailsBySchedule: Record<string, StructureDetails>;
};

export const UNITS = ['Sq. Yards', 'Sq. Feet', 'Sq. Meters', 'Guntas', 'Acres', 'Cents'];

/** Blank state retained for tests and new-draft construction. */
export const initialState: AppState = {
  step: -1,
  statePreset: 'Telangana (TS)',
  deedType: '',
  category: '',
  draft: '',
  unit: 'Sq. Yards',
  form: { ...EMPTY_FORM },
  docs: [],
  scheduleText: '',
  fieldSource: {},
  fieldEvidence: {},
  conflicts: {},
  payments: [newPayment()],
  additionalLinkDocuments: [],
  linkRecordsBySchedule: {},
  additionalExecutants: [],
  additionalClaimants: [],
  additionalSchedules: [],
  vendeeSharesBySchedule: {},
  vendorSharesBySchedule: {},
  supportingRecords: [],
  structureDetailsBySchedule: {},
};

/** Workflow defaults only. Customer facts always start empty. */
export const defaultDraftState: AppState = {
  ...initialState, deedType: 'Sale', draft: 'Outright Absolute Sale Deed',
  form: { ...EMPTY_FORM }, payments: [],
};

let recordSeq = 0;
export const newValueRecord = (): ValueRecord => ({
  id: `record-${Date.now()}-${recordSeq++}`,
  values: {},
  docNames: [],
});

export const newScheduleRecord = (category: string, unit: string): ScheduleRecord => ({
  ...newValueRecord(),
  category: category || 'Vacant Plot',
  unit: unit || 'Sq. Yards',
});

export const newSupportingRecord = (
  scheduleId: string,
  docName: string,
  values: Record<string, string>,
): SupportingRecord => ({
  id: `support-${Date.now()}-${recordSeq++}`,
  scheduleId,
  docName,
  values,
});

export function mergeRecordValues(record: ValueRecord, values: Record<string, string>, docName = '') {
  const next = { ...record.values };
  const filled: string[] = [];
  const agreed: string[] = [];
  const conflicted: string[] = [];
  for (const [id, value] of Object.entries(values)) {
    const current = (next[id] || '').trim();
    if (!current) {
      next[id] = value;
      filled.push(id);
    } else if (current.toLowerCase() === value.trim().toLowerCase()) {
      agreed.push(id);
    } else {
      conflicted.push(id);
    }
  }
  return {
    record: {
      ...record,
      values: next,
      docNames: docName && !record.docNames.includes(docName) ? [...record.docNames, docName] : record.docNames,
    },
    filled,
    agreed,
    conflicted,
  };
}

const picked = (form: Record<string, string>, ids: string[]) =>
  Object.fromEntries(ids.map(id => [id, form[id] || '']));

export const partyRecords = (state: AppState, side: 'executant' | 'claimant') => {
  const ids = ALL_FIELDS.filter(field => field.id.startsWith(side)).map(field => field.id);
  const primary: ValueRecord = { id: `${side}-primary`, values: picked(state.form, ids), docNames: [] };
  return [primary, ...(side === 'executant' ? state.additionalExecutants : state.additionalClaimants)];
};

export const linkDocumentRecords = (state: AppState) => {
  const ids = ['linkDocType', 'linkDocNo', 'linkDocDate', 'linkSro'];
  const primary: ValueRecord = { id: 'link-primary', values: picked(state.form, ids), docNames: [] };
  return [primary, ...state.additionalLinkDocuments];
};

/** Link/title records owned by exactly one property schedule. Legacy records belong to Schedule 1. */
export const linkDocumentRecordsForSchedule = (state: AppState, scheduleId: string): ValueRecord[] => {
  const scoped = state.linkRecordsBySchedule[scheduleId];
  if (scoped) return scoped;
  return scheduleId === 'primary' ? linkDocumentRecords(state) : [];
};

export const scheduleRecords = (state: AppState): ScheduleRecord[] => {
  const ids = [...JURISDICTION_IDS, ...PROPERTY_IDS, ...BOUNDARY_IDS, ...STRUCTURE_IDS, ...VALUATION_IDS];
  const primary: ScheduleRecord = {
    id: 'primary',
    values: picked(state.form, ids),
    docNames: [],
    category: state.category,
    unit: state.unit,
    structureDetails: state.structureDetailsBySchedule.primary,
  };
  return [primary, ...state.additionalSchedules.map(record => ({ ...record, structureDetails: state.structureDetailsBySchedule[record.id] }))];
};

export const supportingRecordsForSchedule = (state: AppState, scheduleId: string) =>
  state.supportingRecords.filter(record => record.scheduleId === scheduleId);

const JURISDICTION_IDS = ['propState', 'district', 'mandal', 'village', 'locality', 'pinCode', 'sro', 'districtRegistrar'];
const PROPERTY_IDS = ['localAuthorityType', 'plotNo', 'bearingHNo', 'nearAdjacent', 'nearHNo', 'landmarkHNo', 'assessmentPtinNo', 'surveyNo', 'extentSqYards', 'extentSqMeters', ...FLAT_SCHEDULE_FIELDS, ...FLAT_BOUNDARY_FIELDS, ...ALL_FIELDS.filter(field => field.only?.includes('Flat')).map(field => field.id)];
const BOUNDARY_IDS = ['boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest'];
const STRUCTURE_IDS = ['houseStage', 'bltNo', 'roofMaterial', 'constructionDescription', 'taxesPerAnnum', 'annualRentalValue', 'tapConnectionNo', 'metersNo'];
const VALUATION_IDS = ['govtRate', 'structValue'];

const SQ_YARD: Record<string, number> = {
  'Sq. Yards': 1,
  'Sq. Feet': 1 / 9,
  'Sq. Meters': 1.19599,
  Guntas: 121,
  Acres: 4840,
  Cents: 48.4,
};

export const toSqYards = (v: any, unit: string) => (Number(v) || 0) * (SQ_YARD[unit] ?? 1);

/** ₹ with Indian grouping. Blank in, blank out — never "₹0" for a field nobody filled. */
export function money(v: any): string {
  if (v === '' || v === null || v === undefined || Number.isNaN(Number(v))) return '';
  return '₹' + Number(Math.round(Number(v))).toLocaleString('en-IN');
}

export function words(num: any): string {
  const n0 = Math.round(Number(num) || 0);
  if (!n0) return '';
  const s = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n: number): string => (n < 20 ? s[n] : t[Math.floor(n / 10)] + (n % 10 ? ' ' + s[n % 10] : ''));
  const three = (n: number): string =>
    (Math.floor(n / 100) ? s[Math.floor(n / 100)] + ' Hundred ' : '') + (n % 100 ? two(n % 100) : '');
  let w = '';
  let n = n0;
  const cr = Math.floor(n / 10000000); n %= 10000000;
  const la = Math.floor(n / 100000); n %= 100000;
  const th = Math.floor(n / 1000); n %= 1000;
  if (cr) w += two(cr) + ' Crore ';
  if (la) w += two(la) + ' Lakh ';
  if (th) w += two(th) + ' Thousand ';
  if (n) w += three(n) + ' ';
  return (w.trim() + ' Rupees Only').replace(/\s+/g, ' ');
}

/** Duty rates for the selected state and deed type. */
export function dutyRates(statePreset: string, deedType: string) {
  const st: any = (RULES as any)[statePreset] || (RULES as any)['Telangana (TS)'];
  return st.by[deedType] || st.def;
}

const num = (v: any) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const has = (v: any) => v !== '' && v !== null && v !== undefined;

const FIELD_STEPS: Record<string, number> = Object.fromEntries(
  GROUPS_FOR_MISSING().flatMap(group => group.fields.map((field: any) => [field.id, group.step]))
);

function GROUPS_FOR_MISSING() {
  return [
    ...groupsForStep(1, 'Vacant Plot'), ...groupsForStep(2, 'Vacant Plot'),
    ...groupsForStep(3, 'Residential'), ...groupsForStep(3, 'Flat'), ...groupsForStep(4, 'Vacant Plot'),
    ...groupsForStep(6, 'Vacant Plot'), ...groupsForStep(7, 'Vacant Plot'),
  ];
}

const fieldLabel = (id: string) => ALL_FIELDS.find(field => field.id === id)?.label ?? id;

/**
 * The values that must be known before generating a registration-ready sale
 * deed. Optional contact data is intentionally excluded; fields needed by the
 * selected template variant are included.
 */
export function generationBlockers(state: AppState): MissingDetail[] {
  const f = state.form;
  const missing: MissingDetail[] = [];
  const displayLabel = (id: string) => {
    const base = fieldLabel(id);
    if (id.startsWith('executant')) return `Executant: ${base}`;
    if (id.startsWith('claimant')) return `Claimant: ${base}`;
    return base;
  };
  const add = (id: string, reason: string, source: string, step = FIELD_STEPS[id] ?? 0) => {
    if (!has(f[id]) && !missing.some(item => item.id === id)) {
      missing.push({ id, label: displayLabel(id), reason, source, step });
    }
  };
  const addStructureDetails = (details: StructureDetails | undefined, label: string, step: number) => {
    const rows = details?.rows || [];
    const total = Number(details?.totalFloors);
    const valid = Number.isInteger(total) && total > 0 && rows.length > 0 && rows.length <= total && rows.every(row =>
      has(row.floorNo) && has(row.structureType) && has(row.stage) && has(row.buildingAge) && has(row.builtUpAreaSqFt) &&
      (row.structureType !== 'Other / Custom Structure' || has(row.customStructureType))
    );
    if (!valid) missing.push({
      id: `structureDetails-${step}-${label}`, label,
      reason: 'Annexure I-A requires complete floor details within the declared total floors.',
      source: 'Property-tax record, plan, house document or manual entry.', step,
    });
  };

  const legalGate = releaseGate(instrumentIdForLegacyType(state.deedType));
  if (!legalGate.ready) missing.push({ id: 'legalReference', label: `${state.deedType || 'Selected'} deed reference`, reason: legalGate.reasons.join(' '), source: 'Approved reference DOCX and legal sign-off.', step: 0 });
  if (!state.category) missing.push({ id: 'category', label: 'Schedule 1 property type', reason: 'Selects the legal schedule included in the deed.', source: 'Property plan, prior deed or manual selection.', step: 1 });
  if (!state.draft) missing.push({ id: 'draft', label: 'Draft form', reason: 'Identifies the sale-deed form.', source: 'Manual selection after document classification.', step: 0 });

  [
    ['linkDocType', 'Title flow must identify the prior instrument.', 'Link/title deed'],
    ['linkDocNo', 'Title flow must identify the registered document number.', 'Link/title deed'],
    ['linkDocDate', 'Title flow must identify the prior document date.', 'Link/title deed'],
    ['linkSro', 'Title flow must name the registering office.', 'Link/title deed'],
    ['propState', 'Registration jurisdiction must be known.', 'Link deed or property record'],
    ['district', 'Registration jurisdiction must be known.', 'Link deed or property record'],
    ['mandal', 'Registration jurisdiction must be known.', 'Link deed or property record'],
    ['village', 'Registration jurisdiction must be known.', 'Link deed or property record'],
    ['locality', 'The property schedule names the locality.', 'Link deed or property plan'],
    ['pinCode', 'The property schedule names the PIN code.', 'Link deed or address/property record'],
    ['sro', 'The property schedule names the registration sub-district.', 'Link deed or registration record'],
    ['districtRegistrar', 'The property schedule names the registration district.', 'Link deed or registration record'],
    ['plotNo', 'The selected template schedule identifies the plot number.', 'Link deed or property plan'],
    ['surveyNo', 'The selected template schedule identifies survey number(s).', 'Link deed or property plan'],
    ['extentSqYards', 'The selected template schedule requires the property extent in Sq. Yards.', 'Link deed or property plan'],
    ['boundaryNorth', 'All four property boundaries are required.', 'Link deed or property plan'],
    ['boundarySouth', 'All four property boundaries are required.', 'Link deed or property plan'],
    ['boundaryEast', 'All four property boundaries are required.', 'Link deed or property plan'],
    ['boundaryWest', 'All four property boundaries are required.', 'Link deed or property plan'],
    ['govtRate', 'Market value and stamp duty require the basic rate.', 'Government basic-value record'],
    ['consid', 'The sale deed must state the consideration.', 'Sale agreement or payment proof'],
    ['stampValue', 'The deed header states the face value of the stamp paper.', 'Stamp paper or manual entry'],
  ].forEach(([id, reason, source]) => add(id, reason, source));

  if (['Vacant Plot', 'Open Place', 'Agricultural land', 'Demolished', 'Part open place'].includes(state.category)) {
    add('nearHNo', ['Demolished', 'Part open place'].includes(state.category)
      ? 'The selected schedule identifies the subject property house number.'
      : 'The selected schedule identifies the nearby/adjacent house number.', 'Link deed or property plan');
  }
  if (['Vacant Plot', 'Open Place', 'Agricultural land'].includes(state.category)) {
    add('nearAdjacent', 'Choose whether the landmark house number is near or adjacent to the property.', 'Link deed or property plan');
  }
  if (f.nearHNo && !['Demolished', 'Part open place'].includes(state.category)) add('nearAdjacent', 'Choose whether the entered landmark house number is near or adjacent to the property.', 'Link deed or property plan');
  if (f.landmarkHNo && ['Demolished', 'Part open place'].includes(state.category)) add('nearAdjacent', 'Choose Near or Adjacent for the separately entered landmark house.', 'Link deed or property plan');
  if (['Residential', 'Commercial'].includes(state.category)) {
    ['bearingHNo', 'bltNo', 'roofMaterial', 'constructionDescription', 'taxesPerAnnum', 'annualRentalValue', 'tapConnectionNo', 'metersNo']
      .forEach(id => add(id, 'The selected house schedule and Annexure I-A require this value.', 'Property-tax record, plan or house document'));
    addStructureDetails(state.structureDetailsBySchedule.primary, 'Structure Details', 3);
  }
  if (state.category === 'Flat') {
    ['roofMaterial', 'constructionDescription', 'taxesPerAnnum', 'annualRentalValue'].forEach(id => add(id, 'The flat Annexure I-A requires this value.', 'Flat property record or manual entry.'));
    if (flatStage(f.flatStage) === 'Finished') add('bearingHNo', 'The finished-flat schedule names its municipal house numbers.', 'Flat title record or municipal record.');
    if (flatStage(f.flatStage) === 'Semi-Finished') { add('nearHNo', 'The semi-finished schedule identifies the nearby/adjacent house.', 'Flat title record or plan.'); add('nearAdjacent', 'Choose Near or Adjacent for the landmark house.', 'Flat title record or plan.'); }
    if (f.flatStage && !flatStage(f.flatStage)) missing.push({ id: 'flat-stage-choice', label: 'Flat completion option', reason: 'Choose Finished Flat or Semi-finished Flat; the saved stage is retained until you choose.', source: 'Deed setup or flat particulars.', step: 0 });
    FLAT_SCHEDULE_FIELDS.forEach(id => add(id, 'The Flat schedule requires this detail.', 'Flat title record, apartment record or manual entry.', 3));
    FLAT_BOUNDARY_FIELDS.forEach(id => add(id, 'All four boundaries of the individual flat are required.', 'Flat plan, apartment record or manual entry.', 3));
  }

  const addRecordField = (record: ValueRecord, id: string, label: string, reason: string, source: string, step: number) => {
    if (!has(record.values[id])) missing.push({ id: `${record.id}-${id}`, label, reason, source, step });
  };
  state.additionalLinkDocuments.forEach((record, index) => {
    for (const id of ['linkDocType', 'linkDocNo', 'linkDocDate', 'linkSro']) {
      addRecordField(record, id, `Link document ${index + 2}: ${fieldLabel(id)}`, 'Every linked title document must be recited completely.', 'Linked/title deed or manual entry.', 1);
    }
  });
  for (const side of ['executant', 'claimant'] as const) {
    if (side === 'claimant' && isMunicipalGift(state)) continue;
    partyRecords(state, side).forEach((record, index) => {
      const values = record.values;
      const id = index === 0 ? (side === 'executant' ? state.primaryExecutantId : state.primaryClaimantId) || 'primary' : record.id;
      const step = side === 'executant' ? 6 : 7;
      const entity = isEntity(values, side);
      const required = entity ? entityRequiredFields(side, values[side + 'PartyType'] as PartyType) : ['Name', 'Relation', 'RelativeName', 'Dob', 'Occupation', 'Aadhaar', 'HNo', 'Village', 'Mandal', 'District', 'State', 'PinCode'].map(suffix => side + suffix);
      if (isMinorParty(values, side) || ((values[side + 'PartyType'] || '').startsWith('Guardian') && !!values[side + 'WardName'])) {
        const occupationIndex = required.indexOf(side + 'Occupation'); if (occupationIndex >= 0) required.splice(occupationIndex, 1);
        for (const [errorIndex, reason] of minorPartyErrors(values, side).entries()) missing.push({ id: side + '-' + id + '-minor-' + errorIndex, label: 'Minor ' + (index + 1) + ' / guardian', reason, source: 'Guardian ID and court permission where required.', step });
      }
      if (Number(f.consid) >= 5000000) required.push(side + (entity ? 'EntityPan' : 'Pan'));
      required.forEach(field => {
        if (index === 0) add(field, 'Complete the active party particulars.', 'Party document or manual entry.', step);
        else addRecordField(record, field, (side === 'executant' ? 'Executant' : 'Claimant') + ' ' + (index + 1) + ': ' + fieldLabel(field), 'Complete the active party particulars.', 'Party document or manual entry.', step);
      });
      if (entity) {
        const people = state.partyPeopleByParty?.[side + '|' + id];
        if (!people?.representatives.length) missing.push({ id: side + '-' + id + '-representatives', label: 'Authorised representative required', reason: 'Add a person authorised to represent this organisation.', source: 'Authorization or resolution.', step });
        for (const [i, person] of (people?.representatives || []).entries()) for (const field of ['name', 'relation', 'relationName', 'designation', 'dob', 'mobile', 'hNo', 'village', 'mandal', 'district', 'state', 'pinCode'] as const) {
          if (!person[field]) missing.push({ id: person.id + '-' + field, label: 'Representative ' + (i + 1) + ': ' + field, reason: 'Complete the representative particulars.', source: 'ID / authorization or manual entry.', step });
        }
      }
    });
  }
  for (const side of ['executant', 'claimant'] as const) {
  if (side === 'claimant' && isMunicipalGift(state)) continue;
  const parties = partyRecords(state, side);
  const vendor = side === 'executant';
  const label = vendor ? 'Vendor' : 'Vendee';
  const key = vendor ? 'vendor' : 'vendee';
  const shares = vendor ? state.vendorSharesBySchedule : state.vendeeSharesBySchedule;
  if (parties.length) scheduleRecords(state).forEach((schedule, scheduleIndex) => {
    if (!parties.some((party, index) => shares?.[schedule.id]?.[index === 0 ? (vendor ? state.primaryExecutantId : state.primaryClaimantId) || 'primary' : party.id]?.trim())) return;
    parties.forEach((party, index) => {
      const partyId = index === 0 ? (vendor ? state.primaryExecutantId : state.primaryClaimantId) || 'primary' : party.id;
      const value = shares?.[schedule.id]?.[partyId] || '';
      if (!value.trim()) return;
      const cents = vendeeShareCents(value);
      if (cents === null) {
        missing.push({
          id: `${key}-share-${schedule.id}-${partyId}`,
          label: `Schedule ${scheduleIndex + 1}: ${label} ${index + 1} undivided share`,
          reason: value ? 'Enter a percentage greater than 0 and no more than 100, with at most two decimal places.' : `Enter this ${label.toLowerCase()}’s undivided ownership percentage.`,
          source: 'Agreed ownership allocation entered by the drafter.', step: vendor ? 6 : 7,
        });
      }
    });

  });
  }
  state.additionalSchedules.forEach((record, index) => {
    const ids = ['propState', 'district', 'mandal', 'village', 'locality', 'pinCode', 'sro', 'districtRegistrar', 'plotNo', 'surveyNo', 'extentSqYards', ...BOUNDARY_IDS, 'govtRate'];
    if (['Vacant Plot', 'Open Place', 'Agricultural land', 'Demolished', 'Part open place'].includes(record.category)) ids.push('nearHNo');
    if (['Vacant Plot', 'Open Place', 'Agricultural land'].includes(record.category) || (record.values.nearHNo && !['Demolished', 'Part open place'].includes(record.category))) ids.push('nearAdjacent');
    if (['Residential', 'Commercial'].includes(record.category)) {
      ids.push('bearingHNo', 'bltNo', 'roofMaterial', 'constructionDescription', 'taxesPerAnnum', 'annualRentalValue', 'tapConnectionNo', 'metersNo');
      addStructureDetails(state.structureDetailsBySchedule[record.id], `Schedule ${index + 2}: Structure Details`, 3);
    }
    if (record.category === 'Flat') {
      ['roofMaterial', 'constructionDescription', 'taxesPerAnnum', 'annualRentalValue', ...(flatStage(record.values.flatStage) === 'Finished' ? ['bearingHNo'] : flatStage(record.values.flatStage) === 'Semi-Finished' ? ['nearHNo', 'nearAdjacent'] : [])].forEach(id => addRecordField(record, id, `Schedule ${index + 2}: ${fieldLabel(id)}`, 'The selected flat schedule and Annexure require this value.', 'Flat property record or manual entry.', 3));
      if (record.values.flatStage && !flatStage(record.values.flatStage)) missing.push({ id: record.id + '-flat-stage-choice', label: `Schedule ${index + 2}: Flat completion option`, reason: 'Choose Finished Flat or Semi-finished Flat.', source: 'Property type selection.', step: 3 });
      [...FLAT_SCHEDULE_FIELDS, ...FLAT_BOUNDARY_FIELDS].forEach(id =>
        addRecordField(record, id, `Schedule ${index + 2}: ${fieldLabel(id)}`, 'The Flat schedule requires this detail.', 'Flat title record, apartment record or manual entry.', 3));
    }
    ids.forEach(id => addRecordField(record, id, `Schedule ${index + 2}: ${fieldLabel(id)}`, 'Every property schedule must be complete before combined registration.', 'Link deed, property record, plan or manual entry.', 3));
  });

  if (!state.payments.some(payment => has(payment.amount))) {
      missing.push({ id: 'payment', label: 'Payment details', reason: 'The receipt clause must state how the consideration was paid.', source: 'Cheque, housing-loan disbursement, DD, transfer/UPI receipt or payment acknowledgement.', step: 5 });
  } else {
    state.payments.filter(payment => has(payment.amount)).forEach((payment, index) => {
      const fields = payment.mode === 'through-bank'
        ? ['amount', 'payer', 'payee']
        : payment.mode === 'cash'
        ? ['amount', 'date', 'payer', 'payee']
        : payment.mode === 'housing-loan'
        ? ['amount', 'bank', 'branch', 'refNo', 'date', 'payer', 'payee']
        : payment.mode === 'upi'
        ? ['amount', 'refNo', 'bank', 'date', 'payer', 'payee']
        : ['amount', 'refNo', 'bank', 'branch', 'date', 'payer', 'payee'];
      fields.forEach(name => {
        if (!has((payment as any)[name])) {
          missing.push({ id: `payment-${payment.id}-${name}`, label: `Payment ${index + 1}: ${name === 'payer' ? 'Vendee' : name === 'payee' ? 'Vendor' : name}`, reason: 'The receipt clause requires a complete payment record.', source: 'Payment instrument or manual entry.', step: 5 });
        }
      });
    });
  }
  for (const id of Object.keys(state.conflicts)) {
    if (isMunicipalGift(state) && id.startsWith('claimant')) continue;
    missing.push({ id: `conflict-${id}`, label: displayLabel(id), reason: 'Uploaded documents disagree about this value.', source: 'Review and choose the correct source value.', step: FIELD_STEPS[id] ?? (id.startsWith('executant') ? 6 : id.startsWith('claimant') ? 7 : 0) });
  }
  const invalid = (id: string, reason: string, step: number) => {
    if (!missing.some(item=>item.id===id)) missing.push({id,label:displayLabel(id),reason,source:'Correct or manually enter the verified value.',step});
  };
  const positive = (value: string | number) => !!value && Number.isFinite(Number(value)) && Number(value)>0;
  if (!positive(f.extentSqYards)) invalid('extentSqYards','A positive verified extent in Sq. Yards is required.',3);
  if (!positive(f.govtRate)) invalid('govtRate','A positive basic rate is required to calculate market value.',3);
  if (f.structValue && (!Number.isFinite(Number(f.structValue)) || Number(f.structValue)<0)) invalid('structValue','Structure valuation must be a valid non-negative amount.',3);
  if (['Residential','Commercial','Flat'].includes(state.category)) add('structValue','A structure valuation is required for this category.','Valuation record or manual entry',3);
  if (!positive(f.consid)) invalid('consid','Final consideration must be a positive valid amount.',3);
  if (state.payments.some(p=>!positive(p.amount))) invalid('payment-total','Every payment amount must be positive and valid.',4);
  const total = state.payments.reduce((sum,p)=>sum+(Number(p.amount)||0),0);
  if (positive(f.consid) && state.payments.length && Math.round(total*100)!==Math.round(Number(f.consid)*100)) {
    invalid('payment-total',total>Number(f.consid)?'Payments exceed final consideration.':'Payments must exactly equal final consideration before generation.',4);
  }
  return missing;
}

export { deedDate } from './deed-format';

export { ageFrom, todayISO } from './party-age';

/** Legal-party identity values are displayed and generated in deed-style capitals. */
export function uppercasePartyIdentity(field: string, value: string): string {
  return /^(?:(?:executant|claimant)(?:Name|RelativeName|EntityName|GuardianName|GuardianRelativeName)|person(?:Name|RelationName))$/.test(field)
    ? value.toLocaleUpperCase('en-IN')
    : value;
}

/**
 * Values the form works out for itself.
 *
 * A complete DOB owns age, recalculated as of today even for restored drafts.
 * A manually entered age is used only without DOB. Extent (Sq. Meters)
 * follows Extent (Sq. Yards) the same way. A field with nothing to compute
 * from keeps whatever was typed into it.
 */
export function withDerived(form: Record<string, string>): Record<string, string> {
  const out = { ...form };
  for (const side of ['executant', 'claimant'] as const) {
    const ageKey = `${side}Age`;
    const age = ageFrom(out[`${side}Dob`] ?? '', todayISO());
    if (out[`${side}Dob`]) out[ageKey] = age;
  }
  const nala = acreGuntasToSqYards(out.nalaExtent || '');
  if (nala !== null) out.convertedExtentText = String(nala);
  const sqYards = Number(out.extentSqYards);
  if (out.extentSqYards && Number.isFinite(sqYards)) {
    out.extentSqMeters = String(Math.round(sqYards * 0.836127 * 100) / 100);
  }
  return out;
}

export type ApplyResult = {
  patch: Partial<AppState>;
  filled: string[];
  conflicted: string[];
  /** Fields the document confirmed — same value already present. */
  agreed: string[];
};

/**
 * Merge extracted values into the form.
 *
 * Empty field   -> filled, and tagged with the document that supplied it.
 * Same value    -> nothing to do; counted as confirmation.
 * Different     -> the typed value stands and a conflict is recorded for review.
 * Nothing typed by the user is ever overwritten.
 */
export function applyExtraction(
  state: AppState,
  kind: DocKind,
  values: Record<string, string>,
  docName: string
): ApplyResult {
  const form = { ...state.form };
  const fieldSource = { ...state.fieldSource };
  const fieldEvidence = { ...state.fieldEvidence };
  const conflicts = { ...state.conflicts };
  const filled: string[] = [];
  const conflicted: string[] = [];
  const agreed: string[] = [];

  for (const [id, value] of Object.entries(values)) {
    const current = (form[id] ?? '').trim();
    if (!current) {
      form[id] = value;
      fieldSource[id] = kind;
      fieldEvidence[id] = { kind, docName, verification: 'transcribed' };
      delete conflicts[id];
      filled.push(id);
    } else if (current.toLowerCase() === value.trim().toLowerCase()) {
      agreed.push(id);
    } else {
      conflicts[id] = { value, kind, docName };
      conflicted.push(id);
    }
  }

  return { patch: { form: withDerived(form), fieldSource, fieldEvidence, conflicts }, filled, conflicted, agreed };
}

/** Take the document's value for one conflicted field. */
export function acceptConflict(state: AppState, id: string): Partial<AppState> {
  const c = state.conflicts[id];
  if (!c) return {};
  const conflicts = { ...state.conflicts };
  delete conflicts[id];
  return {
    form: withDerived({ ...state.form, [id]: c.value }),
    fieldSource: { ...state.fieldSource, [id]: c.kind },
    fieldEvidence: { ...state.fieldEvidence, [id]: { kind: c.kind, docName: c.docName, verification: 'transcribed' } },
    conflicts,
  };
}

/** Take the document's value for every conflicted field in `ids` (all, if omitted). */
export function acceptConflicts(state: AppState, ids?: string[]): Partial<AppState> {
  const target = ids ?? Object.keys(state.conflicts);
  const form = { ...state.form };
  const fieldSource = { ...state.fieldSource };
  const fieldEvidence = { ...state.fieldEvidence };
  const conflicts = { ...state.conflicts };
  for (const id of target) {
    const c = conflicts[id];
    if (!c) continue;
    form[id] = c.value;
    fieldSource[id] = c.kind;
    fieldEvidence[id] = { kind: c.kind, docName: c.docName, verification: 'transcribed' };
    delete conflicts[id];
  }
  return { form: withDerived(form), fieldSource, fieldEvidence, conflicts };
}

/** Discard the document's suggestion, keeping what is typed. */
export function dismissConflicts(state: AppState, ids?: string[]): Partial<AppState> {
  const target = ids ?? Object.keys(state.conflicts);
  const conflicts = { ...state.conflicts };
  for (const id of target) delete conflicts[id];
  return { conflicts };
}

export type ViewModel = ReturnType<typeof buildViewModel>;

export function buildViewModel(state: AppState, setState: (patch: Partial<AppState>) => void, templateFields: TemplateFieldInstance[] = []) {
  const f = state.form;
  const set = (patch: Partial<AppState>) => setState(patch);
  const setField = (id: string, value: string) => {
    // Typing over a field settles any disagreement about it.
    const conflicts = { ...state.conflicts };
    delete conflicts[id];
    const fieldEvidence = { ...state.fieldEvidence };
    delete fieldEvidence[id];
    setState({ form: withDerived({ ...f, [id]: value }), fieldEvidence, conflicts });
  };

  // ---- area ----------------------------------------------------------------
  const printedSqYards = num(String(f.extentSqYards || '').replace(/,/g, ''));
  const sqYardsN = !Number.isNaN(printedSqYards) && printedSqYards > 0 ? printedSqYards : NaN;
  const hasExtent = !Number.isNaN(sqYardsN) && sqYardsN > 0;
  const sqYards = f.extentSqYards || (hasExtent ? sqYardsN.toLocaleString('en-IN') : '');
  const sqMeters = hasExtent ? (Math.round(sqYardsN * 0.836127 * 100) / 100).toLocaleString('en-IN') : '';

  const conversions = UNITS.map(u => ({
    unit: u,
    value: hasExtent ? (Math.round((sqYardsN / (SQ_YARD[u] ?? 1)) * 1000) / 1000).toLocaleString('en-IN') : '—',
  }));

  // ---- valuation -----------------------------------------------------------
  const rate = num(f.govtRate);
  const struct = has(f.structValue) ? Number(f.structValue) : 0;
  const consid = state.deedType === 'Gift' ? NaN : num(f.consid);

  const landN = hasExtent && !Number.isNaN(rate) ? Math.round(rate * sqYardsN) : NaN;
  const primaryPersayN = Number.isNaN(landN) ? NaN : landN + struct;
  const additionalPersay = state.additionalSchedules.map(record => {
    const printedSqYards = num(String(record.values.extentSqYards || '').replace(/,/g, ''));
    const sqy = !Number.isNaN(printedSqYards) && printedSqYards > 0 ? printedSqYards : NaN;
    const scheduleRate = num(record.values.govtRate);
    if (Number.isNaN(sqy) || Number.isNaN(scheduleRate)) return NaN;
    return Math.round(sqy * scheduleRate) + (Number(record.values.structValue) || 0);
  });
  const everyScheduleValued = additionalPersay.every(value => !Number.isNaN(value));
  const persayN = Number.isNaN(primaryPersayN) || !everyScheduleValued
    ? NaN
    : primaryPersayN + additionalPersay.reduce((sum, value) => sum + value, 0);
  const hasPersay = !Number.isNaN(persayN);
  const hasConsid = !Number.isNaN(consid);

  const baseN = hasPersay && hasConsid ? Math.max(persayN, consid) : hasConsid ? consid : hasPersay ? persayN : NaN;
  const basis = !hasPersay || !hasConsid ? '' : consid > persayN ? 'Consideration amount' : 'Market value (per say)';

  const r = dutyRates(state.statePreset, state.deedType);
  const hasBase = !Number.isNaN(baseN);
  const stampN = hasBase ? Math.round((baseN * r.s) / 100) : NaN;
  const transferN = hasBase ? Math.round((baseN * r.t) / 100) : NaN;
  const regfeeN = hasBase ? Math.round((baseN * r.r) / 100) : NaN;
  const dutyN = hasBase ? stampN + transferN + regfeeN + r.u + r.m : NaN;

  const dutyRows = !hasBase
    ? []
    : [
        { label: 'Stamp duty', rate: r.s.toFixed(2) + '% of ' + money(baseN), amount: money(stampN), strong: true },
        { label: 'Transfer duty (local body)', rate: r.t.toFixed(2) + '%', amount: money(transferN) },
        { label: 'Registration fee', rate: r.r.toFixed(2) + '%', amount: money(regfeeN) },
        { label: 'User charges', rate: 'flat', amount: money(r.u) },
        { label: 'Mutation charges', rate: 'flat', amount: money(r.m) },
      ];

  // ---- payments ------------------------------------------------------------
  const payments = state.payments;
  const anyPaid = payments.some(p => p.amount !== '');
  const paidN = anyPaid ? totalOf(payments) : NaN;
  const netPaidN = anyPaid ? netTotalOf(payments) : NaN;
  const tdsN = tdsTotalOf(payments);
  const balanceN = hasConsid ? consid - (anyPaid ? paidN : 0) : NaN;
  const payMatched = anyPaid && hasConsid && paidN === consid;

  const setPayments = (next: Payment[]) => setState({ payments: next });
  const patchPayment = (id: string, patch: Partial<Payment>) =>
    setPayments(payments.map(p => (p.id === id ? { ...p, ...patch } : p)));

  // ---- selections ----------------------------------------------------------
  const deed = DEEDS.find((d: any) => d.type === state.deedType);
  const cat = CATEGORIES.find((c: any) => c.key === state.category);
  const drafts: any[] = (DRAFTS as any)[state.deedType] || [];
  const variant = SCHEDULE_VARIANT[state.category] || '';

  // ---- completeness --------------------------------------------------------
  const required = ALL_FIELDS.filter(x => !x.derived);
  const applicable = required.filter(x => {
    if (isMunicipalGift(state) && x.id.startsWith('claimant')) return false;
    if (x.only && !x.only.includes(state.category)) return false;
    for (const side of ['executant', 'claimant'] as const) if (x.id.startsWith(side)) {
      if (x.id === side + 'PartyType') return true;
      return isEntity(f, side) ? activePartyFields(f, side).includes(x.id) : groupsForStep(side === 'executant' ? 6 : 7, '').some(g => g.fields.some(field => field.id === x.id));
    }
    return true;
  });
  const placed = templateFields.filter(instance => instance.field.placement);
  const additional = placed.filter(instance => !instance.field.existingPlaceholder);
  const applicableCount = applicable.length + additional.length;
  const filled = applicable.filter(x => has(f[x.id])).length + additional.filter(instance => instance.value.trim() && !instance.error).length;
  const pct = applicableCount ? Math.round((filled / applicableCount) * 100) : 0;

  const stepIsDone = (id: number) => {
    if (placed.some(instance => placementStepIndex(instance.field.placement) === id && instance.error)) return false;
    if (id === 0) return !!(state.deedType && state.category && state.draft);
    if (id === 5) return payMatched;
    if (id === 3) return !!state.scheduleText;
    if (id === 6 || id === 7) return !generationBlockers(state).some(item => item.step === id);
    const gs = groupsForStep(id, state.category);
    if (gs.length) {
      const fs = gs.flatMap(g => g.fields).filter(x => !x.derived);
      return fs.length > 0 && fs.every(x => has(f[x.id]));
    }
    return false;
  };
  const workflowSteps = stepsFor(state.deedType);
  const doneIds = workflowSteps.filter((s: any) => stepIsDone(s.id)).map((s: any) => s.id);

  // ---- readiness checks ----------------------------------------------------
  const checks = [
    { label: 'Deed setup chosen', ok: !!state.deedType, note: 'Selects the approved instrument and draft form' },
    { label: 'Property schedules typed', ok: scheduleRecords(state).every(record => !!record.category), note: 'Each schedule selects its own legal wording and fields' },
    { label: 'Link document recited', ok: !!(f.linkDocNo && f.linkDocDate), note: 'Title flow must be traceable' },
    { label: 'Jurisdiction complete', ok: !!(f.district && f.mandal && f.village && f.sro), note: 'Determines the registering office' },
    { label: 'Extent and boundaries entered', ok: hasExtent && !!(f.boundaryNorth && f.boundarySouth && f.boundaryEast && f.boundaryWest)
        && (state.category !== 'Flat' || FLAT_BOUNDARY_FIELDS.every(id => !!f[id])),
      note: state.category === 'Flat' ? 'All four apartment and all four flat abutments are required' : 'All four abutments are required' },
    { label: 'Valuation entered', ok: hasBase, note: 'Duty is computed on the higher of the two' },
    { label: state.deedType === 'Gift' ? 'Gift without monetary consideration' : 'Consideration fully received', ok: state.deedType === 'Gift' || payMatched, note: state.deedType === 'Gift' ? 'Consideration is Nil' : 'Payments must total the consideration' },
    { label: 'Executant details complete', ok: stepIsDone(6), note: 'Identity and capacity of the vendor' },
    { label: 'Claimant details complete', ok: stepIsDone(7), note: 'Identity of the purchaser' },
    { label: 'Schedule of property composed', ok: !!state.scheduleText, note: 'Reads into the deed verbatim' },
    ...[...new Set(placed.map(instance => placementStepIndex(instance.field.placement)))].map(id => ({ label: `Template fields — ${STEPS[id!]?.label}`, ok: !placed.some(instance => placementStepIndex(instance.field.placement) === id && instance.error), note: 'Complete required fields in their configured step' })),
  ].map(c => ({ ...c, mark: c.ok ? '✓' : '!' }));

  const openCount = checks.filter(c => !c.ok).length;
  const blockers = [...generationBlockers(state), ...placed.filter(instance => instance.error).map(instance => ({ id: `template:${instance.field.id}:${instance.record.scope}:${instance.record.id}`, label: `${instance.record.label} — ${instance.field.label}`, reason: instance.error!, source: 'Template field', step: placementStepIndex(instance.field.placement)! }))];

  const cur = STEPS[state.step];
  const partyName = (side: 'executant' | 'claimant') => partyDisplayName(f, side);

  return {
    state,
    set,
    setField,
    f,

    // extraction provenance
    fieldSource: state.fieldSource,
    fieldEvidence: state.fieldEvidence,
    conflicts: state.conflicts,
    conflictCount: Object.keys(state.conflicts).length,
    applyExtraction: (kind: DocKind, values: Record<string, string>, docName: string) => {
      const r = applyExtraction(state, kind, values, docName);
      setState(r.patch);
      return r;
    },
    acceptConflict: (id: string) => setState(acceptConflict(state, id)),
    acceptConflicts: (ids?: string[]) => setState(acceptConflicts(state, ids)),
    dismissConflicts: (ids?: string[]) => setState(dismissConflicts(state, ids)),

    // selections
    deedType: state.deedType,
    deedLabel: deed ? deed.label : '',
    deedTelugu: deed ? deed.telugu : '',
    category: state.category,
    categoryLabel: state.category === 'Flat' ? flatLabel(f.flatStage) : cat ? cat.label : '',
    draft: state.draft,
    drafts,
    variant,
    statePreset: state.statePreset,
    unit: state.unit,

    // area & value
    hasExtent,
    sqYards,
    sqMeters,
    extentLine: hasExtent ? `${sqYards} Sq. Yards` : '',
    conversions,
    rateINR: money(f.govtRate),
    landINR: money(landN),
    structINR: money(struct),
    persayINR: money(persayN),
    considINR: money(consid),
    considWords: words(consid),
    baseINR: money(baseN),
    basis,
    dutyRows,
    dutyINR: money(dutyN),
    dutyWords: words(dutyN),
    stampValueINR: money(f.stampValue),
    scheduleCount: 1 + state.additionalSchedules.length,
    linkDocumentCount: 1 + state.additionalLinkDocuments.length,
    executantCount: 1 + state.additionalExecutants.length,
    claimantCount: 1 + state.additionalClaimants.length,
    supportingRecordCount: state.supportingRecords.length,
    paidINR: money(paidN),
    netPaidINR: money(netPaidN),
    tdsINR: tdsN ? money(tdsN) : '',
    balanceINR: Number.isNaN(balanceN) ? '' : money(Math.abs(balanceN)),
    balanceN,
    payMatched,

    // payments
    payments,
    paymentCount: payments.length,
    paymentRecital: recitalFor(payments),
    // A further payment starts pre-filled with whatever the earlier ones leave
    // unaccounted for — the common case is that the balance is discharged whole.
    addPayment: (mode?: Payment['mode']) => {
      const next = newPayment(mode, f.claimantName || '', f.executantName || '');
      if (!Number.isNaN(balanceN) && balanceN > 0) next.amount = String(Math.round(balanceN));
      setPayments([...payments, next]);
    },
    patchPayment,
    removePayment: (id: string) => setPayments(payments.filter(p => p.id !== id)),

    // repeatable records
    addLinkDocument: () => setState({ additionalLinkDocuments: [...state.additionalLinkDocuments, newValueRecord()] }),
    patchLinkDocument: (id: string, patch: Partial<ValueRecord>) => setState({ additionalLinkDocuments: state.additionalLinkDocuments.map(record => record.id === id ? { ...record, ...patch } : record) }),
    removeLinkDocument: (id: string) => setState({ additionalLinkDocuments: state.additionalLinkDocuments.filter(record => record.id !== id) }),
    addParty: (side: 'executant' | 'claimant') => {
      const key = side === 'executant' ? 'additionalExecutants' : 'additionalClaimants';
      setState({ [key]: [...state[key], newValueRecord()] } as Partial<AppState>);
    },
    patchParty: (side: 'executant' | 'claimant', id: string, patch: Partial<ValueRecord>) => {
      const key = side === 'executant' ? 'additionalExecutants' : 'additionalClaimants';
      setState({ [key]: state[key].map(record => record.id === id ? { ...record, ...patch } : record) } as Partial<AppState>);
    },
    removeParty: (side: 'executant' | 'claimant', id: string) => {
      const key = side === 'executant' ? 'additionalExecutants' : 'additionalClaimants';
      setState({ [key]: state[key].filter(record => record.id !== id) } as Partial<AppState>);
    },
    addSchedule: () => setState({ additionalSchedules: [...state.additionalSchedules, newScheduleRecord(state.category, state.unit)] }),
    patchSchedule: (id: string, patch: Partial<ScheduleRecord>) => setState({ additionalSchedules: state.additionalSchedules.map(record => record.id === id ? { ...record, ...patch } : record) }),
    removeSchedule: (id: string) => setState({
      additionalSchedules: state.additionalSchedules.filter(record => record.id !== id),
      supportingRecords: state.supportingRecords.filter(record => record.scheduleId !== id),
    }),
    addSupportingRecords: (records: SupportingRecord[]) => setState({ supportingRecords: [...state.supportingRecords, ...records] }),
    removeSupportingRecord: (id: string) => setState({ supportingRecords: state.supportingRecords.filter(record => record.id !== id) }),

    // parties
    executantName: partyName('executant'),
    claimantName: partyName('claimant'),

    // progress
    pct,
    pctLabel: pct + '%',
    filled,
    applicableCount,
    doneIds,
    checks,
    openCount,
    ready: openCount === 0 && blockers.length === 0,
    generationBlockers: blockers,
    generationReady: blockers.length === 0,
    sourceFilled: Object.keys(state.fieldEvidence).length,
    manualFilled: applicable.filter(x => has(f[x.id]) && !state.fieldEvidence[x.id] && !x.derived).length,

    // documents
    docs: state.docs,
    docCount: state.docs.length,

    // schedule
    scheduleText: state.scheduleText,

    // navigation
    isOverview: state.step < 0,
    stepIndex: state.step,
    stepLabel: cur ? cur.label : '',
    stepCounter: state.step < 0 ? 'Overview' : `Step ${workflowSteps.findIndex(step => step.id === state.step) + 1} of ${workflowSteps.length} · ${cur ? cur.label : ''}`,
    prevLabel: state.step <= 0 ? 'Overview' : STEPS[adjacentWorkflowStep(state.deedType, state.step, -1)]?.label || 'Overview',
    nextLabel: state.step >= STEPS.length - 1 ? 'Generate' : state.step < 0 ? 'Start at Step 01' : STEPS[adjacentWorkflowStep(state.deedType, state.step, 1)].label,
    goto: (i: number) => set({ step: normalizeWorkflowStep(state.deedType, i) }),
    prev: () => set({ step: adjacentWorkflowStep(state.deedType, state.step, -1) }),
    next: () => set({ step: adjacentWorkflowStep(state.deedType, state.step, 1) }),

    // title line — derived from the property, blank until there is one
    projectTitle:
      [f.plotNo && `Plot No. ${f.plotNo}`, f.bearingHNo && `H.No. ${f.bearingHNo}`, f.locality, f.village]
        .filter(Boolean)
        .join(', ') || '',
  };
}

export { STEPS, DEEDS, DRAFTS, CATEGORIES, RULES };
