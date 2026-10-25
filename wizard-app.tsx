import { isMinorParty } from './minor-parties';
import { changeExecutantCapacity, withReplacedExecutantOrder } from './executant-capacity';
import { IconButton } from './icon-button';
import { giftTemplateVersion, isMunicipalGift, MUNICIPAL_GIFT_CATEGORIES } from './municipal-gift';
import { applyAuthorityPerson, applyGpaExtraction } from './authority-import';
import { stepsFor, adjacentWorkflowStep, normalizeWorkflowStep } from './workflow-steps';
import { isEntity, partyDisplayName, representativeDesignationOptions } from './party-entities';
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pencil, ArrowRight, Check, FileText, FolderOpen, LayoutGrid, Moon, Plus, Search, Sun, Files, ListChecks, CircleCheck, Users, CreditCard, Download, FileDown, Map as MapIcon, AlertCircle, UserRound, Building2, House } from 'lucide-react';
import { ALL_FIELDS, PARTY_CAPACITY_OPTIONS, PERSON_FIELDS, partyKey, personField, GROUPS, groupsForStep, LINK_OPTIONS, TITLE_SECTION_IDS, newPartyRepresentative, newStructureDetail, newStructureDetails, partyEntityFields, ROOF_NATURE_OPTIONS, STRUCTURE_STAGE_OPTIONS, STRUCTURE_TYPE_OPTIONS, type PartyRepresentative, type PartyType, type StructureDetails } from './fields';
import { STEPS, DEEDS, DRAFTS, CATEGORIES } from './reference';
import { SaleAuthorityEditor } from './sale-authority-ui';
import { FileDropZone } from './file-drop-zone';
import { savedTemplateStatus, templateIsEarlier, updateSavedDeedTemplate } from './template-version-status';
import { POA_RELATIONSHIPS, isGeneralPoa, isFamilyPoa, poaRelationship, poaRelationshipErrors, poaValues } from './poa-options';
import { GIFT_RELATIONSHIPS, giftRelationshipValues } from './gift-options';
import { SALE_DOCUMENT_OPTIONS, saleVariant, saleDocumentLabel, saleAuthorityErrors, salePropertyErrors } from './sale-options';
import { HOUSE_OPTIONS, FLAT_OPTIONS, propertyChoice, flatLabel } from './flat-options';
import {
  appStateFor, draftReducer, EXTRACTION_VERSION, fieldKey, newDraft,
  peopleFor, plansFor, resolveDraft, type Candidate, type Role, type Source, type SourceResult, WorkQueue,
  type Draft, type Action,
} from './source-draft';
import { acreGuntasToSqYards, extractUpload, extractTemplateFields, fileHash, type ExtractionProfile } from './upload-extraction';
import {
  validateGeneralPoaTemplate, validateAgreementSaleGpaTemplate, appendRegistrationPlans, BUILT_IN_TEMPLATE_SOURCE, fillSaleDeed, MAX_CUSTOM_TEMPLATE_BYTES, saveBlob, scheduleText, validateSaleDeedTemplate, validateGiftDeedTemplate, validateMunicipalGiftTemplate, inspectTemplateFields,
  type DeedTemplateSource, type ScheduleMerge,
} from './docx';
import { loadTemplate } from './template';
import { templateBytes } from './docx';
import { TemplateLibrary } from './template-library';
import { bundledTemplatePin, currentSaleTemplate, listTemplates, pinFor, sha256 } from './template-library-client';
import type { TemplatePin } from './template-library-types';
import { compileDeed, renderArtifact, type GenerationManifest } from './deed-compiler';
import { EMPTY_FIELD_CONTRACT, canonicalContract, fieldName, recordScope } from './template-fields';
import { bindTemplateFields, resolveTemplateFieldData, templateRecords, type TemplateRecord, type TemplateFieldInstance } from './template-field-values';
import { TemplateAdditionalFields } from './template-additional-fields';
import { TemplatePlacementSurface, TemplatePlacementFallback } from './template-placement-surface';
import { PlacementRecord, PlacementSlot, PlacementAnchor } from './template-placement-context';
import { PLACEMENT_CATALOG, placementStepIndex } from './template-placement';
import { deedFilename, propertyForm, mergeValues, rewritesFor, scheduleMergesFor, variantFor } from './merge';
import { buildViewModel, generationBlockers, partyRecords, scheduleRecords, uppercasePartyIdentity, vendeeShareCents, type VendeeSharesBySchedule } from './logic';
import { planPdf, planPng, registrationPlanSvg } from './registration-plan';
import { paymentPatchError, type Payment } from './payments';
import { C, Section, FieldGroup, Button, Empty, ExtractDialog, type ProgressStep } from './ui';
import { PaymentCard, AddPayment } from './paymentui';
import { ExactReferenceStep } from './exact-reference-step';
import { exactPlanFromDraft } from './exact-reference-integration';
import type { PlanDocument as ExactPlanDocument } from './exact-reference-plan/src/types';
import type { PlanDocument } from './plan-sketch-types';
import type { PlanDocument as ReferencePlanDocument } from './reference-plan/src/types';
import './wizard-app.css';
import './plan-sketch.css';
import './design-refresh.css';
import './workflow-layout.css';
import './workspace-polish.css';
import './compact-workflow.css';
import './finish-workflow.css';
import './property-party-polish.css';
import './workspace-density.css';
import './friendly-workspace.css';
import { ScreenGuide, GettingStartedGuide } from './screen-guide';
import { DocumentUpload, ReviewIssues } from './workflow-ui';
import { DEED_DEFINITIONS, INSTRUMENT_IDS, definitionFor } from './instruments';
import { releaseGate } from './legal-registry';
import { deleteDeed, listSavedDeeds, saveDeed, type SavedDeed } from './saved-deeds';

// Raised from 4: Step 2 now lets a drafter add several document types (link
// deed, house tax, title deed, NALA, permissions) at once, and each upload
// should start extracting immediately rather than queueing behind the first
// four — actual API concurrency is still throttled downstream, in
// upload-extraction.ts's own apiQueue/pageQueue.
const fileQueue = new WorkQueue(10);
const ACCEPT = '.pdf,.docx,.txt,.md,image/jpeg,image/png,image/webp,image/gif';
function StructureDetailsTable({ value, defaultRoof, onChange, onNotice }: { value: StructureDetails; defaultRoof: string; onChange: (value: StructureDetails) => void; onNotice: (message: string) => void }) {
  const details = value || newStructureDetails();
  const total = Number(details.totalFloors);
  const ordinalFloor = (floor: number) => {
    const ones = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth'];
    const tens = ['', '', 'Twentieth', 'Thirtieth', 'Fortieth', 'Fiftieth', 'Sixtieth', 'Seventieth', 'Eightieth', 'Ninetieth'];
    const cardinalTens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (floor < 20) return `${ones[floor]} Floor`;
    if (floor < 100) return `${floor % 10 ? `${cardinalTens[Math.floor(floor / 10)]} ${ones[floor % 10]}` : tens[Math.floor(floor / 10)]} Floor`;
    return `Floor ${floor}`;
  };
  const floorOptions = ['Cellar', 'Foundation', 'Ground', 'Mezzanine floor', 'Parking', ...Array.from({ length: Number.isInteger(total) && total > 0 ? total : 0 }, (_, i) => ordinalFloor(i + 1))];
  const patchRow = (id: string, patch: Record<string, string>) => onChange({ ...details, rows: details.rows.map(row => row.id === id ? { ...row, ...patch } : row) });
  const setTotal = (next: string) => {
    if (next !== '' && (!/^\d+$/.test(next) || Number(next) < details.rows.length)) {
      onNotice(`Total Floors cannot be lower than the ${details.rows.length} entered structure detail row${details.rows.length === 1 ? '' : 's'}. Remove rows first.`);
      return;
    }
    onChange({ ...details, totalFloors: next });
  };
  const canAdd = Number.isInteger(total) && total > details.rows.length;
  const selectedRoof = (row: StructureDetails['rows'][number]) =>
    row.structureType && !STRUCTURE_TYPE_OPTIONS.includes(row.structureType)
      ? ROOF_NATURE_OPTIONS.includes(row.structureType) ? row.structureType : 'Other / Custom Structure'
      : defaultRoof ? ROOF_NATURE_OPTIONS.includes(defaultRoof) ? defaultRoof : 'Other / Custom Structure' : '';
  const customRoof = (row: StructureDetails['rows'][number]) => row.structureType === 'Other / Custom Structure'
    ? row.customStructureType : row.structureType && !ROOF_NATURE_OPTIONS.includes(row.structureType) && !STRUCTURE_TYPE_OPTIONS.includes(row.structureType)
      ? row.structureType : !row.structureType && !ROOF_NATURE_OPTIONS.includes(defaultRoof) ? defaultRoof : '';
  return <Section title="Structure Details" aside={<span style={{ fontSize: 11, color: C.muted }}>Annexure I-A</span>}>
    <div className="structure-table-scroll" role="region" aria-label="Structure details table" tabIndex={0} style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{['Total Floors*', 'Floor No.*', 'Nature of Roof*', 'Stage*', 'Building Age*', 'Built-up area (Sq. Ft.)*', 'Actions'].map(label => <th key={label} style={{ textAlign: 'left', padding: '9px 8px', color: C.paper, background: C.ink, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</th>)}</tr></thead>
        <tbody>{details.rows.map((row, index) => <tr key={row.id}>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><input type="number" min="1" value={details.totalFloors} readOnly={index > 0} onChange={event => setTotal(event.target.value)} style={{ width: 78, padding: 6, border: `1px solid ${C.goldLight}`, background: index ? C.ground : C.paper }} /></td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><select value={row.floorNo} onChange={event => patchRow(row.id, { floorNo: event.target.value })} style={{ minWidth: 130, padding: 6 }}><option value="">Select…</option>{floorOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><select aria-label="Nature of Roof" value={selectedRoof(row)} onChange={event => patchRow(row.id, { structureType: event.target.value, customStructureType: event.target.value === 'Other / Custom Structure' ? customRoof(row) : '' })} style={{ minWidth: 180, padding: 6 }}><option value="">Select…</option>{ROOF_NATURE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select>{selectedRoof(row) === 'Other / Custom Structure' && <input aria-label="Custom nature of roof" value={customRoof(row)} onChange={event => patchRow(row.id, { structureType: 'Other / Custom Structure', customStructureType: event.target.value })} placeholder="Describe roof" style={{ marginTop: 6, width: 160, padding: 6, border: `1px solid ${C.goldLight}` }} />}</td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><select value={row.stage} onChange={event => patchRow(row.id, { stage: event.target.value })} style={{ minWidth: 150, padding: 6 }}><option value="">Select…</option>{STRUCTURE_STAGE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><input type="number" min="0" value={row.buildingAge} onChange={event => patchRow(row.id, { buildingAge: event.target.value })} style={{ width: 80, padding: 6, border: `1px solid ${C.goldLight}` }} /></td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><input type="number" min="0" value={row.builtUpAreaSqFt} onChange={event => patchRow(row.id, { builtUpAreaSqFt: event.target.value })} style={{ width: 112, padding: 6, border: `1px solid ${C.goldLight}` }} /></td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}`, whiteSpace: 'nowrap' }}><button type="button" className="gold" aria-label="Add structure row" disabled={!canAdd} onClick={() => onChange({ ...details, rows: [...details.rows, newStructureDetail()] })}>+</button><IconButton label={`Delete structure row ${index + 1}`} onClick={() => onChange({ ...details, rows: details.rows.length > 1 ? details.rows.filter(item => item.id !== row.id) : [newStructureDetail()] })} style={{ marginLeft: 6 }} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p style={{ margin: '10px 0 0', fontSize: 11, color: C.muted }}>Add up to the declared Total Floors. Each Floor No. may be used more than once.</p>
  </Section>;
}

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
  const label = [...ALL_FIELDS, ...PERSON_FIELDS].find(field => field.id === candidate.field)?.label || candidate.field;
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
      {!target && <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--dc-danger)' }}>This reading has no assigned deed role, so it cannot be added automatically.</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button kind="ghost" onClick={onDismiss}>Leave blank</Button>
        <Button kind="gold" disabled={!target || !value.trim()} onClick={() => onConfirm(review, value.trim())}>Confirm and use value</Button>
      </div>
    </div>
  </div>;
}

/** Keep upload feedback actionable; extracted values are shown in the form itself. */
function SourceFeedback({ sources }: { sources: Source[]; visibleFields?: string[] }) {
  const needsClearerUpload = sources.some(source => source.status === 'error' || !!source.error
    || source.result?.notes.some(note => /could not be read/i.test(note)));
  return needsClearerUpload ? <p role="status" className="notice">Some details could not be filled. Enter them below or upload a clearer photo.</p> : null;
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
  return <DocumentUpload label={`Add a document for ${label.toLowerCase()}`} busy={busy} onUpload={onUpload} />;
}

/** The named passes a document goes through while it's being read, ticked off as each completes. */
/** One role-scoped field group, bound to a specific record through the draft's manual-edit dispatch. */
function RecordFieldGroup({
  role, record, category, step, resolved, edit, label, onDelete, deleteLabel, fallbackValues, hidePartyType, omitConsideration, afterField,
}: {
  role: Role; record: string; category: string; step: number;
  resolved: ReturnType<typeof resolveDraft>; edit: (role: Role, record: string, field: string, value: string) => void;
  label?: string;
  afterField?: (fieldId: string) => React.ReactNode;
  fallbackValues?: Record<string, string>;
  hidePartyType?: boolean;
  omitConsideration?: boolean;
  /** When set, the first group renders a delete action for this whole record. */
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const groups = groupsForStep(step, category).map(group => ({ ...group, fields: group.fields.map(field => field.id === role + 'Age' && resolved.values[fieldKey(role, record, role + 'Dob')] ? { ...field, derived: true } : field).filter(f => (!hidePartyType || (!f.id.endsWith('PartyType') && !/(?:Guardian|Court|Ward)/.test(f.id))) && (!omitConsideration || f.id !== 'consid')) })).flatMap(group => {
    if ((role !== 'executant' && role !== 'claimant') || !hidePartyType) return [group];
    const isAddress = (id: string) => /(?:HNo|Locality|Village|Mandal|District|State|PinCode)$/.test(id);
    return [
      { ...group, title: 'Personal details', telugu: undefined, note: '', fields: group.fields.filter(field => !isAddress(field.id)) },
      { ...group, title: 'Residential address', telugu: undefined, note: '', fields: group.fields.filter(field => isAddress(field.id)) },
    ].filter(group => group.fields.length);
  }).map(group => {
    if (step !== 4 || role !== 'property') return group;
    const rateIndex = group.fields.findIndex(field => field.id === 'govtRate');
    if (rateIndex < 0) return group;
    const calculatedValue = {
      id: 'calculatedLandMarketValue', label: 'Calculated market value (extent × basic rate)',
      type: 'money' as const, derived: true, span: 2 as const,
    };
    return { ...group, fields: [...group.fields.slice(0, rateIndex + 1), calculatedValue, ...group.fields.slice(rateIndex + 1)] };
  });
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
  const marketExtent = Number(String(resolved.values[fieldKey(role, record, 'extentSqYards')] || '').replace(/,/g, ''));
  const marketRate = Number(String(resolved.values[fieldKey(role, record, 'govtRate')] || '').replace(/,/g, ''));
  const calculatedLandMarketValue = marketExtent > 0 && marketRate > 0 && Number.isFinite(marketExtent * marketRate)
    ? String(Math.round(marketExtent * marketRate)) : '';
  for (const g of groups) for (const f of g.fields)
    form[f.id] = f.id === 'extentSqMeters' && sqMeters ? sqMeters
      : f.id === 'calculatedLandMarketValue' ? calculatedLandMarketValue
      : resolved.values[fieldKey(role, record, f.id)] ?? fallbackValues?.[f.id] ?? defaults[f.id] ?? '';
  return <PlacementRecord scope={role} id={record}>
    {groups.map(g => (
      <FieldGroup
        key={g.title}
        afterField={afterField}
        group={label ? { ...g, title: `${g.title} — ${label}` } : g}
        form={form}
        setField={(id, v) => edit(role, record, id, v)}
      />
    ))}
    {onDelete && <IconButton label={deleteLabel || `Delete ${label || role}`} onClick={onDelete} />}
  </PlacementRecord>;
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
  const selectedId = resolved.values[fieldKey('link', record, 'linkOption')] || 'linkDoc';
  const option = LINK_OPTIONS.find(o => o.id === selectedId) || LINK_OPTIONS.find(o => o.id === 'linkDoc')!;
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
    <FileDropZone as="label" className="link-upload" disabled={busy}>
      <span>{busy ? 'Reading…' : `Upload this ${option.label.toLowerCase()} to fill the fields below`}</span>
      <input ref={input} type="file" accept={ACCEPT} multiple disabled={busy} hidden
        onChange={e => { const files = [...(e.target.files || [])]; if (files.length) onUpload(files); e.target.value = ''; }} />
      <button type="button" className="gold" disabled={busy} onClick={() => input.current?.click()}>Choose file(s) or photo</button>
    </FileDropZone>
    <SourceFeedback sources={sources} visibleFields={option.id === 'linkDoc' ? ['linkDocType', 'linkDocNo', 'linkDocDate', 'linkSro'] : undefined} />
    <FieldGroup group={{ placementSection: 'link-' + option.id, step: 1, title: option.label, note: option.note, fields: option.fields }} form={form} setField={(id, v) => edit('link', record, id, v)} />
    {onDelete && <IconButton label={`Delete ${label || 'document'}`} onClick={onDelete} />}
  </section>;
}

function TitlePointCard({ option, record, form, onField, onUpload, sources, busy, onDelete }: {
  option: (typeof LINK_OPTIONS)[number]; record: string; form: Record<string, string>;
  onField: (field: string, value: string) => void; onUpload: (files: File[]) => void;
  sources: Source[]; busy: boolean; onDelete?: () => void;
}) {
  const visibleFields = option.fields.filter(field => !field.hidden);
  return <section className="panel link-record" data-title-point={option.id}>
    <div className="document-card-heading"><span className="document-card-icon"><FileText size={20} aria-hidden="true" /></span><div><h2>{option.id === 'linkDoc' ? 'Registered Deed' : option.id === 'permissions' ? 'House Permission' : option.label}</h2><p>Upload a source to fill the details, or enter them below.</p></div><span className="document-source-count">{sources.length ? `${sources.length} source${sources.length === 1 ? '' : 's'}` : 'Manual / upload'}</span></div>
    <DocumentUpload label={`Add ${option.id === 'linkDoc' ? 'a registered deed' : option.label.toLowerCase()}`} busy={busy} multiple={option.id === 'linkDoc' || option.id === 'landLayoutLrs'} onUpload={onUpload} />
    <SourceFeedback sources={sources} visibleFields={visibleFields.map(field => field.id)} />
    {option.id === 'landLayoutLrs' ? [
      ['Vacant Land Tax / Assessment', 'vltNo'],
      ['Approved Layout', 'layoutFileNo'],
      ['LRS 2020 Application', 'lrsApplicationNo', 'lrsApplicationDate'],
      ['LRS Proceeding', 'lrsProceedingNo', 'lrsProceedingDate'],
    ].map(([title, ...ids]) => <FieldGroup key={title} group={{ placementSection: 'link-' + option.id, step: 1, title, note: '', fields: visibleFields.filter(field => ids.includes(field.id)) }} form={form} setField={onField} />)
      : <FieldGroup group={{ placementSection: 'link-' + option.id, step: 1, title: option.label, note: option.note, fields: visibleFields }} form={form} setField={onField} />}
    {onDelete && <IconButton label={`Delete ${option.label} details`} onClick={onDelete} />}
  </section>;
}

/** Select which title points to add; the editable cards appear after selection. */
function AddLinkDocument({ onAdd }: { onAdd: (optionId: string, files: File[]) => void }) {
  const [picking, setPicking] = useState(false);

  if (!picking) return <div className="document-add"><span className="document-card-icon"><FolderOpen size={22} aria-hidden="true" /></span><div><h3>Add supporting documents</h3><p>Choose a registered deed, tax record, permission or other enclosure.</p></div><button type="button" className="primary" onClick={() => setPicking(true)}>+ Add / upload document</button></div>;

  return <div className="document-picker"><MultiPicker
    onCancel={() => setPicking(false)}
    onContinue={ids => { ids.forEach(id => onAdd(id, [])); setPicking(false); }} /></div>;
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
      {TITLE_SECTION_IDS.map(id => LINK_OPTIONS.find(o => o.id === id)!).map(o => (
        <button key={o.id} type="button" className={`picker-tile${selected.includes(o.id) ? ' selected' : ''}`} aria-pressed={selected.includes(o.id)} onClick={() => toggle(o.id)}>
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
  role, record, category, step, resolved, edit, label, onDelete, onUpload, busy, sources, draft, dispatch, upload, choose, shareFields, relationshipFields, onCapacityChange,
}: {
  onCapacityChange?: (value: string) => void;
  shareFields?: React.ReactNode;
  relationshipFields?: React.ReactNode;
  role: 'executant' | 'claimant'; record: string; category: string; step: number;
  resolved: ReturnType<typeof resolveDraft>; edit: (role: Role, record: string, field: string, value: string) => void;
  label?: string; onDelete?: () => void; onUpload: (files: File[]) => void; busy?: boolean; sources: Source[];
  draft: Draft; dispatch: React.Dispatch<Action>;
  upload: (files: File[], assignment: { role: Role; record: string }, profile: ExtractionProfile) => void;
  choose: (key: string, candidateId: string) => void;
}) {
  const partyType = (resolved.values[fieldKey(role, record, role + 'PartyType')] || (role === 'executant' && appStateFor(draft).saleDocument !== 'ordinary' ? PARTY_CAPACITY_OPTIONS.find(p => p.startsWith('Principal'))! : 'Individual')) as PartyType;
  const entity = isEntity({ [role + 'PartyType']: partyType }, role);
  const people = peopleFor(draft, partyKey(role, record), resolved);
  const society = partyType === 'Society / Association' || partyType === 'Society / Trust';
  const entityFields = partyEntityFields(role, partyType).filter(f => !f.hidden).sort((a, b) => Number(b.id === role + 'EntityName') - Number(a.id === role + 'EntityName'));
  const addressField = (id: string) => /Entity(?:Address|CommunicationAddress|CommunicationSame|HNo|Locality|Village|Mandal|District|State|PinCode|Landmark|BranchOffice)$/.test(id);
  const same = resolved.values[fieldKey(role, record, role + 'EntityCommunicationSame')] === 'Yes';
  const entityForm = Object.fromEntries(entityFields.map(f => [f.id, f.id === role + 'EntityCommunicationAddress' && same ? resolved.values[fieldKey(role, record, role + 'EntityAddress')] || '' : resolved.values[fieldKey(role, record, f.id)] || '']));
  const personList = (kind: 'representativeIds' | 'memberIds') => {
    const members = kind === 'memberIds';
    const rows = members ? people.members : people.representatives;
    return <Section title={members ? 'General body / managing committee members' : 'Authorised representatives'}>
      <p>{members ? 'Committee membership is separate from authority to sign. Add signatories under Authorised representatives.' : 'Add every person authorised to represent this organisation. Each person has an independent ID upload and complete address.'}</p>
      {rows.map((person, index) => {
        const ownSources = draft.sources.filter(s => s.assignment?.role === 'party-person' && s.assignment.record === person.id);
        const form = Object.fromEntries(PERSON_FIELDS.map(f => [f.id, resolved.values[fieldKey('party-person', person.id, f.id)] || (f.id === 'personRelation' ? 'S/O' : '')]));
        const fields = (members ? PERSON_FIELDS.filter(f => ['personName', 'personRelation', 'personRelationName', 'personAadhaar', 'personDesignation', 'personMobile'].includes(f.id)) : PERSON_FIELDS).map(field => field.id === 'personDesignation' ? { ...field, type: 'select' as const, allowCustom: true, options: representativeDesignationOptions(partyType), hint: 'Choose a designation or type your own.' } : field.id === 'personAge' && form.personDob ? { ...field, derived: true } : field);
        return <div className="representative-card" key={person.id} data-person-id={person.id}>
          <div className="representative-heading"><b>{members ? 'Member' : 'Representative'} {index + 1}</b><IconButton label={`Delete ${members ? 'member' : 'representative'} ${index + 1}`} onClick={() => dispatch({ type: 'remove-person', side: role, record, id: person.id })} /></div>
          <ScopedSectionUpload label={members ? 'member' : 'representative'} busy={ownSources.some(s => s.status === 'reading' || s.status === 'queued')} onUpload={files => upload(files, { role: 'party-person', record: person.id }, 'party-person')} />
          <SourceFeedback sources={ownSources} />
          <FieldGroup group={{ step, title: (members ? 'Member' : 'Representative') + ' ' + (index + 1) + ' details', cols: 3, fields }} form={form} setField={(id, value) => edit('party-person', person.id, id, value)} />
          {fields.map(f => {
            const key = fieldKey('party-person', person.id, f.id); const conflict = resolved.conflicts[key]; const evidence = resolved.evidence[key];
            return conflict ? <div className="notice" key={key}><b>Review {f.label}</b>{conflict.map(c => <button type="button" key={c.id} className="quiet" onClick={() => choose(key, c.id)}>Use {c.value} — {c.sourceName}</button>)}</div> : evidence?.length ? <small className="person-evidence" key={key}>{f.label}: {evidence[0].sourceName} · {evidence[0].quote}</small> : null;
          })}
        </div>;
      })}
      <button type="button" className="quiet" onClick={() => { const id = crypto.randomUUID(); dispatch({ type: 'add-person', side: role, record, id, kind }); edit('party-person', id, 'personRelation', 'S/O'); }}>+ Add {members ? 'member' : 'representative'}</button>
    </Section>;
  };
  return <PlacementRecord scope={role} id={record}><section className="panel party-record-card">
    <div className="party-card-heading"><span className="record-heading-icon">{entity ? <Building2 size={21} aria-hidden="true" /> : <UserRound size={21} aria-hidden="true" />}</span><div><h2>{label || (role === 'executant' ? 'Executant' : 'Claimant')}</h2><p>{(entity ? entityForm[role + 'EntityName'] : resolved.values[fieldKey(role, record, role + 'Name')]) || (role === 'executant' ? 'Party transferring the property rights' : 'Party receiving the property rights')}</p></div><span className="record-kind">{partyType}</span></div>
    <div className="party-type-selector"><FieldGroup group={{ step, title: 'Party type', fields: GROUPS.flatMap(g => g.fields).filter(f => f.id === role + 'PartyType') }} form={{ [role + 'PartyType']: partyType }} setField={(id, value) => onCapacityChange ? onCapacityChange(value) : edit(role, record, id, value)} /></div>
    {relationshipFields}
    {entity ? <>
      <Section title={society ? 'Society / association details' : partyType === 'Company' ? 'Company details' : 'Firm / entity details'}>
        <ScopedSectionUpload label="entity particulars" busy={busy} onUpload={files => upload(files, { role, record }, ('entity:' + role + ':' + partyType) as ExtractionProfile)} />
        <SourceFeedback sources={sources.filter(s => !s.profile?.startsWith('authorization:'))} />
        <FieldGroup group={{ step, title: 'Organisation particulars', cols: 3, fields: entityFields.filter(f => !addressField(f.id)) }} form={entityForm} setField={(id, value) => edit(role, record, id, value)} />
        <FieldGroup afterField={id => id.endsWith('PinCode') ? shareFields : null} group={{ step, title: 'Office and communication addresses', cols: 3, fields: entityFields.filter(f => addressField(f.id) && f.id !== role + 'EntityCommunicationSame' && !(same && f.id === role + 'EntityCommunicationAddress')) }} form={entityForm} setField={(id, value) => edit(role, record, id, value)} />
        <label className="entity-same-address"><input type="checkbox" checked={same} onChange={e => edit(role, record, role + 'EntityCommunicationSame', e.target.checked ? 'Yes' : 'No')} /> Same as registered office address</label>
        <ScopedSectionUpload label="board resolution / authorization" busy={busy} onUpload={files => upload(files, { role, record }, ('authorization:' + role + ':' + partyType) as ExtractionProfile)} />
        <SourceFeedback sources={sources.filter(s => s.profile?.startsWith('authorization:'))} />
        {entityFields.map(f => { const key = fieldKey(role, record, f.id); return resolved.conflicts[key] ? <div className="notice" key={key}>Review {f.label}: {resolved.conflicts[key].map(c => <button className="quiet" type="button" key={c.id} onClick={() => choose(key, c.id)}>Use {c.value} — {c.sourceName}</button>)}</div> : null; })}
      </Section>
      {personList('representativeIds')}
      {society && personList('memberIds')}
    </> : <>
      <div className="party-identity-upload"><ScopedSectionUpload label="party identity" busy={busy} onUpload={onUpload} /><SourceFeedback sources={sources} /></div>
      {(isMinorParty(Object.fromEntries(Object.entries(resolved.values).filter(([key]) => key.startsWith(role + '|' + record + '|')).map(([key, value]) => [key.split('|')[2], value])), role) || partyType.startsWith('Guardian')) && <Section title="Minor / guardian representation">
        <p>{partyType.startsWith('Guardian') ? 'The party particulars identify the guardian. Enter the represented minor and the guardian’s relationship below.' : 'The minor remains the party. Enter the guardian’s identity and relationship. Minor executants require court permission for this deed.'}</p>
        {!partyType.startsWith('Guardian') && <ScopedSectionUpload label="guardian Aadhaar / ID" busy={busy} onUpload={files => upload(files, { role, record }, ('guardian:' + role) as ExtractionProfile)} />}
        <FieldGroup group={{ step, title: role === 'executant' ? 'Guardian and court permission' : 'Guardian details', fields: ALL_FIELDS.filter(field => field.id.startsWith(role) && ((partyType.startsWith('Guardian') ? field.id === role + 'GuardianRelationship' || field.id.includes('Ward') : field.id.includes('Guardian')) || (role === 'executant' && field.id.includes('Court')))) }} form={Object.fromEntries(ALL_FIELDS.filter(field => field.id.startsWith(role)).map(field => [field.id, resolved.values[fieldKey(role, record, field.id)] || '']))} setField={(id, value) => edit(role, record, id, value)} />
      </Section>}
      <RecordFieldGroup role={role} record={record} category={category} step={step} resolved={resolved} edit={edit} hidePartyType afterField={id => id.endsWith('PinCode') ? shareFields : null} />
    </>}
    {onDelete && <IconButton label={`Delete ${label || role}`} onClick={onDelete} />}
  </section></PlacementRecord>;
}

/** Below the executant/claimant list: upload another ID to add a second (or third) party, or add one blank to type in by hand. */
function AddPartyRecord({ noun, onAdd }: { noun: string; onAdd: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <FileDropZone className="add-document-row party-add-card">
    <span><Users size={17} aria-hidden="true" />Add another {noun.toLowerCase()}</span>
    <input ref={input} type="file" accept={ACCEPT} multiple hidden
      onChange={e => { const files = [...(e.target.files || [])]; onAdd(files); e.target.value = ''; }} />
    <button type="button" className="primary" onClick={() => input.current?.click()}>+ Upload document for another {noun.toLowerCase()}</button>
    <button className="quiet" onClick={() => onAdd([])}>Add blank {noun.toLowerCase()} instead</button>
  </FileDropZone>;
}

function PartyShareFields({ role, record, parties, schedules, shares, dispatch }: {
  role: 'executant' | 'claimant'; record: string; parties: string[];
  schedules: { id: string }[]; shares: VendeeSharesBySchedule; dispatch: React.Dispatch<Action>;
}) {
  const side = role === 'executant' ? 'Vendor' : 'Vendee';
  return <>{schedules.map((schedule, index) => {
    const value = shares[schedule.id]?.[record] || '';
    const invalid = !!value.trim() && vendeeShareCents(value) === null;
    return <label className="field" key={schedule.id}>
      <span>Share percentage (%) {schedules.length > 1 ? '— Schedule ' + (index + 1) : '(optional)'}</span>
      <input type="text" inputMode="decimal" value={value}
        aria-label={'Schedule ' + (index + 1) + ' ' + side + ' ' + (parties.indexOf(record) + 1) + ' undivided share percent'}
        aria-invalid={invalid}
        onChange={event => dispatch(role === 'executant'
          ? { type: 'vendor-share', scheduleId: schedule.id, executantId: record, value: event.target.value }
          : { type: 'vendee-share', scheduleId: schedule.id, claimantId: record, value: event.target.value })} />
      <small>{invalid ? 'Enter a percentage greater than 0 and no more than 100, with up to two decimal places.' : 'Leave blank to omit the share clause from the document.'}</small>
    </label>;
  })}</>;
}

/** The real template SCHEDULE OF PROPERTY paragraph, loaded live for one property record. */
function SchedulePreview({ merge, templateSource }: { merge: ScheduleMerge; templateSource: DeedTemplateSource }) {
  const [text, setText] = useState<string>('');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setText(''); setError('');
    scheduleText(merge.variant, merge.values, merge.supportingRecords, merge.structureDetails, merge.vendeeShares, merge.vendorShares, templateSource).then(t => { if (live) setText(t); }, e => { if (live) setError(e.message || String(e)); });
    return () => { live = false; };
  }, [templateSource, merge.variant, JSON.stringify(merge.values), JSON.stringify(merge.supportingRecords), JSON.stringify(merge.structureDetails), JSON.stringify(merge.vendeeShares), JSON.stringify(merge.vendorShares)]);
  if (error) return <p style={{ color: C.gold, fontSize: 12 }}>{error}</p>;
  if (!text) return <p style={{ color: C.mutedSoft, fontSize: 12 }}>Loading the schedule paragraph…</p>;
  return <div className="schedule-text-preview" style={{ fontFamily: C.serif, fontSize: 13, lineHeight: 1.7, color: C.ink, whiteSpace: 'pre-wrap' }}>{text}</div>;
}

/** One compact, schedule-scoped type choice. It appears only until the type is
 * known; afterwards the user sees context, not the same question again. */
function ScheduleTypeControl({ scheduleNumber, category, stage, onChange, municipal = false }: { municipal?: boolean; scheduleNumber: number; category: string; stage: string; onChange: (category: string, stage?: string) => void }) {
  const [changing, setChanging] = useState(false);
  const options = [...CATEGORIES.filter(item => item.key !== 'Flat' && item.key !== 'Residential'), ...HOUSE_OPTIONS, ...FLAT_OPTIONS].filter(item => !municipal || MUNICIPAL_GIFT_CATEGORIES.includes(item.key));
  const choice = propertyChoice(category, stage);
  const selected = options.find(item => item.key === choice);
  if (selected && !changing) return <div className="add-document-row property-type-control" aria-label={`Schedule ${scheduleNumber} property type`}>
    <span><b>Schedule {scheduleNumber}</b> · {selected.label}</span>
    <button type="button" className="quiet" onClick={() => setChanging(true)}>Change type</button>
  </div>;
  return <div className="add-document-row property-type-control" aria-label={`Schedule ${scheduleNumber} property type`}>
    <label className="field"><span>What is this property?</span>
      <select value={choice} onChange={event => { const option = [...HOUSE_OPTIONS, ...FLAT_OPTIONS].find(item => item.key === event.target.value); onChange(option ? (option.key.startsWith('Flat:') ? 'Flat' : 'Residential') : event.target.value, option?.stage); setChanging(false); }}>
        <option value="">Choose property type</option>
        {options.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select>
    </label>
    {selected && <span style={{ fontSize: 12, color: C.muted }}>Changing type may change the fields required for this schedule.</span>}
  </div>;
}

function ScheduleSwitcher({ records, activeId, onSelect }: { records: ReturnType<typeof scheduleRecords>; activeId: string; onSelect: (id: string) => void }) {
  if (records.length < 2) return null;
  return <div className="add-document-row" aria-label="Property schedules">
    {records.map((record, index) => <button key={record.id} type="button" className={record.id === activeId ? 'primary' : 'quiet'} onClick={() => onSelect(record.id)}>
      Schedule {index + 1}{record.category ? ` · ${record.category === 'Flat' ? flatLabel(record.values.flatStage) : record.category}` : ''}
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
  const [showFieldHelp, setShowFieldHelp] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('deedcraft-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('deedcraft-theme', theme); } catch { /* Storage may be disabled. */ }
  }, [theme]);
  const [draft, dispatch] = useReducer(draftReducer, undefined, newDraft);
  const [libraryView, setLibraryView] = useState(true);
  const [deedSort, setDeedSort] = useState('recent');
  const [deedSearch, setDeedSearch] = useState('');
  const [creatingDeed, setCreatingDeed] = useState(false);
  const [templatesView, setTemplatesView] = useState(false);
  const [libraryTemplate, setLibraryTemplate] = useState<TemplatePin | null>(null);
  const [latestTemplate, setLatestTemplate] = useState<TemplatePin | null>(null);
  const [defaultTemplates, setDefaultTemplates] = useState<Record<string, TemplatePin>>({});
  const [templateLibraryError, setTemplateLibraryError] = useState('');
  const [generationManifest, setGenerationManifest] = useState<GenerationManifest | null>(null);
  const [extractingTemplateFields, setExtractingTemplateFields] = useState(false);
  const [templateFieldMessage, setTemplateFieldMessage] = useState('');
  const templateExtractionGeneration = useRef(0);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [savedDeeds, setSavedDeeds] = useState<SavedDeed[]>([]);
  const [storageError, setStorageError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveSequence = useRef(0);
  const skipRestoreSave = useRef(false);
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
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDocument>>({});
  const [exactPlanDrafts, setExactPlanDrafts] = useState<Record<string, ExactPlanDocument>>({});
  const [exactPlanSelectedSvgs, setExactPlanSelectedSvgs] = useState<Record<string, string>>({});
  const [referencePlanDrafts, setReferencePlanDrafts] = useState<Record<string, ReferencePlanDocument>>({});
  const [sourceFiles, setSourceFiles] = useState<Record<string, File[]>>({});
  const [selectedPlanSvgs, setSelectedPlanSvgs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [templateMode, setTemplateMode] = useState<'built-in' | 'custom'>('built-in');
  const [customTemplate, setCustomTemplate] = useState<Extract<DeedTemplateSource, { kind: 'custom' }> | null>(null);
  const [validatingTemplate, setValidatingTemplate] = useState(false);
  const templateInput = useRef<HTMLInputElement>(null);
  const templateValidationRevision = useRef(0);
  const [download, setDownload] = useState<{ revision: number; draftId: string; templateKey: string; docx?: Blob; pdf?: Blob; filename: string } | null>(null);
  const state = useMemo(() => appStateFor(draft), [draft]);
  const resolved = useMemo(() => resolveDraft(draft), [draft]);
  const municipalGift = isMunicipalGift(state);
  const giftVersion = giftTemplateVersion(draft.variantId);
  const agreementSaleGpa = draft.instrumentId === 'agreement_of_sale';
  const generalPoa = isGeneralPoa(draft.instrumentId, draft.variantId);
  const bundledVersion = generalPoa ? 'general-poa-v1' : agreementSaleGpa ? 'agreement-sale-gpa-v1' : draft.instrumentId === 'gift' ? giftVersion : 'sale-deed-v10';
  const instrumentTitle = draft.instrumentId === 'power_of_attorney' ? 'General Power of Attorney' : agreementSaleGpa ? 'Agreement of Sale Cum GPA' : draft.instrumentId === 'gift' ? (municipalGift ? 'Municipal Gift' : 'Gift Settlement') : 'Sale Deed';
  // Read-only: only its pure-derived numbers (checks, pct, conversions) are used below.
  // Every real edit goes through `dispatch`/`edit`, never this setter.
  const baseNotices = [...generationBlockers(state), ...(draft.sources.some(s=>s.status==='reading'||s.status==='queued') ? [{id:'pending-uploads',label:'Document verification',reason:'Wait for all uploads to finish verification.',source:'Uploaded documents',step:1}] : [])];
  const shareBlockers = baseNotices.filter(item => item.id.startsWith('vendee-share-') || item.id.startsWith('vendor-share-'));
  const recordOptions = (role: Role) => [...new Set(Object.keys(resolved.values).filter(k => k.startsWith(role + '|')).map(k => k.split('|')[1]))];
  const workflowSteps = stepsFor(state.deedType);
  const step = draft.step;
  const previousStep = adjacentWorkflowStep(state.deedType, step, -1);
  const followingStep = adjacentWorkflowStep(state.deedType, step, 1);
  const displayedStep = workflowSteps.findIndex(item => item.id === step) + 1;
  const deedDefinition = definitionFor(draft.instrumentId);
  const deedRelease = releaseGate(draft.instrumentId, draft.variantId);
  const usesV7 = templateMode === 'custom' ? !!customTemplate?.validation.saleOpenings : !libraryTemplate || ['sale-deed-v9', 'sale-deed-v10'].includes(libraryTemplate.versionId) || !!libraryTemplate.saleOpenings;
  const authorityErrors = generalPoa ? [...poaRelationshipErrors(state), ...salePropertyErrors(state)] : agreementSaleGpa ? salePropertyErrors(state) : draft.instrumentId === 'gift' ? [...(!municipalGift && !giftRelationshipValues(state).Relationship ? ['Select the relationship of the Donee to the Donor.'] : []), ...salePropertyErrors(state), ...(municipalGift ? scheduleRecords(state).flatMap(record => MUNICIPAL_GIFT_CATEGORIES.includes(record.category) ? [] : ['Municipal Gift supports open place, plot, dismantled house and part open place only.']) : [])] : [...saleAuthorityErrors(state), ...(usesV7 ? salePropertyErrors(state) : []), ...(!usesV7 && state.saleDocument && state.saleDocument !== 'ordinary' ? ['Choose or upgrade to the v7 template for sale through GPA/AGPA.'] : [])];
  const generationReady = deedRelease.ready;
  const activeTemplateSource: DeedTemplateSource = useMemo(() => templateMode === 'custom' ? customTemplate || BUILT_IN_TEMPLATE_SOURCE : generalPoa ? { kind: 'library', ...bundledTemplatePin('general-poa-v1') } : agreementSaleGpa ? { kind: 'library', ...bundledTemplatePin('agreement-sale-gpa-v1') } : draft.instrumentId === 'gift' ? { kind: 'library', ...bundledTemplatePin(giftVersion) } : libraryTemplate && !libraryTemplate.versionId.startsWith('gift-') ? { kind: 'library', ...libraryTemplate } : BUILT_IN_TEMPLATE_SOURCE, [templateMode, customTemplate, libraryTemplate, draft.instrumentId, giftVersion, agreementSaleGpa, generalPoa]);
  const fieldContract = activeTemplateSource.kind === 'built-in' ? EMPTY_FIELD_CONTRACT : activeTemplateSource.fieldContract || EMPTY_FIELD_CONTRACT;
  const templateFieldState = useMemo(() => ({ ...state,
    additionalExecutants: [...state.additionalExecutants, ...extraPartyRecords.executant.filter(id => !state.additionalExecutants.some(record => record.id === id)).map(id => ({ id, values: {}, docNames: [] }))],
    additionalClaimants: [...state.additionalClaimants, ...extraPartyRecords.claimant.filter(id => !state.additionalClaimants.some(record => record.id === id)).map(id => ({ id, values: {}, docNames: [] }))],
  }), [state, extraPartyRecords]);
  const templateFieldResolution = useMemo(() => resolveTemplateFieldData(draft, templateFieldState, fieldContract), [draft, templateFieldState, fieldContract]);
  const vm = useMemo(() => buildViewModel(state, () => {}, templateFieldResolution.instances), [state, templateFieldResolution]);
  const notices = [...baseNotices, ...templateFieldResolution.instances.filter(instance => instance.error && instance.field.placement).map(instance => ({ id: `template:${instance.field.id}:${instance.record.scope}:${instance.record.id}`, label: `${instance.record.label} — ${instance.field.label}`, reason: instance.error!, source: 'Template field', step: placementStepIndex(instance.field.placement) ?? 0 }))];
  const templateFieldErrors = templateFieldResolution.instances.filter(instance => instance.error).map(instance => `${instance.record.label}: ${instance.error}`);
  const templateReady = templateMode === 'built-in' || !!customTemplate?.validation.valid;
  const templateKey = `${draft.instrumentId}:${draft.variantId}:${(agreementSaleGpa || draft.instrumentId === 'power_of_attorney') ? "section32a-inline-signatures-v2:" : ""}stamp-space-policy-v1:gift-format-policy-v3:${activeTemplateSource.kind === 'custom' ? `custom:${activeTemplateSource.hash}:${canonicalContract(fieldContract)}` : activeTemplateSource.kind === 'library' ? `library:${activeTemplateSource.versionId}:${activeTemplateSource.packageHash || activeTemplateSource.hash}` : 'built-in:sale-deed-v10'}:annexure-floor-stage-v2:party-share-policy-v4:authority-declaration-policy-v1`;
  const activeTemplateKeyRef = useRef(templateKey); activeTemplateKeyRef.current = templateKey;
  useEffect(() => { templateExtractionGeneration.current++; setExtractingTemplateFields(false); setTemplateFieldMessage(''); }, [templateKey, draft.id]);
  const hasStarted = draft.revision > 0 || !!libraryTemplate || !!customTemplate || templateMode === 'custom'
    || !!Object.keys(exactPlanDrafts).length || !!Object.keys(planDrafts).length || !!Object.keys(referencePlanDrafts).length
    || !!Object.keys(selectedPlanSvgs).length;
  const snapshot = (): SavedDeed => ({
    id: draft.id,
    updatedAt: new Date().toISOString(),
    claimantNames: municipalGift ? [[mergeValues(state).ULB, state.form.village].filter(Boolean).join(', ')] : [...new Set(partyRecords(state, 'claimant').map(p => partyDisplayName(p.values, 'claimant')).filter(Boolean))],
    deedType: deedDefinition.label,
    draft,
    sourceFiles: Object.fromEntries(Object.entries(sourceFiles).filter(([id]) => draft.sources.some(source => source.id === id))),
    planDrafts, referencePlanDrafts, exactPlanDrafts, exactPlanSelectedSvgs, selectedPlanSvgs, extraPartyRecords,
    templateMode, customTemplate, libraryTemplate: (generalPoa || agreementSaleGpa || draft.instrumentId === 'gift') && templateMode === 'built-in' ? bundledTemplatePin(bundledVersion) : libraryTemplate, generationManifest,
  });
  const persist = (deed: SavedDeed): Promise<void> => {
    const sequence = ++saveSequence.current;
    setSaveStatus('saving');
    const task = saveQueue.current.catch(() => {}).then(() => saveDeed(deed));
    saveQueue.current = task;
    return task.then(() => {
      setSavedDeeds(old => [deed, ...old.filter(item => item.id !== deed.id)]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      if (sequence === saveSequence.current) { setSaveStatus('saved'); setStorageError(''); }
    }).catch(error => {
      if (sequence === saveSequence.current) setSaveStatus('error');
      setStorageError(`This deed was not saved: ${error?.message || String(error)}`);
      throw error;
    });
  };
  useEffect(() => {
    listSavedDeeds().then(setSavedDeeds).catch(error =>
      setStorageError(`Saved deeds could not be loaded: ${error?.message || String(error)}`)
    ).finally(() => setLoadingLibrary(false));
  }, []);
  useEffect(() => {
    if (skipRestoreSave.current) { skipRestoreSave.current = false; return; }
    if (!loadingLibrary && !libraryView && hasStarted) void persist(snapshot()).catch(() => {});
  }, [loadingLibrary, libraryView, draft, sourceFiles, planDrafts, referencePlanDrafts, exactPlanDrafts, exactPlanSelectedSvgs, selectedPlanSvgs, extraPartyRecords, templateMode, customTemplate, libraryTemplate, generationManifest]);
  async function refreshPublishedTemplate() {
    try {
      const listing = await listTemplates();
      const version = listing.versions.find(item => item.id === listing.active.sale);
      if (!version) throw new Error('No published Sale template is available.');
      setLatestTemplate(pinFor(version));
      setDefaultTemplates(Object.fromEntries([['power_of_attorney', bundledTemplatePin('general-poa-v1')], ['agreement_of_sale', bundledTemplatePin('agreement-sale-gpa-v1')], ['gift', bundledTemplatePin('gift-deed-v4')], ...Object.entries(listing.active).flatMap(([instrument, id]) => {
        const revision = listing.versions.find(item => item.id === id && item.instrumentId === instrument);
        return revision ? [[instrument, pinFor(revision)]] : [];
      })]));
      setTemplateLibraryError('');
    } catch (error: any) { setTemplateLibraryError(error.message); }
  }
  useEffect(() => {
    void refreshPublishedTemplate();
    const refresh = () => { void refreshPublishedTemplate(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    if (loadingLibrary || !Object.keys(defaultTemplates).length) return;
    for (const deed of savedDeeds) {
      const updated = updateSavedDeedTemplate(deed, defaultTemplates);
      if (updated !== deed) void persist(updated).catch(() => {});
    }
  }, [loadingLibrary, defaultTemplates]);
  useEffect(() => {
    const pin = generalPoa ? bundledTemplatePin('general-poa-v1') : agreementSaleGpa ? bundledTemplatePin('agreement-sale-gpa-v1') : draft.instrumentId === 'gift' ? bundledTemplatePin(giftVersion) : defaultTemplates[draft.instrumentId || 'sale'];
    if (templateMode !== 'built-in' || !pin || (libraryTemplate && !templateIsEarlier(libraryTemplate, pin))) return;
    setLibraryTemplate(pin);
    setDownload(null);
    setGenerationManifest(null);
  }, [defaultTemplates, draft.instrumentId, giftVersion, generalPoa, templateMode, libraryTemplate]);
  const goto = (s: number) => {
    dispatch({ type: 'step', step: s });
    requestAnimationFrame(() => {
      document.getElementById('workspace-title')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  };
  const gotoTemplateField = (instance: TemplateFieldInstance) => {
    if (instance.record.scope === 'property') dispatch({ type: 'active-property', id: instance.record.id });
    goto(placementStepIndex(instance.field.placement) ?? 0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(`[data-template-field="${CSS.escape(instance.field.id)}"][data-template-record="${CSS.escape(instance.record.scope + ':' + instance.record.id)}"] input, [data-template-field="${CSS.escape(instance.field.id)}"][data-template-record="${CSS.escape(instance.record.scope + ':' + instance.record.id)}"] select, [data-template-field="${CSS.escape(instance.field.id)}"][data-template-record="${CSS.escape(instance.record.scope + ':' + instance.record.id)}"] textarea`);
      field?.focus(); field?.scrollIntoView({ block: 'center' });
    }));
  };
  const visibleSavedDeeds = savedDeeds.filter(deed => [deed.deedType, ...deed.claimantNames, ...partyRecords(appStateFor(deed.draft), 'claimant').map(p => partyDisplayName(p.values, 'claimant'))].join(' ').toLowerCase().includes(deedSearch.toLowerCase())).sort((a, b) => deedSort === 'type' ? a.deedType.localeCompare(b.deedType) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const nextStep = workflowSteps.find(s => s.id <= 8 && !vm.doneIds.includes(s.id)) || STEPS[8];
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
    if (role === 'property' || role === 'executant' || role === 'claimant') {
      setSelectedPlanSvgs(old => {
        if (role !== 'property') return {};
        const next = { ...old }; delete next[record]; return next;
      });
      setDownload(null);
    }
    dispatch({ type: 'manual', key: fieldKey(role, record, field), value });
  };

  useEffect(() => () => { controllers.current.forEach(c => c.abort()); }, []);

  /** Reads one ordered source bundle, binding it to one record so it never spills into another. */
  async function runUpload(files: File[], assignment?: { role: Role; record: string; propertyRecord?: string }, profile: ExtractionProfile = 'general') {
    if (!files.length) return;
    const templateKeyAtUpload = activeTemplateKeyRef.current;
    const sourceId = crypto.randomUUID();
    setSourceFiles(old => ({ ...old, [sourceId]: files }));
    const draftId = current.current.id;
    controllers.current.get(sourceId)?.abort();
    const controller = new AbortController(); controllers.current.set(sourceId, controller);
    const option = profile.startsWith('phase1:') ? LINK_OPTIONS.find(item => item.id === profile.slice('phase1:'.length)) : undefined;
    setActiveUpload({
      id: sourceId,
      label: option?.label || (assignment?.role === 'executant' ? 'Executant ID' : assignment?.role === 'claimant' ? 'Claimant ID' : 'Document'),
      names: files.map(file => file.name),
    });
    const valid = () => !controller.signal.aborted && current.current.id === draftId && (assignment?.role !== 'party-person' || Object.values(current.current.partyPeople || {}).some(p => [...p.representativeIds, ...p.memberIds].includes(assignment.record)));
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
          const scope = assignment?.role === 'link' ? 'property' : assignment?.role;
          const recordId = assignment?.role === 'link' ? assignment.propertyRecord || 'primary' : assignment?.record;
          requestAnimationFrame(() => {
            if (!valid() || activeTemplateKeyRef.current !== templateKeyAtUpload || !current.current.sources.some(source => source.id === sourceId && source.status === 'done')) return;
            const latest = resolveTemplateFieldData(current.current, appStateFor(current.current), fieldContract);
            const customRecord = latest.data.records.find(record => record.scope === scope && (record.id === recordId || record.sourceRecordId === recordId));
            if (customRecord && latest.instances.some(instance => instance.record.scope === customRecord.scope && instance.record.id === customRecord.id && instance.field.extractionEnabled)) void runTemplateExtraction(files, customRecord, { id: sourceId, revision: 0 } as Source);
          });
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
  function retryUpload(source: Source) {
    const files = sourceFiles[source.id];
    if (!files?.length) { setMessage('The original upload is unavailable. Please upload the file again.'); return; }
    dispatch({ type: 'remove', id: source.id });
    setSourceFiles(old => { const next = { ...old }; delete next[source.id]; return next; });
    void runUpload(files, source.assignment, (source.profile || 'general') as ExtractionProfile);
  }
  const uploadFor = (role: Role, record: string, profile?: ExtractionProfile, propertyRecord = activePropertyId) => (files: File[]) => {
    const scoped = profile || (role === 'executant' ? 'party:executant' : role === 'claimant' ? 'party:claimant' : 'general');
    if (scoped === 'phase1:linkDoc' || scoped === 'jurisdiction' || scoped === 'property-schedule') {
      void runUpload(files, { role, record, ...(role === 'link' ? { propertyRecord } : {}) }, scoped);
    } else {
      for (const file of files) void runUpload([file], { role, record, ...(role === 'link' ? { propertyRecord } : {}) }, scoped);
    }
  };
  async function runTemplateExtraction(files: File[], record: TemplateRecord, existingSource?: Source) {
    const fields = resolveTemplateFieldData(current.current, appStateFor(current.current), fieldContract).instances.filter(instance => instance.record.scope === record.scope && instance.record.id === record.id && instance.field.extractionEnabled).map(instance => instance.field);
    if (!files.length || !fields.length) return;
    const sourceId = crypto.randomUUID(); const draftId = current.current.id; const key = activeTemplateKeyRef.current; const generation = templateExtractionGeneration.current;
    const controller = new AbortController(); controllers.current.set(sourceId, controller);
    const valid = () => !controller.signal.aborted && current.current.id === draftId && activeTemplateKeyRef.current === key && generation === templateExtractionGeneration.current && current.current.sources.some(source => source.id === sourceId) && (!existingSource || current.current.sources.some(source => source.id === existingSource.id && source.revision === existingSource.revision)) && (record.scope === 'transaction' || record.scope === 'property' ? record.scope === 'transaction' || ['primary', ...current.current.propertyIds].includes(record.id) || Object.keys(resolveDraft(current.current).values).some(value => value.startsWith('property|' + record.id + '|')) : templateRecords(appStateFor(current.current)).some(item => item.scope === record.scope && item.id === record.id && (item.sourceRecordId || item.id) === (record.sourceRecordId || record.id)));
    setSourceFiles(old => ({ ...old, [sourceId]: files }));
    dispatch({ type: 'add', source: { id: sourceId, revision: 0, name: files.map(file => file.name).join(' · '), hash: '', status: 'reading', profile: 'template-fields', templateCandidates: [], templateParent: existingSource ? { id: existingSource.id, revision: existingSource.revision } : undefined } });
    setExtractingTemplateFields(true); setTemplateFieldMessage('Reading additional template fields…');
    try {
      const hash = await fileHash(files);
      const candidates = await fileQueue.run(() => extractTemplateFields(files, fields, { id: record.id, label: record.label }, controller.signal, message => { if (valid()) setTemplateFieldMessage(message); }));
      const original = existingSource && current.current.sources.find(source => source.id === existingSource.id);
      if (original?.profile === 'phase1:linkDoc') for (const candidate of candidates) {
        if (fields.find(field => field.id === candidate.fieldId)?.evidenceContext === 'current') { candidate.historical = true; candidate.issue = 'A prior title deed cannot establish this current fact. Enter the current value or upload current evidence.'; }
      }
      if (valid()) { dispatch({ type: 'job', draftId, sourceId, sourceRevision: 0, patch: { status: 'done', hash, templateCandidates: candidates } }); setTemplateFieldMessage(candidates.length ? `${candidates.length} proposed values need your review.` : 'No supported additional values were found. Enter them manually or upload clearer evidence.'); }
      else dispatch({ type: 'remove', id: sourceId });
    } catch (error: any) { if (valid()) { dispatch({ type: 'job', draftId, sourceId, sourceRevision: 0, patch: { status: 'error', error: error.message } }); setTemplateFieldMessage(`Additional-field extraction failed: ${error.message}. Retry or enter values manually.`); } }
    finally { controllers.current.delete(sourceId); if (generation === templateExtractionGeneration.current) setExtractingTemplateFields(false); }
  }
  async function readSavedTemplateFields() {
    const generation = templateExtractionGeneration.current;
    const sources = draft.sources.filter(source => source.profile !== 'template-fields' && sourceFiles[source.id]?.length);
    if (!sources.length) { setTemplateFieldMessage('No original documents are saved with this draft. Upload evidence using the additional-fields section.'); return; }
    for (const source of sources) for (const record of templateFieldResolution.data.records) {
      if (generation !== templateExtractionGeneration.current) return;
      const permitted = record.scope === 'transaction' ? true : record.scope === 'property' ? source.assignment?.record === record.id && source.assignment.role === 'property' || source.assignment?.propertyRecord === record.id : source.assignment?.role === record.scope && source.assignment.record === (record.sourceRecordId || record.id);
      if (permitted) await runTemplateExtraction(sourceFiles[source.id], record, source);
    }
  }
  function cancelTemplateExtraction() {
    templateExtractionGeneration.current++;
    for (const source of current.current.sources.filter(source => source.profile === 'template-fields' && source.status === 'reading')) {
      controllers.current.get(source.id)?.abort();
      dispatch({ type: 'job', draftId: current.current.id, sourceId: source.id, sourceRevision: source.revision, patch: { status: 'error', error: 'Additional-field read cancelled.' } });
    }
    setExtractingTemplateFields(false); setTemplateFieldMessage('Additional-field read cancelled.');
  }
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
  /** Each grouped section uses one record per property, including several uploaded files. */
  const addLinkDocuments = (optionId: string, files: File[]) => {
    if (optionId === 'landLayoutLrs' || optionId === 'houseTax') {
      const related = optionId === 'landLayoutLrs'
        ? ['landLayoutLrs', 'vacantTax', 'approvedLayout', 'lrsApplication', 'lrsProceeding', 'layoutLrs']
        : ['houseTax', 'assessment'];
      const existing = recordOptions('link').find(record => propertyForLinkRecord(record) === activePropertyId
        && related.includes(resolved.values[fieldKey('link', record, 'linkOption')]));
      const record = existing || crypto.randomUUID();
      if (!existing) dispatch({ type: 'link-property', record, propertyId: activePropertyId });
      edit('link', record, 'linkOption', optionId);
      if (files.length) void runUpload(files, { role: 'link', record, propertyRecord: activePropertyId }, `phase1:${optionId}` as ExtractionProfile);
      return;
    }
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
    const existing = recordOptions(role);
    const base = existing.includes('primary') ? ['primary', ...existing.filter(record => record !== 'primary')] : existing.length ? existing : ['primary'];
    return [...base, ...extraPartyRecords[role].filter(r => !base.includes(r))];
  };
  /** One new row per uploaded ID (each is its own person); no files chosen still creates one blank row to type into. */
  const addPartyRecord = (role: 'executant' | 'claimant') => (files: File[]) => {
    // Persist even untouched blank cards so numbering and share checks use the
    // same parties as the UI, including after a draft is reopened.
    if (!recordOptions(role).length) dispatch({ type: 'manual', key: fieldKey(role, 'primary', `${role}Name`), value: '' });
    if (!files.length) { const record = crypto.randomUUID(); dispatch({ type: 'manual', key: fieldKey(role, record, `${role}Name`), value: '' }); setExtraPartyRecords(s => ({ ...s, [role]: [...s[role], record] })); return; }
    for (const file of files) {
      const record = crypto.randomUUID();
      dispatch({ type: 'manual', key: fieldKey(role, record, `${role}Name`), value: '' });
      setExtraPartyRecords(s => ({ ...s, [role]: [...s[role], record] }));
      // Extra people use the same identity-only profile as the primary card.  A
      // generic extraction here used to discard address/identity candidates
      // during profile filtering, leaving this newly added card blank.
      void runUpload([file], { role, record }, role === 'executant' ? 'party:executant' : 'party:claimant');
    }
  };
  const clearPartyRecord = (role: 'executant' | 'claimant', record: string) => {
    dispatch({ type: 'remove-party', role, record });
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
  const selectedPlanDraftId = useRef(draft.id);
  useEffect(() => {
    if (selectedPlanDraftId.current !== draft.id) { selectedPlanDraftId.current = draft.id; return; }
    setSelectedPlanSvgs({});
  }, [draft.id, draft.manual, draft.sources, draft.propertyIds, draft.structureDetailsBySchedule, draft.instrumentId, draft.variantId]);

  function clearTransient() {
    controllers.current.forEach(c => c.abort()); controllers.current.clear(); cache.current.clear();
    setUploadSteps({}); setDownload(null); setMessage(''); setExtraPartyRecords({ executant: [], claimant: [] });
    setPendingReviews([]); setExactPlanDrafts({}); setExactPlanSelectedSvgs({}); setPlanDrafts({}); setReferencePlanDrafts({}); setSelectedPlanSvgs({}); setSourceFiles({});
    templateValidationRevision.current++; if (templateInput.current) templateInput.current.value = '';
    setTemplateMode('built-in'); setCustomTemplate(null); setValidatingTemplate(false);
    setLibraryTemplate(null); setGenerationManifest(null);
    templateExtractionGeneration.current++; setExtractingTemplateFields(false); setTemplateFieldMessage('');
  }

  async function saveBeforeSwitch(): Promise<boolean> {
    if (libraryView || !hasStarted) return true;
    try { await persist(snapshot()); return true; }
    catch { return false; }
  }

  async function createDeed() {
    if (creatingDeed) return;
    setCreatingDeed(true);
    try {
      if (!await saveBeforeSwitch()) return;
      const pin = await currentSaleTemplate();
      clearTransient();
      setLibraryTemplate(pin); setLatestTemplate(pin); setTemplateLibraryError('');
      dispatch({ type: 'load', draft: newDraft() });
      setTemplatesView(false); setLibraryView(false);
    } catch (error: any) { setTemplateLibraryError(error.message); }
    finally { setCreatingDeed(false); }
  }

  async function showLibrary() {
    if (!await saveBeforeSwitch()) return;
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    setLibraryView(true); setTemplatesView(false);
  }

  function openSaved(saved: SavedDeed) {
    const deed = updateSavedDeedTemplate(saved, defaultTemplates);
    if (deed !== saved) void persist(deed).catch(() => {});
    skipRestoreSave.current = true;
    clearTransient();
    const restored: Draft = { ...deed.draft, sources: deed.draft.sources.map(source =>
      source.status === 'reading' || source.status === 'queued'
        ? { ...source, status: 'error', error: 'Reading was interrupted. Retry this upload.' }
        : source) };
    dispatch({ type: 'load', draft: restored });
    setSourceFiles(deed.sourceFiles || {});
    setPlanDrafts(deed.planDrafts || {});
    setReferencePlanDrafts(deed.referencePlanDrafts || {});
    setExactPlanDrafts(deed.exactPlanDrafts || {});
    setExactPlanSelectedSvgs(deed.exactPlanSelectedSvgs || {});
    setSelectedPlanSvgs(deed.selectedPlanSvgs || {});
    setExtraPartyRecords(deed.extraPartyRecords || { executant: [], claimant: [] });
    setTemplateMode(deed.templateMode || 'built-in');
    setCustomTemplate(deed.customTemplate || null);
    setLibraryTemplate(deed.libraryTemplate || bundledTemplatePin(deed.generationManifest?.templateVersionId));
    setGenerationManifest(deed.generationManifest || null);
    setTemplatesView(false);
    setLibraryView(false);
  }

  async function removeSaved(deed: SavedDeed) {
    if (!window.confirm(`Delete ${deed.claimantNames.join(', ') || 'Unnamed deed'}? This removes the saved deed and its uploaded files.`)) return;
    try {
      await saveQueue.current.catch(() => {});
      await deleteDeed(deed.id);
      setSavedDeeds(old => old.filter(item => item.id !== deed.id));
      setStorageError('');
    } catch (error: any) { setStorageError(`Deed could not be deleted: ${error?.message || String(error)}`); }
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
    if (selectedPlanSvgs[id]) return { id, svg: selectedPlanSvgs[id], note: 'Reviewed plan selected for this schedule.', error: '' };
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
  const templateBoundPreview = bindTemplateFields(fieldContract, templateFieldResolution.data, mergeValues(state), scheduleMerges, rewritesFor(state));
  const activeScheduleMerge = scheduleMerges[activePropertyIndex];
  const claimantIds = partyRecordIds('claimant');
  const executantIds = partyRecordIds('executant');
  async function generate(kind: 'word' | 'pdf') {
    const snapshot = draft; setExporting(true); setMessage('');
    try {
      if (!deedRelease.ready) throw new Error(deedRelease.reasons.join(' '));
      if (kind === 'word' && authorityErrors.length) throw new Error(authorityErrors.join(' '));
      if (!templateReady) throw new Error('Upload a compatible custom Word template or choose the built-in template.');
      if (kind === 'word' && shareBlockers.length) throw new Error('Correct the entered ownership percentages before downloading the Word deed');
      if (kind === 'word' && templateFieldErrors.length) throw new Error(templateFieldErrors.join(' '));
      const templateSource = activeTemplateSource;
      let artifact = download?.draftId === snapshot.id && download.revision === snapshot.revision && download.templateKey === templateKey
        ? download : { draftId: snapshot.id, revision: snapshot.revision, templateKey, filename: deedFilename(state) };
      if (kind === 'word' && !artifact.docx) {
        const deedValues = { ...mergeValues(state), 'Include Prepared By': snapshot.manual.includePreparedBy === 'true' ? '1' : '' };
        const inputSnapshotHash = await sha256(new TextEncoder().encode(JSON.stringify({ deedValues, saleAuthority: snapshot.saleAuthority, scheduleMerges, selectedPlanSvgs, templateFieldData: templateFieldResolution.data })));
        const compiled = compileDeed({ instrumentId: snapshot.instrumentId, variantId: snapshot.variantId, snapshotHash: inputSnapshotHash, values: deedValues, schedules: scheduleMerges, rewrites: rewritesFor(state), unresolvedWarnings: [...notices.map(item => item.reason), ...templateFieldResolution.instances.filter(instance => !instance.value).map(instance => `${instance.field.label}: write-in blank`)], templateFieldData: templateFieldResolution.data }, templateSource);
        const { result: merged, manifest } = await renderArtifact(compiled, 'docx', templateSource);
        const reviewed = await Promise.all(propertyRecords.flatMap((record, index) =>
          selectedPlanSvgs[record.id] ? [{ schedule: index + 1, svg: selectedPlanSvgs[record.id] }] : []
        ).map(async plan => ({ schedule: plan.schedule, png: await planPng(plan.svg) })));
        artifact = { ...artifact, docx: await appendRegistrationPlans(merged.blob, reviewed) };
        const outputHash = await sha256(new Uint8Array(await artifact.docx.arrayBuffer()));
        if (current.current.id === snapshot.id && current.current.revision === snapshot.revision) setGenerationManifest({ ...manifest, outputHash });
      }
      if (kind === 'pdf' && !artifact.pdf) {
        if (previews.some(p => p.error)) throw new Error(previews.find(p => p.error)!.error);
        const pngs = await Promise.all(previews.map(p => planPng(p.svg)));
        const pdf = await planPdf(pngs);
        artifact = { ...artifact, pdf };
      }
      setDownload(artifact);
      saveBlob(kind === 'word' ? artifact.docx! : artifact.pdf!, kind === 'word' ? artifact.filename : artifact.filename.replace(/\.docx$/, '-plan.pdf'));
      const outstandingCount = notices.length + templateFieldResolution.instances.filter(instance => !instance.value).length;
      setMessage(outstandingCount ? `Downloaded an incomplete draft with ${outstandingCount} outstanding items. Review and complete it before signing or registration.` : 'Downloaded using the current verified and manually entered details.');
    } catch (error: any) { setMessage(`Download could not be prepared: ${error.message}. Please retry.`); }
    finally { setExporting(false); }
  }

  async function chooseTemplate(file?: File) {
    if (!file) return;
    const validationRevision = ++templateValidationRevision.current;
    setValidatingTemplate(true); setDownload(null); setMessage('');
    try {
      if (file.size > MAX_CUSTOM_TEMPLATE_BYTES) {
        setCustomTemplate({
          kind: 'custom', name: file.name, hash: `oversized:${file.size}`, bytes: new Uint8Array(),
          validation: { valid: false, errors: ['The template is larger than 20 MB.'], detectedPlaceholders: [], omittedPlaceholders: [] },
        });
        return;
      }
      const [buffer, hash] = await Promise.all([file.arrayBuffer(), fileHash(file)]);
      const bytes = new Uint8Array(buffer);
      const inspection = await inspectTemplateFields(bytes, fieldContract);
      const compatibleContract = { version: 1 as const, fields: fieldContract.fields.filter(field => inspection.occurrences.some(occurrence => fieldName(occurrence.placeholder) === fieldName(field.placeholder))) };
      const validation = generalPoa ? await validateGeneralPoaTemplate(bytes, compatibleContract) : agreementSaleGpa ? await validateAgreementSaleGpaTemplate(bytes, compatibleContract) : draft.instrumentId === 'gift' ? await (municipalGift ? validateMunicipalGiftTemplate : validateGiftDeedTemplate)(bytes) : await validateSaleDeedTemplate(bytes, file.name, undefined, compatibleContract);
      if (validationRevision !== templateValidationRevision.current) return;
      setCustomTemplate({ kind: 'custom', name: file.name, hash, bytes, validation, fieldContract: compatibleContract });
    } catch (error: any) {
      if (validationRevision !== templateValidationRevision.current) return;
      setCustomTemplate(null);
      setMessage(`Template could not be checked: ${error?.message || 'Please choose another file.'}`);
    } finally {
      if (validationRevision === templateValidationRevision.current) {
        setValidatingTemplate(false);
        if (templateInput.current) templateInput.current.value = '';
      }
    }
  }

  async function downloadStarterTemplate() {
    try {
      const bytes = (generalPoa || agreementSaleGpa || draft.instrumentId === 'gift') && templateMode !== 'custom' ? await loadTemplate(bundledVersion) : await templateBytes(activeTemplateSource);
      saveBlob(new Blob([bytes as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `DeedCraft-${generalPoa ? 'General-Power-of-Attorney' : agreementSaleGpa ? 'Agreement-of-Sale-Cum-GPA' : draft.instrumentId === 'gift' ? 'Gift' : 'Sale'}-Deed-Template.docx`);
    } catch (error: any) {
      setMessage(`Starter template could not be downloaded: ${error?.message || 'Please retry.'}`);
    }
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
    dispatch({ type: 'remove-record', role: 'payment', record });
  };
  const clearLinkRecord = (record: string) => { dispatch({ type: 'remove-record', role: 'link', record }); };
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

  return <TemplatePlacementSurface step={libraryView || templatesView ? -1 : step} activePropertyId={activePropertyId} draft={draft} contract={fieldContract} instances={templateFieldResolution.instances} dispatch={dispatch} onExtract={(files, record) => void runTemplateExtraction(files, record)} onReadSaved={() => void readSavedTemplateFields()} onCancel={cancelTemplateExtraction} sourceFiles={sourceFiles} busy={extractingTemplateFields} message={templateFieldMessage}><div className={`wizard-app${showFieldHelp ? ' show-field-help' : ''}`} data-theme={theme}>
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
    <a className="skip-link" href="#workspace-main">Skip to content</a>
    <header className="app-top"><a href="#" className="brand" onClick={event => { event.preventDefault(); void showLibrary(); }}><span className="brand-mark" aria-hidden="true">D</span><span className="brand-name">DeedCraft <small>MULTI-INSTRUMENT</small></span></a><div className="header-actions"><button type="button" className="theme-toggle" onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}</button>{!libraryView && <IconButton icon={FolderOpen} label="Saved deeds" onClick={() => void showLibrary()} />}<button type="button" onClick={() => { void (async () => { if (await saveBeforeSwitch()) setTemplatesView(true); })(); }}><FileText size={16} aria-hidden="true" />Templates</button><button className="new-deed" disabled={creatingDeed} aria-busy={creatingDeed} onClick={() => void createDeed()}><Plus size={16} aria-hidden="true" />{creatingDeed ? 'Preparing…' : 'New deed'}</button></div></header>
    {templateLibraryError && <p className="notice" role="alert">Shared template library: {templateLibraryError} <button onClick={() => void refreshPublishedTemplate()}>Retry</button></p>}
    {templatesView ? <TemplateLibrary onClose={() => setTemplatesView(false)} onPublished={() => void refreshPublishedTemplate()} /> : libraryView ? <main id="workspace-main" tabIndex={-1} className="saved-deeds-dashboard">
      <div className="saved-deeds-heading"><div><p className="eyebrow">YOUR WORK</p><h1>Saved deeds</h1></div><button type="button" className="primary" disabled={creatingDeed} aria-busy={creatingDeed} onClick={() => void createDeed()}><Plus size={16} aria-hidden="true" />{creatingDeed ? 'Preparing…' : 'New deed'}</button></div>
      {storageError && <p className="notice" role="alert">{storageError}</p>}
      <div className="library-context"><span><FolderOpen size={16} aria-hidden="true" /> {savedDeeds.length} saved {savedDeeds.length === 1 ? 'deed' : 'deeds'}</span><span>Stored in this browser · Keep using this device to access your drafts</span></div>
      {savedDeeds.length > 0 && <GettingStartedGuide />}
      {savedDeeds.length > 0 && <div className="library-toolbar"><label className="deed-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search saved deeds by name or deed type</span><input type="search" value={deedSearch} onChange={e => setDeedSearch(e.target.value)} placeholder="Search by party name or deed type…" /></label><label className="library-sort"><span>Sort by</span><select aria-label="Sort by" value={deedSort} onChange={e => setDeedSort(e.target.value)}><option value="recent">Recently edited</option><option value="type">Deed type</option></select></label></div>}
      {savedDeeds.length > 0 && !visibleSavedDeeds.length && <p role="status">No deeds match “{deedSearch}”. <button type="button" className="quiet" onClick={() => setDeedSearch('')}>Clear search</button></p>}
      {loadingLibrary ? <p role="status">Loading saved deeds…</p> : savedDeeds.length ? <div className="saved-deeds-list">{visibleSavedDeeds.map(deed =>
        <article className="saved-deed-card" key={deed.id}><div className="saved-deed-symbol" aria-hidden="true"><FileText size={26} strokeWidth={1.5} /></div>
          <div><h2>{(isMunicipalGift(appStateFor(deed.draft)) ? [mergeValues(appStateFor(deed.draft)).ULB, appStateFor(deed.draft).form.village].filter(Boolean).join(', ') : partyRecords(appStateFor(deed.draft), 'claimant').map(p => partyDisplayName(p.values, 'claimant')).filter(Boolean).join(', ')) || deed.claimantNames?.join(', ') || `Untitled ${deed.deedType.toLowerCase()}`}</h2><p>{deed.draft.instrumentId === 'agreement_of_sale' ? 'Agreement of Sale Cum GPA' : deed.deedType} · Last edited {new Date(deed.updatedAt).toLocaleString('en-IN')}</p><div className="saved-deed-meta"><span title="Source documents" aria-label={`${deed.draft.sources.length} source documents`}><Files size={13} aria-hidden="true" />{deed.draft.sources.length}</span><span title="Last viewed step"><ListChecks size={13} aria-hidden="true" />{STEPS[normalizeWorkflowStep(deed.draft.instrumentId, deed.draft.step)]?.label || 'Overview'}</span><span>{savedTemplateStatus(deed, latestTemplate).label}{savedTemplateStatus(deed, latestTemplate).earlier ? ' · Updating to current default' : ''}</span></div></div>
          <div className="saved-deed-actions" role="group" aria-label="Deed actions"><IconButton icon={Pencil} label="Continue / Edit" onClick={() => openSaved(deed)} /><IconButton label={`Delete ${deed.claimantNames?.join(', ') || 'deed'}`} onClick={() => void removeSaved(deed)} /></div>
        </article>)}
      </div> : <section className="library-empty"><div className="empty-document"><FileText size={32} strokeWidth={1.5} aria-hidden="true" /></div><p className="eyebrow">FROM DOCUMENTS TO A DRAFT</p><h2>Your next deed starts here</h2><p>Bring your documents, review the details, and prepare your deed in one guided workspace.</p><button type="button" className="primary" disabled={creatingDeed} aria-busy={creatingDeed} onClick={() => void createDeed()}>{creatingDeed ? 'Preparing your workspace…' : 'Create your first deed'} <ArrowRight size={17} aria-hidden="true" /></button><small>Your entries are saved automatically as you work.</small><ol className="getting-started"><li><b>01</b><span><strong>Set up your deed</strong>Choose the instrument and property type.</span></li><li><b>02</b><span><strong>Add & review details</strong>Upload documents or enter details manually.</span></li><li><b>03</b><span><strong>Review & download</strong>Resolve open checks and generate your deed.</span></li></ol></section>}
    </main> : <div className="shell">
      <div className="mobile-step-picker"><label htmlFor="mobile-step">Drafting workspace</label><select id="mobile-step" value={step} onChange={e => goto(Number(e.target.value))}><option value={-1}>Overview</option>{workflowSteps.map(s => <option key={s.id} value={s.id}>{workflowSteps.indexOf(s) + 1}. {s.label}</option>)}</select></div>
      <nav className="rail" aria-label="Deed steps"><div className="rail-heading">YOUR WORKSPACE</div><div className="rail-draft-meta"><FileText size={20} aria-hidden="true" /><div><strong>{deedDefinition.label}</strong><span>{vm.doneIds.filter(id => id <= 8).length} of 9 drafting steps complete</span></div></div>
        <button className={`rail-overview${step === -1 ? ' active' : ''}`} aria-current={step === -1 ? 'page' : undefined} onClick={() => goto(-1)}><LayoutGrid size={18} aria-hidden="true" /> Overview</button>
        {[1, 2, 3, 4].map(phase => <div className="rail-phase" key={phase}>
          <span className="rail-phase-label">{['', 'Setup & sources', draft.instrumentId === 'gift' ? 'Property' : 'Property & payment', 'Parties', 'Review & finish'][phase]}</span>
          {workflowSteps.filter(s => s.phase === phase).map(s => (
            <button key={s.id} className={`rail-step${step === s.id ? ' active' : ''}${vm.doneIds.includes(s.id) ? ' done' : ''}`} aria-current={step === s.id ? 'step' : undefined} onClick={() => goto(s.id)}>
              <b>{String(workflowSteps.indexOf(s) + 1).padStart(2, '0')}</b>
              <span><em>{s.label}{vm.doneIds.includes(s.id) && <><Check size={13} aria-hidden="true" /><span className="sr-only"> · Complete</span></>}</em><small>{s.sub}</small></span>
            </button>
          ))}
        </div>)}
      </nav>

      <main id="workspace-main" tabIndex={-1} className="stage">
        {storageError && <p className="notice" role="alert">{storageError}</p>}
        {draft.sources.filter(source => source.error?.includes('Reading was interrupted')).map(source => <div className="notice" key={source.id} role="alert">Upload interrupted: {source.name}. <button type="button" onClick={() => retryUpload(source)}>Retry upload</button></div>)}
        <header className="compact-step-header">
          <div className="step-toolbar">
            <div className="workspace-breadcrumb">{step >= 0 ? <><button type="button" className="quiet" onClick={() => goto(-1)}>Overview</button><span aria-hidden="true">/</span><span>{['', 'Setup & sources', draft.instrumentId === 'gift' ? 'Property' : 'Property & payment', 'Parties', 'Review & finish'][STEPS[step].phase]}</span></> : <span>Workspace / Overview</span>}</div>
            <div className="step-toolbar-status">{!storageError && hasStarted && <span className="save-indicator" role="status">{saveStatus === 'saving' ? 'Saving deed…' : saveStatus === 'saved' ? 'Saved in this browser' : 'Deed not saved'}</span>}
              {templateMode === 'built-in' && <details className="template-context"><summary><FileText size={13} aria-hidden="true" />Template</summary><div><strong>{generalPoa ? 'General Power of Attorney v1' : agreementSaleGpa ? 'Agreement of Sale Cum GPA v1' : draft.instrumentId === 'gift' ? (municipalGift ? 'Municipal Gift v1' : 'Gift Settlement v4') : libraryTemplate?.name || 'Built-in Sale v10'}</strong><small>{generalPoa || agreementSaleGpa ? bundledVersion : draft.instrumentId === 'gift' ? giftVersion : libraryTemplate?.versionId || 'sale-deed-v10'}</small></div></details>}
            </div>
          </div>
          <div className="stage-head"><div className="step-title-line"><h1 id="workspace-title" tabIndex={-1}>{step < 0 ? 'Draft overview' : STEPS[step].label}</h1><span className="step-position">{step < 0 ? 'Overview' : `Step ${displayedStep} of ${workflowSteps.length}`}</span></div><p>{step >= 0 ? STEPS[step].sub : `Everything you need to prepare your ${deedDefinition.label.toLowerCase()}, in one place.`}</p></div>
        </header>
        {step >= 0 && <ScreenGuide key={step} step={step} gift={draft.instrumentId === 'gift'} municipal={municipalGift} showFieldHelp={showFieldHelp} onFieldHelpChange={setShowFieldHelp} />}
        {[-1, 3, 6, 7, 8, 9].includes(step) && <TemplateAdditionalFields draft={draft} contract={fieldContract} instances={templateFieldResolution.instances.filter(instance => !instance.field.placement)} dispatch={dispatch} onExtract={(files, record) => void runTemplateExtraction(files, record)} onReadSaved={() => void readSavedTemplateFields()} onCancel={cancelTemplateExtraction} sourceFiles={sourceFiles} busy={extractingTemplateFields} message={templateFieldMessage} filterScope={step === 3 ? 'property' : step === 6 ? 'executant' : step === 7 ? 'claimant' : undefined} />}
        {fieldContract.fields.some(field => field.placement) && (extractingTemplateFields || templateFieldMessage) && <div className="notice"><p role="status">{templateFieldMessage}</p>{extractingTemplateFields && <button type="button" onClick={cancelTemplateExtraction}>Cancel additional-field read</button>}</div>}


        {step === -1 && <div className="dashboard">
          <section className="dashboard-hero" aria-labelledby="dashboard-title">
            <div className="dashboard-hero-copy">
              <span className="dashboard-kicker">CURRENT DRAFT <span aria-hidden="true">·</span> {deedDefinition.label}</span>
              <h2 id="dashboard-title">Your deed, at a glance</h2>
              <p>Pick up where you left off and see what still needs attention.</p>
              <button type="button" className="dashboard-cta" onClick={() => goto(nextStep.id)}>{vm.filled === 0 ? 'Start drafting' : `Continue with ${nextStep.label}`} <span aria-hidden="true">→</span></button>
            </div>
            <div className="dashboard-progress" aria-label={`${vm.pct}% of applicable fields entered`}>
              <div className="progress-orbit" style={{ '--progress': `${vm.pct}%` } as React.CSSProperties}><div className="dashboard-progress-number">{vm.pct}<span>%</span></div></div>
              <span>Fields entered</span>
              <div className="progress-bar" role="progressbar" aria-label="Applicable fields entered" aria-valuenow={vm.pct} aria-valuemin={0} aria-valuemax={100}><div className="progress-fill" style={{ width: `${vm.pct}%` }} /></div>
            </div>
          </section>
          <button type="button" className="review-shortcut" onClick={() => goto(8)}><span className="review-shortcut-icon"><Check size={20} aria-hidden="true" /></span><span><strong>{notices.length ? `${notices.length} details need a closer look` : 'Ready for a final review'}</strong><small>{notices.length ? 'See outstanding details, grouped by drafting section.' : 'Read through your deed and confirm the details.'}</small></span><ArrowRight size={20} aria-hidden="true" /></button>
          <div className="dashboard-stats">
            <div><span className="metric-icon"><Files size={20} aria-hidden="true" /></span><strong>{vm.filled}<span> / {vm.applicableCount}</span></strong><span>Applicable fields entered</span></div>
            <div><span className="metric-icon"><CircleCheck size={20} aria-hidden="true" /></span><strong>{vm.doneIds.filter(id => id <= 8).length}<span> / 9</span></strong><span>Drafting steps complete</span></div>
            <div><span className="metric-icon"><ListChecks size={20} aria-hidden="true" /></span><strong>{vm.openCount}</strong><span>Readiness checks open</span></div>
          </div>
          <div className="dashboard-details"><details className="dashboard-section document-options"><summary>Document preferences <span>Optional formatting</span></summary>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.manual.includePreparedBy === 'true'} onChange={event => dispatch({ type: 'manual', key: 'includePreparedBy', value: event.target.checked ? 'true' : '' })} />
              <span><b>Include Prepared By line</b><small style={{ display: 'block' }}>Adds “Prepared By: Gundlapelli Sampath (98662 70006)” after the witness signatures.</small></span>
            </label>
          </details>
          <section className="dashboard-section" aria-label="Party summaries"><h2>Parties and representatives</h2>{(['executant', 'claimant'] as const).flatMap(side => partyRecords(state, side).map((party, index) => {
            const id = index === 0 ? (side === 'executant' ? state.primaryExecutantId : state.primaryClaimantId) || 'primary' : party.id;
            const count = state.partyPeopleByParty?.[partyKey(side, id)]?.representatives.length || 0;
            const open = notices.filter(n => n.step === (side === 'executant' ? 6 : 7)).length;
            return <div className="party-summary" key={side + id}><b>{partyDisplayName(party.values, side) || 'Unnamed ' + side}</b><span>{party.values[side + 'PartyType'] || 'Individual'}{isEntity(party.values, side) ? ' · ' + count + ' representative(s)' : ''} · {open ? open + ' outstanding details on this side' : 'Complete'}</span><button type="button" className="quiet" onClick={() => goto(side === 'executant' ? 6 : 7)}>Edit {side}</button></div>;
          }))}</section></div>
          <section className="dashboard-section" aria-labelledby="workflow-title">
            <div className="dashboard-section-head"><div><p className="eyebrow">WORKFLOW</p><h2 id="workflow-title">Your drafting steps</h2></div><span>Choose any step to continue</span></div>
            {[1, 2, 3, 4].map(phase => <div className="dashboard-phase" key={phase}>
              <h3><span className="phase-icon">{phase === 1 ? <FolderOpen size={17} aria-hidden="true" /> : phase === 2 ? <LayoutGrid size={17} aria-hidden="true" /> : phase === 3 ? <Users size={17} aria-hidden="true" /> : <CircleCheck size={17} aria-hidden="true" />}</span><span>{['', 'Setup & sources', draft.instrumentId === 'gift' ? 'Property' : 'Property & payment', 'Parties', 'Review & finish'][phase]}</span><i /></h3>
              <div className="overview-grid">{workflowSteps.filter(s => s.phase === phase).map(s => (
                <button key={s.id} type="button" className={`overview-card${vm.doneIds.includes(s.id) ? ' done' : ''}${s.id >= 10 ? ' optional' : ''}`} onClick={() => goto(s.id)}>
                  <span className="overview-card-top"><b>{String(workflowSteps.indexOf(s) + 1).padStart(2, '0')}</b><em>{s.id >= 10 ? 'Optional plan' : vm.doneIds.includes(s.id) ? 'Complete' : 'To do'}</em></span>
                  <span className="overview-card-title">{s.label}</span>
                  <small>{s.sub}</small>
                  <span className="overview-card-arrow" aria-hidden="true">→</span>
                </button>
              ))}</div>
            </div>)}
          </section>
          <section className="dashboard-section dashboard-readiness" aria-labelledby="readiness-title">
            <div className="dashboard-section-head"><div><p className="eyebrow">FINAL REVIEW</p><h2 id="readiness-title">Readiness checks</h2></div><span>{vm.openCount === 0 ? 'All checks complete' : `${vm.openCount} still open`}</span></div>
            <ul className="checks">{vm.checks.map((c: any) => <li key={c.label} className={c.ok ? 'ok' : ''}><span className="mark">{c.mark}</span><span><b>{c.label}</b><small>{c.note}</small></span></li>)}</ul>
          </section>
        </div>}

        {step === 0 && <div className="setup-step">
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onSelect={id => dispatch({ type: 'active-property', id })} />
          <section className="setup-card" aria-labelledby="setup-property-title">
            <div className="workflow-section-heading"><span className="workflow-section-number">01</span><div><h2 id="setup-property-title">Property type <span lang="te">ఆస్తి రకం</span></h2><p>Choose the property covered by this schedule.</p></div></div>
            <div className="setup-card-content"><PlacementSlot sectionId="setup-property" anchorFieldId="category" position="before" /><IconButton label={`Delete property schedule ${activePropertyIndex + 1}`} onClick={() => dispatch({ type: 'remove-record', role: 'property', record: activePropertyId })} />
              <ScheduleTypeControl municipal={municipalGift} key={activePropertyId} scheduleNumber={activePropertyIndex + 1} category={propertyRecords.find(record => record.id === activePropertyId)?.category || ''} stage={propertyRecords.find(record => record.id === activePropertyId)?.values[propertyRecords.find(record => record.id === activePropertyId)?.category === 'Flat' ? 'flatStage' : 'houseStage'] || ''} onChange={(value, stage) => { edit('property', activePropertyId, 'category', value); if (stage) edit('property', activePropertyId, value === 'Flat' ? 'flatStage' : 'houseStage', stage); }} /><PlacementSlot sectionId="setup-property" anchorFieldId="category" position="after" /><PlacementSlot sectionId="setup-property" /></div>
          </section>
          <section className="setup-card" aria-labelledby="setup-deed-title">
            <div className="workflow-section-heading"><span className="workflow-section-number">02</span><div><h2 id="setup-deed-title">Deed &amp; draft form</h2><p>Select the legal instrument and the form to use.</p></div></div>
            <div className="deed-quick-choices" role="group" aria-label="Common deed forms">
              {[
                { label: 'SALE', detail: 'Ordinary sale', instrument: 'sale' as const, variant: saleVariant('ordinary') },
                { label: 'GPA', detail: 'Sale through GPA', instrument: 'sale' as const, variant: saleVariant('gpa') },
                { label: 'AGPA', detail: 'Sale through AGPA', instrument: 'sale' as const, variant: saleVariant('agpa') },
                { label: 'GIFT', detail: 'Gift settlement', instrument: 'gift' as const, variant: DEED_DEFINITIONS.gift.variants[0].id },
              ].map(choice => <button key={choice.label} type="button" aria-pressed={draft.instrumentId === choice.instrument && draft.variantId === choice.variant} onClick={() => dispatch({ type: 'instrument', instrumentId: choice.instrument, variantId: choice.variant })}><span className="deed-choice-icon"><FileText size={19} aria-hidden="true" /></span><span><strong>{choice.label}</strong><small>{choice.detail}</small></span><CircleCheck className="deed-choice-check" size={18} aria-hidden="true" /></button>)}
            </div>
            <div className="setup-card-content setup-fields">
              <PlacementSlot sectionId="setup-deed" anchorFieldId="instrumentId" position="before" />
              <label className="setup-field"><span>Deed type <span lang="te">దస్తావేజు రకం</span></span>
                <select value={draft.instrumentId} onChange={event => dispatch({ type: 'instrument', instrumentId: event.target.value as Draft['instrumentId'] })}>
                  {INSTRUMENT_IDS.map(id => <option key={id} value={id}>{DEED_DEFINITIONS[id].label}</option>)}
                </select>
                <small>The instrument determines the available draft forms.</small>
              </label>
              <PlacementSlot sectionId="setup-deed" anchorFieldId="instrumentId" position="after" />
              <PlacementSlot sectionId="setup-deed" anchorFieldId="variantId" position="before" />
              <label className="setup-field"><span>{draft.instrumentId === 'sale' ? 'Sale document' : 'Draft form'} <span lang="te">ముసాయిదా రూపం</span></span>
                <select value={draft.variantId} onChange={event => dispatch({ type: 'instrument', instrumentId: draft.instrumentId, variantId: event.target.value })}>
                  {draft.instrumentId === 'sale' ? <>{!SALE_DOCUMENT_OPTIONS.some(option => saleVariant(option.id) === draft.variantId) && <option value={draft.variantId}>{deedDefinition.variants.find(option => option.id === draft.variantId)?.label || draft.variantId}</option>}{SALE_DOCUMENT_OPTIONS.map(option => <option key={option.id} value={saleVariant(option.id)}>{option.label}</option>)}</> : deedDefinition.variants.map(variant => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                </select>
                <small>Use the form that matches this transaction.</small>
              </label>
              <div className={`setup-reference ${deedRelease.ready ? 'is-ready' : 'needs-reference'}`} role="status">
                <FileText size={20} aria-hidden="true" /><div><strong>{deedRelease.ready ? 'Supplied reference available' : 'Reference required'}</strong><p>{deedRelease.ready ? 'This form uses the supplied Word reference template.' : deedRelease.reasons.join(' ')}</p></div>
              </div>
              <PlacementSlot sectionId="setup-deed" anchorFieldId="variantId" position="after" />
              <PlacementSlot sectionId="setup-deed" />
            </div>
          </section>
          <p className="workflow-footnote">Your choices carry forward to the document and property sections.</p>
        </div>}

        {municipalGift && [0, 8].includes(step) && <section className="panel" aria-label="Municipal Gift details"><h2>Municipal Gift</h2><p>Gift to the property ULB, represented by its Commissioner, for the public purpose stated in the supplied template.</p><p><strong>Municipal recipient:</strong> {[mergeValues(state).ULB, state.form.village].filter(Boolean).join(', ') || 'Complete the property ULB and village.'}</p><p>Supports open place, plot, dismantled house and part open place.</p></section>}
        {draft.instrumentId === 'gift' && !municipalGift && [0, 7, 8].includes(step) && <section className="panel gift-relationship-panel" aria-label="Gift relationship">
          <h2>Donee relationship to Donor</h2>
          <p>Choose how the Donee is related to the Donor. This is separate from the identity-card relation (S/O, W/O or D/O).</p>
          <label className="field"><span>Relationship for gift</span><select aria-label="Relationship for gift" value={state.form.giftRelationship || ''} onChange={event => edit('property', 'primary', 'giftRelationship', event.target.value)}>
            <option value="">Choose relationship</option>
            {GIFT_RELATIONSHIPS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            <option value="other">Other / mixed relationships</option>
          </select></label>
          {state.form.giftRelationship === 'other' && <label className="field"><span>Relationship wording</span><input aria-label="Relationship wording" value={state.form.giftRelationshipCustom || ''} onChange={event => edit('property', 'primary', 'giftRelationshipCustom', event.target.value)} /><small>Enter the full phrase, for example “son and daughter” for two Donees. Confirm it applies to the listed Donors.</small></label>}
          <div className="gift-clause-preview"><strong>Clause preview</strong><p>{giftRelationshipValues(state)['Gift Relationship Recital'] || 'Choose a relationship to preview the gift recital.'}</p></div>
        </section>}
        {authorityErrors.length > 0 && [8, 9].includes(step) && <details className="notice" open={step !== 6}><summary>Complete document details ({authorityErrors.length})</summary><ul>{authorityErrors.map(error => <li key={error}>{error}</li>)}</ul><button type="button" onClick={() => goto(6)}>Open Executants and authority</button><button type="button" onClick={() => goto(0)}>Choose property type and stage</button></details>}
        {step === 1 && (() => {
          const records = recordOptions('link').filter(record => propertyForLinkRecord(record) === activePropertyId);
          const activeProperty = propertyRecords.find(record => record.id === activePropertyId);
          const category = activeProperty?.category || '';
          const options = TITLE_SECTION_IDS.map(id => LINK_OPTIONS.find(option => option.id === id)!);
          const sectionRecords = (id: string) => records.filter(record => {
            const saved = resolved.values[fieldKey('link', record, 'linkOption')] || 'linkDoc';
            return saved === id || (id === 'landLayoutLrs' && ['vacantTax', 'approvedLayout', 'lrsApplication', 'lrsProceeding', 'layoutLrs'].includes(saved))
              || (id === 'houseTax' && saved === 'assessment');
          });
          return <div className="documents-step">
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onSelect={id => dispatch({ type: 'active-property', id })} />
          <section className="property-context" aria-label="Selected property type">
            <span className="document-card-icon"><LayoutGrid size={20} aria-hidden="true" /></span>
            <div><span className="property-context-label">Schedule {activePropertyIndex + 1} · Property type</span><strong>{category ? category === 'Flat' ? flatLabel(activeProperty?.values.flatStage) : category : 'Property type not selected'}</strong></div>
            <button type="button" className="quiet" onClick={() => goto(0)}>{category ? 'Change property type in Step 1' : 'Choose property type in Step 1'}</button>
          </section>
          {!category ? <Empty>Choose this schedule's property type in Step 1 to add its documents.</Empty> : <>
          <div className="documents-intro"><div><h2>Documents for this property</h2><p>Add the records you have. Review the extracted details in each card.</p></div><span>{records.length} document{records.length === 1 ? '' : 's'} added</span></div>
          {options.map(option => {
            const related = sectionRecords(option.id);
            const existing = option.id === 'landLayoutLrs' || option.id === 'houseTax' ? related.slice(0, 1) : related;
            return <React.Fragment key={option.id}>
              {existing.map(record => {
                const grouped = option.id === 'landLayoutLrs' || option.id === 'houseTax';
                const canonical = grouped ? related.find(id => resolved.values[fieldKey('link', id, 'linkOption')] === option.id) : record;
                const priority = option.id === 'landLayoutLrs' ? ['vacantTax', 'approvedLayout', 'lrsApplication', 'lrsProceeding', 'layoutLrs'] : ['assessment'];
                const ordered = grouped ? [canonical, ...priority.flatMap(kind => related.filter(id => resolved.values[fieldKey('link', id, 'linkOption')] === kind)), ...related].filter((id, index, ids): id is string => !!id && ids.indexOf(id) === index) : [record];
                const form = Object.fromEntries(option.fields.map(field => [field.id, ordered.map(id => resolved.values[fieldKey('link', id, field.id)]).find(Boolean) || '']));
                if (option.id === 'houseTax' && !form.bltNo) form.bltNo = resolved.values[fieldKey('property', activePropertyId, 'bltNo')]
                  || related.map(id => resolved.values[fieldKey('link', id, 'assessmentPtinNo')]).find(Boolean) || '';
                if (option.id === 'landLayoutLrs' && !form.vltNo) form.vltNo = resolved.values[fieldKey('property', activePropertyId, 'assessmentPtinNo')]
                  || records.filter(id => !resolved.values[fieldKey('link', id, 'linkOption')])
                    .map(id => resolved.values[fieldKey('link', id, 'assessmentPtinNo')]).find(Boolean) || '';
                const ensureRecord = () => {
                  if (resolved.values[fieldKey('link', record, 'linkOption')] !== option.id) {
                    dispatch({ type: 'link-property', record, propertyId: activePropertyId });
                    edit('link', record, 'linkOption', option.id);
                  }
                };
                return <TitlePointCard key={record} option={option} record={record} form={form}
                  onField={(field, value) => { ensureRecord(); edit('link', record, field, value); }}
                  onUpload={files => { ensureRecord(); void runUpload(files, { role: 'link', record, propertyRecord: activePropertyId }, `phase1:${option.id}` as ExtractionProfile); }}
                  sources={draft.sources.filter(source => source.assignment?.role === 'link' && (grouped ? related.includes(source.assignment.record) : source.assignment.record === record))}
                  busy={(grouped ? related : [record]).some(id => !!sourceBusyFor('link', id))}
                  onDelete={() => (grouped ? related : [record]).forEach(clearLinkRecord)} />;
              })}
            </React.Fragment>;
          })}
          {category === 'Flat' && ['sale', 'agreement_of_sale'].includes(draft.instrumentId) && <section className="panel flat-agreement-documents" aria-label="Landowner–developer agreements">
            <h2>Landowner–developer agreements</h2>
            <ScopedSectionUpload label="development / supplemental agreement" busy={!!sourceBusyFor('property', activePropertyId)} onUpload={files => void runUpload(files, { role: 'property', record: activePropertyId }, 'flat-agreements')} />
            <SourceFeedback sources={draft.sources.filter(source => source.profile === 'flat-agreements' && source.assignment?.record === activePropertyId)} />
            <PlacementRecord scope="property" id={activePropertyId}><FieldGroup group={{ ...GROUPS.find(group => group.title === 'Landowner–developer agreements')!, step: 1, title: 'Development & flat-allotment registration', placementSection: 'flat-agreement-documents', note: '' }} form={Object.fromEntries(GROUPS.find(group => group.title === 'Landowner–developer agreements')!.fields.map(field => [field.id, resolved.values[fieldKey('property', activePropertyId, field.id)] || '']))} setField={(field, value) => edit('property', activePropertyId, field, value)} /></PlacementRecord>
          </section>}
          <AddLinkDocument onAdd={addLinkDocuments} />
          </>}
        </div>;
        })()}

        {step >= 2 && <div className={`workflow-step workflow-step-${step}`}>
        {step === 2 && <LinkStageGate status={linkStageStatus('step3')} loading="Extracting jurisdiction from the property documents…">
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onSelect={id => dispatch({ type: 'active-property', id })} />
          <ScopedSectionUpload label="Jurisdiction" busy={!!sourceBusyFor('property', activePropertyId)} onUpload={files => void runUpload(files, { role: 'property', record: activePropertyId }, 'jurisdiction')} />
          <SourceFeedback sources={draft.sources.filter(source => source.profile === 'jurisdiction' && source.assignment?.record === activePropertyId)} visibleFields={GROUPS.filter(group => group.step === 2).flatMap(group => group.fields.map(field => field.id))} />
          <section className="panel"><SourceFeedback sources={draft.sources.filter(s => s.assignment?.role === 'link' && (s.assignment.propertyRecord || 'primary') === activePropertyId)} visibleFields={GROUPS.filter(g => g.step === 2).flatMap(g => g.fields.map(f => f.id))} /><RecordFieldGroup role="property" record={activePropertyId} category={propertyRecords.find(record => record.id === activePropertyId)?.category || ''} step={2} resolved={resolved} edit={edit} /></section>
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
            return <section className="panel property-schedule-card" key={record.id}>
              <div className="property-card-heading"><span className="record-heading-icon"><House size={21} aria-hidden="true" /></span><div><h2>{multipleProperties ? `Schedule ${i + 1} · Property details` : 'Property details'}</h2><p>Identification, extent and boundaries for this schedule</p></div><span className="record-kind">Schedule {i + 1}</span><IconButton label={`Delete property schedule ${i + 1}`} onClick={() => dispatch({ type: 'remove-record', role: 'property', record: id })} /></div>
              <ScheduleTypeControl municipal={municipalGift} scheduleNumber={i + 1} category={record.category} stage={record.values[record.category === 'Flat' ? 'flatStage' : 'houseStage'] || ''} onChange={(value, stage) => { edit('property', id, 'category', value); if (stage) edit('property', id, value === 'Flat' ? 'flatStage' : 'houseStage', stage); }} />
              {multipleProperties && <div className="add-document-row"><IconButton icon={Pencil} label={`Edit documents for property ${i + 1}`} onClick={() => { dispatch({ type: 'active-property', id }); goto(1); }} /></div>}
              <SourceFeedback sources={draft.sources.filter(s => s.assignment?.role === 'link' && (s.assignment.propertyRecord || 'primary') === id)} visibleFields={[...GROUPS.filter(g => g.step === 3).flatMap(g => g.fields.map(f => f.id)), 'category', 'unit']} />
              <ReviewQueue sources={draft.sources.filter(s => s.assignment?.role === 'link' && (s.assignment.propertyRecord || 'primary') === id)} record={id} edit={edit} />
              <RecordFieldGroup role="property" record={id} category={record.category} step={3} resolved={resolved} edit={edit}
                fallbackValues={{ bltNo: id === 'primary' ? state.form.bltNo : record.values.bltNo || '' }} />
              {['Residential', 'Commercial'].includes(record.category) && <StructureDetailsTable
                value={state.structureDetailsBySchedule[id] || newStructureDetails()}
                defaultRoof={record.values.roofMaterial || ''}
                onChange={value => dispatch({ type: 'structure-details', propertyId: id, value })}
                onNotice={setMessage}
              />}
              {merge && <details className="property-wording"><summary><FileText size={16} aria-hidden="true" /><span>Preview schedule wording<small>Read the generated property description</small></span></summary><Section title="Schedule of property" telugu="ఆస్తి వివరణ"><SchedulePreview merge={templateBoundPreview.schedules[activePropertyIndex] || merge} templateSource={activeTemplateSource} /></Section></details>}
            </section>;
          })}
          {propertyRecords.length === 0 && <Empty>No property identified yet. Fill in property details above first.</Empty>}
          <div className="add-document-row property-add-card"><span><House size={17} aria-hidden="true" />More than one property?</span><button type="button" className="primary" onClick={addProperty}>+ Add another property</button></div>
        </LinkStageGate>}

        {step === 4 && <LinkStageGate status={combinedMarketStatus} loading="Extracting market value from the property documents…">
          <section className="panel"><h2>Combined market value</h2><SourceFeedback sources={draft.sources.filter(s => s.assignment?.role === 'link')} visibleFields={GROUPS.filter(g => g.step === 4).flatMap(g => g.fields.map(f => f.id))} />
            {propertyRecords.map((record, index) => <div key={record.id} style={index ? { marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.rule}` } : undefined}>
              {propertyRecords.length > 1 && <h3 style={{ margin: '0 0 10px', fontFamily: C.serif, color: C.ink }}>Schedule {index + 1}{record.category ? ` — ${record.category}` : ''}</h3>}
              <RecordFieldGroup role="property" record={record.id} category={record.category} step={4} omitConsideration={draft.instrumentId === 'gift'} resolved={resolved} edit={edit} />
            </div>)}
          </section>
          {draft.instrumentId === 'gift' ? <section className="panel"><h2>Gift document value</h2><p>Enter the consideration / declared value to print in every total market-value and estimate field. The Gift itself remains without monetary consideration (Nil).</p><FieldGroup group={{ step: 4, title: 'Declared value', fields: [{ ...ALL_FIELDS.find(field => field.id === 'consid')!, label: 'Consideration / declared document value (₹)' }] }} form={state.form} setField={(id, value) => edit('property', propertyRecords[0]?.id || 'primary', id, value)} /></section> : <><section className="panel" aria-label="Consideration value">
            <h2>Consideration value</h2>
            <p>The agreed sale consideration for this deed. Calculated market value remains available for validation and duty calculations.</p>
            <strong style={{ fontSize: 22, color: C.ink }}>{vm.considINR || 'Enter sale consideration'}</strong>
          </section>
          <section className="panel" aria-label="Consideration in words">
            <h2>Consideration in words</h2>
            <strong style={{ fontSize: 17, color: C.ink }}>{vm.considWords || 'Enter sale consideration to generate words'}</strong>
          </section>
          </>}
        </LinkStageGate>}

        {step === 5 && draft.instrumentId !== 'gift' && <section className="panel payments">
          <div className="finish-section-heading"><span className="finish-heading-icon"><CreditCard size={22} aria-hidden="true" /></span><div><h2>Payment summary</h2><p>Add each payment separately. Upload proof to read its details, or enter them below.</p></div></div>
          <div className="payment-summary-grid"><div><span>Sale consideration</span><strong>{vm.considINR || 'Not entered'}</strong><button type="button" className="quiet" onClick={() => goto(4)}>Edit consideration <ArrowRight size={13} aria-hidden="true" /></button></div><div><span>Payments recorded</span><strong>{vm.paidINR || '₹0'}</strong><small>{state.payments.length} payment {state.payments.length === 1 ? 'record' : 'records'}</small></div><div className={vm.payMatched ? 'is-reconciled' : ''}><span>{vm.payMatched ? 'Reconciliation' : 'Balance remaining'}</span><strong>{!state.form.consid.trim() ? 'Awaiting value' : vm.payMatched ? 'Matched' : vm.balanceINR || '₹0'}</strong><small>{vm.payMatched ? 'Payments match the consideration' : 'Compare payments with the sale consideration'}</small></div></div>
          <div className="payment-list-heading"><h3>Payment records</h3><span>Choose a method for each payment</span></div>
          {!state.payments.length && <div className="payment-empty"><CreditCard size={22} aria-hidden="true" /><div><strong>No payment records yet</strong><p>Choose a payment method below to add the first record.</p></div></div>}
          {state.payments.map((p, i) => (
            <PaymentCard key={p.id} index={i} payment={p} canRemove={true}
              onPatch={patch => patchPayment(p.id, patch)} onRemove={() => removePayment(p.id)} />
          ))}
          <AddPayment onAdd={addPayment} remaining={vm.balanceINR ? `Balance remaining: ${vm.balanceINR}` : ''} />
          <div className="payment-total">
            <span>Consideration: {vm.considINR || '—'}</span>
            <span>Paid so far: {vm.paidINR || '—'}</span>
            <span className={vm.payMatched ? 'ok' : ''}>{!state.form.consid.trim() ? 'Reconciliation pending: enter sale consideration' : vm.payMatched ? 'Reconciled with consideration' : vm.balanceINR ? `Short by ${vm.balanceINR}` : ''}</span>
          </div>
        </section>}

        {(step === 6 || step === 7) && (() => {
          if (municipalGift && step === 7) return <section className="panel" aria-label="Municipal donee"><h2>Municipal donee</h2><p>{mergeValues(state).ULB || 'Select the property ULB / municipality'}, {state.form.village || 'enter the property village'}, represented by its Commissioner.</p><p>The municipal recipient comes from the property details.</p><button type="button" onClick={() => goto(3)}>Edit property details</button></section>;
          const role: 'executant' | 'claimant' = step === 6 ? 'executant' : 'claimant';
          const noun = generalPoa ? step === 6 ? 'Principal' : 'Attorney' : step === 6 ? 'Executant' : 'Claimant';
          const combined = role === 'executant' && state.saleDocument !== 'ordinary';
          const records = partyRecordIds(role).filter(id => !combined || !state.saleAuthority?.attorneys.some(attorney => attorney.id === id));
          const changeCapacity = async (id: string, value: string) => {
            try {
              const originals = value.startsWith('Attorney') ? current.current.sources.filter(source => source.assignment?.role === 'executant' && source.assignment.record === id).flatMap(source => (sourceFiles[source.id] || []).map((file, index) => ({ file, documentId: `executant-source-${source.id}-${index}` }))) : [];
              const documents = await Promise.all(originals.map(({ file, documentId }) => new Promise<import('./sale-options').AuthorityDocument>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ id: documentId, name: file.name, size: file.size, dataUrl: String(reader.result) });
                reader.onerror = () => reject(new Error('Could not retain the identity upload. Please retry.'));
                reader.readAsDataURL(file);
              })));
              const next = changeExecutantCapacity(current.current, id, value, records);
              if (documents.length && next.saleAuthority) next.saleAuthority = { ...next.saleAuthority, attorneys: next.saleAuthority.attorneys.map(attorney => attorney.id === id ? { ...attorney, documents: [...(attorney.documents || []), ...documents.filter(document => !attorney.documents?.some(existing => existing.id === document.id))] } : attorney) };
              dispatch({ type: 'load', draft: next });
              setExtraPartyRecords(previous => ({ ...previous, executant: previous.executant.filter(record => record !== id) }));
            } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not change this person’s role. Please retry.'); }
          };
          const parties = <>
            {generalPoa && role === 'claimant' && <section className="panel" aria-label="GPA appointment recital"><h2>Appointment recital</h2><p>{poaValues(state)['Poa Appointment Recital']}</p></section>}
        {authorityErrors.length > 0 && step === 6 && <details className="notice" open={step !== 6}><summary>Complete document details ({authorityErrors.length})</summary><ul>{authorityErrors.map(error => <li key={error}>{error}</li>)}</ul><button type="button" onClick={() => goto(6)}>Open Executants and authority</button><button type="button" onClick={() => goto(0)}>Choose property type and stage</button></details>}
            {records.map((record, i, all) => {
              const busySource = sourceBusyFor(role, record);
              return <PartyRecordCard key={record} role={role} record={record} category={state.category} step={step} resolved={resolved} edit={edit}
                onCapacityChange={combined ? value => { if (!busySource) void changeCapacity(record, value); } : undefined}
                relationshipFields={generalPoa && role === 'claimant' && isFamilyPoa(state) && <div className="poa-relationship-fields">
                    <label className="field"><span>Relationship to principal(s)</span><select aria-label="Relationship to principal(s)" required value={resolved.values[fieldKey(role, record, 'poaRelationship')] || ''} onChange={event => edit(role, record, 'poaRelationship', event.target.value)}>
                      <option value="">Choose family relationship</option>{POA_RELATIONSHIPS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}<option value="other">Other family relationship</option>
                    </select></label>
                    {resolved.values[fieldKey(role, record, 'poaRelationship')] === 'other' && <label className="field"><span>Family relationship wording</span><input aria-label="Family relationship wording" required value={resolved.values[fieldKey(role, record, 'poaRelationshipCustom')] || ''} onChange={event => edit(role, record, 'poaRelationshipCustom', event.target.value)} /><small>Enter this attorney’s relationship to the listed principal(s).</small></label>}
                    {!poaRelationship({ poaRelationship: resolved.values[fieldKey(role, record, 'poaRelationship')] || '', poaRelationshipCustom: resolved.values[fieldKey(role, record, 'poaRelationshipCustom')] || '' }) && <p role="status" className="notice">Choose this attorney’s family relationship before generating the GPA.</p>}
                  </div>}
                shareFields={<>
                  <PartyShareFields role={role} record={record} parties={records} schedules={propertyRecords}
                    shares={(role === 'executant' ? draft.vendorSharesBySchedule : draft.vendeeSharesBySchedule) || {}} dispatch={dispatch} />
                </>}
                label={all.length > 1 ? `${noun} ${i + 1}` : undefined}
                onDelete={() => clearPartyRecord(role, record)}
                draft={draft} dispatch={dispatch} upload={(files, assignment, profile) => void runUpload(files, assignment, profile)} choose={(key, candidateId) => dispatch({ type: 'choose', key, candidateId })}
                onUpload={uploadFor(role, record)}
                sources={draft.sources.filter(s => s.assignment?.role === role && s.assignment.record === record)}
                busy={!!busySource} />;
            })}
            <AddPartyRecord noun={noun} onAdd={addPartyRecord(role)} />
          </>;
          return role === 'executant' ? <SaleAuthorityEditor key={draft.id} state={state} principalIds={records} onCapacityChange={changeCapacity} onDeleteAttorney={id => { const cleared = draftReducer(current.current, { type: 'remove-party', role: 'executant', record: id }); dispatch({ type: 'load', draft: { ...cleared, saleAuthority: { ...cleared.saleAuthority!, attorneys: cleared.saleAuthority!.attorneys.filter(item => item.id !== id) } } }); }} onChange={value => dispatch({ type: 'sale-authority', value })} onApplyGpa={(authority, result) => { try { const next = withReplacedExecutantOrder(current.current, applyGpaExtraction(current.current, authority, result)); setExtraPartyRecords(records => ({ ...records, executant: [] })); dispatch({ type: 'load', draft: next }); return ''; } catch (error) { return error instanceof Error ? error.message : 'Could not fill GPA principals.'; } }} onApplyPerson={(person, role, targetId) => { try { dispatch({ type: 'load', draft: applyAuthorityPerson(current.current, person, role, targetId) }); return ''; } catch (error) { return error instanceof Error ? error.message : 'Could not fill this role.'; } }}>{parties}</SaleAuthorityEditor> : parties;
        })()}


        {step === 8 && <section className="panel reverify">
          <section className="template-field-summary" aria-label="Configured template fields"><h2>Template fields</h2>{templateFieldResolution.instances.filter(instance => instance.field.placement).map(instance => <div key={`${instance.field.id}:${instance.record.scope}:${instance.record.id}`}><strong>{instance.record.label} — {instance.field.label}</strong><span>{instance.value || '____'}</span>{instance.error && <p role="alert">{instance.error}</p>}<button type="button" onClick={() => gotoTemplateField(instance)}>Edit in {PLACEMENT_CATALOG.find(step => step.id === instance.field.placement?.stepId)?.label}</button></div>)}</section>
          <div className="finish-banner"><span className="finish-banner-icon"><ListChecks size={26} aria-hidden="true" /></span><div><span className="finish-kicker">FINAL REVIEW</span><h2>Give your deed a final check</h2><p>Review outstanding details and read the property schedule before downloading.</p></div><div className="finish-banner-metric"><strong>{vm.checks.filter(c => c.ok).length}<span> / {vm.checks.length}</span></strong><span>readiness checks complete</span></div></div>
          {generalPoa && <section aria-label="GPA appointment recital"><h2>Appointment recital</h2><p>{poaValues(state)['Poa Appointment Recital']}</p>{poaRelationshipErrors(state).map(error => <p key={error} role="status">{error}</p>)}</section>}
          <ReviewIssues issues={notices} onNavigate={goto} onNavigateIssue={issue => { const instance = templateFieldResolution.instances.find(instance => issue.id === `template:${instance.field.id}:${instance.record.scope}:${instance.record.id}`); if (instance) gotoTemplateField(instance); else goto(issue.step); }} /><details className="completed-checks"><summary>View all readiness checks · {vm.checks.filter(c => c.ok).length} of {vm.checks.length} complete</summary>
          <ul className="checks">{vm.checks.map((c: any) => <li key={c.label} className={c.ok ? 'ok' : ''}><span className="mark">{c.mark}</span><span><b>{c.label}</b><small>{c.note}</small></span></li>)}</ul>
          </details>
          <details className="schedule-review"><summary>Read {scheduleMerges.length > 1 ? 'property schedules' : 'the property schedule'} <span>Preview the wording before download</span></summary>
          {templateBoundPreview.schedules.map((merge, i) => <Section key={i} title={scheduleMerges.length > 1 ? `Property ${i + 1}` : 'Schedule of property'}><SchedulePreview merge={merge} templateSource={activeTemplateSource} /></Section>)}
          </details>
        </section>}

        {step === 9 && <section className="panel download">
          <div className="finish-section-heading"><span className="finish-heading-icon"><Download size={22} aria-hidden="true" /></span><div><h2>Prepare your downloads</h2><p>Choose your template, then download the deed or property plan.</p></div><button type="button" className="quiet download-review-link" onClick={() => goto(8)}>Back to final review <ArrowRight size={14} aria-hidden="true" /></button></div>
          <p role="status"><strong>{generalPoa || agreementSaleGpa ? `${instrumentTitle} — ${state.draft}` : draft.instrumentId === 'gift' ? (municipalGift ? 'Municipal Gift Deed' : 'Gift Settlement Deed') : saleDocumentLabel(state.saleDocument)}</strong> · {propertyRecords.map(record => `${record.category} ${record.values[record.category === 'Flat' ? 'flatStage' : 'houseStage'] || ''}`.trim()).join(' / ')}</p>
          <FieldGroup group={{ step: 9, title: 'Page setup', fields: ALL_FIELDS.filter(field => field.id === 'stampPaperMargin') }} form={{ stampPaperMargin: state.form.stampPaperMargin || 'Legacy' }} setField={(id, value) => edit('property', 'transaction', id, value)} />
          <div className="template-picker" aria-label="Word template">
            <div className="template-picker-heading"><h3>1. Choose the Word template</h3><span>Applies to this draft</span></div>
            <div className="template-choices">
              <label className={templateMode === 'built-in' ? 'selected' : ''}>
                <input type="radio" name="template-mode" checked={templateMode === 'built-in'} onChange={() => { setTemplateMode('built-in'); setDownload(null); setMessage(''); }} />
                <span><b>Published / pinned template</b><small>Use DeedCraft’s supplied {instrumentTitle} template.</small></span>
              </label>
              <label className={templateMode === 'custom' ? 'selected' : ''}>
                <input type="radio" name="template-mode" checked={templateMode === 'custom'} onChange={() => { setTemplateMode('custom'); setDownload(null); setMessage(''); }} />
                <span><b>My template</b><small>Use a compatible tagged Word template for this draft.</small></span>
              </label>
            </div>
            {templateMode === 'custom' && <FileDropZone className="custom-template" disabled={validatingTemplate}>
              <p>Start from the DeedCraft template, preserve its tagged placeholders and section markers, and change the wording or formatting you need.</p>
              <div className="template-actions">
                <button type="button" className="gold" disabled={validatingTemplate} onClick={() => templateInput.current?.click()}>{validatingTemplate ? 'Checking…' : customTemplate ? 'Replace template' : 'Upload .docx template'}</button>
                <input ref={templateInput} type="file" disabled={validatingTemplate} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={event => void chooseTemplate(event.target.files?.[0])} />
                <button type="button" onClick={() => void downloadStarterTemplate()}>Download starter template</button>
                {customTemplate && <IconButton label="Remove custom template" onClick={() => { templateValidationRevision.current++; setValidatingTemplate(false); setCustomTemplate(null); setDownload(null); setMessage(''); if (templateInput.current) templateInput.current.value = ''; }} />}
              </div>
              {customTemplate?.validation.valid && <div className="template-status valid"><b>{customTemplate.name}</b><span>Compatible — {customTemplate.validation.detectedPlaceholders.length} supported placeholders found.</span>{customTemplate.validation.omittedPlaceholders.length > 0 && <small>{customTemplate.validation.omittedPlaceholders.length} optional starter placeholders are omitted from this template.</small>}</div>}
              {customTemplate && !customTemplate.validation.valid && <div className="template-status invalid" role="alert"><b>{customTemplate.name} is not compatible</b><ul>{customTemplate.validation.errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
              {!customTemplate && !validatingTemplate && <small>No custom template selected. Upload a compatible .docx or choose the built-in template.</small>}
              <small>Per-deed custom templates are checked locally and are not sent to the extraction AI. Publish shared revisions from Dashboard → Templates. Compatibility checks do not legally approve customer-authored wording.</small>
            </FileDropZone>}
          </div>
          <h3 className="export-section-title">2. Download your files</h3>
          <div className="export-options" aria-busy={exporting}>
            <article className="export-card export-word"><div className="export-file-icon"><FileDown size={25} aria-hidden="true" /></div><div><span className="export-format">WORD DOCUMENT · .DOCX</span><h3>Editable deed</h3><p>Open in Microsoft Word to review the wording and finish any write-in details.</p></div>
              <button className="primary" aria-describedby="word-download-state" disabled={exporting || (templateMode === 'custom' && validatingTemplate) || !generationReady || !templateReady || authorityErrors.length > 0 || shareBlockers.length > 0 || templateFieldErrors.length > 0} onClick={() => generate('word')}>{exporting ? 'Preparing…' : 'Download Word 2007 deed (.docx)'}</button>
              <small id="word-download-state">{exporting ? 'Preparing your files. Please keep this screen open.' : templateMode === 'custom' && validatingTemplate ? 'Wait for the custom template check to finish.' : !generationReady ? [...deedRelease.reasons, ...authorityErrors].join(' ') : authorityErrors.length ? authorityErrors.join(' ') : !templateReady ? 'Choose a compatible Word template to enable this download.' : shareBlockers.length > 0 ? 'Correct the invalid ownership percentages first.' : templateFieldErrors.length ? 'Correct the template field errors listed below.' : notices.length ? 'Incomplete draft: review the outstanding details before using it.' : 'Read the generated deed before using it.'}</small>
            </article>
            <article className="export-card"><div className="export-file-icon"><MapIcon size={25} aria-hidden="true" /></div><div><span className="export-format">PROPERTY PLAN · PDF</span><h3>Plan for printing</h3><p>Download the property-plan PDF. This is a separate file from the Word deed.</p></div>
              <button aria-describedby="plan-download-state" disabled={exporting || (templateMode === 'custom' && validatingTemplate) || !generationReady || !templateReady} onClick={() => generate('pdf')}>Download plan PDF</button>
              <small id="plan-download-state">{exporting ? 'Preparing your files…' : !generationReady ? 'An approved reference is required before generation.' : !templateReady ? 'Choose a compatible template before generating files.' : templateMode === 'custom' && validatingTemplate ? 'Wait for the custom template check to finish.' : 'Check the property plan before printing.'}</small>
            </article>
          </div>
          {message && <p className="export-feedback" role="status">{message}</p>}
          {templateFieldErrors.length > 0 && <div className="notice" role="alert"><b>Template fields need attention</b><ul>{templateFieldResolution.instances.filter(instance => instance.error).map(instance => <li key={`${instance.field.id}:${instance.record.scope}:${instance.record.id}`}>{instance.record.label}: {instance.error}{instance.field.placement && <button type="button" onClick={() => gotoTemplateField(instance)}>Go to field</button>}</li>)}</ul></div>}
          {shareBlockers.length > 0 && <p className="notice" role="alert">Correct invalid ownership percentages before downloading the Word deed. Blank percentages are omitted. <button type="button" onClick={() => goto(-1)}>Review party details</button></p>}
          <details className="download-outstanding"><summary><AlertCircle size={17} aria-hidden="true" />{notices.length ? `${notices.length} details to review before using this draft` : 'Review the current readiness status'}</summary><ReviewIssues issues={notices} onNavigate={goto} onNavigateIssue={issue => { const instance = templateFieldResolution.instances.find(instance => issue.id === `template:${instance.field.id}:${instance.record.scope}:${instance.record.id}`); if (instance) gotoTemplateField(instance); else goto(issue.step); }} compact /></details>

        </section>}

        {step === 10 && <section className="panel reference-plan-step">
          <div className="plan-schedule-tabs">{propertyIds.map((id, index) => <button key={id} className={id === activePropertyId ? 'primary' : ''} onClick={() => dispatch({ type: 'active-property', id })}>Schedule {index + 1}</button>)}</div>
          <ExactReferenceStep key={`${draft.id}:${activePropertyId}`} draftId={draft.id} scheduleId={activePropertyId}
            seed={exactPlanFromDraft(state, activePropertyId)} doc={exactPlanDrafts[activePropertyId]}
            selected={!!exactPlanSelectedSvgs[activePropertyId] && exactPlanSelectedSvgs[activePropertyId] === selectedPlanSvgs[activePropertyId]}
            onChange={doc => {
              setExactPlanDrafts(old => ({ ...old, [activePropertyId]: doc }));
              if (exactPlanSelectedSvgs[activePropertyId] === selectedPlanSvgs[activePropertyId]) {
                setSelectedPlanSvgs(old => { const next = { ...old }; delete next[activePropertyId]; return next; });
              }
              setExactPlanSelectedSvgs(old => { const next = { ...old }; delete next[activePropertyId]; return next; });
              setDownload(null);
            }}
            onUse={svg => { setSelectedPlanSvgs(old => ({ ...old, [activePropertyId]: svg })); setExactPlanSelectedSvgs(old => ({ ...old, [activePropertyId]: svg })); setDownload(null); }} />
        </section>}

        </div>}
        {step >= 0 && step <= 7 && <TemplatePlacementFallback />}
        {step >= 0 && <footer className="navigation">
          <button disabled={step <= -1} onClick={() => goto(previousStep)}>{step <= 0 ? 'Overview' : STEPS[previousStep]?.label || 'Overview'}</button>
          <span><strong>Saved as you work</strong><small>You can go back and change any detail.</small></span>
          {step < STEPS.length - 1 && <button className="primary" onClick={() => goto(followingStep)}>{step < 0 ? 'Start at Step 01' : `Continue → ${STEPS[followingStep]?.label ?? 'Generate'}`}</button>}
        </footer>}
      </main>
    </div>}
  </div></TemplatePlacementSurface>;
}
