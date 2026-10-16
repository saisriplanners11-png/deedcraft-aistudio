import React, { useId, useRef, useState } from 'react';
import { ArrowRight, CheckCheck, FileUp, LoaderCircle, ListChecks } from 'lucide-react';
import { STEPS } from './reference';
import type { MissingDetail } from './logic';

const ACCEPTED = /\.(pdf|docx|txt|md|jpe?g|png|webp|gif)$/i;
const ACCEPT = '.pdf,.docx,.txt,.md,image/jpeg,image/png,image/webp,image/gif';

/** Shared upload interaction; the native picker remains available without dragging. */
export function DocumentUpload({ label, busy = false, multiple = true, onUpload }: {
  label: string; busy?: boolean; multiple?: boolean; onUpload: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  function receive(files: File[]) {
    if (busy || !files.length) return;
    setError('');
    if ((!multiple && files.length > 1) || files.some(file => !ACCEPTED.test(file.name))) {
      setError(!multiple && files.length > 1 ? 'Choose one document for this section.' : 'Choose PDF, Word (.docx), text, JPG, PNG, WebP, or GIF files.');
      return;
    }
    onUpload(files);
  }
  return <div className={`link-upload document-upload${dragging && !busy ? ' is-dragging' : ''}`} aria-busy={busy}
    onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
    onDrop={event => { event.preventDefault(); setDragging(false); receive(Array.from(event.dataTransfer.files)); }}>
    <div className="upload-symbol" aria-hidden="true">{busy ? <LoaderCircle size={24} className="dc-spin" /> : <FileUp size={24} />}</div>
    <div className="upload-copy"><strong>{busy ? 'Reading and verifying your document…' : label}</strong><p id={hintId}>{busy ? 'You can keep editing while verification runs.' : `Drop ${multiple ? 'files' : 'a file'} here or choose ${multiple ? 'documents' : 'a document'}. You can also enter details below.`}</p><small>PDF, Word, images or text</small></div>
    <input ref={input} type="file" accept={ACCEPT} multiple={multiple} disabled={busy} hidden
      onChange={event => { receive(Array.from(event.target.files || [])); event.target.value = ''; }} />
    <button type="button" className="gold" disabled={busy} aria-describedby={hintId} onClick={() => input.current?.click()}>Choose file(s) or photo</button>
    {error && <p className="upload-error" role="alert">{error}</p>}
  </div>;
}

/** Readiness guidance uses the existing legal checks without changing download policy. */
export function ReviewIssues({ issues, onNavigate, compact = false, onNavigateIssue }: {
  issues: MissingDetail[]; onNavigate: (step: number) => void; compact?: boolean; onNavigateIssue?: (issue: MissingDetail) => void;
}) {
  const headingId = useId();
  const groups = STEPS.map(step => ({ step, items: issues.filter(item => item.step === step.id) })).filter(group => group.items.length);
  return <section className={`review-issues${compact ? ' compact' : ''}`} aria-labelledby={headingId}>
    <div className="review-intro"><span className="review-icon" aria-hidden="true">{issues.length ? <ListChecks size={24} /> : <CheckCheck size={24} />}</span><div><h2 id={headingId}>{issues.length ? 'Details to review' : 'No outstanding details'}</h2><p>{issues.length ? `${issues.length} ${issues.length === 1 ? 'item' : 'items'} across ${groups.length} ${groups.length === 1 ? 'section' : 'sections'}. Review each section before using the deed.` : 'The current checks are complete. Read the generated deed before using it.'}</p></div></div>
    {issues.length > 0 && <p className="review-draft-note">An incomplete draft can be downloaded where generation checks allow. Unresolved details still need your review.</p>}
    <div className="review-groups">{groups.map(({ step, items }) => <article className="review-group" key={step.id}>
      <div className="review-group-heading"><span className="review-step-number">{String(step.id + 1).padStart(2, '0')}</span><div><h3>{step.label}</h3><span>{items.length} {items.length === 1 ? 'detail' : 'details'} to review</span></div><button type="button" className="quiet" onClick={() => onNavigate(step.id)}>Review section <ArrowRight size={15} aria-hidden="true" /></button></div>
      {compact ? <p className="review-preview">{items.slice(0, 2).map(item => item.label).join(' · ')}{items.length > 2 ? ` · +${items.length - 2} more` : ''}</p> : <details><summary>Show {items.length === 1 ? 'detail' : 'details'} for this section</summary><ul>{items.map(item => <li key={item.id}><strong>{item.label}</strong><p>{item.reason}</p>{onNavigateIssue && item.id.startsWith('template:') && <button type="button" onClick={() => onNavigateIssue(item)}>Go to field</button>}{item.source && <small>Where to find it: {item.source}</small>}</li>)}</ul></details>}
    </article>)}</div>
  </section>;
}
