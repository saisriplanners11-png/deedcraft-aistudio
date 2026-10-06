import React from 'react';
import { BoundaryDimensions, DimensionUnit, RoadSideOption, RoadLayoutType, DeadEndType, DeadEndSide } from '../types';
import { parseDimension, extractRoadWidthFromBoundary } from '../utils/dimensionUtils';
import { Compass, Sparkles, Navigation, Layers, Split, GitMerge, ShieldAlert, Camera, RotateCw } from 'lucide-react';

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

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Boundaries & House Style:</span>
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                id="btn-boundary-normal"
                onClick={() => onChange({ ...boundaries, boundaryFontWeight: 'normal' })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  (boundaries.boundaryFontWeight || 'normal') === 'normal'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="బౌండరీలు మరియు హౌస్ కొలతలు Bold కాకుండా క్లియర్‌గా కనిపిస్తాయి"
              >
                ✓ Normal (Bold కాకుండా)
              </button>
              <button
                type="button"
                id="btn-boundary-bold"
                onClick={() => onChange({ ...boundaries, boundaryFontWeight: 'bold' })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  boundaries.boundaryFontWeight === 'bold'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bold
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
            <span className="text-[11px] font-mono text-slate-500">
              Normalized: {boundaries.northDim.normalized || 0} {boundaries.dimensionUnit}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Boundary / Adjacent Property <span className="text-rose-600">*</span>
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
            <span className="text-[11px] font-mono text-slate-500">
              Normalized: {boundaries.southDim.normalized || 0} {boundaries.dimensionUnit}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Boundary / Adjacent Property <span className="text-rose-600">*</span>
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
            <span className="text-[11px] font-mono text-slate-500">
              Normalized: {boundaries.eastDim.normalized || 0} {boundaries.dimensionUnit}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Boundary / Adjacent Property <span className="text-rose-600">*</span>
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
            <span className="text-[11px] font-mono text-slate-500">
              Normalized: {boundaries.westDim.normalized || 0} {boundaries.dimensionUnit}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Boundary / Adjacent Property <span className="text-rose-600">*</span>
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
