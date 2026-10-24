import { describe, expect, it } from 'vitest';
import { appStateFor, draftReducer, newDraft, type Draft } from './source-draft';
import { GENERAL_POA_VARIANTS, POA_RELATIONSHIPS, poaValues, poaRelationshipErrors } from './poa-options';
import { savedTemplateStatus, updateSavedDeedTemplate } from './template-version-status';
import { compileDeed } from './deed-compiler';
import { DEED_DEFINITIONS } from './instruments';
import type { SavedDeed } from './saved-deeds';

const change = (draft: Draft, record: string, field: string, value: string) => draftReducer(draft, { type: 'manual', key: `claimant|${record}|${field}`, value });
const familyDraft = () => draftReducer(newDraft(), { type: 'instrument', instrumentId: 'power_of_attorney', variantId: GENERAL_POA_VARIANTS[1] });

describe('General GPA relationships', () => {
  it('adds Family while preserving the other variant IDs and their generation gates', () => {
    expect(DEED_DEFINITIONS.power_of_attorney.variants.map(variant => variant.id)).toEqual([...GENERAL_POA_VARIANTS, 'special-power-of-attorney', 'property-power-of-attorney']);
    for (const variantId of GENERAL_POA_VARIANTS) expect(compileDeed({ instrumentId: 'power_of_attorney', variantId, snapshotHash: '', values: {}, schedules: [], unresolvedWarnings: [] }).templateVersionId).toBe('general-poa-v1');
    for (const variantId of ['special-power-of-attorney', 'property-power-of-attorney']) expect(() => compileDeed({ instrumentId: 'power_of_attorney', variantId, snapshotHash: '', values: {}, schedules: [], unresolvedWarnings: [] })).toThrow(/approved/);
    expect(POA_RELATIONSHIPS.some(([id]) => String(id) === 'friend')).toBe(false);
  });

  it('requires a relationship for each attorney and keeps identity relationships separate', () => {
    let draft = change(familyDraft(), 'primary', 'claimantName', 'A');
    draft = change(draft, 'primary', 'claimantRelation', 'D/O');
    expect(poaRelationshipErrors(appStateFor(draft))).toHaveLength(1);
    draft = change(draft, 'primary', 'poaRelationship', 'son');
    draft = change(draft, 'attorney-b', 'claimantName', 'B');
    expect(poaRelationshipErrors(appStateFor(draft))).toEqual([expect.stringContaining('B')]);
    draft = change(draft, 'attorney-b', 'poaRelationship', 'daughter');
    expect(poaRelationshipErrors(appStateFor(draft))).toEqual([]);
    expect(poaValues(appStateFor(draft))['Poa Attorney Appointment']).toBe('son A and daughter B');
    expect(appStateFor(draft).form.claimantRelation).toBe('D/O');
  });

  it('retains custom family wording after save, source replacement and switching variants', () => {
    let draft = change(familyDraft(), 'primary', 'claimantName', 'A');
    draft = change(draft, 'primary', 'poaRelationship', 'other');
    draft = change(draft, 'primary', 'poaRelationshipCustom', '  ');
    expect(poaRelationshipErrors(appStateFor(draft))).toHaveLength(1);
    draft = change(draft, 'primary', 'poaRelationshipCustom', 'nephew');
    draft = draftReducer(draft, { type: 'add', source: { id: 'identity', name: 'id.txt', hash: '', revision: 0, status: 'done', assignment: { role: 'claimant', record: 'primary' } } });
    draft = draftReducer(draft, { type: 'replace', id: 'identity', name: 'updated-id.txt' });
    draft = JSON.parse(JSON.stringify(draft));
    draft = draftReducer(draft, { type: 'instrument', instrumentId: 'power_of_attorney', variantId: GENERAL_POA_VARIANTS[0] });
    expect(poaValues(appStateFor(draft))['Poa Attorney Appointment']).toBe('friend A');
    expect(poaRelationshipErrors(appStateFor(draft))).toEqual([]);
    draft = draftReducer(draft, { type: 'instrument', instrumentId: 'power_of_attorney', variantId: GENERAL_POA_VARIANTS[1] });
    expect(poaValues(appStateFor(draft))['Poa Attorney Appointment']).toBe('nephew A');
  });

  it('removes only the deleted attorney relationship and retains the remaining stable IDs', () => {
    let draft = change(familyDraft(), 'primary', 'claimantName', 'A');
    draft = change(draft, 'primary', 'poaRelationship', 'son');
    draft = change(draft, 'attorney-b', 'claimantName', 'B');
    draft = change(draft, 'attorney-b', 'poaRelationship', 'daughter');
    draft = draftReducer(draft, { type: 'remove-party', role: 'claimant', record: 'primary' });
    expect(appStateFor(draft).primaryClaimantId).toBe('attorney-b');
    expect(poaValues(appStateFor(draft))['Poa Attorney Appointment']).toBe('daughter B');
    expect(Object.keys(draft.manual).some(key => key.startsWith('claimant|primary|'))).toBe(false);
  });

  it('refreshes only supported default GPA drafts without changing facts or explicit custom templates', () => {
    for (const variantId of GENERAL_POA_VARIANTS) {
      const deed = { draft: { ...familyDraft(), variantId }, templateMode: 'built-in', generationManifest: { templateVersionId: 'old' } } as SavedDeed;
      const updated = updateSavedDeedTemplate(deed, {});
      expect(updated.libraryTemplate?.versionId).toBe('general-poa-v1');
      expect(updated.draft).toBe(deed.draft);
      expect(updated.generationManifest).toBeNull();
      expect(savedTemplateStatus(updated).label).toContain('General Power of Attorney v1');
      const custom = { ...deed, templateMode: 'custom' as const };
      expect(updateSavedDeedTemplate(custom, {})).toBe(custom);
    }
  });
});
