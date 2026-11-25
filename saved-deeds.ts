import { accountStore, session } from './account';
import type { PlanDocument as GuidedPlanDocument } from './step13-reference-plan/src/types';
import type { Draft } from './source-draft';
import type { PlanDocument } from './plan-sketch-types';
import type { PlanDocument as ReferencePlanDocument } from './reference-plan/src/types';
import type { DeedTemplateSource } from './docx';
import type { GenerationManifest } from './deed-compiler';
import type { TemplatePin } from './template-library-types';

export type SavedDeed = {
  id: string;
  updatedAt: string;
  name?: string;
  claimantNames: string[];
  deedType: string;
  draft: Draft;
  sourceFiles: Record<string, File[]>;
  planDrafts: Record<string, PlanDocument>;
  step13PlanDrafts?: Record<string, GuidedPlanDocument>;
  step13PlanSelectedSvgs?: Record<string, string>;
  referencePlanDrafts: Record<string, ReferencePlanDocument>;
  selectedPlanSvgs: Record<string, string>;
  extraPartyRecords: { executant: string[]; claimant: string[] };
  templateMode: 'built-in' | 'custom';
  customTemplate: Extract<DeedTemplateSource, { kind: 'custom' }> | null;
  libraryTemplate?: TemplatePin | null;
  generationManifest?: GenerationManifest | null;
};


const deeds = accountStore<SavedDeed>('deed');
export const listSavedDeeds = async () => (await deeds.list()).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
export const openSavedDeed = (deed: SavedDeed) => deeds.open(deed.id, deed);
export const saveDeed = (deed: SavedDeed, owner = session?.user.id) => deeds.save(deed.id, deed, owner);
export const saveDeeds = async (items: SavedDeed[]) => {
  const owner = session?.user.id;
  for (const deed of items) await saveDeed(deed, owner);
};
export const deleteDeed = deeds.remove;
