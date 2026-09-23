import React from 'react';

export type PlanDrawing = {
  /** Deterministic vector trace of source ink; never supplied as model-generated SVG. */
  tracedPath?: string;
  width?: number;
  height?: number;
  lines: { points: [number, number][] }[];
  labels: { text: string; x: number; y: number; rotation?: number }[];
  scale: string;
};
export const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const blank = '__________';
export const text = (x: number, y: number, value: string, size = 18, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${esc(value)}</text>`;

/** Wrap by measured text when available; deterministic fallback also supports QA. */
export function lines(value: string, width: number, size: number): string[] {
  const measure = (v: string) => {
    if (typeof document === 'undefined') return [...v].length * size * .52;
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${size}px "Times New Roman", serif`;
    return ctx.measureText(v).width;
  };
  const result: string[] = []; let current = '';
  for (const word of value.split(/\s+/)) {
    if (measure((current ? current + ' ' : '') + word) <= width) { current += (current ? ' ' : '') + word; continue; }
    if (current) result.push(current);
    current = '';
    for (const char of word) {
      if (current && measure(current + char) > width) { result.push(current); current = ''; }
      current += char;
    }
  }
  if (current) result.push(current);
  return result;
}

export function registrationPlanSvg(form: Record<string, string>, drawing?: PlanDrawing | null, parties?: { vendors: Record<string, string>[]; buyers: Record<string, string>[] }): string {
  const f = (id: string) => form[id]?.trim() || blank;
  const party = (record: Record<string, string>, side: string) => {
    const get = (suffix: string) => record[side + suffix]?.trim() || blank;
    const entity = record[side + 'EntityName']?.trim();
    const relation = [record[side + 'Relation']?.trim(), record[side + 'RelativeName']?.trim()].filter(Boolean).join(' ') || blank;
    const signatory = `${get('Name')}, ${relation}, ${record[side + 'SignatoryDesignation']?.trim() || 'AUTHORIZED SIGNATORY'}`;
    const identity = entity ? `${entity}, REPRESENTED BY ${signatory}` : `${get('Name')}, ${relation}, AGED ${get('Age')} YEARS, OCCU: ${get('Occupation')}`;
    return `${identity}, R/O H.NO.${get('HNo')}, ${get('Locality')}, ${get('Village')}, ${get('Mandal')}.`.toUpperCase();
  };
  const vendors = (parties?.vendors || [form]).map(p => party(p, 'executant')).join('; ');
  const buyers = (parties?.buyers || [form]).map(p => party(p, 'claimant')).join('; ');
  const landmarkRelation = f('nearAdjacent') === blank ? 'NEAR/ADJACENT' : f('nearAdjacent');
  const description = `THE ${form.category === 'Residential' ? 'HOUSE BEARING H.NO.' + f('bearingHNo') : 'OPEN PLOT NO.' + f('plotNo')}, ADMEASURING A TOTAL AREA OF ${f('extentSqYards')} SQUARE YARDS EQUIVALENT TO ${f('extentSqMeters')} SQUARE METERS, IN SURVEY NO/S.${f('surveyNo')}, SITUATED ${landmarkRelation} H.NO.${f('nearHNo')} OF '${f('locality')}' LOCALITY OF ${f('village')} VILLAGE, ${f('mandal')} MANDAL.`.toUpperCase();
  let body = text(450, 86, 'PLAN FOR REGISTRATION', 24, 'text-anchor="middle" text-decoration="underline"');
  let y = 132;
  for (const paragraph of [description, 'VENDOR/S: ' + vendors, 'VENDEE/S: ' + buyers]) {
    for (const line of lines(paragraph, 780, 18)) { body += text(60, y, line); y += 23; }
    y += 24;
  }
  if (y > 610) throw new Error('The plan party details exceed one page. Shorten only duplicate address text or create separate property plans.');
  body += text(60, y, `SITE-PLAN: SCALE ${drawing?.scale || blank}`, 23, 'text-decoration="underline"');
  const top = y + 28;
  const available = 955 - top;
  const height = Math.min(440, available);
  if (drawing) {
    // Coordinates represent the source drawing, including roads and direction marks.
    // Uniform scaling preserves shape; no generic plot or north arrow is inserted.
    const drawingWidth = drawing.tracedPath ? drawing.width || 1000 : 1000;
    const drawingHeight = drawing.tracedPath ? drawing.height || 1000 : 1000;
    const regionWidth = drawing.tracedPath ? 680 : 520;
    const factor = Math.min(regionWidth / drawingWidth, height / drawingHeight);
    const tx = 80 + (regionWidth - drawingWidth * factor) / 2;
    body += `<g transform="translate(${tx} ${top}) scale(${factor})" stroke="black" stroke-width="2.5" fill="none">`;
    if (drawing.tracedPath) body += `<path d="${esc(drawing.tracedPath)}" fill="black" stroke="none"/>`;
    for (const line of drawing.lines) body += `<polyline points="${line.points.map(p => p.join(',')).join(' ')}"/>`;
    body += '</g>';
    for (const label of drawing.labels) {
      const lx = tx + label.x * factor; const ly = top + label.y * factor;
      const fontSize = Math.max(8, 18 * factor);
      const wrapped = lines(label.text, 260 * factor, fontSize);
      body += `<g transform="translate(${lx} ${ly}) rotate(${label.rotation || 0})">`;
      wrapped.forEach((line, i) => { body += text(0, i * fontSize * 1.15, line, fontSize, 'text-anchor="middle"'); });
      body += '</g>';
    }
  }
  body += text(655, 930, 'VENDOR/S SIGN/S', 18, 'text-decoration="underline"');
  body += text(655, 1090, 'VENDEE/S SIGN/S', 18, 'text-decoration="underline"');
  body += text(655, 1114, 'WITNESSES:', 18, 'text-decoration="underline"');
  body += text(667, 1160, '1.', 18) + text(667, 1210, '2.', 18);
  body += text(280, 1160, 'INDEX', 18, 'text-anchor="middle" text-decoration="underline"');
  body += '<rect x="115" y="1175" width="38" height="13" fill="none" stroke="black"/>';
  body += text(166, 1190, 'AREA UNDER REGISTRATION', 18, 'text-decoration="underline"');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1273" viewBox="0 0 900 1273"><rect width="900" height="1273" fill="white"/><g fill="black" font-family="Times New Roman, Noto Serif Telugu, serif"><rect x="25" y="25" width="850" height="1223" fill="none" stroke="black"/><rect x="30" y="30" width="840" height="1213" fill="none" stroke="black"/>${body}</g></svg>`;
}

export async function planPng(svg: string): Promise<Uint8Array> {
  await document.fonts.ready;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 2480; canvas.height = 3508;
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not render the registration plan.')), 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}

export async function planPdf(pages: Uint8Array[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Plan for Registration');
  for (const png of pages) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' });
}

export async function downloadRegistrationPlan(form: Record<string, string>, drawing?: PlanDrawing) {
  const { saveBlob } = await import('./docx');
  saveBlob(await planPdf([await planPng(registrationPlanSvg(form, drawing))]), 'registration-plan.pdf');
}

export function RegistrationPlanPreview({ form, drawing }: { form: Record<string, string>; drawing?: PlanDrawing }) {
  return <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(registrationPlanSvg(form, drawing))}`} alt="Registration plan" style={{ width: '100%', height: 'auto' }} />;
}
