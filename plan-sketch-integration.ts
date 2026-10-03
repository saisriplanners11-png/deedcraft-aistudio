import { partyRecords, scheduleRecords, type AppState } from './logic';
import type { PlanDocument } from './plan-sketch-types';

export type PlanDeedChange = {
  role: 'property' | 'executant' | 'claimant';
  index: number;
  field: string;
  label: string;
  before: string;
  after: string;
};

/** Only fields with a direct, unambiguous counterpart in the deed are offered. */
export function planDeedChanges(state: AppState, scheduleId: string, plan: PlanDocument): PlanDeedChange[] {
  const schedule = scheduleRecords(state).find(record => record.id === scheduleId);
  if (!schedule) return [];
  const propertyPairs: [string, string, unknown][] = [
    ['extentSqYards', 'Area (Sq. Yards)', plan.property.areaSqYards],
    ['surveyNo', 'Survey no.', plan.property.surveyNo], ['plotNo', 'Plot no.', plan.property.plotNo],
    ['bearingHNo', 'Bearing H.No.', plan.property.houseNo], ['nearHNo', 'Near H.No.', plan.property.nearHNo],
    ['locality', 'Locality', plan.property.locality], ['village', 'Village', plan.property.village],
    ['mandal', 'Mandal', plan.property.mandal], ['district', 'District', plan.property.district],
    ['boundaryNorth', 'North boundary', plan.boundaries.northBoundary],
    ['boundarySouth', 'South boundary', plan.boundaries.southBoundary],
    ['boundaryEast', 'East boundary', plan.boundaries.eastBoundary],
    ['boundaryWest', 'West boundary', plan.boundaries.westBoundary],
  ];
  const changes: PlanDeedChange[] = [];
  for (const [field, label, raw] of propertyPairs) {
    const after = String(raw ?? '').trim();
    const before = String(schedule.values[field] || '').trim();
    if (after && after !== before) changes.push({ role: 'property', index: 0, field, label, before, after });
  }
  for (const role of ['executant', 'claimant'] as const) {
    const records = partyRecords(state, role);
    const people = role === 'executant' ? plan.executants?.length ? plan.executants : [plan.executant]
      : plan.claimants?.length ? plan.claimants : [plan.claimant];
    for (let index = 0; index < people.length; index++) {
      const person = people[index];
      for (const [suffix, label, raw] of [
        ['Name', 'Name', person.name], ['Relation', 'Relation', person.relation],
        ['RelativeName', 'Relative name', person.relativeName], ['Age', 'Age', person.age],
        ['Occupation', 'Occupation', person.occupation],
      ]) {
        const field = `${role}${suffix}`;
        const before = String(records[index]?.values[field] || '').trim();
        const after = String(raw || '').trim();
        if (after && after !== before) changes.push({ role, index, field, label: `${role} ${index + 1} ${label}`, before, after });
      }
    }
  }
  return changes;
}
