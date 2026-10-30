import React, { useState, useEffect, useRef } from 'react';
import { BoundaryDimensions, DimensionUnit, RoadSideOption, RoadLayoutType, DeadEndType, DeadEndSide } from '../types';
import { parseDimension, extractRoadWidthFromBoundary, isRoadSegment, formatSegmentBoundaryText, sanitizeRoadBoundaryString } from '../utils/dimensionUtils';
import { Compass, Sparkles, Navigation, Layers, GitMerge, ShieldAlert, Camera, RotateCw, Sliders, FileUp, Trash2, X } from 'lucide-react';

interface BoundariesFormProps {
  boundaries: BoundaryDimensions;
  onChange: (updated: BoundaryDimensions) => void;
  onGenerateSketch?: () => void;
  onUploadManualPlan?: () => void;
}

export const BoundariesForm: React.FC<BoundariesFormProps> = ({
  boundaries,
  onChange,
  onGenerateSketch,
  onUploadManualPlan,
}) => {
  const [plotNumbersInput, setPlotNumbersInput] = useState<string>(
    boundaries.multiPlot?.plotNumbers ? boundaries.multiPlot.plotNumbers.join(', ') : ''
  );
  const isInternalPlotNumUpdateRef = useRef(false);

  useEffect(() => {
    if (isInternalPlotNumUpdateRef.current) {
      isInternalPlotNumUpdateRef.current = false;
      return;
    }
    setPlotNumbersInput(
      boundaries.multiPlot?.plotNumbers ? boundaries.multiPlot.plotNumbers.join(', ') : ''
    );
  }, [boundaries.multiPlot?.plotNumbers]);

  const handleUnitToggle = (newUnit: DimensionUnit) => {
    // Re-parse existing raw inputs with the new unit
    const updated: BoundaryDimensions = {
      ...boundaries,
      dimensionUnit: newUnit,
      northDim: parseDimension(boundaries.northDim.raw, newUnit),
      southDim: parseDimension(boundaries.southDim.raw, newUnit),
      eastDim: parseDimension(boundaries.eastDim.raw, newUnit),
      westDim: parseDimension(boundaries.westDim.raw, newUnit),
    };
    if (boundaries.roadWidth) {
      const roadWidthParsed = parseDimension(boundaries.roadWidth, newUnit);
      updated.roadWidth = roadWidthParsed.raw;
    }
    onChange(updated);
  };

  const handleDimChange = (
    side: 'northDim' | 'southDim' | 'eastDim' | 'westDim',
    val: string
  ) => {
    const parsed = parseDimension(val, boundaries.dimensionUnit);
    onChange({
      ...boundaries,
      [side]: parsed,
    });
  };

  const handleRoadSideToggle = (side: RoadSideOption) => {
    if (side === 'None') {
      onChange({
        ...boundaries,
        roadSides: [],
      });
      return;
    }

    let nextSides = [...boundaries.roadSides];
    if (nextSides.includes(side)) {
      nextSides = nextSides.filter((s) => s !== side);
    } else {
      if (boundaries.cornerProperty || nextSides.length >= 1) {
        nextSides.push(side);
      } else {
        // Single road side if not corner
        nextSides = [side];
      }
    }
    const isCorner = nextSides.length > 1;
    onChange({
      ...boundaries,
      roadSides: nextSides,
      cornerProperty: isCorner ? true : boundaries.cornerProperty,
    });
  };

  const handleCornerToggle = (isCorner: boolean) => {
    let nextSides = [...boundaries.roadSides];
    if (isCorner && nextSides.length === 1) {
      // Auto suggest adjacent side if corner
      if (nextSides.includes('South') && !nextSides.includes('East')) {
        nextSides.push('East');
      } else if (nextSides.includes('North') && !nextSides.includes('East')) {
        nextSides.push('East');
      }
    }
    onChange({
      ...boundaries,
      cornerProperty: isCorner,
      roadSides: nextSides,
    });
  };

  const handleBoundaryChange = (
    field: 'northBoundary' | 'southBoundary' | 'eastBoundary' | 'westBoundary',
    value: string
  ) => {
    const sideMap: Record<string, RoadSideOption> = {
      northBoundary: 'North',
      southBoundary: 'South',
      eastBoundary: 'East',
      westBoundary: 'West',
    };
    const side = sideMap[field];
    let nextSides = [...boundaries.roadSides];
    const isRoadText = /road|rasta|street|lane\b/i.test(value);
    const wasRoad = /road|rasta|street|lane\b/i.test(boundaries[field] || '');

    if (isRoadText && !nextSides.includes(side)) {
      nextSides.push(side);
    } else if (!isRoadText && wasRoad && nextSides.includes(side)) {
      nextSides = nextSides.filter((s) => s !== side);
    }

    const isCorner = nextSides.length > 1;

    onChange({
      ...boundaries,
      [field]: value,
      roadSides: nextSides,
      cornerProperty: isCorner ? true : boundaries.cornerProperty,
    });
  };


  const handleLoadTriangleForkSample = () => {
    const updated: BoundaryDimensions = {
      ...boundaries,
      northBoundary: "20' ROAD",
      northDim: parseDimension("70'", 'Feet'),
      southBoundary: "25' ROAD",
      southDim: parseDimension("60'", 'Feet'),
      eastBoundary: "NEIGHBOUR PROPERTY",
      eastDim: parseDimension("40'", 'Feet'),
      westBoundary: "ROAD FORK / JUNCTION",
      westDim: parseDimension("0'", 'Feet'),
      roadWidth: "20'-0\"",
      roadSides: ['North', 'South'],
      cornerProperty: true,
      dimensionUnit: 'Feet',
      highlightBoundaryRed: true,
      dimensionLineStyle: 'arrows',
      plotGeometryType: 'triangle-fork',
      triangleFork: {
        enabled: true,
        topDim: "70'",
        bottomDim: "60'",
        rightDim: "40'",
        topRoadName: "20' ROAD",
        bottomRoadName: "25' ROAD",
        topRoadWidth: "20'",
        bottomRoadWidth: "25'",
        stemRoadWidth: "25'",
        stemRoadName: "ROAD",
        forkAngleDegrees: 32,
      },
      multiPlot: {
        ...boundaries.multiPlot!,
        enabled: false,
      },
    };
    onChange(updated);
  };

  const handleAutoFillFromSketch = () => {
    // Logic extracted from the provided handwritten sketch
    const updated: BoundaryDimensions = {
      ...boundaries,
      northBoundary: "20' ROAD",
      northDim: parseDimension("70'", 'Feet'),
      southBoundary: "25' ROAD",
      southDim: parseDimension("60'", 'Feet'),
      eastBoundary: "NEIGHBOUR PROPERTY",
      eastDim: parseDimension("40'", 'Feet'),
      westBoundary: "ROAD FORK / JUNCTION",
      westDim: parseDimension("0'", 'Feet'),
      roadWidth: "20'-0\"",
      roadSides: ['North', 'South'],
      cornerProperty: true,
      dimensionUnit: 'Feet',
      highlightBoundaryRed: true,
      dimensionLineStyle: 'arrows',
      plotGeometryType: 'triangle-fork',
      triangleFork: {
        enabled: true,
        topDim: "70'",
        bottomDim: "60'",
        rightDim: "40'",
        topRoadName: "20' ROAD",
        bottomRoadName: "25' ROAD",
        topRoadWidth: "20'",
        bottomRoadWidth: "25'",
        stemRoadWidth: "25'",
        stemRoadName: "ROAD",
        forkAngleDegrees: 32,
      },
      multiPlot: {
        ...boundaries.multiPlot!,
        enabled: false,
      },
    };
    onChange(updated);
  };

  const handleLoadMultiPlotSample = () => {
    const updated: BoundaryDimensions = {
      ...boundaries,
      northBoundary: "24' WIDE ROAD",
      northDim: parseDimension("90'", 'Feet'),
      southBoundary: "25' WIDE ROAD",
      southDim: parseDimension("90'", 'Feet'),
      westBoundary: "NEIGHBOUR PROPERTY",
      westDim: parseDimension("120'", 'Feet'),
      eastBoundary: "NEIGHBOUR PROPERTY",
      eastDim: parseDimension("120'", 'Feet'),
      roadWidth: "24'-0\"",
      roadSides: ['North', 'South'],
      cornerProperty: true,
      dimensionUnit: 'Feet',
      highlightBoundaryRed: true,
      dimensionLineStyle: 'arrows',
      multiPlot: {
        enabled: true,
        rows: 2,
        cols: 3,
        plotNumbers: ['6', '7', '8', '11', '10', '9'],
        plotDimensions: ["30' x 60'", "30' x 60'", "30' x 60'", "30' x 60'", "30' x 60'", "30' x 60'"],
        uniformDimension: "30' x 60'",
        showGridDimensions: true,
        extendDividersOutside: false,
        plotTextOrientation: 'horizontal',
      },
    };
    onChange(updated);
  };

  const handleEastWestSplit = (colsCount: number) => {
    const total = colsCount;
    const nos = Array.from({ length: total }, (_, i) => `${i + 1}`);
    onChange({
      ...boundaries,
      multiPlot: {
        enabled: true,
        rows: 1,
        cols: colsCount,
        plotNumbers: nos,
        uniformDimension: boundaries.multiPlot?.uniformDimension || "30' x 60'",
        plotDimensions: Array(total).fill(boundaries.multiPlot?.uniformDimension || "30' x 60'"),
        showGridDimensions: boundaries.multiPlot?.showGridDimensions ?? true,
        extendDividersOutside: boundaries.multiPlot?.extendDividersOutside ?? true,
        plotTextOrientation: boundaries.multiPlot?.plotTextOrientation || 'horizontal',
        autoAdjustTextScale: true,
        textScale: 100,
      },
      dimensionLineStyle: 'arrows',
    });
  };

  const handleNorthSouthSplit = (rowsCount: number) => {
    const total = rowsCount;
    const nos = Array.from({ length: total }, (_, i) => `${i + 1}`);
    onChange({
      ...boundaries,
      multiPlot: {
        enabled: true,
        rows: rowsCount,
        cols: 1,
        plotNumbers: nos,
        uniformDimension: boundaries.multiPlot?.uniformDimension || "30' x 60'",
        plotDimensions: Array(total).fill(boundaries.multiPlot?.uniformDimension || "30' x 60'"),
        showGridDimensions: boundaries.multiPlot?.showGridDimensions ?? true,
        extendDividersOutside: boundaries.multiPlot?.extendDividersOutside ?? true,
        plotTextOrientation: boundaries.multiPlot?.plotTextOrientation || 'vertical',
        autoAdjustTextScale: true,
        textScale: 100,
      },
      dimensionLineStyle: 'arrows',
    });
  };

  const handleWestSegmentChange = (idx: number, field: 'name' | 'dimension', val: string) => {
    const current = boundaries.westSegments && boundaries.westSegments.length === 2
      ? [...boundaries.westSegments]
      : [
          { name: 'OPEN PLOT NO.51 OF VENDORS', dimension: "45'" },
          { name: 'OPEN PLOT NOS.68 OF VENDORS', dimension: "45'" },
        ];
    current[idx] = { ...current[idx], [field]: val };
    
    const d0 = parseDimension(current[0].dimension, boundaries.dimensionUnit).normalized || 0;
    const d1 = parseDimension(current[1].dimension, boundaries.dimensionUnit).normalized || 0;
    const total = d0 + d1;
    const totalStr = total > 0 ? (boundaries.dimensionUnit === 'Feet' ? `${total}'-0"` : `${total}`) : boundaries.westDim.raw;

    const formattedBoundary = formatSegmentBoundaryText(current[0], current[1]);
    const isRoad = isRoadSegment(current[0].name) || isRoadSegment(current[1].name) || isRoadSegment(formattedBoundary);

    let nextSides = [...boundaries.roadSides];
    if (isRoad && !nextSides.includes('West')) {
      nextSides.push('West');
    } else if (!isRoad && nextSides.includes('West')) {
      nextSides = nextSides.filter((s) => s !== 'West');
    }

    onChange({
      ...boundaries,
      westSegments: current,
      westBoundary: formattedBoundary,
      westDim: total > 0 ? parseDimension(totalStr, boundaries.dimensionUnit) : boundaries.westDim,
      roadSides: nextSides,
      cornerProperty: nextSides.length > 1 ? true : boundaries.cornerProperty,
    });
  };

  const handleEastSegmentChange = (idx: number, field: 'name' | 'dimension', val: string) => {
    const current = boundaries.eastSegments && boundaries.eastSegments.length === 2
      ? [...boundaries.eastSegments]
      : [
          { name: 'OPEN PLOT NO.49 OF VENDORS', dimension: "45'" },
          { name: 'OPEN PLOT NO.70 OF VENDORS', dimension: "45'" },
        ];
    current[idx] = { ...current[idx], [field]: val };
    
    const d0 = parseDimension(current[0].dimension, boundaries.dimensionUnit).normalized || 0;
    const d1 = parseDimension(current[1].dimension, boundaries.dimensionUnit).normalized || 0;
    const total = d0 + d1;
    const totalStr = total > 0 ? (boundaries.dimensionUnit === 'Feet' ? `${total}'-0"` : `${total}`) : boundaries.eastDim.raw;

    const formattedBoundary = formatSegmentBoundaryText(current[0], current[1]);
    const isRoad = isRoadSegment(current[0].name) || isRoadSegment(current[1].name) || isRoadSegment(formattedBoundary);

    let nextSides = [...boundaries.roadSides];
    if (isRoad && !nextSides.includes('East')) {
      nextSides.push('East');
    } else if (!isRoad && nextSides.includes('East')) {
      nextSides = nextSides.filter((s) => s !== 'East');
    }

    onChange({
      ...boundaries,
      eastSegments: current,
      eastBoundary: formattedBoundary,
      eastDim: total > 0 ? parseDimension(totalStr, boundaries.dimensionUnit) : boundaries.eastDim,
      roadSides: nextSides,
      cornerProperty: nextSides.length > 1 ? true : boundaries.cornerProperty,
    });
  };

  const handleNorthSegmentChange = (idx: number, field: 'name' | 'dimension', val: string) => {
    const current = boundaries.northSegments && boundaries.northSegments.length === 2
      ? [...boundaries.northSegments]
      : [
          { name: 'NEIGHBOUR PROPERTY (PLOT 1)', dimension: "20'" },
          { name: 'NEIGHBOUR PROPERTY (PLOT 2)', dimension: "20'" },
        ];
    current[idx] = { ...current[idx], [field]: val };
    
    const d0 = parseDimension(current[0].dimension, boundaries.dimensionUnit).normalized || 0;
    const d1 = parseDimension(current[1].dimension, boundaries.dimensionUnit).normalized || 0;
    const total = d0 + d1;
    const totalStr = total > 0 ? (boundaries.dimensionUnit === 'Feet' ? `${total}'-0"` : `${total}`) : boundaries.northDim.raw;

    const formattedBoundary = formatSegmentBoundaryText(current[0], current[1]);
    const isRoad = isRoadSegment(current[0].name) || isRoadSegment(current[1].name) || isRoadSegment(formattedBoundary);

    let nextSides = [...boundaries.roadSides];
    if (isRoad && !nextSides.includes('North')) {
      nextSides.push('North');
    } else if (!isRoad && nextSides.includes('North')) {
      nextSides = nextSides.filter((s) => s !== 'North');
    }

    onChange({
      ...boundaries,
      northSegments: current,
      northBoundary: formattedBoundary,
      northDim: total > 0 ? parseDimension(totalStr, boundaries.dimensionUnit) : boundaries.northDim,
      roadSides: nextSides,
      cornerProperty: nextSides.length > 1 ? true : boundaries.cornerProperty,
    });
  };

  const handleSouthSegmentChange = (idx: number, field: 'name' | 'dimension', val: string) => {
    const current = boundaries.southSegments && boundaries.southSegments.length === 2
      ? [...boundaries.southSegments]
      : [
          { name: 'NEIGHBOUR PROPERTY (PLOT 1)', dimension: "20'" },
          { name: 'NEIGHBOUR PROPERTY (PLOT 2)', dimension: "20'" },
        ];
    current[idx] = { ...current[idx], [field]: val };
    
    const d0 = parseDimension(current[0].dimension, boundaries.dimensionUnit).normalized || 0;
    const d1 = parseDimension(current[1].dimension, boundaries.dimensionUnit).normalized || 0;
    const total = d0 + d1;
    const totalStr = total > 0 ? (boundaries.dimensionUnit === 'Feet' ? `${total}'-0"` : `${total}`) : boundaries.southDim.raw;

    const formattedBoundary = formatSegmentBoundaryText(current[0], current[1]);
    const isRoad = isRoadSegment(current[0].name) || isRoadSegment(current[1].name) || isRoadSegment(formattedBoundary);

    let nextSides = [...boundaries.roadSides];
    if (isRoad && !nextSides.includes('South')) {
      nextSides.push('South');
    } else if (!isRoad && nextSides.includes('South')) {
      nextSides = nextSides.filter((s) => s !== 'South');
    }

    onChange({
      ...boundaries,
      southSegments: current,
      southBoundary: formattedBoundary,
      southDim: total > 0 ? parseDimension(totalStr, boundaries.dimensionUnit) : boundaries.southDim,
      roadSides: nextSides,
      cornerProperty: nextSides.length > 1 ? true : boundaries.cornerProperty,
    });
  };

  return (
    <div id="section-boundaries-details" className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              3. Boundary & Dimension Details
            </h2>
            <p className="text-xs text-slate-500">
              Surrounding properties, cardinal dimensions, road alignments, and unit system
            </p>
          </div>
        </div>

        {/* Dimension Unit & Boundary Style Toggle */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Unit:</span>
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                id="btn-unit-feet"
                onClick={() => handleUnitToggle('Feet')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  boundaries.dimensionUnit === 'Feet'
                    ? 'bg-white text-rose-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Feet & Inches (e.g. 40'-5")
              </button>
              <button
                type="button"
                id="btn-unit-metres"
                onClick={() => handleUnitToggle('Metres')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  boundaries.dimensionUnit === 'Metres'
                    ? 'bg-white text-rose-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Metres (e.g. 12.35m)
              </button>
            </div>
          </div>

        </div>
      </div>


      {/* Quick Upload Banner for Hand-Drawn / Manual Sketch */}
      {onUploadManualPlan && (
        <div className="p-3.5 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-700 text-white rounded-lg shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                చేతితో గీసిన డ్రాయింగ్ ఉందా? (Have a Hand-Drawn Sketch?)
              </div>
              <div className="text-[11px] text-slate-600">
                ఫోటో అప్‌లోడ్ చేయగానే AI కొలతలు & రోడ్లను ఆటోమేటిక్ గా గుర్తించి సేమ్ టు సేమ్ డ్రాయింగ్ అందిస్తుంది.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onUploadManualPlan}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Upload Drawing / డ్రాయింగ్ అప్‌లోడ్
          </button>
        </div>
      )}




      {/* Triangular Fork Road Plot Setup Card (ఉదా: యూజర్ అప్‌లోడ్ చేసిన ఫోటోలోని త్రిభుజ ప్లాట్ & 20'-25' ఫోర్క్ రోడ్లు) */}
      <div className="p-4 bg-gradient-to-r from-slate-50 via-rose-50/30 to-slate-50 border border-slate-200 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-700 text-white rounded-lg shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Triangular Fork Road Plot (త్రిభుజాకార ప్లాట్ & ఫోర్క్ రోడ్ల లేఅవుట్ - 70' x 60' x 40')
                </h3>
                {boundaries.plotGeometryType === 'triangle-fork' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-700 text-white rounded-full">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                రెండు రోడ్లు ఒకే బిందువు వద్ద కలుసుకునే (Fork Junction) త్రిభుజాకార ప్లాట్ ప్లానింగ్ కోసం (ఉదా: 20' & 25' రోడ్లు).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleAutoFillFromSketch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all"
              title="అప్‌లోడ్ చేసిన స్కెచ్ నుండి ఆటోమేటిక్‌గా డేటాను నింపుతుంది"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Auto-Fill from Sketch (స్కెచ్ నుండి ఆటో-ఫిల్)</span>
            </button>
            <button
              type="button"
              onClick={handleLoadTriangleForkSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all"
              title="ఫోటోలోని త్రిభుజ ప్లాట్ (70'x60'x40') & 20'-25' ఫోర్క్ రోడ్ల శాంపిల్‌ను లోడ్ చేస్తుంది"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Triangle Fork Sample (ఫోటో శాంపిల్ లోడ్ చేయి)</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <input
              type="checkbox"
              id="checkbox-triangle-fork-enable"
              checked={boundaries.plotGeometryType === 'triangle-fork'}
              onChange={(e) =>
                onChange({
                  ...boundaries,
                  plotGeometryType: e.target.checked ? 'triangle-fork' : 'rectangular',
                  triangleFork: {
                    enabled: e.target.checked,
                    topDim: boundaries.northDim.raw || "70'",
                    bottomDim: boundaries.southDim.raw || "60'",
                    rightDim: boundaries.eastDim.raw || "40'",
                    topRoadName: boundaries.northBoundary || "20' ROAD",
                    bottomRoadName: boundaries.southBoundary || "25' ROAD",
                    topRoadWidth: "20'",
                    bottomRoadWidth: "25'",
                  },
                  multiPlot: {
                    ...boundaries.multiPlot!,
                    enabled: e.target.checked ? false : boundaries.multiPlot?.enabled || false,
                  },
                })
              }
              className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
            />
            <span className="text-xs font-bold text-slate-800">
              Enable Triangular Fork Plot Mode (త్రిభుజాకార ఫోర్క్ రోడ్ల మోడ్ ఆన్ చేయండి)
            </span>
          </label>

          {boundaries.plotGeometryType === 'triangle-fork' && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-600 font-medium">Sides: 70' (Top) / 60' (Bottom) / 40' (Right)</span>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Plot Grid Layout Setup Card (උദാ: 2x3 grid like user's uploaded photo) */}
      <div className="p-4 bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 border border-slate-200 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-700 text-white rounded-lg shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Multi-Plot Grid Layout (మల్టీ-ప్లాట్ గ్రిడ్ లేఅవుట్ - ఉదా: ఫోటోలోని 6 ప్లాట్లు)
                </h3>
                {boundaries.multiPlot?.enabled && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-700 text-white rounded-full">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                ఒకే పెద్ద స్థలంలో బహుళ ప్లాట్లు (ఉదా: 2 వరుసలు x 3 నిలువు వరసలు = 6 ప్లాట్లు) గ్రిడ్ రూపంలో చూపించడానికి.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleLoadMultiPlotSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all"
              title="ఫోటోలో ఉన్నట్లుగా 2 rows x 3 cols (6 plots: 6, 7, 8, 11, 10, 9) గ్రిడ్ శాంపిల్‌ను లోడ్ చేస్తుంది"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 6-Plots Grid Sample (6 ప్లాట్ల గ్రిడ్ శాంపిల్)</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <input
              type="checkbox"
              id="checkbox-multi-plot-enable"
              checked={Boolean(boundaries.multiPlot?.enabled)}
              onChange={(e) =>
                onChange({
                  ...boundaries,
                  multiPlot: {
                    enabled: e.target.checked,
                    rows: boundaries.multiPlot?.rows || 2,
                    cols: boundaries.multiPlot?.cols || 3,
                    plotNumbers: boundaries.multiPlot?.plotNumbers || ['6', '7', '8', '11', '10', '9'],
                    showGridDimensions: false,
                    extendDividersOutside: boundaries.multiPlot?.extendDividersOutside !== false,
                    plotTextOrientation: boundaries.multiPlot?.plotTextOrientation || 'horizontal',
                  },
                  dimensionLineStyle: e.target.checked ? 'arrows' : boundaries.dimensionLineStyle,
                })
              }
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-xs font-bold text-slate-800">
              Enable Multi-Plot Grid Mode (మల్టీ-ప్లాట్ గ్రిడ్ మోడ్ ఆన్ చేయండి)
            </span>
          </label>

          {boundaries.multiPlot?.enabled && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-medium">Rows (వరుసలు):</span>
                <select
                  value={boundaries.multiPlot.rows || 2}
                  onChange={(e) =>
                    onChange({
                      ...boundaries,
                      multiPlot: { ...boundaries.multiPlot!, rows: parseInt(e.target.value, 10) },
                    })
                  }
                  className="px-2 py-1 bg-white border border-slate-300 rounded font-bold text-xs"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'Row' : 'Rows'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-medium">Cols (కాలమ్స్):</span>
                <select
                  value={boundaries.multiPlot.cols || 3}
                  onChange={(e) =>
                    onChange({
                      ...boundaries,
                      multiPlot: { ...boundaries.multiPlot!, cols: parseInt(e.target.value, 10) },
                    })
                  }
                  className="px-2 py-1 bg-white border border-slate-300 rounded font-bold text-xs"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'Col' : 'Cols'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {boundaries.multiPlot?.enabled && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
            <span className="text-[11px] font-bold text-slate-700">Quick Split (త్వరిత విభజన):</span>
            <button
              type="button"
              onClick={() => handleEastWestSplit(2)}
              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded border border-emerald-300 transition-all cursor-pointer flex items-center gap-1"
              title="తూర్పు - పడమర 2 ప్లాట్లుగా చీల్చు (East-West 2 Plots)"
            >
              <span>↔️ East-West 2 Plots (తూర్పు-పడమర 2)</span>
            </button>
            <button
              type="button"
              onClick={() => handleEastWestSplit(3)}
              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded border border-emerald-300 transition-all cursor-pointer flex items-center gap-1"
              title="తూర్పు - పడమర 3 ప్లాట్లుగా చీల్చు (East-West 3 Plots)"
            >
              <span>↔️ East-West 3 Plots (తూర్పు-పడమర 3)</span>
            </button>
            <button
              type="button"
              onClick={() => handleNorthSouthSplit(2)}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold rounded border border-blue-300 transition-all cursor-pointer flex items-center gap-1"
              title="ఉత్తర - దక్షిణ 2 ప్లాట్లుగా చీల్చు (North-South 2 Plots)"
            >
              <span>↕️ North-South 2 Plots (ఉత్తర-దక్షిణ 2)</span>
            </button>
            <button
              type="button"
              onClick={() => handleNorthSouthSplit(3)}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold rounded border border-blue-300 transition-all cursor-pointer flex items-center gap-1"
              title="ఉత్తర - దక్షిణ 3 ప్లాట్లుగా చీల్చు (North-South 3 Plots)"
            >
              <span>↕️ North-South 3 Plots (ఉత్తర-దక్షిణ 3)</span>
            </button>
          </div>
        )}

        {boundaries.multiPlot?.enabled && (() => {
          const rows = Math.max(1, boundaries.multiPlot.rows || 2);
          const cols = Math.max(1, boundaries.multiPlot.cols || 3);
          const totalPlots = rows * cols;
          const currentPlotNos = boundaries.multiPlot.plotNumbers || [];
          const currentPlotDims = boundaries.multiPlot.plotDimensions || [];
          const uniformDim = boundaries.multiPlot.uniformDimension || '';

          const handlePlotNumbersInputChange = (val: string) => {
            isInternalPlotNumUpdateRef.current = true;
            setPlotNumbersInput(val);
            const trimmed = val.trim();
            let list: string[] = [];
            if (trimmed !== '') {
              list = val.split(',').map((s) => s.trim());
            }
            onChange({
              ...boundaries,
              multiPlot: {
                ...boundaries.multiPlot!,
                plotNumbers: list,
              },
            });
          };

          const handleClearPlotNumbers = () => {
            isInternalPlotNumUpdateRef.current = false;
            setPlotNumbersInput('');
            onChange({
              ...boundaries,
              multiPlot: {
                ...boundaries.multiPlot!,
                plotNumbers: [],
              },
            });
          };

          const updateCell = (idx: number, field: 'plotNo' | 'dimension', val: string) => {
            if (field === 'plotNo') {
              const updatedNos = currentPlotNos.length > 0
                ? [...currentPlotNos]
                : Array.from({ length: totalPlots }, () => '');
              while (updatedNos.length <= idx) updatedNos.push('');
              updatedNos[idx] = val;
              isInternalPlotNumUpdateRef.current = false;
              setPlotNumbersInput(updatedNos.join(', '));
              onChange({
                ...boundaries,
                multiPlot: {
                  ...boundaries.multiPlot!,
                  plotNumbers: updatedNos,
                },
              });
            } else {
              const updatedDims = currentPlotDims.length > 0
                ? [...currentPlotDims]
                : Array.from({ length: totalPlots }, (_, i) => (currentPlotDims[i] !== undefined ? currentPlotDims[i] : (uniformDim || '')));
              while (updatedDims.length <= idx) updatedDims.push('');
              updatedDims[idx] = val;
              onChange({
                ...boundaries,
                multiPlot: {
                  ...boundaries.multiPlot!,
                  plotDimensions: updatedDims,
                },
              });
            }
          };

          const handleApplyUniformDimension = (dim: string) => {
            const newDims = Array(totalPlots).fill(dim);
            onChange({
              ...boundaries,
              multiPlot: {
                ...boundaries.multiPlot!,
                uniformDimension: dim,
                plotDimensions: newDims,
                showGridDimensions: true,
              },
            });
          };

          const handleClearAllDimensions = () => {
            const blankDims = Array(totalPlots).fill('');
            onChange({
              ...boundaries,
              multiPlot: {
                ...boundaries.multiPlot!,
                uniformDimension: '',
                plotDimensions: blankDims,
                showGridDimensions: false,
              },
            });
          };

          const handleAutoNumberSequential = () => {
            isInternalPlotNumUpdateRef.current = false;
            const newNos = Array.from({ length: totalPlots }, (_, i) => `${i + 1}`);
            setPlotNumbersInput(newNos.join(', '));
            onChange({
              ...boundaries,
              multiPlot: {
                ...boundaries.multiPlot!,
                plotNumbers: newNos,
              },
            });
          };

          const handleAutoNumberSample6 = () => {
            isInternalPlotNumUpdateRef.current = false;
            const sample = ['6', '7', '8', '11', '10', '9'];
            setPlotNumbersInput(sample.join(', '));
            onChange({
              ...boundaries,
              multiPlot: {
                ...boundaries.multiPlot!,
                rows: 2,
                cols: 3,
                plotNumbers: sample,
              },
            });
          };

          return (
            <div className="space-y-4 pt-1">
              {/* Option checkboxes & orientation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={boundaries.multiPlot.showGridDimensions !== false}
                    onChange={(e) =>
                      onChange({
                        ...boundaries,
                        multiPlot: { ...boundaries.multiPlot!, showGridDimensions: e.target.checked },
                      })
                    }
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span>Show Plot Dimensions (కొలతలు చూపించు)</span>
                </label>

                <label
                  className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800"
                  title="రోడ్డు ఉన్న వైపు లైన్లు రావు; రోడ్డు లేని ఇతర సైడ్స్ మాత్రమే లైన్లు పొడిగించబడతాయి"
                >
                  <input
                    type="checkbox"
                    checked={boundaries.multiPlot.extendDividersOutside !== false}
                    onChange={(e) =>
                      onChange({
                        ...boundaries,
                        multiPlot: { ...boundaries.multiPlot!, extendDividersOutside: e.target.checked },
                      })
                    }
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span>Extend Dividers to Roads (రోడ్లలోకి లైన్లు)</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(boundaries.highlightBoundaryRed)}
                    onChange={(e) =>
                      onChange({
                        ...boundaries,
                        highlightBoundaryRed: e.target.checked,
                      })
                    }
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                    Red Border (ఎరుపు అవుట్‌లైన్)
                  </span>
                </label>

                <label
                  className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800"
                  title="ప్లాట్ సైజుకు తగినట్లు ప్లాట్ నంబర్లు మరియు కొలతల సైజు ఆటోమేటిక్‌గా సర్దుబాటు అవుతుంది"
                >
                  <input
                    type="checkbox"
                    checked={boundaries.multiPlot.autoAdjustTextScale !== false}
                    onChange={(e) =>
                      onChange({
                        ...boundaries,
                        multiPlot: { ...boundaries.multiPlot!, autoAdjustTextScale: e.target.checked },
                      })
                    }
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span className="flex items-center gap-1 text-slate-800">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    Auto Scale (ప్లాట్ సైజుని బట్టి ఆటో స్కేలింగ్)
                  </span>
                </label>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Text Style:</span>
                  <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...boundaries,
                          multiPlot: { ...boundaries.multiPlot!, plotTextOrientation: 'horizontal' },
                        })
                      }
                      className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-all ${
                        (boundaries.multiPlot.plotTextOrientation || 'horizontal') === 'horizontal'
                          ? 'bg-blue-700 text-white font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Horizontal (అడ్డంగా)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...boundaries,
                          multiPlot: { ...boundaries.multiPlot!, plotTextOrientation: 'vertical' },
                        })
                      }
                      className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-all ${
                        boundaries.multiPlot.plotTextOrientation === 'vertical'
                          ? 'bg-blue-700 text-white font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Vertical (నిలువుగా)
                    </button>
                  </div>
                </div>
            </div>



              {/* Quick Input Toolbar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. Plot Numbers Quick Comma Input */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                      Plot Numbers (కామాతో వేరు చేయండి)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleAutoNumberSequential}
                        className="text-[10px] text-blue-700 hover:underline font-semibold"
                        title="1 నుండి క్రమ సంఖ్యలు సెట్ చేయండి"
                      >
                        1, 2, 3..
                      </button>
                      {rows === 2 && cols === 3 && (
                        <button
                          type="button"
                          onClick={handleAutoNumberSample6}
                          className="text-[10px] text-blue-700 hover:underline font-semibold"
                          title="శాంపిల్ నంబర్లు సెట్ చేయండి"
                        >
                          6, 7, 8..
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleClearPlotNumbers}
                        className="text-[10px] text-rose-600 hover:text-rose-800 hover:underline font-bold flex items-center gap-1 ml-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 transition-colors"
                        title="అన్ని ప్లాట్ నంబర్లను తొలగించండి (ఖాళీగా ఉంచండి)"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600" />
                        Delete (తొలగించు)
                      </button>
                    </div>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={plotNumbersInput}
                      onChange={(e) => handlePlotNumbersInputChange(e.target.value)}
                      placeholder="e.g. 6, 7, 8, 11, 10, 9 (లేదా ఖాళీగా ఉంచండి)"
                      className="w-full pl-2.5 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    {plotNumbersInput.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearPlotNumbers}
                        className="absolute right-2 text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded cursor-pointer"
                        title="Delete / Clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    మొత్తం {totalPlots} ప్లాట్లకు కామాతో వేరు చేసి నంబర్లు ఇవ్వండి. Backspace లేదా Delete బటన్ ద్వారా సులభంగా తొలగించవచ్చు.
                  </p>
                </div>

                {/* 2. Manual Dimensions Quick Setup */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                      Uniform Dimension (అన్ని ప్లాట్లకు ఒకే కొలత)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 hidden sm:inline">ఉదా: 30' x 60'</span>
                      <button
                        type="button"
                        onClick={handleClearAllDimensions}
                        className="text-[10px] text-rose-600 hover:text-rose-800 hover:underline font-bold flex items-center gap-0.5 cursor-pointer ml-1 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                        title="అన్ని ప్లాట్ల కొలతలను తొలగించండి (ఖాళీగా ఉంచండి)"
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                        Clear All Dims (కొలతలు తొలగించు)
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={uniformDim}
                      onChange={(e) =>
                        onChange({
                          ...boundaries,
                          multiPlot: {
                            ...boundaries.multiPlot!,
                            uniformDimension: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. 30' x 60'"
                      className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyUniformDimension(uniformDim || "30' x 60'")}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      Apply to All (అందరికీ సెట్ చేయి)
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    ఒకేసారి అన్ని ప్లాట్లకు ఈ కొలత సెట్ అవుతుంది లేదా కింద విడివిడిగా మార్చుకోవచ్చు / తొలగించవచ్చు.
                  </p>
                </div>
              </div>

              {/* 3. Detailed Plot-by-Plot Individual Inputs (ప్రతి ప్లాట్ నంబర్ & కొలత విడివిడిగా నమోదు) */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Manual Plot Numbers & Dimensions Table (ప్రతి ప్లాట్ నంబర్ & కొలత విడివిడిగా ఎడిట్ చేయండి)
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Total {totalPlots} Plots ({rows} Rows × {cols} Cols)
                  </span>
                </div>

                <div
                  className="grid gap-2.5 max-h-72 overflow-y-auto pr-1"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(cols, 6)}, minmax(130px, 1fr))`,
                  }}
                >
                  {Array.from({ length: totalPlots }).map((_, idx) => {
                    const r = Math.floor(idx / cols);
                    const c = idx % cols;
                    const defaultPlotNo = (rows === 2 && cols === 3)
                      ? (r === 0 ? (c === 0 ? '6' : c === 1 ? '7' : '8') : (c === 0 ? '11' : c === 1 ? '10' : '9'))
                      : `${idx + 1}`;
                    const valNo = boundaries.multiPlot?.plotNumbers !== undefined
                      ? (currentPlotNos[idx] !== undefined ? currentPlotNos[idx] : '')
                      : defaultPlotNo;
                    const valDim = currentPlotDims[idx] !== undefined ? currentPlotDims[idx] : (uniformDim || '');

                    return (
                      <div
                        key={`plot-cell-edit-${idx}`}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 shadow-2xs hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-extrabold text-blue-800">
                            Plot #{idx + 1}
                          </span>
                          <span className="text-slate-400 font-mono text-[9px]">
                            R{r + 1}:C{c + 1}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase">
                              Plot No:
                            </label>
                            {valNo ? (
                              <button
                                type="button"
                                onClick={() => updateCell(idx, 'plotNo', '')}
                                className="text-[9px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                                title="ప్లాట్ నంబర్ తొలగించు (ఖాళీగా ఉంచు)"
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={valNo}
                              onChange={(e) => updateCell(idx, 'plotNo', e.target.value)}
                              placeholder={`e.g. ${defaultPlotNo}`}
                              className="w-full pl-2 pr-6 py-1 text-xs bg-white border border-slate-300 rounded font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                            {valNo ? (
                              <button
                                type="button"
                                onClick={() => updateCell(idx, 'plotNo', '')}
                                className="absolute right-1.5 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                title="Delete Plot No"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase">
                              Dimension:
                            </label>
                            {valDim ? (
                              <button
                                type="button"
                                onClick={() => updateCell(idx, 'dimension', '')}
                                className="text-[9px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                                title="ఈ ప్లాట్ కొలతను తొలగించండి (ఖాళీగా ఉంచండి)"
                              >
                                Clear (ఖాళీ)
                              </button>
                            ) : null}
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={valDim}
                              onChange={(e) => updateCell(idx, 'dimension', e.target.value)}
                              placeholder={uniformDim || "e.g. 30' x 60' (ఖాళీ)"}
                              className="w-full pl-2 pr-6 py-1 text-xs bg-white border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                            {valDim ? (
                              <button
                                type="button"
                                onClick={() => updateCell(idx, 'dimension', '')}
                                className="absolute right-1.5 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                title="Delete Dimension"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 4 Cardinal Sides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* NORTH */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-700 text-white text-xs font-bold flex items-center justify-center">
                N
              </span>
              <span className="text-sm font-bold text-slate-900">NORTH</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (boundaries.northSegments && boundaries.northSegments.length > 0) {
                    onChange({
                      ...boundaries,
                      northSegments: undefined,
                    });
                  } else {
                    const currentN = boundaries.northDim.normalized || 40;
                    const half = Math.round(currentN / 2);
                    const halfStr = `${half}'`;
                    const isCurrentlyRoad = boundaries.roadSides.includes('North') || isRoadSegment(boundaries.northBoundary);
                    const segs = [
                      { name: isCurrentlyRoad ? 'ROAD' : 'NEIGHBOUR PROPERTY (PLOT 1)', dimension: halfStr },
                      { name: isCurrentlyRoad ? 'ROAD' : 'NEIGHBOUR PROPERTY (PLOT 2)', dimension: halfStr },
                    ];
                    const newBoundary = formatSegmentBoundaryText(segs[0], segs[1]);
                    let nextSides = [...boundaries.roadSides];
                    if (isCurrentlyRoad && !nextSides.includes('North')) {
                      nextSides.push('North');
                    }
                    onChange({
                      ...boundaries,
                      northSegments: segs,
                      northBoundary: newBoundary,
                      northDim: parseDimension(`${currentN}'`, boundaries.dimensionUnit),
                      roadSides: nextSides,
                      cornerProperty: nextSides.length > 1,
                    });
                  }
                }}
                className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-all cursor-pointer ${
                  boundaries.northSegments && boundaries.northSegments.length > 0
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {boundaries.northSegments && boundaries.northSegments.length > 0
                  ? '✓ 2 Segments Active'
                  : '+ 2 Plots Split'}
              </button>
              <span className="text-[11px] font-mono text-slate-500">
                Normalized: {boundaries.northDim.normalized || 0} {boundaries.dimensionUnit}
              </span>
            </div>
          </div>

          {boundaries.northSegments && boundaries.northSegments.length === 2 ? (
            <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                <span>North Side Segments (ఉత్తరం వైపు ప్లాట్లు):</span>
                <span className="text-rose-700 font-mono">Total: {boundaries.northDim.raw || '40\''}</span>
              </div>
              <div className="space-y-2">
                <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">1. Left / West Segment</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="e.g. NEIGHBOUR PROPERTY or ROAD"
                      value={boundaries.northSegments[0].name}
                      onChange={(e) => handleNorthSegmentChange(0, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 font-medium"
                    />
                    <input
                      type="text"
                      placeholder="20'"
                      value={boundaries.northSegments[0].dimension}
                      onChange={(e) => handleNorthSegmentChange(0, 'dimension', e.target.value)}
                      className="col-span-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-bold font-mono focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">2. Right / East Segment</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="e.g. NEIGHBOUR PROPERTY or ROAD"
                      value={boundaries.northSegments[1].name}
                      onChange={(e) => handleNorthSegmentChange(1, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 font-medium"
                    />
                    <input
                      type="text"
                      placeholder="20'"
                      value={boundaries.northSegments[1].dimension}
                      onChange={(e) => handleNorthSegmentChange(1, 'dimension', e.target.value)}
                      className="col-span-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-bold font-mono focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200 text-slate-700">
                  <span className="font-semibold">Boundary Text (హద్దుల వివరము):</span>
                  <span className="font-bold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {boundaries.northBoundary || 'ROAD'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Boundary <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-north-boundary"
                  type="text"
                  placeholder={'e.g. 30\'-0" Wide Road or Plot No. 42'}
                  value={boundaries.northBoundary}
                  onChange={(e) => handleBoundaryChange('northBoundary', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-900"
                />
                {extractRoadWidthFromBoundary(boundaries.northBoundary) && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-1">
                    <span>🛣️ Road Width Detected:</span>
                    <span className="font-bold underline">{extractRoadWidthFromBoundary(boundaries.northBoundary)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Dimension ({boundaries.dimensionUnit}) <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-north-dim"
                  type="text"
                  placeholder={boundaries.dimensionUnit === 'Feet' ? "e.g. 40'-5\" or 40" : "e.g. 12.35"}
                  value={boundaries.northDim.raw}
                  onChange={(e) => handleDimChange('northDim', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold text-slate-900"
                />
              </div>
            </>
          )}
        </div>

        {/* SOUTH */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                S
              </span>
              <span className="text-sm font-bold text-slate-900">SOUTH</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (boundaries.southSegments && boundaries.southSegments.length > 0) {
                    onChange({
                      ...boundaries,
                      southSegments: undefined,
                    });
                  } else {
                    const currentS = boundaries.southDim.normalized || 40;
                    const half = Math.round(currentS / 2);
                    const halfStr = `${half}'`;
                    const isCurrentlyRoad = boundaries.roadSides.includes('South') || isRoadSegment(boundaries.southBoundary);
                    const segs = [
                      { name: isCurrentlyRoad ? 'ROAD' : 'NEIGHBOUR PROPERTY (PLOT 1)', dimension: halfStr },
                      { name: isCurrentlyRoad ? 'ROAD' : 'NEIGHBOUR PROPERTY (PLOT 2)', dimension: halfStr },
                    ];
                    const newBoundary = formatSegmentBoundaryText(segs[0], segs[1]);
                    let nextSides = [...boundaries.roadSides];
                    if (isCurrentlyRoad && !nextSides.includes('South')) {
                      nextSides.push('South');
                    }
                    onChange({
                      ...boundaries,
                      southSegments: segs,
                      southBoundary: newBoundary,
                      southDim: parseDimension(`${currentS}'`, boundaries.dimensionUnit),
                      roadSides: nextSides,
                      cornerProperty: nextSides.length > 1,
                    });
                  }
                }}
                className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-all cursor-pointer ${
                  boundaries.southSegments && boundaries.southSegments.length > 0
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {boundaries.southSegments && boundaries.southSegments.length > 0
                  ? '✓ 2 Segments Active'
                  : '+ 2 Plots Split'}
              </button>
              <span className="text-[11px] font-mono text-slate-500">
                Normalized: {boundaries.southDim.normalized || 0} {boundaries.dimensionUnit}
              </span>
            </div>
          </div>

          {boundaries.southSegments && boundaries.southSegments.length === 2 ? (
            <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                <span>South Side Segments (దక్షిణం వైపు ప్లాట్లు):</span>
                <span className="text-rose-700 font-mono">Total: {boundaries.southDim.raw || '40\''}</span>
              </div>
              <div className="space-y-2">
                <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">1. Left / West Segment</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="e.g. NEIGHBOUR PROPERTY or ROAD"
                      value={boundaries.southSegments[0].name}
                      onChange={(e) => handleSouthSegmentChange(0, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 font-medium"
                    />
                    <input
                      type="text"
                      placeholder="20'"
                      value={boundaries.southSegments[0].dimension}
                      onChange={(e) => handleSouthSegmentChange(0, 'dimension', e.target.value)}
                      className="col-span-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-bold font-mono focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">2. Right / East Segment</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="e.g. NEIGHBOUR PROPERTY or ROAD"
                      value={boundaries.southSegments[1].name}
                      onChange={(e) => handleSouthSegmentChange(1, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 font-medium"
                    />
                    <input
                      type="text"
                      placeholder="20'"
                      value={boundaries.southSegments[1].dimension}
                      onChange={(e) => handleSouthSegmentChange(1, 'dimension', e.target.value)}
                      className="col-span-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-bold font-mono focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200 text-slate-700">
                  <span className="font-semibold">Boundary Text (హద్దుల వివరము):</span>
                  <span className="font-bold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {boundaries.southBoundary || 'ROAD'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Boundary <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-south-boundary"
                  type="text"
                  placeholder={'e.g. 30\'-0" Wide Road or Plot No. 18'}
                  value={boundaries.southBoundary}
                  onChange={(e) => handleBoundaryChange('southBoundary', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-900"
                />
                {extractRoadWidthFromBoundary(boundaries.southBoundary) && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-1">
                    <span>🛣️ Road Width Detected:</span>
                    <span className="font-bold underline">{extractRoadWidthFromBoundary(boundaries.southBoundary)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Dimension ({boundaries.dimensionUnit}) <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-south-dim"
                  type="text"
                  placeholder={boundaries.dimensionUnit === 'Feet' ? "e.g. 40'-5\" or 40" : "e.g. 12.35"}
                  value={boundaries.southDim.raw}
                  onChange={(e) => handleDimChange('southDim', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold text-slate-900"
                />
              </div>
            </>
          )}
        </div>

        {/* EAST */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                E
              </span>
              <span className="text-sm font-bold text-slate-900">EAST</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (boundaries.eastSegments && boundaries.eastSegments.length > 0) {
                    onChange({
                      ...boundaries,
                      eastSegments: undefined,
                    });
                  } else {
                    const currentE = boundaries.eastDim.normalized || 90;
                    const half = Math.round(currentE / 2);
                    const halfStr = `${half}'`;
                    const isCurrentlyRoad = boundaries.roadSides.includes('East') || isRoadSegment(boundaries.eastBoundary);
                    const segs = [
                      { name: isCurrentlyRoad ? 'ROAD' : 'OPEN PLOT NO.49 OF VENDORS', dimension: halfStr },
                      { name: isCurrentlyRoad ? 'ROAD' : 'OPEN PLOT NO.70 OF VENDORS', dimension: halfStr },
                    ];
                    const newBoundary = formatSegmentBoundaryText(segs[0], segs[1]);
                    let nextSides = [...boundaries.roadSides];
                    if (isCurrentlyRoad && !nextSides.includes('East')) {
                      nextSides.push('East');
                    }
                    onChange({
                      ...boundaries,
                      eastSegments: segs,
                      eastBoundary: newBoundary,
                      eastDim: parseDimension(`${currentE}'`, boundaries.dimensionUnit),
                      roadSides: nextSides,
                      cornerProperty: nextSides.length > 1,
                    });
                  }
                }}
                className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-all cursor-pointer ${
                  boundaries.eastSegments && boundaries.eastSegments.length > 0
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {boundaries.eastSegments && boundaries.eastSegments.length > 0
                  ? '✓ 2 Segments Active'
                  : '+ 2 Plots Split'}
              </button>
              <span className="text-[11px] font-mono text-slate-500">
                Normalized: {boundaries.eastDim.normalized || 0} {boundaries.dimensionUnit}
              </span>
            </div>
          </div>

          {boundaries.eastSegments && boundaries.eastSegments.length === 2 ? (
            <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                <span>East Side Segments (తూర్పు వైపు ప్లాట్లు):</span>
                <span className="text-rose-700 font-mono">Total: {boundaries.eastDim.raw || '90\''}</span>
              </div>
              <div className="space-y-2">
                <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">1. Top / North Segment</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="e.g. OPEN PLOT NO.49 OF VENDORS or ROAD"
                      value={boundaries.eastSegments[0].name}
                      onChange={(e) => handleEastSegmentChange(0, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 font-medium"
                    />
                    <input
                      type="text"
                      placeholder="45'"
                      value={boundaries.eastSegments[0].dimension}
                      onChange={(e) => handleEastSegmentChange(0, 'dimension', e.target.value)}
                      className="col-span-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-bold font-mono focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">2. Bottom / South Segment</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="e.g. OPEN PLOT NO.70 OF VENDORS or ROAD"
                      value={boundaries.eastSegments[1].name}
                      onChange={(e) => handleEastSegmentChange(1, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 font-medium"
                    />
                    <input
                      type="text"
                      placeholder="45'"
                      value={boundaries.eastSegments[1].dimension}
                      onChange={(e) => handleEastSegmentChange(1, 'dimension', e.target.value)}
                      className="col-span-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-bold font-mono focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200 text-slate-700">
                  <span className="font-semibold">Boundary Text (హద్దుల వివరము):</span>
                  <span className="font-bold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {boundaries.eastBoundary || 'ROAD'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Boundary <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-east-boundary"
                  type="text"
                  placeholder={'e.g. 40\'-0" Wide Road or Open Plot'}
                  value={boundaries.eastBoundary}
                  onChange={(e) => handleBoundaryChange('eastBoundary', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-900"
                />
                {extractRoadWidthFromBoundary(boundaries.eastBoundary) && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-1">
                    <span>🛣️ Road Width Detected:</span>
                    <span className="font-bold underline">{extractRoadWidthFromBoundary(boundaries.eastBoundary)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Dimension ({boundaries.dimensionUnit}) <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-east-dim"
                  type="text"
                  placeholder={boundaries.dimensionUnit === 'Feet' ? "e.g. 60'-0\" or 60" : "e.g. 18.28"}
                  value={boundaries.eastDim.raw}
                  onChange={(e) => handleDimChange('eastDim', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold text-slate-900"
                />
              </div>
            </>
          )}
        </div>

        {/* WEST */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                W
              </span>
              <span className="text-sm font-bold text-slate-900">WEST</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (boundaries.westSegments && boundaries.westSegments.length > 0) {
                    onChange({
                      ...boundaries,
                      westSegments: undefined,
                    });
                  } else {
                    const currentW = boundaries.westDim.normalized || 90;
                    const half = Math.round(currentW / 2);
                    const halfStr = `${half}'`;
                    const isCurrentlyRoad = boundaries.roadSides.includes('West') || isRoadSegment(boundaries.westBoundary);
                    const segs = [
                      { name: isCurrentlyRoad ? 'ROAD' : 'OPEN PLOT NO.51 OF VENDORS', dimension: halfStr },
                      { name: isCurrentlyRoad ? 'ROAD' : 'OPEN PLOT NOS.68 OF VENDORS', dimension: halfStr },
                    ];
                    const newBoundary = formatSegmentBoundaryText(segs[0], segs[1]);
                    let nextSides = [...boundaries.roadSides];
                    if (isCurrentlyRoad && !nextSides.includes('West')) {
                      nextSides.push('West');
                    }
                    onChange({
                      ...boundaries,
                      westSegments: segs,
                      westBoundary: newBoundary,
                      westDim: parseDimension(`${currentW}'`, boundaries.dimensionUnit),
                      roadSides: nextSides,
                      cornerProperty: nextSides.length > 1,
                    });
                  }
                }}
                className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-all cursor-pointer ${
                  boundaries.westSegments && boundaries.westSegments.length > 0
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {boundaries.westSegments && boundaries.westSegments.length > 0
                  ? '✓ 2 Segments Active'
                  : '+ 2 Plots Split'}
              </button>
              <span className="text-[11px] font-mono text-slate-500">
                Normalized: {boundaries.westDim.normalized || 0} {boundaries.dimensionUnit}
              </span>
            </div>
          </div>

          {boundaries.westSegments && boundaries.westSegments.length === 2 ? (
            <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                <span>West Side Segments (పడమర వైపు ప్లాట్లు):</span>
                <span className="text-rose-700 font-mono">Total: {boundaries.westDim.raw || '90\''}</span>
              </div>
              <div className="space-y-2">
                <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">1. Top / North Segment</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="e.g. OPEN PLOT NO.51 OF VENDORS or ROAD"
                      value={boundaries.westSegments[0].name}
                      onChange={(e) => handleWestSegmentChange(0, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 font-medium"
                    />
                    <input
                      type="text"
                      placeholder="45'"
                      value={boundaries.westSegments[0].dimension}
                      onChange={(e) => handleWestSegmentChange(0, 'dimension', e.target.value)}
                      className="col-span-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-bold font-mono focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">2. Bottom / South Segment</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="e.g. OPEN PLOT NOS.68 OF VENDORS or ROAD"
                      value={boundaries.westSegments[1].name}
                      onChange={(e) => handleWestSegmentChange(1, 'name', e.target.value)}
                      className="col-span-2 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 font-medium"
                    />
                    <input
                      type="text"
                      placeholder="45'"
                      value={boundaries.westSegments[1].dimension}
                      onChange={(e) => handleWestSegmentChange(1, 'dimension', e.target.value)}
                      className="col-span-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-bold font-mono focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200 text-slate-700">
                  <span className="font-semibold">Boundary Text (హద్దుల వివరము):</span>
                  <span className="font-bold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {boundaries.westBoundary || 'ROAD'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Boundary <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-west-boundary"
                  type="text"
                  placeholder={'e.g. 30\'-0" Wide Road or Plot No. 25'}
                  value={boundaries.westBoundary}
                  onChange={(e) => handleBoundaryChange('westBoundary', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-900"
                />
                {extractRoadWidthFromBoundary(boundaries.westBoundary) && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-1">
                    <span>🛣️ Road Width Detected:</span>
                    <span className="font-bold underline">{extractRoadWidthFromBoundary(boundaries.westBoundary)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Dimension ({boundaries.dimensionUnit}) <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-west-dim"
                  type="text"
                  placeholder={boundaries.dimensionUnit === 'Feet' ? "e.g. 60'-0\" or 60" : "e.g. 18.28"}
                  value={boundaries.westDim.raw}
                  onChange={(e) => handleDimChange('westDim', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono font-bold text-slate-900"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Road & Corner Property Configuration */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-rose-700" />
            <h3 className="text-sm font-bold text-slate-900">Road & Corner Configuration</h3>
          </div>
        </div>

        {/* Active Road Sides and Corner Configuration */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Active Road Sides [ROAD_SIDE]
              </label>
              <p className="text-[11px] text-slate-500">
                Road widths are derived directly from the Boundary details entered above (e.g. 30'-0" Wide Road).
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 cursor-pointer bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 shrink-0">
              <input
                type="checkbox"
                id="checkbox-corner-property"
                checked={boundaries.cornerProperty}
                onChange={(e) => handleCornerToggle(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
              />
              <span className="text-xs font-bold text-amber-900">
                Corner / Multi-Road Property
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {(['North', 'South', 'East', 'West'] as RoadSideOption[]).map((side) => {
              const isSelected = boundaries.roadSides.includes(side);

              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => handleRoadSideToggle(side)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>{side} Side Road</span>
                  {isSelected && <span className="font-bold">✓</span>}
                </button>
              );
            })}
            {boundaries.roadSides.length > 0 && (
              <button
                type="button"
                onClick={() => handleRoadSideToggle('None')}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Clear All Roads
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Road Continuous Options */}
        {boundaries.roadSides.length > 0 && boundaries.roadLayoutType !== 'Dead-End / Cul-de-Sac' && (
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="checkbox-road-continuous"
                  checked={boundaries.roadContinuous !== false}
                  onChange={(e) => onChange({ ...boundaries, roadContinuous: e.target.checked })}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                />
                <span className="text-xs font-bold text-slate-900">
                  Continuous Road (రోడ్ కంటిన్యూస్ / Through Road Extension)
                </span>
              </label>
              <span className="text-[11px] text-slate-500">
                Extends road strip continuously past plot boundaries
              </span>
            </div>

            {boundaries.roadContinuous !== false && (
              <div className="space-y-3">
                {boundaries.roadSides.filter((s) => s !== 'None').map((side) => {
                  if (side === 'North') {
                    const continuity = boundaries.northRoadContinuity ?? boundaries.roadContinuitySide ?? 'both';
                    return (
                      <div key="north-continuity" className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                            North Side Road Continuity Extent (ఉత్తరం రోడ్ కంటిన్యూటీ)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Continuity Extent
                            </label>
                            <select
                              id="select-north-road-continuity-side"
                              value={continuity}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  northRoadContinuity: e.target.value as any,
                                  ...(boundaries.roadSides.length === 1 ? { roadContinuitySide: e.target.value as any } : {}),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-medium"
                            >
                              <option value="both">Both Sides (రెండు వైపులా - West & East)</option>
                              <option value="left">Left / West Side Only (ఎడమ వైపు మాత్రమే)</option>
                              <option value="right">Right / East Side Only (కుడి వైపు మాత్రమే)</option>
                              <option value="none">Confined to Plot Width (ప్లాట్ వెడల్పుకే పరిమితం)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Left / West Label (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Towards Village"
                              value={boundaries.northRoadDirectionLeft || ''}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  northRoadDirectionLeft: e.target.value,
                                  ...(boundaries.roadSides.length === 1 ? { roadDirectionLeft: e.target.value } : {}),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Right / East Label (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Towards Highway"
                              value={boundaries.northRoadDirectionRight || ''}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  northRoadDirectionRight: e.target.value,
                                  ...(boundaries.roadSides.length === 1 ? { roadDirectionRight: e.target.value } : {}),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (side === 'South') {
                    const continuity = boundaries.southRoadContinuity ?? boundaries.roadContinuitySide ?? 'both';
                    return (
                      <div key="south-continuity" className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                            South Side Road Continuity Extent (దక్షిణం రోడ్ కంటిన్యూటీ)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Continuity Extent
                            </label>
                            <select
                              id="select-south-road-continuity-side"
                              value={continuity}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  southRoadContinuity: e.target.value as any,
                                  ...(boundaries.roadSides.length === 1 ? { roadContinuitySide: e.target.value as any } : {}),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-medium"
                            >
                              <option value="both">Both Sides (రెండు వైపులా - West & East)</option>
                              <option value="left">Left / West Side Only (ఎడమ వైపు మాత్రమే)</option>
                              <option value="right">Right / East Side Only (కుడి వైపు మాత్రమే)</option>
                              <option value="none">Confined to Plot Width (ప్లాట్ వెడల్పుకే పరిమితం)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Left / West Label (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Towards Village / City"
                              value={boundaries.southRoadDirectionLeft || ''}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  southRoadDirectionLeft: e.target.value,
                                  ...(boundaries.roadSides.length === 1 ? { roadDirectionLeft: e.target.value } : {}),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Right / East Label (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Towards Highway"
                              value={boundaries.southRoadDirectionRight || ''}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  southRoadDirectionRight: e.target.value,
                                  ...(boundaries.roadSides.length === 1 ? { roadDirectionRight: e.target.value } : {}),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (side === 'East') {
                    const continuity = boundaries.eastRoadContinuity ?? boundaries.roadContinuitySide ?? 'both';
                    return (
                      <div key="east-continuity" className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                            East Side Road Continuity Extent (తూర్పు రోడ్ కంటిన్యూటీ)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Continuity Extent
                            </label>
                            <select
                              id="select-east-road-continuity-side"
                              value={continuity}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  eastRoadContinuity: e.target.value as any,
                                  ...(boundaries.roadSides.length === 1 ? { roadContinuitySide: (e.target.value === 'top' ? 'left' : e.target.value === 'bottom' ? 'right' : e.target.value) as any } : {}),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-medium"
                            >
                              <option value="both">Both Sides (రెండు వైపులా - North & South)</option>
                              <option value="top">Top / North Side Only (పైకి / ఉత్తరం వైపు మాత్రమే)</option>
                              <option value="bottom">Bottom / South Side Only (క్రిందికి / దక్షిణం వైపు మాత్రమే)</option>
                              <option value="none">Confined to Plot Height (ప్లాట్ పొడవుకే పరిమితం)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Top / North Label (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Towards Main Road"
                              value={boundaries.eastRoadDirectionTop || ''}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  eastRoadDirectionTop: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Bottom / South Label (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Towards Colony / Market"
                              value={boundaries.eastRoadDirectionBottom || ''}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  eastRoadDirectionBottom: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (side === 'West') {
                    const continuity = boundaries.westRoadContinuity ?? boundaries.roadContinuitySide ?? 'both';
                    return (
                      <div key="west-continuity" className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                            West Side Road Continuity Extent (పడమర రోడ్ కంటిన్యూటీ)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Continuity Extent
                            </label>
                            <select
                              id="select-west-road-continuity-side"
                              value={continuity}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  westRoadContinuity: e.target.value as any,
                                  ...(boundaries.roadSides.length === 1 ? { roadContinuitySide: (e.target.value === 'top' ? 'left' : e.target.value === 'bottom' ? 'right' : e.target.value) as any } : {}),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 font-medium"
                            >
                              <option value="both">Both Sides (రెండు వైపులా - North & South)</option>
                              <option value="top">Top / North Side Only (పైకి / ఉత్తరం వైపు మాత్రమే)</option>
                              <option value="bottom">Bottom / South Side Only (క్రిందికి / దక్షిణం వైపు మాత్రమే)</option>
                              <option value="none">Confined to Plot Height (ప్లాట్ పొడవుకే పరిమితం)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Top / North Label (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Towards Highway"
                              value={boundaries.westRoadDirectionTop || ''}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  westRoadDirectionTop: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                              Bottom / South Label (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Towards Town / Layout"
                              value={boundaries.westRoadDirectionBottom || ''}
                              onChange={(e) =>
                                onChange({
                                  ...boundaries,
                                  westRoadDirectionBottom: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action button: Generate Sketch */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          id="btn-generate-sketch"
          onClick={onGenerateSketch}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold uppercase tracking-wider rounded-lg shadow-xs cursor-pointer transition-all"
        >
          <Layers className="w-4 h-4 text-amber-400" />
          Generate / Refresh Sketch
        </button>
      </div>
    </div>
  );
};
