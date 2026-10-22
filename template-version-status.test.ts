import { describe, expect, it } from 'vitest';
import { bundledTemplatePin } from './template-library-client';
import { savedTemplateStatus } from './template-version-status';
import { newDraft } from './source-draft';
import type { SavedDeed } from './saved-deeds';
const saved = (patch = {}) => ({ draft: newDraft(), templateMode: 'built-in', ...patch } as SavedDeed);
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
    expect(savedTemplateStatus(saved({ draft, libraryTemplate: bundledTemplatePin('gift-deed-v1') }), latest)).toEqual({ label: 'Gift Settlement v2 (gift-deed-v2)', earlier: false });
  });
  it('does not mark drafts as older before the library is loaded', () => {
    expect(savedTemplateStatus(saved()).earlier).toBe(false);
  });
});
