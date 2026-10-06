import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PlanDocument } from './exact-reference-plan/src/types';
import { applyExactRefresh, exactRefreshFields, isExactPlan } from './exact-reference-integration';

export function ExactReferenceStep({ draftId, scheduleId, seed, doc, selected, onChange, onUse }: {
  draftId: string; scheduleId: string; seed: PlanDocument; doc?: PlanDocument; selected: boolean;
  onChange: (doc: PlanDocument) => void; onUse: (svg: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [review, setReview] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const latest = useRef({ seed, doc, onChange, onUse }); latest.current = { seed, doc, onChange, onUse };
  const currentDoc = doc || seed;
  const changes = useMemo(() => exactRefreshFields(currentDoc, seed), [currentDoc, seed]);
  const sendSeed = (next = latest.current.doc || latest.current.seed) => frame.current?.contentWindow?.postMessage({
    type: 'deedcraft:exact-plan-seed', draftId, scheduleId, sessionId, doc: next,
  }, window.location.origin);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow
        || data?.draftId !== draftId || data?.scheduleId !== scheduleId || data?.sessionId !== sessionId) return;
      if (data.type === 'deedcraft:exact-plan-ready') {
        if (!latest.current.doc) latest.current.onChange(latest.current.seed);
        sendSeed();
      }
      if (data.type === 'deedcraft:exact-plan-change' && isExactPlan(data.doc)
        && JSON.stringify(data.doc) !== JSON.stringify(latest.current.doc || latest.current.seed)) latest.current.onChange(data.doc);
      if (data.type === 'deedcraft:exact-plan-use' && typeof data.png === 'string'
        && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.png)
        && Number.isFinite(data.width) && Number.isFinite(data.height) && data.width > 0 && data.height > 0
        && JSON.stringify(data.doc) === JSON.stringify(latest.current.doc || latest.current.seed)) {
        latest.current.onUse(`<svg xmlns="http://www.w3.org/2000/svg" width="${data.width}" height="${data.height}" viewBox="0 0 ${data.width} ${data.height}"><image width="${data.width}" height="${data.height}" href="${data.png}" /></svg>`);
        setError('');
      }
      if (data.type === 'deedcraft:exact-plan-error') setError(String(data.error || 'Could not prepare the plan.'));
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [draftId, scheduleId, sessionId]);
  return <>
    <div style={{ display: 'flex', gap: 12, margin: '12px 0', alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={() => { setReview(!review); setChecked([]); }}>Review and refresh from deed</button>
      <button className="primary" onClick={() => frame.current?.contentWindow?.postMessage({ type: 'deedcraft:exact-plan-request-use', draftId, scheduleId, sessionId }, window.location.origin)}>Use this plan in deed</button>
      {selected && <span>This exact reference plan is selected for this schedule.</span>}
    </div>
    {error && <p role="alert">{error}</p>}
    {review && <div style={{ padding: 16, border: '1px solid #d6c8aa', marginBottom: 12 }}>
      <p>Select changed deed facts to copy into this plan. Drawing settings and unselected edits stay here.</p>
      {!changes.length && <p>Plan facts match the current deed.</p>}
      {changes.map(field => { const id = field.path.join('.'); return <label key={id} style={{ display: 'block', margin: '8px 0' }}>
        <input type="checkbox" checked={checked.includes(id)} onChange={() => setChecked(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id])} />
        {field.label}: {JSON.stringify(field.before) || 'blank'} → {JSON.stringify(field.after) || 'blank'}
      </label>; })}
      <button disabled={!checked.length} onClick={() => {
        const next = applyExactRefresh(currentDoc, changes.filter(field => checked.includes(field.path.join('.'))));
        onChange(next); sendSeed(next); setReview(false);
      }}>Apply selected deed facts to plan</button>
    </div>}
    <iframe ref={frame} title="Property Plan — Exact Reference"
      src={`/exact-reference-plan/index.html?draftId=${encodeURIComponent(draftId)}&scheduleId=${encodeURIComponent(scheduleId)}&sessionId=${sessionId}`}
      onLoad={() => sendSeed()} style={{ display: 'block', width: '100%', minHeight: 900, height: 'calc(100vh - 170px)', border: 0, background: '#f1f5f9' }} />
  </>;
}
