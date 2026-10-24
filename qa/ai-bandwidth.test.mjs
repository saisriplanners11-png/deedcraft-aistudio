import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createServer, request as httpRequest } from 'node:http';
import { createGeminiMediaStore, withGeminiMedia } from '../gemini-media.mjs';
import { createProxyHandler } from '../proxy.mjs';

const bytes = Buffer.alloc(256 * 1024, 0xab);
const input = (data = bytes, text = 'Extract the identity.', mimeType = 'image/png') => ({
  contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: data.toString('base64') } }, { text }] }],
  systemInstruction: { parts: [{ text: 'Copy evidence exactly.' }] },
  generationConfig: { maxOutputTokens: 8000 }, tools: [{ functionDeclarations: [{ name: 'record_transcription' }] }],
});
const ok = body => Response.json(body);
function provider() {
  let time = Date.parse('2026-10-24T00:00:00Z');
  const files = [], sessions = new Map(), uploads = [], calls = [];
  const fetch = async (url, init = {}) => {
    const target = new URL(url);
    calls.push({ url: String(url), init });
    if (init.signal?.aborted) throw init.signal.reason;
    if (target.pathname === '/v1beta/files') return ok({ files: files.filter(file => file.key === init.headers['x-goog-api-key']).map(({ key, ...file }) => file) });
    if (target.pathname === '/upload/v1beta/files') {
      const id = String(sessions.size + 1);
      sessions.set(id, { key: init.headers['x-goog-api-key'], mime: init.headers['X-Goog-Upload-Header-Content-Type'], ...JSON.parse(init.body).file });
      return new Response('', { headers: { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload-session/' + id } });
    }
    if (target.pathname.startsWith('/upload-session/')) {
      const meta = sessions.get(target.pathname.split('/').pop());
      uploads.push(Buffer.from(init.body));
      const name = 'files/' + String(files.length + 1);
      const file = { key: meta.key, name, uri: 'https://generativelanguage.googleapis.com/v1beta/' + name, mimeType: meta.mime, displayName: meta.display_name,
        sha256Hash: createHash('sha256').update(init.body).digest('base64'), state: 'ACTIVE', expirationTime: new Date(time + 48 * 3600000).toISOString() };
      files.push(file);
      const { key, ...metadata } = file;
      return ok({ file: metadata });
    }
    throw new Error('Unexpected mock request: ' + target.pathname);
  };
  return { fetch, files, uploads, calls, now: () => time, advance: ms => { time += ms; } };
}
const signal = () => new AbortController().signal;
const quiet = () => {};

test('same source uploads once while all independent reads and tool definitions remain intact', async () => {
  const p = provider(), store = createGeminiMediaStore(p);
  const sent = [], logs = [];
  let originalBytes = 0;
  for (let i = 0; i < 6; i++) {
    const original = input(bytes, 'Independent read ' + i);
    originalBytes += Buffer.byteLength(JSON.stringify(original));
    const result = await withGeminiMedia(original, { apiKey: 'key', signal: signal(), store, log: line => logs.push(JSON.parse(line)), send: async body => {
      sent.push(body);
      assert.deepEqual(body.tools, original.tools);
      assert.deepEqual(body.systemInstruction, original.systemInstruction);
      assert.deepEqual(body.generationConfig, original.generationConfig);
      assert.equal(body.contents[0].parts[1].text, 'Independent read ' + i);
      assert.equal(body.contents[0].parts[0].inlineData, undefined);
      assert.ok(body.contents[0].parts[0].fileData.fileUri);
      return { independentResult: i };
    } });
    assert.equal(result.independentResult, i);
    assert.equal(original.contents[0].parts[0].inlineData.data, bytes.toString('base64'));
  }
  assert.equal(sent.length, 6);
  assert.equal(p.uploads.length, 1);
  assert.deepEqual(p.uploads[0], bytes);
  const transferred = p.calls.reduce((sum, call) => sum + (call.init.body ? Buffer.byteLength(call.init.body) : 0), 0) + sent.reduce((sum, body) => sum + Buffer.byteLength(JSON.stringify(body)), 0);
  assert.ok(transferred < originalBytes * 0.15);
  assert.equal(logs.reduce((sum, row) => sum + row.uploadedBytes, 0), bytes.length);
  assert.ok(logs.every(row => !JSON.stringify(row).includes('Independent read')));
  console.log(`Synthetic six-read transfer: ${originalBytes} -> ${transferred} bytes (${(100 * (1 - transferred / originalBytes)).toFixed(1)}% less).`);
});

test('concurrent calls share uploads and a restart recovers references from provider metadata', async () => {
  const p = provider(), store = createGeminiMediaStore(p);
  const prepared = await Promise.all(Array.from({ length: 4 }, () => store.prepare(input(), 'key', signal())));
  assert.equal(p.uploads.length, 1);
  assert.ok(prepared.every(item => item.request.contents[0].parts[0].fileData.fileUri === prepared[0].request.contents[0].parts[0].fileData.fileUri));
  const restarted = createGeminiMediaStore(p);
  await restarted.prepare(input(), 'key', signal());
  assert.equal(p.uploads.length, 1);
});

test('expired, changed, different MIME and different account files do not reuse an old reference', async () => {
  const p = provider(), store = createGeminiMediaStore(p);
  const first = await store.prepare(input(), 'key', signal());
  p.advance(49 * 3600000);
  const next = await store.prepare(input(), 'key', signal());
  assert.notEqual(first.request.contents[0].parts[0].fileData.fileUri, next.request.contents[0].parts[0].fileData.fileUri);
  await store.prepare(input(Buffer.concat([bytes, Buffer.from('changed')])), 'key', signal());
  await store.prepare(input(bytes, 'read', 'application/pdf'), 'key', signal());
  await store.prepare(input(), 'other-key', signal());
  assert.equal(p.uploads.length, 5);
});

test('both provider hash encodings work, while an incorrect digest cannot substitute another document', async () => {
  const p = provider();
  const store = createGeminiMediaStore({ ...p, fetch: async (...args) => {
    const response = await p.fetch(...args);
    if (!String(args[0]).includes('/upload-session/')) return response;
    const payload = await response.json();
    payload.file.sha256Hash = Buffer.from(createHash('sha256').update(args[1].body).digest('hex')).toString('base64');
    p.files.at(-1).sha256Hash = payload.file.sha256Hash;
    return ok(payload);
  } });
  assert.ok((await store.prepare(input(), 'key', signal())).request.contents[0].parts[0].fileData);
  assert.ok((await createGeminiMediaStore(p).prepare(input(), 'key', signal())).request.contents[0].parts[0].fileData);
  assert.equal(p.uploads.length, 1);
  p.files[0].sha256Hash = Buffer.alloc(32, 0).toString('base64');
  await createGeminiMediaStore(p).prepare(input(), 'key', signal());
  assert.equal(p.uploads.length, 2);
});

test('processing files are polled until active before they can be used by an extraction', async () => {
  const p = provider();
  let polls = 0;
  const store = createGeminiMediaStore({ ...p, fetch: async (url, init) => {
    if (String(url).includes('/v1beta/files/')) { polls++; return ok({ ...p.files.at(-1), state: 'ACTIVE' }); }
    const response = await p.fetch(url, init);
    if (!String(url).includes('/upload-session/')) return response;
    const payload = await response.json();
    return ok({ file: { ...payload.file, state: 'PROCESSING' } });
  } });
  assert.ok((await store.prepare(input(), 'key', signal())).request.contents[0].parts[0].fileData);
  assert.equal(polls, 1);
});

test('small text/images stay inline, and disabled reuse performs no provider calls', async () => {
  const p = provider(), store = createGeminiMediaStore(p);
  const small = input(Buffer.from('small'));
  assert.deepEqual((await store.prepare(small, 'key', signal())).request, small);
  assert.equal(p.calls.length, 0);
  const old = process.env.GEMINI_FILE_REUSE;
  process.env.GEMINI_FILE_REUSE = 'false';
  try { assert.deepEqual((await store.prepare(input(), 'key', signal())).request, input()); }
  finally { if (old === undefined) delete process.env.GEMINI_FILE_REUSE; else process.env.GEMINI_FILE_REUSE = old; }
  assert.equal(p.calls.length, 0);
});

test('upload failure preserves the original evidence and backs off repeated upload attempts', async () => {
  let attempts = 0;
  const store = createGeminiMediaStore({ fetch: async () => { attempts++; return Response.json({}, { status: 503 }); } });
  const first = await store.prepare(input(), 'key', signal());
  assert.deepEqual(first.request, input());
  assert.equal(first.stats.inlineFallbacks, 1);
  const calls = attempts;
  assert.deepEqual((await store.prepare(input(), 'key', signal())).request, input());
  assert.equal(attempts, calls);
});

test('deleted file references retry once with exact inline bytes; rate limits never trigger that fallback', async () => {
  const p = provider(), store = createGeminiMediaStore(p);
  const sent = [];
  await withGeminiMedia(input(), { apiKey: 'key', signal: signal(), store, log: quiet, send: async body => {
    sent.push(body);
    if (sent.length === 1) throw Object.assign(new Error('File not found.'), { status: 404 });
    assert.deepEqual(body, input()); return 'ok';
  } });
  assert.equal(sent.length, 2);
  assert.deepEqual((await store.prepare(input(), 'key', signal())).request, input());
  const fresh = createGeminiMediaStore(p);
  let attempts = 0;
  await assert.rejects(withGeminiMedia(input(), { apiKey: 'key', signal: signal(), store: fresh, log: quiet, send: async () => {
    attempts++; throw Object.assign(new Error('Rate limited.'), { status: 429 });
  } }), /Rate limited/);
  assert.equal(attempts, 1);
});

test('cancelling one concurrent caller does not corrupt another caller sharing its upload', async () => {
  const p = provider();
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const store = createGeminiMediaStore({ ...p, fetch: async (url, init) => {
    if (String(url).includes('/upload-session/')) { entered(); await gate; }
    return p.fetch(url, init);
  } });
  const cancelled = new AbortController();
  const one = store.prepare(input(), 'key', cancelled.signal);
  const two = store.prepare(input(), 'key', signal());
  const rejected = assert.rejects(one, { name: 'AbortError' });
  await started; cancelled.abort(); release();
  await rejected;
  assert.ok((await two).request.contents[0].parts[0].fileData);
  assert.equal(p.uploads.length, 1);
});

test('wizard proxy sends Gemini file references and preserves structured responses', async () => {
  const p = provider(), store = createGeminiMediaStore(p);
  const originalFetch = globalThis.fetch;
  const messages = [];
  globalThis.fetch = async (url, init) => {
    messages.push(JSON.parse(init.body));
    assert.equal(init.headers['x-goog-api-key'], 'proxy-key');
    assert.ok(messages.at(-1).contents[0].parts[0].fileData);
    return ok({ candidates: [{ content: { parts: [{ functionCall: { name: 'record_transcription', args: { candidates: [] } } }] }, finishReason: 'STOP' }] });
  };
  const handler = createProxyHandler(() => ({ extractionProvider: 'gemini', geminiApiKey: 'proxy-key', draftModel: 'draft' }), { mediaStore: store });
  const server = createServer((req, res) => handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const body = JSON.stringify({ model: 'vision', max_tokens: 4000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: bytes.toString('base64') } }] }] });
    const response = await new Promise((resolve, reject) => {
      const req = httpRequest({ hostname: '127.0.0.1', port: server.address().port, path: '/api/anthropic/v1/messages', method: 'POST', headers: { 'content-type': 'application/json' } }, res => {
        const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
      }); req.on('error', reject); req.end(body);
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.content[0].type, 'tool_use');
    assert.equal(response.body.content[0].name, 'record_transcription');
    assert.equal(p.uploads.length, 1);
  } finally { globalThis.fetch = originalFetch; await new Promise(resolve => server.close(resolve)); }
});
