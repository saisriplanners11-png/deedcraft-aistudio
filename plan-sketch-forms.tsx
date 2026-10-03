import React from 'react';
import { Section, Input, C } from './ui';
import { css } from './css';
import type { Field } from './fields';
import type {
  BoundaryDimensions, DimensionUnit, HouseDetails, PartyDetails, PropertyDetails,
  PropertyType, RoadLayoutType, RoadSideOption, Witnesses,
} from './plan-sketch-types';
import { calculateSqMtrs, parseDimension } from './plan-sketch-dimensions';

/** A minimal Field descriptor for a one-off input outside the fixed ALL_FIELDS catalog. */
const field = (id: string, label: string, extra: Partial<Field> = {}): Field => ({ id, label, ...extra });

const ROAD_SIDES: RoadSideOption[] = ['North', 'South', 'East', 'West'];
const ROAD_LAYOUTS: RoadLayoutType[] = [
  'One Side Road', 'Two Side Road / Corner', 'Three Side Road', 'Four Side Road / Island',
  'Through Road / Through Plot', 'T-Junction', 'Dead-End / Cul-de-Sac',
];
const PROPERTY_TYPES: PropertyType[] = ['Open Plot', 'Plot', 'House', 'Open Place', 'Demolished House', 'Part Open Place', 'Flat', 'Commercial Building', 'Agricultural Land', 'Other'];
const LOCATION_TEMPLATES: { label: string; value: NonNullable<PropertyDetails['locationTemplateType']> }[] = [
  { label: 'Bearing H.No. & Plot No.', value: 'bearing_and_plot' }, { label: 'Bearing H.No. only', value: 'bearing_only' },
  { label: 'Plot No. only', value: 'plot_only' }, { label: 'Survey No. only', value: 'survey_only' },
  { label: 'Near H.No.', value: 'near_hno' }, { label: 'Adjacent H.No.', value: 'adjacent_hno' },
  { label: 'Opposite H.No.', value: 'opp_hno' }, { label: 'Beside H.No.', value: 'beside_hno' },
  { label: 'Part open place H.No.', value: 'part_open_place_hno' }, { label: 'Demolished house H.No.', value: 'demolished_house_hno' },
];
const HOUSE_POSITIONS: NonNullable<HouseDetails['position']>[] = ['center', 'north-west', 'north-east', 'south-west', 'south-east', 'north', 'south', 'east', 'west', 'attached-north', 'attached-south', 'attached-west', 'attached-east', 'attached-nw-corner', 'attached-ne-corner', 'attached-sw-corner', 'attached-se-corner', 'attached-center', 'custom'];
const STRUCTURE_TYPES = ['R.C.C. Building', 'R.C.C. Roof House', 'Ground Floor House', 'G + 1 Upper Floor', 'G + 2 Upper Floors', 'Independent Villa', 'Tiled House', 'A.C. Sheet Roof House', 'Madras Terrace House', 'Commercial Building', 'Shed Structure', 'Other / Custom Structure'];

function ToggleGroup<T extends string>({ options, selected, onToggle, multi }: { options: T[]; selected: T[]; onToggle: (v: T) => void; multi?: boolean }) {
  return (
    <div className="picker-grid" style={css('grid-template-columns:repeat(auto-fill,minmax(120px,1fr))')}>
      {options.map(o => (
        <button
          key={o}
          type="button"
          className={`picker-tile${selected.includes(o) ? ' selected' : ''}`}
          onClick={() => onToggle(o)}
          style={css('cursor:pointer')}
        >
          <b>{o}</b>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- property

export function PropertyDetailsSection({ property, boundaries, onChange }: { property: PropertyDetails; boundaries?: BoundaryDimensions; onChange: (p: PropertyDetails) => void }) {
  const set = <K extends keyof PropertyDetails>(key: K, value: PropertyDetails[K]) => onChange({ ...property, [key]: value });
  const houseEnabled = property.propertyType === 'House' || !!property.house?.enabled;
  const house = property.house || {};
  const setHouse = (patch: Partial<HouseDetails>) => onChange({ ...property, house: { ...house, ...patch } });
  const houses = property.houses?.length ? property.houses : houseEnabled ? [house] : [];
  const setHouses = (next: HouseDetails[]) => onChange({ ...property, houses: next, house: next[0] });
  const patchHouse = (index: number, patch: Partial<HouseDetails>) => {
    const next = houses.map((item, i) => i === index ? { ...item, ...patch } : item);
    setHouses(next);
  };
  const dimensionPatch = (item: HouseDetails, patch: { widthRaw?: string; lengthRaw?: string }) => {
    const widthRaw = patch.widthRaw ?? item.widthRaw;
    const lengthRaw = patch.lengthRaw ?? item.lengthRaw;
    const width = parseDimension(widthRaw || '', 'Feet').normalized;
    const length = parseDimension(lengthRaw || '', 'Feet').normalized;
    return { ...patch, ...(width > 0 && length > 0 ? { plinthAreaSqFt: Math.round(width * length * 100) / 100,
      plinthAreaSqYds: Math.round(width * length / 9 * 100) / 100 } : {}) };
  };
  const plotFeet = (side: 'north' | 'south' | 'east' | 'west') => {
    const dim = boundaries?.[`${side}Dim`];
    return dim && dim.normalized > 0 ? dim.normalized * (dim.unit === 'Metres' ? 3.28084 : 1) : 0;
  };

  return (
    <Section title="Property identification" telugu="ఆస్తి గుర్తింపు">
      <div className="picker-grid" style={css('margin-bottom:16px')}>
        {PROPERTY_TYPES.map(t => (
          <button key={t} type="button" className={`picker-tile${property.propertyType === t ? ' selected' : ''}`}
            onClick={() => set('propertyType', t)} style={css('cursor:pointer')}>
            <b>{t}</b>
          </button>
        ))}
      </div>
      {property.propertyType === 'Other' && (
        <div style={css('margin-bottom:16px')}>
          <Input field={field('customPropertyType', 'Custom property type')} value={property.customPropertyType || ''} onChange={v => set('customPropertyType', v)} />
        </div>
      )}
      <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px')}>
        <Input field={field('areaSqYards', 'Area (Sq. Yards)', { type: 'number' })} value={String(property.areaSqYards ?? '')}
          onChange={v => { const n = v === '' ? '' : Number(v); onChange({ ...property, areaSqYards: n, areaSqMtrs: calculateSqMtrs(n) }); }} />
        <Input field={field('areaSqMtrs', 'Area (Sq. Metres)', { type: 'number', hint: 'Calculated from Sq. Yards' })} value={String(property.areaSqMtrs ?? '')}
          onChange={v => set('areaSqMtrs', v === '' ? '' : Number(v))} />
        <Input field={field('surveyNo', 'Survey no(s).')} value={property.surveyNo} onChange={v => set('surveyNo', v)} />
        <Input field={field('plotNo', 'Plot no.')} value={property.plotNo || ''} onChange={v => set('plotNo', v)} />
        <Input field={field('houseNo', 'Bearing house no.')} value={property.houseNo || ''} onChange={v => set('houseNo', v)} />
        <Input field={field('houseAuthority', 'House no. authority', { type: 'select', options: ['Municipal Council House No.', 'Gram Panchayat House No.', 'Municipal Corporation House No.', 'House No.', 'H.No.'] })} value={property.houseAuthority || ''} onChange={v => set('houseAuthority', v)} />
        <Input field={field('nearAdjacent', 'Landmark relation', { type: 'select', options: ['Near', 'Adjacent'] })} value={property.nearAdjacent || ''} onChange={v => set('nearAdjacent', v as PropertyDetails['nearAdjacent'])} />
        <Input field={field('nearHNo', 'Near / adjacent H.No.')} value={property.nearHNo} onChange={v => set('nearHNo', v)} />
        <Input field={field('locality', 'Locality')} value={property.locality} onChange={v => set('locality', v)} />
        <Input field={field('village', 'Village')} value={property.village} onChange={v => set('village', v)} />
        <Input field={field('mandal', 'Mandal')} value={property.mandal} onChange={v => set('mandal', v)} />
        <Input field={field('district', 'District')} value={property.district} onChange={v => set('district', v)} />
      </div>

      <div style={css('margin-top:16px')}>
        <span style={css(`display:block;margin-bottom:8px;font-size:10px;font-weight:700;color:${C.mutedSoft}`)}>Location description template</span>
        <div className="picker-grid">{LOCATION_TEMPLATES.map(option => <button key={option.value} type="button"
          className={`picker-tile${property.locationTemplateType === option.value ? ' selected' : ''}`}
          onClick={() => set('locationTemplateType', option.value)}><b>{option.label}</b></button>)}</div>
      </div>

      <label style={css('display:flex;align-items:center;gap:8px;margin-top:18px;font-size:12px;color:' + C.body)}>
        <input type="checkbox" checked={houseEnabled} onChange={e => setHouse({ enabled: e.target.checked })} />
        This property includes a house / built structure
      </label>
      {houseEnabled && <>
        <div style={css('display:flex;justify-content:flex-end;margin-top:10px')}><button type="button" className="quiet"
          onClick={() => setHouses([...houses, { id: crypto.randomUUID(), name: `Structure ${houses.length + 1}`, enabled: true, position: 'center' }])}>+ Add another house / shed</button></div>
        {houses.map((item, index) => (
        <div key={item.id || index} style={css(`margin-top:14px;border:1px solid ${C.goldLight};background:${C.goldBg};padding:16px 18px`)}>
          <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px')}>
            <div>
              <div style={css(`font-family:${C.serif};font-size:14px;font-weight:600;color:${C.ink}`)}>House / Shed {index + 1} Measurements &amp; Sketch Drawing</div>
              <div style={css(`font-family:${C.telugu};font-size:11px;color:${C.mutedSoft};margin-top:2px`)}>ఇంటి కొలతలు &amp; స్కెచ్ డ్రాయింగ్</div>
            </div>
            <label style={css(`display:flex;align-items:center;gap:7px;font-size:11.5px;color:${C.body};white-space:nowrap;cursor:pointer`)}>
              <input type="checkbox" checked={item.showMeasurements !== false} onChange={e => patchHouse(index, { showMeasurements: e.target.checked })} />
              Show House in Sketch
            </label>
            <button type="button" className="quiet" onClick={() => setHouses(houses.filter((_, i) => i !== index))}>Remove</button>
          </div>

          <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px')}>
            <Input field={field(`houseName-${index}`, 'Structure name')} value={item.name || ''} onChange={v => patchHouse(index, { name: v })} />
            <Input field={field(`housePosition-${index}`, 'Position', { type: 'select', options: HOUSE_POSITIONS })} value={item.position || 'center'} onChange={v => patchHouse(index, { position: v as HouseDetails['position'] })} />
            <Input field={field(`houseWidthRaw-${index}`, 'House width (e.g. 24\'-0")')} value={item.widthRaw || ''}
              onChange={v => patchHouse(index, dimensionPatch(item, { widthRaw: v }))} />
            <Input field={field(`houseLengthRaw-${index}`, 'House length (e.g. 36\'-0")')} value={item.lengthRaw || ''}
              onChange={v => patchHouse(index, dimensionPatch(item, { lengthRaw: v }))} />
            <Input field={field(`structureType-${index}`, 'Structure / roof type', { type: 'select', options: STRUCTURE_TYPES })} value={item.structureType || ''} onChange={v => patchHouse(index, { structureType: v })} />
            <Input field={field(`roofType-${index}`, 'Roof type')} value={item.roofType || ''} onChange={v => patchHouse(index, { roofType: v })} />
            <Input field={field(`houseAuthority-${index}`, 'House no. authority')} value={item.houseAuthority || ''} onChange={v => patchHouse(index, { houseAuthority: v })} />
            <Input field={field(`plinthAreaSqFt-${index}`, 'Plinth area (Sq. Ft.)', { type: 'number', hint: 'W × L when dimensions are entered' })}
              value={String(item.plinthAreaSqFt ?? '')} onChange={v => patchHouse(index, { plinthAreaSqFt: v === '' ? '' : Number(v) })} />
            <Input field={field(`plinthPrefix-${index}`, 'Plinth label')} value={item.plinthPrefix || ''} onChange={v => patchHouse(index, { plinthPrefix: v })} />
          </div>

          <div style={css(`display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:20px;padding-top:14px;border-top:1px solid ${C.rule}`)}>
            <span style={css(`font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.mutedSoft}`)}>
              Setbacks &amp; open spaces (సెట్‌బ్యాక్‌లు)
            </span>
            <label style={css(`display:flex;align-items:center;gap:7px;font-size:11.5px;color:${C.body};cursor:pointer`)}>
              <input type="checkbox" checked={item.showSetbacks !== false} onChange={e => patchHouse(index, { showSetbacks: e.target.checked })} />
              Show Setback Lines
            </label>
          </div>
          <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px;margin-top:12px')}>
            <Input field={field(`setbackSouth-${index}`, 'South (front) open', { hint: `e.g. 12'-0"` })} value={item.setbackSouth || ''} onChange={v => patchHouse(index, { setbackSouth: v })} />
            <Input field={field(`setbackNorth-${index}`, 'North (rear) open', { hint: `e.g. 8'-0"` })} value={item.setbackNorth || ''} onChange={v => patchHouse(index, { setbackNorth: v })} />
            <Input field={field(`setbackWest-${index}`, 'West (left) open', { hint: `e.g. 8'-0"` })} value={item.setbackWest || ''} onChange={v => patchHouse(index, { setbackWest: v })} />
            <Input field={field(`setbackEast-${index}`, 'East (right) open', { hint: `e.g. 8'-0"` })} value={item.setbackEast || ''} onChange={v => patchHouse(index, { setbackEast: v })} />
          </div>
          <div style={css('display:flex;gap:8px;margin-top:12px')}>
            <button type="button" className="quiet" onClick={() => {
              const plotWidth = plotFeet('north') && plotFeet('south') ? Math.min(plotFeet('north'), plotFeet('south')) : 0;
              const plotLength = plotFeet('east') && plotFeet('west') ? Math.min(plotFeet('east'), plotFeet('west')) : 0;
              const width = Math.max(0, plotWidth - parseDimension(item.setbackEast || '', 'Feet').normalized - parseDimension(item.setbackWest || '', 'Feet').normalized);
              const length = Math.max(0, plotLength - parseDimension(item.setbackNorth || '', 'Feet').normalized - parseDimension(item.setbackSouth || '', 'Feet').normalized);
              if (width > 0 && length > 0) patchHouse(index, dimensionPatch(item, { widthRaw: String(Math.round(width * 100) / 100), lengthRaw: String(Math.round(length * 100) / 100) }));
            }}>Auto-calc from setbacks</button>
            <button type="button" className="quiet" onClick={() => {
              const plotWidth = plotFeet('north') && plotFeet('south') ? Math.min(plotFeet('north'), plotFeet('south')) : 0;
              const plotLength = plotFeet('east') && plotFeet('west') ? Math.min(plotFeet('east'), plotFeet('west')) : 0;
              const width = parseDimension(item.widthRaw || '', 'Feet').normalized;
              const length = parseDimension(item.lengthRaw || '', 'Feet').normalized;
              if (plotWidth > 0 && plotLength > 0 && width > 0 && length > 0) patchHouse(index, { setbackEast: String(Math.max(0, (plotWidth - width) / 2)), setbackWest: String(Math.max(0, (plotWidth - width) / 2)), setbackNorth: String(Math.max(0, (plotLength - length) / 2)), setbackSouth: String(Math.max(0, (plotLength - length) / 2)) });
            }}>Center house</button>
          </div>
        </div>
        ))}
      </>}
    </Section>
  );
}

// ---------------------------------------------------------------- boundaries

export function BoundariesSection({ boundaries, onChange }: { boundaries: BoundaryDimensions; onChange: (b: BoundaryDimensions) => void }) {
  const set = <K extends keyof BoundaryDimensions>(key: K, value: BoundaryDimensions[K]) => onChange({ ...boundaries, [key]: value });
  const unit: DimensionUnit = boundaries.dimensionUnit || 'Feet';

  const setDim = (side: 'north' | 'south' | 'east' | 'west', raw: string) => {
    onChange({ ...boundaries, [`${side}Dim`]: parseDimension(raw, unit) } as BoundaryDimensions);
  };

  const sides: { key: 'north' | 'south' | 'east' | 'west'; label: string }[] = [
    { key: 'north', label: 'North' }, { key: 'south', label: 'South' }, { key: 'east', label: 'East' }, { key: 'west', label: 'West' },
  ];

  const isTJunction = boundaries.roadLayoutType === 'T-Junction';
  const isDeadEnd = boundaries.roadLayoutType === 'Dead-End / Cul-de-Sac';

  return (
    <Section title="Boundaries &amp; dimensions" telugu="చతుస్సీమలు">
      <div style={css('display:flex;align-items:center;gap:14px;margin-bottom:16px')}>
        <span style={css(`font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.mutedSoft}`)}>Unit</span>
        {(['Feet', 'Metres'] as DimensionUnit[]).map(u => (
          <button key={u} type="button" className={`picker-tile${unit === u ? ' selected' : ''}`}
            style={css('padding:5px 12px;cursor:pointer')}
            onClick={() => onChange({
              ...boundaries, dimensionUnit: u,
              northDim: parseDimension(boundaries.northDim.raw, u), southDim: parseDimension(boundaries.southDim.raw, u),
              eastDim: parseDimension(boundaries.eastDim.raw, u), westDim: parseDimension(boundaries.westDim.raw, u),
            })}>
            <b>{u}</b>
          </button>
        ))}
      </div>

      <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 18px')}>
        {sides.map(({ key, label }) => (
          <React.Fragment key={key}>
            <Input field={field(`${key}Boundary`, `${label} boundary (adjacent property)`)} value={(boundaries as any)[`${key}Boundary`]} onChange={v => set(`${key}Boundary` as any, v)} />
            <Input field={field(`${key}Dim`, `${label} dimension`, { hint: unit === 'Feet' ? `e.g. 40'-0"` : 'e.g. 12.35' })} value={(boundaries as any)[`${key}Dim`].raw} onChange={v => setDim(key, v)} />
          </React.Fragment>
        ))}
      </div>

      <div style={css('margin-top:20px;padding-top:16px;border-top:1px solid ' + C.rule)}>
        <span style={css(`font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.mutedSoft};display:block;margin-bottom:8px`)}>Road sides</span>
        <ToggleGroup options={ROAD_SIDES} selected={boundaries.roadSides} multi onToggle={side => {
          const has = boundaries.roadSides.includes(side);
          set('roadSides', has ? boundaries.roadSides.filter(s => s !== side) : [...boundaries.roadSides, side]);
        }} />
        <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px;margin-top:14px')}>
          <Input field={field('roadWidth', 'Road width', { hint: `e.g. 30'-0"` })} value={boundaries.roadWidth} onChange={v => set('roadWidth', v)} />
        </div>
        <label style={css('display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:' + C.body)}>
          <input type="checkbox" checked={boundaries.cornerProperty} onChange={e => set('cornerProperty', e.target.checked)} />
          Corner property (roads on two sides)
        </label>
        <label style={css('display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:' + C.body)}>
          <input type="checkbox" checked={boundaries.roadContinuous !== false} onChange={e => set('roadContinuous', e.target.checked)} />
          Continuous road beyond plot edges
        </label>
        {boundaries.roadSides.map(side => {
          const key = side.toLowerCase() as 'north' | 'south' | 'east' | 'west';
          const vertical = key === 'east' || key === 'west';
          const continuityKey = `${key}RoadContinuity` as keyof BoundaryDimensions;
          const firstKey = `${key}RoadDirection${vertical ? 'Top' : 'Left'}` as keyof BoundaryDimensions;
          const secondKey = `${key}RoadDirection${vertical ? 'Bottom' : 'Right'}` as keyof BoundaryDimensions;
          return <div key={side} style={css(`display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px;padding:10px;border:1px solid ${C.rule}`)}>
            <Input field={field(continuityKey, `${side} road continuity`, { type: 'select', options: vertical ? ['both', 'top', 'bottom', 'none'] : ['both', 'left', 'right', 'none'] })}
              value={String(boundaries[continuityKey] || 'both')} onChange={v => onChange({ ...boundaries, [continuityKey]: v })} />
            <Input field={field(firstKey, `${side} road ${vertical ? 'top' : 'left'} label`)} value={String(boundaries[firstKey] || '')} onChange={v => onChange({ ...boundaries, [firstKey]: v })} />
            <Input field={field(secondKey, `${side} road ${vertical ? 'bottom' : 'right'} label`)} value={String(boundaries[secondKey] || '')} onChange={v => onChange({ ...boundaries, [secondKey]: v })} />
          </div>;
        })}
      </div>

      <div style={css('margin-top:20px;padding-top:16px;border-top:1px solid ' + C.rule)}>
        <span style={css(`font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.mutedSoft};display:block;margin-bottom:8px`)}>Road layout</span>
        <div className="picker-grid">
          {ROAD_LAYOUTS.map(t => (
            <button key={t} type="button" className={`picker-tile${boundaries.roadLayoutType === t ? ' selected' : ''}`}
              onClick={() => set('roadLayoutType', t)} style={css('cursor:pointer')}>
              <b>{t}</b>
            </button>
          ))}
        </div>
        {isTJunction && (
          <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 18px;margin-top:14px')}>
            <Input field={field('tJunctionSide', 'T-junction side', { type: 'select', options: ROAD_SIDES })} value={boundaries.tJunctionSide || ''} onChange={v => set('tJunctionSide', v as RoadSideOption)} />
            <Input field={field('approachRoadWidth', 'Approach road width')} value={boundaries.approachRoadWidth || ''} onChange={v => set('approachRoadWidth', v)} />
          </div>
        )}
        {isDeadEnd && (
          <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 18px;margin-top:14px')}>
            <Input field={field('deadEndType', 'Type', { type: 'select', options: ['dead-end', 'cul-de-sac'] })} value={boundaries.deadEndType || ''} onChange={v => set('deadEndType', v as any)} />
            <Input field={field('deadEndSide', 'Side', { type: 'select', options: ['left', 'right', 'both'] })} value={boundaries.deadEndSide || ''} onChange={v => set('deadEndSide', v as any)} />
          </div>
        )}
      </div>

      <div style={css('margin-top:20px;padding-top:16px;border-top:1px solid ' + C.rule)}>
        <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:14px')}>
          <Input field={field('northSymbolStyle', 'North symbol', { type: 'select', options: ['cadastral', 'compass', 'architectural', 'minimal'] })}
            value={boundaries.northSymbolStyle || 'cadastral'} onChange={v => set('northSymbolStyle', v as BoundaryDimensions['northSymbolStyle'])} />
          <Input field={field('boundaryFontWeight', 'Boundary text weight', { type: 'select', options: ['normal', 'bold'] })}
            value={boundaries.boundaryFontWeight || 'normal'} onChange={v => set('boundaryFontWeight', v as BoundaryDimensions['boundaryFontWeight'])} />
        </div>
        <label style={css('display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:12px;color:' + C.body)}>
          <input type="checkbox" checked={!!boundaries.autoAlignBoundariesWithMap} onChange={e => set('autoAlignBoundariesWithMap', e.target.checked)} />
          Auto-align boundary labels with map rotation
        </label>
        {([['mapRotation', 'Map rotation', 359], ['sketchScale', 'Map scale (%)', 150], ['textScale', 'Text scale (%)', 150]] as const).map(([key, label, max]) =>
          <label key={key} style={css('display:flex;flex-direction:column;gap:6px;max-width:320px;margin-bottom:12px')}>
            <span style={css(`font-size:10px;font-weight:700;color:${C.mutedSoft}`)}>{label}: {boundaries[key] ?? (key === 'mapRotation' ? 0 : 100)}{key === 'mapRotation' ? '°' : '%'}</span>
            <input type="range" min={key === 'mapRotation' ? 0 : 50} max={max} value={boundaries[key] ?? (key === 'mapRotation' ? 0 : 100)} onChange={e => set(key, Number(e.target.value))} />
          </label>)}
        <label style={css('display:flex;flex-direction:column;gap:6px;max-width:320px')}>
          <span style={css(`font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.mutedSoft}`)}>
            North direction rotation ({boundaries.northRotation || 0}°)
          </span>
          <input type="range" min={0} max={359} value={boundaries.northRotation || 0} onChange={e => set('northRotation', Number(e.target.value))} />
        </label>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- parties

function PartyFields({ label, telugu, party, onChange }: { label: string; telugu: string; party: PartyDetails; onChange: (p: PartyDetails) => void }) {
  const set = <K extends keyof PartyDetails>(key: K, value: PartyDetails[K]) => onChange({ ...party, [key]: value });
  return (
    <Section title={label} telugu={telugu}>
      <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px')}>
        <Input field={field('name', 'Full name', { span: 2 })} value={party.name} onChange={v => set('name', v)} />
        <Input field={field('relation', 'Relation', { type: 'select', options: ['S/o', 'W/o', 'D/o', 'C/o', 'Rep. by'] })} value={party.relation} onChange={v => set('relation', v)} />
        <Input field={field('relativeName', 'Relative name')} value={party.relativeName} onChange={v => set('relativeName', v)} />
        <Input field={field('age', 'Age', { type: 'number' })} value={party.age} onChange={v => set('age', v)} />
        <Input field={field('occupation', 'Occupation')} value={party.occupation} onChange={v => set('occupation', v)} />
        <Input field={field('address', 'Address', { type: 'textarea', span: 2 })} value={party.address} onChange={v => set('address', v)} />
      </div>
    </Section>
  );
}

export function PartiesSection({
  executants, claimants, witnesses, onExecutants, onClaimants, onWitnesses,
}: {
  executants: PartyDetails[]; claimants: PartyDetails[]; witnesses: Witnesses;
  onExecutants: (p: PartyDetails[]) => void; onClaimants: (p: PartyDetails[]) => void; onWitnesses: (w: Witnesses) => void;
}) {
  const blank = (): PartyDetails => ({ name: '', relation: 'S/o', relativeName: '', age: '', occupation: '', address: '' });
  return (
    <>
      {executants.map((party, index) => <div key={`executant-${index}`}>
        <PartyFields label={`Executant ${index + 1}`} telugu="అమ్మకందారు" party={party}
          onChange={next => onExecutants(executants.map((item, i) => i === index ? next : item))} />
        {executants.length > 1 && <button type="button" className="quiet" onClick={() => onExecutants(executants.filter((_, i) => i !== index))}>Remove executant {index + 1}</button>}
      </div>)}
      <button type="button" className="quiet" onClick={() => onExecutants([...executants, blank()])}>+ Add another executant</button>
      {claimants.map((party, index) => <div key={`claimant-${index}`}>
        <PartyFields label={`Claimant ${index + 1}`} telugu="కొనుగోలుదారు" party={party}
          onChange={next => onClaimants(claimants.map((item, i) => i === index ? next : item))} />
        {claimants.length > 1 && <button type="button" className="quiet" onClick={() => onClaimants(claimants.filter((_, i) => i !== index))}>Remove claimant {index + 1}</button>}
      </div>)}
      <button type="button" className="quiet" onClick={() => onClaimants([...claimants, blank()])}>+ Add another claimant</button>
      <Section title="Witnesses" telugu="సాక్షులు">
        <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 18px')}>
          <Input field={field('witness1', 'Witness 1')} value={witnesses.witness1} onChange={v => onWitnesses({ ...witnesses, witness1: v })} />
          <Input field={field('witness2', 'Witness 2')} value={witnesses.witness2} onChange={v => onWitnesses({ ...witnesses, witness2: v })} />
        </div>
      </Section>
    </>
  );
}
