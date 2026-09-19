import { describe, expect, it } from 'vitest';
import { DEED_DEFINITIONS, INSTRUMENT_IDS } from './instruments';
import { LEGAL_REFERENCES, releaseGate, validateRegistry } from './legal-registry';
import { appStateFor, draftReducer, newDraft } from './source-draft';
import { approvalAllowsGeneration, emptyApproval, invalidateApproval } from './professional-review';
import { compileDeed } from './deed-compiler';

describe('multi-instrument registry', () => {
  it('registers all sixteen committed instrument families with valid workflow contracts', () => {
    expect(INSTRUMENT_IDS).toHaveLength(16);
    expect(validateRegistry()).toEqual([]);
    for (const definition of Object.values(DEED_DEFINITIONS)) {
      expect(definition.variants.length).toBeGreaterThan(0);
      expect(definition.roles.length).toBeGreaterThan(0);
      expect(definition.validationRules.map(rule => rule.id)).toContain('professional-approval');
    }
  });

  it('fails closed for instruments without an approved supplied reference', () => {
    expect(releaseGate('sale', DEED_DEFINITIONS.sale.variants[0].id).ready).toBe(true);
    expect(releaseGate('gift').ready).toBe(false);
    expect(releaseGate('will').reasons[0]).toMatch(/approved legal reference/i);
    expect(LEGAL_REFERENCES).toHaveLength(1);
  });

  it('persists instrument and definition version through source-backed projections', () => {
    const start = newDraft();
    const gift = draftReducer(start, { type: 'instrument', instrumentId: 'gift', variantId: DEED_DEFINITIONS.gift.variants[1].id });
    const state = appStateFor(gift);
    expect(gift.instrumentId).toBe('gift');
    expect(gift.definitionVersion).toBe(DEED_DEFINITIONS.gift.version);
    expect(state.deedType).toBe('Gift');
    expect(state.draft).toBe(DEED_DEFINITIONS.gift.variants[1].label);
  });
});

describe('professional generation safeguards', () => {
  it('ties approval to the exact immutable snapshot and all accepted warnings', () => {
    const approval = { ...emptyApproval(), status: 'approved' as const, reviewerName: 'A. Advocate', approvedSnapshotHash: 'snapshot-1', approvedAt: '2026-09-16T00:00:00Z', acceptedWarnings: ['missing optional phone'] };
    expect(approvalAllowsGeneration(approval, 'snapshot-1', ['missing optional phone'])).toBe(true);
    expect(approvalAllowsGeneration(approval, 'snapshot-2', ['missing optional phone'])).toBe(false);
    expect(approvalAllowsGeneration(approval, 'snapshot-1', ['new conflict'])).toBe(false);
    expect(invalidateApproval(approval).status).toBe('unreviewed');
  });

  it('blocks compilation without professional approval and blocks unonboarded deeds', () => {
    const common = { variantId: DEED_DEFINITIONS.sale.variants[0].id, snapshotHash: 'hash', values: {}, schedules: [], unresolvedWarnings: [], approval: emptyApproval() };
    expect(() => compileDeed({ ...common, instrumentId: 'sale' })).toThrow(/professional approval/i);
    expect(() => compileDeed({ ...common, instrumentId: 'gift', variantId: DEED_DEFINITIONS.gift.variants[0].id })).toThrow(/approved legal reference/i);
  });
});

