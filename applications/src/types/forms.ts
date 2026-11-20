export type FormType = 'ccCopy' | 'mvOpen' | 'mvHouse' | 'ec' | 'indent';

export type CcApplicationMode = 'CERTIFIED COPY' | 'PERSONAL SEARCH';
export type RelationType = 'S/O' | 'W/O' | 'D/O' | 'S/W/D/O';

export const REGISTERED_DEED_TYPES: string[] = [
  'SALE DEED',
  'GIFT DEED',
  'GIFT SETTLEMENT DEED',
  'LEASE DEED',
  'MORTGAGE DEED',
  'MORTGAGE WITH POSSESSION',
  'SIMPLE MORTGAGE',
  'DEPOSIT OF TITLE DEEDS (MODT)',
  'PARTITION DEED',
  'RELEASE DEED',
  'RECTIFICATION DEED',
  'CANCELLATION DEED',
  'EXCHANGE DEED',
  'AGREEMENT OF SALE',
  'DEVELOPMENT AGREEMENT-CUM-GPA',
  'GENERAL POWER OF ATTORNEY (GPA)',
  'SPECIAL POWER OF ATTORNEY (SPA)',
  'WILL DEED',
  'SETTLEMENT DEED',
  'TRUST DEED',
  'PARTNERSHIP DEED',
  'ADOPTION DEED',
  'RECONVEYANCE DEED',
  'COURT DECREE / AWARD',
];

export const TELANGANA_SRO_LIST: string[] = [
  'ACHAMPET',
  'ADILABAD',
  'ALAMPUR',
  'ALER',
  'ALWAL',
  'ANDOLE (JOGIPET)',
  'ARMOOR',
  'ASIFABAD',
  'ASWARAOPETA',
  'ATMAKUR',
  'AZAMPURA',
  'BALANAGAR',
  'BALKONDA',
  'BANJARA HILLS',
  'BANSWADA',
  'BELLAMPALLI',
  'BHADRACHALAM',
  'BHAINSA',
  'BHEEMGAL',
  'BHONGIR',
  'BHUPALPALLY',
  'BIBINAGAR',
  'BICHKUNDA',
  'BOATH',
  'BODHAN',
  'BOWENPALLY',
  'BURGAMPAHAD',
  'CHANDUR',
  'CHARMINAR',
  'CHENNUR',
  'CHERYAL',
  'CHEVELLA',
  'CHIKKADPALLY',
  'CHOPPADANDI',
  'CHOUTUPPAL',
  'DEVARAKONDA',
  'DEVARKADRA',
  'DHARMAPURI',
  'DICHPALLY',
  'DOMAKONDA',
  'DOODHBOWLI',
  'DORNAKAL',
  'DUBBAK',
  'GADWAL',
  'GAJWEL',
  'GAMBHIRAOPET',
  'GANDIPET',
  'GANGADHARA',
  'GHATKESAR',
  'GOLCONDA',
  'HANAMKONDA',
  'HAYATHNAGAR',
  'HUSNABAD',
  'HUZURABAD',
  'HUZURNAGAR',
  'HYDERABAD (R.O.)',
  'IBRAHIMPATNAM',
  'JADCHERLA',
  'JAGTIAL',
  'JAINOOR',
  'JANGAON',
  'KAGAZNAGAR',
  'KALLURU',
  'KALWAKURTHY',
  'KAMAREDDY',
  'KANDUKUR',
  'KAPRA',
  'KARIMNAGAR',
  'KARIMNAGAR (R.O.)',
  'KEESARA',
  'KHAMMAM',
  'KHAMMAM (R.O.)',
  'KHANAPUR',
  'KODAD',
  'KODANGAL',
  'KOLLAPUR',
  'KORUTLA',
  'KOSGI',
  'KOTHAGUDEM',
  'KOTHAKOTA',
  'KUKATPALLY',
  'L.B. NAGAR',
  'LUXETTIPET',
  'MADHIRA',
  'MAHABUBABAD',
  'MAHABUBNAGAR',
  'MAHABUBNAGAR (R.O.)',
  'MAHESHWARAM',
  'MAKTHAL',
  'MALKAJGIRI',
  'MANAKONDUR',
  'MANCHAL',
  'MANCHERIAL',
  'MANTHANI',
  'MANUGURU',
  'MARIPEDA',
  'MARREDPALLY',
  'MEDAK',
  'MEDCHAL',
  'MEDCHAL-MALKAJGIRI (R.O.)',
  'METPALLY',
  'MIRYALAGUDA',
  'MOINABAD',
  'MORTAD',
  'MOTHKUR',
  'MULUGU',
  'MUSHEERABAD',
  'NAGARKURNOOL',
  'NAKREKAL',
  'NALGONDA',
  'NALGONDA (R.O.)',
  'NARAPALLY',
  'NARAYANKHED',
  'NARAYANPET',
  'NARSAMPET',
  'NARSAPUR',
  'NIDAMANOOR',
  'NIRMAL',
  'NIZAMABAD (R.O.)',
  'NIZAMABAD (RURAL)',
  'PALAKURTHY',
  'PALVONCHA',
  'PARGI',
  'PARKAL',
  'PATANCHERU',
  'PEBBAIR',
  'PEDDA AMBERPET',
  'PEDDAPALLI',
  'QUTHBULLAPUR',
  'RAJENDRANAGAR',
  'RAMAGUNDAM',
  'RAMANNAPET',
  'RAMAYAMPET',
  'RANGA REDDY (R.O.)',
  'S.R. NAGAR',
  'SADASIVPET',
  'SANGAREDDY',
  'SAROORNAGAR',
  'SATHUPALLI',
  'SECUNDERABAD',
  'SERILINGAMPALLY',
  'SHADNAGAR',
  'SHAMIRPET',
  'SHAMSHABAD',
  'SHANKARPALLY',
  'SIDDIPET',
  'SIRCILLA',
  'SIRPUR',
  'STATION GHANPUR',
  'SULTANABAD',
  'SURYAPET',
  'TANDUR',
  'THIMMAPUR',
  'THORRUR',
  'THUNGATHURTHY',
  'TOOPRAN',
  'UPPAL',
  'UTNOOR',
  'VALLABHNAGAR',
  'VANASTHALIPURAM',
  'VEMULAWADA',
  'VIKARABAD',
  'WANAPARTHY',
  'WARANGAL (FORT)',
  'WARANGAL (R.O.)',
  'WARDHANNAPET',
  'WYRA',
  'YACHARAM',
  'YADAGIRIGUTTA',
  'YELLANDU',
  'YELLAREDDY',
  'ZAHEERABAD',
];

export interface CcCopyFormData {
  applicationType: CcApplicationMode;
  showCardSubtitle: boolean;
  mobileNo: string;
  fromNameAddress: string;
  relationType?: RelationType;
  relationLine: string;
  residenceAddress?: string;
  toOffice: string;
  requestText: string;
  descriptionOfDocument: string;
  documentNo?: string;
  documentBookNo?: string;
  executantNameAddress: string;
  claimantNameAddress: string;
  villageAndStreet: string;
  surveyAndDoorNo: string;
  searchYear: string;
  sNo: string;
  cNo: string;
  date: string;
  applicationFee: string;
  userChargeFee: string;
  totalFee: string;
  bookNo: string;
  volNo: string;
  pageFrom: string;
  pageTo: string;
  doctNo: string;
  year: string;
  stamp: string;
  noOfWords: string;
  searchMadeBy: string;
  searchVerifiedBy: string;
  copyPreparedBy: string;
  copyComparedBy: string;
  reader: string;
  examiner: string;
}

export type HouseNoLabelType =
  | 'Near H.No.'
  | 'Adjacent H.No.'
  | 'Open Place Bearing H.No.'
  | 'Demolished H.No.';

export const HOUSE_NO_LABEL_OPTIONS: HouseNoLabelType[] = [
  'Near H.No.',
  'Adjacent H.No.',
  'Open Place Bearing H.No.',
  'Demolished H.No.',
];

export interface MvOpenRow {
  id: string;
  syNo: string;
  plotNo: string;
  extentSqY: string;
  wardBlockNo: string;
  nearHNoLabel?: HouseNoLabelType;
  nearHNo: string;
  zone: string;
  valuePerSqY: string;
  total: string;
}

export interface MvOpenFormData {
  stampLabel: string;
  mobileNo: string;
  village: string;
  mandal: string;
  district: string;
  courtName: string;
  rows: MvOpenRow[];
  situatedLocality: string;
  situatedMandal: string;
  situatedDistrict: string;
  plaintiffNameAddress: string;
  applicantNameAddress: string;
  place: string;
  date: string;
}

export interface HouseStructureRow {
  id: string;
  natureOfRoof: string;
  measurement: string;
  floorNo: string;
  buildingAge: string;
  stage: string;
  rate: string;
}

export interface MvHouseRow {
  id: string;
  syNo: string;
  plotNo: string;
  extentSqY: string;
  wardBlockNo: string;
  bearingHNo: string;
  rccSqFts: string;
  tinshedSqFts: string;
  bTilesSqFts: string;
  customRoofLabel: string;
  customRoofSqFts: string;
  total: string;
  structures?: HouseStructureRow[];
}

export function getHouseRowStructures(row: MvHouseRow): HouseStructureRow[] {
  if (row.structures && row.structures.length > 0) {
    return row.structures;
  }
  const items: HouseStructureRow[] = [];
  if (row.rccSqFts.trim()) {
    items.push({
      id: `${row.id}-rcc`,
      natureOfRoof: 'R.C.C.',
      measurement: row.rccSqFts,
      floorNo: '',
      buildingAge: '',
      stage: '',
      rate: '',
    });
  }
  if (row.tinshedSqFts.trim()) {
    items.push({
      id: `${row.id}-tinshed`,
      natureOfRoof: 'TINSHED.',
      measurement: row.tinshedSqFts,
      floorNo: '',
      buildingAge: '',
      stage: '',
      rate: '',
    });
  }
  if (row.bTilesSqFts.trim()) {
    items.push({
      id: `${row.id}-btiles`,
      natureOfRoof: 'B.TILES',
      measurement: row.bTilesSqFts,
      floorNo: '',
      buildingAge: '',
      stage: '',
      rate: '',
    });
  }
  if (row.customRoofLabel.trim() || row.customRoofSqFts.trim()) {
    items.push({
      id: `${row.id}-custom`,
      natureOfRoof: row.customRoofLabel,
      measurement: row.customRoofSqFts,
      floorNo: '',
      buildingAge: '',
      stage: '',
      rate: '',
    });
  }
  return items;
}

export interface MvHouseFormData {
  stampLabel: string;
  mobileNo: string;
  village: string;
  mandal: string;
  district: string;
  courtName: string;
  rows: MvHouseRow[];
  situatedText: string;
  plaintiffNameAddress: string;
  applicantNameAddress: string;
  place: string;
  date: string;
}

export interface EcAgriRow {
  id: string;
  syNo: string;
  extentAcGs: string;
  classification: string;
}

export interface EcLinkDocument {
  id: string;
  doctNo: string;
  doctYear: string;
  description?: string;
}

export interface EcFormData {
  mobileNo: string;
  applicantName: string;
  relationType?: RelationType;
  relationLine?: string;
  residenceAddress?: string;
  corporationTownVillage: string;
  mandal: string;
  district: string;
  doorNo: string;
  plotNo: string;
  surveyNo: string;
  extentSqY: string;
  locationName: string;
  plinthAreaSqFt: string;
  apartmentName: string;
  uds: string;
  includeAgriculturalLands?: boolean;
  agriVillage: string;
  agriMandal: string;
  agriDistrict: string;
  agriRows: EcAgriRow[];
  doctNo: string;
  doctYear: string;
  linkDocuments: EcLinkDocument[];
  belongsTo: string;
  east: string;
  west: string;
  north: string;
  south: string;
  periodFrom: string;
  periodTo: string;
  date: string;
}

export interface StampCategoryOption {
  code: string;
  label: string;
}

export const STAMP_CATEGORIES: StampCategoryOption[] = [
  { code: 'Spl.Adh', label: 'Special Adhesives' },
  { code: 'Non Judicial', label: 'Non Judicial' },
  { code: 'Share Transfer', label: 'Share Transfer' },
  { code: 'Notary Stamps', label: 'Notary Stamps' },
  { code: 'Foreign Bill', label: 'Foreign Bill' },
  { code: 'Court fee', label: 'Court fee' },
  { code: 'Revenue Stamp', label: 'Revenue Stamp' },
];

export interface IndentFormData {
  mobileNo: string;
  category: string;
  categoryDisplayMode: 'code' | 'full';
  valueOfStamps: string;
  quantity: string;
  totalAmount?: string;
  purchaserDetails: string;
  forWhomDetails: string;
  dated: string;
  indentNo: string;
}

export interface AllFormsState {
  ccCopy: CcCopyFormData;
  mvOpen: MvOpenFormData;
  mvHouse: MvHouseFormData;
  ec: EcFormData;
  indent: IndentFormData;
}

export type RecordStatus = 'pending' | 'complete' | 'due';

export interface SavedRecord {
  id: string;
  formType: FormType;
  title: string;
  applicantName: string;
  mobileNo: string;
  status: RecordStatus;
  dueDate: string;
  feeAmount: string;
  paidAmount: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  data: AllFormsState[FormType];
}

export function extractRecordMeta(
  formType: FormType,
  data: AllFormsState[FormType]
): { applicantName: string; mobileNo: string; defaultTitle: string } {
  switch (formType) {
    case 'ccCopy': {
      const d = data as CcCopyFormData;
      const desc = d.descriptionOfDocument.trim();
      const docNum = (d.documentNo || '').trim();
      const fullDesc =
        desc && docNum && !desc.toLowerCase().includes(docNum.toLowerCase())
          ? `${desc} ${docNum.toLowerCase().startsWith('no') ? docNum : `No.${docNum}`}`
          : desc || docNum;
      return {
        applicantName: d.fromNameAddress.trim() || d.claimantNameAddress.trim(),
        mobileNo: d.mobileNo.trim(),
        defaultTitle:
          fullDesc ||
          d.fromNameAddress.trim() ||
          'Certified Copy Application',
      };
    }
    case 'mvOpen': {
      const d = data as MvOpenFormData;
      return {
        applicantName: d.plaintiffNameAddress.trim() || d.applicantNameAddress.trim(),
        mobileNo: d.mobileNo.trim(),
        defaultTitle:
          d.plaintiffNameAddress.trim() ||
          (d.village ? `MV Open Plot — ${d.village}` : 'MV Open Plot Application'),
      };
    }
    case 'mvHouse': {
      const d = data as MvHouseFormData;
      return {
        applicantName: d.plaintiffNameAddress.trim() || d.applicantNameAddress.trim(),
        mobileNo: d.mobileNo.trim(),
        defaultTitle:
          d.plaintiffNameAddress.trim() ||
          (d.village ? `MV House — ${d.village}` : 'MV House Application'),
      };
    }
    case 'ec': {
      const d = data as EcFormData;
      return {
        applicantName: d.applicantName.trim() || d.belongsTo.trim(),
        mobileNo: d.mobileNo.trim(),
        defaultTitle:
          d.applicantName.trim() ||
          (d.surveyNo ? `EC — Sy.No ${d.surveyNo}` : 'EC Application'),
      };
    }
    case 'indent': {
      const d = data as IndentFormData;
      return {
        applicantName: d.purchaserDetails.trim(),
        mobileNo: d.mobileNo.trim(),
        defaultTitle:
          d.purchaserDetails.trim() ||
          (d.valueOfStamps ? `Stamp Indent Rs.${d.valueOfStamps}/-` : 'Stamp Indent'),
      };
    }
  }
}

export function getTodayFormatted(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function normalizeDateToDDMMYYYY(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
  }
  const slashMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    if (first >= 1 && first <= 12 && second > 12 && second <= 31) {
      return `${String(second).padStart(2, '0')}/${String(first).padStart(2, '0')}/${slashMatch[3]}`;
    }
  }
  return trimmed;
}

export function getEmptyFormsState(): AllFormsState {
  const today = getTodayFormatted();
  return {
    ccCopy: {
      applicationType: 'CERTIFIED COPY',
      showCardSubtitle: false,
      mobileNo: '',
      fromNameAddress: '',
      relationType: 'S/O',
      relationLine: '',
      residenceAddress: '',
      toOffice: 'SIRCILLA',
      requestText:
        'Please search books of your office and grant me copies of the under mentioned document.',
      descriptionOfDocument: '',
      documentNo: '',
      documentBookNo: '',
      executantNameAddress: '',
      claimantNameAddress: '',
      villageAndStreet: '',
      surveyAndDoorNo: '',
      searchYear: '',
      sNo: '',
      cNo: '',
      date: '',
      applicationFee: '',
      userChargeFee: '',
      totalFee: '',
      bookNo: '1',
      volNo: '',
      pageFrom: '',
      pageTo: '0',
      doctNo: '',
      year: '',
      stamp: '',
      noOfWords: '',
      searchMadeBy: '',
      searchVerifiedBy: '',
      copyPreparedBy: '',
      copyComparedBy: '',
      reader: '',
      examiner: '',
    },
    mvOpen: {
      stampLabel: 'Rs.2/-',
      mobileNo: '',
      village: '',
      mandal: '',
      district: 'Rajanna Sircilla.',
      courtName: 'Junior Civil Judge, Sircilla.',
      rows: [
        {
          id: 'row-1',
          syNo: '',
          plotNo: '',
          extentSqY: '',
          wardBlockNo: '',
          nearHNoLabel: 'Near H.No.',
          nearHNo: '',
          zone: '',
          valuePerSqY: '',
          total: '',
        },
      ],
      situatedLocality: '',
      situatedMandal: '',
      situatedDistrict: 'Rajanna Sircilla.',
      plaintiffNameAddress: '',
      applicantNameAddress: '',
      place: 'Sircilla.',
      date: today,
    },
    mvHouse: {
      stampLabel: 'Rs.2/-',
      mobileNo: '',
      village: '',
      mandal: '',
      district: 'Rajanna Sircilla.',
      courtName: 'Junior Civil Judge, Sircilla.',
      rows: [
        {
          id: 'hrow-1',
          syNo: '',
          plotNo: '',
          extentSqY: '',
          wardBlockNo: '',
          bearingHNo: '',
          rccSqFts: '',
          tinshedSqFts: '',
          bTilesSqFts: '',
          customRoofLabel: '',
          customRoofSqFts: '',
          total: '',
        },
      ],
      situatedText: 'Shanthinagar, Sircilla, Dist.Rajanna Sircilla.',
      plaintiffNameAddress: '',
      applicantNameAddress: '',
      place: 'Sircilla.',
      date: today,
    },
    ec: {
      mobileNo: '',
      applicantName: '',
      relationType: 'S/O',
      relationLine: '',
      residenceAddress: '',
      corporationTownVillage: '',
      mandal: '',
      district: 'Rajanna Sircilla',
      doorNo: '',
      plotNo: '',
      surveyNo: '',
      extentSqY: '',
      locationName: '',
      plinthAreaSqFt: '',
      apartmentName: '',
      uds: '',
      includeAgriculturalLands: false,
      agriVillage: '',
      agriMandal: '',
      agriDistrict: 'Rajanna Sircilla',
      agriRows: [
        {
          id: 'agri-1',
          syNo: '',
          extentAcGs: '',
          classification: 'Wet',
        },
      ],
      doctNo: '',
      doctYear: '',
      linkDocuments: [
        {
          id: 'link-1',
          doctNo: '',
          doctYear: '',
          description: '',
        },
      ],
      belongsTo: 'SELF',
      east: '',
      west: '',
      north: '',
      south: '',
      periodFrom: '',
      periodTo: today,
      date: today,
    },
    indent: {
      mobileNo: '',
      category: 'Spl.Adh',
      categoryDisplayMode: 'code',
      valueOfStamps: '',
      quantity: '1',
      totalAmount: '',
      purchaserDetails: '',
      forWhomDetails: 'SELF',
      dated: today,
      indentNo: '',
    },
  };
}

export function getSampleFormsState(): AllFormsState {
  const today = getTodayFormatted();
  return {
    ccCopy: {
      applicationType: 'CERTIFIED COPY',
      showCardSubtitle: false,
      mobileNo: '0000000000',
      fromNameAddress: 'SAMPLE APPLICANT S/O SAMPLE PARENT R/O SIRCILLA',
      relationType: 'S/O',
      relationLine: '',
      residenceAddress: '',
      toOffice: 'SIRCILLA',
      requestText:
        'Please search books of your office and grant me copies of the under mentioned document.',
      descriptionOfDocument: 'LEASE DEED',
      documentNo: '3789/2012',
      documentBookNo: '',
      executantNameAddress: 'MUNCIPAL COUNCIL,SIRCILLA',
      claimantNameAddress: 'SAMPLE APPLICANT',
      villageAndStreet: 'SIRCILLA',
      surveyAndDoorNo: '17',
      searchYear: '2012',
      sNo: '',
      cNo: '',
      date: '',
      applicationFee: '',
      userChargeFee: '',
      totalFee: '',
      bookNo: '1',
      volNo: '',
      pageFrom: '',
      pageTo: '0',
      doctNo: '3789',
      year: '2012',
      stamp: '',
      noOfWords: '',
      searchMadeBy: '',
      searchVerifiedBy: '',
      copyPreparedBy: '',
      copyComparedBy: '',
      reader: '',
      examiner: '',
    },
    mvOpen: {
      stampLabel: 'Rs.2/-',
      mobileNo: '0000000000',
      village: 'Sircilla',
      mandal: 'Sircilla',
      district: 'Rajanna Sircilla.',
      courtName: 'Junior Civil Judge, Sircilla.',
      rows: [
        {
          id: 'row-1',
          syNo: '142',
          plotNo: '24',
          extentSqY: '200',
          wardBlockNo: 'Ward No. 5',
          nearHNoLabel: 'Near H.No.',
          nearHNo: '5-2-118',
          zone: 'Residential',
          valuePerSqY: '6500',
          total: '13,00,000',
        },
      ],
      situatedLocality: 'Vidyanagar',
      situatedMandal: 'Sircilla',
      situatedDistrict: 'Rajanna Sircilla.',
      plaintiffNameAddress: 'SAMPLE APPLICANT S/O SAMPLE PARENT R/O SIRCILLA',
      applicantNameAddress: '',
      place: 'Sircilla.',
      date: today,
    },
    mvHouse: {
      stampLabel: 'Rs.2/-',
      mobileNo: '0000000000',
      village: 'Sircilla',
      mandal: 'Sircilla',
      district: 'Rajanna Sircilla.',
      courtName: 'Junior Civil Judge, Sircilla.',
      rows: [
        {
          id: 'hrow-1',
          syNo: '41',
          plotNo: '',
          extentSqY: '144',
          wardBlockNo: '',
          bearingHNo: '3-7-114',
          rccSqFts: '486',
          tinshedSqFts: '120',
          bTilesSqFts: '',
          customRoofLabel: '',
          customRoofSqFts: '',
          total: '',
        },
      ],
      situatedText: 'Shanthinagar, Sircilla, Dist.Karimnagar.',
      plaintiffNameAddress: 'SAMPLE APPLICANT W/O SAMPLE SPOUSE R/O SIRCILLA',
      applicantNameAddress: '',
      place: 'Sircilla.',
      date: today,
    },
    ec: {
      mobileNo: '0000000000',
      applicantName: 'SAMPLE APPLICANT',
      relationType: 'S/O',
      relationLine: '',
      residenceAddress: '',
      corporationTownVillage: 'Sircilla',
      mandal: 'Sircilla',
      district: 'Rajanna Sircilla',
      doorNo: '3-7-114',
      plotNo: '24',
      surveyNo: '41',
      extentSqY: '144',
      locationName: 'Shanthinagar',
      plinthAreaSqFt: '606',
      apartmentName: '',
      uds: '',
      includeAgriculturalLands: false,
      agriVillage: '',
      agriMandal: '',
      agriDistrict: 'Rajanna Sircilla',
      agriRows: [
        {
          id: 'agri-1',
          syNo: '',
          extentAcGs: '',
          classification: 'Wet',
        },
      ],
      doctNo: '3789',
      doctYear: '2012',
      linkDocuments: [
        {
          id: 'link-1',
          doctNo: '3789',
          doctYear: '2012',
          description: '',
        },
        {
          id: 'link-2',
          doctNo: '1452',
          doctYear: '2018',
          description: '',
        },
      ],
      belongsTo: 'SELF',
      east: 'Road',
      west: 'Plot No. 23',
      north: 'Plot No. 25',
      south: '20 Feet Wide Road',
      periodFrom: '01/01/1983',
      periodTo: today,
      date: today,
    },
    indent: {
      mobileNo: '0000000000',
      category: 'Spl.Adh',
      categoryDisplayMode: 'code',
      valueOfStamps: '1000',
      quantity: '1',
      totalAmount: '1000',
      purchaserDetails: 'SAMPLE PURCHASER S/O SAMPLE PARENT R/O SIRCILLA',
      forWhomDetails: 'SELF',
      dated: today,
      indentNo: '',
    },
  };
}
