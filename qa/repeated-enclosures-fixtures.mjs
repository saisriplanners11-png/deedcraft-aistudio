export const enclosureFixture = (scope, index) => {
  const suffix = `${scope}-${index}`;
  const date = `202${index}-02-03`;
  return [
    { linkOption: 'linkDoc', linkDocType: 'Sale Deed', linkDocNo: `TITLE-${suffix}`, linkDocDate: date, linkSro: `Title Office ${suffix}`, linkSroCode: `TITLE-CODE-${suffix}` },
    { linkOption: 'rectificationDeed', rectificationDeedNo: `RECT-${suffix}`, rectificationDeedDate: date, rectificationDeedSro: `Rect Office ${suffix}`, rectificationDeedSroCode: `RECT-CODE-${suffix}` },
    { linkOption: 'supplementalDeed', supplementalDeedNo: `SUPP-${suffix}`, supplementalDeedDate: date, supplementalDeedSro: `Supp Office ${suffix}`, supplementalDeedSroCode: `SUPP-CODE-${suffix}` },
    { linkOption: 'landLayoutLrs', vltNo: `VLT-${suffix}`, layoutFileNo: `LAYOUT-${suffix}`, lrsApplicationNo: `APP-${suffix}`, lrsApplicationDate: date, lrsProceedingNo: `PROC-${suffix}`, lrsProceedingDate: date },
    { linkOption: 'titleDeed', titleDeedNo: `PASSBOOK-${suffix}`, khataNo: `KHATA-${suffix}` },
    { linkOption: 'nala', nalaOrderNo: `NALA-${suffix}`, nalaProceedingDate: date },
    { linkOption: 'houseTax', houseTaxReceiptNo: `RECEIPT-${suffix}`, localBodyName: `Tax Authority ${suffix}`, taxPaidDate: date },
    { linkOption: 'permissions', permBuildingPermitNo: `PERMIT-${suffix}`, permissionDate: date, permissionAuthorityName: `Permit Authority ${suffix}` },
  ].map((values, i) => ({ id: `${suffix}-${i}`, docNames: [], values }));
};
