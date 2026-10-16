import { describe, expect, it } from 'vitest';
import { PLACEMENT_CATALOG, matchingHosts, placementOrder, placementStepIndex, validatePlacement } from './template-placement';
import { canonicalContract, fieldFingerprint, validateFieldContract, type TemplateField } from './template-fields';
import { newDraft, appStateFor, draftReducer } from './source-draft';
import { resolveTemplateFieldData } from './template-field-values';
import { buildViewModel } from './logic';
const field: TemplateField = { id: 'custom-note', placeholder: 'Custom Note', label: 'Custom note', help: '', type: 'text', scope: 'transaction', required: true, options: [], sampleValue: 'Example', extractionEnabled: true, extractionDescription: 'Current note', evidenceContext: 'current' };
const placement = { stepId: 'property-schedules', sectionId: 'property-identification', position: 'after' as const, anchorFieldId: 'plotNo', order: 2 };
const occurrence = [{ placeholder: field.placeholder, text: '', part: 'word/document.xml', variants: [], supported: true }];
describe('template field placement', () => {
  it('offers eight entry steps with unique stable sections and anchors', () => {
    expect(PLACEMENT_CATALOG.map(step => step.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const sections = PLACEMENT_CATALOG.flatMap(step => step.sections);
    expect(new Set(sections.map(section => section.id)).size).toBe(sections.length);
    for (const section of sections) expect(new Set(section.anchors.map(anchor => anchor.id)).size).toBe(section.anchors.length);
  });
  it('validates step, section, anchor, position and order, retaining legacy contracts', () => {
    expect(validatePlacement(placement)).toEqual(placement);
    for (const patch of [{ stepId: 'generate' }, { sectionId: 'executant-personal' }, { anchorFieldId: 'unknown' }, { order: -1 }, { order: 1.5 }, { position: 'middle' }, { position: 'end' }]) expect(() => validatePlacement({ ...placement, ...patch })).toThrow();
    expect(validateFieldContract({ version: 1, fields: [field] }, [], occurrence).fields[0].placement).toBeUndefined();
    expect(() => validateFieldContract({ version: 1, fields: [field] }, [], occurrence, undefined, true)).toThrow(/Choose a dashboard step/);
    expect(validateFieldContract({ version: 1, fields: [{ ...field, placement }] }, [], occurrence, undefined, true).fields[0].placement).toEqual(placement);
  });
  it('changes package input without changing identity, values or reviewed evidence', () => {
    const moved = { ...field, placement };
    expect(fieldFingerprint(moved)).toBe(fieldFingerprint(field));
    expect(canonicalContract({ version: 1, fields: [field] })).not.toBe(canonicalContract({ version: 1, fields: [moved] }));
    let draft = newDraft(); draft = draftReducer(draft, { type: 'template-field', fieldId: field.id, recordId: 'transaction:deed', value: 'Preserved' });
    expect(resolveTemplateFieldData(draft, appStateFor(draft), { version: 1, fields: [moved] }).instances[0].value).toBe('Preserved');
    const configured = validateFieldContract({ version: 1, fields: [moved] }, [], occurrence, { version: 1, fields: [field] }, true);
    expect(configured.fields[0].id).toBe(field.id);
    const evidence = { ...newDraft(), sources: [{ id: 'proof', revision: 0, name: 'note.txt', hash: '', status: 'done' as const, templateCandidates: [{ id: 'candidate', fieldId: field.id, recordId: 'deed', value: 'Reviewed', quote: 'Reviewed', page: 0, region: 'note', historical: false, verified: true, fingerprint: fieldFingerprint(field) }] }], templateFieldReviews: { 'proof:0:candidate': 'accepted' as const } };
    expect(resolveTemplateFieldData(evidence, appStateFor(evidence), { version: 1, fields: [moved] }).instances[0].value).toBe('Reviewed');
  });
  it('matches scoped records without a cross-product and has no host for hidden anchors', () => {
    const hosts = ['primary', 'second'].map(recordId => ({ sectionId: placement.sectionId, anchorFieldId: 'plotNo', position: 'after' as const, scope: 'property', recordId }));
    expect(matchingHosts(hosts, placement, { scope: 'property', id: 'second' }).map(host => host.recordId)).toEqual(['second']);
    expect(matchingHosts(hosts, placement, { scope: 'transaction', id: 'deed' })).toHaveLength(2);
    expect(matchingHosts(hosts, { ...placement, anchorFieldId: 'flatNo' }, { scope: 'property', id: 'primary' })).toEqual([]);
    const partyPlacement = { ...placement, stepId: 'executant-details', sectionId: 'executant-personal', anchorFieldId: 'executantName' };
    const partyHosts = [{ ...hosts[0], sectionId: 'executant-personal', anchorFieldId: 'executantName', scope: 'executant' }];
    expect(matchingHosts(partyHosts, partyPlacement, { scope: 'executant', id: 'executant-primary', sourceRecordId: 'primary' })).toHaveLength(1);
    expect([{ id: 'b', placement }, { id: 'a', placement }].sort(placementOrder).map(field => field.id)).toEqual(['a', 'b']);
  });
  it('counts placed inputs and blocks their owner step and readiness until corrected', () => {
    const draft = newDraft(), state = appStateFor(draft);
    const instances = resolveTemplateFieldData(draft, state, { version: 1, fields: [{ ...field, placement: { stepId: 'deed-setup', sectionId: 'setup-deed', position: 'end', order: 0 } }] }).instances;
    const base = buildViewModel(state, () => {}), view = buildViewModel(state, () => {}, instances);
    expect(view.applicableCount).toBe(base.applicableCount + 1);
    expect(view.doneIds).not.toContain(0);
    expect(view.generationBlockers.some(issue => issue.id.startsWith('template:') && issue.step === 0)).toBe(true);
    expect(placementStepIndex(placement)).toBe(3);
  });
  it('retains placement for an existing-field alias without adding an editable built-in field', () => {
    const alias = { ...field, type: 'currency' as const, required: false, existingPlaceholder: 'Sale Amount', placement };
    const contract = validateFieldContract({ version: 1, fields: [alias] }, [{ placeholder: 'Sale Amount', label: 'Consideration', type: 'currency', scope: 'transaction' }], occurrence, undefined, true);
    expect(contract.fields[0].existingPlaceholder).toBe('Sale Amount');
    expect(contract.fields[0].extractionEnabled).toBe(false);
    expect(contract.fields[0].placement).toEqual(placement);
  });
});
