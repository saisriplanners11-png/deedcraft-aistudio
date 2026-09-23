// Builds the placeholder -> value map the template expects, from live form state.

import type { Rewrite, ScheduleMerge } from './docx';
import { ALL_FIELDS, GROUPS, LINK_OPTIONS, SCHEDULE_VARIANT } from './fields';
import { deedDate, money, partyRecords, scheduleRecords, linkDocumentRecordsForSchedule, supportingRecordsForSchedule, uppercasePartyIdentity, words, type AppState, type SupportingRecord } from './logic';
import { deedPaymentRecital, modeSpec, type Payment } from './payments';

/** Values for every placeholder the template names. */
export function mergeValues(state: AppState): Record<string, string> {
  const f = state.form;
  const out: Record<string, string> = {};

  // Straight field -> placeholder mappings declared in fields.ts.
  for (const field of ALL_FIELDS) {
    if (!field.ph) continue;
    const names = Array.isArray(field.ph) ? field.ph : [field.ph];
    let value = uppercasePartyIdentity(field.id, f[field.id] ?? '');
    if (field.type === 'date') value = deedDate(value);
    for (const n of names) out[n] = value;
  }
  // The Schedule of Property's "Registration Sub-District" placeholder uses
  // the same office selected in Jurisdiction, never an older link-deed office.
  const registrationSro = f.sro || f.linkSro || '';
  out['Sub Registrar'] = registrationSro;
  out['Sub-Registrar'] = registrationSro;
  // The updated template uses one generic PAN slot in the claimant recital.
  out.PAN = f.claimantPan || '';
  // This is a renderer-only value: the supplied template has no placeholder
  // for the relationship, but uses a literal "near/adjacent" phrase instead.
  out['Near / Adjacent'] = f.nearAdjacent || '';

  // Derived values.
  const squareYards = Number(String(f.extentSqYards || '').replace(/,/g, ''));
  if (f.extentSqYards && Number.isFinite(squareYards) && squareYards > 0) {
    out['Extent in Sq.yards'] = squareYards.toLocaleString('en-IN');
    out['Extent in Sq.Meters'] = (Math.round(squareYards * 0.836127 * 100) / 100).toLocaleString('en-IN');
  } else {
    out['Extent in Sq.yards'] = '';
    out['Extent in Sq.Meters'] = '';
  }
  for (const field of ['extentSqYards', 'extentSqMeters']) {
    if (state.unresolvedFields?.includes(field)) out[field === 'extentSqYards' ? 'Extent in Sq.yards' : 'Extent in Sq.Meters'] = '';
  }

  // The deed's first page prints the sale consideration itself, not the
  // calculated basic-rate market value (which stays visible to the drafter
  // only in the Market Value step's on-screen "calculated market value" panel).
  const rate = Number(f.govtRate);
  const consid = Number(f.consid);
  const considText = f.consid && Number.isFinite(consid) ? consid.toLocaleString('en-IN') : '';
  out['Market of Value Rs./-'] = considText;
  out['Sale Consideration'] = considText;
  out['Statement of Market Value Consideration'] = considText;
  out['Sale Consideration Words'] = words(f.consid);
  out['Consideration in words'] = words(f.consid);
  out['Market Value Per Sq.Yard'] =
    f.govtRate === '' || Number.isNaN(rate) ? '' : rate.toLocaleString('en-IN');

  // Relation + relative's name are collected as two fields but recite as one
  // template line ("S/o Yellaiah"), same as before the fields were split.
  for (const side of ['executant', 'claimant'] as const) {
    const ph = side === 'executant' ? 'EXECUTANT RELATION NAME' : 'CLAIMANT RELATION NAME';
    out[ph] = [f[`${side}Relation`]?.toUpperCase(), uppercasePartyIdentity(`${side}RelativeName`, f[`${side}RelativeName`] || '')].filter(Boolean).join(' ');
  }

  // The non-judicial stamp paper value is supplied by the user. It is not the
  // calculated statutory duty and therefore must never be derived from value.
  out['Stamp of Rs/-'] = f.stampValue === '' ? '' : Number(f.stampValue).toLocaleString('en-IN');

  // The template has a single set of instrument placeholders, so the largest
  // payment is the one printed there; the full list is recited in the receipt
  // clause instead (see paymentRecital).
  const paid = state.payments.filter(p => p.amount !== '');
  const primary: Payment | undefined = paid.length
    ? paid.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a))
    : undefined;

  out['Cheque.Amount'] = primary?.amount ? Number(primary.amount).toLocaleString('en-IN') : '';
  out['Cheque.No.'] = primary?.refNo ?? '';
  out['Cheque.Branch'] = primary
    ? [primary.bank, primary.branch].filter(Boolean).join(', ')
    : '';
  out['Cheque.Date'] = primary ? deedDate(primary.date) : '';
  out['Utr/Reference No.'] = primary?.refNo ?? '';
  out['Remitting Bank'] = primary ? [primary.bank, primary.branch].filter(Boolean).join(', ') : '';

  return out;
}

/**
 * The template writes the opening recital as a fill-in-by-hand line. The app
 * collects the current deed date, but deliberately leaves the template's
 * existing place text untouched.
 */
export function rewritesFor(state: AppState): Rewrite[] {
  const date = deedDate(state.form.executionDate);
  const rewrites: Rewrite[] = [{
    find: /made and executed on\s+[^;]*?(?=\s+at\s+)/,
    replace: date ? 'made and executed on ' + date : 'made and executed',
  }];
  // No execution date was entered: omit the date phrase rather than invent a
  // fill-in blank in the downloaded deed.
  if (!date) rewrites.push({
    find: /in the presence of the following witnesses on the afore mentioned date\./,
    replace: 'in the presence of the following witnesses.',
  });
  const paid = state.payments.filter(payment => payment.amount !== '');
  // The v2 template contains one sample paragraph for each payment method.
  // Replace each sample with one cloned paragraph per actual payment, or remove
  // it entirely when that method was not used.
  const paymentRecord = (payment: Payment, refName: string) => ({
    Amount: payment.amount ? Number(payment.amount).toLocaleString('en-IN') : '',
    [refName]: payment.refNo || '',
    'Utr/Reference No.': payment.refNo || '',
    'Bank Name': [payment.bank, payment.branch].filter(Boolean).join(', '),
    'Remitting Bank': [payment.bank, payment.branch].filter(Boolean).join(', '),
    Date: deedDate(payment.date),
    'Claimant Name': payment.payer || state.form.claimantName || '',
    'CLAIMANT NAME': payment.payer || state.form.claimantName || '',
    'Executant Name': payment.payee || state.form.executantName || '',
    'EXECUTANT NAME': payment.payee || state.form.executantName || '',
  });
  const v2PaymentParagraphs: Array<{ mode: Payment['mode']; find: RegExp; refName: string }> = [
    { mode: 'rtgs', find: /RTGS\/NEFT:\s*Amount of Rs\./i, refName: 'UTR No.' },
    { mode: 'cheque', find: /Cheque:\s*Amount of Rs\./i, refName: 'Cheque No.' },
    { mode: 'dd', find: /Demand Draft:\s*Amount of Rs\./i, refName: 'DD No.' },
    { mode: 'upi', find: /UPI\/Online:\s*Amount of Rs\./i, refName: 'Transaction ID' },
    { mode: 'cash', find: /Cash:\s*Amount of Rs\./i, refName: 'Cash Receipt No.' },
  ];
  for (const { mode, find, refName } of v2PaymentParagraphs) {
    rewrites.push({ find, replace: '', records: paid.filter(payment => payment.mode === mode).map(payment => paymentRecord(payment, refName)) });
  }
  if (paid.length && !(paid.length === 1 && paid[0].mode === 'cash')) {
    rewrites.push({ find: /\(1\)\s+Amount of Rs\..*paid via Cash\./i, replace: paid.map((payment, index) => {
      const amount = payment.amount ? Number(payment.amount).toLocaleString('en-IN') : '';
      const mode = payment.mode ? modeSpec(payment.mode).label : '';
      const ref = payment.refNo || '';
      const bank = [payment.bank, payment.branch].filter(Boolean).join(', ');
      const date = deedDate(payment.date);
      const prefix = `(${index + 1}) Amount of Rs.${amount}/-`;
      return payment.mode === 'cash' ? `${prefix} paid via cash${date ? ` dated ${date}` : ''}.`
        : `${prefix} paid${mode ? ` through ${mode}` : ''}${ref ? ` bearing No. ${ref}` : ''}${bank ? ` drawn on ${bank}` : ''}${date ? ` dated ${date}` : ''}.`;
    }).join('; ') });
  }
  for (const side of ['executant', 'claimant'] as const) {
    const records = partyRecords(state, side);
    if (records.length < 2) continue;
    rewrites.push({
      find: new RegExp(side === 'executant' ? '<EXECUTANT NAME>' : '<CLAIMANT NAME>'), replace: '',
      records: records.map(record => {
        const form = { ...state.form };
        for (const field of ALL_FIELDS.filter(f => f.id.startsWith(side))) form[field.id] = record.values[field.id] || '';
        return mergeValues({ ...state, form });
      }),
    });
  }
  return rewrites;
}

/** A concise, source-backed recital for one uploaded supporting record. */
export function supportingRecordRecital(record: SupportingRecord): string {
  const v = record.values;
  const seen = new Set<string>();
  const parts: string[] = [];
  const add = (label: string, value?: string) => {
    const clean = (value || '').trim();
    const key = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean || (key && seen.has(key))) return;
    if (key) seen.add(key);
    parts.push(`${label} ${clean}`);
  };
  add('Assessment No.', v.supportingAssessmentNo);
  add('House/Premises No.', v.supportingHouseNo);
  add('Passbook No.', v.supportingPassbookNo);
  add('Khata No.', v.supportingKhataNo);
  add('NALA Order No.', v.supportingNalaOrderNo);
  add('Permit No.', v.supportingPermitNo);
  add('Electricity SC No.', v.supportingElectricityScNo);
  add('Electricity USC No.', v.supportingElectricityUscNo);
  add('Sy.No.', v.supportingSurveyNo);
  add('Plot No.', v.supportingPlotNo);
  add('Extent', v.supportingExtent);
  add('Dated', v.supportingDate ? deedDate(v.supportingDate) : '');
  add('Issued by', v.supportingAuthority);
  add('Recorded holder/consumer', v.supportingHolder);
  add('Particulars:', v.supportingDetails);
  const type = v.supportingDocType || 'Supporting Property Record';
  return parts.length ? `${type}: ${parts.join('; ')}.` : '';
}

export function propertyForm(state: AppState, values: Record<string, string>): Record<string, string> {
  const blankProperty = Object.fromEntries(GROUPS.filter(g => [2,3,5].includes(g.step)).flatMap(g => g.fields).filter(f => !['executionDate','consid','stampValue'].includes(f.id)).map(f => [f.id, '']));
  return { ...state.form, ...blankProperty, ...values };
}

/** One filled template schedule for every property being registered together. */
export function scheduleMergesFor(state: AppState): ScheduleMerge[] {
  return scheduleRecords(state).map(record => {
    const blankTitleFields = Object.fromEntries(LINK_OPTIONS.flatMap(option => option.fields).map(field => [field.id, '']));
    const scheduleState: AppState = {
      ...state,
      category: record.category,
      unit: record.unit,
      form: { ...propertyForm(state, record.values), ...blankTitleFields },
      additionalSchedules: [],
    };
    const values = mergeValues(scheduleState);
    const titleValues = { ...values };
    const titleLinkRecords = linkDocumentRecordsForSchedule(state, record.id);
    const registeredTitleLinks: Record<string, string>[] = [];
    for (const titleRecord of titleLinkRecords) {
      const mapped = mergeValues({ ...scheduleState, form: { ...scheduleState.form, ...titleRecord.values } });
      for (const [key, value] of Object.entries(mapped)) if (value && !titleValues[key]) titleValues[key] = value;
      if (titleRecord.values.linkOption === 'linkDoc' || (!titleRecord.values.linkOption && ['linkDocNo', 'linkDocType', 'linkDocDate', 'linkSro'].some(key => !!titleRecord.values[key]))) {
        registeredTitleLinks.push(mapped);
      }
    }
    const extent = Number(String(record.values.extentSqYards || '').replace(/,/g, ''));
    const rate = Number(record.values.govtRate);
    if (record.values.extentSqYards && record.values.govtRate && !Number.isNaN(extent) && !Number.isNaN(rate)) {
      values['Market of Value Rs./-'] = (Math.round(extent * rate) + (Number(record.values.structValue) || 0)).toLocaleString('en-IN');
    }
    const supportingRecords = supportingRecordsForSchedule(state, record.id)
      .map(supportingRecordRecital)
      .filter(Boolean);
    return { variant: variantFor(record.category), values, titleValues, titleLinkRecords: registeredTitleLinks, supportingRecords, structureDetails: record.structureDetails };
  });
}

/** Which SCHEDULE OF PROPERTY block of the template this deed uses. */
export const variantFor = (category: string) => SCHEDULE_VARIANT[category] || 'IF OPEN PLOT';

/** Filename for the generated deed, from whatever identifies the property. */
export function deedFilename(state: AppState): string {
  const f = state.form;
  const who = (f.executantName || '').split(/\s+/)[0];
  const what = f.plotNo ? `Plot-${f.plotNo}` : f.bearingHNo ? `HNo-${f.bearingHNo}` : '';
  const parts = ['Sale-Deed', what, who].filter(Boolean);
  return parts.join('-').replace(/[^\w.-]+/g, '-') + '.docx';
}

export { money, words };
