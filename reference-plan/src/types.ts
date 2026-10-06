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

export type NorthSymbolStyle = 'cadastral' | 'compass' | 'architectural' | 'minimal';

export interface DimensionValue {
  raw: string;           // e.g. "40'-5"" or "40.5" or "12.35m"
  normalized: number;    // normalized float value (in feet or meters)
  unit: DimensionUnit;
}

export interface HouseDetails {
  id?: string;
  name?: string; // e.g. 'Main House', 'House 1', 'Shed / Portion 2', 'Block A'
  enabled?: boolean;
  widthFeet?: number;
  lengthFeet?: number;
  widthRaw?: string;
  lengthRaw?: string;
  structureType?: string; // e.g. 'R.C.C. Building', 'Ground Floor House', 'G+1 Building'
  roofType?: string;
  plinthPrefix?: string; // e.g. 'R.C.C.'
  plinthAreaSqFt?: number | string;
  plinthAreaSqMtrs?: number | '';
  plinthAreaSqYds?: number | '';
  showMeasurements?: boolean;
  showSetbacks?: boolean;
  setbackNorth?: string;
  setbackSouth?: string;
  setbackEast?: string;
  setbackWest?: string;
  houseAuthority?: string; // e.g. 'Municipal Council House No.', 'Gram Panchayat House No.'
  position?: 
    | 'center' 
    | 'north' 
    | 'south' 
    | 'east' 
    | 'west' 
    | 'north-west' 
    | 'north-east' 
    | 'south-west' 
    | 'south-east'
    | 'attached-north'
    | 'attached-south'
    | 'attached-west'
    | 'attached-east'
    | 'attached-nw-corner'
    | 'attached-ne-corner'
    | 'attached-sw-corner'
    | 'attached-se-corner'
    | 'attached-center'
    | 'custom';
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
  locationTemplateType?: 
    | 'bearing_and_plot' 
    | 'bearing_only' 
    | 'plot_only' 
    | 'survey_only'
    | 'near_hno' 
    | 'near_adjacent_hno' 
    | 'adjacent_hno' 
    | 'opp_hno' 
    | 'beside_hno' 
    | 'part_open_place_hno'
    | 'demolished_house_hno'
    | 'custom';
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
  relation: string; // S/o, W/o, D/o, C/o, Rep. by
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
  roadSides: RoadSideOption[]; // Can have multiple if corner
  cornerProperty: boolean;
  dimensionUnit: DimensionUnit;
  // Road Continuity Options
  roadContinuous?: boolean;
  roadContinuitySide?: RoadContinuitySide;
  roadDirectionLeft?: string;
  roadDirectionRight?: string;
  // Per-Side Road Continuity Options
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
  // Road Layout & Preset Types
  roadLayoutType?: RoadLayoutType;
  tJunctionSide?: RoadSideOption;
  approachRoadWidth?: string;
  deadEndType?: DeadEndType;
  deadEndSide?: DeadEndSide;
  northRotation?: number; // 0-359 degrees
  northSymbolStyle?: NorthSymbolStyle; // North Arrow / Compass Symbol Style
  mapRotation?: number; // 0-359 degrees for entire map / sketch rotation
  sketchScale?: number; // 50-150% map scaling (default 100)
  textScale?: number; // 50-150% text scaling (default 100)
  boundaryFontWeight?: 'normal' | 'bold'; // 'normal' by default (Bold కాకుండా)
  autoAlignBoundariesWithMap?: boolean; // Auto-align boundaries and dimensions with map rotation
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
  executant: PartyDetails[];
  claimant: PartyDetails[];
  boundaries: BoundaryDimensions;
  witnesses: Witnesses;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}
