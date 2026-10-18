import { describe, expect, it } from 'vitest';
import { adjacentWorkflowStep, stepsFor } from './workflow-steps';
import { draftReducer, newDraft } from './source-draft';

describe('Gift workflow skips payments', () => {
  it('omits payments in Gift while preserving Sale navigation', () => {
    expect(stepsFor('Gift').map(step => step.id)).not.toContain(5);
    expect(stepsFor('Sale').map(step => step.id)).toContain(5);
    expect(adjacentWorkflowStep('Gift', 4, 1)).toBe(6);
    expect(adjacentWorkflowStep('Gift', 6, -1)).toBe(4);
    expect(adjacentWorkflowStep('Sale', 4, 1)).toBe(5);
  });
  it('opens old Gift payment steps at parties without changing saved facts', () => {
    const saved = { ...newDraft(), instrumentId: 'gift' as const, variantId: 'family-gift', step: 5, manual: { 'property|primary|giftRelationship': 'daughter' } };
    const loaded = draftReducer(newDraft(), { type: 'load', draft: saved });
    expect(loaded.step).toBe(6);
    expect(loaded.manual).toEqual(saved.manual);
    expect(draftReducer(loaded, { type: 'step', step: 5 }).step).toBe(6);
    expect(draftReducer({ ...newDraft(), step: 5 }, { type: 'instrument', instrumentId: 'gift' }).step).toBe(6);
  });
});
