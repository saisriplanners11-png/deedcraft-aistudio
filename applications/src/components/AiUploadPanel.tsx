import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  FileText,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  ArrowLeft,
  X,
} from 'lucide-react';
import { FormType } from '../types/forms';

export interface AllA4ExtractedPayload {
  marketValueMode: 'mvOpen' | 'mvHouse';
  forms: {
    ccCopy: Record<string, unknown>;
    mvOpen: Record<string, unknown>;
    mvHouse: Record<string, unknown>;
    ec: Record<string, unknown>;
  };
}

interface AiUploadPanelProps {
  activeForm: FormType;
  activeFormLabel: string;
  onExtracted: (
    formType: FormType,
    fields: Record<string, unknown>,
    summary: string,
    fileName: string
  ) => void;
  onExtractedAllA4: (
    payload: AllA4ExtractedPayload,
    summary: string,
    fileName: string
  ) => void;
  onClose: () => void;
}

const MAX_FILES = 15;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
const MAX_TOTAL_BYTES = 35 * 1024 * 1024; // 35 MB combined

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error(`Could not read "${file.name}".`));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = () =>
      reject(new Error(`Failed to read "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

function getFileMimeType(file: File): string {
  if (file.type) {
    return file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

function isSupportedFile(file: File): boolean {
  const mime = getFileMimeType(file).toLowerCase();
  return (
    mime === 'application/pdf' ||
    mime === 'image/jpeg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    mime === 'image/heic'
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AiUploadPanel: React.FC<AiUploadPanelProps> = ({
  activeForm,
  activeFormLabel,
  onExtracted,
  onExtractedAllA4,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [targetMode, setTargetMode] = useState<'allA4' | 'current'>(
    activeForm === 'indent' ? 'current' : 'allA4'
  );
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeForm === 'indent') {
      setTargetMode('current');
    }
  }, [activeForm]);

  const addFilesToQueue = (incomingList: FileList | File[]) => {
    const incoming = Array.from(incomingList);
    if (incoming.length === 0) return;

    setErrorMsg(null);

    const next = [...queuedFiles];
    for (const file of incoming) {
      if (!isSupportedFile(file)) {
        setErrorMsg(
          `Unsupported file "${file.name}". Please upload PDF, JPG, PNG, WEBP, or HEIC files.`
        );
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrorMsg(
          `"${file.name}" exceeds the 15 MB per-file limit. Please choose a smaller file.`
        );
        return;
      }
      const alreadyAdded = next.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      );
      if (!alreadyAdded) {
        next.push(file);
      }
    }

    if (next.length > MAX_FILES) {
      setErrorMsg(`You can upload up to ${MAX_FILES} files at once.`);
      return;
    }

    const totalSize = next.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_BYTES) {
      setErrorMsg('Combined file size exceeds 35 MB limit. Please upload fewer or smaller files.');
      return;
    }

    setQueuedFiles(next);
  };

  const removeFileAt = (idx: number) => {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== idx));
    setErrorMsg(null);
  };

  const processQueuedFiles = async () => {
    if (queuedFiles.length === 0 || isProcessing) return;

    setErrorMsg(null);
    setIsProcessing(true);

    const fileLabel =
      queuedFiles.length === 1
        ? queuedFiles[0].name
        : `${queuedFiles.length} files (${queuedFiles[0].name} + ${queuedFiles.length - 1} more)`;

    try {
      const encodedFiles = await Promise.all(
        queuedFiles.map(async (file) => ({
          name: file.name,
          mimeType: getFileMimeType(file),
          base64Data: await readFileAsBase64(file),
        }))
      );

      const res = await fetch('/api/applications/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetForm: targetMode === 'allA4' ? 'allA4' : activeForm,
          files: encodedFiles,
        }),
      });

      const json = (await res.json()) as {
        mode?: 'single' | 'allA4';
        formType?: FormType;
        fields?: Record<string, unknown>;
        marketValueMode?: 'mvOpen' | 'mvHouse';
        forms?: AllA4ExtractedPayload['forms'];
        extractedSummary?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || `AI extraction failed (${res.status})`);
      }

      if (json.mode === 'allA4' && json.forms) {
        onExtractedAllA4(
          {
            marketValueMode: json.marketValueMode === 'mvHouse' ? 'mvHouse' : 'mvOpen',
            forms: json.forms,
          },
          json.extractedSummary ||
            'Filled Certified Copy, Market Value, and EC Application from documents',
          fileLabel
        );
        return;
      }

      if (!json.formType || !json.fields) {
        throw new Error('AI extraction returned empty fields.');
      }

      onExtracted(
        json.formType,
        json.fields,
        json.extractedSummary || 'Fields auto-filled from documents',
        fileLabel
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to read documents with AI. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isProcessing && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-slate-700" />
            <span>Upload Documents or Photos — AI Auto-Fill</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {targetMode === 'allA4'
              ? 'Reads single or multiple PDFs/photos and fills only the fields in Certified Copy, Market Value & EC Application'
              : `Reads single or multiple PDFs/photos and fills only the fields in ${activeFormLabel}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to form"
          className="applications-back"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTargetMode('allA4')}
          disabled={isProcessing}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            targetMode === 'allA4'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          Fill CC, Market Value &amp; EC
        </button>
        <button
          type="button"
          onClick={() => setTargetMode('current')}
          disabled={isProcessing}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            targetMode === 'current'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          Fill Only {activeFormLabel}
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
        className={`rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-slate-900 bg-slate-100'
            : 'border-slate-300 bg-white hover:border-slate-400'
        } ${isProcessing ? 'opacity-75 cursor-wait' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic"
          onChange={handleFileChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-2.5 py-2">
            <Loader2 className="h-7 w-7 text-slate-800 animate-spin" />
            <div className="text-sm font-semibold text-slate-800">
              Reading {queuedFiles.length}{' '}
              {queuedFiles.length === 1 ? 'file' : 'files'} with AI...
            </div>
            <div className="text-xs text-slate-500">
              Extracting only the fields present in the application forms
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileUp className="h-8 w-8 text-slate-500" />
            <div className="text-sm font-semibold text-slate-800">
              Click to select multiple photos or PDFs, or drag &amp; drop here
            </div>
            <div className="text-xs text-slate-500">
              Supports multiple PDFs, JPG, PNG, WEBP (up to {MAX_FILES} files, 15 MB each)
            </div>
          </div>
        )}
      </div>

      {/* Selected files list + extract trigger */}
      {queuedFiles.length > 0 && (
        <div className="space-y-2.5">
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-0.5">
            {queuedFiles.map((file, idx) => {
              const isPdf = getFileMimeType(file) === 'application/pdf';
              return (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isPdf ? (
                      <FileText className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                    )}
                    <span className="truncate font-medium text-slate-800">
                      {file.name}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={() => removeFileAt(idx)}
                      aria-label={`Remove ${file.name}`}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isProcessing || queuedFiles.length >= MAX_FILES}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add More
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setQueuedFiles([]);
                  setErrorMsg(null);
                }}
                className="rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-50 transition-colors"
              >
                Clear
              </button>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={processQueuedFiles}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reading...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Extract &amp; Fill ({queuedFiles.length}{' '}
                  {queuedFiles.length === 1 ? 'file' : 'files'})
                </>
              )}
            </button>
          </div>
        </div>
      )}

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
