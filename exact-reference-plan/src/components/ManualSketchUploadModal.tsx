import React, { useState, useRef } from 'react';
import { PlanDocument } from '../types';
import {
  analyzeManualSketch,
  applyExtractedDataToPlan,
  ExtractedSketchData,
} from '../services/sketchAiService';
import { SAMPLE_MANUAL_SKETCHES, SampleManualSketch } from '../data/sampleSketches';
import {
  Upload,
  Camera,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Eye,
  Sliders,
  X,
  Compass,
  Building2,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ManualSketchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: PlanDocument;
  onApplyPlan: (
    updatedPlan: PlanDocument,
    sketchImageUrl: string,
    extractedData: ExtractedSketchData
  ) => void;
}

export const ManualSketchUploadModal: React.FC<ManualSketchUploadModalProps> = ({
  isOpen,
  onClose,
  currentPlan,
  onApplyPlan,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedSketchData | null>(null);
  const [editableData, setEditableData] = useState<ExtractedSketchData | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      setSelectedImage(result);
      setMimeType(file.type || 'image/jpeg');
      setExtractedData(null);
      setEditableData(null);
      setAnalysisError(null);
      setSelectedSampleId(null);
      // Automatically trigger analysis
      triggerScan(result, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      setSelectedImage(result);
      setMimeType(file.type || 'image/jpeg');
      setExtractedData(null);
      setEditableData(null);
      setAnalysisError(null);
      setSelectedSampleId(null);
      triggerScan(result, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  // Handle Sample selection
  const handleSelectSample = (sample: SampleManualSketch) => {
    setSelectedImage(sample.dataUrl);
    setMimeType('image/svg+xml');
    setSelectedSampleId(sample.id);
    setExtractedData(sample.expectedData);
    setEditableData(JSON.parse(JSON.stringify(sample.expectedData)));
    setAnalysisError(null);
  };

  // Trigger Gemini AI Scan
  const triggerScan = async (imgData: string, mime: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await analyzeManualSketch(imgData, mime);
      setExtractedData(result);
      setEditableData(JSON.parse(JSON.stringify(result)));
    } catch (err: any) {
      console.warn('Backend scan failed, attempting fallback or checking error:', err);
      setAnalysisError(
        err?.message ||
          'Could not analyze the image automatically. Please verify your manual drawing is clearly visible, or try a sample drawing.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply to CAD drawing
  const handleApply = () => {
    if (!editableData || !selectedImage) return;
    const updatedPlan = applyExtractedDataToPlan(currentPlan, editableData);
    onApplyPlan(updatedPlan, selectedImage, editableData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/30 rounded-xl border border-rose-400/30">
              <Camera className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  Upload Manual Drawing / చేతితో గీసిన ప్లాన్ అప్‌లోడ్
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full uppercase tracking-wider">
                  AI Same to Same
                </span>
              </div>
              <p className="text-xs text-slate-300">
                చేతితో గీసిన ప్లాన్ ఫోటో అప్‌లోడ్ చేయండి — కొలతలు, రోడ్డు, హద్దులను గుర్తించి సేమ్ టు సేమ్ డ్రాయింగ్ అందిస్తుంది.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto min-h-0">
          {/* Quick Upload / Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              selectedImage
                ? 'border-emerald-400 bg-emerald-50/20'
                : 'border-slate-300 hover:border-rose-400 bg-slate-50 hover:bg-rose-50/20'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.pdf"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />

            {!selectedImage ? (
              <div className="space-y-3">
                <div className="flex justify-center gap-3">
                  <div className="p-3 bg-white shadow-xs rounded-xl text-rose-700 border border-rose-100">
                    <Upload className="w-7 h-7" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    మీరు చేతితో గీసిన డ్రాయింగ్ ఫోటోను ఇక్కడ వేయండి (Drop Image Here)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supports JPG, PNG, WEBP, or Camera capture from paper / notebook sketch
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-all"
                  >
                    <FileImage className="w-4 h-4" />
                    Browse Photo / ఫైల్ ఎంచుకోండి
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo with Camera / కెమెరాతో తీయండి
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center text-left">
                {/* Image Preview with Scan Animation */}
                <div className="md:col-span-5 relative rounded-lg overflow-hidden border border-slate-300 bg-white shadow-xs group">
                  <img
                    src={selectedImage}
                    alt="Uploaded Manual Plan"
                    className="w-full h-56 object-contain bg-slate-100 p-2"
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-rose-950/40 backdrop-blur-2xs flex flex-col items-center justify-center text-white p-4">
                      {/* Animated scanning bar */}
                      <div className="w-full h-1 bg-rose-400 absolute top-0 animate-pulse shadow-[0_0_12px_#f43f5e]"></div>
                      <RefreshCw className="w-7 h-7 text-rose-300 animate-spin mb-2" />
                      <span className="text-xs font-bold text-center">
                        AI Recognising Plan & Dimensions...
                      </span>
                      <span className="text-[11px] text-rose-200 text-center mt-1">
                        కొలతలు & రోడ్డు గుర్తిస్తోంది...
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-1 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] rounded font-medium shadow-xs cursor-pointer transition-all"
                    >
                      Change Photo
                    </button>
                  </div>
                </div>

                {/* Upload Status & Actions */}
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Manual Plan Image Loaded (డ్రాయింగ్ అందింది)
                      </span>
                    </div>
                    {!isAnalyzing && (
                      <button
                        type="button"
                        onClick={() => triggerScan(selectedImage, mimeType)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-800 hover:underline cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Re-Scan / మళ్లీ స్కాన్
                      </button>
                    )}
                  </div>

                  {analysisError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        Notice / గమనిక
                      </div>
                      <p>{analysisError}</p>
                      <p className="text-[11px] text-amber-700 pt-1">
                        Tip: You can select one of the built-in sample drawings below to test immediately, or manually verify dimensions on the form.
                      </p>
                    </div>
                  )}

                  {editableData && (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
                        <span className="font-semibold">
                          ✨ AI successfully identified {editableData.propertyType || 'Plot'} dimensions & road!
                        </span>
                        <span className="font-bold text-emerald-800">
                          {editableData.roadLayoutType || 'Road Identified'}
                        </span>
                      </div>
                      {editableData.summaryNotes && (
                        <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                          "{editableData.summaryNotes}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Demo Test Section: Try Hand-Drawn Samples */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                చేతితో గీసిన డ్రాయింగ్ నమూనాలు (Try Sample Hand-Drawn Sketches)
              </span>
              <span className="text-[11px] text-slate-500">
                ఫోటో లేకపోతే వెంటనే పరీక్షించడానికి నమూనాను ఎంచుకోండి
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SAMPLE_MANUAL_SKETCHES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                    selectedSampleId === sample.id
                      ? 'border-rose-500 bg-rose-50/50 shadow-xs ring-2 ring-rose-300/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <img
                    src={sample.dataUrl}
                    alt={sample.title}
                    className="w-16 h-16 object-contain rounded bg-amber-50/40 border border-slate-200 shrink-0 p-1"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">{sample.teluguTitle}</div>
                    <div className="text-[11px] text-slate-600 font-medium">{sample.title}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-1">{sample.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Extracted Data Review & Fine-Tune Table */}
          {editableData && (
            <div className="space-y-4 pt-3 border-t border-slate-200 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-rose-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Extracted Drawing Dimensions / గుర్తించిన కొలతలు
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500">
                  సేమ్ టు సేమ్ సరిపోల్చుకోండి (Review & adjust if needed)
                </span>
              </div>

              {/* 4 Sides Measurements & Boundary Names Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>NORTH (ఉత్తరం)</span>
                    <span className="text-[10px] text-slate-500">కొలత</span>
                  </div>
                  <input
                    type="text"
                    value={editableData.northDim}
                    onChange={(e) =>
                      setEditableData({ ...editableData, northDim: e.target.value })
                    }
                    placeholder="e.g. 40'-0&quot;"
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded font-mono text-slate-900 focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="text-[10px] text-slate-500 font-semibold">హద్దు (Boundary):</div>
                  <input
                    type="text"
                    value={editableData.northBoundary || ''}
                    onChange={(e) =>
                      setEditableData({ ...editableData, northBoundary: e.target.value })
                    }
                    placeholder="e.g. Plot No. 24"
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-800"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>SOUTH (దక్షిణం)</span>
                    <span className="text-[10px] text-slate-500">కొలత</span>
                  </div>
                  <input
                    type="text"
                    value={editableData.southDim}
                    onChange={(e) =>
                      setEditableData({ ...editableData, southDim: e.target.value })
                    }
                    placeholder="e.g. 40'-0&quot;"
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded font-mono text-slate-900 focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="text-[10px] text-slate-500 font-semibold">హద్దు (Boundary):</div>
                  <input
                    type="text"
                    value={editableData.southBoundary || ''}
                    onChange={(e) =>
                      setEditableData({ ...editableData, southBoundary: e.target.value })
                    }
                    placeholder="e.g. 30'-0&quot; Wide Road"
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-800"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>EAST (తూర్పు)</span>
                    <span className="text-[10px] text-slate-500">కొలత</span>
                  </div>
                  <input
                    type="text"
                    value={editableData.eastDim}
                    onChange={(e) =>
                      setEditableData({ ...editableData, eastDim: e.target.value })
                    }
                    placeholder="e.g. 60'-0&quot;"
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded font-mono text-slate-900 focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="text-[10px] text-slate-500 font-semibold">హద్దు (Boundary):</div>
                  <input
                    type="text"
                    value={editableData.eastBoundary || ''}
                    onChange={(e) =>
                      setEditableData({ ...editableData, eastBoundary: e.target.value })
                    }
                    placeholder="e.g. Plot No. 12"
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-800"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>WEST (పడమర)</span>
                    <span className="text-[10px] text-slate-500">కొలత</span>
                  </div>
                  <input
                    type="text"
                    value={editableData.westDim}
                    onChange={(e) =>
                      setEditableData({ ...editableData, westDim: e.target.value })
                    }
                    placeholder="e.g. 60'-0&quot;"
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded font-mono text-slate-900 focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="text-[10px] text-slate-500 font-semibold">హద్దు (Boundary):</div>
                  <input
                    type="text"
                    value={editableData.westBoundary || ''}
                    onChange={(e) =>
                      setEditableData({ ...editableData, westBoundary: e.target.value })
                    }
                    placeholder="e.g. Neighbour's Land"
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-800"
                  />
                </div>
              </div>

              {/* Property Identifiers: Plot, Survey, House No & Area */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] font-semibold text-slate-600">Plot No. (ప్లాట్ నెం)</span>
                  <input
                    type="text"
                    value={editableData.plotNo || ''}
                    onChange={(e) =>
                      setEditableData({ ...editableData, plotNo: e.target.value })
                    }
                    placeholder="e.g. 24"
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-medium text-slate-900 mt-0.5"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-600">Survey No. (సర్వే నెం)</span>
                  <input
                    type="text"
                    value={editableData.surveyNo || ''}
                    onChange={(e) =>
                      setEditableData({ ...editableData, surveyNo: e.target.value })
                    }
                    placeholder="e.g. 508/B"
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-medium text-slate-900 mt-0.5"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-600">House No. (హౌస్ నెం)</span>
                  <input
                    type="text"
                    value={editableData.houseNo || ''}
                    onChange={(e) =>
                      setEditableData({ ...editableData, houseNo: e.target.value })
                    }
                    placeholder="e.g. 6-5-48/2"
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-medium text-slate-900 mt-0.5"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-600">Total Area (Sq.Yards)</span>
                  <input
                    type="number"
                    value={editableData.areaSqYards || ''}
                    onChange={(e) =>
                      setEditableData({ ...editableData, areaSqYards: e.target.value ? parseFloat(e.target.value) : '' })
                    }
                    placeholder="e.g. 266.67"
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-medium text-slate-900 mt-0.5"
                  />
                </div>
              </div>

              {/* Road & Layout Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Road Width</span>
                  <input
                    type="text"
                    value={editableData.roadWidth || "30'-0\""}
                    onChange={(e) =>
                      setEditableData({ ...editableData, roadWidth: e.target.value })
                    }
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-medium text-slate-900"
                  />
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Road Sides</span>
                  <div className="flex gap-1">
                    {(['North', 'South', 'East', 'West'] as const).map((side) => {
                      const isSelected = editableData.roadSides?.includes(side);
                      return (
                        <button
                          key={side}
                          type="button"
                          onClick={() => {
                            const current = editableData.roadSides || [];
                            const updated = current.includes(side)
                              ? current.filter((s) => s !== side)
                              : [...current, side];
                            setEditableData({ ...editableData, roadSides: updated });
                          }}
                          className={`flex-1 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-rose-700 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {side[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Road Layout</span>
                  <select
                    value={editableData.roadLayoutType || 'One Side Road'}
                    onChange={(e) =>
                      setEditableData({ ...editableData, roadLayoutType: e.target.value })
                    }
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded font-medium text-slate-900"
                  >
                    <option value="One Side Road">One Side Road (సింగిల్ రోడ్డు)</option>
                    <option value="Two Side Road / Corner">Two Side / Corner (కార్నర్)</option>
                    <option value="Three Side Road">Three Side Road</option>
                    <option value="Four Side Road / Island">Four Side / Island</option>
                    <option value="T-Junction">T-Junction (ఎదురు రోడ్డు)</option>
                    <option value="Dead-End / Cul-de-Sac">Dead-End / Cul-de-Sac (చివరి రోడ్డు)</option>
                  </select>
                </div>
              </div>

              {/* If House is detected */}
              {editableData.house?.enabled && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <Building2 className="w-4 h-4 text-amber-700" />
                    House Structure Detected in Sketch (ఇంటి నిర్మాణం గుర్తించబడింది)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-amber-800">Width:</span>
                      <div className="font-bold">{editableData.house.widthFeet} Feet</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-800">Length:</span>
                      <div className="font-bold">{editableData.house.lengthFeet} Feet</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-800">Structure:</span>
                      <div className="font-bold truncate">{editableData.house.structureType}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-800">Setbacks:</span>
                      <div className="font-bold">N:3' S:5' E:4' W:3'</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Layers className="w-4 h-4 text-slate-400" />
            <span>
              వర్తింపజేయగానే ఆటోమేటిక్ గా సేమ్ టు సేమ్ డ్రాయింగ్ మరియు ట్రేసింగ్ మోడ్ వస్తాయి.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer transition-all"
            >
              Cancel (రద్దు చేయండి)
            </button>

            <button
              type="button"
              id="btn-apply-manual-sketch"
              onClick={handleApply}
              disabled={!editableData}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all ${
                editableData
                  ? 'bg-rose-700 hover:bg-rose-800 text-white cursor-pointer shadow-rose-700/20'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Apply Same to Same Drawing / సేమ్ టు సేమ్ డ్రాయింగ్ వర్తింపు
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
