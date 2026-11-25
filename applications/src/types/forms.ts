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
  plaintiffRelationType?: RelationType;
  plaintiffRelationLine?: string;
  plaintiffResidenceAddress?: string;
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
  plaintiffRelationType?: RelationType;
  plaintiffRelationLine?: string;
  plaintiffResidenceAddress?: string;
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

export type EcDoorNoType = '' | 'Near H.No.' | 'Adjacent H.No.' | 'Bearing H.No.';

export const EC_DOOR_NO_TYPE_OPTIONS: Array<{
  value: EcDoorNoType;
  label: string;
}> = [
  { value: '', label: 'None' },
  { value: 'Near H.No.', label: 'Near H.No.' },
  { value: 'Adjacent H.No.', label: 'Adjacent H.No.' },
  { value: 'Bearing H.No.', label: 'Bearing H.No.' },
];

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
  doorNoType?: EcDoorNoType;
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
  purchaserRelationType?: RelationType;
  purchaserRelationLine?: string;
  purchaserResidenceAddress?: string;
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

export function extractApplicantOnlyName(raw: string): string {
  let text = (raw || '').trim();
  if (!text) return '';
  text = text.split(/\r?\n/)[0].trim();
  text = text.replace(/^\s*(?:\(?1\)?[.)]\s*)/, '');
  text = text.split(/\s+(?:2[.)]|\(2\))\s+/i)[0].trim();
  text = text
    .split(
      /\s*,?\s*(?:\b(?:S\s*\/\s*W\s*\/\s*D\s*\/\s*O|S\s*\/\s*D\s*\/\s*W\s*\/\s*O|S\s*\/\s*O|W\s*\/\s*O|D\s*\/\s*O|C\s*\/\s*O|H\s*\/\s*O|F\s*\/\s*O|M\s*\/\s*O|R\s*\/\s*O)\b\.?|\b(?:SON\s+OF|WIFE\s+OF|DAUGHTER\s+OF|CARE\s+OF|HUSBAND\s+OF|RESIDENT\s+OF|AGED?|OCC(?:UPATION)?|AADHAAR|UID|H\.?\s*NO\.?|D\.?\s*NO\.?|DOOR\s*NO\.?|PLOT\s*NO\.?|SY\.?\s*NO\.?)\b[:.\s-]*)/i
    )[0]
    .trim();
  return text.replace(/[,;:\-]+$/, '').trim();
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
      const applicantOnly =
        extractApplicantOnlyName(d.fromNameAddress) ||
        extractApplicantOnlyName(d.claimantNameAddress);
      return {
        applicantName: applicantOnly,
        mobileNo: d.mobileNo.trim(),
        defaultTitle:
          fullDesc ||
          applicantOnly ||
          'Certified Copy Application',
      };
    }
    case 'mvOpen': {
      const d = data as MvOpenFormData;
      const syNos = Array.from(
        new Set(d.rows.map((r) => r.syNo.trim()).filter(Boolean))
      );
      const syRef =
        syNos.length > 0
          ? /^(sy\.?\s*no\.?|survey\s*no\.?)/i.test(syNos[0])
            ? syNos.join(', ')
            : `Sy.No. ${syNos.join(', ')}`
          : '';
      const applicantOnly =
        extractApplicantOnlyName(d.applicantNameAddress) ||
        extractApplicantOnlyName(d.plaintiffNameAddress);
      return {
        applicantName: applicantOnly,
        mobileNo: d.mobileNo.trim(),
        defaultTitle:
          syRef ||
          applicantOnly ||
          (d.village ? `MV Open Plot — ${d.village}` : 'MV Open Plot Application'),
      };
    }
    case 'mvHouse': {
      const d = data as MvHouseFormData;
      const hNos = Array.from(
        new Set(d.rows.map((r) => r.bearingHNo.trim()).filter(Boolean))
      );
      const hNoRef =
        hNos.length > 0
          ? /^(h\.?\s*no\.?|house\s*no\.?)/i.test(hNos[0])
            ? hNos.join(', ')
            : `H.No. ${hNos.join(', ')}`
          : '';
      const applicantOnly =
        extractApplicantOnlyName(d.applicantNameAddress) ||
        extractApplicantOnlyName(d.plaintiffNameAddress);
      return {
        applicantName: applicantOnly,
        mobileNo: d.mobileNo.trim(),
        defaultTitle:
          hNoRef ||
          applicantOnly ||
          (d.village ? `MV House — ${d.village}` : 'MV House Application'),
      };
    }
    case 'ec': {
      const d = data as EcFormData;
      const doorNo = d.doorNo.trim();
      const showAgri =
        d.includeAgriculturalLands ??
        Boolean(
          d.agriVillage.trim() ||
            d.agriMandal.trim() ||
            d.agriRows.some((r) => r.syNo.trim() || r.extentAcGs.trim())
        );
      const agriSyNos = showAgri
        ? Array.from(new Set(d.agriRows.map((r) => r.syNo.trim()).filter(Boolean)))
        : [];
      const syNo = d.surveyNo.trim() || agriSyNos.join(', ');
      const doorRef = doorNo
        ? /^(door\s*no\.?|d\.?\s*no\.?|h\.?\s*no\.?)/i.test(doorNo)
          ? doorNo
          : `Door No. ${doorNo}`
        : '';
      const syRef = syNo
        ? /^(sy\.?\s*no\.?|survey\s*no\.?)/i.test(syNo)
          ? syNo
          : `Sy.No. ${syNo}`
        : '';
      const refTitle = [doorRef, syRef].filter(Boolean).join(', ');
      const applicantOnly =
        extractApplicantOnlyName(d.applicantName) ||
        extractApplicantOnlyName(d.belongsTo);
      return {
        applicantName: applicantOnly,
        mobileNo: d.mobileNo.trim(),
        defaultTitle: refTitle || applicantOnly || 'EC Application',
      };
    }
    case 'indent': {
      const d = data as IndentFormData;
      const applicantOnly = extractApplicantOnlyName(d.purchaserDetails);
      return {
        applicantName: applicantOnly,
        mobileNo: d.mobileNo.trim(),
        defaultTitle:
          applicantOnly ||
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
  const compactMatch = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compactMatch) {
    return `${compactMatch[1]}/${compactMatch[2]}/${compactMatch[3]}`;
  }
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    if (first >= 1 && first <= 12 && second > 12 && second <= 31) {
      return `${String(second).padStart(2, '0')}/${String(first).padStart(2, '0')}/${dmyMatch[3]}`;
    }
    return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
  }
  return trimmed;
}

export function formatTypedDateDDMMYYYY(raw: string): string {
  const trimmed = raw.trim();
  const compactMatch = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compactMatch) {
    const dd = Number(compactMatch[1]);
    const mm = Number(compactMatch[2]);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      return `${compactMatch[1]}/${compactMatch[2]}/${compactMatch[3]}`;
    }
  }
  const sepMatch = trimmed.match(/^(\d{2})[-.](\d{2})[-.](\d{4})$/);
  if (sepMatch) {
    return `${sepMatch[1]}/${sepMatch[2]}/${sepMatch[3]}`;
  }
  return raw;
}

export function subtractOneDayDDMMYYYY(value: string): string {
  const normalized = normalizeDateToDDMMYYYY(value);
  const match = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return '';
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== yyyy ||
    d.getMonth() !== mm - 1 ||
    d.getDate() !== dd
  ) {
    return '';
  }
  d.setDate(d.getDate() - 1);
  const prevDd = String(d.getDate()).padStart(2, '0');
  const prevMm = String(d.getMonth() + 1).padStart(2, '0');
  const prevYyyy = d.getFullYear();
  return `${prevDd}/${prevMm}/${prevYyyy}`;
}

export function getEmptyFormsState(): AllFormsState {
  const today = getTodayFormatted();
  const yesterday = subtractOneDayDDMMYYYY(today) || today;
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
      plaintiffRelationType: 'S/O',
      plaintiffRelationLine: '',
      plaintiffResidenceAddress: '',
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
      plaintiffRelationType: 'S/O',
      plaintiffRelationLine: '',
      plaintiffResidenceAddress: '',
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
      doorNoType: '',
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
      periodTo: yesterday,
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
      purchaserRelationType: 'S/O',
      purchaserRelationLine: '',
      purchaserResidenceAddress: '',
      forWhomDetails: 'SELF',
      dated: today,
      indentNo: '',
    },
  };
}
