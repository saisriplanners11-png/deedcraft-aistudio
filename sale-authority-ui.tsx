import React, { useId, useRef, useState } from 'react';
import { FileDropZone } from './file-drop-zone';
import { partyRecords, type AppState } from './logic';
import { emptySaleAuthority, saleDocumentLabel, type SaleAuthority, type AuthorityDocument } from './sale-options';

function AuthorityUploads({ label, documents = [], onChange }: { label: string; documents?: AuthorityDocument[]; onChange: (documents: AuthorityDocument[]) => void }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef({ documents, onChange });
  latest.current = { documents, onChange };
  async function upload(files: File[]) {
    if (!files.length) return;
    setError('');
    if (files.some(file => !/\.(pdf|docx|txt|md|jpe?g|png|webp|gif)$/i.test(file.name) || file.size > 20 * 1024 * 1024)) {
      setError('Choose PDF, Word (.docx), text or image files, up to 20 MB each.');
      return;
    }
    setBusy(true);
    try {
      const added = await Promise.all(files.map(file => new Promise<AuthorityDocument>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, size: file.size, dataUrl: String(reader.result) });
        reader.onerror = () => reject(new Error('The file could not be read. Please try again.'));
        reader.onabort = () => reject(new Error('The file read was interrupted. Please try again.'));
        reader.readAsDataURL(file);
      })));
      latest.current.onChange([...latest.current.documents, ...added]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <FileDropZone className="authority-uploads" disabled={busy}>
    <label className="field" htmlFor={id}><span>{label}</span></label>
    <p id={`${id}-hint`}>Attach supporting documents (up to 20 MB each). Enter the details below manually.</p>
    <input id={id} type="file" multiple accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,.gif" disabled={busy} aria-describedby={`${id}-hint`} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void upload(files); }} />
    {busy && <p role="status">Attaching documents…</p>}
    {error && <p role="alert">{error}</p>}
    {documents.length > 0 && <ul>{documents.map(document => <li key={document.id}><a href={document.dataUrl} download={document.name}>{document.name}</a> <small>({Math.ceil(document.size / 1024)} KB)</small> <button type="button" disabled={busy} aria-label={`Remove ${document.name}`} onClick={() => onChange(documents.filter(item => item.id !== document.id))}>Remove</button></li>)}</ul>}
  </FileDropZone>;
}

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
    <AuthorityUploads label={`Upload ${state.saleDocument.toUpperCase()} documents`} documents={authority.documents} onChange={documents => onChange({ ...authority, documents })} />
    <div className="sale-authority-grid">{([
      ['documentNo', 'Authority document number'], ['bookNumber', 'Authority book number'], ['documentDate', 'Authority document date'],
      ['sro', 'Authority Sub-Registrar Office'], ['sroCode', 'Authority SRO code'],
      ...(state.saleDocument === 'agpa' ? [['adjustedAmount', 'AGPA adjusted stamp-duty amount (₹)']] : []),
    ] as [keyof SaleAuthority, string][]).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input type={key === 'documentDate' ? 'date' : key === 'adjustedAmount' ? 'number' : 'text'} min={key === 'adjustedAmount' ? 0 : undefined} value={(authority[key] as string) || ''} onChange={event => onChange({ ...authority, [key]: event.target.value })} /></label>)}</div>
    {authority.attorneys.map((attorney, index) => <fieldset key={attorney.id}><legend>Attorney {index + 1}</legend>
      <AuthorityUploads label={`Upload Attorney ${index + 1} identity / supporting documents`} documents={attorney.documents} onChange={documents => onChange({ ...authority, attorneys: authority.attorneys.map(item => item.id === attorney.id ? { ...item, documents } : item) })} />
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
