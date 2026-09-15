import { describe, it, expect } from 'vitest';
import { scoreBenchmark, type BenchmarkCase } from './benchmark';
import type { Candidate } from './source-draft';

const item: BenchmarkCase = { id:'a',manuallyChecked:true,expected:[{role:'executant',record:'primary',field:'executantMobile',value:'9876543210',handwritten:true}],actual:[],latencyMs:10,manualEdits:0 };
describe('accuracy release gate', () => {
  it('does not count blanks as correct or claim 99% on an empty corpus', () => {
    expect(scoreBenchmark([]).status).toBe('not-verified');
    expect(scoreBenchmark([item]).overall).toMatchObject({precision:null,coverage:0});
  });
  it('measures wrong characters and wrong party assignments as errors', () => {
    const c: Candidate = {id:'a',...item.expected[0],value:'9876543211',status:'accepted',quote:'9876543211',page:1,region:'note',historical:false,role:'executant'};
    expect(scoreBenchmark([{...item,actual:[c]}]).overall.precision).toBe(0);
    expect(scoreBenchmark([{...item,actual:[{...c,value:'9876543210',role:'claimant'}]}]).overall.precision).toBe(0);
  });
  it('reports perfect small samples as insufficient for a release claim', () => {
    const c: Candidate = {id:'a',...item.expected[0],status:'accepted',quote:'9876543210',page:1,region:'note',historical:false,role:'executant'};
    const report=scoreBenchmark([{...item,actual:[c]}]);
    expect(report.overall.precision).toBe(1); expect(report.status).toBe('not-verified');
  });
  it('reports the two-minute latency gate separately from extraction accuracy', () => {
    const report = scoreBenchmark([{ ...item, latencyMs: 120001 }]);
    expect(report.latencyPassed).toBe(false);
    expect(report.p95LatencyMs).toBe(120001);
  });
});
