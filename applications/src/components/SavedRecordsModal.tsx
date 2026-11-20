import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderOpen,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { FormType, RecordStatus, SavedRecord } from '../types/forms';

interface SavedRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: SavedRecord[];
  onLoad: (record: SavedRecord) => void;
  onDelete: (id: string) => void;
  onClearAll: () => Promise<void> | void;
  onOpenReports: () => void;
}

const FORM_LABELS: Record<FormType, string> = {
  ccCopy: 'CC / Personal Search',
  mvOpen: 'MV Open Plot',
  mvHouse: 'MV House',
  ec: 'EC Application',
  indent: 'Stamp Indent',
};

const STATUS_BADGE: Record<
  RecordStatus,
  { label: string; color: string; Icon: React.FC<{ className?: string }> }
> = {
  pending: { label: 'Pending', color: 'text-amber-700', Icon: Clock },
  complete: { label: 'Complete', color: 'text-emerald-700', Icon: CheckCircle2 },
  due: { label: 'Due', color: 'text-red-700', Icon: AlertCircle },
};

export const SavedRecordsModal: React.FC<SavedRecordsModalProps> = ({
  isOpen,
  onClose,
  records,
  onLoad,
  onDelete,
  onClearAll,
  onOpenReports,
}) => {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | FormType>('all');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  if (!isOpen) return null;

  const filtered = records.filter((rec) => {
    const matchesType = filterType === 'all' || rec.formType === filterType;
    const matchesQuery =
      !query.trim() ||
      rec.title.toLowerCase().includes(query.toLowerCase()) ||
      rec.applicantName.toLowerCase().includes(query.toLowerCase()) ||
      rec.mobileNo.toLowerCase().includes(query.toLowerCase()) ||
      FORM_LABELS[rec.formType].toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesQuery;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Saved Applications"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Saved Applications
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reload saved applications or jump to the Status Report
            </p>
          </div>
          <div className="flex items-center gap-2">
            {records.length > 0 &&
              (confirmClearAll ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await onClearAll();
                      setConfirmClearAll(false);
                    }}
                    className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                  >
                    Confirm Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  Clear All
                </button>
              ))}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenReports();
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Open Full Report
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search saved entries by applicant, mobile, or title..."
              className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'ccCopy', 'mvOpen', 'mvHouse', 'ec', 'indent'] as const).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    filterType === type
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'all' ? 'All Forms' : FORM_LABELS[type]}
                </button>
              )
            )}
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-200">
          {filtered.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <FolderOpen className="h-8 w-8 text-slate-300 mx-auto mb-2.5" />
              <p className="text-sm font-medium text-slate-700">
                No saved applications found
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Fill out a form and select Save Application to store it with a status.
              </p>
            </div>
          ) : (
            filtered.map((rec) => {
              const badge = STATUS_BADGE[rec.status || 'pending'];
              const StatusIcon = badge.Icon;
              return (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {rec.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className={`inline-flex items-center gap-1 font-medium ${badge.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{FORM_LABELS[rec.formType]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(rec.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onLoad(rec);
                        onClose();
                      }}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      Load Form
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(rec.id)}
                      aria-label={`Delete ${rec.title}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
