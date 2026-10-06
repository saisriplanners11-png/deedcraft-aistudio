import { PlanDocument, BoundaryDimensions, PropertyDetails, RoadSideOption, PartyDetails } from '../types';
import { parseDimension, calculateSqMtrs } from '../utils/dimensionUtils';

export interface PartyExtract {
  name?: string;
  relation?: string;
  relativeName?: string;
  age?: string;
  occupation?: string;
  address?: string;
}

export interface ExtractedSketchData {
  northDim: string;
  southDim: string;
  eastDim: string;
  westDim: string;
  dimensionUnit?: 'Feet' | 'Metres';
  northBoundary?: string;
  southBoundary?: string;
  eastBoundary?: string;
  westBoundary?: string;
  roadSides?: ('North' | 'South' | 'East' | 'West')[];
  roadWidth?: string;
  roadLayoutType?: string;
  tJunctionSide?: 'North' | 'South' | 'East' | 'West';
  approachRoadWidth?: string;
  deadEndType?: 'dead-end' | 'cul-de-sac';
  deadEndSide?: 'left' | 'right' | 'both';
  propertyType?: string;
  northRotation?: number;
  northSymbolStyle?: 'cadastral' | 'compass' | 'architectural' | 'minimal';
  ownerName?: string;
  areaSqYards?: number | '';
  areaSqMtrs?: number | '';
  surveyNo?: string;
  plotNo?: string;
  houseNo?: string;
  houseAuthority?: string;
  locationTemplateType?: string;
  nearHNo?: string;
  executant?: PartyExtract | PartyExtract[];
  claimant?: PartyExtract | PartyExtract[];
  executants?: PartyExtract[];
  claimants?: PartyExtract[];
  locality?: string;
  village?: string;
  mandal?: string;
  district?: string;
  house?: {
    enabled?: boolean;
    widthFeet?: number;
    lengthFeet?: number;
    widthRaw?: string;
    lengthRaw?: string;
    structureType?: string;
    roofType?: string;
    plinthPrefix?: string;
    plinthAreaSqFt?: number;
    plinthAreaSqYds?: number;
    setbackNorth?: string;
    setbackSouth?: string;
    setbackEast?: string;
    setbackWest?: string;
  };
  houses?: Array<{
    id?: string;
    name?: string;
    position?: any;
    enabled?: boolean;
    widthFeet?: number;
    lengthFeet?: number;
    widthRaw?: string;
    lengthRaw?: string;
    structureType?: string;
    roofType?: string;
    plinthPrefix?: string;
    plinthAreaSqFt?: number;
    plinthAreaSqYds?: number;
    showMeasurements?: boolean;
    showSetbacks?: boolean;
    setbackNorth?: string;
    setbackSouth?: string;
    setbackEast?: string;
    setbackWest?: string;
  }>;
  summaryNotes?: string;
}

export async function analyzeManualSketch(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<ExtractedSketchData> {
  try {
    const response = await fetch('/api/analyze-sketch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to analyze drawing.');
    }

    return result.data as ExtractedSketchData;
  } catch (error: any) {
    console.error('Sketch AI service error:', error);
    throw error;
  }
}

/**
 * Apply extracted sketch/document details to an existing PlanDocument, returning the new PlanDocument.
 */
export function applyExtractedDataToPlan(
  currentPlan: PlanDocument,
  extracted: ExtractedSketchData
): PlanDocument {
  const unit = extracted.dimensionUnit === 'Metres' ? 'Metres' : 'Feet';

  const nRaw = extracted.northDim || currentPlan.boundaries.northDim.raw;
  const sRaw = extracted.southDim || currentPlan.boundaries.southDim.raw;
  const eRaw = extracted.eastDim || currentPlan.boundaries.eastDim.raw;
  const wRaw = extracted.westDim || currentPlan.boundaries.westDim.raw;

  const northDim = parseDimension(nRaw, unit);
  const southDim = parseDimension(sRaw, unit);
  const eastDim = parseDimension(eRaw, unit);
  const westDim = parseDimension(wRaw, unit);

  // Auto calculate area in Sq. Yards if not explicitly given
  let areaYards = extracted.areaSqYards;
  if (!areaYards || areaYards <= 0) {
    const avgW = (northDim.normalized + southDim.normalized) / 2;
    const avgH = (eastDim.normalized + westDim.normalized) / 2;
    if (unit === 'Feet') {
      areaYards = Math.round(((avgW * avgH) / 9) * 100) / 100;
    } else {
      // Metres to Sq Yards (1 sq.m = 1.19599 sq.yds)
      areaYards = Math.round((avgW * avgH * 1.19599) * 100) / 100;
    }
  }

  const areaMtrs = calculateSqMtrs(areaYards);

  const roadSides = (extracted.roadSides && extracted.roadSides.length > 0 
    ? extracted.roadSides 
    : (extracted.roadLayoutType ? ['South'] : currentPlan.boundaries.roadSides)) as RoadSideOption[];

  const updatedBoundaries: BoundaryDimensions = {
    ...currentPlan.boundaries,
    dimensionUnit: unit,
    northDim,
    southDim,
    eastDim,
    westDim,
    northBoundary: extracted.northBoundary || currentPlan.boundaries.northBoundary || 'Plot No. 24',
    southBoundary: extracted.southBoundary || currentPlan.boundaries.southBoundary || '30\'-0" WIDE ROAD',
    eastBoundary: extracted.eastBoundary || currentPlan.boundaries.eastBoundary || 'Plot No. 12',
    westBoundary: extracted.westBoundary || currentPlan.boundaries.westBoundary || 'Neighbour Property',
    roadWidth: extracted.roadWidth || currentPlan.boundaries.roadWidth || '30\'-0"',
    roadSides,
    cornerProperty: roadSides.length > 1,
    roadLayoutType: (extracted.roadLayoutType as any) || currentPlan.boundaries.roadLayoutType || (roadSides.length > 1 ? 'Two Side Road / Corner' : 'One Side Road'),
    tJunctionSide: extracted.tJunctionSide || currentPlan.boundaries.tJunctionSide || 'South',
    approachRoadWidth: extracted.approachRoadWidth || currentPlan.boundaries.approachRoadWidth || '30\'-0"',
    deadEndType: extracted.deadEndType || currentPlan.boundaries.deadEndType || 'dead-end',
    deadEndSide: extracted.deadEndSide || currentPlan.boundaries.deadEndSide || 'right',
    northRotation: extracted.northRotation !== undefined ? extracted.northRotation : currentPlan.boundaries.northRotation,
    northSymbolStyle: extracted.northSymbolStyle || currentPlan.boundaries.northSymbolStyle || 'cadastral',
  };

  // Extract Clean House Number
  let rawExtractedHNo = (extracted.houseNo || '').trim();
  if (!rawExtractedHNo && extracted.nearHNo) {
    // Attempt to extract house number pattern e.g. 6-5-48/2, 1-45, 12-4/A, 5-60 from nearHNo
    const match = extracted.nearHNo.match(/([0-9]+[-/][0-9]+(?:[-/][a-zA-Z0-9]+)?)/);
    if (match && match[1]) {
      rawExtractedHNo = match[1].trim();
    }
  }

  // Clean prefixes if any leaked in
  const cleanHouseNo = rawExtractedHNo
    .replace(/^(NEAR\/ADJACENT|NEAR|ADJACENT|OPP\.?|BESIDE|BEARING|H\.NO\.?|DOOR\s+NO\.?|D\.NO\.?|\s)+/gi, '')
    .trim();

  const finalHouseNo = cleanHouseNo || currentPlan.property.houseNo || '';
  const finalHouseAuthority = extracted.houseAuthority || currentPlan.property.houseAuthority || 'Municipal Council House No.';
  const finalPropType = (extracted.propertyType as any) || currentPlan.property.propertyType || 'Plot';
  const finalPlotNo = extracted.plotNo !== undefined ? (extracted.plotNo || '') : (currentPlan.property.plotNo || '');
  const finalSurveyNo = extracted.surveyNo !== undefined ? (extracted.surveyNo || '') : currentPlan.property.surveyNo;

  // Determine Location Template Type & formatted nearHNo
  let templateType = (extracted.locationTemplateType as any) || currentPlan.property.locationTemplateType;
  let computedNearHNo = extracted.nearHNo || currentPlan.property.nearHNo;

  if (finalPropType === 'House') {
    templateType = finalPlotNo ? 'bearing_and_plot' : 'bearing_only';
    const authPrefix = finalHouseAuthority.toLowerCase().startsWith('bearing ') ? finalHouseAuthority : `bearing ${finalHouseAuthority}`;
    const cleanH = finalHouseNo.startsWith('.') ? finalHouseNo.substring(1).trim() : finalHouseNo;
    const houseStr = cleanH ? (authPrefix.endsWith('.') ? `${authPrefix}${cleanH}` : `${authPrefix}.${cleanH}`) : '';
    if (finalPlotNo) {
      computedNearHNo = houseStr ? `${houseStr} and in plot no.${finalPlotNo}` : `in plot no.${finalPlotNo}`;
    } else {
      computedNearHNo = houseStr;
    }
  } else if (finalPropType === 'Demolished House') {
    templateType = 'demolished_house_hno';
    computedNearHNo = finalHouseNo ? `bearing dismantled house H.No.${finalHouseNo}` : `bearing dismantled house H.No._______`;
  } else if (finalPropType === 'Part Open Place') {
    templateType = 'part_open_place_hno';
    computedNearHNo = finalHouseNo ? `bearing H.No.${finalHouseNo} (PART)` : `bearing H.No._______ (PART)`;
  } else {
    // Plot / Open Plot / Open Place
    if (!templateType || templateType === 'bearing_and_plot' || templateType === 'bearing_only') {
      templateType = 'near_adjacent_hno';
    }
    if (finalHouseNo && (!computedNearHNo || computedNearHNo.includes('_______'))) {
      if (templateType === 'adjacent_hno') {
        computedNearHNo = `ADJACENT H.NO.${finalHouseNo}`;
      } else if (templateType === 'opp_hno') {
        computedNearHNo = `OPP. H.NO.${finalHouseNo}`;
      } else if (templateType === 'beside_hno') {
        computedNearHNo = `BESIDE H.NO.${finalHouseNo}`;
      } else if (templateType === 'near_hno') {
        computedNearHNo = `NEAR H.NO.${finalHouseNo}`;
      } else {
        computedNearHNo = `NEAR/ADJACENT H.NO.${finalHouseNo}`;
      }
    }
  }

  // House Structure Details
  const isHouseType = finalPropType === 'House';
  const hasExtractedHouse = isHouseType || extracted.house?.enabled || (Array.isArray(extracted.houses) && extracted.houses.length > 0);

  // Exact Plinth Area extracted from uploaded document
  const extractedPlinthSqFt = extracted.house?.plinthAreaSqFt ?? (extracted.houses?.[0]?.plinthAreaSqFt);
  const housePlinthSqFt = (extractedPlinthSqFt !== undefined && extractedPlinthSqFt !== null && extractedPlinthSqFt > 0)
    ? extractedPlinthSqFt
    : (extracted.house?.widthFeet && extracted.house?.lengthFeet ? Math.round(extracted.house.widthFeet * extracted.house.lengthFeet * 100) / 100 : 1172.00);

  const housePlinthSqYds = extracted.house?.plinthAreaSqYds ?? (extracted.houses?.[0]?.plinthAreaSqYds) ?? Math.round((housePlinthSqFt / 9) * 100) / 100;

  // Derive width & length if given, or calculate dimensions matching exact plinth area
  let houseWidthFeet = extracted.house?.widthFeet || extracted.houses?.[0]?.widthFeet;
  let houseLengthFeet = extracted.house?.lengthFeet || extracted.houses?.[0]?.lengthFeet;

  if (!houseWidthFeet || !houseLengthFeet) {
    if (housePlinthSqFt > 0) {
      // Create pleasing architectural aspect ratio (approx 1:1.4) that matches the exact plinth area
      const approxW = Math.max(10, Math.round(Math.sqrt(housePlinthSqFt / 1.45) * 10) / 10);
      const approxL = Math.round((housePlinthSqFt / approxW) * 10) / 10;
      houseWidthFeet = approxW;
      houseLengthFeet = approxL;
    } else {
      houseWidthFeet = 28;
      houseLengthFeet = 41.85;
    }
  }

  const primaryStructureType = extracted.house?.structureType || extracted.houses?.[0]?.structureType || 'R.C.C. Building';
  const primaryRoofType = extracted.house?.roofType || extracted.houses?.[0]?.roofType || 'R.C.C. Slab';
  const primaryPlinthPrefix = extracted.house?.plinthPrefix || extracted.houses?.[0]?.plinthPrefix || 'R.C.C.';

  // Format width & length raw strings
  const formatFeetInches = (val: number): string => {
    const totalInches = Math.round(val * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return inches > 0 ? `${feet}'-${inches}"` : `${feet}'-0"`;
  };

  const primaryHouseObj: any = {
    id: 'house-1',
    name: extracted.houses?.[0]?.name || 'Main House',
    position: 'center',
    enabled: true,
    widthFeet: houseWidthFeet,
    lengthFeet: houseLengthFeet,
    widthRaw: extracted.house?.widthRaw || extracted.houses?.[0]?.widthRaw || formatFeetInches(houseWidthFeet),
    lengthRaw: extracted.house?.lengthRaw || extracted.houses?.[0]?.lengthRaw || formatFeetInches(houseLengthFeet),
    structureType: primaryStructureType,
    roofType: primaryRoofType,
    plinthPrefix: primaryPlinthPrefix,
    plinthAreaSqFt: housePlinthSqFt,
    plinthAreaSqYds: housePlinthSqYds,
    showMeasurements: true,
    showSetbacks: true,
    setbackNorth: extracted.house?.setbackNorth || extracted.houses?.[0]?.setbackNorth || "12'-0\"",
    setbackSouth: extracted.house?.setbackSouth || extracted.houses?.[0]?.setbackSouth || "12'-0\"",
    setbackEast: extracted.house?.setbackEast || extracted.houses?.[0]?.setbackEast || "8'-0\"",
    setbackWest: extracted.house?.setbackWest || extracted.houses?.[0]?.setbackWest || "8'-0\"",
    houseAuthority: finalHouseAuthority,
  };

  // Map all extracted houses if an array was returned
  const allExtractedHouses = (Array.isArray(extracted.houses) && extracted.houses.length > 0)
    ? extracted.houses.map((h, i) => {
        const hSqFt = h.plinthAreaSqFt || (h.widthFeet && h.lengthFeet ? Math.round(h.widthFeet * h.lengthFeet * 100) / 100 : housePlinthSqFt);
        const hSqYds = h.plinthAreaSqYds || Math.round((hSqFt / 9) * 100) / 100;
        const hW = h.widthFeet || houseWidthFeet;
        const hL = h.lengthFeet || houseLengthFeet;
        return {
          id: h.id || `house-${i + 1}`,
          name: h.name || (i === 0 ? 'Main House' : `Structure ${i + 1}`),
          position: h.position || (i === 0 ? 'center' : (i === 1 ? 'east' : 'west')),
          enabled: h.enabled !== false,
          widthFeet: hW,
          lengthFeet: hL,
          widthRaw: h.widthRaw || formatFeetInches(hW),
          lengthRaw: h.lengthRaw || formatFeetInches(hL),
          structureType: h.structureType || primaryStructureType,
          roofType: h.roofType || primaryRoofType,
          plinthPrefix: h.plinthPrefix || primaryPlinthPrefix,
          plinthAreaSqFt: hSqFt,
          plinthAreaSqYds: hSqYds,
          showMeasurements: h.showMeasurements !== false,
          showSetbacks: h.showSetbacks !== false,
          setbackNorth: h.setbackNorth || "12'-0\"",
          setbackSouth: h.setbackSouth || "12'-0\"",
          setbackEast: h.setbackEast || "8'-0\"",
          setbackWest: h.setbackWest || "8'-0\"",
          houseAuthority: finalHouseAuthority,
        };
      })
    : (hasExtractedHouse ? [primaryHouseObj] : currentPlan.property.houses);

  const updatedProperty: PropertyDetails = {
    ...currentPlan.property,
    propertyType: finalPropType,
    areaSqYards: areaYards,
    areaSqMtrs: areaMtrs,
    surveyNo: finalSurveyNo,
    plotNo: finalPlotNo,
    houseNo: finalHouseNo,
    houseAuthority: finalHouseAuthority,
    locationTemplateType: templateType,
    nearHNo: computedNearHNo,
    locality: extracted.locality || currentPlan.property.locality,
    village: extracted.village || currentPlan.property.village,
    mandal: extracted.mandal || currentPlan.property.mandal,
    district: extracted.district || currentPlan.property.district,
    house: hasExtractedHouse ? primaryHouseObj : {
      ...(currentPlan.property.house || {}),
      enabled: false,
    },
    houses: allExtractedHouses,
  };

  // Extract and apply all Executants (Sellers)
  const rawExecList: PartyExtract[] = [];
  if (Array.isArray(extracted.executants) && extracted.executants.length > 0) {
    rawExecList.push(...extracted.executants);
  } else if (Array.isArray(extracted.executant) && extracted.executant.length > 0) {
    rawExecList.push(...extracted.executant);
  } else if (extracted.executant && !Array.isArray(extracted.executant)) {
    const singleExec = extracted.executant as PartyExtract;
    if (singleExec.name || singleExec.relativeName) {
      rawExecList.push(singleExec);
    }
  }

  const validExecutants: PartyDetails[] = rawExecList
    .filter((e) => e && ((e.name && e.name.trim()) || (e.relativeName && e.relativeName.trim())))
    .map((e) => ({
      name: (e.name || '').trim(),
      relation: (e.relation || 'S/o').trim(),
      relativeName: (e.relativeName || '').trim(),
      age: (e.age !== undefined && e.age !== null ? String(e.age) : '').trim(),
      occupation: (e.occupation || '').trim(),
      address: (e.address || '').trim(),
    }));

  const updatedExecutant = validExecutants.length > 0 
    ? validExecutants 
    : (extracted.ownerName && extracted.ownerName.trim() 
        ? [{ name: extracted.ownerName.trim(), relation: 'S/o', relativeName: '', age: '', occupation: '', address: '' }] 
        : currentPlan.executant);

  // Extract and apply all Claimants (Purchasers)
  const rawClaimList: PartyExtract[] = [];
  if (Array.isArray(extracted.claimants) && extracted.claimants.length > 0) {
    rawClaimList.push(...extracted.claimants);
  } else if (Array.isArray(extracted.claimant) && extracted.claimant.length > 0) {
    rawClaimList.push(...extracted.claimant);
  } else if (extracted.claimant && !Array.isArray(extracted.claimant)) {
    const singleClaim = extracted.claimant as PartyExtract;
    if (singleClaim.name || singleClaim.relativeName) {
      rawClaimList.push(singleClaim);
    }
  }

  const validClaimants: PartyDetails[] = rawClaimList
    .filter((c) => c && ((c.name && c.name.trim()) || (c.relativeName && c.relativeName.trim())))
    .map((c) => ({
      name: (c.name || '').trim(),
      relation: (c.relation || 'S/o').trim(),
      relativeName: (c.relativeName || '').trim(),
      age: (c.age !== undefined && c.age !== null ? String(c.age) : '').trim(),
      occupation: (c.occupation || '').trim(),
      address: (c.address || '').trim(),
    }));

  const updatedClaimant = validClaimants.length > 0 ? validClaimants : currentPlan.claimant;

  return {
    ...currentPlan,
    updatedAt: new Date().toISOString().split('T')[0],
    boundaries: updatedBoundaries,
    property: updatedProperty,
    executant: updatedExecutant,
    claimant: updatedClaimant,
  };
}

export async function parseDocumentFile(fileBase64?: string, mimeType?: string, textContent?: string): Promise<ExtractedSketchData> {
  try {
    const response = await fetch('/api/parse-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileBase64,
        mimeType,
        textContent,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to parse document.');
    }

    return result.data as ExtractedSketchData;
  } catch (error: any) {
    console.error('Document parsing service error:', error);
    throw error;
  }
}
