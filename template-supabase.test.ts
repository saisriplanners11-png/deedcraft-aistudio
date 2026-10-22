import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createTemplateStorage } from './template-storage.mjs';
import { createTemplateApi } from './template-api.mjs';

// Deterministic wire-level Supabase double; no real credentials or provider calls.
function provider() {
  let row: any = null;
  const objects = new Map<string, Buffer>();
  const state = { public: false, failWrites: false };
  const realFetch = globalThis.fetch;
  const json = (value: any, status = 200) => new Response(JSON.stringify(value), { status });
  const fetcher = vi.fn(async (input: any, init: any = {}) => {
    const url = new URL(String(input));
    if (url.host !== 'templates.supabase.co') return realFetch(input, init);
    expect(init.headers.apikey).toBe('sb_secret_test');
    expect(init.headers.Authorization).toBeUndefined();
    if (url.pathname.startsWith('/storage/v1/bucket/')) return json({ public: state.public });
    if (url.pathname.startsWith('/storage/v1/object/')) {
      const name = decodeURIComponent(url.pathname.split('/').pop()!);
      if (init.method === 'POST') {
        expect(init.headers['x-upsert']).toBe('false');
        if (state.failWrites) return json({}, 503);
        if (objects.has(name)) return json({}, 409);
        objects.set(name, Buffer.from(init.body)); return json({});
      }
      return objects.has(name) ? new Response(new Uint8Array(objects.get(name)!)) : json({}, 404);
    }
    expect(url.pathname).toBe('/rest/v1/deed_template_library');
    if (!init.method) return json(row ? [row] : []);
    if (state.failWrites) return json({}, 503);
    const data = JSON.parse(init.body);
    if (init.method === 'POST') {
      if (row) return json({}, 409);
    } else if (!row || url.searchParams.get('revision') !== 'eq.' + row.revision) return json([]);
    row = data; return json([row]);
  });
  vi.stubGlobal('fetch', fetcher);
  return { objects, state, fetcher };
}
const options = { backend: 'supabase', supabaseUrl: 'https://templates.supabase.co', supabaseKey: 'sb_secret_test' };
afterEach(() => vi.unstubAllGlobals());

describe('Supabase template persistence', () => {
  it('upgrades an existing Supabase default without dropping its concurrency revision', async () => {
    const fake = provider();
    const storage = createTemplateStorage(options, '.');
    await storage.init();
    const bytes = await readFile(new URL('./sale-deed-template-v9.docx', import.meta.url));
    const prior = { id: 'sale-deed-v9', instrumentId: 'sale', filename: 'sale-deed-template-v9.docx', hash: createHash('sha256').update(bytes).digest('hex'), publishedAt: '2026-10-17', validation: { valid: true }, samples: [] };
    await storage.put(prior.id + '.docx', bytes);
    await storage.save({ active: { sale: prior.id }, versions: [prior], history: [] });
    const api = createTemplateApi({ ...options, password: 'test-password' });
    const server = createServer((req, res) => { void api(req, res); });
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    try {
      const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/templates`);
      expect(response.status).toBe(200);
      const listing = await response.json();
      expect(listing.active.sale).toBe('sale-deed-v10');
      expect(listing.versions.some((version: any) => version.id === prior.id && version.hash === prior.hash)).toBe(true);
      expect((await storage.read()).active.sale).toBe('sale-deed-v10');
      expect(fake.fetcher.mock.calls.some(([, init]: any) => init?.method === 'PATCH')).toBe(true);
    } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); }
  }, 30000);
  it('keeps private immutable bytes and rejects stale metadata across independent instances', async () => {
    const fake = provider();
    const first = createTemplateStorage(options, '.');
    const second = createTemplateStorage(options, '.');
    await first.init(); expect(await first.read()).toBeNull();
    await first.put('test.docx', Buffer.from('original'));
    await second.put('test.docx', Buffer.from('original'));
    await expect(second.put('test.docx', Buffer.from('replacement'))).rejects.toMatchObject({ status: 409 });
    expect((await second.get('test.docx')).toString()).toBe('original');
    await first.save({ active: { sale: 'first' } });
    const one = await first.read(), two = await second.read();
    one.active.sale = 'published'; await first.save(one);
    two.active.sale = 'stale'; await expect(second.save(two)).rejects.toMatchObject({ status: 409 });
    expect((await second.read()).active.sale).toBe('published');
    fake.state.failWrites = true;
    await expect(first.save(await first.read())).rejects.toMatchObject({ status: 503 });
    expect((await second.read()).active.sale).toBe('published');
    fake.state.public = true;
    await expect(second.init()).rejects.toThrow(/private/);
  });
  it('serves the existing API workflow without a disk and survives handler restart', async () => {
    provider();
    let api = createTemplateApi({ ...options, production: true, password: 'test-password' });
    const server = createServer((req, res) => { void api(req, res); });
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const base = `http://127.0.0.1:${(server.address() as any).port}/api/templates`;
    try {
      expect((await (await fetch(base)).json()).active.sale).toBe('sale-deed-v10');
      const login = await fetch(base + '/login', { method: 'POST', body: JSON.stringify({ password: 'test-password' }) });
      const cookie = login.headers.get('set-cookie')!.split(';')[0], csrf = (await login.json()).csrf;
      const headers = { Cookie: cookie, 'X-CSRF-Token': csrf };
      const bytes = await readFile(new URL('./sale-deed-template-v10.docx', import.meta.url));
      const response = await fetch(base + '/upload?filename=updated.docx', { method: 'POST', headers, body: bytes });
      expect(response.status).toBe(201);
      const revision = await response.json();
      expect(revision.validation.valid).toBe(true); expect(revision.samples).toHaveLength(25);
      expect((await fetch(base + `/versions/${revision.id}/samples/ordinary-plot`, { headers })).status).toBe(200);
      expect((await fetch(base + `/versions/${revision.id}/download`)).status).toBe(401);
      const remove = () => fetch(base + `/versions/${revision.id}`, { method: 'DELETE', headers, body: JSON.stringify({ expectedHash: revision.hash, expectedSchemaRevision: revision.schemaRevision || 0 }) });
      expect((await remove()).status).toBe(200);
      api = createTemplateApi({ ...options, production: true, password: 'test-password' });
      const renewed = await fetch(base + '/login', { method: 'POST', body: JSON.stringify({ password: 'test-password' }) });
      headers.Cookie = renewed.headers.get('set-cookie')!.split(';')[0]; headers['X-CSRF-Token'] = (await renewed.json()).csrf;
      const trash = await (await fetch(base, { headers })).json();
      expect(trash.deletedVersions[0].id).toBe(revision.id);
      expect(trash.versions.some((item: any) => item.id === revision.id)).toBe(false);
      expect((await fetch(base + `/versions/${revision.id}/download`, { headers })).status).toBe(404);
      expect((await fetch(base + `/versions/${revision.id}/restore`, { method: 'POST', headers, body: '{}' })).status).toBe(200);
      const publish = await fetch(base + `/versions/${revision.id}/publish`, { method: 'POST', headers, body: JSON.stringify({ expectedActive: 'sale-deed-v10', reviewed: true }) });
      expect(publish.status).toBe(200);
      api = createTemplateApi({ ...options, production: true, password: 'test-password' });
      expect((await (await fetch(base)).json()).active.sale).toBe(revision.id);
      const download = await fetch(base + `/versions/${revision.id}/download`);
      expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
      expect((await (await fetch(base + '/session', { headers })).json()).authenticated).toBe(false);
      expect((await fetch(base + `/versions/${revision.id}/samples/ordinary-plot`)).status).toBe(401);
    } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); }
  }, 60000);
  it('fails closed on incomplete setup and does not fall back to disk', async () => {
    provider();
    await expect(createTemplateStorage({ ...options, supabaseUrl: 'http://unsafe.example' }, '.').init()).rejects.toMatchObject({ status: 503 });
  });
});
