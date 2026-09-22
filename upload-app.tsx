import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ALL_FIELDS } from './fields';
import { appStateFor, draftReducer, EXTRACTION_VERSION, fieldKey, labelFor, newDraft, plansFor, resolveDraft, type Draft, type Role, type SourceResult, WorkQueue } from './source-draft';
import { extractUpload, fileHash } from './upload-extraction';
import { fillSaleDeed, saveBlob } from './docx';
import { deedFilename, propertyForm, mergeValues, rewritesFor, scheduleMergesFor, variantFor } from './merge';
import { generationBlockers, partyRecords, scheduleRecords } from './logic';
import { planPdf, planPng, registrationPlanSvg } from './registration-plan';
import './upload-app.css';

const screens = ['Property documents', 'Payments', 'Claimants & download'];
const fileQueue = new WorkQueue(2);
const ACCEPT = '.pdf,.docx,.txt,.md,image/jpeg,image/png,image/webp,image/gif';

/** Labels for unassigned party-prefixed fields, reusing the executant field labels. */
const PARTY_LABELS: Record<string, string> = Object.fromEntries(
  ALL_FIELDS.filter(f => f.id.startsWith('executant')).map(f => [f.id.replace(/^executant/, ''), f.label])
);
const partyFieldLabel = (field: string) => PARTY_LABELS[field.replace(/^party/, '')] || field.replace(/^party/, '');
/** One readable line per unassigned person, built only from fields actually found. */
const PARTY_SUMMARY_ORDER = ['Dob', 'Age', 'Occupation', 'RelationName', 'Aadhaar', 'Mobile', 'HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'];

type PersonGroup = { sourceId: string; sourceName: string; record: string; fields: Record<string, string> };

export default function UploadApp() {
  const [draft, dispatch] = useReducer(draftReducer, undefined, newDraft);
  const current = useRef(draft); current.current = draft;
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const cache = useRef(new Map<string, Promise<SourceResult>>());
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [download, setDownload] = useState<{ revision: number; draftId: string; docx?: Blob; pdf?: Blob; filename: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const state = useMemo(() => appStateFor(draft), [draft]);
  const resolved = useMemo(() => resolveDraft(draft), [draft]);
  const notices = generationBlockers(state).filter(item => !['deedType','draft'].includes(item.id));
  const busy = draft.sources.some(s => s.status === 'reading' || s.status === 'queued');
  const recordOptions = (role: Role) => [...new Set(Object.keys(resolved.values).filter(k => k.startsWith(role + '|')).map(k => k.split('|')[1]))];

  // Documents that identify a person without saying which side of the deed they
  // are on (a bare Aadhaar, a note with no role) group into one card per person
  // so the drafter can say "seller" or "buyer" once, instead of hunting through
  // every uploaded source for an easy-to-miss inline prompt.
  const personGroups = useMemo(() => {
    const map = new Map<string, PersonGroup>();
    for (const c of resolved.unassigned) {
      const key = `${c.sourceId}|${c.record}`;
      const group = map.get(key) || { sourceId: c.sourceId, sourceName: c.sourceName, record: c.record, fields: {} };
      group.fields[c.field] = c.value;
      map.set(key, group);
    }
    return [...map.values()];
  }, [resolved.unassigned]);
  const [dismissedPeople, setDismissedPeople] = useState<Set<string>>(new Set());
  const pendingPeople = personGroups.filter(g => !dismissedPeople.has(`${g.sourceId}|${g.record}`));
  const pendingSignature = pendingPeople.map(g => `${g.sourceId}|${g.record}`).join(',');
  const [roleModalClosed, setRoleModalClosed] = useState(false);
  useEffect(() => { if (pendingSignature) setRoleModalClosed(false); }, [pendingSignature]);
  const assignPerson = (group: PersonGroup, role: Role) => {
    dispatch({ type: 'assign', id: group.sourceId, role, record: recordOptions(role)[0] || 'primary', fromRecord: group.record });
    setDismissedPeople(prev => new Set(prev).add(`${group.sourceId}|${group.record}`));
  };
  const dismissPerson = (group: PersonGroup) => setDismissedPeople(prev => new Set(prev).add(`${group.sourceId}|${group.record}`));
  const acceptedCount = Object.values(resolved.values).filter(Boolean).length;
  useEffect(() => { setDownload(null); setMessage(''); }, [draft.id, draft.revision]);
  useEffect(() => () => { controllers.current.forEach(c => c.abort()); }, []);

  async function run(sourceId: string, revision: number, file: File, draftId: string) {
    controllers.current.get(sourceId)?.abort();
    const controller = new AbortController(); controllers.current.set(sourceId, controller);
    const valid = () => !controller.signal.aborted && current.current.id === draftId;
    const job = (patch: any) => dispatch({ type: 'job', draftId, sourceId, sourceRevision: revision, patch });
    const started = performance.now();
    try {
      await fileQueue.run(async () => {
        if (!valid()) return;
        job({ status: 'reading' });
        const hash = await fileHash(file);
        if (!valid()) return;
        job({ hash });
        const key = `${draftId}:${hash}:${EXTRACTION_VERSION}`;
        // Store completed results only: cancellation of one source must not cancel another.
        let result: SourceResult;
        if (cache.current.has(key)) result = await cache.current.get(key)!;
        else {
          result = await extractUpload(file, controller.signal, text => {
            if (valid()) setProgress(p => ({ ...p, [sourceId]: typeof text === 'string' ? text : `${text.title} · ${text.state}` }));
          }, result => { if (valid()) job({ result }); });
          if (valid()) cache.current.set(key, Promise.resolve(result));
        }
        if (valid()) job({ status: 'done', result, durationMs: performance.now() - started, error: undefined });
      });
    } catch (error: any) {
      if (valid()) job({ status: 'error', error: error.message || 'This upload could not be read.' });
    }
  }

  function addFiles(incoming: File[]) {
    for (const file of incoming) {
      const id = crypto.randomUUID(); files.current.set(id, file);
      dispatch({ type: 'add', source: { id, revision: 0, name: file.name, hash: '', status: 'queued' } });
      void run(id, 0, file, current.current.id);
    }
  }
  function replace(id: string, file: File) {
    const source = current.current.sources.find(s => s.id === id); if (!source) return;
    files.current.set(id, file);
    dispatch({ type: 'replace', id, name: file.name });
    void run(id, source.revision + 1, file, current.current.id);
  }
  function remove(id: string) {
    controllers.current.get(id)?.abort(); controllers.current.delete(id); files.current.delete(id);
    dispatch({ type: 'remove', id });
  }
  function reset() {
    controllers.current.forEach(c => c.abort()); controllers.current.clear(); files.current.clear(); cache.current.clear();
    setProgress({}); setDownload(null); dispatch({ type: 'reset' });
  }

  const propertyRecords = scheduleRecords(state);
  const hasAny = (values: Record<string, string>) => Object.values(values).some(Boolean);
  const executantRecords = partyRecords(state, 'executant').filter(r => hasAny(r.values));
  const claimantRecords = partyRecords(state, 'claimant').filter(r => hasAny(r.values));
  const populatedPropertyRecords = propertyRecords.filter(r => hasAny(r.values));
  const partySummary = (values: Record<string, string>, side: 'executant' | 'claimant') => {
    const get = (suffix: string) => values[`${side}${suffix}`];
    return {
      name: get('Name') || 'Name not yet confirmed',
      line1: [get('RelationName'), get('Age') && `Aged ${get('Age')}`, get('Occupation')].filter(Boolean).join(' · '),
      line2: [get('HNo') && `H.No. ${get('HNo')}`, get('Locality'), get('Village'), get('Mandal')].filter(Boolean).join(', '),
      line3: [get('Aadhaar') && `Aadhaar ${get('Aadhaar')}`, get('Mobile')].filter(Boolean).join(' · '),
    };
  };
  const propertySummary = (record: (typeof propertyRecords)[number]) => {
    const v = record.values;
    return {
      heading: [v.plotNo && `Plot No. ${v.plotNo}`, v.bearingHNo && `H.No. ${v.bearingHNo}`, record.category].filter(Boolean).join(' · ') || 'Property not yet identified',
      line1: [v.surveyNo && `Survey ${v.surveyNo}`, v.extentValue && `${v.extentValue} ${record.unit || ''}`.trim()].filter(Boolean).join(' · '),
      line2: [v.locality, v.village, v.mandal, v.district].filter(Boolean).join(', '),
    };
  };
  const completePaymentTotal = state.payments.length > 0 && state.payments.every(p=>p.amount && Number.isFinite(Number(p.amount))) ? state.payments.reduce((sum,p)=>sum+Number(p.amount),0) : null;
  const paymentMismatch = completePaymentTotal !== null && state.form.consid && Math.abs(completePaymentTotal-Number(state.form.consid)) > .005;
  const propertyIds = [...new Set(Object.keys(resolved.values).filter(k => k.startsWith('property|') && !k.startsWith('property|transaction|')).map(k => k.split('|')[1]))];
  const previews = propertyRecords.map((record, i) => {
    const id = propertyIds[i] || 'primary';
    const plans = plansFor(draft, id);
    // More than one differing plan is ambiguous; do not pick one by upload order.
    const unique = [...new Map(plans.map(plan => [JSON.stringify(plan.drawing), plan])).values()];
    const form: Record<string, string> = { ...propertyForm(state, record.values), category: record.category };
    const values = mergeValues({ ...state, form, unit: record.unit, additionalSchedules: [] });
    form.extentSqYards = values['Extent in Sq.yards']; form.extentSqMeters = values['Extent in Sq.Meters'];
    try { return { id, svg: registrationPlanSvg(form, unique.length === 1 ? unique[0].drawing : null, { vendors: partyRecords(state, 'executant').map(r => r.values), buyers: partyRecords(state, 'claimant').map(r => r.values) }), note: unique.length > 1 ? 'Several plans disagree. Remove or replace the superseded plan; the drawing remains blank.' : unique.length === 0 ? 'No verified drawing yet. Upload a plan or hand sketch, or download with this region blank.' : unique[0].linked ? 'Drawing from the linked deed.' : 'Drawing from the uploaded plan.', error: '' }; }
    catch (error: any) { return { id, svg: '', note: '', error: error.message }; }
  });

  async function generate(kind: 'word' | 'pdf') {
    const snapshot = current.current; setExporting(true); setMessage('');
    try {
      let artifact = download?.draftId === snapshot.id && download.revision === snapshot.revision
        ? download : { draftId: snapshot.id, revision: snapshot.revision, filename: deedFilename(state) };
      if (kind === 'word' && !artifact.docx) {
        const merged = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMergesFor(state));
        artifact = { ...artifact, docx: merged.blob };
      }
      if (kind === 'pdf' && !artifact.pdf) {
        if (previews.some(p => p.error)) throw new Error(previews.find(p => p.error)!.error);
        const pngs = await Promise.all(previews.map(p => planPng(p.svg)));
        const pdf = await planPdf(pngs);
        artifact = { ...artifact, pdf };
      }
      if (current.current.id !== snapshot.id || current.current.revision !== snapshot.revision) {
        setMessage('Details changed while preparing the download. Please download again to use the latest details.'); return;
      }
      setDownload(artifact);
      saveBlob(kind === 'word' ? artifact.docx! : artifact.pdf!, kind === 'word' ? artifact.filename : artifact.filename.replace(/\.docx$/, '-plan.pdf'));
      setMessage('Downloaded using the current details. Missing or uncertain details were left blank.');
    } catch (error: any) { setMessage(`Download could not be prepared: ${error.message}. Your uploads are still here; please retry.`); }
    finally { setExporting(false); }
  }

  const edit = (role: Role, record: string, field: string, value: string) => dispatch({ type: 'manual', key: fieldKey(role, record, field), value });
  const groupsForScreen = ALL_FIELDS.filter(f => draft.step === 0 ? !/^claimant/.test(f.id) && !['consid','stampValue','executionDate'].includes(f.id) : draft.step === 1 ? ['consid','stampValue','executionDate'].includes(f.id) : /^claimant/.test(f.id));

  return <div className="upload-app">
    <header className="app-top"><a href="#" className="brand">DeedCraft <span>SALE DEEDS</span></a><button className="quiet" onClick={reset}>New deed</button></header>
    <main>
      <nav className="steps" aria-label="Document steps">{screens.map((label, i) => <button key={label} aria-current={draft.step === i ? 'step' : undefined} onClick={() => dispatch({ type: 'step', step: i })}><b>{i + 1}</b>{label}</button>)}</nav>
      <div className="intro"><p className="eyebrow">STEP {draft.step + 1} OF 3</p><h1>{screens[draft.step]}</h1><p>{draft.step === 0 ? 'Upload the linked deed, house-tax records, NALA, passbook and any plan. We will read the details for you.' : draft.step === 1 ? 'Upload payment receipts, cheques, or a handwritten payment note. Each payment stays separate.' : 'Upload claimant identity documents and any handwritten particulars. Your deed and plan are ready to download, even with blanks.'}</p></div>
      <section className="drop-area" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles([...e.dataTransfer.files]); }}>
        <div className="upload-icon">↑</div><h2>Upload documents or handwritten notes</h2><p>Drop everything here. Mixed files and photos are welcome on any step.</p>
        <button className="primary" onClick={() => input.current?.click()}>Choose files or take a photo</button><input ref={input} type="file" multiple accept={ACCEPT} onChange={e => { addFiles([...(e.target.files || [])]); e.target.value = ''; }} hidden />
        <small>PDF, Word, images or text · English and Telugu · Missing details stay blank</small>
      </section>
      <div className="summary-bar"><strong>{acceptedCount} details available</strong><span>{draft.sources.length} uploads</span><span>{busy ? 'Reading your uploads…' : 'You can add more at any time'}</span></div>
      {pendingPeople.length > 0 && roleModalClosed && <button className="review-people-banner" onClick={() => setRoleModalClosed(false)}>{pendingPeople.length} {pendingPeople.length === 1 ? 'person needs' : 'people need'} a role — review</button>}
      {pendingPeople.length > 0 && !roleModalClosed && <div className="role-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm who each person is">
        <div className="role-modal">
          <header><h2>Who are these people?</h2><button className="quiet" aria-label="Close" onClick={() => setRoleModalClosed(true)}>✕</button></header>
          <p>These uploads name a person but nothing said whether they are the seller or the buyer. Choose for each — you can always change this later.</p>
          <div className="role-modal-list">{pendingPeople.map(group => {
            const name = group.fields.partyName || group.record;
            const details = PARTY_SUMMARY_ORDER.filter(suffix => group.fields[`party${suffix}`]).map(suffix => `${partyFieldLabel(`party${suffix}`)}: ${group.fields[`party${suffix}`]}`);
            return <article className="role-card" key={`${group.sourceId}|${group.record}`}>
              <strong>{name}</strong>
              <p>{details.join(' · ') || 'No further identifying details were verified.'}</p>
              <small>From {group.sourceName}</small>
              <div className="role-card-actions">
                <button className="primary" onClick={() => assignPerson(group, 'executant')}>Executant (Seller)</button>
                <button className="primary" onClick={() => assignPerson(group, 'claimant')}>Claimant (Buyer)</button>
                <button className="quiet" onClick={() => dismissPerson(group)}>Not a party — skip</button>
              </div>
            </article>;
          })}</div>
        </div>
      </div>}
      {(executantRecords.length > 0 || claimantRecords.length > 0 || populatedPropertyRecords.length > 0) && <section className="panel parties-property">
        <h2>Parties &amp; property</h2>
        <p>What the deed will say, so far. Executant and claimant are always kept separate — nothing here is guessed from a name alone.</p>
        <div className="party-columns">
          <div className="party-column">
            <h3>Executant{executantRecords.length !== 1 ? 's' : ''} — seller <span className="count-badge">{executantRecords.length}</span></h3>
            {executantRecords.length === 0 && <p className="notice">None confirmed yet.</p>}
            {executantRecords.map((r, i) => { const p = partySummary(r.values, 'executant'); return <article className="party-summary-card" key={r.id}>
              <strong>{i + 1}. {p.name}</strong>
              {p.line1 && <p>{p.line1}</p>}{p.line2 && <p>{p.line2}</p>}{p.line3 && <p>{p.line3}</p>}
            </article>; })}
          </div>
          <div className="party-column">
            <h3>Claimant{claimantRecords.length !== 1 ? 's' : ''} — buyer <span className="count-badge">{claimantRecords.length}</span></h3>
            {claimantRecords.length === 0 && <p className="notice">None confirmed yet.</p>}
            {claimantRecords.map((r, i) => { const p = partySummary(r.values, 'claimant'); return <article className="party-summary-card" key={r.id}>
              <strong>{i + 1}. {p.name}</strong>
              {p.line1 && <p>{p.line1}</p>}{p.line2 && <p>{p.line2}</p>}{p.line3 && <p>{p.line3}</p>}
            </article>; })}
          </div>
        </div>
        {populatedPropertyRecords.length > 0 && <><h3>Propert{populatedPropertyRecords.length !== 1 ? 'ies' : 'y'} <span className="count-badge">{populatedPropertyRecords.length}</span></h3>
        <div className="property-list">{populatedPropertyRecords.map((r, i) => { const p = propertySummary(r); return <article className="property-summary-card" key={r.id}>
          <strong>{populatedPropertyRecords.length > 1 ? `Property ${i + 1}: ` : ''}{p.heading}</strong>
          {p.line1 && <p>{p.line1}</p>}{p.line2 && <p>{p.line2}</p>}
        </article>; })}</div></>}
      </section>}
      {draft.sources.length > 0 && <section className="panel"><h2>Your uploads</h2><div className="source-list">{draft.sources.map(source => <article className="source" key={source.id}>
        <div><strong>{source.name}</strong><p role="status">{source.status === 'done' ? `${source.result?.candidates.filter(c => c.status === 'accepted').length || 0} verified transcriptions · ${Math.round((source.durationMs || 0) / 1000)}s` : source.status === 'error' ? source.error : progress[source.id] || 'Waiting to read…'}</p>
          <p>{Object.entries(resolved.values).filter(([key,value]) => value && resolved.evidence[key]?.some(c => c.sourceId === source.id && c.value === value)).slice(0,4).map(([key,value]) => `${labelFor(key.split('|')[2])}: ${value}`).join(' · ')}</p>
          {source.result?.notes.map((note, i) => <p className="notice" key={i}>{note}</p>)}
          {source.result?.candidates.some(c => c.status === 'uncertain') && <p className="notice">Some details could not be verified and remain blank. Upload a closer photo or note.</p>}
          {resolved.unassigned.some(c => c.sourceId === source.id) && <p className="notice">Names a person without a confirmed role. <button className="quiet" onClick={() => setRoleModalClosed(false)}>Review who they are</button></p>}
          {source.result?.plans.length === 1 && propertyIds.length > 0 && !propertyIds.some(id => plansFor(draft,id).includes(source.result!.plans[0])) && <div className="assignment"><span>Choose the property for this plan:</span>{propertyIds.map(id => <button key={id} onClick={() => dispatch({type:'assign',id:source.id,role:'property',record:id})}>{id}</button>)}</div>}
          <details><summary>Source details and assignment</summary><label>Associate this source with <select value={source.assignment ? `${source.assignment.role}|${source.assignment.record}` : ''} onChange={e => { const [role, record] = e.target.value.split('|'); if (role) dispatch({ type: 'assign', id: source.id, role: role as Role, record }); else dispatch({ type: 'unassign', id: source.id }); }}><option value="">Automatic association</option>{(['property','executant','claimant','payment','link'] as Role[]).flatMap(role => [...new Set(['primary', ...recordOptions(role), `additional-${source.id}`])].map(record => <option key={`${role}|${record}`} value={`${role}|${record}`}>{role} · {record.startsWith('additional-') ? 'Separate record' : record}</option>))}</select></label>
            {source.result?.candidates.map(c => <p key={c.id}><b>{labelFor(c.field)}:</b> {c.status === 'accepted' ? c.value : 'Blank — uncertain'} <small>{c.region} · “{c.quote}”</small></p>)}
          </details>
        </div><div className="source-actions"><label className="button">Replace<input type="file" accept={ACCEPT} hidden onChange={e => { const file = e.target.files?.[0]; if (file) replace(source.id, file); e.target.value = ''; }} /></label>{source.status === 'error' && <button onClick={() => { const f = files.current.get(source.id); if (f) replace(source.id, f); }}>Retry</button>}<button onClick={() => remove(source.id)}>Remove</button></div>
      </article>)}</div></section>}
      {Object.keys(resolved.conflicts).length > 0 && <section className="panel"><h2>Different details found</h2><p>Unresolved extracted details stay blank. An intentional manual entry remains yours.</p>{Object.entries(resolved.conflicts).map(([key, candidates]) => <div className="conflict" key={key}><b>{labelFor(key.split('|')[2])}</b>{candidates.map(c => <button key={c.id} onClick={() => dispatch({ type: 'choose', key, candidateId: c.id })}>{c.value}<small>{c.sourceName} · {c.region}</small></button>)}</div>)}</section>}
      {draft.step === 2 && <section className="panel download"><h2>Download your sale deed</h2><p>The Word draft keeps your reference wording. Download the registration plan separately as a PDF. Missing details are left as write-in spaces.</p>
        {paymentMismatch && <p className="notice">The uploaded payments total ₹{completePaymentTotal!.toLocaleString('en-IN')}, which differs from the stated consideration. Upload another payment record or correct the details if needed; download is still available.</p>}
        <details><summary>{notices.length} missing or incomplete details — download is still available</summary><ul>{notices.map(item => <li key={item.id}>{item.label}</li>)}</ul></details>
        {busy && <p className="notice">Uploads are still being read. A download now includes only details already verified.</p>}
        <div className="download-actions"><button className="primary" disabled={exporting} onClick={() => generate('word')}>{exporting ? 'Preparing…' : 'Download Word deed'}</button><button disabled={exporting} onClick={() => generate('pdf')}>Download plan PDF</button></div>
        {message && <p role="status">{message}</p>}
      </section>}
      <details className="panel"><summary>View details or make an optional correction</summary><p>Prefer to avoid typing? Upload another photo or a handwritten note above.</p>
        <div className="fields">{groupsForScreen.map(field => {
          const role: Role = field.id.startsWith('executant') ? 'executant' : field.id.startsWith('claimant') ? 'claimant' : field.id.startsWith('link') ? 'link' : 'property';
          const records = ['consid','executionDate','stampValue'].includes(field.id) ? ['transaction'] : recordOptions(role).filter(r => r !== 'transaction'); if (!records.length) records.push('primary');
          return records.map(record => <label key={`${record}:${field.id}`}>{field.label}{records.length > 1 ? ` · ${record}` : ''}<input type={field.type === 'date' ? 'date' : 'text'} value={resolved.values[fieldKey(role, record, field.id)] || ''} onChange={e => edit(role, record, field.id, e.target.value)} /></label>);
        })}</div>
        {draft.step === 0 && <label>Property category <select value={state.category} onChange={e => edit('property', propertyIds[0] || 'primary', 'category', e.target.value)}><option value="">Blank / not established</option>{['Vacant Plot','Residential','Commercial','Flat','Demolished','Agricultural land','Part open place'].map(category => <option key={category}>{category}</option>)}</select></label>}
        {draft.step === 1 && <div className="fields">{[...new Set(['primary', ...recordOptions('payment')])].map(record => ['mode','amount','refNo','bank','branch','date','payer','payee'].map(field => <label key={`${record}:${field}`}>{labelFor(field)} · {record}{field === 'mode' ? <select value={resolved.values[fieldKey('payment', record, field)] || ''} onChange={e => edit('payment', record, field, e.target.value)}><option value="">Blank</option>{['rtgs','cheque','dd','upi','cash'].map(mode => <option key={mode} value={mode}>{mode.toUpperCase()}</option>)}</select> : <input type={field === 'date' ? 'date' : 'text'} value={resolved.values[fieldKey('payment', record, field)] || ''} onChange={e => edit('payment', record, field, e.target.value)} />}</label>))}</div>}
      </details>
      {(draft.step === 0 || draft.step === 2) && <details className="panel" open={draft.step === 2}><summary>Registration plan preview</summary>{previews.map(preview => <div key={preview.id}><p>{preview.error || preview.note}</p>{preview.svg && <img className="plan-preview" alt="Registration plan preview" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svg)}`} />}</div>)}</details>}

      <footer className="navigation"><button disabled={draft.step === 0} onClick={() => dispatch({ type: 'step', step: draft.step - 1 })}>Back</button><span>Your uploads stay within this draft. New deed clears them.</span>{draft.step < 2 && <button className="primary" onClick={() => dispatch({ type: 'step', step: draft.step + 1 })}>Continue →</button>}</footer>
    </main>
  </div>;
}
