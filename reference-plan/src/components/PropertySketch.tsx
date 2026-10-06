import React from 'react';
import { BoundaryDimensions, PropertyDetails, HouseDetails } from '../types';
import { formatDimensionDisplay, getRoadLabelForSide, parseDimensionToNumber, getUprightAngle, parseDimension } from '../utils/dimensionUtils';

interface PropertySketchProps {
  property: PropertyDetails;
  boundaries: BoundaryDimensions;
  isPrintMode?: boolean;
  className?: string;
  overlayImage?: string;
  overlayOpacity?: number;
  showOverlay?: boolean;
}

export const PropertySketch: React.FC<PropertySketchProps> = ({
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

  const getBoundaryLines = (text: string, maxLenPx: number): string[] => {
    if (!text) return [];
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
    return lines;
  };

  const isBoundaryBold = boundaries.boundaryFontWeight === 'bold';
  const mapRot = boundaries.mapRotation || 0;

  const renderBoundaryLines = (lines: string[], x: number, y: number) => {
    if (!lines || lines.length === 0) return null;
    const lineHeight = 12;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    return (
      <text
        textAnchor="middle"
        dominantBaseline="central"
        className={`text-[11px] ${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal uppercase`}
        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.5px' : '1.2px' }}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={x} y={startY + index * lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };

  // Raw or normalized values - parsed safely with full support for feet-inches like 68'-0"
  const isMeters = boundaries.dimensionUnit === 'Metres';
  const nVal = parseDimensionToNumber(northDim.raw || northDim.normalized, isMeters, 40);
  const sVal = parseDimensionToNumber(southDim.raw || southDim.normalized, isMeters, 40);
  const eVal = parseDimensionToNumber(eastDim.raw || eastDim.normalized, isMeters, 60);
  const wVal = parseDimensionToNumber(westDim.raw || westDim.normalized, isMeters, 60);

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
  const baseViewBoxHeight = 520;

  // Determine dynamic margins based on road strips and dimension lines so plot auto-fits nicely
  const topMargin = hasNorthRoad ? (isTJunction && effectiveTJunctionSide === 'North' ? 125 : 110) : 70;
  const bottomMargin = hasSouthRoad ? (isTJunction && effectiveTJunctionSide === 'South' ? 125 : 110) : 70;
  const leftMargin = hasWestRoad ? (isTJunction && effectiveTJunctionSide === 'West' ? 125 : 115) : 75;
  const rightMargin = hasEastRoad ? (isTJunction && effectiveTJunctionSide === 'East' ? 125 : 115) : 75;

  const availableW = viewBoxWidth - leftMargin - rightMargin;
  const availableH = baseViewBoxHeight - topMargin - bottomMargin;

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

  const rawScale = boundaries.sketchScale ?? 100;
  const sketchScaleFactor = Math.max(0.4, Math.min(2.0, rawScale / 100));

  // Dynamic Box Top & Bottom based on Map Scale:
  // Automatically adjust SVG viewBox height and top/bottom edges so the box hugs the map perfectly.
  const nominalContentH = availableH;
  const scaledContentH = nominalContentH * sketchScaleFactor;
  const effectiveBoxHeight = Math.round(topMargin + bottomMargin + scaledContentH);
  const minY = Math.round(centerY - (scaledContentH / 2) - topMargin);

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

  // Minimum plot width and height for house geometry
  const minPlotW = Math.min(scaledNW, scaledSW);
  const minPlotH = Math.min(scaledEH, scaledWH);

  // Format dimensions for display
  const nText = formatDimensionDisplay(northDim) || `${nVal}'`;
  const sText = formatDimensionDisplay(southDim) || `${sVal}'`;
  const eText = formatDimensionDisplay(eastDim) || `${eVal}'`;
  const wText = formatDimensionDisplay(westDim) || `${wVal}'`;

  // ================= HOUSE DETAILS & GEOMETRY =================
  const housesList: HouseDetails[] = property.houses && property.houses.length > 0
    ? property.houses
    : (property.house ? [property.house] : []);

  const activeHouses = housesList.filter(h => h.enabled !== false);
  const isHouseActive = (property.propertyType === 'House' || activeHouses.length > 0) && property.propertyType !== 'Demolished House';

  const parseDimensionValue = (val: string | number | undefined, isMetersVal: boolean, fallback: number): number => {
    return parseDimensionToNumber(val, isMetersVal, fallback);
  };

  const avgPlotW = (nVal + sVal) / 2;
  const avgPlotL = (eVal + wVal) / 2;

  // Plot midpoints and span in SVG pixels
  const plotNorthY = (ay + by) / 2;
  const plotSouthY = (cy + dy) / 2;
  const plotWestX = (ax + dx) / 2;
  const plotEastX = (bx + cx) / 2;
  const plotSpanW = Math.max(30, plotEastX - plotWestX);
  const plotSpanH = Math.max(30, plotSouthY - plotNorthY);

  // Exact boundary edge coordinates for any given point on the plot polygon
  const getNorthBoundaryY = (x: number): number => {
    const minX = Math.min(ax, bx);
    const maxX = Math.max(ax, bx);
    if (maxX === minX) return (ay + by) / 2;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    return ay + ((clampedX - ax) / (bx - ax)) * (by - ay);
  };

  const getSouthBoundaryY = (x: number): number => {
    const minX = Math.min(dx, cx);
    const maxX = Math.max(dx, cx);
    if (maxX === minX) return (dy + cy) / 2;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    return dy + ((clampedX - dx) / (cx - dx)) * (cy - dy);
  };

  const getWestBoundaryX = (y: number): number => {
    const minY = Math.min(ay, dy);
    const maxY = Math.max(ay, dy);
    if (maxY === minY) return (ax + dx) / 2;
    const clampedY = Math.max(minY, Math.min(maxY, y));
    return ax + ((clampedY - ay) / (dy - ay)) * (dx - ax);
  };

  const getEastBoundaryX = (y: number): number => {
    const minY = Math.min(by, cy);
    const maxY = Math.max(by, cy);
    if (maxY === minY) return (bx + cx) / 2;
    const clampedY = Math.max(minY, Math.min(maxY, y));
    return bx + ((clampedY - by) / (cy - by)) * (cx - bx);
  };

  // Keep house safely inside plot boundary edges with minimum clearance
  const BOUNDARY_PADDING = Math.min(14, Math.max(8, Math.min(plotSpanW, plotSpanH) * 0.05));
  const safeMinX = Math.max(ax, dx) + BOUNDARY_PADDING;
  const safeMaxX = Math.min(bx, cx) - BOUNDARY_PADDING;
  const safeMinY = Math.max(ay, by) + BOUNDARY_PADDING;
  const safeMaxY = Math.min(dy, cy) - BOUNDARY_PADDING;
  const availW = Math.max(30, safeMaxX - safeMinX);
  const availH = Math.max(30, safeMaxY - safeMinY);

  interface RenderedHouse {
    id: string;
    name: string;
    structureType: string;
    hx1: number;
    hx2: number;
    hy1: number;
    hy2: number;
    housePxW: number;
    housePxH: number;
    hCenterX: number;
    hCenterY: number;
    houseWDisplay: string;
    houseLDisplay: string;
    houseWFeet: number;
    houseLFeet: number;
    showHouseDims: boolean;
    showSetbacks: boolean;
    rearSetbackText: string;
    frontSetbackText: string;
    westSetbackText: string;
    eastSetbackText: string;
    canShowNorthSetback: boolean;
    northPosX: number;
    northPlotEdgeY: number;
    northSetbackY: number;
    canShowSouthSetback: boolean;
    southPosX: number;
    southPlotEdgeY: number;
    southSetbackY: number;
    canShowWestSetback: boolean;
    westPosY: number;
    westPlotEdgeX: number;
    westSetbackX: number;
    canShowEastSetback: boolean;
    eastPosY: number;
    eastPlotEdgeX: number;
    eastSetbackX: number;
    canProtrudeNorthEntry: boolean;
    canProtrudeSouthEntry: boolean;
  }

  const renderedHouses: RenderedHouse[] = [];

  for (let idx = 0; idx < activeHouses.length; idx++) {
    const houseData = activeHouses[idx];
    const isSingle = activeHouses.length === 1;
    const defaultHouseW = Math.max(isMeters ? 3 : 10, Math.round(avgPlotW * (isSingle ? 0.62 : 0.38)));
    const defaultHouseL = Math.max(isMeters ? 3.6 : 12, Math.round(avgPlotL * (isSingle ? 0.60 : 0.40)));

    const houseWFeet = parseDimensionValue(houseData.widthRaw ?? houseData.widthFeet, isMeters, defaultHouseW);
    const houseLFeet = parseDimensionValue(houseData.lengthRaw ?? houseData.lengthFeet, isMeters, defaultHouseL);

    const houseStructure = (houseData.structureType || houseData.roofType || 'R.C.C. Roof House').toUpperCase();
    
    // Omit generic Structure-1, Structure-2, House 1, House 2, Main House etc. - show roof/structure type directly
    const isGenericStructureName = (str?: string): boolean => {
      if (!str) return true;
      const t = str.trim();
      return !t || /^(structure|house|bldg|building)[\s#\-_]*\d*$/i.test(t) || /^main\s*house$/i.test(t);
    };
    const houseName = isGenericStructureName(houseData.name) ? '' : houseData.name!.trim().toUpperCase();

    const sbNorthFt = houseData.setbackNorth ? parseDimensionValue(houseData.setbackNorth, isMeters, -1) : -1;
    const sbSouthFt = houseData.setbackSouth ? parseDimensionValue(houseData.setbackSouth, isMeters, -1) : -1;
    const sbWestFt = houseData.setbackWest ? parseDimensionValue(houseData.setbackWest, isMeters, -1) : -1;
    const sbEastFt = houseData.setbackEast ? parseDimensionValue(houseData.setbackEast, isMeters, -1) : -1;

    // EXACT GIVEN DIMENSIONS IN SVG PIXELS (ACCURATE TO USER'S GIVEN MEASUREMENTS)
    const exactHousePxW = houseWFeet * scale;
    const exactHousePxH = houseLFeet * scale;

    let hx1: number;
    let hx2: number;
    let hy1: number;
    let hy2: number;

    const nominalW = Math.max(20, Math.min(exactHousePxW, Math.max(20, availW - 4)));
    const nominalH = Math.max(20, Math.min(exactHousePxH, Math.max(20, availH - 4)));

    if (idx === 0) {
      // Primary / Main House positioning
      // 1. Horizontal Span (West to East) positioning
      if (sbWestFt >= 0 && sbEastFt >= 0) {
        const totalSbFt = sbWestFt + sbEastFt;
        const westRatio = totalSbFt > 0 ? (sbWestFt / totalSbFt) : 0.5;
        const remSpaceX = Math.max(0, plotSpanW - nominalW);
        hx1 = plotWestX + remSpaceX * westRatio;
        hx2 = hx1 + nominalW;
      } else if (sbWestFt >= 0) {
        hx1 = plotWestX + (sbWestFt * scale);
        hx2 = hx1 + nominalW;
      } else if (sbEastFt >= 0) {
        hx2 = plotEastX - (sbEastFt * scale);
        hx1 = hx2 - nominalW;
      } else {
        hx1 = centerX - nominalW / 2;
        hx2 = hx1 + nominalW;
      }

      // 2. Vertical Span (North to South) positioning
      if (sbNorthFt >= 0 && sbSouthFt >= 0) {
        const totalSbFt = sbNorthFt + sbSouthFt;
        const northRatio = totalSbFt > 0 ? (sbNorthFt / totalSbFt) : 0.5;
        const remSpaceY = Math.max(0, plotSpanH - nominalH);
        hy1 = plotNorthY + remSpaceY * northRatio;
        hy2 = hy1 + nominalH;
      } else if (sbNorthFt >= 0) {
        hy1 = plotNorthY + (sbNorthFt * scale);
        hy2 = hy1 + nominalH;
      } else if (sbSouthFt >= 0) {
        hy2 = plotSouthY - (sbSouthFt * scale);
        hy1 = hy2 - nominalH;
      } else {
        hy1 = centerY - nominalH / 2;
        hy2 = hy1 + nominalH;
      }
    } else {
      // Secondary House / Shed / Out-House relative to Main House or Plot
      const pos = houseData.position || (idx === 1 ? 'attached-east' : 'attached-west');
      const mainHouse = renderedHouses[0] || {
        hx1: centerX - nominalW,
        hx2: centerX + nominalW,
        hy1: centerY - nominalH,
        hy2: centerY + nominalH,
        hCenterX: centerX,
        hCenterY: centerY,
      };

      if (pos === 'attached-center') {
        // Placed in Middle / Inside Main House (e.g. Courtyard or Central Block)
        hx1 = mainHouse.hCenterX - nominalW / 2;
        hx2 = hx1 + nominalW;
        hy1 = mainHouse.hCenterY - nominalH / 2;
        hy2 = hy1 + nominalH;
      } else if (pos === 'attached-west') {
        // Attached to Left / West side of Main House (centered vertically)
        hx2 = mainHouse.hx1;
        hx1 = hx2 - nominalW;
        hy1 = mainHouse.hCenterY - nominalH / 2;
        hy2 = hy1 + nominalH;
      } else if (pos === 'attached-east') {
        // Attached to Right / East side of Main House (centered vertically)
        hx1 = mainHouse.hx2;
        hx2 = hx1 + nominalW;
        hy1 = mainHouse.hCenterY - nominalH / 2;
        hy2 = hy1 + nominalH;
      } else if (pos === 'attached-north') {
        // Attached to Rear / North side of Main House (centered horizontally)
        hy2 = mainHouse.hy1;
        hy1 = hy2 - nominalH;
        hx1 = mainHouse.hCenterX - nominalW / 2;
        hx2 = hx1 + nominalW;
      } else if (pos === 'attached-south') {
        // Attached to Front / South side of Main House (centered horizontally)
        hy1 = mainHouse.hy2;
        hy2 = hy1 + nominalH;
        hx1 = mainHouse.hCenterX - nominalW / 2;
        hx2 = hx1 + nominalW;
      } else if (pos === 'attached-nw-corner') {
        // Attached to North-West Corner of Main House (touching top-left)
        hx2 = mainHouse.hx1;
        hx1 = hx2 - nominalW;
        hy1 = mainHouse.hy1;
        hy2 = hy1 + nominalH;
      } else if (pos === 'attached-ne-corner') {
        // Attached to North-East Corner of Main House (touching top-right)
        hx1 = mainHouse.hx2;
        hx2 = hx1 + nominalW;
        hy1 = mainHouse.hy1;
        hy2 = hy1 + nominalH;
      } else if (pos === 'attached-sw-corner') {
        // Attached to South-West Corner of Main House (touching bottom-left)
        hx2 = mainHouse.hx1;
        hx1 = hx2 - nominalW;
        hy2 = mainHouse.hy2;
        hy1 = hy2 - nominalH;
      } else if (pos === 'attached-se-corner') {
        // Attached to South-East Corner of Main House (touching bottom-right)
        hx1 = mainHouse.hx2;
        hx2 = hx1 + nominalW;
        hy2 = mainHouse.hy2;
        hy1 = hy2 - nominalH;
      } else if (pos === 'west') {
        hx1 = safeMinX + 10;
        hx2 = hx1 + nominalW;
        hy1 = centerY - nominalH / 2;
        hy2 = hy1 + nominalH;
      } else if (pos === 'east') {
        hx2 = safeMaxX - 10;
        hx1 = hx2 - nominalW;
        hy1 = centerY - nominalH / 2;
        hy2 = hy1 + nominalH;
      } else if (pos === 'north') {
        hx1 = centerX - nominalW / 2;
        hx2 = hx1 + nominalW;
        hy1 = safeMinY + 10;
        hy2 = hy1 + nominalH;
      } else if (pos === 'south') {
        hx1 = centerX - nominalW / 2;
        hx2 = hx1 + nominalW;
        hy2 = safeMaxY - 10;
        hy1 = hy2 - nominalH;
      } else if (pos === 'north-west') {
        hx1 = safeMinX + 10;
        hx2 = hx1 + nominalW;
        hy1 = safeMinY + 10;
        hy2 = hy1 + nominalH;
      } else if (pos === 'north-east') {
        hx2 = safeMaxX - 10;
        hx1 = hx2 - nominalW;
        hy1 = safeMinY + 10;
        hy2 = hy1 + nominalH;
      } else if (pos === 'south-west') {
        hx1 = safeMinX + 10;
        hx2 = hx1 + nominalW;
        hy2 = safeMaxY - 10;
        hy1 = hy2 - nominalH;
      } else if (pos === 'south-east') {
        hx2 = safeMaxX - 10;
        hx1 = hx2 - nominalW;
        hy2 = safeMaxY - 10;
        hy1 = hy2 - nominalH;
      } else if (pos === 'center') {
        hx1 = centerX - nominalW / 2;
        hx2 = hx1 + nominalW;
        hy1 = centerY - nominalH / 2;
        hy2 = hy1 + nominalH;
      } else {
        // Custom or setback fallback
        if (sbWestFt >= 0) {
          hx1 = plotWestX + (sbWestFt * scale);
          hx2 = hx1 + nominalW;
        } else if (sbEastFt >= 0) {
          hx2 = plotEastX - (sbEastFt * scale);
          hx1 = hx2 - nominalW;
        } else {
          hx1 = centerX - nominalW / 2;
          hx2 = hx1 + nominalW;
        }
        if (sbNorthFt >= 0) {
          hy1 = plotNorthY + (sbNorthFt * scale);
          hy2 = hy1 + nominalH;
        } else if (sbSouthFt >= 0) {
          hy2 = plotSouthY - (sbSouthFt * scale);
          hy1 = hy2 - nominalH;
        } else {
          hy1 = centerY - nominalH / 2;
          hy2 = hy1 + nominalH;
        }
      }
    }

    // STRICT CONFINEMENT: Shift house rectangle as a unit to preserve EXACT width and length
    const houseW = hx2 - hx1;
    const houseH = hy2 - hy1;

    if (hx1 < safeMinX) {
      hx1 = safeMinX;
      hx2 = hx1 + houseW;
    }
    if (hx2 > safeMaxX) {
      hx2 = safeMaxX;
      hx1 = Math.max(safeMinX, hx2 - houseW);
    }
    if (hy1 < safeMinY) {
      hy1 = safeMinY;
      hy2 = hy1 + houseH;
    }
    if (hy2 > safeMaxY) {
      hy2 = safeMaxY;
      hy1 = Math.max(safeMinY, hy2 - houseH);
    }

    // Strict polygon edge enforcement against actual boundary line functions
    for (let iter = 0; iter < 3; iter++) {
      const topLimit = Math.max(getNorthBoundaryY(hx1), getNorthBoundaryY(hx2)) + BOUNDARY_PADDING;
      if (hy1 < topLimit) {
        const d = topLimit - hy1;
        hy1 += d;
        hy2 += d;
      }
      const btmLimit = Math.min(getSouthBoundaryY(hx1), getSouthBoundaryY(hx2)) - BOUNDARY_PADDING;
      if (hy2 > btmLimit) {
        const d = hy2 - btmLimit;
        hy2 -= d;
        hy1 -= d;
      }
      const leftLimit = Math.max(getWestBoundaryX(hy1), getWestBoundaryX(hy2)) + BOUNDARY_PADDING;
      if (hx1 < leftLimit) {
        const d = leftLimit - hx1;
        hx1 += d;
        hx2 += d;
      }
      const rightLimit = Math.min(getEastBoundaryX(hy1), getEastBoundaryX(hy2)) - BOUNDARY_PADDING;
      if (hx2 > rightLimit) {
        const d = hx2 - rightLimit;
        hx2 -= d;
        hx1 -= d;
      }
      const currentMaxW = Math.max(20, rightLimit - leftLimit);
      if (hx2 - hx1 > currentMaxW) {
        hx1 = leftLimit;
        hx2 = leftLimit + currentMaxW;
      }
      const currentMaxH = Math.max(20, btmLimit - topLimit);
      if (hy2 - hy1 > currentMaxH) {
        hy1 = topLimit;
        hy2 = topLimit + currentMaxH;
      }
    }

    const housePxW = Math.max(20, Math.round(hx2 - hx1));
    const housePxH = Math.max(20, Math.round(hy2 - hy1));
    hx2 = hx1 + housePxW;
    hy2 = hy1 + housePxH;
    const hCenterX = (hx1 + hx2) / 2;
    const hCenterY = (hy1 + hy2) / 2;

    const formatHouseMeasurement = (raw?: string, numFeet?: number): string => {
      if (raw && raw.trim()) {
        const trimmed = raw.trim();
        if (isMeters) {
          return trimmed.toLowerCase().includes('m') ? trimmed : `${trimmed} m`;
        }
        if (trimmed.includes("'") || trimmed.includes('"')) {
          return trimmed;
        }
        const parsed = parseDimension(trimmed, 'Feet');
        if (parsed.normalized > 0) {
          const totalInches = Math.round(parsed.normalized * 12);
          const ft = Math.floor(totalInches / 12);
          const inch = totalInches % 12;
          return inch > 0 ? `${ft}'-${inch}"` : `${ft}'-0"`;
        }
        const val = parseFloat(trimmed);
        if (!isNaN(val) && val > 0) {
          const ft = Math.floor(val);
          const inch = Math.round((val - ft) * 12);
          return inch > 0 ? `${ft}'-${inch}"` : `${ft}'-0"`;
        }
        return trimmed;
      }
      if (typeof numFeet === 'number' && numFeet > 0) {
        if (isMeters) return `${Math.round(numFeet * 100) / 100} m`;
        const totalInches = Math.round(numFeet * 12);
        const ft = Math.floor(totalInches / 12);
        const inch = totalInches % 12;
        return inch > 0 ? `${ft}'-${inch}"` : `${ft}'-0"`;
      }
      return isMeters ? '0 m' : '0\'-0"';
    };

    const formatSetbackText = (raw?: string, autoFt?: number): string => {
      if (raw && raw.trim()) {
        const trimmed = raw.trim();
        if (isMeters) {
          return trimmed.toLowerCase().includes('m') ? trimmed : `${trimmed} m`;
        }
        if (trimmed.includes("'") || trimmed.includes('"')) {
          return trimmed;
        }
        const parsed = parseDimension(trimmed, 'Feet');
        if (parsed.normalized > 0) {
          const totalInches = Math.round(parsed.normalized * 12);
          const ft = Math.floor(totalInches / 12);
          const inch = totalInches % 12;
          return inch > 0 ? `${ft}'-${inch}"` : `${ft}'-0"`;
        }
        return trimmed;
      }
      if (typeof autoFt === 'number' && autoFt > 0) {
        if (isMeters) return `${Math.max(0.5, Math.round(autoFt * 10) / 10)} m`;
        const totalInches = Math.round(autoFt * 12);
        const ft = Math.floor(totalInches / 12);
        const inch = totalInches % 12;
        return inch > 0 ? `${ft}'-${inch}"` : `${ft}'-0"`;
      }
      return isMeters ? '0 m' : '0\'-0"';
    };

    const houseWDisplay = formatHouseMeasurement(houseData.widthRaw, houseWFeet);
    const houseLDisplay = formatHouseMeasurement(houseData.lengthRaw, houseLFeet);

    const showHouseDims = houseData.showMeasurements !== false;
    const showSetbacks = houseData.showSetbacks === true || (isSingle && houseData.showSetbacks !== false);

    // Only show setbacks that have been explicitly entered by the user
    const hasNorthSetbackEntered = Boolean(houseData.setbackNorth && houseData.setbackNorth.trim().length > 0);
    const hasSouthSetbackEntered = Boolean(houseData.setbackSouth && houseData.setbackSouth.trim().length > 0);
    const hasWestSetbackEntered = Boolean(houseData.setbackWest && houseData.setbackWest.trim().length > 0);
    const hasEastSetbackEntered = Boolean(houseData.setbackEast && houseData.setbackEast.trim().length > 0);

    const rearSetbackText = formatSetbackText(houseData.setbackNorth, Math.max(0.5, (hy1 - plotNorthY) / scale));
    const frontSetbackText = formatSetbackText(houseData.setbackSouth, Math.max(0.5, (plotSouthY - hy2) / scale));
    const westSetbackText = formatSetbackText(houseData.setbackWest, Math.max(0.5, (hx1 - plotWestX) / scale));
    const eastSetbackText = formatSetbackText(houseData.setbackEast, Math.max(0.5, (plotEastX - hx2) / scale));

    // Auto-adjust setback coordinates to prevent collision with centered plot dimensions and house walls
    const northPosX = hCenterX - Math.min(32, Math.max(18, housePxW * 0.24));
    const northPlotEdgeY = getNorthBoundaryY(northPosX);
    const clearanceN = hy1 - northPlotEdgeY;
    const canShowNorthSetback = hasNorthSetbackEntered && clearanceN >= 4;
    // When clearance is comfortable, place setback label slightly towards house so top edge is fully free for plot dimension
    const northSetbackY = clearanceN >= 24
      ? (northPlotEdgeY + 14 + hy1) / 2
      : (northPlotEdgeY + hy1) / 2;

    const southPosX = hCenterX - Math.min(32, Math.max(18, housePxW * 0.24));
    const southPlotEdgeY = getSouthBoundaryY(southPosX);
    const clearanceS = southPlotEdgeY - hy2;
    const canShowSouthSetback = hasSouthSetbackEntered && clearanceS >= 4;
    // When clearance is comfortable, place setback label slightly towards house so bottom edge is fully free for plot dimension
    const southSetbackY = clearanceS >= 24
      ? (hy2 + southPlotEdgeY - 14) / 2
      : (hy2 + southPlotEdgeY) / 2;

    const westPosY = hCenterY + Math.min(28, Math.max(16, housePxH * 0.22));
    const westPlotEdgeX = getWestBoundaryX(westPosY);
    const clearanceW = hx1 - westPlotEdgeX;
    const canShowWestSetback = hasWestSetbackEntered && clearanceW >= 4;
    const westSetbackX = clearanceW >= 24
      ? (westPlotEdgeX + 14 + hx1) / 2
      : (westPlotEdgeX + hx1) / 2;

    const eastPosY = hCenterY + Math.min(28, Math.max(16, housePxH * 0.22));
    const eastPlotEdgeX = getEastBoundaryX(eastPosY);
    const clearanceE = eastPlotEdgeX - hx2;
    const canShowEastSetback = hasEastSetbackEntered && clearanceE >= 4;
    const eastSetbackX = clearanceE >= 24
      ? (hx2 + eastPlotEdgeX - 14) / 2
      : (hx2 + eastPlotEdgeX) / 2;

    const canProtrudeNorthEntry = clearanceN >= 14;
    const canProtrudeSouthEntry = clearanceS >= 14;

    renderedHouses.push({
      id: houseData.id || `house-${idx}`,
      name: houseName,
      structureType: houseStructure,
      hx1,
      hx2,
      hy1,
      hy2,
      housePxW,
      housePxH,
      hCenterX,
      hCenterY,
      houseWDisplay,
      houseLDisplay,
      houseWFeet,
      houseLFeet,
      showHouseDims,
      showSetbacks,
      rearSetbackText,
      frontSetbackText,
      westSetbackText,
      eastSetbackText,
      canShowNorthSetback,
      northPosX,
      northPlotEdgeY,
      northSetbackY,
      canShowSouthSetback,
      southPosX,
      southPlotEdgeY,
      southSetbackY,
      canShowWestSetback,
      westPosY,
      westPlotEdgeX,
      westSetbackX,
      canShowEastSetback,
      eastPosY,
      eastPlotEdgeX,
      eastSetbackX,
      canProtrudeNorthEntry,
      canProtrudeSouthEntry,
    });
  }

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox={`0 ${minY} ${viewBoxWidth} ${effectiveBoxHeight}`}
        className="w-full h-auto max-w-full bg-white border border-slate-300 print:border-slate-800 shadow-xs transition-[aspect-ratio] duration-200"
        style={{ aspectRatio: `${viewBoxWidth} / ${effectiveBoxHeight}` }}
      >
        <defs>
          {/* Official Cadastral Red Diagonal Hatching for AREA UNDER REGN */}
          <pattern
            id="regnHatch"
            width="12"
            height="12"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="12"
              stroke="#000000"
              strokeWidth="1.5"
              strokeOpacity="0.4"
            />
          </pattern>

          {/* Dimension arrow markers */}
          <marker
            id="arrowStart"
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
            id="arrowEnd"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#000000" />
          </marker>

          {/* Strict ClipPath: Guarantees houses and measurements never cross plot boundaries */}
          <clipPath id="plot-boundary-house-clip">
            <polygon points={polygonPoints} />
          </clipPath>
        </defs>

        {/* Tracing Overlay: Uploaded Hand-Drawn Sketch (Same to Same Tracing Mode) */}
        {showOverlay && overlayImage && (
          <g id="manual-sketch-overlay" opacity={overlayOpacity}>
            <image
              href={overlayImage}
              x="16"
              y={minY + 16}
              width={viewBoxWidth - 32}
              height={effectiveBoxHeight - 32}
              preserveAspectRatio="xMidYMid meet"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        )}

        {/* Outer Cadastral Border Frame */}

        {/* ================= NORTH ARROW (COMPASS / SURVEY SYMBOL) ================= */}
        <g id="sketch-north-compass" transform={`translate(${viewBoxWidth - 70}, ${minY + (hasNorthRoad ? 75 : 60)})`}>
          <g transform={`rotate(${boundaries.northRotation || 0})`}>
            {(() => {
              const style = boundaries.northSymbolStyle || 'cadastral';

              if (style === 'compass') {
                // 8-Point Cadastral Compass Rose
                return (
                  <g id="north-symbol-compass">
                    <circle cx="0" cy="0" r="28" fill="#ffffff" stroke="#000000" strokeWidth="1.8" />
                    <circle cx="0" cy="0" r="24.5" fill="none" stroke="#000000" strokeWidth="0.8" />
                    <circle cx="0" cy="0" r="23" fill="none" stroke="#64748b" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
                    
                    {/* Cardinal & Intermediate Ticks */}
                    <line x1="0" y1="-24.5" x2="0" y2="-20.5" stroke="#000000" strokeWidth="1.5" />
                    <line x1="0" y1="24.5" x2="0" y2="20.5" stroke="#000000" strokeWidth="1.5" />
                    <line x1="24.5" y1="0" x2="20.5" y2="0" stroke="#000000" strokeWidth="1.5" />
                    <line x1="-24.5" y1="0" x2="-20.5" y2="0" stroke="#000000" strokeWidth="1.5" />
                    <line x1="16.9" y1="-16.9" x2="14.2" y2="-14.2" stroke="#000000" strokeWidth="0.9" />
                    <line x1="-16.9" y1="-16.9" x2="-14.2" y2="-14.2" stroke="#000000" strokeWidth="0.9" />
                    <line x1="16.9" y1="16.9" x2="14.2" y2="14.2" stroke="#000000" strokeWidth="0.9" />
                    <line x1="-16.9" y1="16.9" x2="-14.2" y2="14.2" stroke="#000000" strokeWidth="0.9" />

                    {/* 4 Corner points */}
                    <polygon points="13,-13 2.5,-0.5 0.5,-2.5" fill="#000000" />
                    <polygon points="13,-13 0.5,-2.5 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.5" />
                    <polygon points="-13,-13 -0.5,-2.5 -2.5,-0.5" fill="#000000" />
                    <polygon points="-13,-13 -2.5,-0.5 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.5" />
                    <polygon points="13,13 0.5,2.5 2.5,0.5" fill="#000000" />
                    <polygon points="13,13 2.5,0.5 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.5" />
                    <polygon points="-13,13 -2.5,0.5 -0.5,2.5" fill="#000000" />
                    <polygon points="-13,13 -0.5,2.5 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.5" />

                    {/* Major 4 Points */}
                    {/* North Spear */}
                    <polygon points="0,-21 -5.5,-3 0,0" fill="#000000" stroke="#000000" strokeWidth="0.6" strokeLinejoin="round" />
                    <polygon points="0,-21 5.5,-3 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.8" strokeLinejoin="round" />
                    {/* South Point */}
                    <polygon points="0,17 -4,2.5 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.8" strokeLinejoin="round" />
                    <polygon points="0,17 4,2.5 0,0" fill="#000000" stroke="#000000" strokeWidth="0.6" strokeLinejoin="round" />
                    {/* East Point */}
                    <polygon points="17,0 2.5,4 0,0" fill="#000000" stroke="#000000" strokeWidth="0.6" strokeLinejoin="round" />
                    <polygon points="17,0 2.5,-4 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.8" strokeLinejoin="round" />
                    {/* West Point */}
                    <polygon points="-17,0 -2.5,-4 0,0" fill="#000000" stroke="#000000" strokeWidth="0.6" strokeLinejoin="round" />
                    <polygon points="-17,0 -2.5,4 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.8" strokeLinejoin="round" />

                    {/* Center Eyelet */}
                    <circle cx="0" cy="0" r="2.8" fill="#ffffff" stroke="#000000" strokeWidth="1.2" />
                    <circle cx="0" cy="0" r="1.2" fill="#000000" />

                    {/* North 'N' */}
                    <text
                      x="0"
                      y="-33"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[12px] font-black fill-black select-none tracking-normal"
                      style={{ fontFamily: 'sans-serif', paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}
                    >
                      N
                    </text>
                  </g>
                );
              }

              if (style === 'architectural') {
                // Classic Vertical AutoCAD Deed Survey Arrow
                return (
                  <g id="north-symbol-architectural">
                    {/* Outer frame circle */}
                    <circle cx="0" cy="0" r="28" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                    <circle cx="0" cy="0" r="25" fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
                    
                    {/* Arrow Shaft */}
                    <line x1="0" y1="21" x2="0" y2="-12" stroke="#000000" strokeWidth="2" />
                    <line x1="-7" y1="21" x2="7" y2="21" stroke="#000000" strokeWidth="1.5" />
                    <line x1="-4" y1="16" x2="4" y2="16" stroke="#000000" strokeWidth="1.2" />

                    {/* Broad Split Arrowhead */}
                    <polygon points="0,-22 -7,-8 0,-12" fill="#000000" stroke="#000000" strokeWidth="0.6" strokeLinejoin="round" />
                    <polygon points="0,-22 7,-8 0,-12" fill="#ffffff" stroke="#000000" strokeWidth="1.2" strokeLinejoin="round" />

                    {/* Center Cross Line */}
                    <line x1="-12" y1="0" x2="12" y2="0" stroke="#000000" strokeWidth="1" />

                    {/* North 'N' in top badge */}
                    <rect x="-7" y="-39" width="14" height="13" rx="2" fill="#ffffff" stroke="#000000" strokeWidth="1.2" />
                    <text
                      x="0"
                      y="-32"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[11px] font-black fill-black select-none"
                      style={{ fontFamily: 'sans-serif' }}
                    >
                      N
                    </text>
                  </g>
                );
              }

              if (style === 'minimal') {
                // Modern Clean CAD Ring Pointer
                return (
                  <g id="north-symbol-minimal">
                    <circle cx="0" cy="0" r="26" fill="#ffffff" stroke="#000000" strokeWidth="2" />
                    {/* Large Bold Pointer Wedge */}
                    <polygon points="0,-21 -8,-4 8,-4" fill="#000000" stroke="#000000" strokeWidth="0.8" />
                    <line x1="0" y1="-4" x2="0" y2="20" stroke="#000000" strokeWidth="1.8" />
                    <line x1="-12" y1="0" x2="12" y2="0" stroke="#000000" strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx="0" cy="0" r="3" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                    <text
                      x="0"
                      y="-33"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[12px] font-black fill-black select-none"
                      style={{ fontFamily: 'sans-serif', paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}
                    >
                      N
                    </text>
                  </g>
                );
              }

              // Default: 'cadastral' (Standard Indian Deed Plan Survey Arrow - Crisp & Authentic)
              return (
                <g id="north-symbol-cadastral">
                  {/* Outer Circular Dial */}
                  <circle cx="0" cy="0" r="28" fill="#ffffff" stroke="#000000" strokeWidth="1.8" />
                  <circle cx="0" cy="0" r="24.5" fill="none" stroke="#000000" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="23" fill="none" stroke="#000000" strokeWidth="0.4" strokeDasharray="1 1.5" />
                  
                  {/* Cardinal Ticks */}
                  <line x1="0" y1="-24.5" x2="0" y2="-20.5" stroke="#000000" strokeWidth="1.6" />
                  <line x1="0" y1="24.5" x2="0" y2="20.5" stroke="#000000" strokeWidth="1.6" />
                  <line x1="24.5" y1="0" x2="20.5" y2="0" stroke="#000000" strokeWidth="1.6" />
                  <line x1="-24.5" y1="0" x2="-20.5" y2="0" stroke="#000000" strokeWidth="1.6" />

                  {/* 45-degree angle tick marks */}
                  <line x1="16.9" y1="-16.9" x2="14.5" y2="-14.5" stroke="#000000" strokeWidth="0.8" />
                  <line x1="-16.9" y1="-16.9" x2="-14.5" y2="-14.5" stroke="#000000" strokeWidth="0.8" />
                  <line x1="16.9" y1="16.9" x2="14.5" y2="14.5" stroke="#000000" strokeWidth="0.8" />
                  <line x1="-16.9" y1="16.9" x2="-14.5" y2="14.5" stroke="#000000" strokeWidth="0.8" />

                  {/* Subtle E, W, S mini cardinal labels */}
                  <text x="0" y="16" textAnchor="middle" dominantBaseline="central" className="text-[6.5px] font-extrabold fill-slate-800 select-none">S</text>
                  <text x="16" y="0" textAnchor="middle" dominantBaseline="central" className="text-[6.5px] font-extrabold fill-slate-800 select-none">E</text>
                  <text x="-16" y="0" textAnchor="middle" dominantBaseline="central" className="text-[6.5px] font-extrabold fill-slate-800 select-none">W</text>

                  {/* Split Deed Survey Needle (North / South) */}
                  {/* North Point (Left Half Solid Black, Right Half Crisp White with Black Outline) */}
                  <polygon points="0,-21 -5.5,-3 0,0" fill="#000000" stroke="#000000" strokeWidth="0.6" strokeLinejoin="round" />
                  <polygon points="0,-21 5.5,-3 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.9" strokeLinejoin="round" />

                  {/* South Counter-Tail (Left Half White, Right Half Solid Black) */}
                  <polygon points="0,13.5 -3.2,2.5 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.8" strokeLinejoin="round" />
                  <polygon points="0,13.5 3.2,2.5 0,0" fill="#000000" stroke="#000000" strokeWidth="0.6" strokeLinejoin="round" />

                  {/* East-West Cross Wings */}
                  <polygon points="11,0 2.5,2.2 0,0" fill="#000000" />
                  <polygon points="11,0 2.5,-2.2 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.6" />
                  <polygon points="-11,0 -2.5,-2.2 0,0" fill="#000000" />
                  <polygon points="-11,0 -2.5,2.2 0,0" fill="#ffffff" stroke="#000000" strokeWidth="0.6" />

                  {/* Center Eyelet Pivot */}
                  <circle cx="0" cy="0" r="2.8" fill="#ffffff" stroke="#000000" strokeWidth="1.3" />
                  <circle cx="0" cy="0" r="1.2" fill="#000000" />

                  {/* Bold Distinct North 'N' at top */}
                  <text
                    x="0"
                    y="-33"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-[13px] font-black fill-black select-none tracking-tight"
                    style={{ fontFamily: 'sans-serif', paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}
                  >
                    N
                  </text>
                </g>
              );
            })()}
          </g>
        </g>

        {/* ================= SCALABLE MAP CONTENT (MAP SCALE & ROTATION) ================= */}
        <g
          id="scalable-map-content"
          transform={`rotate(${boundaries.mapRotation || 0}, ${centerX}, ${centerY}) translate(${centerX}, ${centerY}) scale(${sketchScaleFactor}) translate(${-centerX}, ${-centerY})`}
        >
          {/* ================= ROAD STRIPS ================= */}
        {/* South Road */}
        {hasSouthRoad && (() => {
          const isCont = roadContinuous !== false;
          const southCont = boundaries.southRoadContinuity ?? roadContinuitySide ?? 'both';
          const isDeadEnd = roadLayoutType === 'Dead-End / Cul-de-Sac';
          const termR = isDeadEnd && (deadEndSide === 'right' || deadEndSide === 'both');
          const termL = isDeadEnd && (deadEndSide === 'left' || deadEndSide === 'both');

          const extL = termL ? 22 : (!isCont || southCont === 'right' || southCont === 'none' ? 0 : 80);
          const extR = termR ? 22 : (!isCont || southCont === 'left' || southCont === 'none' ? 0 : 80);

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
          const apprBottomY = Math.min(baseViewBoxHeight - 14, Math.max(apprY1, apprY2) + 52);

          // Dead-End Bulb / Barrier dimensions
          const bulbR = roadStripDepth * 0.65;
          const bulbMidY_R = (y2_in + y2_out) / 2;
          const bulbCenterX_R = x2 + bulbR * 0.55;
          const bulbMidY_L = (y1_in + y1_out) / 2;
          const bulbCenterX_L = x1 - bulbR * 0.55;

          // Road Display Label specifically for South Road boundary
          const southRoadLabel = getRoadLabelForSide('South', boundaries);
          let roadDisplayLabel = isCont ? `⟵  ${southRoadLabel}  ⟶` : southRoadLabel;
          if (roadLayoutType === 'Through Road / Through Plot') {
            roadDisplayLabel = `⟵  THROUGH ROAD (${southRoadLabel})  ⟶`;
          } else if (roadLayoutType === 'T-Junction') {
            roadDisplayLabel = `⟵  ${southRoadLabel} (T-JUNCTION)  ⟶`;
          } else if (isDeadEnd) {
            roadDisplayLabel = `${southRoadLabel} (${deadEndType === 'cul-de-sac' ? 'CUL-DE-SAC' : 'DEAD-END'})`;
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
                  {/* T-Junction approach center dashed line (breaks before & after text so no dashed line passes through text) */}
                  {(() => {
                    const midY_appr = (apprY1 + apprBottomY) / 2 + 6;
                    const apprTop = (apprY1 + apprY2) / 2;
                    return (
                      <>
                        {apprTop < midY_appr - 18 && (
                          <line
                            x1={midX}
                            y1={apprTop}
                            x2={midX}
                            y2={midY_appr - 18}
                            stroke="#000000"
                            strokeWidth="1.5"
                            strokeDasharray="5 3"
                          />
                        )}
                        {midY_appr + 18 < apprBottomY && (
                          <line
                            x1={midX}
                            y1={midY_appr + 18}
                            x2={midX}
                            y2={apprBottomY}
                            stroke="#000000"
                            strokeWidth="1.5"
                            strokeDasharray="5 3"
                          />
                        )}
                        {/* Solid clean backdrop so no line touches the text */}
                        <rect
                          x={midX - 44}
                          y={midY_appr - 16}
                          width={88}
                          height={30}
                          fill="#ffffff"
                          stroke="none"
                          rx="4"
                        />
                        {/* T-Junction approach branch labels */}
                        <text
                          x={midX}
                          y={(apprY1 + apprBottomY) / 2 + 3}
                          textAnchor="middle"
                          className="text-[8px] font-extrabold fill-black tracking-wider uppercase"
                          style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}
                        >
                          {approachRoadWidth ? `${approachRoadWidth} ` : ''}T-JUNCTION ROAD
                        </text>
                        <text
                          x={midX}
                          y={(apprY1 + apprBottomY) / 2 + 13}
                          textAnchor="middle"
                          className="text-[7.5px] font-bold fill-black tracking-wide"
                          style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}
                        >
                          (ఎదురు రోడ్డు)
                        </text>
                      </>
                    );
                  })()}
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
                    <text x={bulbCenterX_R} y={bulbMidY_R - bulbR * 0.55} textAnchor="middle" className="text-[7.5px] font-black fill-black tracking-wider" style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}>
                      CUL-DE-SAC
                    </text>
                    <text x={bulbCenterX_R} y={bulbMidY_R + bulbR * 0.68} textAnchor="middle" className="text-[6.5px] font-bold fill-black" style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}>
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
                      className="text-[8px] font-black fill-black tracking-wider uppercase"
                      style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}
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
                    <text x={bulbCenterX_L} y={bulbMidY_L - bulbR * 0.55} textAnchor="middle" className="text-[7.5px] font-black fill-black tracking-wider" style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}>
                      CUL-DE-SAC
                    </text>
                    <text x={bulbCenterX_L} y={bulbMidY_L + bulbR * 0.68} textAnchor="middle" className="text-[6.5px] font-bold fill-black" style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}>
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
                      className="text-[8px] font-black fill-black tracking-wider uppercase"
                      style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}
                    >
                      ⛔ DEAD END
                    </text>
                  </g>
                )
              )}

              {/* Center Dashed Line & Road Label (Breaks around text so dashed line never passes through 30' road matter) */}
              {(() => {
                const midX_lbl = (dx + cx) / 2;
                const midY_lbl = yIn(midX_lbl) + roadStripDepth / 2;
                const roadAngle = getUprightAngle(angleDC, mapRot);
                const labelWidth = Math.max(70, roadDisplayLabel.length * 7.5 + 20);
                const halfLabelWidth = labelWidth / 2;
                const rad = (angleDC * Math.PI) / 180;
                const cosA = Math.abs(Math.cos(rad)) || 1;
                const halfSpanX = halfLabelWidth * cosA + 6;
                const seg1EndX = midX_lbl - halfSpanX;
                const seg2StartX = midX_lbl + halfSpanX;

                return (
                  <>
                    {/* Left/Start Segment of Center Line */}
                    {seg1EndX > xCenterStart + 8 && (
                      <line
                        x1={xCenterStart}
                        y1={yIn(xCenterStart) + roadStripDepth / 2}
                        x2={seg1EndX}
                        y2={yIn(seg1EndX) + roadStripDepth / 2}
                        stroke="#000000"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Right/End Segment of Center Line */}
                    {xCenterEnd > seg2StartX + 8 && (
                      <line
                        x1={seg2StartX}
                        y1={yIn(seg2StartX) + roadStripDepth / 2}
                        x2={xCenterEnd}
                        y2={yIn(xCenterEnd) + roadStripDepth / 2}
                        stroke="#000000"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Road Label placed along the road center and aligned with slope */}
                    <g transform={`rotate(${roadAngle}, ${midX_lbl}, ${midY_lbl})`}>
                      {/* Protective solid white background pill so no lines touch the matter */}
                      <rect
                        x={midX_lbl - labelWidth / 2}
                        y={midY_lbl - 9}
                        width={labelWidth}
                        height={18}
                        fill="#ffffff"
                        stroke="none"
                        rx="3"
                      />
                      <text
                        x={midX_lbl}
                        y={midY_lbl}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`text-[11px] ${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal uppercase`}
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.5px' : '1.2px' }}
                      >
                        {roadDisplayLabel}
                      </text>
                    </g>
                  </>
                );
              })()}

              {/* Optional direction continuation labels */}
              {(() => {
                const southDirL = boundaries.southRoadDirectionLeft || roadDirectionLeft;
                const southDirR = boundaries.southRoadDirectionRight || roadDirectionRight;
                return (
                  <>
                    {extL > 0 && !termL && southDirL && (
                      <text
                        x={x1 + 8}
                        y={yIn(x1 + 8) + roadStripDepth / 2}
                        textAnchor="start"
                        dominantBaseline="central"
                        transform={`rotate(${angleDC}, ${x1 + 8}, ${yIn(x1 + 8) + roadStripDepth / 2})`}
                        className="text-[9px] font-bold fill-black tracking-wide"
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                      >
                        ⟵ {southDirL}
                      </text>
                    )}
                    {extR > 0 && !termR && southDirR && (
                      <text
                        x={x2 - 8}
                        y={yIn(x2 - 8) + roadStripDepth / 2}
                        textAnchor="end"
                        dominantBaseline="central"
                        transform={`rotate(${angleDC}, ${x2 - 8}, ${yIn(x2 - 8) + roadStripDepth / 2})`}
                        className="text-[9px] font-bold fill-black tracking-wide"
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                      >
                        {southDirR} ⟶
                      </text>
                    )}
                  </>
                );
              })()}
            </g>
          );
        })()}

        {/* North Road */}
        {hasNorthRoad && (() => {
          const isCont = roadContinuous !== false;
          const northCont = boundaries.northRoadContinuity ?? roadContinuitySide ?? 'both';
          const isDeadEnd = roadLayoutType === 'Dead-End / Cul-de-Sac';
          const termR = isDeadEnd && (deadEndSide === 'right' || deadEndSide === 'both');
          const termL = isDeadEnd && (deadEndSide === 'left' || deadEndSide === 'both');

          const extL = termL ? 22 : (!isCont || northCont === 'right' || northCont === 'none' ? 0 : 80);
          const extR = termR ? 22 : (!isCont || northCont === 'left' || northCont === 'none' ? 0 : 80);

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

          // Road Display Label specifically for North Road boundary
          const northRoadLabel = getRoadLabelForSide('North', boundaries);
          let roadDisplayLabel = isCont ? `⟵  ${northRoadLabel}  ⟶` : northRoadLabel;
          if (roadLayoutType === 'Through Road / Through Plot') {
            roadDisplayLabel = `⟵  THROUGH ROAD (${northRoadLabel})  ⟶`;
          } else if (roadLayoutType === 'T-Junction') {
            roadDisplayLabel = `⟵  ${northRoadLabel} (T-JUNCTION)  ⟶`;
          } else if (isDeadEnd) {
            roadDisplayLabel = `${northRoadLabel} (${deadEndType === 'cul-de-sac' ? 'CUL-DE-SAC' : 'DEAD-END'})`;
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
                  {/* Center dashed line for approach road (breaks before & after text) */}
                  {(() => {
                    const midY_appr = (apprTopY + apprY1) / 2 + 3;
                    const apprBottom = (apprY1 + apprY2) / 2;
                    return (
                      <>
                        {apprTopY < midY_appr - 18 && (
                          <line
                            x1={midX}
                            y1={apprTopY}
                            x2={midX}
                            y2={midY_appr - 18}
                            stroke="#000000"
                            strokeWidth="1.5"
                            strokeDasharray="5 3"
                          />
                        )}
                        {midY_appr + 18 < apprBottom && (
                          <line
                            x1={midX}
                            y1={midY_appr + 18}
                            x2={midX}
                            y2={apprBottom}
                            stroke="#000000"
                            strokeWidth="1.5"
                            strokeDasharray="5 3"
                          />
                        )}
                        {/* Solid clean backdrop so no line touches the text */}
                        <rect
                          x={midX - 44}
                          y={midY_appr - 16}
                          width={88}
                          height={30}
                          fill="#ffffff"
                          stroke="none"
                          rx="4"
                        />
                        {/* Labels on approach branch */}
                        <text
                          x={midX}
                          y={(apprTopY + apprY1) / 2 - 2}
                          textAnchor="middle"
                          className="text-[8px] font-extrabold fill-black tracking-wider uppercase"
                          style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}
                        >
                          {approachRoadWidth ? `${approachRoadWidth} ` : ''}T-JUNCTION ROAD
                        </text>
                        <text
                          x={midX}
                          y={(apprTopY + apprY1) / 2 + 8}
                          textAnchor="middle"
                          className="text-[7.5px] font-bold fill-black tracking-wide"
                          style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}
                        >
                          (ఎదురు రోడ్డు)
                        </text>
                      </>
                    );
                  })()}
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
                    <text x={bulbCenterX_R} y={bulbMidY_R - bulbR * 0.55} textAnchor="middle" className="text-[7.5px] font-black fill-black tracking-wider" style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}>
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
                      className="text-[8px] font-black fill-black tracking-wider uppercase"
                      style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}
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
                    <text x={bulbCenterX_L} y={bulbMidY_L - bulbR * 0.55} textAnchor="middle" className="text-[7.5px] font-black fill-black tracking-wider" style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}>
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
                      className="text-[8px] font-black fill-black tracking-wider uppercase"
                      style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '3px' }}
                    >
                      ⛔ DEAD END
                    </text>
                  </g>
                )
              )}

              {/* Center Dashed Line & Road Label (Breaks around text so dashed line never passes through 30' road matter) */}
              {(() => {
                const midX_lbl = (ax + bx) / 2;
                const midY_lbl = yIn(midX_lbl) - roadStripDepth / 2;
                const roadAngle = getUprightAngle(angleAB, mapRot);
                const labelWidth = Math.max(70, roadDisplayLabel.length * 7.5 + 20);
                const halfLabelWidth = labelWidth / 2;
                const rad = (angleAB * Math.PI) / 180;
                const cosA = Math.abs(Math.cos(rad)) || 1;
                const halfSpanX = halfLabelWidth * cosA + 6;
                const seg1EndX = midX_lbl - halfSpanX;
                const seg2StartX = midX_lbl + halfSpanX;

                return (
                  <>
                    {/* Left/Start Segment of Center Line */}
                    {seg1EndX > xCenterStart + 8 && (
                      <line
                        x1={xCenterStart}
                        y1={yIn(xCenterStart) - roadStripDepth / 2}
                        x2={seg1EndX}
                        y2={yIn(seg1EndX) - roadStripDepth / 2}
                        stroke="#000000"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Right/End Segment of Center Line */}
                    {xCenterEnd > seg2StartX + 8 && (
                      <line
                        x1={seg2StartX}
                        y1={yIn(seg2StartX) - roadStripDepth / 2}
                        x2={xCenterEnd}
                        y2={yIn(xCenterEnd) - roadStripDepth / 2}
                        stroke="#000000"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Road Label */}
                    <g transform={`rotate(${roadAngle}, ${midX_lbl}, ${midY_lbl})`}>
                      {/* Protective solid white background pill so no lines touch the matter */}
                      <rect
                        x={midX_lbl - labelWidth / 2}
                        y={midY_lbl - 9}
                        width={labelWidth}
                        height={18}
                        fill="#ffffff"
                        stroke="none"
                        rx="3"
                      />
                      <text
                        x={midX_lbl}
                        y={midY_lbl}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`text-[11px] ${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal uppercase`}
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.5px' : '1.2px' }}
                      >
                        {roadDisplayLabel}
                      </text>
                    </g>
                  </>
                );
              })()}

              {(() => {
                const northDirL = boundaries.northRoadDirectionLeft || roadDirectionLeft;
                const northDirR = boundaries.northRoadDirectionRight || roadDirectionRight;
                return (
                  <>
                    {extL > 0 && !termL && northDirL && (
                      <text
                        x={x1 + 8}
                        y={yIn(x1 + 8) - roadStripDepth / 2}
                        textAnchor="start"
                        dominantBaseline="central"
                        transform={`rotate(${angleAB}, ${x1 + 8}, ${yIn(x1 + 8) - roadStripDepth / 2})`}
                        className="text-[9px] font-bold fill-black tracking-wide"
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                      >
                        ⟵ {northDirL}
                      </text>
                    )}
                    {extR > 0 && !termR && northDirR && (
                      <text
                        x={x2 - 8}
                        y={yIn(x2 - 8) - roadStripDepth / 2}
                        textAnchor="end"
                        dominantBaseline="central"
                        transform={`rotate(${angleAB}, ${x2 - 8}, ${yIn(x2 - 8) - roadStripDepth / 2})`}
                        className="text-[9px] font-bold fill-black tracking-wide"
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                      >
                        {northDirR} ⟶
                      </text>
                    )}
                  </>
                );
              })()}
            </g>
          );
        })()}

        {/* East Road */}
        {hasEastRoad && (() => {
          const isCont = roadContinuous !== false;
          const eastCont = boundaries.eastRoadContinuity ?? roadContinuitySide ?? 'both';
          const isDeadEnd = roadLayoutType === 'Dead-End / Cul-de-Sac';
          const extT = (!isCont || eastCont === 'bottom' || eastCont === 'right' || eastCont === 'none') ? 0 : 70;
          const extB = (!isCont || eastCont === 'top' || eastCont === 'left' || eastCont === 'none') ? 0 : 70;

          const y1 = Math.max(22, by - (hasNorthRoad ? roadStripDepth : 0) - extT);
          const y2 = Math.min(baseViewBoxHeight - 22, cy + (hasSouthRoad ? roadStripDepth : 0) + extB);

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

          // Road Display Label specifically for East Road boundary
          const eastRoadLabel = getRoadLabelForSide('East', boundaries);
          let roadDisplayLabel = isCont ? `⟵  ${eastRoadLabel}  ⟶` : eastRoadLabel;
          if (roadLayoutType === 'Through Road / Through Plot') {
            roadDisplayLabel = `⟵  THROUGH ROAD (${eastRoadLabel})  ⟶`;
          } else if (roadLayoutType === 'T-Junction') {
            roadDisplayLabel = `⟵  ${eastRoadLabel} (T-JUNCTION)  ⟶`;
          } else if (isDeadEnd) {
            roadDisplayLabel = `${eastRoadLabel} (${deadEndType === 'cul-de-sac' ? 'CUL-DE-SAC' : 'DEAD-END'})`;
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
                  {/* Center line for approach road (breaks before & after text) */}
                  {(() => {
                    const midX_appr = (apprX1 + apprRightX) / 2;
                    const apprLeft = (apprX1 + apprX2) / 2;
                    return (
                      <>
                        {apprLeft < midX_appr - 18 && (
                          <line
                            x1={apprLeft}
                            y1={midY}
                            x2={midX_appr - 18}
                            y2={midY}
                            stroke="#000000"
                            strokeWidth="1.5"
                            strokeDasharray="5 3"
                          />
                        )}
                        {midX_appr + 18 < apprRightX && (
                          <line
                            x1={midX_appr + 18}
                            y1={midY}
                            x2={apprRightX}
                            y2={midY}
                            stroke="#000000"
                            strokeWidth="1.5"
                            strokeDasharray="5 3"
                          />
                        )}
                        {/* Solid clean backdrop so no line touches the text */}
                        <rect
                          x={midX_appr - 28}
                          y={midY - 10}
                          width={56}
                          height={20}
                          fill="#ffffff"
                          stroke="none"
                          rx="3"
                        />
                        <text
                          x={midX_appr}
                          y={midY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="text-[7.5px] font-extrabold fill-black tracking-wider uppercase"
                          style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}
                        >
                          T-JUNCTION
                        </text>
                      </>
                    );
                  })()}
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

              {/* Center Dashed Line & Road Label (Breaks around text so dashed line never passes through 30' road matter) */}
              {(() => {
                const midY_lbl = (by + cy) / 2;
                const midX_lbl = xIn(midY_lbl) + roadStripDepth / 2;
                const roadAngle = getUprightAngle(angleBC, mapRot);
                const labelWidth = Math.max(70, roadDisplayLabel.length * 7.5 + 20);
                const halfLabelWidth = labelWidth / 2;
                const rad = (angleBC * Math.PI) / 180;
                const sinA = Math.abs(Math.sin(rad)) || 1;
                const halfSpanY = halfLabelWidth * sinA + 6;
                const seg1EndY = midY_lbl - halfSpanY;
                const seg2StartY = midY_lbl + halfSpanY;

                return (
                  <>
                    {/* Top/Start Segment of Center Line */}
                    {seg1EndY > yCenterStart + 8 && (
                      <line
                        x1={xIn(yCenterStart) + roadStripDepth / 2}
                        y1={yCenterStart}
                        x2={xIn(seg1EndY) + roadStripDepth / 2}
                        y2={seg1EndY}
                        stroke="#000000"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Bottom/End Segment of Center Line */}
                    {yCenterEnd > seg2StartY + 8 && (
                      <line
                        x1={xIn(seg2StartY) + roadStripDepth / 2}
                        y1={seg2StartY}
                        x2={xIn(yCenterEnd) + roadStripDepth / 2}
                        y2={yCenterEnd}
                        stroke="#000000"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Road Label */}
                    <g transform={`rotate(${roadAngle}, ${midX_lbl}, ${midY_lbl})`}>
                      {/* Protective solid white background pill so no lines touch the matter */}
                      <rect
                        x={midX_lbl - labelWidth / 2}
                        y={midY_lbl - 9}
                        width={labelWidth}
                        height={18}
                        fill="#ffffff"
                        stroke="none"
                        rx="3"
                      />
                      <text
                        x={midX_lbl}
                        y={midY_lbl}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`text-[11px] ${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal uppercase`}
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.5px' : '1.2px' }}
                      >
                        {roadDisplayLabel}
                      </text>
                    </g>
                  </>
                );
              })()}

              {/* Optional direction continuation labels for East Road */}
              {(() => {
                const eastDirT = boundaries.eastRoadDirectionTop;
                const eastDirB = boundaries.eastRoadDirectionBottom;
                return (
                  <>
                    {extT > 0 && eastDirT && (
                      <text
                        x={xIn(y1 + 8) + roadStripDepth / 2}
                        y={y1 + 8}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${angleBC}, ${xIn(y1 + 8) + roadStripDepth / 2}, ${y1 + 8})`}
                        className="text-[9px] font-bold fill-black tracking-wide"
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                      >
                        ⟵ {eastDirT}
                      </text>
                    )}
                    {extB > 0 && eastDirB && (
                      <text
                        x={xIn(y2 - 8) + roadStripDepth / 2}
                        y={y2 - 8}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${angleBC}, ${xIn(y2 - 8) + roadStripDepth / 2}, ${y2 - 8})`}
                        className="text-[9px] font-bold fill-black tracking-wide"
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                      >
                        {eastDirB} ⟶
                      </text>
                    )}
                  </>
                );
              })()}
            </g>
          );
        })()}

        {/* West Road */}
        {hasWestRoad && (() => {
          const isCont = roadContinuous !== false;
          const westCont = boundaries.westRoadContinuity ?? roadContinuitySide ?? 'both';
          const isDeadEnd = roadLayoutType === 'Dead-End / Cul-de-Sac';
          const extT = (!isCont || westCont === 'bottom' || westCont === 'right' || westCont === 'none') ? 0 : 70;
          const extB = (!isCont || westCont === 'top' || westCont === 'left' || westCont === 'none') ? 0 : 70;

          const y1 = Math.max(22, ay - (hasNorthRoad ? roadStripDepth : 0) - extT);
          const y2 = Math.min(baseViewBoxHeight - 22, dy + (hasSouthRoad ? roadStripDepth : 0) + extB);

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

          // Road Display Label specifically for West Road boundary
          const westRoadLabel = getRoadLabelForSide('West', boundaries);
          let roadDisplayLabel = isCont ? `⟵  ${westRoadLabel}  ⟶` : westRoadLabel;
          if (roadLayoutType === 'Through Road / Through Plot') {
            roadDisplayLabel = `⟵  THROUGH ROAD (${westRoadLabel})  ⟶`;
          } else if (roadLayoutType === 'T-Junction') {
            roadDisplayLabel = `⟵  ${westRoadLabel} (T-JUNCTION)  ⟶`;
          } else if (isDeadEnd) {
            roadDisplayLabel = `${westRoadLabel} (${deadEndType === 'cul-de-sac' ? 'CUL-DE-SAC' : 'DEAD-END'})`;
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
                  {/* Center line for approach road (breaks before & after text) */}
                  {(() => {
                    const midX_appr = (apprX1 + apprLeftX) / 2;
                    const apprRight = (apprX1 + apprX2) / 2;
                    return (
                      <>
                        {apprLeftX < midX_appr - 18 && (
                          <line
                            x1={apprLeftX}
                            y1={midY}
                            x2={midX_appr - 18}
                            y2={midY}
                            stroke="#000000"
                            strokeWidth="1.5"
                            strokeDasharray="5 3"
                          />
                        )}
                        {midX_appr + 18 < apprRight && (
                          <line
                            x1={midX_appr + 18}
                            y1={midY}
                            x2={apprRight}
                            y2={midY}
                            stroke="#000000"
                            strokeWidth="1.5"
                            strokeDasharray="5 3"
                          />
                        )}
                        {/* Solid clean backdrop so no line touches the text */}
                        <rect
                          x={midX_appr - 28}
                          y={midY - 10}
                          width={56}
                          height={20}
                          fill="#ffffff"
                          stroke="none"
                          rx="3"
                        />
                        <text
                          x={midX_appr}
                          y={midY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="text-[7.5px] font-extrabold fill-black tracking-wider uppercase"
                          style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2.5px' }}
                        >
                          T-JUNCTION
                        </text>
                      </>
                    );
                  })()}
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

              {/* Center Dashed Line & Road Label (Breaks around text so dashed line never passes through 30' road matter) */}
              {(() => {
                const midY_lbl = (ay + dy) / 2;
                const midX_lbl = xIn(midY_lbl) - roadStripDepth / 2;
                const roadAngle = getUprightAngle(angleAD, mapRot);
                const labelWidth = Math.max(70, roadDisplayLabel.length * 7.5 + 20);
                const halfLabelWidth = labelWidth / 2;
                const rad = (angleAD * Math.PI) / 180;
                const sinA = Math.abs(Math.sin(rad)) || 1;
                const halfSpanY = halfLabelWidth * sinA + 6;
                const seg1EndY = midY_lbl - halfSpanY;
                const seg2StartY = midY_lbl + halfSpanY;

                return (
                  <>
                    {/* Top/Start Segment of Center Line */}
                    {seg1EndY > yCenterStart + 8 && (
                      <line
                        x1={xIn(yCenterStart) - roadStripDepth / 2}
                        y1={yCenterStart}
                        x2={xIn(seg1EndY) - roadStripDepth / 2}
                        y2={seg1EndY}
                        stroke="#000000"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Bottom/End Segment of Center Line */}
                    {yCenterEnd > seg2StartY + 8 && (
                      <line
                        x1={xIn(seg2StartY) - roadStripDepth / 2}
                        y1={seg2StartY}
                        x2={xIn(yCenterEnd) - roadStripDepth / 2}
                        y2={yCenterEnd}
                        stroke="#000000"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Road Label */}
                    <g transform={`rotate(${roadAngle}, ${midX_lbl}, ${midY_lbl})`}>
                      {/* Protective solid white background pill so no lines touch the matter */}
                      <rect
                        x={midX_lbl - labelWidth / 2}
                        y={midY_lbl - 9}
                        width={labelWidth}
                        height={18}
                        fill="#ffffff"
                        stroke="none"
                        rx="3"
                      />
                      <text
                        x={midX_lbl}
                        y={midY_lbl}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`text-[11px] ${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal uppercase`}
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.5px' : '1.2px' }}
                      >
                        {roadDisplayLabel}
                      </text>
                    </g>
                  </>
                );
              })()}

              {/* Optional direction continuation labels for West Road */}
              {(() => {
                const westDirT = boundaries.westRoadDirectionTop;
                const westDirB = boundaries.westRoadDirectionBottom;
                return (
                  <>
                    {extT > 0 && westDirT && (
                      <text
                        x={xIn(y1 + 8) - roadStripDepth / 2}
                        y={y1 + 8}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${angleAD}, ${xIn(y1 + 8) - roadStripDepth / 2}, ${y1 + 8})`}
                        className="text-[9px] font-bold fill-black tracking-wide"
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                      >
                        ⟵ {westDirT}
                      </text>
                    )}
                    {extB > 0 && westDirB && (
                      <text
                        x={xIn(y2 - 8) - roadStripDepth / 2}
                        y={y2 - 8}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${angleAD}, ${xIn(y2 - 8) - roadStripDepth / 2}, ${y2 - 8})`}
                        className="text-[9px] font-bold fill-black tracking-wide"
                        style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '2px' }}
                      >
                        {westDirB} ⟶
                      </text>
                    )}
                  </>
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
          <g id="houses-drawing-group" clipPath="url(#plot-boundary-house-clip)">
            {renderedHouses.map((h, idx) => {
              const isSingleHouse = renderedHouses.length === 1;

              // Safe measurement exclusion zones: Guarantees Roof Type NEVER touches or crosses house measurements
              const hasNorthDim = h.showHouseDims && h.housePxH >= 44;
              const hasSouthDim = h.showHouseDims && h.housePxH >= 68;
              const hasEastDim = h.showHouseDims && h.housePxW >= 44;
              const hasWestDim = h.showHouseDims && h.housePxW >= 68;

              // Distance reserved from inner house edges so the Roof Type badge is 100% separated from measurement labels
              const northDimReserve = hasNorthDim ? Math.min(18, h.housePxH * 0.25 + 9.5) + 3.5 : 5.5;
              const southDimReserve = hasSouthDim ? Math.min(18, h.housePxH * 0.25 + 9.5) + 3.5 : 5.5;
              const westDimReserve = hasWestDim ? Math.min(18, h.housePxW * 0.25 + 9.5) + 3.5 : 5.5;
              const eastDimReserve = hasEastDim ? Math.min(18, h.housePxW * 0.25 + 9.5) + 3.5 : 5.5;

              // Exact safe clear inner boundary strictly between the house dimensions and masonry walls
              const safeBoxX1 = h.hx1 + westDimReserve;
              const safeBoxX2 = h.hx2 - eastDimReserve;
              const safeBoxY1 = h.hy1 + northDimReserve;
              const safeBoxY2 = h.hy2 - southDimReserve;

              const safeAvailW = Math.max(8, safeBoxX2 - safeBoxX1);
              const safeAvailH = Math.max(6, safeBoxY2 - safeBoxY1);
              const safeMidX = (safeBoxX1 + safeBoxX2) / 2;
              const safeMidY = (safeBoxY1 + safeBoxY2) / 2;

              // Orientation: Orient vertically (-90 deg) only when safe height is noticeably taller than safe width
              const isRoofVertical = safeAvailH > safeAvailW * 1.30;
              const roofAngle = getUprightAngle(isRoofVertical ? -90 : 0, mapRot);
              const allowedRoofSpan = isRoofVertical ? safeAvailH : safeAvailW;
              const allowedRoofCross = isRoofVertical ? safeAvailW : safeAvailH;

              // Standardized clean structure / roof type display without generic STRUCTURE-1 / STRUCTURE-2
              let roofClean = (h.structureType || 'R.C.C. ROOF HOUSE').trim();
              // Strip any prefixes like 'STRUCTURE-1: ' or 'STRUCTURE #1: ' if accidentally entered
              roofClean = roofClean.replace(/^(STRUCTURE|HOUSE|BLDG)[\s#\-_]*\d+[:\s\-]*/i, '').trim();
              if (allowedRoofSpan < 75) {
                roofClean = roofClean
                  .replace(/ROOF HOUSE/gi, 'ROOF')
                  .replace(/BUILDING/gi, 'BLDG');
              }
              if (allowedRoofSpan < 45) {
                roofClean = roofClean
                  .replace(/R\.C\.C\..*/gi, 'R.C.C.')
                  .replace(/A\.C\..*/gi, 'A.C.')
                  .replace(/TILED.*/gi, 'TILED');
              }

              const isGeneric = !h.name ||
                /^(structure|house|bldg|building)[\s#\-_]*\d*$/i.test(h.name.trim()) ||
                /^main\s*house$/i.test(h.name.trim());
              const hasHouseName = Boolean(!isGeneric && h.name && h.name.trim().length > 0);
              const useTwoLines = hasHouseName && allowedRoofCross >= 20 && allowedRoofSpan < 100;
              const roofLine1 = useTwoLines ? h.name.trim() : (hasHouseName ? `${h.name.trim()}: ${roofClean}` : roofClean);
              const roofLine2 = useTwoLines ? roofClean : '';

              let naturalBadgeW: number;
              let naturalBadgeH: number;
              let baseFontSize: number;

              if (useTwoLines) {
                const maxLineChars = Math.max(roofLine1.length, roofLine2.length);
                naturalBadgeW = Math.max(22, maxLineChars * 4.9 + 10);
                naturalBadgeH = 19;
                baseFontSize = 7.5;
              } else {
                naturalBadgeW = Math.max(20, roofLine1.length * 5.3 + 10);
                naturalBadgeH = 14;
                baseFontSize = 8.5;
              }

              // Auto-fit scale factor strictly constrained so the badge NEVER crosses dimensions or walls
              const spanScale = Math.min(1.0, (allowedRoofSpan - 2) / naturalBadgeW);
              const crossScale = Math.min(1.0, (allowedRoofCross - 2) / naturalBadgeH);
              const autoFitScale = Math.min(spanScale, crossScale);

              const badgeW = Math.min(allowedRoofSpan - 2, Math.max(14, naturalBadgeW * autoFitScale));
              const badgeH = Math.min(allowedRoofCross - 2, Math.max(8, naturalBadgeH * autoFitScale));
              const finalFontSize = Math.max(4.0, Math.min(baseFontSize, baseFontSize * autoFitScale));

              return (
                <g key={h.id || idx} id={`house-group-${idx}`}>
                  {/* 1. Base White Foundation Slab (covers cadastral hatching) */}
                  <rect
                    id={`house-foundation-${idx}`}
                    x={h.hx1}
                    y={h.hy1}
                    width={h.housePxW}
                    height={h.housePxH}
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    className="drop-shadow-xs"
                  />

                  {/* 2. Masonry Inner Wall (Architectural double-line standard) */}
                  {h.housePxW >= 14 && h.housePxH >= 14 && (
                    <rect
                      id={`house-inner-wall-${idx}`}
                      x={h.hx1 + 3}
                      y={h.hy1 + 3}
                      width={h.housePxW - 6}
                      height={h.housePxH - 6}
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth="1.2"
                    />
                  )}

                  {/* 3. Selected Structure / Roof Type & House Name Badge - AUTO-FIT INSIDE SAFE CLEARANCE */}
                  {safeAvailW >= 14 && safeAvailH >= 8 && (
                    <g
                      id={`house-roof-badge-${idx}`}
                      transform={`translate(${safeMidX}, ${safeMidY}) rotate(${roofAngle})`}
                    >
                      <rect
                        x={-badgeW / 2}
                        y={-badgeH / 2}
                        width={badgeW}
                        height={badgeH}
                        rx={Math.min(2.5, badgeH * 0.22)}
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth="1.1"
                      />
                      {useTwoLines ? (
                        <>
                          <text
                            x="0"
                            y={-badgeH * 0.22}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className={`${isBoundaryBold ? 'font-bold' : 'font-medium'} fill-slate-900 tracking-normal select-none`}
                            style={{ fontSize: `${finalFontSize * 0.95}px` }}
                            textLength={Math.max(6, badgeW - 6)}
                            lengthAdjust="spacingAndGlyphs"
                          >
                            {roofLine1}
                          </text>
                          <text
                            x="0"
                            y={badgeH * 0.25}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className={`${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal select-none`}
                            style={{ fontSize: `${finalFontSize * 0.90}px` }}
                            textLength={Math.max(6, badgeW - 6)}
                            lengthAdjust="spacingAndGlyphs"
                          >
                            {roofLine2}
                          </text>
                        </>
                      ) : (
                        <text
                          x="0"
                          y="0"
                          textAnchor="middle"
                          dominantBaseline="central"
                          className={`${isBoundaryBold ? 'font-bold' : 'font-medium'} fill-slate-900 tracking-normal select-none`}
                          style={{ fontSize: `${finalFontSize}px` }}
                          textLength={Math.max(6, badgeW - 6)}
                          lengthAdjust="spacingAndGlyphs"
                        >
                          {roofLine1}
                        </text>
                      )}
                    </g>
                  )}

                  {/* 6. House Width & Length Dimensions (Non-bold clean style with auto-protective backdrops) */}
                  {h.showHouseDims && (
                    <g id={`house-dimensions-inside-group-${idx}`}>
                      {/* North / Top Inside Edge - Width */}
                      {h.housePxH >= 24 && (() => {
                        const dimY = h.hy1 + Math.min(13, Math.max(7, h.housePxH * 0.22));
                        const textW = Math.max(26, h.houseWDisplay.length * 6.8 + 8);
                        return (
                          <g id={`house-dim-inside-north-${idx}`}>
                            <rect
                              x={h.hCenterX - textW / 2}
                              y={dimY - 6.5}
                              width={textW}
                              height={13}
                              fill="#ffffff"
                              stroke="none"
                              rx="2"
                            />
                            <text
                              x={h.hCenterX}
                              y={dimY}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className={`${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-900 tracking-normal select-none`}
                              style={{
                                fontSize: `${Math.min(10.5, Math.max(8.0, h.housePxH * 0.18))}px`,
                                paintOrder: 'stroke fill',
                                stroke: '#ffffff',
                                strokeWidth: isBoundaryBold ? '2.5px' : '1.2px',
                              }}
                            >
                              {h.houseWDisplay}
                            </text>
                          </g>
                        );
                      })()}

                      {/* East / Right Inside Edge - Length (Rotated 90°) */}
                      {h.housePxW >= 24 && (() => {
                        const posX = h.hx2 - Math.min(13, Math.max(7, h.housePxW * 0.22));
                        const textW = Math.max(26, h.houseLDisplay.length * 6.8 + 8);
                        return (
                          <g id={`house-dim-inside-east-${idx}`} transform={`translate(${posX}, ${h.hCenterY}) rotate(90)`}>
                            <rect
                              x={-textW / 2}
                              y={-6.5}
                              width={textW}
                              height={13}
                              fill="#ffffff"
                              stroke="none"
                              rx="2"
                            />
                            <text
                              x="0"
                              y="0"
                              textAnchor="middle"
                              dominantBaseline="central"
                              className={`${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-900 tracking-normal select-none`}
                              style={{
                                fontSize: `${Math.min(10.5, Math.max(8.0, h.housePxW * 0.18))}px`,
                                paintOrder: 'stroke fill',
                                stroke: '#ffffff',
                                strokeWidth: isBoundaryBold ? '2.5px' : '1.2px',
                              }}
                            >
                              {h.houseLDisplay}
                            </text>
                          </g>
                        );
                      })()}

                      {/* West / Left Inside Edge - Length (Rotated -90°) */}
                      {h.housePxW >= 55 && (() => {
                        const posX = h.hx1 + Math.min(13, h.housePxW * 0.22);
                        const textW = Math.max(26, h.houseLDisplay.length * 6.8 + 8);
                        return (
                          <g id={`house-dim-inside-west-${idx}`} transform={`translate(${posX}, ${h.hCenterY}) rotate(-90)`}>
                            <rect
                              x={-textW / 2}
                              y={-6.5}
                              width={textW}
                              height={13}
                              fill="#ffffff"
                              stroke="none"
                              rx="2"
                            />
                            <text
                              x="0"
                              y="0"
                              textAnchor="middle"
                              dominantBaseline="central"
                              className={`${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-900 tracking-normal select-none`}
                              style={{
                                fontSize: `${Math.min(10.5, Math.max(8.0, h.housePxW * 0.18))}px`,
                                paintOrder: 'stroke fill',
                                stroke: '#ffffff',
                                strokeWidth: isBoundaryBold ? '2.5px' : '1.2px',
                              }}
                            >
                              {h.houseLDisplay}
                            </text>
                          </g>
                        );
                      })()}

                      {/* South / Bottom Inside Edge - Width */}
                      {h.housePxH >= 55 && (() => {
                        const dimY = h.hy2 - Math.min(13, h.housePxH * 0.22);
                        const textW = Math.max(26, h.houseWDisplay.length * 6.8 + 8);
                        return (
                          <g id={`house-dim-inside-south-${idx}`}>
                            <rect
                              x={h.hCenterX - textW / 2}
                              y={dimY - 6.5}
                              width={textW}
                              height={13}
                              fill="#ffffff"
                              stroke="none"
                              rx="2"
                            />
                            <text
                              x={h.hCenterX}
                              y={dimY}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className={`${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-900 tracking-normal select-none`}
                              style={{
                                fontSize: `${Math.min(10.5, Math.max(8.0, h.housePxH * 0.18))}px`,
                                paintOrder: 'stroke fill',
                                stroke: '#ffffff',
                                strokeWidth: isBoundaryBold ? '2.5px' : '1.2px',
                              }}
                            >
                              {h.houseWDisplay}
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  )}

                  {/* 7. Setbacks - ONLY entered setbacks with dashed extension line from house wall to plot boundary */}
                  {h.showSetbacks && (
                    <g id={`house-setbacks-group-${idx}`}>
                      {/* North Setback (Horizontal 0°, matching North house dimension) */}
                      {h.canShowNorthSetback && (() => {
                        const textW = Math.max(24, h.rearSetbackText.length * 5.8 + 8);
                        return (
                          <g id={`setback-north-${idx}`}>
                            {/* Dashed line from plot boundary to house north edge */}
                            <line
                              x1={h.northPosX}
                              y1={h.northPlotEdgeY}
                              x2={h.northPosX}
                              y2={h.hy1}
                              stroke="#334155"
                              strokeWidth="1.2"
                              strokeDasharray="4 2.5"
                            />
                            {/* Tick marks at ends */}
                            <line
                              x1={h.northPosX - 3.5}
                              y1={h.northPlotEdgeY}
                              x2={h.northPosX + 3.5}
                              y2={h.northPlotEdgeY}
                              stroke="#334155"
                              strokeWidth="1.2"
                            />
                            <line
                              x1={h.northPosX - 3.5}
                              y1={h.hy1}
                              x2={h.northPosX + 3.5}
                              y2={h.hy1}
                              stroke="#334155"
                              strokeWidth="1.2"
                            />
                            {/* Label horizontal (matching North house dimension) */}
                            <rect
                              x={h.northPosX - textW / 2}
                              y={h.northSetbackY - 5.5}
                              width={textW}
                              height={11}
                              fill="#ffffff"
                              stroke="none"
                              rx="2"
                            />
                            <text
                              x={h.northPosX}
                              y={h.northSetbackY}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className={`text-[8px] ${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-800 select-none font-sans`}
                              style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.2px' : '1.1px' }}
                            >
                              {h.rearSetbackText}
                            </text>
                          </g>
                        );
                      })()}

                      {/* South Setback (Horizontal 0°, matching South house dimension) */}
                      {h.canShowSouthSetback && (() => {
                        const textW = Math.max(24, h.frontSetbackText.length * 5.8 + 8);
                        return (
                          <g id={`setback-south-${idx}`}>
                            {/* Dashed line from house south edge to plot boundary */}
                            <line
                              x1={h.southPosX}
                              y1={h.hy2}
                              x2={h.southPosX}
                              y2={h.southPlotEdgeY}
                              stroke="#334155"
                              strokeWidth="1.2"
                              strokeDasharray="4 2.5"
                            />
                            {/* Tick marks at ends */}
                            <line
                              x1={h.southPosX - 3.5}
                              y1={h.hy2}
                              x2={h.southPosX + 3.5}
                              y2={h.hy2}
                              stroke="#334155"
                              strokeWidth="1.2"
                            />
                            <line
                              x1={h.southPosX - 3.5}
                              y1={h.southPlotEdgeY}
                              x2={h.southPosX + 3.5}
                              y2={h.southPlotEdgeY}
                              stroke="#334155"
                              strokeWidth="1.2"
                            />
                            {/* Label horizontal (matching South house dimension) */}
                            <rect
                              x={h.southPosX - textW / 2}
                              y={h.southSetbackY - 5.5}
                              width={textW}
                              height={11}
                              fill="#ffffff"
                              stroke="none"
                              rx="2"
                            />
                            <text
                              x={h.southPosX}
                              y={h.southSetbackY}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className={`text-[8px] ${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-800 select-none font-sans`}
                              style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.2px' : '1.1px' }}
                            >
                              {h.frontSetbackText}
                            </text>
                          </g>
                        );
                      })()}

                      {/* West Setback (Rotated -90°, matching West house dimension) */}
                      {h.canShowWestSetback && (() => {
                        const textW = Math.max(24, h.westSetbackText.length * 5.8 + 8);
                        return (
                          <g id={`setback-west-${idx}`}>
                            {/* Dashed line from west plot boundary to house west edge */}
                            <line
                              x1={h.westPlotEdgeX}
                              y1={h.westPosY}
                              x2={h.hx1}
                              y2={h.westPosY}
                              stroke="#334155"
                              strokeWidth="1.2"
                              strokeDasharray="4 2.5"
                            />
                            {/* Tick marks at ends */}
                            <line
                              x1={h.westPlotEdgeX}
                              y1={h.westPosY - 3.5}
                              x2={h.westPlotEdgeX}
                              y2={h.westPosY + 3.5}
                              stroke="#334155"
                              strokeWidth="1.2"
                            />
                            <line
                              x1={h.hx1}
                              y1={h.westPosY - 3.5}
                              x2={h.hx1}
                              y2={h.westPosY + 3.5}
                              stroke="#334155"
                              strokeWidth="1.2"
                            />
                            {/* Label rotated -90° (matching West house dimension) */}
                            <g transform={`translate(${h.westSetbackX}, ${h.westPosY}) rotate(-90)`}>
                              <rect
                                x={-textW / 2}
                                y={-5.5}
                                width={textW}
                                height={11}
                                fill="#ffffff"
                                stroke="none"
                                rx="2"
                              />
                              <text
                                x="0"
                                y="0"
                                textAnchor="middle"
                                dominantBaseline="central"
                                className={`text-[8px] ${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-800 select-none font-sans`}
                                style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.2px' : '1.1px' }}
                              >
                                {h.westSetbackText}
                              </text>
                            </g>
                          </g>
                        );
                      })()}

                      {/* East Setback (Rotated 90°, matching East house dimension) */}
                      {h.canShowEastSetback && (() => {
                        const textW = Math.max(24, h.eastSetbackText.length * 5.8 + 8);
                        return (
                          <g id={`setback-east-${idx}`}>
                            {/* Dashed line from house east edge to east plot boundary */}
                            <line
                              x1={h.hx2}
                              y1={h.eastPosY}
                              x2={h.eastPlotEdgeX}
                              y2={h.eastPosY}
                              stroke="#334155"
                              strokeWidth="1.2"
                              strokeDasharray="4 2.5"
                            />
                            {/* Tick marks at ends */}
                            <line
                              x1={h.hx2}
                              y1={h.eastPosY - 3.5}
                              x2={h.hx2}
                              y2={h.eastPosY + 3.5}
                              stroke="#334155"
                              strokeWidth="1.2"
                            />
                            <line
                              x1={h.eastPlotEdgeX}
                              y1={h.eastPosY - 3.5}
                              x2={h.eastPlotEdgeX}
                              y2={h.eastPosY + 3.5}
                              stroke="#334155"
                              strokeWidth="1.2"
                            />
                            {/* Label rotated 90° (matching East house dimension) */}
                            <g transform={`translate(${h.eastSetbackX}, ${h.eastPosY}) rotate(90)`}>
                              <rect
                                x={-textW / 2}
                                y={-5.5}
                                width={textW}
                                height={11}
                                fill="#ffffff"
                                stroke="none"
                                rx="2"
                              />
                              <text
                                x="0"
                                y="0"
                                textAnchor="middle"
                                dominantBaseline="central"
                                className={`text-[8px] ${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-800 select-none font-sans`}
                                style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.2px' : '1.1px' }}
                              >
                                {h.eastSetbackText}
                              </text>
                            </g>
                          </g>
                        );
                      })()}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* ================= PLOT CENTER TEXT: AREA UNDER REGN. & PLOT BADGE IN MIDDLE ================= */}
        {/* Aligned along whichever plot dimension is longer */}
        {!isHouseActive && (() => {
          const isPlotVertical = avgPlotL > avgPlotW;
          const isDemolishedHouse = property.propertyType === 'Demolished House';
          const isOpenPlaceOrPart = property.propertyType === 'Open Place' || property.propertyType === 'Part Open Place';

          const plotNoText = property.plotNo ? `PLOT NO: ${property.plotNo.toUpperCase()}` : '';
          const showPlotNo = !isDemolishedHouse && !isOpenPlaceOrPart && !!plotNoText;
          const areaUnderRegnText = 'AREA UNDER REGISTRATION';

          let badgeW = 165;
          let badgeH = 28;

          if (isDemolishedHouse) {
            badgeW = 160;
            badgeH = 28;
          } else if (showPlotNo) {
            badgeH = 36;
            badgeW = Math.max(165, Math.max(plotNoText.length * 8.5, areaUnderRegnText.length * 7.2) + 26);
          } else {
            // Open Place, Part Open Place, or Plot without Plot No
            badgeH = 28;
            badgeW = Math.max(165, areaUnderRegnText.length * 7.2 + 24);
          }

          const maxSpan = isPlotVertical ? minPlotH : minPlotW;
          const crossSpan = isPlotVertical ? minPlotW : minPlotH;

          const plotTextScale = Math.min(
            1.0,
            Math.max(0.5, Math.min((maxSpan * 0.76) / badgeW, (crossSpan * 0.54) / badgeH))
          );

          return (
            <g
              id="plot-center-area-under-regn"
              transform={`translate(${centerX}, ${centerY}) rotate(${getUprightAngle(isPlotVertical ? -90 : 0, mapRot)}) scale(${plotTextScale})`}
            >
              <rect
                x={-badgeW / 2}
                y={-badgeH / 2}
                width={badgeW}
                height={badgeH}
                rx="3"
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="1.2"
              />
              {isDemolishedHouse ? (
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`text-[11px] ${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-900 tracking-wider font-sans uppercase`}
                  style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '0.5px' }}
                >
                  DEMOLISHED HOUSE
                </text>
              ) : showPlotNo ? (
                <>
                  <text
                    x="0"
                    y="-7"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`text-[11.5px] ${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-900 tracking-wider font-sans`}
                  >
                    {plotNoText}
                  </text>
                  <text
                    x="0"
                    y="7.5"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`text-[8.5px] ${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-800 tracking-wider font-sans uppercase`}
                  >
                    {areaUnderRegnText}
                  </text>
                </>
              ) : (
                /* Open Place, Part Open Place, or Plot without Plot No */
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`text-[10px] ${isBoundaryBold ? 'font-bold' : 'font-semibold'} fill-slate-900 tracking-wider font-sans uppercase`}
                  style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: '0.5px' }}
                >
                  {areaUnderRegnText}
                </text>
              )}
            </g>
          );
        })()}
        {/* ================= ALIGNED DIMENSION LINES & BOUNDARIES (SMART AUTO-ADJUSTMENT TO CLEAR/EMPTY SPACE) ================= */}
        {(() => {
          interface ObstacleBox {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
          }

          const sketchObstacles: ObstacleBox[] = [];

          // 1. Add all house structures (with buffer for walls & entry steps)
          renderedHouses.forEach((h) => {
            sketchObstacles.push({
              x1: h.hx1 - 4,
              y1: h.hy1 - 4,
              x2: h.hx2 + 4,
              y2: h.hy2 + 4,
            });
            if (h.canProtrudeNorthEntry) {
              sketchObstacles.push({
                x1: h.hCenterX - 20,
                y1: h.hy1 - 16,
                x2: h.hCenterX + 20,
                y2: h.hy1,
              });
            }
            if (h.canProtrudeSouthEntry) {
              sketchObstacles.push({
                x1: h.hCenterX - 20,
                y1: h.hy2,
                x2: h.hCenterX + 20,
                y2: h.hy2 + 16,
              });
            }
            // Add entered setbacks so plot dimension automatically stays clear of setback dashed lines & labels
            if (h.showSetbacks) {
              if (h.canShowNorthSetback) {
                const sbW = Math.max(30, h.rearSetbackText.length * 6 + 12);
                sketchObstacles.push({
                  x1: h.northPosX - sbW / 2 - 4,
                  y1: Math.min(h.northPlotEdgeY, h.hy1) - 2,
                  x2: h.northPosX + sbW / 2 + 4,
                  y2: Math.max(h.northPlotEdgeY, h.hy1) + 2,
                });
              }
              if (h.canShowSouthSetback) {
                const sbW = Math.max(30, h.frontSetbackText.length * 6 + 12);
                sketchObstacles.push({
                  x1: h.southPosX - sbW / 2 - 4,
                  y1: Math.min(h.hy2, h.southPlotEdgeY) - 2,
                  x2: h.southPosX + sbW / 2 + 4,
                  y2: Math.max(h.hy2, h.southPlotEdgeY) + 2,
                });
              }
              if (h.canShowWestSetback) {
                const sbW = Math.max(30, h.westSetbackText.length * 6 + 12);
                sketchObstacles.push({
                  x1: Math.min(h.westPlotEdgeX, h.hx1) - 2,
                  y1: h.westPosY - 10,
                  x2: Math.max(h.westPlotEdgeX, h.hx1) + 2,
                  y2: h.westPosY + 10,
                });
              }
              if (h.canShowEastSetback) {
                const sbW = Math.max(30, h.eastSetbackText.length * 6 + 12);
                sketchObstacles.push({
                  x1: Math.min(h.hx2, h.eastPlotEdgeX) - 2,
                  y1: h.eastPosY - 10,
                  x2: Math.max(h.hx2, h.eastPlotEdgeX) + 2,
                  y2: h.eastPosY + 10,
                });
              }
            }
          });

          // 2. Add center plot badge (when no house is active)
          if (!isHouseActive) {
            sketchObstacles.push({
              x1: centerX - 85,
              y1: centerY - 28,
              x2: centerX + 85,
              y2: centerY + 28,
            });
          }

          // Helper to check if a point is strictly inside the plot polygon
          const isPointStrictlyInsidePlot = (px: number, py: number): boolean => {
            const vs = [
              { x: ax, y: ay },
              { x: bx, y: by },
              { x: cx, y: cy },
              { x: dx, y: dy },
            ];
            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
              const xi = vs[i].x, yi = vs[i].y;
              const xj = vs[j].x, yj = vs[j].y;
              const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
              if (intersect) inside = !inside;
            }
            return inside;
          };

          // Function to find clear/empty position along or near a boundary, strictly inside the plot boundary line
          const findOptimalDimension = (
            p1: { x: number; y: number },
            p2: { x: number; y: number },
            normalOut: { x: number; y: number },
            dimText: string
          ) => {
            const textWidth = Math.max(34, dimText.length * 7.2 + 14);
            const textHeight = 15;
            const halfW = textWidth / 2;
            const halfH = textHeight / 2;

            const edx = p2.x - p1.x;
            const edy = p2.y - p1.y;
            const edgeLen = Math.hypot(edx, edy) || 1;
            const uEdgeX = edx / edgeLen;
            const uEdgeY = edy / edgeLen;

            // Candidate positions along edge (u = 0.5 is centered, shifts if obstacles exist)
            const uValues = [0.5, 0.44, 0.56, 0.38, 0.62, 0.30, 0.70, 0.22, 0.78, 0.15, 0.85];
            // Inward offsets (strictly negative = inside the plot boundary line, close to line with zero overlap)
            const inOffsets = [-10, -12, -14, -17, -20, -24, -28, -34];

            const candidates: Array<{ x: number; y: number; u: number; offset: number }> = [];

            for (const u of uValues) {
              for (const off of inOffsets) {
                const baseX = p1.x + u * edx;
                const baseY = p1.y + u * edy;
                const candX = baseX + normalOut.x * off;
                const candY = baseY + normalOut.y * off;
                candidates.push({ x: candX, y: candY, u, offset: off });
              }
            }

            let bestCand = candidates[0];
            let bestScore = -Infinity;
            let bestCorners = [
              { x: bestCand.x - halfW, y: bestCand.y - halfH },
              { x: bestCand.x + halfW, y: bestCand.y - halfH },
              { x: bestCand.x + halfW, y: bestCand.y + halfH },
              { x: bestCand.x - halfW, y: bestCand.y + halfH },
            ];

            for (const cand of candidates) {
              // Exact oriented corners corresponding to rotated text bounding box:
              const c1 = {
                x: cand.x + uEdgeX * halfW + normalOut.x * halfH,
                y: cand.y + uEdgeY * halfW + normalOut.y * halfH,
              };
              const c2 = {
                x: cand.x + uEdgeX * halfW - normalOut.x * halfH,
                y: cand.y + uEdgeY * halfW - normalOut.y * halfH,
              };
              const c3 = {
                x: cand.x - uEdgeX * halfW + normalOut.x * halfH,
                y: cand.y - uEdgeY * halfW + normalOut.y * halfH,
              };
              const c4 = {
                x: cand.x - uEdgeX * halfW - normalOut.x * halfH,
                y: cand.y - uEdgeY * halfW - normalOut.y * halfH,
              };

              const box = {
                x1: Math.min(c1.x, c2.x, c3.x, c4.x),
                y1: Math.min(c1.y, c2.y, c3.y, c4.y),
                x2: Math.max(c1.x, c2.x, c3.x, c4.x),
                y2: Math.max(c1.y, c2.y, c3.y, c4.y),
              };

              // Check if candidate center and corners are strictly inside the plot polygon
              const cornersInside = [
                isPointStrictlyInsidePlot(cand.x, cand.y),
                isPointStrictlyInsidePlot(c1.x, c1.y),
                isPointStrictlyInsidePlot(c2.x, c2.y),
                isPointStrictlyInsidePlot(c3.x, c3.y),
                isPointStrictlyInsidePlot(c4.x, c4.y),
              ];
              const insideCount = cornersInside.filter(Boolean).length;
              if (insideCount < 3) {
                // Not inside the plot boundaries - skip
                continue;
              }

              let collisionScore = 0;
              let minObsDistance = Infinity;

              for (const obs of sketchObstacles) {
                const overlapX = Math.max(0, Math.min(box.x2, obs.x2) - Math.max(box.x1, obs.x1));
                const overlapY = Math.max(0, Math.min(box.y2, obs.y2) - Math.max(box.y1, obs.y1));
                const overlapArea = overlapX * overlapY;

                if (overlapArea > 0) {
                  collisionScore += 1200 + overlapArea * 12;
                }

                const obsMidX = (obs.x1 + obs.x2) / 2;
                const obsMidY = (obs.y1 + obs.y2) / 2;
                const dist = Math.hypot(cand.x - obsMidX, cand.y - obsMidY);
                if (dist < minObsDistance) {
                  minObsDistance = dist;
                }
              }

              let score = 600 - collisionScore;
              // Strongly reward all 4 corners being safely inside the plot
              score += insideCount * 45;
              // Prefer natural centered positioning in the middle (u = 0.5)
              score += (1 - Math.abs(cand.u - 0.5) * 2) * 80;
              if (cand.u === 0.5) {
                score += 50;
              }
              // Prefer close-to-line inward offsets (-10 to -12)
              if (cand.offset === -10) score += 55;
              else if (cand.offset === -12) score += 50;
              else if (cand.offset === -14) score += 35;
              else if (cand.offset === -17) score += 25;
              else if (cand.offset === -20) score += 15;

              score += Math.min(50, minObsDistance * 0.4);

              if (score > bestScore) {
                bestScore = score;
                bestCand = cand;
                bestCorners = [c1, c2, c3, c4];
              }
            }

            // Register placed box to obstacles to prevent collision with next dimensions
            const placedBox = {
              x1: Math.min(...bestCorners.map(c => c.x)) - 3,
              y1: Math.min(...bestCorners.map(c => c.y)) - 3,
              x2: Math.max(...bestCorners.map(c => c.x)) + 3,
              y2: Math.max(...bestCorners.map(c => c.y)) + 3,
            };
            sketchObstacles.push(placedBox);

            return {
              dimX: bestCand.x,
              dimY: bestCand.y,
              textWidth,
            };
          };

          // NORTH
          const northText = northBoundary.trim() || 'ADJACENT PROPERTY';
          const northLines = getBoundaryLines(northText, lenAB);
          const northPlacement = findOptimalDimension(
            { x: ax, y: ay },
            { x: bx, y: by },
            { x: nABx, y: nABy },
            nText
          );
          const northDimAngle = getUprightAngle(angleAB, mapRot);
          const northMidX = (ax + bx) / 2;
          const northMidY = (ay + by) / 2;
          const northOffset = 18 + ((northLines.length * 12) / 2);
          const northBoundX = northMidX + nABx * northOffset;
          const northBoundY = northMidY + nABy * northOffset;

          // SOUTH
          const southText = southBoundary.trim() || 'ADJACENT PROPERTY';
          const southLines = getBoundaryLines(southText, lenDC);
          const southPlacement = findOptimalDimension(
            { x: dx, y: dy },
            { x: cx, y: cy },
            { x: nDCx, y: nDCy },
            sText
          );
          const southDimAngle = getUprightAngle(angleDC, mapRot);
          const southMidX = (dx + cx) / 2;
          const southMidY = (dy + cy) / 2;
          const southOffset = 18 + ((southLines.length * 12) / 2);
          const southBoundX = southMidX + nDCx * southOffset;
          const southBoundY = southMidY + nDCy * southOffset;

          // WEST
          const westText = westBoundary.trim() || 'ADJACENT PROPERTY';
          const westLines = getBoundaryLines(westText, lenAD);
          const westPlacement = findOptimalDimension(
            { x: ax, y: ay },
            { x: dx, y: dy },
            { x: nADx, y: nADy },
            wText
          );
          const westDimAngle = getUprightAngle(angleAD, mapRot);
          const westMidX = (ax + dx) / 2;
          const westMidY = (ay + dy) / 2;
          const westOffset = 18 + ((westLines.length * 12) / 2);
          const westBoundX = westMidX + nADx * westOffset;
          const westBoundY = westMidY + nADy * westOffset;

          // EAST
          const eastText = eastBoundary.trim() || 'ADJACENT PROPERTY';
          const eastLines = getBoundaryLines(eastText, lenBC);
          const eastPlacement = findOptimalDimension(
            { x: bx, y: by },
            { x: cx, y: cy },
            { x: nBCx, y: nBCy },
            eText
          );
          const eastDimAngle = getUprightAngle(angleBC, mapRot);
          const eastMidX = (bx + cx) / 2;
          const eastMidY = (by + cy) / 2;
          const eastOffset = 18 + ((eastLines.length * 12) / 2);
          const eastBoundX = eastMidX + nBCx * eastOffset;
          const eastBoundY = eastMidY + nBCy * eastOffset;

          return (
            <>
              {/* NORTH DIMENSION & BOUNDARY */}
              <g id="north-dim-and-boundary">
                <g transform={`rotate(${northDimAngle}, ${northPlacement.dimX}, ${northPlacement.dimY})`}>
                  {/* Clean white protective backdrop mask to guarantee zero line clash */}
                  <rect
                    x={northPlacement.dimX - northPlacement.textWidth / 2}
                    y={northPlacement.dimY - 8}
                    width={northPlacement.textWidth}
                    height={16}
                    fill="#ffffff"
                    stroke="none"
                    rx="3"
                  />
                  <text
                    x={northPlacement.dimX}
                    y={northPlacement.dimY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`text-[12px] ${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal`}
                    style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.5px' : '1.4px' }}
                  >
                    {nText}
                  </text>
                </g>
                {!hasNorthRoad && (
                  <g transform={`rotate(${northDimAngle}, ${northBoundX}, ${northBoundY})`}>
                    {renderBoundaryLines(northLines, northBoundX, northBoundY)}
                  </g>
                )}
              </g>

              {/* SOUTH DIMENSION & BOUNDARY */}
              <g id="south-dim-and-boundary">
                <g transform={`rotate(${southDimAngle}, ${southPlacement.dimX}, ${southPlacement.dimY})`}>
                  <rect
                    x={southPlacement.dimX - southPlacement.textWidth / 2}
                    y={southPlacement.dimY - 8}
                    width={southPlacement.textWidth}
                    height={16}
                    fill="#ffffff"
                    stroke="none"
                    rx="3"
                  />
                  <text
                    x={southPlacement.dimX}
                    y={southPlacement.dimY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`text-[12px] ${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal`}
                    style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.5px' : '1.4px' }}
                  >
                    {sText}
                  </text>
                </g>
                {!hasSouthRoad && (
                  <g transform={`rotate(${southDimAngle}, ${southBoundX}, ${southBoundY})`}>
                    {renderBoundaryLines(southLines, southBoundX, southBoundY)}
                  </g>
                )}
              </g>

              {/* WEST DIMENSION & BOUNDARY */}
              <g id="west-dim-and-boundary">
                <g transform={`rotate(${westDimAngle}, ${westPlacement.dimX}, ${westPlacement.dimY})`}>
                  <rect
                    x={westPlacement.dimX - westPlacement.textWidth / 2}
                    y={westPlacement.dimY - 8}
                    width={westPlacement.textWidth}
                    height={16}
                    fill="#ffffff"
                    stroke="none"
                    rx="3"
                  />
                  <text
                    x={westPlacement.dimX}
                    y={westPlacement.dimY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`text-[12px] ${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal`}
                    style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.5px' : '1.4px' }}
                  >
                    {wText}
                  </text>
                </g>
                {!hasWestRoad && (
                  <g transform={`rotate(${westDimAngle}, ${westBoundX}, ${westBoundY})`}>
                    {renderBoundaryLines(westLines, westBoundX, westBoundY)}
                  </g>
                )}
              </g>

              {/* EAST DIMENSION & BOUNDARY */}
              <g id="east-dim-and-boundary">
                <g transform={`rotate(${eastDimAngle}, ${eastPlacement.dimX}, ${eastPlacement.dimY})`}>
                  <rect
                    x={eastPlacement.dimX - eastPlacement.textWidth / 2}
                    y={eastPlacement.dimY - 8}
                    width={eastPlacement.textWidth}
                    height={16}
                    fill="#ffffff"
                    stroke="none"
                    rx="3"
                  />
                  <text
                    x={eastPlacement.dimX}
                    y={eastPlacement.dimY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`text-[12px] ${isBoundaryBold ? 'font-bold' : 'font-normal'} fill-slate-900 tracking-normal`}
                    style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: isBoundaryBold ? '2.5px' : '1.4px' }}
                  >
                    {eText}
                  </text>
                </g>
                {!hasEastRoad && (
                  <g transform={`rotate(${eastDimAngle}, ${eastBoundX}, ${eastBoundY})`}>
                    {renderBoundaryLines(eastLines, eastBoundX, eastBoundY)}
                  </g>
                )}
              </g>
            </>
          );
        })()}
        </g>

        {/* ================= CORNER PROPERTY INDICATOR REMOVED ================= */}

        {/* Bottom corner cadastral notice */}
        <text
          x={30}
          y={minY + effectiveBoxHeight - 16}
          className="text-[8px] font-medium fill-black italic"
        >
          * Plan Prepared for Registration Purpose (Not to Civil Scale)
        </text>
      </svg>
    </div>
  );
};
