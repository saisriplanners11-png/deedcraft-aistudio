import { describe, expect, it } from 'vitest';
import { bundledTemplatePin } from './template-library-client';
import { savedTemplateStatus, updateSavedDeedTemplate } from './template-version-status';
import { newDraft } from './source-draft';
import type { SavedDeed } from './saved-deeds';
import { INSTRUMENT_IDS } from './instruments';
import { DEED_PRESERVATION_VERSION } from './deed-preservation';
const saved = (patch = {}) => ({ draft: newDraft(), templateMode: 'built-in', ...patch } as SavedDeed);

it('refreshes stale rule metadata for every instrument without changing custom sources or saved facts', () => {
  for (const instrumentId of INSTRUMENT_IDS) {
    const customTemplate = { kind: 'custom', name: 'kept.docx' };
    const deed = saved({ draft: { ...newDraft(), instrumentId }, templateMode: 'custom', customTemplate, generationManifest: { preservationVersion: 'old', templateVersionId: 'custom:kept' }, sourceFiles: { primary: [] }, updatedAt: 'original' });
    const updated = updateSavedDeedTemplate(deed, {});
    expect(updated.generationManifest).toBeNull();
    expect(updated.draft).toBe(deed.draft);
    expect(updated.customTemplate).toBe(customTemplate);
    expect(updated.sourceFiles).toBe(deed.sourceFiles);
    expect(updated.updatedAt).toBe('original');
    const current = { ...deed, generationManifest: { ...deed.generationManifest!, preservationVersion: DEED_PRESERVATION_VERSION } };
    expect(updateSavedDeedTemplate(current, {})).toBe(current);
  }
});

it('moves previous authority defaults to the new immutable sources without changing entered facts', () => {
  for (const [instrumentId, variantId, previous, current] of [
    ['power_of_attorney', 'general-power-of-attorney', 'general-poa-v2', 'general-poa-v3'],
    ['power_of_attorney', 'general-power-of-attorney-family', 'general-poa-v2', 'general-poa-v3'],
    ['agreement_of_sale', 'with-possession', 'agreement-sale-gpa-v3', 'agreement-sale-gpa-v4'],
    ['agreement_of_sale', 'without-possession', 'agreement-sale-gpa-v3', 'agreement-sale-gpa-v4'],
  ]) {
    const deed = saved({ draft: { ...newDraft(), instrumentId, variantId, manual: { 'claimant|primary|claimantGender': 'Female', 'claimant|primary|poaRelationship': 'daughter', 'property|primary|surveyNo': 'KEPT-42' } }, libraryTemplate: bundledTemplatePin(previous), generationManifest: { templateVersionId: previous }, sourceFiles: { primary: [] } });
    const updated = updateSavedDeedTemplate(deed, {});
    expect(updated.libraryTemplate?.versionId).toBe(current);
    expect(updated.draft).toBe(deed.draft);
    expect(updated.sourceFiles).toBe(deed.sourceFiles);
    expect(updated.generationManifest).toBeNull();
  }
});
describe('Saved template version notices', () => {
  const latest = bundledTemplatePin('sale-deed-v10');
  it('flags v9 and legacy drafts without replacing their pinned version', () => {
    const pin = bundledTemplatePin('sale-deed-v9');
    expect(savedTemplateStatus(saved({ libraryTemplate: pin }), latest)).toEqual({ label: 'Built-in Sale v9 (sale-deed-v9)', earlier: true });
    expect(pin.versionId).toBe('sale-deed-v9');
    expect(savedTemplateStatus(saved(), latest).earlier).toBe(true);
  });
  it('identifies the current default and keeps per-deed custom templates distinct', () => {
    expect(savedTemplateStatus(saved({ libraryTemplate: latest }), latest).earlier).toBe(false);
    expect(savedTemplateStatus(saved({ templateMode: 'custom', customTemplate: { name: 'My template.docx' } }), latest)).toEqual({ label: 'Custom template: My template.docx', earlier: false });
  });
  it('identifies the Gift default independently of the Sale default', () => {
    const draft = { ...newDraft(), instrumentId: 'gift' as const, variantId: 'family-gift' };
    expect(savedTemplateStatus(saved({ draft, libraryTemplate: bundledTemplatePin('gift-deed-v1') }), latest)).toEqual({ label: 'Gift Settlement v6 (gift-deed-v6)', earlier: false });
  });
  it('does not mark drafts as older before the library is loaded', () => {
    expect(savedTemplateStatus(saved()).earlier).toBe(false);
  });
});

describe('Automatic default template updates', () => {
  const sale = bundledTemplatePin('sale-deed-v10');
  const gift = bundledTemplatePin('gift-deed-v6');
  it('updates every deed type using its own default and preserves facts and files', () => {
    for (const instrumentId of ['sale', 'gift', 'power_of_attorney', 'development_agreement_agpa'] as const) {
      const pin = instrumentId === 'gift' ? gift : { ...sale, versionId: instrumentId + '-current' };
      const deed = saved({ draft: { ...newDraft(), instrumentId }, libraryTemplate: bundledTemplatePin('sale-deed-v9'), generationManifest: { templateVersionId: 'old' }, updatedAt: 'original', sourceFiles: { source: [] } });
      const updated = updateSavedDeedTemplate(deed, { [instrumentId]: pin });
      expect(updated.libraryTemplate).toEqual(pin);
      expect(updated.generationManifest).toBeNull();
      expect(updated.draft).toBe(deed.draft);
      expect(updated.sourceFiles).toBe(deed.sourceFiles);
      expect(updated.updatedAt).toBe('original');
      expect(updateSavedDeedTemplate(updated, { [instrumentId]: pin })).toBe(updated);
    }
  });
  it('retains explicit custom templates and types without a published default', () => {
    const custom = saved({ templateMode: 'custom' });
    expect(updateSavedDeedTemplate(custom, { sale })).toBe(custom);
    const noDefault = saved();
    expect(updateSavedDeedTemplate(noDefault, {})).toBe(noDefault);
  });
});

it('keeps municipal and regular Gift defaults separate across refresh and reload', () => {
  const municipal = saved({ draft: { ...newDraft(), instrumentId: 'gift', variantId: 'municipal-gift' }, libraryTemplate: bundledTemplatePin('gift-deed-v5') });
  const updated = updateSavedDeedTemplate(municipal, { gift: bundledTemplatePin('gift-deed-v5') });
  expect(updated.libraryTemplate?.versionId).toBe('gift-municipal-v3');
  expect(savedTemplateStatus(updated).label).toContain('Municipal Gift');
  const regular = { ...updated, draft: { ...updated.draft, variantId: 'family-gift' } };
  expect(updateSavedDeedTemplate(regular, {}).libraryTemplate?.versionId).toBe('gift-deed-v6');
});


it('refreshes Agreement of Sale Cum GPA defaults while preserving both variants and saved facts', () => {
  for (const variantId of ['with-possession', 'without-possession']) {
    const deed = saved({ deedType: 'Agreement of Sale', libraryTemplate: bundledTemplatePin('agreement-sale-gpa-v1'), draft: { ...newDraft(), instrumentId: 'agreement_of_sale', variantId, manual: { 'executant|primary|executantName': 'KEPT NAME' } }, generationManifest: { templateVersionId: 'old' } });
    const updated = updateSavedDeedTemplate(deed, {});
    expect(updated.libraryTemplate?.versionId).toBe('agreement-sale-gpa-v4');
    expect(updated.deedType).toBe('Agreement of Sale Cum GPA');
    expect(updated.draft).toBe(deed.draft);
    expect(updated.generationManifest).toBeNull();
    expect(savedTemplateStatus(updated).label).toContain('Agreement of Sale Cum GPA');
    const custom = { ...deed, templateMode: 'custom' as const };
    const kept = updateSavedDeedTemplate(custom, {});
    expect(kept.customTemplate).toBe(custom.customTemplate);
    expect(kept.draft).toBe(custom.draft);
    expect(kept.templateMode).toBe('custom');
    expect(kept.generationManifest).toBeNull();
  }
});

it('refreshes previous Gift defaults without changing saved party, property or relationship records', () => {
  for (const [variantId, previous, current] of [['family-gift', 'gift-deed-v5', 'gift-deed-v6'], ['municipal-gift', 'gift-municipal-v2', 'gift-municipal-v3']]) {
    const deed = saved({ draft: { ...newDraft(), instrumentId: 'gift', variantId, manual: { 'executant|primary|executantPan': 'ABCDE1234F', 'property|primary|surveyNo': 'SAVED-42', 'transaction|primary|giftRelationship': 'daughter' } }, libraryTemplate: bundledTemplatePin(previous), generationManifest: { templateVersionId: previous } });
    const updated = updateSavedDeedTemplate(deed, {});
    expect(updated.libraryTemplate?.versionId).toBe(current);
    expect(updated.draft).toBe(deed.draft);
    expect(updated.generationManifest).toBeNull();
    const custom = { ...deed, templateMode: 'custom' as const };
    const kept = updateSavedDeedTemplate(custom, {});
    expect(kept.customTemplate).toBe(custom.customTemplate);
    expect(kept.draft).toBe(custom.draft);
    expect(kept.templateMode).toBe('custom');
    expect(kept.generationManifest).toBeNull();
  }
});
