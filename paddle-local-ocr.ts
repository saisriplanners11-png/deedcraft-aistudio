import { PaddleOCR } from '@paddleocr/paddleocr-js';
import { untilStopped } from './local-ocr';

export async function openPaddleOcr(signal: AbortSignal) {
  const base = new URL('/ocr/paddle-v5/', window.location.origin);
  const model = (name: string) => ({ url: new URL(name + '_onnx_infer.tar', base).href });
  const opening = PaddleOCR.create({
    textDetectionModelName: 'PP-OCRv5_mobile_det',
    textDetectionModelAsset: model('PP-OCRv5_mobile_det'),
    textRecognitionModelName: 'en_PP-OCRv5_mobile_rec',
    textRecognitionModelAsset: model('en_PP-OCRv5_mobile_rec'),
    worker: true,
    ortOptions: { backend: 'wasm', wasmPaths: new URL('wasm/', base).href, numThreads: 1 },
  });
  const ocr = await untilStopped(opening, AbortSignal.any([signal, AbortSignal.timeout(90000)])).catch(error => {
    void opening.then(late => late.dispose()).catch(() => {});
    throw error;
  });
  return {
    async read(image: Blob, identity = false) {
      signal.throwIfAborted();
      const [result] = await untilStopped(ocr.predict(image), AbortSignal.any([signal, AbortSignal.timeout(90000)]));
      if (!result) return '';
      if (identity) {
        const lines = result.items.map(item => ({
          text: item.text, left: Math.min(...item.poly.map(point => point[0])),
        }));
        const front = lines.find(line => /^Government of India$/i.test(line.text.trim()));
        const back = lines.find(line => /^Unique Identification Authority of India$/i.test(line.text.trim()));
        // Aadhaar front and back often appear side by side. Preserve each side's
        // reading order so the reverse address cannot interrupt the front's DOB block.
        if (front && back && back.left - front.left > result.image.width * .25) {
          const divider = (front.left + back.left) / 2;
          return [...lines.filter(line => line.left < divider), ...lines.filter(line => line.left >= divider)]
            .map(line => line.text).join('\n');
        }
      }
      return result.items.map(item => item.text).join('\n');
    },
    close: async () => { await ocr.dispose(); },
  };
}
