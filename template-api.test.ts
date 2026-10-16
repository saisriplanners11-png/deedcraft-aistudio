import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createTemplateApi } from './template-api.mjs';
import { loadTemplateRuntime } from './template-runtime-loader.mjs';

// Upload tests render eight or nine DOCX samples and can run alongside a build.
describe('shared template library API', { timeout: 30000 }, () => {
  let directory: string, base: string, server: Server, cookie: string, csrf: string, runtime: any, starter: Buffer;
  async function start(password = 'test-admin-password', storageDir = directory) {
    const api = createTemplateApi({ password, storageDir });
    server = createServer((req, res) => { void api(req, res); });
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${(server.address() as any).port}/api/templates`;
  }
  async function close() {
    server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
  }
  async function login() {
    const response = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-admin-password' }) });
    expect(response.status).toBe(200);
    cookie = response.headers.get('set-cookie')!.split(';')[0]; csrf = (await response.json()).csrf;
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
  }
  const headers = () => ({ Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' });
  const post = (path: string, data: unknown) => fetch(base + path, { method: 'POST', headers: headers(), body: JSON.stringify(data) });
  async function upload(bytes = starter, filename = 'revised.docx') {
    return fetch(base + '/upload?filename=' + encodeURIComponent(filename), { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: new Uint8Array(bytes).buffer });
  }
  async function changed(edit: (xml: string) => string) {
    const entries = await runtime.readZip(starter);
    const document = entries.find((item: any) => item.name === 'word/document.xml');
    document.data = new TextEncoder().encode(edit(new TextDecoder().decode(document.data)));
    return Buffer.from(await runtime.writeZip(entries));
  }
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'deedcraft-template-test-'));
    starter = await readFile(new URL('./sale-deed-template-v6.docx', import.meta.url));
    runtime = await loadTemplateRuntime(); await start(); await login();
  }, 30000);
  afterAll(async () => {
    await close();
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected temporary test directory.');
    await rm(directory, { recursive: true, force: true });
  });
  it('seeds a public immutable version but protects drafts and management', async () => {
    const listing = await (await fetch(base)).json();
    expect(listing.active.sale).toBe('sale-deed-v6');
    expect(listing.versions[0].validation).toBeUndefined();
    expect((await fetch(base + '/versions/sale-deed-v6')).status).toBe(401);
    const bytes = Buffer.from(await (await fetch(base + '/versions/sale-deed-v6/download')).arrayBuffer());
    expect(bytes.equals(starter)).toBe(true);
    expect((await fetch(base + '/upload?filename=x.docx', { method: 'POST', body: new Uint8Array(starter).buffer })).status).toBe(401);
    expect((await fetch(base + '/upload?filename=x.docx', { method: 'POST', headers: { Cookie: cookie }, body: new Uint8Array(starter).buffer })).status).toBe(403);
    expect((await fetch(base + '/upload?filename=x.docx', { method: 'POST', headers: { ...headers(), Origin: 'https://evil.example' }, body: new Uint8Array(starter).buffer })).status).toBe(403);
  });
  it('validates, renders all categories, publishes atomically, preserves old bytes and survives restart', async () => {
    const revision = await (await upload(await changed(xml => xml.replace('DECLARATION', 'DECLARATION')))).json();
    expect(revision.validation.valid).toBe(true);
    expect(revision.samples).toHaveLength(8);
    expect(revision.samples.every((item: any) => !item.error)).toBe(true);
    expect((await fetch(base + `/versions/${revision.id}/download`)).status).toBe(401);
    expect((await post(`/versions/${revision.id}/publish`, { expectedActive: 'sale-deed-v6', reviewed: false })).status).toBe(400);
    const originalEntries = await runtime.readZip(starter);
    for (const sample of revision.samples) {
      const response = await fetch(base + `/versions/${revision.id}/samples/${sample.id}`, { headers: { Cookie: cookie } });
      expect(response.status).toBe(200);
      const entries = await runtime.readZip(new Uint8Array(await response.arrayBuffer()));
      for (const name of ['word/styles.xml', 'word/settings.xml']) {
        expect(entries.find((item: any) => item.name === name).data).toEqual(originalEntries.find((item: any) => item.name === name).data);
      }
      const xml = new TextDecoder().decode(entries.find((item: any) => item.name === 'word/document.xml').data);
      const original = new TextDecoder().decode(originalEntries.find((item: any) => item.name === 'word/document.xml').data);
      expect(xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0]).toBe(original.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0]);
      if (sample.id === 'multiple') expect(await runtime.docxToText(new Uint8Array(await runtime.renderSample('multiple', { kind: 'custom', bytes: starter, validation: revision.validation })))).toContain('SECOND SAMPLE');
    }
    expect((await post(`/versions/${revision.id}/publish`, { expectedActive: 'sale-deed-v6', reviewed: true })).status).toBe(200);
    expect((await post(`/versions/${revision.id}/publish`, { expectedActive: 'sale-deed-v6', reviewed: true })).status).toBe(409);
    const pinned = Buffer.from(await (await fetch(base + '/versions/sale-deed-v6/download')).arrayBuffer());
    expect(pinned.equals(starter)).toBe(true);
    await close(); await start();
    expect((await (await fetch(base)).json()).active.sale).toBe(revision.id);
    await login();
    expect((await post('/versions/sale-deed-v6/rollback', { expectedActive: revision.id })).status).toBe(200);
    expect((await (await fetch(base)).json()).active.sale).toBe('sale-deed-v6');
    expect((await post(`/versions/${revision.id}/validate`, {})).status).toBe(409);
  }, 30000);
  it('retains actionable validation errors without changing the active version', async () => {
    const invalid = await changed(xml => xml.replace('<w:body>', '<w:body><w:p><w:r><w:t>&lt;Unknown Test Placeholder&gt;</w:t></w:r></w:p>'));
    const revision = await (await upload(invalid)).json();
    expect(revision.validation.valid).toBe(false);
    expect(revision.validation.errors.join(' ')).toContain('Unsupported placeholder');
    expect((await post(`/versions/${revision.id}/publish`, { expectedActive: 'sale-deed-v6', reviewed: true })).status).toBe(400);
    const malformed = await (await upload(Buffer.from('not a zip'))).json();
    expect(malformed.validation.valid).toBe(false);
    expect((await (await fetch(base)).json()).active.sale).toBe('sale-deed-v6');
    expect((await upload(starter, 'bad.txt')).status).toBe(400);
    expect((await upload(Buffer.alloc(20 * 1024 * 1024 + 1))).status).toBe(413);
  });
  it('rejects unsupported instruments and stored-byte tampering', async () => {
    expect((await fetch(base + '/upload?instrument=gift&filename=gift.docx', { method: 'POST', headers: headers(), body: new Uint8Array(starter).buffer })).status).toBe(400);
    const revision = await (await upload()).json();
    await writeFile(join(directory, revision.id + '.docx'), 'tampered');
    expect((await post(`/versions/${revision.id}/publish`, { expectedActive: 'sale-deed-v6', reviewed: true })).status).toBe(503);
    expect((await (await fetch(base)).json()).active.sale).toBe('sale-deed-v6');
  });
  it('configures new placeholders, invalidates samples, checks schema conflicts and publishes the complete package', async () => {
    const bytes = await changed(xml => xml.replace('<w:body>', '<w:body><w:p><w:r><w:t>Maintenance is &lt;Maintenance Amount&gt;.</w:t></w:r></w:p>'));
    const revision = await (await upload(bytes)).json();
    expect(revision.inspection.unresolved).toContain('Maintenance Amount');
    expect(revision.validation.valid).toBe(false);
    const contract = { version: 1, fields: [{ id: 'custom-maintenance', placeholder: 'Maintenance Amount', label: 'Maintenance amount', help: '', type: 'currency', scope: 'transaction', required: true, options: [], sampleValue: '1000', extractionEnabled: true, extractionDescription: 'Current maintenance charge', evidenceContext: 'current' }] };
    const patch = (expectedSchemaRevision: number) => fetch(base + `/versions/${revision.id}/fields`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ expectedSchemaRevision, contract }) });
    expect((await fetch(base + `/versions/${revision.id}/fields`)).status).toBe(401);
    const configured = await (await patch(0)).json();
    expect(configured.schemaRevision).toBe(1);
    expect(configured.samples).toEqual([]);
    expect(configured.validation.valid).toBe(true);
    expect(configured.schemaHash).toHaveLength(64);
    expect(configured.packageHash).toHaveLength(64);
    expect((await patch(0)).status).toBe(409);
    expect((await post(`/versions/${revision.id}/publish`, { expectedActive: 'sale-deed-v6', expectedSchemaRevision: 1, expectedSchemaHash: configured.schemaHash, reviewed: true })).status).toBe(400);
    const sampled = await (await post(`/versions/${revision.id}/validate`, {})).json();
    expect(sampled.samples).toHaveLength(8);
    expect(sampled.samplesSchemaHash).toBe(sampled.schemaHash);
    expect((await post(`/versions/${revision.id}/publish`, { expectedActive: 'sale-deed-v6', expectedSchemaRevision: 0, expectedSchemaHash: sampled.schemaHash, reviewed: true })).status).toBe(409);
    expect((await post(`/versions/${revision.id}/publish`, { expectedActive: 'sale-deed-v6', expectedSchemaRevision: 1, expectedSchemaHash: sampled.schemaHash, reviewed: true })).status).toBe(200);
    expect((await patch(1)).status).toBe(409);
    const publicVersion = (await (await fetch(base)).json()).versions.find((item: any) => item.id === revision.id);
    expect(publicVersion.fieldContract.fields[0].id).toBe('custom-maintenance');
    expect(publicVersion.inspection).toBeUndefined();
    expect((await post('/versions/sale-deed-v6/rollback', { expectedActive: revision.id })).status).toBe(200);
  });
  it('serializes simultaneous publication and expires administrator sessions', async () => {
    const first = await (await upload()).json();
    const second = await (await upload()).json();
    const results = await Promise.all([first, second].map(item => post(`/versions/${item.id}/publish`, { expectedActive: 'sale-deed-v6', reviewed: true })));
    expect(results.map(response => response.status).sort()).toEqual([200, 409]);
    const active = (await (await fetch(base)).json()).active.sale;
    expect((await post('/versions/sale-deed-v6/rollback', { expectedActive: active })).status).toBe(200);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 9 * 60 * 60 * 1000);
    try {
      expect((await (await fetch(base + '/session', { headers: { Cookie: cookie } })).json()).authenticated).toBe(false);
    } finally { clock.mockRestore(); }
  });
  it('moves only unpublished revisions to recoverable Trash with authentication, CSRF and stale-edit protection', async () => {
    await login();
    const revision = await (await upload(starter, 'delete-test.docx')).json();
    const path = `/versions/${revision.id}`;
    const body = JSON.stringify({ expectedSchemaRevision: revision.schemaRevision || 0, expectedHash: revision.hash });
    expect((await fetch(base + path, { method: 'DELETE', body })).status).toBe(401);
    expect((await fetch(base + path, { method: 'DELETE', headers: { Cookie: cookie }, body })).status).toBe(403);
    expect((await fetch(base + path, { method: 'DELETE', headers: { ...headers(), Origin: 'https://evil.example' }, body })).status).toBe(403);
    expect((await fetch(base + path, { method: 'DELETE', headers: headers(), body: JSON.stringify({ expectedSchemaRevision: 999, expectedHash: revision.hash }) })).status).toBe(409);
    expect((await fetch(base + '/versions/sale-deed-v6', { method: 'DELETE', headers: headers(), body })).status).toBe(409);
    const published = (await (await fetch(base)).json()).versions.find((item: any) => item.id !== 'sale-deed-v6');
    expect((await fetch(base + `/versions/${published.id}`, { method: 'DELETE', headers: headers(), body })).status).toBe(409);
    expect((await fetch(base + path, { method: 'DELETE', headers: headers(), body })).status).toBe(200);
    const admin = await (await fetch(base, { headers: headers() })).json();
    expect(admin.versions.some((item: any) => item.id === revision.id)).toBe(false);
    expect(admin.deletedVersions.find((item: any) => item.id === revision.id).deletedAt).toBeTruthy();
    expect(admin.active.sale).toBe('sale-deed-v6');
    expect((await (await fetch(base)).json()).deletedVersions).toBeUndefined();
    expect((await fetch(base + path + '/download', { headers: headers() })).status).toBe(404);
    expect((await post(path + '/validate', {})).status).toBe(404);
    expect((await post(path + '/publish', { expectedActive: 'sale-deed-v6', reviewed: true })).status).toBe(404);
    expect((await fetch(base + path + '/restore', { method: 'POST', body: '{}' })).status).toBe(401);
    expect((await post(path + '/restore', {})).status).toBe(200);
    expect((await fetch(base + path + '/download', { headers: headers() })).status).toBe(200);
    expect((await (await fetch(base)).json()).active.sale).toBe('sale-deed-v6');
  });
  it('disables management without a password and limits failed logins', async () => {
    await close(); await start('');
    expect((await (await fetch(base + '/session')).json()).configured).toBe(false);
    expect((await fetch(base + '/login', { method: 'POST', body: '{}' })).status).toBe(503);
    await close(); await start();
    for (let i = 0; i < 5; i++) expect((await fetch(base + '/login', { method: 'POST', body: '{"password":"wrong"}' })).status).toBe(401);
    expect((await fetch(base + '/login', { method: 'POST', body: '{"password":"wrong"}' })).status).toBe(429);
  });
  it('reports storage failures without overwriting an existing library', async () => {
    await close();
    const file = join(directory, 'not-a-directory'); await writeFile(file, 'occupied');
    await start('test-admin-password', file);
    expect((await fetch(base)).status).toBe(503);
    expect(await readFile(file, 'utf8')).toBe('occupied');
    await rm(file);
    expect((await fetch(base)).status).toBe(200);
  });
});
