import type { Field } from './fields';

const hints: Record<string, string> = {
  districtRegistrar: 'Enter the District Registrar office shown in the registration records.',
  sro: 'SRO means Sub-Registrar Office. Enter the office for this property.',
  mandal: 'Enter the mandal in which the property is located.',
  village: 'Copy the village or town name from the property records.',
  surveyNo: 'Copy all applicable survey numbers, including subdivisions, exactly as recorded.',
  bearingHNo: 'The house or door number of this property, not the nearby landmark.',
  plotNo: 'Copy the plot number from the registered deed or layout.',
  localAuthorityType: 'Choose the body responsible for this property: corporation, council or Gram Panchayat.',
  bltNo: 'Property Tax Identification Number. Copy it from the property-tax record.',
  assessmentPtinNo: 'Vacant Land Tax identification number from the tax or assessment record.',
  govtRate: 'Enter the basic rate for one square yard, not the total property value.',
  consid: 'Enter the agreed total sale amount for the whole deed. Check the amount in words below.',
  udsSqYards: 'The flat’s share of land in square yards, separate from its built-up area.',
  udsSqMeters: 'The flat’s share of land in square metres, separate from its built-up area.',
  superBuiltUpAreaSqFt: 'Enter the area including common areas in square feet, as recorded in your source.',
  carpetAreaSqFt: 'Enter the carpet area in square feet. Keep it separate from the built-up area.',
  flatFloorNo: 'Enter the floor on which this flat is located.',
  flatStage: 'Choose the recorded completion stage of this flat.',
  houseStage: 'Choose the recorded completion stage of this house.',
  roofMaterial: 'Choose or enter the roof description that matches the property record.',
};
export function fieldHelp(field: Field): string | undefined {
  if (field.hint) return field.hint;
  if (field.derived) return 'Calculated from the details you entered. Update the source fields to change this value.';
  if (hints[field.id]) return hints[field.id];
  if (/boundary/i.test(field.id)) return 'Describe the road, property or landmark on this side, as recorded in the property documents.';
  if (/PartyType$/.test(field.id)) return 'Choose Individual for a person, or the matching organisation type to show its details and signatories.';
  if (/(?:Relation)$/.test(field.id)) return 'S/O: son of · D/O: daughter of · W/O: wife of · C/O: care of. This is separate from the Gift relationship.';
  if (/(?:RelationName)$/.test(field.id)) return 'Enter the name that follows the selected relationship on the identity document.';
  if (/(?:Aadhaar)$/.test(field.id)) return 'Copy the Aadhaar number carefully from the identity document.';
  if (/(?:Name)$/.test(field.id)) return 'Use the full name as shown in the relevant identity or registration document.';
  if (/(?:PinCode)$/.test(field.id) || field.id === 'pinCode') return 'Enter the six-digit postal PIN code for this address.';
  if (/SroCode$/i.test(field.id)) return 'Copy the registration office code from the relevant registered document.';
  if (/Sro$/i.test(field.id)) return 'Enter the Sub-Registrar Office shown on this document.';
  if (field.type === 'date') return 'Choose the complete date. The generated deed prints DD-MM-YYYY.';
  return undefined;
}
