import type { AppState } from './logic';

export const MUNICIPAL_GIFT_VARIANT = 'municipal-gift';
export const MUNICIPAL_GIFT_TEMPLATE = 'gift-municipal-v3';
export const MUNICIPAL_GIFT_CATEGORIES = ['Vacant Plot', 'Open Place', 'Demolished', 'Part open place'];

/** User-approved council-only closing. Jurisdiction never supplies the recipient. */
export function municipalCouncilRecital(name: string): string {
  if (!/^(?:THE\s+)?MUNICIPAL\s+COUNCIL\b/i.test(name.trim())) return '';
  return name.trim().replace(/[,.\s]+$/, '') + ', constitute under Hyderabad Municipal Corporation Act 1965. Represented by its Commissioner (Hereinafter called the “DONEE”) which expression shall, unless repugnant to the context or meaning thereof, include its successors in office and permitted assigns, of the OTHER PART.';
}

export const isMunicipalGift = (state: Pick<AppState, 'deedType' | 'draft'>) =>
  state.deedType === 'Gift' && ['Gift to Local Bodies', 'Municipal Gift'].includes(state.draft);

export const giftTemplateVersion = (variant?: string) =>
  variant === MUNICIPAL_GIFT_VARIANT ? MUNICIPAL_GIFT_TEMPLATE : 'gift-deed-v6';
