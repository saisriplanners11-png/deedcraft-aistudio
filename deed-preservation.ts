import type { InstrumentId } from './instruments';

/** Independent of Word assets: updating a draft never changes these rules. */
export const DEED_PRESERVATION_VERSION = '2026-10-30.1';
export type PreservationProfile = 'sale' | 'gift' | 'municipal-gift' | 'agreement_of_sale' | 'power_of_attorney';

export function preservationProfileFor(instrument: InstrumentId, variant = ''): PreservationProfile {
  if (instrument === 'gift') return variant === 'municipal-gift' ? 'municipal-gift' : 'gift';
  if (instrument === 'sale' || instrument === 'agreement_of_sale' || instrument === 'power_of_attorney') return instrument;
  throw new Error(`Template preservation rules and a renderer must be registered for ${instrument} before replacement drafts can be used.`);
}

export function protectedIdentityErrors(text: string, role: string): string[] {
  const tags = new Set([...text.matchAll(/<([^<>]+)>/g)].map(match => match[1].replace(/\s+/g, ' ').trim().toLowerCase()));
  const required = ['NAME', 'RELATION NAME', 'Age', 'Dob', 'Occupation', 'Adhar Number', 'Cell.No.'];
  if (!tags.has(`${role} Address`.toLowerCase())) required.push('H.No.', 'Locality', 'Village', 'Mandal', 'District', 'State', 'Pin Code');
  const authority = role === 'Principal' || role === 'Attorney' ? 'This replacement template would omit GPA/AGPA details. ' : '';
  return required.filter(suffix => !tags.has(`${role} ${suffix}`.toLowerCase())).map(suffix => `${authority}Retain <${role} ${suffix}> in the ${role.toLowerCase()} identity paragraph so a replacement cannot discard saved party details.`);
}

/** Edit only template slots/known application clauses, before personal facts merge. */
export function protectedSourceWording(text: string, profile: PreservationProfile, inSchedule: boolean, identityRole?: string, apply?: (find: RegExp, replacement: string) => void): string {
  const change = (find: RegExp, replacement: string) => { apply?.(find, replacement); text = text.replace(find, replacement); };
  if (identityRole) {
    const errors = protectedIdentityErrors(text, identityRole);
    if (errors.length) throw new Error(errors.join(' '));
    if (identityRole === 'Claimant') change(/<\s*PAN\s*>/gi, '<Claimant PAN>');
    if (!new RegExp('<\\s*' + identityRole + ' PAN\\s*>', 'i').test(text)) {
      const label = `, PAN: <${identityRole} PAN>`;
      if (/\s*\(Hereinafter|\s+hereinafter/i.test(text)) change(/\.?\s*(\(Hereinafter|hereinafter)/i, label + '. $1');
      else change(/([^\s.])\.?\s*$/, '$1' + label + '.');
    }
    if (profile !== 'gift') {
      const side = identityRole === 'Claimant' ? 'Claimant' : identityRole === 'Attorney' ? 'Attorney' : 'Executant';
      const recital = `, holding an undivided share of <${side} Share> in the schedule property`;
      change(/,?\s*holding\s+(?:an?\s+)?undivided\s+shares?\s+of\s*(?:<[^<>]+>|[\d,.]+\s*%|_+\s*%)(?:\s+in\s+(?:the\s+)?schedule(?:d)?\s+property)?\.?/gi, recital);
      change(/,?\s*holding\s+[\d,.]+\s*%\s+(?:ownership\s+)?shares?(?:\s+in\s+(?:the\s+)?schedule(?:d)?\s+property)?\.?/gi, recital);
      if (/\bholding\s+(?:(?:an?\s+)?undivided\s+shares?\b|[\d,.]+\s*%\s+(?:ownership\s+)?shares?\b)/i.test(text.replace(/, holding an undivided share of <(?:Executant|Claimant|Attorney) Share> in the schedule property/gi, ''))) throw new Error('The party share clause in this replacement is not supported. Retain a supported share binding so only entered percentages print.');
    }
  }
  if (inSchedule) {
    if (/^\s*The (?:Donors?|Donees?|vendors?|vendees?) (?:convey|gift|acquire|hold) this Schedule Property in the following undivided shares:/i.test(text)) { change(/[\s\S]+/, ''); return text; }
    change(/\s*NALA converted extent:\s*(?:<NALA Converted Extent>|[\d,.]+)\s*(?:Sq\.?\s*Yards?|square\s+yards?)\.?/gi, '');
    if (/\bfollowing undivided shares\s*:|\bNALA converted extent\s*:/i.test(text)) throw new Error('Unsupported saved allocation or NALA extent wording in this replacement. Retain the property bindings so the current draft supplies these facts.');
  }
  if (/^\s*THIS\b/i.test(text) && /\b(?:DEED|AGREEMENT|GIFT|POWER OF ATTORNEY)\b/i.test(text)) {
    change(/((?:made(?:\s+and\s+executed)?|executed)\s+on\s+)(?:\d{4}-\d{2}-\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|DD[-/.]?MM[-/.]?YYYY)\b/gi, '$1<Date>');
  }
  if (!inSchedule) change(/(Market Value(?:\s+of)?\s+(?:Rs\.?\s*))[\d,]+(?:\.\d{1,2})?(?=\s*\/-)/gi, '$1<Market of Value Rs./->');
  return text;
}
