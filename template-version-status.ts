import { isGeneralPoa } from './poa-options';
import { giftTemplateVersion } from './municipal-gift';
import type { SavedDeed } from './saved-deeds';
import type { TemplatePin } from './template-library-types';
import { bundledTemplatePin } from './template-library-client';

export function templateIsEarlier(pin: TemplatePin, latest?: TemplatePin | null): boolean {
  return !!latest && (pin.versionId !== latest.versionId || pin.hash !== latest.hash || (pin.packageHash || '') !== (latest.packageHash || ''));
}

export function savedTemplateStatus(deed: SavedDeed, latest?: TemplatePin | null) {
  if (deed.templateMode === 'custom') return { label: `Custom template: ${deed.customTemplate?.name || 'saved Word document'}`, earlier: false };
  if (isGeneralPoa(deed.draft.instrumentId, deed.draft.variantId)) return { label: 'General Power of Attorney v1 (general-poa-v1)', earlier: false };
  if (deed.draft.instrumentId === 'agreement_of_sale') return { label: 'Agreement of Sale Cum GPA v2 (agreement-sale-gpa-v2)', earlier: false };
  if (deed.draft.instrumentId === 'gift' && deed.draft.variantId === 'municipal-gift') return { label: 'Municipal Gift v1 (gift-municipal-v1)', earlier: false };
  if (deed.draft.instrumentId === 'gift') return { label: 'Gift Settlement v4 (gift-deed-v4)', earlier: false };
  if (deed.draft.instrumentId && deed.draft.instrumentId !== 'sale') return { label: 'Reference required', earlier: false };
  const pin = deed.libraryTemplate || bundledTemplatePin(deed.generationManifest?.templateVersionId);
  return { label: `${pin.name} (${pin.versionId})`, earlier: templateIsEarlier(pin, latest) };
}

/** Refresh template metadata without changing any entered deed facts or edit dates. */
export function updateSavedDeedTemplate(deed: SavedDeed, defaults: Record<string, TemplatePin>): SavedDeed {
  if (deed.templateMode === 'custom') return deed;
  const pin = isGeneralPoa(deed.draft.instrumentId, deed.draft.variantId) ? bundledTemplatePin('general-poa-v1') : deed.draft.instrumentId === 'agreement_of_sale' ? bundledTemplatePin('agreement-sale-gpa-v2') : deed.draft.instrumentId === 'gift' ? bundledTemplatePin(giftTemplateVersion(deed.draft.variantId)) : defaults[deed.draft.instrumentId || 'sale'];
  if (!pin || (deed.libraryTemplate && !templateIsEarlier(deed.libraryTemplate, pin))) return deed;
  return { ...deed, ...(deed.draft.instrumentId === 'agreement_of_sale' ? { deedType: 'Agreement of Sale Cum GPA' } : {}), libraryTemplate: pin, generationManifest: null };
}
