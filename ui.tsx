import React from 'react';
import { css } from './css';
import type { Field, Group } from './fields';
import type { Conflict, FieldEvidence } from './logic';
import { DOC_KINDS, type DocKind } from './extract';

// Shared pieces of the deed-register look: rules and small caps, ink on cream,
// serif for what the deed says and mono for what the registry counts.

/** Formats a raw (comma-free) numeric string for display, Indian-grouped, keeping a trailing "." or partial decimal while the user is still typing it. */
export function formatMoneyInput(raw: string): string {
  if (raw === '') return '';
  const [intPart, ...rest] = raw.split('.');
  const grouped = intPart === '' ? '' : Number(intPart).toLocaleString('en-IN');
  return rest.length ? `${grouped}.${rest.join('')}` : grouped;
}

export const C = {
  ink: '#16130F',
  paper: '#FFFDF8',
  ground: '#EFEAE0',
  rule: '#E4DBC9',
  ruleSoft: '#EFE8D9',
  gold: '#8A5E12',
  goldLight: '#D6C79E',
  goldBg: '#FBF3DC',
  muted: '#7B7263',
  mutedSoft: '#948872',
  body: '#5A5145',
  green: '#2E6B4A',
  greenLine: '#A9C9B6',
  greenBg: '#EAF2ED',
  serif: "'Source Serif 4',serif",
  mono: "'IBM Plex Mono',monospace",
  telugu: "'Noto Sans Telugu',sans-serif",
};

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div style={css(`font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.gold};margin-bottom:6px`)}>
    {children}
  </div>
);

export function PageHead({ eyebrow, title, telugu, blurb }: { eyebrow: string; title: string; telugu?: string; blurb: string }) {
  return (
    <div style={css(`border-bottom:2px solid ${C.ink};padding-bottom:14px`)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div style={css('display:flex;align-items:baseline;gap:14px;flex-wrap:wrap')}>
        <h1 style={css(`margin:0;font-family:${C.serif};font-size:32px;font-weight:600;letter-spacing:-.02em`)}>{title}</h1>
      </div>
      <p style={css(`margin:7px 0 0;font-size:13px;color:${C.body};max-width:70ch`)}>{blurb}</p>
    </div>
  );
}

export function Note({ tag, children, tone = 'gold' }: { tag: string; children: React.ReactNode; tone?: 'gold' | 'green' }) {
  const g = tone === 'green';
  return (
    <div style={css(`display:flex;align-items:center;gap:12px;border:1px solid ${g ? C.greenLine : C.goldLight};background:${g ? C.greenBg : C.goldBg};padding:11px 15px`)}>
      <span style={css(`font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${g ? C.green : C.gold};border:1px solid ${g ? C.greenLine : C.goldLight};background:${C.paper};padding:3px 7px;flex-shrink:0`)}>
        {tag}
      </span>
      <span style={css(`font-size:12px;color:${g ? '#31463C' : C.body};line-height:1.5`)}>{children}</span>
    </div>
  );
}

export function Section({ title, telugu, aside, children }: { title: string; telugu?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={css(`background:${C.paper};border:1px solid ${C.rule};border-top:2px solid ${C.ink}`)}>
      <div style={css(`padding:13px 18px;border-bottom:1px solid ${C.rule};display:flex;align-items:baseline;gap:12px;flex-wrap:wrap`)}>
        <h2 style={css(`margin:0;font-family:${C.serif};font-size:17px;font-weight:600`)}>{title}</h2>
        {aside ? <span style={css('margin-left:auto')}>{aside}</span> : null}
      </div>
      <div style={css('padding:18px')}>{children}</div>
    </section>
  );
}

/** A labelled input. Empty is the resting state — no value is ever pre-filled. */
export function Input({
  field, value, onChange, derivedValue, conflict, source, sourceDocument, onAccept, onDismiss,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  derivedValue?: string;
  conflict?: Conflict;
  source?: DocKind;
  sourceDocument?: string;
  onAccept?: () => void;
  onDismiss?: () => void;
}) {
  const span = field.span || 1;
  const readOnly = field.derived;
  // A derived field can receive an explicit display value from a parent, or
  // its already-calculated value from the bound form. This keeps read-only
  // calculations visible in record-scoped property sections.
  const shown = readOnly ? (derivedValue ?? value) : value;

  return (
    <label style={css(`grid-column:span ${span};display:flex;flex-direction:column;gap:5px;min-width:0`)}>
      <span style={css('display:flex;align-items:baseline;gap:7px;flex-wrap:wrap')}>
        <span style={css(`font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.mutedSoft}`)}>
          {field.label}
        </span>
        {source ? (
          <span style={css(`font-size:8.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${C.green};border:1px solid ${C.greenLine};background:${C.greenBg};padding:1px 5px`)}>
            {SOURCE_TAG[source]}
          </span>
        ) : null}
        {sourceDocument ? <span style={css(`font-size:9px;color:${C.mutedSoft};max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)} title={sourceDocument}>{sourceDocument}</span> : null}
      </span>
      {field.type === 'select' ? (
        <select
          value={shown}
          onChange={e => onChange(e.target.value)}
          style={css(`padding:7px 2px;border:0;border-bottom:1px solid ${C.goldLight};background:transparent;font-size:13.5px;color:${C.ink};outline:none`)}
        >
          <option value=""></option>
          {(field.options || []).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          value={shown}
          rows={3}
          onChange={e => onChange(e.target.value)}
          style={css(`padding:7px 2px;border:0;border-bottom:1px solid ${C.goldLight};background:transparent;font-size:13.5px;color:${C.ink};outline:none;resize:vertical;font-family:inherit`)}
        />
      ) : field.type === 'money' ? (
        <input
          type="text"
          inputMode="decimal"
          value={formatMoneyInput(shown)}
          readOnly={readOnly}
          onChange={e => {
            const raw = e.target.value.replace(/,/g, '');
            if (raw === '' || /^\d*\.?\d*$/.test(raw)) onChange(raw);
          }}
          style={css(
            `padding:7px 2px;border:0;border-bottom:1px solid ${C.goldLight};background:transparent;font-size:13.5px;color:${readOnly ? C.mutedSoft : C.ink};outline:none;font-family:${C.mono};`
          )}
        />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'tel' ? 'tel' : 'text'}
          value={shown}
          readOnly={readOnly}
          onChange={e => onChange(e.target.value)}
          style={css(
            `padding:7px 2px;border:0;border-bottom:1px solid ${C.goldLight};background:transparent;font-size:13.5px;color:${readOnly ? C.mutedSoft : C.ink};outline:none;` +
              (field.type === 'number' || field.id.includes('aadhaar') || field.id.includes('Pan') ? `font-family:${C.mono};` : '')
          )}
        />
      )}
      {conflict ? (
        <span style={css(`display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:10.5px;color:${C.gold};border:1px solid ${C.goldLight};background:${C.goldBg};padding:5px 8px`)}>
          <span style={css('min-width:0')}>
            {SOURCE_TAG[conflict.kind]} says <strong style={css(`color:${C.ink}`)}>{conflict.value}</strong>
          </span>
          <span style={css('margin-left:auto;display:flex;gap:6px;flex-shrink:0')}>
            <button type="button" onClick={onAccept} style={css(`padding:2px 8px;border:1px solid ${C.gold};background:${C.paper};color:${C.gold};font-size:10px;font-weight:700;cursor:pointer`)}>
              Use it
            </button>
            <button type="button" onClick={onDismiss} style={css(`padding:2px 8px;border:1px solid ${C.goldLight};background:transparent;color:${C.muted};font-size:10px;font-weight:600;cursor:pointer`)}>
              Keep mine
            </button>
          </span>
        </span>
      ) : field.hint ? (
        <span style={css(`font-size:10.5px;color:${C.mutedSoft}`)}>{field.hint}</span>
      ) : null}
    </label>
  );
}

const SOURCE_TAG: Record<DocKind, string> = {
  'link-deed': 'Link deed',
  'executant-id': 'Executant ID',
  'claimant-id': 'Claimant ID',
  plan: 'Plan',
  supporting: 'Supporting document',
};

/** One titled group of fields. */
export function FieldGroup({
  group, form, setField, derived, conflicts, fieldSource, fieldEvidence, onAccept, onDismiss, onAcceptGroup,
}: {
  group: Group;
  form: Record<string, string>;
  setField: (id: string, v: string) => void;
  derived?: Record<string, string>;
  conflicts?: Record<string, Conflict>;
  fieldSource?: Record<string, DocKind>;
  fieldEvidence?: Record<string, FieldEvidence>;
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAcceptGroup?: (ids: string[]) => void;
}) {
  const clashing = group.fields.filter(f => conflicts?.[f.id]).map(f => f.id);

  return (
    <Section
      title={group.title}
      telugu={group.telugu}
      aside={
        clashing.length ? (
          <button
            type="button"
            onClick={() => onAcceptGroup?.(clashing)}
            className="hv4"
            style={css(`padding:5px 11px;border:1px solid ${C.gold};background:transparent;color:${C.gold};font-size:10px;font-weight:700;letter-spacing:.04em;cursor:pointer`)}
          >
            Use all {clashing.length} from document
          </button>
        ) : undefined
      }
    >
      {group.note ? (
        <p style={css(`margin:0 0 16px;font-size:12px;color:${C.body};line-height:1.6;max-width:80ch`)}>{group.note}</p>
      ) : null}
      <div style={css(`display:grid;grid-template-columns:repeat(${group.cols || 4},minmax(0,1fr));gap:16px 18px`)}>
        {group.fields.map(f => (
          <Input
            key={f.id}
            field={f}
            value={form[f.id] || ''}
            derivedValue={derived?.[f.id]}
            conflict={conflicts?.[f.id]}
            source={fieldSource?.[f.id]}
            sourceDocument={fieldEvidence?.[f.id]?.docName}
            onAccept={() => onAccept?.(f.id)}
            onDismiss={() => onDismiss?.(f.id)}
            onChange={v => setField(f.id, v)}
          />
        ))}
      </div>
    </Section>
  );
}

/** Shown wherever the design used to display sample records. */
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={css(`padding:26px 18px;text-align:center;font-size:12px;color:${C.mutedSoft};border:1px dashed ${C.goldLight};background:${C.ground}`)}>
      {children}
    </div>
  );
}

export function Button({ onClick, children, kind = 'ghost', disabled }: { onClick?: () => void; children: React.ReactNode; kind?: 'ghost' | 'solid' | 'gold'; disabled?: boolean }) {
  const style =
    kind === 'solid'
      ? `padding:12px 22px;background:${C.ink};border:1px solid ${C.ink};color:#F6F2E9;font-size:12.5px;font-weight:700`
      : kind === 'gold'
      ? `padding:7px 14px;background:transparent;border:1px solid ${C.gold};color:${C.gold};font-size:11px;font-weight:700`
      : `padding:9px 16px;background:transparent;border:1px solid #C9BFA8;font-size:11.5px;font-weight:600;color:${C.body}`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={kind === 'solid' ? 'hv1' : kind === 'gold' ? 'hv4' : 'hv3'}
      style={css(style + `;letter-spacing:.04em;cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? '.45' : '1'}`)}
    >
      {children}
    </button>
  );
}


/** One line of the upload dialog: a pass over the document, and its state. */
export type ProgressStep = {
  title: string;
  state: 'pending' | 'running' | 'done';
  filled?: number;
  waitSeconds?: number;
};

const Marker = ({ state }: { state: ProgressStep['state'] }) => {
  if (state === 'done') {
    return (
      <span style={css(`flex:none;width:16px;height:16px;border-radius:50%;background:${C.green};color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center`)}>
        ✓
      </span>
    );
  }
  if (state === 'running') {
    return (
      <span
        className="dc-spin"
        style={css(`flex:none;width:16px;height:16px;border-radius:50%;border:2px solid ${C.goldLight};border-top-color:${C.gold}`)}
      />
    );
  }
  return <span style={css(`flex:none;width:16px;height:16px;border-radius:50%;border:1.5px solid ${C.rule}`)} />;
};

/**
 * The modal shown while a document is read. Extraction runs as several passes
 * over the file, so the dialog names the pass in flight instead of leaving the
 * drafter watching a dead screen for half a minute.
 */
export function ExtractDialog({
  open, label, fileNames, steps, error, result, onClose, onCancel,
}: {
  open: boolean;
  label: string;
  fileNames: string[];
  steps: ProgressStep[];
  error: string;
  result: string;
  onClose: () => void;
  /** Abandons the read in flight. Absent when the dialog cannot be cancelled. */
  onCancel?: () => void;
}) {
  if (!open) return null;

  const done = steps.filter(s => s.state === 'done').length;
  const finished = !!error || !!result;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const waiting = steps.find(s => s.waitSeconds)?.waitSeconds;

  return (
    <div
      className="dc-veil"
      role="dialog"
      aria-modal="true"
      aria-busy={!finished}
      onClick={() => (finished ? onClose() : onCancel?.())}
      style={css(
        'position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px;' +
        'background:rgba(22,19,15,.44);backdrop-filter:blur(2px)'
      )}
    >
      <div
        className="dc-card"
        onClick={e => e.stopPropagation()}
        style={css(
          `width:min(440px,100%);background:${C.paper};border:1px solid ${C.rule};` +
          'box-shadow:0 24px 60px rgba(22,19,15,.28);padding:22px 24px 20px'
        )}
      >
        <Eyebrow>{finished ? (error ? 'Could not read' : 'Read') : 'Reading the document'}</Eyebrow>
        <div style={css(`font-family:${C.serif};font-size:19px;font-weight:600;color:${C.ink}`)}>{label}</div>
        <div style={css(`margin-top:4px;font-family:${C.mono};font-size:10.5px;color:${C.mutedSoft};word-break:break-all`)}>
          {fileNames.join(' · ')}
        </div>

        <div style={css(`margin:16px 0 14px;height:3px;background:${C.ground}`)}>
          <div style={css(`height:3px;width:${finished && !error ? 100 : pct}%;background:${error ? '#B4553F' : C.gold};transition:width .3s ease`)} />
        </div>

        <div style={css('display:none')}>
          {steps.map(s => (
            <div key={s.title} style={css('display:flex;align-items:center;gap:9px')}>
              <Marker state={s.state} />
              <span style={css(`font-size:12px;color:${s.state === 'pending' ? C.mutedSoft : C.ink}`)}>{s.title}</span>
              {s.state === 'done' ? (
                <span style={css(`margin-left:auto;font-family:${C.mono};font-size:10px;color:${s.filled ? C.green : C.mutedSoft}`)}>
                  {s.filled ? `${s.filled} found` : 'none'}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {waiting ? (
          <p style={css(`margin:14px 0 0;font-size:11px;color:${C.gold}`)}>
            The API is busy — retrying in {waiting}s…
          </p>
        ) : null}

        {error ? (
          <div style={css('margin-top:16px;padding:11px 13px;font-size:11.5px;color:#8A3A2E;background:#FBEDEA;border:1px solid #E8C4BC;line-height:1.6')}>
            {error}
          </div>
        ) : result ? (
          <div style={css('margin-top:16px')}>
            <Note tag="Filled in" tone="green">{result}</Note>
          </div>
        ) : (
          <p style={css(`margin:16px 0 0;font-size:11px;color:${C.mutedSoft};line-height:1.6;text-align:center`)}>
            {waiting ? `The service is busy — retrying in ${waiting}s…` : 'Reading and verifying the document…'}
          </p>
        )}

        <div style={css('display:flex;justify-content:flex-end;gap:8px;margin-top:18px')}>
          {!finished && onCancel ? (
            <Button kind="ghost" onClick={onCancel}>Cancel</Button>
          ) : null}
          <Button kind="ghost" onClick={onClose} disabled={!finished}>
            {finished ? 'Close' : 'Working…'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Where a document is dropped to be read. Extraction runs as soon as files land. */
export function UploadZone({
  kind, busy, status, result, error, audit, onFiles, dialog,
}: {
  kind: DocKind;
  busy: boolean;
  status: string;
  result: string;
  error: string;
  audit?: {
    found: string[]; confirmed: string[]; notFound: string[]; conflicts: string[]; unreadable: string;
  } | null;
  onFiles: (files: File[]) => void;
  dialog?: {
    open: boolean; names: string[]; steps: ProgressStep[];
    close: () => void; cancel?: () => void;
  };
}) {
  const [over, setOver] = React.useState(false);
  const meta = DOC_KINDS[kind];

  const take = (list: FileList | null) => {
    const files = Array.from(list || []);
    if (files.length) onFiles(files);
  };

  return (
    <Section title={meta.label} telugu="పత్రం చదవడం">
      {dialog ? (
        <ExtractDialog
          open={dialog.open}
          label={meta.label}
          fileNames={dialog.names}
          steps={dialog.steps}
          error={error}
          result={busy ? '' : result}
          onClose={dialog.close}
          onCancel={dialog.cancel}
        />
      ) : null}

      <p style={css(`margin:0 0 14px;font-size:12px;color:${C.body};line-height:1.6;max-width:80ch`)}>{meta.blurb}</p>

      <label
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
        style={css(
          `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:26px 18px;` +
          `border:1px dashed ${over || busy ? C.gold : C.goldLight};background:${over ? C.goldBg : C.ground};` +
          `cursor:${busy ? 'progress' : 'pointer'};text-align:center`
        )}
      >
        <span style={css(`font-family:${C.serif};font-size:15px;font-weight:600;color:${busy ? C.gold : C.ink}`)}>
          {busy ? status || 'Reading…' : 'Drop a file here, or choose one'}
        </span>
        <span style={css(`font-size:11px;color:${C.mutedSoft}`)}>
          {busy ? 'A few seconds — cancel any time from the dialog' : 'PDF, photo or Word document · read by Claude, then filled in below'}
        </span>
        <input type="file" multiple accept={meta.accept} disabled={busy}
               onChange={e => { take(e.target.files); e.currentTarget.value = ''; }}
               style={css('display:none')} />
      </label>

      {error ? (
        <div style={css(`margin-top:14px;padding:11px 14px;font-size:11.5px;color:#8A3A2E;background:#FBEDEA;border:1px solid #E8C4BC;line-height:1.6`)}>
          {error}
        </div>
      ) : null}

      {result && !busy ? (
        <div style={css('margin-top:14px')}>
          <Note tag="Read" tone="green">{result}</Note>
        </div>
      ) : null}

      {audit && !busy ? (
        <div style={css(`margin-top:14px;padding:12px 14px;border:1px solid ${C.rule};background:${C.paper};font-size:11px;line-height:1.55`)}>
          <strong style={css(`font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${C.ink}`)}>Extraction audit</strong>
          <p style={css(`margin:5px 0 0;color:${C.body}`)}>
            Found {audit.found.length} new value{audit.found.length === 1 ? '' : 's'}; {audit.confirmed.length} confirmed; {audit.notFound.length} not returned from this source.
          </p>
          {audit.found.length ? <p style={css(`margin:7px 0 0;color:${C.green}`)}><b>Fetched:</b> {audit.found.join(', ')}</p> : null}
          {audit.confirmed.length ? <p style={css(`margin:7px 0 0;color:${C.body}`)}><b>Confirmed:</b> {audit.confirmed.join(', ')}</p> : null}
          {audit.notFound.length ? <p style={css(`margin:7px 0 0;color:${C.mutedSoft}`)}><b>Not returned:</b> {audit.notFound.join(', ')}. These remain blank unless another source supplies them; the app does not infer them.</p> : null}
          {audit.conflicts.length ? <p style={css(`margin:7px 0 0;color:#8A3A2E`)}><b>Needs review:</b> {audit.conflicts.join(', ')}.</p> : null}
          {audit.unreadable ? <p style={css(`margin:7px 0 0;color:${C.mutedSoft}`)}><b>Reader note:</b> {audit.unreadable}</p> : null}
        </div>
      ) : null}

      <p style={css(`margin:12px 0 0;font-size:10.5px;color:${C.mutedSoft};line-height:1.6`)}>
        The file is sent to the Anthropic API to be read, and is not stored by this app.
        Every value it returns is editable below and tagged with where it came from.
      </p>
    </Section>
  );
}
