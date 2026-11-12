import { releaseValues, releaseScheduleValues } from './release';
import { enclosureRecordsFor } from './enclosure-records';
import { claimantRepresentationForOutput, isMinorParty, linkedClaimantRepresentation, minorClaimantValues, minorGuardianRecital, minorPartyErrors } from './minor-parties';
import { deedMobile, executionDeedDate } from './deed-format';
import { formatDeedAmount, stampPaperValue, stampSheetCount } from './deed-money';
import { acreGuntasToSqYards } from './land-area';
import { PROPERTY_DIRECTIONS } from './fields';
import { reconveyanceValues } from './reconveyance';
import { authorityPartyValues, saleDocumentLabel } from './sale-options';
import { isMunicipalGift } from './municipal-gift';
import { linkEnclosureValues } from './link-enclosure';
import { poaValues } from './poa-options';
import { titleAmendmentKind, titleAmendmentValues } from './title-amendments';
import { giftRelationshipValues } from './gift-options';
import { localAuthorityName } from './fields';
import { instrumentIdForLegacyType } from './instruments';
import { entityRecital, isEntity, partyDisplayName } from './party-entities';
import { flatStage, flatVariant } from './flat-options';
import { normalizePropertyPlaceName } from './place-names';
import { housePtinPairsForSources, parsePropertyHousePtinPairs, propertyHousePtinOutput } from './property-house-ptin';
// Builds the placeholder -> value map the template expects, from live form state.

import type { Rewrite, ScheduleMerge } from './docx';
import { ALL_FIELDS, GROUPS, LINK_OPTIONS, STRUCTURE_TYPE_OPTIONS, SCHEDULE_VARIANT } from './fields';
import { withDerived, deedDate, money, partyRecords, scheduleRecords, linkDocumentRecordsForSchedule, supportingRecordsForSchedule, uppercasePartyIdentity, vendeeShareCents, words, type AppState, type SupportingRecord } from './logic';
import { deedPaymentRecital, modeSpec, type Payment } from './payments';

function shareExtent(state: AppState, schedule: ReturnType<typeof scheduleRecords>[number], cents: number, side: 'executant' | 'claimant', partyId: string): string {
  const override = state.shareExtentOverrides?.[`${side}|${partyId}|shareExtentSqYards:${schedule.id}`]?.trim();
  if (override && /^\d+(?:\.\d+)?$/.test(override)) return override;
  const total = Number(withDerived(schedule.values).extentSqYards?.replace(/,/g, ''));
  return Number.isFinite(total) && total > 0 ? String(Number((total * cents / 10000).toFixed(4))) : '';
}

function ownershipShare(state: AppState, side: 'executant' | 'claimant', partyId: string): string {
  if (state.deedType === 'Deed Of Reconvayance') return '';
  const schedules = scheduleRecords(state);
  const shares = side === 'executant' ? state.vendorSharesBySchedule : state.vendeeSharesBySchedule;
  return schedules.map((schedule, index) => {
    const cents = vendeeShareCents(shares?.[schedule.id]?.[partyId] || '');
    if (cents === null) return '';
    const extent = shareExtent(state, schedule, cents, side, partyId);
    const value = `${cents / 100}%${extent ? ` (${extent} Sq. Yards)` : ''}`;
    return schedules.length > 1 ? `Schedule ${index + 1}: ${value}` : value;
  }).filter(Boolean).join('; ');
}

/** Values for every placeholder the template names. */
export function mergeValues(state: AppState, partyForm?: AppState['form']): Record<string, string> {
  const { recipients } = claimantRepresentationForOutput(state);
  const primaryRecipient = recipients[0]?.values;
  const form = partyForm || { ...state.form };
  if (!partyForm && primaryRecipient && primaryRecipient !== state.form) {
    for (const field of ALL_FIELDS.filter(field => field.id.startsWith('claimant'))) form[field.id] = primaryRecipient[field.id] || '';
  }
  const f = withDerived(minorClaimantValues(form));
  const out: Record<string, string> = { 'Stamp Paper Margin': f.stampPaperMargin || 'Legacy', 'Stamp Paper Count': String(stampSheetCount(f.stampPaperCount)) };
  out['Landmark Valuation Enabled'] = String(['Open Place', 'Vacant Plot'].includes(state.category));
  if (isMunicipalGift(state)) { out.ULB = localAuthorityName(f.localAuthorityType || ''); out.VILLAGE = normalizePropertyPlaceName('village', f.village || ''); }
  const nalaArea = acreGuntasToSqYards(f.nalaExtent || '');
  if (nalaArea !== null) out['NALA Converted Extent'] = String(nalaArea);
  const minorErrors = (['executant', 'claimant'] as const).flatMap(side => partyRecords(state, side).flatMap((record, index) => (side === 'claimant' ? linkedClaimantRepresentation(record.values, partyRecords(state, 'claimant').map((p, i) => ({ ...p, id: i ? p.id : state.primaryClaimantId || 'primary' }))).errors : minorPartyErrors(record.values, side)).map(reason => `${side === 'executant' ? 'Executant' : 'Claimant'} ${index + 1}: ${reason}`)));
  out['Minor Representation Complete'] = String(!minorErrors.length);
  out['Minor Representation Errors'] = minorErrors.join('\n');
  Object.assign(out, giftRelationshipValues(state), poaValues(state));

  // Straight field -> placeholder mappings declared in fields.ts.
  for (const field of ALL_FIELDS) {
    if (!field.ph) continue;
    const names = Array.isArray(field.ph) ? field.ph : [field.ph];
    let value = normalizePropertyPlaceName(field.id, uppercasePartyIdentity(field.id, f[field.id] ?? ''));
    if (field.type === 'date') value = deedDate(value);
    if (field.type === 'tel') value = deedMobile(value);
    if (field.type === 'money') value = formatDeedAmount(value);
    if (field.type === 'number' && /^(?:extentSq|udsSq|superBuiltUpAreaSq|parkingAreaSq)/.test(field.id)) value = value.replace(/,/g, '');
    for (const n of names) out[n] = value;
  }
  // Legacy drafts stored vacant-land assessment under assessmentPtinNo.
  out['V.L.T No.'] = f.vltNo || f.assessmentPtinNo || '';
  out['V.L.T. No.'] = out['V.L.T No.'];
  out['V.L.T.No.'] = out['V.L.T No.'];
  // The Schedule of Property's "Registration Sub-District" placeholder uses
  // the same office selected in Jurisdiction, never an older link-deed office.
  const registrationSro = normalizePropertyPlaceName('sro', f.sro || f.linkSro || '');
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
  const pairedHouseIds = parsePropertyHousePtinPairs(f.housePtinPairs || '');
  if (pairedHouseIds !== null) {
    const pairedOutput = propertyHousePtinOutput(f.housePtinPairs || '');
    out['Bearing H.No.'] = (state.category === 'Residential' && f.bearingHNo) || pairedOutput.houseNos;
    out['Municipal House Nos.'] = out['Bearing H.No.'];
    if (state.category === 'Part open place') out['Near H.No.'] = pairedOutput.houseNos;
    out['P.T.I.No.'] = pairedOutput.ptins;
    out['P.T.I. No.'] = pairedOutput.ptins;
  }
  out['Municipality/Municipal Corporation/Gram Panchayat Name'] = normalizePropertyPlaceName('permissionAuthorityName', f.permissionAuthorityName || '');
  out['House Permission No.'] = f.permBuildingPermitNo || f.buildingPermitNo || '';
  out['Stage'] = state.category === 'Flat' ? flatStage(f.flatStage) : out['Stage'] || '';
  out['Plot Nos.'] = f.plotNo || '';
  const houseRows = state.structureDetailsBySchedule.primary?.rows || [];
  const firstStructure = houseRows.find(row => row.structureType && !STRUCTURE_TYPE_OPTIONS.includes(row.structureType));
  out['Nature of House'] = f.roofMaterial || (firstStructure?.structureType === 'Other / Custom Structure'
    ? firstStructure.customStructureType || '' : firstStructure?.structureType || '');
  out['Roof Material'] = f.roofMaterial || '';
  out['Construction Description'] = f.constructionDescription || '';
  out['Type of structure'] = out['Construction Description'];
  const ages = houseRows.map(row => row.buildingAge).filter(value => value !== '').map(Number).filter(Number.isFinite);
  out['Age of House'] = ages.length ? String(Math.max(...ages)) : '';
  out['Floors'] = state.structureDetailsBySchedule.primary?.totalFloors || '';
  const areas = houseRows.map(row => row.builtUpAreaSqFt).filter(value => value !== '').map(Number).filter(Number.isFinite);
  out['Plinth Area'] = areas.length ? String(areas.reduce((sum, area) => sum + area, 0)) : '';

  // Historical template aliases use the same entered structure facts.
  out['Structure Type'] = out['Nature of House'];
  out['Building Age'] = out['Age of House'];
  out['Total Built-up Area'] = out['Plinth Area'];

  // Derived values.
  const squareYards = Number(String(f.extentSqYards || '').replace(/,/g, ''));
  if (f.extentSqYards && Number.isFinite(squareYards) && squareYards > 0) {
    out['Extent in Sq.yards'] = String(squareYards);
    out['Extent in Sq.Meters'] = String(Math.round(squareYards * 0.836127 * 100) / 100);
  } else {
    out['Extent in Sq.yards'] = '';
    out['Extent in Sq.Meters'] = '';
  }
  // Square metres are derived from the verified yard extent. A stale source
  // disagreement about the derived value must not erase the calculation.
  if (state.unresolvedFields?.includes('extentSqYards')) {
    out['Extent in Sq.yards'] = ''; out['Extent in Sq.Meters'] = '';
  }
  out['Total Land Extent'] = out['Extent in Sq.yards'];

  // The deed's first page prints the sale consideration itself, not the
  // calculated basic-rate market value (which stays visible to the drafter
  // only in the Market Value step's on-screen "calculated market value" panel).
  const considText = formatDeedAmount(f.consid || '');
  out['Market of Value Rs./-'] = considText;
  out['Sale Consideration'] = considText;
  out['Statement of Market Value Consideration'] = considText;
  out['Sale Consideration Words'] = words(f.consid);
  out['Consideration in words'] = words(f.consid);
  out['Market Value Per Sq.Yard'] = formatDeedAmount(f.govtRate || '');

  // Relation + relative's name are collected as two fields but recite as one
  // template line ("S/o Yellaiah"), same as before the fields were split.
  for (const side of ['executant', 'claimant'] as const) {
    const ph = side === 'executant' ? 'EXECUTANT RELATION NAME' : 'CLAIMANT RELATION NAME';
    out[ph] = [f[`${side}Relation`]?.toUpperCase(), uppercasePartyIdentity(`${side}RelativeName`, f[`${side}RelativeName`] || '')].filter(Boolean).join(' ');
  }

  if (['Gift', 'Agreement of Sale', 'Agreement of Sale Cum GPA', 'Deed Of Reconvayance'].includes(state.deedType)) {
    out['Municipality/Gram Panchayat Name'] = normalizePropertyPlaceName('permissionAuthorityName', f.permissionAuthorityName || '');
    out.Date = executionDeedDate(f.executionDate || '');
    for (const [side, label] of [['executant', 'Executant'], ['claimant', 'Claimant']] as const) out[label + ' Address'] = ['HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'].map(suffix => f[side + suffix]?.trim()).filter(Boolean).join(', ');
  }

  out['Stamp of Rs/-'] = formatDeedAmount(stampPaperValue(f));

  // The template has a single set of instrument placeholders, so the largest
  // payment is the one printed there; the full list is recited in the receipt
  // clause instead (see paymentRecital).
  const paid = instrumentIdForLegacyType(state.deedType) === 'power_of_attorney' ? [] : state.payments.filter(p => p.amount !== '');
  const primary: Payment | undefined = paid.length
    ? paid.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a))
    : undefined;

  out['Cheque.Amount'] = formatDeedAmount(primary?.amount || '');
  out['Cheque.No.'] = primary?.refNo ?? '';
  out['Cheque.Branch'] = primary
    ? [primary.bank, primary.branch].filter(Boolean).join(', ')
    : '';
  out['Cheque.Date'] = primary ? deedDate(primary.date) : '';
  out['Utr/Reference No.'] = primary?.refNo ?? '';
  out['Remitting Bank'] = primary ? [primary.bank, primary.branch].filter(Boolean).join(', ') : '';

  out['Sale Document Mode'] = state.saleDocument || 'ordinary';
  out['Execution Date'] = executionMonthDate(f.executionDate || '');
  out.Date = out['Execution Date'];
  const authority = state.saleAuthority;
  for (const prefix of ['G.P.A.', 'A.G.P.A.']) {
    out[prefix + 'Doct.No.'] = authority?.documentNo || '';
    out[prefix + 'Doct.Date'] = deedDate(authority?.documentDate || '');
  }
  out['Authority Book Number'] = authority?.bookNumber || '';
  out['Authority SRO'] = state.saleDocument === 'gpa' ? normalizePropertyPlaceName('sro', authority?.sro || '') : authority?.sro || '';
  out['Authority SRO Code'] = authority?.sroCode || '';
  out['Authority Attorney Count'] = String(authority?.attorneys.length || 0);
  out['Ownership Vendor Enabled'] = String(Object.values(state.vendorSharesBySchedule || {}).some(shares => Object.values(shares).some(value => value.trim())));
  out['Ownership Vendee Enabled'] = String(Object.values(state.vendeeSharesBySchedule || {}).some(shares => Object.values(shares).some(value => value.trim())));
  out['Ownership Vendor Count'] = String(partyRecords(state, 'executant').length);
  out['Ownership Vendee Count'] = String(recipients.length);
  out['Executant Gender'] = isEntity(f, 'executant') ? 'Other' : f.executantGender || '';
  out['Claimant Gender'] = isEntity(f, 'claimant') ? 'Other' : f.claimantGender || '';
  out['Attorney Gender'] = authority?.attorneys.length ? authority.attorneys[0].values.Gender || '' : out['Claimant Gender'];
  out['Authority Holder Label'] = state.saleDocument === 'gpa' ? 'G.P.A. HOLDER OF' : state.saleDocument === 'agpa' ? 'A.G.P.A. HOLDER OF' : '';
  out['Authority Principal Names'] = partyRecords(state, 'executant').map(record => partyDisplayName(record.values, 'executant').toLocaleUpperCase('en-IN')).filter(Boolean).join(', ');
  out['Executant Share'] = ownershipShare(state, 'executant', state.primaryExecutantId || 'primary');
  out['Claimant Share'] = ownershipShare(state, 'claimant', state.primaryClaimantId || 'primary');
  out['Adjusted Amount'] = formatDeedAmount(authority?.adjustedAmount || '');
  for (const [label, pattern] of [['Ground Floor Area', /^(ground|g|0)$/i], ['First Floor Area', /^(first|1|1st)$/i]] as const) {
    const rows = houseRows.filter(row => pattern.test(row.floorNo.trim()));
    out[label] = rows.length ? String(rows.reduce((sum, row) => sum + Number(row.builtUpAreaSqFt.replace(/,/g, '') || 0), 0)) : '';
  }
  if (isMunicipalGift(state)) { out.Village = out.VILLAGE; out['Local Authority Type'] = out.ULB; }
  if (state.deedType === 'Release') Object.assign(out, releaseValues(state));
  if (state.deedType === 'Deed Of Reconvayance') Object.assign(out, reconveyanceValues(state));
  return out;
}

/** Compatibility name for saved drafts; full dates use the shared deed format. */
export const executionMonthDate = executionDeedDate;

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
  const claimants = claimantRepresentationForOutput(state);
  const claimantPoints = new Map(claimants.recipients.map(({ id }, index) => [id, index + 1]));
  const defaultPayer = (state.deedType === 'Release' ? claimants.recipients : claimants.recipients.slice(0, 1))
    .map(({ values }) => partyDisplayName(values, 'claimant')).filter(Boolean).join(', ');
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
  const paid = instrumentIdForLegacyType(state.deedType) === 'power_of_attorney' ? [] : state.payments.filter(payment => payment.amount !== '');
  // The v2 template contains one sample paragraph for each payment method.
  // Replace each sample with one cloned paragraph per actual payment, or remove
  // it entirely when that method was not used.
  const paymentRecord = (payment: Payment, refName: string) => ({
    Amount: formatDeedAmount(payment.amount),
    [refName]: payment.refNo || '',
    'Utr/Reference No.': payment.refNo || '',
    'Bank Name': [payment.bank, payment.branch].filter(Boolean).join(', '),
    'Housing Loan Bank': payment.bank || '',
    'Housing Loan Branch': payment.branch || '',
    'Remitting Bank': [payment.bank, payment.branch].filter(Boolean).join(', '),
    Date: deedDate(payment.date),
    'Claimant Name': payment.payer || defaultPayer,
    'CLAIMANT NAME': payment.payer || defaultPayer,
    'Executant Name': payment.payee || (state.deedType === 'Release' ? partyRecords(state,'executant').map(p=>partyDisplayName(p.values,'executant')).filter(Boolean).join(', ') : partyDisplayName(state.form, 'executant')) || '',
    'EXECUTANT NAME': payment.payee || (state.deedType === 'Release' ? partyRecords(state,'executant').map(p=>partyDisplayName(p.values,'executant')).filter(Boolean).join(', ') : state.form.executantName) || '',
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
      const amount = formatDeedAmount(payment.amount);
      const mode = payment.mode ? modeSpec(payment.mode).label : '';
      const ref = payment.refNo || '';
      const bank = [payment.bank, payment.branch].filter(Boolean).join(', ');
      const date = deedDate(payment.date);
      const prefix = `(${index + 1}) Amount of Rs.${amount}/-`;
      if (payment.mode === 'through-bank') return `${prefix} paid through bank by the Vendee/s, namely ${payment.payer || defaultPayer}, to the Vendor/s, namely ${payment.payee || partyDisplayName(state.form, 'executant') || ''}.`;
      return payment.mode === 'cash' ? `${prefix} paid via cash${date ? ` dated ${date}` : ''}.`
        : `${prefix} paid${mode ? ` through ${mode}` : ''}${ref ? ` bearing No. ${ref}` : ''}${bank ? ` drawn on ${bank}` : ''}${date ? ` dated ${date}` : ''}.`;
    }).join('; ') });
  }
  for (const side of ['executant', 'claimant'] as const) {
    const records = side === 'claimant' ? claimants.recipients : partyRecords(state, side);

    rewrites.push({
      find: new RegExp(side === 'executant' ? '<EXECUTANT NAME>' : '<CLAIMANT NAME>'), replace: '',
      partyRole: side,
      records: records.map((record, index) => {
        const identity = side === 'claimant' ? minorClaimantValues(record.values) : record.values;
        const minorClaimant = side === 'claimant' && isMinorParty(identity, side);
        const form = { ...state.form };
        for (const field of ALL_FIELDS.filter(f => f.id.startsWith(side))) form[field.id] = identity[field.id] || '';
        const partyId = side === 'executant' && index === 0 ? state.primaryExecutantId || 'primary' : record.id;
        const people = state.partyPeopleByParty?.[side + '|' + partyId] || { representatives: [], members: [] };
        const prefix = minorClaimant ? '' : partyCapacityPrefix(record.values[side + 'PartyType']);
        const guardianRecital = side === 'claimant'
          ? linkedClaimantRepresentation(record.values, claimants.records, (id, recital) => {
            const minors = claimants.minorsByGuardian.get(id);
            if (minors?.at(-1) !== partyId) return '';
            if (minors.length === 1) return recital;
            const points = minors.map(minorId => claimantPoints.get(minorId));
            return recital + ', representing the minors at Points ' + points.slice(0, -1).join(', ') + ' and ' + points.at(-1);
          }).recital
          : minorGuardianRecital(record.values, side);
        return { 'MINOR CLAIMANT': String(minorClaimant), 'MINOR GUARDIAN RECITAL': guardianRecital, 'PARTY CAPACITY PREFIX': prefix, ...mergeValues(state, form), 'Registration Name': partyDisplayName(record.values, side), 'Registration Address': isEntity(record.values, side) ? record.values[side + 'EntityAddress'] || '' : ['HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'].map(suffix => identity[side + suffix]?.trim()).filter(Boolean).join(', '), [side === 'executant' ? 'Executant Share' : 'Claimant Share']: ownershipShare(state, side, partyId), ...(isEntity(record.values, side) ? { 'ENTITY RECITAL': entityRecital(record.values, side, people) } : {}), 'UNDIVIDED SHARE RECITAL': ownershipShare(state, side, partyId) ? 'Holding Undivided Share of ' + ownershipShare(state, side, partyId) : '' };
      }),
    });
  }
  if (state.saleDocument && state.saleDocument !== 'ordinary') {
    const principals = partyRecords(state, 'executant');
    const principalRecords = principals.map((record, index) => {
      const values = Object.fromEntries(Object.entries(record.values).filter(([key]) => key.startsWith('executant')).map(([key, value]) => [key.slice(9), value]));
      return { 'MINOR GUARDIAN RECITAL': minorGuardianRecital(record.values, 'executant'), 'PARTY CAPACITY PREFIX': partyCapacityPrefix(record.values.executantPartyType), ...authorityPartyValues(values, 'Principal'), 'Executant Share': ownershipShare(state, 'executant', index === 0 ? state.primaryExecutantId || 'primary' : record.id) };
    });
    rewrites.push({ find: /<PRINCIPAL NAME>/i, replace: '', finalSuffix: /\s+represented herein[\s\S]*$/i, records: principalRecords });
    rewrites.push({ find: /<ATTORNEY NAME>/i, replace: '', finalSuffix: /\s+the Principal owner\/s[\s\S]*$/i, records: (state.saleAuthority?.attorneys || []).map(attorney => ({
      ...authorityPartyValues(attorney.values, 'Attorney'),
      ...(state.saleDocument === 'gpa' ? { 'Attorney NAME': (attorney.values.Name || '').toLocaleUpperCase('en-IN') } : {}),
      'Attorney Share': scheduleRecords(state).map((schedule, index, schedules) => {
        const cents = vendeeShareCents(attorney.values.SharePercentage || '');
        if (cents === null) return '';
        const extent = shareExtent(state, schedule, cents, 'claimant', attorney.id);
        return `${schedules.length > 1 ? `Schedule ${index + 1}: ` : ''}${cents / 100}%${extent ? ` (${extent} Sq. Yards)` : ''}`;
      }).filter(Boolean).join('; '),
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
  const vendees = claimantRepresentationForOutput(state).recipients;
  const vendors = partyRecords(state, 'executant');
  return scheduleRecords(state).map(record => {
    const propertyFieldIds = new Set(GROUPS.flatMap(group => group.fields.map(field => field.id)));
    const blankTitleFields = Object.fromEntries(LINK_OPTIONS.flatMap(option => option.fields)
      .filter(field => !propertyFieldIds.has(field.id)).map(field => [field.id, '']));
    const structureDetails = record.structureDetails && {
      ...record.structureDetails,
      rows: record.structureDetails.rows.map(row => ({ ...row, builtUpAreaSqFt: row.builtUpAreaSqFt.replace(/,/g, '') })),
    };
    const scheduleState: AppState = {
      ...state,
      category: record.category,
      unit: record.unit,
      form: { ...propertyForm(state, record.values), ...blankTitleFields },
      additionalSchedules: [],
      structureDetailsBySchedule: { primary: structureDetails || { totalFloors: '', rows: [] } },
    };
    const titleLinkRecords = linkDocumentRecordsForSchedule(state, record.id);
    const identificationPairs = housePtinPairsForSources({ ...record.values, category: record.category }, titleLinkRecords);
    if (identificationPairs) scheduleState.form.housePtinPairs = identificationPairs;
    const values = mergeValues(scheduleState);
    values['Property Category'] = record.category;
    for (const side of PROPERTY_DIRECTIONS) values[side + ' Dimension'] = record.values['dimension' + side] || '';
    if (state.deedType === 'Release') Object.assign(values, releaseScheduleValues(state, record.id));
    const titleValues = { ...values };
    const amendmentKind = (item: typeof titleLinkRecords[number]) => titleAmendmentKind(item.values);
    const amendmentRecords = { rectification: [] as Record<string, string>[], supplemental: [] as Record<string, string>[] };
    for (const item of titleLinkRecords) {
      const kind = amendmentKind(item);
      if (!kind) continue;
      const fields = titleAmendmentValues(item.values, kind);
      if (!fields[(kind === 'rectification' ? 'Rectification' : 'Supplemental') + ' Deed No.']) continue;
      amendmentRecords[kind].push({ ...mergeValues(scheduleState), ...fields, ...linkEnclosureValues(item.values) });
    }
    const registeredTitleLinks: Record<string, string>[] = [];
    const taxRecords = titleLinkRecords.filter(titleRecord => titleRecord.values.linkOption === 'houseTax'
      || (!titleRecord.values.linkOption && ['houseTaxReceiptNo', 'assessmentPtinNo', 'taxPaidDate', 'localBodyName']
        .some(key => !!titleRecord.values[key])));
    for (const titleRecord of titleLinkRecords) {
      if (amendmentKind(titleRecord)) continue;
      const mapped = mergeValues({ ...scheduleState, form: { ...scheduleState.form, ...titleRecord.values } });
      for (const [key, value] of Object.entries(mapped)) if (value && !titleValues[key]) titleValues[key] = value;
      if ((isMunicipalGift(state) && ['linkDocNo', 'linkDocType', 'linkDocDate', 'linkSro'].some(key => !!titleRecord.values[key])) || (['linkDocNo', 'linkDocType'].every(key => !!titleRecord.values[key])
        && (titleRecord.values.linkSro || scheduleState.form.sro))) {
        const titleSro = normalizePropertyPlaceName('sro', titleRecord.values.linkSro || scheduleState.form.sro || '');
        registeredTitleLinks.push({ ...mapped,
          'Sub Registrar': titleSro,
          'Sub-Registrar': titleSro,
          'Sub Registrar Code': titleRecord.values.linkSroCode || '',
          ...linkEnclosureValues(titleRecord.values),
          ...(isMunicipalGift(state) ? { 'Municipal Link Registered Office': titleRecord.values.linkSro || '' } : {}),
        });
      }
    }
    const complete = (options: string[], fields: string[]) => titleLinkRecords.find(titleRecord =>
      (options.includes(titleRecord.values.linkOption || '') || (!titleRecord.values.linkOption && fields.some(field => !!titleRecord.values[field])))
      && fields.every(field => !!titleRecord.values[field]));
    const mapped = (titleRecord?: typeof titleLinkRecords[number]) => titleRecord
      ? mergeValues({ ...scheduleState, form: { ...scheduleState.form, ...titleRecord.values } }) : undefined;
    const registered = registeredTitleLinks[0];
    for (const name of ['Link Authority']) titleValues[name] = registered?.[name] || '';
    for (const [kind, records] of Object.entries(amendmentRecords)) {
      const label = kind === 'rectification' ? 'Rectification' : 'Supplemental';
      for (const suffix of ['Type', 'No.', 'Date', 'SRO', 'SRO Code']) titleValues[label + ' Deed ' + suffix] = records[0]?.[label + ' Deed ' + suffix] || '';
    }
    for (const name of ['Link Doc Type', 'Link Doct.No.', 'Link Doct.Date', 'Sub Registrar', 'Sub Registrar Code']) {
      titleValues[name] = registered?.[name] || '';
    }
    const preferredField = (field: string, options: string[]) => options.map(option =>
      titleLinkRecords.find(titleRecord => titleRecord.values.linkOption === option && titleRecord.values[field])?.values[field]).find(Boolean) || '';
    const legacyVacantTax = !preferredField('vltNo', ['landLayoutLrs', 'vacantTax']) && record.category === 'Vacant Plot'
      ? taxRecords.find(tax => !tax.values.linkOption && tax.values.assessmentPtinNo
        && !['houseTaxReceiptNo', 'bltNo', 'bearingHNo', 'taxPaidDate', 'localBodyName'].some(field => tax.values[field])) : undefined;
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
    const nalaExtent = acreGuntasToSqYards(titleLinkRecords.find(link => link.values.linkOption === 'nala' && link.values.nalaExtent)?.values.nalaExtent || record.values.nalaExtent || '');
    if (nalaExtent !== null) values['NALA Converted Extent'] = String(nalaExtent);
    titleValues['Nala Order No'] = nala?.values.nalaOrderNo || '';
    titleValues['Nala Order No.'] = titleValues['Nala Order No'];
    titleValues['Nala Order Date'] = deedDate(nala?.values.nalaProceedingDate || '');
    const taxRecord = taxRecords.find(({ values: item }) => item.houseTaxReceiptNo && item.localBodyName);
    const tax = mapped(taxRecord);
    const taxReceiptNo = tax?.['House Tax Receipt'] || '';
    titleValues['House Tax Receipt'] = taxReceiptNo;
    titleValues['Local Body Name'] = tax?.['Local Body Name'] || '';
    titleValues['Tax Paid Date'] = deedDate(taxRecord?.values.taxPaidDate || '');
    const explicitAssessment = preferredField('bltNo', ['houseTax', 'assessment']);
    const taxAssessment = taxRecords.find(item => item !== legacyVacantTax && item.values.assessmentPtinNo)?.values.assessmentPtinNo;
    const extractedPairs = parsePropertyHousePtinPairs(identificationPairs);
    const pairedAssessment = extractedPairs === null ? '' : propertyHousePtinOutput(identificationPairs).ptins;
    const assessment = extractedPairs !== null ? pairedAssessment : explicitAssessment || record.values.bltNo || taxAssessment || '';
    titleValues['P.T.I.No.'] = assessment;
    titleValues['P.T.I. No.'] = assessment;
    if (record.category === 'Residential') {
      if (extractedPairs?.some(row => row.houseNo && !row.ptin)) {
        titleValues['Partial House Identification'] = extractedPairs.filter(row => row.ptin || row.houseNo).map((row, index) => {
          if (!row.ptin) return `${index ? 'separately identified by' : 'bearing'} H.No.${row.houseNo}`;
          return `under Assessment No.${row.ptin}${row.houseNo ? ' bearing H.No.' + row.houseNo : ''}`;
        }).join('; ');
      } else if (!assessment && values['Bearing H.No.']) {
        titleValues['Partial House Identification'] = 'bearing H.No.' + values['Bearing H.No.'];
      }
    }
    const permission = mapped(complete(['permissions'], ['permBuildingPermitNo', 'permissionAuthorityName']));
    titleValues['House Permission No.'] = permission?.['House Permission No.'] || record.values.buildingPermitNo || '';
    titleValues['Permission Date'] = permission?.['Permission Date'] || '';
    titleValues['Municipality/Gram Panchayat Name'] = permission?.['Municipality/Gram Panchayat Name'] || '';
    titleValues['Municipality/Municipal Corporation/Gram Panchayat Name'] = titleValues['Municipality/Gram Panchayat Name'];
    titleValues['LRS Application No.'] = preferredField('lrsApplicationNo', ['landLayoutLrs', 'lrsApplication', 'layoutLrs']);
    titleValues['Application Date'] = deedDate(preferredField('lrsApplicationDate', ['landLayoutLrs', 'lrsApplication', 'layoutLrs']));
    titleValues['LRS Proceeding No.'] = preferredField('lrsProceedingNo', ['landLayoutLrs', 'lrsProceeding', 'layoutLrs']);
    titleValues['Proceeding Date'] = deedDate(preferredField('lrsProceedingDate', ['landLayoutLrs', 'lrsProceeding', 'layoutLrs']));
    const enclosureRecords = enclosureRecordsFor(titleLinkRecords);
    for (const records of Object.values(enclosureRecords)) if (records?.length) Object.assign(titleValues, records[0]);
    const supportingRecords = supportingRecordsForSchedule(state, record.id)
      .map(supportingRecordRecital)
      .filter(Boolean);
    const vendeeShares = vendees.some(party => state.vendeeSharesBySchedule?.[record.id]?.[party.id]?.trim()) ? vendees.map((vendee, index) => {
      const partyId = vendee.id;
      const cents = vendeeShareCents(state.vendeeSharesBySchedule?.[record.id]?.[partyId] || '');
      return {
        partyNumber: index + 1,
        name: partyDisplayName(vendee.values, 'claimant').toLocaleUpperCase('en-IN'),
        percentage: cents === null ? '' : String(cents / 100),
        extentSqYards: cents === null ? '' : shareExtent(state, record, cents, 'claimant', partyId),
      };
    }).filter(share => share.percentage !== '') : undefined;
    const vendorShares = vendors.some((party, index) => state.vendorSharesBySchedule?.[record.id]?.[index === 0 ? state.primaryExecutantId || 'primary' : party.id]?.trim()) ? vendors.map((vendor, index) => {
      const partyId = index === 0 ? state.primaryExecutantId || 'primary' : vendor.id;
      const cents = vendeeShareCents(state.vendorSharesBySchedule?.[record.id]?.[partyId] || '');
      return {
        partyNumber: index + 1,
        name: partyDisplayName(vendor.values, 'executant').toLocaleUpperCase('en-IN'),
        percentage: cents === null ? '' : String(cents / 100),
        extentSqYards: cents === null ? '' : shareExtent(state, record, cents, 'executant', partyId),
      };
    }).filter(share => share.percentage !== '') : undefined;
    return { variant: variantFor(record.category, record.category === 'Flat' ? record.values.flatStage : record.values.houseStage), values, titleValues, titleLinkRecords: registeredTitleLinks, amendmentRecords, enclosureRecords, supportingRecords, structureDetails, vendorShares: state.deedType === 'Deed Of Reconvayance' ? undefined : vendorShares, vendeeShares: state.deedType === 'Deed Of Reconvayance' ? undefined : vendeeShares };
  });
}

/** Which SCHEDULE OF PROPERTY block of the template this deed uses. */
export const variantFor = (category: string, stage = '') => category === 'Flat' ? flatVariant(stage) : ['Residential', 'Commercial'].includes(category) && flatStage(stage) === 'Semi-Finished' ? 'IF HOUSE SEMI FINISHED' : SCHEDULE_VARIANT[category] || 'IF OPEN PLOT';

/** Filename for the generated deed, identified by instrument and claimant. */
export function deedFilename(state: AppState): string {
  const claimant = claimantRepresentationForOutput(state).recipients
    .map(record => partyDisplayName(record.values, 'claimant')).find(Boolean) || 'Unnamed deed';
  const safe = (value: string) => value.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[._-]+|[._-]+$/g, '');
  const saleMode = state.deedType === 'Sale' ? state.saleDocument : undefined;
  return `${safe(isMunicipalGift(state) ? 'Municipal Gift' : saleMode ? saleDocumentLabel(saleMode) : state.deedType || 'Deed')}${saleMode ? '-' + safe([state.category, state.category === 'Flat' ? state.form.flatStage : state.form.houseStage].filter(Boolean).join(' ')) : ''}-${safe(claimant).slice(0, 100) || 'Unnamed-deed'}.docx`;
}

export { money, words };
