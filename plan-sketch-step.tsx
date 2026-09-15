import React, { useState } from 'react';
import { Section, Note, Button, C } from './ui';
import { css } from './css';
import type { AppState } from './logic';
import { planDocumentFromDraft } from './plan-sketch-mapping';
import { PropertyDetailsSection, BoundariesSection, PartiesSection } from './plan-sketch-forms';
import { PlanSketchDrawing } from './plan-sketch-drawing';
import { PlanSketchPreview } from './plan-sketch-preview';
import { analyzeManualSketch, applyExtractedDataToPlan, type ExtractedSketchData } from './plan-sketch-extract';
import { SAMPLE_MANUAL_SKETCHES } from './plan-sketch-samples';
import type { PlanDocument } from './plan-sketch-types';

const SKETCH_ACCEPT = 'image/jpeg,image/png,image/webp';

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const match = result.match(/^data:([^;]+);base64,(.*)$/s);
      if (!match) return reject(new Error('Could not read this file.'));
      resolve({ mimeType: match[1], base64: match[2] });
    };
    reader.onerror = () => reject(new Error('Could not read this file.'));
    reader.readAsDataURL(file);
  });
}

export function PlanSketchStep({ state }: { state: AppState }) {
  const [doc, setDoc] = useState<PlanDocument>(() => planDocumentFromDraft(state));
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [extracted, setExtracted] = useState<ExtractedSketchData | null>(null);
  const controller = React.useRef<AbortController | null>(null);

  const runUpload = async (file: File) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setBusy(true);
    setUploadError('');
    setExtracted(null);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const data = await analyzeManualSketch(base64, mimeType, ctrl.signal);
      setExtracted(data);
    } catch (e: any) {
      if (!ctrl.signal.aborted) setUploadError(e?.message || 'Could not read this sketch.');
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  };

  const applyExtracted = () => {
    if (!extracted) return;
    setDoc(current => applyExtractedDataToPlan(current, extracted));
    setExtracted(null);
  };

  const applySample = (sampleData: (typeof SAMPLE_MANUAL_SKETCHES)[number]['expectedData']) => {
    setDoc(current => applyExtractedDataToPlan(current, sampleData as ExtractedSketchData));
  };

  return (
    <div style={css('display:flex;flex-direction:column;gap:18px')}>
      <Note tag="Beta">
        An experimental, self-contained alternative to the registration-plan preview in Property Schedules — this one
        draws a proportional sketch straight from four typed boundary dimensions, instead of tracing an uploaded plan
        photo. Nothing entered here feeds back into the deed, and this step may be removed later.
      </Note>

      <div style={css('display:flex;justify-content:flex-end')}>
        <Button onClick={() => setDoc(planDocumentFromDraft(state))}>Re-sync from deed data</Button>
      </div>

      <Section title="Read dimensions from a sketch photo" telugu="చేతితో గీసిన ప్లాన్ అప్‌లోడ్">
        <p style={css(`margin:0 0 14px;font-size:12px;color:${C.body};line-height:1.6`)}>
          Upload a photo of a hand-drawn sketch to auto-fill the boundary dimensions below. This is optional — typing
          the four dimensions in the form works just as well without it.
        </p>
        <label className="link-upload" aria-disabled={busy}>
          <span>{busy ? 'Reading…' : 'Upload a photo of a hand-drawn sketch'}</span>
          <input type="file" accept={SKETCH_ACCEPT} disabled={busy} hidden
            onChange={e => { const file = e.target.files?.[0]; if (file) void runUpload(file); e.currentTarget.value = ''; }} />
          <button type="button" className="gold" disabled={busy}>Choose file or photo</button>
        </label>
        {uploadError && (
          <div style={css('margin-top:12px;padding:11px 14px;font-size:11.5px;color:#8A3A2E;background:#FBEDEA;border:1px solid #E8C4BC;line-height:1.6')}>
            {uploadError} Typing the dimensions below works regardless.
          </div>
        )}
        {extracted && (
          <div style={css('margin-top:14px;padding:12px 14px;border:1px solid ' + C.rule + ';background:' + C.paper)}>
            <p style={css(`margin:0 0 8px;font-size:11px;color:${C.mutedSoft}`)}>Read from the photo — review before applying:</p>
            <ul style={css('margin:0;padding:0 0 0 18px;font-size:12px;color:' + C.body)}>
              {extracted.northDim && <li>North: {extracted.northDim}</li>}
              {extracted.southDim && <li>South: {extracted.southDim}</li>}
              {extracted.eastDim && <li>East: {extracted.eastDim}</li>}
              {extracted.westDim && <li>West: {extracted.westDim}</li>}
              {extracted.roadSides?.length ? <li>Road side(s): {extracted.roadSides.join(', ')}</li> : null}
              {extracted.summaryNotes && <li>{extracted.summaryNotes}</li>}
            </ul>
            <div style={css('margin-top:12px')}>
              <Button kind="gold" onClick={applyExtracted}>Apply to plan</Button>
            </div>
          </div>
        )}
        <div style={css('display:flex;gap:10px;margin-top:14px')}>
          {SAMPLE_MANUAL_SKETCHES.map(sample => (
            <button key={sample.id} type="button" className="quiet" onClick={() => applySample(sample.expectedData)}>
              Try sample: {sample.title}
            </button>
          ))}
        </div>
      </Section>

      <div className="plan-sketch-columns">
        <div style={css('display:flex;flex-direction:column;gap:18px;min-width:0')}>
          <PropertyDetailsSection property={doc.property} onChange={property => setDoc({ ...doc, property })} />
          <BoundariesSection boundaries={doc.boundaries} onChange={boundaries => setDoc({ ...doc, boundaries })} />
          <PartiesSection
            executant={doc.executant} claimant={doc.claimant} witnesses={doc.witnesses}
            onExecutant={executant => setDoc({ ...doc, executant })}
            onClaimant={claimant => setDoc({ ...doc, claimant })}
            onWitnesses={witnesses => setDoc({ ...doc, witnesses })}
          />
        </div>
        <div className="plan-sketch-live">
          <Section title="Live sketch" telugu="ప్రత్యక్ష రేఖాచిత్రం">
            <PlanSketchDrawing property={doc.property} boundaries={doc.boundaries} />
          </Section>
        </div>
      </div>

      <PlanSketchPreview doc={doc} />
    </div>
  );
}
