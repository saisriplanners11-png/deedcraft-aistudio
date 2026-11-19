import type { Candidate } from './source-draft';

export const mobileLabel = '(?:Mobile|Phone|Cell(?:[ -]?phone)?|Contact)(?:\\s*(?:No\\.?|Number))?';
export const writtenMobileLabel = '(?:Written|Handwritten|Current|Updated|Preferred|New)\\s+' + mobileLabel;
const explicitWrittenMobile = new RegExp('^' + writtenMobileLabel + '\\b', 'i');

export function identityMobile(value: string) {
  const trimmed = value.trim().replace(/^\+91\s*-?\s*/, '');
  return /^(?:\d{10}|\d{5}[ -]+\d{5})$/.test(trimmed) ? trimmed.replace(/[ -]/g, '') : '';
}

export function isWrittenMobile(candidate: Pick<Candidate, 'field' | 'handwritten' | 'writtenContact' | 'quote'>) {
  return candidate.field.endsWith('Mobile')
    && (candidate.handwritten || candidate.writtenContact || explicitWrittenMobile.test(candidate.quote));
}
