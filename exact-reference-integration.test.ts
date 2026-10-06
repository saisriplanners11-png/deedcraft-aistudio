import { describe, expect, it } from 'vitest';
import { initialState } from './logic';
import { exactPlanFromDraft, exactRefreshFields, applyExactRefresh, isExactPlan } from './exact-reference-integration';
import { SAMPLE_TEMPLATES } from './exact-reference-plan/src/components/SavedPlansModal';
import { rotateBoundariesByQuarterTurns, parseDimension } from './exact-reference-plan/src/utils/dimensionUtils';

describe('exact reference integration', () => {
  it('pre-fills current facts without sample dimensions or people', () => {
    const state = { ...initialState, form: { ...initialState.form, surveyNo: '123/B', executantName: 'CURRENT SELLER', extentSqYards: '200' } };
    const before = JSON.stringify(state);
    const plan = exactPlanFromDraft(state, 'primary');
    expect(plan.property.surveyNo).toBe('123/B');
    expect(plan.executant[0].name).toBe('CURRENT SELLER');
    expect(plan.property.areaSqYards).toBe(200);
    expect(plan.boundaries.northDim.raw).toBe('');
    expect(plan.boundaries.roadSides).toEqual([]);
    expect(plan.claimant[0].name).toBe('');
    expect(isExactPlan(plan)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('selectively refreshes cleared facts while preserving edits and drawing settings', () => {
    const plan = structuredClone(SAMPLE_TEMPLATES[0]);
    plan.boundaries.boundaryScale = 160;
    plan.boundaries.mapRotation = 90;
    const seed = exactPlanFromDraft(initialState, 'primary');
    const fields = exactRefreshFields(plan, seed);
    const updated = applyExactRefresh(plan, fields.filter(field => field.path.join('.') === 'property.surveyNo'));
    expect(updated.property.surveyNo).toBe('');
    expect(updated.property.village).toBe(plan.property.village);
    expect(updated.executant).toEqual(plan.executant);
    expect(updated.boundaries.boundaryScale).toBe(160);
    expect(updated.boundaries.mapRotation).toBe(90);
    expect(updated.boundaries.northDim).toEqual(plan.boundaries.northDim);
    expect(plan.property.surveyNo).not.toBe('');
  });
  it('keeps party arrays separate when refreshing additions and removals', () => {
    const plan = exactPlanFromDraft(initialState, 'primary');
    const seed = structuredClone(plan);
    seed.executant = [ { ...seed.executant[0], name: 'ONE' }, { ...seed.executant[0], name: 'TWO' } ];
    const updated = applyExactRefresh(plan, exactRefreshFields(plan, seed));
    expect(updated.executant.map(p => p.name)).toEqual(['ONE', 'TWO']);
    const removed = applyExactRefresh(updated, exactRefreshFields(updated, plan));
    expect(removed.executant).toHaveLength(1);
  });
  it('refreshes one party field without overwriting other manually edited details', () => {
    const plan = exactPlanFromDraft(initialState, 'primary');
    plan.executant[0].name = 'MANUAL NAME';
    plan.executant[0].occupation = 'MANUAL OCCUPATION';
    const seed = structuredClone(plan);
    seed.executant[0].name = 'DEED NAME'; seed.executant[0].occupation = 'DEED OCCUPATION';
    const updated = applyExactRefresh(plan, exactRefreshFields(plan, seed).filter(field => field.path.join('.') === 'executant.0.name'));
    expect(updated.executant[0].name).toBe('DEED NAME');
    expect(updated.executant[0].occupation).toBe('MANUAL OCCUPATION');
  });

  it('can select a later new party without creating gaps in the party list', () => {
    const plan = exactPlanFromDraft(initialState, 'primary');
    const seed = structuredClone(plan);
    seed.executant.push({ ...seed.executant[0], name: 'SKIPPED' }, { ...seed.executant[0], name: 'SELECTED' });
    const updated = applyExactRefresh(plan, exactRefreshFields(plan, seed).filter(field => field.path.join('.') === 'executant.2'));
    expect(updated.executant.map(party => party.name)).toEqual(['', 'SELECTED']);
  });

  it('retains all five exact samples and rotates dimensions with their boundaries', () => {
    expect(SAMPLE_TEMPLATES).toHaveLength(5);
    for (const plan of SAMPLE_TEMPLATES) expect(isExactPlan(plan)).toBe(true);
    const boundaries = structuredClone(SAMPLE_TEMPLATES[0].boundaries);
    expect(rotateBoundariesByQuarterTurns(rotateBoundariesByQuarterTurns(boundaries, 1), 3)).toMatchObject({
      northBoundary: boundaries.northBoundary, eastBoundary: boundaries.eastBoundary, northDim: boundaries.northDim,
    });
    expect(parseDimension("40'-5\"", 'Feet').normalized).toBeCloseTo(40 + 5 / 12);
  });
});
