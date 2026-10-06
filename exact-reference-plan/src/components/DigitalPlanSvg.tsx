import React, { useRef, useState, useCallback, useId } from 'react';
import {
  StructuredGeometryPlan,
  BoundaryPoint,
  BoundarySegment,
  InternalBuilding,
  RoadFeature,
  VisualStyle,
} from '../types/sketchGeometry';
import { calculatePolygonMetrics, calculateDimensionLineGeometry } from '../utils/geometryEngine';

interface DigitalPlanSvgProps {
  plan: StructuredGeometryPlan;
  visualStyle?: VisualStyle;
  isEditingGeometry?: boolean;
  activeTool?: 'select' | 'drag-point' | 'add-point' | 'delete-point' | 'move-building' | 'pan';
  selectedPointId?: string | null;
  onSelectPoint?: (pointId: string | null) => void;
  onUpdatePoint?: (pointId: string, newPos: { x: number; y: number }) => void;
  onAddPointOnSegment?: (segmentIndex: number, newPoint: BoundaryPoint) => void;
  onUpdateBuildingPos?: (buildingId: string, newPos: { x: number; y: number }) => void;
  onUpdateDimension?: (segmentIndex: number, newDimText: string, newDimValue?: number) => void;
  showDimensions?: boolean;
  showPointLabels?: boolean;
  showGrid?: boolean;
  showNorthArrow?: boolean;
  showRoads?: boolean;
  showBuildings?: boolean;
  showSpecBox?: boolean;
  showBearings?: boolean;
  zoomLevel?: number;
  panOffset?: { x: number; y: number };
  className?: string;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const DigitalPlanSvg: React.FC<DigitalPlanSvgProps> = ({
  plan,
  visualStyle = 'technical',
  isEditingGeometry = false,
  activeTool = 'select',
  selectedPointId = null,
  onSelectPoint,
  onUpdatePoint,
  onAddPointOnSegment,
  onUpdateBuildingPos,
  onUpdateDimension,
  showDimensions = true,
  showPointLabels = true,
  showGrid = true,
  showNorthArrow = true,
  showRoads = true,
  showBuildings = true,
  showSpecBox = true,
  showBearings = false,
  zoomLevel = 1.0,
  panOffset = { x: 0, y: 0 },
  className = '',
  svgRef: externalSvgRef,
}) => {
  const localSvgRef = useRef<SVGSVGElement | null>(null);
  const activeSvgRef = externalSvgRef || localSvgRef;
  const hatchId = useId();

  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [draggingBuildingId, setDraggingBuildingId] = useState<string | null>(null);
  const [dragStartMouse, setDragStartMouse] = useState<{ x: number; y: number } | null>(null);
  const [buildingInitPos, setBuildingInitPos] = useState<{ x: number; y: number } | null>(null);

  const points = plan.property.points || [];
  const segments = plan.property.segments || [];
  const buildings = plan.buildings || [];
  const roads = plan.roads || [];
  const northAngle = plan.orientation.northArrowAngle || 0;

  // Calculate metrics
  const metrics = calculatePolygonMetrics(points, segments);

  // SVG Canvas dimensions
  const canvasWidth = 1000;
  const canvasHeight = 750;

  // Dynamic transformation for zoom and pan
  const viewBoxMinX = 0;
  const viewBoxMinY = 0;

  // Convert client mouse event to SVG coordinate space
  const getSvgCoordinates = useCallback(
    (event: React.MouseEvent<Element> | MouseEvent) => {
      const svg = activeSvgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      return {
        x: (event.clientX - ctm.e) / ctm.a,
        y: (event.clientY - ctm.f) / ctm.d,
      };
    },
    [activeSvgRef]
  );

  // Point Dragging Handlers
  const handlePointMouseDown = (e: React.MouseEvent, pId: string) => {
    if (!isEditingGeometry) return;
    e.stopPropagation();
    setDraggingPointId(pId);
    onSelectPoint?.(pId);
  };

  // Building Dragging Handlers
  const handleBuildingMouseDown = (e: React.MouseEvent, bId: string) => {
    if (!isEditingGeometry || activeTool !== 'move-building') return;
    e.stopPropagation();
    const b = buildings.find((x) => x.id === bId);
    if (!b) return;
    const coords = getSvgCoordinates(e);
    setDraggingBuildingId(bId);
    setDragStartMouse(coords);
    setBuildingInitPos({ x: b.x, y: b.y });
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingPointId && onUpdatePoint) {
      const coords = getSvgCoordinates(e);
      // Clamp coordinates within viewBox
      const clampedX = Math.max(40, Math.min(canvasWidth - 40, coords.x));
      const clampedY = Math.max(40, Math.min(canvasHeight - 40, coords.y));
      onUpdatePoint(draggingPointId, { x: clampedX, y: clampedY });
    } else if (draggingBuildingId && onUpdateBuildingPos && dragStartMouse && buildingInitPos) {
      const coords = getSvgCoordinates(e);
      const dx = coords.x - dragStartMouse.x;
      const dy = coords.y - dragStartMouse.y;
      const newX = Math.max(60, Math.min(canvasWidth - 60, buildingInitPos.x + dx));
      const newY = Math.max(60, Math.min(canvasHeight - 60, buildingInitPos.y + dy));
      onUpdateBuildingPos(draggingBuildingId, { x: newX, y: newY });
    }
  };

  const handleSvgMouseUp = () => {
    setDraggingPointId(null);
    setDraggingBuildingId(null);
    setDragStartMouse(null);
    setBuildingInitPos(null);
  };

  // Click on a segment to add an intermediate corner point
  const handleSegmentClick = (e: React.MouseEvent, segmentIndex: number) => {
    if (!isEditingGeometry || activeTool !== 'add-point' || !onAddPointOnSegment) return;
    e.stopPropagation();
    const coords = getSvgCoordinates(e);
    const newPointId = `P${points.length + 1}`;
    const newPoint: BoundaryPoint = {
      id: newPointId,
      x: Math.round(coords.x),
      y: Math.round(coords.y),
      cornerType: 'corner',
      confidence: 1.0,
    };
    onAddPointOnSegment(segmentIndex, newPoint);
  };

  // Polygon Points String
  const polygonPointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Theme Styling based on VisualStyle
  const isTechnical = visualStyle === 'technical';
  const isSurvey = visualStyle === 'survey';
  const isProperty = visualStyle === 'property';

  const strokeColor = '#000000';
  const strokeWidth = isTechnical ? 2.8 : isSurvey ? 2.5 : 3.0;
  const polyFillColor = isTechnical
    ? '#ffffff'
    : isSurvey
    ? 'rgba(240, 249, 255, 0.4)'
    : 'rgba(254, 249, 195, 0.35)';

  return (
    <div className={`relative w-full flex flex-col items-center select-none ${className}`}>
      <svg
        ref={activeSvgRef}
        viewBox={`${viewBoxMinX} ${viewBoxMinY} ${canvasWidth} ${canvasHeight}`}
        className="w-full h-auto bg-white border border-slate-300 shadow-sm print:border-slate-800 transition-all"
        style={{
          aspectRatio: `${canvasWidth} / ${canvasHeight}`,
          cursor:
            activeTool === 'drag-point'
              ? 'crosshair'
              : activeTool === 'add-point'
              ? 'copy'
              : activeTool === 'delete-point'
              ? 'not-allowed'
              : activeTool === 'move-building'
              ? 'move'
              : 'default',
        }}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onMouseLeave={handleSvgMouseUp}
      >
        <defs>
          {/* Dimension Arrow Markers */}
          <marker
            id="dimArrowStart"
            viewBox="0 0 10 10"
            refX="2"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 10 1 L 2 5 L 10 9 z" fill="#000000" />
          </marker>
          <marker
            id="dimArrowEnd"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#000000" />
          </marker>

          {/* Road Hatch Pattern */}
          <pattern
            id={`roadHatch-${hatchId}`}
            width="12"
            height="12"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="12" stroke="#64748b" strokeWidth="1" strokeOpacity="0.3" />
          </pattern>

          {/* Survey Engineering Grid Pattern */}
          <pattern
            id={`surveyGrid-${hatchId}`}
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" strokeWidth="0.75" />
            <circle cx="0" cy="0" r="1.5" fill="#94a3b8" />
          </pattern>
        </defs>

        {/* Survey / Engineering Grid Background */}
        {showGrid && (
          <rect width="100%" height="100%" fill={`url(#surveyGrid-${hatchId})`} opacity={isSurvey ? 0.9 : 0.4} />
        )}

        {/* Scalable & Pannable Plan Root Layer */}
        <g
          id="digital-plan-viewport"
          transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}
          style={{ transformOrigin: 'center center' }}
        >
          {/* ================= 1. ROADS (OUTSIDE BOUNDARIES) ================= */}
          {showRoads &&
            roads.map((road, rIdx) => {
              // Find approximate bounding box
              let roadX = 80;
              let roadY = canvasHeight - 90;
              let roadW = canvasWidth - 160;
              let roadH = 50;

              if (road.position === 'North' || road.position === 'top') {
                roadY = 30;
              } else if (road.position === 'East' || road.position === 'right') {
                roadX = canvasWidth - 110;
                roadY = 80;
                roadW = 50;
                roadH = canvasHeight - 160;
              } else if (road.position === 'West' || road.position === 'left') {
                roadX = 50;
                roadY = 80;
                roadW = 50;
                roadH = canvasHeight - 160;
              }

              const isVerticalRoad = road.position === 'East' || road.position === 'West' || road.position === 'left' || road.position === 'right';

              return (
                <g key={road.id || rIdx} id={`road-feature-${rIdx}`}>
                  {/* Road Strip Surface */}
                  <rect
                    x={roadX}
                    y={roadY}
                    width={roadW}
                    height={roadH}
                    fill={isTechnical ? '#ffffff' : '#f8fafc'}
                    stroke="#000000"
                    strokeWidth="1.6"
                    strokeDasharray={road.isContinuous !== false ? '6 4' : 'none'}
                  />

                  {/* Road Centerline */}
                  {isVerticalRoad ? (
                    <line
                      x1={roadX + roadW / 2}
                      y1={roadY}
                      x2={roadX + roadW / 2}
                      y2={roadY + roadH}
                      stroke="#475569"
                      strokeWidth="1.2"
                      strokeDasharray="8 6"
                    />
                  ) : (
                    <line
                      x1={roadX}
                      y1={roadY + roadH / 2}
                      x2={roadX + roadW}
                      y2={roadY + roadH / 2}
                      stroke="#475569"
                      strokeWidth="1.2"
                      strokeDasharray="8 6"
                    />
                  )}

                  {/* Road Label */}
                  <rect
                    x={isVerticalRoad ? roadX + roadW / 2 - 45 : roadX + roadW / 2 - 120}
                    y={isVerticalRoad ? roadY + roadH / 2 - 12 : roadY + roadH / 2 - 11}
                    width={isVerticalRoad ? 90 : 240}
                    height={22}
                    fill="#ffffff"
                    stroke="none"
                    rx="3"
                  />
                  <text
                    x={roadX + roadW / 2}
                    y={roadY + roadH / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={isVerticalRoad ? `rotate(90, ${roadX + roadW / 2}, ${roadY + roadH / 2})` : undefined}
                    className="text-[12px] font-bold fill-slate-900 tracking-wider uppercase font-mono"
                    style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}
                  >
                    ⟵ {road.label || `${road.width || "30'-0\""} WIDE ROAD`} ⟶
                  </text>
                </g>
              );
            })}

          {/* ================= 2. OUTER PROPERTY POLYGON ================= */}
          {points.length >= 3 && (
            <g id="property-outer-polygon">
              {/* Solid Filled Polygon */}
              <polygon
                points={polygonPointsStr}
                fill={polyFillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* In Property style, add subtle boundary border glow */}
              {isProperty && (
                <polygon
                  points={polygonPointsStr}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="1.0"
                  strokeDasharray="5 3"
                  opacity={0.5}
                />
              )}
            </g>
          )}

          {/* ================= 3. INTERNAL BUILDINGS / STRUCTURES ================= */}
          {showBuildings &&
            buildings.map((b, bIdx) => {
              const bWidth = (b.width || 20) * 5; // Scale to pixels
              const bLength = (b.length || 25) * 5;
              const bX = b.x - bWidth / 2;
              const bY = b.y - bLength / 2;

              return (
                <g
                  key={b.id || bIdx}
                  id={`building-${b.id || bIdx}`}
                  onMouseDown={(e) => handleBuildingMouseDown(e, b.id)}
                  className={isEditingGeometry && activeTool === 'move-building' ? 'cursor-move' : ''}
                >
                  {/* Building Footprint Box */}
                  <rect
                    x={bX}
                    y={bY}
                    width={bWidth}
                    height={bLength}
                    fill={isTechnical ? '#ffffff' : '#fed7aa'}
                    fillOpacity={isTechnical ? 1 : 0.6}
                    stroke="#000000"
                    strokeWidth="2.0"
                    strokeDasharray={b.structureType?.includes('Tiled') ? 'none' : '4 2'}
                  />

                  {/* Corner Cross Marks on building */}
                  <line x1={bX} y1={bY} x2={bX + 8} y2={bY + 8} stroke="#000000" strokeWidth="1.2" />
                  <line x1={bX + bWidth} y1={bY} x2={bX + bWidth - 8} y2={bY + 8} stroke="#000000" strokeWidth="1.2" />
                  <line x1={bX} y1={bY + bLength} x2={bX + 8} y2={bY + bLength - 8} stroke="#000000" strokeWidth="1.2" />
                  <line x1={bX + bWidth} y1={bY + bLength} x2={bX + bWidth - 8} y2={bY + bLength - 8} stroke="#000000" strokeWidth="1.2" />

                  {/* Building Label & Measurements */}
                  <text
                    x={b.x}
                    y={b.y - 7}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-[11px] font-bold fill-slate-900 tracking-wide font-sans uppercase"
                    style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                  >
                    {b.label || 'BUILDING'}
                  </text>
                  <text
                    x={b.x}
                    y={b.y + 9}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-[9.5px] font-bold fill-slate-800 font-mono"
                    style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                  >
                    {b.widthText || `${b.width || 20}'`} x {b.lengthText || `${b.length || 25}'`}
                  </text>
                  {b.structureType && (
                    <text
                      x={b.x}
                      y={b.y + 22}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[8px] font-semibold fill-slate-600 font-sans uppercase"
                    >
                      ({b.structureType})
                    </text>
                  )}
                </g>
              );
            })}

          {/* ================= 4. DIMENSION LINES (PARALLEL TO SEGMENTS WITH ARROWS) ================= */}
          {showDimensions &&
            points.map((p1, idx) => {
              const p2 = points[(idx + 1) % points.length];
              if (!p2) return null;

              // Find segment metadata
              const seg =
                segments.find(
                  (s) =>
                    (s.from === p1.id && s.to === p2.id) ||
                    (s.from === p2.id && s.to === p1.id)
                ) || segments[idx];

              const dimText = seg?.dimensionText || (seg?.dimension ? `${seg.dimension}'` : '');
              if (!dimText && !isEditingGeometry) return null;

              // Calculate parallel offset geometry
              const dimGeom = calculateDimensionLineGeometry(p1, p2, 28, 1);
              const isNeedsVerification = seg?.needsVerification || (seg?.confidence !== undefined && seg.confidence < 0.8);

              return (
                <g
                  key={`dim-${p1.id}-${p2.id}`}
                  id={`dim-segment-${idx}`}
                  onClick={(e) => handleSegmentClick(e, idx)}
                  className={activeTool === 'add-point' ? 'cursor-copy hover:opacity-80' : ''}
                >
                  {/* Extension Lines from Corner to Dimension Line */}
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={dimGeom.d1.x}
                    y2={dimGeom.d1.y}
                    stroke="#94a3b8"
                    strokeWidth="0.9"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1={p2.x}
                    y1={p2.y}
                    x2={dimGeom.d2.x}
                    y2={dimGeom.d2.y}
                    stroke="#94a3b8"
                    strokeWidth="0.9"
                    strokeDasharray="2 2"
                  />

                  {/* Main Parallel Dimension Line with Arrowheads */}
                  <line
                    x1={dimGeom.d1.x}
                    y1={dimGeom.d1.y}
                    x2={dimGeom.d2.x}
                    y2={dimGeom.d2.y}
                    stroke={isNeedsVerification ? '#d97706' : '#000000'}
                    strokeWidth="1.3"
                    markerStart="url(#dimArrowStart)"
                    markerEnd="url(#dimArrowEnd)"
                  />

                  {/* Dimension Text with Solid White Backdrop Pill */}
                  {dimText && (
                    <g transform={`rotate(${dimGeom.angleDeg}, ${dimGeom.midPoint.x}, ${dimGeom.midPoint.y})`}>
                      <rect
                        x={dimGeom.midPoint.x - (dimText.length * 5.5 + 10)}
                        y={dimGeom.midPoint.y - 9}
                        width={dimText.length * 11 + 20}
                        height={18}
                        fill="#ffffff"
                        stroke={isNeedsVerification ? '#f59e0b' : '#000000'}
                        strokeWidth={isNeedsVerification ? '1.5' : '0.8'}
                        rx="3"
                      />
                      <text
                        x={dimGeom.midPoint.x}
                        y={dimGeom.midPoint.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`text-[11.5px] ${
                          isNeedsVerification ? 'font-black fill-amber-700' : 'font-bold fill-slate-950'
                        } font-mono tracking-tight`}
                      >
                        {dimText}
                        {isNeedsVerification && ' ⚠️'}
                      </text>
                    </g>
                  )}

                  {/* Boundary Name Label (Outside Dimension Line) */}
                  {seg?.boundaryName && (
                    <g transform={`rotate(${dimGeom.angleDeg}, ${dimGeom.midPoint.x + dimGeom.normalVector.x * 16}, ${dimGeom.midPoint.y + dimGeom.normalVector.y * 16})`}>
                      <text
                        x={dimGeom.midPoint.x + dimGeom.normalVector.x * 16}
                        y={dimGeom.midPoint.y + dimGeom.normalVector.y * 16}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[9px] font-semibold fill-slate-700 tracking-wider font-sans uppercase"
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                      >
                        {seg.boundaryName}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* ================= 5. CORNER POINTS & INTERACTIVE VERTICES ================= */}
          {points.map((p, pIdx) => {
            const isSelected = selectedPointId === p.id;
            const isDragging = draggingPointId === p.id;

            return (
              <g key={p.id || pIdx} id={`point-vertex-${p.id || pIdx}`}>
                {/* Vertex Point Handle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isEditingGeometry ? (isSelected ? 7 : 5.5) : isSurvey ? 3.5 : 2.5}
                  fill={isEditingGeometry ? (isSelected ? '#e11d48' : '#0284c7') : '#000000'}
                  stroke="#ffffff"
                  strokeWidth={isEditingGeometry ? 2 : 1}
                  className={isEditingGeometry ? 'cursor-grab active:cursor-grabbing hover:scale-125 transition-transform' : ''}
                  onMouseDown={(e) => handlePointMouseDown(e, p.id)}
                />

                {/* Point Label badge (P1, P2, P3...) */}
                {showPointLabels && (
                  <g transform={`translate(${p.x}, ${p.y})`}>
                    <rect
                      x="-11"
                      y="-22"
                      width="22"
                      height="14"
                      fill={isSelected ? '#e11d48' : '#0f172a'}
                      stroke="#ffffff"
                      strokeWidth="1"
                      rx="3"
                    />
                    <text
                      x="0"
                      y="-14"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[9px] font-extrabold fill-white font-mono"
                    >
                      {p.id}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ================= 6. CENTER PROPERTY AREA BADGE ================= */}
          {metrics.areaSqYds > 0 && (
            <g
              id="center-area-badge"
              transform={`translate(${metrics.centroid.x}, ${metrics.centroid.y})`}
            >
              <rect
                x="-125"
                y="-26"
                width="250"
                height="52"
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="1.4"
                rx="4"
              />
              <text
                x="0"
                y="-11"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[11px] font-bold fill-slate-900 tracking-wider font-sans uppercase"
              >
                AREA UNDER REGISTRATION
              </text>
              <text
                x="0"
                y="8"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[12px] font-extrabold fill-slate-950 font-mono"
              >
                {metrics.areaSqYds} SQ.YARDS
              </text>
              <text
                x="0"
                y="20"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[9px] font-semibold fill-slate-600 font-sans"
              >
                ({metrics.areaSqMtrs} Sq.Mtrs / {metrics.areaSqFt} Sq.Ft)
              </text>
            </g>
          )}

          {/* ================= 7. NORTH ARROW / DIRECTION COMPASS ================= */}
          {showNorthArrow && (
            <g
              id="sketch-north-arrow"
              transform={`translate(${canvasWidth - 75}, 75) rotate(${northAngle})`}
            >
              {/* Compass Dial Frame */}
              <circle cx="0" cy="0" r="28" fill="#ffffff" stroke="#000000" strokeWidth="1.8" />
              <circle cx="0" cy="0" r="24.5" fill="none" stroke="#000000" strokeWidth="0.8" />
              <circle cx="0" cy="0" r="23" fill="none" stroke="#64748b" strokeWidth="0.5" strokeDasharray="1.5 1.5" />

              {/* Cardinal Ticks */}
              <line x1="0" y1="-24.5" x2="0" y2="-20" stroke="#000000" strokeWidth="1.5" />
              <line x1="0" y1="24.5" x2="0" y2="20" stroke="#000000" strokeWidth="1.5" />
              <line x1="24.5" y1="0" x2="20" y2="0" stroke="#000000" strokeWidth="1.5" />
              <line x1="-24.5" y1="0" x2="-20" y2="0" stroke="#000000" strokeWidth="1.5" />

              {/* North Needle Spear (Left Black, Right White) */}
              <polygon points="0,-21 -5.5,-3 0,0" fill="#000000" stroke="#000000" strokeWidth="0.6" strokeLinejoin="round" />
              <polygon points="0,-21 5.5,-3 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.8" strokeLinejoin="round" />

              {/* South Tail */}
              <polygon points="0,15 -3.5,2.5 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.8" strokeLinejoin="round" />
              <polygon points="0,15 3.5,2.5 0,0" fill="#000000" stroke="#000000" strokeWidth="0.6" strokeLinejoin="round" />

              {/* Center Eyelet */}
              <circle cx="0" cy="0" r="2.8" fill="#ffffff" stroke="#000000" strokeWidth="1.2" />
              <circle cx="0" cy="0" r="1.2" fill="#000000" />

              {/* North 'N' letter */}
              <text
                x="0"
                y="-33"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[13px] font-black fill-black select-none font-sans"
                style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}
              >
                N
              </text>
            </g>
          )}

          {/* ================= 8. TITLE BLOCK / SPECIFICATION BOX ================= */}
          {showSpecBox && (
            <g id="plan-specification-box" transform={`translate(45, ${canvasHeight - 90})`}>
              <rect
                x="0"
                y="0"
                width="360"
                height="70"
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="1.4"
                rx="3"
              />
              <text
                x="180"
                y="14"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[10px] font-bold fill-black uppercase tracking-wider font-mono"
              >
                {plan.title || 'PROPERTY SITE PLAN (డిజిటల్ ప్లాన్)'}
              </text>
              <line x1="0" y1="23" x2="360" y2="23" stroke="#000000" strokeWidth="1.0" />

              <text x="12" y="37" className="text-[9px] font-semibold fill-slate-800 font-sans">
                PLOT AREA: <tspan className="font-bold font-mono">{metrics.areaSqYds} SQ.YDS</tspan> ({metrics.areaSqMtrs} SQ.M)
              </text>
              <text x="12" y="52" className="text-[9px] font-semibold fill-slate-800 font-sans">
                PLINTH AREA: <tspan className="font-bold font-mono">{plan.buildings[0]?.plinthAreaSqFt || (plan.buildings[0]?.width && plan.buildings[0]?.length ? plan.buildings[0].width * plan.buildings[0].length : 0)} SQ.FT</tspan>
              </text>
              <text x="12" y="64" className="text-[8.5px] font-medium fill-slate-600 font-sans italic">
                * Reconstructed digitally preserving exact handwritten geometry
              </text>
            </g>
          )}

          {/* Scale Bar Indicator (Bottom-Right) */}
          <g id="scale-bar-indicator" transform={`translate(${canvasWidth - 210}, ${canvasHeight - 45})`}>
            <rect x="0" y="0" width="180" height="28" fill="#ffffff" stroke="#000000" strokeWidth="1.0" rx="3" />
            <line x1="15" y1="12" x2="165" y2="12" stroke="#000000" strokeWidth="2.5" />
            <line x1="15" y1="7" x2="15" y2="17" stroke="#000000" strokeWidth="1.5" />
            <line x1="90" y1="7" x2="90" y2="17" stroke="#000000" strokeWidth="1.5" />
            <line x1="165" y1="7" x2="165" y2="17" stroke="#000000" strokeWidth="1.5" />
            <text x="90" y="22" textAnchor="middle" className="text-[7.5px] font-bold fill-slate-800 font-mono">
              SCALE: NOT TO CIVIL SCALE (DOCUMENT PURPOSE)
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};
