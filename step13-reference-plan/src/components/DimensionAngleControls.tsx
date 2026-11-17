import React from 'react';
import { BoundaryDimensions, DimensionTextOrientation } from '../types';
import { Sliders, RotateCcw } from 'lucide-react';

interface DimensionAngleControlsProps {
  boundaries: BoundaryDimensions;
  onChange: (updated: BoundaryDimensions) => void;
  compact?: boolean;
}

export const DimensionAngleControls: React.FC<DimensionAngleControlsProps> = ({
  boundaries,
  onChange,
  compact = false,
}) => {
  const mode: DimensionTextOrientation = boundaries.dimensionTextOrientation || 'auto';
  const tilt = boundaries.dimensionTextTilt ?? 0;

  const setMode = (nextMode: DimensionTextOrientation) => {
    if (nextMode === 'cross') {
      onChange({
        ...boundaries,
        dimensionTextOrientation: 'cross',
        dimensionTextTilt: tilt === 0 ? -20 : tilt,
      });
    } else {
      onChange({
        ...boundaries,
        dimensionTextOrientation: nextMode,
        dimensionTextTilt: 0,
      });
    }
  };

  return (
    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-indigo-600" />
          <span>
            Measurements Angle: Straight / Cross (కొలతలు: స్ట్రెయిట్ / క్రాస్)
          </span>
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">
            {mode === 'straight-horizontal'
              ? 'Straight 0°'
              : mode === 'straight-ortho'
              ? 'Straight 0°/90°'
              : mode === 'cross'
              ? `Cross (${tilt >= 0 ? `+${tilt}` : tilt}°)`
              : `Auto${tilt !== 0 ? ` (${tilt >= 0 ? `+${tilt}` : tilt}°)` : ''}`}
          </span>
          {(mode !== 'auto' || tilt !== 0) && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...boundaries,
                  dimensionTextOrientation: 'auto',
                  dimensionTextTilt: 0,
                })
              }
              title="Reset Measurement Angle to Auto"
              className="text-[9.5px] text-slate-600 hover:text-slate-900 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer flex items-center gap-0.5"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Mode Buttons + Tilt Slider */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'auto' as DimensionTextOrientation, label: 'Auto (Edge)' },
            { id: 'straight-horizontal' as DimensionTextOrientation, label: 'Straight (0° నిలువు లేకుండా)' },
            { id: 'straight-ortho' as DimensionTextOrientation, label: 'Straight (0° / 90°)' },
            { id: 'cross' as DimensionTextOrientation, label: 'Cross (క్రాస్ / Slant)' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`px-2 py-1 rounded-md text-[10.5px] font-bold border cursor-pointer transition-colors ${
                mode === opt.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Fine Cross/Straight Angle Slider */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
            Cross Tilt:
          </span>
          <input
            type="range"
            min="-45"
            max="45"
            step="1"
            value={tilt}
            onChange={(e) => {
              const nextTilt = parseInt(e.target.value, 10);
              onChange({
                ...boundaries,
                dimensionTextOrientation: nextTilt !== 0 && mode === 'auto' ? 'cross' : mode,
                dimensionTextTilt: nextTilt,
              });
            }}
            className="flex-1 min-w-[80px] h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          {!compact && (
            <div className="flex items-center gap-1 text-[9.5px]">
              {[-30, -15, 0, 15, 30].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...boundaries,
                      dimensionTextOrientation: deg === 0 ? (mode === 'cross' ? 'auto' : mode) : 'cross',
                      dimensionTextTilt: deg,
                    })
                  }
                  className={`px-1.5 py-0.5 rounded font-semibold border cursor-pointer ${
                    tilt === deg
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {deg > 0 ? `+${deg}°` : `${deg}°`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
