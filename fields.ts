// Every field the app collects, and the placeholder it fills in the Sale Deed
// template (`SALE DEED FOR PLOT DOCT TO DOCT 3.docx`). The template is the
// authority: if a placeholder exists there, a field for it exists here.
//
// `ph` names match the template exactly, including its own spelling
// (`Executant Adhar Number`, `Market of Value Rs./-`).

export type FieldType = 'text' | 'number' | 'money' | 'date' | 'tel' | 'select' | 'textarea';

export type Field = {
  id: string;
  label: string;
  ph?: string | string[];
  type?: FieldType;
  options?: string[];
  hint?: string;
  span?: 1 | 2 | 3 | 4;
  /** Computed from other fields — rendered read-only. */
  derived?: boolean;
  /** Only collected for these property categories. */
  only?: string[];
  /** Retained for extraction and document generation, but not shown to drafters. */
  hidden?: boolean;
  /** Omit this field's tagged recital segment, rather than printing a blank, when no value is supplied. */
  omitWhenEmpty?: boolean;
};

export type Group = {
  step: number;
  title: string;
  telugu?: string;
  note?: string;
  cols?: 2 | 3 | 4;
  fields: Field[];
};

/** One floor/level entry in the repeatable Annexure I-A structure table. */
export type StructureDetail = {
  id: string;
  floorNo: string;
  structureType: string;
  customStructureType: string;
  stage: string;
  buildingAge: string;
  builtUpAreaSqFt: string;
};

export type StructureDetails = { totalFloors: string; rows: StructureDetail[] };

export const STRUCTURE_TYPE_OPTIONS = [
  'R.C.C. Building', 'R.C.C. Roof House', 'Ground Floor House', 'G + 1 Upper Floor',
  'G + 2 Upper Floors', 'Independent Villa', 'Tiled House', 'A.C. Sheet Roof House',
  'Madras Terrace House', 'Commercial Building', 'Shed Structure', 'Other / Custom Structure',
];

export const STRUCTURE_STAGE_OPTIONS = [
  'Foundation', 'Upto Lintel level', 'Upto Slab/Roof level', 'Semi-Finished', 'Finished',
];

export const newStructureDetail = (): StructureDetail => ({
  id: globalThis.crypto?.randomUUID?.() || `structure-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  floorNo: '', structureType: '', customStructureType: '', stage: '', buildingAge: '', builtUpAreaSqFt: '',
});

export const newStructureDetails = (): StructureDetails => ({ totalFloors: '', rows: [newStructureDetail()] });

/**
 * Repeatable evidence read from supporting property documents. These are not
 * fixed template placeholders: every uploaded source becomes its own record
 * and is recited in the applicable Schedule of Property only when populated.
 */
export const SUPPORTING_RECORD_FIELDS: Field[] = [
  { id: 'supportingDocType', label: 'Supporting document type', options: ['House Tax Receipt', 'Pattadar Passbook', 'NALA Conversion Order', 'Building Permit Order', 'Electricity Bill', 'Water Bill', 'Other Property Record'] },
  { id: 'supportingDate', label: 'Document date', type: 'date' },
  { id: 'supportingAuthority', label: 'Issuing authority' },
  { id: 'supportingHolder', label: 'Recorded holder / consumer' },
  { id: 'supportingAssessmentNo', label: 'House assessment number', hint: 'Copy the assessment or property-tax identification number exactly as printed.' },
  { id: 'supportingHouseNo', label: 'House / premises number' },
  { id: 'supportingPassbookNo', label: 'Pattadar passbook number' },
  { id: 'supportingKhataNo', label: 'Khata number' },
  { id: 'supportingNalaOrderNo', label: 'NALA order number', hint: 'Copy the proceedings/order number, not the survey number.' },
  { id: 'supportingPermitNo', label: 'Building permit number', hint: 'Copy the permit or file number exactly as printed.' },
  { id: 'supportingElectricityScNo', label: 'Electricity SC number' },
  { id: 'supportingElectricityUscNo', label: 'Electricity USC number' },
  { id: 'supportingSurveyNo', label: 'Supporting-record survey number' },
  { id: 'supportingPlotNo', label: 'Supporting-record plot number' },
  { id: 'supportingExtent', label: 'Supporting-record extent', hint: 'Keep the printed number and unit together.' },
  { id: 'supportingDetails', label: 'Other visibly printed particulars', type: 'textarea', hint: 'A short exact summary of relevant property particulars not captured above; never infer.' },
];

/** Which SCHEDULE OF PROPERTY variant of the template a category selects. */
export const SCHEDULE_VARIANT: Record<string, string> = {
  'Vacant Plot': 'IF OPEN PLOT',
  'Open Place': 'IF OPEN PLACE',
  'Agricultural land': 'IF OPEN PLOT',
  Residential: 'IF HOUSE',
  Commercial: 'IF HOUSE',
  Flat: 'IF HOUSE',
  Demolished: 'IF DIMOLISHED HOUSE',
  'Part open place': 'IF PART OPEN PLACE',
};

export const HOUSE_CATEGORIES = ['Residential', 'Commercial', 'Flat'];

const party = (side: 'executant' | 'claimant'): Field[] => {
  const P = side === 'executant' ? 'Executant' : 'Claimant';
  const C = side === 'executant' ? 'EXECUTANT' : 'CLAIMANT';
  const k = (n: string) => `${side}${n}`;
  return [
    { id: k('PartyType'), label: 'Party type', type: 'select', options: ['Individual', 'Firm / LLP', 'Society / Trust', 'Company', 'Others / HUF'], span: 2,
      hint: 'Choose the legal capacity of this executant or claimant.' },
    { id: k('Name'), label: 'Full name', ph: `${C} NAME`, span: 2 },
    { id: k('Relation'), label: 'Relation', type: 'select', options: ['S/O', 'W/O', 'D/O', 'C/O', 'REP. BY'] },
    { id: k('RelativeName'), label: "Father's / relative's name", span: 2 },
    { id: k('Age'), label: 'Age', ph: `${P} Age`, type: 'number', hint: 'Pre-filled from date of birth as of today; you may correct it manually.' },
    { id: k('Dob'), label: 'Date of birth', ph: `${P} Dob`, type: 'date' },
    { id: k('Occupation'), label: 'Occupation', ph: `${P} Occupation` },
    { id: k('Aadhaar'), label: 'Aadhaar number', ph: `${P} Adhar Number` },
    { id: k('Pan'), label: 'PAN', ph: `${P} Pan No.`, hint: 'Required above ₹50 lakh', omitWhenEmpty: true },
    { id: k('Mobile'), label: 'Mobile', ph: `${P} Cell.No.`, type: 'tel', omitWhenEmpty: true },
    { id: k('HNo'), label: 'House no.', ph: `${P} H.No.` },
    { id: k('Locality'), label: 'Locality', ph: `${P} Locality`, omitWhenEmpty: true },
    { id: k('Village'), label: 'Village', ph: `${P} Village` },
    { id: k('Mandal'), label: 'Mandal', ph: `${P} Mandal` },
    { id: k('District'), label: 'District', ph: `${P} District` },
    { id: k('State'), label: 'State', ph: `${P} State` },
    { id: k('PinCode'), label: 'PIN code', ph: `${P} Pin Code` },
  ];
};

export type PartyType = 'Individual' | 'Firm / LLP' | 'Society / Trust' | 'Company' | 'Others / HUF';

/**
 * Legal-entity particulars collected in addition to the individual/signatory
 * fields above. They deliberately have no Word-template placeholders: the
 * supplied sale-deed template only contains individual-party blanks, while
 * these source-backed facts remain available for review and future entity
 * recital templates.
 */
export const partyEntityFields = (side: 'executant' | 'claimant', type: PartyType): Field[] => {
  const k = (name: string) => `${side}${name}`;
  const common = [
    { id: k('EntityName'), label: 'Entity name (English)', span: 2 as const },
    { id: k('EntityPan'), label: 'Entity PAN' },
    { id: k('EntityMobile'), label: 'Official mobile number', type: 'tel' as const },
    { id: k('EntityAddress'), label: 'Registered / principal office address', type: 'textarea' as const, span: 2 as const },
    { id: k('SignatoryDesignation'), label: 'Signatory designation / role in entity', span: 2 as const },
  ];
  if (type === 'Firm / LLP') return [
    { id: k('FirmSubtype'), label: 'Firm sub-type', type: 'select', options: ['Partnership Firm', 'Limited Liability Partnership (LLP)'] },
    ...common,
    { id: k('FirmRegistrationNo'), label: 'ROF registration no. / LLPIN' },
    { id: k('FirmRegistrarOffice'), label: 'Registrar of Firms (ROF) office' },
    { id: k('FirmDeedNo'), label: 'Registered partnership deed document no.' },
    { id: k('FirmDeedDate'), label: 'Partnership deed / LLP date', type: 'date' },
    { id: k('FirmGstin'), label: 'Firm GSTIN (optional)' },
    { id: k('FirmAuthority'), label: 'Partnership consent / authority resolution ref. & date', span: 2 as const },
  ];
  if (type === 'Society / Trust') return [
    { id: k('SocietyClassification'), label: 'Society / entity classification', type: 'select', options: ['Registered Society', 'Public Trust', 'Private Trust', 'Co-operative Society', 'Other registered entity'] },
    ...common,
    { id: k('SocietyRegistrationNo'), label: 'Society / trust registration no.' },
    { id: k('SocietyRegistrationYear'), label: 'Registration year', type: 'number' },
    { id: k('SocietyRegistrarOffice'), label: 'Registrar / district office' },
    { id: k('SocietyNoc'), label: 'Competent authority NOC / permission ref.' },
    { id: k('SocietyResolutionNo'), label: 'Governing-body resolution no. / authorization', span: 2 as const },
  ];
  if (type === 'Company') return [
    { id: k('CompanyClassification'), label: 'Company classification', type: 'select', options: ['Private Limited Company', 'Public Limited Company', 'One Person Company', 'Section 8 Company', 'Other company'] },
    ...common,
    { id: k('CompanyCin'), label: 'Corporate Identification Number (CIN)' },
    { id: k('CompanyDin'), label: 'Director Identification Number (DIN)' },
    { id: k('CompanyBoardResolution'), label: 'Board resolution ref. / authorization', span: 2 as const },
  ];
  return [
    { id: k('OtherEntityKind'), label: 'Other entity / HUF description', span: 2 as const },
    ...common,
    { id: k('OtherRegistrationNo'), label: 'Registration / identification number (if any)' },
    { id: k('OtherAuthority'), label: 'Authorization / representation reference', span: 2 as const },
  ];
};

export const PARTY_ENTITY_FIELDS: Field[] = ([
  'Individual', 'Firm / LLP', 'Society / Trust', 'Company', 'Others / HUF',
] as PartyType[]).flatMap(type => ['executant', 'claimant'].flatMap(side => partyEntityFields(side as 'executant' | 'claimant', type)));

// Step 05 (payment) has no field group: a deed can recite any number of
// payments, each with its own mode and instrument, so they live as records in
// payments.ts rather than as fixed fields here.
export const GROUPS: Group[] = [
  {
    step: 1,
    title: 'Link / title document',
    telugu: 'లింక్ దస్తావేజు వివరాలు',
    note: 'The prior registered document through which the vendor holds title. It is recited verbatim in the deed.',
    fields: [
      { id: 'linkDocType', label: 'Document type', ph: 'Link Doc Type', span: 2, hint: 'e.g. Registered Sale Deed' },
      { id: 'linkDocNo', label: 'Document number', ph: 'Link Doct.No.',
        hint: 'Registration/document number of the uploaded link deed itself — not an older deed recited inside it.' },
      { id: 'linkDocDate', label: 'Link deed execution date', ph: 'Link Doct.Date', type: 'date',
        hint: 'The date this document was executed, shown in its opening recital on the first page — not the SRO registration/presentation date.' },
      { id: 'linkSro', label: 'Sub-Registrar Office', ph: ['Sub Registrar', 'Sub-Registrar'], span: 2 },
    ],
  },
  {
    step: 2,
    title: 'Jurisdiction',
    telugu: 'పరిధి వివరాలు',
    note: 'Where the property lies and where the deed will be presented for registration.',
    fields: [
      { id: 'propState', label: 'State', type: 'select', options: ['Telangana', 'Andhra Pradesh'] },
      { id: 'districtRegistrar', label: 'District Registrar', ph: 'District Registrar', span: 2 },
      { id: 'sro', label: 'Sub-Registrar Office', span: 2 },
      { id: 'district', label: 'District', ph: 'District' },
      { id: 'mandal', label: 'Mandal', ph: 'Mandal' },
      { id: 'village', label: 'Village', ph: 'Village' },
      { id: 'ulbAuthority', label: 'ULB name / Authority', type: 'select', options: ['Municipality', 'Gram Panchayit', 'Municipal Corporation', 'GHMC'],
        hint: 'Select the local urban body / authority explicitly named for this property.' },
      { id: 'executionDate', label: 'Sale deed execution date', type: 'date', hint: 'Optional — left blank in the deed when not entered.' },
    ],
  },
  {
    step: 3,
    title: 'Property identification',
    telugu: 'ఆస్తి గుర్తింపు',
    note: 'What is being conveyed. The fields shown follow this schedule\'s selected property type.',
    fields: [
      { id: 'plotNo', label: 'Plot number', ph: 'Plot No.' },
      { id: 'extentSqYards', label: 'Extent (Sq. Yards)', ph: 'Extent in Sq.yards', type: 'number',
        hint: 'Required extent. Enter the exact area in square yards.' },
      { id: 'extentSqMeters', label: 'Extent (Sq. Meters)', ph: 'Extent in Sq.Meters', type: 'number',
        derived: true, hint: 'Calculated automatically from Extent (Sq. Yards).' },
      { id: 'surveyNo', label: 'Survey no(s).', ph: 'Survey No.' },
      { id: 'nearAdjacent', label: 'Landmark relation', type: 'select', options: ['Near', 'Adjacent'],
        hint: 'Choose the relationship of the landmark house number to the property.' },
      { id: 'nearHNo', label: 'Near / adjacent H.No.', ph: 'Near H.No.',
        hint: 'Door/house number of a neighbouring property used as a landmark in the boundary description — not the subject property\'s own number (see Bearing H.No.).' },
      { id: 'assessmentPtinNo', label: 'V.L.T. number', ph: 'V.L.T No.', only: ['Vacant Plot', 'Open Place'],
        hint: 'Vacant Land Tax / assessment number, exactly as printed in the local-body record.' },
      { id: 'locality', label: 'Locality', ph: 'Locality', span: 2 },
      { id: 'pinCode', label: 'PIN code', ph: 'Pin Code' },
    ],
  },
  {
    step: 3,
    title: 'Boundaries',
    telugu: 'చతుస్సీమలు',
    note: 'The four abutments as they will read in the schedule. Each is recited in the deed exactly as typed.',
    cols: 2,
    fields: [
      { id: 'boundaryNorth', label: 'North', ph: 'North Boundary' },
      { id: 'boundarySouth', label: 'South', ph: 'South Boundary' },
      { id: 'boundaryEast', label: 'East', ph: 'East Boundary' },
      { id: 'boundaryWest', label: 'West', ph: 'West Boundary' },
    ],
  },
  {
    step: 3,
    title: 'Structure & Annexure I-A',
    telugu: 'నిర్మాణ వివరాలు',
    note: 'Collected only for a built structure — these fill Annexure I-A of the deed.',
    fields: [
      { id: 'bearingHNo', label: 'Bearing H.No.', ph: 'Bearing H.No.', only: HOUSE_CATEGORIES },
      { id: 'bltNo', label: 'PTIN number', ph: ['P.T.I.No.', 'P.T.I. No.'], span: 2, only: HOUSE_CATEGORIES },
      { id: 'taxesPerAnnum', label: 'Tax per annum (₹)', ph: 'Taxes Per Annum', type: 'money', only: HOUSE_CATEGORIES },
      { id: 'annualRentalValue', label: 'Annual rental value (₹)', ph: 'Annual Rental Value', type: 'money', only: HOUSE_CATEGORIES },
      { id: 'tapConnectionNo', label: 'Tap connection no(s).', ph: 'Tap Connection No.', only: HOUSE_CATEGORIES },
      { id: 'metersNo', label: 'Electricity S.C. no(s).', ph: 'Meters No/s', only: HOUSE_CATEGORIES },
    ],
  },
  {
    step: 3,
    title: 'Flat / apartment particulars',
    telugu: 'ఫ్లాట్ వివరాలు',
    note: 'Not part of the sale deed template’s fixed clauses — recorded here for reference only. These do not appear in the generated Word document, which keeps the template’s wording unchanged.',
    fields: [
      { id: 'apartmentName', label: 'Apartment / project name', span: 2, only: ['Flat'] },
      { id: 'udsSqYards', label: 'Undivided share (Sq. Yards)', type: 'number', only: ['Flat'] },
      { id: 'udsSqMeters', label: 'Undivided share (Sq. Meters)', type: 'number', only: ['Flat'] },
      { id: 'superBuiltUpAreaSqFt', label: 'Super built-up area (Sq. Ft.)', type: 'number', only: ['Flat'] },
      { id: 'carpetAreaSqFt', label: 'Carpet area (Sq. Ft.)', type: 'number', only: ['Flat'] },
      { id: 'parkingSlotNos', label: 'Parking slot no(s).', only: ['Flat'] },
      { id: 'buildingPermitNo', label: 'Building permit number', only: ['Flat'] },
    ],
  },
  {
    step: 4,
    title: 'Market value, consideration & stamp paper',
    telugu: 'మార్కెట్ విలువ',
    note: 'Enter the agreed values and the face value printed on the non-judicial stamp paper. Stamp value is editable and is not calculated as statutory duty.',
    fields: [
      { id: 'govtRate', label: 'Basic rate per Sq. Yard (₹)', ph: 'Market Value Per Sq.Yard', type: 'money' },
      { id: 'structValue', label: 'Structure valuation (₹)', type: 'money', hint: 'Depreciated; 0 for open land' },
      { id: 'consid', label: 'Sale consideration (₹)', ph: 'Market of Value Rs./-', type: 'money' },
      { id: 'stampValue', label: 'Stamp paper value (₹)', ph: 'Stamp of Rs/-', type: 'money', hint: 'Read from the uploaded stamp paper or transaction note; left blank when missing.' },
    ],
  },
  { step: 6, title: 'Executant', telugu: 'అమ్మకందారు వివరాలు', note: 'The party conveying the right — vendor, donor or first party.', fields: party('executant') },
  { step: 7, title: 'Claimant', telugu: 'కొనుగోలుదారు వివరాలు', note: 'The party acquiring the right — purchaser, donee or second party.', fields: party('claimant') },
];

export type LinkOption = { id: string; label: string; telugu: string; note: string; fields: Field[] };

/**
 * What a Step 1 upload might actually be. `linkDoc` maps to the template's own
 * placeholders; the other four are supporting title/approval evidence with no
 * template blank of their own — recorded for reference and reused in the
 * schedule via `supportingRecordRecital`-style recitals only where applicable.
 */
export const LINK_OPTIONS: LinkOption[] = [
  {
    id: 'linkDoc', label: 'Link Document No.', telugu: 'రిజిస్టర్డ్ లింక్ దస్తావేజు',
    note: 'The prior registered document through which the vendor holds title. It is recited verbatim in the deed.',
    fields: [
      { id: 'linkDocType', label: 'Document type', ph: 'Link Doc Type', span: 2, hint: 'e.g. Registered Sale Deed' },
      { id: 'linkDocNo', label: 'Document number', ph: 'Link Doct.No.',
        hint: 'Registration/document number of the uploaded link deed itself — not an older deed recited inside it.' },
      { id: 'linkDocDate', label: 'Link deed execution date', ph: 'Link Doct.Date', type: 'date',
        hint: 'The date this document was executed, shown in its opening recital on the first page — not the SRO registration/presentation date.' },
      { id: 'linkSro', label: 'Sub-Registrar Office', ph: ['Sub Registrar', 'Sub-Registrar'], span: 2 },
      { id: 'linkSroCode', label: 'SRO code', ph: 'Sub Registrar Code', hint: 'Filled in automatically from the Sub-Registrar Office entered in the Jurisdiction step; only type over it if this document names a different SRO code.' },
    ],
  },
  {
    id: 'houseTax', label: 'House Tax Receipt No.', telugu: 'ఇంటి పన్ను రసీదు',
    note: 'Municipal house-tax record. Its details are recited in the deed when entered.',
    fields: [
      { id: 'houseTaxReceiptNo', label: 'House tax receipt number', ph: 'House Tax Receipt' },
      { id: 'assessmentPtinNo', label: 'Vacant land tax / assessment number', ph: ['V.L.T No.', 'V.L.T. No.'],
        hint: 'Copy only the value explicitly labelled V.L.T., vacant-land tax or assessment number.' },
      { id: 'localBodyName', label: 'Local body', ph: 'Local Body Name', hint: 'Municipality / Gram Panchayat / GHMC circle' },
      { id: 'taxPaidDate', label: 'Tax paid date', ph: 'Tax Paid Date', type: 'date' },
    ],
  },
  {
    id: 'titleDeed', label: 'Title Deed No.', telugu: 'పట్టాదారు పాస్ పుస్తకం',
    note: 'Pattadar passbook / title-deed record. Its details are recited in the deed when entered.',
    fields: [
      { id: 'titleDeedNo', label: 'Title deed number', ph: 'Pattadar Pass Book No' },
      { id: 'khataNo', label: 'Khata number', ph: 'Pass Book Khata No' },
    ],
  },
  {
    id: 'nala', label: 'Nala Order No.', telugu: 'నాలా ఉత్తర్వు',
    note: 'Non-agricultural land-use conversion order. Its details are recited in the deed when entered.',
    fields: [
      { id: 'nalaOrderNo', label: 'NALA order number', ph: 'Nala Order No' },
      { id: 'nalaProceedingDate', label: 'Proceeding date', ph: 'Nala Order Date', type: 'date' },
      { id: 'nalaExtent', label: 'Extent (Acre-Guntas)', hint: 'Original extent as printed in the NALA order.' },
      { id: 'convertedExtentText', label: 'Extent (Sq. Yards)', hint: 'The Acre-Gunta extent converted to square yards.' },
    ],
  },
  {
    id: 'permissions', label: 'Permissions / Approved details', telugu: 'అనుమతులు',
    note: 'House-permission details. The matching deed recital appears when all three details are entered.',
    fields: [
      { id: 'permBuildingPermitNo', label: 'Permission number', ph: 'House Permission No.' },
      { id: 'permissionDate', label: 'Permission date', ph: 'Permission Date', type: 'date' },
      { id: 'permissionAuthorityName', label: 'Issuing local authority', ph: 'Municipality/Gram Panchayat Name', hint: 'Municipality / Gram Panchayat / other local authority exactly as printed.' },
    ],
  },
  {
    id: 'layoutLrs', label: 'Layout / LRS details', telugu: 'లేఅవుట్ మరియు LRS',
    note: 'Approved-layout or Layout Regularisation Scheme particulars. Each completed recital is included in the deed.',
    fields: [
      { id: 'layoutFileNo', label: 'Approved layout file number', ph: 'Layout File No.' },
      { id: 'lrsApplicationNo', label: 'LRS application number', ph: 'LRS Application No.' },
      { id: 'lrsApplicationDate', label: 'LRS application date', ph: 'Application Date', type: 'date' },
      { id: 'lrsProceedingNo', label: 'LRS proceeding number', ph: 'LRS Proceeding No.' },
      { id: 'lrsProceedingDate', label: 'LRS proceeding date', ph: 'Proceeding Date', type: 'date' },
    ],
  },
];

/** Flat list of every field, in step order. De-duplicated: `linkDoc`'s core four are the same fields already in GROUPS. */
export const ALL_FIELDS: Field[] = Object.values(
  Object.fromEntries(
    [...GROUPS.flatMap(g => g.fields), ...LINK_OPTIONS.flatMap(o => o.fields), ...PARTY_ENTITY_FIELDS].map(f => [f.id, f])
  )
);

/** Groups for one step, with category-inapplicable fields removed. */
export function groupsForStep(step: number, category: string): Group[] {
  return GROUPS.filter(g => g.step === step)
    .map(g => ({ ...g, fields: g.fields.filter(f => !f.hidden && (!f.only || f.only.includes(category))) }))
    .filter(g => g.fields.length > 0);
}

/** The blank form — every field present, every value empty. */
export const EMPTY_FORM: Record<string, string> = Object.fromEntries(
  ALL_FIELDS.map(f => [f.id, ''])
);
