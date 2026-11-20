import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileUp, Loader2, Sparkles, X } from 'lucide-react';
import { FormType } from '../types/forms';

interface AiUploadPanelProps {
  activeForm: FormType;
  activeFormLabel: string;
  onExtracted: (
    formType: FormType,
    fields: Record<string, unknown>,
    summary: string,
    fileName: string
  ) => void;
  onClose: () => void;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error('Could not read uploaded file contents.'));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export const AiUploadPanel: React.FC<AiUploadPanelProps> = ({
  activeForm,
  activeFormLabel,
  onExtracted,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const [targetMode, setTargetMode] = useState<'current' | 'auto'>('current');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const processFile = async (file: File) => {
    if (activeRequest.current) return;
    setErrorMsg(null);
    setSelectedFileName(file.name);

    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('File exceeds 15 MB limit. Please upload a smaller PDF or image.');
      return;
    }

    const mimeType =
      file.type ||
      (file.name.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'image/jpeg');

    const controller = new AbortController();
    activeRequest.current = controller;
    setIsProcessing(true);
    try {
      const base64Data = await readFileAsBase64(file);
      const res = await fetch('/api/applications/extract', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetForm: targetMode === 'auto' ? 'auto' : activeForm,
          mimeType,
          base64Data,
        }),
      });

      const json = (await res.json()) as {
        formType?: FormType;
        fields?: Record<string, unknown>;
        extractedSummary?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || `AI extraction failed (${res.status})`);
      }

      if (!json.formType || !json.fields) {
        throw new Error('AI extraction returned empty fields.');
      }

      if (controller.signal.aborted) return;
      onExtracted(
        json.formType,
        json.fields,
        json.extractedSummary || 'Fields auto-filled from document',
        file.name
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to read document with AI. Please try again.'
      );
    } finally {
      activeRequest.current = null;
      if (!controller.signal.aborted) setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !isProcessing) {
      processFile(file);
    }
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Sparkles className="h-3.5 w-3.5 text-slate-700" />
            <span>Upload Document or Photo — AI Auto-Fill</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Upload a PDF or image to send it to Gemini for autofill. Review the extracted details before printing.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close upload panel"
          className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setTargetMode('current')}
          disabled={isProcessing}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            targetMode === 'current'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          Fill {activeFormLabel}
        </button>
        <button
          type="button"
          onClick={() => setTargetMode('auto')}
          disabled={isProcessing}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            targetMode === 'auto'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          Auto-Detect Form Type
        </button>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isProcessing) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`rounded-lg border border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-slate-900 bg-slate-100'
            : 'border-slate-300 bg-white hover:border-slate-400'
        } ${isProcessing ? 'opacity-75 cursor-wait' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic"
          onChange={handleFileChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 text-slate-800 animate-spin" />
            <div className="text-xs font-medium text-slate-800">
              Reading {selectedFileName || 'document'} with AI...
            </div>
            <div className="text-[11px] text-slate-500">
              Extracting names, survey numbers, boundaries, and document details
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <FileUp className="h-5 w-5 text-slate-500" />
            <div className="text-xs font-medium text-slate-800">
              Click to choose a file or drag &amp; drop here
            </div>
            <div className="text-[11px] text-slate-500">
              Supports PDF, JPG, PNG, WEBP (max 15 MB)
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
