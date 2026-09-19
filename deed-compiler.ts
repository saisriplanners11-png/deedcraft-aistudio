import { fillSaleDeed, type MergeResult, type Rewrite, type ScheduleMerge } from './docx';
import type { InstrumentId } from './instruments';
import { definitionFor } from './instruments';
import { releaseGate } from './legal-registry';
import { approvalAllowsGeneration, type ProfessionalApproval } from './professional-review';

export interface DraftSnapshot {
  instrumentId: InstrumentId;
  variantId: string;
  snapshotHash: string;
  values: Record<string, string>;
  schedules: ScheduleMerge[];
  unresolvedWarnings: string[];
  approval: ProfessionalApproval;
  rewrites?: Rewrite[];
  planPages?: Uint8Array[];
}
export interface CompiledDeed {
  snapshot: DraftSnapshot;
  templateVersionId: string;
  ruleVersion?: string;
}
export interface GenerationManifest {
  instrumentId: InstrumentId;
  definitionVersion: string;
  templateVersionId: string;
  ruleVersion?: string;
  inputSnapshotHash: string;
  unresolvedWarnings: string[];
  approvedBy: string;
  approvedAt?: string;
  outputHash?: string;
}

export function compileDeed(snapshot: DraftSnapshot): CompiledDeed {
  const gate = releaseGate(snapshot.instrumentId, snapshot.variantId);
  if (!gate.ready || !gate.reference?.templateVersionId) throw new Error(gate.reasons.join(' '));
  if (!approvalAllowsGeneration(snapshot.approval, snapshot.snapshotHash, snapshot.unresolvedWarnings)) {
    throw new Error('Professional approval of this exact draft snapshot is required before final generation.');
  }
  return { snapshot, templateVersionId: gate.reference.templateVersionId, ruleVersion: definitionFor(snapshot.instrumentId).dutyRuleSetId };
}

export async function renderArtifact(compiled: CompiledDeed, format: 'docx'): Promise<{ result: MergeResult; manifest: GenerationManifest }> {
  if (format !== 'docx') throw new Error('Only DOCX rendering is approved at this time.');
  if (compiled.snapshot.instrumentId !== 'sale') throw new Error('No approved renderer is registered for this instrument.');
  const first = compiled.snapshot.schedules[0];
  if (!first) throw new Error('At least one property schedule is required by the Sale template.');
  const result = await fillSaleDeed(compiled.snapshot.values, first.variant, compiled.snapshot.rewrites || [], compiled.snapshot.schedules, compiled.snapshot.planPages || []);
  return {
    result,
    manifest: {
      instrumentId: compiled.snapshot.instrumentId,
      definitionVersion: definitionFor(compiled.snapshot.instrumentId).version,
      templateVersionId: compiled.templateVersionId,
      ruleVersion: compiled.ruleVersion,
      inputSnapshotHash: compiled.snapshot.snapshotHash,
      unresolvedWarnings: compiled.snapshot.unresolvedWarnings,
      approvedBy: compiled.snapshot.approval.reviewerName,
      approvedAt: compiled.snapshot.approval.approvedAt,
    },
  };
}

export function validateTemplateContract(instrumentId: InstrumentId, availableBindings: string[]): string[] {
  const definition = definitionFor(instrumentId);
  const available = new Set(availableBindings);
  return definition.templateBindings.filter(binding => !available.has(binding.placeholder)).map(binding => `Missing template placeholder: ${binding.placeholder}`);
}

