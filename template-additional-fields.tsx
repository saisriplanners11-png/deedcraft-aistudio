import { IconButton } from './icon-button';
import { FileDropZone } from './file-drop-zone';
import React, { useEffect, useState } from 'react';
import type { Draft, Action } from './source-draft';
import type { TemplateFieldContract } from './template-fields';
import { fieldFingerprint, recordScope } from './template-fields';
import { templateSourceActive, type TemplateFieldInstance } from './template-field-values';
import { Input } from './ui';
import type { Field } from './fields';

function EvidenceFile({ file, page }: { file: File; page: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const url = URL.createObjectURL(file); setUrl(url); return () => URL.revokeObjectURL(url); }, [file]);
  return <a href={url + (/\.pdf$/i.test(file.name) && page > 0 ? `#page=${page}` : '')} target="_blank" rel="noopener noreferrer">Open original: {file.name}</a>;
}

export function TemplateAdditionalFields({ draft, contract, instances, dispatch, onExtract, onReadSaved, onCancel, sourceFiles, busy, message, filterScope, inline = false }: {
  draft: Draft; contract: TemplateFieldContract; instances: TemplateFieldInstance[]; dispatch: (action: Action) => void;
  onExtract: (files: File[], record: TemplateFieldInstance['record']) => void; onReadSaved: () => void;
  onCancel: () => void;
  sourceFiles: Record<string, File[]>;
  busy: boolean; message: string; filterScope?: string; inline?: boolean;
}) {
  const visible = instances.filter(instance => !filterScope || instance.record.scope === filterScope);
  if (!visible.length) return null;
  const groups = [...new Map(visible.map(instance => [instance.record.scope + ':' + instance.record.id, instance.record])).values()];
  return <section className={inline ? 'placed-template-field' : 'panel template-additional-fields'}>
    {!inline && <><h2>Additional template fields</h2><p>Enter values or upload evidence. AI proposals are used only after you accept them. Optional blank fields print as write-in spaces.</p>
    <button type="button" disabled={busy} onClick={onReadSaved}>Read new fields from saved documents</button>
    {busy && <button type="button" onClick={onCancel}>Cancel additional-field read</button>}
    {message && <p role="status">{message}</p>}</>}
    {groups.map(record => <div key={record.scope + ':' + record.id}>{inline ? <small className="placed-record-label">{record.label}</small> : <h3>{record.label}</h3>}
      {!inline && visible.some(instance => instance.record === record && instance.field.extractionEnabled) && <FileDropZone as="label">Upload evidence for {record.label}<input type="file" multiple disabled={busy} accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" onChange={event => { const files = [...(event.target.files || [])]; if (files.length) onExtract(files, record); event.target.value = ''; }} /></FileDropZone>}
      {visible.filter(instance => instance.record.scope === record.scope && instance.record.id === record.id).map(instance => {
        const field = instance.field;
        const proposals = draft.sources.filter(source => templateSourceActive(draft, source)).flatMap(source => (source.templateCandidates || []).filter(candidate => candidate.fieldId === field.id && candidate.recordId === record.id && candidate.fingerprint === fieldFingerprint(field)).map(candidate => ({ candidate, source, key: `${source.id}:${source.revision}:${candidate.id}` })));
        const update = (value: string) => dispatch({ type: 'template-field', fieldId: field.id, recordId: record.scope + ':' + record.id, value });
        const regularField: Field = { id: 'template-' + field.id, label: field.label + (field.required ? ' *' : ' (optional)'), ariaLabel: `${record.label} — ${field.label}`, type: field.existingPlaceholder ? 'text' : ({ currency: 'money', multiline: 'textarea', dropdown: 'select', boolean: 'select' } as const)[field.type] || field.type as Field['type'], derived: !!field.existingPlaceholder, options: field.type === 'boolean' ? ['true', 'false'] : field.options, optionLabels: field.type === 'boolean' ? { true: 'Yes', false: 'No' } : undefined, hint: field.help };
        return <div key={field.id} data-template-field={field.id} data-template-record={`${record.scope}:${record.id}`}>
          {inline ? <Input field={regularField} value={instance.value} onChange={update} /> : <>
          <label>{field.label}{field.required ? ' *' : ' (optional)'}{field.type === 'dropdown' || field.type === 'boolean' ? <select aria-label={`${record.label} — ${field.label}`} disabled={!!field.existingPlaceholder} value={instance.value} onChange={event => update(event.target.value)}><option value="">Choose value</option>{(field.type === 'boolean' ? ['true', 'false'] : field.options).map(value => <option key={value} value={value}>{field.type === 'boolean' ? value === 'true' ? 'Yes' : 'No' : value}</option>)}</select> : field.type === 'multiline' ? <textarea aria-label={`${record.label} — ${field.label}`} disabled={!!field.existingPlaceholder} value={instance.value} onChange={event => update(event.target.value)} /> : <input aria-label={`${record.label} — ${field.label}`} type={field.existingPlaceholder ? 'text' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} inputMode={field.type === 'currency' ? 'decimal' : undefined} disabled={!!field.existingPlaceholder} value={instance.value} onChange={event => update(event.target.value)} />}</label>
          {field.help && <small>{field.help}</small>}</>}{field.existingPlaceholder && <small>Uses existing field &lt;{field.existingPlaceholder}&gt;.</small>}
          {!field.existingPlaceholder && Object.prototype.hasOwnProperty.call(draft.templateFieldValues?.[field.id] || {}, record.scope + ':' + record.id) && <button type="button" onClick={() => dispatch({ type: 'template-field-clear', fieldId: field.id, recordId: record.scope + ':' + record.id })}>Clear manual override and use reviewed evidence</button>}
          {instance.error && <p role="alert">{instance.error}</p>}{instance.conflict && <p role="alert">Conflicting evidence exists. Reject the incorrect proposal or enter the current value manually.</p>}
          <details className="template-field-evidence" open={inline ? undefined : true}><summary>Evidence for {field.label} ({proposals.length})</summary>
          {inline && field.extractionEnabled && <><FileDropZone as="label">Upload evidence for {record.label}<input type="file" multiple disabled={busy} accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" onChange={event => { const files = [...(event.target.files || [])]; if (files.length) onExtract(files, record); event.target.value = ''; }} /></FileDropZone><button type="button" disabled={busy} onClick={onReadSaved}>Read new fields from saved documents</button></>}
          {proposals.map(({ candidate, source, key }) => <div className="template-evidence" key={key}><p><strong>{candidate.value}</strong> · {source.name} · {candidate.page > 0 ? `page ${candidate.page}` : 'document text'} · {candidate.region}</p><blockquote>{candidate.quote}</blockquote>{(sourceFiles[source.id] || []).map((file, index) => <p key={index}><EvidenceFile file={file} page={(sourceFiles[source.id] || []).length === 1 ? candidate.page : 0} /></p>)}<p>{candidate.issue || 'Independent reads agree; your review is still required.'}</p><p>Decision: {draft.templateFieldReviews?.[key] || 'Awaiting review'}</p><button type="button" disabled={!!candidate.issue || source.status !== 'done'} onClick={() => dispatch({ type: 'template-review', candidateKey: key, decision: 'accepted' })}>Accept value</button><button type="button" onClick={() => dispatch({ type: 'template-review', candidateKey: key, decision: 'rejected' })}>Reject value</button><button type="button" onClick={() => { dispatch({ type: 'template-review', candidateKey: key, decision: 'rejected' }); update(''); }}>Enter corrected value</button><IconButton label="Remove evidence source" onClick={() => dispatch({ type: 'remove', id: source.id })} /></div>)}</details>
        </div>;
      })}
    </div>)}
  </section>;
}
