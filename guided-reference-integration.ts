import { exactPlanFromDraft } from './exact-reference-integration';
import type { AppState } from './logic';
import type { PlanDocument } from './guided-reference-plan/src/types';

export function guidedPlanFromDraft(state: AppState, scheduleId: string): PlanDocument {
  return { ...exactPlanFromDraft(state, scheduleId), id: `guided-plan-${scheduleId}` };
}
