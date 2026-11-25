import express from 'express';
import { extractAllA4FormsFromDocument, extractFormFieldsFromDocument } from './ai-extractor.ts';

const VALID_FORMS = new Set(['auto', 'allA4', 'ccCopy', 'mvOpen', 'mvHouse', 'ec', 'indent']);
const VALID_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 35 * 1024 * 1024;
const MAX_FILES = 15;

export function createApplicationApi({ apiKey, model = 'gemini-3.6-flash' }) {
  const api = express.Router();
  api.post('/extract', express.json({ limit: '50mb' }), async (req, res) => {
    const { targetForm, files, base64Data, mimeType } = req.body || {};
    const uploads = files ?? [{ base64Data, mimeType }];
    if (!VALID_FORMS.has(targetForm) || !Array.isArray(uploads) || !uploads.length || uploads.length > MAX_FILES) {
      return res.status(400).json({ error: 'Select a valid form and upload up to 15 PDFs or images.' });
    }

    const documents = [];
    let totalBytes = 0;
    for (const upload of uploads) {
      const data = upload?.base64Data;
      const mime = upload?.mimeType === 'image/jpg' ? 'image/jpeg' : upload?.mimeType;
      if (!VALID_MIME.has(mime) || typeof data !== 'string' || !data || data.length % 4) {
        return res.status(400).json({ error: 'Each upload must contain a supported PDF or image.' });
      }
      const bytes = Buffer.byteLength(data, 'base64');
      totalBytes += bytes;
      if (bytes > MAX_FILE_BYTES || totalBytes > MAX_TOTAL_BYTES) {
        return res.status(413).json({ error: 'Uploads are limited to 15 MB per file and 35 MB combined.' });
      }
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
        return res.status(400).json({ error: 'The uploaded file could not be read.' });
      }
      documents.push({ mimeType: mime, base64Data: data });
    }
    if (!apiKey) {
      return res.status(503).json({ error: 'AI autofill requires a Gemini API key on the DeedCraft server.' });
    }

    const controller = new AbortController();
    const stop = () => controller.abort();
    const timeout = setTimeout(stop, 90_000);
    res.once('close', stop);
    try {
      const options = { files: documents, apiKey, model, signal: controller.signal };
      const fields = targetForm === 'allA4'
        ? await extractAllA4FormsFromDocument(options)
        : await extractFormFieldsFromDocument({ ...options, targetForm });
      res.json(fields);
    } catch (error) {
      if (!res.destroyed) res.status(controller.signal.aborted ? 504 : 502).json({
        error: controller.signal.aborted ? 'AI autofill timed out.' : error.message || 'AI autofill failed.',
      });
    } finally {
      clearTimeout(timeout);
      res.off('close', stop);
    }
  });
  api.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({
    error: error.status === 413 ? 'The upload request is too large.' : 'Invalid application upload request.',
  }));
  return api;
}
