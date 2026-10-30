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

export interface BoundarySegment {
  name: string;
  dimension: string; // e.g. "45'" or "45'-0""
  normalized?: number;
}

export interface DualPlotConfig {
  enabled: boolean;
  plot1No?: string; // e.g. "50" -> PLOT NO.50
  plot2No?: string; // e.g. "69" -> PLOT NO.69
  dividerOrientation?: 'horizontal' | 'vertical'; // default 'horizontal' (divides along length)
  dividerRatio?: number; // 0.5 (equal split) or custom
  showDividerDimension?: boolean; // default true (shows e.g. 24')
  extendDividerOutside?: boolean; // default true (extends into adjacent plots like in the picture)
  plotTextOrientation?: 'vertical' | 'horizontal'; // default 'vertical' like the photo
}

export type PlotGeometryType = 'rectangular' | 'triangle-fork' | 'stepped' | 'stepped-l' | 'zig-zag';

export interface ZigZagPlotConfig {
  enabled: boolean;
  leftWidth: string;        // e.g. "20'"
  leftHeight: string;       // e.g. "40'"
  rightWidth: string;       // e.g. "30'"
  rightLowerHeight: string; // e.g. "40'"
  rightUpperHeight: string; // e.g. "40'"
  stepOrientation?: 'left-step-up' | 'right-step-up'; // default 'left-step-up'
  showDividers?: boolean; // default true (shows internal dashed lines)
  showDividerDimensions?: boolean; // default true (shows dimensions on dashed lines)
  roadSide?: 'South' | 'North' | 'East' | 'West'; // default 'South'
  roadName?: string; // default "ROAD"
  roadWidth?: string; // default "30'"
  leftPartName?: string; // e.g. "PART-A"
  rightPartName?: string; // e.g. "PART-B"
}


export interface TriangleForkConfig {
  enabled: boolean;
  topDim?: string; // e.g. "70'"
  bottomDim?: string; // e.g. "60'"
  rightDim?: string; // e.g. "40'"
  topRoadName?: string; // e.g. "20' ROAD"
  bottomRoadName?: string; // e.g. "25' ROAD"
  topRoadWidth?: string; // e.g. "20'"
  bottomRoadWidth?: string; // e.g. "25'"
  stemRoadWidth?: string; // e.g. "25'"
  stemRoadName?: string; // e.g. "ROAD"
  forkAngleDegrees?: number; // e.g. 32
}

export interface MultiPlotConfig {
  enabled: boolean;
  rows: number; // e.g. 2 (rows of plots)
  cols: number; // e.g. 3 (columns of plots, up to 10)
  plotNumbers?: string[]; // e.g. ["6", "7", "8", "11", "10", "9"]
  plotDimensions?: string[]; // e.g. ["30' x 60'", "30' x 60'", ...] per plot cell
  uniformDimension?: string; // e.g. "30' x 60'" applied to all plots
  startPlotNo?: string; // e.g. "6"
  showGridDimensions?: boolean; // default true
  extendDividersOutside?: boolean; // default true
  plotTextOrientation?: 'vertical' | 'horizontal';
  autoAdjustTextScale?: boolean; // Auto-adjust plot number and dimension scaling based on plot size (default true)
  textScale?: number; // Custom text scaling percentage (50% to 150%, default 100)
}

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
  deedMatterScale?: number;
  partiesScale?: number;
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
  boundaryScale?: number; // 50-200% Boundaries text scaling (default 100)
  dimensionScale?: number; // 50-200% Dimensions measurement scaling (default 100)
  roadScale?: number; // 50-200% Road width & road stripe scaling (default 100)
  plotTextScale?: number; // 50-200% Plot inner text scale (Plot No., Area Under Regn, House labels) (default 100)
  autoAlignBoundariesWithMap?: boolean; // Auto-align boundaries and dimensions with map rotation
  autoAdjustPlotTextScale?: boolean; // Auto-adjust plot numbers & dimensions scaling based on plot size
  plotTextOrientation?: 'auto' | 'horizontal' | 'vertical'; // default 'auto' (horizontal first, vertical if plot is narrow)
  // Dual Plot / Sub-division Layout & Triangular Fork Plot
  dualPlot?: DualPlotConfig;
  multiPlot?: MultiPlotConfig;
  plotGeometryType?: PlotGeometryType;
  triangleFork?: TriangleForkConfig;
  steppedPolygon?: any;
  zigZagPlot?: ZigZagPlotConfig;
  // Multi-Segment Boundaries
  westSegments?: BoundarySegment[];
  eastSegments?: BoundarySegment[];
  northSegments?: BoundarySegment[];
  southSegments?: BoundarySegment[];
  // Red Boundary Highlight (Registration deed standard)
  highlightBoundaryRed?: boolean;
  // Dimension Line Style
  dimensionLineStyle?: 'arrows' | 'standard'; // 'arrows' for CAD extension & arrow lines
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
