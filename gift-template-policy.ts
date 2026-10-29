/** Saved Gift corrections take precedence over wording in every Word revision.
 * Run before merging entered facts; property land UDS and linked NALA records
 * are separate from the party allocations and appended sentence omitted here.
 */
export function regularGiftSourcePolicy(text: string, inSchedule: boolean, apply?: (find: RegExp, replacement: string) => void): string {
  const replace = (find: RegExp, replacement: string) => { apply?.(find, replacement); text = text.replace(find, replacement); };
  if (/<\s*(?:EXECUTANT|CLAIMANT) NAME\s*>/i.test(text)) {
    const percentage = '(?:<[^<>]+>|[\\d,.]+\\s*%|_+\\s*%)';
    replace(new RegExp(',?\\s*holding\\s+(?:an?\\s+)?undivided\\s+shares?\\s+of\\s*' + percentage + '(?:\\s+in\\s+(?:the\\s+)?schedule(?:d)?\\s+property)?\\.?', 'gi'), '');
    replace(/,?\s*holding\s+[\d,.]+\s*%\s+(?:ownership\s+)?shares?(?:\s+in\s+(?:the\s+)?schedule(?:d)?\s+property)?\.?/gi, '');
    if (/\bholding\s+(?:(?:an?\s+)?undivided\s+shares?\b|[\d,.]+\s*%\s+(?:ownership\s+)?shares?\b)/i.test(text)) {
      throw new Error('This Gift template has unsupported party share wording. Remove that clause; regular Gift omits party ownership allocations.');
    }
  }
  if (inSchedule) {
    if (/^\s*The (?:Donors?|Donees?|vendors?|vendees?) (?:convey|gift|acquire|hold) this Schedule Property in the following undivided shares:/i.test(text)) {
      replace(/[\s\S]+/, '');
      return text;
    }
    replace(/\s*NALA converted extent:\s*(?:<NALA Converted Extent>|[\d,.]+)\s*(?:Sq\.?\s*Yards?|square\s+yards?)\.?/gi, '');
    if (/\bNALA converted extent\s*:/i.test(text) || /\bfollowing undivided shares\s*:/i.test(text)) {
      throw new Error('This Gift template has unsupported schedule allocation or NALA extent wording. Remove that clause; retain the property extent and linked NALA record.');
    }
  }
  return text;
}
