import { describe, expect, it } from 'vitest';
import { initialState } from './logic';
import { DEFAULT_DRAFT_PLAN_FORM } from './plan-test-fixture';
import { planDocumentFromDraft } from './plan-sketch-mapping';

describe('planDocumentFromDraft', () => {
  it('invents nothing from a blank draft: no dimensions, boundaries, road or witnesses', () => {
    const doc = planDocumentFromDraft(initialState);
    expect(doc.boundaries.northDim).toEqual({ raw: '', normalized: 0, unit: 'Feet' });
    expect(doc.boundaries.southDim.raw).toBe('');
    expect(doc.boundaries.roadSides).toEqual([]);
    expect(doc.boundaries.roadWidth).toBe('');
    expect(doc.witnesses).toEqual({ witness1: '', witness2: '' });
    expect(doc.property.surveyNo).toBe('');
    expect(doc.executant.name).toBe('');
  });

  it('does not mutate the input state', () => {
    const state = { ...initialState, form: { ...initialState.form, ...DEFAULT_DRAFT_PLAN_FORM }, category: 'Residential' };
    const snapshot = JSON.stringify(state);
    planDocumentFromDraft(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('maps a populated draft and composes addresses', () => {
    const state = { ...initialState, form: { ...initialState.form, ...DEFAULT_DRAFT_PLAN_FORM }, category: 'Residential', unit: 'Sq. Yards' };
    const doc = planDocumentFromDraft(state);

    // The fixture leaves executantRelation blank — must default, not drop the relative's name.
    expect(doc.executant.relation).toBe('S/o');
    expect(doc.executant.relativeName).toBe('Adepu Komraiah');
    expect(doc.executant.name).toBe('Adepu Kailash Kumar');
    expect(doc.executant.address).toBe('H.No 2-2-8, Venkampet, Sircilla');

    expect(doc.claimant.relativeName).toBe('Bommena Laxman');
    expect(doc.claimant.address).toContain('14-214');

    expect(doc.property.surveyNo).toBe('41/3');
    expect(doc.property.areaSqYards).toBe(200);
    expect(doc.property.propertyType).toBe('House');

    // "25' Road" sniffed for a road side/width without adopting the whole sentence as a label.
    expect(doc.boundaries.roadSides).toContain('South');
    expect(doc.boundaries.roadWidth).toBe("25'-0\"");
    expect(doc.boundaries.southBoundary).toBe("25' Road");

    // Fields with no wizard equivalent stay blank, not invented.
    expect(doc.boundaries.northDim.raw).toBe('');
    expect(doc.witnesses.witness1).toBe('');
  });

  it('uses only the square-yard extent supplied by the property schedule', () => {
    const state = {
      ...initialState,
      category: 'Vacant Plot',
      unit: 'Sq. Meters',
      form: { ...initialState.form, extentValue: '100', extentSqYards: '119.599' },
    };
    const doc = planDocumentFromDraft(state);
    expect(doc.property.areaSqYards).toBeCloseTo(119.599, 2);
    expect(doc.property.propertyType).toBe('Plot');
  });
});
