import type { Candidate } from './source-draft';

export type GoldField = { role: string; record: string; field: string; value: string; handwritten: boolean };
export type BenchmarkCase = { id: string; manuallyChecked: boolean; expected: GoldField[]; actual: Candidate[]; latencyMs: number; manualEdits: number };
const critical = (field: string) => /Aadhaar|Pan|Mobile|surveyNo|plotNo|bearingHNo|nearHNo|linkDocNo|boundary|amount|refNo|consid|extent/i.test(field);
const key = (field: { role: string; record: string; field: string }) => `${field.role}|${field.record}|${field.field}`;
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Precision and coverage are separate; blanks never count as correct extraction. */
export function scoreBenchmark(cases: BenchmarkCase[]) {
  const checked = cases.filter(c => c.manuallyChecked);
  const report = (include: (field: GoldField | Candidate) => boolean) => {
    let populated = 0, correct = 0, expected = 0;
    for (const item of checked) {
      const gold = new Map(item.expected.filter(include).filter(f => f.value).map(f => [key(f), normalize(f.value)]));
      const predicted = new Map(item.actual.filter(include).filter(f => f.status === 'accepted' && f.value).map(f => [key(f), normalize(f.value)]));
      expected += gold.size; populated += predicted.size;
      for (const [id, value] of predicted) if (gold.get(id) === value) correct++;
    }
    return { correct, populated, expected, precision: populated ? correct / populated : null, coverage: expected ? correct / expected : null };
  };
  const overall = report(() => true);
  const handwriting = report(f => f.handwritten);
  const identifiers = report(f => critical(f.field));
  const sufficient = checked.length >= 50 && overall.expected >= 1000 && handwriting.expected >= 100;
  const precisionPassed = [overall, handwriting, identifiers].every(r => r.precision !== null && r.precision >= .99);
  // A separate minimum coverage gate prevents an all-blank extractor from passing.
  const coveragePassed = [overall, handwriting, identifiers].every(r => r.coverage !== null && r.coverage >= .95);
  const durations = checked.map(c => c.latencyMs).sort((a,b) => a-b);
  const p95LatencyMs = durations.length ? durations[Math.min(durations.length - 1, Math.ceil(durations.length * .95) - 1)] : null;
  // The product target is a typical 15-page scanned deed completing within two
  // minutes. Keep the corpus gate explicit so a slow but accurate change is
  // not silently promoted.
  const latencyPassed = p95LatencyMs !== null && p95LatencyMs <= 120_000;
  return { status: sufficient && precisionPassed && coveragePassed && latencyPassed ? 'passed' : 'not-verified', checkedDocuments: checked.length,
    overall, handwriting, criticalIdentifiers: identifiers, sufficient, precisionPassed, coveragePassed,
    medianLatencyMs: durations.length ? durations[Math.floor(durations.length / 2)] : null,
    p95LatencyMs, latencyPassed,
    manualEdits: checked.reduce((sum,c) => sum + c.manualEdits, 0),
    requirements: { documents: 50, fields: 1000, handwrittenFields: 100, precision: .99, coverage: .95, p95LatencyMs: 120_000 },
  };
}
