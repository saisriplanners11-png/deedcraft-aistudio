import { extractAuthorityDocuments } from './authority-extraction';
import React, { useEffect, useId, useRef, useState } from 'react';
import { ExtractDialog, type ProgressStep } from './ui';
import { FileDropZone } from './file-drop-zone';
import { partyRecords, vendeeShareCents, type AppState } from './logic';
import { emptySaleAuthority, saleDocumentLabel, type SaleAuthority, type AuthorityDocument, type AuthorityPerson, type AuthorityExtraction } from './sale-options';

function AuthorityUploads({ label, documents = [], onChange, onExtract }: { label: string; documents?: AuthorityDocument[]; onChange: (documents: AuthorityDocument[]) => void; onExtract: (files: File[], ids: string[]) => Promise<void> }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [error, setError] = useState('');
  const latest = useRef({ documents, onChange, onExtract });
  latest.current = { documents, onChange, onExtract };
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
      if (!mounted.current) return;
      latest.current.onChange([...latest.current.documents, ...added]);
      await latest.current.onExtract(files, added.map(document => document.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <FileDropZone className="authority-uploads" disabled={busy}>
    <label className="field" htmlFor={id}><span>{label}</span></label>
    <p id={`${id}-hint`}>Upload documents (up to 20 MB each) to extract details. GPA/AGPA authority uploads replace executants automatically. For other uploads, select each person’s role below; existing entered values are retained.</p>
    <input id={id} type="file" multiple accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,.gif" disabled={busy} aria-describedby={`${id}-hint`} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void upload(files); }} />
    {busy && <p role="status">Attaching and extracting documents…</p>}
    {error && <p role="alert">{error}</p>}
    {documents.length > 0 && <ul>{documents.map(document => <li key={document.id}><a href={document.dataUrl} download={document.name}>{document.name}</a> <small>({Math.ceil(document.size / 1024)} KB)</small> <button type="button" disabled={busy} aria-label={`Remove ${document.name}`} onClick={() => onChange(documents.filter(item => item.id !== document.id))}>Remove</button></li>)}</ul>}
  </FileDropZone>;
}

const fields = [
  ['Name', 'Full name'], ['Relation', 'Relation'], ['RelativeName', "Father’s / relative’s name"],
  ['Dob', 'Date of birth'], ['Age', 'Age'], ['Occupation', 'Occupation'],
  ['HNo', 'House no.'], ['Locality', 'Locality'], ['Village', 'Village'], ['Mandal', 'Mandal'],
  ['District', 'District'], ['State', 'State'], ['PinCode', 'PIN code'], ['SharePercentage', 'Share percentage (%) — optional'], ['Aadhaar', 'Aadhaar number'],
  ['Mobile', 'Mobile (optional)'], ['Pan', 'PAN (optional)'],
];
export function SaleAuthorityEditor({ state, onChange, onApplyPerson, onApplyGpa, children }: { children?: React.ReactNode; state: AppState; onChange: (value: SaleAuthority) => void; onApplyGpa: (authority: SaleAuthority, result: AuthorityExtraction) => string; onApplyPerson: (person: AuthorityPerson, role: 'principal' | 'attorney', targetId: string) => string }) {
  const authority = state.saleAuthority || emptySaleAuthority();
  const latest = useRef({ authority, onChange, onApplyGpa }); latest.current = { authority, onChange, onApplyGpa };
  const controllers = useRef(new Set<AbortController>());
  const mounted = useRef(true);
  const [progress, setProgress] = useState('');
  const [extractionError, setExtractionError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [dialog, setDialog] = useState<{ names: string[]; label: string; result: string } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controllers.current.forEach(controller => controller.abort()); controllers.current.clear(); }; }, [state.saleDocument]);
  if (!state.saleDocument || state.saleDocument === 'ordinary') return <>{children}</>;
  async function extract(files: File[], ids: string[], authorityUpload = false) {
    if (!mounted.current) return;
    setDialog({ names: files.map(file => file.name), label: authorityUpload ? `${state.saleDocument?.toUpperCase()} authority document` : 'Attorney identity / supporting document', result: '' });
    const controller = new AbortController(); controllers.current.add(controller); setExtractionError(''); setExtracting(true); setProgress('Preparing authority documents…');
    try {
      const result = await extractAuthorityDocuments(files, ids, controller.signal, setProgress);
      const current = latest.current.authority;
      const retained = new Set([...(current.documents || []), ...current.attorneys.flatMap(attorney => attorney.documents || [])].map(document => document.id));
      if (controller.signal.aborted || ids.some(id => !retained.has(id))) return;
      const updated = { ...current, extractions: [...(current.extractions || []).filter(item => !item.documentIds.some(id => ids.includes(id))), result] };
      for (const [key, value] of Object.entries(result.details)) if (!String((updated as any)[key] || '').trim()) (updated as any)[key] = value;
      if (authorityUpload && (state.saleDocument === 'gpa' || state.saleDocument === 'agpa')) {
        const error = latest.current.onApplyGpa(updated, result);
        if (error) { latest.current.onChange({ ...current, extractions: updated.extractions }); setExtractionError(error); return; }
        setDialog(current => current && { ...current, result: 'Authority details, Principal executants and attorney records filled. Review the completed fields and representation links.' });
        setProgress('GPA/AGPA authority details and Principal executants filled. Attorney details and evidenced representation links filled automatically. Review the extracted source quotes and completed records.');
        return;
      }
      latest.current.onChange(updated);
      setDialog(current => current && { ...current, result: `Found ${result.people.length} people. Open the source review to select the role for these supporting details.` });
      setProgress(`Found ${result.people.length} people. Review the source quotes and select Principal or GPA holder to fill the correct record.`);
    } catch (error) {
      if (!controller.signal.aborted) { const message = error instanceof Error ? error.message : 'Authority extraction failed.'; setExtractionError(message); throw error; }
    } finally { controllers.current.delete(controller); if (mounted.current) setExtracting(controllers.current.size > 0); }
  }
  async function retry(documents: AuthorityDocument[], authorityUpload = false) {
    try {
      const files = await Promise.all(documents.map(async document => { const blob = await (await fetch(document.dataUrl)).blob(); return new File([blob], document.name, { type: blob.type }); }));
      await extract(files, documents.map(document => document.id), authorityUpload);
    } catch (error) {
      setExtractionError(error instanceof Error ? error.message : 'Could not read the attached documents. Please upload them again.');
    }
  }
  const principals = partyRecords(state, 'executant').map((record, index) => ({ ...record, id: index ? record.id : state.primaryExecutantId || 'primary' }));
  const finished = !!extractionError || !!dialog?.result;
  const preparing = progress.startsWith('Preparing');
  const dialogSteps: ProgressStep[] = [
    { title: 'Preparing documents', state: finished || !preparing ? 'done' : 'running' },
    { title: 'Reading and verifying pages', state: dialog?.result ? 'done' : preparing ? 'pending' : 'running' },
    { title: 'Filling authority and party details', state: dialog?.result ? 'done' : 'pending' },
  ];
  return <><ExtractDialog open={!!dialog} label={dialog?.label || 'Authority document'} fileNames={dialog?.names || []} steps={dialogSteps} error={extractionError} result={dialog?.result || ''} onClose={() => setDialog(null)} onCancel={() => {
    controllers.current.forEach(controller => controller.abort());
    setExtractionError('Reading was cancelled. Attached documents are retained; retry extraction when ready.');
    setProgress('');
  }} /><section className="panel" aria-label="Sale authority details">
    <h2>{saleDocumentLabel(state.saleDocument)} — authority details</h2>
    <p>GPA and AGPA uploads automatically replace Executants with the verified principals and select Principal as Party type. Missing authority details stay blank. The authority fields are followed by Principal executants and attorney details with their representation links. Review any missing details below.</p>
    <AuthorityUploads label={`Upload ${state.saleDocument.toUpperCase()} documents`} documents={authority.documents} onExtract={(files, ids) => extract(files, ids, true)} onChange={documents => updateDocuments({ ...authority, documents })} />
    {!!authority.documents?.length && <button type="button" disabled={extracting} onClick={() => void retry(authority.documents || [], true)}>Extract details from attached authority documents</button>}
    {!!authority.documents?.length && !extracting && !extractionError && authority.documents.some(document => !(authority.extractions || []).some(read => read.documentIds.includes(document.id))) && <p role="alert">The authority document is attached, but extraction has not completed. Click “Extract details from attached authority documents”. If extraction fails, the error will appear here; uploading alone does not confirm that details were filled.</p>}
    {extracting && <p role="status">Extracting authority details…</p>}
    {progress && !extractionError && <p role="status" aria-live="polite">{progress}</p>}
    {extractionError && <p role="alert">Extraction could not finish: {extractionError} Your attached documents are retained; retry extraction.</p>}
    <div className="sale-authority-grid">{([
      ['documentNo', 'Authority document number'], ['bookNumber', 'Authority book number'], ['documentDate', 'Authority document date'],
      ['sro', 'Authority Sub-Registrar Office'], ['sroCode', 'Authority SRO code'],
      ...(state.saleDocument === 'agpa' ? [['adjustedAmount', 'AGPA adjusted stamp-duty amount (₹)']] : []),
    ] as [keyof SaleAuthority, string][]).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input type={key === 'documentDate' ? 'date' : key === 'adjustedAmount' ? 'number' : 'text'} min={key === 'adjustedAmount' ? 0 : undefined} value={(authority[key] as string) || ''} onChange={event => onChange({ ...authority, [key]: event.target.value })} /></label>)}</div>
  </section>
  {children}
  <section className="panel" aria-label="Sale attorney details">
    <h2>Attorneys — {state.saleDocument.toUpperCase()} holders</h2>
    {authority.attorneys.map((attorney, index) => <fieldset key={attorney.id} aria-label={`Attorney ${index + 1}`}><legend>Attorney {index + 1} — {state.saleDocument.toUpperCase()} holder</legend>
      <AuthorityUploads label={`Upload Attorney ${index + 1} identity / supporting documents`} documents={attorney.documents} onExtract={extract} onChange={documents => updateDocuments({ ...authority, attorneys: authority.attorneys.map(item => item.id === attorney.id ? { ...item, documents } : item) })} />
      {!!attorney.documents?.length && <button type="button" disabled={controllers.current.size > 0} onClick={() => void retry(attorney.documents || [])}>Extract details for Attorney {index + 1}</button>}
      <div className="sale-authority-grid">{fields.map(([key, label]) => <label className="field" key={key}><span>{label}</span>{key === 'Relation' ? <select value={attorney.values[key] || ''} onChange={event => update(attorney.id, key, event.target.value)}><option value="">Choose relation</option>{['S/O', 'W/O', 'D/O', 'C/O', 'REP. BY'].map(option => <option key={option}>{option}</option>)}</select> : <input type={key === 'Dob' ? 'date' : key === 'Age' ? 'number' : 'text'} inputMode={key === 'SharePercentage' ? 'decimal' : undefined} aria-invalid={key === 'SharePercentage' && !!attorney.values[key]?.trim() && vendeeShareCents(attorney.values[key]) === null} value={attorney.values[key] || ''} onChange={event => update(attorney.id, key, event.target.value)} />}</label>)}</div>
      <p>Represents these principals:</p>
      {principals.map((principal, principalIndex) => <label key={principal.id} style={{ display: 'block', marginBottom: 8 }}><input type="checkbox" checked={attorney.principalIds.includes(principal.id)} onChange={event => onChange({ ...authority, attorneys: authority.attorneys.map(item => item.id !== attorney.id ? item : { ...item, principalIds: event.target.checked ? [...item.principalIds, principal.id] : item.principalIds.filter(id => id !== principal.id) }) })} /> {principal.values.executantName || `Principal ${principalIndex + 1}`}</label>)}
      <button type="button" onClick={() => onChange({ ...authority, attorneys: authority.attorneys.filter(item => item.id !== attorney.id) })}>Remove attorney {index + 1}</button>
    </fieldset>)}
    <button type="button" onClick={() => onChange({ ...authority, attorneys: [...authority.attorneys, { id: crypto.randomUUID(), principalIds: [], values: {} }] })}>Add attorney</button>
  </section>
  {!!authority.extractions?.length && <details className="panel" aria-label="Authority extraction review"><summary>Review extracted people, source quotes and notes</summary>
    {(authority.extractions || []).map(extraction => <section key={extraction.id} aria-label="Extracted authority people">
      {extraction.people.map(person => <ExtractedAuthorityPerson key={person.id} person={person} principals={principals} authority={authority} onApply={onApplyPerson} holderLabel={state.saleDocument === 'agpa' ? 'AGPA holder' : 'GPA holder'} />)}
      {extraction.notes.length > 0 && <ul>{extraction.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
    </section>)}
  </details>}
    <style>{`.sale-authority-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;margin:18px 0}.sale-authority-grid input,.sale-authority-grid select{width:100%;min-height:40px}.panel[aria-label="Sale attorney details"] fieldset,details[aria-label="Authority extraction review"] fieldset{padding:18px;margin:18px 0;border:1px solid #aaa;border-radius:8px}`}</style>
  </>;
  function updateDocuments(value: SaleAuthority) {
    const retained = new Set([...(value.documents || []), ...value.attorneys.flatMap(attorney => attorney.documents || [])].map(document => document.id));
    onChange({ ...value, extractions: (value.extractions || []).filter(extraction => extraction.documentIds.every(id => retained.has(id))) });
  }
  function update(id: string, key: string, value: string) {
    onChange({ ...authority, attorneys: authority.attorneys.map(item => item.id === id ? { ...item, values: { ...item.values, [key]: value } } : item) });
  }
}

function ExtractedAuthorityPerson({ person, principals, authority, onApply, holderLabel }: { person: AuthorityPerson; principals: { id: string; values: Record<string, string> }[]; authority: SaleAuthority; onApply: (person: AuthorityPerson, role: 'principal' | 'attorney', targetId: string) => string; holderLabel: string }) {
  const [role, setRole] = useState(person.role === 'unknown' ? '' : person.role);
  const [target, setTarget] = useState('auto');
  const [message, setMessage] = useState('');
  const name = person.values.Name.toLocaleLowerCase().trim();
  const effectiveTarget = target !== 'auto' ? target : role === 'principal' ? principals.find(principal => principal.values.executantName?.toLocaleLowerCase().trim() === name)?.id || principals.find(principal => !principal.values.executantName)?.id || 'new' : authority.attorneys.find(attorney => attorney.values.Name?.toLocaleLowerCase().trim() === name)?.id || authority.attorneys.find(attorney => !attorney.values.Name)?.id || 'new';
  return <fieldset><legend>{person.values.Name} — extracted individual</legend>
    <p>{person.sourceName} · Page {person.page} · Detected role: {person.role === 'attorney' ? holderLabel : person.role}</p>
    <details><summary>Review extracted details and source quote</summary><dl>{Object.entries(person.values).map(([key, value]) => <React.Fragment key={key}><dt>{fields.find(field => field[0] === key)?.[1] || key}</dt><dd>{value}</dd></React.Fragment>)}</dl><blockquote>{person.quote}</blockquote></details>
    <label className="field"><span>Assign role for {person.values.Name}</span><select aria-label={`Assign role for ${person.values.Name}`} value={role} onChange={event => { setRole(event.target.value); setTarget('auto'); setMessage(''); }}><option value="">Choose role</option><option value="principal">Principal</option><option value="attorney">{holderLabel} / attorney</option></select></label>
    {role && <label className="field"><span>Fill record for {person.values.Name}</span><select aria-label={`Fill record for ${person.values.Name}`} value={effectiveTarget} onChange={event => setTarget(event.target.value)}><option value="new">New {role === 'principal' ? 'principal' : holderLabel}</option>{role === 'principal' ? principals.map((principal, index) => <option key={principal.id} value={principal.id}>{principal.values.executantName || `Principal ${index + 1}`}</option>) : authority.attorneys.map((attorney, index) => <option key={attorney.id} value={attorney.id}>{attorney.values.Name || `Attorney ${index + 1}`}</option>)}</select></label>}
    <button type="button" disabled={!role} onClick={() => { const targetId = effectiveTarget === 'new' ? crypto.randomUUID() : effectiveTarget; const error = onApply(person, role as 'principal' | 'attorney', targetId); setMessage(error || 'Details filled. Existing values were retained; review the completed record and represented principals.'); if (!error) setTarget(targetId); }}>Fill selected role</button>
    {message && <p role="status">{message}</p>}
  </fieldset>;
}
