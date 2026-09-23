// One-way, read-only mapping from the main wizard's already-collected draft
// data into a PlanDocument, so the Plan Sketch (Beta) step doesn't force the
// drafter to retype facts already on file. Never writes back into AppState.

import { HOUSE_CATEGORIES } from './fields';
import { partyRecords, scheduleRecords, type AppState } from './logic';
import { calculateSqMtrs } from './plan-sketch-dimensions';
import type { BoundaryDimensions, DimensionValue, PartyDetails, PlanDocument, PropertyDetails, PropertyType, RoadSideOption } from './plan-sketch-types';

const CATEGORY_TO_PROPERTY_TYPE: Record<string, PropertyType> = {
  'Vacant Plot': 'Plot',
  'Open Place': 'Open Place',
  Residential: 'House',
  Flat: 'Flat',
  Demolished: 'Open Place',
  Commercial: 'Commercial Building',
  'Agricultural land': 'Agricultural Land',
  'Part open place': 'Open Place',
};

const joinNonEmpty = (parts: (string | undefined)[], sep = ', ') => parts.map(p => (p || '').trim()).filter(Boolean).join(sep);

function composeAddress(v: Record<string, string>, prefix: string) {
  const hno = v[`${prefix}HNo`];
  const line = joinNonEmpty([hno ? `H.No ${hno}` : '', v[`${prefix}Locality`], v[`${prefix}Village`], v[`${prefix}Mandal`]]);
  const district = v[`${prefix}District`];
  const pin = v[`${prefix}PinCode`];
  return joinNonEmpty([line, district, pin ? `PIN ${pin}` : '']);
}

function mapParty(v: Record<string, string>, prefix: 'executant' | 'claimant'): PartyDetails {
  return {
    name: v[`${prefix}Name`] || '',
    relation: v[`${prefix}Relation`] || 'S/o',
    relativeName: v[`${prefix}RelativeName`] || '',
    age: v[`${prefix}Age`] || '',
    occupation: v[`${prefix}Occupation`] || '',
    address: composeAddress(v, prefix),
  };
}

/** A boundary abutment like "25' Road" implies a road on that side — but only the
 * number is a usable road width; the rest of the sentence is not a label to draw. */
const ROAD_SNIFF = /(\d+(?:\.\d+)?)\s*(?:'|ft\.?|feet)?\s*(?:wide\s*)?(?:road|street|rasta)/i;

function blankDim(): DimensionValue {
  return { raw: '', normalized: 0, unit: 'Feet' };
}

export function planDocumentFromDraft(state: AppState): PlanDocument {
  const schedule = scheduleRecords(state)[0];
  const executant = partyRecords(state, 'executant')[0];
  const claimant = partyRecords(state, 'claimant')[0];
  const sv = schedule.values;
  const now = new Date().toISOString();

  const areaSqYards = sv.extentSqYards ? Number(sv.extentSqYards) : ('' as const);
  const areaSqMtrs = calculateSqMtrs(areaSqYards);

  const houseEnabled = HOUSE_CATEGORIES.includes(schedule.category);
  const firstStructure = schedule.structureDetails?.rows[0];

  const property: PropertyDetails = {
    propertyType: CATEGORY_TO_PROPERTY_TYPE[schedule.category] || 'Open Place',
    areaSqYards,
    areaSqMtrs,
    surveyNo: sv.surveyNo || '',
    nearAdjacent: sv.nearAdjacent === 'Adjacent' ? 'Adjacent' : sv.nearAdjacent === 'Near' ? 'Near' : '',
    nearHNo: sv.nearHNo || '',
    locality: sv.locality || '',
    village: sv.village || '',
    mandal: sv.mandal || '',
    district: sv.district || '',
    house: houseEnabled ? {
      enabled: true,
      structureType: firstStructure?.structureType === 'Other / Custom Structure'
        ? firstStructure.customStructureType : firstStructure?.structureType || '',
      plinthAreaSqFt: '',
    } : undefined,
  };

  const roadSides: RoadSideOption[] = [];
  let roadWidth = '';
  const sniffRoad = (side: RoadSideOption, text: string) => {
    const m = text.match(ROAD_SNIFF);
    if (m) {
      roadSides.push(side);
      if (!roadWidth) roadWidth = `${m[1]}'-0"`;
    }
  };
  sniffRoad('North', sv.boundaryNorth || '');
  sniffRoad('South', sv.boundarySouth || '');
  sniffRoad('East', sv.boundaryEast || '');
  sniffRoad('West', sv.boundaryWest || '');

  const boundaries: BoundaryDimensions = {
    northBoundary: sv.boundaryNorth || '',
    northDim: blankDim(),
    southBoundary: sv.boundarySouth || '',
    southDim: blankDim(),
    eastBoundary: sv.boundaryEast || '',
    eastDim: blankDim(),
    westBoundary: sv.boundaryWest || '',
    westDim: blankDim(),
    roadWidth,
    roadSides,
    cornerProperty: roadSides.length > 1,
    dimensionUnit: 'Feet',
    roadLayoutType: 'One Side Road',
    northRotation: 0,
  };

  return {
    id: 'plan-sketch-draft',
    title: 'Plan Sketch',
    createdAt: now,
    updatedAt: now,
    property,
    executant: mapParty(executant.values, 'executant'),
    claimant: mapParty(claimant.values, 'claimant'),
    boundaries,
    witnesses: { witness1: '', witness2: '' },
  };
}
