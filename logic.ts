// Derives everything the UI shows from what the user has actually entered.
// There is no seeded record: a field is blank until someone types into it, and
// anything computed from a blank field reads as blank too, never as zero.

import { STEPS, DEEDS, DRAFTS, CATEGORIES, RULES } from './reference';
import { ALL_FIELDS, EMPTY_FORM, SCHEDULE_VARIANT, groupsForStep } from './fields';
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
};

export type SupportingRecord = {
  id: string;
  /** `primary` or the id of an additional property schedule. */
  scheduleId: string;
  docName: string;
  values: Record<string, string>;
};

export type AppState = {
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
  additionalSchedules: ScheduleRecord[];
  /** Uploaded evidence recited only in the property schedule it supports. */
  supportingRecords: SupportingRecord[];
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
  supportingRecords: [],
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
  };
  return [primary, ...state.additionalSchedules];
};

export const supportingRecordsForSchedule = (state: AppState, scheduleId: string) =>
  state.supportingRecords.filter(record => record.scheduleId === scheduleId);

const JURISDICTION_IDS = ['propState', 'district', 'mandal', 'village', 'locality', 'pinCode', 'sro', 'districtRegistrar'];
const PROPERTY_IDS = ['plotNo', 'bearingHNo', 'nearHNo', 'surveyNo', 'extentValue', 'extentSqYards', 'extentSqMeters'];
const BOUNDARY_IDS = ['boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest'];
const STRUCTURE_IDS = ['natureOfHouse', 'floors', 'ageOfHouse', 'plinthArea', 'bltNo', 'taxesPerAnnum', 'annualRentalValue', 'tapConnectionNo', 'metersNo'];
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
    ...groupsForStep(3, 'Residential'), ...groupsForStep(4, 'Vacant Plot'),
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
    ['extentValue', 'The selected template schedule requires the property extent.', 'Link deed or property plan'],
    ['boundaryNorth', 'All four property boundaries are required.', 'Link deed or property plan'],
    ['boundarySouth', 'All four property boundaries are required.', 'Link deed or property plan'],
    ['boundaryEast', 'All four property boundaries are required.', 'Link deed or property plan'],
    ['boundaryWest', 'All four property boundaries are required.', 'Link deed or property plan'],
    ['govtRate', 'Market value and stamp duty require the basic rate.', 'Government basic-value record'],
    ['consid', 'The sale deed must state the consideration.', 'Sale agreement or payment proof'],
    ['stampValue', 'The deed header states the face value of the stamp paper.', 'Stamp paper or manual entry'],
  ].forEach(([id, reason, source]) => add(id, reason, source));

  if (['Vacant Plot', 'Open Place', 'Agricultural land', 'Demolished', 'Part open place'].includes(state.category)) {
    add('nearHNo', 'The selected schedule identifies the nearby/adjacent house number.', 'Link deed or property plan');
  }
  if (['Residential', 'Commercial', 'Flat'].includes(state.category)) {
    ['bearingHNo', 'natureOfHouse', 'floors', 'ageOfHouse', 'plinthArea', 'bltNo', 'taxesPerAnnum', 'annualRentalValue', 'tapConnectionNo', 'metersNo']
      .forEach(id => add(id, 'The selected house schedule and Annexure I-A require this value.', 'Property-tax record, plan or house document'));
  }

  for (const side of ['executant', 'claimant']) {
    ['Name', 'Relation', 'RelativeName', 'Dob', 'Occupation', 'Aadhaar', 'HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode']
      .forEach(suffix => add(`${side}${suffix}`, 'The party recital requires this identity or address detail.', 'Aadhaar, PAN, address proof or party declaration'));
    if (Number(f.consid) >= 5000000) add(`${side}Pan`, 'PAN is required for consideration of ₹50 lakh or more.', 'PAN card or party declaration');
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
    const records = side === 'executant' ? state.additionalExecutants : state.additionalClaimants;
    records.forEach((record, index) => {
      ['Name', 'Relation', 'RelativeName', 'Dob', 'Occupation', 'Aadhaar', 'HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'].forEach(suffix => {
        const id = `${side}${suffix}`;
        addRecordField(record, id, `${side === 'executant' ? 'Executant' : 'Claimant'} ${index + 2}: ${fieldLabel(id)}`, 'Every party recital requires this identity or address detail.', 'Aadhaar, PAN, address proof or manual entry.', side === 'executant' ? 6 : 7);
      });
      if (Number(f.consid) >= 5000000) addRecordField(record, `${side}Pan`, `${side === 'executant' ? 'Executant' : 'Claimant'} ${index + 2}: PAN`, 'PAN is required for consideration of ₹50 lakh or more.', 'PAN card or manual entry.', side === 'executant' ? 6 : 7);
    });
  }
  state.additionalSchedules.forEach((record, index) => {
    const ids = ['propState', 'district', 'mandal', 'village', 'locality', 'pinCode', 'sro', 'districtRegistrar', 'plotNo', 'surveyNo', 'extentValue', ...BOUNDARY_IDS, 'govtRate'];
    if (['Vacant Plot', 'Open Place', 'Agricultural land', 'Demolished', 'Part open place'].includes(record.category)) ids.push('nearHNo');
    if (['Residential', 'Commercial', 'Flat'].includes(record.category)) ids.push('bearingHNo', 'natureOfHouse', 'floors', 'ageOfHouse', 'plinthArea', 'bltNo', 'taxesPerAnnum', 'annualRentalValue', 'tapConnectionNo', 'metersNo');
    ids.forEach(id => addRecordField(record, id, `Schedule ${index + 2}: ${fieldLabel(id)}`, 'Every property schedule must be complete before combined registration.', 'Link deed, property record, plan or manual entry.', 3));
  });

  if (!state.payments.some(payment => has(payment.amount))) {
    missing.push({ id: 'payment', label: 'Payment details', reason: 'The receipt clause must state how the consideration was paid.', source: 'Cheque, DD, transfer/UPI receipt or payment acknowledgement.', step: 5 });
  } else {
    state.payments.filter(payment => has(payment.amount)).forEach((payment, index) => {
      const fields = payment.mode === 'cash'
        ? ['amount', 'date', 'payer', 'payee']
        : payment.mode === 'upi'
        ? ['amount', 'refNo', 'bank', 'date', 'payer', 'payee']
        : ['amount', 'refNo', 'bank', 'branch', 'date', 'payer', 'payee'];
      fields.forEach(name => {
        if (!has((payment as any)[name])) {
          missing.push({ id: `payment-${payment.id}-${name}`, label: `Payment ${index + 1}: ${name}`, reason: 'The receipt clause requires a complete payment record.', source: 'Payment instrument or manual entry.', step: 5 });
        }
      });
    });
  }
  for (const id of Object.keys(state.conflicts)) {
    missing.push({ id: `conflict-${id}`, label: displayLabel(id), reason: 'Uploaded documents disagree about this value.', source: 'Review and choose the correct source value.', step: FIELD_STEPS[id] ?? 0 });
  }
  const invalid = (id: string, reason: string, step: number) => {
    if (!missing.some(item=>item.id===id)) missing.push({id,label:displayLabel(id),reason,source:'Correct or manually enter the verified value.',step});
  };
  const positive = (value: string | number) => !!value && Number.isFinite(Number(value)) && Number(value)>0;
  const squareYards = f.extentSqYards || toSqYards(f.extentValue,state.unit);
  if (!positive(squareYards)) invalid('extentValue','A positive verified extent and valid unit are required.',5);
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

/** dd-mm-yyyy, as the deed reads dates. */
export function deedDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}-${m}-${y}` : iso;
}

/** Completed years between two ISO dates. Blank if the birth date is unusable. */
export function ageFrom(dobISO: string, onISO?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobISO)) return '';
  const dob = new Date(dobISO);
  if (!onISO || !/^\d{4}-\d{2}-\d{2}$/.test(onISO)) return '';
  const on = new Date(onISO);
  if (Number.isNaN(dob.getTime()) || dob > on) return '';
  let years = on.getFullYear() - dob.getFullYear();
  const before =
    on.getMonth() < dob.getMonth() || (on.getMonth() === dob.getMonth() && on.getDate() < dob.getDate());
  if (before) years -= 1;
  return years >= 0 && years < 130 ? String(years) : '';
}

/**
 * Values the form works out for itself.
 *
 * Age follows the date of birth and the date of execution, so a party's age is
 * never typed twice or left stale when either changes. Extent (Sq. Meters)
 * follows Extent (Sq. Yards) the same way. A field with nothing to compute
 * from keeps whatever was typed into it.
 */
export function withDerived(form: Record<string, string>): Record<string, string> {
  const out = { ...form };
  for (const side of ['executant', 'claimant'] as const) {
    const age = ageFrom(out[`${side}Dob`] ?? '', out.executionDate);
    if (out[`${side}Dob`]) out[`${side}Age`] = age;
  }
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

export function buildViewModel(state: AppState, setState: (patch: Partial<AppState>) => void) {
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
  const extentRaw = num(f.extentValue);
  // A registered deed often prints only the alternate schedule extents (for
  // example 157.22 sq. yards / 132.06 sq. metres). Treat a verified printed
  // square-yard figure as authoritative area even when no separate generic
  // extent/unit pair was returned, so market value can be calculated directly
  // from the uploaded record.
  const printedSqYards = num(String(f.extentSqYards || '').replace(/,/g, ''));
  const sqYardsN = !Number.isNaN(printedSqYards) && printedSqYards > 0
    ? printedSqYards
    : Number.isNaN(extentRaw) ? NaN : Math.round(toSqYards(extentRaw, state.unit) * 100) / 100;
  const hasExtent = !Number.isNaN(sqYardsN) && sqYardsN > 0;
  const sqYards = f.extentSqYards || (hasExtent ? sqYardsN.toLocaleString('en-IN') : '');
  const sqMeters = f.extentSqMeters || (hasExtent ? (Math.round(sqYardsN * 0.836127 * 100) / 100).toLocaleString('en-IN') : '');

  const conversions = UNITS.map(u => ({
    unit: u,
    value: hasExtent ? (Math.round((sqYardsN / (SQ_YARD[u] ?? 1)) * 1000) / 1000).toLocaleString('en-IN') : '—',
  }));

  // ---- valuation -----------------------------------------------------------
  const rate = num(f.govtRate);
  const struct = has(f.structValue) ? Number(f.structValue) : 0;
  const consid = num(f.consid);

  const landN = hasExtent && !Number.isNaN(rate) ? Math.round(rate * sqYardsN) : NaN;
  const primaryPersayN = Number.isNaN(landN) ? NaN : landN + struct;
  const additionalPersay = state.additionalSchedules.map(record => {
    const extent = num(record.values.extentValue);
    // An uploaded deed can provide only the separately printed square-yard
    // extent. Treat it exactly as we do for the primary schedule so one such
    // schedule cannot blank the combined market value.
    const printedSqYards = num(String(record.values.extentSqYards || '').replace(/,/g, ''));
    const sqy = !Number.isNaN(printedSqYards) && printedSqYards > 0
      ? printedSqYards
      : Number.isNaN(extent) ? NaN : toSqYards(extent, record.unit);
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
  const applicable = required.filter(x => !x.only || x.only.includes(state.category));
  const filled = applicable.filter(x => has(f[x.id])).length;
  const pct = applicable.length ? Math.round((filled / applicable.length) * 100) : 0;

  const stepIsDone = (id: number) => {
    if (id === 0) return !!(state.deedType && state.category && state.draft);
    if (id === 5) return payMatched;
    if (id === 3) return !!state.scheduleText;
    const gs = groupsForStep(id, state.category);
    if (gs.length) {
      const fs = gs.flatMap(g => g.fields).filter(x => !x.derived);
      return fs.length > 0 && fs.every(x => has(f[x.id]));
    }
    return false;
  };
  const doneIds = STEPS.filter((s: any) => stepIsDone(s.id)).map((s: any) => s.id);

  // ---- readiness checks ----------------------------------------------------
  const checks = [
    { label: 'Deed setup chosen', ok: !!state.deedType, note: 'Selects the approved instrument and draft form' },
    { label: 'Property schedules typed', ok: scheduleRecords(state).every(record => !!record.category), note: 'Each schedule selects its own legal wording and fields' },
    { label: 'Link document recited', ok: !!(f.linkDocNo && f.linkDocDate), note: 'Title flow must be traceable' },
    { label: 'Jurisdiction complete', ok: !!(f.district && f.mandal && f.village && f.sro), note: 'Determines the registering office' },
    { label: 'Extent and boundaries entered', ok: hasExtent && !!(f.boundaryNorth && f.boundarySouth && f.boundaryEast && f.boundaryWest), note: 'All four abutments are required' },
    { label: 'Valuation entered', ok: hasBase, note: 'Duty is computed on the higher of the two' },
    { label: 'Consideration fully received', ok: payMatched, note: 'Payments must total the consideration' },
    { label: 'Executant details complete', ok: stepIsDone(6), note: 'Identity and capacity of the vendor' },
    { label: 'Claimant details complete', ok: stepIsDone(7), note: 'Identity of the purchaser' },
    { label: 'Schedule of property composed', ok: !!state.scheduleText, note: 'Reads into the deed verbatim' },
  ].map(c => ({ ...c, mark: c.ok ? '✓' : '!' }));

  const openCount = checks.filter(c => !c.ok).length;
  const blockers = generationBlockers(state);

  const cur = STEPS[state.step];
  const partyName = (side: 'executant' | 'claimant') => f[side + 'Name'] || '';

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
    categoryLabel: cat ? cat.label : '',
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
    applicableCount: applicable.length,
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
    stepCounter: state.step < 0 ? 'Overview' : `Step ${state.step + 1} of ${STEPS.length} · ${cur ? cur.label : ''}`,
    prevLabel: state.step <= 0 ? 'Overview' : STEPS[state.step - 1].label,
    nextLabel: state.step >= STEPS.length - 1 ? 'Generate' : state.step < 0 ? 'Start at Step 01' : STEPS[state.step + 1].label,
    goto: (i: number) => set({ step: i }),
    prev: () => set({ step: Math.max(-1, state.step - 1) }),
    next: () => set({ step: Math.min(STEPS.length - 1, state.step + 1) }),

    // title line — derived from the property, blank until there is one
    projectTitle:
      [f.plotNo && `Plot No. ${f.plotNo}`, f.bearingHNo && `H.No. ${f.bearingHNo}`, f.locality, f.village]
        .filter(Boolean)
        .join(', ') || '',
  };
}

export { STEPS, DEEDS, DRAFTS, CATEGORIES, RULES };
