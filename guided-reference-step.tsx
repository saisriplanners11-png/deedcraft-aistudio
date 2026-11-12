import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PlanDocument } from './guided-reference-plan/src/types';
import { syncGuidedDeedBoundaries, applyGuidedRefresh, guidedRefreshFields, isGuidedPlan } from './guided-reference-integration';

export function GuidedReferenceStep({ draftId, scheduleId, seed, doc, enteredDeedDimensions, selected, onChange, onUse, theme = 'light', variant = 'guided' }: {
  draftId: string; scheduleId: string; seed: PlanDocument; doc?: PlanDocument; enteredDeedDimensions?: readonly string[]; selected: boolean;
  onChange: (doc: PlanDocument) => void; onUse: (svg: string) => void; theme?: 'light' | 'dark'; variant?: 'guided' | 'latest';
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [review, setReview] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const deedSides = enteredDeedDimensions && JSON.stringify([seed.boundaries, enteredDeedDimensions]);
  const currentDoc = doc || seed;
  const lastDeedSides = useRef<string | undefined>(undefined);
  const latest = useRef({ seed, doc, onChange, onUse }); latest.current = { seed, doc, onChange, onUse };
  const changes = useMemo(() => guidedRefreshFields(currentDoc, seed), [currentDoc, seed]);
  const sendTheme = () => frame.current?.contentWindow?.postMessage({
    type: 'deedcraft:guided-plan-theme', draftId, scheduleId, sessionId, theme,
  }, window.location.origin);
  useEffect(() => sendTheme(), [theme]);
  const sendSeed = (next = latest.current.doc || latest.current.seed) => frame.current?.contentWindow?.postMessage({
    type: 'deedcraft:guided-plan-seed', draftId, scheduleId, sessionId, doc: next,
  }, window.location.origin);
  useEffect(() => {
    if (!deedSides || lastDeedSides.current === deedSides) return;
    lastDeedSides.current = deedSides;
    const current = latest.current.doc;
    if (!current) return;
    const next = syncGuidedDeedBoundaries(current, latest.current.seed, enteredDeedDimensions);
    if (next !== current) {
      latest.current = { ...latest.current, doc: next };
      latest.current.onChange(next);
      sendSeed(next);
    }
  }, [deedSides]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow
        || data?.draftId !== draftId || data?.scheduleId !== scheduleId || data?.sessionId !== sessionId) return;
      if (data.type === 'deedcraft:guided-plan-ready') {
        if (!latest.current.doc) latest.current.onChange(latest.current.seed);
        sendSeed();
      }
      if (data.type === 'deedcraft:guided-plan-change' && isGuidedPlan(data.doc)
        && JSON.stringify(data.doc) !== JSON.stringify(latest.current.doc || latest.current.seed)) latest.current.onChange(data.doc);
      if (data.type === 'deedcraft:guided-plan-use' && typeof data.png === 'string'
        && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.png)
        && Number.isFinite(data.width) && Number.isFinite(data.height) && data.width > 0 && data.height > 0
        && JSON.stringify(data.doc) === JSON.stringify(latest.current.doc || latest.current.seed)) {
        latest.current.onUse(`<svg xmlns="http://www.w3.org/2000/svg" width="${data.width}" height="${data.height}" viewBox="0 0 ${data.width} ${data.height}"><image width="${data.width}" height="${data.height}" href="${data.png}" /></svg>`);
        setError('');
      }
      if (data.type === 'deedcraft:guided-plan-error') setError(String(data.error || 'Could not prepare the plan.'));
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [draftId, scheduleId, sessionId]);
  return <>
    <div className="plan-workspace-actions">
      <button aria-expanded={review} onClick={() => { setReview(!review); setChecked([]); }}>Review and refresh from deed</button>
      <button className="primary" onClick={() => frame.current?.contentWindow?.postMessage({ type: 'deedcraft:guided-plan-request-use', draftId, scheduleId, sessionId }, window.location.origin)}>Use this plan in deed</button>
      {selected && <span role="status">This new generator plan is selected for this schedule.</span>}
    </div>
    {error && <p role="alert">{error}</p>}
    {review && <div className="plan-refresh-review">
      <p>Select changed deed facts to copy into this plan. Drawing settings and unselected edits stay here.</p>
      {!changes.length && <p>Plan facts match the current deed.</p>}
      {changes.map(field => { const id = field.path.join('.'); return <label key={id} style={{ display: 'block', margin: '8px 0' }}>
        <input type="checkbox" checked={checked.includes(id)} onChange={() => setChecked(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id])} />
        {field.label}: {JSON.stringify(field.before) || 'blank'} → {JSON.stringify(field.after) || 'blank'}
      </label>; })}
      <button disabled={!checked.length} onClick={() => {
        const next = applyGuidedRefresh(currentDoc, changes.filter(field => checked.includes(field.path.join('.'))));
        onChange(next); sendSeed(next); setReview(false);
      }}>Apply selected deed facts to plan</button>
    </div>}
    <iframe className="plan-workspace-frame" ref={frame} title={variant === 'latest' ? 'Property Plan — Latest Generator' : 'Property Plan — New Generator'}
      src={`/${variant}-reference-plan/index.html?draftId=${encodeURIComponent(draftId)}&scheduleId=${encodeURIComponent(scheduleId)}&sessionId=${sessionId}`}
      onLoad={() => { sendSeed(); sendTheme(); }} style={{ display: 'block', width: '100%', minHeight: 900, height: 'calc(100vh - 170px)', border: 0, background: 'var(--dc-ground)' }} />
  </>;
}
