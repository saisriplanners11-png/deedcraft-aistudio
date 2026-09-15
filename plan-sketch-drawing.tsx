import React from 'react';
import { BoundaryDimensions, PropertyDetails } from './plan-sketch-types';
import { formatDimensionDisplay } from './plan-sketch-dimensions';

/** Inline replacement for the ported component's Tailwind text utility classes:
 * this project loads no Tailwind, and a serialized standalone SVG (the export
 * path — see registration-plan.tsx's planPng) carries no external stylesheet,
 * so utility class names would render unstyled. Plain inline styles are part
 * of the element markup itself and survive serialization. */
function T(px: number, weight: number, extra?: React.CSSProperties): React.CSSProperties {
  return { fontSize: px, fontWeight: weight, fill: '#000000', ...extra };
}

interface PlanSketchDrawingProps {
  property: PropertyDetails;
  boundaries: BoundaryDimensions;
  isPrintMode?: boolean;
  className?: string;
  overlayImage?: string;
  overlayOpacity?: number;
  showOverlay?: boolean;
}

export const PlanSketchDrawing: React.FC<PlanSketchDrawingProps> = ({
  property,
  boundaries,
  isPrintMode = false,
  className = '',
  overlayImage,
  overlayOpacity = 0.45,
  showOverlay = false,
}) => {
  const {
    northBoundary,
    northDim,
    southBoundary,
    southDim,
    eastBoundary,
    eastDim,
    westBoundary,
    westDim,
    roadWidth,
    roadSides = [],
    cornerProperty,
    roadContinuous = true,
    roadContinuitySide = 'both',
    roadDirectionLeft,
    roadDirectionRight,
    roadLayoutType,
    tJunctionSide = 'South',
    approachRoadWidth,
    deadEndType = 'dead-end',
    deadEndSide = 'right',
  } = boundaries;

  const renderWrappedBoundaryText = (text: string, x: number, y: number, maxLenPx: number) => {
    if (!text) return null;
    const charWidth = 6.0; // Approx for 11px uppercase bold tracking-wide
    const maxChars = Math.max(8, Math.floor((maxLenPx - 20) / charWidth));

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if ((currentLine + ' ' + word).length <= maxChars) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    const lineHeight = 12;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    return (
      <text
        textAnchor="middle"
        dominantBaseline="central"
        style={{ ...T(11, 800, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={x} y={startY + index * lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };

  // Raw or normalized values
  const nVal = northDim.normalized > 0 ? northDim.normalized : 40;
  const sVal = southDim.normalized > 0 ? southDim.normalized : 40;
  const eVal = eastDim.normalized > 0 ? eastDim.normalized : 60;
  const wVal = westDim.normalized > 0 ? westDim.normalized : 60;

  // Check active road sides
  const hasNorthRoad = roadSides.includes('North');
  const hasSouthRoad = roadSides.includes('South');
  const hasEastRoad = roadSides.includes('East');
  const hasWestRoad = roadSides.includes('West');

  const isTJunction = roadLayoutType === 'T-Junction';
  const effectiveTJunctionSide = tJunctionSide || (hasSouthRoad ? 'South' : hasNorthRoad ? 'North' : hasEastRoad ? 'East' : 'West');

  const roadStripDepth = 42;
  const roadLabel = roadWidth.trim() ? `${roadWidth.trim()} WIDE ROAD` : 'ROAD';

  // SVG ViewBox
  const viewBoxWidth = 740;
  const viewBoxHeight = 520;

  // Determine dynamic margins based on road strips and dimension lines so plot auto-fits nicely
  const topMargin = hasNorthRoad ? (isTJunction && effectiveTJunctionSide === 'North' ? 125 : 110) : 70;
  const bottomMargin = hasSouthRoad ? (isTJunction && effectiveTJunctionSide === 'South' ? 125 : 110) : 70;
  const leftMargin = hasWestRoad ? (isTJunction && effectiveTJunctionSide === 'West' ? 125 : 115) : 75;
  const rightMargin = hasEastRoad ? (isTJunction && effectiveTJunctionSide === 'East' ? 125 : 115) : 75;

  const availableW = viewBoxWidth - leftMargin - rightMargin;
  const availableH = viewBoxHeight - topMargin - bottomMargin;

  const maxDimW = Math.max(nVal, sVal, 10);
  const maxDimH = Math.max(eVal, wVal, 10);

  // Proportional scale factor auto-fitting to exact plot dimensions
  const scale = Math.min(availableW / maxDimW, availableH / maxDimH);

  // Scaled dimensions
  const scaledNW = nVal * scale;
  const scaledSW = sVal * scale;
  const scaledEH = eVal * scale;
  const scaledWH = wVal * scale;

  const centerX = leftMargin + availableW / 2;
  const centerY = topMargin + availableH / 2;

  // Calculate 4 corners of property:
  // A = NW (top-left)
  // B = NE (top-right)
  // C = SE (bottom-right)
  // D = SW (bottom-left)
  const ax = centerX - scaledNW / 2;
  const ay = centerY - scaledWH / 2;

  const bx = centerX + scaledNW / 2;
  const by = centerY - scaledEH / 2;

  const cx = centerX + scaledSW / 2;
  const cy = centerY + scaledEH / 2;

  const dx = centerX - scaledSW / 2;
  const dy = centerY + scaledWH / 2;

  const polygonPoints = `${ax},${ay} ${bx},${by} ${cx},${cy} ${dx},${dy}`;

  // ================= CAD GEOMETRY & ALIGNED DRAFTING VECTORS =================
  // North Edge: A(ax, ay) -> B(bx, by)
  const dxAB = bx - ax;
  const dyAB = by - ay;
  const lenAB = Math.hypot(dxAB, dyAB) || 1;
  const uABx = dxAB / lenAB;
  const uABy = dyAB / lenAB;
  const nABx = uABy;
  const nABy = -uABx; // Outward (upward) normal
  const angleAB = Math.atan2(dyAB, dxAB) * (180 / Math.PI);
  const slopeAB = (bx !== ax) ? (by - ay) / (bx - ax) : 0;

  // South Edge: D(dx, dy) -> C(cx, cy)
  const dxDC = cx - dx;
  const dyDC = cy - dy;
  const lenDC = Math.hypot(dxDC, dyDC) || 1;
  const uDCx = dxDC / lenDC;
  const uDCy = dyDC / lenDC;
  const nDCx = -uDCy;
  const nDCy = uDCx; // Outward (downward) normal
  const angleDC = Math.atan2(dyDC, dxDC) * (180 / Math.PI);
  const slopeDC = (cx !== dx) ? (cy - dy) / (cx - dx) : 0;

  // West Edge: A(ax, ay) -> D(dx, dy)
  const dxAD = dx - ax;
  const dyAD = dy - ay;
  const lenAD = Math.hypot(dxAD, dyAD) || 1;
  const uADx = dxAD / lenAD;
  const uADy = dyAD / lenAD;
  const nADx = -uADy;
  const nADy = uADx; // Outward (leftward) normal
  const angleAD = Math.atan2(dyAD, dxAD) * (180 / Math.PI) - 180;
  const invSlopeAD = (dy !== ay) ? (dx - ax) / (dy - ay) : 0;

  // East Edge: B(bx, by) -> C(cx, cy)
  const dxBC = cx - bx;
  const dyBC = cy - by;
  const lenBC = Math.hypot(dxBC, dyBC) || 1;
  const uBCx = dxBC / lenBC;
  const uBCy = dyBC / lenBC;
  const nBCx = uBCy;
  const nBCy = -uBCx; // Outward (rightward) normal
  const angleBC = Math.atan2(dyBC, dxBC) * (180 / Math.PI);
  const invSlopeBC = (cy !== by) ? (cx - bx) / (cy - by) : 0;

  // Dimensions for center badge auto-fitting
  const minPlotW = Math.min(scaledNW, scaledSW);
  const minPlotH = Math.min(scaledEH, scaledWH);

  // Base badge dimensions (compact, without Sq.Mtrs and Sy.No.)
  const hasArea = property.areaSqYards !== '' && property.areaSqYards !== undefined;
  const baseBadgeW = 144;
  const baseBadgeH = hasArea ? 44 : 26;

  // Calculate auto-fit scale for center badge so it never overflows plot bounds
  const scaleBadgeW = (minPlotW * 0.78) / baseBadgeW;
  const scaleBadgeH = (minPlotH * 0.72) / baseBadgeH;
  const badgeFitScale = Math.min(1.0, Math.max(0.48, Math.min(scaleBadgeW, scaleBadgeH)));

  // Format dimensions for display
  const nText = formatDimensionDisplay(northDim) || `${nVal}'`;
  const sText = formatDimensionDisplay(southDim) || `${sVal}'`;
  const eText = formatDimensionDisplay(eastDim) || `${eVal}'`;
  const wText = formatDimensionDisplay(westDim) || `${wVal}'`;

  // ================= HOUSE DETAILS & GEOMETRY =================
  const isHouseActive = property.propertyType === 'House' || !!property.house?.enabled;
  const houseData = property.house;

  const parseFt = (val?: string | number, fallback: number = 24): number => {
    if (typeof val === 'number') return val > 0 ? val : fallback;
    if (!val) return fallback;
    const match = String(val).match(/(\d+(?:\.\d+)?)\s*['’]/);
    if (match) {
      const ft = parseFloat(match[1]);
      const inMatch = String(val).match(/['’]\s*(\d+(?:\.\d+)?)/);
      const inches = inMatch ? parseFloat(inMatch[1]) : 0;
      return ft + inches / 12;
    }
    const num = parseFloat(String(val));
    return isNaN(num) || num <= 0 ? fallback : num;
  };

  const avgPlotW = (nVal + sVal) / 2;
  const avgPlotL = (eVal + wVal) / 2;
  const defaultHouseW = Math.max(10, Math.round(avgPlotW * 0.62));
  const defaultHouseL = Math.max(12, Math.round(avgPlotL * 0.60));

  const houseWFeet = parseFt(houseData?.widthRaw ?? houseData?.widthFeet, defaultHouseW);
  const houseLFeet = parseFt(houseData?.lengthRaw ?? houseData?.lengthFeet, defaultHouseL);

  const houseWDisplay = houseData?.widthRaw || `${Math.round(houseWFeet)}'-0"`;
  const houseLDisplay = houseData?.lengthRaw || `${Math.round(houseLFeet)}'-0"`;
  const houseStructure = (houseData?.structureType || 'R.C.C. Roof House').toUpperCase();
  const housePlinthSqFt = houseData?.plinthAreaSqFt || Math.round(houseWFeet * houseLFeet);

  // Scaled dimensions in SVG pixels, capped so it always fits nicely inside the plot
  const maxHousePxW = minPlotW * 0.74;
  const maxHousePxH = minPlotH * 0.70;
  const housePxW = Math.max(54, Math.min(houseWFeet * scale, maxHousePxW));
  const housePxH = Math.max(54, Math.min(houseLFeet * scale, maxHousePxH));

  const hx1 = centerX - housePxW / 2;
  const hx2 = centerX + housePxW / 2;
  const hy1 = centerY - housePxH / 2;
  const hy2 = centerY + housePxH / 2;

  const showHouseDims = houseData?.showMeasurements !== false;
  const showSetbacks = houseData?.showSetbacks !== false;

  // Setback strings
  const rearSetbackText = houseData?.setbackNorth || `${Math.max(1, Math.round(((hy1 - (ay + by) / 2) / scale) * 10) / 10)}'-0"`;
  const frontSetbackText = houseData?.setbackSouth || `${Math.max(1, Math.round((((cy + dy) / 2 - hy2) / scale) * 10) / 10)}'-0"`;
  const westSetbackText = houseData?.setbackWest || `${Math.max(1, Math.round(((hx1 - (ax + dx) / 2) / scale) * 10) / 10)}'-0"`;
  const eastSetbackText = houseData?.setbackEast || `${Math.max(1, Math.round((((bx + cx) / 2 - hx2) / scale) * 10) / 10)}'-0"`;

  return (
    <div className={`plan-sketch-canvas-wrap ${className}`}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="plan-sketch-canvas"
        style={{ aspectRatio: `${viewBoxWidth} / ${viewBoxHeight}` }}
      >
        {/* Tracing Overlay: Uploaded Hand-Drawn Sketch (Same to Same Tracing Mode) */}
        {showOverlay && overlayImage && (
          <g id="manual-sketch-overlay" opacity={overlayOpacity}>
            <image
              href={overlayImage}
              x="16"
              y="16"
              width={viewBoxWidth - 32}
              height={viewBoxHeight - 32}
              preserveAspectRatio="xMidYMid meet"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        )}

        {/* Outer Cadastral Border Frame */}

        {/* ================= NORTH ARROW (COMPASS) ================= */}
        <g transform={`translate(${viewBoxWidth - 70}, 65)`}>
          <circle cx="0" cy="0" r="24" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
          <g transform={`rotate(${boundaries.northRotation || 0})`}>
            {/* Compass 4-point star */}
            <polygon points="0,-20 5,-4 0,0" fill="#000000" />
            <polygon points="0,-20 -5,-4 0,0" fill="#000000" />
            <polygon points="0,20 4,4 0,0" fill="#000000" />
            <polygon points="0,20 -4,4 0,0" fill="#000000" />
            <polygon points="20,0 4,4 0,0" fill="#000000" />
            <polygon points="-20,0 -4,4 0,0" fill="#000000" />
            {/* North 'N' label */}
            <text
              x="0"
              y="-26"
              textAnchor="middle"
              style={{ ...T(12, 800), ...{ fontFamily: 'sans-serif' } }}
            >
              N
            </text>
          </g>
        </g>

        {/* ================= ROAD STRIPS ================= */}
        {/* South Road */}
        {hasSouthRoad && (() => {
          const isCont = roadContinuous !== false;
          const isDeadEnd = roadLayoutType === 'Dead-End / Cul-de-Sac';
          const termR = isDeadEnd && (deadEndSide === 'right' || deadEndSide === 'both');
          const termL = isDeadEnd && (deadEndSide === 'left' || deadEndSide === 'both');

          const extL = termL ? 22 : (!isCont || roadContinuitySide === 'right' || roadContinuitySide === 'none' ? 0 : 80);
          const extR = termR ? 22 : (!isCont || roadContinuitySide === 'left' || roadContinuitySide === 'none' ? 0 : 80);

          // Junction bounds
          const x1 = Math.max(22, dx - (hasWestRoad ? roadStripDepth : 0) - extL);
          const x2 = Math.min(viewBoxWidth - 22, cx + (hasEastRoad ? roadStripDepth : 0) + extR);

          const yIn = (x: number) => dy + slopeDC * (x - dx);
          const yOut = (x: number) => yIn(x) + roadStripDepth;

          const y1_in = yIn(x1);
          const y1_out = yOut(x1);
          const y2_in = yIn(x2);
          const y2_out = yOut(x2);

          // Center line endpoints
          const xCenterStart = extL > 0 ? x1 : (hasWestRoad ? dx - roadStripDepth : dx);
          const xCenterEnd = extR > 0 ? x2 : (hasEastRoad ? cx + roadStripDepth : cx);

          // T-Junction Approach Branch on South
          const isTJunctionBranch = isTJunction && effectiveTJunctionSide === 'South';
          const midX = (dx + cx) / 2;
          const apprRoadW = 46;
          const apprX1 = midX - apprRoadW / 2;
          const apprX2 = midX + apprRoadW / 2;
          const apprY1 = yOut(apprX1);
          const apprY2 = yOut(apprX2);
          const apprBottomY = Math.min(viewBoxHeight - 14, Math.max(apprY1, apprY2) + 52);

          // Dead-End Bulb / Barrier dimensions
          const bulbR = roadStripDepth * 0.65;
          const bulbMidY_R = (y2_in + y2_out) / 2;
          const bulbCenterX_R = x2 + bulbR * 0.55;
          const bulbMidY_L = (y1_in + y1_out) / 2;
          const bulbCenterX_L = x1 - bulbR * 0.55;

          // Road Display Label
          let roadDisplayLabel = isCont ? `⟵  ${roadLabel}  ⟶` : roadLabel;
          if (roadLayoutType === 'Through Road / Through Plot') {
            roadDisplayLabel = `⟵  THROUGH ROAD (${roadLabel})  ⟶`;
          } else if (roadLayoutType === 'T-Junction') {
            roadDisplayLabel = `⟵  ${roadLabel} (T-JUNCTION)  ⟶`;
          } else if (isDeadEnd) {
            roadDisplayLabel = `${roadLabel} (${deadEndType === 'cul-de-sac' ? 'CUL-DE-SAC' : 'DEAD-END'})`;
          }

          return (
            <g id="road-south">
              {/* Road surface polygon (no stroke to prevent dividing lines in junction) */}
              <polygon
                points={`${x1},${y1_in} ${x2},${y2_in} ${x2},${y2_out} ${x1},${y1_out}`}
                fill="#ffffff"
                stroke="none"
              />

              {/* T-Junction Approach Road Surface */}
              {isTJunctionBranch && (
                <polygon
                  points={`${apprX1},${apprY1 - 1} ${apprX2},${apprY2 - 1} ${apprX2},${apprBottomY} ${apprX1},${apprBottomY}`}
                  fill="#ffffff"
                  stroke="none"
                />
              )}

              {/* Outer boundary line - continuous or opening into T-Junction */}
              {isTJunctionBranch ? (
                <>
                  <line x1={x1} y1={y1_out} x2={apprX1 - 8} y2={yOut(apprX1 - 8)} stroke="#000000" strokeWidth="1.5" />
                  <path
                    d={`M ${apprX1 - 8} ${yOut(apprX1 - 8)} Q ${apprX1} ${apprY1} ${apprX1} ${apprY1 + 8} L ${apprX1} ${apprBottomY}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line x1={apprX1} y1={apprBottomY} x2={apprX2} y2={apprBottomY} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                  <path
                    d={`M ${apprX2} ${apprBottomY} L ${apprX2} ${apprY2 + 8} Q ${apprX2} ${apprY2} ${apprX2 + 8} ${yOut(apprX2 + 8)}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line x1={apprX2 + 8} y1={yOut(apprX2 + 8)} x2={x2} y2={y2_out} stroke="#000000" strokeWidth="1.5" />
                  {/* T-Junction approach center dashed line */}
                  <line
                    x1={midX}
                    y1={(apprY1 + apprY2) / 2}
                    x2={midX}
                    y2={apprBottomY}
                    stroke="#000000"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                  {/* T-Junction approach branch labels */}
                  <text
                    x={midX}
                    y={(apprY1 + apprBottomY) / 2 + 3}
                    textAnchor="middle"
                    style={{ ...T(8, 800, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                  >
                    {approachRoadWidth ? `${approachRoadWidth} ` : ''}T-JUNCTION ROAD
                  </text>
                  <text
                    x={midX}
                    y={(apprY1 + apprBottomY) / 2 + 13}
                    textAnchor="middle"
                    style={{ ...T(7.5, 700, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' } }}
                  >
                    (ఎదురు రోడ్డు)
                  </text>
                </>
              ) : (
                <line
                  x1={x1}
                  y1={y1_out}
                  x2={x2}
                  y2={y2_out}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* Inner boundary beyond plot on left */}
              {x1 < dx && (
                <line
                  x1={x1}
                  y1={y1_in}
                  x2={dx}
                  y2={dy}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* Inner boundary beyond plot on right */}
              {x2 > cx && (
                <line
                  x1={cx}
                  y1={cy}
                  x2={x2}
                  y2={y2_in}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* End caps / break lines (when not dead-end) */}
              {!termL && !hasWestRoad && (
                extL > 0 ? (
                  <line x1={x1} y1={y1_in} x2={x1} y2={y1_out} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                ) : (
                  <line x1={dx} y1={dy} x2={dx} y2={yOut(dx)} stroke="#000000" strokeWidth="1.5" />
                )
              )}
              {!termL && hasWestRoad && extL > 0 && (
                <line x1={x1} y1={y1_in} x2={x1} y2={y1_out} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
              )}

              {!termR && !hasEastRoad && (
                extR > 0 ? (
                  <line x1={x2} y1={y2_in} x2={x2} y2={y2_out} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                ) : (
                  <line x1={cx} y1={cy} x2={cx} y2={yOut(cx)} stroke="#000000" strokeWidth="1.5" />
                )
              )}
              {!termR && hasEastRoad && extR > 0 && (
                <line x1={x2} y1={y2_in} x2={x2} y2={y2_out} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
              )}

              {/* Dead-End / Cul-de-Sac Renderings on Right */}
              {termR && (
                deadEndType === 'cul-de-sac' ? (
                  <g id="cul-de-sac-south-right">
                    <path
                      d={`M ${x2} ${y2_in} C ${x2 + bulbR * 0.8} ${y2_in - bulbR * 0.4}, ${x2 + bulbR * 1.5} ${bulbMidY_R - bulbR * 0.7}, ${x2 + bulbR * 1.5} ${bulbMidY_R} C ${x2 + bulbR * 1.5} ${bulbMidY_R + bulbR * 0.7}, ${x2 + bulbR * 0.8} ${y2_out + bulbR * 0.4}, ${x2} ${y2_out}`}
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth="1.5"
                    />
                    <circle cx={bulbCenterX_R} cy={bulbMidY_R} r={bulbR * 0.42} fill="none" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx={bulbCenterX_R} cy={bulbMidY_R} r="2.5" fill="#000000" />
                    <text x={bulbCenterX_R} y={bulbMidY_R - bulbR * 0.55} textAnchor="middle" style={{ ...T(7.5, 900, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}>
                      CUL-DE-SAC
                    </text>
                    <text x={bulbCenterX_R} y={bulbMidY_R + bulbR * 0.68} textAnchor="middle" style={{ ...T(6.5, 700), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' } }}>
                      (టర్నింగ్ సర్కిల్)
                    </text>
                  </g>
                ) : (
                  <g id="dead-end-south-right">
                    <line x1={x2} y1={y2_in} x2={x2} y2={y2_out} stroke="#000000" strokeWidth="1.5" />
                    {[0.2, 0.4, 0.6, 0.8].map((f, i) => {
                      const py = y2_in + (y2_out - y2_in) * f;
                      return (
                        <line
                          key={i}
                          x1={x2 - 5}
                          y1={py - 4}
                          x2={x2 + 5}
                          y2={py + 4}
                          stroke="#000000"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                    <text
                      x={x2 - 8}
                      y={(y2_in + y2_out) / 2}
                      textAnchor="end"
                      dominantBaseline="central"
                      style={{ ...T(8, 900, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                    >
                      DEAD END ⛔
                    </text>
                  </g>
                )
              )}

              {/* Dead-End / Cul-de-Sac Renderings on Left */}
              {termL && (
                deadEndType === 'cul-de-sac' ? (
                  <g id="cul-de-sac-south-left">
                    <path
                      d={`M ${x1} ${y1_in} C ${x1 - bulbR * 0.8} ${y1_in - bulbR * 0.4}, ${x1 - bulbR * 1.5} ${bulbMidY_L - bulbR * 0.7}, ${x1 - bulbR * 1.5} ${bulbMidY_L} C ${x1 - bulbR * 1.5} ${bulbMidY_L + bulbR * 0.7}, ${x1 - bulbR * 0.8} ${y1_out + bulbR * 0.4}, ${x1} ${y1_out}`}
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth="1.5"
                    />
                    <circle cx={bulbCenterX_L} cy={bulbMidY_L} r={bulbR * 0.42} fill="none" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx={bulbCenterX_L} cy={bulbMidY_L} r="2.5" fill="#000000" />
                    <text x={bulbCenterX_L} y={bulbMidY_L - bulbR * 0.55} textAnchor="middle" style={{ ...T(7.5, 900, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}>
                      CUL-DE-SAC
                    </text>
                    <text x={bulbCenterX_L} y={bulbMidY_L + bulbR * 0.68} textAnchor="middle" style={{ ...T(6.5, 700), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' } }}>
                      (టర్నింగ్ సర్కిల్)
                    </text>
                  </g>
                ) : (
                  <g id="dead-end-south-left">
                    <line x1={x1} y1={y1_in} x2={x1} y2={y1_out} stroke="#000000" strokeWidth="1.5" />
                    {[0.2, 0.4, 0.6, 0.8].map((f, i) => {
                      const py = y1_in + (y1_out - y1_in) * f;
                      return (
                        <line
                          key={i}
                          x1={x1 - 5}
                          y1={py - 4}
                          x2={x1 + 5}
                          y2={py + 4}
                          stroke="#000000"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                    <text
                      x={x1 + 8}
                      y={(y1_in + y1_out) / 2}
                      textAnchor="start"
                      dominantBaseline="central"
                      style={{ ...T(8, 900, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                    >
                      ⛔ DEAD END
                    </text>
                  </g>
                )
              )}

              {/* Center Dashed Line */}
              <line
                x1={xCenterStart}
                y1={yIn(xCenterStart) + roadStripDepth / 2}
                x2={xCenterEnd}
                y2={yIn(xCenterEnd) + roadStripDepth / 2}
                stroke="#000000"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />

              {/* Road Label placed along the road center and aligned with slope */}
              {(() => {
                const midX_lbl = (dx + cx) / 2;
                const midY_lbl = yIn(midX_lbl) + roadStripDepth / 2;
                return (
                  <g transform={`rotate(${angleDC}, ${midX_lbl}, ${midY_lbl})`}>
                    <text
                      x={midX_lbl}
                      y={midY_lbl}
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ ...T(11, 700, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                    >
                      {roadDisplayLabel}
                    </text>
                  </g>
                );
              })()}

              {/* Optional direction continuation labels */}
              {extL > 0 && !termL && roadDirectionLeft && (
                <text
                  x={x1 + 8}
                  y={yIn(x1 + 8) + roadStripDepth / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  transform={`rotate(${angleDC}, ${x1 + 8}, ${yIn(x1 + 8) + roadStripDepth / 2})`}
                  style={{ ...T(9, 700, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' } }}
                >
                  ⟵ {roadDirectionLeft}
                </text>
              )}
              {extR > 0 && !termR && roadDirectionRight && (
                <text
                  x={x2 - 8}
                  y={yIn(x2 - 8) + roadStripDepth / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  transform={`rotate(${angleDC}, ${x2 - 8}, ${yIn(x2 - 8) + roadStripDepth / 2})`}
                  style={{ ...T(9, 700, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' } }}
                >
                  {roadDirectionRight} ⟶
                </text>
              )}
            </g>
          );
        })()}

        {/* North Road */}
        {hasNorthRoad && (() => {
          const isCont = roadContinuous !== false;
          const isDeadEnd = roadLayoutType === 'Dead-End / Cul-de-Sac';
          const termR = isDeadEnd && (deadEndSide === 'right' || deadEndSide === 'both');
          const termL = isDeadEnd && (deadEndSide === 'left' || deadEndSide === 'both');

          const extL = termL ? 22 : (!isCont || roadContinuitySide === 'right' || roadContinuitySide === 'none' ? 0 : 80);
          const extR = termR ? 22 : (!isCont || roadContinuitySide === 'left' || roadContinuitySide === 'none' ? 0 : 80);

          const x1 = Math.max(22, ax - (hasWestRoad ? roadStripDepth : 0) - extL);
          const x2 = Math.min(viewBoxWidth - 22, bx + (hasEastRoad ? roadStripDepth : 0) + extR);

          const yIn = (x: number) => ay + slopeAB * (x - ax);
          const yOut = (x: number) => yIn(x) - roadStripDepth;

          const y1_in = yIn(x1);
          const y1_out = yOut(x1);
          const y2_in = yIn(x2);
          const y2_out = yOut(x2);

          const xCenterStart = extL > 0 ? x1 : (hasWestRoad ? ax - roadStripDepth : ax);
          const xCenterEnd = extR > 0 ? x2 : (hasEastRoad ? bx + roadStripDepth : bx);

          // T-Junction Approach Branch on North
          const isTJunctionBranch = isTJunction && effectiveTJunctionSide === 'North';
          const midX = (ax + bx) / 2;
          const apprRoadW = 46;
          const apprX1 = midX - apprRoadW / 2;
          const apprX2 = midX + apprRoadW / 2;
          const apprY1 = yOut(apprX1);
          const apprY2 = yOut(apprX2);
          const apprTopY = Math.max(14, Math.min(apprY1, apprY2) - 52);

          // Dead-End Bulb / Barrier dimensions
          const bulbR = roadStripDepth * 0.65;
          const bulbMidY_R = (y2_in + y2_out) / 2;
          const bulbCenterX_R = x2 + bulbR * 0.55;
          const bulbMidY_L = (y1_in + y1_out) / 2;
          const bulbCenterX_L = x1 - bulbR * 0.55;

          // Road Display Label
          let roadDisplayLabel = isCont ? `⟵  ${roadLabel}  ⟶` : roadLabel;
          if (roadLayoutType === 'Through Road / Through Plot') {
            roadDisplayLabel = `⟵  THROUGH ROAD (${roadLabel})  ⟶`;
          } else if (roadLayoutType === 'T-Junction') {
            roadDisplayLabel = `⟵  ${roadLabel} (T-JUNCTION)  ⟶`;
          } else if (isDeadEnd) {
            roadDisplayLabel = `${roadLabel} (${deadEndType === 'cul-de-sac' ? 'CUL-DE-SAC' : 'DEAD-END'})`;
          }

          return (
            <g id="road-north">
              <polygon
                points={`${x1},${y1_out} ${x2},${y2_out} ${x2},${y2_in} ${x1},${y1_in}`}
                fill="#ffffff"
                stroke="none"
              />

              {/* T-Junction Approach Road Surface */}
              {isTJunctionBranch && (
                <polygon
                  points={`${apprX1},${apprTopY} ${apprX2},${apprTopY} ${apprX2},${apprY2 + 1} ${apprX1},${apprY1 + 1}`}
                  fill="#ffffff"
                  stroke="none"
                />
              )}

              {/* Outer boundary - continuous or opening into T-Junction */}
              {isTJunctionBranch ? (
                <>
                  <line x1={x1} y1={y1_out} x2={apprX1 - 8} y2={yOut(apprX1 - 8)} stroke="#000000" strokeWidth="1.5" />
                  <path
                    d={`M ${apprX1 - 8} ${yOut(apprX1 - 8)} Q ${apprX1} ${apprY1} ${apprX1} ${apprY1 - 8} L ${apprX1} ${apprTopY}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line x1={apprX1} y1={apprTopY} x2={apprX2} y2={apprTopY} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                  <path
                    d={`M ${apprX2} ${apprTopY} L ${apprX2} ${apprY2 - 8} Q ${apprX2} ${apprY2} ${apprX2 + 8} ${yOut(apprX2 + 8)}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line x1={apprX2 + 8} y1={yOut(apprX2 + 8)} x2={x2} y2={y2_out} stroke="#000000" strokeWidth="1.5" />
                  {/* Center dashed line for approach road */}
                  <line
                    x1={midX}
                    y1={apprTopY}
                    x2={midX}
                    y2={(apprY1 + apprY2) / 2}
                    stroke="#000000"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                  {/* Labels on approach branch */}
                  <text
                    x={midX}
                    y={(apprTopY + apprY1) / 2 - 2}
                    textAnchor="middle"
                    style={{ ...T(8, 800, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                  >
                    {approachRoadWidth ? `${approachRoadWidth} ` : ''}T-JUNCTION ROAD
                  </text>
                  <text
                    x={midX}
                    y={(apprTopY + apprY1) / 2 + 8}
                    textAnchor="middle"
                    style={{ ...T(7.5, 700, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' } }}
                  >
                    (ఎదురు రోడ్డు)
                  </text>
                </>
              ) : (
                <line
                  x1={x1}
                  y1={y1_out}
                  x2={x2}
                  y2={y2_out}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* Inner boundary beyond plot on left */}
              {x1 < ax && (
                <line
                  x1={x1}
                  y1={y1_in}
                  x2={ax}
                  y2={ay}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* Inner boundary beyond plot on right */}
              {x2 > bx && (
                <line
                  x1={bx}
                  y1={by}
                  x2={x2}
                  y2={y2_in}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* End caps */}
              {!termL && !hasWestRoad && (
                extL > 0 ? (
                  <line x1={x1} y1={y1_in} x2={x1} y2={y1_out} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                ) : (
                  <line x1={ax} y1={ay} x2={ax} y2={yOut(ax)} stroke="#000000" strokeWidth="1.5" />
                )
              )}
              {!termL && hasWestRoad && extL > 0 && (
                <line x1={x1} y1={y1_in} x2={x1} y2={y1_out} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
              )}

              {!termR && !hasEastRoad && (
                extR > 0 ? (
                  <line x1={x2} y1={y2_in} x2={x2} y2={y2_out} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                ) : (
                  <line x1={bx} y1={by} x2={bx} y2={yOut(bx)} stroke="#000000" strokeWidth="1.5" />
                )
              )}
              {!termR && hasEastRoad && extR > 0 && (
                <line x1={x2} y1={y2_in} x2={x2} y2={y2_out} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
              )}

              {/* Dead-End / Cul-de-Sac Renderings on Right */}
              {termR && (
                deadEndType === 'cul-de-sac' ? (
                  <g id="cul-de-sac-north-right">
                    <path
                      d={`M ${x2} ${y2_in} C ${x2 + bulbR * 0.8} ${y2_in + bulbR * 0.4}, ${x2 + bulbR * 1.5} ${bulbMidY_R + bulbR * 0.7}, ${x2 + bulbR * 1.5} ${bulbMidY_R} C ${x2 + bulbR * 1.5} ${bulbMidY_R - bulbR * 0.7}, ${x2 + bulbR * 0.8} ${y2_out - bulbR * 0.4}, ${x2} ${y2_out}`}
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth="1.5"
                    />
                    <circle cx={bulbCenterX_R} cy={bulbMidY_R} r={bulbR * 0.42} fill="none" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx={bulbCenterX_R} cy={bulbMidY_R} r="2.5" fill="#000000" />
                    <text x={bulbCenterX_R} y={bulbMidY_R - bulbR * 0.55} textAnchor="middle" style={{ ...T(7.5, 900, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}>
                      CUL-DE-SAC
                    </text>
                  </g>
                ) : (
                  <g id="dead-end-north-right">
                    <line x1={x2} y1={y2_in} x2={x2} y2={y2_out} stroke="#000000" strokeWidth="1.5" />
                    {[0.2, 0.4, 0.6, 0.8].map((f, i) => {
                      const py = y2_in + (y2_out - y2_in) * f;
                      return (
                        <line
                          key={i}
                          x1={x2 - 5}
                          y1={py - 4}
                          x2={x2 + 5}
                          y2={py + 4}
                          stroke="#000000"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                    <text
                      x={x2 - 8}
                      y={(y2_in + y2_out) / 2}
                      textAnchor="end"
                      dominantBaseline="central"
                      style={{ ...T(8, 900, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                    >
                      DEAD END ⛔
                    </text>
                  </g>
                )
              )}

              {/* Dead-End / Cul-de-Sac Renderings on Left */}
              {termL && (
                deadEndType === 'cul-de-sac' ? (
                  <g id="cul-de-sac-north-left">
                    <path
                      d={`M ${x1} ${y1_in} C ${x1 - bulbR * 0.8} ${y1_in + bulbR * 0.4}, ${x1 - bulbR * 1.5} ${bulbMidY_L + bulbR * 0.7}, ${x1 - bulbR * 1.5} ${bulbMidY_L} C ${x1 - bulbR * 1.5} ${bulbMidY_L - bulbR * 0.7}, ${x1 - bulbR * 0.8} ${y1_out - bulbR * 0.4}, ${x1} ${y1_out}`}
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth="1.5"
                    />
                    <circle cx={bulbCenterX_L} cy={bulbMidY_L} r={bulbR * 0.42} fill="none" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx={bulbCenterX_L} cy={bulbMidY_L} r="2.5" fill="#000000" />
                    <text x={bulbCenterX_L} y={bulbMidY_L - bulbR * 0.55} textAnchor="middle" style={{ ...T(7.5, 900, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}>
                      CUL-DE-SAC
                    </text>
                  </g>
                ) : (
                  <g id="dead-end-north-left">
                    <line x1={x1} y1={y1_in} x2={x1} y2={y1_out} stroke="#000000" strokeWidth="1.5" />
                    {[0.2, 0.4, 0.6, 0.8].map((f, i) => {
                      const py = y1_in + (y1_out - y1_in) * f;
                      return (
                        <line
                          key={i}
                          x1={x1 - 5}
                          y1={py - 4}
                          x2={x1 + 5}
                          y2={py + 4}
                          stroke="#000000"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                    <text
                      x={x1 + 8}
                      y={(y1_in + y1_out) / 2}
                      textAnchor="start"
                      dominantBaseline="central"
                      style={{ ...T(8, 900, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                    >
                      ⛔ DEAD END
                    </text>
                  </g>
                )
              )}

              {/* Center Dashed Line */}
              <line
                x1={xCenterStart}
                y1={yIn(xCenterStart) - roadStripDepth / 2}
                x2={xCenterEnd}
                y2={yIn(xCenterEnd) - roadStripDepth / 2}
                stroke="#000000"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />

              {/* Road Label */}
              {(() => {
                const midX_lbl = (ax + bx) / 2;
                const midY_lbl = yIn(midX_lbl) - roadStripDepth / 2;
                return (
                  <g transform={`rotate(${angleAB}, ${midX_lbl}, ${midY_lbl})`}>
                    <text
                      x={midX_lbl}
                      y={midY_lbl}
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ ...T(11, 700, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                    >
                      {roadDisplayLabel}
                    </text>
                  </g>
                );
              })()}

              {extL > 0 && !termL && roadDirectionLeft && (
                <text
                  x={x1 + 8}
                  y={yIn(x1 + 8) - roadStripDepth / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  transform={`rotate(${angleAB}, ${x1 + 8}, ${yIn(x1 + 8) - roadStripDepth / 2})`}
                  style={{ ...T(9, 700, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' } }}
                >
                  ⟵ {roadDirectionLeft}
                </text>
              )}
              {extR > 0 && !termR && roadDirectionRight && (
                <text
                  x={x2 - 8}
                  y={yIn(x2 - 8) - roadStripDepth / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  transform={`rotate(${angleAB}, ${x2 - 8}, ${yIn(x2 - 8) - roadStripDepth / 2})`}
                  style={{ ...T(9, 700, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' } }}
                >
                  {roadDirectionRight} ⟶
                </text>
              )}
            </g>
          );
        })()}

        {/* East Road */}
        {hasEastRoad && (() => {
          const isCont = roadContinuous !== false;
          const isDeadEnd = roadLayoutType === 'Dead-End / Cul-de-Sac';
          const extT = !isCont ? 0 : 70;
          const extB = !isCont ? 0 : 70;

          const y1 = Math.max(22, by - (hasNorthRoad ? roadStripDepth : 0) - extT);
          const y2 = Math.min(viewBoxHeight - 22, cy + (hasSouthRoad ? roadStripDepth : 0) + extB);

          const xIn = (y: number) => bx + invSlopeBC * (y - by);
          const xOut = (y: number) => xIn(y) + roadStripDepth;

          const x1_in = xIn(y1);
          const x1_out = xOut(y1);
          const x2_in = xIn(y2);
          const x2_out = xOut(y2);

          const yCenterStart = extT > 0 ? y1 : (hasNorthRoad ? by - roadStripDepth : by);
          const yCenterEnd = extB > 0 ? y2 : (hasSouthRoad ? cy + roadStripDepth : cy);

          // T-Junction on East
          const isTJunctionBranch = isTJunction && effectiveTJunctionSide === 'East';
          const midY = (by + cy) / 2;
          const apprRoadH = 46;
          const apprY1 = midY - apprRoadH / 2;
          const apprY2 = midY + apprRoadH / 2;
          const apprX1 = xOut(apprY1);
          const apprX2 = xOut(apprY2);
          const apprRightX = Math.min(viewBoxWidth - 14, Math.max(apprX1, apprX2) + 52);

          let roadDisplayLabel = isCont ? `⟵  ${roadLabel}  ⟶` : roadLabel;
          if (roadLayoutType === 'Through Road / Through Plot') {
            roadDisplayLabel = `⟵  THROUGH ROAD (${roadLabel})  ⟶`;
          } else if (roadLayoutType === 'T-Junction') {
            roadDisplayLabel = `⟵  ${roadLabel} (T-JUNCTION)  ⟶`;
          } else if (isDeadEnd) {
            roadDisplayLabel = `${roadLabel} (${deadEndType === 'cul-de-sac' ? 'CUL-DE-SAC' : 'DEAD-END'})`;
          }

          return (
            <g id="road-east">
              <polygon
                points={`${x1_in},${y1} ${x1_out},${y1} ${x2_out},${y2} ${x2_in},${y2}`}
                fill="#ffffff"
                stroke="none"
              />

              {/* T-Junction Approach Branch East */}
              {isTJunctionBranch && (
                <>
                  <polygon
                    points={`${apprX1 - 1},${apprY1} ${apprRightX},${apprY1} ${apprRightX},${apprY2} ${apprX2 - 1},${apprY2}`}
                    fill="#ffffff"
                    stroke="none"
                  />
                  <line x1={x1_out} y1={y1} x2={xOut(apprY1 - 8)} y2={apprY1 - 8} stroke="#000000" strokeWidth="1.5" />
                  <path
                    d={`M ${xOut(apprY1 - 8)} ${apprY1 - 8} Q ${apprX1} ${apprY1} ${apprX1 + 8} ${apprY1} L ${apprRightX} ${apprY1}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line x1={apprRightX} y1={apprY1} x2={apprRightX} y2={apprY2} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                  <path
                    d={`M ${apprRightX} ${apprY2} L ${apprX2 + 8} ${apprY2} Q ${apprX2} ${apprY2} ${xOut(apprY2 + 8)} ${apprY2 + 8}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line x1={xOut(apprY2 + 8)} y1={apprY2 + 8} x2={x2_out} y2={y2} stroke="#000000" strokeWidth="1.5" />
                  {/* Center line for approach road */}
                  <line
                    x1={(apprX1 + apprX2) / 2}
                    y1={midY}
                    x2={apprRightX}
                    y2={midY}
                    stroke="#000000"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                  <text
                    x={(apprX1 + apprRightX) / 2}
                    y={midY - 4}
                    textAnchor="middle"
                    style={{ ...T(7.5, 800, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                  >
                    T-JUNCTION
                  </text>
                </>
              )}

              {/* Outer boundary */}
              {!isTJunctionBranch && (
                <line
                  x1={x1_out}
                  y1={y1}
                  x2={x2_out}
                  y2={y2}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* Inner boundary beyond plot on top */}
              {y1 < by && (
                <line
                  x1={x1_in}
                  y1={y1}
                  x2={bx}
                  y2={by}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* Inner boundary beyond plot on bottom */}
              {y2 > cy && (
                <line
                  x1={cx}
                  y1={cy}
                  x2={x2_in}
                  y2={y2}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* End caps */}
              {!hasNorthRoad && (
                extT > 0 ? (
                  <line x1={x1_in} y1={y1} x2={x1_out} y2={y1} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                ) : (
                  <line x1={bx} y1={by} x2={xOut(by)} y2={by} stroke="#000000" strokeWidth="1.5" />
                )
              )}
              {hasNorthRoad && extT > 0 && (
                <line x1={x1_in} y1={y1} x2={x1_out} y2={y1} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
              )}

              {!hasSouthRoad && (
                extB > 0 ? (
                  <line x1={x2_in} y1={y2} x2={x2_out} y2={y2} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                ) : (
                  <line x1={cx} y1={cy} x2={xOut(cy)} y2={cy} stroke="#000000" strokeWidth="1.5" />
                )
              )}
              {hasSouthRoad && extB > 0 && (
                <line x1={x2_in} y1={y2} x2={x2_out} y2={y2} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
              )}

              {/* Center Dashed Line */}
              <line
                x1={xIn(yCenterStart) + roadStripDepth / 2}
                y1={yCenterStart}
                x2={xIn(yCenterEnd) + roadStripDepth / 2}
                y2={yCenterEnd}
                stroke="#000000"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />

              {/* Road Label */}
              {(() => {
                const midY_lbl = (by + cy) / 2;
                const midX_lbl = xIn(midY_lbl) + roadStripDepth / 2;
                return (
                  <g transform={`rotate(${angleBC}, ${midX_lbl}, ${midY_lbl})`}>
                    <text
                      x={midX_lbl}
                      y={midY_lbl}
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ ...T(11, 700, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                    >
                      {roadDisplayLabel}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })()}

        {/* West Road */}
        {hasWestRoad && (() => {
          const isCont = roadContinuous !== false;
          const isDeadEnd = roadLayoutType === 'Dead-End / Cul-de-Sac';
          const extT = !isCont ? 0 : 70;
          const extB = !isCont ? 0 : 70;

          const y1 = Math.max(22, ay - (hasNorthRoad ? roadStripDepth : 0) - extT);
          const y2 = Math.min(viewBoxHeight - 22, dy + (hasSouthRoad ? roadStripDepth : 0) + extB);

          const xIn = (y: number) => ax + invSlopeAD * (y - ay);
          const xOut = (y: number) => xIn(y) - roadStripDepth;

          const x1_in = xIn(y1);
          const x1_out = xOut(y1);
          const x2_in = xIn(y2);
          const x2_out = xOut(y2);

          const yCenterStart = extT > 0 ? y1 : (hasNorthRoad ? ay - roadStripDepth : ay);
          const yCenterEnd = extB > 0 ? y2 : (hasSouthRoad ? dy + roadStripDepth : dy);

          // T-Junction on West
          const isTJunctionBranch = isTJunction && effectiveTJunctionSide === 'West';
          const midY = (ay + dy) / 2;
          const apprRoadH = 46;
          const apprY1 = midY - apprRoadH / 2;
          const apprY2 = midY + apprRoadH / 2;
          const apprX1 = xOut(apprY1);
          const apprX2 = xOut(apprY2);
          const apprLeftX = Math.max(14, Math.min(apprX1, apprX2) - 52);

          let roadDisplayLabel = isCont ? `⟵  ${roadLabel}  ⟶` : roadLabel;
          if (roadLayoutType === 'Through Road / Through Plot') {
            roadDisplayLabel = `⟵  THROUGH ROAD (${roadLabel})  ⟶`;
          } else if (roadLayoutType === 'T-Junction') {
            roadDisplayLabel = `⟵  ${roadLabel} (T-JUNCTION)  ⟶`;
          } else if (isDeadEnd) {
            roadDisplayLabel = `${roadLabel} (${deadEndType === 'cul-de-sac' ? 'CUL-DE-SAC' : 'DEAD-END'})`;
          }

          return (
            <g id="road-west">
              <polygon
                points={`${x1_out},${y1} ${x1_in},${y1} ${x2_in},${y2} ${x2_out},${y2}`}
                fill="#ffffff"
                stroke="none"
              />

              {/* T-Junction Approach Branch West */}
              {isTJunctionBranch && (
                <>
                  <polygon
                    points={`${apprLeftX},${apprY1} ${apprX1 + 1},${apprY1} ${apprX2 + 1},${apprY2} ${apprLeftX},${apprY2}`}
                    fill="#ffffff"
                    stroke="none"
                  />
                  <line x1={x1_out} y1={y1} x2={xOut(apprY1 - 8)} y2={apprY1 - 8} stroke="#000000" strokeWidth="1.5" />
                  <path
                    d={`M ${xOut(apprY1 - 8)} ${apprY1 - 8} Q ${apprX1} ${apprY1} ${apprX1 - 8} ${apprY1} L ${apprLeftX} ${apprY1}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line x1={apprLeftX} y1={apprY1} x2={apprLeftX} y2={apprY2} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                  <path
                    d={`M ${apprLeftX} ${apprY2} L ${apprX2 - 8} ${apprY2} Q ${apprX2} ${apprY2} ${xOut(apprY2 + 8)} ${apprY2 + 8}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line x1={xOut(apprY2 + 8)} y1={apprY2 + 8} x2={x2_out} y2={y2} stroke="#000000" strokeWidth="1.5" />
                  {/* Center line for approach road */}
                  <line
                    x1={apprLeftX}
                    y1={midY}
                    x2={(apprX1 + apprX2) / 2}
                    y2={midY}
                    stroke="#000000"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                  <text
                    x={(apprX1 + apprLeftX) / 2}
                    y={midY - 4}
                    textAnchor="middle"
                    style={{ ...T(7.5, 800, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                  >
                    T-JUNCTION
                  </text>
                </>
              )}

              {/* Outer boundary */}
              {!isTJunctionBranch && (
                <line
                  x1={x1_out}
                  y1={y1}
                  x2={x2_out}
                  y2={y2}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* Inner boundary beyond plot on top */}
              {y1 < ay && (
                <line
                  x1={x1_in}
                  y1={y1}
                  x2={ax}
                  y2={ay}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* Inner boundary beyond plot on bottom */}
              {y2 > dy && (
                <line
                  x1={dx}
                  y1={dy}
                  x2={x2_in}
                  y2={y2}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              )}

              {/* End caps */}
              {!hasNorthRoad && (
                extT > 0 ? (
                  <line x1={x1_in} y1={y1} x2={x1_out} y2={y1} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                ) : (
                  <line x1={ax} y1={ay} x2={xOut(ay)} y2={ay} stroke="#000000" strokeWidth="1.5" />
                )
              )}
              {hasNorthRoad && extT > 0 && (
                <line x1={x1_in} y1={y1} x2={x1_out} y2={y1} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
              )}

              {!hasSouthRoad && (
                extB > 0 ? (
                  <line x1={x2_in} y1={y2} x2={x2_out} y2={y2} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
                ) : (
                  <line x1={dx} y1={dy} x2={xOut(dy)} y2={dy} stroke="#000000" strokeWidth="1.5" />
                )
              )}
              {hasSouthRoad && extB > 0 && (
                <line x1={x2_in} y1={y2} x2={x2_out} y2={y2} stroke="#000000" strokeWidth="1.5" strokeDasharray="3 2" />
              )}

              {/* Center Dashed Line */}
              <line
                x1={xIn(yCenterStart) - roadStripDepth / 2}
                y1={yCenterStart}
                x2={xIn(yCenterEnd) - roadStripDepth / 2}
                y2={yCenterEnd}
                stroke="#000000"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />

              {/* Road Label */}
              {(() => {
                const midY_lbl = (ay + dy) / 2;
                const midX_lbl = xIn(midY_lbl) - roadStripDepth / 2;
                return (
                  <g transform={`rotate(${angleAD}, ${midX_lbl}, ${midY_lbl})`}>
                    <text
                      x={midX_lbl}
                      y={midY_lbl}
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ ...T(11, 700, {letterSpacing: '0.025em', textTransform: 'uppercase'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                    >
                      {roadDisplayLabel}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })()}

        {/* ================= ROAD INTERSECTION JUNCTIONS (WHERE TWO ROADS MEET - MADYA LO LINES) ================= */}
        {/* South-West Junction */}
        {hasSouthRoad && hasWestRoad && (() => {
          const ptTop = { x: dx - roadStripDepth, y: dy + slopeDC * (-roadStripDepth) };
          const ptRight = { x: dx + invSlopeAD * roadStripDepth, y: dy + roadStripDepth };
          const outerCorner = { x: dx - roadStripDepth, y: dy + roadStripDepth + slopeDC * (-roadStripDepth) };
          return (
            <g id="junction-south-west">
              {/* Line separating West road continuation from South road */}
              <line
                x1={ptTop.x}
                y1={ptTop.y}
                x2={dx}
                y2={dy}
                stroke="#000000"
                strokeWidth="1.5"
              />
              {/* Line separating South road continuation from West road */}
              <line
                x1={dx}
                y1={dy}
                x2={ptRight.x}
                y2={ptRight.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
              {/* Middle diagonal miter line where two roads meet */}
              <line
                x1={dx}
                y1={dy}
                x2={outerCorner.x}
                y2={outerCorner.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
            </g>
          );
        })()}

        {/* South-East Junction */}
        {hasSouthRoad && hasEastRoad && (() => {
          const ptTop = { x: cx + roadStripDepth, y: cy + slopeDC * roadStripDepth };
          const ptLeft = { x: cx + invSlopeBC * roadStripDepth, y: cy + roadStripDepth };
          const outerCorner = { x: cx + roadStripDepth, y: cy + roadStripDepth + slopeDC * roadStripDepth };
          return (
            <g id="junction-south-east">
              <line
                x1={cx}
                y1={cy}
                x2={ptTop.x}
                y2={ptTop.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
              <line
                x1={cx}
                y1={cy}
                x2={ptLeft.x}
                y2={ptLeft.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
              {/* Middle diagonal miter line where two roads meet */}
              <line
                x1={cx}
                y1={cy}
                x2={outerCorner.x}
                y2={outerCorner.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
            </g>
          );
        })()}

        {/* North-West Junction */}
        {hasNorthRoad && hasWestRoad && (() => {
          const ptBottom = { x: ax - roadStripDepth, y: ay + slopeAB * (-roadStripDepth) };
          const ptRight = { x: ax - invSlopeAD * roadStripDepth, y: ay - roadStripDepth };
          const outerCorner = { x: ax - roadStripDepth, y: ay - roadStripDepth + slopeAB * (-roadStripDepth) };
          return (
            <g id="junction-north-west">
              <line
                x1={ptBottom.x}
                y1={ptBottom.y}
                x2={ax}
                y2={ay}
                stroke="#000000"
                strokeWidth="1.5"
              />
              <line
                x1={ax}
                y1={ay}
                x2={ptRight.x}
                y2={ptRight.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
              {/* Middle diagonal miter line where two roads meet */}
              <line
                x1={ax}
                y1={ay}
                x2={outerCorner.x}
                y2={outerCorner.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
            </g>
          );
        })()}

        {/* North-East Junction */}
        {hasNorthRoad && hasEastRoad && (() => {
          const ptBottom = { x: bx + roadStripDepth, y: by + slopeAB * roadStripDepth };
          const ptLeft = { x: bx - invSlopeBC * roadStripDepth, y: by - roadStripDepth };
          const outerCorner = { x: bx + roadStripDepth, y: by - roadStripDepth + slopeAB * roadStripDepth };
          return (
            <g id="junction-north-east">
              <line
                x1={bx}
                y1={by}
                x2={ptBottom.x}
                y2={ptBottom.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
              <line
                x1={bx}
                y1={by}
                x2={ptLeft.x}
                y2={ptLeft.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
              {/* Middle diagonal miter line where two roads meet */}
              <line
                x1={bx}
                y1={by}
                x2={outerCorner.x}
                y2={outerCorner.y}
                stroke="#000000"
                strokeWidth="1.5"
              />
            </g>
          );
        })()}

        {/* ================= PLOT POLYGON (AREA UNDER REGN) ================= */}
        {/* Solid light rose background */}
        <polygon
          points={polygonPoints}
          fill="#ffffff"
        />
        {/* Heavy Plot Border */}
        <polygon
          points={polygonPoints}
          fill="none"
          stroke="#000000"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Corner vertex labels A, B, C, D removed as requested */}

        {/* ================= HOUSE DRAWING & MEASUREMENTS IN MIDDLE OF PLOT ================= */}
        {isHouseActive && (
          <g id="house-drawing-group">
            {/* 1. Base White Foundation Slab (covers cadastral hatching) */}
            <rect
              id="house-foundation"
              x={hx1}
              y={hy1}
              width={housePxW}
              height={housePxH}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* 2. Masonry Inner Wall (Architectural double-line standard) */}
            <rect
              id="house-inner-wall"
              x={hx1 + 3.5}
              y={hy1 + 3.5}
              width={housePxW - 7}
              height={housePxH - 7}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="1.5"
            />

            {/* 3. Interior CAD Room Partitions */}
            <g id="house-partitions" opacity="0.65">
              {/* Horizontal room wall with door passage */}
              <line
                x1={hx1 + 3.5}
                y1={centerY}
                x2={centerX - 16}
                y2={centerY}
                stroke="#000000"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <line
                x1={centerX + 16}
                y1={centerY}
                x2={hx2 - 3.5}
                y2={centerY}
                stroke="#000000"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              {/* Vertical room wall with door passage */}
              <line
                x1={centerX}
                y1={hy1 + 3.5}
                x2={centerX}
                y2={centerY - 16}
                stroke="#000000"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <line
                x1={centerX}
                y1={centerY + 16}
                x2={centerX}
                y2={hy2 - 3.5}
                stroke="#000000"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            </g>

            {/* 4. Entrance Steps / Verandah on Road side (defaulting to South) */}
            {(() => {
              // Position entrance steps facing the road
              if (hasNorthRoad && !hasSouthRoad) {
                return (
                  <g id="house-entrance-north">
                    <rect
                      x={centerX - 16}
                      y={hy1 - 6}
                      width={32}
                      height={6}
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth="1.5"
                    />
                    <line x1={centerX - 12} y1={hy1 - 3} x2={centerX + 12} y2={hy1 - 3} stroke="#000000" strokeWidth="1.5" />
                    <text x={centerX} y={hy1 - 8} textAnchor="middle" style={T(7, 900, {letterSpacing: '0.025em'})}>
                      ENTRY
                    </text>
                  </g>
                );
              }
              // Default to South (or hasSouthRoad)
              return (
                <g id="house-entrance-south">
                  <rect
                    x={centerX - 16}
                    y={hy2}
                    width={32}
                    height={6}
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line x1={centerX - 12} y1={hy2 + 3} x2={centerX + 12} y2={hy2 + 3} stroke="#000000" strokeWidth="1.5" />
                  <text x={centerX} y={hy2 + 13} textAnchor="middle" style={T(7, 900, {letterSpacing: '0.025em'})}>
                    ENTRY
                  </text>
                </g>
              );
            })()}

            {/* 5. House Architectural Stamp / Identification Badge */}
            {(() => {
              const hBadgeScale = Math.min(1.0, Math.max(0.62, Math.min(housePxW / 120, housePxH / 65)));
              return (
                <g transform={`translate(${centerX}, ${centerY}) scale(${hBadgeScale})`}>
                  {/* Clean text backdrop without any border box */}
                  <rect
                    x="-50"
                    y="-18"
                    width="100"
                    height="36"
                    rx="2"
                    fill="#ffffff"
                    opacity="0.88"
                  />
                  <text
                    x="0"
                    y="-7"
                    textAnchor="middle"
                    style={T(9, 900, {letterSpacing: '0.025em'})}
                  >
                    {houseStructure}
                  </text>
                  <text
                    x="0"
                    y="5"
                    textAnchor="middle"
                    style={T(9.5, 800)}
                  >
                    {`${houseWDisplay} × ${houseLDisplay}`}
                  </text>
                  <text
                    x="0"
                    y="15"
                    textAnchor="middle"
                    style={T(8, 700)}
                  >
                    {`PLINTH: ${housePlinthSqFt} SQ.FT.`}
                  </text>
                </g>
              );
            })()}

            {/* 6. House Plinth Dimension Lines (Width & Length Measurements - NO rectangular box, NO lines as per plot rules) */}
            {showHouseDims && (
              <g id="house-plinth-dimensions">
                {/* --- Width Dimension Line (North of House) --- */}
                {(() => {
                  return (
                    <text
                      x={centerX}
                      y={hy1 + 10}
                      textAnchor="middle"
                      style={{ ...T(9, 800), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                    >
                      {houseWDisplay}
                    </text>
                  );
                })()}

                {/* --- Length Dimension Line (East of House) --- */}
                {(() => {
                  return (
                    <g transform={`rotate(-90, ${hx2 - 10}, ${centerY})`}>
                      <text
                        x={hx2 - 10}
                        y={centerY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ ...T(9, 800), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' } }}
                      >
                        {houseLDisplay}
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}

            {/* 7. Setback Open Yard Lines & Measurements (సందుల కొలతలు - NO rectangular box, NO lines) */}
            {showSetbacks && (
              <g id="house-setbacks-group">
                {/* Rear / North Setback */}
                {hy1 - (ay + by) / 2 > 16 && (
                  <g id="setback-north">
                    <text
                      x={centerX - housePxW * 0.28}
                      y={((ay + by) / 2 + hy1) / 2 + 3}
                      textAnchor="middle"
                      style={{ ...T(7.5, 700), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3.5px' } }}
                    >
                      {rearSetbackText}
                    </text>
                  </g>
                )}

                {/* Front / South Setback */}
                {(cy + dy) / 2 - hy2 > 16 && (
                  <g id="setback-south">
                    <text
                      x={centerX - housePxW * 0.28}
                      y={(hy2 + (cy + dy) / 2) / 2 + 3}
                      textAnchor="middle"
                      style={{ ...T(7.5, 700), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3.5px' } }}
                    >
                      {frontSetbackText}
                    </text>
                  </g>
                )}

                {/* West Setback */}
                {hx1 - (ax + dx) / 2 > 16 && (
                  <g id="setback-west">
                    <text
                      x={((ax + dx) / 2 + hx1) / 2}
                      y={centerY + housePxH * 0.26 + 3}
                      textAnchor="middle"
                      style={{ ...T(7.5, 700), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3.5px' } }}
                    >
                      {westSetbackText}
                    </text>
                  </g>
                )}

                {/* East Setback */}
                {(bx + cx) / 2 - hx2 > 16 && (
                  <g id="setback-east">
                    <text
                      x={(hx2 + (bx + cx) / 2) / 2}
                      y={centerY + housePxH * 0.26 + 3}
                      textAnchor="middle"
                      style={{ ...T(7.5, 700), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3.5px' } }}
                    >
                      {eastSetbackText}
                    </text>
                  </g>
                )}
              </g>
            )}
          </g>
        )}

        {/* ================= PLOT CENTER TEXT BADGE ================= */}
        {/* Auto-fits to plot dimensions; when house is active, positions safely in open yard */}
        {isHouseActive ? (
          (() => {
            const plotBadgeY = hasNorthRoad
              ? (hy2 + (cy + dy) / 2) / 2
              : ((ay + by) / 2 + hy1) / 2;
            const plotBadgeX = centerX + housePxW * 0.28;
            return (
              <g transform={`translate(${plotBadgeX}, ${plotBadgeY})`}>
                <rect
                  x="-62"
                  y="-11"
                  width="124"
                  height="22"
                  rx="3"
                  fill="#ffffff"
                  stroke="#000000"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  style={T(9, 900, {letterSpacing: '-0.025em'})}
                >
                  {hasArea ? `PLOT: ${property.areaSqYards} Sq.Yards` : 'AREA UNDER REGN.'}
                </text>
              </g>
            );
          })()
        ) : (
          <g transform={`translate(${centerX}, ${centerY}) scale(${badgeFitScale})`}>
            <rect
              x={-baseBadgeW / 2}
              y={-baseBadgeH / 2}
              width={baseBadgeW}
              height={baseBadgeH}
              rx={4 / badgeFitScale}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth={1.5 / badgeFitScale}
            />
            {hasArea ? (
              <>
                <text
                  x="0"
                  y="-4"
                  textAnchor="middle"
                  style={T(11, 900, {letterSpacing: '0.025em'})}
                >
                  AREA UNDER REGN.
                </text>
                <text
                  x="0"
                  y="13"
                  textAnchor="middle"
                  style={T(12, 800)}
                >
                  {`${property.areaSqYards} Sq.Yards`}
                </text>
              </>
            ) : (
              <text
                x="0"
                y="4"
                textAnchor="middle"
                style={T(11, 900, {letterSpacing: '0.025em'})}
              >
                AREA UNDER REGN.
              </text>
            )}
          </g>
        )}

        {/* ================= ALIGNED DIMENSION LINES & BOUNDARIES (MIDDLE OF LINE WITH SPACE, NO SQUARE DABBA) ================= */}

        {/* NORTH DIMENSION & BOUNDARY */}
        {(() => {
          const p1x = ax;
          const p1y = ay;
          const p2x = bx;
          const p2y = by;

          const midX = (p1x + p2x) / 2;
          const midY = (p1y + p2y) / 2;

          // Dimension text inside plot
          const dimX = midX + nABx * -16;
          const dimY = midY + nABy * -16;

          // Boundary text outside
          const boundX = midX + nABx * 16;
          const boundY = midY + nABy * 16;

          return (
            <g id="north-dim-and-boundary">
              {/* Aligned Dimension Text */}
              <g transform={`rotate(${angleAB}, ${dimX}, ${dimY})`}>
                <text
                  x={dimX}
                  y={dimY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ ...T(12, 900, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3.5px' } }}
                >
                  {nText}
                </text>
              </g>

              {/* Aligned North Boundary Text (Only if no road) */}
              {!hasNorthRoad && (
                <g transform={`rotate(${angleAB}, ${boundX}, ${boundY})`}>
                  {renderWrappedBoundaryText(northBoundary.trim() || 'ADJACENT PROPERTY', boundX, boundY, lenAB)}
                </g>
              )}
            </g>
          );
        })()}

        {/* SOUTH DIMENSION & BOUNDARY */}
        {(() => {
          const p1x = dx;
          const p1y = dy;
          const p2x = cx;
          const p2y = cy;

          const midX = (p1x + p2x) / 2;
          const midY = (p1y + p2y) / 2;

          // Dimension text inside plot
          const dimX = midX + nDCx * -16;
          const dimY = midY + nDCy * -16;

          // Boundary text outside
          const boundX = midX + nDCx * 16;
          const boundY = midY + nDCy * 16;

          return (
            <g id="south-dim-and-boundary">
              {/* Aligned Dimension Text */}
              <g transform={`rotate(${angleDC}, ${dimX}, ${dimY})`}>
                <text
                  x={dimX}
                  y={dimY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ ...T(12, 900, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3.5px' } }}
                >
                  {sText}
                </text>
              </g>

              {/* Aligned South Boundary Text (Only if no road) */}
              {!hasSouthRoad && (
                <g transform={`rotate(${angleDC}, ${boundX}, ${boundY})`}>
                  {renderWrappedBoundaryText(southBoundary.trim() || 'ADJACENT PROPERTY', boundX, boundY, lenDC)}
                </g>
              )}
            </g>
          );
        })()}

        {/* WEST DIMENSION & BOUNDARY */}
        {(() => {
          const p1x = ax;
          const p1y = ay;
          const p2x = dx;
          const p2y = dy;

          const midX = (p1x + p2x) / 2;
          const midY = (p1y + p2y) / 2;

          // Dimension text inside plot
          const dimX = midX + nADx * -16;
          const dimY = midY + nADy * -16;

          // Boundary text outside
          const boundX = midX + nADx * 16;
          const boundY = midY + nADy * 16;

          return (
            <g id="west-dim-and-boundary">
              {/* Aligned Dimension Text */}
              <g transform={`rotate(${angleAD}, ${dimX}, ${dimY})`}>
                <text
                  x={dimX}
                  y={dimY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ ...T(12, 900, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3.5px' } }}
                >
                  {wText}
                </text>
              </g>

              {/* Aligned West Boundary Text (Only if no road) */}
              {!hasWestRoad && (
                <g transform={`rotate(${angleAD}, ${boundX}, ${boundY})`}>
                  {renderWrappedBoundaryText(westBoundary.trim() || 'ADJACENT PROPERTY', boundX, boundY, lenAD)}
                </g>
              )}
            </g>
          );
        })()}

        {/* EAST DIMENSION & BOUNDARY */}
        {(() => {
          const p1x = bx;
          const p1y = by;
          const p2x = cx;
          const p2y = cy;

          const midX = (p1x + p2x) / 2;
          const midY = (p1y + p2y) / 2;

          // Dimension text inside plot
          const dimX = midX + nBCx * -16;
          const dimY = midY + nBCy * -16;

          // Boundary text outside
          const boundX = midX + nBCx * 16;
          const boundY = midY + nBCy * 16;

          return (
            <g id="east-dim-and-boundary">
              {/* Aligned Dimension Text */}
              <g transform={`rotate(${angleBC}, ${dimX}, ${dimY})`}>
                <text
                  x={dimX}
                  y={dimY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ ...T(12, 900, {letterSpacing: '0.025em'}), ...{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3.5px' } }}
                >
                  {eText}
                </text>
              </g>

              {/* Aligned East Boundary Text (Only if no road) */}
              {!hasEastRoad && (
                <g transform={`rotate(${angleBC}, ${boundX}, ${boundY})`}>
                  {renderWrappedBoundaryText(eastBoundary.trim() || 'ADJACENT PROPERTY', boundX, boundY, lenBC)}
                </g>
              )}
            </g>
          );
        })()}

        {/* ================= CORNER PROPERTY INDICATOR ================= */}
        {cornerProperty && (
          <g transform="translate(24, 30)">
            <rect
              x="0"
              y="0"
              width="108"
              height="20"
              rx="3"
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="1.5"
            />
            <text
              x="54"
              y="14"
              textAnchor="middle"
              style={T(9, 700, {letterSpacing: '0.025em'})}
            >
              ★ CORNER PROPERTY
            </text>
          </g>
        )}

        {/* Bottom corner cadastral notice */}
        <text
          x={30}
          y={viewBoxHeight - 34}
          style={T(8, 500, {fontStyle: 'italic'})}
        >
          * Plan Prepared for Registration Purpose (Not to Civil Scale)
        </text>
      </svg>
    </div>
  );
};
