import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanSketchDrawing } from './plan-sketch-drawing';
import type { BoundaryDimensions, PropertyDetails } from './plan-sketch-types';

const property: PropertyDetails = {
  propertyType: 'Plot', areaSqYards: 266.67, areaSqMtrs: 222.97,
  surveyNo: '41/3', nearHNo: '', locality: 'Venkampet', village: 'Sircilla', mandal: 'Sircilla', district: '',
};

const boundaries: BoundaryDimensions = {
  northBoundary: 'Open place of others', northDim: { raw: "40'", normalized: 40, unit: 'Feet' },
  southBoundary: "25' Road", southDim: { raw: "40'", normalized: 40, unit: 'Feet' },
  eastBoundary: 'Plot No. 195', eastDim: { raw: "60'", normalized: 60, unit: 'Feet' },
  westBoundary: 'Plot No. 191', westDim: { raw: "60'", normalized: 60, unit: 'Feet' },
  roadWidth: "25'", roadSides: ['South'], cornerProperty: false, dimensionUnit: 'Feet',
  roadLayoutType: 'One Side Road', northRotation: 0,
};

describe('PlanSketchDrawing', () => {
  it('renders the four dimension labels and the area badge', () => {
    const markup = renderToStaticMarkup(PlanSketchDrawing({ property, boundaries }) as any);
    expect(markup).toContain("40&#x27;");
    expect(markup).toContain("60&#x27;");
    expect(markup).toContain('266.67');
  });

  it('carries no Tailwind utility classes — every text style is inline, so the SVG is standalone-serializable (only this project\'s own plain-CSS wrapper/canvas classes remain)', () => {
    const markup = renderToStaticMarkup(PlanSketchDrawing({ property, boundaries }) as any);
    expect(markup).not.toMatch(/class="[^"]*(?:text-\[|font-(?:bold|black|extrabold|medium)|fill-black|tracking-|shadow-)/);
    expect(markup).toContain('class="plan-sketch-canvas"');
  });

  it('renders road geometry for every layout type without throwing', () => {
    const layouts: BoundaryDimensions['roadLayoutType'][] = [
      'One Side Road', 'Two Side Road / Corner', 'Three Side Road', 'Four Side Road / Island',
      'Through Road / Through Plot', 'T-Junction', 'Dead-End / Cul-de-Sac',
    ];
    for (const roadLayoutType of layouts) {
      const b = { ...boundaries, roadLayoutType, roadSides: ['South', 'East'] as BoundaryDimensions['roadSides'], cornerProperty: true };
      expect(() => renderToStaticMarkup(PlanSketchDrawing({ property, boundaries: b }) as any)).not.toThrow();
    }
  });
});
