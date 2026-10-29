import type { AppState } from './logic';

export const MUNICIPAL_GIFT_VARIANT = 'municipal-gift';
export const MUNICIPAL_GIFT_TEMPLATE = 'gift-municipal-v3';
export const MUNICIPAL_GIFT_CATEGORIES = ['Vacant Plot', 'Open Place', 'Demolished', 'Part open place'];

export const isMunicipalGift = (state: Pick<AppState, 'deedType' | 'draft'>) =>
  state.deedType === 'Gift' && ['Gift to Local Bodies', 'Municipal Gift'].includes(state.draft);

export const giftTemplateVersion = (variant?: string) =>
  variant === MUNICIPAL_GIFT_VARIANT ? MUNICIPAL_GIFT_TEMPLATE : 'gift-deed-v6';
