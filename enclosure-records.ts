import { deedDate } from './deed-format';
import { normalizePropertyPlaceName } from './place-names';

export const ENCLOSURE_RECITALS = {
  vacantTax: /Vacant Land Tax\/Assessment:/i,
  layout: /Approved Layout:/i,
  titleDeed: /Title Deed:/i,
  nala: /Nala Order:/i,
  houseTax: /Property Tax:/i,
  permissions: /House Permission:/i,
  lrsApplication: /L\.R\.S\.-2020 Application:/i,
  lrsProceeding: /L\.R\.S\. Proceeding:/i,
};
export type EnclosureRecitalKind = keyof typeof ENCLOSURE_RECITALS;
export type EnclosureRecords = Partial<Record<EnclosureRecitalKind, Record<string, string>[]>>;

/** Preserve each supporting record as a unit, including its own dates and office.
 * Old narrow cards and the combined land/layout/LRS card share these bindings. */
export function enclosureRecordsFor(records: { values: Record<string, string> }[]): EnclosureRecords {
  const result: EnclosureRecords = {};
  const add = (kind: EnclosureRecitalKind, values: Record<string, string>) => (result[kind] ??= []).push(values);
  for (const { values: v } of records) {
    const option = v.linkOption;
    const landRecord = ['landLayoutLrs', 'vacantTax', 'approvedLayout', 'lrsApplication', 'lrsProceeding', 'layoutLrs'].includes(option);
    if (landRecord && v.vltNo) add('vacantTax', {
      'V.L.T. No.': v.vltNo, 'V.L.T No.': v.vltNo, 'V.L.T.No.': v.vltNo,
    });
    if (landRecord && v.layoutFileNo) add('layout', { 'Layout File No.': v.layoutFileNo });
    if (option === 'titleDeed' && v.titleDeedNo && v.khataNo) add('titleDeed', {
      'Pattadar Pass Book No': v.titleDeedNo, 'Pattadar Pass Book No.': v.titleDeedNo,
      'Pass Book Khata No': v.khataNo, 'Pass Book Khata No.': v.khataNo,
    });
    if (option === 'nala' && v.nalaOrderNo) add('nala', {
      'Nala Order No': v.nalaOrderNo, 'Nala Order No.': v.nalaOrderNo, 'Nala Order Date': deedDate(v.nalaProceedingDate || ''),
    });
    if (['houseTax', 'assessment'].includes(option) && v.houseTaxReceiptNo && v.localBodyName) add('houseTax', {
      'House Tax Receipt': v.houseTaxReceiptNo, 'Local Body Name': normalizePropertyPlaceName('localBodyName', v.localBodyName),
      'Tax Paid Date': deedDate(v.taxPaidDate || ''),
    });
    if (option === 'permissions' && v.permBuildingPermitNo && v.permissionAuthorityName) {
      const authority = normalizePropertyPlaceName('permissionAuthorityName', v.permissionAuthorityName);
      add('permissions', { 'House Permission No.': v.permBuildingPermitNo, 'Permission Date': deedDate(v.permissionDate || ''),
        'Municipality/Gram Panchayat Name': authority, 'Municipality/Municipal Corporation/Gram Panchayat Name': authority });
    }
    if (landRecord && v.lrsApplicationNo) add('lrsApplication', {
      'LRS Application No.': v.lrsApplicationNo, 'Application Date': deedDate(v.lrsApplicationDate || ''),
    });
    if (landRecord && v.lrsProceedingNo) add('lrsProceeding', {
      'LRS Proceeding No.': v.lrsProceedingNo, 'Proceeding Date': deedDate(v.lrsProceedingDate || ''),
    });
  }
  return result;
}

/** Uploaded values must not move an existing manual card to a different position. */
export function orderedEnclosureIds(ids: string[], linkedProperties: Record<string, string>, manual: Record<string, string>): string[] {
  const available = new Set(ids);
  return [...new Set([...Object.keys(linkedProperties), ...Object.keys(manual).filter(key => key.startsWith('link|')).map(key => key.split('|')[1]), ...ids])]
    .filter(id => available.has(id));
}
