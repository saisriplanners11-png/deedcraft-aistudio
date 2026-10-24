import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const API = 'https://generativelanguage.googleapis.com';
const PREFIX = 'deedcraft-media-v1-';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const supported = /^(application\/pdf|image\/(png|jpeg|webp))$/;
function sameHash(encoded, hash) {
  if (typeof encoded !== 'string') return false;
  const decoded = Buffer.from(encoded, 'base64');
  // Files API responses have used both raw digest bytes and the ASCII hex
  // digest inside the base64 field. Both must identify the exact same bytes.
  return (decoded.length === 32 && decoded.toString('hex') === hash) || (decoded.length === 64 && decoded.toString('ascii').toLowerCase() === hash);
}

// Only file references are cached. Results are never cached here: independent
// extraction/verification calls must continue to run against the original bytes.
export function createGeminiMediaStore({ fetch: fetcher = (...args) => fetch(...args), now = Date.now, minBytes = 64 * 1024, maxEntries = 512, inventoryPages = 10, uploadTimeoutMs = 45000 } = {}) {
  const accounts = new Map();
  function accountFor(apiKey) {
    const key = digest(apiKey);
    if (!accounts.has(key)) {
      // A normal process uses one provider key. Bound metadata if keys rotate.
      if (accounts.size >= 4) accounts.delete(accounts.keys().next().value);
      accounts.set(key, { files: new Map(), pending: new Map(), inventory: null, disabledUntil: 0 });
    }
    return accounts.get(key);
  }
  const keyFor = (mime, hash) => mime + ':' + hash;
  function remember(account, key, file) {
    if (file.state !== 'ACTIVE' || !file.uri || !/^files\/[a-z0-9-]+$/.test(file.name || '')) return false;
    const expires = Date.parse(file.expirationTime);
    if (!Number.isFinite(expires) || expires <= now() + 60000) return false;
    if (account.files.size >= maxEntries && !account.files.has(key)) account.files.delete(account.files.keys().next().value);
    account.files.set(key, { file, expires });
    return true;
  }
  async function jsonFetch(url, apiKey, signal, init = {}) {
    const response = await fetcher(url, { ...init, headers: { 'x-goog-api-key': apiKey, ...init.headers }, signal, redirect: 'error' });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Gemini file operation unavailable.'); }
    return response.json();
  }
  async function inventory(account, apiKey) {
    // Render Free can restart after idle periods. Recover our unexpired file
    // references from Gemini metadata instead of uploading documents again.
    if (!account.inventory) account.inventory = (async () => {
      const signal = AbortSignal.timeout(10000);
      let token = '';
      for (let page = 0; page < inventoryPages; page++) {
        const url = new URL('/v1beta/files', API);
        url.searchParams.set('pageSize', '100');
        if (token) url.searchParams.set('pageToken', token);
        const result = await jsonFetch(url, apiKey, signal);
        for (const file of result.files || []) {
          const hash = file.displayName?.startsWith(PREFIX) ? file.displayName.slice(PREFIX.length) : '';
          if (!/^[a-f0-9]{64}$/.test(hash) || !supported.test(file.mimeType || '')) continue;
          // Do not trust the display name alone when discovering an old file.
          if (!sameHash(file.sha256Hash, hash)) continue;
          remember(account, keyFor(file.mimeType, hash), file);
        }
        token = result.nextPageToken;
        if (!token) break;
      }
    })().catch(() => { /* Listing permission is optional; direct uploads still work. */ });
    await account.inventory;
  }
  async function upload(bytes, mime, hash, apiKey, signal, stats) {
    const start = await fetcher(API + '/upload/v1beta/files', {
      method: 'POST', signal, redirect: 'error',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json', 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(bytes.length), 'X-Goog-Upload-Header-Content-Type': mime },
      body: JSON.stringify({ file: { display_name: PREFIX + hash } }),
    });
    const uploadUrl = start.headers.get('x-goog-upload-url');
    await start.body?.cancel();
    if (!start.ok || !uploadUrl || new URL(uploadUrl).origin !== API) throw new Error('Gemini upload session unavailable.');
    stats.uploadedFiles++;
    stats.uploadedBytes += bytes.length;
    const response = await fetcher(uploadUrl, {
      method: 'POST', signal, redirect: 'error',
      headers: { 'Content-Type': mime, 'Content-Length': String(bytes.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
      body: bytes,
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('Gemini file upload unavailable.'); }
    let { file } = await response.json();
    while (file?.state === 'PROCESSING') {
      await delay(500, undefined, { signal });
      file = await jsonFetch(API + '/v1beta/' + file.name, apiKey, signal);
    }
    if (!sameHash(file?.sha256Hash, hash) || file?.mimeType !== mime) throw new Error('Gemini uploaded-file integrity check failed.');
    return file;
  }
  async function sharedUpload(account, key, work, signal) {
    let entry = account.pending.get(key);
    if (!entry) {
      entry = { controller: new AbortController(), waiters: 0, settled: false };
      entry.promise = Promise.resolve().then(() => work(AbortSignal.any([entry.controller.signal, AbortSignal.timeout(uploadTimeoutMs)]))).finally(() => {
        entry.settled = true;
        if (account.pending.get(key) === entry) account.pending.delete(key);
      });
      account.pending.set(key, entry);
    }
    entry.waiters++;
    let onAbort;
    try {
      return await Promise.race([entry.promise, new Promise((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
      })]);
    } finally {
      signal.removeEventListener('abort', onAbort);
      if (--entry.waiters === 0 && !entry.settled) {
        account.pending.delete(key);
        entry.controller.abort();
      }
    }
  }
  return {
    async prepare(request, apiKey, signal = new AbortController().signal) {
      const stats = { mediaParts: 0, referencedParts: 0, uploadedFiles: 0, uploadedBytes: 0, base64BytesAvoided: 0, inlineFallbacks: 0 };
      const account = accountFor(apiKey);
      const used = new Set();
      const contents = Array.isArray(request.contents) ? request.contents : [request.contents];
      const rewritten = await Promise.all(contents.map(async content => ({ ...content, parts: await Promise.all((content?.parts || []).map(async part => {
        const inline = part.inlineData;
        if (!inline || !supported.test(inline.mimeType || '') || typeof inline.data !== 'string') return part;
        stats.mediaParts++;
        // Small inputs stay inline to avoid upload/session overhead.
        if (inline.data.length < Math.ceil(minBytes * 4 / 3) || process.env.GEMINI_FILE_REUSE === 'false' || account.disabledUntil > now()) return part;
        signal.throwIfAborted();
        const bytes = Buffer.from(inline.data, 'base64');
        const hash = digest(bytes), key = keyFor(inline.mimeType, hash);
        try {
          const file = await sharedUpload(account, key, async uploadSignal => {
            await inventory(account, apiKey);
            uploadSignal.throwIfAborted();
            const cached = account.files.get(key);
            if (cached?.expires > now() + 60000) return cached.file;
            account.files.delete(key);
            const uploaded = await upload(bytes, inline.mimeType, hash, apiKey, uploadSignal, stats);
            if (!remember(account, key, uploaded)) throw new Error('Gemini file is not ready for reuse.');
            return uploaded;
          }, signal);
          used.add(key);
          stats.referencedParts++;
          stats.base64BytesAvoided += Buffer.byteLength(inline.data);
          return { ...part, inlineData: undefined, fileData: { fileUri: file.uri, mimeType: inline.mimeType } };
        } catch {
          signal.throwIfAborted();
          account.disabledUntil = now() + 60000;
          stats.inlineFallbacks++;
          // Preserve extraction availability if Files API is temporarily down.
          return part;
        }
      })) })));
      signal.throwIfAborted();
      return {
        request: { ...request, contents: Array.isArray(request.contents) ? rewritten : rewritten[0] }, stats,
        invalidate() { for (const key of used) account.files.delete(key); account.disabledUntil = now() + 60000; },
      };
    },
  };
}

export const geminiMediaStore = createGeminiMediaStore();
export const isGeminiFileReferenceError = error => [400, 403, 404].includes(Number(error.status)) && /file/i.test(error.message || '') && /not found|not exist|expired|permission|not.*active|invalid|unsupported/i.test(error.message || '');

/** Shared by the wizard proxy and the plan/document API. No output deduplication. */
export async function withGeminiMedia(request, { apiKey, signal, send, store = geminiMediaStore, log = console.info }) {
  const prepared = await store.prepare(request, apiKey, signal);
  try {
    try { return await send(prepared.request); }
    catch (error) {
      if (!prepared.stats.referencedParts || !isGeminiFileReferenceError(error) || signal?.aborted) throw error;
      prepared.invalidate();
      prepared.stats.base64BytesAvoided = 0;
      prepared.stats.inlineFallbacks++;
      // One exact-byte fallback for expired/deleted/unsupported references.
      return await send(request);
    }
  } finally {
    if (prepared.stats.mediaParts && process.env.AI_BANDWIDTH_LOG !== 'false') log(JSON.stringify({ event: 'ai_media_transfer', provider: 'gemini', ...prepared.stats }));
  }
}
