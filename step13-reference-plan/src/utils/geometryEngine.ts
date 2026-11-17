import { BoundaryPoint, BoundarySegment, StructuredGeometryPlan } from '../types/sketchGeometry';

export interface Point2D {
  x: number;
  y: number;
}

export interface PolygonMetrics {
  areaSqFt: number;
  areaSqYds: number;
  areaSqMtrs: number;
  perimeterFt: number;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  centroid: Point2D;
}

/**
 * Calculates metrics for an arbitrary N-gon polygon using real feet dimensions or normalized coordinates.
 */
export function calculatePolygonMetrics(points: BoundaryPoint[], segments?: BoundarySegment[]): PolygonMetrics {
  if (!points || points.length < 3) {
    return {
      areaSqFt: 0,
      areaSqYds: 0,
      areaSqMtrs: 0,
      perimeterFt: 0,
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
      centroid: { x: 0, y: 0 },
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    sumX += p.x;
    sumY += p.y;
  }

  const centroid = {
    x: sumX / points.length,
    y: sumY / points.length,
  };

  // Calculate real perimeter if segment dimensions are provided
  let perimeterFt = 0;
  if (segments && segments.length > 0) {
    for (const seg of segments) {
      if (seg.dimension && seg.dimension > 0) {
        perimeterFt += seg.dimension;
      }
    }
  }

  // Calculate Shoelace Area in normalized space
  let shoelaceSum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    shoelaceSum += points[i].x * points[j].y;
    shoelaceSum -= points[j].x * points[i].y;
  }
  const normArea = Math.abs(shoelaceSum) / 2;

  // Derive approx feet scale from segment dimensions if available
  let avgFtPerNormUnit = 0.1; // fallback
  if (segments && segments.length > 0) {
    let totalDimFt = 0;
    let totalNormDist = 0;
    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const seg = segments.find(s => (s.from === p1.id && s.to === p2.id) || (s.from === p2.id && s.to === p1.id)) || segments[i];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (seg && seg.dimension && seg.dimension > 0 && dist > 0) {
        totalDimFt += seg.dimension;
        totalNormDist += dist;
      }
    }
    if (totalNormDist > 0 && totalDimFt > 0) {
      avgFtPerNormUnit = totalDimFt / totalNormDist;
    }
  }

  const areaSqFt = Math.round(normArea * Math.pow(avgFtPerNormUnit, 2) * 100) / 100;
  const areaSqYds = Math.round((areaSqFt / 9) * 100) / 100;
  const areaSqMtrs = Math.round((areaSqYds * 0.836127) * 100) / 100;

  return {
    areaSqFt,
    areaSqYds,
    areaSqMtrs,
    perimeterFt: Math.round(perimeterFt * 100) / 100,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
    centroid,
  };
}

/**
 * Calculates a parallel dimension line offset from a segment P1 -> P2.
 */
export function calculateDimensionLineGeometry(
  p1: Point2D,
  p2: Point2D,
  offsetDistance: number = 24,
  outwardSign: number = 1
) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy) || 1;

  // Unit vector along edge
  const ux = dx / length;
  const uy = dy / length;

  // Normal vector pointing outward (90 deg counter-clockwise)
  const nx = -uy * outwardSign;
  const ny = ux * outwardSign;

  // Offset points
  const d1 = {
    x: p1.x + nx * offsetDistance,
    y: p1.y + ny * offsetDistance,
  };

  const d2 = {
    x: p2.x + nx * offsetDistance,
    y: p2.y + ny * offsetDistance,
  };

  const midPoint = {
    x: (d1.x + d2.x) / 2,
    y: (d1.y + d2.y) / 2,
  };

  // Upright text angle (between -90 and 90 degrees for human readability)
  let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg < -90) angleDeg += 180;

  return {
    d1,
    d2,
    midPoint,
    angleDeg,
    length,
    unitVector: { x: ux, y: uy },
    normalVector: { x: nx, y: ny },
  };
}

/**
 * Generates an initial sample irregular plan matching the user's prompt specifications:
 * (Top 50', upper-right 30', right 20', offset 20', lower 30', bottom 50', building 20'x25', road at bottom, north arrow)
 */
export function getSampleIrregularPlan(): StructuredGeometryPlan {
  const points: BoundaryPoint[] = [
    { id: 'P1', x: 200, y: 150, cornerType: 'corner', confidence: 0.98 },
    { id: 'P2', x: 600, y: 150, cornerType: 'corner', confidence: 0.97 },
    { id: 'P3', x: 600, y: 350, cornerType: 'inner-corner', confidence: 0.95 },
    { id: 'P4', x: 800, y: 350, cornerType: 'outer-corner', confidence: 0.96 },
    { id: 'P5', x: 800, y: 550, cornerType: 'corner', confidence: 0.94 },
    { id: 'P6', x: 450, y: 550, cornerType: 'corner', confidence: 0.96 },
    { id: 'P7', x: 450, y: 480, cornerType: 'inner-corner', confidence: 0.92 },
    { id: 'P8', x: 200, y: 480, cornerType: 'corner', confidence: 0.95 },
  ];

  const segments: BoundarySegment[] = [
    { from: 'P1', to: 'P2', direction: 'N', dimension: 50, dimensionUnit: 'ft', dimensionText: "50'", boundaryName: 'NEIGHBOUR PROPERTY', confidence: 0.98 },
    { from: 'P2', to: 'P3', direction: 'E', dimension: 30, dimensionUnit: 'ft', dimensionText: "30'", boundaryName: 'OPEN PLOT NO. 12', confidence: 0.95 },
    { from: 'P3', to: 'P4', direction: 'N', dimension: 20, dimensionUnit: 'ft', dimensionText: "20'", boundaryName: 'SETBACK EXTENT', confidence: 0.94 },
    { from: 'P4', to: 'P5', direction: 'E', dimension: 25, dimensionUnit: 'ft', dimensionText: "25'", boundaryName: 'PLOT NO. 14', confidence: 0.93 },
    { from: 'P5', to: 'P6', direction: 'S', dimension: 35, dimensionUnit: 'ft', dimensionText: "35'", boundaryName: "30'-0\" WIDE ROAD", confidence: 0.97 },
    { from: 'P6', to: 'P7', direction: 'W', dimension: 10, dimensionUnit: 'ft', dimensionText: "10'", boundaryName: 'COMPOUND OFFSET', confidence: 0.88 },
    { from: 'P7', to: 'P8', direction: 'S', dimension: 25, dimensionUnit: 'ft', dimensionText: "25'", boundaryName: "30'-0\" WIDE ROAD", confidence: 0.95 },
    { from: 'P8', to: 'P1', direction: 'W', dimension: 45, dimensionUnit: 'ft', dimensionText: "45'", boundaryName: 'HOUSE OF RAMANA', confidence: 0.96 },
  ];

  return {
    id: 'plan-sample-irregular',
    title: 'Irregular Site Plan Digitization (స్కెచ్ డిజిటైజేషన్)',
    projectNumber: 'REG-2026-0482',
    date: new Date().toISOString().split('T')[0],
    scaleText: 'Not to Civil Scale (Document Purpose)',
    orientation: {
      north: 'North Arrow at Top-Right',
      northArrowAngle: 0,
      detected: true,
      confidence: 0.98,
    },
    property: {
      boundaryType: 'irregular',
      points,
      segments,
    },
    buildings: [
      {
        id: 'B1',
        type: 'building',
        label: 'B.No.1 (R.C.C. House)',
        x: 340,
        y: 240,
        width: 20,
        length: 25,
        widthText: "20'",
        lengthText: "25'",
        dimensions: [
          { value: 20, unit: 'ft', text: "20'" },
          { value: 25, unit: 'ft', text: "25'" },
        ],
        structureType: 'R.C.C. Roof Slab',
        plinthAreaSqFt: 500,
        confidence: 0.95,
      },
    ],
    roads: [
      {
        id: 'R1',
        position: 'South',
        label: "30'-0\" WIDE ROAD",
        width: "30'-0\"",
        direction: 'East-West',
        isContinuous: true,
        confidence: 0.96,
      },
    ],
    dimensions: [
      { id: 'D1', text: "50'", value: 50, unit: 'ft', targetType: 'segment', targetId: 'P1-P2', confidence: 0.98 },
      { id: 'D2', text: "30'", value: 30, unit: 'ft', targetType: 'segment', targetId: 'P2-P3', confidence: 0.95 },
      { id: 'D3', text: "20'", value: 20, unit: 'ft', targetType: 'segment', targetId: 'P3-P4', confidence: 0.94 },
      { id: 'D4', text: "25'", value: 25, unit: 'ft', targetType: 'segment', targetId: 'P4-P5', confidence: 0.93 },
      { id: 'D5', text: "35'", value: 35, unit: 'ft', targetType: 'segment', targetId: 'P5-P6', confidence: 0.97 },
      { id: 'D6', text: "25'", value: 25, unit: 'ft', targetType: 'segment', targetId: 'P7-P8', confidence: 0.95 },
      { id: 'D7', text: "45'", value: 45, unit: 'ft', targetType: 'segment', targetId: 'P8-P1', confidence: 0.96 },
    ],
    labels: [
      { id: 'L1', text: 'B.No.1', x: 380, y: 280, category: 'building' },
      { id: 'L2', text: 'ROAD', x: 500, y: 620, category: 'road' },
    ],
    notes: [
      'Preserved exact 8-corner irregular polygon topology without rectangularization.',
      'Explicit handwritten dimensions prioritized over visual approximations.',
    ],
    specification: {
      totalPlotAreaSqYds: 310.5,
      totalPlotAreaSqMtrs: 259.61,
      totalPlotAreaSqFt: 2794.5,
      plinthAreaSqYds: 55.55,
      plinthAreaSqFt: 500,
      ownerName: 'SRI K. VENKATA RAO',
      houseNo: '5-24/A',
      surveyNo: '142/Part',
      plotNo: 'Irregular Site-A',
      village: 'Kompally',
      mandal: 'Dundigal Gandimaisamma',
      district: 'Medchal-Malkajgiri',
    },
    rawConfidenceScore: 0.95,
    hasConflicts: false,
    summaryNotes: 'Faithful reproduction of uploaded handwritten irregular property sketch.',
  };
}
