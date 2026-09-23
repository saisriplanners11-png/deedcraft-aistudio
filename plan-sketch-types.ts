// Data model for the "Plan Sketch (Beta)" step — a proportional site-sketch
// generator computed from four typed boundary dimensions, ported from a
// standalone tool. Deliberately separate from AppState/ALL_FIELDS: this step
// is additive and self-contained (see plan-sketch-mapping.ts).

export type PropertyType =
  | 'Open Place'
  | 'House'
  | 'Plot'
  | 'Flat'
  | 'Commercial Building'
  | 'Agricultural Land'
  | 'Other';

export type DimensionUnit = 'Feet' | 'Metres';

export type RoadSideOption = 'North' | 'South' | 'East' | 'West' | 'None';
export type RoadContinuitySide = 'both' | 'left' | 'right' | 'none';

export type RoadLayoutType =
  | 'One Side Road'
  | 'Two Side Road / Corner'
  | 'Three Side Road'
  | 'Four Side Road / Island'
  | 'Through Road / Through Plot'
  | 'T-Junction'
  | 'Dead-End / Cul-de-Sac';

export type DeadEndType = 'dead-end' | 'cul-de-sac';
export type DeadEndSide = 'left' | 'right' | 'both';

export interface DimensionValue {
  raw: string;
  normalized: number;
  unit: DimensionUnit;
}

export interface HouseDetails {
  enabled?: boolean;
  widthFeet?: number;
  lengthFeet?: number;
  widthRaw?: string;
  lengthRaw?: string;
  structureType?: string;
  roofType?: string;
  plinthAreaSqFt?: number | '';
  plinthAreaSqYds?: number | '';
  showMeasurements?: boolean;
  showSetbacks?: boolean;
  setbackNorth?: string;
  setbackSouth?: string;
  setbackEast?: string;
  setbackWest?: string;
}

export interface PropertyDetails {
  propertyType: PropertyType;
  customPropertyType?: string;
  areaSqYards: number | '';
  areaSqMtrs: number | '';
  surveyNo: string;
  nearAdjacent?: 'Near' | 'Adjacent' | '';
  nearHNo: string;
  locality: string;
  village: string;
  mandal: string;
  district: string;
  house?: HouseDetails;
}

export interface PartyDetails {
  name: string;
  relation: string;
  relativeName: string;
  age: string;
  occupation: string;
  address: string;
}

export interface BoundaryDimensions {
  northBoundary: string;
  northDim: DimensionValue;
  southBoundary: string;
  southDim: DimensionValue;
  eastBoundary: string;
  eastDim: DimensionValue;
  westBoundary: string;
  westDim: DimensionValue;
  roadWidth: string;
  roadSides: RoadSideOption[];
  cornerProperty: boolean;
  dimensionUnit: DimensionUnit;
  roadContinuous?: boolean;
  roadContinuitySide?: RoadContinuitySide;
  roadDirectionLeft?: string;
  roadDirectionRight?: string;
  roadLayoutType?: RoadLayoutType;
  tJunctionSide?: RoadSideOption;
  approachRoadWidth?: string;
  deadEndType?: DeadEndType;
  deadEndSide?: DeadEndSide;
  northRotation?: number;
}

export interface Witnesses {
  witness1: string;
  witness2: string;
}

export interface PlanDocument {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  property: PropertyDetails;
  executant: PartyDetails;
  claimant: PartyDetails;
  boundaries: BoundaryDimensions;
  witnesses: Witnesses;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}
