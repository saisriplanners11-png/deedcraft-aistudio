import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { listSavedDeeds } from '../../../saved-deeds';
import { savedDeedDetails, type SavedDeedDetails } from '../deed-autofill';

export function SavedDeedPicker({ formLabel, onClose, onFill }: {
  formLabel: string;
  onClose: () => void;
  onFill: (deed: SavedDeedDetails, scheduleId: string) => void;
}) {
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [deeds, setDeeds] = useState<SavedDeedDetails[]>();
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [schedule, setSchedule] = useState('primary');

  useEffect(() => {
    dialog.current?.showModal();
    let mounted = true;
    void listSavedDeeds().then(records => {
      if (mounted) setDeeds(records.map(savedDeedDetails));
    }).catch(() => {
      if (mounted) setError('Could not open saved deeds in this browser.');
    });
    return () => { mounted = false; };
  }, []);

  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = deeds?.filter(deed => terms.every(term => deed.searchText.includes(term)));
  const deed = matches?.find(item => item.id === selected);

  return (
    <dialog ref={dialog} aria-labelledby={heading} onCancel={event => { event.preventDefault(); onClose(); }}
      className="no-print fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl backdrop:bg-slate-900/50 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={heading} className="text-lg font-semibold">Fill from a saved deed</h2>
        <button type="button" className="applications-back" onClick={onClose}>
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>
      </div>
      <label className="relative mt-3 block space-y-1">
        <span className="text-sm font-medium">Search saved deeds</span>
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute bottom-3.5 left-3 text-slate-500" />
        <input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)}
          aria-describedby={heading + '-hint'} className="block min-h-11 w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 focus-visible:outline-2" />
      </label>
      <p id={heading + '-hint'} className="mt-1 text-xs text-slate-600">
        Combine a party name, mobile number, locality, survey or plot number, or link document number.
      </p>
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : !matches ? (
        <p role="status" className="mt-4 text-sm">Loading saved deeds…</p>
      ) : matches.length === 0 ? (
        <p role="status" className="mt-4 text-sm">{deeds?.length ? 'No saved deeds match your search.' : 'No deeds are saved in this browser.'}</p>
      ) : (
        <fieldset className="mt-4 max-h-60 space-y-2 overflow-y-auto pr-1">
          <legend className="mb-2 text-sm font-medium">{matches.length} matching {matches.length === 1 ? 'deed' : 'deeds'}</legend>
          {matches.map(item => (
            <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-checked:border-slate-700 has-checked:bg-slate-50">
              <input type="radio" name={heading + '-selection'} className="mt-1" checked={item.id === selected}
                onChange={() => { setSelected(item.id); setSchedule(item.schedules[0].id); }} />
              <span className="min-w-0 wrap-anywhere">
                <strong className="block text-sm">{item.title}</strong>
                <span className="block text-xs text-slate-600">{item.summary}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {deed && deed.schedules.length > 1 && (
        <label className="mt-4 block text-sm font-medium">
          Property schedule
          <select value={schedule} onChange={event => setSchedule(event.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-2">
            {deed.schedules.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
          </select>
        </label>
      )}
      <p className="mt-4 text-xs text-slate-600">
        Available deed details will replace their matching fields in {formLabel}. Review the applicant and the filled details before printing.
      </p>
      <button type="button" disabled={!deed} onClick={() => deed && onFill(deed, schedule)}
        className="mt-3 min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white focus-visible:outline-2 disabled:opacity-50">
        Fill current form
      </button>
    </dialog>
  );
}
