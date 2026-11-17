import React from 'react';
import { BoundaryDimensions } from '../types';
import { Check, RotateCcw, Sliders } from 'lucide-react';

interface BoxShapeControlsProps {
  boundaries: BoundaryDimensions;
  onChange: (updated: BoundaryDimensions) => void;
  compact?: boolean;
}

export const BoxShapeControls: React.FC<BoxShapeControlsProps> = ({
  boundaries,
  onChange,
  compact = false,
}) => {
  const mode = boundaries.boxShapeMode || 'auto';
  const straightSides = {
    west: mode === 'straight' || (boundaries.boxStraightSides?.west ?? (boundaries.boxAlignH === 'west-straight')),
    east: mode === 'straight' || (boundaries.boxStraightSides?.east ?? (boundaries.boxAlignH === 'east-straight')),
    north: mode === 'straight' || (boundaries.boxStraightSides?.north ?? (boundaries.boxAlignV === 'north-straight')),
    south: mode === 'straight' || (boundaries.boxStraightSides?.south ?? (boundaries.boxAlignV === 'south-straight')),
  };

  const skewX = mode === 'straight' ? 0 : (boundaries.boxSkewX || 0);
  const skewY = mode === 'straight' ? 0 : (boundaries.boxSkewY || 0);

  const allFourStraight = straightSides.west && straightSides.east && straightSides.north && straightSides.south;
  const anySideStraight = straightSides.west || straightSides.east || straightSides.north || straightSides.south;
  const isStraight = mode === 'straight' || (allFourStraight && skewX === 0 && skewY === 0);
  const isCrossActive = !isStraight && (mode === 'cross' || skewX !== 0 || skewY !== 0 || anySideStraight);

  const setAuto = () => {
    onChange({
      ...boundaries,
      boxShapeMode: 'auto',
      boxAlignH: 'center',
      boxAlignV: 'center',
      boxStraightSides: { west: false, east: false, north: false, south: false },
      boxSkewX: 0,
      boxSkewY: 0,
    });
  };

  const setStraight = () => {
    onChange({
      ...boundaries,
      boxShapeMode: 'straight',
      boxAlignH: 'center',
      boxAlignV: 'center',
      boxStraightSides: { west: true, east: true, north: true, south: true },
      boxSkewX: 0,
      boxSkewY: 0,
    });
  };

  const setCrossPreset = (targetSkewX: number) => {
    onChange({
      ...boundaries,
      boxShapeMode: 'cross',
      boxAlignH: 'center',
      boxAlignV: 'center',
      boxStraightSides: { west: false, east: false, north: false, south: false },
      boxSkewX: targetSkewX,
    });
  };

  const toggleStraightSide = (side: 'west' | 'east' | 'north' | 'south') => {
    const nextSides = {
      ...straightSides,
      [side]: !straightSides[side],
    };
    const nextAllFour = Boolean(nextSides.west && nextSides.east && nextSides.north && nextSides.south);
    const nextAny = Boolean(nextSides.west || nextSides.east || nextSides.north || nextSides.south);

    onChange({
      ...boundaries,
      boxShapeMode: nextAllFour ? 'straight' : (nextAny || skewX !== 0 || skewY !== 0 ? 'cross' : 'auto'),
      boxAlignH: 'center',
      boxAlignV: 'center',
      boxStraightSides: nextSides,
    });
  };

  const clearStraightSides = () => {
    onChange({
      ...boundaries,
      boxShapeMode: skewX !== 0 || skewY !== 0 ? 'cross' : 'auto',
      boxAlignH: 'center',
      boxAlignV: 'center',
      boxStraightSides: { west: false, east: false, north: false, south: false },
    });
  };

  return (
    <div className={`rounded-lg border border-slate-200 ${compact ? 'bg-white p-2.5 space-y-2' : 'bg-slate-50 p-3.5 rounded-xl space-y-3'}`}>
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="text-[11px] font-bold text-slate-800">
            Box Shape: Straight / Cross (బాక్స్ స్ట్రెయిట్ / క్రాస్ అడ్జస్ట్):
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              isStraight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isCrossActive
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {isStraight ? 'Straight (90°)' : isCrossActive ? 'Cross Adjusted' : 'Auto (Exact Dims)'}
          </span>
          <button
            type="button"
            onClick={setAuto}
            title="Reset Box Shape to Auto"
            className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center gap-0.5 cursor-pointer"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Primary Shape Mode Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={setAuto}
          className={`px-2 py-1.5 rounded-md text-[10.5px] font-bold border transition-colors cursor-pointer text-center ${
            mode === 'auto' && !isCrossActive
              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
          title="కొలతల ప్రకారం సహజమైన ఆకారం (Exact measurements centered)"
        >
          Auto (కొలతల ప్రకారం)
        </button>
        <button
          type="button"
          onClick={setStraight}
          className={`px-2 py-1.5 rounded-md text-[10.5px] font-bold border transition-colors cursor-pointer text-center ${
            isStraight
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
          }`}
          title="కొలతలు వేరుగా ఉన్నా బాక్స్ స్ట్రెయిట్ 90° దీర్ఘచతురస్రాకారంలో ఉంటుంది"
        >
          ▭ Straight (స్ట్రెయిట్)
        </button>
        <button
          type="button"
          onClick={() => setCrossPreset(-40)}
          className={`px-2 py-1.5 rounded-md text-[10.5px] font-bold border transition-colors cursor-pointer text-center ${
            !isStraight && skewX < 0
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
          }`}
          title="బాక్స్ ఎడమవైపుకు క్రాస్ (Cross Left)"
        >
          ╲ Cross Left
        </button>
        <button
          type="button"
          onClick={() => setCrossPreset(40)}
          className={`px-2 py-1.5 rounded-md text-[10.5px] font-bold border transition-colors cursor-pointer text-center ${
            !isStraight && skewX > 0
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
          }`}
          title="బాక్స్ కుడివైపుకు క్రాస్ (Cross Right)"
        >
          ╱ Cross Right
        </button>
      </div>

      {/* Multi-Select Straight Sides (West, East, North, South can all be toggled independently) */}
      <div className="bg-slate-50/90 p-2 rounded-lg border border-slate-200 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-700">
            Straight Sides (Multi-Select — ఒకేసారి ఒకటి కంటే ఎక్కువ ఎంచుకోవచ్చు):
          </span>
          {anySideStraight && (
            <button
              type="button"
              onClick={clearStraightSides}
              className="text-[9.5px] font-semibold text-slate-600 hover:text-rose-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer"
            >
              Center (Clear All)
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { key: 'west' as const, label: 'West Straight' },
            { key: 'east' as const, label: 'East Straight' },
            { key: 'north' as const, label: 'North Straight' },
            { key: 'south' as const, label: 'South Straight' },
          ].map(({ key, label }) => {
            const isActive = straightSides[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleStraightSide(key)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                }`}
              >
                <span
                  className={`w-3 h-3 rounded-xs border flex items-center justify-center ${
                    isActive
                      ? 'bg-white border-white text-indigo-600'
                      : 'bg-slate-50 border-slate-300 text-transparent'
                  }`}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fine Cross / Slant Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-600 whitespace-nowrap">
            Top ↔ Bottom Cross:
          </span>
          <input
            type="range"
            min="-120"
            max="120"
            step="2"
            value={skewX}
            onChange={(e) => {
              const nextSkewX = parseInt(e.target.value, 10);
              onChange({
                ...boundaries,
                boxShapeMode: 'cross',
                boxStraightSides: allFourStraight
                  ? { west: false, east: false, north: false, south: false }
                  : straightSides,
                boxSkewX: nextSkewX,
              });
            }}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <span className="text-[10px] font-mono font-bold text-indigo-700 w-9 text-right">
            {skewX > 0 ? `+${skewX}` : skewX}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-600 whitespace-nowrap">
            Left ↕ Right Cross:
          </span>
          <input
            type="range"
            min="-120"
            max="120"
            step="2"
            value={skewY}
            onChange={(e) => {
              const nextSkewY = parseInt(e.target.value, 10);
              onChange({
                ...boundaries,
                boxShapeMode: 'cross',
                boxStraightSides: allFourStraight
                  ? { west: false, east: false, north: false, south: false }
                  : straightSides,
                boxSkewY: nextSkewY,
              });
            }}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <span className="text-[10px] font-mono font-bold text-indigo-700 w-9 text-right">
            {skewY > 0 ? `+${skewY}` : skewY}
          </span>
        </div>
      </div>
    </div>
  );
};
