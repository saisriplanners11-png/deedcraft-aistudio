import type { SavedDeed } from './saved-deeds';
import type { TemplatePin } from './template-library-types';
import { bundledTemplatePin } from './template-library-client';

export function templateIsEarlier(pin: TemplatePin, latest?: TemplatePin | null): boolean {
  return !!latest && (pin.versionId !== latest.versionId || pin.hash !== latest.hash || (pin.packageHash || '') !== (latest.packageHash || ''));
}

export function savedTemplateStatus(deed: SavedDeed, latest?: TemplatePin | null) {
  if (deed.templateMode === 'custom') return { label: `Custom template: ${deed.customTemplate?.name || 'saved Word document'}`, earlier: false };
  if (deed.draft.instrumentId === 'gift' && deed.draft.variantId === 'family-gift') return { label: 'Gift Settlement v1 (gift-deed-v1)', earlier: false };
  if (deed.draft.instrumentId && deed.draft.instrumentId !== 'sale') return { label: 'Reference required', earlier: false };
  const pin = deed.libraryTemplate || bundledTemplatePin(deed.generationManifest?.templateVersionId);
  return { label: `${pin.name} (${pin.versionId})`, earlier: templateIsEarlier(pin, latest) };
}
