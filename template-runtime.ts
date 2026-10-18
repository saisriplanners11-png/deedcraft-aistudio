// Bundled for Node with a filesystem implementation of template.ts.
export { mergeValues, rewritesFor, scheduleMergesFor, deedFilename } from './merge';
export { saleAuthorityErrors, salePropertyErrors, saleVariant } from './sale-options';
export { newDraft, appStateFor, draftReducer, resolveDraft } from './source-draft';
export { initialState, partyRecords } from './logic';
export { newPayment, MODES } from './payments';
export { PLACEMENT_CATALOG } from './template-placement';
export { validateSaleDeedTemplate, validateGiftDeedTemplate, fillGiftDeed, fillSaleDeed, readZip, writeZip, docxToText, templateBindingCatalog, inspectTemplateFields, replaceRunText } from './docx';
export { validateFieldContract, canonicalContract, EMPTY_FIELD_CONTRACT } from './template-fields';
import { fillSaleDeed, type DeedTemplateSource } from './docx';
import { initialState, type AppState } from './logic';
import { mergeValues, rewritesFor, scheduleMergesFor, variantFor } from './merge';
import { newPayment } from './payments';
import { newStructureDetail } from './fields';
import { compileDeed, renderArtifact } from './deed-compiler';
import { templateRecords } from './template-field-values';
import { EMPTY_FIELD_CONTRACT } from './template-fields';
import { DEED_DEFINITIONS } from './instruments';

export const sampleCases = [
  ['plot', 'Vacant plot', 'Vacant Plot', ''], ['open', 'Open place', 'Open Place', ''],
  ['part', 'Part open place', 'Part open place', ''], ['house', 'House', 'Residential', ''],
  ['dismantled', 'Dismantled house', 'Demolished', ''], ['flat-finished', 'Finished flat', 'Flat', 'Finished'],
  ['flat-semi', 'Semi-finished flat', 'Flat', 'Semi-Finished'], ['multiple', 'Multiple parties and properties', 'Vacant Plot', ''],
];
export const saleMatrixCases = ['ordinary', 'gpa', 'agpa'].flatMap(mode => [
  ['plot', 'Vacant plot', 'Vacant Plot', ''], ['open', 'Open place', 'Open Place', ''],
  ['part', 'Part open place', 'Part open place', ''], ['dismantled', 'Demolished house', 'Demolished', ''],
  ['house-finished', 'Finished house', 'Residential', 'Finished'], ['house-semi', 'Semi-finished house', 'Residential', 'Semi-Finished'],
  ['flat-finished', 'Finished flat', 'Flat', 'Finished'], ['flat-semi', 'Semi-finished flat', 'Flat', 'Semi-Finished'],
].map(item => [`${mode}-${item[0]}`, `${mode.toUpperCase()} — ${item[1]}`, item[2], item[3]]));
export const sampleCasesFor = (contract = EMPTY_FIELD_CONTRACT, validation?: { saleOpenings?: boolean }) => validation?.saleOpenings ? [...saleMatrixCases, sampleCases.find(item => item[0] === 'multiple')!, ...(contract.fields.some(field => field.scope === 'party') ? [['entity', 'Company vendor', 'Vacant Plot', '']] : [])] : contract.fields.some(field => field.scope === 'party') ? [...sampleCases, ['entity', 'Company vendor', 'Vacant Plot', '']] : sampleCases;

export async function renderSample(id: string, source: DeedTemplateSource): Promise<Uint8Array> {
  const contract = source.kind === 'built-in' ? EMPTY_FIELD_CONTRACT : source.fieldContract || EMPTY_FIELD_CONTRACT;
  const state = sampleState(id);
  const mode = state.saleDocument || 'ordinary';
  const records = templateRecords(state);
  const customValues: Record<string, Record<string, string>> = {};
  for (const field of contract.fields) {
    customValues[field.id] = {};
    for (const [index, record] of records.entries()) {
      if (field.existingPlaceholder && !record.values[field.existingPlaceholder]) record.values[field.existingPlaceholder] = field.sampleValue || (field.type === 'date' ? '13-10-2026' : field.type === 'currency' || field.type === 'number' ? '1000' : 'SAMPLE VALUE');
      customValues[field.id][record.id] = field.type === 'text' || field.type === 'multiline' ? `${field.sampleValue} ${index + 1}` : field.sampleValue;
    }
  }
  const compiled = compileDeed({ instrumentId: 'sale', variantId: mode === 'gpa' ? 'sale-deed-by-gpa-holder' : mode === 'agpa' ? 'sale-through-existing-agpa' : DEED_DEFINITIONS.sale.variants[0].id, snapshotHash: 'synthetic-sample', values: mergeValues(state), schedules: scheduleMergesFor(state), rewrites: rewritesFor(state), unresolvedWarnings: [], templateFieldData: { records, values: customValues } }, source);
  const { result } = await renderArtifact(compiled, 'docx');
  if (result.unmapped.length) throw new Error(`Unmapped sample placeholders: ${result.unmapped.join(', ')}`);
  return new Uint8Array(await result.blob.arrayBuffer());
}

export function sampleState(id: string): AppState {
  id = id.replace(':', '-');
  const item = [...saleMatrixCases, ...sampleCases, ['entity', 'Company vendor', 'Vacant Plot', '']].find(item => item[0] === id);
  if (!item) throw new Error('Unknown sample.');
  const form = { ...initialState.form, executionDate: '2026-10-13', executantName: 'SAMPLE VENDOR', executantRelativeName: 'SAMPLE PARENT', executantRelation: 'S/O', executantAge: '45', executantDob: '1981-01-02', executantAadhaar: '444455556666', executantOccupation: 'Business', executantHNo: '1-1', executantVillage: 'Sample Village', executantMandal: 'Sample Mandal', executantDistrict: 'Sample District', executantState: 'Telangana', executantPinCode: '500001', claimantName: 'SAMPLE PURCHASER', claimantRelativeName: 'SAMPLE PARENT', claimantRelation: 'S/O', claimantAge: '35', claimantOccupation: 'Business', claimantHNo: '2-2', claimantVillage: 'Sample Village', claimantMandal: 'Sample Mandal', claimantDistrict: 'Sample District', claimantState: 'Telangana', claimantPinCode: '500001', propState: 'Telangana', consid: '1500000', stampValue: '100', extentSqYards: '200', extentSqMeters: '167.22', surveyNo: '123', plotNo: '10', bearingHNo: '3-3', nearHNo: '3-4', locality: 'Sample Locality', village: 'Sample Village', mandal: 'Sample Mandal', district: 'Sample District', state: 'Telangana', pinCode: '500001', sro: 'Sample SRO', districtRegistrar: 'Sample Registrar', boundaryNorth: 'Road', boundarySouth: 'Plot 11', boundaryEast: 'Plot 12', boundaryWest: 'Road', flatStage: item[2] === 'Flat' ? item[3] : '', houseStage: item[2] === 'Residential' ? item[3] : '', flatAgeYears: '5', flatNo: '101', flatFloorNo: 'First', apartmentName: 'SAMPLE APARTMENTS', superBuiltUpAreaSqFt: '1000', udsSqYards: '30', parkingAreaSqFt: '75', stiltFloors: '1', upperFloors: '4', flatBoundaryNorth: 'Corridor', flatBoundarySouth: 'Flat 102', flatBoundaryEast: 'Open to sky', flatBoundaryWest: 'Open to sky', roofMaterial: 'R.C.C. Building', constructionDescription: 'Framed with pillars & beams', taxesPerAnnum: '1000', annualRentalValue: '12000', localAuthorityType: 'Municipality' };
  const state: AppState = { ...initialState, category: item[2], form, payments: [{ ...newPayment('cash'), amount: '1500000' }] };
  const structure = { totalFloors: '2', rows: [
    { ...newStructureDetail(), floorNo: 'Ground', structureType: 'Framed with walls only', stage: 'Finished', buildingAge: '10', builtUpAreaSqFt: '800' },
    { ...newStructureDetail(), floorNo: 'First', structureType: 'Framed with walls only', stage: 'Finished', buildingAge: '5', builtUpAreaSqFt: '600' },
  ] };
  const mode = id.startsWith('gpa-') ? 'gpa' : id.startsWith('agpa-') ? 'agpa' : 'ordinary';
  state.saleDocument = mode;
  if (mode !== 'ordinary') state.saleAuthority = { documentNo: 'AUTH-42', documentDate: '2025-01-02', sro: 'AUTHORITY SRO', sroCode: 'AUTH-SRO-CODE', adjustedAmount: '50000', attorneys: [{ id: 'agent', principalIds: ['primary'], values: { Name: 'SAMPLE ATTORNEY', Relation: 'S/O', RelativeName: 'ATTORNEY PARENT', Dob: '1980-02-03', Age: '46', Occupation: 'Business', HNo: '7-7', Village: 'Agent Village', Mandal: 'Agent Mandal', District: 'Agent District', State: 'Telangana', PinCode: '500002', Aadhaar: '111122223333' } }] };
  if (item[2] === 'Residential') state.structureDetailsBySchedule = { primary: { ...structure, rows: structure.rows.map(row => ({ ...row, stage: item[3] || 'Finished' })) } };
  if (id === 'house') state.structureDetailsBySchedule = { primary: structure };
  if (id === 'multiple') {
    state.additionalExecutants = [{ id: 'seller-2', values: { ...form, executantName: 'SECOND SAMPLE VENDOR' }, docNames: [] }];
    state.additionalClaimants = [{ id: 'buyer-2', values: { ...form, claimantName: 'SECOND SAMPLE PURCHASER' }, docNames: [] }];
    state.additionalSchedules = [{ id: 'property-2', category: 'Residential', unit: 'Sq. Yards', values: { ...form, bearingHNo: '5-5' }, docNames: [] }];
    state.structureDetailsBySchedule = { 'property-2': structure };
    state.vendorSharesBySchedule = { primary: { primary: '50', 'seller-2': '50' }, 'property-2': { primary: '50', 'seller-2': '50' } };
    state.vendeeSharesBySchedule = { primary: { primary: '50', 'buyer-2': '50' }, 'property-2': { primary: '50', 'buyer-2': '50' } };
  }
  if (id === 'entity') { state.form = { ...state.form, executantPartyType: 'Company', executantEntityName: 'SAMPLE COMPANY', executantEntityAddress: 'SAMPLE OFFICE', executantCompanyCin: 'SAMPLE-CIN' }; }
  return state;
}

export { compileDeed, renderArtifact } from './deed-compiler';
