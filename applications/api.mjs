import express from 'express';
import { extractFormFieldsFromDocument } from './ai-extractor.ts';

const VALID_FORMS = new Set(['auto', 'ccCopy', 'mvOpen', 'mvHouse', 'ec', 'indent']);
const VALID_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_BASE64_LENGTH = 20 * 1024 * 1024;

export function createApplicationApi({ apiKey, model = 'gemini-3.6-flash' }) {
  const api = express.Router();
  api.post('/extract', express.json({ limit: '21mb' }), async (req, res) => {
    const { targetForm, base64Data } = req.body || {};
    const mimeType = req.body?.mimeType === 'image/jpg' ? 'image/jpeg' : req.body?.mimeType;
    if (!VALID_FORMS.has(targetForm) || !VALID_MIME.has(mimeType) || typeof base64Data !== 'string' || !base64Data) {
      return res.status(400).json({ error: 'Select a valid form and upload a supported PDF or image.' });
    }
    if (base64Data.length > MAX_BASE64_LENGTH) {
      return res.status(413).json({ error: 'The file exceeds 15 MB.' });
    }
    if (base64Data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) {
      return res.status(400).json({ error: 'The uploaded file could not be read.' });
    }
    if (!apiKey) {
      return res.status(503).json({ error: 'AI autofill requires a Gemini API key on the DeedCraft server.' });
    }
    const controller = new AbortController();
    const stop = () => controller.abort();
    const timeout = setTimeout(stop, 90_000);
    res.once('close', stop);
    try {
      const fields = await extractFormFieldsFromDocument({ targetForm, mimeType, base64Data, apiKey, model, signal: controller.signal });
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
    error: error.status === 413 ? 'The file exceeds 15 MB.' : 'Invalid application upload request.',
  }));
  return api;
}
