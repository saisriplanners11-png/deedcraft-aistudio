import React, { useRef } from 'react';
import { BoundaryDimensions, LocationMapConfig, LocationMapPosition } from '../types';
import { MapPin, Upload, Trash2, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RotateCcw, Image as ImageIcon, Map as MapIcon } from 'lucide-react';

interface LocationMapControlsProps {
  boundaries: BoundaryDimensions;
  onChange: (updated: BoundaryDimensions) => void;
  compact?: boolean;
}

const DEFAULT_LOCATION_MAP: LocationMapConfig = {
  enabled: false,
  mode: 'cad',
  position: 'side-right',
  title: 'LOCATION MAP',
  mainRoadName: 'MAIN ROAD',
  approachRoadName: 'APPROACH ROAD',
  landmarkName: '',
  distanceText: '',
  siteLabel: '',
  sizePercent: 100,
  offsetX: 0,
  offsetY: 0,
  showNotToScale: true,
};

export const LocationMapControls: React.FC<LocationMapControlsProps> = ({
  boundaries,
  onChange,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locMap: LocationMapConfig = boundaries.locationMap || DEFAULT_LOCATION_MAP;

  const updateLocMap = (patch: Partial<LocationMapConfig>) => {
    onChange({
      ...boundaries,
      locationMap: {
        ...DEFAULT_LOCATION_MAP,
        ...locMap,
        ...patch,
      },
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateLocMap({
          enabled: true,
          mode: 'image',
          imageDataUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-3">
      {/* Header & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              Location Map / Key Map (లొకేషన్ మ్యాప్)
            </h4>
            {!compact && (
              <p className="text-[10.5px] text-slate-500">
                స్కెచ్‌లో కీ-మ్యాప్ (CAD) లేదా Google Map / లేఅవుట్ ఫోటో యాడ్ చేయండి
              </p>
            )}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
          <input
            type="checkbox"
            checked={!!locMap.enabled}
            onChange={(e) => updateLocMap({ enabled: e.target.checked })}
            className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
          />
          <span className={`text-[11px] font-bold ${locMap.enabled ? 'text-emerald-700' : 'text-slate-600'}`}>
            {locMap.enabled ? 'Location Map ON' : 'Add Location Map'}
          </span>
        </label>
      </div>

      {locMap.enabled && (
        <div className="space-y-3 pt-1 border-t border-slate-200">
          {/* Mode Selector: CAD Key Map vs Upload Image */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateLocMap({ mode: 'cad' })}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                (locMap.mode || 'cad') === 'cad'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              Auto CAD Key Map (డ్రాయింగ్)
            </button>
            <button
              type="button"
              onClick={() => updateLocMap({ mode: 'image' })}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                locMap.mode === 'image'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Upload Map Image (ఫోటో / స్క్రీన్‌షాట్)
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center gap-1 cursor-pointer ml-auto"
            >
              <Upload className="w-3.5 h-3.5" />
              {locMap.imageDataUrl ? 'Change Image' : 'Upload Map Screenshot'}
            </button>
            {locMap.imageDataUrl && (
              <button
                type="button"
                onClick={() => updateLocMap({ imageDataUrl: undefined, mode: 'cad' })}
                title="Remove uploaded image"
                className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* CAD Key Map Text Fields */}
          {(locMap.mode || 'cad') === 'cad' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Main Road (మెయిన్ రోడ్)
                </label>
                <input
                  type="text"
                  placeholder="e.g. MAIN ROAD / NH-44"
                  value={locMap.mainRoadName ?? 'MAIN ROAD'}
                  onChange={(e) => updateLocMap({ mainRoadName: e.target.value })}
                  className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Approach Road (అప్రోచ్ రోడ్)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 30' COLONY ROAD"
                  value={locMap.approachRoadName ?? 'APPROACH ROAD'}
                  onChange={(e) => updateLocMap({ approachRoadName: e.target.value })}
                  className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Landmark (సమీప గుర్తు)
                </label>
                <input
                  type="text"
                  placeholder="e.g. GOVT SCHOOL / TEMPLE"
                  value={locMap.landmarkName ?? ''}
                  onChange={(e) => updateLocMap({ landmarkName: e.target.value })}
                  className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Distance from Main Rd (దూరం)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 150 Mtrs"
                  value={locMap.distanceText ?? ''}
                  onChange={(e) => updateLocMap({ distanceText: e.target.value })}
                  className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Site Label (సైట్ పేరు)
                </label>
                <input
                  type="text"
                  placeholder="Auto (Plot / H.No)"
                  value={locMap.siteLabel ?? ''}
                  onChange={(e) => updateLocMap({ siteLabel: e.target.value })}
                  className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Box Title (టైటిల్)
                </label>
                <input
                  type="text"
                  placeholder="LOCATION MAP"
                  value={locMap.title ?? 'LOCATION MAP'}
                  onChange={(e) => updateLocMap({ title: e.target.value })}
                  className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                />
              </div>
            </div>
          ) : (
            <div className="bg-white p-2.5 rounded-lg border border-dashed border-slate-300 flex flex-wrap items-center justify-between gap-2">
              {locMap.imageDataUrl ? (
                <div className="flex items-center gap-2.5">
                  <img
                    src={locMap.imageDataUrl}
                    alt="Uploaded Location Map Preview"
                    className="w-12 h-12 object-cover rounded border border-slate-200"
                  />
                  <div className="text-[11px] text-slate-700 font-semibold">
                    లొకేషన్ మ్యాప్ ఫోటో లోడ్ అయ్యింది! (Location Map Image Ready)
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  Google Maps స్క్రీన్‌షాట్ లేదా విలేజ్ / లేఅవుట్ మ్యాప్ ఫోటో అప్‌లోడ్ చేయడానికి "Upload Map Screenshot" క్లిక్ చేయండి.
                </div>
              )}
            </div>
          )}

          {/* Placement, Size & Position Controls */}
          <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold text-slate-700">
                Position (స్థానం):
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'side-right', label: 'Right Side (పక్కన)' },
                    { id: 'bottom-left', label: 'Bottom-Left' },
                    { id: 'bottom-right', label: 'Bottom-Right' },
                    { id: 'top-left', label: 'Top-Left' },
                    { id: 'top-right', label: 'Top-Right' },
                  ] as { id: LocationMapPosition; label: string }[]
                ).map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => updateLocMap({ position: pos.id, offsetX: 0, offsetY: 0 })}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                      (locMap.position || 'side-right') === pos.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
              {/* Size Slider */}
              <div className="flex items-center gap-2 min-w-[160px] flex-1">
                <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">
                  Size: {locMap.sizePercent ?? 100}%
                </span>
                <input
                  type="range"
                  min="60"
                  max="140"
                  step="5"
                  value={locMap.sizePercent ?? 100}
                  onChange={(e) => updateLocMap({ sizePercent: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>

              {/* Fine Nudge Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateLocMap({ offsetX: (locMap.offsetX || 0) - 10 })}
                  title="Move Left"
                  className="p-1 rounded border border-slate-200 bg-slate-50 hover:bg-emerald-50 text-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => updateLocMap({ offsetY: (locMap.offsetY || 0) - 10 })}
                  title="Move Top"
                  className="p-1 rounded border border-slate-200 bg-slate-50 hover:bg-emerald-50 text-slate-700 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => updateLocMap({ offsetY: (locMap.offsetY || 0) + 10 })}
                  title="Move Bottom"
                  className="p-1 rounded border border-slate-200 bg-slate-50 hover:bg-emerald-50 text-slate-700 cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => updateLocMap({ offsetX: (locMap.offsetX || 0) + 10 })}
                  title="Move Right"
                  className="p-1 rounded border border-slate-200 bg-slate-50 hover:bg-emerald-50 text-slate-700 cursor-pointer"
                >
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => updateLocMap({ offsetX: 0, offsetY: 0, sizePercent: 100 })}
                  title="Reset Location Map Position & Size"
                  className="px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[9.5px] font-semibold text-slate-600 flex items-center gap-0.5 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
