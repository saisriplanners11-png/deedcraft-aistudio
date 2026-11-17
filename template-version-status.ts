import { appStateFor, type Draft } from './source-draft';
import { isBankReconveyance, reconveyanceTemplateVersion } from './reconveyance';
import { isGeneralPoa } from './poa-options';
import type { SavedDeed } from './saved-deeds';
import type { TemplatePin } from './template-library-types';
import { bundledTemplatePin } from './template-library-client';
import { DEED_PRESERVATION_VERSION } from './deed-preservation';
import { libraryFamilyFor, TEMPLATE_FAMILIES, type TemplateFamilyId } from './template-library-families';
import { releaseGate, TEMPLATE_VERSIONS } from './legal-registry';

export function templateIsEarlier(pin: TemplatePin, latest?: TemplatePin | null): boolean {
  return !!latest && (pin.versionId !== latest.versionId || pin.hash !== latest.hash || (pin.packageHash || '') !== (latest.packageHash || ''));
}

export function defaultTemplateForDraft(draft: Pick<Draft, 'instrumentId' | 'variantId'>, defaults: Record<string, TemplatePin>, cached?: TemplatePin | null, bankReconveyance = false): TemplatePin | undefined {
  const instrument = draft.instrumentId || 'sale';
  if (instrument === 'reconveyance' && !bankReconveyance) return bundledTemplatePin(reconveyanceTemplateVersion(false));
  if (instrument === 'power_of_attorney' && !isGeneralPoa(instrument, draft.variantId)) return undefined;
  const family = libraryFamilyFor(instrument, draft.variantId);
  if (!Object.hasOwn(TEMPLATE_FAMILIES, family)) return undefined;
  if (defaults[family]) return defaults[family];
  const isLegacySale = family === 'sale' && /^sale-[0-9a-f-]{36}$/.test(cached?.versionId || '');
  if (cached && (cached.family === family || isLegacySale) && !TEMPLATE_VERSIONS.some(version => version.id === cached.versionId)) return cached;
  return bundledTemplatePin(TEMPLATE_FAMILIES[family as TemplateFamilyId].defaultId);
}

export function savedTemplateStatus(deed: SavedDeed, defaults: Record<string, TemplatePin> = {}) {
  if (deed.templateMode === 'custom') return { label: `Custom template: ${deed.customTemplate?.name || 'saved Word document'}`, earlier: false };
  if (!releaseGate(deed.draft.instrumentId, deed.draft.variantId).ready && deed.draft.instrumentId !== 'sale') return { label: 'Reference required', earlier: false };
  const latest = savedDefault(deed, defaults);
  const pin = deed.libraryTemplate || latest;
  return pin ? { label: `${pin.name} (${pin.versionId})`, earlier: templateIsEarlier(pin, latest) } : { label: 'Reference required', earlier: false };
}

function savedDefault(deed: SavedDeed, defaults: Record<string, TemplatePin>) {
  return defaultTemplateForDraft(deed.draft, defaults, deed.libraryTemplate, deed.draft.instrumentId === 'reconveyance' && isBankReconveyance(appStateFor(deed.draft)));
}

/** Refresh template metadata without changing any entered deed facts or edit dates. */
export function updateSavedDeedTemplate(deed: SavedDeed, defaults: Record<string, TemplatePin>): SavedDeed {
  if (deed.generationManifest && deed.generationManifest.preservationVersion !== DEED_PRESERVATION_VERSION) deed = { ...deed, generationManifest: null };
  if (deed.templateMode === 'custom') return deed;
  const pin = savedDefault(deed, defaults);
  if (!pin || (deed.libraryTemplate && !templateIsEarlier(deed.libraryTemplate, pin))) return deed;
  return { ...deed, ...(deed.draft.instrumentId === 'agreement_of_sale' ? { deedType: 'Agreement of Sale Cum GPA' } : {}), libraryTemplate: pin, generationManifest: null };
}
