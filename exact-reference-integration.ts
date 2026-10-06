import { planDocumentFromDraft } from './plan-sketch-mapping';
import { scheduleRecords, type AppState } from './logic';
import type { PlanDocument } from './exact-reference-plan/src/types';

export function exactPlanFromDraft(state: AppState, scheduleId: string): PlanDocument {
  const base = planDocumentFromDraft(state, scheduleId);
  const schedule = scheduleRecords(state).find(record => record.id === scheduleId);
  const houses = (schedule?.structureDetails?.rows || [])
    .filter(row => row.structureType || row.builtUpAreaSqFt)
    .map((row, index) => ({
      id: row.id, name: row.floorNo || `Structure ${index + 1}`, enabled: true,
      structureType: row.structureType === 'Other / Custom Structure' ? row.customStructureType || '' : row.structureType || '',
      roofType: schedule?.values.roofMaterial || '',
      plinthAreaSqFt: Number(row.builtUpAreaSqFt) || '' as const,
    }));
  return {
    ...base,
    id: `exact-plan-${scheduleId}`, title: 'PLAN FOR REGISTRATION',
    // Stable metadata prevents a read-only parent render from becoming a new plan.
    createdAt: '', updatedAt: '',
    property: { ...base.property, propertyType: base.property.propertyType === 'Plot' ? 'Open Plot' : base.property.propertyType,
      house: houses[0], houses },
    executant: base.executants || [base.executant], claimant: base.claimants || [base.claimant],
  };
}

export type RefreshField = { path: string[]; label: string; before: unknown; after: unknown; remove?: boolean };
export function exactRefreshFields(plan: PlanDocument, seed: PlanDocument): RefreshField[] {
  const fields: RefreshField[] = [];
  const visit = (before: any, after: any, path: string[]) => {
    if (after && typeof after === 'object') {
      Object.keys(after).forEach(key => visit(before?.[key], after[key], [...path, key]));
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      fields.push({ path, label: path.join(' · '), before, after });
    }
  };
  // Refresh deed facts, including values cleared upstream; never drawing settings.
  for (const key of ['areaSqYards', 'areaSqMtrs', 'propertyType', 'surveyNo', 'plotNo', 'houseNo', 'nearHNo', 'locality', 'village', 'mandal', 'district', 'locationTemplateType']) {
    visit((plan.property as any)[key], (seed.property as any)[key], ['property', key]);
  }
  for (const key of ['northBoundary', 'southBoundary', 'eastBoundary', 'westBoundary']) {
    visit((plan.boundaries as any)[key], (seed.boundaries as any)[key], ['boundaries', key]);
  }
  for (const role of ['executant', 'claimant'] as const) {
    for (let index = 0; index < Math.max(plan[role].length, seed[role].length); index++) {
      const path = [role, String(index)];
      if (!seed[role][index]) fields.push({ path, label: `${role} ${index + 1} · remove party`, before: plan[role][index], after: undefined, remove: true });
      else if (!plan[role][index]) fields.push({ path, label: `${role} ${index + 1} · add party`, before: undefined, after: seed[role][index] });
      else visit(plan[role][index], seed[role][index], path);
    }
  }
  seed.property.houses?.forEach((house, index) => {
    for (const key of ['structureType', 'roofType', 'plinthAreaSqFt']) {
      visit((plan.property.houses?.[index] as any)?.[key], (house as any)[key], ['property', 'houses', String(index), key]);
    }
  });
  return fields;
}

export function applyExactRefresh(plan: PlanDocument, fields: RefreshField[]): PlanDocument {
  const result = structuredClone(plan);
  const ordered = [...fields].sort((a, b) => Number(!!a.remove) - Number(!!b.remove)
    || (a.remove && b.remove ? Number(b.path.at(-1)) - Number(a.path.at(-1)) : 0));
  for (const { path, after, remove } of ordered) {
    let target: any = result;
    path.slice(0, -1).forEach((key, index) => { target = target[key] ??= /^\d+$/.test(path[index + 1]) ? [] : {}; });
    if (remove && Array.isArray(target)) target.splice(Number(path.at(-1)), 1);
    else if (Array.isArray(target) && Number(path.at(-1)) >= target.length) target.push(structuredClone(after));
    else target[path[path.length - 1]] = structuredClone(after);
  }
  if (result.property.houses?.length) result.property.house = result.property.houses[0];
  result.updatedAt = new Date().toISOString();
  return result;
}

export function isExactPlan(value: any): value is PlanDocument {
  return !!value && typeof value.id === 'string' && typeof value.title === 'string'
    && !!value.property && typeof value.property.surveyNo === 'string'
    && !!value.boundaries && ['northDim', 'southDim', 'eastDim', 'westDim'].every(key =>
      value.boundaries[key] && typeof value.boundaries[key].raw === 'string' && Number.isFinite(value.boundaries[key].normalized))
    && Array.isArray(value.executant) && Array.isArray(value.claimant) && !!value.witnesses;
}
