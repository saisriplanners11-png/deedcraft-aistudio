import { createWorker, OEM, PSM } from 'tesseract.js';
import workerUrl from 'tesseract.js/dist/worker.min.js?url';

/** Tesseract jobs do not support AbortSignal directly. Release the worker when the upload stops. */
export function untilStopped<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}

/** Make small printed identity-card text more legible without changing the original upload. */
async function enhanceIdentityImage(input: Blob, signal: AbortSignal): Promise<Blob> {
  const image = await createImageBitmap(input);
  try {
    signal.throwIfAborted();
    const longEdge = Math.max(image.width, image.height);
    if (longEdge >= 2800) return input;
    const scale = Math.min(2.5, 3000 / longEdge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(image.width * scale);
    canvas.height = Math.ceil(image.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return input;
    try {
      context.filter = 'grayscale(1) contrast(1.35)';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await untilStopped(new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png')), signal);
      return blob || input;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    image.close();
  }
}

export async function openLocalOcr(signal: AbortSignal) {
  const setup = AbortSignal.any([signal, AbortSignal.timeout(90000)]);
  const opening = createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: workerUrl,
    // The worker selects the quickest supported WASM core, including a scalar fallback.
    corePath: new URL('/ocr/v7/core/', window.location.origin).href,
    langPath: new URL('/ocr/v7/', window.location.origin).href,
    workerBlobURL: false,
    cachePath: 'deedcraft-ocr-v7-best-int-1',
  });
  const worker = await untilStopped(opening, setup).catch(error => {
    void opening.then(lateWorker => lateWorker.terminate()).catch(() => {});
    throw error;
  });
  try {
    await untilStopped(worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' }), setup);
  } catch (error) {
    await worker.terminate();
    throw error;
  }
  return {
    read: async (image: Blob, enhanceIdentity = false) => {
      const scan = AbortSignal.any([signal, AbortSignal.timeout(90000)]);
      const input = enhanceIdentity ? await enhanceIdentityImage(image, scan) : image;
      let result = await untilStopped(worker.recognize(input, { rotateAuto: true }), scan);
      if (enhanceIdentity && result.data.confidence < 65) {
        // Aadhaar cards place short lines around the portrait and QR code.
        await untilStopped(worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }), scan);
        const sparse = await untilStopped(worker.recognize(input, { rotateAuto: true }), scan);
        await untilStopped(worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO }), scan);
        if (sparse.data.text.trim() && sparse.data.confidence >= result.data.confidence + 8) result = sparse;
      }
      // Automatic deskew handles small angles. Retry sideways and upside-down pages
      // when the first transcription is weak, keeping all attempts within the same timeout.
      if (result.data.confidence < 65) {
        for (const angle of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
          scan.throwIfAborted();
          const rotated = await untilStopped(worker.recognize(input, { rotateRadians: angle }), scan);
          if (rotated.data.confidence >= 65 && rotated.data.confidence >= result.data.confidence + 8) return rotated.data.text;
        }
      }
      return result.data.text;
    },
    close: () => worker.terminate(),
  };
}
