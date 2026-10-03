// Data model for the "Plan Sketch (Beta)" step — a proportional site-sketch
// generator computed from four typed boundary dimensions, ported from a
// standalone tool. Deliberately separate from AppState/ALL_FIELDS: this step
// is additive and self-contained (see plan-sketch-mapping.ts).

export type PropertyType =
  | 'Open Place'
  | 'House'
  | 'Plot'
  | 'Open Plot'
  | 'Demolished House'
  | 'Part Open Place'
  | 'Flat'
  | 'Commercial Building'
  | 'Agricultural Land'
  | 'Other';

export type DimensionUnit = 'Feet' | 'Metres';

export type RoadSideOption = 'North' | 'South' | 'East' | 'West' | 'None';
export type RoadContinuitySide = 'both' | 'left' | 'right' | 'none';
export type VerticalRoadContinuitySide = 'both' | 'top' | 'bottom' | 'none';
export type NorthSymbolStyle = 'cadastral' | 'compass' | 'architectural' | 'minimal';
export type HousePosition = 'center' | 'north' | 'south' | 'east' | 'west' | 'north-west' | 'north-east' | 'south-west' | 'south-east' | 'attached-north' | 'attached-south' | 'attached-west' | 'attached-east' | 'attached-nw-corner' | 'attached-ne-corner' | 'attached-sw-corner' | 'attached-se-corner' | 'attached-center' | 'custom';

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
  id?: string;
  name?: string;
  position?: HousePosition;
  enabled?: boolean;
  widthFeet?: number;
  lengthFeet?: number;
  widthRaw?: string;
  lengthRaw?: string;
  structureType?: string;
  roofType?: string;
  houseAuthority?: string;
  plinthPrefix?: string;
  plinthAreaSqFt?: number | '';
  plinthAreaSqMtrs?: number | '';
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
  plotNo?: string;
  houseNo?: string;
  houseAuthority?: string;
  locationTemplateType?: 'bearing_and_plot' | 'bearing_only' | 'plot_only' | 'survey_only' | 'near_hno' | 'near_adjacent_hno' | 'adjacent_hno' | 'opp_hno' | 'beside_hno' | 'part_open_place_hno' | 'demolished_house_hno' | 'custom';
  nearAdjacent?: 'Near' | 'Adjacent' | '';
  nearHNo: string;
  locality: string;
  village: string;
  mandal: string;
  district: string;
  house?: HouseDetails;
  houses?: HouseDetails[];
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
  northRoadContinuity?: RoadContinuitySide;
  northRoadDirectionLeft?: string;
  northRoadDirectionRight?: string;
  southRoadContinuity?: RoadContinuitySide;
  southRoadDirectionLeft?: string;
  southRoadDirectionRight?: string;
  eastRoadContinuity?: VerticalRoadContinuitySide | RoadContinuitySide;
  eastRoadDirectionTop?: string;
  eastRoadDirectionBottom?: string;
  westRoadContinuity?: VerticalRoadContinuitySide | RoadContinuitySide;
  westRoadDirectionTop?: string;
  westRoadDirectionBottom?: string;
  roadLayoutType?: RoadLayoutType;
  tJunctionSide?: RoadSideOption;
  approachRoadWidth?: string;
  deadEndType?: DeadEndType;
  deadEndSide?: DeadEndSide;
  northRotation?: number;
  northSymbolStyle?: NorthSymbolStyle;
  mapRotation?: number;
  sketchScale?: number;
  textScale?: number;
  boundaryFontWeight?: 'normal' | 'bold';
  autoAlignBoundariesWithMap?: boolean;
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
  executants?: PartyDetails[];
  claimants?: PartyDetails[];
  boundaries: BoundaryDimensions;
  witnesses: Witnesses;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}
