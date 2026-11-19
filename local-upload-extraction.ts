import { pageText, prepareDocument, type DocumentPage } from './document-pages';
import { readLocalDocumentFields, supportsLocalIdentity, supportsLocalRead, type LocalPage } from './local-document-fields';
import type { ExtractionProgress } from './upload-extraction';
import type { openLocalOcr } from './local-ocr';

export async function extractLocally(files: File[], signal: AbortSignal, progress: (event: ExtractionProgress) => void, profile: string, reconveyance: boolean) {
  if (!supportsLocalRead(profile)) return { candidates: [], plans: [], notes: ['This document type is attached for manual entry while AI extraction is off.'] };
  const started = performance.now();
  progress({ id: 'local', title: 'Reading on this device', state: 'running' });
  const document = await prepareDocument(files, signal, { localImages: true });
  const pages: LocalPage[] = [];
  const notes = [...document.notes];
  const identityUpload = supportsLocalIdentity(profile);
  const scanned: DocumentPage[] = [];
  const pagesMs: Record<string, number> = {};
  let scanIndex = 0;
  try {
    for (const page of document.pages) {
      signal.throwIfAborted();
      const embedded = pageText(page);
      if (!page.untranscribedRaster && embedded && !embedded.includes('\uFFFD')
        && (embedded.replace(/[^\p{L}\p{N}]/gu, '').length >= 24 || !page.localImage)) {
        const separateContactNote = page.fileIndex != null && /\.(?:txt|md|docx)$/i.test(files[page.fileIndex].name);
        pages.push({ number: page.number, region: page.region, text: embedded, separateContactNote });
      } else if (page.localImage) {
        scanned.push(page);
      }
    }
    // Keep full OCR resolution and overlap independent page reads on devices with spare CPU.
    const parallel = navigator.hardwareConcurrency >= 6
      && ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) >= 4;
    const readScans = async () => {
      let worker: Promise<Awaited<ReturnType<typeof openLocalOcr>>> | undefined;
      try {
        for (let page = scanned[scanIndex++]; page; page = scanned[scanIndex++]) {
          signal.throwIfAborted();
          const pageStart = performance.now();
          try {
            worker ??= import('./local-ocr').then(module => module.openLocalOcr(signal));
            const [ocr, image] = await Promise.all([worker, page.localImage!()]);
            // PDF.js already renders scanned pages at a higher resolution.
            const text = await ocr.read(image, identityUpload && !page.image);
            if (text.trim()) pages.push({ number: page.number, region: page.region + ' · OCR transcription', text });
            else {
              if (page.untranscribedRaster) pages.push({ number: page.number, region: page.region, text: pageText(page) });
              notes.push(page.region + ' could not be read by local OCR.');
            }
          } catch {
            signal.throwIfAborted();
            await worker?.then(ocr => ocr.close()).catch(() => {});
            worker = undefined;
            if (page.untranscribedRaster) pages.push({ number: page.number, region: page.region, text: pageText(page) });
            notes.push(page.region + ' could not be read by local OCR. Try a searchable PDF or a clearer image.');
          } finally {
            pagesMs[page.number] = Math.round(performance.now() - pageStart);
          }
        }
      } finally {
        await worker?.then(ocr => ocr.close()).catch(() => {});
      }
    };
    const reads = await Promise.allSettled(Array.from({ length: Math.min(scanned.length, parallel ? 2 : 1) }, readScans));
    for (const read of reads) if (read.status === 'rejected') throw read.reason;
    const result = readLocalDocumentFields(pages.sort((a, b) => a.number - b.number), profile, reconveyance);
    progress({ id: 'local', title: 'Reading on this device', state: 'done' });
    return { ...result, notes: [...notes, ...result.notes], timing: { totalMs: Math.round(performance.now() - started), pagesMs } };
  } finally {
    await document.dispose();
  }
}
