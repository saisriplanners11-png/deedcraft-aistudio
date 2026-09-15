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
const PROPERTY_TYPES: PropertyType[] = ['Plot', 'House', 'Flat', 'Commercial Building', 'Agricultural Land', 'Open Place', 'Other'];

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

export function PropertyDetailsSection({ property, onChange }: { property: PropertyDetails; onChange: (p: PropertyDetails) => void }) {
  const set = <K extends keyof PropertyDetails>(key: K, value: PropertyDetails[K]) => onChange({ ...property, [key]: value });
  const houseEnabled = property.propertyType === 'House' || !!property.house?.enabled;
  const house = property.house || {};
  const setHouse = (patch: Partial<HouseDetails>) => onChange({ ...property, house: { ...house, ...patch } });

  /** Plinth area follows house width × length until the figures disagree with what's typed, keeping the field in sync automatically. */
  const setHouseDim = (patch: { widthRaw?: string; lengthRaw?: string }) => {
    const widthRaw = patch.widthRaw ?? house.widthRaw;
    const lengthRaw = patch.lengthRaw ?? house.lengthRaw;
    const w = parseDimension(widthRaw || '', 'Feet').normalized;
    const l = parseDimension(lengthRaw || '', 'Feet').normalized;
    const plinth = w > 0 && l > 0
      ? { plinthAreaSqFt: Math.round(w * l), plinthAreaSqYds: Math.round((w * l / 9) * 100) / 100 }
      : {};
    setHouse({ ...patch, ...plinth });
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
        <Input field={field('nearHNo', 'Near / adjacent H.No.')} value={property.nearHNo} onChange={v => set('nearHNo', v)} />
        <Input field={field('locality', 'Locality')} value={property.locality} onChange={v => set('locality', v)} />
        <Input field={field('village', 'Village')} value={property.village} onChange={v => set('village', v)} />
        <Input field={field('mandal', 'Mandal')} value={property.mandal} onChange={v => set('mandal', v)} />
        <Input field={field('district', 'District')} value={property.district} onChange={v => set('district', v)} />
      </div>

      <label style={css('display:flex;align-items:center;gap:8px;margin-top:18px;font-size:12px;color:' + C.body)}>
        <input type="checkbox" checked={houseEnabled} onChange={e => setHouse({ enabled: e.target.checked })} />
        This property includes a house / built structure
      </label>
      {houseEnabled && (
        <div style={css(`margin-top:14px;border:1px solid ${C.goldLight};background:${C.goldBg};padding:16px 18px`)}>
          <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px')}>
            <div>
              <div style={css(`font-family:${C.serif};font-size:14px;font-weight:600;color:${C.ink}`)}>House Measurements &amp; Sketch Drawing</div>
              <div style={css(`font-family:${C.telugu};font-size:11px;color:${C.mutedSoft};margin-top:2px`)}>ఇంటి కొలతలు &amp; స్కెచ్ డ్రాయింగ్</div>
            </div>
            <label style={css(`display:flex;align-items:center;gap:7px;font-size:11.5px;color:${C.body};white-space:nowrap;cursor:pointer`)}>
              <input type="checkbox" checked={house.showMeasurements !== false} onChange={e => setHouse({ showMeasurements: e.target.checked })} />
              Show House in Sketch
            </label>
          </div>

          <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px')}>
            <Input field={field('houseWidthRaw', 'House width (e.g. 24\'-0")')} value={house.widthRaw || ''}
              onChange={v => setHouseDim({ widthRaw: v })} />
            <Input field={field('houseLengthRaw', 'House length (e.g. 36\'-0")')} value={house.lengthRaw || ''}
              onChange={v => setHouseDim({ lengthRaw: v })} />
            <Input field={field('structureType', 'Structure / roof type', { hint: 'e.g. R.C.C. Roof' })} value={house.structureType || ''} onChange={v => setHouse({ structureType: v })} />
            <Input field={field('plinthAreaSqFt', 'Plinth area (Sq. Ft.)', { type: 'number', hint: 'Auto-calculated (W × L)', derived: true })}
              value={String(house.plinthAreaSqFt ?? '')} derivedValue={String(house.plinthAreaSqFt ?? '')} onChange={() => {}} />
          </div>

          <div style={css(`display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:20px;padding-top:14px;border-top:1px solid ${C.rule}`)}>
            <span style={css(`font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.mutedSoft}`)}>
              Setbacks &amp; open spaces (సెట్‌బ్యాక్‌లు)
            </span>
            <label style={css(`display:flex;align-items:center;gap:7px;font-size:11.5px;color:${C.body};cursor:pointer`)}>
              <input type="checkbox" checked={house.showSetbacks !== false} onChange={e => setHouse({ showSetbacks: e.target.checked })} />
              Show Setback Lines
            </label>
          </div>
          <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px;margin-top:12px')}>
            <Input field={field('setbackSouth', 'South (front) open', { hint: `e.g. 12'-0"` })} value={house.setbackSouth || ''} onChange={v => setHouse({ setbackSouth: v })} />
            <Input field={field('setbackNorth', 'North (rear) open', { hint: `e.g. 8'-0"` })} value={house.setbackNorth || ''} onChange={v => setHouse({ setbackNorth: v })} />
            <Input field={field('setbackWest', 'West (left) open', { hint: `e.g. 8'-0"` })} value={house.setbackWest || ''} onChange={v => setHouse({ setbackWest: v })} />
            <Input field={field('setbackEast', 'East (right) open', { hint: `e.g. 8'-0"` })} value={house.setbackEast || ''} onChange={v => setHouse({ setbackEast: v })} />
          </div>
        </div>
      )}
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
  executant, claimant, witnesses, onExecutant, onClaimant, onWitnesses,
}: {
  executant: PartyDetails; claimant: PartyDetails; witnesses: Witnesses;
  onExecutant: (p: PartyDetails) => void; onClaimant: (p: PartyDetails) => void; onWitnesses: (w: Witnesses) => void;
}) {
  return (
    <>
      <PartyFields label="Executant" telugu="అమ్మకందారు" party={executant} onChange={onExecutant} />
      <PartyFields label="Claimant" telugu="కొనుగోలుదారు" party={claimant} onChange={onClaimant} />
      <Section title="Witnesses" telugu="సాక్షులు">
        <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 18px')}>
          <Input field={field('witness1', 'Witness 1')} value={witnesses.witness1} onChange={v => onWitnesses({ ...witnesses, witness1: v })} />
          <Input field={field('witness2', 'Witness 2')} value={witnesses.witness2} onChange={v => onWitnesses({ ...witnesses, witness2: v })} />
        </div>
      </Section>
    </>
  );
}
