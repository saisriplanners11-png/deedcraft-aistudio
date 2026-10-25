// Every field the app collects, and the placeholder it fills in the Sale Deed
// template (`SALE DEED FOR PLOT DOCT TO DOCT 3.docx`). The template is the
// authority: if a placeholder exists there, a field for it exists here.
//
// `ph` names match the template exactly, including its own spelling
// (`Executant Adhar Number`, `Market of Value Rs./-`).

export type FieldType = 'text' | 'number' | 'money' | 'date' | 'month' | 'tel' | 'select' | 'textarea';

export const LOCAL_AUTHORITY_OPTIONS = ['Municipal Corporation', 'Municipal Council', 'Gram Panchayat'];
export const localAuthorityName = (value: string): string => ({
  corporation: 'Municipal Corporation', municipality: 'Municipal Council', 'gram panchayati': 'Gram Panchayat',
  'municipal corporation': 'Municipal Corporation', 'municipal council': 'Municipal Council', 'gram panchayat': 'Gram Panchayat',
} as Record<string, string>)[value.trim().toLowerCase()] || value;

export type Field = {
  ariaLabel?: string;
  optionLabels?: Record<string, string>;
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
  allowCustom?: boolean;
  /** Omit this field's tagged recital segment, rather than printing a blank, when no value is supplied. */
  omitWhenEmpty?: boolean;
};

export type Group = {
  placementSection?: string;
  placementContinuation?: boolean;
  step: number;
  title: string;
  telugu?: string;
  note?: string;
  cols?: 2 | 3 | 4;
  fields: Field[];
};

/** One floor/level entry in a house schedule and Annexure I-A. */
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

export const ROOF_NATURE_OPTIONS = [
  'R.C.C. Building', 'R.C.C. Roof House', 'Ground Floor House', 'G + 1 Upper Floor',
  'G + 2 Upper Floors', 'Independent Villa', 'Tiled House', 'A.C. Sheet Roof House',
  'Madras Terrace House', 'Commercial Building', 'Shed Structure',
  'Other / Custom Structure',
];

export const STRUCTURE_TYPE_OPTIONS = [
  'Framed with walls only', 'Framed with pillars & columns only',
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
  Flat: 'IF FLAT',
  Demolished: 'IF DIMOLISHED HOUSE',
  'Part open place': 'IF PART OPEN PLACE',
};

export const HOUSE_CATEGORIES = ['Residential', 'Commercial', 'Flat'];

const party = (side: 'executant' | 'claimant'): Field[] => {
  const P = side === 'executant' ? 'Executant' : 'Claimant';
  const C = side === 'executant' ? 'EXECUTANT' : 'CLAIMANT';
  const k = (n: string) => `${side}${n}`;
  return [
    { id: k('PartyType'), label: 'Party type', type: 'select', options: ['Individual', 'Minor', 'Firm / LLP', 'Society / Association', 'Company', 'Others / HUF', ...PARTY_CAPACITY_OPTIONS], span: 2,
      hint: 'Choose the legal capacity of this executant or claimant.' },
    { id: k('Name'), label: 'Full name', ph: `${C} NAME`, span: 2 },
    { id: k('Gender'), label: 'Gender', ariaLabel: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], hint: 'Used for his / her wording in the deed. Other and multiple parties use their. Leave unselected if unknown.' },
    { id: k('Relation'), label: 'Relation', type: 'select', options: ['S/O', 'W/O', 'D/O', 'C/O', 'REP. BY'] },
    { id: k('RelativeName'), label: "Father's / relative's name", span: 2 },
    { id: k('Age'), label: 'Age', ph: `${P} Age`, type: 'number', hint: 'Calculated from date of birth to today.' },
    { id: k('Dob'), label: 'Date of birth', ph: `${P} Dob`, type: 'date' },
    { id: k('GuardianRelationship'), label: 'Guardian relationship to minor', type: 'select', options: ['Father', 'Mother', 'Grandfather', 'Grandmother', 'Brother', 'Sister', 'Court-appointed Guardian', 'Other'], allowCustom: true },
    ...['Name', 'Relation', 'RelativeName', 'Dob', 'Aadhaar', 'Mobile', 'HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'].map(suffix => ({ id: k('Guardian' + suffix), label: 'Guardian ' + (({ Name: 'full name', RelativeName: 'father’s / relative’s name', Dob: 'date of birth', Aadhaar: 'Aadhaar number', HNo: 'house no.', PinCode: 'PIN code' } as Record<string, string>)[suffix] || suffix), ...(suffix === 'Dob' ? { type: 'date' as const } : {}) })),
    { id: k('WardName'), label: 'Represented minor’s full name' },
    { id: k('WardDob'), label: 'Represented minor’s date of birth', type: 'date' },
    { id: k('CourtOrderNo'), label: 'Court permission order / case number' },
    { id: k('CourtName'), label: 'Court granting permission' },
    { id: k('CourtOrderDate'), label: 'Court permission date', type: 'date' },
    { id: k('CourtOrderPermitsExecution'), label: 'Court order permits this guardian to execute this deed for the minor', type: 'select', options: ['Yes', 'No'] },
    { id: k('Occupation'), label: 'Occupation', ph: `${P} Occupation` },
    { id: k('Aadhaar'), label: 'Aadhaar number', ph: `${P} Adhar Number` },
    { id: k('Pan'), label: 'PAN', ph: [`${P} Pan No.`, `${P} PAN`], hint: 'Required above ₹50 lakh', omitWhenEmpty: true },
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

/** `Society / Trust` is retained only so previously saved drafts remain readable. */
export const PARTY_CAPACITY_OPTIONS = [
  'Guardian (సంరక్షకుడు)',
  'Confirming Party (నిర్ధారణ పక్షం)',
  'Consenting Party (సమ్మతిని ఇచ్చే పక్షం)',
  'Legal Heir (చట్టబద్ధమైన వారసుడు)',
  'Principal (పవర్ ఆఫ్ అటార్నీ ఇచ్చేవారు)',
  'Attorney / Agent (ఏజెంట్)',
] as const;

export type PartyType = 'Individual' | 'Minor' | 'Firm / LLP' | 'Society / Association' | 'Society / Trust' | 'Company' | 'Others / HUF' | typeof PARTY_CAPACITY_OPTIONS[number];

/** An authorised signatory for a non-individual party, with each postal
 * component retained separately for registration use. */
export type PartyRepresentative = {
  id: string; name: string; relation: string; relationName: string;
  designation: string; dob: string; age: string; aadhaar: string; pan: string;
  mobile: string; hNo: string; locality: string; village: string; mandal: string;
  district: string; state: string; pinCode: string;
};

export const newPartyRepresentative = (): PartyRepresentative => ({
  id: globalThis.crypto?.randomUUID?.() || `representative-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '', relation: 'S/O', relationName: '', designation: '', dob: '', age: '', aadhaar: '', pan: '', mobile: '',
  hNo: '', locality: '', village: '', mandal: '', district: '', state: '', pinCode: '',
});

/** Entity particulars feed the organisation recital; people are stored separately. */
export const partyEntityFields = (side: 'executant' | 'claimant', type: PartyType): Field[] => {
  if (type === 'Individual' || (PARTY_CAPACITY_OPTIONS as readonly string[]).includes(type)) return [];
  const k = (name: string) => `${side}${name}`;
  const common = [
    { id: k('EntityName'), label: 'Entity name (English)', span: 2 as const },
    { id: k('EntityPan'), label: 'Entity PAN' },
    { id: k('EntityMobile'), label: 'Official mobile number', type: 'tel' as const },
    { id: k('EntityEmail'), label: 'Email' },
    { id: k('EntityIncorporationDate'), label: 'Date of incorporation', type: 'date' as const },
    { id: k('EntityNature'), label: 'Nature of business / society' },
    { id: k('EntityAadhaar'), label: 'Aadhaar no. (if any)' },
    { id: k('EntityTin'), label: 'TIN (in case of builder)' },
    { id: k('EntityTan'), label: 'TAN' },
    { id: k('EntityIdProof'), label: 'ID proof', type: 'select' as const, options: ['Aadhaar', 'PAN', 'Registration certificate', 'Other'], allowCustom: true },
    { id: k('EntityIdProofNo'), label: 'ID proof number' },
    { id: k('EntityForm9798'), label: 'Form 97/98', type: 'select' as const, options: ['Yes', 'No'] },
    { id: k('EntityAddress'), label: 'Registered / principal office address', type: 'textarea' as const, span: 2 as const },
    { id: k('EntityCommunicationSame'), label: 'Same as registered office address', type: 'select' as const, options: ['Yes', 'No'] },
    { id: k('EntityCommunicationAddress'), label: 'Communication address', type: 'textarea' as const, span: 2 as const },
    ...(['HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode', 'Landmark'] as const).map((suffix, index) => ({ id: k('Entity' + suffix), label: ['Door / house no.', 'Locality / street', 'Village / city / town', 'Mandal', 'District', 'State', 'PIN code', 'Landmark'][index] })),
    { id: k('EntityBranchOffice'), label: 'Branch office address', type: 'textarea' as const, span: 2 as const },
    { id: k('SignatoryDesignation'), label: 'Legacy signatory designation', hidden: true, span: 2 as const },
  ];
  if (type === 'Firm / LLP') return [
    { id: k('FirmCin'), label: 'Corporation identification no. (if applicable)' },
    { id: k('FirmDin'), label: 'DIN (if applicable)' },
    { id: k('FirmSubtype'), label: 'Firm sub-type', type: 'select', options: ['Partnership Firm', 'Limited Liability Partnership (LLP)'] },
    ...common,
    { id: k('FirmRegistrationNo'), label: 'ROF registration no. / LLPIN' },
    { id: k('FirmRegistrarOffice'), label: 'Registrar of Firms (ROF) office' },
    { id: k('FirmDeedNo'), label: 'Registered partnership deed document no.' },
    { id: k('FirmDeedDate'), label: 'Partnership deed / LLP date', type: 'date' },
    { id: k('FirmGstin'), label: 'Firm GSTIN (optional)' },
    { id: k('FirmAuthority'), label: 'Partnership consent / authority resolution ref. & date', span: 2 as const },
  ];
  if (type === 'Society / Association' || type === 'Society / Trust') return [
    { id: k('SocietyClassification'), label: 'Society / entity classification', type: 'select', options: ['Registered Society', 'Public Trust', 'Private Trust', 'Co-operative Society', 'Other registered entity'], allowCustom: true },
    ...common.filter(f => !['EntityIncorporationDate', 'EntityTin', 'EntityIdProof', 'EntityIdProofNo', 'EntityForm9798'].some(suffix => f.id === k(suffix))),
    { id: k('SocietyRegistrationNo'), label: 'Society / trust registration no.' },
    { id: k('SocietyRegistrationDate'), label: 'Date of registration', type: 'date' },
    { id: k('SocietyRegisteredAct'), label: 'Registered under act', type: 'select', options: ['Societies Registration Act', 'Co-operative Societies Act', 'Other'], allowCustom: true },
    { id: k('SocietyTenureFrom'), label: 'Society tenure from', type: 'date' },
    { id: k('SocietyTenureTo'), label: 'Society tenure to', type: 'date' },
    { id: k('SocietyRegistrationYear'), label: 'Registration year', type: 'number' },
    { id: k('SocietyRegistrarOffice'), label: 'Registrar / district office' },
    { id: k('SocietyNoc'), label: 'Competent authority NOC / permission ref.' },
    { id: k('SocietyResolutionNo'), label: 'Governing-body resolution no. / authorization', span: 2 as const },
  ];
  if (type === 'Company') return [
    { id: k('CompanyClassification'), label: 'Company classification', type: 'select', options: ['Private Limited Company', 'Public Limited Company', 'One Person Company', 'Section 8 Company', 'Other company'], allowCustom: true },
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
  'Individual', 'Firm / LLP', 'Society / Association', 'Society / Trust', 'Company', 'Others / HUF',
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
      { id: 'propState', label: 'State', ph: ['Property State', 'State'], type: 'select', options: ['Telangana', 'Andhra Pradesh'] },
      { id: 'districtRegistrar', label: 'District Registrar', ph: 'District Registrar', span: 2 },
      { id: 'sro', label: 'Sub-Registrar Office', span: 2 },
      { id: 'district', label: 'District', ph: 'District' },
      { id: 'mandal', label: 'Mandal', ph: 'Mandal' },
      { id: 'village', label: 'Village', ph: 'Village' },
      { id: 'executionDate', label: 'Deed execution date', ph: ['Execution Date', 'Date'], type: 'date', hint: 'Prints DD-MM-YYYY. Use “Leave day blank” to print __-MM-YYYY for signing later.' },
    ],
  },
  {
    step: 3,
    title: 'Property identification',
    telugu: 'ఆస్తి గుర్తింపు',
    note: 'What is being conveyed. The fields shown follow this schedule\'s selected property type.',
    fields: [
      { id: 'plotNo', label: 'Plot number', ph: ['Plot No.', 'Plot Nos.'] },
      { id: 'extentSqYards', label: 'Extent (Sq. Yards)', ph: 'Extent in Sq.yards', type: 'number',
        hint: 'Required extent. Enter the exact area in square yards.' },
      { id: 'extentSqMeters', label: 'Extent (Sq. Meters)', ph: 'Extent in Sq.Meters', type: 'number',
        derived: true, hint: 'Calculated automatically from Extent (Sq. Yards).' },
      { id: 'surveyNo', label: 'Survey no(s).', ph: 'Survey No.' },
      { id: 'nearAdjacent', label: 'Landmark relation', type: 'select', options: ['Near', 'Adjacent'],
        hint: 'Choose the relationship of the landmark house number to the property.' },
      { id: 'nearHNo', label: 'Near / adjacent H.No.', ph: 'Near H.No.',
        hint: 'Door/house number of a neighbouring property used as a landmark in the boundary description — not the subject property\'s own number (see Bearing H.No.).' },
      { id: 'landmarkHNo', label: 'Near / adjacent landmark house number', ph: 'Landmark House No.', only: ['Demolished', 'Part open place'],
        hint: 'Neighbouring house used as a landmark; keep the subject property house number in its separate field.' },
      { id: 'assessmentPtinNo', label: 'V.L.T. number', ph: 'V.L.T No.', only: ['Vacant Plot', 'Open Place'],
        hint: 'Vacant Land Tax / assessment number, exactly as printed in the local-body record.' },
      { id: 'locality', label: 'Locality', ph: 'Locality' },
      { id: 'localAuthorityType', label: 'ULB / municipality', ph: 'Local Authority Type', type: 'select', options: LOCAL_AUTHORITY_OPTIONS },
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
      { id: 'boundaryNorth', label: 'North', ph: ['North Boundary', 'North Boundary of Apartment'] },
      { id: 'boundarySouth', label: 'South', ph: ['South Boundary', 'South Boundary of Apartment'] },
      { id: 'boundaryEast', label: 'East', ph: ['East Boundary', 'East Boundary of Apartment'] },
      { id: 'boundaryWest', label: 'West', ph: ['West Boundary', 'West Boundary of Apartment'] },
    ],
  },
  {
    step: 3,
    title: 'Boundaries of Flat',
    telugu: 'ఫ్లాట్ చతుస్సీమలు',
    note: 'The four abutments of this individual flat, separate from the apartment property boundaries.',
    cols: 2,
    fields: [
      { id: 'flatBoundaryNorth', label: 'North', ph: 'North Boundary of Flat', only: ['Flat'] },
      { id: 'flatBoundarySouth', label: 'South', ph: 'South Boundary of Flat', only: ['Flat'] },
      { id: 'flatBoundaryEast', label: 'East', ph: 'East Boundary of Flat', only: ['Flat'] },
      { id: 'flatBoundaryWest', label: 'West', ph: 'West Boundary of Flat', only: ['Flat'] },
    ],
  },
  {
    step: 3,
    title: 'Structure & Annexure I-A',
    telugu: 'నిర్మాణ వివరాలు',
    note: 'Collected only for a built structure — these fill Annexure I-A of the deed.',
    fields: [
      { id: 'houseStage', label: 'House completion stage', type: 'select', options: ['Finished', 'Semi-Finished'], only: ['Residential', 'Commercial'] },
      { id: 'bearingHNo', label: 'Bearing H.No.', ph: 'Bearing H.No.', only: HOUSE_CATEGORIES },
      { id: 'roofMaterial', label: 'Nature of roof', only: HOUSE_CATEGORIES,
        options: ROOF_NATURE_OPTIONS,
        hint: 'Select the description supported by the property record, or enter a custom description.' },
      { id: 'constructionDescription', label: 'Type of structure / construction', type: 'select', only: HOUSE_CATEGORIES,
        options: STRUCTURE_TYPE_OPTIONS,
        hint: 'Select the construction description for Annexure I-A.' },
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
    note: 'The selected completion option controls the matching flat deed. Enter the parking area and building/title particulars from the supporting records.',
    fields: [
      { id: 'flatStage', label: 'Flat stage', ph: 'Stage', type: 'select', options: ['Finished', 'Semi-Finished'], only: ['Flat'] },
      { id: 'flatAgeYears', label: 'Age of flat (years)', ph: 'Age of Flat', type: 'number', only: ['Flat'] },
      { id: 'flatNo', label: 'Flat number', ph: 'Flat No.', only: ['Flat'] },
      { id: 'flatFloorNo', label: 'Floor number', ph: 'Floor No.', only: ['Flat'] },
      { id: 'apartmentName', label: 'Apartment complex name', ph: 'Apartment Complex Name', span: 2, only: ['Flat'] },
      { id: 'udsSqYards', label: 'Undivided share (Sq. Yards)', ph: 'UDS', type: 'number', only: ['Flat'] },
      { id: 'udsSqMeters', label: 'Undivided share (Sq. Meters)', type: 'number', only: ['Flat'] },
      { id: 'superBuiltUpAreaSqFt', label: 'Built-up area including common area (Sq. Ft.)', ph: 'Built-up Area', type: 'number', only: ['Flat'] },
      { id: 'carpetAreaSqFt', label: 'Carpet area (Sq. Ft.)', type: 'number', only: ['Flat'] },
      { id: 'parkingSlotNos', label: 'Parking slot no(s).', only: ['Flat'] },
      { id: 'parkingAreaSqFt', label: 'Car parking area (Sq. Ft.)', ph: ['Car Parking Area', '100'], type: 'number', only: ['Flat'] },
      { id: 'buildingPermitNo', label: 'Building permit number', only: ['Flat'], hint: 'Add the permission date and issuing local authority in Link Deed & Enclosures → Permissions.' },
    ],
  },
  {
    step: 3,
    title: 'Landowner–developer agreements',
    placementSection: 'flat-particulars',
    placementContinuation: true,
    note: 'Development agreement and flat-allotment details for the selected Word template.',
    fields: [
      { id: 'stiltFloors', label: 'Number of stilt floors', ph: ['Stilt Floors', '1'], type: 'number', only: ['Flat'] },
      { id: 'upperFloors', label: 'Number of upper floors', ph: ['Upper Floors', '5'], type: 'number', only: ['Flat'] },
      { id: 'developmentSro', label: 'Development agreement — SRO', ph: 'Development SRO', only: ['Flat'] },
      { id: 'developmentSroCode', label: 'Development agreement — SRO code', ph: 'Development SRO Code', only: ['Flat'] },
      { id: 'supplementalSro', label: 'Supplemental agreement — SRO', ph: 'Supplemental SRO', only: ['Flat'] },
      { id: 'supplementalSroCode', label: 'Supplemental agreement — SRO code', ph: 'Supplemental SRO Code', only: ['Flat'] },
      { id: 'developmentDocNo', label: 'Development agreement-cum-GPA document number', ph: 'Document No.', only: ['Flat'] },
      { id: 'developmentDocDate', label: 'Development agreement-cum-GPA date', ph: 'Document Date', type: 'date', only: ['Flat'] },
      { id: 'supplementalDocNo', label: 'Supplemental agreement document number', ph: 'Supplemental Agreement No.', only: ['Flat'] },
    ],
  },
  {
    step: 4,
    title: 'Market value, consideration & stamp paper',
    telugu: 'మార్కెట్ విలువ',
    note: 'The extent × basic rate estimate is shown for reference. Enter the agreed consideration and the face value printed on the non-judicial stamp paper; the deed uses the consideration amount.',
    fields: [
      { id: 'govtRate', label: 'Basic rate per Sq. Yard (₹)', ph: 'Market Value Per Sq.Yard', type: 'money' },
      { id: 'structValue', label: 'Structure valuation (₹)', type: 'money', hint: 'Depreciated; 0 for open land' },
      { id: 'consid', label: 'Sale consideration (₹)', ph: 'Market of Value Rs./-', type: 'money' },
      { id: 'stampPaperMargin', label: 'First-page stamp-paper margin', type: 'select', options: ['Legacy', 'None', '100', '50', '20'], optionLabels: { Legacy: 'Current default (5.7 inches)', None: 'Normal page margin', '100': '₹100 stamp paper — 5.8 inches', '50': '₹50 stamp paper — 6 inches', '20': '₹20 stamp paper — 6 inches' } },
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
  { id: 'landLayoutLrs', label: 'Vacant Land Tax / Approved Layout / LRS', telugu: '', note: 'Enter each available land-tax, layout and regularisation detail for this property.', fields: [
    { id: 'vltNo', label: 'V.L.T. number', ph: ['V.L.T No.', 'V.L.T. No.'] },
    { id: 'layoutFileNo', label: 'Approved layout file number', ph: 'Layout File No.' },
    { id: 'lrsApplicationNo', label: 'LRS 2020 application number', ph: 'LRS Application No.' },
    { id: 'lrsApplicationDate', label: 'Application date', ph: 'Application Date', type: 'date' },
    { id: 'lrsProceedingNo', label: 'LRS proceeding number', ph: 'LRS Proceeding No.' },
    { id: 'lrsProceedingDate', label: 'Proceeding date', ph: 'Proceeding Date', type: 'date' },
  ] },
  { id: 'vacantTax', label: 'Vacant Land Tax/Assessment', telugu: '', note: 'Vacant-land tax or assessment identifier for this schedule.', fields: [
    { id: 'vltNo', label: 'V.L.T. / vacant-land assessment number', ph: ['V.L.T No.', 'V.L.T. No.'] },
  ] },
  { id: 'approvedLayout', label: 'Approved Layout', telugu: '', note: 'Approved layout file number for this schedule.', fields: [
    { id: 'layoutFileNo', label: 'Approved layout file number', ph: 'Layout File No.' },
  ] },
  { id: 'assessment', label: 'Tax/Assessment Identification', telugu: '', note: 'Enter the property assessment or PTIN identifier once here. A house-tax receipt may fill this value when it is shown on the receipt.', fields: [
    { id: 'bltNo', label: 'Assessment / PTIN number', ph: ['P.T.I.No.', 'P.T.I. No.'] },
  ] },
  { id: 'lrsApplication', label: 'L.R.S.-2020 Application', telugu: '', note: 'Layout regularisation application and date.', fields: [
    { id: 'lrsApplicationNo', label: 'Application number', ph: 'LRS Application No.' },
    { id: 'lrsApplicationDate', label: 'Application date', ph: 'Application Date', type: 'date' },
  ] },
  { id: 'lrsProceeding', label: 'L.R.S. Proceeding', telugu: '', note: 'Layout regularisation proceeding and date.', fields: [
    { id: 'lrsProceedingNo', label: 'Proceeding number', ph: 'LRS Proceeding No.' },
    { id: 'lrsProceedingDate', label: 'Proceeding date', ph: 'Proceeding Date', type: 'date' },
  ] },
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
    id: 'houseTax', label: 'Property Tax / Assessment', telugu: 'ఇంటి పన్ను రసీదు',
    note: 'Enter the receipt and the property assessment/PTIN separately. Do not use a demand or receipt number as the assessment number.',
    fields: [
      { id: 'houseTaxReceiptNo', label: 'House tax receipt number', ph: 'House Tax Receipt' },
      { id: 'bltNo', label: 'Assessment / PTIN number', ph: ['P.T.I.No.', 'P.T.I. No.'] },
      { id: 'assessmentPtinNo', label: 'Assessment / PTIN number',
        hint: 'Kept for older drafts.', hidden: true },
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
      { id: 'convertedExtentText', label: 'Extent (Sq. Yards)', derived: true, hint: 'Automatically converted: 00-02 means 0 acres and 2 guntas = 242 sq. yards.' },
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
export const TITLE_SECTION_IDS = ['linkDoc', 'landLayoutLrs', 'titleDeed', 'nala', 'houseTax', 'permissions'] as const;

/** Flat list of every field, in step order. De-duplicated: `linkDoc`'s core four are the same fields already in GROUPS. */
export const ALL_FIELDS: Field[] = Object.values(
  Object.fromEntries(
    [...GROUPS.flatMap(g => g.fields), ...LINK_OPTIONS.flatMap(o => o.fields), ...PARTY_ENTITY_FIELDS].map(f => [f.id, f])
  )
);

export const FLAT_AGREEMENT_FIELDS = GROUPS.find(group => group.title === 'Landowner–developer agreements')!.fields;

export const FLAT_SCHEDULE_FIELDS = ['flatStage', 'flatNo', 'flatFloorNo', 'apartmentName', 'superBuiltUpAreaSqFt', 'udsSqYards'] as const;
export const FLAT_BOUNDARY_FIELDS = ['flatBoundaryNorth', 'flatBoundarySouth', 'flatBoundaryEast', 'flatBoundaryWest'] as const;

/** Groups for one step, with category-inapplicable fields removed. */
export function groupsForStep(step: number, category: string): Group[] {
  return GROUPS.filter(g => g.step === step)
    .map(g => ({ ...g,
      ...(category === 'Flat' && g.title === 'Boundaries' ? { title: 'Boundaries of Apartment', note: 'The four apartment-level property boundaries. Enter the individual flat boundaries separately below.' } : {}),
      fields: g.fields.filter(f => !f.hidden && (!f.only || f.only.includes(category)))
      .map(f => f.id === 'nearHNo' && ['Demolished', 'Part open place'].includes(category)
        ? { ...f, label: 'Subject property H.No.', hint: 'House number of the dismantled house or partly open property described in the schedule.' }
        : f.id === 'bearingHNo' && category === 'Flat' ? { ...f, label: 'Municipal H.Nos.' } : f) }))
    .filter(g => g.fields.length > 0);
}

/** The blank form — every field present, every value empty. */
export const EMPTY_FORM: Record<string, string> = Object.fromEntries(
  ALL_FIELDS.map(f => [f.id, ''])
);
export type PartyPeople = { representatives: PartyRepresentative[]; members: PartyRepresentative[] };
export type PartyPeopleIds = { representativeIds: string[]; memberIds: string[] };
export const partyKey = (side: string, record: string) => side + '|' + record;
export const PERSON_FIELDS: Field[] = [
  { id: 'personName', label: 'Name *', span: 2 },
  { id: 'personGender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
  { id: 'personRelation', label: 'Relation', type: 'select', options: ['S/O', 'W/O', 'D/O', 'C/O'] },
  { id: 'personRelationName', label: "Father’s / spouse’s name" },
  { id: 'personDesignation', label: 'Designation' },
  { id: 'personDob', label: 'Date of birth', type: 'date' },
  { id: 'personAge', label: 'Age', type: 'number' },
  { id: 'personMobile', label: 'Mobile no.', type: 'tel' },
  { id: 'personAadhaar', label: 'Aadhaar no.' },
  { id: 'personPan', label: 'PAN' },
  ...(['HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'] as const).map((suffix, i) => ({ id: 'person' + suffix, label: ['Door / house no.', 'Locality / street', 'Village / city / town', 'Mandal', 'District', 'State', 'PIN code'][i] })),
];
export const personField = (key: string) => 'person' + key[0].toUpperCase() + key.slice(1);
