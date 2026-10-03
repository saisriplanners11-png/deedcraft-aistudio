import React, { useEffect, useState } from 'react';
import { Section, Button, C } from './ui';
import { css } from './css';
import { planSketchLibrary, validateImportedPlan } from './plan-sketch-library';
import { SAMPLE_PLAN_TEMPLATES } from './plan-sketch-saved-samples';
import type { PlanDocument } from './plan-sketch-types';

function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function PlanSketchLibrary({ current, onLoad }: { current: PlanDocument; onLoad: (plan: PlanDocument) => void }) {
  const [plans, setPlans] = useState<PlanDocument[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'saved' | 'templates'>('saved');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const refresh = async () => setPlans(await planSketchLibrary.list());
  useEffect(() => { if (open) void refresh().catch(error => setMessage(error.message)); }, [open]);
  const save = async (asCopy: boolean) => {
    try { const saved = await planSketchLibrary.save(current, asCopy); onLoad(saved); await refresh(); setMessage(`Saved “${saved.title}”.`); }
    catch (error: any) { setMessage(error.message); }
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try { if (file.size > 5_000_000) throw new Error('The JSON backup exceeds 5 MB.'); const count = await planSketchLibrary.import(JSON.parse(await file.text())); await refresh(); setMessage(`Imported ${count} plan${count === 1 ? '' : 's'}.`); }
    catch (error: any) { setMessage(error.message); }
  };
  const shown = (tab === 'saved' ? plans : SAMPLE_PLAN_TEMPLATES).filter(plan =>
    `${plan.title} ${plan.property.village} ${plan.property.surveyNo}`.toLowerCase().includes(query.toLowerCase()));
  return <Section title="Templates & saved plans" telugu="సేవ్ చేసిన ప్లాన్లు">
    <div style={css('display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px')}>
      <Button onClick={() => setOpen(!open)}>{open ? 'Close library' : `Open library (${plans.length})`}</Button>
      <Button onClick={() => void save(false)}>Save / update plan</Button>
      <Button onClick={() => void save(true)}>Save as new copy</Button>
    </div>
    {message && <p role="status" style={css(`font-size:12px;color:${C.body}`)}>{message}</p>}
    {open && <>
      <div style={css('display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px')}>
        <Button kind={tab === 'saved' ? 'gold' : 'ghost'} onClick={() => setTab('saved')}>Saved plans</Button>
        <Button kind={tab === 'templates' ? 'gold' : 'ghost'} onClick={() => setTab('templates')}>Sample templates</Button>
        <input aria-label="Search plans" placeholder="Search plans" value={query} onChange={event => setQuery(event.target.value)}
          style={css(`padding:8px;border:1px solid ${C.rule};background:${C.paper};color:${C.ink}`)} />
      </div>
      <div style={css('display:flex;flex-direction:column;gap:8px')}>
        {shown.map(plan => <div key={plan.id} style={css(`padding:12px;border:1px solid ${C.rule};background:${C.paper}`)}>
          <strong style={css(`display:block;font-size:12px;color:${C.ink}`)}>{plan.title}</strong>
          <small>{plan.property.propertyType} · {plan.property.village || 'Village blank'} · {plan.property.surveyNo || 'Survey blank'}</small>
          <div style={css('display:flex;gap:8px;margin-top:8px;flex-wrap:wrap')}>
            <Button onClick={() => { onLoad(validateImportedPlan(plan)); setMessage(`Loaded “${plan.title}” into this schedule.`); }}>Load</Button>
            <Button onClick={() => downloadJson(plan, `${plan.title.replace(/[^a-z0-9_-]+/gi, '_')}.json`)}>Download JSON</Button>
            {tab === 'saved' && <>
              <Button onClick={() => void planSketchLibrary.save(plan, true).then(refresh).catch(error => setMessage(error.message))}>Duplicate</Button>
              <Button onClick={() => { if (window.confirm(`Delete saved plan “${plan.title}”?`)) void planSketchLibrary.remove(plan.id).then(refresh).catch(error => setMessage(error.message)); }}>Delete</Button>
            </>}
          </div>
        </div>)}
        {!shown.length && <p style={css(`font-size:12px;color:${C.mutedSoft}`)}>No plans match this search.</p>}
      </div>
      <div style={css(`display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid ${C.rule}`)}>
        <label className="quiet">Import plans JSON<input type="file" accept=".json,application/json" hidden onChange={event => { void importJson(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
        <Button onClick={() => downloadJson(plans, 'deedcraft-plan-library-backup.json')} disabled={!plans.length}>Export all backup</Button>
      </div>
    </>}
  </Section>;
}
