import { describe, expect, it } from 'vitest';
import { registrationPlanSvg } from './registration-plan';
import { DEFAULT_DRAFT_PLAN_FORM } from './plan-test-fixture';

describe('registration plan output', () => {
  it('uses current details and preserves the reference page elements', () => {
    const svg = registrationPlanSvg(DEFAULT_DRAFT_PLAN_FORM);
    for (const value of ['PLAN FOR REGISTRATION','PLOT NO.196','41/3','200.00 SQUARE YARDS','167.2255','VENDOR/S SIGN/S','VENDEE/S SIGN/S','WITNESSES:','AREA UNDER REGISTRATION']) expect(svg).toContain(value);
    expect(svg).not.toContain('DRAFT PLAN');
  });
  it('renders the selected landmark relationship', () => {
    expect(registrationPlanSvg({ ...DEFAULT_DRAFT_PLAN_FORM, nearAdjacent: 'Near', nearHNo: '10-1-36/1' })).toContain('SITUATED NEAR H.NO.10-1-36/1');
    expect(registrationPlanSvg({ ...DEFAULT_DRAFT_PLAN_FORM, nearAdjacent: 'Adjacent', nearHNo: '10-1-36/1' })).toContain('SITUATED ADJACENT H.NO.10-1-36/1');
  });
  it('leaves the drawing and facts blank when there is no source', () => {
    const svg = registrationPlanSvg({});
    expect(svg).not.toContain('196'); expect(svg).not.toContain('75&apos;-6');
    expect(svg).not.toContain('<polyline'); expect(svg).toContain('SCALE __________');
    expect(svg).not.toContain('KAILASH');
  });
  it('renders source geometry and labels instead of fixed dimensions', () => {
    const svg = registrationPlanSvg({}, { lines:[{points:[[100,100],[600,230],[530,800],[100,100]]}], labels:[{text:'31 feet',x:250,y:120}],scale:'1:100' });
    expect(svg).toContain('100,100 600,230 530,800 100,100');
    expect(svg).toContain('31 feet'); expect(svg).toContain('SCALE 1:100');
    expect(svg).not.toContain('75&apos;-6');
  });
  it('escapes source text rather than executing markup', () => {
    const svg = registrationPlanSvg({ executantName:'<script>alert(1)</script>' });
    expect(svg).not.toContain('<script>'); expect(svg).toContain('&lt;SCRIPT&gt;');
  });
});
