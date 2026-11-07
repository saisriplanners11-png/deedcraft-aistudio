import { STEPS } from './reference';

export const hasPaymentStep = (instrument: string) => !['gift', 'reconveyance', 'deed of reconvayance', 'power_of_attorney', 'gpa/power of attorney'].includes((instrument || '').toLowerCase());

// Keep persisted step IDs stable while presenting only applicable sections.
export const stepsFor = (instrument: string) => STEPS.filter(step => hasPaymentStep(instrument) || step.id !== 5).map(step => ['release','reconveyance','deed of reconvayance'].includes((instrument || '').toLowerCase()) ? { ...step, ...(step.id === 4 && !['release'].includes((instrument || '').toLowerCase()) ? { label: 'Market Value', sub: 'Valuation and repayment totals' } : step.id === 6 ? { label: 'Releasor' } : step.id === 7 ? { label: 'Releasee' } : {}) } : step);
export const normalizeWorkflowStep = (instrument: string, step: number) => !hasPaymentStep(instrument) && step === 5 ? 6 : step;
export function adjacentWorkflowStep(instrument: string, step: number, direction: -1 | 1): number {
  const steps = stepsFor(instrument);
  return direction === 1
    ? steps.find(item => item.id > step)?.id ?? steps[steps.length - 1].id
    : [...steps].reverse().find(item => item.id < step)?.id ?? -1;
}
