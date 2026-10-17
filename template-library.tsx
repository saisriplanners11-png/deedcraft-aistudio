import { FileDropZone } from './file-drop-zone';
import React, { useEffect, useRef, useState } from 'react';
import { listTemplates, templateRequest } from './template-library-client';
import type { LibraryListing } from './template-library-types';
import { MAX_CUSTOM_TEMPLATE_BYTES, validateSaleDeedTemplate } from './docx';
import './template-library.css';
import { TemplateFieldConfigurator } from './template-field-configurator';

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
    return templateRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf || '' }, body: JSON.stringify(body) });
  }
  async function upload(file?: File) {
    if (!file) return;
    await run(async () => {
      if (file.size > MAX_CUSTOM_TEMPLATE_BYTES) throw new Error('The template is larger than 20 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const local = await validateSaleDeedTemplate(bytes, file.name);
      if (!local.valid) setNotice('Compatibility issues detected. Uploading for the authoritative server report.');
      await templateRequest(`/upload?instrument=sale&filename=${encodeURIComponent(file.name)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'X-CSRF-Token': session.csrf || '' }, body: bytes as BodyInit,
      });
      await refresh(); setNotice('Revision uploaded. Review its validation report and sample Word files before publishing.');
    });
    if (input.current) input.current.value = '';
  }
  return <main id="workspace-main" tabIndex={-1} className="template-library saved-deeds-dashboard">
    <div className="template-heading"><div><p className="eyebrow">SHARED LIBRARY</p><h1>Deed templates</h1><p>Download → Edit in Word → Upload → Configure fields → Validate → Review → Publish</p></div><button onClick={onClose}>Back to deeds</button></div>
    {error && <p className="notice" role="alert">{error} <button disabled={busy} onClick={() => void run(refresh)}>Refresh library</button></p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="template-panel"><h2>Sale Deed</h2><p>One approved template covers plot, open place, part open place, house, dismantled house, and flats. Published changes apply to new deeds. Saved drafts retain their selected version.</p>
      {listing && <p>Active version: <strong>{listing.active.sale}</strong> · <a href={`/api/templates/versions/${listing.active.sale}/download`}>Download current Word template</a></p>}
      <details><summary>How to edit a template</summary><p>Open the downloaded .docx in Microsoft Word. Edit wording and formatting, preserving placeholders and all schedule/section markers. Upload the template rather than a completed client deed. Do not include client information in this shared file.</p><p>Inserted field values inherit the formatting of their placeholders. Longer text changes pagination. Generated ownership paragraphs, annexures, prepared-by text, and plan attachments have separately controlled formatting.</p><p>Required boundaries include “1. FLOW OF TITLE &amp; LINK DEED DETAILS:”, “2. CONSIDERATION &amp; PAYMENT TERMS:”, property schedule markers, and the declaration/shared-tail boundary.</p></details>
      <details><summary>Supported placeholders ({placeholders.length})</summary><div className="placeholder-list">{placeholders.map(value => <code key={value}>&lt;{value}&gt;</code>)}</div></details>
    </section>
    <section className="template-panel"><h2>Template administrator</h2>
      {!session.configured ? <p>Management is disabled. Configure TEMPLATE_ADMIN_PASSWORD on the server to enable uploading and publishing.</p> : !session.authenticated ? <form onSubmit={event => { event.preventDefault(); void run(async () => {
        await templateRequest('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
        setPassword(''); await refresh();
      }); }}><label>Administrator password <input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><button disabled={busy}>Sign in</button></form> : <FileDropZone className="template-actions" disabled={busy}><input ref={input} type="file" disabled={busy} hidden accept=".docx" onChange={event => void upload(event.target.files?.[0])} /><button disabled={busy} className="primary" onClick={() => input.current?.click()}>{busy ? 'Working…' : 'Upload revised Word template'}</button><button disabled={busy} onClick={() => void run(async () => { await mutation('/logout', {}); await refresh(); })}>Sign out</button><button disabled={busy} onClick={() => void run(refresh)}>Refresh</button></FileDropZone>}
    </section>
    {listing?.versions.map(version => <section className="template-panel" key={version.id}>
      <div className="template-heading"><div><h2>{version.filename}</h2><p>{version.id === listing.active.sale ? 'Active' : version.publishedAt ? 'Previously published' : 'Unpublished revision'} · {new Date(version.createdAt).toLocaleString()}</p><small>{version.id} · SHA-256 {version.hash}</small></div><a href={`/api/templates/versions/${version.id}/download`}>Download Word</a></div>
      {session.authenticated && version.validation && <>
        {!version.publishedAt && <div className="template-delete"><button disabled={busy} onClick={() => setDeleting(version.id)}>Delete revision</button>{deleting === version.id && <div role="alertdialog" aria-label={`Delete ${version.filename}`}><p>Move <strong>{version.filename}</strong> to Trash? It will be removed from this list. You can restore it from Trash. The active template will stay unchanged.</p><div className="template-actions"><button autoFocus disabled={busy} onClick={() => setDeleting(null)}>Cancel deletion</button><button disabled={busy} onClick={() => void run(async () => {
          await templateRequest(`/versions/${version.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf || '' }, body: JSON.stringify({ expectedSchemaRevision: version.schemaRevision || 0, expectedHash: version.hash }) });
          setDeleting(null); if (configuring === version.id) setConfiguring(null); setReviewed(old => ({ ...old, [version.id]: false })); await refresh(); setNotice('Revision moved to Trash. The active template is unchanged.');
        })}>Move to Trash</button></div></div>}</div>}
        {!version.publishedAt && <><p>{version.inspection?.unresolved?.length ? `Needs field configuration: ${version.inspection.unresolved.join(', ')}` : `${version.fieldContract?.fields.length || 0} configured additional fields`}</p><button disabled={busy} onClick={() => setConfiguring(old => old === version.id ? null : version.id)}>Configure fields</button>{configuring === version.id && <TemplateFieldConfigurator key={`${version.id}:${version.schemaRevision || 0}`} version={version} csrf={session.csrf || ''} onSaved={async () => { await refresh(); setReviewed(old => ({ ...old, [version.id]: false })); setNotice('Field configuration saved. Revalidate and rebuild samples, then review them before publishing.'); }} />}</>}
        <p><strong>{version.validation.valid ? 'Structural validation passed' : 'Validation failed'}</strong> · {version.validation.detectedPlaceholders.length} supported placeholders</p>
        {!!version.validation.errors.length && <ul>{version.validation.errors.map(error => <li key={error}>{error}</li>)}</ul>}
        <details><summary>Optional omitted placeholders ({version.validation.omittedPlaceholders.length})</summary><p>{version.validation.omittedPlaceholders.join(', ') || 'None'}</p></details>
        <div className="template-samples">{version.samples.map(sample => sample.error ? <p key={sample.id} role="alert">{sample.label}: {sample.error}</p> : <a key={sample.id} href={`/api/templates/versions/${version.id}/samples/${sample.id}`}>Sample: {sample.label}</a>)}</div>
        {!version.publishedAt && <><label className="template-review"><input type="checkbox" checked={!!reviewed[version.id]} onChange={event => setReviewed(old => ({ ...old, [version.id]: event.target.checked }))} />I reviewed every sample’s wording and layout in Word and approve this template for future deeds.</label><div className="template-actions"><button disabled={busy || !reviewed[version.id] || !version.validation.valid || version.samples.length !== (version.expectedSampleCount || 8) || version.samples.some(item => item.error) || version.samplesSchemaHash !== version.schemaHash} onClick={() => void run(async () => { await mutation(`/versions/${version.id}/publish`, { expectedActive: listing.active.sale, expectedSchemaRevision: version.schemaRevision, expectedSchemaHash: version.schemaHash, reviewed: true }); await refresh(); onPublished(); setNotice('Published. New deeds will use this version.'); })}>Publish version</button><button disabled={busy} onClick={() => void run(async () => { await mutation(`/versions/${version.id}/validate`, {}); await refresh(); setReviewed(old => ({ ...old, [version.id]: false })); })}>Revalidate and rebuild samples</button></div></>}
        {version.publishedAt && version.id !== listing.active.sale && <button disabled={busy} onClick={() => void run(async () => { await mutation(`/versions/${version.id}/rollback`, { expectedActive: listing.active.sale }); await refresh(); onPublished(); setNotice('Previous version activated for new deeds.'); })}>Restore this published version</button>}
      </>}
    </section>)}
    {session.authenticated && <section className="template-panel"><details><summary>Trash ({listing?.deletedVersions?.length || 0})</summary><p>Deleted unpublished revisions can be restored. Their Word files and samples are retained. Published versions cannot be deleted because saved deeds may use them.</p>{listing?.deletedVersions?.map(version => <div key={version.id}><h3>{version.filename}</h3><p>{version.id} · Deleted {new Date(version.deletedAt!).toLocaleString()}</p><button disabled={busy} onClick={() => void run(async () => { await mutation(`/versions/${version.id}/restore`, {}); await refresh(); setNotice('Revision restored. Review validation and samples before publishing.'); })}>Restore revision</button></div>)}</details></section>}
    {session.authenticated && !!listing?.history?.length && <section className="template-panel"><h2>Publication history</h2><ul>{listing.history.map((item, index) => <li key={`${item.at}-${index}`}>{new Date(item.at).toLocaleString()} · {item.action} · {item.versionId}</li>)}</ul></section>}
    <p>Gift, Mortgage, and other instruments will use this library after their approved templates and rendering contracts are onboarded.</p>
  </main>;
}
