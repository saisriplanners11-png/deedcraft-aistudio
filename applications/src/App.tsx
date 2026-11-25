import { clearSavedApplications, createSavedApplication, deleteSavedApplication, listSavedApplications, updateSavedApplication } from './saved-records';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  FileUp,
  FolderOpen,
  Printer,
  RotateCcw,
  Save,
} from 'lucide-react';
import {
  AiUploadPanel,
  AllA4ExtractedPayload,
} from './components/AiUploadPanel';
import { CcCopyEditor } from './components/forms/CcCopyEditor';
import { EcEditor } from './components/forms/EcEditor';
import { IndentEditor } from './components/forms/IndentEditor';
import {
  MarketValueEditor,
  MarketValueMode,
} from './components/forms/MarketValueEditor';
import { CcCopySheet } from './components/previews/CcCopySheet';
import { EcSheet } from './components/previews/EcSheet';
import { IndentSheet } from './components/previews/IndentSheet';
import { MvHouseSheet } from './components/previews/MvHouseSheet';
import { MvOpenSheet } from './components/previews/MvOpenSheet';
import { SavedDeedPicker } from './components/SavedDeedPicker';
import { fillApplicationFromDeed } from './deed-autofill';
import { SavedRecordsModal } from './components/SavedRecordsModal';
import { StatusReportView } from './components/StatusReportView';
import {
  AllFormsState,
  CcCopyFormData,
  EcFormData,
  extractRecordMeta,
  FormType,
  getEmptyFormsState,
  getTodayFormatted,
  HOUSE_NO_LABEL_OPTIONS,
  HouseNoLabelType,
  IndentFormData,
  MvHouseFormData,
  MvOpenFormData,
  normalizeDateToDDMMYYYY,
  RecordStatus,
  SavedRecord,
  STAMP_CATEGORIES,
  subtractOneDayDDMMYYYY,
} from './types/forms';

const DRAFT_STORAGE_KEY = 'card_forms_studio_draft_v1';

type WorkspaceView = 'builder' | 'report';

interface FormTabMeta {
  id: FormType;
  navLabel: string;
  fullTitle: string;
  subtitle: string;
}

const FORM_TABS: FormTabMeta[] = [
  {
    id: 'ccCopy',
    navLabel: 'Certified Copy',
    fullTitle: 'CARD — Certified Copy / Personal Search Application',
    subtitle: 'Search registration books and request certified copies or personal search',
  },
  {
    id: 'mvOpen',
    navLabel: 'MV Open Plot',
    fullTitle: 'APPLICATION FOR MARKET VALUE (Open Plot / House Site)',
    subtitle: 'Application for market value certificate of open plot involved in a suit',
  },
  {
    id: 'mvHouse',
    navLabel: 'MV House',
    fullTitle: 'APPLICATION FOR MARKET VALUE (House & Plinth Area)',
    subtitle: 'Application for market value certificate with R.C.C. / Tinshed / B.Tiles area',
  },
  {
    id: 'ec',
    navLabel: 'EC Application',
    fullTitle: 'CARD — Application for Encumbrance Certificate (E.C.)',
    subtitle: 'Search encumbrances for house, open plot, or agricultural lands',
  },
  {
    id: 'indent',
    navLabel: 'Stamp Indent',
    fullTitle: 'CARD — Indent for Stamps',
    subtitle: 'Requisition form for Non-Judicial, Special Adhesives, Court Fee & other stamps',
  },
];

export default function App() {
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('builder');
  const [activeForm, setActiveForm] = useState<FormType>('ccCopy');
  const [mvMode, setMvMode] = useState<MarketValueMode>('mvOpen');
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  const [formsState, setFormsState] = useState<AllFormsState>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AllFormsState>;
        const defaults = getEmptyFormsState();
        const mvOpen = { ...defaults.mvOpen, ...parsed.mvOpen };
        const mvHouse = { ...defaults.mvHouse, ...parsed.mvHouse };
        const ec = { ...defaults.ec, ...parsed.ec };
        const indent = { ...defaults.indent, ...parsed.indent };
        return {
          ccCopy: { ...defaults.ccCopy, ...parsed.ccCopy },
          mvOpen: { ...mvOpen, date: normalizeDateToDDMMYYYY(mvOpen.date) },
          mvHouse: { ...mvHouse, date: normalizeDateToDDMMYYYY(mvHouse.date) },
          ec: {
            ...ec,
            periodFrom: normalizeDateToDDMMYYYY(ec.periodFrom),
            periodTo: normalizeDateToDDMMYYYY(ec.periodTo),
            date: normalizeDateToDDMMYYYY(ec.date),
          },
          indent: { ...indent, dated: normalizeDateToDDMMYYYY(indent.dated) },
        };
      }
    } catch {
      // Ignore storage read errors
    }
    return getEmptyFormsState();
  });

  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [isSavedDeedPickerOpen, setIsSavedDeedPickerOpen] = useState(false);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
  const [isSaveInlineOpen, setIsSaveInlineOpen] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [saveFormDraft, setSaveFormDraft] = useState({
    title: '',
    status: 'pending' as RecordStatus,
    dueDate: new Date().toISOString().slice(0, 10),
    feeAmount: '',
    paidAmount: '',
    notes: '',
  });

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const savePanelRef = useRef<HTMLFormElement | null>(null);

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      setSavedRecords(await listSavedApplications());
    } catch (err) {
      setRecordsError(
        err instanceof Error ? err.message : 'Unable to connect server'
      );
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Persist working input draft locally in browser
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formsState));
    } catch {
      // Ignore quota errors
    }
  }, [formsState]);

  const showToast = (msg: string) => {
    setFeedbackMessage(msg);
    window.setTimeout(() => {
      setFeedbackMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  useEffect(() => {
    if (!isPrintPreviewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPrintPreviewOpen(false);
        setIsSaveInlineOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPrintPreviewOpen]);

  const handlePrint = () => {
    document.body.classList.remove('printing-all-a4');
    if (workspaceView === 'builder') {
      const prevTitle = document.title;
      const meta = extractRecordMeta(activeForm, formsState[activeForm]);
      const safeName = (meta.defaultTitle || activeMeta.navLabel)
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .trim();
      document.title = `${activeMeta.navLabel} - ${safeName}`;
      const restoreTitle = () => {
        document.title = prevTitle;
        window.removeEventListener('afterprint', restoreTitle);
      };
      window.addEventListener('afterprint', restoreTitle);
      window.print();
      window.setTimeout(restoreTitle, 2000);
      return;
    }
    window.print();
  };

  const handleClearForm = () => {
    const empty = getEmptyFormsState();
    setActiveRecordId(null);
    setHasPreviewed(false);
    setIsSaveInlineOpen(false);
    setFormsState((prev) => ({
      ...prev,
      [activeForm]: empty[activeForm],
    }));
    showToast('Cleared fields for this form');
  };

  const handleOpenSaveInline = () => {
    const meta = extractRecordMeta(activeForm, formsState[activeForm]);
    const existing = activeRecordId
      ? savedRecords.find((r) => r.id === activeRecordId)
      : undefined;

    setSaveFormDraft({
      title: existing?.title || meta.defaultTitle,
      status: existing?.status || 'pending',
      dueDate: existing?.dueDate || new Date().toISOString().slice(0, 10),
      feeAmount: existing?.feeAmount || '',
      paidAmount: existing?.paidAmount || '',
      notes: existing?.notes || '',
    });
    setIsSaveInlineOpen(true);
  };

  const handleSaveApplication = async (
    e: React.FormEvent,
    asNew: boolean = false
  ) => {
    e.preventDefault();
    setIsSavingRecord(true);
    try {
      const meta = extractRecordMeta(activeForm, formsState[activeForm]);
      const payload = {
        formType: activeForm,
        title: saveFormDraft.title.trim() || meta.defaultTitle,
        applicantName: meta.applicantName,
        mobileNo: meta.mobileNo,
        status: saveFormDraft.status,
        dueDate: saveFormDraft.dueDate,
        feeAmount: saveFormDraft.feeAmount,
        paidAmount: saveFormDraft.paidAmount,
        notes: saveFormDraft.notes,
        data: formsState[activeForm],
      };

      const shouldUpdate = Boolean(activeRecordId && !asNew);
      const record = shouldUpdate && activeRecordId
        ? await updateSavedApplication(activeRecordId, payload)
        : await createSavedApplication(payload);
      setActiveRecordId(record.id);
      setIsSaveInlineOpen(false);
      await fetchRecords();
      showToast(
        shouldUpdate
          ? `Updated "${record.title}" (${record.status.toUpperCase()})`
          : `Saved "${record.title}"`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error saving'
      );
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleUpdateRecord = async (
    id: string,
    patch: Partial<
      Pick<
        SavedRecord,
        'status' | 'title' | 'dueDate' | 'feeAmount' | 'paidAmount' | 'notes'
      >
    >
  ) => {
    const record = await updateSavedApplication(id, patch);
    setSavedRecords((prev) =>
      prev.map((rec) => (rec.id === id ? record : rec))
    );
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteSavedApplication(id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete this application');
      return;
    }
    if (activeRecordId === id) {
      setActiveRecordId(null);
    }
    setSavedRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAllRecords = async () => {
    try {
      await clearSavedApplications();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to clear saved applications');
      return;
    }
    setActiveRecordId(null);
    setSavedRecords([]);
    showToast('Removed all saved entries');
  };

  const handleLoadSaved = (record: SavedRecord) => {
    setWorkspaceView('builder');
    setActiveForm(record.formType);
    if (record.formType === 'mvOpen' || record.formType === 'mvHouse') {
      setMvMode(record.formType);
    }
    setActiveRecordId(record.id);
    setHasPreviewed(false);
    setIsSaveInlineOpen(false);
    setFormsState((prev) => ({
      ...prev,
      [record.formType]: { ...getEmptyFormsState()[record.formType], ...record.data },
    }));
    showToast(`Loaded "${record.title}"`);
  };

  const pickStr = (val: unknown, fallback: string = '') =>
    typeof val === 'string' && val.trim() ? val.trim() : fallback;

  const cleanSroName = (val: unknown): string =>
    pickStr(val, '')
      .replace(/^(?:THE\s+)?(?:SUB[- ]?REGISTRAR(?:\s+OFFICE)?|S\.?R\.?O\.?)[,:\s-]*/i, '')
      .replace(/\.$/, '')
      .trim()
      .toUpperCase();

  const parseDocPair = (docNoStr: string): { doctNo: string; year: string } => {
    const cleaned = docNoStr.trim().replace(/^no\.?\s*/i, '');
    const m = cleaned.match(/^([^\s/-]+)\s*[/-]\s*(\d{4})$/);
    if (m) return { doctNo: m[1], year: m[2] };
    return { doctNo: '', year: '' };
  };

  const buildCcCopyFromAi = (
    rawFields: Record<string, unknown>,
    emptyBase: CcCopyFormData
  ): CcCopyFormData => {
    const appMode =
      rawFields.applicationType === 'PERSONAL SEARCH'
        ? 'PERSONAL SEARCH'
        : 'CERTIFIED COPY';
    const rawDocNo = pickStr(rawFields.documentNo, '');
    const parsedPair = parseDocPair(rawDocNo);
    const doctNo = pickStr(rawFields.doctNo, parsedPair.doctNo);
    const year = pickStr(
      rawFields.year,
      parsedPair.year || pickStr(rawFields.searchYear, '')
    );
    const documentNo =
      rawDocNo || (doctNo && year ? `${doctNo}/${year}` : doctNo);
    const searchYear = pickStr(rawFields.searchYear, year);
    const rawDocBookNo = pickStr(rawFields.documentBookNo, '');
    const documentBookNo = rawDocBookNo === '2' ? '' : rawDocBookNo;
    const rawBookNo = pickStr(rawFields.bookNo, documentBookNo);
    const bookNo = rawBookNo === '2' ? '1' : rawBookNo;

    return {
      ...emptyBase,
      applicationType: appMode,
      mobileNo: pickStr(rawFields.mobileNo, ''),
      fromNameAddress: pickStr(rawFields.fromNameAddress, '').toUpperCase(),
      relationType:
        rawFields.relationType === 'W/O' ||
        rawFields.relationType === 'D/O' ||
        rawFields.relationType === 'S/W/D/O'
          ? rawFields.relationType
          : 'S/O',
      relationLine: pickStr(rawFields.relationLine, '').toUpperCase(),
      residenceAddress: pickStr(rawFields.residenceAddress, '').toUpperCase(),
      toOffice: cleanSroName(rawFields.toOffice),
      descriptionOfDocument: pickStr(
        rawFields.descriptionOfDocument,
        ''
      ).toUpperCase(),
      documentNo,
      documentBookNo,
      executantNameAddress: pickStr(
        rawFields.executantNameAddress,
        ''
      ).toUpperCase(),
      claimantNameAddress: pickStr(
        rawFields.claimantNameAddress,
        ''
      ).toUpperCase(),
      villageAndStreet: pickStr(rawFields.villageAndStreet, '').toUpperCase(),
      surveyAndDoorNo: pickStr(rawFields.surveyAndDoorNo, ''),
      searchYear,
      bookNo,
      volNo: pickStr(rawFields.volNo, ''),
      pageFrom: pickStr(rawFields.pageFrom, ''),
      pageTo: pickStr(rawFields.pageTo, ''),
      doctNo,
      year,
    };
  };

  const buildMvOpenFromAi = (
    rawFields: Record<string, unknown>,
    emptyBase: MvOpenFormData
  ): MvOpenFormData => {
    const rawRows = Array.isArray(rawFields.rows) ? rawFields.rows : [];
    const rows =
      rawRows.length > 0
        ? rawRows.map((item, idx) => {
            const r = (item || {}) as Record<string, unknown>;
            const extentSqY = pickStr(r.extentSqY, '');
            const valuePerSqY = pickStr(r.valuePerSqY, '');
            let total = pickStr(r.total, '');
            if (!total && extentSqY && valuePerSqY) {
              const ext = parseFloat(extentSqY.replace(/,/g, ''));
              const rate = parseFloat(valuePerSqY.replace(/,/g, ''));
              if (!Number.isNaN(ext) && !Number.isNaN(rate)) {
                total = Math.round(ext * rate).toLocaleString('en-IN');
              }
            }
            const rawLabel = pickStr(r.nearHNoLabel, 'Near H.No.');
            const nearHNoLabel: HouseNoLabelType =
              HOUSE_NO_LABEL_OPTIONS.includes(rawLabel as HouseNoLabelType)
                ? (rawLabel as HouseNoLabelType)
                : 'Near H.No.';
            return {
              id: `ai-row-${Date.now()}-${idx}`,
              syNo: pickStr(r.syNo, ''),
              plotNo: pickStr(r.plotNo, ''),
              extentSqY,
              wardBlockNo: '',
              nearHNoLabel,
              nearHNo: pickStr(r.nearHNo, ''),
              zone: pickStr(r.zone, ''),
              valuePerSqY,
              total,
            };
          })
        : emptyBase.rows;

    const extractedDate = normalizeDateToDDMMYYYY(pickStr(rawFields.date, ''));

    return {
      ...emptyBase,
      mobileNo: pickStr(rawFields.mobileNo, ''),
      village: pickStr(rawFields.village, ''),
      mandal: pickStr(rawFields.mandal, ''),
      district: pickStr(rawFields.district, ''),
      courtName: pickStr(rawFields.courtName, ''),
      rows,
      situatedLocality: pickStr(rawFields.situatedLocality, ''),
      situatedMandal: pickStr(
        rawFields.situatedMandal,
        pickStr(rawFields.mandal, '')
      ),
      situatedDistrict: pickStr(
        rawFields.situatedDistrict,
        pickStr(rawFields.district, '')
      ),
      plaintiffNameAddress: pickStr(rawFields.plaintiffNameAddress, '').toUpperCase(),
      plaintiffRelationType:
        rawFields.plaintiffRelationType === 'W/O' ||
        rawFields.plaintiffRelationType === 'D/O' ||
        rawFields.plaintiffRelationType === 'S/W/D/O'
          ? rawFields.plaintiffRelationType
          : 'S/O',
      plaintiffRelationLine: pickStr(
        rawFields.plaintiffRelationLine,
        ''
      ).toUpperCase(),
      plaintiffResidenceAddress: pickStr(
        rawFields.plaintiffResidenceAddress,
        ''
      ).toUpperCase(),
      applicantNameAddress: pickStr(rawFields.applicantNameAddress, '').toUpperCase(),
      place: pickStr(rawFields.place, ''),
      date: extractedDate || emptyBase.date,
    };
  };

  const buildMvHouseFromAi = (
    rawFields: Record<string, unknown>,
    emptyBase: MvHouseFormData
  ): MvHouseFormData => {
    const rawRows = Array.isArray(rawFields.rows) ? rawFields.rows : [];
    const rows =
      rawRows.length > 0
        ? rawRows.map((item, idx) => {
            const r = (item || {}) as Record<string, unknown>;
            return {
              id: `ai-hrow-${Date.now()}-${idx}`,
              syNo: pickStr(r.syNo, ''),
              plotNo: pickStr(r.plotNo, ''),
              extentSqY: pickStr(r.extentSqY, ''),
              wardBlockNo: '',
              bearingHNo: pickStr(r.bearingHNo, ''),
              rccSqFts: pickStr(r.rccSqFts, ''),
              tinshedSqFts: pickStr(r.tinshedSqFts, ''),
              bTilesSqFts: pickStr(r.bTilesSqFts, ''),
              customRoofLabel: pickStr(r.customRoofLabel, ''),
              customRoofSqFts: pickStr(r.customRoofSqFts, ''),
              total: pickStr(r.total, ''),
            };
          })
        : emptyBase.rows;

    const extractedDate = normalizeDateToDDMMYYYY(pickStr(rawFields.date, ''));

    return {
      ...emptyBase,
      mobileNo: pickStr(rawFields.mobileNo, ''),
      village: pickStr(rawFields.village, ''),
      mandal: pickStr(rawFields.mandal, ''),
      district: pickStr(rawFields.district, ''),
      courtName: pickStr(rawFields.courtName, ''),
      rows,
      situatedText: pickStr(rawFields.situatedText, ''),
      plaintiffNameAddress: pickStr(rawFields.plaintiffNameAddress, '').toUpperCase(),
      plaintiffRelationType:
        rawFields.plaintiffRelationType === 'W/O' ||
        rawFields.plaintiffRelationType === 'D/O' ||
        rawFields.plaintiffRelationType === 'S/W/D/O'
          ? rawFields.plaintiffRelationType
          : 'S/O',
      plaintiffRelationLine: pickStr(
        rawFields.plaintiffRelationLine,
        ''
      ).toUpperCase(),
      plaintiffResidenceAddress: pickStr(
        rawFields.plaintiffResidenceAddress,
        ''
      ).toUpperCase(),
      applicantNameAddress: pickStr(rawFields.applicantNameAddress, '').toUpperCase(),
      place: pickStr(rawFields.place, ''),
      date: extractedDate || emptyBase.date,
    };
  };

  const buildEcFromAi = (
    rawFields: Record<string, unknown>,
    emptyBase: EcFormData
  ): EcFormData => {
    const rawAgri = Array.isArray(rawFields.agriRows) ? rawFields.agriRows : [];
    const parsedAgriRows = rawAgri
      .map((item, idx) => {
        const r = (item || {}) as Record<string, unknown>;
        return {
          id: `ai-agri-${Date.now()}-${idx}`,
          syNo: pickStr(r.syNo, ''),
          extentAcGs: pickStr(r.extentAcGs, ''),
          classification: pickStr(r.classification, ''),
        };
      })
      .filter((r) => r.syNo || r.extentAcGs);

    const hasAgriData = Boolean(
      rawFields.includeAgriculturalLands === true ||
        pickStr(rawFields.agriVillage, '') ||
        pickStr(rawFields.agriMandal, '') ||
        parsedAgriRows.length > 0
    );

    const agriRows =
      parsedAgriRows.length > 0
        ? parsedAgriRows
        : [
            {
              id: `ai-agri-${Date.now()}-0`,
              syNo: '',
              extentAcGs: '',
              classification: '',
            },
          ];

    const rawLinks = Array.isArray(rawFields.linkDocuments)
      ? rawFields.linkDocuments
      : [];
    const fallbackDoctNo = pickStr(rawFields.doctNo, '');
    const fallbackDoctYear = pickStr(rawFields.doctYear, '');
    const linkDocuments =
      rawLinks.length > 0
        ? rawLinks
            .map((item, idx) => {
              const l = (item || {}) as Record<string, unknown>;
              return {
                id: `ai-link-${Date.now()}-${idx}`,
                doctNo: pickStr(l.doctNo, ''),
                doctYear: pickStr(l.doctYear, ''),
                description: '',
              };
            })
            .filter((d) => d.doctNo || d.doctYear)
        : fallbackDoctNo || fallbackDoctYear
        ? [
            {
              id: `ai-link-${Date.now()}-0`,
              doctNo: fallbackDoctNo,
              doctYear: fallbackDoctYear,
              description: '',
            },
          ]
        : emptyBase.linkDocuments;

    const finalLinks =
      linkDocuments.length > 0 ? linkDocuments : emptyBase.linkDocuments;
    const firstLink = finalLinks[0];
    const periodFrom = normalizeDateToDDMMYYYY(
      pickStr(rawFields.periodFrom, '')
    );
    const date =
      normalizeDateToDDMMYYYY(pickStr(rawFields.date, '')) || emptyBase.date;
    const rawPeriodTo = normalizeDateToDDMMYYYY(
      pickStr(rawFields.periodTo, '')
    );
    const periodTo =
      (rawPeriodTo && rawPeriodTo !== date ? rawPeriodTo : '') ||
      subtractOneDayDDMMYYYY(date) ||
      emptyBase.periodTo;

    const rawDoorNo = pickStr(rawFields.doorNo, '');
    const rawDoorNoType = pickStr(rawFields.doorNoType, '');
    let resolvedDoorNoType: '' | 'Near H.No.' | 'Adjacent H.No.' | 'Bearing H.No.' =
      rawDoorNoType === 'Near H.No.' ||
      rawDoorNoType === 'Adjacent H.No.' ||
      rawDoorNoType === 'Bearing H.No.'
        ? rawDoorNoType
        : '';
    if (!resolvedDoorNoType && rawDoorNo) {
      if (/\badjacent\b/i.test(rawDoorNo)) {
        resolvedDoorNoType = 'Adjacent H.No.';
      } else if (/\bbearing\b/i.test(rawDoorNo)) {
        resolvedDoorNoType = 'Bearing H.No.';
      } else if (/\bnear\b/i.test(rawDoorNo)) {
        resolvedDoorNoType = 'Near H.No.';
      }
    }
    const cleanDoorNo = rawDoorNo
      .replace(/^\s*(?:near|adjacent|open\s*place\s*bearing|bearing)\s*h\.?\s*no\.?\s*[:.-]*\s*/i, '')
      .replace(/\s*\(\s*(?:near|adjacent|bearing)\s*h\.?\s*no\.?\s*\)\s*/gi, ' ')
      .trim();

    return {
      ...emptyBase,
      mobileNo: pickStr(rawFields.mobileNo, ''),
      applicantName: pickStr(rawFields.applicantName, '').toUpperCase(),
      relationType:
        rawFields.relationType === 'W/O' ||
        rawFields.relationType === 'D/O' ||
        rawFields.relationType === 'S/W/D/O'
          ? rawFields.relationType
          : 'S/O',
      relationLine: pickStr(rawFields.relationLine, '').toUpperCase(),
      residenceAddress: pickStr(rawFields.residenceAddress, '').toUpperCase(),
      corporationTownVillage: pickStr(rawFields.corporationTownVillage, ''),
      mandal: pickStr(rawFields.mandal, ''),
      district: pickStr(rawFields.district, ''),
      doorNo: cleanDoorNo,
      doorNoType: resolvedDoorNoType,
      plotNo: pickStr(rawFields.plotNo, ''),
      surveyNo: pickStr(rawFields.surveyNo, ''),
      extentSqY: pickStr(rawFields.extentSqY, ''),
      locationName: pickStr(rawFields.locationName, ''),
      plinthAreaSqFt: pickStr(rawFields.plinthAreaSqFt, ''),
      apartmentName: pickStr(rawFields.apartmentName, ''),
      uds: pickStr(rawFields.uds, ''),
      includeAgriculturalLands: hasAgriData,
      agriVillage: hasAgriData ? pickStr(rawFields.agriVillage, '') : '',
      agriMandal: hasAgriData ? pickStr(rawFields.agriMandal, '') : '',
      agriDistrict: hasAgriData ? pickStr(rawFields.agriDistrict, '') : '',
      agriRows,
      doctNo: firstLink?.doctNo || fallbackDoctNo,
      doctYear: firstLink?.doctYear || fallbackDoctYear,
      linkDocuments: finalLinks,
      belongsTo: pickStr(rawFields.belongsTo, '').toUpperCase(),
      east: pickStr(rawFields.east, ''),
      west: pickStr(rawFields.west, ''),
      north: pickStr(rawFields.north, ''),
      south: pickStr(rawFields.south, ''),
      periodFrom,
      periodTo,
      date,
    };
  };

  const buildIndentFromAi = (
    rawFields: Record<string, unknown>,
    emptyBase: IndentFormData
  ): IndentFormData => {
    const rawCat = pickStr(rawFields.category, emptyBase.category);
    const matchedCat =
      STAMP_CATEGORIES.find(
        (c) =>
          c.code.toLowerCase() === rawCat.toLowerCase() ||
          c.label.toLowerCase() === rawCat.toLowerCase()
      )?.code || emptyBase.category;

    const extractedVal = pickStr(rawFields.valueOfStamps, '');
    const extractedQty = pickStr(rawFields.quantity, emptyBase.quantity);
    const valNum = parseFloat(extractedVal.replace(/,/g, ''));
    const qtyNum = parseFloat(extractedQty.replace(/,/g, ''));
    const computedTotal =
      !Number.isNaN(valNum) && !Number.isNaN(qtyNum)
        ? String(Math.round(valNum * qtyNum))
        : '';

    return {
      ...emptyBase,
      mobileNo: pickStr(rawFields.mobileNo, ''),
      category: matchedCat,
      valueOfStamps: extractedVal,
      quantity: extractedQty,
      totalAmount: computedTotal,
      purchaserDetails: pickStr(rawFields.purchaserDetails, '').toUpperCase(),
      purchaserRelationType:
        rawFields.purchaserRelationType === 'W/O' ||
        rawFields.purchaserRelationType === 'D/O' ||
        rawFields.purchaserRelationType === 'S/W/D/O'
          ? rawFields.purchaserRelationType
          : 'S/O',
      purchaserRelationLine: pickStr(
        rawFields.purchaserRelationLine,
        ''
      ).toUpperCase(),
      purchaserResidenceAddress: pickStr(
        rawFields.purchaserResidenceAddress,
        ''
      ).toUpperCase(),
      forWhomDetails: pickStr(
        rawFields.forWhomDetails,
        emptyBase.forWhomDetails
      ).toUpperCase(),
      dated: emptyBase.dated,
      indentNo: pickStr(rawFields.indentNo, ''),
    };
  };

  const handleAiExtracted = (
    detectedType: FormType,
    rawFields: Record<string, unknown>,
    summary: string,
    fileName: string
  ) => {
    const empty = getEmptyFormsState();
    setActiveRecordId(null);
    setHasPreviewed(false);
    setIsSaveInlineOpen(false);
    setActiveForm(detectedType);
    if (detectedType === 'mvOpen' || detectedType === 'mvHouse') {
      setMvMode(detectedType);
    }

    setFormsState((prev) => {
      if (detectedType === 'ccCopy') {
        return { ...prev, ccCopy: buildCcCopyFromAi(rawFields, empty.ccCopy) };
      }
      if (detectedType === 'mvOpen') {
        return { ...prev, mvOpen: buildMvOpenFromAi(rawFields, empty.mvOpen) };
      }
      if (detectedType === 'mvHouse') {
        return { ...prev, mvHouse: buildMvHouseFromAi(rawFields, empty.mvHouse) };
      }
      if (detectedType === 'ec') {
        return { ...prev, ec: buildEcFromAi(rawFields, empty.ec) };
      }
      return { ...prev, indent: buildIndentFromAi(rawFields, empty.indent) };
    });

    setIsUploadPanelOpen(false);
    showToast(`${summary} from "${fileName}"`);
  };

  const handleAiExtractedAllA4 = (
    payload: AllA4ExtractedPayload,
    summary: string,
    fileName: string
  ) => {
    const empty = getEmptyFormsState();
    const blankMvHouse: MvHouseFormData = {
      ...empty.mvHouse,
      district: '',
      courtName: '',
      situatedText: '',
      place: '',
    };
    const blankMvOpen: MvOpenFormData = {
      ...empty.mvOpen,
      district: '',
      courtName: '',
      situatedDistrict: '',
      place: '',
    };

    setActiveRecordId(null);
    setHasPreviewed(false);
    setIsSaveInlineOpen(false);
    setMvMode(payload.marketValueMode);
    if (
      activeForm === 'mvOpen' ||
      activeForm === 'mvHouse' ||
      activeForm === 'indent'
    ) {
      setActiveForm(
        activeForm === 'indent' ? 'ccCopy' : payload.marketValueMode
      );
    }

    setFormsState((prev) => ({
      ...prev,
      ccCopy: buildCcCopyFromAi(payload.forms.ccCopy, empty.ccCopy),
      mvOpen:
        payload.marketValueMode === 'mvOpen'
          ? buildMvOpenFromAi(payload.forms.mvOpen, empty.mvOpen)
          : blankMvOpen,
      mvHouse:
        payload.marketValueMode === 'mvHouse'
          ? buildMvHouseFromAi(payload.forms.mvHouse, empty.mvHouse)
          : blankMvHouse,
      ec: buildEcFromAi(payload.forms.ec, empty.ec),
    }));

    setIsUploadPanelOpen(false);
    showToast(`${summary} from "${fileName}"`);
  };

  const activeMeta = FORM_TABS.find((t) => t.id === activeForm)!;

  const renderSaveInlinePanel = () => (
    <form
      ref={savePanelRef}
      onSubmit={(e) => handleSaveApplication(e, false)}
      className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3"
    >
      <div className="text-xs font-semibold text-slate-800">
        Save Entry &amp; Status to Localhost
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-slate-600">
            Reference Title
          </span>
          <input
            type="text"
            value={saveFormDraft.title}
            onChange={(e) =>
              setSaveFormDraft((d) => ({ ...d, title: e.target.value }))
            }
            placeholder="Applicant or Doc No."
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-slate-600">Status</span>
          <select
            value={saveFormDraft.status}
            onChange={(e) =>
              setSaveFormDraft((d) => ({
                ...d,
                status: e.target.value as RecordStatus,
              }))
            }
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          >
            <option value="pending">Pending</option>
            <option value="complete">Complete</option>
            <option value="due">Due</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-slate-600">Due Date</span>
          <input
            type="date"
            value={saveFormDraft.dueDate}
            onChange={(e) =>
              setSaveFormDraft((d) => ({ ...d, dueDate: e.target.value }))
            }
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-slate-600">Fee (Rs.)</span>
          <input
            type="text"
            value={saveFormDraft.feeAmount}
            onChange={(e) =>
              setSaveFormDraft((d) => ({
                ...d,
                feeAmount: e.target.value,
              }))
            }
            placeholder="e.g. 500"
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-slate-600">Paid (Rs.)</span>
          <input
            type="text"
            value={saveFormDraft.paidAmount}
            onChange={(e) =>
              setSaveFormDraft((d) => ({
                ...d,
                paidAmount: e.target.value,
              }))
            }
            placeholder="e.g. 200"
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-slate-600">
          Notes / Remarks (Optional)
        </span>
        <input
          type="text"
          value={saveFormDraft.notes}
          onChange={(e) =>
            setSaveFormDraft((d) => ({ ...d, notes: e.target.value }))
          }
          placeholder="e.g. Balance Rs.300 due on delivery"
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setIsSaveInlineOpen(false)}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        {activeRecordId && (
          <button
            type="button"
            disabled={isSavingRecord}
            onClick={(e) => handleSaveApplication(e, true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Save as New
          </button>
        )}
        <button
          type="submit"
          disabled={isSavingRecord}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isSavingRecord
            ? 'Saving...'
            : activeRecordId
            ? 'Update Entry'
            : 'Confirm Save'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 3-Zone Top Bar Contract */}
      <header className="no-print lg:sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
        <div className="flex items-center gap-3">
          {workspaceView === 'report' ? (
            <button type="button" onClick={() => setWorkspaceView('builder')} className="applications-back">
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          ) : (
            <a href="/" className="applications-back">
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </a>
          )}
          <span className="font-display text-lg font-bold tracking-tight">CARD Forms Studio</span>
        </div>

        <nav
          aria-label="Primary Navigation"
          className="order-last w-full lg:order-none lg:w-auto flex overflow-x-auto items-center gap-4 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => setWorkspaceView('builder')}
            className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              workspaceView === 'builder'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Form Builder
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceView('report')}
            className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              workspaceView === 'report'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Status Report ({savedRecords.length})
          </button>

          <button
            type="button"
            onClick={() => setIsSavedModalOpen(true)}
            className="inline-block py-5 border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            Saved Entries
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {workspaceView === 'report' && (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Report
            </button>
          )}
        </div>
      </header>

      {workspaceView === 'report' ? (
        <StatusReportView
          records={savedRecords}
          isLoading={recordsLoading}
          error={recordsError}
          onRetry={fetchRecords}
          onUpdateRecord={handleUpdateRecord}
          onDeleteRecord={handleDeleteRecord}
          onClearAllRecords={handleClearAllRecords}
          onOpenInBuilder={handleLoadSaved}
        />
      ) : (
        <>
          {/* Form Template Selector Strip */}
          <div className="no-print bg-white border-b border-slate-200 px-6 py-2.5 overflow-x-auto">
            <div className="flex items-center gap-1.5 min-w-max">
              {(
                [
                  { id: 'ccCopy', label: 'Certified Copy' },
                  { id: 'marketValue', label: 'Market Value' },
                  { id: 'ec', label: 'EC Application' },
                  { id: 'indent', label: 'Stamp Indent' },
                ] as const
              ).map((tab) => {
                const isMv = activeForm === 'mvOpen' || activeForm === 'mvHouse';
                const isActive =
                  tab.id === 'marketValue' ? isMv : tab.id === activeForm;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveForm(tab.id === 'marketValue' ? mvMode : tab.id);
                      setActiveRecordId(null);
                      setHasPreviewed(false);
                      setIsSaveInlineOpen(false);
                    }}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Workspace */}
          <main className="flex-1 px-4 sm:px-6 py-6">
            {/* Fillable Form Editor */}
            <section
              aria-label="Form Input Editor"
              className="no-print max-w-4xl mx-auto w-full bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden"
            >
              {/* Context Title & Quick Actions */}
              <div className="px-6 py-5 border-b border-slate-200 space-y-3.5">
                <div>
                  <h1 className="text-base font-semibold text-slate-900">
                    {activeMeta.fullTitle}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">{activeMeta.subtitle}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadPanelOpen((v) => !v);
                      setIsSaveInlineOpen(false);
                    }}
                    className={`inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 text-base font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 ${
                      isUploadPanelOpen
                        ? 'bg-slate-900 text-white ring-2 ring-slate-900/20'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <FileUp className="h-5 w-5" />
                    <span>Upload &amp; AI Fill</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadPanelOpen(false);
                      setIsSaveInlineOpen(false);
                      setIsSavedDeedPickerOpen(true);
                    }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-2"
                  >
                    <FolderOpen size={18} aria-hidden="true" /> Fill from Saved Deed
                  </button>

                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                    Clear Blank
                  </button>
                </div>

                {isUploadPanelOpen && (
                  <AiUploadPanel
                    activeForm={activeForm}
                    activeFormLabel={activeMeta.navLabel}
                    onExtracted={handleAiExtracted}
                    onExtractedAllA4={handleAiExtractedAllA4}
                    onClose={() => setIsUploadPanelOpen(false)}
                  />
                )}
              </div>

              {/* Form Fields */}
              <div className="p-6 flex-1">
                {activeForm === 'ccCopy' && (
                  <CcCopyEditor
                    data={formsState.ccCopy}
                    onChange={(ccCopy) => setFormsState((prev) => ({ ...prev, ccCopy }))}
                  />
                )}
                {(activeForm === 'mvOpen' || activeForm === 'mvHouse') && (
                  <MarketValueEditor
                    mode={activeForm}
                    onModeChange={(nextMode) => {
                      if (nextMode !== activeForm) {
                        setActiveRecordId(null);
                        setHasPreviewed(false);
                        setIsSaveInlineOpen(false);
                      }
                      setMvMode(nextMode);
                      setActiveForm(nextMode);
                    }}
                    mvOpen={formsState.mvOpen}
                    mvHouse={formsState.mvHouse}
                    onChangeOpen={(mvOpen) =>
                      setFormsState((prev) => ({ ...prev, mvOpen }))
                    }
                    onChangeHouse={(mvHouse) =>
                      setFormsState((prev) => ({ ...prev, mvHouse }))
                    }
                  />
                )}
                {activeForm === 'ec' && (
                  <EcEditor
                    data={formsState.ec}
                    onChange={(ec) => setFormsState((prev) => ({ ...prev, ec }))}
                  />
                )}
                {activeForm === 'indent' && (
                  <IndentEditor
                    data={formsState.indent}
                    onChange={(indent) => setFormsState((prev) => ({ ...prev, indent }))}
                  />
                )}
              </div>

              {/* Bottom Form Actions: Print Preview first; Save & Print unlock after Print Preview */}
              <div className="border-t border-slate-200 bg-slate-50/90 px-6 py-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setHasPreviewed(true);
                      setIsSaveInlineOpen(false);
                      setIsPrintPreviewOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Print Preview</span>
                  </button>
                  {hasPreviewed && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (isSaveInlineOpen) {
                            setIsSaveInlineOpen(false);
                            return;
                          }
                          handleOpenSaveInline();
                          setIsUploadPanelOpen(false);
                          window.setTimeout(() => {
                            savePanelRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }, 40);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          isSaveInlineOpen
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{activeRecordId ? 'Update Save' : 'Save'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print</span>
                      </button>
                    </>
                  )}
                </div>

                {hasPreviewed && !isPrintPreviewOpen && isSaveInlineOpen && renderSaveInlinePanel()}

                {feedbackMessage && !isPrintPreviewOpen && (
                  <div
                    role="status"
                    className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span>{feedbackMessage}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Hidden on screen; rendered only for browser printing (preview opens via Print Preview button) */}
            <section
              aria-label="Print-Only A4 Document Container"
              className="hidden print-only-container"
            >
              <div className="print-only-container">
                <div className="print-single-sheet print-scale-reset">
                  <div className="print-scale-reset bg-white">
                    {activeForm === 'ccCopy' && <CcCopySheet data={formsState.ccCopy} />}
                    {activeForm === 'mvOpen' && <MvOpenSheet data={formsState.mvOpen} />}
                    {activeForm === 'mvHouse' && (
                      <MvHouseSheet data={formsState.mvHouse} />
                    )}
                    {activeForm === 'ec' && <EcSheet data={formsState.ec} />}
                    {activeForm === 'indent' && <IndentSheet data={formsState.indent} />}
                  </div>
                </div>

                {/* Batch Print Output: 3 A4 Forms (Excludes Stamp Indent) */}
                <div className="print-batch-sheets">
                  <div className="print-batch-page">
                    <CcCopySheet data={formsState.ccCopy} />
                  </div>
                  <div className="print-batch-page">
                    {mvMode === 'mvHouse' ? (
                      <MvHouseSheet data={formsState.mvHouse} />
                    ) : (
                      <MvOpenSheet data={formsState.mvOpen} />
                    )}
                  </div>
                  <div className="print-batch-page">
                    <EcSheet data={formsState.ec} />
                  </div>
                </div>
              </div>
            </section>
          </main>
        </>
      )}

      {isPrintPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Print Preview"
          className="no-print fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-[1px] flex flex-col"
        >
          <div className="bg-white border-b border-slate-200 px-6 py-3 space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Print Preview — {activeMeta.navLabel}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {activeForm === 'indent'
                    ? 'Half A4 Slip (210 × 148.5 mm)'
                    : 'A4 Sheet (210 × 297 mm)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isSaveInlineOpen) {
                      setIsSaveInlineOpen(false);
                      return;
                    }
                    handleOpenSaveInline();
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isSaveInlineOpen
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{activeRecordId ? 'Update Save' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintPreviewOpen(false);
                    setIsSaveInlineOpen(false);
                  }}
                  aria-label="Back from print preview"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  <span>Back</span>
                </button>
              </div>
            </div>

            {isSaveInlineOpen && (
              <div className="max-w-3xl ml-auto max-h-[55vh] overflow-y-auto">
                {renderSaveInlinePanel()}
              </div>
            )}

            {feedbackMessage && (
              <div
                role="status"
                className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2"
              >
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
            )}
          </div>
          <div
            className="flex-1 overflow-auto p-6 flex justify-center items-start"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsPrintPreviewOpen(false);
                setIsSaveInlineOpen(false);
              }
            }}
          >
            <div className="bg-white shadow-2xl border border-slate-300">
              {activeForm === 'ccCopy' && <CcCopySheet data={formsState.ccCopy} />}
              {activeForm === 'mvOpen' && <MvOpenSheet data={formsState.mvOpen} />}
              {activeForm === 'mvHouse' && (
                <MvHouseSheet data={formsState.mvHouse} />
              )}
              {activeForm === 'ec' && <EcSheet data={formsState.ec} />}
              {activeForm === 'indent' && <IndentSheet data={formsState.indent} />}
            </div>
          </div>
        </div>
      )}

      {isSavedDeedPickerOpen && (
        <SavedDeedPicker
          formLabel={activeMeta.navLabel}
          onClose={() => setIsSavedDeedPickerOpen(false)}
          onFill={(deed, scheduleId) => {
            setFormsState(current => fillApplicationFromDeed(current, activeForm, deed, scheduleId));
            setHasPreviewed(false);
            setIsSavedDeedPickerOpen(false);
            showToast('Filled from "' + deed.title + '". Review the form details.');
          }}
        />
      )}
      <SavedRecordsModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        records={savedRecords}
        onLoad={handleLoadSaved}
        onDelete={handleDeleteRecord}
        onClearAll={handleClearAllRecords}
        onOpenReports={() => setWorkspaceView('report')}
      />
    </div>
  );
}
