import { describe, expect, it } from 'vitest';
import { adjacentWorkflowStep, stepsFor } from './workflow-steps';
import { draftReducer, newDraft } from './source-draft';
import { generationBlockers, initialState, buildViewModel } from './logic';

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

 describe('GPA workflow skips payments', () => {
  it.each(['power_of_attorney', 'GPA/Power of Attorney'])('skips payments for %s', instrument => {
    expect(stepsFor(instrument).map(step => step.id)).not.toContain(5);
    expect(adjacentWorkflowStep(instrument, 4, 1)).toBe(6);
    expect(adjacentWorkflowStep(instrument, 6, -1)).toBe(4);
  });
  it('restores old GPA payment steps and preserves saved records', () => {
    const saved = { ...newDraft(), instrumentId: 'power_of_attorney' as const, step: 5, manual: { 'payment|primary|amount': '5000' } };
    const loaded = draftReducer(newDraft(), { type: 'load', draft: saved });
    expect(loaded.step).toBe(6);
    expect(loaded.manual).toEqual(saved.manual);
    expect(draftReducer(loaded, { type: 'step', step: 5 }).step).toBe(6);
    expect(draftReducer({ ...newDraft(), step: 5 }, { type: 'instrument', instrumentId: 'power_of_attorney' }).step).toBe(6);
    expect(stepsFor('Agreement of Sale').map(step => step.id)).toContain(5);
  });
});

it('does not require or reconcile payments for GPA', () => {
  const state = { ...initialState, deedType: 'GPA/Power of Attorney' };
  expect(generationBlockers(state).filter(item => item.id.startsWith('payment'))).toEqual([]);
  expect(buildViewModel(state, () => {}).checks.some(item => item.label === 'Consideration fully received')).toBe(false);
});
