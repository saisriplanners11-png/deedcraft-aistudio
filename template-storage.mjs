import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const failure = (status, message) => Object.assign(new Error(message), { status });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function createTemplateStorage(options, root) {
  const backend = options.backend || process.env.TEMPLATE_STORAGE_BACKEND || 'disk';
  if (backend === 'supabase') return supabaseStorage(options);
  if (backend !== 'disk') throw failure(503, 'Unknown TEMPLATE_STORAGE_BACKEND. Use disk or supabase.');
  const directory = resolve(options.storageDir || process.env.TEMPLATE_STORAGE_DIR || join(root, 'template-storage'));
  async function atomic(name, bytes) {
    const target = join(directory, name), temporary = target + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, target);
  }
  return {
    async init() {
      const path = relative(join(root, 'dist'), directory);
      if (!path || (!path.startsWith('..') && !isAbsolute(path))) throw failure(503, 'Template storage must be outside the build directory.');
      if (options.production && !options.storageDir && !process.env.TEMPLATE_STORAGE_DIR) throw failure(503, 'Configure TEMPLATE_STORAGE_DIR on a persistent disk or select the Supabase template backend.');
      await mkdir(directory, { recursive: true });
    },
    read: async () => { try { return JSON.parse(await readFile(join(directory, 'library.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } },
    save: data => atomic('library.json', JSON.stringify(data, null, 2)),
    put: atomic,
    get: name => readFile(join(directory, name)),
  };
}

function supabaseStorage(options) {
  const url = (options.supabaseUrl || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = options.supabaseKey || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = options.supabaseBucket || process.env.SUPABASE_TEMPLATE_BUCKET || 'deed-templates';
  const revisions = new WeakMap();
  async function request(path, init = {}) {
    const headers = { apikey: key, ...(!key.startsWith('sb_secret_') ? { Authorization: `Bearer ${key}` } : {}), ...init.headers };
    try { return await fetch(url + path, { ...init, headers, signal: AbortSignal.timeout(60000) }); }
    catch { throw failure(503, 'Supabase template storage could not be reached. Retry when it is available.'); }
  }
  const objectPath = name => '/storage/v1/object/' + encodeURIComponent(bucket) + '/' + encodeURIComponent(name);
  async function get(name) {
    const response = await request(objectPath(name));
    if (!response.ok) throw failure(503, 'A template file is unavailable in Supabase. Check the private bucket and retry.');
    return Buffer.from(await response.arrayBuffer());
  }
  return {
    async init() {
      let parsed; try { parsed = new URL(url); } catch {}
      if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' || !key || !/^[a-z0-9-]+$/.test(bucket)) throw failure(503, 'Configure SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), and SUPABASE_TEMPLATE_BUCKET on the server.');
      const response = await request('/storage/v1/bucket/' + encodeURIComponent(bucket));
      if (!response.ok) throw failure(503, 'Supabase template bucket is unavailable. Run the Supabase setup SQL and check server credentials.');
      if ((await response.json()).public !== false) throw failure(503, 'The Supabase template bucket must be private.');
    },
    async read() {
      const response = await request('/rest/v1/deed_template_library?id=eq.shared&select=revision,data');
      if (!response.ok) throw failure(503, 'Supabase template metadata is unavailable. Run the setup SQL and enable the Data API.');
      const rows = await response.json();
      if (!rows.length) return null;
      const data = rows[0].data; revisions.set(data, rows[0].revision); return data;
    },
    async save(data) {
      const previous = revisions.get(data);
      const response = await request('/rest/v1/deed_template_library' + (previous === undefined ? '' : `?id=eq.shared&revision=eq.${previous}`), {
        method: previous === undefined ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ id: 'shared', revision: previous === undefined ? 1 : previous + 1, data }),
      });
      if (response.status === 409) throw failure(409, 'The template library changed. Refresh and retry.');
      if (!response.ok) throw failure(503, 'Supabase could not save template metadata. The published library was not changed. Retry.');
      const rows = await response.json();
      if (!rows.length) throw failure(409, 'The template library changed. Refresh and retry.');
      revisions.set(data, rows[0].revision);
    },
    async put(name, bytes) {
      const response = await request(objectPath(name), { method: 'POST', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x-upsert': 'false' }, body: bytes });
      if (response.ok) return;
      // Seed races and retried writes may encounter an existing immutable object.
      if (response.status === 409 || response.status === 400) {
        const existing = await get(name);
        if (digest(existing) === digest(bytes)) return;
        throw failure(409, 'An immutable template file already exists with different bytes. Upload a new revision.');
      }
      throw failure(503, 'Supabase could not store the template file. Check storage quota and retry.');
    },
    get,
  };
}
