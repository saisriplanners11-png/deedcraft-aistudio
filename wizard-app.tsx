import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ALL_FIELDS, GROUPS, groupsForStep, LINK_OPTIONS, partyEntityFields, type PartyType } from './fields';
import { STEPS, DEEDS, DRAFTS, CATEGORIES } from './reference';
import {
  appStateFor, draftReducer, EXTRACTION_VERSION, fieldKey, newDraft,
  plansFor, resolveDraft, type Candidate, type Role, type Source, type SourceResult, WorkQueue,
} from './source-draft';
import { acreGuntasToSqYards, extractUpload, fileHash, type ExtractionProfile } from './upload-extraction';
import { fillSaleDeed, saveBlob, scheduleText, type ScheduleMerge } from './docx';
import { deedFilename, propertyForm, mergeValues, rewritesFor, scheduleMergesFor, variantFor } from './merge';
import { buildViewModel, generationBlockers, partyRecords, scheduleRecords, uppercasePartyIdentity } from './logic';
import { planPdf, planPng, registrationPlanSvg } from './registration-plan';
import { paymentPatchError, type Payment } from './payments';
import { C, Section, FieldGroup, Button, Empty, ExtractDialog, type ProgressStep } from './ui';
import { PaymentCard, AddPayment } from './paymentui';
import { PlanSketchStep } from './plan-sketch-step';
import './wizard-app.css';
import './plan-sketch.css';
import { DEED_DEFINITIONS, INSTRUMENT_IDS, definitionFor } from './instruments';
import { releaseGate } from './legal-registry';

// Raised from 4: Step 2 now lets a drafter add several document types (link
// deed, house tax, title deed, NALA, permissions) at once, and each upload
// should start extracting immediately rather than queueing behind the first
// four — actual API concurrency is still throttled downstream, in
// upload-extraction.ts's own apiQueue/pageQueue.
const fileQueue = new WorkQueue(10);
const ACCEPT = '.pdf,.docx,.txt,.md,image/jpeg,image/png,image/webp,image/gif';
const LINK_FIELDS = ['linkOption', ...LINK_OPTIONS.flatMap(o => o.fields.map(f => f.id))];
const PARTY_FIELDS: Record<'executant' | 'claimant', string[]> = {
  executant: ALL_FIELDS.filter(f => f.id.startsWith('executant')).map(f => f.id),
  claimant: ALL_FIELDS.filter(f => f.id.startsWith('claimant')).map(f => f.id),
};

type ExtractStep = { id?: string; title: string; state: 'queued' | 'running' | 'done' | 'review' | 'error' };
type PendingReview = { id: string; sourceName: string; assignment?: Source['assignment']; candidate: Candidate };

function reviewTarget(review: PendingReview) {
  const { candidate, assignment } = review;
  if (candidate.role === 'unassigned' && assignment && (assignment.role === 'executant' || assignment.role === 'claimant')) {
    return { role: assignment.role, record: assignment.record, field: candidate.field.replace(/^party/, assignment.role) };
  }
  if (candidate.role === 'unassigned') return null;
  return {
    role: candidate.role,
    record: candidate.role === 'property'
      ? assignment?.propertyRecord || candidate.record
      : assignment?.role === candidate.role ? assignment.record : candidate.record,
    field: candidate.field,
  };
}

/** A visible-but-disputed read must be confirmed before it enters the deed. */
function UnverifiedReviewDialog({ review, onConfirm, onDismiss }: {
  review: PendingReview | null;
  onConfirm: (review: PendingReview, value: string) => void;
  onDismiss: () => void;
}) {
  const [value, setValue] = useState('');
  useEffect(() => setValue(review?.candidate.value || ''), [review?.id]);
  if (!review) return null;
  const { candidate } = review;
  const target = reviewTarget(review);
  const label = ALL_FIELDS.find(field => field.id === candidate.field)?.label || candidate.field;
  return <div className="dc-veil" role="dialog" aria-modal="true" aria-labelledby="unverified-review-title"
    style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(22,19,15,.44)', backdropFilter: 'blur(2px)' }}>
    <div className="dc-card" style={{ width: 'min(540px,100%)', background: C.paper, border: `1px solid ${C.rule}`, boxShadow: '0 24px 60px rgba(22,19,15,.28)', padding: '22px 24px 20px' }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: C.gold }}>CONFIRM SOURCE READING</p>
      <h2 id="unverified-review-title" style={{ margin: '6px 0 8px', fontFamily: C.serif, fontSize: 21, color: C.ink }}>Verify {label}</h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.body, lineHeight: 1.55 }}>The automated reads disagreed. Check the source text before adding this value to the deed.</p>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: C.mutedSoft }}>{review.sourceName} · page {candidate.page || 'source'}</p>
      <blockquote style={{ margin: '0 0 14px', padding: '10px 12px', borderLeft: `3px solid ${C.goldLight}`, background: C.ground, fontSize: 12, lineHeight: 1.55 }}>{candidate.quote}</blockquote>
      <label style={{ display: 'block', fontSize: 12, color: C.body }}>Confirmed value
        <input autoFocus value={value} onChange={event => setValue(event.target.value)}
          style={{ display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 5, padding: '9px 10px', border: `1px solid ${C.goldLight}`, background: 'transparent', color: C.ink, fontSize: 14 }} />
      </label>
      {!target && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#8A3A2E' }}>This reading has no assigned deed role, so it cannot be added automatically.</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button kind="ghost" onClick={onDismiss}>Leave blank</Button>
        <Button kind="gold" disabled={!target || !value.trim()} onClick={() => onConfirm(review, value.trim())}>Confirm and use value</Button>
      </div>
    </div>
  </div>;
}

/** Keep failed and disputed reads visible after the progress indicator ends. */
function SourceFeedback({ sources, visibleFields }: { sources: Source[]; visibleFields?: string[] }) {
  return <>{sources.map(source => {
    // A link deed continues reading property pages after Step 2 is ready. The
    // card must never become an accidental preview of later wizard steps.
    const candidates = (source.result?.candidates || []).filter(candidate => !visibleFields || visibleFields.includes(candidate.field));
    const accepted = candidates.filter(c => c.status === 'accepted');
    const uncertain = candidates.filter(c => c.status === 'uncertain');
    return <div className="source" key={source.id} style={{ margin: '12px 0', fontSize: 12 }}>
      <strong>{source.name}</strong>
      {source.error && <p role="alert" style={{ color: '#a12828' }}>{source.error}</p>}
      {source.result && candidates.length > 0 && <>
        <p>{accepted.length} verified transcriptions · {uncertain.length} awaiting review{source.durationMs ? ` · ${Math.round(source.durationMs / 1000)}s` : ''}</p>
        {!!candidates.length && <details><summary>View extracted details and source pages</summary>
          <ul>{candidates.map(c => <li key={c.id}>
            {ALL_FIELDS.find(f => f.id === c.field)?.label || c.field}: {c.value} — page {c.page || 'metadata'}{c.status === 'uncertain' ? ' (unverified reading)' : ''}<blockquote>{c.quote}</blockquote>
          </li>)}</ul>
        </details>}

      </>}
      {source.result && !candidates.length && <p>No verified details found for these fields.</p>}
      {source.result && [...new Set(source.result.notes)].map(note => <p key={note}>{note}</p>)}
    </div>;
  })}</>;
}

type LinkStageStatus = 'loading' | 'error' | 'review' | 'done' | null;

/**
 * Kept at module scope so form edits do not change its React component type.
 * A component declared inside WizardApp is a new function on every render,
 * which remounts (and blurs) its input children after each keystroke.
 */
function LinkStageGate({ status, loading, children }: { status: LinkStageStatus; loading: string; children: React.ReactNode }) {
  return <>
    {status === 'loading' && <Empty>{loading} You can continue entering or correcting the fields below.</Empty>}
    {status === 'error' && <Empty>Automatic extraction could not finish for this step. You can enter the details manually.</Empty>}
    {status === 'review' && <Empty>Some extracted details need review. Confirm the visible values or enter them manually.</Empty>}
    {children}
  </>;
}

/** A section-scoped upload whose extraction is allowed to fill only that section. */
function ScopedSectionUpload({ label, busy, onUpload }: { label: string; busy?: boolean; onUpload: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <label className="link-upload" aria-disabled={busy}>
    <span>{busy ? 'Reading…' : `Upload document or images for ${label.toLowerCase()}`}</span>
    <input ref={input} type="file" accept={ACCEPT} multiple disabled={busy} hidden
      onChange={event => { const files = [...(event.target.files || [])]; if (files.length) onUpload(files); event.target.value = ''; }} />
    <button type="button" className="gold" disabled={busy} onClick={() => input.current?.click()}>Choose file(s) or photo</button>
  </label>;
}

/** The named passes a document goes through while it's being read, ticked off as each completes. */
/** One role-scoped field group, bound to a specific record through the draft's manual-edit dispatch. */
function RecordFieldGroup({
  role, record, category, step, resolved, edit, label, onDelete, deleteLabel,
}: {
  role: Role; record: string; category: string; step: number;
  resolved: ReturnType<typeof resolveDraft>; edit: (role: Role, record: string, field: string, value: string) => void;
  label?: string;
  /** When set, the first group renders a delete action for this whole record. */
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const groups = groupsForStep(step, category);
  if (!groups.length) return null;
  const form: Record<string, string> = {};
  // Most executants and claimants are individuals related as S/o, and nearly
  // every deed is registered in Telangana, so those pickers open on the
  // common choice instead of forcing a click on every party/property.
  const defaults: Record<string, string> = { [`${role}PartyType`]: 'Individual', [`${role}Relation`]: 'S/O', propState: 'Telangana' };
  // Extent (Sq. Meters) follows Extent (Sq. Yards) live, the same way it
  // already does when typed by hand — regardless of whether the yard figure
  // arrived by typing or by AI extraction from an uploaded property record.
  const sqYards = role === 'property' ? Number(resolved.values[fieldKey(role, record, 'extentSqYards')]) : NaN;
  const sqMeters = Number.isFinite(sqYards) && sqYards > 0 ? String(Math.round(sqYards * 0.836127 * 100) / 100) : '';
  for (const g of groups) for (const f of g.fields)
    form[f.id] = f.id === 'extentSqMeters' && sqMeters ? sqMeters
      : resolved.values[fieldKey(role, record, f.id)] || defaults[f.id] || '';
  return <>
    {groups.map(g => (
      <FieldGroup
        key={g.title}
        group={label ? { ...g, title: `${g.title} — ${label}` } : g}
        form={form}
        setField={(id, v) => edit(role, record, id, v)}
      />
    ))}
    {onDelete && <button className="quiet" onClick={onDelete} style={{ marginTop: 8 }}>{deleteLabel || 'Delete this record'}</button>}
  </>;
}

/**
 * Step 1's record card. Which of the five document types this is was chosen
 * once, at creation (via AddLinkDocument below) — the row stays that type.
 */
function LinkRecordCard({
  record, resolved, edit, label, onDelete, onUpload, busy, sources,
}: {
  record: string; resolved: ReturnType<typeof resolveDraft>;
  edit: (role: Role, record: string, field: string, value: string) => void;
  label?: string; onDelete?: () => void;
  onUpload: (files: File[]) => void;
  busy?: boolean;
  sources: Source[];
}) {
  const selectedId = resolved.values[fieldKey('link', record, 'linkOption')] || LINK_OPTIONS[0].id;
  const option = LINK_OPTIONS.find(o => o.id === selectedId) || LINK_OPTIONS[0];
  const form: Record<string, string> = {};
  // Square-yard equivalent follows the Acre-Guntas extent live, the same way
  // it already does when typed by hand — regardless of whether nalaExtent
  // arrived by typing or by AI extraction from an uploaded NALA order.
  const nalaExtent = resolved.values[fieldKey('link', record, 'nalaExtent')];
  const convertedExtent = nalaExtent ? acreGuntasToSqYards(nalaExtent) : null;
  for (const f of option.fields)
    form[f.id] = f.id === 'convertedExtentText' && convertedExtent !== null
      ? String(convertedExtent) : resolved.values[fieldKey('link', record, f.id)] || '';
  const input = useRef<HTMLInputElement>(null);
  return <section className="panel link-record">
    <h2>{option.label}{label ? ` — ${label}` : ''}</h2>
    <label className="link-upload" aria-disabled={busy}>
      <span>{busy ? 'Reading…' : `Upload this ${option.label.toLowerCase()} to fill the fields below`}</span>
      <input ref={input} type="file" accept={ACCEPT} multiple disabled={busy} hidden
        onChange={e => { const files = [...(e.target.files || [])]; if (files.length) onUpload(files); e.target.value = ''; }} />
      <button type="button" className="gold" disabled={busy} onClick={() => input.current?.click()}>Choose file(s) or photo</button>
    </label>
    <SourceFeedback sources={sources} visibleFields={option.id === 'linkDoc' ? ['linkDocType', 'linkDocNo', 'linkDocDate', 'linkSro'] : undefined} />
    <FieldGroup group={{ step: 1, title: option.label, note: option.note, fields: option.fields }} form={form} setField={(id, v) => edit('link', record, id, v)} />
    {onDelete && <button className="quiet" onClick={onDelete} style={{ marginTop: 8 }}>Delete this document</button>}
  </section>;
}

/** One blank preview card for a document type not yet added — its own upload button creates the row. */
function AddLinkDocumentCard({ option, onUpload }: { option: (typeof LINK_OPTIONS)[number]; onUpload: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const blankForm = Object.fromEntries(option.fields.map(f => [f.id, '']));
  return <section className="panel link-record">
    <h2>{option.label}</h2>
    <label className="link-upload">
      <span>{`Upload a ${option.label.toLowerCase()} to fill the fields below`}</span>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden
        onChange={e => { const files = [...(e.target.files || [])]; if (files.length) onUpload(files); e.target.value = ''; }} />
      <button type="button" className="gold" onClick={() => input.current?.click()}>Choose file(s) or photo</button>
    </label>
    <FieldGroup group={{ step: 1, title: option.label, telugu: option.telugu, note: option.note, fields: option.fields }} form={blankForm} setField={() => {}} />
  </section>;
}

/**
 * "+ Add / upload document": first pick which document type(s) are being
 * added — one or several at once (link deed + house tax + NALA, say) — then
 * only those chosen cards appear, each with its own upload button so a
 * different file goes straight into the matching card.
 */
function AddLinkDocument({ onAdd }: { onAdd: (optionId: string, files: File[]) => void }) {
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);

  if (chosen.length) {
    return <>
      <div className="add-document-row">
        <span>Upload each document into its matching card below.</span>
        <button className="quiet" onClick={() => { setChosen([]); setPicking(false); }}>Cancel all</button>
      </div>
      {chosen.map(id => {
        const option = LINK_OPTIONS.find(o => o.id === id)!;
        return <AddLinkDocumentCard key={id} option={option}
          onUpload={files => { onAdd(option.id, files); setChosen(c => c.filter(x => x !== id)); }} />;
      })}
    </>;
  }

  if (!picking) return <div className="add-document-row"><button className="primary" onClick={() => setPicking(true)}>+ Add / upload document</button></div>;

  return <MultiPicker
    onCancel={() => setPicking(false)}
    onContinue={ids => setChosen(ids)} />;
}

/** Checkbox-style tile picker for choosing one or several document types before any upload happens. */
function MultiPicker({ onContinue, onCancel }: { onContinue: (ids: string[]) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return <>
    <div className="add-document-row">
      <span>Which document(s) are you adding? Select as many as you have ready.</span>
      <button className="quiet" onClick={onCancel}>Cancel</button>
    </div>
    <div className="picker-grid">
      {LINK_OPTIONS.map(o => (
        <button key={o.id} type="button" className={`picker-tile${selected.includes(o.id) ? ' selected' : ''}`} onClick={() => toggle(o.id)}>
          <b>{o.label}</b>
        </button>
      ))}
    </div>
    <button className="primary" disabled={!selected.length} onClick={() => onContinue(selected)} style={{ marginTop: 10 }}>
      Continue with {selected.length || 0} document{selected.length === 1 ? '' : 's'}
    </button>
  </>;
}

/**
 * One executant/claimant record's own Aadhaar/ID upload box, sitting above its
 * field group so a photo or scan fills that specific person's fields — never a
 * different record's — the same way LinkRecordCard scopes an upload to one row.
 */
function PartyRecordCard({
  role, record, category, step, resolved, edit, label, onDelete, onUpload, busy, sources,
}: {
  role: Role; record: string; category: string; step: number;
  resolved: ReturnType<typeof resolveDraft>; edit: (role: Role, record: string, field: string, value: string) => void;
  label?: string; onDelete?: () => void;
  onUpload: (files: File[]) => void;
  busy?: boolean;
  sources: Source[];
}) {
  const noun = role === 'executant' ? 'executant' : 'claimant';
  const input = useRef<HTMLInputElement>(null);
  const partyType = (resolved.values[fieldKey(role, record, `${role}PartyType`)] || 'Individual') as PartyType;
  const entityFields = partyType === 'Individual' ? [] : partyEntityFields(role as 'executant' | 'claimant', partyType);
  const entityForm = Object.fromEntries(entityFields.map(field => [field.id, resolved.values[fieldKey(role, record, field.id)] || '']));
  const entityTitle = partyType === 'Firm / LLP' ? 'Firm / LLP details'
    : partyType === 'Society / Trust' ? 'Registered society / trust details'
    : partyType === 'Company' ? 'Company details' : 'Other entity / HUF details';
  return <>
    <Section title={`Upload party document${label ? ` — ${label}` : ''}`} telugu="పార్టీ పత్రం అప్‌లోడ్">
      <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body }}>
        Upload the {noun}'s Aadhaar/ID proof, or the entity’s registration, incorporation, deed, resolution or authorization. Front and back may be uploaded separately. Only visibly supported identity, entity, authorization and address details are filled; anything not printed stays blank for review.
      </p>
      <label className="link-upload" aria-disabled={busy}>
        <span>{busy ? 'Reading…' : 'Upload party / entity document'}</span>
        <input ref={input} type="file" accept={ACCEPT} multiple disabled={busy} hidden
          onChange={e => { const files = [...(e.target.files || [])]; if (files.length) onUpload(files); e.target.value = ''; }} />
        <button type="button" className="gold" disabled={busy} onClick={() => input.current?.click()}>Choose file(s) or photo</button>
      </label>
      <SourceFeedback sources={sources} />
    </Section>
    <RecordFieldGroup role={role} record={record} category={category} step={step} resolved={resolved} edit={edit} label={label}
      onDelete={onDelete} deleteLabel={`Delete this ${noun}`} />
    {entityFields.length > 0 && <FieldGroup
      group={{ step, title: entityTitle, note: 'These particulars identify the legal entity. The individual details above are the authorized signatory / representative.', fields: entityFields }}
      form={entityForm}
      setField={(id, value) => edit(role, record, id, value)}
    />}
  </>;
}

/** Below the executant/claimant list: upload another ID to add a second (or third) party, or add one blank to type in by hand. */
function AddPartyRecord({ noun, onAdd }: { noun: string; onAdd: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="add-document-row">
    <span>Add another {noun.toLowerCase()}</span>
    <input ref={input} type="file" accept={ACCEPT} multiple hidden
      onChange={e => { const files = [...(e.target.files || [])]; onAdd(files); e.target.value = ''; }} />
    <button type="button" className="primary" onClick={() => input.current?.click()}>+ Upload document for another {noun.toLowerCase()}</button>
    <button className="quiet" onClick={() => onAdd([])}>Add blank {noun.toLowerCase()} instead</button>
  </div>;
}

/** The real template SCHEDULE OF PROPERTY paragraph, loaded live for one property record. */
function SchedulePreview({ merge }: { merge: ScheduleMerge }) {
  const [text, setText] = useState<string>('');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    scheduleText(merge.variant, merge.values, merge.supportingRecords).then(t => { if (live) setText(t); }, e => { if (live) setError(e.message || String(e)); });
    return () => { live = false; };
  }, [merge.variant, JSON.stringify(merge.values)]);
  if (error) return <p style={{ color: C.gold, fontSize: 12 }}>{error}</p>;
  if (!text) return <p style={{ color: C.mutedSoft, fontSize: 12 }}>Loading the schedule paragraph…</p>;
  return <div style={{ fontFamily: C.serif, fontSize: 13, lineHeight: 1.7, color: C.ink, whiteSpace: 'pre-wrap' }}>{text}</div>;
}

/** One compact, schedule-scoped type choice. It appears only until the type is
 * known; afterwards the user sees context, not the same question again. */
function ScheduleTypeControl({ scheduleNumber, category, onChange }: { scheduleNumber: number; category: string; onChange: (category: string) => void }) {
  const [changing, setChanging] = useState(false);
  const selected = CATEGORIES.find(item => item.key === category);
  if (selected && !changing) return <div className="add-document-row" aria-label={`Schedule ${scheduleNumber} property type`}>
    <span><b>Schedule {scheduleNumber}</b> · {selected.label}</span>
    <button type="button" className="quiet" onClick={() => setChanging(true)}>Change type</button>
  </div>;
  return <div className="add-document-row" aria-label={`Schedule ${scheduleNumber} property type`}>
    <label className="field"><span>What is this property?</span>
      <select value={category} onChange={event => { onChange(event.target.value); setChanging(false); }}>
        <option value="">Choose property type</option>
        {CATEGORIES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select>
    </label>
    {selected && <span style={{ fontSize: 12, color: C.muted }}>Changing type may change the fields required for this schedule.</span>}
  </div>;
}

function ScheduleSwitcher({ records, activeId, onSelect }: { records: ReturnType<typeof scheduleRecords>; activeId: string; onSelect: (id: string) => void }) {
  if (records.length < 2) return null;
  return <div className="add-document-row" aria-label="Property schedules">
    {records.map((record, index) => <button key={record.id} type="button" className={record.id === activeId ? 'primary' : 'quiet'} onClick={() => onSelect(record.id)}>
      Schedule {index + 1}{record.category ? ` · ${record.category}` : ''}
    </button>)}
  </div>;
}

/** Values which are visible in a source but did not pass automatic consensus
 * can only become deed data through an explicit drafter action. */
function ReviewQueue({ sources, record, edit }: { sources: Source[]; record: string; edit: (role: Role, record: string, field: string, value: string) => void }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const candidates = sources.flatMap(source => (source.result?.candidates || []).map(candidate => ({ source, candidate })))
    .filter(({ candidate }) => candidate.status === 'uncertain' && candidate.role === 'property' && !dismissed.includes(candidate.id));
  if (!candidates.length) return null;
  return <Section title="Review visible source details">
    <p style={{ margin: '0 0 12px', fontSize: 12, color: C.body }}>These details were read from the source but did not pass automatic verification. Confirm only what you can see in the quoted source.</p>
    {candidates.map(({ source, candidate }) => <div key={`${source.id}:${candidate.id}`} className="source" style={{ margin: '8px 0' }}>
      <strong>{ALL_FIELDS.find(field => field.id === candidate.field)?.label || candidate.field}: {candidate.value}</strong>
      <small> · {source.name}, page {candidate.page || 'source'}</small>
      <blockquote>{candidate.quote}</blockquote>
      <button type="button" className="quiet" onClick={() => edit('property', record, candidate.field, candidate.value)}>Use this value</button>{' '}
      <button type="button" className="quiet" onClick={() => edit('property', record, candidate.field, '')}>Edit / clear</button>{' '}
      <button type="button" className="quiet" onClick={() => setDismissed(ids => [...ids, candidate.id])}>Leave blank</button>
    </div>)}
  </Section>;
}

export default function WizardApp() {
  const [draft, dispatch] = useReducer(draftReducer, undefined, newDraft);
  const current = useRef(draft); current.current = draft;
  const controllers = useRef(new Map<string, AbortController>());
  const cache = useRef(new Map<string, Promise<SourceResult>>());
  const [uploadSteps, setUploadSteps] = useState<Record<string, ExtractStep[]>>({});
  const [activeUpload, setActiveUpload] = useState<{ id: string; label: string; names: string[] } | null>(null);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  // Record ids added via "Add another executant/claimant" before any evidence names them —
  // resolveDraft only lists a record once it has a value, so a freshly added blank/uploading
  // row would otherwise vanish from the step until its first field resolves.
  const [extraPartyRecords, setExtraPartyRecords] = useState<{ executant: string[]; claimant: string[] }>({ executant: [], claimant: [] });
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [download, setDownload] = useState<{ revision: number; draftId: string; docx: Blob; pdf: Blob; filename: string } | null>(null);
  const state = useMemo(() => appStateFor(draft), [draft]);
  const resolved = useMemo(() => resolveDraft(draft), [draft]);
  // Read-only: only its pure-derived numbers (checks, pct, conversions) are used below.
  // Every real edit goes through `dispatch`/`edit`, never this setter.
  const vm = useMemo(() => buildViewModel(state, () => {}), [state]);
  const notices = [...generationBlockers(state), ...(draft.sources.some(s=>s.status==='reading'||s.status==='queued') ? [{id:'pending-uploads',label:'Document verification',reason:'Wait for all uploads to finish verification.',source:'Uploaded documents',step:1}] : [])];
  const recordOptions = (role: Role) => [...new Set(Object.keys(resolved.values).filter(k => k.startsWith(role + '|')).map(k => k.split('|')[1]))];
  const step = draft.step;
  const deedDefinition = definitionFor(draft.instrumentId);
  const deedRelease = releaseGate(draft.instrumentId, draft.variantId);
  const generationReady = deedRelease.ready;
  const goto = (s: number) => dispatch({ type: 'step', step: s });
  const edit = (role: Role, record: string, field: string, value: string) => {
    value = uppercasePartyIdentity(field, value);
    if (field === 'consid') {
      const consideration = Number(value);
      const paid = state.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      if (Number.isFinite(consideration) && consideration < paid) {
        setMessage(`Sale consideration cannot be lower than the already recorded payments (₹${paid.toLocaleString('en-IN')}).`);
        return;
      }
    }
    // Extent (Sq. Meters) and NALA's square-yard equivalent are computed live
    // for display (see RecordFieldGroup/LinkRecordCard) straight from their
    // source figure, whichever way it arrived — no mirrored write needed here.
    // Link-document SRO fields mirror the registering office for this property,
    // so the Schedule's Registration Sub-District can never diverge.
    if (field === 'sro' && role === 'property') {
      for (const linkRecord of recordOptions('link').filter(linkRecord =>
        (draft.linkPropertyRecords[linkRecord]
          || draft.sources.find(source => source.assignment?.role === 'link' && source.assignment.record === linkRecord)?.assignment?.propertyRecord
          || 'primary') === record
      )) {
        dispatch({ type: 'manual', key: fieldKey('link', linkRecord, 'linkSro'), value });
        dispatch({ type: 'manual', key: fieldKey('link', linkRecord, 'linkSroCode'), value });
      }
    }
    dispatch({ type: 'manual', key: fieldKey(role, record, field), value });
  };

  useEffect(() => () => { controllers.current.forEach(c => c.abort()); }, []);

  /** Reads one ordered source bundle, binding it to one record so it never spills into another. */
  async function runUpload(files: File[], assignment?: { role: Role; record: string; propertyRecord?: string }, profile: ExtractionProfile = 'general') {
    if (!files.length) return;
    const sourceId = crypto.randomUUID();
    const draftId = current.current.id;
    controllers.current.get(sourceId)?.abort();
    const controller = new AbortController(); controllers.current.set(sourceId, controller);
    const option = profile.startsWith('phase1:') ? LINK_OPTIONS.find(item => item.id === profile.slice('phase1:'.length)) : undefined;
    setActiveUpload({
      id: sourceId,
      label: option?.label || (assignment?.role === 'executant' ? 'Executant ID' : assignment?.role === 'claimant' ? 'Claimant ID' : 'Document'),
      names: files.map(file => file.name),
    });
    const valid = () => !controller.signal.aborted && current.current.id === draftId;
    const job = (patch: any) => dispatch({ type: 'job', draftId, sourceId, sourceRevision: 0, patch });
    dispatch({ type: 'add', source: { id: sourceId, revision: 0, name: files.map(file => file.name).join(' · '), hash: '', status: 'queued', assignment, profile } });
    setUploadSteps(s => ({ ...s, [sourceId]: [] }));
    const started = performance.now();
    try {
      await fileQueue.run(async () => {
        if (!valid()) return;
        job({ status: 'reading' });
        const hash = await fileHash(files);
        if (!valid()) return;
        job({ hash });
        const key = `${draftId}:${hash}:${EXTRACTION_VERSION}:${profile}`;
        let result: SourceResult;
        if (cache.current.has(key)) result = await cache.current.get(key)!;
        else {
          result = await extractUpload(files, controller.signal, event => {
            if (!valid()) return;
            // Link-deed page 1/2 verification is the foreground task. Once
            // it settles, the property-page workers keep running without a
            // modal blocking the drafter in Step 2.
            if (typeof event !== 'string' && profile === 'phase1:linkDoc' && event.id === 'step2' && (event.state === 'done' || event.state === 'review')) {
              setActiveUpload(active => active?.id === sourceId ? null : active);
            }
            setUploadSteps(s => {
              const steps = s[sourceId] || [];
              if (typeof event === 'string') return { ...s, [sourceId]: [...steps, { title: event, state: 'running' as const }] };
              const index = steps.findIndex(step => step.id === event.id);
              return { ...s, [sourceId]: index < 0 ? [...steps, event] : steps.map((step,i) => i === index ? event : step) };
            });
          }, result => { if (valid()) job({ result }); }, profile);
          if (valid() && result.candidates.length > 0 && result.candidates.every(c => c.status === 'accepted') && result.notes.length === 0) cache.current.set(key, Promise.resolve(result));
        }
        if (valid()) {
          setUploadSteps(s => ({ ...s, [sourceId]: (s[sourceId] || []).map(step => step.state === 'running' ? { ...step, state: 'done' as const } : step) }));
          job({ status: 'done', result, durationMs: performance.now() - started, error: undefined });
          const uncertain = result.candidates.filter(candidate => candidate.status === 'uncertain');
          if (uncertain.length) setPendingReviews(queue => [...queue, ...uncertain.map(candidate => ({
            id: `${sourceId}:${candidate.id}`, sourceName: files.map(file => file.name).join(' · '), assignment, candidate,
          }))]);
        }
      });
    } catch (error: any) {
      if (valid()) {
        setUploadSteps(s=>({...s,[sourceId]:(s[sourceId]||[]).map(step=>step.state==='running'||step.state==='queued'?{...step,state:'error' as const}:step)}));
        job({ status: 'error', error: error.message || 'This upload could not be read.' });
      }
    } finally {
      controllers.current.delete(sourceId);
    }
  }
  const uploadFor = (role: Role, record: string, profile?: ExtractionProfile, propertyRecord = activePropertyId) => (files: File[]) => {
    const scoped = profile || (role === 'executant' ? 'party:executant' : role === 'claimant' ? 'party:claimant' : 'general');
    if (scoped === 'phase1:linkDoc' || scoped === 'jurisdiction' || scoped === 'property-schedule') {
      void runUpload(files, { role, record, ...(role === 'link' ? { propertyRecord } : {}) }, scoped);
    } else {
      for (const file of files) void runUpload([file], { role, record, ...(role === 'link' ? { propertyRecord } : {}) }, scoped);
    }
  };
  const sourceBusyFor = (role: Role, record: string) => draft.sources.find(s => s.assignment?.role === role && s.assignment?.record === record && (s.status === 'reading' || s.status === 'queued'));
  const linkStageStatus = (stageId: string, propertyRecord = activePropertyId): LinkStageStatus => {
    const states = draft.sources
      .filter(source => source.assignment?.role === 'link' && (source.assignment.propertyRecord || 'primary') === propertyRecord)
      .map(source => (uploadSteps[source.id] || []).find(stage => stage.id === stageId)?.state)
      .filter((state): state is ExtractStep['state'] => !!state);
    if (!states.length) return null;
    if (states.some(state => state === 'running' || state === 'queued')) return 'loading';
    if (states.some(state => state === 'error')) return 'error';
    if (states.some(state => state === 'review')) return 'review';
    return 'done';
  };
  /** A selected Link Deed bundle becomes one record; other document types keep one record per file. */
  const addLinkDocuments = (optionId: string, files: File[]) => {
    if (!files.length) { const record = crypto.randomUUID(); dispatch({ type: 'link-property', record, propertyId: activePropertyId }); edit('link', record, 'linkOption', optionId); return; }
    if (optionId === 'linkDoc') {
      const record = crypto.randomUUID();
      dispatch({ type: 'link-property', record, propertyId: activePropertyId });
      edit('link', record, 'linkOption', optionId);
      void runUpload(files, { role: 'link', record, propertyRecord: activePropertyId }, 'phase1:linkDoc');
      return;
    }
    for (const file of files) {
      const record = crypto.randomUUID();
      dispatch({ type: 'link-property', record, propertyId: activePropertyId });
      edit('link', record, 'linkOption', optionId);
      void runUpload([file], { role: 'link', record, propertyRecord: activePropertyId }, `phase1:${optionId}` as ExtractionProfile);
    }
  };
  /** Every executant/claimant record worth a card: those resolved from evidence/manual entry (or 'primary' when there are none yet), plus any just added and still waiting on their first upload. */
  const partyRecordIds = (role: 'executant' | 'claimant') => {
    const base = recordOptions(role).length ? recordOptions(role) : ['primary'];
    return [...base, ...extraPartyRecords[role].filter(r => !base.includes(r))];
  };
  /** One new row per uploaded ID (each is its own person); no files chosen still creates one blank row to type into. */
  const addPartyRecord = (role: 'executant' | 'claimant') => (files: File[]) => {
    if (!files.length) { const record = crypto.randomUUID(); setExtraPartyRecords(s => ({ ...s, [role]: [...s[role], record] })); return; }
    for (const file of files) {
      const record = crypto.randomUUID();
      setExtraPartyRecords(s => ({ ...s, [role]: [...s[role], record] }));
      // Extra people use the same identity-only profile as the primary card.  A
      // generic extraction here used to discard address/identity candidates
      // during profile filtering, leaving this newly added card blank.
      void runUpload([file], { role, record }, role === 'executant' ? 'party:executant' : 'party:claimant');
    }
  };
  const clearPartyRecord = (role: 'executant' | 'claimant', record: string) => {
    for (const field of PARTY_FIELDS[role]) edit(role, record, field, '');
    setExtraPartyRecords(s => ({ ...s, [role]: s[role].filter(r => r !== record) }));
  };

  const activeSource = activeUpload ? draft.sources.find(source => source.id === activeUpload.id) : undefined;
  const activeSteps: ProgressStep[] = (activeUpload ? uploadSteps[activeUpload.id] : []).map(step => ({
    title: step.title,
    state: step.state === 'done' || step.state === 'review' ? 'done' : step.state === 'running' ? 'running' : 'pending',
    filled: step.state === 'done' ? activeSource?.result?.candidates.filter(candidate => candidate.status === 'accepted').length : undefined,
  }));
  const activeResult = activeSource?.status === 'done'
    ? `${activeSource.result?.candidates.filter(candidate => candidate.status === 'accepted').length || 0} verified detail${(activeSource.result?.candidates.filter(candidate => candidate.status === 'accepted').length || 0) === 1 ? '' : 's'} filled`
    : '';
  const cancelActiveUpload = () => {
    if (!activeUpload || !activeSource) return;
    controllers.current.get(activeUpload.id)?.abort();
    dispatch({ type: 'job', draftId: draft.id, sourceId: activeSource.id, sourceRevision: activeSource.revision, patch: { status: 'error', error: 'Reading cancelled.' } });
    setUploadSteps(steps => ({ ...steps, [activeUpload.id]: (steps[activeUpload.id] || []).map(step => step.state === 'running' || step.state === 'queued' ? { ...step, state: 'error' } : step) }));
  };

  useEffect(() => { setDownload(null); setMessage(''); }, [draft.id, draft.revision]);

  function reset() {
    controllers.current.forEach(c => c.abort()); controllers.current.clear(); cache.current.clear();
    setUploadSteps({}); setDownload(null); setMessage(''); setExtraPartyRecords({ executant: [], claimant: [] }); dispatch({ type: 'reset' });
  }

  const propertyIds = [...new Set(['primary', ...draft.propertyIds, ...Object.keys(resolved.values).filter(k => k.startsWith('property|') && !k.startsWith('property|transaction|')).map(k => k.split('|')[1])])];
  const activePropertyId = propertyIds.includes(draft.activePropertyId) ? draft.activePropertyId : 'primary';
  const activePropertyIndex = propertyIds.indexOf(activePropertyId);
  const propertyRecords = scheduleRecords(state);
  const combinedMarketStatus: LinkStageStatus = (() => {
    const states = propertyRecords.map(record => linkStageStatus('step5', record.id));
    if (states.includes('loading')) return 'loading';
    if (states.includes('error')) return 'error';
    if (states.includes('review')) return 'review';
    return states.some(Boolean) ? 'done' : null;
  })();
  const executantRecords = partyRecords(state, 'executant');
  const claimantRecords = partyRecords(state, 'claimant');

  const previews = propertyRecords.map((record) => {
    const id = record.id;
    const plans = plansFor(draft, id);
    const unique = [...new Map(plans.map(plan => [JSON.stringify(plan.drawing), plan])).values()];
    const form: Record<string, string> = { ...propertyForm(state, record.values), category: record.category };
    const values = mergeValues({ ...state, form, unit: record.unit, additionalSchedules: [] });
    form.extentSqYards = values['Extent in Sq.yards']; form.extentSqMeters = values['Extent in Sq.Meters'];
    try {
      return {
        id, svg: registrationPlanSvg(form, unique.length === 1 ? unique[0].drawing : null, { vendors: executantRecords.map(r => r.values), buyers: claimantRecords.map(r => r.values) }),
        note: unique.length > 1 ? 'Several plans disagree. Remove or replace the superseded plan; the drawing remains blank.' : unique.length === 0 ? 'No plan drawing entered yet; the drawing remains blank.' : unique[0].linked ? 'Drawing from the linked deed.' : 'Drawing from the uploaded plan.',
        error: '',
      };
    } catch (error: any) { return { id, svg: '', note: '', error: error.message }; }
  });
  const scheduleMerges = scheduleMergesFor(state);
  const activeScheduleMerge = scheduleMerges[activePropertyIndex];

  async function generate(kind: 'word' | 'pdf') {
    const snapshot = draft; setExporting(true); setMessage('');
    try {
      if (!deedRelease.ready) throw new Error(deedRelease.reasons.join(' '));
      let artifact = download?.draftId === snapshot.id && download.revision === snapshot.revision ? download : null;
      if (!artifact) {
        if (previews.some(p => p.error)) throw new Error(previews.find(p => p.error)!.error);
        const pngs = await Promise.all(previews.map(p => planPng(p.svg)));
        const merged = await fillSaleDeed(mergeValues(state), variantFor(state.category), rewritesFor(state), scheduleMerges, pngs);
        const pdf = await planPdf(pngs);
        artifact = { draftId: snapshot.id, revision: snapshot.revision, docx: merged.blob, pdf, filename: deedFilename(state) };
      }
      setDownload(artifact);
      saveBlob(kind === 'word' ? artifact.docx : artifact.pdf, kind === 'word' ? artifact.filename : artifact.filename.replace(/\.docx$/, '-plan.pdf'));
      setMessage(notices.length ? `Downloaded an incomplete draft with ${notices.length} outstanding items. Review and complete it before signing or registration.` : 'Downloaded using the current verified and manually entered details.');
    } catch (error: any) { setMessage(`Download could not be prepared: ${error.message}. Please retry.`); }
    finally { setExporting(false); }
  }

  const patchPayment = (record: string, patch: Partial<Payment>) => {
    const error = paymentPatchError(state.payments, record, patch, state.form.consid);
    if (error) { setMessage(error); return false; }
    for (const [key, value] of Object.entries(patch)) {
      const str = Array.isArray(value) ? value.join(',') : typeof value === 'boolean' ? (value ? 'true' : '') : String(value ?? '');
      edit('payment', record, key, str);
    }
    return true;
  };
  const addPayment = (mode: Payment['mode']) => {
    const record = `payment-${Date.now()}`;
    edit('payment', record, 'mode', mode);
    if (Number.isFinite(vm.balanceN) && vm.balanceN > 0) edit('payment', record, 'amount', String(Math.round(vm.balanceN)));
  };
  const removePayment = (record: string) => {
    for (const key of ['mode', 'amount', 'refNo', 'bank', 'branch', 'date', 'payer', 'payee', 'advance', 'tds', 'filled', 'docName']) edit('payment', record, key, '');
  };
  const clearLinkRecord = (record: string) => { for (const field of LINK_FIELDS) edit('link', record, field, ''); };
  const propertyForLinkRecord = (record: string) => draft.linkPropertyRecords[record]
    || draft.sources.find(source => source.assignment?.role === 'link' && source.assignment.record === record)?.assignment?.propertyRecord
    || 'primary';
  const addProperty = () => {
    const id = crypto.randomUUID();
    dispatch({ type: 'add-property', id });
    goto(1);
  };
  const confirmUnverified = (review: PendingReview, value: string) => {
    const target = reviewTarget(review);
    if (target) edit(target.role, target.record, target.field, value);
    setPendingReviews(queue => queue.filter(item => item.id !== review.id));
  };
  const dismissUnverified = () => setPendingReviews(queue => queue.slice(1));

  return <div className="wizard-app">
    <ExtractDialog
      open={!!activeUpload}
      label={activeUpload?.label || 'Document'}
      fileNames={activeUpload?.names || []}
      steps={activeSteps.length ? activeSteps : [{ title: 'Preparing document', state: 'running' }]}
      error={activeSource?.error || ''}
      result={activeResult}
      onClose={() => setActiveUpload(null)}
      onCancel={cancelActiveUpload}
    />
    <UnverifiedReviewDialog review={pendingReviews[0] || null} onConfirm={confirmUnverified} onDismiss={dismissUnverified} />
    <header className="app-top"><a href="#" className="brand">DeedCraft <span>MULTI-INSTRUMENT</span></a><button className="quiet" onClick={reset}>New deed</button></header>
    <div className="shell">
      <nav className="rail" aria-label="Deed steps">
        <button className={`rail-overview${step === -1 ? ' active' : ''}`} onClick={() => goto(-1)}>Overview</button>
        {[1, 2, 3, 4].map(phase => <div className="rail-phase" key={phase}>
          <span className="rail-phase-label">Phase {phase}</span>
          {STEPS.filter(s => s.phase === phase).map(s => (
            <button key={s.id} className={`rail-step${step === s.id ? ' active' : ''}${vm.doneIds.includes(s.id) ? ' done' : ''}`} onClick={() => goto(s.id)}>
              <b>{String(s.id + 1).padStart(2, '0')}</b>
              <span><em>{s.label}</em><small>{s.sub}</small></span>
            </button>
          ))}
        </div>)}
      </nav>

      <main className="stage">
        <div className="stage-head">
          <p className="eyebrow">{step < 0 ? 'OVERVIEW' : `STEP ${step + 1} OF ${STEPS.length}`}</p>
          <h1>{step < 0 ? `DeedCraft — ${deedDefinition.label}` : STEPS[step].label}</h1>
          {step >= 0 && <p>{STEPS[step].sub}</p>}
        </div>

        {step === -1 && <section className="panel overview">
          <h2>Readiness</h2>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${vm.pct}%` }} /></div>
          <p>{vm.filled} of {vm.applicableCount} applicable fields entered · {vm.openCount} readiness check{vm.openCount === 1 ? '' : 's'} open</p>
          <div className="overview-grid">{STEPS.map(s => (
            <button key={s.id} className={`overview-card${vm.doneIds.includes(s.id) ? ' done' : ''}`} onClick={() => goto(s.id)}>
              <b>{String(s.id + 1).padStart(2, '0')}</b>
              <span>{s.label}</span>
              <em>{s.id === 10 ? 'Beta — optional' : vm.doneIds.includes(s.id) ? '✓ Done' : 'Open'}</em>
            </button>
          ))}</div>
          <h2>Readiness checks</h2>
          <ul className="checks">{vm.checks.map((c: any) => <li key={c.label} className={c.ok ? 'ok' : ''}><span className="mark">{c.mark}</span><span><b>{c.label}</b><small>{c.note}</small></span></li>)}</ul>
          <Button kind="solid" onClick={() => goto(0)}>Start at Step 01 →</Button>
        </section>}

        {step === 0 && <section className="panel">
          <Section title="Deed type" telugu="దస్తావేజు రకం">
            <p style={{ margin: '0 0 14px', fontSize: 12, color: C.body }}>Choose the legal instrument. Generation opens only when an effective, professionally approved reference template has been registered.</p>
            <div className="picker-grid">{INSTRUMENT_IDS.map(id => {
              const definition = DEED_DEFINITIONS[id];
              const ready = releaseGate(id).ready;
              return <button key={id} type="button" className={`picker-tile${draft.instrumentId === id ? ' selected' : ''}`} onClick={() => dispatch({ type: 'instrument', instrumentId: id })}>
                <b>{definition.label}</b><em>{ready ? 'Approved reference available' : 'Reference required'}</em>
              </button>;
            })}</div>
          </Section>
          <Section title="Draft form" telugu="ముసాయిదా రూపం">
            <div className="picker-grid">{deedDefinition.variants.map(variant => (
              <button key={variant.id} type="button" className={`picker-tile${draft.variantId === variant.id ? ' selected' : ''}`} onClick={() => dispatch({ type: 'instrument', instrumentId: draft.instrumentId, variantId: variant.id })}>
                <b>{variant.label}</b><em>{releaseGate(draft.instrumentId, variant.id).ready ? 'Approved for drafting' : 'Awaiting approved reference'}</em>
              </button>
            ))}</div>
            {!deedRelease.ready && <Empty>Legal reference onboarding required. {deedRelease.reasons.join(' ')}</Empty>}
          </Section>
        </section>}

        {step === 1 && (() => {
          const records = recordOptions('link').filter(record => propertyForLinkRecord(record) === activePropertyId);
          const multipleProperties = propertyRecords.length > 1;
          const activeProperty = propertyRecords.find(record => record.id === activePropertyId);
          const category = activeProperty?.category || '';
          return <>
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onSelect={id => dispatch({ type: 'active-property', id })} />
          <section className="panel"><ScheduleTypeControl scheduleNumber={activePropertyIndex + 1} category={category} onChange={value => edit('property', activePropertyId, 'category', value)} /></section>
          {!category ? <Empty>Choose this schedule's property type to add its documents.</Empty> : <>
          <section className="panel"><h2>{multipleProperties ? `Documents for Property ${activePropertyIndex + 1}` : 'Property documents'}</h2><p>Upload only the link deeds, receipts and property records for this schedule. These documents cannot alter another property’s extracted details.</p></section>
          {records.length === 0 && <Empty>No documents added{multipleProperties ? ` for Property ${activePropertyIndex + 1}` : ''} yet — click below to add one.</Empty>}
          {records.map((record, i, all) => {
            const busySource = sourceBusyFor('link', record);
            const optionId = resolved.values[fieldKey('link', record, 'linkOption')] || LINK_OPTIONS[0].id;
            return <LinkRecordCard key={record} record={record} resolved={resolved} edit={edit}
              label={all.length > 1 ? `Document ${i + 1}` : undefined}
              onDelete={() => clearLinkRecord(record)}
              onUpload={uploadFor('link', record, `phase1:${optionId}` as ExtractionProfile)}
              sources={draft.sources.filter(s => s.assignment?.role === 'link' && s.assignment.record === record && (s.assignment.propertyRecord || 'primary') === activePropertyId)}
              busy={!!busySource} />;
          })}
          <AddLinkDocument onAdd={addLinkDocuments} />
          </>}
        </>;
        })()}

        {step === 2 && <LinkStageGate status={linkStageStatus('step3')} loading="Extracting jurisdiction from the property documents…">
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onSelect={id => dispatch({ type: 'active-property', id })} />
          <ScopedSectionUpload label="Jurisdiction" busy={!!sourceBusyFor('property', activePropertyId)} onUpload={files => void runUpload(files, { role: 'property', record: activePropertyId }, 'jurisdiction')} />
          <SourceFeedback sources={draft.sources.filter(source => source.profile === 'jurisdiction' && source.assignment?.record === activePropertyId)} visibleFields={GROUPS.filter(group => group.step === 2).flatMap(group => group.fields.map(field => field.id))} />
          <section className="panel"><h2>{propertyRecords.length > 1 ? `Property ${activePropertyIndex + 1} — Jurisdiction` : 'Jurisdiction'}</h2><SourceFeedback sources={draft.sources.filter(s => s.assignment?.role === 'link' && (s.assignment.propertyRecord || 'primary') === activePropertyId)} visibleFields={GROUPS.filter(g => g.step === 2).flatMap(g => g.fields.map(f => f.id))} /><RecordFieldGroup role="property" record={activePropertyId} category={propertyRecords.find(record => record.id === activePropertyId)?.category || ''} step={2} resolved={resolved} edit={edit} /></section>
        </LinkStageGate>}

        {step === 3 && <LinkStageGate status={linkStageStatus('step4')} loading="Extracting the property schedule from the property documents…">
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onSelect={id => dispatch({ type: 'active-property', id })} />
          <ScopedSectionUpload label="Property Schedule" busy={!!sourceBusyFor('property', activePropertyId)} onUpload={files => void runUpload(files, { role: 'property', record: activePropertyId }, 'property-schedule')} />
          <SourceFeedback sources={draft.sources.filter(source => source.profile === 'property-schedule' && source.assignment?.record === activePropertyId)} visibleFields={[...GROUPS.filter(group => group.step === 3).flatMap(group => group.fields.map(field => field.id)), 'category', 'unit']} />
          {propertyRecords.filter(record => record.id === activePropertyId).map(record => {
            const id = record.id;
            const merge = activeScheduleMerge;
            const i = activePropertyIndex;
            const multipleProperties = propertyRecords.length > 1;
            return <section className="panel" key={record.id}>
              <h2>{multipleProperties ? `Schedule ${i + 1} · Property details` : 'Property details'}{record.category ? ` — ${record.category}` : ''}</h2>
              {multipleProperties && <div className="add-document-row"><button type="button" className="quiet" onClick={() => { dispatch({ type: 'active-property', id }); goto(1); }}>Edit documents for Property {i + 1}</button></div>}
              <SourceFeedback sources={draft.sources.filter(s => s.assignment?.role === 'link' && (s.assignment.propertyRecord || 'primary') === id)} visibleFields={[...GROUPS.filter(g => g.step === 3).flatMap(g => g.fields.map(f => f.id)), 'category', 'unit']} />
              <ReviewQueue sources={draft.sources.filter(s => s.assignment?.role === 'link' && (s.assignment.propertyRecord || 'primary') === id)} record={id} edit={edit} />
              <RecordFieldGroup role="property" record={id} category={record.category} step={3} resolved={resolved} edit={edit} />
              {merge && <Section title="Schedule of property" telugu="ఆస్తి వివరణ">
                <SchedulePreview merge={merge} />
              </Section>}
            </section>;
          })}
          {propertyRecords.length === 0 && <Empty>No property identified yet. Fill in property details above first.</Empty>}
          <div className="add-document-row"><button type="button" className="primary" onClick={addProperty}>+ Add another property</button></div>
        </LinkStageGate>}

        {step === 4 && <LinkStageGate status={combinedMarketStatus} loading="Extracting market value from the property documents…">
          <section className="panel"><h2>Combined market value</h2><SourceFeedback sources={draft.sources.filter(s => s.assignment?.role === 'link')} visibleFields={GROUPS.filter(g => g.step === 4).flatMap(g => g.fields.map(f => f.id))} />
            {propertyRecords.map((record, index) => <div key={record.id} style={index ? { marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.rule}` } : undefined}>
              {propertyRecords.length > 1 && <h3 style={{ margin: '0 0 10px', fontFamily: C.serif, color: C.ink }}>Schedule {index + 1}{record.category ? ` — ${record.category}` : ''}</h3>}
              <RecordFieldGroup role="property" record={record.id} category={record.category} step={4} resolved={resolved} edit={edit} />
            </div>)}
          </section>
          <section className="panel" aria-label="Calculated market value">
            <h2>Calculated market value</h2>
            <p>Total of every schedule's area × verified basic rate + structure valuation. This is calculated automatically and does not replace the final sale consideration.</p>
            <strong style={{ fontSize: 22, color: C.ink }}>{vm.persayINR || 'Enter verified area and basic rate for every schedule'}</strong>
          </section>
          <section className="panel" aria-label="Consideration in words">
            <h2>Consideration in words</h2>
            <strong style={{ fontSize: 17, color: C.ink }}>{vm.considWords || 'Enter sale consideration to generate words'}</strong>
          </section>
        </LinkStageGate>}

        {step === 5 && <section className="panel payments">
          <h2>Payments</h2>
          <p>Each instrument discharging the consideration is its own record — an advance by UPI, a cheque on execution, an RTGS balance.</p>
          {state.payments.map((p, i) => (
            <PaymentCard key={p.id} index={i} payment={p} canRemove={state.payments.length > 1}
              onPatch={patch => patchPayment(p.id, patch)} onRemove={() => removePayment(p.id)} />
          ))}
          <AddPayment onAdd={addPayment} remaining={vm.balanceINR ? `Balance remaining: ₹${vm.balanceINR}` : ''} />
          <div className="payment-total">
            <span>Consideration: ₹{vm.considINR || '—'}</span>
            <span>Paid so far: ₹{vm.paidINR || '—'}</span>
            <span className={vm.payMatched ? 'ok' : ''}>{!state.form.consid.trim() ? 'Reconciliation pending: enter sale consideration' : vm.payMatched ? 'Reconciled with consideration' : vm.balanceINR ? `Short by ₹${vm.balanceINR}` : ''}</span>
          </div>
        </section>}

        {(step === 6 || step === 7) && (() => {
          const role: 'executant' | 'claimant' = step === 6 ? 'executant' : 'claimant';
          const noun = step === 6 ? 'Executant' : 'Claimant';
          const records = partyRecordIds(role);
          return <>
            {records.map((record, i, all) => {
              const busySource = sourceBusyFor(role, record);
              return <PartyRecordCard key={record} role={role} record={record} category={state.category} step={step} resolved={resolved} edit={edit}
                label={all.length > 1 ? `${noun} ${i + 1}` : undefined}
                onDelete={all.length > 1 ? () => clearPartyRecord(role, record) : undefined}
                onUpload={uploadFor(role, record)}
                sources={draft.sources.filter(s => s.assignment?.role === role && s.assignment.record === record)}
                busy={!!busySource} />;
            })}
            <AddPartyRecord noun={noun} onAdd={addPartyRecord(role)} />
          </>;
        })()}

        {step === 8 && <section className="panel reverify">
          <h2>Readiness checks</h2>
          <ul className="checks">{vm.checks.map((c: any) => <li key={c.label} className={c.ok ? 'ok' : ''}><span className="mark">{c.mark}</span><span><b>{c.label}</b><small>{c.note}</small></span></li>)}</ul>
          {notices.length > 0 && <details><summary>{notices.length} outstanding items — draft download is available</summary><ul>{notices.map(item => <li key={item.id}><button className="quiet" onClick={()=>goto(item.step)}>{item.label}</button> — {item.reason}</li>)}</ul></details>}
          <h2>Schedule{scheduleMerges.length > 1 ? 's' : ''} of property</h2>
          {scheduleMerges.map((merge, i) => <Section key={i} title={scheduleMerges.length > 1 ? `Property ${i + 1}` : 'Schedule of property'}><SchedulePreview merge={merge} /></Section>)}
        </section>}

        {step === 9 && <section className="panel download">
          <h2>Download deed and plan</h2>
          <p>Review the listed details before downloading. You can return to any section to correct them.</p>
          {notices.length > 0 && <details open><summary>{notices.length} outstanding items — incomplete draft</summary><ul>{notices.map(item => <li key={item.id}><button className="quiet" onClick={()=>goto(item.step)}>{item.label}</button> — {item.reason}</li>)}</ul></details>}
          {!generationReady && <p>{deedRelease.reasons.join(' ')}</p>}
          <div className="download-actions"><button className="primary" disabled={exporting || !generationReady} onClick={() => generate('word')}>{exporting ? 'Preparing…' : 'Download Word deed + plan'}</button><button disabled={exporting || !generationReady} onClick={() => generate('pdf')}>Download plan PDF</button></div>
          {message && <p role="status">{message}</p>}
        </section>}

        {step === 10 && <section className="panel plan-sketch"><PlanSketchStep state={state} /></section>}

        <footer className="navigation">
          <button disabled={step <= -1} onClick={() => goto(Math.max(-1, step - 1))}>{step <= 0 ? 'Overview' : STEPS[step - 1].label}</button>
          <span>New deed clears everything you've entered.</span>
          {step < STEPS.length - 1 && <button className="primary" onClick={() => goto(Math.min(STEPS.length - 1, step + 1))}>{step < 0 ? 'Start at Step 01' : `Continue → ${STEPS[step + 1]?.label ?? 'Generate'}`}</button>}
        </footer>
      </main>
    </div>
  </div>;
}
