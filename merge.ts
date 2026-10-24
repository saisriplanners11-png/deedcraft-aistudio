import { authorityPartyValues, saleDocumentLabel } from './sale-options';
import { isMunicipalGift } from './municipal-gift';
import { poaValues } from './poa-options';
import { giftRelationshipValues } from './gift-options';
import { localAuthorityName } from './fields';
import { entityRecital, isEntity, partyDisplayName } from './party-entities';
import { flatStage, flatVariant } from './flat-options';
// Builds the placeholder -> value map the template expects, from live form state.

import type { Rewrite, ScheduleMerge } from './docx';
import { ALL_FIELDS, GROUPS, LINK_OPTIONS, ROOF_NATURE_OPTIONS, STRUCTURE_TYPE_OPTIONS, SCHEDULE_VARIANT } from './fields';
import { deedDate, money, partyRecords, scheduleRecords, linkDocumentRecordsForSchedule, supportingRecordsForSchedule, uppercasePartyIdentity, vendeeShareCents, words, type AppState, type SupportingRecord } from './logic';
import { deedPaymentRecital, modeSpec, type Payment } from './payments';

function ownershipShare(state: AppState, side: 'executant' | 'claimant', partyId: string): string {
  const schedules = scheduleRecords(state);
  const shares = side === 'executant' ? state.vendorSharesBySchedule : state.vendeeSharesBySchedule;
  return schedules.map((schedule, index) => {
    const cents = vendeeShareCents(shares?.[schedule.id]?.[partyId] || '');
    if (cents === null) return '';
    const value = `${cents / 100}%`;
    return schedules.length > 1 ? `Schedule ${index + 1}: ${value}` : value;
  }).filter(Boolean).join('; ');
}

/** Values for every placeholder the template names. */
export function mergeValues(state: AppState): Record<string, string> {
  const f = state.form;
  const out: Record<string, string> = {};
  if (isMunicipalGift(state)) { out.ULB = localAuthorityName(f.localAuthorityType || ''); out.VILLAGE = f.village || ''; }
  Object.assign(out, giftRelationshipValues(state), poaValues(state));

  // Straight field -> placeholder mappings declared in fields.ts.
  for (const field of ALL_FIELDS) {
    if (!field.ph) continue;
    const names = Array.isArray(field.ph) ? field.ph : [field.ph];
    let value = uppercasePartyIdentity(field.id, f[field.id] ?? '');
    if (field.type === 'date') value = deedDate(value);
    for (const n of names) out[n] = value;
  }
  // Legacy drafts stored vacant-land assessment under assessmentPtinNo.
  out['V.L.T No.'] = f.vltNo || f.assessmentPtinNo || '';
  out['V.L.T. No.'] = out['V.L.T No.'];
  out['V.L.T.No.'] = out['V.L.T No.'];
  // The Schedule of Property's "Registration Sub-District" placeholder uses
  // the same office selected in Jurisdiction, never an older link-deed office.
  const registrationSro = f.sro || f.linkSro || '';
  out['Sub Registrar'] = registrationSro;
  out['Sub-Registrar'] = registrationSro;
  // Both party recitals have their own PAN slot in the updated draft.
  out.PAN = f.claimantPan || '';
  out['Executant PAN'] = f.executantPan || '';
  out['Claimant PAN'] = f.claimantPan || '';
  out['Pattadar Pass Book No.'] = out['Pattadar Pass Book No'] || '';
  out['Pass Book Khata No.'] = out['Pass Book Khata No'] || '';
  out['Nala Order No.'] = out['Nala Order No'] || '';
  // This is a renderer-only value: the supplied template has no placeholder
  // for the relationship, but uses a literal "near/adjacent" phrase instead.
  out['Local Authority Type'] = localAuthorityName(f.localAuthorityType || '');
  out['Near / Adjacent'] = f.nearAdjacent || '';
  out['Landmark House No.'] = ['Demolished', 'Part open place'].includes(state.category) ? f.landmarkHNo || '' : f.nearHNo || '';
  out['Municipal House Nos.'] = f.bearingHNo || '';
  out['Municipality/Municipal Corporation/Gram Panchayat Name'] = f.permissionAuthorityName || '';
  out['House Permission No.'] = f.permBuildingPermitNo || f.buildingPermitNo || '';
  out['Stage'] = state.category === 'Flat' ? flatStage(f.flatStage) : out['Stage'] || '';
  out['Plot Nos.'] = f.plotNo || '';
  const houseRows = state.structureDetailsBySchedule.primary?.rows || [];
  const firstStructure = houseRows.find(row => row.structureType && !STRUCTURE_TYPE_OPTIONS.includes(row.structureType));
  out['Nature of House'] = (ROOF_NATURE_OPTIONS.includes(f.roofMaterial) ? f.roofMaterial : '') || (firstStructure?.structureType === 'Other / Custom Structure'
    ? firstStructure.customStructureType || '' : firstStructure?.structureType || '');
  out['Roof Material'] = f.roofMaterial || '';
  out['Construction Description'] = f.constructionDescription || '';
  out['Type of structure'] = out['Construction Description'];
  const ages = houseRows.map(row => row.buildingAge).filter(value => value !== '').map(Number).filter(Number.isFinite);
  out['Age of House'] = ages.length ? String(Math.max(...ages)) : '';
  out['Floors'] = state.structureDetailsBySchedule.primary?.totalFloors || '';
  const areas = houseRows.map(row => row.builtUpAreaSqFt).filter(value => value !== '').map(Number).filter(Number.isFinite);
  out['Plinth Area'] = areas.length ? areas.reduce((sum, area) => sum + area, 0).toLocaleString('en-IN') : '';

  // Historical template aliases use the same entered structure facts.
  out['Structure Type'] = out['Nature of House'];
  out['Building Age'] = out['Age of House'];
  out['Total Built-up Area'] = out['Plinth Area'];

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
  out['Total Land Extent'] = out['Extent in Sq.yards'];

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

  if (['Gift', 'Agreement of Sale', 'Agreement of Sale Cum GPA'].includes(state.deedType)) {
    out['Municipality/Gram Panchayat Name'] = f.permissionAuthorityName || '';
    out.Date = deedDate(f.executionDate || '');
    for (const [side, label] of [['executant', 'Executant'], ['claimant', 'Claimant']] as const) out[label + ' Address'] = ['HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'].map(suffix => f[side + suffix]?.trim()).filter(Boolean).join(', ');
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

  out['Sale Document Mode'] = state.saleDocument || 'ordinary';
  out['Execution Date'] = executionMonthDate(f.executionDate || '');
  const authority = state.saleAuthority;
  for (const prefix of ['G.P.A.', 'A.G.P.A.']) {
    out[prefix + 'Doct.No.'] = authority?.documentNo || '';
    out[prefix + 'Doct.Date'] = deedDate(authority?.documentDate || '');
  }
  out['Authority Book Number'] = authority?.bookNumber || '';
  out['Authority SRO'] = authority?.sro || '';
  out['Authority SRO Code'] = authority?.sroCode || '';
  out['Authority Attorney Count'] = String(authority?.attorneys.length || 0);
  out['Ownership Vendor Enabled'] = String(Object.values(state.vendorSharesBySchedule || {}).some(shares => Object.values(shares).some(value => value.trim())));
  out['Ownership Vendee Enabled'] = String(Object.values(state.vendeeSharesBySchedule || {}).some(shares => Object.values(shares).some(value => value.trim())));
  out['Ownership Vendor Count'] = String(partyRecords(state, 'executant').length);
  out['Ownership Vendee Count'] = String(partyRecords(state, 'claimant').length);
  out['Authority Holder Label'] = state.saleDocument === 'gpa' ? 'G.P.A. HOLDER OF' : state.saleDocument === 'agpa' ? 'A.G.P.A. HOLDER OF' : '';
  out['Authority Principal Names'] = partyRecords(state, 'executant').map(record => partyDisplayName(record.values, 'executant').toLocaleUpperCase('en-IN')).filter(Boolean).join(', ');
  out['Executant Share'] = ownershipShare(state, 'executant', state.primaryExecutantId || 'primary');
  out['Claimant Share'] = ownershipShare(state, 'claimant', state.primaryClaimantId || 'primary');
  out['Adjusted Amount'] = authority?.adjustedAmount ? Number(authority.adjustedAmount).toLocaleString('en-IN') : '';
  for (const [label, pattern] of [['Ground Floor Area', /^(ground|g|0)$/i], ['First Floor Area', /^(first|1|1st)$/i]] as const) {
    const rows = houseRows.filter(row => pattern.test(row.floorNo.trim()));
    out[label] = rows.length ? rows.reduce((sum, row) => sum + Number(row.builtUpAreaSqFt || 0), 0).toLocaleString('en-IN') : '';
  }
  return out;
}

/** Compatibility name for saved drafts; full dates use the shared deed format. */
export const executionMonthDate = deedDate;

/**
 * The template writes the opening recital as a fill-in-by-hand line. The app
 * collects the current deed date, but deliberately leaves the template's
 * existing place text untouched.
 */
function partyCapacityPrefix(value: string = ''): string {
  const capacity = value.split(' (')[0].trim();
  return ['Guardian', 'Confirming Party', 'Consenting Party', 'Legal Heir'].includes(capacity) ? capacity + ': ' : '';
}

export function rewritesFor(state: AppState): Rewrite[] {
  const date = executionMonthDate(state.form.executionDate || '');
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
    'Housing Loan Bank': payment.bank || '',
    'Housing Loan Branch': payment.branch || '',
    'Remitting Bank': [payment.bank, payment.branch].filter(Boolean).join(', '),
    Date: deedDate(payment.date),
    'Claimant Name': payment.payer || partyDisplayName(state.form, 'claimant') || '',
    'CLAIMANT NAME': payment.payer || state.form.claimantName || '',
    'Executant Name': payment.payee || partyDisplayName(state.form, 'executant') || '',
    'EXECUTANT NAME': payment.payee || state.form.executantName || '',
  });
  const v2PaymentParagraphs: Array<{ mode: Payment['mode']; find: RegExp; refName: string }> = [
    { mode: 'rtgs', find: /RTGS\/NEFT:\s*Amount of Rs\./i, refName: 'UTR No.' },
    { mode: 'cheque', find: /Cheque:\s*Amount of Rs\./i, refName: 'Cheque No.' },
    { mode: 'dd', find: /Demand Draft:\s*Amount of Rs\./i, refName: 'DD No.' },
    { mode: 'upi', find: /UPI\/Online:\s*Amount of Rs\./i, refName: 'Transaction ID' },
    { mode: 'cash', find: /Cash:\s*Amount of Rs\./i, refName: 'Cash Receipt No.' },
    { mode: 'housing-loan', find: /Housing Loan:\s*Amount of Rs\./i, refName: 'Cheque No.' },
    { mode: 'through-bank', find: /Through Bank:\s*Amount of Rs\./i, refName: 'Bank Reference No.' },
  ];
  for (const { mode, find, refName } of v2PaymentParagraphs) {
    if (mode === 'housing-loan') {
      // The supplied template has this sample sentence twice. Remove the
      // unnumbered first copy; retain its numbered copy at regular weight.
      rewrites.push({ find, replace: '', records: [], when: paragraph => !/<w:numPr\b/.test(paragraph) });
      rewrites.push({
        find,
        replace: '',
        records: paid.filter(payment => payment.mode === mode).map(payment => paymentRecord(payment, refName)),
        when: paragraph => /<w:numPr\b/.test(paragraph),
        regularWeight: true,
      });
      continue;
    }
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
      if (payment.mode === 'through-bank') return `${prefix} paid through bank by the Vendee/s, namely ${payment.payer || partyDisplayName(state.form, 'claimant') || ''}, to the Vendor/s, namely ${payment.payee || partyDisplayName(state.form, 'executant') || ''}.`;
      return payment.mode === 'cash' ? `${prefix} paid via cash${date ? ` dated ${date}` : ''}.`
        : `${prefix} paid${mode ? ` through ${mode}` : ''}${ref ? ` bearing No. ${ref}` : ''}${bank ? ` drawn on ${bank}` : ''}${date ? ` dated ${date}` : ''}.`;
    }).join('; ') });
  }
  for (const side of ['executant', 'claimant'] as const) {
    const records = partyRecords(state, side);

    rewrites.push({
      find: new RegExp(side === 'executant' ? '<EXECUTANT NAME>' : '<CLAIMANT NAME>'), replace: '',
      partyRole: side,
      records: records.map((record, index) => {
        const form = { ...state.form };
        for (const field of ALL_FIELDS.filter(f => f.id.startsWith(side))) form[field.id] = record.values[field.id] || '';
        const partyId = index === 0 ? (side === 'executant' ? state.primaryExecutantId : state.primaryClaimantId) || 'primary' : record.id;
        const people = state.partyPeopleByParty?.[side + '|' + partyId] || { representatives: [], members: [] };
        const prefix = partyCapacityPrefix(record.values[side + 'PartyType']);
        return { 'PARTY CAPACITY PREFIX': prefix, ...mergeValues({ ...state, form }), 'Registration Name': partyDisplayName(record.values, side), 'Registration Address': isEntity(record.values, side) ? record.values[side + 'EntityAddress'] || '' : ['HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'].map(suffix => record.values[side + suffix]?.trim()).filter(Boolean).join(', '), [side === 'executant' ? 'Executant Share' : 'Claimant Share']: ownershipShare(state, side, partyId), ...(isEntity(record.values, side) ? { 'ENTITY RECITAL': entityRecital(record.values, side, people) } : {}), 'UNDIVIDED SHARE RECITAL': ownershipShare(state, side, partyId) ? 'Holding Undivided Share of ' + ownershipShare(state, side, partyId) : '' };
      }),
    });
  }
  if (state.saleDocument && state.saleDocument !== 'ordinary') {
    const principals = partyRecords(state, 'executant');
    const principalRecords = principals.map((record, index) => {
      const values = Object.fromEntries(Object.entries(record.values).filter(([key]) => key.startsWith('executant')).map(([key, value]) => [key.slice(9), value]));
      return { 'PARTY CAPACITY PREFIX': partyCapacityPrefix(record.values.executantPartyType), ...authorityPartyValues(values, 'Principal'), 'Executant Share': ownershipShare(state, 'executant', index === 0 ? state.primaryExecutantId || 'primary' : record.id) };
    });
    rewrites.push({ find: /<PRINCIPAL NAME>/i, replace: '', finalSuffix: /\s+represented herein[\s\S]*$/i, records: principalRecords });
    rewrites.push({ find: /<ATTORNEY NAME>/i, replace: '', finalSuffix: /\s+the Principal owner\/s[\s\S]*$/i, records: (state.saleAuthority?.attorneys || []).map(attorney => ({
      ...authorityPartyValues(attorney.values, 'Attorney'),
      'Attorney Share': vendeeShareCents(attorney.values.SharePercentage || '') === null ? '' : `${(vendeeShareCents(attorney.values.SharePercentage) || 0) / 100}%`,
      'Represented Principals': attorney.principalIds.map(id => principals.find((record, index) => (index ? record.id : state.primaryExecutantId || 'primary') === id)?.values.executantName || '').filter(Boolean).join(', '),
    })) });
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
  const vendees = partyRecords(state, 'claimant');
  const vendors = partyRecords(state, 'executant');
  return scheduleRecords(state).map(record => {
    const propertyFieldIds = new Set(GROUPS.flatMap(group => group.fields.map(field => field.id)));
    const blankTitleFields = Object.fromEntries(LINK_OPTIONS.flatMap(option => option.fields)
      .filter(field => !propertyFieldIds.has(field.id)).map(field => [field.id, '']));
    const scheduleState: AppState = {
      ...state,
      category: record.category,
      unit: record.unit,
      form: { ...propertyForm(state, record.values), ...blankTitleFields },
      additionalSchedules: [],
      structureDetailsBySchedule: { primary: record.structureDetails || { totalFloors: '', rows: [] } },
    };
    const values = mergeValues(scheduleState);
    const titleValues = { ...values };
    const titleLinkRecords = linkDocumentRecordsForSchedule(state, record.id);
    const registeredTitleLinks: Record<string, string>[] = [];
    const taxRecords = titleLinkRecords.filter(titleRecord => titleRecord.values.linkOption === 'houseTax'
      || (!titleRecord.values.linkOption && ['houseTaxReceiptNo', 'assessmentPtinNo', 'taxPaidDate', 'localBodyName']
        .some(key => !!titleRecord.values[key])));
    for (const titleRecord of titleLinkRecords) {
      const mapped = mergeValues({ ...scheduleState, form: { ...scheduleState.form, ...titleRecord.values } });
      for (const [key, value] of Object.entries(mapped)) if (value && !titleValues[key]) titleValues[key] = value;
      if ((isMunicipalGift(state) && ['linkDocNo', 'linkDocType', 'linkDocDate', 'linkSro'].some(key => !!titleRecord.values[key])) || (['linkDocNo', 'linkDocType'].every(key => !!titleRecord.values[key])
        && (titleRecord.values.linkSro || scheduleState.form.sro))) {
        registeredTitleLinks.push({ ...mapped,
          'Sub Registrar': titleRecord.values.linkSro || scheduleState.form.sro,
          'Sub-Registrar': titleRecord.values.linkSro || scheduleState.form.sro,
          'Sub Registrar Code': titleRecord.values.linkSroCode || '',
        });
      }
    }
    const complete = (options: string[], fields: string[]) => titleLinkRecords.find(titleRecord =>
      (options.includes(titleRecord.values.linkOption || '') || (!titleRecord.values.linkOption && fields.some(field => !!titleRecord.values[field])))
      && fields.every(field => !!titleRecord.values[field]));
    const mapped = (titleRecord?: typeof titleLinkRecords[number]) => titleRecord
      ? mergeValues({ ...scheduleState, form: { ...scheduleState.form, ...titleRecord.values } }) : undefined;
    const registered = registeredTitleLinks[0];
    for (const name of ['Link Doc Type', 'Link Doct.No.', 'Link Doct.Date', 'Sub Registrar', 'Sub Registrar Code']) {
      titleValues[name] = registered?.[name] || '';
    }
    const preferredField = (field: string, options: string[]) => options.map(option =>
      titleLinkRecords.find(titleRecord => titleRecord.values.linkOption === option && titleRecord.values[field])?.values[field]).find(Boolean) || '';
    const legacyVacantTax = !preferredField('vltNo', ['landLayoutLrs', 'vacantTax']) && variantFor(record.category) !== 'IF HOUSE'
      ? taxRecords.find(tax => !tax.values.linkOption && tax.values.assessmentPtinNo) : undefined;
    titleValues['V.L.T. No.'] = preferredField('vltNo', ['landLayoutLrs', 'vacantTax']) || legacyVacantTax?.values.assessmentPtinNo || record.values.assessmentPtinNo || '';
    titleValues['V.L.T No.'] = titleValues['V.L.T. No.'];
    titleValues['V.L.T.No.'] = titleValues['V.L.T. No.'];
    titleValues['Layout File No.'] = preferredField('layoutFileNo', ['landLayoutLrs', 'approvedLayout', 'layoutLrs']);
    const deed = mapped(complete(['titleDeed'], ['titleDeedNo', 'khataNo']));
    titleValues['Pattadar Pass Book No'] = deed?.['Pattadar Pass Book No'] || '';
    titleValues['Pass Book Khata No'] = deed?.['Pass Book Khata No'] || '';
    titleValues['Pattadar Pass Book No.'] = titleValues['Pattadar Pass Book No'];
    titleValues['Pass Book Khata No.'] = titleValues['Pass Book Khata No'];
    const nala = complete(['nala'], ['nalaOrderNo']);
    titleValues['Nala Order No'] = nala?.values.nalaOrderNo || '';
    titleValues['Nala Order No.'] = titleValues['Nala Order No'];
    titleValues['Nala Order Date'] = deedDate(nala?.values.nalaProceedingDate || '');
    const tax = mapped(taxRecords.find(({ values: item }) => item.houseTaxReceiptNo && item.localBodyName));
    titleValues['House Tax Receipt'] = tax?.['House Tax Receipt'] || '';
    titleValues['Local Body Name'] = tax?.['Local Body Name'] || '';
    const taxRecord = taxRecords.find(({ values: item }) => item.houseTaxReceiptNo && item.localBodyName);
    titleValues['Tax Paid Date'] = deedDate(taxRecord?.values.taxPaidDate || '');
    const explicitAssessment = preferredField('bltNo', ['houseTax', 'assessment']);
    const taxAssessment = taxRecords.find(({ values: item }) => item.assessmentPtinNo)?.values.assessmentPtinNo;
    const assessment = explicitAssessment || record.values.bltNo || taxAssessment || '';
    titleValues['P.T.I.No.'] = assessment;
    titleValues['P.T.I. No.'] = assessment;
    const permission = mapped(complete(['permissions'], ['permBuildingPermitNo', 'permissionAuthorityName']));
    titleValues['House Permission No.'] = permission?.['House Permission No.'] || record.values.buildingPermitNo || '';
    titleValues['Permission Date'] = permission?.['Permission Date'] || '';
    titleValues['Municipality/Gram Panchayat Name'] = permission?.['Municipality/Gram Panchayat Name'] || '';
    titleValues['Municipality/Municipal Corporation/Gram Panchayat Name'] = titleValues['Municipality/Gram Panchayat Name'];
    titleValues['LRS Application No.'] = preferredField('lrsApplicationNo', ['landLayoutLrs', 'lrsApplication', 'layoutLrs']);
    titleValues['Application Date'] = deedDate(preferredField('lrsApplicationDate', ['landLayoutLrs', 'lrsApplication', 'layoutLrs']));
    titleValues['LRS Proceeding No.'] = preferredField('lrsProceedingNo', ['landLayoutLrs', 'lrsProceeding', 'layoutLrs']);
    titleValues['Proceeding Date'] = deedDate(preferredField('lrsProceedingDate', ['landLayoutLrs', 'lrsProceeding', 'layoutLrs']));
    const supportingRecords = supportingRecordsForSchedule(state, record.id)
      .map(supportingRecordRecital)
      .filter(Boolean);
    const vendeeShares = vendees.some((party, index) => state.vendeeSharesBySchedule?.[record.id]?.[index === 0 ? state.primaryClaimantId || 'primary' : party.id]?.trim()) ? vendees.map((vendee, index) => {
      const partyId = index === 0 ? state.primaryClaimantId || 'primary' : vendee.id;
      const cents = vendeeShareCents(state.vendeeSharesBySchedule?.[record.id]?.[partyId] || '');
      return {
        partyNumber: index + 1,
        name: partyDisplayName(vendee.values, 'claimant').toLocaleUpperCase('en-IN'),
        percentage: cents === null ? '' : String(cents / 100),
      };
    }).filter(share => share.percentage !== '') : undefined;
    const vendorShares = vendors.some((party, index) => state.vendorSharesBySchedule?.[record.id]?.[index === 0 ? state.primaryExecutantId || 'primary' : party.id]?.trim()) ? vendors.map((vendor, index) => {
      const partyId = index === 0 ? state.primaryExecutantId || 'primary' : vendor.id;
      const cents = vendeeShareCents(state.vendorSharesBySchedule?.[record.id]?.[partyId] || '');
      return {
        partyNumber: index + 1,
        name: partyDisplayName(vendor.values, 'executant').toLocaleUpperCase('en-IN'),
        percentage: cents === null ? '' : String(cents / 100),
      };
    }).filter(share => share.percentage !== '') : undefined;
    return { variant: variantFor(record.category, record.category === 'Flat' ? record.values.flatStage : record.values.houseStage), values, titleValues, titleLinkRecords: registeredTitleLinks, supportingRecords, structureDetails: record.structureDetails, vendorShares, vendeeShares };
  });
}

/** Which SCHEDULE OF PROPERTY block of the template this deed uses. */
export const variantFor = (category: string, stage = '') => category === 'Flat' ? flatVariant(stage) : ['Residential', 'Commercial'].includes(category) && flatStage(stage) === 'Semi-Finished' ? 'IF HOUSE SEMI FINISHED' : SCHEDULE_VARIANT[category] || 'IF OPEN PLOT';

/** Filename for the generated deed, identified by instrument and claimant. */
export function deedFilename(state: AppState): string {
  const claimant = isMunicipalGift(state) ? [localAuthorityName(state.form.localAuthorityType || ''), state.form.village].filter(Boolean).join(' ') : partyDisplayName(state.form, 'claimant') || state.additionalClaimants
    .map(record => partyDisplayName(record.values, 'claimant')).find(Boolean) || 'Unnamed deed';
  const safe = (value: string) => value.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[._-]+|[._-]+$/g, '');
  const saleMode = state.deedType === 'Sale' ? state.saleDocument : undefined;
  return `${safe(isMunicipalGift(state) ? 'Municipal Gift' : saleMode ? saleDocumentLabel(saleMode) : state.deedType || 'Deed')}${saleMode ? '-' + safe([state.category, state.category === 'Flat' ? state.form.flatStage : state.form.houseStage].filter(Boolean).join(' ')) : ''}-${safe(claimant).slice(0, 100) || 'Unnamed-deed'}.docx`;
}

export { money, words };
