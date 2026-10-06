/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PlanDocument, ValidationIssue } from './types';
import { calculateSqMtrs, validatePlanDocument, generateLegalDescription, rotateBoundariesByQuarterTurns } from './utils/dimensionUtils';
import { downloadWord2007DeedDocx } from './utils/deedDocxExporter';
import { PropertyDetailsForm } from './components/PropertyDetailsForm';
import { PartiesForm } from './components/PartiesForm';
import { BoundariesForm } from './components/BoundariesForm';
import { PropertySketch } from './components/PropertySketch';
import { PlanPreview } from './components/PlanPreview';
import { SavedPlansModal, SAMPLE_TEMPLATES } from './components/SavedPlansModal';
import { ManualSketchUploadModal } from './components/ManualSketchUploadModal';
import { ExtractedSketchData, applyExtractedDataToPlan } from './services/sketchAiService';
import { planStorageService } from './services/planStorageService';
import {
  FileText,
  Eye,
  Save,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Printer,
  Compass,
  Building2,
  Users,
  Layers,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Camera,
  Upload,
  Sparkles,
  Sliders,
  Split,
  EyeOff,
  Maximize2,
  Copy,
  ChevronDown,
  Database,
} from 'lucide-react';

const INITIAL_BLANK_PLAN: PlanDocument = {
  id: 'new-plan',
  title: 'Untitled Registration Plan',
  createdAt: new Date().toISOString().split('T')[0],
  updatedAt: new Date().toISOString().split('T')[0],
  property: {
    propertyType: 'Open Place',
    areaSqYards: '',
    areaSqMtrs: '',
    surveyNo: '',
    plotNo: '',
    houseNo: '',
    locationTemplateType: 'near_hno',
    nearHNo: '',
    locality: '',
    village: '',
    mandal: '',
    district: '',
  },
  executant: [{
    name: '',
    relation: 'S/o',
    relativeName: '',
    age: '',
    occupation: '',
    address: '',
  }],
  claimant: [{
    name: '',
    relation: 'S/o',
    relativeName: '',
    age: '',
    occupation: '',
    address: '',
  }],
  boundaries: {
    northBoundary: '',
    northDim: { raw: "40'-0\"", normalized: 40, unit: 'Feet' },
    southBoundary: 'ROAD',
    southDim: { raw: "40'-0\"", normalized: 40, unit: 'Feet' },
    eastBoundary: '',
    eastDim: { raw: "60'-0\"", normalized: 60, unit: 'Feet' },
    westBoundary: '',
    westDim: { raw: "60'-0\"", normalized: 60, unit: 'Feet' },
    roadWidth: '',
    roadSides: ['South'],
    cornerProperty: false,
    dimensionUnit: 'Feet',
  },
  witnesses: {
    witness1: '',
    witness2: '',
  },
};

export default function App() {
  // Start with standard template loaded so user sees functional sketch immediately
  const [doc, setDoc] = useState<PlanDocument>(SAMPLE_TEMPLATES[0]);
  const [seedScheduleId, setSeedScheduleId] = useState('');
  useEffect(() => {
    const receiveSeed = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'deedcraft:reference-plan-seed') return;
      setSeedScheduleId(event.data.scheduleId);
      setDoc(event.data.doc);
    };
    window.addEventListener('message', receiveSeed);
    window.parent.postMessage({ type: 'deedcraft:reference-plan-ready' }, window.location.origin);
    return () => window.removeEventListener('message', receiveSeed);
  }, []);
  useEffect(() => {
    if (seedScheduleId) window.parent.postMessage({ type: 'deedcraft:reference-plan-change', scheduleId: seedScheduleId, doc }, window.location.origin);
  }, [doc, seedScheduleId]);
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const [activeTab, setActiveTab] = useState<'all' | 'property' | 'parties' | 'boundaries'>('all');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryInitialTab, setLibraryInitialTab] = useState<'saved' | 'templates'>('saved');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Manual Hand-Drawn Sketch Upload & Tracing State
  const [isManualUploadOpen, setIsManualUploadOpen] = useState(false);
  const [manualSketchImage, setManualSketchImage] = useState<string | null>(null);
  const [manualSketchMeta, setManualSketchMeta] = useState<ExtractedSketchData | null>(null);
  const [sketchViewMode, setSketchViewMode] = useState<'cad' | 'overlay' | 'side-by-side'>('cad');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.45);
  const [syncNorthWithMap, setSyncNorthWithMap] = useState<boolean>(false);
  const [autoAlignBoundariesWithMap, setAutoAlignBoundariesWithMap] = useState<boolean>(true);
  const [copiedLegalText, setCopiedLegalText] = useState(false);

  const legalDesc = useMemo(() => generateLegalDescription(doc), [doc]);

  const handleToggleSyncNorth = (checked: boolean) => {
    setSyncNorthWithMap(checked);
    if (checked) {
      const currentMapRot = doc.boundaries.mapRotation || 0;
      setDoc({
        ...doc,
        boundaries: {
          ...doc.boundaries,
          northRotation: currentMapRot,
        },
      });
      showToast(`Sync North with Map ఆన్ చేయబడింది: నార్త్ & మ్యాప్ ${currentMapRot}° వద్ద స్టాండర్డ్‌గా సింక్ అయ్యాయి`);
    } else {
      showToast('Sync North with Map ఆఫ్ చేయబడింది');
    }
  };

  const handleMapRotation = (angleInput: number) => {
    const newAngle = ((Math.round(angleInput) % 360) + 360) % 360;

    if (syncNorthWithMap) {
      // Standard Direction: Map and North rotate in matching standard direction
      setDoc({
        ...doc,
        boundaries: {
          ...doc.boundaries,
          mapRotation: newAngle,
          northRotation: newAngle,
        },
      });
      showToast(`మ్యాప్ & నార్త్ ${newAngle}° స్టాండర్డ్ డైరెక్షన్‌లో రొటేట్ అయ్యాయి (Map & North: ${newAngle}°)`);
    } else {
      setDoc({
        ...doc,
        boundaries: {
          ...doc.boundaries,
          mapRotation: newAngle,
        },
      });
    }
  };

  const handleAlignBoundariesToCurrentRotation = () => {
    const currentMapRot = doc.boundaries.mapRotation || 0;
    const quarterTurn = Math.round(currentMapRot / 90) % 4;
    const turns = ((quarterTurn % 4) + 4) % 4;

    if (turns === 0 && currentMapRot === 0) {
      showToast('మ్యాప్ ఇప్పటికే స్టాండర్డ్ 0° ఓరియంటేషన్‌లో ఉంది (Already at standard orientation)');
      return;
    }

    const shifted = rotateBoundariesByQuarterTurns(doc.boundaries, turns === 0 ? 1 : turns);
    setDoc({
      ...doc,
      boundaries: {
        ...shifted,
        mapRotation: 0,
      },
    });
    showToast('బౌండరీలు మరియు కొలతలు రొటేషన్‌కు అనుగుణంగా అలైన్ చేయబడ్డాయి! (Boundaries & Dimensions aligned)');
  };

  const handleBoundaryFontWeightChange = (weight: 'normal' | 'bold') => {
    setDoc({
      ...doc,
      boundaries: {
        ...doc.boundaries,
        boundaryFontWeight: weight,
      },
    });
    showToast(weight === 'normal' ? 'బౌండరీలు & హౌస్ కొలతలు Bold కాకుండా సెట్ చేయబడ్డాయి (Normal Weight Set)' : 'బౌండరీలు & హౌస్ కొలతలు Bold గా సెట్ చేయబడ్డాయి (Bold Set)');
  };

  const handleNorthRotation = (angleInput: number) => {
    const newAngle = ((Math.round(angleInput) % 360) + 360) % 360;
    if (syncNorthWithMap) {
      setDoc({
        ...doc,
        boundaries: {
          ...doc.boundaries,
          northRotation: newAngle,
          mapRotation: newAngle,
        },
      });
    } else {
      setDoc({
        ...doc,
        boundaries: {
          ...doc.boundaries,
          northRotation: newAngle,
        },
      });
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApplyManualSketch = (
    updatedPlan: PlanDocument,
    sketchImageUrl: string,
    extractedData: ExtractedSketchData
  ) => {
    setDoc(updatedPlan);
    setManualSketchImage(sketchImageUrl);
    setManualSketchMeta(extractedData);
    setSketchViewMode('side-by-side');
    showToast('చేతితో గీసిన ప్లాన్ కొలతలు వర్తింపజేయబడ్డాయి! (Drawing Applied Same to Same)');
  };

  // Real-time validation
  const validationIssues: ValidationIssue[] = useMemo(() => {
    return validatePlanDocument(doc);
  }, [doc]);

  const errors = validationIssues.filter((i) => i.severity === 'error');
  const warnings = validationIssues.filter((i) => i.severity === 'warning');
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const [savedPlansCount, setSavedPlansCount] = useState<number>(() => {
    return planStorageService.getPlansSynchronous().length;
  });
  const saveMenuRef = useRef<HTMLDivElement>(null);

  // Sync count on mount and when library is closed
  const refreshSavedCount = async () => {
    const plans = await planStorageService.getAllPlans();
    setSavedPlansCount(plans.length);
  };

  useEffect(() => {
    refreshSavedCount();
  }, [isLibraryOpen]);

  // Keyboard shortcut: Ctrl+S or Cmd+S to save instantly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSavePlan();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc]);

  // Close Save Menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setIsSaveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Action: New Plan
  const handleNewPlan = () => {
    if (window.confirm('Start a new registration plan? Unsaved changes will be cleared.')) {
      setDoc({
        ...INITIAL_BLANK_PLAN,
        id: `plan-${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      });
      setViewMode('editor');
      showToast('Initialized new registration plan.');
    }
  };

  // Action: Save Plan (Unlimited Storage via IndexedDB)
  const handleSavePlan = async (options?: { asNewCopy?: boolean; customTitle?: string }) => {
    try {
      setIsSaveMenuOpen(false);
      const result = await planStorageService.savePlan(doc, options);
      setDoc(result.savedPlan);
      setSavedPlansCount(result.totalCount);
      setLibraryInitialTab('saved');

      if (options?.asNewCopy) {
        showToast(`✅ కొత్త కాపీగా సేవ్ అయ్యింది (Saved as New Copy! Total: ${result.totalCount})`);
      } else {
        showToast(`✅ ప్లాన్ 'My Saved Plans' లో సేవ్ అయ్యింది (Saved! Total: ${result.totalCount})`);
      }
    } catch (e) {
      console.error(e);
      showToast('Error saving plan to storage.');
    }
  };

  // Action: Calculate Area
  const handleCalculateArea = () => {
    if (doc.property.areaSqYards !== '') {
      const calculated = calculateSqMtrs(doc.property.areaSqYards);
      setDoc((prev) => ({
        ...prev,
        property: {
          ...prev.property,
          areaSqMtrs: calculated,
        },
      }));
      showToast(`Area calculated: ${calculated} Sq.Metres`);
    } else {
      showToast('Please enter Total Area in Sq.Yards first.');
    }
  };

  // Action: Generate Sketch (re-syncs and scrolls to sketch)
  const handleGenerateSketch = () => {
    showToast('Sketch dimensions & boundaries updated.');
    const sketchElement = document.getElementById('live-sketch-panel');
    if (sketchElement) {
      sketchElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Application Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black shadow-xs">
              <Compass className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  PROPERTY PLAN GENERATOR
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded-md border border-amber-200 uppercase tracking-wider">
                  Registration Software
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Standard Cadastral Registration Plan Preparation & Proportional Sketch
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-app-upload-sketch-top"
              onClick={() => setIsManualUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 cursor-pointer transition-all shadow-2xs"
              title="చేతితో గీసిన స్కెచ్ ఫోటో లేదా PDF అప్‌లోడ్ చేసి ఆటోమేటిక్ డ్రాయింగ్ పొందండి"
            >
              <Camera className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Upload Sketch (AI)</span>
              <span className="sm:hidden">Upload</span>
            </button>

            <button
              type="button"
              id="btn-app-library"
              onClick={() => {
                setLibraryInitialTab('saved');
                setIsLibraryOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-all"
              title="View all saved plans and templates"
            >
              <FolderOpen className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Templates & Saved</span>
              <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-rose-100 text-rose-800 rounded-full">
                {savedPlansCount}
              </span>
            </button>

            <button
              type="button"
              id="btn-app-new"
              onClick={handleNewPlan}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">New Plan</span>
            </button>

            {/* Split Save Button with Dropdown (Unlimited Save) */}
            <div className="relative inline-flex rounded-lg shadow-2xs" ref={saveMenuRef}>
              <button
                type="button"
                id="btn-app-save"
                onClick={() => handleSavePlan()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-l-lg border border-r-0 border-slate-300 cursor-pointer transition-all active:scale-95"
                title="Save current plan (Ctrl+S)"
              >
                <Save className="w-3.5 h-3.5 text-rose-700" />
                <span className="hidden sm:inline font-bold text-rose-900">Save</span>
                <span className="sm:hidden font-bold text-rose-900">Save</span>
              </button>
              <button
                type="button"
                id="btn-app-save-dropdown"
                onClick={() => setIsSaveMenuOpen(!isSaveMenuOpen)}
                className="px-1.5 py-2 text-xs text-slate-600 bg-white hover:bg-slate-50 rounded-r-lg border border-slate-300 cursor-pointer transition-all"
                title="More save options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isSaveMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-fade-in text-xs">
                  <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/70 text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-600" />
                    Unlimited IndexedDB Storage
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSavePlan({ asNewCopy: false })}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 hover:text-rose-900 flex items-center justify-between gap-2 cursor-pointer font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Save className="w-3.5 h-3.5 text-rose-700" />
                      <span>Save / Update Plan</span>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Ctrl+S</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSavePlan({ asNewCopy: true })}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 hover:text-rose-900 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Save as New Copy (కొత్త కాపీ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaveMenuOpen(false);
                      setLibraryInitialTab('saved');
                      setIsLibraryOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer border-t border-slate-100 pt-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>Open Saved Plans Library</span>
                  </button>
                </div>
              )}
            </div>

            {/* View Mode Toggle Button */}
            {viewMode === 'editor' ? (
              <button
                type="button"
                id="btn-app-preview"
                onClick={() => setViewMode('preview')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-xs cursor-pointer transition-all"
              >
                <Eye className="w-4 h-4 text-white" />
                Preview Plan
              </button>
            ) : (
              <button
                type="button"
                id="btn-app-edit"
                onClick={() => setViewMode('editor')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-xs cursor-pointer transition-all"
              >
                <FileText className="w-4 h-4 text-white" />
                Edit Form
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {viewMode === 'preview' ? (
          /* ================= PREVIEW MODE ================= */
          <PlanPreview
            document={doc}
            validationIssues={validationIssues}
            onEdit={() => setViewMode('editor')}
            onSave={handleSavePlan}
            onNewPlan={handleNewPlan}
            onUpdateBoundaries={(newBoundaries) => setDoc({ ...doc, boundaries: newBoundaries })}
            onUpdateProperty={(newProperty) => setDoc({ ...doc, property: newProperty })}
          />
        ) : (
          /* ================= EDITOR MODE ================= */
          <div className="space-y-6">
            {/* Navigation tabs & Status Bar */}
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All Sections
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('property')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'property'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  1. Property Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('parties')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'parties'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  2. Executant / Claimant
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('boundaries')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'boundaries'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  3. Boundaries & Sketch
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                {errors.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-rose-50 text-rose-700 rounded-md border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.length} Required Field{errors.length > 1 ? 's' : ''} Missing
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Plan Validated
                  </span>
                )}
              </div>
            </div>

            {/* Layout: Form Panels (Left) + Live Sketch & Quick Legal Text (Right) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Column: Input Forms */}
              <div className="xl:col-span-7 space-y-6">
                {(activeTab === 'all' || activeTab === 'property') && (
                  <PropertyDetailsForm
                    property={doc.property}
                    boundaries={doc.boundaries}
                    onChange={(updated) => setDoc({ ...doc, property: updated })}
                    onCalculateArea={handleCalculateArea}
                    onApplyExtractedData={(extracted) => {
                      const updatedPlan = applyExtractedDataToPlan(doc, extracted);
                      setDoc(updatedPlan);
                      const housePart = updatedPlan.property.houseNo ? ` | H.No: ${updatedPlan.property.houseNo}` : '';
                      const plotPart = updatedPlan.property.plotNo ? ` | Plot: ${updatedPlan.property.plotNo}` : '';
                      const syPart = updatedPlan.property.surveyNo ? ` | Sy: ${updatedPlan.property.surveyNo}` : '';
                      const execCount = updatedPlan.executant.filter(e => e && (e.name || e.relativeName)).length;
                      const claimCount = updatedPlan.claimant.filter(c => c && (c.name || c.relativeName)).length;
                      const partiesPart = (execCount > 0 || claimCount > 0) ? ` | ${execCount} Executant(s), ${claimCount} Claimant(s)` : '';
                      showToast(`డాక్యుమెంట్ నుండి వివరాలు విజయవంతంగా ఆటో-ఫిల్ అయ్యాయి!${housePart}${plotPart}${syPart}${partiesPart}`);
                    }}
                  />
                )}

                {(activeTab === 'all' || activeTab === 'parties') && (
                  <PartiesForm
                    executant={doc.executant}
                    claimant={doc.claimant}
                    witnesses={doc.witnesses}
                    onExecutantChange={(updated) => setDoc({ ...doc, executant: updated })}
                    onClaimantChange={(updated) => setDoc({ ...doc, claimant: updated })}
                    onWitnessesChange={(updated) => setDoc({ ...doc, witnesses: updated })}
                    onApplyExtractedData={(extracted) => {
                      const updatedPlan = applyExtractedDataToPlan(doc, extracted);
                      setDoc(updatedPlan);
                      const execCount = updatedPlan.executant.filter(e => e && (e.name || e.relativeName)).length;
                      const claimCount = updatedPlan.claimant.filter(c => c && (c.name || c.relativeName)).length;
                      showToast(`డాక్యుమెంట్ నుండి ${execCount} Executants & ${claimCount} Claimants ఆటో-ఫిల్ అయ్యాయి! (All Parties Extracted)`);
                    }}
                  />
                )}

                {(activeTab === 'all' || activeTab === 'boundaries') && (
                  <BoundariesForm
                    boundaries={doc.boundaries}
                    onChange={(updated) => setDoc({ ...doc, boundaries: updated })}
                    onGenerateSketch={handleGenerateSketch}
                  />
                )}
              </div>

              {/* Right Column: Live Property Sketch & Summary */}
              <div className="xl:col-span-5 space-y-6 xl:sticky xl:top-24">
                {/* Live Sketch Card */}
                <div
                  id="live-sketch-panel"
                  className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-100 text-slate-800 rounded-lg">
                        <Layers className="w-4 h-4 text-rose-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">Automatic Property Sketch</h3>
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-100 text-rose-800 rounded-full uppercase">
                            CAD Vector
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Proportional 4-edge plot with exact dimensions, road & North arrow
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="btn-upload-manual-sketch-card"
                        onClick={() => setIsManualUploadOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                        title="చేతితో గీసిన స్కెచ్ ఫోటో లేదా PDF అప్‌లోడ్ చేయండి"
                      >
                        <Camera className="w-3.5 h-3.5 text-rose-100" />
                        <span>Upload Handwritten Sketch</span>
                        <span className="bg-rose-900/50 text-[9px] px-1.5 py-0.2 rounded text-rose-100 font-semibold uppercase">
                          AI
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode('preview')}
                        className="text-xs font-bold text-rose-700 hover:text-rose-800 hover:underline cursor-pointer"
                      >
                        Full Plan →
                      </button>
                    </div>
                  </div>

                  {/* If Handwritten Sketch is Uploaded: Show Compare & Tracing Bar */}
                  {manualSketchImage && (
                    <div className="p-2.5 bg-rose-50/60 border border-rose-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-slate-800">
                          చేతి రాత స్కెచ్ లోడ్ చేయబడింది (Handwritten Sketch Loaded)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSketchViewMode('cad')}
                          className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                            sketchViewMode === 'cad'
                              ? 'bg-rose-700 text-white shadow-2xs'
                              : 'bg-white text-slate-700 hover:bg-rose-100'
                          }`}
                        >
                          CAD Drawing
                        </button>
                        <button
                          type="button"
                          onClick={() => setSketchViewMode('side-by-side')}
                          className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                            sketchViewMode === 'side-by-side'
                              ? 'bg-rose-700 text-white shadow-2xs'
                              : 'bg-white text-slate-700 hover:bg-rose-100'
                          }`}
                        >
                          <Split className="w-3 h-3" />
                          Side-by-Side (పోల్చి చూడండి)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSketchViewMode('overlay')}
                          className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                            sketchViewMode === 'overlay'
                              ? 'bg-rose-700 text-white shadow-2xs'
                              : 'bg-white text-slate-700 hover:bg-rose-100'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          Overlay (ట్రేసింగ్)
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsManualUploadOpen(true)}
                          className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-md transition-all cursor-pointer"
                        >
                          Change / Re-scan
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SVG Sketch Display */}
                  <div className="w-full">
                    {/* Map Controls: Rotation & Scaling */}
                    <div className="mb-3 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                      {/* Top Row: Sync Option, Auto-Align Option & Font Style */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <label
                          htmlFor="sync-north-checkbox"
                          className={`flex items-center gap-2 text-[11px] font-medium px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-colors ${
                            syncNorthWithMap
                              ? 'bg-rose-50 text-rose-800 border-rose-300 font-semibold shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            id="sync-north-checkbox"
                            checked={syncNorthWithMap}
                            onChange={(e) => handleToggleSyncNorth(e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          Sync North with Map (మ్యాప్‌తో పాటు కంపాస్ స్టాండర్డ్ డైరెక్షన్‌లో తిరుగును)
                        </label>

                        <label
                          htmlFor="auto-align-boundaries-checkbox"
                          title="మ్యాప్ రొటేషన్ చేసినప్పుడు బౌండరీలు మరియు కొలతలు ఆటోమేటిక్‌గా అలైన్ అవుతాయి"
                          className={`flex items-center gap-2 text-[11px] font-medium px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-colors ${
                            autoAlignBoundariesWithMap
                              ? 'bg-blue-50 text-blue-800 border-blue-300 font-semibold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            id="auto-align-boundaries-checkbox"
                            checked={autoAlignBoundariesWithMap}
                            onChange={(e) => setAutoAlignBoundariesWithMap(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          Auto-Align Boundaries & Dims (బౌండరీలు & కొలతలు ఆటో-అలైన్)
                        </label>

                        {/* Boundaries & House Measurements Font Style (Bold కాకుండా) */}
                        <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] shadow-2xs ml-auto">
                          <span className="text-slate-500 font-medium mr-1">Style:</span>
                          <button
                            type="button"
                            onClick={() => handleBoundaryFontWeightChange('normal')}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                              (doc.boundaries.boundaryFontWeight || 'normal') === 'normal'
                                ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                            title="బౌండరీలు మరియు హౌస్ కొలతలు Bold కాకుండా సాధారణ వెయిట్‌తో కనిపిస్తాయి"
                          >
                            ✓ Normal (Bold కాకుండా)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBoundaryFontWeightChange('bold')}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                              doc.boundaries.boundaryFontWeight === 'bold'
                                ? 'bg-slate-800 text-white font-semibold shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Bold
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {/* Map Rotation */}
                        <div className="flex flex-col gap-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                              <RotateCw className="w-3 h-3 text-rose-600" />
                              Map Rotation:
                            </label>
                            <span className="text-[11px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {doc.boundaries.mapRotation || 0}°
                            </span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="359" 
                            value={doc.boundaries.mapRotation || 0}
                            onChange={(e) => handleMapRotation(parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                          />
                          <div className="flex items-center justify-between gap-1 text-[9px]">
                            {[
                              { label: '0°', deg: 0, title: 'Standard North Up (0°)' },
                              { label: '90°', deg: 90, title: '90° Standard Direction' },
                              { label: '180°', deg: 180, title: '180° Standard Direction' },
                              { label: '270°', deg: 270, title: '270° Standard Direction' },
                              { label: '360°', deg: 360, title: '360° Full Standard Rotation' },
                            ].map(({ label, deg, title }) => {
                              const currentRot = doc.boundaries.mapRotation || 0;
                              const isSelected = deg === 360 ? currentRot === 0 : currentRot === deg;
                              return (
                                <button
                                  key={deg}
                                  type="button"
                                  title={title}
                                  onClick={() => handleMapRotation(deg === 360 ? 0 : deg)}
                                  className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer border ${
                                    isSelected
                                      ? 'bg-rose-600 text-white border-rose-600'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={handleAlignBoundariesToCurrentRotation}
                              title="Align Boundaries & Dimensions with current Map rotation"
                              className="px-1.5 py-0.5 rounded font-bold cursor-pointer border bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-0.5 ml-auto"
                            >
                              <RefreshCw className="w-2.5 h-2.5 text-amber-600" />
                              Align
                            </button>
                          </div>
                        </div>

                        {/* North Rotation & Symbol Style */}
                        <div className="flex flex-col gap-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                              <Compass className="w-3 h-3 text-blue-600" />
                              North Symbol & Rotation:
                            </label>
                            <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {doc.boundaries.northRotation || 0}°
                            </span>
                          </div>

                          {/* North Symbol Style Selector */}
                          <div className="grid grid-cols-4 gap-1 text-[9.5px]">
                            {[
                              { id: 'cadastral', label: 'డీడ్ సర్వే' },
                              { id: 'compass', label: 'కంపాస్' },
                              { id: 'architectural', label: 'ఆర్కిటెక్ట్' },
                              { id: 'minimal', label: 'సింపుల్' },
                            ].map(({ id, label }) => {
                              const currentStyle = doc.boundaries.northSymbolStyle || 'cadastral';
                              const isSelected = currentStyle === id;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setDoc({ ...doc, boundaries: { ...doc.boundaries, northSymbolStyle: id as any } })}
                                  className={`px-1 py-1 rounded text-center font-bold cursor-pointer border transition-colors ${
                                    isSelected
                                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                  title={label}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>

                          <input 
                            type="range" 
                            min="0" 
                            max="359" 
                            value={doc.boundaries.northRotation || 0}
                            onChange={(e) => handleNorthRotation(parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex items-center justify-between gap-1 text-[9px]">
                            {[
                              { label: 'N (0°)', deg: 0 },
                              { label: 'E (90°)', deg: 90 },
                              { label: 'S (180°)', deg: 180 },
                              { label: 'W (270°)', deg: 270 },
                              { label: '360°', deg: 360 },
                            ].map(({ label, deg }) => {
                              const targetDeg = deg === 360 ? 0 : deg;
                              const currentNorth = doc.boundaries.northRotation || 0;
                              const isSelected = deg === 360 ? currentNorth === 0 : currentNorth === targetDeg;
                              return (
                                <button
                                  key={deg}
                                  type="button"
                                  onClick={() => handleNorthRotation(targetDeg)}
                                  className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer border ${
                                    isSelected
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Map Scale */}
                        <div className="flex flex-col gap-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700">Map Scale:</label>
                            <span className="text-[11px] font-extrabold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {doc.boundaries.sketchScale ?? 100}%
                            </span>
                          </div>
                          <input 
                            type="range" 
                            min="50" 
                            max="150" 
                            step="1"
                            value={doc.boundaries.sketchScale ?? 100}
                            onChange={(e) => setDoc({ ...doc, boundaries: { ...doc.boundaries, sketchScale: parseInt(e.target.value, 10) } })}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                          />
                          <div className="flex justify-end pt-0.5">
                            <button
                              type="button"
                              onClick={() => setDoc({ ...doc, boundaries: { ...doc.boundaries, sketchScale: 100 } })}
                              className="text-[9px] text-slate-500 hover:text-slate-800"
                            >
                              Reset (100%)
                            </button>
                          </div>
                        </div>

                        {/* Text Scale */}
                        <div className="flex flex-col gap-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700">Text Scale:</label>
                            <span className="text-[11px] font-extrabold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {doc.boundaries.textScale ?? 100}%
                            </span>
                          </div>
                          <input 
                            type="range" 
                            min="50" 
                            max="150" 
                            step="1"
                            value={doc.boundaries.textScale ?? 100}
                            onChange={(e) => setDoc({ ...doc, boundaries: { ...doc.boundaries, textScale: parseInt(e.target.value, 10) } })}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                          />
                          <div className="flex justify-end pt-0.5">
                            <button
                              type="button"
                              onClick={() => setDoc({ ...doc, boundaries: { ...doc.boundaries, textScale: 100 } })}
                              className="text-[9px] text-slate-500 hover:text-slate-800"
                            >
                              Reset (100%)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {sketchViewMode === 'side-by-side' && manualSketchImage ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        {/* Left: Original Handwritten Drawing Photo */}
                        <div className="bg-slate-900 text-white rounded-xl p-3 space-y-2 border border-slate-800 shadow-md">
                          <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
                            <span className="font-bold flex items-center gap-1.5 text-rose-300">
                              <Camera className="w-3.5 h-3.5" />
                              Original Handwritten Sketch (చేతి రాత)
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                              Reference Photo
                            </span>
                          </div>
                          <div className="relative rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center p-2 min-h-[300px]">
                            <img
                              src={manualSketchImage}
                              alt="Handwritten Sketch"
                              className="max-h-[360px] w-full object-contain rounded"
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 text-center">
                            Handwritten sketch uploaded by user / మీరు అప్‌లోడ్ చేసిన ఒరిజినల్ డ్రాయింగ్
                          </p>
                        </div>

                        {/* Right: Exact CAD Vector Drawing */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs px-1">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5 text-rose-600" />
                              Generated CAD Drawing (కంప్యూటర్ స్కెచ్)
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              100% Accurate
                            </span>
                          </div>
                          <PropertySketch
                            property={doc.property}
                            boundaries={doc.boundaries}
                            showOverlay={false}
                          />
                        </div>
                      </div>
                    ) : (
                      <PropertySketch
                        property={doc.property}
                        boundaries={doc.boundaries}
                        overlayImage={manualSketchImage || undefined}
                        overlayOpacity={overlayOpacity}
                        showOverlay={sketchViewMode === 'overlay' && !!manualSketchImage}
                      />
                    )}
                  </div>

                  {/* Quick Sketch Legend */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-100 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-300"></span>
                      <span>Area Under Regn: {doc.property.areaSqYards || 0} Yds</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300"></span>
                      <span>
                        Road: {doc.boundaries.roadSides.length > 0 ? doc.boundaries.roadSides.join(', ') : 'None'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Output Legal Text Preview Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Legal Description Output Text
                      </span>
                      <span className="text-[10px] bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                        CAPITAL LETTERS
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const fullLegalText = `${legalDesc.title}\n\n${legalDesc.propertyDescription}\n\nEXECUTANT/S: ${legalDesc.executantText}\n\nCLAIMANT/S: ${legalDesc.claimantText}`.toUpperCase();
                          navigator.clipboard.writeText(fullLegalText);
                          setCopiedLegalText(true);
                          setTimeout(() => setCopiedLegalText(false), 2000);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                        title="Copy text in Capital Letters"
                      >
                        {copiedLegalText ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">COPIED</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5 text-slate-600" />
                            <span>COPY TEXT</span>
                          </>
                        )}
                      </button>
                      <span className="text-[10px] text-slate-400 font-mono">Format 5</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-900 font-serif uppercase tracking-normal select-all">
                    <p className="font-bold text-center border-b border-slate-200 pb-1.5 mb-2.5 tracking-wider uppercase text-slate-900">
                      {legalDesc.title.toUpperCase()}
                    </p>
                    <p className="mb-2.5 uppercase font-medium leading-relaxed text-slate-900">
                      {legalDesc.propertyDescription.toUpperCase()}
                    </p>
                    <div className="space-y-1 pt-2 border-t border-slate-200/70 text-[11px] text-slate-700 uppercase">
                      <p>
                        <span className="font-bold text-slate-900">EXECUTANT/S: </span>
                        {legalDesc.executantText.toUpperCase()}
                      </p>
                      <p>
                        <span className="font-bold text-slate-900">CLAIMANT/S: </span>
                        {legalDesc.claimantText.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">
                      Auto-syncs in CAPITAL LETTERS with registration document
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="btn-download-word-deed-main"
                        onClick={async () => {
                          try {
                            const sketchElem = document.getElementById('property-sketch-viewport') || document.querySelector('svg');
                            await downloadWord2007DeedDocx(doc, sketchElem as HTMLElement);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="px-3 py-1.5 bg-neutral-950 hover:bg-black text-[#ffedd5] border border-neutral-700 font-mono text-xs font-bold rounded-lg cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
                        title="Download Word 2007 deed document (.docx)"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>Download Word 2007 deed (.docx)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('preview')}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                      >
                        Open Full Document
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Library Modal */}
      <SavedPlansModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        initialTab={libraryInitialTab}
        onSaveCurrentPlan={handleSavePlan}
        onLoadPlan={(plan) => {
          setDoc(plan);
          showToast(`Loaded "${plan.title}"`);
        }}
        currentPlan={doc}
      />

      {/* Manual Handwritten Sketch / PDF Upload & AI Drawing Modal */}
      <ManualSketchUploadModal
        isOpen={isManualUploadOpen}
        onClose={() => setIsManualUploadOpen(false)}
        currentPlan={doc}
        onApplyPlan={(updatedPlan, sketchImageUrl) => {
          setDoc(updatedPlan);
          setManualSketchImage(sketchImageUrl);
          setSketchViewMode('side-by-side');
          showToast('చేతితో గీసిన ప్లాన్ వివరాలు ఆటోమేటిక్‌గా అప్లై చేయబడ్డాయి (Sketch & Dimensions Applied)!');
          const sketchElement = document.getElementById('live-sketch-panel');
          if (sketchElement) {
            sketchElement.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />
    </div>
  );
}
