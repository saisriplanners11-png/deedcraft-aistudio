import React from 'react';
import { partyRecords, type AppState } from './logic';
import { emptySaleAuthority, saleDocumentLabel, type SaleAuthority } from './sale-options';

const fields = [
  ['Name', 'Full name'], ['Relation', 'Relation'], ['RelativeName', "Father’s / relative’s name"],
  ['Dob', 'Date of birth'], ['Age', 'Age'], ['Occupation', 'Occupation'],
  ['HNo', 'House no.'], ['Locality', 'Locality'], ['Village', 'Village'], ['Mandal', 'Mandal'],
  ['District', 'District'], ['State', 'State'], ['PinCode', 'PIN code'], ['Aadhaar', 'Aadhaar number'],
  ['Mobile', 'Mobile (optional)'], ['Pan', 'PAN (optional)'],
];
export function SaleAuthorityEditor({ state, onChange }: { state: AppState; onChange: (value: SaleAuthority) => void }) {
  if (!state.saleDocument || state.saleDocument === 'ordinary') return null;
  const authority = state.saleAuthority || emptySaleAuthority();
  const principals = partyRecords(state, 'executant').map((record, index) => ({ ...record, id: index ? record.id : state.primaryExecutantId || 'primary' }));
  return <section className="panel" aria-label="Sale authority details">
    <h2>{saleDocumentLabel(state.saleDocument)} — authority details</h2>
    <p>Enter the principals in Executants. Link each attorney below to the principals they represent.</p>
    <div className="sale-authority-grid">{([
      ['documentNo', 'Authority document number'], ['bookNumber', 'Authority book number'], ['documentDate', 'Authority document date'],
      ['sro', 'Authority Sub-Registrar Office'], ['sroCode', 'Authority SRO code'],
      ...(state.saleDocument === 'agpa' ? [['adjustedAmount', 'AGPA adjusted stamp-duty amount (₹)']] : []),
    ] as [keyof SaleAuthority, string][]).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input type={key === 'documentDate' ? 'date' : key === 'adjustedAmount' ? 'number' : 'text'} min={key === 'adjustedAmount' ? 0 : undefined} value={(authority[key] as string) || ''} onChange={event => onChange({ ...authority, [key]: event.target.value })} /></label>)}</div>
    {authority.attorneys.map((attorney, index) => <fieldset key={attorney.id}><legend>Attorney {index + 1}</legend>
      <div className="sale-authority-grid">{fields.map(([key, label]) => <label className="field" key={key}><span>{label}</span>{key === 'Relation' ? <select value={attorney.values[key] || ''} onChange={event => update(attorney.id, key, event.target.value)}><option value="">Choose relation</option>{['S/O', 'W/O', 'D/O', 'C/O', 'REP. BY'].map(option => <option key={option}>{option}</option>)}</select> : <input type={key === 'Dob' ? 'date' : key === 'Age' ? 'number' : 'text'} value={attorney.values[key] || ''} onChange={event => update(attorney.id, key, event.target.value)} />}</label>)}</div>
      <p>Represents these principals:</p>
      {principals.map((principal, principalIndex) => <label key={principal.id} style={{ display: 'block', marginBottom: 8 }}><input type="checkbox" checked={attorney.principalIds.includes(principal.id)} onChange={event => onChange({ ...authority, attorneys: authority.attorneys.map(item => item.id !== attorney.id ? item : { ...item, principalIds: event.target.checked ? [...item.principalIds, principal.id] : item.principalIds.filter(id => id !== principal.id) }) })} /> {principal.values.executantName || `Principal ${principalIndex + 1}`}</label>)}
      <button type="button" onClick={() => onChange({ ...authority, attorneys: authority.attorneys.filter(item => item.id !== attorney.id) })}>Remove attorney {index + 1}</button>
    </fieldset>)}
    <button type="button" onClick={() => onChange({ ...authority, attorneys: [...authority.attorneys, { id: crypto.randomUUID(), principalIds: [], values: {} }] })}>Add attorney</button>
    <style>{`.sale-authority-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;margin:18px 0}.sale-authority-grid input,.sale-authority-grid select{width:100%;min-height:40px}.panel[aria-label="Sale authority details"] fieldset{padding:18px;margin:18px 0;border:1px solid #aaa;border-radius:8px}`}</style>
  </section>;
  function update(id: string, key: string, value: string) {
    onChange({ ...authority, attorneys: authority.attorneys.map(item => item.id === id ? { ...item, values: { ...item.values, [key]: value } } : item) });
  }
}
