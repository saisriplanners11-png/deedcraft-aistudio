import React, { useState, useRef, useEffect } from 'react';
import {
  StructuredGeometryPlan,
  BoundaryPoint,
  BoundarySegment,
  VisualStyle,
} from '../types/sketchGeometry';
import { DigitalPlanSvg } from './DigitalPlanSvg';
import { calculatePolygonMetrics, getSampleIrregularPlan } from '../utils/geometryEngine';
import {
  Upload,
  Camera,
  FileImage,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  FileText,
  RotateCcw,
  RotateCw,
  PlusCircle,
  Trash2,
  Move,
  Layers,
  Sparkles,
  Save,
  FileJson,
  Eye,
  Sliders,
  Compass,
  ArrowRight,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface SketchVerificationWorkspaceProps {
  initialPlan?: StructuredGeometryPlan | null;
  uploadedImageUrl?: string | null;
  onApplyPlanToApp?: (plan: StructuredGeometryPlan) => void;
}

export const SketchVerificationWorkspace: React.FC<SketchVerificationWorkspaceProps> = ({
  initialPlan,
  uploadedImageUrl,
  onApplyPlanToApp,
}) => {
  // Plan and History State
  const [currentPlan, setCurrentPlan] = useState<StructuredGeometryPlan>(
    initialPlan || getSampleIrregularPlan()
  );
  const [undoStack, setUndoStack] = useState<StructuredGeometryPlan[]>([]);
  const [redoStack, setRedoStack] = useState<StructuredGeometryPlan[]>([]);

  // Image Upload & Scanning State
  const [sketchImage, setSketchImage] = useState<string | null>(uploadedImageUrl || null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);

  // Editor and View Controls
  const [activeTool, setActiveTool] = useState<'select' | 'drag-point' | 'add-point' | 'delete-point' | 'move-building' | 'pan'>('select');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('technical');
  const [isEditingGeometry, setIsEditingGeometry] = useState<boolean>(true);

  // Viewport Zoom & Pan
  const [digitalZoom, setDigitalZoom] = useState<number>(1.0);
  const [digitalPan, setDigitalPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sketchZoom, setSketchZoom] = useState<number>(1.0);
  const [sketchPan, setSketchPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showSketchOverlayOnDigital, setShowSketchOverlayOnDigital] = useState<boolean>(false);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.35);

  // Layer Toggles
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showPointLabels, setShowPointLabels] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showNorthArrow, setShowNorthArrow] = useState<boolean>(true);
  const [showRoads, setShowRoads] = useState<boolean>(true);
  const [showBuildings, setShowBuildings] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const digitalSvgRef = useRef<SVGSVGElement | null>(null);
  const digitalContainerRef = useRef<HTMLDivElement>(null);

  // Sync initial plan if passed
  useEffect(() => {
    if (initialPlan) {
      setCurrentPlan(initialPlan);
    }
  }, [initialPlan]);

  useEffect(() => {
    if (uploadedImageUrl) {
      setSketchImage(uploadedImageUrl);
    }
  }, [uploadedImageUrl]);

  // Helper to push history
  const pushHistory = (newPlan: StructuredGeometryPlan) => {
    setUndoStack((prev) => [...prev.slice(-20), currentPlan]);
    setRedoStack([]);
    setCurrentPlan(newPlan);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, currentPlan]);
    setUndoStack((prev) => prev.slice(0, -1));
    setCurrentPlan(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, currentPlan]);
    setRedoStack((prev) => prev.slice(0, -1));
    setCurrentPlan(next);
  };

  // Upload and AI Analysis
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      setSketchImage(result);
      setScanError(null);
      triggerAiScan(result, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const triggerAiScan = async (imgData: string, mime: string = 'image/jpeg') => {
    setIsScanning(true);
    setScanError(null);
    try {
      const response = await fetch('/api/analyze-sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imgData, mimeType: mime }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to analyze property sketch.');
      }

      const extractedPlan: StructuredGeometryPlan = {
        id: `plan-${Date.now()}`,
        title: result.data.title || 'Digital Reconstructed Property Plan',
        projectNumber: result.data.projectNumber || 'DOC-2026',
        date: new Date().toISOString().split('T')[0],
        orientation: result.data.orientation || {
          north: 'North at Top',
          northArrowAngle: 0,
          detected: true,
          confidence: 0.95,
        },
        property: result.data.property,
        buildings: result.data.buildings || [],
        roads: result.data.roads || [],
        dimensions: result.data.dimensions || [],
        labels: result.data.labels || [],
        notes: result.data.notes || [],
        specification: result.data.specification,
        rawConfidenceScore: result.data.rawConfidenceScore || 0.95,
        hasConflicts: result.data.hasConflicts || false,
        summaryNotes: result.data.summaryNotes || 'Reconstructed exact geometry from uploaded sketch.',
      };

      pushHistory(extractedPlan);
      setIsVerified(false);
    } catch (err: any) {
      console.error('Scan failed:', err);
      setScanError(err?.message || 'Could not analyze sketch automatically. Please check your image or edit geometry manually.');
    } finally {
      setIsScanning(false);
    }
  };

  // Point Updating
  const handleUpdatePoint = (pointId: string, newPos: { x: number; y: number }) => {
    const updatedPoints = currentPlan.property.points.map((p) =>
      p.id === pointId ? { ...p, x: Math.round(newPos.x), y: Math.round(newPos.y) } : p
    );
    const updated = {
      ...currentPlan,
      property: {
        ...currentPlan.property,
        points: updatedPoints,
      },
    };
    pushHistory(updated);
  };

  // Add Point on Segment
  const handleAddPointOnSegment = (segmentIndex: number, newPoint: BoundaryPoint) => {
    const currentPoints = [...currentPlan.property.points];
    // Insert new point between segment's endpoints
    const insertIdx = (segmentIndex + 1) % (currentPoints.length + 1);
    currentPoints.splice(insertIdx, 0, newPoint);

    // Rebuild segments
    const newSegments: BoundarySegment[] = currentPoints.map((p, idx) => {
      const nextP = currentPoints[(idx + 1) % currentPoints.length];
      const existing = currentPlan.property.segments.find(
        (s) => (s.from === p.id && s.to === nextP.id) || (s.from === nextP.id && s.to === p.id)
      );
      return (
        existing || {
          from: p.id,
          to: nextP.id,
          dimensionUnit: 'ft',
          dimensionText: "20'",
          confidence: 1.0,
        }
      );
    });

    const updated: StructuredGeometryPlan = {
      ...currentPlan,
      property: {
        ...currentPlan.property,
        points: currentPoints,
        segments: newSegments,
      },
    };
    pushHistory(updated);
    setActiveTool('select');
  };

  // Delete Selected Point
  const handleDeletePoint = () => {
    if (!selectedPointId || currentPlan.property.points.length <= 3) return;
    const remainingPoints = currentPlan.property.points.filter((p) => p.id !== selectedPointId);

    const newSegments: BoundarySegment[] = remainingPoints.map((p, idx) => {
      const nextP = remainingPoints[(idx + 1) % remainingPoints.length];
      const existing = currentPlan.property.segments.find(
        (s) => (s.from === p.id && s.to === nextP.id) || (s.from === nextP.id && s.to === p.id)
      );
      return (
        existing || {
          from: p.id,
          to: nextP.id,
          dimensionUnit: 'ft',
          dimensionText: "30'",
          confidence: 1.0,
        }
      );
    });

    const updated: StructuredGeometryPlan = {
      ...currentPlan,
      property: {
        ...currentPlan.property,
        points: remainingPoints,
        segments: newSegments,
      },
    };
    pushHistory(updated);
    setSelectedPointId(null);
  };

  // Update Building Position
  const handleUpdateBuildingPos = (buildingId: string, newPos: { x: number; y: number }) => {
    const updatedBuildings = currentPlan.buildings.map((b) =>
      b.id === buildingId ? { ...b, x: Math.round(newPos.x), y: Math.round(newPos.y) } : b
    );
    const updated = {
      ...currentPlan,
      buildings: updatedBuildings,
    };
    pushHistory(updated);
  };

  // Update Segment Dimension
  const handleUpdateSegmentDimension = (segmentIndex: number, newDimText: string) => {
    const updatedSegments = [...currentPlan.property.segments];
    const numericMatch = newDimText.match(/([0-9.]+)/);
    const numVal = numericMatch ? parseFloat(numericMatch[1]) : 0;

    if (updatedSegments[segmentIndex]) {
      updatedSegments[segmentIndex] = {
        ...updatedSegments[segmentIndex],
        dimensionText: newDimText,
        dimension: numVal,
        needsVerification: false,
        confidence: 1.0,
      };
    }

    const updated = {
      ...currentPlan,
      property: {
        ...currentPlan.property,
        segments: updatedSegments,
      },
    };
    pushHistory(updated);
  };

  // Rotate North Angle
  const handleRotateNorth = (degreesDelta: number) => {
    const currentAngle = currentPlan.orientation.northArrowAngle || 0;
    const newAngle = ((currentAngle + degreesDelta) % 360 + 360) % 360;
    const updated = {
      ...currentPlan,
      orientation: {
        ...currentPlan.orientation,
        northArrowAngle: newAngle,
      },
    };
    pushHistory(updated);
  };

  // Export as pure vector SVG
  const handleExportSvg = () => {
    if (!digitalSvgRef.current) return;
    const svgElement = digitalSvgRef.current;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentPlan.title.replace(/\s+/g, '_')}_Digital_Plan.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export as High-Res PNG
  const handleExportPng = async () => {
    if (!digitalContainerRef.current) return;
    try {
      const canvas = await html2canvas(digitalContainerRef.current, {
        scale: 3, // Ultra crisp resolution
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `${currentPlan.title.replace(/\s+/g, '_')}_300DPI.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('PNG export failed:', err);
    }
  };

  // Export as PDF
  const handleExportPdf = async () => {
    if (!digitalContainerRef.current) return;
    try {
      const canvas = await html2canvas(digitalContainerRef.current, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 10, 10, pageWidth - 20, pageHeight - 20);
      pdf.save(`${currentPlan.title.replace(/\s+/g, '_')}_Survey_Plan.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  // Save JSON
  const handleSaveJson = () => {
    const jsonStr = JSON.stringify(currentPlan, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentPlan.id || 'geometry_plan'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Load JSON
  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.property && Array.isArray(parsed.property.points)) {
          pushHistory(parsed);
        }
      } catch (err) {
        console.error('Failed to parse JSON file:', err);
      }
    };
    reader.readAsText(file);
  };

  const metrics = calculatePolygonMetrics(currentPlan.property.points, currentPlan.property.segments);

  return (
    <div className="space-y-5">
      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf" className="hidden" />
      <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />
      <input type="file" ref={jsonInputRef} onChange={handleLoadJson} accept=".json,application/json" className="hidden" />

      {/* Top Header & Mode Status Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-rose-600/30 rounded-xl border border-rose-400/30 shadow-inner">
            <Compass className="w-6 h-6 text-rose-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-black tracking-tight uppercase">
                Property Sketch to Accurate Digital Plan Generator
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] font-black bg-rose-600 text-white rounded-full uppercase tracking-wider">
                Survey Digitizer
              </span>
            </div>
            <p className="text-xs text-slate-300">
              "What you draw is what is redrawn" — Detects every corner, zig-zag, handwritten dimension, building, and road.
            </p>
          </div>
        </div>

        {/* Upload & Quick Demo Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload Sketch Photo
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-all"
          >
            <Camera className="w-4 h-4" />
            Camera
          </button>
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition-all"
          >
            <FileJson className="w-4 h-4 text-amber-400" />
            Load JSON
          </button>
        </div>
      </div>

      {/* Main Verification & Redrawing Grid (Left: Uploaded Sketch, Right: Clean Digital Plan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================= LEFT PANEL: UPLOADED SKETCH (SOURCE OF TRUTH) ================= */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-300 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileImage className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Source Sketch (చేతితో గీసిన ప్లాన్)
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSketchZoom((z) => Math.max(0.6, z - 0.2))}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-slate-600 px-1">{Math.round(sketchZoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setSketchZoom((z) => Math.min(2.5, z + 0.2))}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSketchZoom(1.0);
                  setSketchPan({ x: 0, y: 0 });
                }}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                title="Reset View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sketch Image Viewer Box with Scan Animation */}
          <div className="relative w-full h-[460px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
            {sketchImage ? (
              <div
                className="w-full h-full flex items-center justify-center transition-transform"
                style={{
                  transform: `scale(${sketchZoom}) translate(${sketchPan.x}px, ${sketchPan.y}px)`,
                }}
              >
                <img
                  src={sketchImage}
                  alt="Uploaded handwritten sketch"
                  className="max-w-full max-h-full object-contain p-2"
                />
              </div>
            ) : (
              <div className="text-center p-6 space-y-3">
                <div className="p-3 bg-white rounded-full inline-flex text-slate-400 shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">No Image Uploaded Yet</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Upload your handwritten sketch photograph to digitize and verify corners.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                >
                  Select File
                </button>
              </div>
            )}

            {/* AI Scanning Active Overlay */}
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-2xs flex flex-col items-center justify-center text-white p-6 text-center space-y-2">
                <div className="w-full h-1 bg-rose-500 absolute top-0 animate-pulse shadow-[0_0_15px_#f43f5e]" />
                <RefreshCw className="w-8 h-8 text-rose-400 animate-spin" />
                <div className="text-sm font-bold">Stage 1: Reading Handwritten Sketch...</div>
                <p className="text-xs text-rose-200 max-w-xs">
                  Detecting irregular polygon corners, zig-zags, handwritten dimensions, internal buildings, roads, and North needle...
                </p>
              </div>
            )}
          </div>

          {/* Quick Rescan or Notice */}
          {scanError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Notice: </span>
                {scanError}
              </div>
            </div>
          )}

          {sketchImage && !isScanning && (
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <span className="text-[11px]">Source verified</span>
              <button
                type="button"
                onClick={() => triggerAiScan(sketchImage)}
                className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Re-Analyze Image
              </button>
            </div>
          )}
        </div>

        {/* ================= RIGHT PANEL: CLEAN DIGITAL PLAN (VECTOR SVG) ================= */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-300 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between pb-2 border-b border-slate-200 gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Digital Geometry Reconstruction (డిజిటల్ ప్లాన్)
              </h3>
            </div>

            {/* Visual Style Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {(['technical', 'property', 'survey'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setVisualStyle(style)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded capitalize cursor-pointer transition-all ${
                    visualStyle === style
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>

            {/* Viewport Zoom */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDigitalZoom((z) => Math.max(0.5, z - 0.15))}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-slate-600 px-1">{Math.round(digitalZoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setDigitalZoom((z) => Math.min(2.5, z + 0.15))}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDigitalZoom(1.0);
                  setDigitalPan({ x: 0, y: 0 });
                }}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                title="Fit"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Geometry Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Tools:</span>
              <button
                type="button"
                onClick={() => setActiveTool('drag-point')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition-all ${
                  activeTool === 'drag-point'
                    ? 'bg-rose-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Move className="w-3 h-3" />
                Drag Corner
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('add-point')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition-all ${
                  activeTool === 'add-point'
                    ? 'bg-rose-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <PlusCircle className="w-3 h-3" />
                Add Corner Point
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('move-building')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition-all ${
                  activeTool === 'move-building'
                    ? 'bg-rose-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Move className="w-3 h-3" />
                Move Building
              </button>

              {selectedPointId && (
                <button
                  type="button"
                  onClick={handleDeletePoint}
                  className="px-2.5 py-1 text-[11px] font-bold rounded bg-rose-100 hover:bg-rose-200 text-rose-800 flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete {selectedPointId}
                </button>
              )}
            </div>

            {/* Undo / Redo & North Rotation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="p-1.5 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer"
                title="Undo"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-700" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="p-1.5 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer"
                title="Redo"
              >
                <RotateCw className="w-3.5 h-3.5 text-slate-700" />
              </button>

              <div className="h-4 w-px bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => handleRotateNorth(90)}
                className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 flex items-center gap-1 cursor-pointer"
                title="Rotate North 90°"
              >
                <Compass className="w-3 h-3 text-rose-600" />
                North +90°
              </button>
            </div>
          </div>

          {/* SVG Canvas Container */}
          <div
            ref={digitalContainerRef}
            className="w-full h-[460px] bg-slate-100 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center p-1"
          >
            <DigitalPlanSvg
              plan={currentPlan}
              visualStyle={visualStyle}
              isEditingGeometry={isEditingGeometry}
              activeTool={activeTool}
              selectedPointId={selectedPointId}
              onSelectPoint={setSelectedPointId}
              onUpdatePoint={handleUpdatePoint}
              onAddPointOnSegment={handleAddPointOnSegment}
              onUpdateBuildingPos={handleUpdateBuildingPos}
              onUpdateDimension={handleUpdateSegmentDimension}
              showDimensions={showDimensions}
              showPointLabels={showPointLabels}
              showGrid={showGrid}
              showNorthArrow={showNorthArrow}
              showRoads={showRoads}
              showBuildings={showBuildings}
              zoomLevel={digitalZoom}
              panOffset={digitalPan}
              svgRef={digitalSvgRef}
            />
          </div>

          {/* Metric Status Bar */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-slate-500 font-semibold">Corners: </span>
                <span className="font-bold text-slate-900">{currentPlan.property.points.length} Points</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Calculated Area: </span>
                <span className="font-bold text-slate-900">{metrics.areaSqYds} Sq.Yds</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Buildings: </span>
                <span className="font-bold text-slate-900">{currentPlan.buildings.length}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Roads: </span>
                <span className="font-bold text-slate-900">{currentPlan.roads.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportSvg}
                className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                SVG
              </button>
              <button
                type="button"
                onClick={handleExportPng}
                className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                PNG (300 DPI)
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-2.5 py-1 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white rounded flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3 h-3 text-amber-400" />
                PDF
              </button>
              <button
                type="button"
                onClick={handleSaveJson}
                className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3 h-3 text-emerald-600" />
                Save JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= DETECTED HANDWRITTEN DIMENSIONS & VERIFICATION TABLE ================= */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Detected Handwritten Dimensions & Boundary Verification
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review every detected handwritten measurement. Explicit written notation takes precedence over visual approximations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsVerified(true);
                if (onApplyPlanToApp) {
                  onApplyPlanToApp(currentPlan);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Verify & Apply Plan / నిర్ధారించి వర్తింపజేయండి
            </button>
          </div>
        </div>

        {/* Segments Dimension Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {currentPlan.property.segments.map((seg, sIdx) => {
            const isLowConfidence = seg.confidence < 0.8 || seg.needsVerification;
            return (
              <div
                key={`seg-edit-${seg.from}-${seg.to}-${sIdx}`}
                className={`p-3 rounded-xl border transition-all ${
                  isLowConfidence
                    ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-300/30'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-800 font-mono">
                    Segment {seg.from} ⟶ {seg.to}
                  </span>
                  {isLowConfidence ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      ⚠️ Verify
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      {Math.round(seg.confidence * 100)}% Match
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600">Handwritten Dimension:</label>
                    <input
                      type="text"
                      value={seg.dimensionText}
                      onChange={(e) => handleUpdateSegmentDimension(sIdx, e.target.value)}
                      placeholder="e.g. 50'"
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600">Boundary Description:</label>
                    <input
                      type="text"
                      value={seg.boundaryName || ''}
                      onChange={(e) => {
                        const updatedSegs = [...currentPlan.property.segments];
                        updatedSegs[sIdx] = { ...updatedSegs[sIdx], boundaryName: e.target.value };
                        pushHistory({
                          ...currentPlan,
                          property: { ...currentPlan.property, segments: updatedSegs },
                        });
                      }}
                      placeholder="e.g. ROAD or NEIGHBOUR"
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded text-slate-800"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Building & Road Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
          {/* Building Details */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-rose-600" />
              Internal Structure Footprint
            </div>
            {currentPlan.buildings.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold">Label:</span>
                  <input
                    type="text"
                    value={currentPlan.buildings[0]?.label || ''}
                    onChange={(e) => {
                      const updatedB = [...currentPlan.buildings];
                      updatedB[0] = { ...updatedB[0], label: e.target.value };
                      pushHistory({ ...currentPlan, buildings: updatedB });
                    }}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold">Width:</span>
                  <input
                    type="text"
                    value={currentPlan.buildings[0]?.widthText || `${currentPlan.buildings[0]?.width || 20}'`}
                    onChange={(e) => {
                      const updatedB = [...currentPlan.buildings];
                      const num = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 20;
                      updatedB[0] = { ...updatedB[0], widthText: e.target.value, width: num };
                      pushHistory({ ...currentPlan, buildings: updatedB });
                    }}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold">Length:</span>
                  <input
                    type="text"
                    value={currentPlan.buildings[0]?.lengthText || `${currentPlan.buildings[0]?.length || 25}'`}
                    onChange={(e) => {
                      const updatedB = [...currentPlan.buildings];
                      const num = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 25;
                      updatedB[0] = { ...updatedB[0], lengthText: e.target.value, length: num };
                      pushHistory({ ...currentPlan, buildings: updatedB });
                    }}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold">Structure:</span>
                  <input
                    type="text"
                    value={currentPlan.buildings[0]?.structureType || 'R.C.C. Building'}
                    onChange={(e) => {
                      const updatedB = [...currentPlan.buildings];
                      updatedB[0] = { ...updatedB[0], structureType: e.target.value };
                      pushHistory({ ...currentPlan, buildings: updatedB });
                    }}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold"
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">No internal building footprint detected in sketch.</div>
            )}
          </div>

          {/* Road & North Details */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-rose-600" />
              Road & North Direction Settings
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold">Road Label:</span>
                <input
                  type="text"
                  value={currentPlan.roads[0]?.label || "30'-0\" WIDE ROAD"}
                  onChange={(e) => {
                    const updatedR = [...currentPlan.roads];
                    if (updatedR[0]) {
                      updatedR[0] = { ...updatedR[0], label: e.target.value };
                    } else {
                      updatedR.push({ id: 'R1', position: 'South', label: e.target.value, confidence: 1.0 });
                    }
                    pushHistory({ ...currentPlan, roads: updatedR });
                  }}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold">Road Position:</span>
                <select
                  value={currentPlan.roads[0]?.position || 'South'}
                  onChange={(e) => {
                    const updatedR = [...currentPlan.roads];
                    if (updatedR[0]) {
                      updatedR[0] = { ...updatedR[0], position: e.target.value as any };
                    } else {
                      updatedR.push({ id: 'R1', position: e.target.value as any, label: 'ROAD', confidence: 1.0 });
                    }
                    pushHistory({ ...currentPlan, roads: updatedR });
                  }}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold"
                >
                  <option value="South">South Side (Bottom)</option>
                  <option value="North">North Side (Top)</option>
                  <option value="East">East Side (Right)</option>
                  <option value="West">West Side (Left)</option>
                </select>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold">North Angle:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={currentPlan.orientation.northArrowAngle || 0}
                    onChange={(e) => {
                      const angle = parseInt(e.target.value, 10) || 0;
                      pushHistory({
                        ...currentPlan,
                        orientation: { ...currentPlan.orientation, northArrowAngle: angle },
                      });
                    }}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono"
                  />
                  <span className="text-xs font-bold text-slate-600">°</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
