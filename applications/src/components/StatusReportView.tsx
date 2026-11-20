import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Pencil,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { FormType, RecordStatus, SavedRecord } from '../types/forms';

interface StatusReportViewProps {
  records: SavedRecord[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onUpdateRecord: (
    id: string,
    patch: Partial<
      Pick<
        SavedRecord,
        'status' | 'title' | 'dueDate' | 'feeAmount' | 'paidAmount' | 'notes'
      >
    >
  ) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onClearAllRecords: () => Promise<void>;
  onOpenInBuilder: (record: SavedRecord) => void;
}

const FORM_LABELS: Record<FormType, string> = {
  ccCopy: 'Certified Copy / PS',
  mvOpen: 'MV Open Plot',
  mvHouse: 'MV House',
  ec: 'EC Application',
  indent: 'Stamp Indent',
};

const STATUS_META: Record<
  RecordStatus,
  { label: string; className: string; icon: React.FC<{ className?: string }> }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Clock,
  },
  complete: {
    label: 'Complete',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
  },
  due: {
    label: 'Due',
    className: 'bg-red-50 text-red-800 border-red-200',
    icon: AlertCircle,
  },
};

function parseAmount(val: string): number {
  const num = parseFloat(String(val || '').replace(/,/g, ''));
  return Number.isNaN(num) ? 0 : num;
}

export const StatusReportView: React.FC<StatusReportViewProps> = ({
  records,
  isLoading,
  error,
  onRetry,
  onUpdateRecord,
  onDeleteRecord,
  onClearAllRecords,
  onOpenInBuilder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RecordStatus>('all');
  const [formFilter, setFormFilter] = useState<'all' | FormType>('all');
  const [editingRecord, setEditingRecord] = useState<SavedRecord | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: '',
    status: 'pending' as RecordStatus,
    dueDate: '',
    feeAmount: '',
    paidAmount: '',
    notes: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const summary = useMemo(() => {
    let pendingCount = 0;
    let completeCount = 0;
    let dueCount = 0;
    let totalDueAmount = 0;

    for (const rec of records) {
      if (rec.status === 'pending') pendingCount += 1;
      if (rec.status === 'complete') completeCount += 1;
      if (rec.status === 'due') dueCount += 1;

      const fee = parseAmount(rec.feeAmount);
      const paid = parseAmount(rec.paidAmount);
      const bal = Math.max(0, fee - paid);
      if (rec.status === 'due' || bal > 0) {
        totalDueAmount += bal;
      }
    }

    return {
      total: records.length,
      pending: pendingCount,
      complete: completeCount,
      due: dueCount,
      totalDueAmount,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (formFilter !== 'all' && rec.formType !== formFilter) return false;
      if (!q) return true;
      return (
        rec.title.toLowerCase().includes(q) ||
        rec.applicantName.toLowerCase().includes(q) ||
        rec.mobileNo.toLowerCase().includes(q) ||
        rec.notes.toLowerCase().includes(q) ||
        FORM_LABELS[rec.formType].toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, statusFilter, formFilter]);

  const openEdit = (rec: SavedRecord) => {
    setEditingRecord(rec);
    setEditDraft({
      title: rec.title,
      status: rec.status,
      dueDate: rec.dueDate,
      feeAmount: rec.feeAmount,
      paidAmount: rec.paidAmount,
      notes: rec.notes,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setIsSavingEdit(true);
    try {
      await onUpdateRecord(editingRecord.id, editDraft);
      setEditingRecord(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Title',
      'Form Type',
      'Applicant',
      'Mobile No',
      'Status',
      'Due Date',
      'Total Fee',
      'Paid Amount',
      'Balance Due',
      'Notes',
      'Updated At',
    ];
    const escapeCell = (val: string) =>
      `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = filteredRecords.map((rec) => {
      const fee = parseAmount(rec.feeAmount);
      const paid = parseAmount(rec.paidAmount);
      const balance = Math.max(0, fee - paid);
      return [
        rec.title,
        FORM_LABELS[rec.formType],
        rec.applicantName,
        rec.mobileNo,
        STATUS_META[rec.status].label,
        rec.dueDate,
        rec.feeAmount,
        rec.paidAmount,
        balance > 0 ? String(balance) : '0',
        rec.notes,
        new Date(rec.updatedAt).toLocaleString(),
      ]
        .map(escapeCell)
        .join(',');
    });

    const csv = [headers.map(escapeCell).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `card-status-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Application Status Report
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Track pending, complete, and due applications saved in this browser.
            </p>
          </div>
          <div className="no-print flex flex-wrap items-center gap-2.5 shrink-0">
            {records.length > 0 &&
              (confirmClearAll ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await onClearAllRecords();
                      setConfirmClearAll(false);
                    }}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors whitespace-nowrap"
                  >
                    Confirm Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </button>
              ))}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Report
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">
              Total Saved Entries
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {summary.total}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <Clock className="h-3.5 w-3.5" />
              <span>Pending</span>
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {summary.pending}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Complete</span>
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {summary.complete}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-800">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Due</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {summary.due}
              </span>
              {summary.totalDueAmount > 0 && (
                <span className="text-xs text-red-700 font-mono tabular-nums">
                  (Rs.{summary.totalDueAmount.toLocaleString('en-IN')} balance)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="no-print rounded-lg border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by applicant, mobile, title, or remarks..."
              className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'pending', 'complete', 'due'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === status
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status === 'all' ? 'All Status' : STATUS_META[status].label}
                </button>
              ))}
            </div>

            <select
              value={formFilter}
              onChange={(e) => setFormFilter(e.target.value as 'all' | FormType)}
              aria-label="Filter by form type"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-none"
            >
              <option value="all">All Form Types</option>
              <option value="ccCopy">Certified Copy / PS</option>
              <option value="mvOpen">MV Open Plot</option>
              <option value="mvHouse">MV House</option>
              <option value="ec">EC Application</option>
              <option value="indent">Stamp Indent</option>
            </select>
          </div>
        </div>

        {/* Error / Loading / Data Table */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
            <div className="text-sm text-red-800">{error}</div>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
            >
              Retry
            </button>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Application / Reference</th>
                  <th className="py-3 px-4">Form</th>
                  <th className="py-3 px-4">Applicant &amp; Mobile</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Fee / Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 no-print text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={7} className="py-4 px-4">
                        <div className="h-5 bg-slate-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 px-6 text-center">
                      <p className="text-sm font-medium text-slate-800">
                        No matching saved applications
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Save an entry from the Form Builder or adjust your filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const meta = STATUS_META[rec.status];
                    const StatusIcon = meta.icon;
                    const fee = parseAmount(rec.feeAmount);
                    const paid = parseAmount(rec.paidAmount);
                    const balance = Math.max(0, fee - paid);

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3 px-4 align-top max-w-[260px]">
                          <div className="font-medium text-slate-900 truncate">
                            {rec.title}
                          </div>
                          {rec.notes && (
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {rec.notes}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 align-top text-xs text-slate-700 whitespace-nowrap">
                          {FORM_LABELS[rec.formType]}
                        </td>

                        <td className="py-3 px-4 align-top max-w-[220px]">
                          <div className="text-xs font-medium text-slate-800 truncate">
                            {rec.applicantName || '—'}
                          </div>
                          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                            {rec.mobileNo || '—'}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top text-xs text-slate-700 font-mono tabular-nums whitespace-nowrap">
                          {rec.dueDate || '—'}
                        </td>

                        <td className="py-3 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="text-xs text-slate-900">
                            {fee > 0 ? `Rs.${fee.toLocaleString('en-IN')}` : '—'}
                          </div>
                          {balance > 0 && (
                            <div className="text-[11px] text-red-700 font-medium mt-0.5">
                              Due: Rs.{balance.toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="no-print">
                            <select
                              value={rec.status}
                              onChange={(e) =>
                                onUpdateRecord(rec.id, {
                                  status: e.target.value as RecordStatus,
                                })
                              }
                              aria-label={`Status for ${rec.title}`}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium focus:outline-none ${meta.className}`}
                            >
                              <option value="pending">Pending</option>
                              <option value="complete">Complete</option>
                              <option value="due">Due</option>
                            </select>
                          </div>
                          <div className="hidden print:inline-flex items-center gap-1 text-xs font-medium">
                            <StatusIcon className="h-3.5 w-3.5" />
                            <span>{meta.label}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top text-right no-print whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenInBuilder(rec)}
                              title="Open in Form Builder"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(rec)}
                              title="Edit status, due date, and fee"
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRecord(rec.id)}
                              title="Delete entry"
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Details Modal */}
      {editingRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Entry Status"
        >
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Update Status &amp; Due Details
              </h2>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Title</span>
                <input
                  type="text"
                  value={editDraft.title}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">Status</span>
                  <select
                    value={editDraft.status}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...d,
                        status: e.target.value as RecordStatus,
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="complete">Complete</option>
                    <option value="due">Due</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">Due Date</span>
                  <input
                    type="date"
                    value={editDraft.dueDate}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, dueDate: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">
                    Total Fee (Rs.)
                  </span>
                  <input
                    type="text"
                    value={editDraft.feeAmount}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, feeAmount: e.target.value }))
                    }
                    placeholder="e.g. 500"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">
                    Paid Amount (Rs.)
                  </span>
                  <input
                    type="text"
                    value={editDraft.paidAmount}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, paidAmount: e.target.value }))
                    }
                    placeholder="e.g. 200"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Notes / Remarks</span>
                <textarea
                  rows={2}
                  value={editDraft.notes}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  placeholder="Optional status remarks"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none resize-y"
                />
              </label>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
