import { deedDate } from './deed-format';

export type TitleAmendmentKind = 'rectification' | 'supplemental';
export const titleAmendmentLabel = (kind: TitleAmendmentKind) => kind === 'rectification' ? 'Rectification Deed' : 'Supplemental Deed';

/** A typed registered-deed name and a dedicated amendment card share one route.
 * Incomplete typing never changes saved field IDs or moves the active input. */
export function titleAmendmentKind(values: Record<string, string>): TitleAmendmentKind | undefined {
  const type = (values.linkDocType || '').trim().replace(/\s+/g, ' ');
  if (values.linkOption === 'rectificationDeed') return 'rectification';
  if (values.linkOption === 'supplementalDeed') return 'supplemental';
  if (values.linkOption && values.linkOption !== 'linkDoc') return undefined;
  const match = type.match(/^(?:Registered\s+)?(Rectification|Supplemental)\s+Deed\b/i);
  return match?.[1].toLowerCase() as TitleAmendmentKind | undefined;
}

/** Resolve only this record's data; never use the original title, property SRO
 * or a flat's supplemental/allotment agreement as an amendment fallback. */
export function titleAmendmentValues(values: Record<string, string>, kind: TitleAmendmentKind): Record<string, string> {
  const prefix = kind + 'Deed', label = titleAmendmentLabel(kind);
  const dedicated = values.linkOption === prefix;
  const own = (suffix: string, legacy: string) => dedicated ? values[prefix + suffix] || values[legacy] || '' : values[legacy] || values[prefix + suffix] || '';
  return {
    [label + ' Type']: own('Type', 'linkDocType') || label,
    [label + ' No.']: own('No', 'linkDocNo'),
    [label + ' Date']: deedDate(own('Date', 'linkDocDate')),
    [label + ' SRO']: own('Sro', 'linkSro'),
    [label + ' SRO Code']: own('SroCode', 'linkSroCode'),
  };
}
