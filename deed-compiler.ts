import { BUILT_IN_TEMPLATE_SOURCE, fillSaleDeed, fillGiftDeed, fillAgreementSaleGpaDeed, fillGeneralPoaDeed, type DeedTemplateSource, type MergeResult, type Rewrite, type ScheduleMerge } from './docx';
import type { InstrumentId } from './instruments';
import { definitionFor } from './instruments';
import { releaseGate } from './legal-registry';
import { bindTemplateFields, type TemplateFieldData } from './template-field-values';
import { readZip, writeZip } from './docx';
import { sha256 } from './template-library-client';
import { canonicalContract } from './template-fields';

export interface DraftSnapshot {
  instrumentId: InstrumentId;
  variantId: string;
  snapshotHash: string;
  values: Record<string, string>;
  schedules: ScheduleMerge[];
  unresolvedWarnings: string[];
  rewrites?: Rewrite[];
  templateFieldData?: TemplateFieldData;
}
export interface CompiledDeed {
  snapshot: DraftSnapshot;
  templateVersionId: string;
  ruleVersion?: string;
  templateSource?: DeedTemplateSource;
}
export interface GenerationManifest {
  instrumentId: InstrumentId;
  definitionVersion: string;
  templateVersionId: string;
  ruleVersion?: string;
  inputSnapshotHash: string;
  unresolvedWarnings: string[];
  outputHash?: string;
  templateHash?: string;
  schemaHash?: string;
  packageHash?: string;
}

export function compileDeed(snapshot: DraftSnapshot, templateSource: DeedTemplateSource = BUILT_IN_TEMPLATE_SOURCE): CompiledDeed {
  if (snapshot.values['Minor Representation Complete'] === 'false') throw new Error('Complete minor guardian details and court permission for each minor executant before generating the deed.');
  const gate = releaseGate(snapshot.instrumentId, snapshot.variantId);
  if (!gate.ready || !gate.reference?.templateVersionId) throw new Error(gate.reasons.join(' '));
  if (snapshot.instrumentId === 'sale' && snapshot.values['Sale Document Mode'] && snapshot.values['Sale Document Mode'] !== 'ordinary') {
    for (const tag of ['G.P.A.Doct.No.', 'G.P.A.Doct.Date', 'Authority SRO', 'Authority SRO Code']) if (!snapshot.values[tag]) throw new Error('Complete the sale authority details before generating the deed.');
  }
  return { snapshot, templateSource, templateVersionId: templateSource.kind === 'library' ? templateSource.versionId : templateSource.kind === 'custom' ? `custom:${templateSource.hash}` : gate.reference.templateVersionId, ruleVersion: definitionFor(snapshot.instrumentId).dutyRuleSetId };
}

export async function renderArtifact(
  compiled: CompiledDeed,
  format: 'docx',
  templateSource: DeedTemplateSource = compiled.templateSource || BUILT_IN_TEMPLATE_SOURCE,
): Promise<{ result: MergeResult; manifest: GenerationManifest }> {
  if (format !== 'docx') throw new Error('Only DOCX rendering is approved at this time.');
  if (!['sale', 'gift', 'agreement_of_sale', 'power_of_attorney'].includes(compiled.snapshot.instrumentId)) throw new Error('No approved renderer is registered for this instrument.');
  const first = compiled.snapshot.schedules[0];
  if (!first) throw new Error('At least one property schedule is required by the Sale template.');
  const binding = bindTemplateFields(templateSource.kind === 'built-in' ? undefined : templateSource.fieldContract, compiled.snapshot.templateFieldData || { records: [], values: {} }, compiled.snapshot.values, compiled.snapshot.schedules, compiled.snapshot.rewrites || []);
  if (binding.errors.length) throw new Error(binding.errors.join(' '));
  if (templateSource.kind !== 'built-in' && templateSource.fieldContract?.fields.length && !compiled.snapshot.templateFieldData) throw new Error('Template field values are missing from this draft snapshot.');
  const result = compiled.snapshot.instrumentId === 'power_of_attorney'
    ? await fillGeneralPoaDeed({ ...binding.values, 'Poa Variant': compiled.snapshot.variantId }, binding.rewrites, binding.schedules, templateSource)
    : compiled.snapshot.instrumentId === 'agreement_of_sale'
    ? await fillAgreementSaleGpaDeed({ ...binding.values, 'Agreement Possession Variant': compiled.snapshot.variantId }, binding.rewrites, binding.schedules, templateSource)
    : compiled.snapshot.instrumentId === 'gift'
    ? await fillGiftDeed({ ...binding.values, 'Gift Variant': compiled.snapshot.variantId }, binding.rewrites, binding.schedules, templateSource)
    : await fillSaleDeed(binding.values, first.variant, binding.rewrites, binding.schedules, templateSource);
  if (binding.markers.length) {
    const entries = await readZip(new Uint8Array(await result.blob.arrayBuffer()));
    const document = entries.find(entry => entry.name === 'word/document.xml')!;
    let xml = new TextDecoder().decode(document.data);
    for (const marker of binding.markers) {
      const encoded = marker.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (!xml.includes(encoded)) throw new Error('A configured field was discarded by a generated section. Move its placeholder to a standalone paragraph in the template.');
      xml = xml.split(encoded).join('');
    }
    document.data = new TextEncoder().encode(xml); result.blob = new Blob([await writeZip(entries) as any], { type: result.blob.type });
  }
  const schemaHash = templateSource.kind === 'library' ? templateSource.schemaHash : templateSource.kind === 'custom' ? await sha256(new TextEncoder().encode(canonicalContract(templateSource.fieldContract))) : undefined;
  const templateHash = templateSource.kind === 'custom' ? await sha256(templateSource.bytes) : templateSource.kind === 'library' ? templateSource.hash : undefined;
  const packageHash = templateSource.kind === 'library' ? templateSource.packageHash : templateSource.kind === 'custom' ? await sha256(new TextEncoder().encode(templateHash + ':' + schemaHash + ':custom-fields-1')) : undefined;
  return {
    result,
    manifest: {
      instrumentId: compiled.snapshot.instrumentId,
      definitionVersion: definitionFor(compiled.snapshot.instrumentId).version,
      templateVersionId: templateSource.kind === 'library' ? templateSource.versionId : templateSource.kind === 'custom' ? `custom:${templateSource.hash}` : compiled.templateVersionId,
      templateHash, schemaHash, packageHash,
      ruleVersion: compiled.ruleVersion,
      inputSnapshotHash: compiled.snapshot.snapshotHash,
      unresolvedWarnings: compiled.snapshot.unresolvedWarnings,
    },
  };
}

export function validateTemplateContract(instrumentId: InstrumentId, availableBindings: string[]): string[] {
  const definition = definitionFor(instrumentId);
  const available = new Set(availableBindings);
  return definition.templateBindings.filter(binding => !available.has(binding.placeholder)).map(binding => `Missing template placeholder: ${binding.placeholder}`);
}
