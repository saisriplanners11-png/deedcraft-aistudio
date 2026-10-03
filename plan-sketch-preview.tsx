import React, { useEffect, useRef, useState } from 'react';
import { Section, Button, C } from './ui';
import { css } from './css';
import { planPdf, planPng, text, lines as wrapLines } from './registration-plan';
import { saveBlob } from './docx';
import { generateLegalDescription, validatePlanDocument } from './plan-sketch-dimensions';
import { PlanSketchDrawing } from './plan-sketch-drawing';
import type { PlanDocument } from './plan-sketch-types';

/**
 * Composes the "PLAN FOR REGISTRATION" page in the office's standard format
 * (title, property description, EXECUTANT/S & CLAIMANT/S particulars, a
 * bordered site-plan box, signature lines and the area-under-registration
 * index) — fed from this step's own PlanDocument and its live proportional
 * sketch, instead of a traced photo.
 */
function planSketchRegistrationSvg(doc: PlanDocument, innerSvg: SVGSVGElement): string {
  const legal = generateLegalDescription(doc);
  const period = (value: string) => (value.endsWith('.') ? value : `${value}.`);
  const executants = legal.executantText ? period(legal.executantText) : '';
  const claimants = legal.claimantText ? period(legal.claimantText) : '';

  let body = text(450, 86, 'PLAN FOR REGISTRATION', 24, 'text-anchor="middle" text-decoration="underline"');
  let y = 132;
  for (const paragraph of [legal.propertyDescription, executants && `EXECUTANT/S: ${executants}`, claimants && `CLAIMANT/S: ${claimants}`].filter(Boolean)) {
    for (const line of wrapLines(paragraph, 780, 18)) { body += text(60, y, line); y += 23; }
    y += 24;
  }
  if (y > 700) throw new Error('The plan party details exceed the page. Shorten address text or the property description.');

  const top = y + 14;
  const height = Math.min(460, 940 - top);

  body += `<rect x="60" y="${top}" width="780" height="${height}" fill="none" stroke="black" stroke-width="1.5"/>`;
  const inner = innerSvg.cloneNode(true) as SVGSVGElement;
  inner.removeAttribute('class');
  const viewBox = innerSvg.getAttribute('viewBox') || '0 0 740 520';
  const serialized = new XMLSerializer().serializeToString(inner).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  body += `<svg x="70" y="${top + 10}" width="760" height="${height - 20}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${serialized}</svg>`;

  const footerTop = top + height + 40;
  body += '<rect x="60" y="' + footerTop + '" width="22" height="16" fill="none" stroke="black"/>';
  body += text(92, footerTop + 12, 'AREA UNDER REGN.', 16, 'text-decoration="underline"');

  const signTop = footerTop + 55;
  body += text(60, signTop, 'WITNESSES:', 18, 'text-decoration="underline"');
  body += `<line x1="655" y1="${signTop - 14}" x2="840" y2="${signTop - 14}" stroke="black"/>`;
  body += text(840, signTop, 'EXECUTANT/S SIGN/S', 18, 'text-anchor="end" text-decoration="underline"');
  body += text(60, signTop + 46, '1.', 18);
  body += `<line x1="80" y1="${signTop + 46}" x2="330" y2="${signTop + 46}" stroke="black"/>`;
  if (doc.witnesses.witness1.trim()) body += text(88, signTop + 40, doc.witnesses.witness1.trim(), 14);

  const claimSignTop = signTop + 96;
  body += `<line x1="655" y1="${claimSignTop - 14}" x2="840" y2="${claimSignTop - 14}" stroke="black"/>`;
  body += text(840, claimSignTop, 'CLAIMANT/S SIGN/S', 18, 'text-anchor="end" text-decoration="underline"');
  body += text(60, claimSignTop, '2.', 18);
  body += `<line x1="80" y1="${claimSignTop}" x2="330" y2="${claimSignTop}" stroke="black"/>`;
  if (doc.witnesses.witness2.trim()) body += text(88, claimSignTop - 6, doc.witnesses.witness2.trim(), 14);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1273" viewBox="0 0 900 1273">` +
    `<rect width="900" height="1273" fill="white"/>` +
    `<g fill="black" font-family="'Times New Roman','Noto Serif Telugu',serif">` +
    `<rect x="25" y="25" width="850" height="1223" fill="none" stroke="black"/>` +
    `<rect x="30" y="30" width="840" height="1213" fill="none" stroke="black"/>${body}</g></svg>`;
}

export function PlanSketchPreview({ doc, selected, onUse }: { doc: PlanDocument; selected?: boolean; onUse?: (svg: string) => void }) {
  const drawingRef = useRef<HTMLDivElement>(null);
  const [pageSvg, setPageSvg] = useState('');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => setReviewed(false), [doc]);
  const sampleOrigin = doc.id.startsWith('sample-');

  const issues = validatePlanDocument(doc);
  const errors = issues.filter(i => i.severity === 'error');

  const findSvg = () => drawingRef.current?.querySelector('svg') as SVGSVGElement | null;

  // Recompute the composed document page whenever the underlying data changes,
  // so the on-screen preview always matches what "Download" would produce.
  useEffect(() => {
    const svgEl = findSvg();
    if (!svgEl) return;
    setPageSvg(planSketchRegistrationSvg(doc, svgEl));
  }, [doc]);

  const exportPdf = async () => {
    const svgEl = findSvg();
    if (!svgEl) return;
    setExporting(true);
    setMessage('');
    try {
      const svg = planSketchRegistrationSvg(doc, svgEl);
      const png = await planPng(svg);
      const pdf = await planPdf([png]);
      saveBlob(pdf, `Plan_SyNo_${(doc.property.surveyNo || 'draft').replace(/[^\w-]+/g, '_')}.pdf`);
    } catch (e: any) {
      setMessage(e?.message || 'Could not export the plan sketch.');
    } finally {
      setExporting(false);
    }
  };
  const copyText = async () => {
    const legal = generateLegalDescription(doc);
    try {
      await navigator.clipboard.writeText([legal.propertyDescription, legal.executantText, legal.claimantText].join('\n\n'));
      setMessage('Plan legal text copied.');
    } catch { setMessage('Clipboard access was unavailable. Select the legal text in the preview instead.'); }
  };

  return (
    <Section title="Plan preview &amp; export" telugu="ప్రివ్యూ">
      {errors.length > 0 && (
        <div style={css('margin-bottom:14px;padding:11px 14px;font-size:11.5px;color:#8A3A2E;background:#FBEDEA;border:1px solid #E8C4BC;line-height:1.6')}>
          <strong>Before exporting:</strong> {errors.map(e => e.message).join(' ')}
        </div>
      )}
      {sampleOrigin && <p style={css(`padding:10px;border:1px solid ${C.goldLight};font-size:12px;color:${C.body}`)}>
        This is a demonstration plan with sample property and party details. Save it as a working copy, replace those details, and review it before use in a deed.
      </p>}

      {/* Off-screen: only used to hand a rendered <svg> to the composer above. */}
      <div ref={drawingRef} style={css('position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none')} aria-hidden="true">
        <PlanSketchDrawing property={doc.property} boundaries={doc.boundaries} isPrintMode />
      </div>

      <div className="plan-sketch-registration-preview" style={css('background:#fff;border:1px solid ' + C.rule + ';overflow-x:auto')}>
        {pageSvg ? (
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pageSvg)}`}
            alt="Plan for registration, formatted for the sub-registrar's office"
            style={{ display: 'block', width: '100%', minWidth: 480, height: 'auto' }}
          />
        ) : (
          <p style={css(`margin:0;padding:40px;text-align:center;font-size:12px;color:${C.mutedSoft}`)}>Preparing the plan page…</p>
        )}
      </div>

      {onUse && <label style={css(`display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;color:${C.body}`)}>
        <input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
        I checked this plan’s property, measurements, parties, and sketch against this schedule.
      </label>}
      <div style={css('display:flex;gap:10px;margin-top:16px')}>
        {onUse && <Button kind="gold" disabled={!pageSvg || errors.length > 0 || !reviewed || sampleOrigin} onClick={() => onUse(pageSvg)}>{selected ? 'Selected for deed' : 'Use this plan in deed'}</Button>}
        <Button kind="solid" onClick={exportPdf} disabled={exporting}>{exporting ? 'Preparing…' : 'Download plan for registration (PDF)'}</Button>
        <Button onClick={() => void copyText()}>Copy legal text</Button>
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      {message && <p role="status" style={css(`margin-top:10px;font-size:12px;color:${C.gold}`)}>{message}</p>}
    </Section>
  );
}
