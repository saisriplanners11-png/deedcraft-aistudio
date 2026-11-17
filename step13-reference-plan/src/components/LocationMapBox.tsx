import React from 'react';
import { LocationMapConfig, PropertyDetails } from '../types';

interface LocationMapBoxProps {
  config: LocationMapConfig;
  property: PropertyDetails;
  isTelugu?: boolean;
  isPrintMode?: boolean;
}

export const LocationMapBox: React.FC<LocationMapBoxProps> = ({
  config,
  property,
  isTelugu = false,
  isPrintMode = false,
}) => {
  if (!config?.enabled) return null;

  const mode = config.mode || (config.imageDataUrl ? 'image' : 'cad');
  const titleText = config.title?.trim() || (isTelugu ? 'లొకేషన్ మ్యాప్' : 'LOCATION MAP');
  const showNotToScale = config.showNotToScale !== false;

  const defaultSiteLabel = property.plotNo
    ? `PLOT NO. ${property.plotNo}`
    : property.houseNo
    ? `H.NO. ${property.houseNo}`
    : property.surveyNo
    ? `SY.NO. ${property.surveyNo}`
    : 'SITE';

  const siteLabel = (config.siteLabel?.trim() || defaultSiteLabel).toUpperCase();
  const mainRoadName = (config.mainRoadName?.trim() || 'MAIN ROAD').toUpperCase();
  const approachRoadName = (config.approachRoadName?.trim() || 'APPROACH ROAD').toUpperCase();
  const landmarkName = (config.landmarkName?.trim() || '').toUpperCase();
  const distanceText = (config.distanceText?.trim() || '').toUpperCase();
  const localityText = (property.locality || property.village || '').trim().toUpperCase();

  const scale = (config.sizePercent ?? 100) / 100;
  const offsetX = config.offsetX ?? 0;
  const offsetY = config.offsetY ?? 0;

  return (
    <div
      id="location-map-box"
      className={`bg-white border-[1.5px] border-black flex flex-col select-none ${
        isPrintMode ? 'shadow-none' : 'shadow-xs'
      }`}
      style={{
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      {/* Header Title Bar */}
      <div className="border-b border-black px-2 py-0.5 text-center bg-white">
        <div className="text-[10px] font-bold tracking-wider text-black leading-tight uppercase">
          {titleText}
        </div>
        {showNotToScale && (
          <div className="text-[7.5px] font-semibold text-black/80 tracking-wide leading-tight">
            {isTelugu ? '(స్కేల్‌కు కాదు)' : '(NOT TO SCALE)'}
          </div>
        )}
      </div>

      {/* Body: Uploaded Image OR Auto CAD Key Map */}
      {mode === 'image' && config.imageDataUrl ? (
        <div className="p-1 bg-white flex items-center justify-center min-h-[120px] max-h-[210px] overflow-hidden">
          <img
            src={config.imageDataUrl}
            alt="Location Map"
            className="w-full h-full max-h-[195px] object-contain block"
          />
        </div>
      ) : (
        <div className="p-1 bg-white">
          <svg
            viewBox="0 0 220 175"
            className="w-full h-auto block"
            style={{ minWidth: '150px' }}
          >
            {/* Subtle grid background */}
            <rect x="0" y="0" width="220" height="175" fill="#ffffff" />

            {/* North Mini Indicator (Top Right) */}
            <g transform="translate(200, 18)">
              <line x1="0" y1="10" x2="0" y2="-8" stroke="#000000" strokeWidth="1.2" />
              <polygon points="0,-11 -3.5,-4 3.5,-4" fill="#000000" />
              <text
                x="0"
                y="-13"
                textAnchor="middle"
                className="font-bold fill-black"
                style={{ fontSize: '7.5px' }}
              >
                N
              </text>
            </g>

            {/* Main Road along Top */}
            <g id="locmap-main-road">
              <rect x="6" y="22" width="182" height="22" fill="#f8fafc" />
              <line x1="6" y1="22" x2="188" y2="22" stroke="#000000" strokeWidth="1.4" />
              {/* Gap where approach road connects */}
              <line x1="6" y1="44" x2="88" y2="44" stroke="#000000" strokeWidth="1.4" />
              <line x1="112" y1="44" x2="188" y2="44" stroke="#000000" strokeWidth="1.4" />
              {/* Center dashed line */}
              <line
                x1="12"
                y1="33"
                x2="182"
                y2="33"
                stroke="#000000"
                strokeWidth="0.8"
                strokeDasharray="5,4"
              />
              {/* Main road label */}
              <text
                x="97"
                y="15"
                textAnchor="middle"
                className="font-bold fill-black"
                style={{ fontSize: '8px' }}
              >
                {mainRoadName}
              </text>
            </g>

            {/* Vertical Approach Road connecting Main Road to Site */}
            <g id="locmap-approach-road">
              <rect x="88" y="44" width="24" height="86" fill="#f8fafc" />
              <line x1="88" y1="44" x2="88" y2="124" stroke="#000000" strokeWidth="1.2" />
              <line x1="112" y1="44" x2="112" y2="108" stroke="#000000" strokeWidth="1.2" />
              {/* Horizontal branch road towards site on right */}
              <rect x="112" y="108" width="44" height="18" fill="#f8fafc" />
              <line x1="112" y1="108" x2="156" y2="108" stroke="#000000" strokeWidth="1.2" />
              <line x1="88" y1="126" x2="156" y2="126" stroke="#000000" strokeWidth="1.2" />

              {/* Center dashed guide */}
              <line
                x1="100"
                y1="48"
                x2="100"
                y2="117"
                stroke="#000000"
                strokeWidth="0.7"
                strokeDasharray="3,3"
              />
              <line
                x1="100"
                y1="117"
                x2="150"
                y2="117"
                stroke="#000000"
                strokeWidth="0.7"
                strokeDasharray="3,3"
              />

              {/* Approach Road Label (vertical) */}
              <text
                x="78"
                y="84"
                textAnchor="middle"
                transform="rotate(-90, 78, 84)"
                className="font-semibold fill-black"
                style={{ fontSize: '7px' }}
              >
                {approachRoadName}
              </text>

              {/* Distance callout if entered */}
              {distanceText && (
                <g>
                  <line x1="117" y1="48" x2="117" y2="104" stroke="#000000" strokeWidth="0.7" />
                  <polygon points="117,45 114.5,50 119.5,50" fill="#000000" />
                  <polygon points="117,107 114.5,102 119.5,102" fill="#000000" />
                  <text
                    x="122"
                    y="78"
                    className="font-bold fill-black"
                    style={{ fontSize: '7px' }}
                  >
                    {distanceText}
                  </text>
                </g>
              )}
            </g>

            {/* Landmark box if provided */}
            {landmarkName && (
              <g id="locmap-landmark" transform="translate(12, 56)">
                <rect
                  x="0"
                  y="0"
                  width="54"
                  height="26"
                  fill="#ffffff"
                  stroke="#000000"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <circle cx="8" cy="13" r="2.5" fill="#000000" />
                <text
                  x="14"
                  y="11"
                  className="font-bold fill-black"
                  style={{ fontSize: '6.2px' }}
                >
                  LANDMARK
                </text>
                <text
                  x="14"
                  y="20"
                  className="font-semibold fill-black"
                  style={{ fontSize: '6.5px' }}
                >
                  {landmarkName.length > 13 ? `${landmarkName.slice(0, 12)}…` : landmarkName}
                </text>
              </g>
            )}

            {/* Highlighted Target Property / Site Box */}
            <g id="locmap-site-box" transform="translate(156, 94)">
              <rect
                x="0"
                y="0"
                width="52"
                height="44"
                fill="#ffe4e6"
                fillOpacity="0.65"
                stroke="#dc2626"
                strokeWidth="2"
              />
              {/* Diagonal cross/hatch lines */}
              <line x1="0" y1="0" x2="52" y2="44" stroke="#dc2626" strokeWidth="0.6" strokeOpacity="0.45" />
              <line x1="52" y1="0" x2="0" y2="44" stroke="#dc2626" strokeWidth="0.6" strokeOpacity="0.45" />
              <rect x="4" y="13" width="44" height="18" fill="#ffffff" fillOpacity="0.92" />
              <text
                x="26"
                y="21"
                textAnchor="middle"
                className="font-extrabold fill-red-700"
                style={{ fontSize: '7px' }}
              >
                {siteLabel.length > 12 ? siteLabel.slice(0, 12) : siteLabel}
              </text>
              <text
                x="26"
                y="29"
                textAnchor="middle"
                className="font-bold fill-black"
                style={{ fontSize: '6px' }}
              >
                {siteLabel.length > 12 ? siteLabel.slice(12, 24) : 'PROPOSED SITE'}
              </text>
            </g>

            {/* Footer Locality / Village strip */}
            {localityText && (
              <text
                x="110"
                y="164"
                textAnchor="middle"
                className="font-bold fill-black"
                style={{ fontSize: '7.5px' }}
              >
                {localityText}
              </text>
            )}
          </svg>
        </div>
      )}
    </div>
  );
};
