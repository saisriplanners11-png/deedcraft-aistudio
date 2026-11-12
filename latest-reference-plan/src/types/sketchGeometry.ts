export type CornerType = 'corner' | 'inner-corner' | 'outer-corner';
export type CardinalDirection = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW' | 'unknown';
export type VisualStyle = 'technical' | 'property' | 'survey';

export interface BoundaryPoint {
  id: string; // e.g. "P1", "P2"
  x: number;  // 0 to 1000 normalized coordinate
  y: number;  // 0 to 1000 normalized coordinate
  cornerType?: CornerType;
  confidence: number; // 0.0 to 1.0
  label?: string; // Optional custom label
}

export interface BoundarySegment {
  id?: string;
  from: string; // Point ID e.g. "P1"
  to: string;   // Point ID e.g. "P2"
  direction?: CardinalDirection;
  dimension?: number; // Numeric value in feet or meters
  dimensionUnit: string; // "ft" or "m"
  dimensionText: string; // Exact written notation e.g. "50'", "24'-6\"", "30'"
  boundaryName?: string; // e.g. "HOUSE OF NAKKA SUBBAYAH", "ROAD"
  confidence: number; // 0.0 to 1.0
  needsVerification?: boolean;
}

export interface BuildingDimension {
  value: number;
  unit: string;
  text?: string;
}

export interface InternalBuilding {
  id: string;
  type: string; // "building" | "house" | "shed" | "tiled_roof" | "rcc_slab"
  label: string; // e.g. "B.No.1", "TILED ROOF HOUSE", "H.NO.4-5-101"
  x: number; // relative center/top-left x (0 to 1000)
  y: number; // relative center/top-left y (0 to 1000)
  width: number; // in feet/units
  length: number; // in feet/units
  widthText?: string; // e.g. "20'"
  lengthText?: string; // e.g. "25'"
  rotation?: number; // rotation in degrees
  points?: { x: number; y: number }[]; // optional polygon corners
  dimensions: BuildingDimension[];
  structureType?: string;
  roofType?: string;
  plinthAreaSqFt?: number;
  confidence: number;
}

export interface RoadFeature {
  id: string;
  position: 'North' | 'South' | 'East' | 'West' | 'top' | 'bottom' | 'left' | 'right' | 'custom';
  label: string; // e.g. "ROAD", "EAST: 12' WIDE ROAD", "30'-0\" WIDE PANCHAYAT ROAD"
  width?: string; // e.g. "30'", "12'-0\""
  direction?: string; // e.g. "East-West", "North-South"
  points?: { x: number; y: number }[];
  isContinuous?: boolean;
  confidence: number;
}

export interface DimensionItem {
  id: string;
  text: string;
  value: number;
  unit: string;
  targetType: 'segment' | 'building' | 'road' | 'setback' | 'custom';
  targetId?: string; // e.g. "P1-P2" or "B1"
  confidence: number;
  needsVerification?: boolean;
  isConflict?: boolean;
}

export interface LabelItem {
  id: string;
  text: string;
  x: number;
  y: number;
  category?: 'building' | 'boundary' | 'road' | 'specification' | 'general';
}

export interface OrientationData {
  north: string; // Description or notation
  south?: string;
  east?: string;
  west?: string;
  northArrowAngle: number; // 0 = Up, 90 = Right, 180 = Down, 270 = Left
  detected: boolean;
  confidence: number;
}

export interface SpecificationBoxData {
  totalPlotAreaSqYds?: number;
  totalPlotAreaSqMtrs?: number;
  totalPlotAreaSqFt?: number;
  plinthAreaSqYds?: number;
  plinthAreaSqMtrs?: number;
  plinthAreaSqFt?: number;
  ownerName?: string;
  houseNo?: string;
  surveyNo?: string;
  plotNo?: string;
  locality?: string;
  village?: string;
  mandal?: string;
  district?: string;
}

export interface StructuredGeometryPlan {
  id: string;
  title: string;
  projectNumber?: string;
  date?: string;
  scaleText?: string;
  orientation: OrientationData;
  property: {
    boundaryType: 'regular' | 'irregular' | 'l-shape' | 't-shape' | 'u-shape' | 'stepped' | 'multi-corner';
    points: BoundaryPoint[];
    segments: BoundarySegment[];
  };
  buildings: InternalBuilding[];
  roads: RoadFeature[];
  dimensions: DimensionItem[];
  labels: LabelItem[];
  notes: string[];
  specification?: SpecificationBoxData;
  rawConfidenceScore: number;
  hasConflicts: boolean;
  summaryNotes?: string;
}

export interface GeometryEditorState {
  plan: StructuredGeometryPlan;
  selectedPointId: string | null;
  selectedSegmentIndex: number | null;
  selectedBuildingId: string | null;
  activeTool: 'select' | 'drag-point' | 'add-point' | 'delete-point' | 'move-building' | 'pan';
  visualStyle: VisualStyle;
  showDimensions: boolean;
  showPointLabels: boolean;
  showGrid: boolean;
  showNorthArrow: boolean;
  showRoads: boolean;
  showBuildings: boolean;
  showSpecBox: boolean;
  showBearings: boolean;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  undoStack: StructuredGeometryPlan[];
  redoStack: StructuredGeometryPlan[];
}
