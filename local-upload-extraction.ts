import { pageText, prepareDocument, type DocumentPage } from './document-pages';
import { readLocalDocumentFields, supportsLocalIdentity, supportsLocalRead, type LocalPage } from './local-document-fields';
import type { openLocalOcr } from './local-ocr';
import type { openPaddleOcr } from './paddle-local-ocr';

function englishText(text: string) {
  return text.replace(/\p{Script_Extensions=Telugu}+/gu, '').trim();
}

export async function extractLocally(files: File[], signal: AbortSignal, profile: string, reconveyance: boolean) {
  if (!supportsLocalRead(profile)) return { candidates: [], plans: [], notes: ['Local field matching is unavailable for this document card. Enter the details directly or use cloud extraction.'] };
  const started = performance.now();
  const document = await prepareDocument(files, signal, { localImages: true });
  const pages: LocalPage[] = [];
  const notes = [...document.notes];
  const identityUpload = supportsLocalIdentity(profile);
  const scanned: DocumentPage[] = [];
  const pagesMs: Record<string, number> = {};
  try {
    for (const page of document.pages) {
      signal.throwIfAborted();
      const embedded = englishText(pageText(page)).replace(/\p{Co}/gu, '').trim();
      if (!page.untranscribedRaster && embedded && (!page.localImage
        || (!embedded.includes('\uFFFD') && (embedded.match(/[A-Za-z0-9]/g)?.length ?? 0) >= 24))) {
        const separateContactNote = page.fileIndex != null && /\.(?:txt|md|docx)$/i.test(files[page.fileIndex].name);
        pages.push({ number: page.number, region: page.region, text: embedded, separateContactNote });
      } else if (page.localImage) {
        scanned.push(page);
      }
    }
    // Keep full OCR resolution and overlap independent page reads on devices with spare CPU.
    const parallel = navigator.hardwareConcurrency >= 6
      && ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) >= 4;
    const readScans = async (nextPage: () => DocumentPage | undefined, usePaddle: boolean) => {
      let worker: Promise<Awaited<ReturnType<typeof openLocalOcr>>> | undefined;
      let paddle: Promise<Awaited<ReturnType<typeof openPaddleOcr>>> | undefined;
      let paddleFailed = !usePaddle;
      try {
        for (let page = nextPage(); page; page = nextPage()) {
          signal.throwIfAborted();
          const pageStart = performance.now();
          try {
            const image = await page.localImage!();
            let text = '';
            let engine = 'PaddleOCR';
            if (!paddleFailed) {
              try {
                paddle ??= import('./paddle-local-ocr').then(module => module.openPaddleOcr(signal));
                text = englishText(await (await paddle).read(image, identityUpload));
              } catch (error) {
                signal.throwIfAborted();
                if (import.meta.env.DEV) console.warn('PaddleOCR failed to read the page:', error);
                await paddle?.then(ocr => ocr.close()).catch(() => {});
                paddle = undefined;
                paddleFailed = true;
              }
            }
            if (!text) {
              engine = 'Tesseract fallback';
              worker ??= import('./local-ocr').then(module => module.openLocalOcr(signal));
              text = englishText(await (await worker).read(image, identityUpload));
            }
            if (text) pages.push({ number: page.number, region: page.region + ' · ' + engine + ' transcription', text });
            else {
              if (page.untranscribedRaster) pages.push({ number: page.number, region: page.region, text: englishText(pageText(page)) });
              notes.push(page.region + ' could not be read by local OCR.');
            }
          } catch {
            signal.throwIfAborted();
            await worker?.then(ocr => ocr.close()).catch(() => {});
            worker = undefined;
            if (page.untranscribedRaster) pages.push({ number: page.number, region: page.region, text: englishText(pageText(page)) });
            notes.push(page.region + ' could not be read by local OCR. Try a searchable PDF or a clearer image.');
          } finally {
            pagesMs[page.number] = Math.round(performance.now() - pageStart);
          }
        }
      } finally {
        await Promise.allSettled([worker?.then(ocr => ocr.close()), paddle?.then(ocr => ocr.close())]);
      }
    };
    const readPages = async (input: DocumentPage[], usePaddle: boolean) => {
      let scanIndex = 0;
      const reads = await Promise.allSettled(Array.from({ length: Math.min(input.length, parallel ? 2 : 1) },
        () => readScans(() => input[scanIndex++], usePaddle)));
      for (const read of reads) if (read.status === 'rejected') throw read.reason;
      return readLocalDocumentFields(pages.sort((a, b) => a.number - b.number), profile, reconveyance);
    };
    let result = await readPages(scanned, true);
    // A legible transcript can still lose the line layout needed to bind a field.
    const paddlePages = new Set(pages.filter(page => page.region.endsWith(' · PaddleOCR transcription')).map(page => page.number));
    const identityName = /(?:executant|claimant)(?:Guardian|Minor)?Name$|^personName$/;
    const needsIdentityName = identityUpload && !result.candidates.some(candidate => identityName.test(candidate.field));
    if ((!result.candidates.length || needsIdentityName) && paddlePages.size && !result.notes.some(note => /conflict|several deed/i.test(note))) {
      for (let index = pages.length - 1; index >= 0; index--) if (paddlePages.has(pages[index].number)) pages.splice(index, 1);
      const retry = await readPages(scanned.filter(page => paddlePages.has(page.number)), false);
      if (!result.candidates.length) result = retry;
      else if (retry.candidates.some(candidate => identityName.test(candidate.field))
        && retry.candidates.some(candidate => /(?:Aadhaar|Dob)$/.test(candidate.field)
          && result.candidates.some(previous => previous.field === candidate.field && previous.value === candidate.value))
        && !retry.candidates.some(candidate => result.candidates.some(previous =>
          candidate.field === previous.field && candidate.value.toLowerCase() !== previous.value.toLowerCase()))) {
        const fields = new Set(result.candidates.map(candidate => candidate.field));
        const supplementary = retry.candidates.filter(candidate => !fields.has(candidate.field))
          .map(candidate => ({ ...candidate, id: 'retry:' + candidate.id }));
        result = { ...result, candidates: [...result.candidates, ...supplementary] };
      }
    }
    return { ...result, notes: [...notes, ...result.notes], timing: { totalMs: Math.round(performance.now() - started), pagesMs } };
  } finally {
    await document.dispose();
  }
}
