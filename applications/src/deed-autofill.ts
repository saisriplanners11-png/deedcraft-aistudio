import { appStateFor } from '../../source-draft';
import { partyDisplayName } from '../../party-entities';
import type { SavedDeed } from '../../saved-deeds';
import { getEmptyFormsState, type AllFormsState, type FormType, type RelationType } from './types/forms';

type Values = Record<string, string>;
const propertySummary = (p: Values) => [
  p.category, p.village || p.locality, p.surveyNo && 'Survey ' + p.surveyNo,
  p.plotNo && 'Plot ' + p.plotNo, p.bearingHNo && 'House ' + p.bearingHNo,
].filter(Boolean).join(' · ');

export function savedDeedDetails(deed: SavedDeed) {
  const state = appStateFor(deed.draft);
  const parties = (side: 'executant' | 'claimant') => [
    state.form, ...(side === 'claimant' ? state.additionalClaimants : state.additionalExecutants).map(record => record.values),
  ].map(values => partyDisplayName(values, side)).filter(Boolean);
  const claimants = parties('claimant');
  const executants = parties('executant');
  const schedules = [{ id: 'primary', values: state.form }, ...state.additionalSchedules].map((schedule, index) => ({
    ...schedule,
    label: 'Schedule ' + (index + 1) + (propertySummary(schedule.values) ? ' · ' + propertySummary(schedule.values) : ''),
  }));
  const links = Object.values(state.linkRecordsBySchedule || {}).flat().map(record => record.values.linkDocNo).filter(Boolean);
  const title = deed.name || claimants.join(', ') || deed.claimantNames.join(', ') || deed.deedType;
  const summary = [deed.deedType, [...executants, ...claimants].filter(Boolean).join(', '), schedules.map(s => propertySummary(s.values)).filter(Boolean).join(' | '), links.join(', ')].filter(Boolean).join(' · ');
  const contact = [state.form, ...state.additionalClaimants.map(p => p.values), ...state.additionalExecutants.map(p => p.values)]
    .flatMap(p => [p.claimantMobile, p.executantMobile]);
  const locations = schedules.flatMap(({ values: p }) => [p.locality, p.village, p.mandal, p.district, p.sro, p.flatNo, p.apartmentName]);
  return { id: deed.id, title, summary, schedules, state, claimants, executants, searchText: [title, summary, ...contact, ...locations].join(' ').toLocaleLowerCase() };
}

export type SavedDeedDetails = ReturnType<typeof savedDeedDetails>;

function fill<T extends object>(current: T, values: Partial<T>): T {
  return { ...current, ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== '')) };
}

export function fillApplicationFromDeed(
  forms: AllFormsState, form: FormType, deed: SavedDeedDetails, scheduleId: string,
): AllFormsState {
  const property = deed.schedules.find(schedule => schedule.id === scheduleId)?.values;
  if (!property) return forms;

  const { state, claimants, executants } = deed;
  const p = property;
  const party = state.form;
  const applicant = partyDisplayName(party, 'claimant');
  const relation = ['S/O', 'W/O', 'D/O', 'S/W/D/O'].includes(party.claimantRelation) && party.claimantRelativeName
    ? party.claimantRelation as RelationType : undefined;
  const contact = { mobileNo: party.claimantMobile, relationLine: party.claimantRelativeName, relationType: relation, residenceAddress: party.claimantVillage };
  const links = (state.linkRecordsBySchedule?.[scheduleId] || []).filter(record => record.values.linkDocNo && (!record.values.linkOption || record.values.linkOption === 'linkDoc'));
  const document = links[0]?.values || {};
  const splitNumber = (number: string) => {
    const match = number.match(/^(.+?)\s*\/\s*((?:19|20)\d{2})$/);
    return [match?.[1] || number, match?.[2] || ''];
  };
  const [doctNo, year] = splitNumber(document.linkDocNo || '');
  const address = [p.locality, p.village, p.mandal, p.district].filter(Boolean);
  const extentSqY = p.extentSqYards || (p.unit === 'Sq. Yards' ? p.extent : '');
  const place = { village: p.village, mandal: p.mandal, district: p.district };
  const row = { syNo: p.surveyNo, plotNo: p.plotNo, extentSqY };
  switch (form) {
    case 'ccCopy':
      return { ...forms, ccCopy: fill(forms.ccCopy, {
        ...contact, fromNameAddress: applicant, toOffice: document.linkSro || p.sro,
        documentNo: document.linkDocNo, descriptionOfDocument: document.linkDocType,
        executantNameAddress: document.linkDocNo ? undefined : executants.join(', '),
        claimantNameAddress: document.linkDocNo ? undefined : claimants.join(', '),
        villageAndStreet: [p.village, p.locality].filter(Boolean).join(', '),
        surveyAndDoorNo: [p.surveyNo && 'Sy.No. ' + p.surveyNo, p.bearingHNo && 'H.No. ' + p.bearingHNo].filter(Boolean).join(', '),
        searchYear: year,
      }) };
    case 'mvOpen': {
      const current = forms.mvOpen;
      const [first, ...rest] = current.rows;
      const blank = getEmptyFormsState().mvOpen.rows[0];
      return { ...forms, mvOpen: fill(current, {
        ...place, mobileNo: contact.mobileNo, plaintiffNameAddress: applicant, plaintiffRelationType: relation,
        plaintiffRelationLine: contact.relationLine, plaintiffResidenceAddress: contact.residenceAddress,
        situatedLocality: p.locality, situatedMandal: p.mandal, situatedDistrict: p.district,
        rows: [fill(first || blank, { ...row, nearHNo: p.nearHNo, nearHNoLabel: p.nearAdjacent === 'Adjacent' ? 'Adjacent H.No.' : p.nearAdjacent === 'Near' ? 'Near H.No.' : undefined, valuePerSqY: p.govtRate }), ...rest],
      }) };
    }
    case 'mvHouse': {
      const current = forms.mvHouse;
      const [first, ...rest] = current.rows;
      const blank = getEmptyFormsState().mvHouse.rows[0];
      const structures = (state.structureDetailsBySchedule?.[scheduleId]?.rows || [])
        .filter(item => item.builtUpAreaSqFt)
        .map(item => ({ id: item.id, natureOfRoof: p.roofMaterial || p.roofNature || '', measurement: item.builtUpAreaSqFt, floorNo: item.floorNo, buildingAge: item.buildingAge, stage: item.stage, rate: item.rateOverride || '' }));
      return { ...forms, mvHouse: fill(current, {
        ...place, mobileNo: contact.mobileNo, plaintiffNameAddress: applicant, plaintiffRelationType: relation,
        plaintiffRelationLine: contact.relationLine, plaintiffResidenceAddress: contact.residenceAddress,
        situatedText: [...new Set(address)].join(', '),
        rows: [fill(first || blank, { ...row, bearingHNo: p.bearingHNo, structures: structures.length ? structures : undefined }), ...rest],
      }) };
    }
    case 'ec': {
      const current = forms.ec;
      const doorNo = p.bearingHNo || (p.nearAdjacent ? p.nearHNo : '');
      const additional = links.slice(1).flatMap(({ id, values }) => {
        const [number, doctYear] = splitNumber(values.linkDocNo);
        return current.linkDocuments.some(link => link.doctNo === number && link.doctYear === doctYear)
          ? [] : [{ id, doctNo: number, doctYear, description: values.linkDocType }];
      });
      return { ...forms, ec: fill(current, {
        ...contact, applicantName: applicant, corporationTownVillage: p.village, mandal: p.mandal, district: p.district,
        doorNo, doorNoType: p.bearingHNo ? 'Bearing H.No.' : p.nearAdjacent === 'Near' ? 'Near H.No.' : p.nearAdjacent === 'Adjacent' ? 'Adjacent H.No.' : undefined,
        plotNo: p.plotNo, surveyNo: p.surveyNo, extentSqY, locationName: p.locality, apartmentName: p.apartmentName,
        uds: p.udsSqYards, plinthAreaSqFt: p.superBuiltUpAreaSqFt, doctNo, doctYear: year,
        ...(additional.length ? { linkDocuments: [...current.linkDocuments, ...additional] } : {}),
        north: p.boundaryNorth, south: p.boundarySouth, east: p.boundaryEast, west: p.boundaryWest,
      }) };
    }
    case 'indent':
      return { ...forms, indent: fill(forms.indent, {
        mobileNo: contact.mobileNo, purchaserDetails: applicant, purchaserRelationType: relation,
        purchaserRelationLine: contact.relationLine, purchaserResidenceAddress: contact.residenceAddress,
      }) };
  }
}
