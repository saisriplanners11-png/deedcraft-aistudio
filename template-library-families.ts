import type { InstrumentId } from './instruments';

type TemplateFamily = { label: string; instrumentId: InstrumentId; variantId: string; defaultId: string };

export const TEMPLATE_FAMILIES = {
  sale: { label: 'Sale Deed', instrumentId: 'sale', variantId: 'outright-absolute-sale-deed', defaultId: 'sale-deed-v12' },
  gift: { label: 'Gift Settlement', instrumentId: 'gift', variantId: 'family-gift', defaultId: 'gift-deed-v7' },
  'municipal-gift': { label: 'Municipal Gift', instrumentId: 'gift', variantId: 'municipal-gift', defaultId: 'gift-municipal-v4' },
  agreement_of_sale: { label: 'Agreement of Sale Cum GPA', instrumentId: 'agreement_of_sale', variantId: 'with-possession', defaultId: 'agreement-sale-gpa-v5' },
  power_of_attorney: { label: 'General / Family GPA', instrumentId: 'power_of_attorney', variantId: 'general-power-of-attorney', defaultId: 'general-poa-v4' },
  release: { label: 'Release Deed', instrumentId: 'release', variantId: 'co-owner-release', defaultId: 'release-deed-v2' },
  reconveyance: { label: 'Bank Reconveyance', instrumentId: 'reconveyance', variantId: 'title-deed', defaultId: 'reconveyance-deed-v2' },
} as const satisfies Record<string, TemplateFamily>;

export type TemplateFamilyId = keyof typeof TEMPLATE_FAMILIES;

export function libraryFamilyFor(instrumentId: string, variantId?: string): string {
  return instrumentId === 'gift' && variantId === 'municipal-gift' ? 'municipal-gift' : instrumentId;
}
