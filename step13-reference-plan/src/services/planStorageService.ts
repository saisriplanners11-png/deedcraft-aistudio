import type { PlanDocument } from '../types';
import { accountStore } from '../../../account';
const plans = accountStore<PlanDocument>('guided-plan');
export function generatePlanTitle(doc: PlanDocument): string {
  const claimants = Array.isArray(doc.claimant) ? doc.claimant : (doc.claimant ? [doc.claimant] : []);
  const validClaimants = claimants
    .filter((c) => c && c.name && c.name.trim())
    .map((c) => c.name.trim().toUpperCase());

  const executants = Array.isArray(doc.executant) ? doc.executant : (doc.executant ? [doc.executant] : []);
  const validExecutants = executants
    .filter((e) => e && e.name && e.name.trim())
    .map((e) => e.name.trim().toUpperCase());

  const p = doc.property || ({} as any);
  const propParts: string[] = [];
  if (p.propertyType) propParts.push(p.propertyType);
  if (p.areaSqYards) propParts.push(`${p.areaSqYards} Sq.Yds`);
  if (p.surveyNo) propParts.push(`Sy.No. ${p.surveyNo}`);
  if (p.plotNo) propParts.push(`Plot ${p.plotNo}`);
  if (p.houseNo) propParts.push(`H.No. ${p.houseNo}`);
  if (p.village) propParts.push(p.village);

  const propSummary = propParts.length > 0 ? propParts.join(' - ') : 'Registration Plan';

  // 1. Claimant Name Priority
  if (validClaimants.length > 0) {
    const claimantStr = validClaimants.join(' & ');
    return `${claimantStr} (Claimant) - ${propSummary}`;
  }

  // 2. Executant Name Secondary
  if (validExecutants.length > 0) {
    const execStr = validExecutants.join(' & ');
    return `${execStr} (Executant) - ${propSummary}`;
  }

  return propSummary;
}

export const planStorageService = {
  async getAllPlans() { return (await plans.list()).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); },
  getPlansSynchronous(): PlanDocument[] { return []; },
  async savePlan(
    doc: PlanDocument,
    options?: { asNewCopy?: boolean; customTitle?: string }
  ): Promise<{ savedPlan: PlanDocument; totalCount: number }> {
    const isNew = options?.asNewCopy || !doc.id || doc.id.startsWith('sample-');
    const newId = isNew ? `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}` : doc.id;
    
    let planTitle = options?.customTitle || doc.title;
    const autoTitle = generatePlanTitle(doc);

    if (!options?.customTitle) {
      const hasGenericTitle =
        !planTitle ||
        planTitle === 'Untitled Registration Plan' ||
        planTitle === 'Registration Plan' ||
        planTitle.startsWith('Registration Plan (') ||
        planTitle.startsWith('R.C.C. Building House') ||
        planTitle.startsWith('Standard Residential Plot') ||
        planTitle.startsWith('Corner Property with') ||
        planTitle.startsWith('Open Place (');

      const claimants = Array.isArray(doc.claimant) ? doc.claimant : (doc.claimant ? [doc.claimant] : []);
      const primaryClaimant = claimants.find((c) => c && c.name && c.name.trim())?.name?.trim();

      // If generic title or if a claimant exists and is not yet in the title
      if (hasGenericTitle || (primaryClaimant && !planTitle.toUpperCase().includes(primaryClaimant.toUpperCase())) || isNew) {
        planTitle = isNew && doc.title && !hasGenericTitle && !doc.id.startsWith('sample-')
          ? `${doc.title} (Copy)`
          : autoTitle;
      }
    }

    const toSave: PlanDocument = {
      ...doc,
      id: newId,
      title: planTitle,
      createdAt: isNew ? new Date().toISOString().split('T')[0] : (doc.createdAt || new Date().toISOString().split('T')[0]),
      updatedAt: new Date().toISOString().split('T')[0],
      executant: Array.isArray(doc.executant) ? doc.executant : (doc.executant ? [doc.executant] : []),
      claimant: Array.isArray(doc.claimant) ? doc.claimant : (doc.claimant ? [doc.claimant] : []),
    };

    await plans.save(toSave.id, toSave);
    return { savedPlan: toSave, totalCount: (await plans.list()).length };
  },
  async deletePlan(id: string) { await plans.remove(id); return this.getAllPlans(); },
  async duplicatePlan(id: string) {
    const plan = (await plans.list()).find(item => item.id === id);
    return plan ? (await this.savePlan(plan, { asNewCopy: true })).savedPlan : null;
  },
  async importPlans(items: PlanDocument[]) {
    await plans.list();
    for (const item of items) await plans.save(item.id, item);
    return this.getAllPlans();
  },
};
