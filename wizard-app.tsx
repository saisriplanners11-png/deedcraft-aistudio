import { RecordMove } from './record-move';
import { ReleaseFields } from './release-fields';
import { releaseErrors } from './release';
import { inRecordOrder } from './source-draft';
import { orderedEnclosureIds } from './enclosure-records';
import { guardianIds, isMinorParty } from './minor-parties';
import { resolveSroSelection } from './sro-directory';
import { normalizePropertyPlaceName, titleCasePlaceName } from './place-names';
import { titleAmendmentKind, titleAmendmentLabel } from './title-amendments';
import { changeExecutantCapacity, withReplacedExecutantOrder } from './executant-capacity';
import { IconButton } from './icon-button';
import { isMunicipalGift, MUNICIPAL_GIFT_CATEGORIES } from './municipal-gift';
import { LINK_ISSUING_AUTHORITIES } from './link-enclosure';
import { isBankReconveyance, reconveyanceErrors, repaymentFor } from './reconveyance';
import { HOUSE_ROOFS, HOUSE_VALUATION_STAGES, STRUCTURE_VALUATION_OVERRIDE, houseValuationStage, houseStageRate, houseStructurePaise, houseStructureRate, houseStructureTotal, isCompoundWall, isHouseCategory, structureAmount, structureMeasurement, structureUnit } from './house-valuation';
import { formatDeedAmount, formatMoneyInput, stampPaperValue } from './deed-money';
import { RECONVEYANCE_FIELDS } from './fields';
import { applyAuthorityPerson, applyGpaExtraction } from './authority-import';
import { hasPaymentStep, stepsFor, adjacentWorkflowStep, normalizeWorkflowStep } from './workflow-steps';
import { isEntity, partyDisplayName, representativeDesignationOptions } from './party-entities';
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Pencil, ArrowRight, Check, FileText, FolderOpen, LayoutGrid, Moon, Plus, Search, Sun, Files, ListChecks, CircleCheck, Users, CreditCard, UserRound, Building2, House } from 'lucide-react';
import { ALL_FIELDS, HOUSE_PTIN_PAIR_CATEGORIES, PROPERTY_DIMENSIONS, PARTY_CAPACITY_OPTIONS, PERSON_FIELDS, partyKey, personField, GROUPS, groupsForStep, LINK_OPTIONS, TITLE_SECTION_IDS, newPartyRepresentative, newStructureDetail, newStructureDetails, partyEntityFields, ROOF_NATURE_OPTIONS, STRUCTURE_TYPE_OPTIONS, type PartyRepresentative, type PartyType, type StructureDetails } from './fields';
import { STEPS, DEEDS, DRAFTS, CATEGORIES } from './reference';
import { SaleAuthorityEditor } from './sale-authority-ui';
import { FileDropZone } from './file-drop-zone';
import { defaultTemplateForDraft, savedTemplateStatus, templateIsEarlier, updateSavedDeedTemplate } from './template-version-status';
import { POA_RELATIONSHIPS, isGeneralPoa, isFamilyPoa, poaRelationship, poaRelationshipErrors, poaValues } from './poa-options';
import { GIFT_RELATIONSHIPS, giftRelationshipValues } from './gift-options';
import { SALE_DOCUMENT_OPTIONS, saleVariant, saleAuthorityErrors, salePropertyErrors } from './sale-options';
import { HOUSE_OPTIONS, FLAT_OPTIONS, propertyChoice, flatLabel, flatStage, isFinishedHouse } from './flat-options';
import {
  appStateFor, draftReducer, EXTRACTION_VERSION, fieldKey, newDraft,
  peopleFor, plansFor, resolveDraft, type Candidate, type Role, type Source, type SourceResult, WorkQueue,
  type Draft, type Action,
} from './source-draft';
import { acreGuntasToSqYards, extractUpload, extractTemplateFields, fileHash, type ExtractionProfile } from './upload-extraction';
import {
  validateDeedTemplate, appendRegistrationPlans, BUILT_IN_TEMPLATE_SOURCE, fillSaleDeed, MAX_CUSTOM_TEMPLATE_BYTES, saveBlob, scheduleText, inspectTemplateFields,
  loadTitleAmendmentTemplates, titleAmendmentPreview,
  type DeedTemplateSource, type ScheduleMerge,
} from './docx';
import { templateBytes } from './docx';
import { TemplateLibrary } from './template-library';
import { listTemplates, pinFor, requireCurrentDeedRules, sha256 } from './template-library-client';
import { libraryFamilyFor } from './template-library-families';
import { DEED_PRESERVATION_VERSION } from './deed-preservation';
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
import { housePtinPairsForSources, newPropertyHousePtinPair, propertyHousePtinPairsForEditor, serializePropertyHousePtinPairs, type PropertyHousePtinPair } from './property-house-ptin';
import { planPdf, planPng, registrationPlanSvg } from './registration-plan';
import { paymentPatchError, type Payment } from './payments';
import { C, Section, FieldGroup, Button, Empty, ExtractDialog, Input, type ProgressStep } from './ui';
import { deedMobile, isMobileNumber } from './deed-format';
import { PaymentCard, AddPayment } from './paymentui';
import { GuidedReferenceStep } from './guided-reference-step';
import { guidedPlanFromDraft } from './guided-reference-integration';
import type { PlanDocument as GuidedPlanDocument } from './step13-reference-plan/src/types';
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
import './workspace-fonts.css';
import './workspace.css';
import { WorkflowNavigation } from './workflow-navigation';
import { ScreenGuide, GettingStartedGuide } from './screen-guide';
import { DocumentUpload, ReviewIssues } from './workflow-ui';
import { DEED_DEFINITIONS, INSTRUMENT_IDS, definitionFor } from './instruments';
import { releaseGate } from './legal-registry';
import { deleteDeed, listSavedDeeds, saveDeed, saveDeeds, type SavedDeed } from './saved-deeds';
import { createDeedBackup, readDeedBackup } from './deed-backup';
import type { FieldRenderer } from './ui';

// Raised from 4: Step 2 now lets a drafter add several document types (link
// deed, house tax, title deed, NALA, permissions) at once, and each upload
// should start extracting immediately rather than queueing behind the first
// four — actual API concurrency is still throttled downstream, in
// upload-extraction.ts's own apiQueue/pageQueue.
const fileQueue = new WorkQueue(10);
const localFileQueue = new WorkQueue(2);
const ACCEPT = '.pdf,.docx,.txt,.md,image/jpeg,image/png,image/webp,image/gif';
function StructureDetailsTable({ value, defaultRoof, authority, onChange, onNotice }: { value: StructureDetails; defaultRoof: string; authority: string; onChange: (value: StructureDetails) => void; onNotice: (message: string) => void }) {
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
  const patchRow = (id: string, patch: Partial<StructureDetails['rows'][number]>) => onChange({ ...details, rows: details.rows.map(row => row.id === id ? { ...row, ...patch } : row) });
  const setTotal = (next: string) => {
    if (next !== '' && (!/^\d+$/.test(next) || Number(next) < 1)) {
      onNotice('Enter a positive whole number for Total Floors.');
      return;
    }
    onChange({ ...details, totalFloors: next });
  };
  const roofOptions = [...HOUSE_ROOFS, ...ROOF_NATURE_OPTIONS];
  const grandTotal = houseStructureTotal(details, authority, defaultRoof);
  const selectedRoof = (row: StructureDetails['rows'][number]) =>
    row.structureType && !STRUCTURE_TYPE_OPTIONS.includes(row.structureType)
      ? roofOptions.includes(row.structureType) ? row.structureType : 'Other / Custom Structure'
      : defaultRoof ? roofOptions.includes(defaultRoof) ? defaultRoof : 'Other / Custom Structure' : '';
  const customRoof = (row: StructureDetails['rows'][number]) => row.structureType === 'Other / Custom Structure'
    ? row.customStructureType : row.structureType && !roofOptions.includes(row.structureType) && !STRUCTURE_TYPE_OPTIONS.includes(row.structureType)
      ? row.structureType : !row.structureType && !roofOptions.includes(defaultRoof) ? defaultRoof : '';
  return <Section title="Structure Details" aside={<span style={{ fontSize: 11, color: C.muted }}>Annexure I-A</span>}>
    <div className="structure-table-scroll" role="region" aria-label="Structure details table" tabIndex={0} style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 1160, borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{['Total Floors*', 'Floor No.*', 'Nature of Roof*', 'Stage*', 'Building Age*', 'Measurement', 'Rate (₹)', 'Total Value (₹)', 'Actions'].map(label => <th key={label} style={{ textAlign: 'left', padding: '9px 8px', color: C.paper, background: C.ink, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</th>)}</tr></thead>
        <tbody>{details.rows.map((row, index) => {
          const wall = isCompoundWall(row);
          const unit = structureUnit(row);
          const amount = houseStructurePaise(row, authority, defaultRoof);
          const stage = houseValuationStage(row.stage);
          const stageRate = stage && stage.percent < 100 ? houseStageRate(row, authority, defaultRoof) : '';
          const legacyStage = !wall && !!row.stage && !stage;
          return <tr key={row.id}>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><input type="number" min="1" aria-label="Total floors" value={details.totalFloors} readOnly={index > 0} onChange={event => setTotal(event.target.value)} style={{ width: 78, padding: 6, border: `1px solid ${C.goldLight}`, background: index ? C.ground : C.paper }} /></td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><select aria-label="Floor number" disabled={wall} value={wall ? '' : row.floorNo} onChange={event => patchRow(row.id, { floorNo: event.target.value })} style={{ minWidth: 130, padding: 6 }}><option value="">Select…</option>{floorOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><select aria-label="Nature of Roof" value={selectedRoof(row)} onChange={event => patchRow(row.id, { structureType: event.target.value, rateOverride: undefined, customStructureType: event.target.value === 'Other / Custom Structure' ? customRoof(row) : '' })} style={{ minWidth: 180, padding: 6 }}><option value="">Select…</option>{roofOptions.map(option => <option key={option} value={option}>{option}</option>)}</select>{selectedRoof(row) === 'Other / Custom Structure' && <input aria-label="Custom nature of roof" value={customRoof(row)} onChange={event => patchRow(row.id, { structureType: 'Other / Custom Structure', customStructureType: event.target.value })} placeholder="Describe roof" style={{ marginTop: 6, width: 160, padding: 6, border: `1px solid ${C.goldLight}` }} />}</td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><select aria-label="Stage" disabled={wall} value={wall ? '' : stage?.value ?? row.stage} onChange={event => patchRow(row.id, { stage: event.target.value })} style={{ minWidth: 150, padding: 6 }}><option value="">Select…</option>{legacyStage && <option value={row.stage}>{row.stage}</option>}{HOUSE_VALUATION_STAGES.map(option => <option key={option.value} value={option.value}>{option.label} ({option.percent}%)</option>)}</select>{legacyStage && <small>Choose a stage with a valuation percentage.</small>}</td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><input type="number" min="0" aria-label="Building age" disabled={wall} value={wall ? '' : row.buildingAge} onChange={event => patchRow(row.id, { buildingAge: event.target.value })} style={{ width: 80, padding: 6, border: `1px solid ${C.goldLight}` }} /></td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}` }}><label><span>{unit}</span><input aria-label={`Measurement (${unit})`} type="number" min="0" step="any" value={structureMeasurement(row)} onChange={event => patchRow(row.id, { [wall ? 'runningFeet' : 'builtUpAreaSqFt']: event.target.value })} style={{ width: 100, padding: 6, border: `1px solid ${C.goldLight}` }} /></label></td>
          <td style={{ padding: 8 }}><label><span>Per {unit}</span><input aria-label={`Rate (₹ per ${unit})`} inputMode="decimal" value={formatMoneyInput(houseStructureRate(row, authority, defaultRoof))} onChange={event => patchRow(row.id, { rateOverride: event.target.value.replace(/,/g, '') })} style={{ width: 100, padding: 6 }} /></label>{stageRate && <small style={{ display: 'block' }}>Stage rate ₹{formatMoneyInput(stageRate)} per {unit}</small>}</td>
          <td style={{ padding: 8 }}><input aria-label="Total Value (₹)" readOnly value={amount === null ? '' : formatDeedAmount(structureAmount(amount))} style={{ width: 100, padding: 6 }} /></td>
          <td style={{ padding: 8, border: `1px solid ${C.rule}`, whiteSpace: 'nowrap' }}><RecordMove scope="structure" id={row.id} ids={details.rows.map(item => item.id)} onChange={ids => onChange({ ...details, rows: inRecordOrder(details.rows, ids, item => item.id) })} /><button type="button" className="gold" aria-label="Add structure row" onClick={() => onChange({ ...details, rows: [...details.rows, newStructureDetail()] })}>+</button><IconButton label={`Delete structure row ${index + 1}`} onClick={() => onChange({ ...details, rows: details.rows.length > 1 ? details.rows.filter(item => item.id !== row.id) : [newStructureDetail()] })} style={{ marginLeft: 6 }} /></td>
        </tr>})}</tbody>
      </table>
    </div>
    <p style={{ margin: '10px 0 0', fontSize: 11, color: C.muted }}>Add one row per structure. A floor may have more than one structure.</p>
    <p><strong>Grand total: {grandTotal ? `₹${formatDeedAmount(grandTotal)}` : '—'}</strong></p>
  </Section>;
}

function HousePtinPairsEditor({
  serialized, legacyHouseNo, legacyPtin, onChange,
}: {
  serialized: string; legacyHouseNo: string; legacyPtin: string; onChange: (value: string) => void;
}) {
  const rows = propertyHousePtinPairsForEditor(serialized, legacyHouseNo, legacyPtin);
  const save = (next: PropertyHousePtinPair[]) => onChange(serializePropertyHousePtinPairs(next));
  const patchRow = (id: string, patch: Partial<Pick<PropertyHousePtinPair, 'houseNo' | 'ptin'>>) =>
    save(rows.map(row => row.id === id ? { ...row, ...patch } : row));
  return <section className="house-ptin-pairs" aria-label="House number and PTIN pairs">
    <div className="house-ptin-pairs-heading">
      <h3>House number and PTIN</h3>
      <p>Add one row for each subject house number. Existing values stay in their rows when you add another.</p>
    </div>
    <div className="house-ptin-pairs-list">
      {rows.map((row, index) => <div className="house-ptin-pair-row" key={row.id}>
        <label>
          <span>H.No. {index + 1}</span>
          <input aria-label={`H.No. for PTIN pair ${index + 1}`} value={row.houseNo}
            onChange={event => patchRow(row.id, { houseNo: event.target.value })} placeholder="e.g. 6-1-142" />
        </label>
        <label>
          <span>PTIN Number / Assessment Number {index + 1}</span>
          <input aria-label={`PTIN for H.No. ${index + 1}`} value={row.ptin}
            onChange={event => patchRow(row.id, { ptin: event.target.value })} placeholder="Property tax ID" />
        </label>
        <RecordMove scope="house-ptin" id={row.id} ids={rows.map(item => item.id)} onChange={ids => save(inRecordOrder(rows, ids, item => item.id))} />
        <button type="button" className="quiet house-ptin-remove" aria-label={`Remove H.No./PTIN pair ${index + 1}`}
          onClick={() => save(rows.filter(item => item.id !== row.id))}>Remove</button>
      </div>)}
    </div>
    <button type="button" className="quiet house-ptin-add" onClick={() => save([...rows, newPropertyHousePtinPair()])}>
      + Add H.No./PTIN pair
    </button>
  </section>;
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
    || source.result?.notes.some(note => /could not be read/i.test(note))
    || (source.readMode === 'local' && source.status === 'done' && !source.result?.candidates.length));
  const pending = sources.some(source => source.status === 'queued' || source.status === 'reading');
  const finished = sources.filter(source => source.status === 'done');
  if (!sources.length) return null;
  return <div role="status" className="source-review-status">
    {pending && <p>Reading documents. You can keep editing.</p>}
    {finished.length > 0 && <p>Read: {finished.map(source => source.name).join(', ')}. Check the filled fields against the originals.</p>}
    {needsClearerUpload && <p className="notice">Some details could not be filled. Enter them below or upload a clearer copy.</p>}
  </div>;
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
  role, record, category, step, resolved, edit, label, onDelete, deleteLabel, fallbackValues, hidePartyType, omitConsideration, afterField, groupsOverride, renderField, requireIdentityRelation,
}: {
  role: Role; record: string; category: string; step: number;
  resolved: ReturnType<typeof resolveDraft>; edit: (role: Role, record: string, field: string, value: string) => void;
  label?: string;
  afterField?: (fieldId: string) => React.ReactNode;
  groupsOverride?: import('./fields').Group[];
  renderField?: FieldRenderer;
  fallbackValues?: Record<string, string>;
  hidePartyType?: boolean;
  requireIdentityRelation?: boolean;
  omitConsideration?: boolean;
  /** When set, the first group renders a delete action for this whole record. */
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const groups = (groupsOverride || groupsForStep(step, category)).map(group => ({ ...group, fields: group.fields.map(field => field.id === role + 'Relation' && requireIdentityRelation ? { ...field, label: 'Relation (required)', required: true, hint: 'Choose this principal’s identity relation (S/O, W/O, D/O or C/O), then enter the father’s / relative’s name. Required before downloading the deed.' } : field.id === role + 'Age' && resolved.values[fieldKey(role, record, role + 'Dob')] ? { ...field, derived: true } : field).filter(f => (!hidePartyType || (!f.id.endsWith('PartyType') && !/(?:Guardian|Court|Ward)/.test(f.id))) && (!omitConsideration || f.id !== 'consid')) })).flatMap(group => {
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
  // Party relation must follow the same resolved record used by validation.
  // In particular, imported GPA principals must never display an unsaved S/O.
  const defaults: Record<string, string> = { [`${role}PartyType`]: 'Individual', propState: 'Telangana' };
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
      : (['executionDate', 'stampPaperMargin', 'stampPaperCount', 'stampValue'].includes(f.id) ? resolved.values[fieldKey('property', 'transaction', f.id)] : undefined)
        ?? resolved.values[fieldKey(role, record, f.id)] ?? fallbackValues?.[f.id] ?? defaults[f.id] ?? '';
  if ('stampValue' in form) form.stampValue = stampPaperValue(form);
  const renderGroup = (g: import('./fields').Group) => (
      <FieldGroup
        key={g.title}
        afterField={afterField}
        renderField={renderField}
        group={label ? { ...g, title: `${g.title} — ${label}` } : g}
        form={form}
        setField={(id, v) => id === 'executionDate' ? edit('property', 'transaction', id, v) : edit(role, record, id, v)}
      />
  );
  const propertySheet = role === 'property' && step === 3;
  const boundaries = groups.filter(group => /^(Boundaries|Dimensions)/.test(group.title));
  return <PlacementRecord scope={role} id={record}>
    {propertySheet ? <div className="schedule-sheet-fields">
      <div>{groups.filter(group => group.title === 'Property identification').map(renderGroup)}</div>
      <div>{boundaries.map(renderGroup)}</div>
      {groups.filter(group => group.title !== 'Property identification' && !boundaries.includes(group)).map(renderGroup)}
    </div> : hidePartyType && groups.length === 2 ? <div className="paper-party-fields">{groups.map(renderGroup)}</div> : groups.map(renderGroup)}
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

function TitlePointCard({ option, record, ordinal, form, onField, onUpload, sources, busy, onDelete, instrument, variant, templateSource }: {
  option: (typeof LINK_OPTIONS)[number]; record: string; ordinal?: number; form: Record<string, string>;
  onField: (field: string, value: string) => void; onUpload: (files: File[]) => void;
  sources: Source[]; busy: boolean; onDelete?: () => void;
  instrument: Draft['instrumentId']; variant: string; templateSource: DeedTemplateSource;
}) {
  const visibleFields = option.fields.filter(field => !field.hidden);
  const amendmentValues = { ...form, linkOption: option.id };
  const kind = titleAmendmentKind(amendmentValues);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof loadTitleAmendmentTemplates>>>({});
  const [previewError, setPreviewError] = useState('');
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const active = !!kind;
  useEffect(() => {
    let current = true;
    setTemplates({}); setPreviewError(''); setPreviewLoaded(false);
    if (active) void loadTitleAmendmentTemplates(instrument, variant, templateSource).then(value => { if (current) { setTemplates(value); setPreviewLoaded(true); } }).catch(error => { if (current) setPreviewError(error instanceof Error ? error.message : 'Could not load the selected Word recital.'); });
    return () => { current = false; };
  }, [active, instrument, variant, templateSource]);
  const showLinkEnclosure = option.id === 'linkDoc' || !!kind;
  const label = kind ? titleAmendmentLabel(kind) : option.id === 'linkDoc' ? 'Registered Deed' : option.id === 'permissions' ? 'House Permission' : option.label;
  return <section className="panel link-record" aria-label={`${label} ${ordinal || 1}`} data-record-id={record} data-title-point={option.id} data-title-amendment={kind}>
    <div className="document-card-heading"><span className="document-card-icon"><FileText size={20} aria-hidden="true" /></span><div><h2>{label}{ordinal ? ` ${ordinal}` : ''}</h2><p>Upload pages for this record, or enter its details. Use Add another for a separate document.</p></div><span className="document-source-count">{sources.length ? `${sources.length} source${sources.length === 1 ? '' : 's'}` : 'Manual / upload'}</span></div>
    <DocumentUpload label={`Add ${option.id === 'linkDoc' ? 'a registered deed' : option.label.toLowerCase()}`} busy={busy} multiple onUpload={onUpload} />
    <SourceFeedback sources={sources} visibleFields={visibleFields.map(field => field.id)} />
    {option.id === 'landLayoutLrs' ? [
      ['Vacant Land Tax / Assessment', 'vltNo'],
      ['Approved Layout', 'layoutFileNo'],
      ['LRS 2020 Application', 'lrsApplicationNo', 'lrsApplicationDate'],
      ['LRS Proceeding', 'lrsProceedingNo', 'lrsProceedingDate'],
    ].map(([title, ...ids]) => <FieldGroup key={title} group={{ placementSection: 'link-' + option.id, step: 1, title, note: '', fields: visibleFields.filter(field => ids.includes(field.id)) }} form={form} setField={onField} />)
      : <FieldGroup group={{ placementSection: 'link-' + option.id, step: 1, title: kind ? label + ' details' : option.label, note: kind ? 'Details of this amendment to the original link/title deed.' : option.note, fields: visibleFields }} form={form} setField={onField} />}
    {showLinkEnclosure && <div className="deed-field-grid">
      <label className="deed-field"><span>Document issuing authority</span>
        <select value={form.municipalLinkAuthority} onChange={event => onField('municipalLinkAuthority', event.target.value)}>
          <option value="">Select issuing authority</option>
          {LINK_ISSUING_AUTHORITIES.map(authority => <option key={authority}>{authority}</option>)}
        </select>
      </label>

    </div>}
    {kind && <div className="notice title-amendment-preview" aria-label="Applicable deed recital">
      <strong role="status">{titleAmendmentLabel(kind)} recital selected</strong>
      <p>This record’s document number, date, Sub-Registrar Office and SRO code fill this recital automatically.</p>
      {previewError ? <p role="alert">{previewError}</p> : templates[kind] ? <p className="title-amendment-prose">{titleAmendmentPreview(templates[kind]!, amendmentValues, kind)}</p> : previewLoaded ? <p role="alert">The selected Word template has no {titleAmendmentLabel(kind)} recital. Use the current default or restore that paragraph to include this record.</p> : <p>Loading the selected Word recital…</p>}
      {!(form.linkDocNo || form[kind + 'DeedNo']) && <p>Enter the document number to include this recital in the deed.</p>}
    </div>}
    {onDelete && <IconButton label={`Delete ${option.label} details`} onClick={onDelete} />}
  </section>;
}

/** Keep the add control in view when new cards are inserted above it. */
function addDocumentsInPlace(anchor: HTMLElement, add: () => void, focus?: () => HTMLElement | null) {
  const bottom = anchor.getBoundingClientRect().bottom;
  flushSync(add);
  (anchor.closest('.stage') ?? window).scrollBy({ top: anchor.getBoundingClientRect().bottom - bottom, behavior: 'instant' });
  focus?.()?.focus({ preventScroll: true });
}

/** Select which title points to add; the editable cards appear after selection. */
function AddLinkDocument({ onAdd }: { onAdd: (optionId: string, files: File[]) => void }) {
  const [picking, setPicking] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = (ids: string[]) => {
    if (!anchor.current) return;
    addDocumentsInPlace(anchor.current, () => {
      ids.forEach(id => onAdd(id, []));
      setPicking(false);
    }, () => trigger.current);
  };

  return picking
    ? <div ref={anchor} className="document-picker"><MultiPicker onCancel={() => close([])} onContinue={close} /></div>
    : <div ref={anchor} className="document-add"><span className="document-card-icon"><FolderOpen size={22} aria-hidden="true" /></span><div><h3>Add supporting documents</h3><p>Choose the document type, then upload it or enter its details by hand.</p></div><button ref={trigger} type="button" className="primary" onClick={() => setPicking(true)}>+ Add / upload document</button></div>;
}

/** Checkbox-style tile picker for choosing one or several document types before any upload happens. */
function MultiPicker({ onContinue, onCancel }: { onContinue: (ids: string[]) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return <>
    <div className="add-document-row">
      <span>Which document(s) are you adding? Select as many as you have ready.</span>
      <button type="button" className="quiet" onClick={onCancel}>Cancel</button>
    </div>
    <div className="picker-grid">
      {TITLE_SECTION_IDS.map(id => LINK_OPTIONS.find(o => o.id === id)!).map(o => (
        <button key={o.id} type="button" className={`picker-tile${selected.includes(o.id) ? ' selected' : ''}`} aria-pressed={selected.includes(o.id)} onClick={() => toggle(o.id)}>
          <b>{o.label}</b>
        </button>
      ))}
    </div>
    <button type="button" className="primary" disabled={!selected.length} onClick={() => onContinue(selected)} style={{ marginTop: 10 }}>
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
  const state = appStateFor(draft);
  const ownParty = partyRecords(state, role).find((party, index) => (index ? party.id : (role === 'executant' ? state.primaryExecutantId : state.primaryClaimantId) || 'primary') === record);
  const partyType = (resolved.values[fieldKey(role, record, role + 'PartyType')] || (role === 'executant' && state.saleDocument !== 'ordinary' ? PARTY_CAPACITY_OPTIONS.find(p => p.startsWith('Principal'))! : 'Individual')) as PartyType;
  const primaryMortgageExecutant = state.deedType === 'Deed Of Reconvayance' && role === 'executant' && record === (state.primaryExecutantId || 'primary');
  const bankParty = primaryMortgageExecutant && isBankReconveyance(state) && (partyType === 'Bank' || !ownParty?.values.executantName);
  const entity = isEntity({ [role + 'PartyType']: partyType }, role);
  const people = peopleFor(draft, partyKey(role, record), resolved);
  const society = partyType === 'Society / Association' || partyType === 'Society / Trust';
  const entityFields = partyEntityFields(role, partyType).filter(f => !f.hidden).sort((a, b) => Number(b.id === role + 'EntityName') - Number(a.id === role + 'EntityName'));
  const addressField = (id: string) => /Entity(?:Address|CommunicationAddress|CommunicationSame|HNo|Locality|Village|Mandal|District|State|PinCode|Landmark|BranchOffice)$/.test(id);
  const same = resolved.values[fieldKey(role, record, role + 'EntityCommunicationSame')] === 'Yes';
  const entityForm = Object.fromEntries(entityFields.map(f => [f.id, f.id === role + 'EntityCommunicationAddress' && same ? resolved.values[fieldKey(role, record, role + 'EntityAddress')] || '' : resolved.values[fieldKey(role, record, f.id)] || '']));
  const personList = () => {
    const rows = people.representatives;
    return <Section title={society ? 'Representatives / members' : 'Authorised representatives'}>
      <p>{society ? 'Add each person once and choose a designation, such as President, Vice President or Member. Each person has an independent ID upload and complete address.' : 'Add every person authorised to represent this organisation. Each person has an independent ID upload and complete address.'}</p>
      {rows.map((person, index) => {
        const ownSources = draft.sources.filter(s => s.assignment?.role === 'party-person' && s.assignment.record === person.id);
        const form = Object.fromEntries(PERSON_FIELDS.map(f => [f.id, resolved.values[fieldKey('party-person', person.id, f.id)] || (f.id === 'personRelation' ? 'S/O' : '')]));
        const fields = PERSON_FIELDS.map(field => field.id === 'personDesignation' ? { ...field, type: 'select' as const, allowCustom: true, options: representativeDesignationOptions(partyType), hint: 'Choose a designation or type your own.' } : field.id === 'personAge' && form.personDob ? { ...field, derived: true } : field);
        return <div className="representative-card" key={person.id} data-person-id={person.id}>
          <div className="representative-heading"><RecordMove scope={'people:' + partyKey(role, record)} id={person.id} ids={rows.map(item => item.id)} onChange={ids => dispatch({ type: 'record-order', scope: 'people:' + partyKey(role, record), ids })} /><b>Representative {index + 1}</b><IconButton label={`Delete representative ${index + 1}`} onClick={() => dispatch({ type: 'remove-person', side: role, record, id: person.id })} /></div>
          <ScopedSectionUpload label="representative" busy={ownSources.some(s => s.status === 'reading' || s.status === 'queued')} onUpload={files => upload(files, { role: 'party-person', record: person.id }, 'party-person')} />
          <SourceFeedback sources={ownSources} />
          <FieldGroup group={{ step, title: 'Representative ' + (index + 1) + ' details', cols: 3, fields }} form={form} setField={(id, value) => edit('party-person', person.id, id, value)} />
          {fields.map(f => {
            const key = fieldKey('party-person', person.id, f.id); const conflict = resolved.conflicts[key]; const evidence = resolved.evidence[key];
            return conflict ? <div className="notice" key={key}><b>Review {f.label}</b>{conflict.map(c => <button type="button" key={c.id} className="quiet" onClick={() => choose(key, c.id)}>Use {c.value} — {c.sourceName}</button>)}</div> : evidence?.length ? <small className="person-evidence" key={key}>{f.label}: {evidence[0].sourceName} · {evidence[0].quote}</small> : null;
          })}
        </div>;
      })}
      <button type="button" className="quiet" onClick={() => { const id = crypto.randomUUID(); dispatch({ type: 'add-person', side: role, record, id, kind: 'representativeIds' }); edit('party-person', id, 'personRelation', 'S/O'); }}>+ Add representative</button>
    </Section>;
  };
  return <PlacementRecord scope={role} id={record}><section className="panel party-record-card">
    <div className="party-card-heading"><span className="record-heading-icon">{entity ? <Building2 size={21} aria-hidden="true" /> : <UserRound size={21} aria-hidden="true" />}</span><div><h2>{label || (role === 'executant' ? 'Executant' : 'Claimant')}</h2><p>{(entity ? entityForm[role + 'EntityName'] : resolved.values[fieldKey(role, record, role + 'Name')]) || (role === 'executant' ? 'Party transferring the property rights' : 'Party receiving the property rights')}</p></div><span className="record-kind">{partyType}</span></div>
    {!bankParty && partyType !== 'Bank' && <div className="party-type-selector"><FieldGroup group={{ step, title: 'Party type', fields: GROUPS.flatMap(g => g.fields).filter(f => f.id === role + 'PartyType') }} form={{ [role + 'PartyType']: partyType }} setField={(id, value) => onCapacityChange ? onCapacityChange(value) : edit(role, record, id, value)} /></div>}
    {relationshipFields}
    {primaryMortgageExecutant && <FieldGroup group={{ step, title: 'Bank details', fields: RECONVEYANCE_FIELDS.filter(field => ['bankName','bankBranch','officialDesignation'].includes(field.id)) }} form={state.form} setField={(id,value) => {
      edit('property','primary',id,value);
      if (id === 'bankName' && state.form.mortgagePartyMode === 'person-to-person') edit('property','primary','mortgagePartyMode','');
    }} />}
    {bankParty ? <><ScopedSectionUpload label="bank or representative particulars" busy={busy} onUpload={onUpload} /><SourceFeedback sources={sources} />{personList()}</> : entity ? <>
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
      {personList()}
    </> : <>
      <div className="party-identity-upload"><ScopedSectionUpload label="party identity" busy={busy} onUpload={onUpload} /><SourceFeedback sources={sources} /></div>
      {role === 'claimant' && (partyType === 'Minor' || isMinorParty(ownParty?.values || {}, role)) && <Section title="Assigned guardians">
        <p>Add each guardian as another claimant with Party type Guardian, then select them here. Each guardian’s details are entered on their own card.</p>
        {partyRecords(state, 'claimant').map((party, index) => ({ ...party, id: index ? party.id : state.primaryClaimantId || 'primary' })).filter(party => party.id !== record && (party.values.claimantPartyType || '').startsWith('Guardian')).map(party => <label className="entity-same-address" key={party.id}><input type="checkbox" checked={guardianIds(ownParty?.values || {}).includes(party.id)} onChange={event => { const ids = guardianIds(ownParty?.values || {}); edit(role, record, 'claimantGuardianIds', (event.target.checked ? [...ids, party.id] : ids.filter(id => id !== party.id)).join(',')); }} />{party.values.claimantName || 'Unnamed guardian'}</label>)}
        {guardianIds(ownParty?.values || {}).length > 0 && <button type="button" className="quiet" onClick={() => edit(role, record, 'claimantGuardianIds', '')}>Clear assigned guardians</button>}
        {!partyRecords(state, 'claimant').some(party => (party.values.claimantPartyType || '').startsWith('Guardian')) && <p>No Guardian claimants yet. Use Add blank claimant below.</p>}
      </Section>}
      {role === 'claimant' && partyType.startsWith('Guardian') && <FieldGroup group={{ step, title: 'Guardian relationship', fields: ALL_FIELDS.filter(field => field.id === 'claimantGuardianRelationship') }} form={ownParty?.values || {}} setField={(id, value) => edit(role, record, id, value)} />}
      {role === 'executant' && (isMinorParty(Object.fromEntries(Object.entries(resolved.values).filter(([key]) => key.startsWith(role + '|' + record + '|')).map(([key, value]) => [key.split('|')[2], value])), role) || partyType.startsWith('Guardian')) && <Section title="Minor / guardian representation">
        <p>{partyType.startsWith('Guardian') ? 'The party particulars identify the guardian. Enter the represented minor and the guardian’s relationship below.' : 'The minor remains the party. Enter the guardian’s identity and relationship. Minor executants require court permission for this deed.'}</p>
        {!partyType.startsWith('Guardian') && <ScopedSectionUpload label="guardian Aadhaar / ID" busy={busy} onUpload={files => upload(files, { role, record }, ('guardian:' + role) as ExtractionProfile)} />}
        <FieldGroup group={{ step, title: role === 'executant' ? 'Guardian and court permission' : 'Guardian details', fields: ALL_FIELDS.filter(field => field.id.startsWith(role) && ((partyType.startsWith('Guardian') ? field.id === role + 'GuardianRelationship' || field.id.includes('Ward') : field.id.includes('Guardian')) || (role === 'executant' && field.id.includes('Court')))) }} form={Object.fromEntries(ALL_FIELDS.filter(field => field.id.startsWith(role)).map(field => [field.id, resolved.values[fieldKey(role, record, field.id)] || '']))} setField={(id, value) => edit(role, record, id, value)} />
      </Section>}
      <RecordFieldGroup role={role} record={record} category={category} step={step} resolved={resolved} edit={edit} hidePartyType fallbackValues={{ [role + 'Relation']: ownParty?.values[role + 'Relation'] || '' }} requireIdentityRelation={role === 'executant' && state.saleDocument !== 'ordinary'} afterField={id => id.endsWith('PinCode') ? shareFields : null} />
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

function PartyShareFields({ role, record, parties, schedules, shares, manual, dispatch }: {
  role: 'executant' | 'claimant'; record: string; parties: string[];
  schedules: ReturnType<typeof scheduleRecords>; shares: VendeeSharesBySchedule; manual: Draft['manual']; dispatch: React.Dispatch<Action>;
}) {
  const side = role === 'executant' ? 'Vendor' : 'Vendee';
  return <>{schedules.map((schedule, index) => {
    const value = shares[schedule.id]?.[record] || '';
    const cents = vendeeShareCents(value);
    const invalid = !!value.trim() && cents === null;
    const total = Number(schedule.values.extentSqYards?.replace(/,/g, ''));
    const computed = cents !== null && total > 0 && Number.isFinite(total)
      ? String(Number((total * cents / 10000).toFixed(4))) : '';
    const key = fieldKey(role, record, 'shareExtentSqYards:' + schedule.id);
    return <React.Fragment key={schedule.id}><label className="field">
      <span>Share percentage (%) {schedules.length > 1 ? '— Schedule ' + (index + 1) : '(optional)'}</span>
      <input type="text" inputMode="decimal" value={value}
        aria-label={'Schedule ' + (index + 1) + ' ' + side + ' ' + (parties.indexOf(record) + 1) + ' undivided share percent'}
        aria-invalid={invalid}
        onChange={event => dispatch(role === 'executant'
          ? { type: 'vendor-share', scheduleId: schedule.id, executantId: record, value: event.target.value }
          : { type: 'vendee-share', scheduleId: schedule.id, claimantId: record, value: event.target.value })} />
      <small>{invalid ? 'Enter a percentage greater than 0 and no more than 100, with up to two decimal places.' : 'Leave blank to omit the share clause from the document.'}</small>
    </label>
    {cents !== null && <div className="field">
      <label>
        <span>Share extent (Sq. Yards){schedules.length > 1 ? ' — Schedule ' + (index + 1) : ''}</span>
        <input type="number" min="0" step="any" value={manual[key] ?? computed}
          onChange={event => dispatch({ type: 'manual', key, value: event.target.value })} />
      </label>
      {manual[key] !== undefined && <button type="button" className="quiet"
        onClick={() => dispatch({ type: 'choose', key, candidateId: '' })}>Use calculated extent</button>}
    </div>}
    </React.Fragment>;
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

function ScheduleSwitcher({ records, activeId, onSelect, onReorder }: { records: ReturnType<typeof scheduleRecords>; activeId: string; onSelect: (id: string) => void; onReorder?: (ids: string[]) => void }) {
  if (records.length < 2) return null;
  return <div className="add-document-row" aria-label="Property schedules">
    {records.map((record, index) => <div key={record.id}>{onReorder && <RecordMove scope="property" id={record.id} ids={records.map(item => item.id)} onChange={onReorder} />}<button type="button" className={record.id === activeId ? 'primary' : 'quiet'} onClick={() => onSelect(record.id)}>
      Schedule {index + 1}{record.category ? ` · ${record.category === 'Flat' ? flatLabel(record.values.flatStage) : record.category}` : ''}
    </button></div>)}
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
  const [defaultTemplates, setDefaultTemplates] = useState<Record<string, TemplatePin>>({});
  const [templateLibraryError, setTemplateLibraryError] = useState('');
  const [generationManifest, setGenerationManifest] = useState<GenerationManifest | null>(null);
  const [extractingTemplateFields, setExtractingTemplateFields] = useState(false);
  const [templateFieldMessage, setTemplateFieldMessage] = useState('');
  const templateExtractionGeneration = useRef(0);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [savedDeeds, setSavedDeeds] = useState<SavedDeed[]>([]);
  const [storageError, setStorageError] = useState('');
  const [backupNotice, setBackupNotice] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const backupInput = useRef<HTMLInputElement>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveSequence = useRef(0);
  const skipRestoreSave = useRef(false);
  const current = useRef(draft); current.current = draft;
  const controllers = useRef(new Map<string, AbortController>());
  const cache = useRef(new Map<string, Promise<SourceResult>>());
  const [uploadSteps, setUploadSteps] = useState<Record<string, ExtractStep[]>>({});
  const [activeUpload, setActiveUpload] = useState<{ id: string; label: string; names: string[] } | null>(null);
  const [aiExtraction, setAiExtraction] = useState(() => {
    try { return localStorage.getItem('deedcraft-ai-extraction') !== 'off'; }
    catch { return true; }
  });
  const aiExtractionRef = useRef(aiExtraction);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  // Record ids added via "Add another executant/claimant" before any evidence names them —
  // resolveDraft only lists a record once it has a value, so a freshly added blank/uploading
  // row would otherwise vanish from the step until its first field resolves.
  const [extraPartyRecords, setExtraPartyRecords] = useState<{ executant: string[]; claimant: string[] }>({ executant: [], claimant: [] });
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDocument>>({});
  const [step13PlanDrafts, setStep13PlanDrafts] = useState<Record<string, GuidedPlanDocument>>({});
  const [step13PlanSelectedSvgs, setStep13PlanSelectedSvgs] = useState<Record<string, string>>({});
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
  const [download, setDownload] = useState<{ revision: number; draftId: string; templateKey: string; docx?: Blob; telugu?: Blob; pdf?: Blob; filename: string } | null>(null);
  const [downloadWarning, setDownloadWarning] = useState<{ kind: 'word' | 'telugu' | 'pdf'; reasons: string[]; draftId: string; revision: number; templateKey: string } | null>(null);
  const state = useMemo(() => appStateFor(draft), [draft]);
  const resolved = useMemo(() => resolveDraft(draft), [draft]);
  const isRelease = draft.instrumentId === 'release';
  const isReconveyance = draft.instrumentId === 'reconveyance';
  const municipalGift = isMunicipalGift(state);
  const agreementSaleGpa = draft.instrumentId === 'agreement_of_sale';
  const generalPoa = isGeneralPoa(draft.instrumentId, draft.variantId);
  const instrumentTitle = isRelease ? 'Release Deed' : isReconveyance ? 'Deed Of Reconvayance' : draft.instrumentId === 'power_of_attorney' ? 'General Power of Attorney' : agreementSaleGpa ? 'Agreement of Sale Cum GPA' : draft.instrumentId === 'gift' ? (municipalGift ? 'Municipal Gift' : 'Gift Settlement') : 'Sale Deed';
  // Read-only: only its pure-derived numbers (checks, pct, conversions) are used below.
  // Every real edit goes through `dispatch`/`edit`, never this setter.
  const baseNotices = [...generationBlockers(state), ...(draft.sources.some(s=>s.status==='reading'||s.status==='queued') ? [{id:'pending-uploads',label:'Document verification',reason:'Wait for all uploads to finish verification.',source:'Uploaded documents',step:1}] : [])];
  const recordOptions = (role: Role) => {
    const ids = [...new Set(Object.keys(resolved.values).filter(k => k.startsWith(role + '|')).map(k => k.split('|')[1]))];
    return role === 'link' ? orderedEnclosureIds(ids, draft.linkPropertyRecords, draft.manual) : ids;
  };
  const workflowSteps = stepsFor(state.deedType);
  const step = draft.step;
  const previousStep = adjacentWorkflowStep(state.deedType, step, -1);
  const followingStep = adjacentWorkflowStep(state.deedType, step, 1);
  const displayedStep = workflowSteps.findIndex(item => item.id === step) + 1;

  const repayment = repaymentFor(state);
  const deedDefinition = definitionFor(draft.instrumentId);
  const deedRelease = releaseGate(draft.instrumentId, draft.variantId);
  const bankReconveyance = isBankReconveyance(state);
  const defaultPin = useMemo(() => defaultTemplateForDraft(draft, defaultTemplates, libraryTemplate, bankReconveyance), [draft.instrumentId, draft.variantId, defaultTemplates, libraryTemplate, bankReconveyance]);
  const defaultSource = useMemo<DeedTemplateSource>(() => defaultPin ? { kind: 'library', ...defaultPin } : BUILT_IN_TEMPLATE_SOURCE, [defaultPin]);
  const activeTemplateSource = templateMode === 'custom' && customTemplate ? customTemplate : defaultSource;
  const usesV7 = activeTemplateSource.kind === 'custom' ? !!activeTemplateSource.validation.saleOpenings : activeTemplateSource.kind === 'built-in' || !!activeTemplateSource.saleOpenings;
  const authorityErrors = isRelease ? [...releaseErrors(state), ...salePropertyErrors(state)] : isReconveyance ? reconveyanceErrors(state) : generalPoa ? [...poaRelationshipErrors(state), ...salePropertyErrors(state)] : agreementSaleGpa ? salePropertyErrors(state) : draft.instrumentId === 'gift' ? [...(!municipalGift && !giftRelationshipValues(state).Relationship ? ['Select the relationship of the Donee to the Donor.'] : []), ...salePropertyErrors(state), ...(municipalGift ? scheduleRecords(state).flatMap(record => MUNICIPAL_GIFT_CATEGORIES.includes(record.category) ? [] : ['Municipal Gift supports open place, plot, dismantled house and part open place only.']) : [])] : [...saleAuthorityErrors(state), ...(usesV7 ? salePropertyErrors(state) : []), ...(!usesV7 && state.saleDocument && state.saleDocument !== 'ordinary' ? ['Choose or upgrade to the v7 template for sale through GPA/AGPA.'] : [])];
  const generationReady = deedRelease.ready;
  const minorDownloadErrors = mergeValues(state)['Minor Representation Errors'] || '';
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
  const templateKey = `${draft.instrumentId}:${draft.variantId}:${DEED_PRESERVATION_VERSION}:${activeTemplateSource.kind === 'custom' ? `custom:${activeTemplateSource.hash}:${canonicalContract(fieldContract)}` : activeTemplateSource.kind === 'library' ? `library:${activeTemplateSource.versionId}:${activeTemplateSource.packageHash || activeTemplateSource.hash}` : 'built-in'}`;
  const activeTemplateKeyRef = useRef(templateKey); activeTemplateKeyRef.current = templateKey;
  useEffect(() => { templateExtractionGeneration.current++; setExtractingTemplateFields(false); setTemplateFieldMessage(''); }, [templateKey, draft.id]);
  const hasStarted = draft.revision > 0 || !!libraryTemplate || !!customTemplate || templateMode === 'custom'
    || !!Object.keys(step13PlanDrafts).length || !!Object.keys(planDrafts).length || !!Object.keys(referencePlanDrafts).length
    || !!Object.keys(selectedPlanSvgs).length;
  const snapshot = (): SavedDeed => ({
    id: draft.id,
    name: savedDeeds.find(deed => deed.id === draft.id)?.name,
    updatedAt: new Date().toISOString(),
    claimantNames: [...new Set(partyRecords(state, 'claimant').map(p => partyDisplayName(p.values, 'claimant')).filter(Boolean))],
    deedType: deedDefinition.label,
    draft,
    sourceFiles: Object.fromEntries(Object.entries(sourceFiles).filter(([id]) => draft.sources.some(source => source.id === id))),
    planDrafts, referencePlanDrafts, step13PlanDrafts, step13PlanSelectedSvgs, selectedPlanSvgs, extraPartyRecords,
    templateMode, customTemplate, libraryTemplate: defaultPin || null,
    generationManifest,
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
  }, [loadingLibrary, libraryView, draft, sourceFiles, planDrafts, referencePlanDrafts, step13PlanDrafts, step13PlanSelectedSvgs, selectedPlanSvgs, extraPartyRecords, templateMode, customTemplate, templateKey, generationManifest]);
  const templateRefresh = useRef(0);
  async function refreshPublishedTemplate() {
    const request = ++templateRefresh.current;
    try {
      const listing = await listTemplates();
      if (request !== templateRefresh.current) return;
      requireCurrentDeedRules(listing);
      setDefaultTemplates(Object.fromEntries(Object.entries(listing.active).flatMap(([family, id]) => {
        const revision = listing.versions.find(item => item.id === id && item.publishedAt && libraryFamilyFor(item.instrumentId, item.variantId) === family);
        return revision ? [[family, pinFor(revision)]] : [];
      })));
      setTemplateLibraryError('');
    } catch (error: any) { if (request === templateRefresh.current) setTemplateLibraryError(error.message); }
  }
  useEffect(() => {
    void refreshPublishedTemplate();
    const refresh = () => { void refreshPublishedTemplate(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    if (loadingLibrary) return;
    for (const deed of savedDeeds) {
      if (!libraryView && deed.id === draft.id) continue;
      const updated = updateSavedDeedTemplate(deed, defaultTemplates);
      if (updated !== deed) void persist(updated).catch(() => {});
    }
  }, [loadingLibrary, defaultTemplates, libraryView]);
  useEffect(() => {
    if (templateMode !== 'built-in' || !defaultPin || !libraryTemplate || !templateIsEarlier(libraryTemplate, defaultPin)) return;
    setLibraryTemplate(defaultPin);
    setGenerationManifest(null);
  }, [defaultPin, templateMode, libraryTemplate]);
  const goto = (s: number) => {
    dispatch({ type: 'step', step: s });
    requestAnimationFrame(() => {
      document.getElementById('workspace-title')?.focus({ preventScroll: true });
      document.getElementById('workspace-main')?.scrollTo({ top: 0, behavior: 'instant' });
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
  const visibleSavedDeeds = savedDeeds.filter(deed => [deed.name, deed.deedType, ...deed.claimantNames, ...partyRecords(appStateFor(deed.draft), 'claimant').map(p => partyDisplayName(p.values, 'claimant'))].join(' ').toLowerCase().includes(deedSearch.toLowerCase())).sort((a, b) => deedSort === 'type' ? a.deedType.localeCompare(b.deedType) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const featuredDeed = savedDeeds.reduce<SavedDeed | undefined>((latest, deed) =>
    !latest || Date.parse(deed.updatedAt) > Date.parse(latest.updatedAt) ? deed : latest, undefined);
  const featuredProgress = libraryView && featuredDeed ? buildViewModel(appStateFor(featuredDeed.draft), () => {}).pct : 0;
  const nextStep = workflowSteps.find(s => s.id <= 8 && !vm.doneIds.includes(s.id)) || STEPS[8];
  const edit = (role: Role, record: string, field: string, value: string) => {
    if (role === 'property' && ['stampPaperMargin', 'stampPaperCount', 'stampValue'].includes(field)) record = 'transaction';
    if (field === 'stampPaperCount' && value && !/^\d{1,3}$/.test(value)) return;
    const sro = resolveSroSelection(field, value);
    if (sro) {
      dispatch({ type: 'manual', key: fieldKey(role, record, sro.nameField), value: sro.name });
      dispatch({ type: 'manual', key: fieldKey(role, record, sro.codeField), value: sro.code });
      setDownload(null);
      return;
    }
    value = normalizePropertyPlaceName(field, value, true);
    value = uppercasePartyIdentity(field, value);
    if (field === 'consid' && hasPaymentStep(state.deedType)) {
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
  const previousSourceIds = useRef(new Set<string>());
  useEffect(() => {
    const retained = new Set(draft.sources.map(source => source.id));
    for (const id of previousSourceIds.current) {
      if (!retained.has(id)) controllers.current.get(id)?.abort();
    }
    previousSourceIds.current = retained;
  }, [draft.sources]);

  /** Reads one ordered source bundle, binding it to one record so it never spills into another. */
  async function runUpload(files: File[], assignment?: { role: Role; record: string; propertyRecord?: string }, profile: ExtractionProfile = 'general') {
    if (!files.length) return;
    const local = !aiExtractionRef.current;
    const templateKeyAtUpload = activeTemplateKeyRef.current;
    const sourceId = crypto.randomUUID();
    setSourceFiles(old => ({ ...old, [sourceId]: files }));
    const draftId = current.current.id;
    controllers.current.get(sourceId)?.abort();
    const controller = new AbortController(); controllers.current.set(sourceId, controller);
    const option = profile.startsWith('phase1:') ? LINK_OPTIONS.find(item => item.id === profile.slice('phase1:'.length)) : undefined;
    if (!local) setActiveUpload({
      id: sourceId,
      label: option?.label || (assignment?.role === 'executant' ? 'Executant ID' : assignment?.role === 'claimant' ? 'Claimant ID' : 'Document'),
      names: files.map(file => file.name),
    });
    const valid = () => !controller.signal.aborted && current.current.id === draftId && (assignment?.role !== 'party-person' || Object.values(current.current.partyPeople || {}).some(p => [...p.representativeIds, ...p.memberIds].includes(assignment.record)));
    const job = (patch: any) => dispatch({ type: 'job', draftId, sourceId, sourceRevision: 0, patch });
    dispatch({ type: 'add', source: { id: sourceId, revision: 0, name: files.map(file => file.name).join(' · '), hash: '', status: 'queued', assignment, profile, readMode: local ? 'local' : undefined } });
    if (!local) setUploadSteps(s => ({ ...s, [sourceId]: [] }));
    const started = performance.now();
    try {
      await (local ? localFileQueue : fileQueue).run(async () => {
        if (!valid()) return;
        job({ status: 'reading' });
        const hash = await fileHash(files);
        if (!valid()) return;
        job({ hash });
        const reconveyance = current.current.instrumentId === 'reconveyance';
        const key = JSON.stringify([draftId, hash, EXTRACTION_VERSION, profile, local, reconveyance, files.map(file => file.name)]);
        let result: SourceResult;
        const report: Parameters<typeof extractUpload>[2] = event => {
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
        };
        if (cache.current.has(key)) result = await cache.current.get(key)!;
        else if (local) {
          const { extractLocally } = await import('./local-upload-extraction');
          result = await extractLocally(files, controller.signal, () => {}, profile, reconveyance);
        } else {
          result = await extractUpload(files, controller.signal, report, result => { if (valid()) job({ result }); }, profile);
        }
        if (valid()) {
          if (result.candidates.length > 0 && result.candidates.every(c => c.status === 'accepted') && result.notes.length === 0) cache.current.set(key, Promise.resolve(result));
          if (local) {
            job({ status: 'done', result, durationMs: performance.now() - started, error: undefined });
            return;
          }
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
      }, controller.signal);
    } catch (error: any) {
      if (valid()) {
        if (!local) setUploadSteps(s=>({...s,[sourceId]:(s[sourceId]||[]).map(step=>step.state==='running'||step.state==='queued'?{...step,state:'error' as const}:step)}));
        job({ status: 'error', error: error.message || 'This upload could not be read.' });
      }
    } finally {
      controllers.current.delete(sourceId);
    }
  }
  function retryUpload(source: Source) {
    const files = sourceFiles[source.id];
    if (!files?.length) { setMessage('The original upload is unavailable. Please upload the file again.'); return; }
    controllers.current.get(source.id)?.abort();
    dispatch({ type: 'remove', id: source.id });
    setSourceFiles(old => { const next = { ...old }; delete next[source.id]; return next; });
    void runUpload(files, source.assignment, (source.profile || 'general') as ExtractionProfile);
  }
  const uploadFor = (role: Role, record: string, profile?: ExtractionProfile, propertyRecord = activePropertyId) => (files: File[]) => {
    const scoped = profile || (role === 'executant' ? 'party:executant' : role === 'claimant' ? 'party:claimant' : 'general');
    if (scoped === 'phase1:linkDoc' || scoped === 'jurisdiction' || scoped === 'property-schedule'
      || scoped.startsWith('party:') || scoped.startsWith('guardian:') || scoped === 'party-person') {
      void runUpload(files, { role, record, ...(role === 'link' ? { propertyRecord } : {}) }, scoped);
    } else {
      for (const file of files) void runUpload([file], { role, record, ...(role === 'link' ? { propertyRecord } : {}) }, scoped);
    }
  };
  async function runTemplateExtraction(files: File[], record: TemplateRecord, existingSource?: Source) {
    if (!aiExtractionRef.current) {
      setTemplateFieldMessage('Enter additional template fields manually while AI extraction is off.');
      const role = record.scope === 'executant' || record.scope === 'claimant' ? record.scope : 'property';
      if (!existingSource) void runUpload(files, { role, record: record.id });
      return;
    }
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
    if (!aiExtractionRef.current) {
      setTemplateFieldMessage('Enter additional template fields manually while AI extraction is off.');
      return;
    }
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
  /** Adding a document always creates a separate, property-scoped record. */
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
    const existing = recordOptions(role);
    const base = existing.includes('primary') ? ['primary', ...existing.filter(record => record !== 'primary')] : existing.length ? existing : ['primary'];
    return inRecordOrder([...base, ...extraPartyRecords[role].filter(r => !base.includes(r))], draft.recordOrder?.[role], id => id);
  };
  /** The files selected together on this control describe one new party. */
  const addPartyRecord = (role: 'executant' | 'claimant') => (files: File[]) => {
    // Persist even untouched blank cards so numbering and share checks use the
    // same parties as the UI, including after a draft is reopened.
    if (!recordOptions(role).length) dispatch({ type: 'add-party', role, record: 'primary' });
    const record = crypto.randomUUID();
    dispatch({ type: 'add-party', role, record });
    setExtraPartyRecords(s => ({ ...s, [role]: [...s[role], record] }));
    if (files.length) void runUpload(files, { role, record }, role === 'executant' ? 'party:executant' : 'party:claimant');
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
    setUploadSteps({}); setActiveUpload(null); setDownload(null); setMessage(''); setExtraPartyRecords({ executant: [], claimant: [] });
    setPendingReviews([]); setStep13PlanDrafts({}); setStep13PlanSelectedSvgs({}); setPlanDrafts({}); setReferencePlanDrafts({}); setSelectedPlanSvgs({}); setSourceFiles({});
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
      clearTransient();
      const nextDraft = newDraft();
      setLibraryTemplate(defaultTemplateForDraft(nextDraft, defaultTemplates) || null);
      dispatch({ type: 'load', draft: nextDraft });
      setTemplatesView(false); setLibraryView(false);
      void refreshPublishedTemplate();
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
    setStep13PlanDrafts(deed.step13PlanDrafts || {});
    setStep13PlanSelectedSvgs(deed.step13PlanSelectedSvgs || {});
    setSelectedPlanSvgs(deed.selectedPlanSvgs || {});
    setExtraPartyRecords(deed.extraPartyRecords || { executant: [], claimant: [] });
    setTemplateMode(deed.templateMode || 'built-in');
    setCustomTemplate(deed.customTemplate || null);
    setLibraryTemplate(deed.libraryTemplate || null);
    setGenerationManifest(deed.generationManifest || null);
    setTemplatesView(false);
    setLibraryView(false);
  }

  function duplicateSaved(deed: SavedDeed, displayName: string) {
    const copy = structuredClone(deed);
    copy.id = crypto.randomUUID();
    copy.draft.id = copy.id;
    copy.name = `Copy of ${displayName}`;
    copy.updatedAt = new Date().toISOString();
    copy.generationManifest = null;
    void persist(copy).catch(() => {});
  }

  function renameSaved(deed: SavedDeed) {
    const name = window.prompt('Rename saved document', deed.name)?.trim();
    if (name && name !== deed.name) void persist({ ...deed, name }).catch(() => {});
  }

  async function removeSaved(deed: SavedDeed) {
    if (!window.confirm(`Delete ${deed.name || deed.claimantNames.join(', ') || 'Unnamed deed'}? This removes the saved deed and its uploaded files.`)) return;
    try {
      await saveQueue.current.catch(() => {});
      await deleteDeed(deed.id);
      setSavedDeeds(old => old.filter(item => item.id !== deed.id));
      setStorageError('');
    } catch (error: any) { setStorageError(`Deed could not be deleted: ${error?.message || String(error)}`); }
  }

  async function exportSavedBackup() {
    setBackupBusy(true); setStorageError(''); setBackupNotice('');
    try {
      await saveQueue.current;
      const deeds = await listSavedDeeds();
      saveBlob(await createDeedBackup(deeds), `DeedCraft-saved-deeds-${new Date().toISOString().slice(0, 10)}.json`);
      setBackupNotice(`Exported ${deeds.length} saved ${deeds.length === 1 ? 'deed' : 'deeds'} with uploaded files and custom templates.`);
    } catch (error: any) { setStorageError(`Backup could not be exported: ${error?.message || String(error)}`); }
    finally { setBackupBusy(false); }
  }

  async function importSavedBackup(file?: File) {
    if (!file) return;
    setBackupBusy(true); setStorageError(''); setBackupNotice('');
    try {
      await saveQueue.current;
      const existing = await listSavedDeeds();
      const result = await readDeedBackup(file, existing);
      if (result.deeds.length) await saveDeeds(result.deeds);
      setSavedDeeds(await listSavedDeeds());
      setBackupNotice(`Imported ${result.deeds.length} saved ${result.deeds.length === 1 ? 'deed' : 'deeds'}. ${result.skipped} already present. ${result.copies} conflicting ${result.copies === 1 ? 'deed was' : 'deeds were'} kept as separate copies.`);
    } catch (error: any) { setStorageError(`Backup could not be imported: ${error?.message || String(error)}`); }
    finally { setBackupBusy(false); if (backupInput.current) backupInput.current.value = ''; }
  }

  const propertyIds = [...new Set(['primary', ...draft.propertyIds, ...Object.keys(resolved.values).filter(k => k.startsWith('property|') && !k.startsWith('property|transaction|')).map(k => k.split('|')[1])])];
  const activePropertyId = propertyIds.includes(draft.activePropertyId) ? draft.activePropertyId : 'primary';
  const activePropertyIndex = propertyIds.indexOf(activePropertyId);
  const activePlanDraft = step13PlanDrafts[activePropertyId];
  const activePlanSelection = step13PlanSelectedSvgs[activePropertyId];
  const isActivePlanSelected = !!activePlanSelection && activePlanSelection === selectedPlanSvgs[activePropertyId];
  const omitActivePlanSelection = (old: Record<string, string>) => {
    if (!(activePropertyId in old)) return old;
    const next = { ...old };
    delete next[activePropertyId];
    return next;
  };
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
  const includeTypingStamp = (draft.manual.includePreparedBy ?? 'true') === 'true';
  const hasSavedTypingDetails = ['typingStampName', 'typingStampPlace', 'typingStampMobile']
    .some(key => Object.hasOwn(draft.manual, key));
  const typingDetails = hasSavedTypingDetails ? {
    typingStampName: draft.manual.typingStampName ?? '',
    typingStampPlace: draft.manual.typingStampPlace ?? '',
    typingStampMobile: draft.manual.typingStampMobile ?? '',
  } : {
    typingStampName: 'Gundlapelli Sampath',
    typingStampPlace: 'Sircilla',
    typingStampMobile: '9866270006',
  };
  function editTypingDetail(key: keyof typeof typingDetails, value: string) {
    if (!hasSavedTypingDetails) {
      for (const [otherKey, otherValue] of Object.entries(typingDetails)) {
        if (otherKey !== key) dispatch({ type: 'manual', key: otherKey, value: otherValue });
      }
    }
    dispatch({ type: 'manual', key, value });
  }
  const typingName = typingDetails.typingStampName.trim().toLocaleUpperCase('en-IN');
  const typingMobile = typingDetails.typingStampMobile.trim();
  const typingStamp = includeTypingStamp && typingName && isMobileNumber(typingMobile)
    ? { name: typingName, mobile: typingMobile, place: typingDetails.typingStampPlace }
    : undefined;

  async function generate(kind: 'word' | 'telugu' | 'pdf', confirmedReasons?: string[]) {
    const allowIncomplete = confirmedReasons !== undefined;
    const isWord = kind !== 'pdf';
    const reasons = [...new Set([
      ...(confirmedReasons || []),
      ...notices.map(item => item.reason),
      ...(isWord ? [
        ...(includeTypingStamp && !typingStamp ? ['Enter the name and a 10-digit mobile number to include the Typed By stamp.'] : []),
        ...deedRelease.reasons, ...authorityErrors, ...templateFieldErrors, ...minorDownloadErrors.split('\n').filter(Boolean),
        ...(!templateReady ? [...(customTemplate?.validation.errors || ['No compatible custom Word template is selected.']), 'The download will try the default template for this deed.'] : []),
      ] : previews.map(preview => preview.error).filter(Boolean)),
    ])];
    const warn = (issues: string[]) => setDownloadWarning({ kind, reasons: issues, draftId: draft.id, revision: draft.revision, templateKey });
    if (reasons.length && !allowIncomplete) { warn(reasons); return; }
    if (isWord) {
      try { requireCurrentDeedRules(await listTemplates()); }
      catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not confirm the current deed rules. Retry when the shared dashboard is available.');
        return;
      }
    }
    const snapshot = draft; setExporting(true); setMessage('');
    try {
      const filename = deedFilename(state, savedDeeds.find(deed => deed.id === snapshot.id)?.name);
      const templateSource = templateReady ? activeTemplateSource : defaultSource;
      let artifact = download?.draftId === snapshot.id && download.revision === snapshot.revision && download.templateKey === templateKey
        ? { ...download, filename } : { draftId: snapshot.id, revision: snapshot.revision, templateKey, filename };
      if (isWord && !artifact.docx) {
        const deedValues = mergeValues(state);
        const inputSnapshotHash = await sha256(new TextEncoder().encode(JSON.stringify({ deedValues, typingStamp, saleAuthority: snapshot.saleAuthority, scheduleMerges, selectedPlanSvgs, templateFieldData: templateFieldResolution.data })));
        const render = async (source: DeedTemplateSource) => renderArtifact(compileDeed({
          instrumentId: snapshot.instrumentId, variantId: snapshot.variantId, snapshotHash: inputSnapshotHash, values: deedValues,
          schedules: scheduleMerges, rewrites: rewritesFor(state),
          unresolvedWarnings: [...reasons, ...templateFieldResolution.instances.filter(instance => !instance.value).map(instance => `${instance.field.label}: write-in blank`)],
          templateFieldData: templateFieldResolution.data,
        }, source, allowIncomplete), 'docx', source);
        const { result: merged, manifest } = await render(templateSource).catch(error => {
          if (!allowIncomplete || templateSource.kind === 'built-in') throw error;
          reasons.push(`The selected Word template could not be rendered. Using the default template. ${error.message}`);
          return templateSource.kind !== 'custom' ? render(BUILT_IN_TEMPLATE_SOURCE) : render(defaultSource).catch(() => render(BUILT_IN_TEMPLATE_SOURCE));
        });
        const reviewed = await Promise.all(propertyRecords.flatMap((record, index) =>
          selectedPlanSvgs[record.id] ? [{ schedule: index + 1, svg: selectedPlanSvgs[record.id] }] : []
        ).map(async plan => {
          try { return [{ schedule: plan.schedule, png: await planPng(plan.svg) }]; }
          catch (error) { if (!allowIncomplete) throw error; return []; }
        })).then(pages => pages.flat());
        artifact = { ...artifact, docx: await appendRegistrationPlans(merged.blob, reviewed, typingStamp) };
        const outputHash = await sha256(new Uint8Array(await artifact.docx.arrayBuffer()));
        if (current.current.id !== snapshot.id || current.current.revision !== snapshot.revision || activeTemplateKeyRef.current !== templateKey) {
          setMessage('The deed or its template changed during generation. Download again to use the current version.');
          return;
        }
        setGenerationManifest({ ...manifest, outputHash });
      }
      if (kind === 'pdf' && !artifact.pdf) {
        const pngs = await Promise.all(previews.map(async preview => {
          try {
            if (preview.error) throw new Error(preview.error);
            return await planPng(preview.svg);
          } catch (error) { if (!allowIncomplete) throw error; return null; }
        }));
        const pdf = await planPdf(pngs);
        artifact = { ...artifact, pdf };
      }
      if (kind === 'telugu' && !artifact.telugu) {
        const { translateDeedToTelugu } = await import('./telugu-deed');
        const fields = Object.entries(resolved.values);
        const identifiers = fields.flatMap(([key, value]) =>
          /(?:aadhaar|pan|phone|mobile|account|reference|no|code)$/i.test(key)
            && !/(?:address|street|locality|village|mandal|district)/i.test(key) ? [value] : []);
        const namesAndPlaces = fields.flatMap(([key, value]) =>
          /(?:name|village|mandal|district|locality|bank|branch|sro)$/i.test(key) && !/(?:address|street)/i.test(key)
            ? [value] : []);
        if (typingStamp) {
          identifiers.push(deedMobile(typingStamp.mobile));
          namesAndPlaces.push(typingStamp.name, typingStamp.place);
        }
        artifact = { ...artifact, telugu: await translateDeedToTelugu(artifact.docx!, identifiers, undefined, namesAndPlaces) };
        if (current.current.id !== snapshot.id || current.current.revision !== snapshot.revision
          || activeTemplateKeyRef.current !== templateKey) {
          setMessage('The deed changed during translation. Download the Telugu copy again for the current draft.');
          return;
        }
      }
      setDownload(artifact);
      if (kind === 'telugu') {
        saveBlob(artifact.telugu!, artifact.filename.replace(/\.docx$/i, ' Telugu.docx'));
        setMessage('Downloaded the Telugu Word draft. Compare the translation with the English deed before signing or registration.');
        return;
      }
      saveBlob(kind === 'word' ? artifact.docx! : artifact.pdf!, kind === 'word' ? artifact.filename : artifact.filename.replace(/\.docx$/, '-plan.pdf'));
      const outstandingCount = reasons.length + templateFieldResolution.instances.filter(instance => !instance.value).length;
      setMessage(outstandingCount ? `Downloaded an incomplete draft with ${outstandingCount} outstanding items. Review and complete it before signing or registration.` : 'Downloaded using the current verified and manually entered details.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (kind === 'telugu') {
        setMessage(`Telugu Word download could not be prepared: ${reason}`);
      } else if (!allowIncomplete) {
        warn([...reasons, reason]);
      } else if (kind === 'word') {
        const { Document, Packer, Paragraph } = await import('docx');
        const fields = new Map([...ALL_FIELDS, ...PERSON_FIELDS, ...RECONVEYANCE_FIELDS].map(field => [field.id, field.label]));
        const stampTotal = formatDeedAmount(stampPaperValue(state.form));
        const details = Object.entries(resolved.values).flatMap(([key, value]) => {
          const [role, record, field] = key.split('|');
          const label = fields.get(field);
          const printed = /(?:mobile|phone)$/i.test(field) ? deedMobile(value) : value;
          return label && field !== 'stampValue' && printed.trim() ? [new Paragraph({ text: `${role} ${record} / ${label}: ${printed}` })] : [];
        });
        if (stampTotal) details.push(new Paragraph({ text: `Stamp paper value (₹): ${stampTotal}` }));
        const blob = await Packer.toBlob(new Document({ sections: [{ children: [
          new Paragraph({ text: `${deedDefinition.label} — Incomplete draft details`, heading: 'Heading1' }),
          new Paragraph('The deed template could not be rendered. Review and complete the draft before use.'),
          ...[...new Set([...reasons, reason])].map(text => new Paragraph(text)), ...details,
        ] }] }));
        saveBlob(await appendRegistrationPlans(blob, [], typingStamp), deedFilename(state, savedDeeds.find(deed => deed.id === draft.id)?.name).replace(/\.docx$/, ' Incomplete Details.docx'));
        setMessage('Downloaded the entered details as a Word file because the deed template could not be rendered.');
      } else {
        setMessage(`Download could not be prepared: ${reason}`);
      }
    }
    finally { setExporting(false); }
  }

  async function chooseTemplate(file?: File) {
    if (!file) return;
    const validationRevision = ++templateValidationRevision.current;
    setValidatingTemplate(true); setDownload(null); setMessage('');
    try {
      if (file.size > MAX_CUSTOM_TEMPLATE_BYTES) {
        if (customTemplate?.validation.valid) { setMessage('The replacement is larger than 20 MB. Your existing template and entered details are retained.'); return; }
        setCustomTemplate({
          kind: 'custom', name: file.name, hash: `oversized:${file.size}`, bytes: new Uint8Array(),
          validation: { valid: false, errors: ['The template is larger than 20 MB.'], detectedPlaceholders: [], omittedPlaceholders: [] },
        });
        return;
      }
      const [buffer, hash] = await Promise.all([file.arrayBuffer(), fileHash(file)]);
      const bytes = new Uint8Array(buffer);
      const compatibleContract = fieldContract;
      const validation = await validateDeedTemplate(bytes, draft.instrumentId || 'sale', draft.variantId, file.name, compatibleContract);
      if (validationRevision !== templateValidationRevision.current) return;
      if (!validation.valid && customTemplate?.validation.valid) {
        setMessage(`The replacement was not applied. ${validation.errors.join(' ')} Your existing template and entered details are retained.`);
        return;
      }
      setCustomTemplate({ kind: 'custom', name: file.name, hash, bytes, validation, fieldContract: compatibleContract });
    } catch (error: any) {
      if (validationRevision !== templateValidationRevision.current) return;
      if (!customTemplate?.validation.valid) setCustomTemplate(null);
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
      const bytes = await templateBytes(defaultSource);
      saveBlob(new Blob([bytes as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `DeedCraft-${isRelease ? 'Release' : isReconveyance ? 'Reconveyance' : generalPoa ? 'General-Power-of-Attorney' : agreementSaleGpa ? 'Agreement-of-Sale-Cum-GPA' : draft.instrumentId === 'gift' ? 'Gift' : 'Sale'}-Deed-Template.docx`);
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
  };
  const confirmUnverified = (review: PendingReview, value: string) => {
    const target = reviewTarget(review);
    if (target) edit(target.role, target.record, target.field, value);
    setPendingReviews(queue => queue.filter(item => item.id !== review.id));
  };
  const dismissUnverified = () => setPendingReviews(queue => queue.slice(1));
  const localUploads = draft.sources.filter(source => source.readMode === 'local');
  const localReadsInProgress = localUploads.filter(source => source.status === 'queued' || source.status === 'reading');

  return <TemplatePlacementSurface step={libraryView || templatesView ? -1 : step} activePropertyId={activePropertyId} draft={draft} contract={fieldContract} instances={templateFieldResolution.instances} dispatch={dispatch} onExtract={(files, record) => void runTemplateExtraction(files, record)} onReadSaved={() => void readSavedTemplateFields()} onCancel={cancelTemplateExtraction} sourceFiles={sourceFiles} busy={extractingTemplateFields} message={templateFieldMessage}><div className={`wizard-app modern-workspace${showFieldHelp ? ' show-field-help' : ''}`} data-theme={theme}>
    {downloadWarning && downloadWarning.draftId === draft.id && downloadWarning.revision === draft.revision && downloadWarning.templateKey === templateKey &&
        <dialog className="download-warning-dialog" ref={element => { if (element && !element.open) element.showModal(); }}
          onCancel={() => setDownloadWarning(null)} aria-labelledby="download-warning-title">
          <h2 id="download-warning-title">Review download issues</h2>
          <ul>{downloadWarning.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
          {downloadWarning.kind === 'word' && <p>If the selected template cannot be rendered, the download will use the deed’s default template when available or include the entered details for review.</p>}
          {downloadWarning.kind === 'telugu' && <p>The Telugu copy requires a renderable Word deed and uses the app’s AI service to translate the deed text.</p>}
          <button type="button" autoFocus onClick={() => setDownloadWarning(null)}>Cancel</button>
          {notices.length > 0 && <button type="button" onClick={() => { setDownloadWarning(null); goto(8); }}>Find details to fix</button>}
          <button type="button" className="primary" onClick={() => {
            const { kind, reasons } = downloadWarning;
            setDownloadWarning(null);
            void generate(kind, reasons);
          }}>Download Anyway</button>
        </dialog>}
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
      <div className="saved-deeds-heading"><div><h1>Saved deeds</h1><p>{savedDeeds.length} saved {savedDeeds.length === 1 ? 'deed' : 'deeds'} · Stored in this browser</p></div><button type="button" className="primary" disabled={creatingDeed} aria-busy={creatingDeed} onClick={() => void createDeed()}><Plus size={16} aria-hidden="true" />{creatingDeed ? 'Preparing…' : 'New deed'}</button></div>
      {storageError && <p className="notice" role="alert">{storageError}</p>}
      {savedDeeds.length > 0 && <div className="paper-library-grid"><section className="paper-library-list"><h2>Your drafts</h2>
      {savedDeeds.length > 0 && <div className="library-toolbar"><label className="deed-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search saved deeds by name or deed type</span><input type="search" value={deedSearch} onChange={e => setDeedSearch(e.target.value)} placeholder="Search by party name or deed type…" /></label><label className="library-sort"><span>Sort by</span><select aria-label="Sort by" value={deedSort} onChange={e => setDeedSort(e.target.value)}><option value="recent">Recently edited</option><option value="type">Deed type</option></select></label></div>}
      {savedDeeds.length > 0 && !visibleSavedDeeds.length && <p role="status">No deeds match “{deedSearch}”. <button type="button" className="quiet" onClick={() => setDeedSearch('')}>Clear search</button></p>}
      <div className="saved-deeds-list">{visibleSavedDeeds.map(deed => {
        const name = deed.name || partyRecords(appStateFor(deed.draft), 'claimant').map(p => partyDisplayName(p.values, 'claimant')).filter(Boolean).join(', ') || deed.claimantNames?.join(', ') || `Untitled ${deed.deedType.toLowerCase()}`;
        return <article className="saved-deed-card" key={deed.id}><div className="saved-deed-symbol" aria-hidden="true"><FileText size={26} strokeWidth={1.5} /></div>
          <div><h2>{name}</h2><p>{deed.draft.instrumentId === 'agreement_of_sale' ? 'Agreement of Sale Cum GPA' : deed.deedType} · Last edited {new Date(deed.updatedAt).toLocaleString('en-IN')}</p><div className="saved-deed-meta"><span title="Source documents" aria-label={`${deed.draft.sources.length} source documents`}><Files size={13} aria-hidden="true" />{deed.draft.sources.length}</span><span title="Last viewed step"><ListChecks size={13} aria-hidden="true" />{STEPS[normalizeWorkflowStep(deed.draft.instrumentId, deed.draft.step)]?.label || 'Overview'}</span><span>{savedTemplateStatus(deed, defaultTemplates).label}{savedTemplateStatus(deed, defaultTemplates).earlier ? ' · Updating to current default' : ''}</span></div></div>
          <div className="saved-deed-actions" role="group" aria-label="Deed actions"><button type="button" className="primary" onClick={() => openSaved(deed)}>Continue / Edit</button><details className="paper-draft-menu"><summary aria-label={`More actions for ${name}`}>•••</summary><div><button type="button" onClick={() => duplicateSaved(deed, name)}>Duplicate This Document</button>{deed.name && <button type="button" onClick={() => renameSaved(deed)}>Rename</button>}<IconButton label={`Delete ${deed.claimantNames?.join(', ') || 'deed'}`} onClick={() => void removeSaved(deed)} /></div></details></div>
        </article>; })}
      </div></section>
        {featuredDeed && <aside className="paper-featured-draft" aria-label="Most recently edited deed">
          <div className="paper-featured-top"><span>Recently edited</span><span>{featuredDeed.deedType}</span></div>
          <div className="paper-document-preview" aria-hidden="true"><div><b>D</b><strong>{featuredDeed.deedType}</strong><span /><span /><span /></div></div>
          <div className="paper-featured-info">
            <h2>{featuredDeed.name || featuredDeed.claimantNames?.join(', ') || `Untitled ${featuredDeed.deedType.toLowerCase()}`}</h2>
            <p>{STEPS[normalizeWorkflowStep(featuredDeed.draft.instrumentId, featuredDeed.draft.step)]?.label || 'Draft overview'}</p>
            <label>Draft progress <strong>{featuredProgress}%</strong><progress max={100} value={featuredProgress} /></label>
            <button type="button" className="primary" onClick={() => openSaved(featuredDeed)}>Resume draft →</button>
          </div>
        </aside>}
      </div>}
      {loadingLibrary ? <p role="status">Loading saved deeds…</p> : savedDeeds.length === 0 && <section className="library-empty"><div className="empty-document"><FileText size={32} strokeWidth={1.5} aria-hidden="true" /></div><p className="eyebrow">FROM DOCUMENTS TO A DRAFT</p><h2>Your next deed starts here</h2><p>Bring your documents, review the details, and prepare your deed in one guided workspace.</p><button type="button" className="primary" disabled={creatingDeed} aria-busy={creatingDeed} onClick={() => void createDeed()}>{creatingDeed ? 'Preparing your workspace…' : 'Create your first deed'} <ArrowRight size={17} aria-hidden="true" /></button><small>Your entries are saved automatically as you work.</small><ol className="getting-started"><li><b>01</b><span><strong>Set up your deed</strong>Choose the instrument and property type.</span></li><li><b>02</b><span><strong>Add & review details</strong>Upload documents or enter details manually.</span></li><li><b>03</b><span><strong>Review & download</strong>Resolve open checks and generate your deed.</span></li></ol></section>}
      <details className="paper-library-tools"><summary>Saved-deed backups and help</summary>
      <div className="library-toolbar"><button type="button" disabled={backupBusy || loadingLibrary} onClick={() => void exportSavedBackup()}>Export saved-deeds backup</button><input ref={backupInput} type="file" hidden accept=".json,application/json" onChange={event => void importSavedBackup(event.target.files?.[0])} /><button type="button" disabled={backupBusy || loadingLibrary} onClick={() => backupInput.current?.click()}>Import saved-deeds backup</button><small>The backup includes deed details, uploaded files and custom templates. Keep the file private when moving it to another computer.</small></div>
      {backupNotice && <p role="status">{backupNotice}</p>}
        <GettingStartedGuide />
      </details>
    </main> : <div className="shell" data-step={step}>
      <WorkflowNavigation steps={workflowSteps} current={step} completed={vm.doneIds} attention={notices.map(notice => notice.step)} title={deedDefinition.label} onNavigate={goto} />

      <main id="workspace-main" tabIndex={-1} className="stage">
        {storageError && <p className="notice" role="alert">{storageError}</p>}
        {draft.sources.filter(source => source.error?.includes('Reading was interrupted')).map(source => <div className="notice" key={source.id} role="alert">Upload interrupted: {source.name}. <button type="button" onClick={() => retryUpload(source)}>Retry upload</button></div>)}
        <header className="compact-step-header">
          <div className="stage-head"><div className="step-title-line"><h1 id="workspace-title" tabIndex={-1}>{step < 0 ? 'Draft overview' : STEPS[step].label}</h1><span className="step-position">{step < 0 ? 'Overview' : `Step ${displayedStep} of ${workflowSteps.length}`}</span></div>{step !== 9 && <p>{step >= 0 ? STEPS[step].sub : `Everything you need to prepare your ${deedDefinition.label.toLowerCase()}, in one place.`}</p>}
          {step >= 0 && step < 8 && notices.some(issue => issue.step === step) && <div className="step-quick-actions"><a href="#step-review">Details to check</a></div>}</div>
        </header>
        {step >= 1 && step <= 8 && <div className="extraction-mode">
          <label>
            <input type="checkbox" role="switch" checked={aiExtraction} aria-describedby="extraction-mode-description"
              onChange={event => {
                const enabled = event.target.checked;
                aiExtractionRef.current = enabled;
                setAiExtraction(enabled);
                try { localStorage.setItem('deedcraft-ai-extraction', enabled ? 'on' : 'off'); } catch { /* Storage may be disabled. */ }
              }} />
            AI extraction
          </label>
          <span id="extraction-mode-description">{aiExtraction ? 'On · Cloud extraction' : 'Off · Local reading uses no AI credits'}</span>
        </div>}
        {!!localReadsInProgress.length && <p role="status" className="notice">
          {localReadsInProgress.length === 1 ? 'Reading 1 upload on this device.' : 'Reading ' + localReadsInProgress.length + ' uploads on this device.'} You can keep editing.
        </p>}
        {localUploads.length > 0 && <details className="notice local-upload-list">
          <summary>Local uploads and results ({localUploads.length})</summary>
          <ul>{localUploads.map(source => <li key={source.id}>
            <strong>{source.name}</strong>
            {(source.status === 'queued' || source.status === 'reading') && <p>{source.status === 'queued' ? 'Waiting to be read' : 'Reading on this device'}</p>}
            {(source.status === 'queued' || source.status === 'reading') &&
              <button type="button" className="quiet" onClick={() => {
                controllers.current.get(source.id)?.abort();
                dispatch({ type: 'job', draftId: draft.id, sourceId: source.id, sourceRevision: source.revision, patch: { status: 'error', error: 'Reading cancelled.' } });
              }}>Cancel reading {source.name}</button>}
            {source.error && <p>{source.error}</p>}
            {source.result?.notes.map((note, index) => <p key={index}>{note}</p>)}
            {(sourceFiles[source.id] || []).map((file, index) =>
              <button type="button" className="quiet" key={index} onClick={() => saveBlob(file, file.name)}>Download {file.name}</button>)}
            {!aiExtraction && !!(sourceFiles[source.id]?.length && (source.error || source.result?.candidates.some(candidate => candidate.status === 'uncertain'))) &&
              <button type="button" className="quiet" onClick={() => retryUpload(source)}>Read {source.name} again</button>}
          </li>)}</ul>
        </details>}
        {step >= 0 && step !== 9 && <ScreenGuide key={step} step={step} gift={draft.instrumentId === 'gift'} municipal={municipalGift} showFieldHelp={showFieldHelp} onFieldHelpChange={setShowFieldHelp} />}
        {[-1, 3, 6, 7, 8].includes(step) && <TemplateAdditionalFields draft={draft} contract={fieldContract} instances={templateFieldResolution.instances.filter(instance => !instance.field.placement)} dispatch={dispatch} onExtract={(files, record) => void runTemplateExtraction(files, record)} onReadSaved={() => void readSavedTemplateFields()} onCancel={cancelTemplateExtraction} sourceFiles={sourceFiles} busy={extractingTemplateFields} message={templateFieldMessage} filterScope={step === 3 ? 'property' : step === 6 ? 'executant' : step === 7 ? 'claimant' : undefined} />}
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

          <div className="dashboard-stats">
            <div><span className="metric-icon"><Files size={20} aria-hidden="true" /></span><strong>{vm.filled}<span> / {vm.applicableCount}</span></strong><span>Applicable fields entered</span></div>
            <div><span className="metric-icon"><CircleCheck size={20} aria-hidden="true" /></span><strong>{workflowSteps.filter(s => s.id <= 8 && vm.doneIds.includes(s.id)).length}<span> / {workflowSteps.filter(s => s.id <= 8).length}</span></strong><span>Drafting steps complete</span></div>
            <div><span className="metric-icon"><ListChecks size={20} aria-hidden="true" /></span><strong>{vm.openCount}</strong><span>Readiness checks open</span></div>
          </div>
          <div className="paper-overview-grid">
          <section className="dashboard-section" aria-labelledby="workflow-title">
            <div className="dashboard-section-head"><div><p className="eyebrow">WORKFLOW</p><h2 id="workflow-title">Your drafting steps</h2></div><span>Choose any step to continue</span></div>
            {[1, 2, 3, 4].map(phase => <div className="dashboard-phase" key={phase}>
              <h3><span className="phase-icon">{phase === 1 ? <FolderOpen size={17} aria-hidden="true" /> : phase === 2 ? <LayoutGrid size={17} aria-hidden="true" /> : phase === 3 ? <Users size={17} aria-hidden="true" /> : <CircleCheck size={17} aria-hidden="true" />}</span><span>{['', 'Setup & sources', !hasPaymentStep(state.deedType) ? 'Property' : 'Property & payment', 'Parties', 'Review & finish'][phase]}</span><i /></h3>
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
          <div className="paper-overview-side">
          <section className="dashboard-section dashboard-readiness" aria-labelledby="readiness-title">
            <div className="dashboard-section-head"><div><p className="eyebrow">FINAL REVIEW</p><h2 id="readiness-title">Readiness checks</h2></div><span>{vm.openCount === 0 ? 'All checks complete' : `${vm.openCount} still open`}</span></div>
            <ul className="checks">{vm.checks.map((c: any) => <li key={c.label} className={c.ok ? 'ok' : ''}><span className="mark">{c.mark}</span><span><b>{c.label}</b><small>{c.note}</small></span></li>)}</ul>
            <button type="button" className="review-shortcut" onClick={() => goto(8)}><span className="review-shortcut-icon"><Check size={20} aria-hidden="true" /></span><span><strong>{notices.length ? `${notices.length} details need a closer look` : 'Ready for a final review'}</strong><small>{notices.length ? 'See outstanding details, grouped by drafting section.' : 'Read through your deed and confirm the details.'}</small></span><ArrowRight size={20} aria-hidden="true" /></button>
          </section>
          <div className="dashboard-details">
          <section className="dashboard-section" aria-label="Party summaries"><h2>Parties and representatives</h2>{(['executant', 'claimant'] as const).flatMap(side => partyRecords(state, side).map((party, index) => {
            const id = index === 0 ? (side === 'executant' ? state.primaryExecutantId : state.primaryClaimantId) || 'primary' : party.id;
            const count = state.partyPeopleByParty?.[partyKey(side, id)]?.representatives.length || 0;
            const open = notices.filter(n => n.step === (side === 'executant' ? 6 : 7)).length;
            return <div className="party-summary" key={side + id}><b>{partyDisplayName(party.values, side) || 'Unnamed ' + side}</b><span>{party.values[side + 'PartyType'] || 'Individual'}{isEntity(party.values, side) ? ' · ' + count + ' representative(s)' : ''} · {open ? open + ' outstanding details on this side' : 'Complete'}</span><button type="button" className="quiet" onClick={() => goto(side === 'executant' ? 6 : 7)}>Edit {side}</button></div>;
          }))}</section></div>
          </div>
          </div>
        </div>}

        {step === 0 && <div className="setup-step">
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onReorder={ids => dispatch({ type: 'record-order', scope: 'property', ids })} onSelect={id => dispatch({ type: 'active-property', id })} />
          <div className="paper-setup-columns">
          <section className="setup-card" aria-labelledby="setup-deed-title">
            <div className="workflow-section-heading"><div><h2 id="setup-deed-title">Deed &amp; draft form</h2><p>Select the legal instrument and the form to use.</p></div></div>
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
          <section className="setup-card" aria-labelledby="setup-property-title">
            <div className="workflow-section-heading"><div><h2 id="setup-property-title">Property type <span lang="te">ఆస్తి రకం</span></h2><p>Choose the property covered by this schedule.</p></div></div>
            <div className="setup-card-content"><PlacementSlot sectionId="setup-property" anchorFieldId="category" position="before" /><IconButton label={`Delete property schedule ${activePropertyIndex + 1}`} onClick={() => dispatch({ type: 'remove-record', role: 'property', record: activePropertyId })} />
              <ScheduleTypeControl municipal={municipalGift} key={activePropertyId} scheduleNumber={activePropertyIndex + 1} category={propertyRecords.find(record => record.id === activePropertyId)?.category || ''} stage={propertyRecords.find(record => record.id === activePropertyId)?.values[propertyRecords.find(record => record.id === activePropertyId)?.category === 'Flat' ? 'flatStage' : 'houseStage'] || ''} onChange={(value, stage) => { edit('property', activePropertyId, 'category', value); if (stage) edit('property', activePropertyId, value === 'Flat' ? 'flatStage' : 'houseStage', stage); }} /><PlacementSlot sectionId="setup-property" anchorFieldId="category" position="after" /><PlacementSlot sectionId="setup-property" /></div>
          </section>
          </div>
          <p className="workflow-footnote">Your choices carry forward to the document and property sections.</p>
        </div>}

        {isRelease && [4,8].includes(step) && <ReleaseFields state={state} draft={draft} dispatch={dispatch} schedules={propertyRecords} onValue={(id,value)=>edit('property','primary',id,value)} />}
        {isReconveyance && [4,8].includes(step) && <section className="panel repayment-panel" aria-label="Reconveyance repayment">
          <header>
            <h2>Reconveyance repayment</h2>
            <p>The repayment total combines principal and interest from the linked mortgages. You can adjust the principal below.</p>
          </header>
          <div className="repayment-breakdown">
            <div>
              <label className="field">
                <strong>Total Principal Amount (₹)</strong>
                <input inputMode="decimal" aria-describedby="repayment-principal-source" value={repayment.overridden ? formatMoneyInput(state.form.principalOverride) : formatDeedAmount(repayment.principal)} onChange={event => edit('property','primary','principalOverride',event.target.value.replace(/,/g, ''))} />
              </label>
              <p id="repayment-principal-source">{repayment.overridden ? 'Manual principal' : 'Automatic principal'} · Link-document total ₹{formatDeedAmount(repayment.linkTotal) || '—'}</p>
              <button className="repayment-reset" type="button" onClick={() => edit('property','primary','principalOverride','')}>Use link-document total</button>
            </div>
            <div>
              <label className="field">
                <strong>Total Interest Amount (₹)</strong>
                <input readOnly aria-describedby="repayment-interest-source" value={formatDeedAmount(repayment.interest)} />
              </label>
              <p id="repayment-interest-source">Calculated from the mortgage records.</p>
            </div>
          </div>
          <label className="repayment-total">
            <span>Total Amount (₹)</span>
            <input readOnly value={formatDeedAmount(repayment.total)} />
          </label>
        </section>}
        {municipalGift && [0, 8].includes(step) && <section className="panel" aria-label="Municipal Gift details"><h2>Municipal Gift</h2><p>Enter the recipient in Claimant Details, including their identity, address and representatives where applicable.</p><p><strong>Claimant:</strong> {partyRecords(state, 'claimant').map(record => partyDisplayName(record.values, 'claimant')).filter(Boolean).join(', ') || 'Complete Claimant Details.'}</p><p>Supports open place, plot, dismantled house and part open place.</p></section>}
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
        {authorityErrors.length > 0 && step === 8 && <details className="notice" open><summary>Complete document details ({authorityErrors.length})</summary><ul>{authorityErrors.map(error => <li key={error}>{error}</li>)}</ul><button type="button" onClick={() => goto(6)}>Open Executants and authority</button><button type="button" onClick={() => goto(0)}>Choose property type and stage</button></details>}
        {step === 1 && (() => {
          const scope = 'link:' + activePropertyId;
          const records = inRecordOrder(recordOptions('link').filter(record => propertyForLinkRecord(record) === activePropertyId), draft.recordOrder?.[scope], id => id);
          const activeProperty = propertyRecords.find(record => record.id === activePropertyId);
          const category = activeProperty?.category || '';
          const options = TITLE_SECTION_IDS.map(id => LINK_OPTIONS.find(option => option.id === id)!);
          const sectionRecords = (id: string) => records.filter(record => {
            const saved = resolved.values[fieldKey('link', record, 'linkOption')] || 'linkDoc';
            return saved === id || (id === 'landLayoutLrs' && ['vacantTax', 'approvedLayout', 'lrsApplication', 'lrsProceeding', 'layoutLrs'].includes(saved))
              || (id === 'houseTax' && saved === 'assessment');
          });
          return <div className="documents-step">
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onReorder={ids => dispatch({ type: 'record-order', scope: 'property', ids })} onSelect={id => dispatch({ type: 'active-property', id })} />
          <section className="property-context" aria-label="Selected property type">
            <span className="document-card-icon"><LayoutGrid size={20} aria-hidden="true" /></span>
            <div><span className="property-context-label">Schedule {activePropertyIndex + 1} · Property type</span><strong>{category ? category === 'Flat' ? flatLabel(activeProperty?.values.flatStage) : category : 'Property type not selected'}</strong></div>
            <button type="button" className="quiet" onClick={() => goto(0)}>{category ? 'Change property type in Step 1' : 'Choose property type in Step 1'}</button>
          </section>
          {!category ? <Empty>Choose this schedule's property type in Step 1 to add its documents.</Empty> : <>
          <div className="documents-intro"><div><h2>Documents for this property</h2><p>Upload a Link Document here once. It can also fill jurisdiction, property and valuation fields. Check the filled details, and add other records only if they apply.</p></div><span>{records.length} document{records.length === 1 ? '' : 's'} added</span></div>
          {records.map(record => {
            const option = options.find(item => sectionRecords(item.id).includes(record));
            if (!option) return null;
                const form = Object.fromEntries([...option.fields.map(field => field.id), 'municipalLinkAuthority', 'municipalLinkEnclosure'].map(field => [field, resolved.values[fieldKey('link', record, field)] || '']));
                if (option.id === 'houseTax' && !form.bltNo) form.bltNo = resolved.values[fieldKey('link', record, 'assessmentPtinNo')] || '';
                const ensureRecord = () => {
                  if (!resolved.values[fieldKey('link', record, 'linkOption')]) {
                    dispatch({ type: 'link-property', record, propertyId: activePropertyId });
                    edit('link', record, 'linkOption', option.id);
                  }
                };
                return <div key={record}><RecordMove scope={scope} id={record} ids={records} onChange={ids => dispatch({ type: 'record-order', scope, ids })} /><TitlePointCard ordinal={sectionRecords(option.id).indexOf(record) + 1} option={isReconveyance && option.id === 'linkDoc' ? { ...option, fields: option.fields.map(field => ['mortgageAmount','mortgageInterestAmount'].includes(field.id) ? { ...field, hidden: false } : field) } : option.id === 'houseTax' ? { ...option, fields: option.fields.filter(field => !['bearingHNo', 'bltNo', 'assessmentPtinNo'].includes(field.id)) } : option} record={record} form={form}
                  instrument={draft.instrumentId} variant={draft.variantId} templateSource={activeTemplateSource}
                  onField={(field, value) => { ensureRecord(); edit('link', record, field, value); }}
                  onUpload={files => { ensureRecord(); void runUpload(files, { role: 'link', record, propertyRecord: activePropertyId }, `phase1:${option.id}` as ExtractionProfile); }}
                  sources={draft.sources.filter(source => source.assignment?.role === 'link' && source.assignment.record === record)}
                  busy={!!sourceBusyFor('link', record)}
                  onDelete={() => clearLinkRecord(record)} />
              {sectionRecords(option.id).at(-1) === record && <div className="add-document-row"><button type="button" className="quiet" onClick={event => addDocumentsInPlace(event.currentTarget, () => addLinkDocuments(option.id, []))}>+ Add another {option.label}</button></div>}
            </div>;
          })}
          {(HOUSE_PTIN_PAIR_CATEGORIES.includes(category) || category === 'Flat' || sectionRecords('houseTax').length > 0) && <section className="panel" aria-label="Property tax identification">
            <HousePtinPairsEditor
              serialized={housePtinPairsForSources({ ...activeProperty?.values, category }, state.linkRecordsBySchedule?.[activePropertyId] || [])}
              legacyHouseNo={(['Part open place', 'Demolished'].includes(category) ? activeProperty?.values.nearHNo || activeProperty?.values.bearingHNo : activeProperty?.values.bearingHNo) || ''}
              legacyPtin={activeProperty?.values.bltNo || ''}
              onChange={value => edit('property', activePropertyId, 'housePtinPairs', value)}
            />
          </section>}
          {category === 'Flat' && (flatStage(activeProperty?.values.flatStage) === 'Semi-Finished' || ['sale', 'agreement_of_sale'].includes(draft.instrumentId)) && <section className="panel flat-agreement-documents" aria-label="Landowner–developer agreements">
            <h2>Landowner–developer agreements</h2>
            <ScopedSectionUpload label="development / supplemental agreement" busy={!!sourceBusyFor('property', activePropertyId)} onUpload={files => void runUpload(files, { role: 'property', record: activePropertyId }, 'flat-agreements')} />
            <SourceFeedback sources={draft.sources.filter(source => source.profile === 'flat-agreements' && source.assignment?.record === activePropertyId)} />
            <PlacementRecord scope="property" id={activePropertyId}><FieldGroup group={{ ...GROUPS.find(group => group.title === 'Landowner–developer agreements')!, step: 1, title: 'Development & flat-allotment registration', placementSection: 'flat-agreement-documents', note: '' }} form={Object.fromEntries(['flatStage', ...GROUPS.find(group => group.title === 'Landowner–developer agreements')!.fields.map(field => field.id)].map(field => [field, resolved.values[fieldKey('property', activePropertyId, field)] || '']))} setField={(field, value) => edit('property', activePropertyId, field, value)} /></PlacementRecord>
          </section>}
          <AddLinkDocument onAdd={addLinkDocuments} />
          </>}
        </div>;
        })()}

        {step >= 2 && <div className={`workflow-step workflow-step-${step}`}>
        {step === 2 && <LinkStageGate status={linkStageStatus('step3')} loading="Extracting jurisdiction from the property documents…">
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onReorder={ids => dispatch({ type: 'record-order', scope: 'property', ids })} onSelect={id => dispatch({ type: 'active-property', id })} />
          <ScopedSectionUpload label="Jurisdiction" busy={!!sourceBusyFor('property', activePropertyId)} onUpload={files => void runUpload(files, { role: 'property', record: activePropertyId }, 'jurisdiction')} />
          <SourceFeedback sources={draft.sources.filter(source => source.profile === 'jurisdiction' && source.assignment?.record === activePropertyId)} visibleFields={GROUPS.filter(group => group.step === 2).flatMap(group => group.fields.map(field => field.id))} />
          <section className="panel"><SourceFeedback sources={draft.sources.filter(s => s.assignment?.role === 'link' && (s.assignment.propertyRecord || 'primary') === activePropertyId)} visibleFields={GROUPS.filter(g => g.step === 2).flatMap(g => g.fields.map(f => f.id))} /><RecordFieldGroup role="property" record={activePropertyId} category={propertyRecords.find(record => record.id === activePropertyId)?.category || ''} step={2} resolved={resolved} edit={edit} /></section>
        </LinkStageGate>}

        {step === 3 && <LinkStageGate status={linkStageStatus('step4')} loading="Extracting the property schedule from the property documents…">
          <div className="paper-schedule-sheet">
          <ScopedSectionUpload label="Property Schedule" busy={!!sourceBusyFor('property', activePropertyId)} onUpload={files => void runUpload(files, { role: 'property', record: activePropertyId }, 'property-schedule')} />
          <div className="paper-schedule-tabs">
          {propertyRecords.length === 1 && <span className="paper-current-schedule">Schedule 1</span>}
          <ScheduleSwitcher records={propertyRecords} activeId={activePropertyId} onReorder={ids => dispatch({ type: 'record-order', scope: 'property', ids })} onSelect={id => dispatch({ type: 'active-property', id })} />
            <button type="button" className="quiet" onClick={addProperty}>+ Add another property</button>
          </div>
          <SourceFeedback sources={draft.sources.filter(source => source.profile === 'property-schedule' && source.assignment?.record === activePropertyId)} visibleFields={[...GROUPS.filter(group => group.step === 3).flatMap(group => group.fields.map(field => field.id)), ...PROPERTY_DIMENSIONS.fields.map(field => field.id), 'category', 'unit']} />
          {propertyRecords.filter(record => record.id === activePropertyId).map(record => {
            const id = record.id;
            const merge = activeScheduleMerge;
            const i = activePropertyIndex;
            const multipleProperties = propertyRecords.length > 1;
            const propertyGroups = groupsForStep(3, record.category).map(group => ({
              ...group,
              fields: group.fields.filter(field => !(isFinishedHouse(record.category, record.values.houseStage) && ['nearAdjacent', 'nearHNo'].includes(field.id))),
            })).filter(group => group.fields.length);
            const boundaries = propertyGroups.map(group => group.title.startsWith('Boundaries')).lastIndexOf(true);
            propertyGroups.splice(boundaries + 1, 0, PROPERTY_DIMENSIONS);
            const sectionNames = [...propertyGroups.map(group => group.title), ...(isHouseCategory(record.category) ? ['Structure Details'] : [])];
            return <section className="panel property-schedule-card" key={record.id}>
              <div className="property-card-heading"><span className="record-heading-icon"><House size={21} aria-hidden="true" /></span><div><h2>{multipleProperties ? `Schedule ${i + 1} · Property details` : 'Property details'}</h2><p>Identification, extent and boundaries for this schedule</p></div><span className="record-kind">Schedule {i + 1}</span><IconButton label={`Delete property schedule ${i + 1}`} onClick={() => dispatch({ type: 'remove-record', role: 'property', record: id })} /></div>
              <ScheduleTypeControl municipal={municipalGift} scheduleNumber={i + 1} category={record.category} stage={record.values[record.category === 'Flat' ? 'flatStage' : 'houseStage'] || ''} onChange={(value, stage) => { edit('property', id, 'category', value); if (stage) edit('property', id, value === 'Flat' ? 'flatStage' : 'houseStage', stage); }} />
              {multipleProperties && <div className="add-document-row"><IconButton icon={Pencil} label={`Edit documents for property ${i + 1}`} onClick={() => { dispatch({ type: 'active-property', id }); goto(1); }} /></div>}
              <SourceFeedback sources={draft.sources.filter(s => s.assignment?.role === 'link' && (s.assignment.propertyRecord || 'primary') === id)} visibleFields={[...GROUPS.filter(g => g.step === 3).flatMap(g => g.fields.map(f => f.id)), 'category', 'unit']} />
              <ReviewQueue sources={draft.sources.filter(s => s.assignment?.role === 'link' && (s.assignment.propertyRecord || 'primary') === id)} record={id} edit={edit} />
              <nav className="paper-form-index" aria-label="Property schedule sections">
                {sectionNames.map(title => <button key={title} type="button" onClick={event => {
                  const sheet = event.currentTarget.closest('.property-schedule-card');
                  const heading = Array.from(sheet?.querySelectorAll<HTMLElement>('.deed-section h2') ?? [])
                    .find(item => item.textContent?.trim().startsWith(title));
                  if (!heading) return;
                  heading.tabIndex = -1;
                  heading.focus({ preventScroll: true });
                  heading.scrollIntoView({ block: 'start' });
                }}>{title.replace('Property identification', 'Identification').replace('Structure & Annexure I-A', 'Annexure I-A').replace('Landowner–developer agreements', 'Development agreements')}</button>)}
              </nav>
              <RecordFieldGroup role="property" record={id} category={record.category} step={3} groupsOverride={propertyGroups} resolved={resolved} edit={edit}
                fallbackValues={{ bearingHNo: record.values.bearingHNo || '' }} />

              {isHouseCategory(record.category) && <StructureDetailsTable
                value={state.structureDetailsBySchedule[id] || newStructureDetails()}
                defaultRoof={record.values.roofMaterial || ''}
                authority={record.values.localAuthorityType || ''}
                onChange={value => dispatch({ type: 'structure-details', propertyId: id, value })}
                onNotice={setMessage}
              />}
              {merge && <details className="property-wording"><summary><FileText size={16} aria-hidden="true" /><span>Preview schedule wording<small>Read the generated property description</small></span></summary><Section title="Schedule of property" telugu="ఆస్తి వివరణ"><SchedulePreview merge={templateBoundPreview.schedules[activePropertyIndex] || merge} templateSource={activeTemplateSource} /></Section></details>}
            </section>;
          })}
          {propertyRecords.length === 0 && <Empty>No property identified yet. Fill in property details above first.</Empty>}
          </div>
        </LinkStageGate>}

        {step === 4 &&
          <RecordFieldGroup role="property" record="primary" step={4} category={propertyRecords[0]?.category || ''} resolved={resolved} edit={edit}
            groupsOverride={GROUPS.filter(group => group.fields.some(field => field.id === 'stampPaperMargin'))} />}

        {step === 4 && !isRelease && !isReconveyance && <LinkStageGate status={combinedMarketStatus} loading="Extracting market value from the property documents…">
          <section className="panel"><h2>Combined market value</h2>
            <SourceFeedback sources={draft.sources.filter(s => s.assignment?.role === 'link')} visibleFields={GROUPS.filter(g => g.step === 4).flatMap(g => g.fields.map(f => f.id))} />
            {propertyRecords.map((record, index) => <div key={record.id} style={index ? { marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.rule}` } : undefined}>
              {propertyRecords.length > 1 && <h3 style={{ margin: '0 0 10px', fontFamily: C.serif, color: C.ink }}>Schedule {index + 1}{record.category ? ` — ${record.category}` : ''}</h3>}
              <RecordFieldGroup role="property" record={record.id} category={record.category} step={4} omitConsideration={draft.instrumentId === 'gift'} resolved={resolved} edit={edit}
                renderField={isHouseCategory(record.category) ? (field, value) => field.id === 'structValue' ? <div>
                  <input aria-label={field.label} inputMode="decimal" value={formatMoneyInput(record.values.structValue ?? value)}
                    onChange={event => edit('property', record.id, STRUCTURE_VALUATION_OVERRIDE, event.target.value.replace(/,/g, ''))} />
                  {draft.manual[fieldKey('property', record.id, STRUCTURE_VALUATION_OVERRIDE)]?.trim() && <button type="button" className="quiet"
                    onClick={() => edit('property', record.id, STRUCTURE_VALUATION_OVERRIDE, '')}>Use calculated valuation</button>}
                </div> : undefined : undefined}
                groupsOverride={groupsForStep(4, record.category).filter(group => !group.fields.some(field => field.id === 'stampPaperMargin'))
                  .map(group => isHouseCategory(record.category) ? { ...group, fields: group.fields.map(field => field.id === 'structValue' ? { ...field, label: 'Structure Valuation (₹)', hint: 'Uses the total of priced structure rows. Enter an amount to override it.' } : field) } : group)} />
            </div>)}
            <div aria-live="polite"><h3>Total Consideration MV</h3><strong>{vm.persayINR || 'Enter the land extent and basic rate for each schedule.'}</strong></div>
          </section>
          {draft.instrumentId === 'gift' ? <section className="panel"><h2>Gift document value</h2><p>Enter the consideration / declared value to print in every total market-value and estimate field. The Gift itself remains without monetary consideration (Nil).</p><FieldGroup group={{ step: 4, title: 'Declared value', fields: [{ ...ALL_FIELDS.find(field => field.id === 'consid')!, label: 'Consideration / declared document value (₹)' }] }} form={state.form} setField={(id, value) => edit('property', 'primary', id, value)} /></section> : <><section className="panel" aria-label="Consideration value">
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

        {step === 5 && hasPaymentStep(state.deedType) && <section className="panel payments">
          <div className="finish-section-heading"><span className="finish-heading-icon"><CreditCard size={22} aria-hidden="true" /></span><div><h2>Payment summary</h2><p>Add each payment separately. Upload proof to read its details, or enter them below.</p></div></div>
          <div className="payment-summary-grid"><div><span>Sale consideration</span><strong>{vm.considINR || 'Not entered'}</strong><button type="button" className="quiet" onClick={() => goto(4)}>Edit consideration <ArrowRight size={13} aria-hidden="true" /></button></div><div><span>Payments recorded</span><strong>{vm.paidINR || '₹0'}</strong><small>{state.payments.length} payment {state.payments.length === 1 ? 'record' : 'records'}</small></div><div className={vm.payMatched ? 'is-reconciled' : ''}><span>{vm.payMatched ? 'Reconciliation' : 'Balance remaining'}</span><strong>{!state.form.consid.trim() ? 'Awaiting value' : vm.payMatched ? 'Matched' : vm.balanceINR || '₹0'}</strong><small>{vm.payMatched ? 'Payments match the consideration' : 'Compare payments with the sale consideration'}</small></div></div>
          <div className="payment-list-heading"><h3>Payment records</h3><span>Choose a method for each payment</span></div>
          {!state.payments.length && <div className="payment-empty"><CreditCard size={22} aria-hidden="true" /><div><strong>No payment records yet</strong><p>Choose a payment method below to add the first record.</p></div></div>}
          {state.payments.map((p, i) => (
            <div key={p.id}><RecordMove scope="payment" id={p.id} ids={state.payments.map(item => item.id)} onChange={ids => dispatch({ type: 'record-order', scope: 'payment', ids })} /><PaymentCard index={i} payment={p} canRemove={true}
              onLocalUpload={aiExtraction ? undefined : files => void runUpload(files, { role: 'payment', record: p.id }, `payment:${p.mode}`)}
              onPatch={patch => patchPayment(p.id, patch)} onRemove={() => removePayment(p.id)} /></div>
          ))}
          <AddPayment onAdd={addPayment} remaining={vm.balanceINR ? `Balance remaining: ${vm.balanceINR}` : ''} />
          <div className="payment-total">
            <span>Consideration: {vm.considINR || '—'}</span>
            <span>Paid so far: {vm.paidINR || '—'}</span>
            <span className={vm.payMatched ? 'ok' : ''}>{!state.form.consid.trim() ? 'Reconciliation pending: enter sale consideration' : vm.payMatched ? 'Reconciled with consideration' : vm.balanceINR ? `Short by ${vm.balanceINR}` : ''}</span>
          </div>
        </section>}

        {(step === 6 || step === 7) && (() => {
          const role: 'executant' | 'claimant' = step === 6 ? 'executant' : 'claimant';
          const noun = isRelease || isReconveyance ? (step === 6 ? 'Releasor' : 'Releasee') : generalPoa ? step === 6 ? 'Principal' : 'Attorney' : step === 6 ? 'Executant' : 'Claimant';
          const combined = !isRelease && !isReconveyance && role === 'executant' && state.saleDocument !== 'ordinary';
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
              const card = <PartyRecordCard key={record} role={role} record={record} category={state.category} step={step} resolved={resolved} edit={edit}
                onCapacityChange={combined ? value => { if (!busySource) void changeCapacity(record, value); } : undefined}
                relationshipFields={generalPoa && role === 'claimant' && isFamilyPoa(state) && <div className="poa-relationship-fields">
                    <label className="field"><span>Relationship to principal(s)</span><select aria-label="Relationship to principal(s)" required value={resolved.values[fieldKey(role, record, 'poaRelationship')] || ''} onChange={event => edit(role, record, 'poaRelationship', event.target.value)}>
                      <option value="">Choose family relationship</option>{POA_RELATIONSHIPS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}<option value="other">Other family relationship</option>
                    </select></label>
                    {resolved.values[fieldKey(role, record, 'poaRelationship')] === 'other' && <label className="field"><span>Family relationship wording</span><input aria-label="Family relationship wording" required value={resolved.values[fieldKey(role, record, 'poaRelationshipCustom')] || ''} onChange={event => edit(role, record, 'poaRelationshipCustom', event.target.value)} /><small>Enter this attorney’s relationship to the listed principal(s).</small></label>}
                    {!poaRelationship({ poaRelationship: resolved.values[fieldKey(role, record, 'poaRelationship')] || '', poaRelationshipCustom: resolved.values[fieldKey(role, record, 'poaRelationshipCustom')] || '' }) && <p role="status" className="notice">Choose this attorney’s family relationship before generating the GPA.</p>}
                  </div>}
                shareFields={!isReconveyance && <>
                  {isRelease && <p>Existing ownership percentages (optional). Enter the rights released or received separately in Release particulars.</p>}
                  <PartyShareFields role={role} record={record} parties={records} schedules={propertyRecords}
                    shares={(role === 'executant' ? draft.vendorSharesBySchedule : draft.vendeeSharesBySchedule) || {}} manual={draft.manual} dispatch={dispatch} />
                </>}
                label={all.length > 1 ? `${noun} ${i + 1}` : isReconveyance ? noun : undefined}
                onDelete={() => clearPartyRecord(role, record)}
                draft={draft} dispatch={dispatch} upload={(files, assignment, profile) => void runUpload(files, assignment, profile)} choose={(key, candidateId) => dispatch({ type: 'choose', key, candidateId })}
                onUpload={uploadFor(role, record)}
                sources={draft.sources.filter(s => s.assignment?.role === role && s.assignment.record === record)}
                busy={!!busySource} />;
              return combined ? card : <div key={record}><RecordMove scope={role} id={record} ids={records} onChange={ids => dispatch({ type: 'record-order', scope: role, ids })} />{card}</div>;
            })}
            <AddPartyRecord noun={noun} onAdd={addPartyRecord(role)} />
          </>;
          return role === 'executant' && !isRelease && !isReconveyance ? <SaleAuthorityEditor key={draft.id} state={state} aiExtraction={aiExtraction} principalIds={records} onRecordOrder={ids => dispatch({ type: 'record-order', scope: 'executant', ids })} onCapacityChange={changeCapacity} onDeleteAttorney={id => { const cleared = draftReducer(current.current, { type: 'remove-party', role: 'executant', record: id }); dispatch({ type: 'load', draft: { ...cleared, saleAuthority: { ...cleared.saleAuthority!, attorneys: cleared.saleAuthority!.attorneys.filter(item => item.id !== id) } } }); }} onChange={value => dispatch({ type: 'sale-authority', value })} onApplyGpa={(authority, result) => { try { const next = withReplacedExecutantOrder(current.current, applyGpaExtraction(current.current, authority, result)); setExtraPartyRecords(records => ({ ...records, executant: [] })); dispatch({ type: 'load', draft: next }); return ''; } catch (error) { return error instanceof Error ? error.message : 'Could not fill GPA principals.'; } }} onApplyPerson={(person, role, targetId) => { try { dispatch({ type: 'load', draft: applyAuthorityPerson(current.current, person, role, targetId) }); return ''; } catch (error) { return error instanceof Error ? error.message : 'Could not fill this role.'; } }}>{parties}</SaleAuthorityEditor> : parties;
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

        {step === 8 &&
          <details className="template-picker review-template-picker">
            <summary>Word template for this draft</summary>
            <div className="template-choices">
              <label className={templateMode === 'built-in' ? 'selected' : ''}>
                <input type="radio" name="template-mode" checked={templateMode === 'built-in'} onChange={() => { setTemplateMode('built-in'); setDownload(null); setMessage(''); }} />
                <span><b>Published / pinned template</b><small>{defaultPin?.name || `${instrumentTitle} template`}</small></span>
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
            {message && <p className="export-feedback" role="status">{message}</p>}
          </details>}
        {step === 9 && <div className="generation-columns">
          <section className="panel" aria-labelledby="deed-download-heading">
            <h2 id="deed-download-heading">Download deed</h2>
            <div className="language-actions" aria-busy={exporting}>
              <button type="button" className="primary" disabled={exporting || validatingTemplate} onClick={() => void generate('word')}>
                <span aria-hidden="true">EN</span>Download English (.docx)
              </button>
              <button type="button" className="primary" disabled={exporting || validatingTemplate} onClick={() => void generate('telugu')}>
                <span aria-hidden="true" lang="te">తె</span>Download Telugu (.docx)
              </button>
            </div>
            {(exporting || validatingTemplate || message) && <p className="export-feedback" role="status">
              {exporting ? 'Preparing your download…' : validatingTemplate ? 'Checking the selected Word template…' : message}
            </p>}
          </section>
          <section className="panel" aria-labelledby="typing-stamp-heading">
            <h2 id="typing-stamp-heading">Typed By stamp</h2>
            <label className="typing-stamp-toggle">
              <input type="checkbox" checked={includeTypingStamp} onChange={event => dispatch({ type: 'manual', key: 'includePreparedBy', value: event.target.checked ? 'true' : '' })} />
              Include Typed By stamp
            </label>
            {includeTypingStamp && <div className="typing-stamp-fields">
              <label>Name<input type="text" value={typingDetails.typingStampName} onChange={event => editTypingDetail('typingStampName', event.target.value)} /></label>
              <label>Place (optional)<input type="text" value={typingDetails.typingStampPlace} onChange={event => editTypingDetail('typingStampPlace', event.target.value)} /></label>
              <Input field={{ id: 'typingStampMobile', label: 'Mobile number', type: 'tel' }} value={typingDetails.typingStampMobile} onChange={value => editTypingDetail('typingStampMobile', value)} />
            </div>}
          </section>
        </div>}

        {step === 10 && <section className="panel reference-plan-step">
          <div className="plan-download-actions">
            <button type="button" disabled={exporting} onClick={() => void generate('pdf')}>{exporting ? 'Preparing…' : 'Download plan PDF'}</button>
            {message && <p role="status">{message}</p>}
          </div>
          <div className="plan-schedule-tabs">{propertyIds.map((id, index) => <button key={id} className={id === activePropertyId ? 'primary' : ''} onClick={() => dispatch({ type: 'active-property', id })}>Schedule {index + 1}</button>)}</div>
          <GuidedReferenceStep key={`${step}:${draft.id}:${activePropertyId}`} draftId={draft.id} scheduleId={activePropertyId} theme={theme}
            seed={guidedPlanFromDraft(state, activePropertyId)} doc={activePlanDraft}
            enteredDeedDimensions={PROPERTY_DIMENSIONS.fields
              .filter(field => Object.hasOwn(resolved.values, fieldKey('property', activePropertyId, field.id))).map(field => field.id)}
            selected={isActivePlanSelected}
            onChange={doc => {
              setStep13PlanDrafts(old => ({ ...old, [activePropertyId]: doc }));
              if (isActivePlanSelected) setSelectedPlanSvgs(omitActivePlanSelection);
              setStep13PlanSelectedSvgs(omitActivePlanSelection);
              setDownload(null);
            }}
            onUse={svg => {
              setSelectedPlanSvgs(old => ({ ...old, [activePropertyId]: svg }));
              setStep13PlanSelectedSvgs(old => ({ ...old, [activePropertyId]: svg }));
              setDownload(null);
            }} />
        </section>}

        </div>}
        {step >= 0 && step <= 7 && <TemplatePlacementFallback />}
        {step >= 0 && step < 8 && notices.some(issue => issue.step === step) && <section id="step-review" className="notice" tabIndex={-1} aria-label="Details to check in this step">
          <strong>Details to check in this step</strong>
          <ul>{notices.filter(issue => issue.step === step).map(issue => <li key={issue.id}><strong>{issue.label}:</strong> {issue.reason} <button type="button" className="quiet" onClick={() => {
            const fields = [...document.querySelectorAll<HTMLElement>(`[data-deed-field="${CSS.escape(issue.id)}"] :is(input, select, textarea)`)].filter(field => field.getClientRects().length);
            if (fields.length === 1) { fields[0].focus(); fields[0].scrollIntoView({ block: 'center' }); }
            else document.getElementById('workspace-title')?.focus();
          }}>Return to entry</button></li>)}</ul>
        </section>}
      </main>
      {step >= 0 && <footer className="navigation">
          <button disabled={step <= -1} onClick={() => goto(previousStep)}>{step === 10 ? STEPS[previousStep]?.label : '← Previous step'}</button>
          <span><strong>Saved as you work</strong><small>You can go back and change any detail.</small></span>
          {step < 9 && <button className="primary" onClick={() => goto(followingStep)}>Next step →</button>}
      </footer>}
    </div>}
  </div></TemplatePlacementSurface>;
}
