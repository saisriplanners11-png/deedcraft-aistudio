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

/** Compare registration particulars, never schedule jurisdiction or document number alone. */
export function uniqueMunicipalLinks(records: Record<string, string>[], keys: { number: string; date: string; office: string; code: string }) {
  const normalize = (text = '') => text.trim().toLowerCase().replace(/\s+/g, ' ');
  const unique: Record<string, string>[] = [];
  for (const record of records) {
    const number = normalize(record[keys.number]).replace(/\s*\/\s*/g, '/');
    const date = normalize(record[keys.date]);
    const office = normalize(record['Municipal Link Registered Office'] ?? record[keys.office]);
    const code = normalize(record[keys.code]);
    const index = number && office ? unique.findIndex(other =>
      normalize(other[keys.number]).replace(/\s*\/\s*/g, '/') === number
      && normalize(other[keys.date]) === date && normalize(other['Municipal Link Registered Office'] ?? other[keys.office]) === office
      && (!code || !other[keys.code]?.trim() || normalize(other[keys.code]) === code)) : -1;
    if (index < 0) { unique.push(record); continue; }
    const prior = unique[index];
    const authority = record['Link Authority'];
    const priorAuthority = prior['Link Authority'];
    if (authority && priorAuthority && authority !== priorAuthority) {
      throw new Error(`Link document ${record[keys.number]} has conflicting issuing authority. Match the entries across schedules before downloading.`);
    }
    if (authority && !priorAuthority) {
      unique[index] = { ...prior, ...Object.fromEntries(Object.entries(record).filter(([key]) => ['Link Authority'].includes(key))) };
    }
  }
  return unique;
}
