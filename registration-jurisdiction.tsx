import React, { useEffect, useId, useState } from 'react';
import { GROUPS, type Field } from './fields';
import { fieldKey } from './source-draft';
import { Input } from './ui';
import { changeLocation, matchingOption, LOCATION_FIELDS, type LocationField, type LookupOption, type JurisdictionLookupState } from './registration-location-state';
import type { JurisdictionPresentationProps } from './workspace-presentation';

type LookupResult = { options: LookupOption[]; ulbs?: LookupOption[]; localBodies?: LookupOption[] };
const EMPTY: LookupOption[] = [];
function useLookup(query: Record<string, string> | null) {
  const key = query ? new URLSearchParams(query).toString() : '';
  const [revision, retry] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: LookupResult; error?: string }>({ key: '' });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    setResult({ key });
    void (async () => {
      try {
        const response = await fetch(`/api/registration/lookups?${key}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.options)) throw new Error(data.error || 'Location lookup failed.');
        if (!controller.signal.aborted) setResult({ key, data });
      } catch (error: any) {
        if (!controller.signal.aborted) setResult({ key, error: error.message || 'Location lookup failed.' });
      }
    })();
    return () => controller.abort();
  }, [key, revision]);
  const current = result.key === key ? result : { key };
  return { data: key ? current.data : undefined, loading: !!key && !current.data && !current.error, error: key ? current.error : undefined, retry: () => retry(value => value + 1) };
}
type Control = ReturnType<typeof useLookup> & { options: LookupOption[]; parent: string; enabled: boolean };
function LocationControl({ field, value, state, control, onSelect, onManual, onUseList, onConfirm }: {
  field: Field; value: string; state: JurisdictionLookupState; control: Control;
  onSelect: (option?: LookupOption) => void; onManual: (value: string) => void; onUseList: () => void; onConfirm: () => void;
}) {
  const id = useId(); const manual = state.manual?.includes(field.id as LocationField);
  const selected = matchingOption(control.options, value, field.id as LocationField, state);
  const review = value && state.needsReview?.includes(field.id as LocationField);
  const hasHelp = !!control.error || !!(!manual && value && !selected) || !!review;
  return <div className="deed-field registration-location-control">
    <div className="registration-location-label"><label htmlFor={id}>{field.label}</label><button type="button" aria-label={`${manual ? 'Use registration list for' : 'Enter manually for'} ${field.label}`} onClick={() => manual ? onUseList() : onManual(value)}>{manual ? 'Use list' : 'Enter manually'}</button></div>
    {manual ? <input id={id} value={value} aria-describedby={hasHelp ? `${id}-help` : undefined} onChange={event => onManual(event.target.value)} /> : <select id={id} value={selected?.code || ''} aria-busy={control.loading} aria-describedby={hasHelp ? `${id}-help` : undefined} disabled={!control.enabled || control.loading} onChange={event => onSelect(control.options.find(option => option.code === event.target.value))}>
      <option value="">{value && !selected ? `Saved / extracted: ${value}` : control.loading ? 'Loading records…' : control.enabled ? 'Select' : `Select ${control.parent} first`}</option>{control.options.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
    </select>}
    {hasHelp && <div id={`${id}-help`} className="registration-location-help">{control.error && <span role="alert">{control.error} <button type="button" aria-label={`Retry ${field.label} lookup`} onClick={control.retry}>Retry</button></span>}{!manual && value && !selected && <span>{review ? 'Parent location changed. Confirm this retained value or choose a new option.' : 'Retained from your deed. Choose a matching record or keep it as a manual entry.'}</span>}
      {review && <button type="button" aria-label={`Keep retained ${field.label}`} onClick={onConfirm}>Keep retained value</button>}
    </div>}
  </div>;
}
const extras: Field[] = [
  { id: 'locality', label: 'Locality' }, { id: 'registrationPropertyLocation', label: 'Location of the property' },
  { id: 'registrationUlbName', label: 'ULB Name' }, { id: 'registrationWard', label: 'Ward', derived: true }, { id: 'registrationBlock', label: 'Block', derived: true },
];
const fields = [...GROUPS.find(group => group.step === 2)!.fields.map(field => ({ ...field, span: 1 as const })), ...extras];
const order = ['district', 'mandal', 'village', 'locality', 'registrationPropertyLocation', 'registrationUlbName', 'registrationWard', 'registrationBlock', 'sro', 'propState', 'districtRegistrar', 'executionDate'];
export const registrationJurisdictionGroups = [{ ...GROUPS.find(group => group.step === 2)!, note: '', fields: [...order.map(id => fields.find(field => field.id === id)!), ...fields.filter(field => !order.includes(field.id))], cols: 4 as const }];

export function RegistrationJurisdiction({ propertyId, values, lookup, onLookupChange, onEdit, renderFields }: JurisdictionPresentationProps) {
  const get = (field: string) => values[fieldKey('property', propertyId, field)] || '';
  const telangana = !get('propState') || get('propState') === 'Telangana';
  const districts = useLookup(telangana ? { kind: 'districts' } : null);
  const district = matchingOption(districts.data?.options || EMPTY, get('district'), 'district', lookup)?.code || '';
  const mandals = useLookup(district ? { kind: 'mandals', district } : null);
  const mandal = matchingOption(mandals.data?.options || EMPTY, get('mandal'), 'mandal', lookup)?.code || '';
  const villages = useLookup(district && mandal ? { kind: 'villages', district, mandal } : null);
  const village = matchingOption(villages.data?.options || EMPTY, get('village'), 'village', lookup)?.code || '';
  const localities = useLookup(district && village ? { kind: 'localities', district, village } : null);
  const locality = matchingOption(localities.data?.options || EMPTY, get('locality'), 'locality', lookup);
  const offices = useLookup(locality?.sroCode ? { kind: 'jurisdiction', sro: locality.sroCode } : null);
  if (!telangana) return <>{renderFields()}</>;
  const controls: Record<LocationField, Control> = {
    district: { ...districts, options: districts.data?.options || EMPTY, parent: '', enabled: true },
    mandal: { ...mandals, options: mandals.data?.options || EMPTY, parent: 'District', enabled: !!district },
    village: { ...villages, options: villages.data?.options || EMPTY, parent: 'Mandal', enabled: !!mandal },
    locality: { ...localities, options: localities.data?.options || EMPTY, parent: 'Village', enabled: !!village },
    registrationPropertyLocation: { ...localities, options: localities.data?.localBodies || EMPTY, parent: 'Village', enabled: !!village },
    registrationUlbName: { ...localities, options: localities.data?.ulbs || EMPTY, parent: 'Village', enabled: !!village },
    sro: { ...offices, options: offices.data?.options || EMPTY, parent: 'Locality', enabled: !!locality },
  };
  function confirm(field: LocationField) {
    onLookupChange({ ...lookup, needsReview: lookup.needsReview?.filter(id => id !== field), manual: [...new Set([...(lookup.manual || []), field])] });
  }
  return <>{renderFields({ groups: registrationJurisdictionGroups, renderField: (field, value) => {
    if (field.id === 'registrationWard' || field.id === 'registrationBlock') return <Input field={field} value={(field.id === 'registrationWard' ? locality?.ward : locality?.block) || ''} onChange={() => {}} />;
    if (!LOCATION_FIELDS.includes(field.id as LocationField)) return undefined;
    const id = field.id as LocationField;
    return <LocationControl field={field} value={value} state={lookup} control={controls[id]} onSelect={option => {
      onLookupChange(changeLocation(lookup, id, option));
      // Only a user selection changes canonical facts. Descendant facts remain for review.
      onEdit(id, option ? option.value || option.label : '');
      if (['district', 'mandal', 'village', 'locality'].includes(id)) { onEdit('registrationWard', ''); onEdit('registrationBlock', ''); }
      if (id === 'locality' && option) { onEdit('registrationWard', option.ward || ''); onEdit('registrationBlock', option.block || ''); }
    }} onManual={text => { onLookupChange(changeLocation(lookup, id, undefined, true)); onEdit(id, text); if (['district', 'mandal', 'village', 'locality'].includes(id)) { onEdit('registrationWard', ''); onEdit('registrationBlock', ''); } }} onUseList={() => onLookupChange({ ...lookup, manual: lookup.manual?.filter(item => item !== id) })} onConfirm={() => confirm(id)} />;
  } })}<p className="registration-lookup-note">Confirm the extracted location using registration records. Saved values remain available for manual entry.</p></>;
}
