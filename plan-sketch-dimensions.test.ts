import { describe, expect, it } from 'vitest';
import { calculateSqMtrs, formatDimensionDisplay, generateLegalDescription, parseDimension, validatePlanDocument } from './plan-sketch-dimensions';
import type { PlanDocument } from './plan-sketch-types';

describe('parseDimension', () => {
  it('parses feet-and-inches formats', () => {
    expect(parseDimension(`40'5"`)).toEqual({ raw: `40'5"`, normalized: Math.round((40 + 5 / 12) * 1000) / 1000, unit: 'Feet' });
    expect(parseDimension(`40' 5"`)).toEqual({ raw: `40' 5"`, normalized: Math.round((40 + 5 / 12) * 1000) / 1000, unit: 'Feet' });
    expect(parseDimension(`40-5`)).toEqual({ raw: `40-5`, normalized: Math.round((40 + 5 / 12) * 1000) / 1000, unit: 'Feet' });
  });
  it('parses the combined prime+hyphen form used throughout the app\'s own hints (e.g. 40\'-0")', () => {
    expect(parseDimension(`40'-5"`)).toEqual({ raw: `40'-5"`, normalized: Math.round((40 + 5 / 12) * 1000) / 1000, unit: 'Feet' });
  });
  it('parses a bare feet value', () => {
    expect(parseDimension(`40'`)).toEqual({ raw: `40'`, normalized: 40, unit: 'Feet' });
    expect(parseDimension(`40`)).toEqual({ raw: `40`, normalized: 40, unit: 'Feet' });
  });
  it('parses metres', () => {
    expect(parseDimension('12.35m')).toEqual({ raw: '12.35m', normalized: 12.35, unit: 'Metres' });
    expect(parseDimension('12.35', 'Metres')).toEqual({ raw: '12.35', normalized: 12.35, unit: 'Metres' });
  });
  it('returns a blank dimension for empty input', () => {
    expect(parseDimension('')).toEqual({ raw: '', normalized: 0, unit: 'Feet' });
  });
  it('retains the full descriptive sentence as raw even when a road width is embedded', () => {
    // Real data from plan-test-fixture.ts's boundarySouth. The mapping's road-side
    // sniff must not reuse this whole string as a label — see plan-sketch-mapping.ts.
    const dim = parseDimension("25' Road");
    expect(dim.normalized).toBe(25);
    expect(dim.raw).toBe("25' Road");
  });
});

describe('calculateSqMtrs', () => {
  it('converts Sq. Yards to Sq. Metres using the standard registration factor', () => {
    expect(calculateSqMtrs(200)).toBeCloseTo(167.2254, 3);
  });
  it('returns blank for non-positive or empty input', () => {
    expect(calculateSqMtrs('')).toBe('');
    expect(calculateSqMtrs(0)).toBe('');
    expect(calculateSqMtrs(-5)).toBe('');
  });
});

describe('formatDimensionDisplay', () => {
  it('prefers the raw string when present', () => {
    expect(formatDimensionDisplay({ raw: `40'-5"`, normalized: 40.4, unit: 'Feet' })).toBe(`40'-5"`);
  });
  it('formats a normalized feet value with no raw string', () => {
    expect(formatDimensionDisplay({ raw: '', normalized: 40.5, unit: 'Feet' })).toBe(`40'-6"`);
  });
});

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

describe('generateLegalDescription', () => {
  it('leaves blanks as underscores rather than inventing facts', () => {
    const legal = generateLegalDescription(blankDoc());
    expect(legal.propertyDescription).toContain('_______');
    expect(legal.executantText).toBe('[EXECUTANT DETAILS NOT ENTERED]');
  });
});

describe('validatePlanDocument', () => {
  it('flags every required field missing on a blank document', () => {
    const issues = validatePlanDocument(blankDoc());
    const fields = issues.map(i => i.field);
    expect(fields).toContain('property.areaSqYards');
    expect(fields).toContain('property.surveyNo');
    expect(fields).toContain('executant.name');
    expect(fields).toContain('claimant.name');
  });
  it('passes a fully completed document with no errors', () => {
    const doc = blankDoc();
    doc.property.areaSqYards = 200;
    doc.property.surveyNo = '41/3';
    doc.property.village = 'Thangallapelli';
    doc.property.mandal = 'Thangallapelli';
    doc.executant.name = 'Adepu Kailash Kumar';
    doc.executant.relativeName = 'Adepu Komraiah';
    doc.claimant.name = 'Bommena Thirumala';
    doc.claimant.relativeName = 'Bommena Laxman';
    doc.boundaries.northBoundary = 'Open place of others';
    doc.boundaries.northDim = { raw: "40'", normalized: 40, unit: 'Feet' };
    doc.boundaries.southBoundary = "25' Road";
    doc.boundaries.southDim = { raw: "25'", normalized: 25, unit: 'Feet' };
    doc.boundaries.eastBoundary = 'Open Plot No. 195';
    doc.boundaries.eastDim = { raw: "60'", normalized: 60, unit: 'Feet' };
    doc.boundaries.westBoundary = 'Open Plot No. 191';
    doc.boundaries.westDim = { raw: "60'", normalized: 60, unit: 'Feet' };
    const errors = validatePlanDocument(doc).filter(i => i.severity === 'error');
    expect(errors).toEqual([]);
  });
});
