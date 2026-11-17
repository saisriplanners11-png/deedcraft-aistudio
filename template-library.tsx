import { IconButton } from './icon-button';
import { FileDropZone } from './file-drop-zone';
import React, { useEffect, useRef, useState } from 'react';
import { listTemplates, templateRequest } from './template-library-client';
import type { LibraryListing } from './template-library-types';
import { MAX_CUSTOM_TEMPLATE_BYTES } from './docx';
import { libraryFamilyFor, TEMPLATE_FAMILIES, type TemplateFamilyId } from './template-library-families';
import './template-library.css';
import { TemplateFieldConfigurator } from './template-field-configurator';

const SAMPLE_BUILD_TIMEOUT_MS = 120000;

export function TemplateLibrary({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const [listing, setListing] = useState<LibraryListing | null>(null);
  const [session, setSession] = useState<{ configured: boolean; authenticated: boolean; csrf?: string }>({ configured: false, authenticated: false });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currentSamples, setCurrentSamples] = useState<Record<string, { preservationVersion: string; cases: { id: string; label: string }[] }>>({});
  const [family, setFamily] = useState<TemplateFamilyId>('sale');
  const activeId = listing?.active[family];
  const versions = listing?.versions.filter(version => libraryFamilyFor(version.instrumentId, version.variantId) === family);
  const input = useRef<HTMLInputElement>(null);
  async function refresh() {
    const [sessionState, data, guide] = await Promise.all([
      templateRequest<typeof session>('/session'), listTemplates(), templateRequest<{ placeholders: string[] }>('/guide'),
    ]);
    setSession(sessionState); setListing(data); setPlaceholders(guide.placeholders);
  }
  useEffect(() => { void refresh().catch(error => setError(error.message)); }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  }
  function mutation(path: string, body: unknown) {
    const signal = path.endsWith('/validate') ? AbortSignal.timeout(SAMPLE_BUILD_TIMEOUT_MS) : undefined;
    return templateRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf || '' }, body: JSON.stringify(body), signal });
  }
  async function upload(file?: File) {
    if (!file) return;
    await run(async () => {
      if (file.size > MAX_CUSTOM_TEMPLATE_BYTES) throw new Error('The template is larger than 20 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      await templateRequest(`/upload?family=${family}&filename=${encodeURIComponent(file.name)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'X-CSRF-Token': session.csrf || '' }, body: bytes as BodyInit,
        signal: AbortSignal.timeout(SAMPLE_BUILD_TIMEOUT_MS),
      });
      await refresh(); setNotice('Revision uploaded. Review its validation report and sample Word files before publishing.');
    });
    if (input.current) input.current.value = '';
  }
  return <main id="workspace-main" tabIndex={-1} className="template-library saved-deeds-dashboard">
    <div className="template-heading"><div><p className="eyebrow">SHARED LIBRARY</p><h1>Deed templates</h1><p>View the Word formats used to prepare your deeds.</p></div><button onClick={onClose}>Back to deeds</button></div>
    <div className="template-intro">Published templates supply the Word wording and layout. DeedCraft applies the current deed rules when generating a document. The Word template download is the unfilled source; use a current-rule sample below to inspect the generated result. {listing?.preservationVersion && <>Shared rule version: <strong>{listing.preservationVersion}</strong>.</>}</div>
    {error && <p className="notice" role="alert">{error} <button disabled={busy} onClick={() => void run(refresh)}>Refresh library</button></p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="template-panel"><h2>Published templates</h2>
      <div className="template-family-field"><label htmlFor="template-family">Deed type</label><select id="template-family" value={family} disabled={busy} onChange={event => { setFamily(event.target.value as TemplateFamilyId); setNotice(''); setError(''); }}>{Object.entries(TEMPLATE_FAMILIES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></div>
      {activeId && <p>Active version <strong>{activeId}</strong> · <a href={`/api/templates/versions/${activeId}/download`}>Download current Word template</a></p>}
      <details><summary>How to edit a template</summary><p>Open the downloaded .docx in Microsoft Word. Edit wording and formatting while retaining the placeholders and section markers. Upload the edited template with the corresponding deed type selected.</p></details>
      {family === 'sale' && <details><summary>Supported Sale placeholders ({placeholders.length})</summary><div className="placeholder-list">{placeholders.map(value => <code key={value}>&lt;{value}&gt;</code>)}</div></details>}
    </section>
    <section className="template-panel"><h2>Template administrator</h2>
      {!session.configured ? <p>Management is disabled. Configure TEMPLATE_ADMIN_PASSWORD on the server to enable uploading and publishing.</p> : !session.authenticated ? <form onSubmit={event => { event.preventDefault(); void run(async () => {
        await templateRequest('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
        setPassword(''); await refresh();
      }); }}><label>Administrator password <input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><button disabled={busy}>Sign in</button></form> : <FileDropZone className="template-actions" disabled={busy}><input ref={input} type="file" disabled={busy} hidden accept=".docx" onChange={event => void upload(event.target.files?.[0])} /><button disabled={busy} className="primary" onClick={() => input.current?.click()}>{busy ? 'Working…' : 'Upload revised Word template'}</button><button disabled={busy} onClick={() => void run(async () => { await mutation('/logout', {}); await refresh(); })}>Sign out</button><button disabled={busy} onClick={() => void run(refresh)}>Refresh</button></FileDropZone>}
    </section>
    {versions?.map(version => <section className="template-panel" key={version.id}>
      <div className="template-heading"><div><h2>{version.filename}</h2><p>{version.id === activeId ? 'Active' : version.publishedAt ? 'Previously published' : 'Unpublished revision'} · {new Date(version.createdAt).toLocaleString()}</p><small>{version.id} · SHA-256 {version.hash}</small></div><a href={`/api/templates/versions/${version.id}/download`}>Download Word</a></div>
      {session.authenticated && version.validation && <>
        {!version.publishedAt && <div className="template-delete"><IconButton label="Delete revision" disabled={busy} onClick={() => setDeleting(version.id)} />{deleting === version.id && <div role="alertdialog" aria-label={`Delete ${version.filename}`}><p>Move <strong>{version.filename}</strong> to Trash? It will be removed from this list. You can restore it from Trash. The active template will stay unchanged.</p><div className="template-actions"><button autoFocus disabled={busy} onClick={() => setDeleting(null)}>Cancel deletion</button><button disabled={busy} onClick={() => void run(async () => {
          await templateRequest(`/versions/${version.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf || '' }, body: JSON.stringify({ expectedSchemaRevision: version.schemaRevision || 0, expectedHash: version.hash }) });
          setDeleting(null); if (configuring === version.id) setConfiguring(null); setReviewed(old => ({ ...old, [version.id]: false })); await refresh(); setNotice('Revision moved to Trash. The active template is unchanged.');
        })}>Move to Trash</button></div></div>}</div>}
        {!version.publishedAt && family === 'sale' && <><p>{version.inspection?.unresolved?.length ? `Needs field configuration: ${version.inspection.unresolved.join(', ')}` : `${version.fieldContract?.fields.length || 0} configured additional fields`}</p><button disabled={busy} onClick={() => setConfiguring(old => old === version.id ? null : version.id)}>Configure fields</button>{configuring === version.id && <TemplateFieldConfigurator key={`${version.id}:${version.schemaRevision || 0}`} version={version} csrf={session.csrf || ''} onSaved={async () => { await refresh(); setReviewed(old => ({ ...old, [version.id]: false })); setNotice('Field configuration saved. Revalidate and rebuild samples, then review them before publishing.'); }} />}</>}
        <p><strong>{version.validation.valid ? 'Structural validation passed' : 'Validation failed'}</strong> · {version.validation.detectedPlaceholders.length} supported placeholders{version.preservationVersion && <> · checked under rules {version.preservationVersion}</>}</p>
        {!!version.validation.errors.length && <ul>{version.validation.errors.map(error => <li key={error}>{error}</li>)}</ul>}
        <details><summary>Optional omitted placeholders ({version.validation.omittedPlaceholders.length})</summary><p>{version.validation.omittedPlaceholders.join(', ') || 'None'}</p></details>
        <div className="template-current-samples"><button disabled={busy} onClick={() => void run(async () => {
          const result = await templateRequest<{ preservationVersion: string; cases: { id: string; label: string }[] }>(`/versions/${version.id}/current-samples`);
          setCurrentSamples(old => ({ ...old, [version.id]: result }));
        })}>Show samples with current deed rules</button>
        {currentSamples[version.id] && <><p>Generated with shared rule version {currentSamples[version.id].preservationVersion} from this unchanged Word source.</p><div className="template-samples">{currentSamples[version.id].cases.map(sample => <a key={sample.id} href={`/api/templates/versions/${version.id}/current-samples/${sample.id}`}>Current sample: {sample.label}</a>)}</div></>}</div>
        {!!version.samples?.length && <details><summary>{version.publishedAt ? 'Historical samples from publication' : 'Samples for publication'} ({version.samples.length})</summary>{version.publishedAt && version.samplesPreservationVersion !== listing?.preservationVersion && <p>These files were made under earlier rules. Use the current-rule samples above to review today’s output.</p>}<div className="template-samples">{version.samples.map(sample => sample.error ? <p key={sample.id} role="alert">{sample.label}: {sample.error}</p> : <a key={sample.id} href={`/api/templates/versions/${version.id}/samples/${sample.id}`}>Sample: {sample.label}</a>)}</div></details>}
        {!version.publishedAt && <><label className="template-review"><input type="checkbox" checked={!!reviewed[version.id]} onChange={event => setReviewed(old => ({ ...old, [version.id]: event.target.checked }))} />I reviewed every sample’s wording and layout in Word and approve this template for future deeds.</label>{version.preservationVersion !== listing.preservationVersion && <p>Deed rules have changed. Revalidate and review fresh samples before publishing.</p>}<div className="template-actions"><button disabled={busy || !reviewed[version.id] || !version.validation.valid || version.samples.length !== (version.expectedSampleCount || 8) || version.samples.some(item => item.error) || version.samplesSchemaHash !== version.schemaHash || version.samplesPreservationVersion !== listing.preservationVersion} onClick={() => void run(async () => { await mutation(`/versions/${version.id}/publish`, { expectedActive: activeId, expectedSchemaRevision: version.schemaRevision, expectedSchemaHash: version.schemaHash, reviewed: true }); await refresh(); onPublished(); setNotice('Published. New and saved deeds will use this version.'); })}>Publish version</button><button disabled={busy} onClick={() => void run(async () => { await mutation(`/versions/${version.id}/validate`, {}); await refresh(); setReviewed(old => ({ ...old, [version.id]: false })); })}>Revalidate and rebuild samples</button></div></>}
        {version.publishedAt && version.id !== activeId && <button disabled={busy} onClick={() => void run(async () => { await mutation(`/versions/${version.id}/rollback`, { expectedActive: activeId }); await refresh(); onPublished(); setNotice('Previous version activated for new and saved deeds.'); })}>Restore this published version</button>}
      </>}
    </section>)}
    {session.authenticated && <section className="template-panel"><details><summary>Trash ({listing?.deletedVersions?.length || 0})</summary><p>Deleted unpublished revisions can be restored. Their Word files and samples are retained. Published versions cannot be deleted because saved deeds may use them.</p>{listing?.deletedVersions?.map(version => <div key={version.id}><h3>{version.filename}</h3><p>{version.id} · Deleted {new Date(version.deletedAt!).toLocaleString()}</p><button disabled={busy} onClick={() => void run(async () => { await mutation(`/versions/${version.id}/restore`, {}); await refresh(); setNotice('Revision restored. Review validation and samples before publishing.'); })}>Restore revision</button></div>)}</details></section>}
    {session.authenticated && !!listing?.history?.length && <section className="template-panel"><h2>Publication history</h2><ul>{listing.history.map((item, index) => <li key={`${item.at}-${index}`}>{new Date(item.at).toLocaleString()} · {item.action} · {item.versionId}</li>)}</ul></section>}
  </main>;
}
