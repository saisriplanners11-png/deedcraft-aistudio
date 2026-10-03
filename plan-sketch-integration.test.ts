import { describe, expect, it } from 'vitest';
import { initialState, newScheduleRecord, newValueRecord } from './logic';
import { planDocumentFromDraft } from './plan-sketch-mapping';
import { planDeedChanges } from './plan-sketch-integration';
import { validateImportedPlan } from './plan-sketch-library';
import { SAMPLE_PLAN_TEMPLATES } from './plan-sketch-saved-samples';
import { appendRegistrationPlans, readZip, writeZip } from './docx';

describe('schedule plans and reviewed deed changes', () => {
  const state = {
    ...initialState,
    form: { ...initialState.form, surveyNo: 'FIRST', executantName: 'FIRST SELLER', claimantName: 'FIRST BUYER' },
    additionalSchedules: [{ ...newScheduleRecord('Residential', 'Sq. Yards'), id: 'second', values: { surveyNo: 'SECOND', extentSqYards: '200' } }],
    additionalExecutants: [{ ...newValueRecord(), values: { executantName: 'SECOND SELLER' } }],
    additionalClaimants: [{ ...newValueRecord(), values: { claimantName: 'SECOND BUYER' } }],
  };

  it('initializes each plan from its own schedule and includes all people', () => {
    const first = planDocumentFromDraft(state, 'primary');
    const second = planDocumentFromDraft(state, 'second');
    expect(first.property.surveyNo).toBe('FIRST');
    expect(second.property.surveyNo).toBe('SECOND');
    expect(second.property.areaSqYards).toBe(200);
    expect(first.executants?.map(p => p.name)).toEqual(['FIRST SELLER', 'SECOND SELLER']);
    expect(second.claimants?.map(p => p.name)).toEqual(['FIRST BUYER', 'SECOND BUYER']);
    expect(second.boundaries.northDim.raw).toBe('');
  });

  it('offers only direct, changed plan fields for review', () => {
    const plan = planDocumentFromDraft(state, 'second');
    plan.property.surveyNo = 'REVIEWED';
    plan.property.areaSqYards = 300;
    plan.boundaries.roadWidth = "30'";
    plan.claimants![1].name = 'UPDATED BUYER';
    const changes = planDeedChanges(state, 'second', plan);
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'property', field: 'surveyNo', before: 'SECOND', after: 'REVIEWED' }),
      expect.objectContaining({ role: 'property', field: 'extentSqYards', before: '200', after: '300' }),
      expect.objectContaining({ role: 'claimant', index: 1, field: 'claimantName', after: 'UPDATED BUYER' }),
    ]));
    expect(changes.some(c => c.field === 'roadWidth')).toBe(false);
    expect(changes.some(c => c.role === 'property' && c.field === 'surveyNo' && c.before === 'FIRST')).toBe(false);
  });
});

describe('saved plan import', () => {
  it('accepts all five source templates and rejects invalid dimensions', () => {
    expect(SAMPLE_PLAN_TEMPLATES).toHaveLength(5);
    for (const sample of SAMPLE_PLAN_TEMPLATES) expect(validateImportedPlan(sample).title).toBe(sample.title);
    const invalid = structuredClone(SAMPLE_PLAN_TEMPLATES[0]);
    invalid.boundaries.northDim.normalized = Number.POSITIVE_INFINITY;
    expect(() => validateImportedPlan(invalid)).toThrow(/north dimension/i);
  });
});

describe('reviewed registration plans in Word', () => {
  it('adds one image relationship and page per selected schedule', async () => {
    const enc = new TextEncoder();
    const original = await writeZip([
      { name: 'word/document.xml', data: enc.encode('<w:document><w:body><w:p/><w:sectPr/></w:body></w:document>') },
      { name: 'word/_rels/document.xml.rels', data: enc.encode('<Relationships></Relationships>') },
      { name: '[Content_Types].xml', data: enc.encode('<Types></Types>') },
    ]);
    const result = await appendRegistrationPlans(new Blob([original as any]), [
      { schedule: 1, png: new Uint8Array([137, 80, 78, 71]) },
      { schedule: 2, png: new Uint8Array([137, 80, 78, 71]) },
    ]);
    const entries = await readZip(new Uint8Array(await result.arrayBuffer()));
    const xml = new TextDecoder().decode(entries.find(e => e.name === 'word/document.xml')!.data);
    const rels = new TextDecoder().decode(entries.find(e => e.name === 'word/_rels/document.xml.rels')!.data);
    expect(xml.match(/PLAN FOR REGISTRATION/g)).toHaveLength(2);
    expect(xml.match(/<w:br w:type="page"\/>/g)).toHaveLength(2);
    expect(rels.match(/relationships\/image/g)).toHaveLength(2);
    expect(entries.some(e => e.name === 'word/media/deedcraft-plan-2.png')).toBe(true);
  });
});
