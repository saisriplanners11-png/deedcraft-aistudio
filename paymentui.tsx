import React, { useState } from 'react';
import { css } from './css';
import { C, Button, ExtractDialog, formatMoneyInput, type ProgressStep } from './ui';
import { words } from './logic';
import {
  MODES, modeSpec, extractPayment, tdsOn, netOf, type Payment, type PayMode,
} from './payments';

const money = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

/** A bare labelled input in the register style, for records that are not form fields. */
function PInput({
  label, value, onChange, type = 'text', hint, mono, span = 1, filled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'number' | 'money' | 'date';
  hint?: string;
  mono?: boolean;
  span?: number;
  /** True when the value came off the uploaded instrument. */
  filled?: boolean;
}) {
  return (
    <label style={css(`grid-column:span ${span};display:flex;flex-direction:column;gap:5px;min-width:0`)}>
      <span style={css('display:flex;align-items:baseline;gap:7px;flex-wrap:wrap')}>
        <span style={css(`font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.mutedSoft}`)}>
          {label}
        </span>
        {filled ? (
          <span style={css(`font-size:8.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${C.green};border:1px solid ${C.greenLine};background:${C.greenBg};padding:1px 5px`)}>
            Instrument
          </span>
        ) : null}
      </span>
      <input
        type={type === 'money' ? 'text' : type}
        inputMode={type === 'money' ? 'decimal' : undefined}
        value={type === 'money' ? formatMoneyInput(value) : value}
        onChange={e => {
          if (type !== 'money') { onChange(e.target.value); return; }
          const raw = e.target.value.replace(/,/g, '');
          if (raw === '' || /^\d*\.?\d*$/.test(raw)) onChange(raw);
        }}
        aria-label={label}
        style={css(
          `padding:7px 2px;border:0;border-bottom:1px solid ${C.goldLight};background:transparent;font-size:13.5px;color:${C.ink};outline:none` +
            (mono || type === 'number' || type === 'money' ? `;font-family:${C.mono}` : '')
        )}
      />
      {hint ? <span style={css(`font-size:10.5px;color:${C.mutedSoft}`)}>{hint}</span> : null}
    </label>
  );
}

function Check({
  on, onToggle, label, note, tone = 'ink',
}: {
  on: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  note?: string;
  tone?: 'ink' | 'gold';
}) {
  return (
    <label
      style={css(
        `display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:6px 9px;` +
        (tone === 'gold'
          ? `border:1px solid ${on ? C.gold : C.goldLight};background:${C.goldBg}`
          : `border:1px solid ${on ? C.ink : 'transparent'}`)
      )}
    >
      <input type="checkbox" checked={on} onChange={e => onToggle(e.target.checked)} style={css('margin-top:2px')} />
      <span style={css('display:flex;flex-direction:column;gap:2px')}>
        <span style={css(`font-size:11px;font-weight:700;letter-spacing:.04em;color:${tone === 'gold' ? C.gold : C.ink}`)}>{label}</span>
        {note ? <span style={css(`font-size:10px;color:${C.mutedSoft}`)}>{note}</span> : null}
      </span>
    </label>
  );
}

/** The mode strip. Switching mode keeps whatever has already been typed. */
function ModeTabs({ mode, onPick }: { mode: PayMode; onPick: (m: PayMode) => void }) {
  return (
    <div style={css('display:flex;flex-wrap:wrap;gap:0;border:1px solid ' + C.goldLight)}>
      {MODES.map(m => {
        const on = m.key === mode;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onPick(m.key)}
            className={on ? undefined : 'hv3'}
            style={css(
              `padding:7px 13px;border:0;border-right:1px solid ${C.goldLight};cursor:pointer;` +
              `font-size:11px;font-weight:700;letter-spacing:.04em;` +
              (on ? `background:${C.ink};color:#F6F2E9` : `background:transparent;color:${C.body}`)
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One payment. The instrument can be photographed and read, or typed; either
 * way the same record is edited, and the fields shown follow the mode.
 */
export function PaymentCard({
  index, payment, onPatch, onRemove, canRemove,
}: {
  index: number;
  payment: Payment;
  onPatch: (patch: Partial<Payment>) => boolean | void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const spec = modeSpec(payment.mode);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [audit, setAudit] = useState<{ found: string[]; notFound: string[]; unreadable: string } | null>(null);
  const [over, setOver] = useState(false);

  const amount = Number(payment.amount) || 0;

  async function onFiles(files: File[]) {
    setBusy(true);
    setError('');
    setResult('');
    setAudit(null);
    setNames(files.map(f => f.name));
    setSteps([{ title: `Reading the ${spec.label.toLowerCase()}`, state: 'running' }]);
    setOpen(true);
    try {
      const { values, detectedMode, unreadable } = await extractPayment(payment.mode, files);
      const keys = Object.keys(values);
      const expected = ['amount', ...(spec.shows.ref ? ['refNo'] : []), ...(spec.shows.bank ? ['bank'] : []), ...(spec.shows.branch ? ['branch'] : []), 'date', ...(spec.shows.parties ? ['payer', 'payee'] : [])];
      const label = (key: string) => ({ amount: 'Amount', refNo: spec.refLabel, bank: spec.bankLabel || 'Bank', branch: spec.branchLabel || 'Branch', date: 'Date', payer: 'Payer', payee: 'Payee' } as Record<string, string>)[key] || key;
      setAudit({ found: keys.map(label), notFound: expected.filter(key => !keys.includes(key)).map(label), unreadable });
      // persist which fields were filled by this instrument so they can be
      // treated as read-only across the app
      const prevFilled = payment.filled ?? [];
      const newFilled = Array.from(new Set([...prevFilled, ...keys]));
      if (onPatch({ ...values, docName: files.map(f => f.name).join(', '), filled: newFilled }) === false) {
        throw new Error('The extracted payment would exceed the final sale consideration. Correct the amount or consideration first.');
      }
      setSteps([{ title: `Reading the ${spec.label.toLowerCase()}`, state: 'done', filled: keys.length }]);

      const bits: string[] = [];
      bits.push(keys.length ? `${keys.length} details filled` : 'nothing could be filled');
      if (detectedMode) bits.push(`this looks like a ${modeSpec(detectedMode).label} — check the mode above`);
      if (unreadable) bits.push(unreadable);
      setResult(bits.join(' · '));
      if (!keys.length && unreadable) setError(unreadable);
    } catch (e: any) {
      setError(e?.message || String(e));
      setSteps([{ title: `Reading the ${spec.label.toLowerCase()}`, state: 'pending' }]);
    } finally {
      setBusy(false);
    }
  }

  const take = (list: FileList | null) => {
    const files = Array.from(list || []);
    if (files.length) onFiles(files);
  };

  const set = (k: keyof Payment) => (v: string) => {
    const prevFilled = payment.filled ?? [];
    const remaining = prevFilled.filter(f => f !== k);
    const patch: any = {};
    // dynamic key assignment
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    patch[k] = v;
    patch.filled = remaining;
    if (onPatch(patch) === false) setError('Payment total cannot exceed the final sale consideration.');
  };

  return (
    <div style={css(`background:${C.paper};border:1px solid ${C.rule};border-left:3px solid ${C.gold}`)}>
      <ExtractDialog
        open={open}
        label={`${spec.label} — payment ${index + 1}`}
        fileNames={names}
        steps={steps}
        error={error}
        result={busy ? '' : result}
        onClose={() => setOpen(false)}
      />

      {/* header: which payment, how it was made, and whether it is an advance */}
      <div style={css(`display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 14px;border-bottom:1px solid ${C.rule};background:${C.ground}`)}>
        <span style={css(`flex:none;width:22px;height:22px;background:${C.ink};color:#F6F2E9;font-family:${C.mono};font-size:11px;display:flex;align-items:center;justify-content:center`)}>
          {index + 1}
        </span>
        <ModeTabs mode={payment.mode} onPick={m => onPatch({ mode: m, filled: [] })} />
        <span style={css('margin-left:auto;display:flex;align-items:center;gap:8px')}>
          <Check
            on={payment.advance}
            onToggle={v => onPatch({ advance: v })}
            label="Advance / token payment"
          />
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            title="Remove this payment"
            style={css(
              `padding:5px 9px;border:1px solid ${C.goldLight};background:transparent;font-size:12px;` +
              `color:${C.muted};cursor:${canRemove ? 'pointer' : 'not-allowed'};opacity:${canRemove ? '1' : '.4'}`
            )}
          >
            ✕
          </button>
        </span>
      </div>

      {/* the instrument itself */}
      <label
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
        style={css(
          `display:flex;align-items:center;gap:12px;margin:14px;padding:11px 14px;` +
          `border:1px dashed ${over || busy ? C.gold : C.goldLight};background:${over ? C.goldBg : C.ground};` +
          `cursor:${busy ? 'progress' : 'pointer'}`
        )}
      >
        <span style={css(`font-size:16px;color:${C.gold}`)}>⇪</span>
        <span style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}>
          <span style={css(`font-family:${C.serif};font-size:13.5px;font-weight:600;color:${busy ? C.gold : C.ink}`)}>
            {busy ? 'Reading…' : payment.docName ? payment.docName : `Upload the ${spec.label.toLowerCase()} — its details are read and filled in below`}
          </span>
          <span style={css(`font-size:10.5px;color:${C.mutedSoft}`)}>{spec.docLabel}</span>
        </span>
        <input type="file" multiple accept={spec.accept} disabled={busy}
               onChange={e => { take(e.target.files); e.currentTarget.value = ''; }}
               style={css('display:none')} />
      </label>

      {audit && !busy ? (
        <div style={css(`margin:0 14px 14px;padding:10px 12px;border:1px solid ${C.rule};background:${C.ground};font-size:10.5px;line-height:1.55`)}>
          <b style={css(`font-size:9px;letter-spacing:.08em;text-transform:uppercase`)}>Payment extraction audit</b>
          <div style={css(`margin-top:4px;color:${C.green}`)}><b>Verified:</b> {audit.found.length ? audit.found.join(', ') : 'None'}</div>
          {audit.notFound.length ? <div style={css(`margin-top:4px;color:${C.mutedSoft}`)}><b>Not verified:</b> {audit.notFound.join(', ')}. The fields were left blank instead of guessed.</div> : null}
          {audit.unreadable ? <div style={css(`margin-top:4px;color:${C.mutedSoft}`)}><b>Reader note:</b> {audit.unreadable}</div> : null}
        </div>
      ) : null}

      {/* particulars */}
      <div style={css('padding:0 14px 14px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 18px')}>
        <PInput label="Amount (₹)" type="money" value={payment.amount} onChange={set('amount')} filled={(payment.filled ?? []).includes('amount')} />
        {spec.shows.ref ? (
          <PInput label={spec.refLabel} value={payment.refNo} onChange={set('refNo')} hint={spec.refHint} mono filled={(payment.filled ?? []).includes('refNo')} />
        ) : null}
        {spec.shows.bank ? (
          <PInput label={spec.bankLabel || 'Bank'} value={payment.bank} onChange={set('bank')} filled={(payment.filled ?? []).includes('bank')} />
        ) : null}
        {spec.shows.branch ? (
          <PInput label={spec.branchLabel || 'Branch'} value={payment.branch} onChange={set('branch')} filled={(payment.filled ?? []).includes('branch')} />
        ) : null}
        <PInput label="Date" type="date" value={payment.date} onChange={set('date')} filled={(payment.filled ?? []).includes('date')} />
        {spec.shows.parties ? (
          <>
            <PInput label="Payer (purchaser)" span={2} value={payment.payer} onChange={set('payer')} filled={(payment.filled ?? []).includes('payer')} />
            <PInput label="Payee (vendor)" span={2} value={payment.payee} onChange={set('payee')} filled={(payment.filled ?? []).includes('payee')} />
          </>
        ) : null}
      </div>

      {/* what this payment comes to */}
      <div style={css(`display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid ${C.ruleSoft};background:${C.paper}`)}>
        <Check
          on={payment.tds}
          onToggle={v => onPatch({ tds: v })}
          tone="gold"
          label="1% TDS (s.194-IA)"
          note="Mandatory where the consideration is ₹50 lakh or more"
        />
        <span style={css(`font-size:11px;color:${C.body};min-width:0;flex:1`)}>
          {amount ? words(amount) : 'Enter the amount to see it in words.'}
        </span>
        <span style={css(`font-family:${C.mono};font-size:11.5px;color:${C.ink};white-space:nowrap`)}>
          {payment.tds ? `TDS ${money(tdsOn(payment))} · ` : ''}
          Net paid {amount ? money(netOf(payment)) : '—'}
        </span>
      </div>
    </div>
  );
}

/** The add-a-payment strip: one button per mode, so the next row starts right. */
export function AddPayment({ onAdd, remaining }: { onAdd: (m: PayMode) => void; remaining: string }) {
  return (
    <div style={css(`display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border:1px dashed ${C.goldLight};background:${C.ground}`)}>
      <span style={css(`font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.mutedSoft}`)}>
        Add a payment
      </span>
      {MODES.map(m => (
        <Button key={m.key} kind="gold" onClick={() => onAdd(m.key)}>+ {m.label}</Button>
      ))}
      {remaining ? (
        <span style={css(`margin-left:auto;font-family:${C.mono};font-size:11.5px;color:${C.gold}`)}>{remaining}</span>
      ) : null}
    </div>
  );
}
