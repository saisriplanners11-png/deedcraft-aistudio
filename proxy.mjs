// Forwards Anthropic API calls from the browser, attaching the key server-side.
// Extraction can also be translated to Gemini here. Keeping this boundary means
// the browser never receives either provider key and the existing extraction
// UI does not need provider-specific code.
//
// The browser never sees ANTHROPIC_API_KEY: the client SDK is pointed at
// /api/anthropic with a placeholder key, and this handler swaps in the real one
// before forwarding to api.anthropic.com. It is mounted three ways — the Vite
// dev server, `vite preview`, and server.mjs for production — all from here, so
// there is one implementation of the forwarding rule.

import { withGeminiMedia } from './gemini-media.mjs';

const UPSTREAM = 'https://api.anthropic.com';
const GEMINI_UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta';
export const PROXY_PREFIX = '/api/anthropic';

/** Headers we pass through. Anything else (including the browser's placeholder key) is dropped. */
const FORWARD = new Set(['content-type', 'anthropic-version', 'anthropic-beta', 'accept']);

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};

/**
 * @param {() => string | undefined} getKey  reads the key at request time, so a
 *   changed .env.local takes effect on the next request rather than at boot
 */
const MAX_BODY = 16 * 1024 * 1024;
const readBody = async req => {
  const chunks = []; let size = 0;
  if (Number(req.headers['content-length']) > MAX_BODY) { req.resume(); throw Object.assign(new Error('Upload is too large. Upload fewer pages at a time.'), { status: 413 }); }
  for await (const chunk of req.iterator({ destroyOnReturn: false })) { size += chunk.length; if (size > MAX_BODY) { req.resume(); throw Object.assign(new Error('Upload is too large. Upload fewer pages at a time.'), { status: 413 }); } chunks.push(chunk); }
  return Buffer.concat(chunks);
};

const geminiPart = part => {
  if (part.type === 'text') return { text: part.text };
  if ((part.type === 'image' || part.type === 'document') && part.source?.type === 'base64') {
    return { inlineData: { mimeType: part.source.media_type, data: part.source.data } };
  }
  return null;
};

export const geminiRequest = request => {
  const schema = request.output_config?.format?.schema;
  const isIdentityRead = /Transcribe only the selected ID holder/.test(request.system || '');
  const functionDeclarations = (request.tools || []).map(tool => ({
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.input_schema,
  }));
  const body = {
    contents: (request.messages || []).map(message => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: (Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }])
        .map(geminiPart).filter(Boolean),
    })),
    generationConfig: {
      maxOutputTokens: request.max_tokens,
      // Aadhaar reads are short, schema-bound transcription, not legal
      // reasoning. Gemini 3.8 Flash otherwise defaults to medium thinking,
      // adding substantial latency and sometimes exhausting the output cap
      // before it returns the requested structured fields.
      ...(isIdentityRead ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
      ...(schema ? { responseMimeType: 'application/json', responseJsonSchema: schema } : {}),
    },
    ...(request.system ? { systemInstruction: { parts: [{ text: request.system }] } } : {}),
    ...(functionDeclarations.length ? { tools: [{ functionDeclarations }] } : {}),
  };
  if (request.tool_choice?.type === 'tool') {
    body.toolConfig = { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [request.tool_choice.name] } };
  }
  return body;
};

const anthropicResponse = (response, model) => {
  const candidate = response.candidates?.[0];
  const content = (candidate?.content?.parts || []).flatMap((part, index) => {
    if (part.text !== undefined) return [{ type: 'text', text: part.text }];
    if (part.functionCall) return [{
      type: 'tool_use', id: part.functionCall.id || `gemini-tool-${index}`,
      name: part.functionCall.name, input: part.functionCall.args || {},
    }];
    return [];
  });
  return {
    id: `gemini-${Date.now()}`, type: 'message', role: 'assistant', model, content,
    stop_reason: candidate?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn', stop_sequence: null,
    usage: { input_tokens: response.usageMetadata?.promptTokenCount || 0, output_tokens: response.usageMetadata?.candidatesTokenCount || 0 },
  };
};

export function createProxyHandler(getConfig, options = {}) {
  let active = 0;
  const maxConcurrent = options.maxConcurrent ?? 4;
  const timeoutMs = options.timeoutMs ?? 120000;
  return async function handle(req, res, next) {
    if (!req.url || !req.url.startsWith(PROXY_PREFIX)) return next?.();

    if (req.method !== 'POST') return json(res, 405, { error: { message: 'Only POST is proxied.' } });
    if (active >= maxConcurrent) { req.resume(); res.setHeader('Retry-After', '2'); return json(res, 429, { error: { message: 'The server is busy reading documents. Please retry shortly.' } }); }
    active++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    try {
    const body = await readBody(req);
    let request;
    try { request = JSON.parse(body.toString('utf8')); }
    catch { return json(res, 400, { error: { message: 'Invalid JSON request body.' } }); }

    const config = getConfig();
    const useGemini = config.extractionProvider === 'gemini' && request.model !== config.draftModel;
    const apiKey = useGemini ? config.geminiApiKey : config.anthropicApiKey;
    if (!apiKey) {
      const name = useGemini ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY';
      return json(res, 500, { error: { type: 'no_api_key', message: `${name} is not set. Add it to .env.local and restart the server.` } });
    }

    if (useGemini) {
      try {
        // The browser can only use model identifiers baked in by vite.config.ts;
        // use that identifier so extraction, vision and verification can each
        // select the right Gemini model.
        const model = request.model || config.geminiModel;
        const payload = await withGeminiMedia(geminiRequest(request), {
          apiKey, signal: controller.signal, store: options.mediaStore,
          send: async body => {
            const upstream = await fetch(`${GEMINI_UPSTREAM}/models/${encodeURIComponent(model)}:generateContent`, {
              method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body),
            });
            const payload = await upstream.json();
            if (!upstream.ok) throw Object.assign(new Error(payload.error?.message || 'Gemini request failed.'), { status: upstream.status });
            return payload;
          },
        });
        return json(res, 200, anthropicResponse(payload, request.model));
      } catch (err) {
        if (err.status) return json(res, err.status, { error: { type: 'gemini_error', message: err.message } });
        return json(res, 502, { error: { type: 'proxy_error', message: `Could not reach the Gemini API: ${err?.message || err}` } });
      }
    }

    const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    for (const [k, v] of Object.entries(req.headers)) {
      if (FORWARD.has(k.toLowerCase()) && typeof v === 'string') headers[k] = v;
    }

    const url = UPSTREAM + req.url.slice(PROXY_PREFIX.length);

    try {
      const upstream = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
      res.statusCode = upstream.status;
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('content-type', ct);

      // Streamed responses (SSE) must not be buffered, or the UI shows nothing
      // until the whole draft is finished.
      if (upstream.body) {
        const reader = upstream.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      }
      res.end();
    } catch (err) {
      json(res, 502, {
        error: { type: 'proxy_error', message: `Could not reach api.anthropic.com: ${err?.message || err}` },
      });
    }
    } catch (error) {
      if (!res.headersSent && !res.destroyed) json(res, error.status || 502, { error: { message: error.message || 'Document request failed. Please retry.' } });
      else if (!res.destroyed) res.end();
    } finally { clearTimeout(timer); res.off('close', disconnect); active--; }
  };
}
