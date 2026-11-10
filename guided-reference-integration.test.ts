import { describe, expect, it } from 'vitest';
import { initialState } from './logic';
import { appStateFor, draftReducer, newDraft } from './source-draft';
import { guidedPlanFromDraft, guidedRefreshFields, applyGuidedRefresh, isGuidedPlan } from './guided-reference-integration';
import { SAMPLE_TEMPLATES } from './guided-reference-plan/src/components/SavedPlansModal';
import { stepsFor, adjacentWorkflowStep } from './workflow-steps';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PropertyDetailsForm } from './guided-reference-plan/src/components/PropertyDetailsForm';

describe('guided plan workspace', () => {
  it('does not display or enable the exported sample house for an empty property', () => {
    const seed = guidedPlanFromDraft(initialState, 'primary');
    const html = renderToStaticMarkup(createElement(PropertyDetailsForm, {
      property: seed.property, boundaries: seed.boundaries, onChange: () => {},
    }));
    expect(html).not.toContain('1 House(s) Enabled');
    expect(html).not.toContain('value="1172"');
    expect(html).not.toContain('value="508/B"');
  });
  it('keeps each schedule separate without introducing sample facts', () => {
    let draft = newDraft();
    draft = draftReducer(draft, { type: 'add-property', id: 'second' });
    for (const [key, value] of Object.entries({
      'property|primary|surveyNo': 'FIRST/123',
      'property|second|surveyNo': 'SECOND/456',
      'property|primary|boundaryNorth': 'Road',
      'property|primary|dimensionNorth': '21 ft',
      'property|second|boundaryEast': 'Plot 20',
      'property|second|dimensionEast': '42 ft',
    })) draft = draftReducer(draft, { type: 'manual', key, value });
    const state = appStateFor(draft);
    const first = guidedPlanFromDraft(state, 'primary');
    const second = guidedPlanFromDraft(state, 'second');
    expect(first.property.surveyNo).toBe('FIRST/123');
    expect(second.property.surveyNo).toBe('SECOND/456');
    expect(first.id).not.toBe(second.id);
    expect(first.boundaries).toMatchObject({ northBoundary: 'Road', northDim: { raw: '21 ft', normalized: 21 }, eastDim: { raw: '' } });
    expect(second.boundaries).toMatchObject({ eastBoundary: 'Plot 20', eastDim: { raw: '42 ft', normalized: 42 }, northDim: { raw: '' } });
    expect(first.boundaries.roadSides).toEqual([]);
    expect(first.property.areaSqYards).toBe('');
    expect(first.claimant[0].name).toBe('');
    first.property.surveyNo = 'PLAN ONLY';
    expect(second.property.surveyNo).toBe('SECOND/456');
    expect(state.form.surveyNo).toBe('FIRST/123');
  });

  it('uses the same selective refresh while retaining new drawing features and party edits', () => {
    const plan = structuredClone(SAMPLE_TEMPLATES[0]);
    plan.boundaries.deedMatterScale = 135;
    plan.boundaries.partiesScale = 115;
    plan.boundaries.mapRotation = 270;
    plan.executant[0].name = 'PLAN SELLER';
    const seed = guidedPlanFromDraft(initialState, 'primary');
    const refreshed = applyGuidedRefresh(plan, guidedRefreshFields(plan, seed)
      .filter(field => field.path.join('.') === 'property.surveyNo'));
    expect(refreshed.property.surveyNo).toBe('');
    expect(refreshed.boundaries).toEqual(plan.boundaries);
    expect(refreshed.executant).toEqual(plan.executant);
    expect(SAMPLE_TEMPLATES.every(isGuidedPlan)).toBe(true);
  });

  it('routes saved plan steps to the guided editor', () => {
    const saved = { ...newDraft(), step: 11, manual: { 'property|primary|surveyNo': 'RETAIN/123' } };
    expect(draftReducer(newDraft(), { type: 'load', draft: saved })).toMatchObject({ ...saved, step: 10 });
    const legacy = { ...saved, workflowVersion: undefined };
    const restored = draftReducer(newDraft(), { type: 'load', draft: legacy });
    expect(restored.step).toBe(10);
    expect(restored.manual).toEqual(saved.manual);
    expect(stepsFor('sale').slice(-2).map(step => step.id)).toEqual([9, 10]);
    expect(stepsFor('gift').slice(-2).map(step => step.id)).toEqual([9, 10]);
    expect(adjacentWorkflowStep('sale', 9, 1)).toBe(10);
    expect(adjacentWorkflowStep('sale', 10, -1)).toBe(9);
  });
});
