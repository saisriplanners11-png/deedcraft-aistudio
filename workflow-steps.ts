import { STEPS } from './reference';

export const hasPaymentStep = (instrument: string) => !['gift', 'reconveyance', 'deed of reconvayance', 'power_of_attorney', 'gpa/power of attorney'].includes((instrument || '').toLowerCase());

// Keep persisted step IDs stable while presenting only applicable sections.
const orderedSteps = [...STEPS.slice(0, 5), STEPS[6], STEPS[7], STEPS[5], ...STEPS.slice(8)];
export const stepsFor = (instrument: string) => orderedSteps.filter(step => hasPaymentStep(instrument) || step.id !== 5).map(step => ['release','reconveyance','deed of reconvayance'].includes((instrument || '').toLowerCase()) ? { ...step, ...(step.id === 4 && !['release'].includes((instrument || '').toLowerCase()) ? { label: 'Market Value', sub: 'Valuation and repayment totals' } : step.id === 6 ? { label: 'Releasor' } : step.id === 7 ? { label: 'Releasee' } : {}) } : step);
export const normalizeWorkflowStep = (instrument: string, step: number) => !hasPaymentStep(instrument) && step === 5 ? 6 : Math.min(step, STEPS.length - 1);
export const CURRENT_WORKFLOW_VERSION = 4;

export function adjacentWorkflowStep(instrument: string, step: number, direction: -1 | 1): number {
  const steps = stepsFor(instrument);
  const index = steps.findIndex(item => item.id === normalizeWorkflowStep(instrument, step));
  if (direction === 1 && index === steps.length - 1) return steps[index].id;
  return steps[index + direction]?.id ?? -1;
}
