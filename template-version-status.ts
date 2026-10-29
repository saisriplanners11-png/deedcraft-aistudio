import { isGeneralPoa } from './poa-options';
import { giftTemplateVersion } from './municipal-gift';
import type { SavedDeed } from './saved-deeds';
import type { TemplatePin } from './template-library-types';
import { bundledTemplatePin } from './template-library-client';
import { DEED_PRESERVATION_VERSION } from './deed-preservation';

export function templateIsEarlier(pin: TemplatePin, latest?: TemplatePin | null): boolean {
  return !!latest && (pin.versionId !== latest.versionId || pin.hash !== latest.hash || (pin.packageHash || '') !== (latest.packageHash || ''));
}

export function savedTemplateStatus(deed: SavedDeed, latest?: TemplatePin | null) {
  if (deed.templateMode === 'custom') return { label: `Custom template: ${deed.customTemplate?.name || 'saved Word document'}`, earlier: false };
  if (isGeneralPoa(deed.draft.instrumentId, deed.draft.variantId)) return { label: 'General Power of Attorney v3 (general-poa-v3)', earlier: false };
  if (deed.draft.instrumentId === 'agreement_of_sale') return { label: 'Agreement of Sale Cum GPA v4 (agreement-sale-gpa-v4)', earlier: false };
  if (deed.draft.instrumentId === 'gift' && deed.draft.variantId === 'municipal-gift') return { label: 'Municipal Gift v3 (gift-municipal-v3)', earlier: false };
  if (deed.draft.instrumentId === 'gift') return { label: 'Gift Settlement v6 (gift-deed-v6)', earlier: false };
  if (deed.draft.instrumentId && deed.draft.instrumentId !== 'sale') return { label: 'Reference required', earlier: false };
  const pin = deed.libraryTemplate || bundledTemplatePin(deed.generationManifest?.templateVersionId);
  return { label: `${pin.name} (${pin.versionId})`, earlier: templateIsEarlier(pin, latest) };
}

/** Refresh template metadata without changing any entered deed facts or edit dates. */
export function updateSavedDeedTemplate(deed: SavedDeed, defaults: Record<string, TemplatePin>): SavedDeed {
  if (deed.generationManifest && deed.generationManifest.preservationVersion !== DEED_PRESERVATION_VERSION) deed = { ...deed, generationManifest: null };
  if (deed.templateMode === 'custom') return deed;
  const pin = isGeneralPoa(deed.draft.instrumentId, deed.draft.variantId) ? bundledTemplatePin('general-poa-v3') : deed.draft.instrumentId === 'agreement_of_sale' ? bundledTemplatePin('agreement-sale-gpa-v4') : deed.draft.instrumentId === 'gift' ? bundledTemplatePin(giftTemplateVersion(deed.draft.variantId)) : defaults[deed.draft.instrumentId || 'sale'];
  if (!pin || (deed.libraryTemplate && !templateIsEarlier(deed.libraryTemplate, pin))) return deed;
  return { ...deed, ...(deed.draft.instrumentId === 'agreement_of_sale' ? { deedType: 'Agreement of Sale Cum GPA' } : {}), libraryTemplate: pin, generationManifest: null };
}
