import { describe, expect, it } from 'vitest';
import { ALL_FIELDS, GROUPS } from './fields';
import { buildViewModel, generationBlockers, initialState } from './logic';
import { newPayment } from './payments';
import { mergeValues, propertyForm, rewritesFor } from './merge';

describe('field mapping', () => {
  it('removes Telugu party names and place of execution', () => {
    const ids = ALL_FIELDS.map(field => field.id);
    expect(ids).not.toContain('executantNameTelugu');
    expect(ids).not.toContain('claimantNameTelugu');
    expect(ids).not.toContain('executionPlace');
  });

  it('keeps link deed and sale deed execution dates distinct', () => {
    const link = GROUPS.find(group => group.step === 1)?.fields.find(field => field.id === 'linkDocDate');
    const sale = GROUPS.find(group => group.step === 2)?.fields.find(field => field.id === 'executionDate');
    expect(link?.label).toBe('Link deed execution date');
    expect(sale?.label).toBe('Sale deed execution date');
  });

  it('does not rewrite the removed place field', () => {
    const state = {
      ...initialState,
      form: { ...initialState.form, executionDate: '2026-01-02' },
    };
    const rewrite = rewritesFor(state)[0];
    expect(rewrite.replace).toBe('made and executed on 02-01-2026');
    expect(rewrite.replace).not.toContain(' at ');
  });

  it('reports missing title, property, party and payment facts', () => {
    const missing = generationBlockers(initialState).map(item => item.id);
    expect(missing).toContain('linkDocNo');
    expect(missing).toContain('executantName');
    expect(missing).toContain('payment');
  });

  it('does not treat the sale deed execution date as a required fact', () => {
    expect(generationBlockers(initialState).map(item => item.id)).not.toContain('executionDate');
  });

  it('does not make optional mobile numbers a generation blocker', () => {
    const form = Object.fromEntries(ALL_FIELDS.map(field => [field.id, field.id.includes('Dob') ? '1990-01-01' : '1']));
    form.executantMobile = '';
    form.claimantMobile = '';
    form.executantPan = '';
    form.claimantPan = '';
    const payment = { ...newPayment('cheque'), amount: '100000', refNo: '123456', bank: 'Bank', branch: 'Main', date: '2026-01-01', payer: 'Buyer', payee: 'Seller' };
    const state = { ...initialState, deedType: 'Sale', category: 'Residential', draft: 'Outright Absolute Sale Deed', form, payments: [payment] };
    expect(generationBlockers(state).map(item => item.id)).not.toContain('executantMobile');
    expect(generationBlockers(state).map(item => item.id)).not.toContain('claimantMobile');
  });

  it('preserves alternate extents exactly as printed by the source deed', () => {
    const state = {
      ...initialState,
      form: { ...initialState.form, extentValue: '157.22', extentSqYards: '157.22', extentSqMeters: '132.06' },
    };
    const values = mergeValues(state);
    expect(values['Extent in Sq.yards']).toBe('157.22');
    expect(values['Extent in Sq.Meters']).toBe('132.06');
  });

  it('calculates market value from a verified printed square-yard extent', () => {
    const state = { ...initialState, form: { ...initialState.form, extentSqYards: '157.22', govtRate: '1000' } };
    expect(buildViewModel(state, () => {}).persayINR).toBe('₹1,57,220');
  });

  it('leaves stamp-paper value blank until supplied', () => {
    const form: Record<string, string> = { ...initialState.form, consid: '600000' };
    const state = { ...initialState, form };
    expect(state.form.stampValue).toBe('');
    expect(mergeValues(state)['Stamp of Rs/-']).toBe('');
  });

  it('prints the sale consideration on the first page, not the calculated basic-rate market value', () => {
    const state = {
      ...initialState,
      form: { ...initialState.form, extentValue: '10', govtRate: '100', structValue: '0', consid: '5000' },
      additionalSchedules: [{ id: 'schedule-2', docNames: [], category: 'Vacant Plot', unit: 'Sq. Yards', values: { extentValue: '20', govtRate: '100', structValue: '0' } }],
    };
    const values = mergeValues(state);
    expect(values['Market of Value Rs./-']).toBe('5,000');
    expect(values['Market of Value Rs./-']).toBe(values['Sale Consideration']);
  });
  it('does not copy primary property details into a second property preview', () => {
    const state = { ...initialState, form: { ...initialState.form, plotNo: '1', surveyNo: '41/3', boundaryNorth: 'Primary neighbour', executantName: 'Shared seller', consid: '500000' } };
    const form = propertyForm(state, { plotNo: '2' });
    expect(form.plotNo).toBe('2');
    expect(form.surveyNo).toBe('');
    expect(form.boundaryNorth).toBe('');
    expect(form.executantName).toBe('Shared seller');
    expect(form.consid).toBe('500000');
  });

  it('leaves the first-page value blank until a sale consideration is entered', () => {
    const state = { ...initialState, form: { ...initialState.form, extentValue: '10', govtRate: '100' }, additionalSchedules: [{ id: 'second', docNames: [], category: 'Vacant Plot', unit: '', values: { extentValue: '20', govtRate: '100' } }] };
    expect(mergeValues(state)['Market of Value Rs./-']).toBe('');
  });

});
