import React, { useRef, useState } from 'react';
import { PlanDocument, ValidationIssue, BoundaryDimensions, PropertyDetails } from '../types';
import { PropertySketch } from './PropertySketch';
import { generateLegalDescription, rotateBoundariesByQuarterTurns, parseDimension } from '../utils/dimensionUtils';
import { Printer, Download, Edit3, AlertTriangle, CheckCircle2, Copy, FileCheck, RefreshCw, FileText, RotateCw, Compass, Split, Sparkles } from 'lucide-react';
import jsPDF from 'jspdf';
import { capturePlan } from '../../../exact-reference-plan/src/utils/capturePlan';
import { Document, Packer, Paragraph, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { downloadWord2007DeedDocx } from '../utils/deedDocxExporter';

interface PlanPreviewProps {
  document: PlanDocument;
  validationIssues: ValidationIssue[];
  onEdit: () => void;
  onSave: () => void;
  onNewPlan: () => void;
  onUpdateBoundaries?: (boundaries: BoundaryDimensions) => void;
  onUpdateProperty?: (property: PropertyDetails) => void;
}

export const PlanPreview: React.FC<PlanPreviewProps> = ({
  document: doc,
  validationIssues,
  onEdit,
  onSave,
  onNewPlan,
  onUpdateBoundaries,
  onUpdateProperty,
}) => {
  const printContainerRef = useRef<HTMLDivElement>(null);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [syncNorthWithMap, setSyncNorthWithMap] = useState(true);
  const [autoAlignBoundariesWithMap, setAutoAlignBoundariesWithMap] = useState(true);

  const handleToggleSyncNorth = (checked: boolean) => {
    setSyncNorthWithMap(checked);
    if (checked && onUpdateBoundaries) {
      const currentMapRot = doc.boundaries.mapRotation || 0;
      onUpdateBoundaries({
        ...doc.boundaries,
        northRotation: currentMapRot,
      });
    }
  };

  const handlePreviewMapRotation = (angleInput: number) => {
    if (!onUpdateBoundaries) return;
    const newAngle = ((Math.round(angleInput) % 360) + 360) % 360;

    if (syncNorthWithMap) {
      onUpdateBoundaries({
        ...doc.boundaries,
        mapRotation: newAngle,
        northRotation: newAngle,
      });
    } else {
      onUpdateBoundaries({
        ...doc.boundaries,
        mapRotation: newAngle,
      });
    }
  };

  const handlePreviewNorthRotation = (angleInput: number) => {
    if (!onUpdateBoundaries) return;
    const newAngle = ((Math.round(angleInput) % 360) + 360) % 360;

    if (syncNorthWithMap) {
      onUpdateBoundaries({
        ...doc.boundaries,
        northRotation: newAngle,
        mapRotation: newAngle,
      });
    } else {
      onUpdateBoundaries({
        ...doc.boundaries,
        northRotation: newAngle,
      });
    }
  };

  const handlePreviewAlignBoundaries = () => {
    if (!onUpdateBoundaries) return;
    const currentMapRot = doc.boundaries.mapRotation || 0;
    const quarterTurn = Math.round(currentMapRot / 90) % 4;
    const turns = ((quarterTurn % 4) + 4) % 4;
    const shifted = rotateBoundariesByQuarterTurns(doc.boundaries, turns === 0 ? 1 : turns);
    onUpdateBoundaries({
      ...shifted,
      mapRotation: 0,
    });
  };

  const { propertyDescription, executantText, claimantText, details } = generateLegalDescription(doc);

  const errors = validationIssues.filter((i) => i.severity === 'error');
  const warnings = validationIssues.filter((i) => i.severity === 'warning');
  const hasErrors = errors.length > 0;

  const handlePrint = () => {
    if (hasErrors) {
      setShowWarningModal(true);
      return;
    }
    window.print();
  };

  const handleExportDocx = async () => {
    if (hasErrors) {
      setShowWarningModal(true);
      return;
    }

    try {
      setIsExportingDocx(true);
      await downloadWord2007DeedDocx(doc, printContainerRef.current);
    } catch (err) {
      console.error('DOCX export error:', err);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportPdf = async () => {
    if (hasErrors) {
      setShowWarningModal(true);
      return;
    }

    if (!printContainerRef.current) return;

    try {
      setIsExportingPdf(true);
      const targetElement = printContainerRef.current;

      const canvas = await capturePlan(targetElement);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

      // Balanced margins for official legal deed printing (5mm)
      const margin = 5;
      const printableWidth = pageWidth - (margin * 2);
      const printableHeight = pageHeight - (margin * 2);

      const imgRatio = canvas.width / canvas.height;
      let renderWidth = printableWidth;
      let renderHeight = printableWidth / imgRatio;

      if (renderHeight > printableHeight) {
        renderHeight = printableHeight;
        renderWidth = printableHeight * imgRatio;
      }

      const xOffset = margin + (printableWidth - renderWidth) / 2;
      const yOffset = margin + (printableHeight - renderHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderWidth, renderHeight);

      const fileName = `Plan_SyNo_${doc.property.surveyNo || 'Doc'}_${doc.property.village || 'Registration'}.pdf`
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export error:', err);
      // Fallback to browser print
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyLegalText = () => {
    const formattedExecs = `THIS SALE DEED IS MADE AND EXECUTED ON [DATE] BY:- \n${executantText} \n(HEREINAFTER CALLED THE "VENDOR/S") OF THE ONE PART.`;
    const fullText = `${doc.title || 'Property Plan'}\n\n${propertyDescription}\n\n${formattedExecs}\n\nCLAIMANT/S: ${claimantText}`;
    navigator.clipboard.writeText(fullText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="space-y-6 print:space-y-0 print:m-0 print:p-0 print:w-full">
      {/* Top Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-black shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-preview-edit"
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-black" />
            Edit Plan
          </button>

          <button
            type="button"
            id="btn-copy-text"
            onClick={handleCopyLegalText}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-black text-xs font-semibold rounded-lg border border-black transition-all cursor-pointer"
          >
            {copiedText ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Text Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-black" />
                <span>Copy Legal Text</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-preview-save"
            onClick={onSave}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold rounded-lg transition-all cursor-pointer"
          >
            <FileCheck className="w-4 h-4 text-black" />
            Save Plan
          </button>

          <button
            type="button"
            id="btn-preview-new"
            onClick={onNewPlan}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold rounded-lg transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-black" />
            New Plan
          </button>

          <button
            type="button"
            id="btn-preview-print"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            Print Plan
          </button>



          <button
            type="button"
            id="btn-preview-export-docx"
            disabled={isExportingDocx}
            onClick={handleExportDocx}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-950 hover:bg-black text-[#ffedd5] border border-neutral-700 text-xs font-mono font-bold tracking-wide rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Download complete Word 2007 deed document with sketch and schedule"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            {isExportingDocx ? 'Generating Word Deed...' : 'Download Word 2007 deed (.docx)'}
          </button>

          <button
            type="button"
            id="btn-preview-export-pdf"
            disabled={isExportingPdf}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-white" />
            {isExportingPdf ? 'Generating PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Quick Map Adjustments: Map Rotation, North Rotation & Map Scale (Print Hidden) */}
      {onUpdateBoundaries && (
        <div className="bg-white p-3 rounded-xl border border-black/20 shadow-2xs space-y-2.5 print:hidden text-xs grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-rose-600" />
                Sketch Adjustments (స్కెచ్ రొటేషన్ & స్కేలింగ్):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateBoundaries({ ...doc.boundaries, mapRotation: 0, northRotation: 0, sketchScale: 100, textScale: 100 })}
                  className="px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer transition-colors"
                >
                  Reset All (రీసెట్)
                </button>
              </div>
            </div>

            {/* Top Controls Row */}
            <div className="flex flex-wrap items-center gap-2.5 pb-2 border-b border-slate-100">
            <label
              htmlFor="preview-sync-north-checkbox"
              className={`flex items-center gap-2 text-[11px] font-medium px-2.5 py-1 rounded-lg border cursor-pointer select-none transition-colors ${
                syncNorthWithMap
                  ? 'bg-rose-50 text-rose-800 border-rose-300 font-semibold shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <input
                type="checkbox"
                id="preview-sync-north-checkbox"
                checked={syncNorthWithMap}
                onChange={(e) => handleToggleSyncNorth(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer"
              />
              Sync North with Map (మ్యాప్‌తో పాటు కంపాస్ స్టాండర్డ్ డైరెక్షన్‌లో తిరుగును)
            </label>

            <label
              htmlFor="preview-auto-align-checkbox"
              className={`flex items-center gap-2 text-[11px] font-medium px-2.5 py-1 rounded-lg border cursor-pointer select-none transition-colors ${
                autoAlignBoundariesWithMap
                  ? 'bg-blue-50 text-blue-800 border-blue-300 font-semibold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <input
                type="checkbox"
                id="preview-auto-align-checkbox"
                checked={autoAlignBoundariesWithMap}
                onChange={(e) => setAutoAlignBoundariesWithMap(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
              />
              Auto-Align Boundaries & Dims (బౌండరీలు & కొలతలు ఆటో-అలైన్)
            </label>

            {/* Boundaries & House Measurements Font Style (Bold కాకుండా) */}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-[11px] ml-auto">
              <span className="text-slate-500 font-medium mr-1">Style:</span>
              <button
                type="button"
                onClick={() => onUpdateBoundaries({ ...doc.boundaries, boundaryFontWeight: 'normal' })}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  (doc.boundaries.boundaryFontWeight || 'normal') === 'normal'
                    ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="బౌండరీలు మరియు హౌస్ కొలతలు Bold కాకుండా సాధారణ వెయిట్‌తో కనిపిస్తాయి"
              >
                ✓ Normal (Bold కాకుండా)
              </button>
              <button
                type="button"
                onClick={() => onUpdateBoundaries({ ...doc.boundaries, boundaryFontWeight: 'bold' })}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  doc.boundaries.boundaryFontWeight === 'bold'
                    ? 'bg-slate-800 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Bold
              </button>
            </div>
          </div>

          {/* Dual Plot & Cadastral Quick Controls (matches photo sample) */}
          <div className="p-2.5 bg-gradient-to-r from-rose-50/70 via-amber-50/40 to-blue-50/50 rounded-lg border border-rose-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                <Split className="w-3.5 h-3.5 text-rose-700" />
                Plot Options:
              </span>

              {/* Red Border Toggle */}
              <button
                type="button"
                onClick={() => onUpdateBoundaries({ ...doc.boundaries, highlightBoundaryRed: !doc.boundaries.highlightBoundaryRed })}
                className={`px-2 py-1 text-[10.5px] font-bold rounded-md border flex items-center gap-1 transition-all cursor-pointer ${
                  doc.boundaries.highlightBoundaryRed
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="రిజిస్ట్రేషన్ ప్లాన్ ఎరుపు రంగు బోర్డర్"
              >
                <span className="w-2 h-2 rounded-full bg-rose-300"></span>
                <span>{doc.boundaries.highlightBoundaryRed ? '✓ Red Border Active' : 'Red Border (ఎరుపు అవుట్‌లైన్)'}</span>
              </button>

              {/* CAD Dimension Arrows Toggle */}
              <button
                type="button"
                onClick={() =>
                  onUpdateBoundaries({
                    ...doc.boundaries,
                    dimensionLineStyle: doc.boundaries.dimensionLineStyle === 'arrows' ? 'standard' : 'arrows',
                  })
                }
                className={`px-2 py-1 text-[10.5px] font-bold rounded-md border flex items-center gap-1 transition-all cursor-pointer ${
                  doc.boundaries.dimensionLineStyle === 'arrows' || doc.boundaries.dualPlot?.enabled
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="CAD స్టైల్ యారో లైన్లు మరియు ఎక్స్‌టెన్షన్ కొలతలు"
              >
                <span className="font-mono text-xs">↔</span>
                <span>
                  {doc.boundaries.dimensionLineStyle === 'arrows' || doc.boundaries.dualPlot?.enabled
                    ? '✓ CAD Arrows Active'
                    : 'CAD Arrows (యారో లైన్లు)'}
                </span>
              </button>

              {/* Dual Plot Mode Toggle */}
              <button
                type="button"
                onClick={() => {
                  const isEnabled = !doc.boundaries.dualPlot?.enabled;
                  onUpdateBoundaries({
                    ...doc.boundaries,
                    dualPlot: {
                      enabled: isEnabled,
                      plot1No: doc.boundaries.dualPlot?.plot1No || '50',
                      plot2No: doc.boundaries.dualPlot?.plot2No || '69',
                      dividerOrientation: doc.boundaries.dualPlot?.dividerOrientation || 'horizontal',
                      dividerRatio: doc.boundaries.dualPlot?.dividerRatio || 0.5,
                      showDividerDimension: doc.boundaries.dualPlot?.showDividerDimension !== false,
                      extendDividerOutside: doc.boundaries.dualPlot?.extendDividerOutside !== false,
                      plotTextOrientation: doc.boundaries.dualPlot?.plotTextOrientation || 'vertical',
                    },
                    dimensionLineStyle: isEnabled ? 'arrows' : doc.boundaries.dimensionLineStyle,
                  });
                }}
                className={`px-2.5 py-1 text-[10.5px] font-bold rounded-md border flex items-center gap-1 transition-all cursor-pointer ${
                  doc.boundaries.dualPlot?.enabled
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{doc.boundaries.dualPlot?.enabled ? '✓ Dual Plot (Plot 50 & 69)' : 'Dual Plot Mode'}</span>
              </button>
            </div>

            {/* 1-Click Load Sample from Photo */}
            <button
              type="button"
              onClick={() => {
                const updatedBoundaries: BoundaryDimensions = {
                  ...doc.boundaries,
                  northBoundary: "24' ROAD",
                  northDim: parseDimension("24'", 'Feet'),
                  southBoundary: "33' ROAD",
                  southDim: parseDimension("24'", 'Feet'),
                  westBoundary: "OPEN PLOT NO.51 OF VENDORS (45') & OPEN PLOT NOS.68 OF VENDORS (45')",
                  westDim: parseDimension("90'", 'Feet'),
                  eastBoundary: "OPEN PLOT NO.49 OF VENDORS (45') & OPEN PLOT NO.70 OF VENDORS (45')",
                  eastDim: parseDimension("90'", 'Feet'),
                  roadWidth: "24'-0\"",
                  roadSides: ['North', 'South'],
                  cornerProperty: true,
                  dimensionUnit: 'Feet',
                  highlightBoundaryRed: true,
                  dimensionLineStyle: 'arrows',
                  dualPlot: {
                    enabled: true,
                    plot1No: '50',
                    plot2No: '69',
                    dividerOrientation: 'horizontal',
                    dividerRatio: 0.5,
                    showDividerDimension: true,
                    extendDividerOutside: true,
                    plotTextOrientation: 'vertical',
                  },
                  westSegments: [
                    { name: 'OPEN PLOT NO.51 OF VENDORS', dimension: "45'" },
                    { name: 'OPEN PLOT NOS.68 OF VENDORS', dimension: "45'" },
                  ],
                  eastSegments: [
                    { name: 'OPEN PLOT NO.49 OF VENDORS', dimension: "45'" },
                    { name: 'OPEN PLOT NO.70 OF VENDORS', dimension: "45'" },
                  ],
                };
                onUpdateBoundaries(updatedBoundaries);
                if (onUpdateProperty) {
                  onUpdateProperty({
                    ...doc.property,
                    plotNo: '50 & 69',
                    propertyType: 'Open Place',
                  });
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold rounded-md shadow-xs cursor-pointer transition-all ml-auto"
              title="ఫోటోలోని Plot 50 & 69, 24'x90', 2 Roads, Segmented Boundaries మరియు Red Border శాంపిల్ ను ఆటోమేటిక్ గా లోడ్ చేస్తుంది"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Photo Sample (ఫోటో శాంపిల్)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Map Rotation (User requested feature) */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <RotateCw className="w-3 h-3 text-rose-600" />
                  Map Rotation:
                </label>
                <span className="text-[11px] font-extrabold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {doc.boundaries.mapRotation || 0}°
                </span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="359" 
                value={doc.boundaries.mapRotation || 0}
                onChange={(e) => handlePreviewMapRotation(parseInt(e.target.value, 10))}
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
                      onClick={() => handlePreviewMapRotation(deg === 360 ? 0 : deg)}
                      className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer border ${
                        isSelected
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={handlePreviewAlignBoundaries}
                  title="Align Boundaries & Dimensions with current Map rotation"
                  className="px-1.5 py-0.5 rounded font-bold cursor-pointer border bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-0.5 ml-auto"
                >
                  <RefreshCw className="w-2.5 h-2.5 text-amber-600" />
                  Align
                </button>
              </div>
            </div>

            {/* North Rotation & Symbol Style */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-blue-600" />
                  North Symbol & Rotation:
                </label>
                <span className="text-[11px] font-extrabold text-blue-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
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
                      onClick={() => onUpdateBoundaries({ ...doc.boundaries, northSymbolStyle: id as any })}
                      className={`px-1 py-1 rounded text-center font-bold cursor-pointer border transition-colors ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
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
                onChange={(e) => handlePreviewNorthRotation(parseInt(e.target.value, 10))}
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
                      onClick={() => handlePreviewNorthRotation(targetDeg)}
                      className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>
          </div>
          <div className="space-y-2.5">
            {/* Map Scale */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">
                  Map Scale:
                </label>
                <span className="text-[11px] font-extrabold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {doc.boundaries.sketchScale ?? 100}%
                </span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="150" 
                step="1"
                value={doc.boundaries.sketchScale ?? 100}
                onChange={(e) => onUpdateBoundaries({ ...doc.boundaries, sketchScale: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => onUpdateBoundaries({ ...doc.boundaries, sketchScale: 100 })}
                  className="text-[9px] text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Reset (100%)
                </button>
              </div>
            </div>
            
            {/* Boundaries Scale */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">
                  Boundaries & Plot Box Scale (బౌండరీలు & బాక్స్):
                </label>
                <span className="text-[11px] font-extrabold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                  {doc.boundaries.boundaryScale ?? 100}%
                </span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="200" 
                step="5"
                value={doc.boundaries.boundaryScale ?? 100}
                onChange={(e) => onUpdateBoundaries({ ...doc.boundaries, boundaryScale: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
              <div className="flex items-center justify-between text-[9px]">
                {[80, 100, 130, 160].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdateBoundaries({ ...doc.boundaries, boundaryScale: v })}
                    className="text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>


            {/* Dimensions Scale */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">
                  Dimensions Scale (కొలతలు):
                </label>
                <span className="text-[11px] font-extrabold text-blue-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                  {doc.boundaries.dimensionScale ?? 100}%
                </span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="200" 
                step="5"
                value={doc.boundaries.dimensionScale ?? 100}
                onChange={(e) => onUpdateBoundaries({ ...doc.boundaries, dimensionScale: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex items-center justify-between text-[9px]">
                {[80, 100, 130, 160].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdateBoundaries({ ...doc.boundaries, dimensionScale: v })}
                    className="text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            {/* Road Scale */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">
                  Road Scaling (రోడ్డు వెడల్పు):
                </label>
                <span className="text-[11px] font-extrabold text-amber-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                  {doc.boundaries.roadScale ?? 100}%
                </span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="200" 
                step="5"
                value={doc.boundaries.roadScale ?? 100}
                onChange={(e) => onUpdateBoundaries({ ...doc.boundaries, roadScale: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="flex items-center justify-between text-[9px]">
                {[70, 100, 130, 160].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdateBoundaries({ ...doc.boundaries, roadScale: v })}
                    className="text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            {/* Document Matter / Description & Parties Text Scale */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">
                  Document Matter Scale (షెడ్యూల్ & పార్టీల వివరాల సైజు):
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono">
                    {doc.boundaries.textScale ?? 100}%
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateBoundaries({ ...doc.boundaries, textScale: 100 })}
                    className="text-[9px] text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Reset (100%)
                  </button>
                </div>
              </div>
              <input 
                type="range" 
                min="50" 
                max="150" 
                step="2"
                value={doc.boundaries.textScale ?? 100}
                onChange={(e) => onUpdateBoundaries({ ...doc.boundaries, textScale: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex items-center justify-between text-[9px]">
                {[60, 75, 90, 100, 115, 130].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdateBoundaries({ ...doc.boundaries, textScale: v })}
                    className="text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>


          </div>
        </div>
      )}

      {/* Validation warning banner if missing fields */}
      {validationIssues.length > 0 && (
        <div
          id="preview-validation-banner"
          className={`p-4 rounded-xl border print:hidden flex items-start gap-3 ${
            hasErrors
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <AlertTriangle className={`w-5 h-5 shrink-0 ${hasErrors ? 'text-rose-600' : 'text-amber-600'}`} />
          <div className="flex-1 text-xs">
            <p className="font-bold">
              {hasErrors
                ? `Registration Plan Validation: ${errors.length} required field(s) missing or incomplete.`
                : `Plan Notices: ${warnings.length} advisory notice(s).`}
            </p>
            <ul className="mt-1.5 list-disc list-inside space-y-0.5 opacity-90">
              {validationIssues.map((issue, idx) => (
                <li key={idx} className={issue.severity === 'error' ? 'font-semibold' : ''}>
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1 bg-white border border-black text-black font-bold text-xs rounded-md shadow-2xs hover:bg-white cursor-pointer"
          >
            Fix In Form
          </button>
        </div>
      )}

      {/* ================= THE PRINTABLE DOCUMENT CANVAS ================= */}
      {/* Container calibrated to standard A4 sheet proportion with Official Double-Line Border */}
      <div className="print-canvas-wrapper flex flex-col items-center overflow-x-auto pb-8 print:block print:w-full print:max-w-none print:p-0 print:m-0 print:overflow-visible">
        {/* A4 Format & Double Border Status Indicator (hidden when printed) */}
        <div className="mb-2.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg uppercase tracking-wider flex items-center justify-between w-full max-w-[800px] print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-slate-800">A4 Paper 100% Fit • Double-Line Deed Border (డబుల్ లైన్ బోర్డర్)</span>
          </div>
          <span className="text-[10px] text-slate-500 normal-case">
            Scale 100% ప్రింట్‌కు పర్ఫెక్ట్‌గా సరిపోతుంది
          </span>
        </div>

        <div
          ref={printContainerRef}
          id="printable-plan-document"
          className="w-full max-w-[800px] bg-white text-black p-[3.5px] border-[3.5px] border-black shadow-lg print:shadow-none print:w-full print:max-w-none box-border relative mx-auto print:h-[calc(297mm-0.65in)] print:min-h-[calc(297mm-0.65in)] print:max-h-[calc(297mm-0.65in)]"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          {/* Inner Line of Legal Double Border Frame */}
          <div className="plan-double-border-inner border border-black p-4 sm:p-5 print:p-2.5 flex flex-col justify-between h-full min-h-[1050px] print:min-h-full print:h-full box-border">
            {/* Top Deed Section & Map Box Flow (Automatically flows and adjusts upwards when text scale shrinks) */}
            <div className="flex flex-col gap-1.5 transition-all duration-200">
              {/* Top Deed Content */}
              <div className="space-y-1 transition-all duration-200">
                {/* 1. Header: PLAN FOR REGISTRATION */}
                <div className="text-center mb-0.5">
                  <h1 className="text-[17px] sm:text-[18px] font-bold text-black tracking-wider uppercase inline-block border-b-2 border-double border-black pb-[1px]">
                    PLAN FOR REGISTRATION
                  </h1>
                </div>

                {/* 2. Property Description Paragraph */}
                <p
                  id="doc-property-description"
                  className="text-justify text-black font-normal tracking-normal uppercase transition-all duration-150"
                  style={{ 
                    fontSize: `calc(13.5px * ${(doc.boundaries.textScale ?? 100) / 100})`, 
                    lineHeight: Math.max(1.25, 1.45 * ((doc.boundaries.textScale ?? 100) / 100))
                  }}
                >
                  {details.isHouseLike ? (
                    <>
                      {details.isHouse ? (
                        <>
                          ALL THAT THE {details.houseBuildingDesc.toUpperCase()}
                          {details.houseBearingPart ? ` ${details.houseBearingPart.toUpperCase()}` : ''}
                        </>
                      ) : details.isPartOpenPlace ? (
                        <>
                          ALL THAT THE OPEN PLACE
                          {details.houseBearingPart ? ` ${details.houseBearingPart.toUpperCase()} (PART)` : ' (PART)'}
                        </>
                      ) : (
                        <>
                          ALL THAT THE OPEN PLACE TOGETHER WITH THE DISMANTLED HOUSE
                          {details.houseBearingPart ? ` ${details.houseBearingPart.toUpperCase()}` : ''}
                        </>
                      )}
                      {details.areaYards ? (
                        <>
                          , ADMEASURING A TOTAL AREA OF <strong>{details.areaYards}</strong> SQUARE YARDS
                          {details.areaMtrs ? (
                            <> EQUIVALENT TO <strong>{details.areaMtrs}</strong> SQUARE METERS</>
                          ) : null}
                        </>
                      ) : null}
                      {(details.isHouse || details.hasMultipleHouses) && details.plinthSqFt ? (
                        details.hasMultipleHouses && details.plinthBreakdown && details.plinthBreakdown.length > 1 ? (
                          <>
                            , HAVING PLINTH AREA OF{' '}
                            {details.plinthBreakdown.map((item, idx) => {
                              const isLast = idx === (details.plinthBreakdown?.length ?? 0) - 1;
                              const isSecondLast = idx === (details.plinthBreakdown?.length ?? 0) - 2;
                              const sep = isLast ? '' : (isSecondLast ? ' AND ' : ', ');
                              return (
                                <span key={idx}>
                                  {item.structureType.toUpperCase()}: <strong>{item.plinthSqFt} SQ.FT</strong>
                                  {sep}
                                </span>
                              );
                            })}{' '}
                            (TOTAL PLINTH AREA: <strong>{details.plinthSqFt} SQ.FT</strong>)
                          </>
                        ) : (
                          <>, HAVING PLINTH AREA OF <strong>{details.plinthSqFt} SQUARE FEETS</strong></>
                        )
                      ) : null}
                      {details.plotSurveyPart ? <>, {details.plotSurveyPart.toUpperCase()}</> : null}
                      {details.locClean && (details.vilDisplay || details.vilClean) ? (
                        <>, SITUATED AT ‘<strong>{details.locClean.toUpperCase()}</strong>’ LOCALITY OF <strong>{(details.vilDisplay || details.vilClean).toUpperCase()}</strong></>
                      ) : details.locClean ? (
                        <>, SITUATED AT ‘<strong>{details.locClean.toUpperCase()}</strong>’ LOCALITY</>
                      ) : (details.vilDisplay || details.vilClean) ? (
                        <>, SITUATED AT <strong>{(details.vilDisplay || details.vilClean).toUpperCase()}</strong></>
                      ) : null}
                      {details.mandalDisplay ? (
                        <>, <strong>{details.mandalDisplay.toUpperCase()}</strong></>
                      ) : details.mandalClean ? (
                        <>, <strong>{details.mandalClean.toUpperCase().endsWith('MANDAL') ? details.mandalClean.toUpperCase() : `${details.mandalClean.toUpperCase()} MANDAL`}</strong></>
                      ) : null}
                      {details.distClean ? (
                        <>, DISTRICT:<strong>{details.distClean.toUpperCase()}</strong></>
                      ) : null}
                    </>
                  ) : details.isPlot ? (
                    <>
                      {details.plotHeader} ADMEASURING A TOTAL AREA OF{' '}
                      <strong>{details.areaYards}</strong> {details.areaUnitsYards} EQUIVALENT TO{' '}
                      <strong>{details.areaMtrs}</strong> {details.areaUnitsMtrs}
                      {details.surveyNo ? <>, {details.surveyPrefix} {details.surveyNo}</> : null}, {details.situatedPrefix}
                      {details.nearHNo} OF {details.locality}
                      {details.village ? `${details.village}, ` : ''}{details.mandal}
                      {details.district}.
                    </>
                  ) : (
                    <>
                      THE {details.propType},{details.houseDesc} ADMEASURING A TOTAL AREA OF{' '}
                      <strong>{details.areaYards}</strong> {details.areaUnitsYards} EQUIVALENT TO{' '}
                      <strong>{details.areaMtrs}</strong> {details.areaUnitsMtrs}
                      {details.surveyNo ? <>, {details.surveyPrefix} {details.surveyNo}</> : null}, {details.situatedPrefix}
                      {details.nearHNo} OF {details.locality}
                      {details.village}, {details.mandal}
                      {details.district}.
                    </>
                  )}
                </p>

                {/* 3. Executant Details */}
                <p
                  id="doc-executant-details"
                  className="whitespace-pre-wrap text-justify text-black font-normal uppercase tracking-normal transition-all duration-150"
                  style={{ 
                    fontSize: `calc(13.5px * ${(doc.boundaries.textScale ?? 100) / 100})`, 
                    lineHeight: Math.max(1.25, 1.45 * ((doc.boundaries.textScale ?? 100) / 100))
                  }}
                >
                  <span className="font-bold underline decoration-1 underline-offset-2">
                    EXECUTANT/S:
                  </span>{' '}
                  {executantText}
                </p>

                {/* 4. Claimant Details */}
                <p
                  id="doc-claimant-details"
                  className="whitespace-pre-wrap text-justify text-black font-normal uppercase tracking-normal transition-all duration-150"
                  style={{ 
                    fontSize: `calc(13.5px * ${(doc.boundaries.textScale ?? 100) / 100})`, 
                    lineHeight: Math.max(1.25, 1.45 * ((doc.boundaries.textScale ?? 100) / 100))
                  }}
                >
                  <span className="font-bold underline decoration-1 underline-offset-2">
                    CLAIMANT/S:
                  </span>{' '}
                  {claimantText}
                </p>
              </div>

              {/* 4. Automatic Property Sketch (Map Box) - Automatically adjusts upwards when text scale shrinks */}
              <div id="sketch-map-box-container" className="pt-0.5 pb-1 transition-all duration-200 [&_svg]:border-0 [&_svg]:shadow-none [&_svg]:print:border-none [&_svg]:print:shadow-none">
                <PropertySketch
                  property={doc.property}
                  boundaries={doc.boundaries}
                  isPrintMode={true}
                />
              </div>
            </div>

            {/* 5. Bottom Section */}
            {/* Left Side: ☐ AREA UNDER REGN & WITNESSES | Right Side: EXECUTANT/S & CLAIMANT/S SIGN/S */}
            <div className="pt-4">
              <div className="grid grid-cols-2 gap-6 items-start">
                {/* Left Side */}
                <div className="space-y-4">
                  {/* Legend: Area under regn & House Structure */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-5 border border-black bg-transparent shrink-0" />
                      <span className="text-xs font-black text-black tracking-wider">
                        AREA UNDER REGN.
                      </span>
                    </div>
                    {(doc.property.propertyType === 'House' || doc.property.house?.enabled) && (
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-5 border-2 border-black bg-white relative flex items-center justify-center shrink-0">
                          <div className="w-8 h-3.5 border border-dashed border-black bg-slate-100" />
                        </div>
                        <span className="text-xs font-black text-black tracking-wider">
                          CONSTRUCTED HOUSE / PLINTH AREA
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Witnesses */}
                  <div className="pt-2">
                    <span className="text-xs font-black text-black tracking-wider block">
                      WITNESSES:
                    </span>
                    <div className="text-xs text-black space-y-12 font-bold pl-1" style={{ marginTop: '0.2in' }}>
                      <div>
                        <span>1. </span>
                      </div>
                      <div>
                        <span>2. </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Signatures */}
                <div className="space-y-8 text-right">
                  {/* Executant Signature */}
                  <div>
                    <div className="h-10"></div>
                    <div className="border-t border-black pt-1.5 inline-block min-w-[200px] text-center">
                      <span className="text-xs font-extrabold text-black tracking-wider">
                        EXECUTANT/S SIGN/S
                      </span>
                    </div>
                  </div>

                  {/* Claimant Signature */}
                  <div>
                    <div className="h-6"></div>
                    <div className="border-t border-black pt-1.5 inline-block min-w-[200px] text-center">
                      <span className="text-xs font-extrabold text-black tracking-wider">
                        CLAIMANT/S SIGN/S
                      </span>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
};
