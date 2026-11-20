import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  FileDown,
  FileSpreadsheet,
  FileUp,
  FolderOpen,
  Printer,
  RotateCcw,
  Save,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AiUploadPanel } from './components/AiUploadPanel';
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
import { SavedRecordsModal } from './components/SavedRecordsModal';
import { StatusReportView } from './components/StatusReportView';
import { clearSavedApplications, createSavedApplication, deleteSavedApplication, listSavedApplications, updateSavedApplication } from './saved-records';
import {
  AllFormsState,
  extractRecordMeta,
  FormType,
  getEmptyFormsState,
  getSampleFormsState,
  normalizeDateToDDMMYYYY,
  RecordStatus,
  SavedRecord,
  STAMP_CATEGORIES,
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
    fullTitle: 'Annexure-I — Market Value Certificate (Open Plot / House Site)',
    subtitle: 'Application for market value certificate of open plot involved in a suit',
  },
  {
    id: 'mvHouse',
    navLabel: 'MV House',
    fullTitle: 'Annexure-I — Market Value Certificate (House & Plinth Area)',
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
  const [zoomMode, setZoomMode] = useState<'fit' | 0.75 | 0.9 | 1>('fit');
  const [fitScale, setFitScale] = useState(0.78);
  const previewWrapperRef = useRef<HTMLDivElement | null>(null);

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      setSavedRecords(await listSavedApplications());
    } catch (err) {
      setRecordsError(
        err instanceof Error ? err.message : 'Unable to open saved applications in this browser'
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

  // Compute responsive fit scale for 210mm (~794px) A4 sheet inside preview pane
  useEffect(() => {
    const computeScale = () => {
      if (!previewWrapperRef.current) return;
      const availableWidth = previewWrapperRef.current.clientWidth - 48;
      const a4WidthPx = 794;
      if (availableWidth <= 0) return;
      const next = Math.min(1, availableWidth / a4WidthPx);
      setFitScale(next);
    };

    computeScale();
    const observer = new ResizeObserver(computeScale);
    if (previewWrapperRef.current) {
      observer.observe(previewWrapperRef.current);
    }
    window.addEventListener('resize', computeScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computeScale);
    };
  }, [workspaceView]);

  const showToast = (msg: string) => {
    setFeedbackMessage(msg);
    window.setTimeout(() => {
      setFeedbackMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  const handlePrint = () => {
    document.body.classList.remove('printing-all-a4');
    window.print();
  };

  const handleSavePdf = () => {
    document.body.classList.remove('printing-all-a4');
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
  };

  const handlePrintAllA4Forms = () => {
    document.body.classList.add('printing-all-a4');
    const cleanup = () => {
      document.body.classList.remove('printing-all-a4');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    window.setTimeout(cleanup, 2000);
  };

  const handleLoadSample = () => {
    const sample = getSampleFormsState();
    setIsUploadPanelOpen(false);
    setIsSaveInlineOpen(false);
    setActiveRecordId(null);
    setFormsState((prev) => ({
      ...prev,
      [activeForm]: sample[activeForm],
    }));
    showToast('Loaded sample values for this form');
  };

  const handleClearForm = () => {
    const empty = getEmptyFormsState();
    setIsUploadPanelOpen(false);
    setIsSaveInlineOpen(false);
    setActiveRecordId(null);
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

      const updateId = asNew ? null : activeRecordId;
      const record = updateId
        ? await updateSavedApplication(updateId, payload)
        : await createSavedApplication(payload);
      setActiveRecordId(record.id);
      setIsSaveInlineOpen(false);
      await fetchRecords();
      showToast(
        updateId
          ? `Updated "${record.title}" (${record.status.toUpperCase()})`
          : `Saved "${record.title}" in this browser`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not save the application in this browser'
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
    try {
      await updateSavedApplication(id, patch);
      await fetchRecords();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update the saved application');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteSavedApplication(id);
      setActiveRecordId(current => current === id ? null : current);
      await fetchRecords();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete the saved application');
    }
  };

  const handleClearAllRecords = async () => {
    try {
      await clearSavedApplications();
      setActiveRecordId(null);
      await fetchRecords();
      showToast('Removed all saved entries');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not clear saved applications');
    }
  };

  const handleLoadSaved = (record: SavedRecord) => {
    setIsUploadPanelOpen(false);
    setIsSaveInlineOpen(false);
    setWorkspaceView('builder');
    setActiveForm(record.formType);
    if (record.formType === 'mvOpen' || record.formType === 'mvHouse') {
      setMvMode(record.formType);
    }
    setActiveRecordId(record.id);
    setFormsState((prev) => ({
      ...prev,
      [record.formType]: record.data,
    }));
    showToast(`Loaded "${record.title}"`);
  };

  const handleAiExtracted = (
    detectedType: FormType,
    rawFields: Record<string, unknown>,
    summary: string,
    fileName: string
  ) => {
    const empty = getEmptyFormsState();
    const pickStr = (val: unknown, fallback: string) =>
      typeof val === 'string' && val.trim() ? val.trim() : fallback;

    setActiveRecordId(null);
    setActiveForm(detectedType);
    if (detectedType === 'mvOpen' || detectedType === 'mvHouse') {
      setMvMode(detectedType);
    }

    setFormsState((prev) => {
      if (detectedType === 'ccCopy') {
        const base = empty.ccCopy;
        const appMode =
          rawFields.applicationType === 'PERSONAL SEARCH'
            ? 'PERSONAL SEARCH'
            : 'CERTIFIED COPY';
        return {
          ...prev,
          ccCopy: {
            ...base,
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
            toOffice: pickStr(rawFields.toOffice, base.toOffice)
              .replace(/\.$/, '')
              .trim()
              .toUpperCase(),
            descriptionOfDocument: pickStr(rawFields.descriptionOfDocument, ''),
            documentNo: pickStr(
              rawFields.documentNo,
              rawFields.doctNo && rawFields.year
                ? `${String(rawFields.doctNo).trim()}/${String(rawFields.year).trim()}`
                : pickStr(rawFields.doctNo, '')
            ),
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
            searchYear: pickStr(rawFields.searchYear, ''),
            bookNo: pickStr(rawFields.bookNo, base.bookNo),
            volNo: pickStr(rawFields.volNo, ''),
            pageFrom: pickStr(rawFields.pageFrom, ''),
            pageTo: pickStr(rawFields.pageTo, base.pageTo),
            doctNo: pickStr(rawFields.doctNo, ''),
            year: pickStr(rawFields.year, ''),
          },
        };
      }

      if (detectedType === 'mvOpen') {
        const base = empty.mvOpen;
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
                return {
                  id: `ai-row-${Date.now()}-${idx}`,
                  syNo: pickStr(r.syNo, ''),
                  plotNo: pickStr(r.plotNo, ''),
                  extentSqY,
                  wardBlockNo: pickStr(r.wardBlockNo, ''),
                  nearHNo: pickStr(r.nearHNo, ''),
                  zone: pickStr(r.zone, ''),
                  valuePerSqY,
                  total,
                };
              })
            : base.rows;

        return {
          ...prev,
          mvOpen: {
            ...base,
            mobileNo: pickStr(rawFields.mobileNo, ''),
            village: pickStr(rawFields.village, ''),
            mandal: pickStr(rawFields.mandal, ''),
            district: pickStr(rawFields.district, base.district),
            courtName: pickStr(rawFields.courtName, base.courtName),
            rows,
            situatedLocality: pickStr(
              rawFields.situatedLocality,
              pickStr(rawFields.village, '')
            ),
            situatedMandal: pickStr(
              rawFields.situatedMandal,
              pickStr(rawFields.mandal, '')
            ),
            situatedDistrict: pickStr(rawFields.situatedDistrict, base.situatedDistrict),
            plaintiffNameAddress: pickStr(rawFields.plaintiffNameAddress, ''),
            applicantNameAddress: pickStr(rawFields.applicantNameAddress, ''),
            place: pickStr(rawFields.place, base.place),
            date: pickStr(rawFields.date, base.date),
          },
        };
      }

      if (detectedType === 'mvHouse') {
        const base = empty.mvHouse;
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
                  wardBlockNo: pickStr(r.wardBlockNo, ''),
                  bearingHNo: pickStr(r.bearingHNo, ''),
                  rccSqFts: pickStr(r.rccSqFts, ''),
                  tinshedSqFts: pickStr(r.tinshedSqFts, ''),
                  bTilesSqFts: pickStr(r.bTilesSqFts, ''),
                  customRoofLabel: pickStr(r.customRoofLabel, ''),
                  customRoofSqFts: pickStr(r.customRoofSqFts, ''),
                  total: pickStr(r.total, ''),
                };
              })
            : base.rows;

        return {
          ...prev,
          mvHouse: {
            ...base,
            mobileNo: pickStr(rawFields.mobileNo, ''),
            village: pickStr(rawFields.village, ''),
            mandal: pickStr(rawFields.mandal, ''),
            district: pickStr(rawFields.district, base.district),
            courtName: pickStr(rawFields.courtName, base.courtName),
            rows,
            situatedText: pickStr(rawFields.situatedText, base.situatedText),
            plaintiffNameAddress: pickStr(rawFields.plaintiffNameAddress, ''),
            applicantNameAddress: pickStr(rawFields.applicantNameAddress, ''),
            place: pickStr(rawFields.place, base.place),
            date: pickStr(rawFields.date, base.date),
          },
        };
      }

      if (detectedType === 'ec') {
        const base = empty.ec;
        const rawAgri = Array.isArray(rawFields.agriRows) ? rawFields.agriRows : [];
        const agriRows =
          rawAgri.length > 0
            ? rawAgri.map((item, idx) => {
                const r = (item || {}) as Record<string, unknown>;
                return {
                  id: `ai-agri-${Date.now()}-${idx}`,
                  syNo: pickStr(r.syNo, ''),
                  extentAcGs: pickStr(r.extentAcGs, ''),
                  classification: pickStr(r.classification, 'Wet'),
                };
              })
            : base.agriRows;

        const rawLinks = Array.isArray(rawFields.linkDocuments)
          ? rawFields.linkDocuments
          : [];
        const fallbackDoctNo = pickStr(rawFields.doctNo, '');
        const fallbackDoctYear = pickStr(rawFields.doctYear, '');
        const linkDocuments =
          rawLinks.length > 0
            ? rawLinks.map((item, idx) => {
                const l = (item || {}) as Record<string, unknown>;
                return {
                  id: `ai-link-${Date.now()}-${idx}`,
                  doctNo: pickStr(l.doctNo, ''),
                  doctYear: pickStr(l.doctYear, ''),
                  description: '',
                };
              })
            : fallbackDoctNo || fallbackDoctYear
            ? [
                {
                  id: `ai-link-${Date.now()}-0`,
                  doctNo: fallbackDoctNo,
                  doctYear: fallbackDoctYear,
                  description: '',
                },
              ]
            : base.linkDocuments;

        const firstLink = linkDocuments[0];

        return {
          ...prev,
          ec: {
            ...base,
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
            district: pickStr(rawFields.district, base.district),
            doorNo: pickStr(rawFields.doorNo, ''),
            plotNo: pickStr(rawFields.plotNo, ''),
            surveyNo: pickStr(rawFields.surveyNo, ''),
            extentSqY: pickStr(rawFields.extentSqY, ''),
            locationName: pickStr(rawFields.locationName, ''),
            plinthAreaSqFt: pickStr(rawFields.plinthAreaSqFt, ''),
            apartmentName: pickStr(rawFields.apartmentName, ''),
            uds: pickStr(rawFields.uds, ''),
            includeAgriculturalLands: Boolean(
              pickStr(rawFields.agriVillage, '') ||
                pickStr(rawFields.agriMandal, '') ||
                agriRows.some((r) => r.syNo.trim() || r.extentAcGs.trim())
            ),
            agriVillage: pickStr(rawFields.agriVillage, ''),
            agriMandal: pickStr(rawFields.agriMandal, ''),
            agriDistrict: pickStr(rawFields.agriDistrict, base.agriDistrict),
            agriRows,
            doctNo: firstLink?.doctNo || fallbackDoctNo,
            doctYear: firstLink?.doctYear || fallbackDoctYear,
            linkDocuments,
            belongsTo: pickStr(rawFields.belongsTo, base.belongsTo).toUpperCase(),
            east: pickStr(rawFields.east, ''),
            west: pickStr(rawFields.west, ''),
            north: pickStr(rawFields.north, ''),
            south: pickStr(rawFields.south, ''),
            periodFrom: pickStr(rawFields.periodFrom, ''),
            periodTo: pickStr(rawFields.periodTo, base.periodTo),
          },
        };
      }

      // indent
      const base = empty.indent;
      const rawCat = pickStr(rawFields.category, base.category);
      const matchedCat =
        STAMP_CATEGORIES.find(
          (c) =>
            c.code.toLowerCase() === rawCat.toLowerCase() ||
            c.label.toLowerCase() === rawCat.toLowerCase()
        )?.code || base.category;

      const extractedVal = pickStr(rawFields.valueOfStamps, '');
      const extractedQty = pickStr(rawFields.quantity, base.quantity);
      const valNum = parseFloat(extractedVal.replace(/,/g, ''));
      const qtyNum = parseFloat(extractedQty.replace(/,/g, ''));
      const computedTotal =
        !Number.isNaN(valNum) && !Number.isNaN(qtyNum)
          ? String(Math.round(valNum * qtyNum))
          : '';

      return {
        ...prev,
        indent: {
          ...base,
          mobileNo: pickStr(rawFields.mobileNo, ''),
          category: matchedCat,
          valueOfStamps: extractedVal,
          quantity: extractedQty,
          totalAmount: computedTotal,
          purchaserDetails: pickStr(rawFields.purchaserDetails, '').toUpperCase(),
          forWhomDetails: pickStr(rawFields.forWhomDetails, base.forWhomDetails).toUpperCase(),
          dated: pickStr(rawFields.dated, base.dated),
          indentNo: pickStr(rawFields.indentNo, ''),
        },
      };
    });

    setIsUploadPanelOpen(false);
    showToast(`${summary} from "${fileName}"`);
  };

  const activeMeta = FORM_TABS.find((t) => t.id === activeForm)!;
  const activeScale = zoomMode === 'fit' ? fitScale : zoomMode;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="no-print lg:sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
        <a
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-900 hover:text-slate-600 focus-visible:outline-2"
        >
          <ArrowLeft aria-hidden="true" size={16} /> Draft options
        </a>

        <nav
          aria-label="Primary Navigation"
          className="order-last w-full lg:order-none lg:w-auto flex overflow-x-auto items-center gap-4 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => setWorkspaceView('builder')}
            className={`py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
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
            className={`py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
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
            className="py-3 border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            Saved Entries
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {workspaceView === 'report' ? (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Report
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  handleOpenSaveInline();
                  setIsUploadPanelOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{activeRecordId ? 'Update Save' : 'Save'}</span>
              </button>
              <button
                type="button"
                onClick={handleSavePdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Save PDF</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </button>
            </>
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
                      setIsSaveInlineOpen(false);
                      setIsUploadPanelOpen(false);
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

          {/* Main Split Workspace */}
          <main className="flex-1 flex flex-col lg:flex-row">
            {/* Left Pane: Fillable Form Editor */}
            <section
              aria-label="Form Input Editor"
              className="no-print w-full lg:w-[500px] xl:w-[560px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col"
            >
              {/* Context Title & Quick Actions */}
              <div className="px-6 py-5 border-b border-slate-200 space-y-3.5">
                <div>
                  <h1 className="text-base font-semibold text-slate-900">
                    {activeMeta.fullTitle}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">{activeMeta.subtitle}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadPanelOpen((v) => !v);
                      setIsSaveInlineOpen(false);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isUploadPanelOpen
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    Upload &amp; AI Fill
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                    Load Sample
                  </button>

                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                    Clear Blank
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleOpenSaveInline();
                      setIsUploadPanelOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    {activeRecordId ? 'Update / Save Status' : 'Save Application'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSavedModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-slate-500" />
                    <span>Saved ({savedRecords.length})</span>
                  </button>
                </div>

                {isUploadPanelOpen && (
                  <AiUploadPanel
                    activeForm={activeForm}
                    activeFormLabel={activeMeta.navLabel}
                    onExtracted={handleAiExtracted}
                    onClose={() => setIsUploadPanelOpen(false)}
                  />
                )}

                {isSaveInlineOpen && (
                  <form
                    onSubmit={(e) => handleSaveApplication(e)}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-3"
                  >
                    <div className="text-xs font-semibold text-slate-800">
                      Save entry and status in this browser
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
                        <span className="text-[11px] font-medium text-slate-600">
                          Status
                        </span>
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
                        <span className="text-[11px] font-medium text-slate-600">
                          Due Date
                        </span>
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
                        <span className="text-[11px] font-medium text-slate-600">
                          Fee (Rs.)
                        </span>
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
                        <span className="text-[11px] font-medium text-slate-600">
                          Paid (Rs.)
                        </span>
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

              {/* Scrollable Form Fields */}
              <div className="p-6 flex-1 lg:overflow-y-auto lg:max-h-[calc(100vh-17rem)]">
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
                      setMvMode(nextMode);
                      setActiveForm(nextMode);
                      setIsUploadPanelOpen(false);
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
            </section>

            {/* Right Pane: Live A4 Print-Ready Preview */}
            <section
              aria-label="Print-Ready A4 Document Preview"
              className="print-only-container flex-1 bg-slate-100 flex flex-col min-w-0"
            >
              {/* Preview Toolbar */}
              <div className="no-print px-6 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                  <span className="font-medium text-slate-800">
                    {activeForm === 'indent'
                      ? 'Half A4 Slip Preview'
                      : 'A4 Fit Print Preview'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {activeForm === 'indent' ? '210 × 148.5 mm' : '210 × 297 mm'}
                  </span>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintAllA4Forms}
                    title="Print Certified Copy, Market Value (selected type), and EC Application fitted to 3 A4 pages (excludes Stamp Indent)"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print All A4 Forms
                  </button>

                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setZoomMode('fit')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        zoomMode === 'fit'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Fit ({Math.round(fitScale * 100)}%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomMode(0.75)}
                      aria-label="Zoom 75%"
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        zoomMode === 0.75
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ZoomOut className="h-3 w-3" />
                      75%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomMode(1)}
                      aria-label="Zoom 100%"
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        zoomMode === 1
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ZoomIn className="h-3 w-3" />
                      100%
                    </button>
                  </div>
                </div>
              </div>

              {/* Paper Canvas */}
              <div
                ref={previewWrapperRef}
                className="print-only-container min-w-0 flex-1 overflow-auto p-6 flex items-start"
              >
                <div
                  className="print-single-sheet print-scale-reset mx-auto flex-none"
                  style={{ width: '210mm', zoom: activeScale }}
                >
                  <div className="print-scale-reset bg-white shadow-md border border-slate-300">
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
