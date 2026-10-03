import React, { useMemo, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Section, Note, Button, C } from './ui';
import { css } from './css';
import type { AppState } from './logic';
import { extractUpload } from './upload-extraction';
import { planDocumentFromDraft } from './plan-sketch-mapping';
import { planDeedChanges, type PlanDeedChange } from './plan-sketch-integration';
import { PropertyDetailsSection, BoundariesSection, PartiesSection } from './plan-sketch-forms';
import { PlanSketchDrawing } from './plan-sketch-drawing';
import { PlanSketchPreview } from './plan-sketch-preview';
import { PlanSketchLibrary } from './plan-sketch-library-ui';
import { analyzeManualSketch, applyExtractedDataToPlan, type ExtractedSketchData } from './plan-sketch-extract';
import { SAMPLE_MANUAL_SKETCHES } from './plan-sketch-samples';
import type { PlanDocument } from './plan-sketch-types';

const ACCEPT = '.pdf,.docx,image/jpeg,image/png,image/webp';
const REVIEW_FIELDS: (keyof ExtractedSketchData)[] = ['northDim','southDim','eastDim','westDim','northBoundary','southBoundary','eastBoundary','westBoundary','roadWidth','surveyNo','plotNo','houseNo','nearHNo','locality','village','mandal','district','areaSqYards'];

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const match = String(reader.result || '').match(/^data:([^;]+);base64,(.*)$/s);
      if (!match) return reject(new Error('Could not read this file.'));
      resolve({ mimeType: match[1], base64: match[2] });
    };
    reader.onerror = () => reject(new Error('Could not read this file.'));
    reader.readAsDataURL(file);
  });
}

async function firstPdfPage(file: File): Promise<{ base64: string; url: string }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), wasmUrl: new URL('/pdfjs/wasm/', window.location.origin).href });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: Math.min(2, 1600 / page.getViewport({ scale: 1 }).width) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    const url = canvas.toDataURL('image/png');
    return { url, base64: url.split(',')[1] };
  } finally { await task.destroy(); }
}

export function PlanSketchStep({ state, scheduleId, doc, selected, sourcePlans = [], onChange, onApplyChanges, onUse }: {
  state: AppState; scheduleId: string; doc: PlanDocument; selected: boolean;
  sourcePlans?: { label: string; svg: string }[];
  onChange: (plan: PlanDocument) => void;
  onApplyChanges: (changes: PlanDeedChange[]) => void;
  onUse: (svg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [extracted, setExtracted] = useState<ExtractedSketchData | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [view, setView] = useState<'cad' | 'side' | 'overlay'>('cad');
  const [opacity, setOpacity] = useState(50);
  const [panel, setPanel] = useState<'all' | 'property' | 'boundaries' | 'parties'>('all');
  const [showSync, setShowSync] = useState(false);
  const [syncChecked, setSyncChecked] = useState<string[]>([]);
  const [showApply, setShowApply] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const fromDeed = useMemo(() => planDocumentFromDraft(state, scheduleId), [state, scheduleId]);
  const deedChanges = planDeedChanges(state, scheduleId, doc);
  const syncChanges = [
    ...(['areaSqYards','surveyNo','plotNo','houseNo','nearHNo','locality','village','mandal','district'] as const).map(key => ({
      id: `property:${key}`, label: key, before: String(doc.property[key] ?? ''), after: String(fromDeed.property[key] ?? ''),
    })),
    ...(['northBoundary','southBoundary','eastBoundary','westBoundary'] as const).map(key => ({
      id: `boundaries:${key}`, label: key, before: doc.boundaries[key], after: fromDeed.boundaries[key],
    })),
    ...(['executant','claimant'] as const).flatMap(role => {
      const deedPeople = role === 'executant' ? fromDeed.executants || [] : fromDeed.claimants || [];
      const planPeople = role === 'executant' ? doc.executants || [doc.executant] : doc.claimants || [doc.claimant];
      return deedPeople.flatMap((person, index) =>
        (['name','relation','relativeName','age','occupation','address'] as const).map(key => ({
          id: `${role}:${index}:${key}`, label: `${role} ${index+1} ${key}`,
          before: String(planPeople[index]?.[key] ?? ''), after: String(person[key] ?? ''),
        }))
      );
    }),
  ].filter(c => c.after && c.after !== c.before);
  const runUpload = async (file: File) => {
    controller.current?.abort();
    const ctrl = new AbortController(); controller.current = ctrl;
    setBusy(true); setUploadError(''); setExtracted(null);
    if (sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    if (file.type.startsWith('image/')) setSourceUrl(URL.createObjectURL(file));
    try {
      if (file.type.startsWith('image/')) {
        const { base64, mimeType } = await fileToBase64(file);
        setExtracted(await analyzeManualSketch(base64, mimeType, ctrl.signal));
      } else {
        const pdfImage = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? await firstPdfPage(file) : null;
        if (pdfImage) setSourceUrl(pdfImage.url);
        const result = await extractUpload([file], ctrl.signal, () => {}, undefined, 'property-schedule');
        const fields: Record<string, string> = {};
        for (const c of result.candidates.filter(c => c.status === 'accepted')) fields[c.field] = c.value;
        const sketch = pdfImage ? await analyzeManualSketch(pdfImage.base64, 'image/png', ctrl.signal).catch(() => null) : null;
        setExtracted({
          ...sketch,
          northDim: sketch?.northDim || '', southDim: sketch?.southDim || '', eastDim: sketch?.eastDim || '', westDim: sketch?.westDim || '',
          northBoundary: fields.boundaryNorth || sketch?.northBoundary, southBoundary: fields.boundarySouth || sketch?.southBoundary,
          eastBoundary: fields.boundaryEast || sketch?.eastBoundary, westBoundary: fields.boundaryWest || sketch?.westBoundary,
          surveyNo: fields.surveyNo || sketch?.surveyNo, plotNo: fields.plotNo || sketch?.plotNo, houseNo: fields.bearingHNo || sketch?.houseNo,
          nearHNo: fields.nearHNo || sketch?.nearHNo, locality: fields.locality || sketch?.locality, village: fields.village || sketch?.village,
          mandal: fields.mandal || sketch?.mandal, district: fields.district || sketch?.district,
          areaSqYards: fields.extentSqYards ? Number(fields.extentSqYards) : sketch?.areaSqYards || '',
          summaryNotes: [sketch?.summaryNotes, ...result.notes].filter(Boolean).join(' '),
        });
      }
    } catch (error: any) {
      if (!ctrl.signal.aborted) setUploadError(error?.message || 'Could not read this source.');
    } finally { if (!ctrl.signal.aborted) setBusy(false); }
  };
  const applyExtracted = () => {
    if (!extracted) return;
    onChange(applyExtractedDataToPlan(doc, extracted));
    setExtracted(null);
  };
  const applyDeedFacts = () => {
    const propertyPatch: Record<string, unknown> = {};
    const boundaryPatch: Record<string, unknown> = {};
    const executants = [...(doc.executants?.length ? doc.executants : [doc.executant])];
    const claimants = [...(doc.claimants?.length ? doc.claimants : [doc.claimant])];
    for (const id of syncChecked) {
      const [section, second, third] = id.split(':');
      if (section === 'property') propertyPatch[second] = (fromDeed.property as any)[second];
      if (section === 'boundaries') boundaryPatch[second] = (fromDeed.boundaries as any)[second];
      if (section === 'executant' || section === 'claimant') {
        const people = section === 'executant' ? executants : claimants;
        const source = section === 'executant' ? fromDeed.executants || [] : fromDeed.claimants || [];
        const index = Number(second);
        while (people.length <= index) people.push({ name:'',relation:'S/o',relativeName:'',age:'',occupation:'',address:'' });
        people[index] = { ...people[index], [third]: (source[index] as any)[third] };
      }
    }
    if (propertyPatch.areaSqYards != null) propertyPatch.areaSqMtrs = fromDeed.property.areaSqMtrs;
    onChange({
      ...doc,
      property: { ...doc.property, ...propertyPatch },
      boundaries: { ...doc.boundaries, ...boundaryPatch },
      executants, claimants, executant: executants[0], claimant: claimants[0],
      updatedAt: new Date().toISOString(),
    });
    setShowSync(false); setSyncChecked([]);
  };
  const toggle = (key: string) => setChecked(old => old.includes(key) ? old.filter(item => item !== key) : [...old,key]);
  const keyFor = (c: PlanDeedChange) => `${c.role}:${c.index}:${c.field}`;
  const drawing = <PlanSketchDrawing property={doc.property} boundaries={doc.boundaries} />;
  return <div style={css('display:flex;flex-direction:column;gap:18px')}>
    <Note tag="Plan for this schedule">Edits stay with this property schedule. Review before copying any plan facts into the deed, then choose “Use this plan in deed” for the downloaded outputs.</Note>
    <label style={css(`display:flex;align-items:center;gap:12px;font-size:12px;color:${C.body}`)}>
      Plan title
      <input value={doc.title} onChange={e => onChange({ ...doc, title: e.target.value })} style={css(`flex:1;max-width:560px;padding:8px;border:1px solid ${C.rule};background:${C.paper};color:${C.ink}`)} />
    </label>
    <div style={css('display:flex;gap:8px;flex-wrap:wrap')}>
      <Button onClick={() => setShowSync(!showSync)}>Review re-sync from deed</Button>
      <Button onClick={() => { setChecked([]); setShowApply(!showApply); }}>Review plan changes for deed ({deedChanges.length})</Button>
      {selected && <span style={css(`font-size:12px;color:${C.gold};padding:8px`)}>This plan is selected for this schedule.</span>}
    </div>
    {sourcePlans.length > 1 && <Section title="Conflicting verified source plans">
      <p style={css('font-size:12px')}>The uploaded source plans disagree. Choose one for this schedule after comparing it with the documents.</p>
      <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px')}>
        {sourcePlans.map((source, index) => <div key={index} style={css(`border:1px solid ${C.rule};padding:8px`)}>
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source.svg)}`} alt={source.label} style={{width:'100%',height:210,objectFit:'contain'}} />
          <Button onClick={() => onUse(source.svg)}>Use {source.label}</Button>
        </div>)}
      </div>
    </Section>}
    {showSync && <Section title="Re-sync review">
      <p style={css('font-size:12px')}>The deed has {syncChanges.length} differing supported field(s). Applying copies current deed facts into this plan. Drawing settings and typed boundary dimensions remain here.</p>
      {syncChanges.map(c => <label key={c.id} style={css('display:block;padding:5px 0;font-size:12px')}>
        <input type="checkbox" checked={syncChecked.includes(c.id)} onChange={() => setSyncChecked(old => old.includes(c.id) ? old.filter(id => id !== c.id) : [...old,c.id])} /> {c.label}: plan “{c.before || 'blank'}”; deed “{c.after}”
      </label>)}
      <Button kind="gold" disabled={!syncChecked.length} onClick={applyDeedFacts}>Apply selected deed facts to plan</Button>
    </Section>}
    {showApply && <Section title="Review fields to copy into deed">
      <p style={css('font-size:12px')}>Select only verified values. Area and party details need particular care; the deed revision will need approval again.</p>
      {deedChanges.map(c => <label key={keyFor(c)} style={css('display:block;padding:6px 0;font-size:12px')}>
        <input type="checkbox" checked={checked.includes(keyFor(c))} onChange={() => toggle(keyFor(c))} /> {c.label}: {c.before || 'blank'} → {c.after}
      </label>)}
      <Button kind="gold" disabled={!checked.length} onClick={() => { onApplyChanges(deedChanges.filter(c => checked.includes(keyFor(c)))); setShowApply(false); setChecked([]); }}>Apply selected fields to deed</Button>
    </Section>}
    <Section title="Upload and compare sketch" telugu="ప్లాన్ అప్‌లోడ్">
      <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file=e.dataTransfer.files[0]; if(file) void runUpload(file); }}
        style={css(`padding:14px;border:1px dashed ${C.goldLight};margin-bottom:12px`)}>
        Drop a sketch photo, PDF, or document here, or
        <label className="link-upload" aria-disabled={busy}><input type="file" accept={ACCEPT} disabled={busy} hidden onChange={e => { const file=e.target.files?.[0]; if(file) void runUpload(file); e.currentTarget.value=''; }} /><button type="button" className="gold" disabled={busy}>{busy ? 'Reading…' : 'Choose file or camera'}</button></label>
        <label className="link-upload" aria-disabled={busy}><input type="file" accept="image/*" capture="environment" disabled={busy} hidden onChange={e => { const file=e.target.files?.[0]; if(file) void runUpload(file); e.currentTarget.value=''; }} /><button type="button" className="quiet" disabled={busy}>Open camera</button></label>
      </div>
      {uploadError && <p role="alert">{uploadError}</p>}
      {extracted && <div style={css(`padding:12px;border:1px solid ${C.rule}`)}>
        <p>Review and edit the extracted details before applying. Blank fields stay blank.</p>
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px')}>
          {REVIEW_FIELDS.map(field => <label key={field} style={css('font-size:11px')}>{field}<input value={String(extracted[field] ?? '')} onChange={e => setExtracted({ ...extracted, [field]: field==='areaSqYards' ? (e.target.value ? Number(e.target.value) : '') : e.target.value })} style={css(`display:block;width:100%;padding:6px;border:1px solid ${C.rule}`)} /></label>)}
        </div>
        {extracted.summaryNotes && <p>{extracted.summaryNotes}</p>}
        <Button kind="gold" onClick={applyExtracted}>Apply reviewed details to plan</Button>
      </div>}
      <div style={css('display:flex;gap:8px;flex-wrap:wrap;margin-top:12px')}>
        {SAMPLE_MANUAL_SKETCHES.map(sample => <Button key={sample.id} onClick={() => onChange(applyExtractedDataToPlan(doc, sample.expectedData as ExtractedSketchData))}>Try sketch: {sample.title}</Button>)}
      </div>
    </Section>
    <div style={css('display:flex;gap:8px;flex-wrap:wrap')}>
      {(['all','property','boundaries','parties'] as const).map(value => <Button key={value} kind={panel===value?'gold':'ghost'} onClick={() => setPanel(value)}>{value[0].toUpperCase()+value.slice(1)}</Button>)}
    </div>
    <div className="plan-sketch-columns">
      <div style={css('display:flex;flex-direction:column;gap:18px;min-width:0')}>
        {(panel==='all'||panel==='property') && <PropertyDetailsSection property={doc.property} boundaries={doc.boundaries} onChange={property => onChange({ ...doc, property })} />}
        {(panel==='all'||panel==='boundaries') && <BoundariesSection boundaries={doc.boundaries} onChange={boundaries => onChange({ ...doc, boundaries })} />}
        {(panel==='all'||panel==='parties') && <PartiesSection executants={doc.executants?.length ? doc.executants : [doc.executant]} claimants={doc.claimants?.length ? doc.claimants : [doc.claimant]} witnesses={doc.witnesses}
          onExecutants={executants => onChange({ ...doc, executants, executant: executants[0] })}
          onClaimants={claimants => onChange({ ...doc, claimants, claimant: claimants[0] })}
          onWitnesses={witnesses => onChange({ ...doc, witnesses })} />}
      </div>
      <div className="plan-sketch-live"><Section title="Live sketch and comparison" telugu="ప్రత్యక్ష రేఖాచిత్రం">
        <div style={css('display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px')}>
          {(['cad','side','overlay'] as const).map(value => <Button key={value} kind={view===value?'gold':'ghost'} onClick={() => setView(value)}>{value==='cad'?'CAD sketch':value==='side'?'Side by side':'Overlay'}</Button>)}
        </div>
        {view==='overlay' && sourceUrl && <label>Photo opacity <input type="range" min="0" max="100" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /> {opacity}%</label>}
        <div style={css(view==='side' && sourceUrl ? 'display:grid;grid-template-columns:1fr 1fr;gap:8px' : 'position:relative')}>
          {view==='side' && sourceUrl && <img src={sourceUrl} alt="Uploaded sketch" style={{width:'100%',objectFit:'contain'}} />}
          {drawing}
          {view==='overlay' && sourceUrl && <img src={sourceUrl} alt="Uploaded sketch overlay" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',opacity:opacity/100,pointerEvents:'none'}} />}
        </div>
      </Section></div>
    </div>
    <PlanSketchPreview doc={doc} selected={selected} onUse={onUse} />
    <PlanSketchLibrary current={doc} onLoad={onChange} />
  </div>;
}
