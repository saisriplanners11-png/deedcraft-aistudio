import { describe, expect, it, vi } from 'vitest';

const calls: any[] = [];
vi.mock('./claude', () => ({
  VISION_MODEL: 'verify',
  readableError: (e: Error) => e,
  getClient: () => ({
    messages: {
      create: async (body: any) => {
        calls.push(body);
        const input = { northDim: "40'", southDim: "40'", eastDim: "60'", westDim: "60'", roadSides: ['South'], roadWidth: "30'" };
        return { content: [{ type: 'tool_use', name: 'record_sketch_details', input }] };
      },
    },
  }),
}));

import { analyzeManualSketch, applyExtractedDataToPlan, type ExtractedSketchData } from './plan-sketch-extract';
import type { PlanDocument } from './plan-sketch-types';

function blankDoc(): PlanDocument {
  const blankDim = { raw: '', normalized: 0, unit: 'Feet' as const };
  return {
    id: 't', title: 't', createdAt: '', updatedAt: '',
    property: { propertyType: 'Plot', areaSqYards: '', areaSqMtrs: '', surveyNo: '', nearHNo: '', locality: '', village: '', mandal: '', district: '' },
    executant: { name: '', relation: 'S/o', relativeName: '', age: '', occupation: '', address: '' },
    claimant: { name: '', relation: 'S/o', relativeName: '', age: '', occupation: '', address: '' },
    boundaries: {
      northBoundary: '', northDim: blankDim, southBoundary: '', southDim: blankDim,
      eastBoundary: '', eastDim: blankDim, westBoundary: '', westDim: blankDim,
      roadWidth: '', roadSides: [], cornerProperty: false, dimensionUnit: 'Feet',
    },
    witnesses: { witness1: '', witness2: '' },
  };
}

describe('analyzeManualSketch', () => {
  it('sends the image as a base64 content block and reads the tool-call input', async () => {
    const data = await analyzeManualSketch('AAAA', 'image/jpeg', new AbortController().signal);
    expect(data.northDim).toBe("40'");
    const body = calls[0];
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'record_sketch_details' });
    const imagePart = body.messages[0].content.find((p: any) => p.type === 'image');
    expect(imagePart.source).toEqual({ type: 'base64', media_type: 'image/jpeg', data: 'AAAA' });
  });
});

describe('applyExtractedDataToPlan', () => {
  it('fills blank boundary dimensions and computes area when none was extracted', () => {
    const extracted: ExtractedSketchData = { northDim: "40'", southDim: "40'", eastDim: "60'", westDim: "60'", roadSides: ['South'] };
    const doc = applyExtractedDataToPlan(blankDoc(), extracted);
    expect(doc.boundaries.northDim.normalized).toBe(40);
    expect(doc.boundaries.roadSides).toEqual(['South']);
    expect(doc.property.areaSqYards).toBeCloseTo(266.67, 1);
  });

  it('never invents a boundary label, road width, or plot number the extraction did not return', () => {
    const extracted: ExtractedSketchData = { northDim: '', southDim: '', eastDim: '', westDim: '' };
    const doc = applyExtractedDataToPlan(blankDoc(), extracted);
    expect(doc.boundaries.northBoundary).toBe('');
    expect(doc.boundaries.roadWidth).toBe('');
    expect(doc.property.surveyNo).toBe('');
  });

  it('preserves values already in the plan when the extraction omits them', () => {
    const current = { ...blankDoc(), property: { ...blankDoc().property, surveyNo: '41/3' } };
    const doc = applyExtractedDataToPlan(current, { northDim: '', southDim: '', eastDim: '', westDim: '' });
    expect(doc.property.surveyNo).toBe('41/3');
  });
});
