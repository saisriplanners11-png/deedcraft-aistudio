import React, { useState, useEffect } from 'react';
import { PlanDocument } from '../types';
import { planStorageService } from '../services/planStorageService';
import { 
  FolderOpen, Plus, Trash2, Download, Upload, Check, Bookmark, Save, Search, 
  Sparkles, Clock, MapPin, Layers, Copy, ArrowUpDown, Database, FileText, CheckCircle2 
} from 'lucide-react';

interface SavedPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPlan: (plan: PlanDocument) => void;
  currentPlan: PlanDocument;
  initialTab?: 'saved' | 'templates';
  onSaveCurrentPlan?: (options?: { asNewCopy?: boolean; customTitle?: string }) => void;
}

export const SAMPLE_TEMPLATES: PlanDocument[] = [
  {
    id: 'sample-sircilla-house-572',
    title: 'B. SRINIVAS (Claimant) - House (572.00 Sq.Yds - H.No. 6-5-48/2, Sy.No. 508/B, Sircilla)',
    createdAt: '2026-09-15',
    updatedAt: '2026-09-15',
    property: {
      propertyType: 'House',
      areaSqYards: 572.00,
      areaSqMtrs: 478.24,
      surveyNo: '508/B',
      plotNo: '20',
      houseNo: '6-5-48/2',
      houseAuthority: 'Municipal Council House No.',
      nearHNo: 'bearing Municipal Council House No.6-5-48/2',
      locality: 'Vidyanagar/ Renukanagar',
      village: 'Sircilla',
      mandal: 'Sircilla',
      district: 'Rajanna Sircilla',
      house: {
        enabled: true,
        widthFeet: 28,
        lengthFeet: 41.85,
        widthRaw: "28'-0\"",
        lengthRaw: "41'-10\"",
        structureType: 'R.C.C. Building',
        roofType: 'R.C.C. Slab',
        plinthPrefix: 'R.C.C.',
        plinthAreaSqFt: 1172.00,
        plinthAreaSqYds: 130.22,
        showMeasurements: true,
        showSetbacks: true,
        setbackNorth: "12'-0\"",
        setbackSouth: "12'-0\"",
        setbackEast: "8'-0\"",
        setbackWest: "8'-0\"",
        houseAuthority: 'Municipal Council House No.',
      },
      locationTemplateType: 'bearing_and_plot',
    },
    executant: [{
      name: 'V. RAMA RAO',
      relation: 'S/o',
      relativeName: 'NARSINGA RAO',
      age: '54',
      occupation: 'BUSINESS',
      address: 'Vidyanagar, Sircilla',
    }],
    claimant: [{
      name: 'B. SRINIVAS',
      relation: 'S/o',
      relativeName: 'VENKATESHAM',
      age: '42',
      occupation: 'EMPLOYEE',
      address: 'Renukanagar, Sircilla',
    }],
    boundaries: {
      northBoundary: 'HOUSE OF OTHERS',
      northDim: { raw: "68'-0\"", normalized: 68, unit: 'Feet' },
      southBoundary: '33\'-0" WIDE ROAD',
      southDim: { raw: "68'-0\"", normalized: 68, unit: 'Feet' },
      eastBoundary: 'PLOT NO. 21',
      eastDim: { raw: "75'-9\"", normalized: 75.75, unit: 'Feet' },
      westBoundary: 'PLOT NO. 19',
      westDim: { raw: "75'-9\"", normalized: 75.75, unit: 'Feet' },
      roadWidth: '33\'-0"',
      roadSides: ['South'],
      cornerProperty: false,
      dimensionUnit: 'Feet',
      northRotation: 0,
      mapRotation: 0,
      textScale: 100,
    },
    witnesses: {
      witness1: 'T. Chandra Shekar, S/o Narayana, R/o Sircilla',
      witness2: 'G. Suresh Kumar, S/o Gopal, R/o Sircilla',
    },
  },
  {
    id: 'sample-sircilla-registration',
    title: 'MARUVADI SWARUPA (Claimant) - Open Place (272.25 Sq.Yds - Sy.No. 1376/B/3, Sircilla)',
    createdAt: '2026-09-12',
    updatedAt: '2026-09-12',
    property: {
      propertyType: 'Open Place',
      areaSqYards: 272.25,
      areaSqMtrs: 227.62,
      surveyNo: '1376/B/3',
      nearHNo: '3-64',
      locality: 'SC COLONY/ INDIRAMMA COLONY/CHANDRAMPET OTHER',
      village: 'Sircilla',
      mandal: 'Sircilla',
      district: 'Rajanna Sircilla',
    },
    executant: [{
      name: 'SAKALI LAXMI',
      relation: 'W/o',
      relativeName: 'YELLAIAH',
      age: '60',
      occupation: 'HOUSE HOLD',
      address: 'H.No.7-79/2, Kondapur v/o Mustabad Mandal',
    }],
    claimant: [{
      name: 'MARUVADI SWARUPA',
      relation: 'W/o',
      relativeName: 'BABU (D/O SAKALI YELLAIAH)',
      age: '39',
      occupation: 'PRVT.EMPLOYEE',
      address: 'H.No.11-40, Kishandaspet, Yellareddypet Proper & Mandal',
    }],
    boundaries: {
      northBoundary: 'NEIGHBOUR PROPERTY',
      northDim: { raw: "45'-0\"", normalized: 45, unit: 'Feet' },
      southBoundary: '30\'-0" WIDE ROAD',
      southDim: { raw: "45'-0\"", normalized: 45, unit: 'Feet' },
      eastBoundary: 'HOUSE OF OTHERS',
      eastDim: { raw: "54'-5\"", normalized: 54.45, unit: 'Feet' },
      westBoundary: 'OPEN LAND',
      westDim: { raw: "54'-5\"", normalized: 54.45, unit: 'Feet' },
      roadWidth: '30\'-0"',
      roadSides: ['South'],
      cornerProperty: false,
      dimensionUnit: 'Feet',
    },
    witnesses: {
      witness1: 'T. Chandra Shekar, S/o Narayana, R/o Sircilla',
      witness2: 'G. Suresh Kumar, S/o Gopal, R/o Mustabad',
    },
  },
  {
    id: 'sample-standard-plot',
    title: 'M. SRINIVASA RAO (Claimant) - Plot (200 Sq.Yds - Sy.No. 142/A, Kompally)',
    createdAt: '2026-09-11',
    updatedAt: '2026-09-11',
    property: {
      propertyType: 'Plot',
      areaSqYards: 200,
      areaSqMtrs: 167.225,
      surveyNo: '142/A',
      nearHNo: '4-88/2',
      locality: 'Sri Sai Enclave',
      village: 'Kompally',
      mandal: 'Quthbullapur',
      district: 'Medchal-Malkajgiri',
    },
    executant: [{
      name: 'K. RAMESH BABU',
      relation: 'S/o',
      relativeName: 'LATE K. VENKATAIAH',
      age: '52',
      occupation: 'BUSINESS',
      address: 'H.No. 1-2-34, Kompally, Quthbullapur Mandal, Medchal Dist.',
    }],
    claimant: [{
      name: 'M. SRINIVASA RAO',
      relation: 'S/o',
      relativeName: 'M. SATYANARAYANA',
      age: '44',
      occupation: 'PRIVATE EMPLOYEE',
      address: 'Plot No. 12, Sri Sai Nagar, Nizampet, Hyderabad.',
    }],
    boundaries: {
      northBoundary: 'PLOT NO. 15',
      northDim: { raw: "40'-0\"", normalized: 40, unit: 'Feet' },
      southBoundary: '30\'-0" WIDE ROAD',
      southDim: { raw: "40'-0\"", normalized: 40, unit: 'Feet' },
      eastBoundary: 'PLOT NO. 17',
      eastDim: { raw: "45'-0\"", normalized: 45, unit: 'Feet' },
      westBoundary: 'PLOT NO. 14',
      westDim: { raw: "45'-0\"", normalized: 45, unit: 'Feet' },
      roadWidth: '30\'-0"',
      roadSides: ['South'],
      cornerProperty: false,
      dimensionUnit: 'Feet',
    },
    witnesses: {
      witness1: 'T. Chandra Shekar, S/o Narayana, R/o Hyderabad',
      witness2: 'G. Suresh Kumar, S/o Gopal, R/o Secunderabad',
    },
  },
  {
    id: 'sample-corner-house',
    title: 'P. VENKAT RAMAN (Claimant) - Corner House (266.66 Sq.Yds - Sy.No. 315/2, Gachibowli)',
    createdAt: '2026-09-11',
    updatedAt: '2026-09-11',
    property: {
      propertyType: 'House',
      areaSqYards: 266.66,
      areaSqMtrs: 222.962,
      surveyNo: '315/2',
      nearHNo: '8-124/1',
      locality: 'Venkateshwara Colony',
      village: 'Gachibowli',
      mandal: 'Serilingampally',
      district: 'Rangareddy',
    },
    executant: [{
      name: 'V. ANURADHA',
      relation: 'W/o',
      relativeName: 'V. PRAKASH REDDY',
      age: '48',
      occupation: 'HOUSEWIFE',
      address: 'Flat 402, Sai Residency, Serilingampally, Rangareddy Dist.',
    }],
    claimant: [{
      name: 'P. VENKAT RAMAN',
      relation: 'S/o',
      relativeName: 'P. APPA RAO',
      age: '39',
      occupation: 'SOFTWARE ENGINEER',
      address: 'H.No. 3-45/9, Gachibowli, Hyderabad.',
    }],
    boundaries: {
      northBoundary: '40\'-0" WIDE ROAD',
      northDim: { raw: "40'-5\"", normalized: 40.417, unit: 'Feet' },
      southBoundary: 'HOUSE OF K. MOHAN',
      southDim: { raw: "40'-0\"", normalized: 40, unit: 'Feet' },
      eastBoundary: '30\'-0" WIDE ROAD',
      eastDim: { raw: "60'-0\"", normalized: 60, unit: 'Feet' },
      westBoundary: 'HOUSE OF L. SUDHAKAR',
      westDim: { raw: "60'-0\"", normalized: 60, unit: 'Feet' },
      roadWidth: '40\' & 30\'',
      roadSides: ['North', 'East'],
      cornerProperty: true,
      dimensionUnit: 'Feet',
    },
    witnesses: {
      witness1: 'N. Ravi Varma, S/o Subba Raju, R/o Hyderabad',
      witness2: 'B. Jagadish, S/o Krishna Murthy, R/o Hyderabad',
    },
  },
  {
    id: 'sample-open-place',
    title: 'SYED MOHAMMED ALI (Claimant) - Open Place (166.66 Sq.Yds - Sy.No. 89, Shamshabad)',
    createdAt: '2026-09-11',
    updatedAt: '2026-09-11',
    property: {
      propertyType: 'Open Place',
      areaSqYards: 166.66,
      areaSqMtrs: 139.349,
      surveyNo: '89',
      nearHNo: '2-12',
      locality: 'Balaji Nagar',
      village: 'Shamshabad',
      mandal: 'Rajendranagar',
      district: 'Rangareddy',
    },
    executant: [{
      name: 'D. SRINIVAS',
      relation: 'S/o',
      relativeName: 'D. MALLESHAM',
      age: '41',
      occupation: 'REAL ESTATE',
      address: 'Shamshabad Village & Mandal, Rangareddy Dist.',
    }],
    claimant: [{
      name: 'SYED MOHAMMED ALI',
      relation: 'S/o',
      relativeName: 'SYED HUSSAIN',
      age: '46',
      occupation: 'MERCHANT',
      address: 'H.No. 18-4-102, Charminar, Hyderabad.',
    }],
    boundaries: {
      northBoundary: 'OPEN LAND OF SRI J. RAO',
      northDim: { raw: "30'-0\"", normalized: 30, unit: 'Feet' },
      southBoundary: '33\'-0" WIDE ROAD',
      southDim: { raw: "30'-0\"", normalized: 30, unit: 'Feet' },
      eastBoundary: 'NEIGHBOUR PLOT',
      eastDim: { raw: "50'-0\"", normalized: 50, unit: 'Feet' },
      westBoundary: 'PLOT OF SMT. SARITHA',
      westDim: { raw: "50'-0\"", normalized: 50, unit: 'Feet' },
      roadWidth: '33\'-0"',
      roadSides: ['South'],
      cornerProperty: false,
      dimensionUnit: 'Feet',
    },
    witnesses: {
      witness1: 'Mohammed Saleem, S/o Ibrahim, R/o Hyderabad',
      witness2: 'K. Balakrishna, S/o Pochaiah, R/o Shamshabad',
    },
  },
];

export const SavedPlansModal: React.FC<SavedPlansModalProps> = ({
  isOpen,
  onClose,
  onLoadPlan,
  currentPlan,
  initialTab,
  onSaveCurrentPlan,
}) => {
  const [savedList, setSavedList] = useState<PlanDocument[]>(() => {
    return planStorageService.getPlansSynchronous();
  });

  const [activeTab, setActiveTab] = useState<'saved' | 'templates'>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'area_high' | 'title'>('newest');
  const [importError, setImportError] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reload saved plans from storage whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      planStorageService.getAllPlans()
        .then((plans) => {
          setSavedList(plans);
          if (initialTab) {
            setActiveTab(initialTab);
          } else {
            setActiveTab(plans.length > 0 ? 'saved' : 'templates');
          }
        })
        .catch((err) => {
          console.error('Error loading saved plans:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleDeleteSaved = async (id: string, title: string) => {
    if (window.confirm(`మీరు ఈ ప్లాన్ ని తొలగించాలనుకుంటున్నారా?\n\nDelete "${title}"?`)) {
      const remaining = await planStorageService.deletePlan(id);
      setSavedList(remaining);
      setSaveSuccessMsg('🗑️ Plan deleted successfully');
      setTimeout(() => setSaveSuccessMsg(''), 2500);
    }
  };

  const handleDuplicateSaved = async (id: string) => {
    const duplicated = await planStorageService.duplicatePlan(id);
    if (duplicated) {
      const updated = await planStorageService.getAllPlans();
      setSavedList(updated);
      setSaveSuccessMsg('📋 Plan duplicated as new copy successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
  };

  const handleSaveCurrentNow = async (asNewCopy: boolean = false) => {
    if (onSaveCurrentPlan) {
      onSaveCurrentPlan({ asNewCopy });
    } else {
      await planStorageService.savePlan(currentPlan, { asNewCopy });
    }
    const updated = await planStorageService.getAllPlans();
    setSavedList(updated);
    setSaveSuccessMsg(asNewCopy ? '✅ Saved as a NEW Copy!' : '✅ Current plan saved successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleExportSinglePlan = (plan: PlanDocument) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(plan, null, 2));
    const downloadAnchor = document.createElement('a');
    const safeTitle = (plan.title || 'Property_Plan').replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${safeTitle}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `PropertyPlans_UnlimitedBackup_${savedList.length}_Plans_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const toImport = Array.isArray(parsed) ? parsed : [parsed];
        const merged = await planStorageService.importPlans(toImport);
        setSavedList(merged);
        setImportError('');
        setSaveSuccessMsg(`🎉 Successfully imported ${toImport.length} plan(s)! Total saved: ${merged.length}`);
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      } catch (err) {
        setImportError('Failed to parse JSON file. Please ensure valid plan data.');
      }
    };
    reader.readAsText(file);
  };

  const filteredAndSortedSavedList = savedList
    .filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const rawClaimants = Array.isArray(item.claimant) ? item.claimant : (item.claimant ? [item.claimant] : []);
      const rawExecutants = Array.isArray(item.executant) ? item.executant : (item.executant ? [item.executant] : []);
      
      const claimantText = rawClaimants.map(c => `${c.name || ''} ${c.relativeName || ''} ${c.address || ''} ${c.occupation || ''}`).join(' ').toLowerCase();
      const executantText = rawExecutants.map(e => `${e.name || ''} ${e.relativeName || ''} ${e.address || ''} ${e.occupation || ''}`).join(' ').toLowerCase();
      
      const boundariesText = `${item.boundaries?.northBoundary || ''} ${item.boundaries?.southBoundary || ''} ${item.boundaries?.eastBoundary || ''} ${item.boundaries?.westBoundary || ''}`.toLowerCase();
      const prop: Partial<PlanDocument['property']> = item.property || {};
      const propText = `${prop.surveyNo || ''} ${prop.plotNo || ''} ${prop.houseNo || ''} ${prop.nearHNo || ''} ${prop.village || ''} ${prop.mandal || ''} ${prop.district || ''} ${prop.locality || ''} ${prop.propertyType || ''} ${prop.areaSqYards || ''}`.toLowerCase();

      return (
        item.title.toLowerCase().includes(q) ||
        claimantText.includes(q) ||
        executantText.includes(q) ||
        propText.includes(q) ||
        boundariesText.includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      if (sortBy === 'oldest') return (a.updatedAt || '').localeCompare(b.updatedAt || '');
      if (sortBy === 'area_high') return (Number(b.property.areaSqYards) || 0) - (Number(a.property.areaSqYards) || 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return 0;
    });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-700 text-white rounded-xl shadow-xs">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Templates & Saved Plans</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                  <Database className="w-3 h-3 text-emerald-600" />
                  Unlimited Storage Active ({savedList.length} Saved)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                అపరిమిత ప్లాన్లను భద్రపరుచుకోండి (IndexedDB Unlimited Storage Engine Enabled)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab switch & Search/Sort Bar */}
        <div className="px-5 pt-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-xs font-bold">
            <button
              type="button"
              id="tab-my-saved-plans"
              onClick={() => setActiveTab('saved')}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'border-rose-700 text-rose-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>My Saved Plans ({savedList.length})</span>
            </button>
            <button
              type="button"
              id="tab-sample-templates"
              onClick={() => setActiveTab('templates')}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'templates'
                  ? 'border-rose-700 text-rose-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sample Templates ({SAMPLE_TEMPLATES.length})</span>
            </button>
          </div>

          {activeTab === 'saved' && (
            <div className="flex items-center gap-2 pb-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Claimant, Executant, Sy.No, Plot, H.No, Village..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-rose-600 w-64 sm:w-80 text-slate-900"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-700 text-xs"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {savedList.length > 1 && (
                <div className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent text-[11px] font-medium outline-hidden cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="area_high">Area (High - Low)</option>
                    <option value="title">Title (A - Z)</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3 bg-slate-50/50">
          {importError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {importError}
            </p>
          )}

          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-900 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* MY SAVED PLANS TAB */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              {/* Quick Save Current Plan Banner with 2 Options */}
              <div className="p-3.5 bg-white border border-rose-200 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Current Active Plan: {currentPlan.property.propertyType}
                    </span>
                    <span className="text-[10px] bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded border border-rose-200">
                      {currentPlan.property.areaSqYards || 0} Sq.Yds
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Sy.No: {currentPlan.property.surveyNo || 'N/A'} | Village: {currentPlan.property.village || 'N/A'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-save-current-modal"
                    onClick={() => handleSaveCurrentNow(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all active:scale-95"
                    title="Update current saved plan"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save / Update Plan</span>
                  </button>

                  <button
                    type="button"
                    id="btn-save-as-new-copy"
                    onClick={() => handleSaveCurrentNow(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs cursor-pointer transition-all active:scale-95"
                    title="Save as a brand new copy (Unsaved variations)"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Save as New Copy (కొత్త కాపీ)</span>
                  </button>
                </div>
              </div>

              {savedList.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6 space-y-2">
                  <Bookmark className="w-10 h-10 mx-auto text-slate-300" />
                  <h3 className="text-sm font-bold text-slate-700">No saved plans yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    మీరు డ్రాయింగ్ లేదా ఫారం నింపిన తర్వాత "Save" బటన్ నొక్కగానే ప్లాన్ ఇక్కడ అపరిమితంగా భద్రపరచబడుతుంది.
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveCurrentNow(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Current Plan Now
                    </button>
                  </div>
                </div>
              ) : filteredAndSortedSavedList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Search className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs">No saved plans matched "{searchQuery}".</p>
                </div>
              ) : (
                filteredAndSortedSavedList.map((item) => {
                  const isCurrent = item.id === currentPlan.id;
                  const rawClaimants = (Array.isArray(item.claimant) ? item.claimant : (item.claimant ? [item.claimant] : []))
                    .filter(c => c && c.name && c.name.trim());
                  const rawExecutants = (Array.isArray(item.executant) ? item.executant : (item.executant ? [item.executant] : []))
                    .filter(e => e && e.name && e.name.trim());

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white shadow-2xs ${
                        isCurrent
                          ? 'border-rose-400 ring-2 ring-rose-200/50 bg-rose-50/10'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-md">
                            {item.property.propertyType}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-800 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              CURRENT ACTIVE
                            </span>
                          )}
                        </div>

                        {/* Claimant & Executant Highlighted Badges */}
                        {(rawClaimants.length > 0 || rawExecutants.length > 0) && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 pb-0.5">
                            {rawClaimants.length > 0 && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-teal-50 border border-teal-200 rounded-md text-[11px] text-teal-900">
                                <span className="font-extrabold text-[9px] bg-teal-700 text-white px-1.5 py-0.2 rounded tracking-wide">
                                  CLAIMANT
                                </span>
                                <span className="font-bold text-teal-950">
                                  {rawClaimants.map(c => c.name).join(' & ')}
                                </span>
                                {rawClaimants[0]?.relativeName && (
                                  <span className="text-[10px] text-teal-700">
                                    ({rawClaimants[0].relation || 'S/o'} {rawClaimants[0].relativeName})
                                  </span>
                                )}
                              </div>
                            )}

                            {rawExecutants.length > 0 && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900">
                                <span className="font-extrabold text-[9px] bg-amber-700 text-white px-1.5 py-0.2 rounded tracking-wide">
                                  EXECUTANT
                                </span>
                                <span className="font-bold text-amber-950">
                                  {rawExecutants.map(e => e.name).join(' & ')}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">
                            {item.property.areaSqYards} Sq.Yds ({item.property.areaSqMtrs || 0} Sq.M)
                          </span>
                          {item.property.surveyNo && <span>Sy.No. {item.property.surveyNo}</span>}
                          {item.property.plotNo && <span>Plot No. {item.property.plotNo}</span>}
                          {item.property.houseNo && <span>H.No. {item.property.houseNo}</span>}
                          {item.property.village && <span>{item.property.village}, {item.property.mandal || ''}</span>}
                        </div>

                        {/* Boundaries Preview */}
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2 pt-0.5">
                          <span>N: {item.boundaries.northDim?.raw || 'N/A'}</span>
                          <span>•</span>
                          <span>S: {item.boundaries.southDim?.raw || 'N/A'}</span>
                          <span>•</span>
                          <span>E: {item.boundaries.eastDim?.raw || 'N/A'}</span>
                          <span>•</span>
                          <span>W: {item.boundaries.westDim?.raw || 'N/A'}</span>
                        </div>

                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last saved: {item.updatedAt || 'Recently'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadPlan(item);
                            onClose();
                          }}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-xs"
                        >
                          Load Plan (ఓపెన్)
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicateSaved(item.id)}
                          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border border-slate-200"
                          title="Duplicate / Clone as new copy (డూప్లికేట్)"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportSinglePlan(item)}
                          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors border border-slate-200"
                          title="Download single plan JSON (డౌన్‌లోడ్ JSON)"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSaved(item.id, item.title)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors border border-slate-200"
                          title="Delete saved plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Import/Export Backup Section */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Import Plans JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportBackup}
                  />
                </label>

                {savedList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export All Backup ({savedList.length} Plans)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SAMPLE TEMPLATES TAB */}
          {activeTab === 'templates' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 mb-2">
                Click any standard registration plan template below to instantly load full property, boundary, party, and sketch data:
              </p>
              {SAMPLE_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-rose-400 bg-white hover:bg-rose-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{tmpl.title}</span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-800 rounded-md">
                        {tmpl.property.propertyType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Sy.No. {tmpl.property.surveyNo} | {tmpl.property.village}, {tmpl.property.mandal} | {tmpl.property.areaSqYards} Sq.Yds
                    </p>
                    <p className="text-[11px] text-slate-400">
                      North: {tmpl.boundaries.northDim.raw} | South: {tmpl.boundaries.southDim.raw} | East: {tmpl.boundaries.eastDim.raw} | West: {tmpl.boundaries.westDim.raw}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadPlan(tmpl);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer shrink-0 transition-all"
                  >
                    Load Template
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
