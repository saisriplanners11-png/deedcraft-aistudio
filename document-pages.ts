import type Anthropic from '@anthropic-ai/sdk';
import { docxToText, readZip } from './docx';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

type Part = Anthropic.ContentBlockParam;
export type DocumentPage = {
  number: number;
  region: string;
  parts: Part[];
  text?: string;
  image?: () => Promise<Part>;
  localImage?: () => Promise<Blob>;
  untranscribedRaster?: boolean;
  needsVision?: boolean;
  fileIndex?: number;
};

type Prepared = { pages: DocumentPage[]; notes: string[]; dispose: () => Promise<void> };

export function imagePart(bytes: Uint8Array, mime: 'image/png' | 'image/jpeg'): Part {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return { type: 'image', source: { type: 'base64', media_type: mime, data: btoa(binary) } };
}

export async function originalPageParts(page: DocumentPage): Promise<Part[]> {
  return page.image ? [await page.image()] : page.parts;
}

export function visuallyRead(page: DocumentPage): boolean {
  return page.needsVision ?? page.parts.some(part => part.type === 'image' || part.type === 'document');
}

export function pageText(page: DocumentPage): string {
  return page.text ?? page.parts.flatMap(part => part.type === 'text' ? [part.text] : []).join('\n');
}

export function quoteOccurs(text: string, quote: string): boolean {
  const normalize = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  return !!quote.trim() && normalize(text).includes(normalize(quote));
}

/** An omitted page is unambiguous only when the request showed one source page. */
export function citedPage<T extends { number: number }>(pages: T[], citation: unknown): T | undefined {
  if (citation == null) return pages.length === 1 ? pages[0] : undefined;
  if (typeof citation !== 'number' && !(typeof citation === 'string' && /^\d+$/.test(citation))) return;
  return pages.find(page => page.number === Number(citation));
}

type PdfMatrix = readonly [number, number, number, number, number, number];
type PdfTextPosition = { x: number; y: number; characters: number };
const identityMatrix: PdfMatrix = [1, 0, 0, 1, 0, 0];

/** A digital header is not a text layer for the separately scanned body of a page. */
function rasterNeedsTranscription(
  operators: { fnArray: number[]; argsArray: unknown[] },
  codes: { save: number; restore: number; transform: number; paintFormXObjectBegin: number; paintFormXObjectEnd: number; paintImageXObject: number; paintInlineImageXObject: number },
  pageArea: number, textPositions: PdfTextPosition[],
) {
  let matrix = identityMatrix;
  const stack: PdfMatrix[] = [];
  for (const [index, operation] of operators.fnArray.entries()) {
    if (operation === codes.save || operation === codes.paintFormXObjectBegin) stack.push(matrix);
    if (operation === codes.restore || operation === codes.paintFormXObjectEnd) matrix = stack.pop() || identityMatrix;
    const operand = operators.argsArray[index];
    const args = operation === codes.transform ? operand
      : operation === codes.paintFormXObjectBegin && Array.isArray(operand) ? operand[0] : null;
    if (Array.isArray(args) && args.length === 6) {
      const [a, b, c, d, e, f] = matrix;
      const [p, q, r, s, x, y] = args;
      matrix = [a * p + c * q, b * p + d * q, a * r + c * s, b * r + d * s, a * x + c * y + e, b * x + d * y + f];
    }
    if (operation !== codes.paintImageXObject && operation !== codes.paintInlineImageXObject) continue;
    const [a, b, c, d, x, y] = matrix;
    const area = Math.abs(a * d - b * c);
    // Ignore small signatures, logos, portraits and other decorative graphics.
    if (area < pageArea * .045 || Math.min(Math.hypot(a, b), Math.hypot(c, d)) < 55) continue;
    const matrixDeterminant = a * d - b * c;
    let characterCount = 0;
    const lines = new Set<number>();
    for (const position of textPositions) {
      const dx = position.x - x, dy = position.y - y;
      const u = (d * dx - c * dy) / matrixDeterminant;
      const v = (-b * dx + a * dy) / matrixDeterminant;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      characterCount += position.characters;
      lines.add(Math.round(v * 24));
    }
    if (characterCount < 45 || lines.size < 3) return true;
  }
  return false;
}

async function preparePdf(bytes: Uint8Array, signal: AbortSignal, localImages: boolean): Promise<Prepared> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({ data: bytes, wasmUrl: new URL('/pdfjs/wasm/', window.location.origin).href });
  const dispose = () => task.destroy();
  const abortLoading = () => void dispose().catch(() => {});
  signal.addEventListener('abort', abortLoading, { once: true });
  let renderTail = Promise.resolve();
  const images = new Map<number, Promise<Blob>>();
  const pages: DocumentPage[] = [];
  try {
    const pdf = await task.promise;
    async function render(number: number) {
      signal.throwIfAborted();
      const page = await pdf.getPage(number);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, 2200 / original.width, 3300 / original.height) });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not display the PDF page.');
      const rendering = page.render({ canvas, canvasContext: context, viewport });
      const cancel = () => rendering.cancel();
      signal.addEventListener('abort', cancel, { once: true });
      try {
        await rendering.promise;
        signal.throwIfAborted();
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('The PDF page could not be rendered.');
        return blob;
      } finally {
        signal.removeEventListener('abort', cancel);
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }
    }

    for (let number = 1; number <= pdf.numPages; number++) {
      signal.throwIfAborted();
      const page = await pdf.getPage(number);
      let text = '';
      let needsVision = true;
      let untranscribedRaster = false;
      try {
        const content = await page.getTextContent();
        let previous: { x: number; y: number; width: number; height: number } | undefined;
        let hasColumns = false;
        const textPositions: PdfTextPosition[] = [];
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const [, , , , x, y] = item.transform;
          if (localImages && item.str.trim()) textPositions.push({ x: x + item.width / 2, y, characters: item.str.trim().length });
          if (previous && item.str && !text.endsWith('\n')) {
            const lineHeight = Math.max(item.height, previous.height, 4);
            if (Math.abs(previous.y - y) > lineHeight * .5) text += '\n';
            else {
              const gap = x - previous.x - previous.width;
              if (gap > lineHeight * 4) { hasColumns = true; text += '\t'; }
              else if (gap > lineHeight * .12) text += ' ';
            }
          }
          text += item.str + (item.hasEOL ? '\n' : '');
          previous = { x, y, width: item.width, height: item.height };
        }
        text = text.trim();
        if (text.replace(/[^\p{L}\p{N}]/gu, '').length >= 24 && !text.includes('\uFFFD')) {
          const operators = await page.getOperatorList();
          if (localImages) {
            const { width, height } = page.getViewport({ scale: 1 });
            // Scanner exports can include a stale hidden text layer over a photograph.
            // Prefer what is visible when such a layer covers a significant scanned region.
            const hiddenText = operators.fnArray.some((op, index) => op === pdfjs.OPS.setTextRenderingMode
              && [3, 7].includes(operators.argsArray[index]?.[0]));
            untranscribedRaster = rasterNeedsTranscription(operators, pdfjs.OPS, width * height, hiddenText ? [] : textPositions);
            if (hiddenText && untranscribedRaster) text = '';
          } else {
            const ops = operators.fnArray;
            const imageOps = new Set([
              pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageMaskXObject,
              pdfjs.OPS.paintImageXObjectRepeat, pdfjs.OPS.paintInlineImageXObjectGroup, pdfjs.OPS.paintImageMaskXObjectRepeat,
            ]);
            const hasGraphic = ops.some(op => imageOps.has(op) || op === pdfjs.OPS.stroke || op === pdfjs.OPS.fillStroke)
              || ops.filter(op => op === pdfjs.OPS.constructPath).length >= 4;
            needsVision = hasColumns || hasGraphic || !!(await page.getAnnotations()).length;
          }
        }
      } catch {
        signal.throwIfAborted();
        // Keep the original page available if the embedded text is corrupt.
      } finally {
        page.cleanup();
      }
      const localImage = () => {
        const cached = images.get(number);
        if (cached) return cached;
        // PDF.js can share decoded image objects across pages. Render one at a time.
        const result = renderTail.then(() => render(number));
        renderTail = result.then(() => {}, () => { images.delete(number); });
        images.set(number, result);
        if (images.size > 6) images.delete(images.keys().next().value!);
        return result;
      };
      pages.push({
        number, region: 'Page ' + number, text, parts: text ? [{ type: 'text', text }] : [], needsVision, localImage, untranscribedRaster,
        image: async () => imagePart(new Uint8Array(await (await localImage()).arrayBuffer()), 'image/png'),
      });
    }
    return { pages, notes: [], dispose };
  } catch (error) {
    await dispose().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener('abort', abortLoading);
  }
}

/** Preserve Word form rows for the local reader, including cells with several runs. */
function wordTextWithRows(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const body = document.getElementsByTagNameNS(document.documentElement.namespaceURI, 'body')[0];
  if (!body) return null;
  const paragraphs = (element: Element) => Array.from(element.getElementsByTagNameNS(body.namespaceURI, 'p'));
  const paragraphText = (paragraph: Element) => Array.from(paragraph.getElementsByTagNameNS(body.namespaceURI, '*'))
    .map(node => node.localName === 't' ? node.textContent : node.localName === 'tab' || node.localName === 'br' ? '\t' : '').join('').trim();
  const rows = (element: Element): string[] => {
    if (element.namespaceURI !== body.namespaceURI) return [];
    if (element.localName === 'p') return [paragraphText(element)];
    if (element.localName === 'tr') {
      const cells = Array.from(element.children).filter(cell => cell.localName === 'tc');
      return [cells.map(cell => paragraphs(cell).map(paragraphText).filter(Boolean).join(' ')).join('\t')];
    }
    return Array.from(element.children).flatMap(rows);
  };
  return rows(body).filter(row => row.trim()).join('\n');
}

async function prepareOne(file: File, signal: AbortSignal, localImages: boolean): Promise<Prepared> {
  signal.throwIfAborted();
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return preparePdf(bytes, signal, localImages);
  const pages: DocumentPage[] = [];
  const notes: string[] = [];
  const dispose = async () => {};
  if (/\.docx$/i.test(file.name)) {
    const entries = await readZip(bytes);
    const xml = new TextDecoder().decode(entries.find(entry => entry.name === 'word/document.xml')?.data);
    const text = (localImages ? wordTextWithRows(xml) : null) ?? await docxToText(bytes);
    if (text.trim()) pages.push({ number: 0, region: 'Word document text', text, parts: [{ type: 'text', text }] });
    for (const media of entries.filter(entry => /^word\/media\/.+\.(png|jpe?g)$/i.test(entry.name))) {
      const type = /\.png$/i.test(media.name) ? 'image/png' : 'image/jpeg';
      pages.push({ number: 0, region: media.name, parts: localImages ? [] : [imagePart(media.data, type)],
        ...(localImages ? { localImage: async () => new Blob([Uint8Array.from(media.data)], { type }) } : {}) });
    }
    if (/<wpg:|<v:shape|<wps:wsp/.test(xml)) notes.push('This Word file contains native drawing shapes. Upload the plan page as PDF/image to reproduce those shapes faithfully.');
  } else if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) {
    const text = new TextDecoder().decode(bytes);
    pages.push({ number: 0, region: 'Uploaded text', text, parts: [{ type: 'text', text }] });
  } else {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
      throw new Error('Use a PDF, Word document, text file, JPEG, PNG, WebP or GIF image.');
    }
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    try {
      signal.throwIfAborted();
      const scale = Math.min(1, 2800 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not display the image.');
      if (localImages) {
        // Give transparent screenshots a white background and preserve the resulting text pixels.
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, localImages ? 'image/png' : 'image/jpeg', .96));
      if (!blob) throw new Error('The uploaded image could not be read.');
      pages.push({ number: 1, region: 'Uploaded photograph',
        parts: localImages ? [] : [imagePart(new Uint8Array(await blob.arrayBuffer()), 'image/jpeg')],
        ...(localImages ? { localImage: async () => blob } : {}) });
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      bitmap.close();
    }
  }
  return { pages, notes, dispose };
}

/** Pages are numbered across the full bundle, and each retains its file and region. */
export async function prepareDocument(input: File | File[], signal: AbortSignal, { localImages = false } = {}): Promise<Prepared> {
  const files = Array.isArray(input) ? input : [input];
  if (!files.length) throw new Error('Choose at least one document or image.');
  const pages: DocumentPage[] = [];
  const notes: string[] = [];
  const cleanups: Prepared['dispose'][] = [];
  const dispose = async () => { await Promise.allSettled(cleanups.map(cleanup => cleanup())); };
  try {
    for (const [fileIndex, file] of files.entries()) {
      let prepared: Prepared;
      try {
        prepared = await prepareOne(file, signal, localImages);
      } catch (error) {
        signal.throwIfAborted();
        if (!localImages) throw error;
        const message = error instanceof Error && error.name === 'PasswordException'
          ? 'This PDF is password-protected. Upload an unlocked copy to read its details.'
          : 'This file could not be read. Re-export it as a PDF or upload a clearer PNG or JPEG.';
        if (files.length === 1) throw new Error(message, { cause: error });
        notes.push(file.name + ': ' + message);
        continue;
      }
      cleanups.push(prepared.dispose);
      for (const page of prepared.pages) pages.push({ ...page, number: pages.length + 1, fileIndex, region: file.name + ' · ' + page.region });
      notes.push(...prepared.notes.map(note => file.name + ': ' + note));
    }
    return { pages, notes, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}
