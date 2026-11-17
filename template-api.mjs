import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { loadTemplateRuntime } from './template-runtime-loader.mjs';
import { createTemplateStorage } from './template-storage.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const LIMIT = 20 * 1024 * 1024;
const CONTRACT = 'sale-v7-fields-1';
const contractFor = family => family === 'sale' ? CONTRACT : `${family}-fields-1`;
const SESSION_MS = 8 * 60 * 60 * 1000;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });

export function createTemplateApi(options = {}) {
  const storage = createTemplateStorage(options, ROOT);
  const password = () => options.password ?? process.env.TEMPLATE_ADMIN_PASSWORD ?? '';
  const sessions = new Map();
  const attempts = new Map();
  let queue = Promise.resolve();
  const serial = task => {
    const next = queue.then(task);
    queue = next.catch(() => {});
    return next;
  };
  const atomic = (name, bytes) => storage.put(name, bytes);
  const save = data => storage.save(data);
  const read = async () => {
    const data = await storage.read();
    if (!data) throw fail(503, 'Template metadata is missing. Restore the library and retry.');
    return data;
  };
  const wasRestored = (data, family) => data.history.find(event => event.versionId === data.active[family])?.action === 'rollback';
  async function seedLibrary() {
    await storage.init();
    const previous = await storage.read();
    const current = previous || { active: {}, versions: [], history: [] };
    const addingLatestSale = !current.versions.some(item => item.id === 'sale-deed-v12');
    let changed = false;
    for (const source of [
      { id: 'sale-deed-v10', filename: 'sale-deed-template-v10.docx', sourceDocument: 'SALE DEED-1610.docx' },
      { id: 'sale-deed-v11', filename: 'sale-deed-template-v11.docx', sourceDocument: 'SALE DEED (7).docx' },
      { id: 'sale-deed-v12', filename: 'sale-deed-template-v12.docx', sourceDocument: 'SALE DEED (8).docx' },
    ]) {
      if (current.versions.some(item => item.id === source.id)) continue;
      const bytes = await readFile(join(ROOT, source.filename));
      const runtime = await loadTemplateRuntime();
      const validation = await runtime.validateSaleDeedTemplate(bytes, source.filename);
      if (!validation.valid) throw fail(503, `Bundled Sale ${source.id} failed validation: ${validation.errors.join('; ')}`);
      const at = new Date().toISOString();
      const version = { ...source, instrumentId: 'sale', hash: hash(bytes), sourceHash: hash(bytes), createdAt: at, contractVersion: CONTRACT, validation, publishedAt: at, samples: [] };
      await atomic(version.id + '.docx', bytes);
      current.versions.push(version); current.history.push({ versionId: version.id, at, action: 'seed' }); changed = true;
    }
    const supersededSaleDefaults = ['sale-deed-v6', 'sale-deed-v7', 'sale-deed-v8', 'sale-deed-v9', 'sale-deed-v10'];
    if (!current.active.sale || (!wasRestored(current, 'sale') && (supersededSaleDefaults.includes(current.active.sale) || (addingLatestSale && current.active.sale === 'sale-deed-v11')))) {
      current.active.sale = 'sale-deed-v12'; changed = true;
    }
    if (!changed) return;
    try { await save(current); }
    catch (error) {
      const latest = error.status === 409 ? await storage.read() : null;
      if (!latest?.versions.some(item => item.id === 'sale-deed-v12')) throw error;
    }
  }

  async function seedAgreementLibrary() {
    const current = await read();
    const sources = [
      { id: 'agreement-sale-gpa-v1', filename: 'agreement-sale-gpa-template-v1.docx', sourceDocument: 'AGREEMENT OF SALE CUM GPA.docx' },
      { id: 'agreement-sale-gpa-v2', filename: 'agreement-sale-gpa-template-v2.docx', sourceDocument: 'AGREEMENT OF SALE CUM GPA (1).docx' },
      { id: 'agreement-sale-gpa-v3', filename: 'agreement-sale-gpa-template-v3.docx', sourceDocument: 'AGREEMENT OF SALE CUM GPA (2).docx' },
      { id: 'agreement-sale-gpa-v4', filename: 'agreement-sale-gpa-template-v4.docx', sourceDocument: 'AGREEMENT OF SALE CUM GPA (3).docx' },
      { id: 'agreement-sale-gpa-v5', filename: 'agreement-sale-gpa-template-v5.docx', sourceDocument: 'AGREEMENT OF SALE CUM GPA (4).docx' },
    ];
    let changed = false;
    for (const source of sources) {
      if (current.versions.some(item => item.id === source.id)) continue;
      const bytes = await readFile(join(ROOT, source.filename));
      const runtime = await loadTemplateRuntime();
      const validation = await runtime.validateAgreementSaleGpaTemplate(bytes);
      if (!validation.valid) throw fail(503, `Bundled Agreement of Sale Cum GPA template ${source.id} failed validation: ${validation.errors.join('; ')}`);
      const at = new Date().toISOString();
      const version = { ...source, instrumentId: 'agreement_of_sale', hash: hash(bytes), sourceHash: hash(bytes), createdAt: at, publishedAt: at, contractVersion: 'agreement-sale-gpa-fields-1', validation, samples: [] };
      await atomic(version.id + '.docx', bytes);
      current.versions.push(version);
      current.history.push({ versionId: version.id, at, action: 'seed' });
      changed = true;
    }
    if (!current.active.agreement_of_sale || (!wasRestored(current, 'agreement_of_sale') && ['agreement-sale-gpa-v1', 'agreement-sale-gpa-v2', 'agreement-sale-gpa-v3', 'agreement-sale-gpa-v4'].includes(current.active.agreement_of_sale))) { current.active.agreement_of_sale = 'agreement-sale-gpa-v5'; changed = true; }
    if (!changed) return;
    try { await save(current); }
    catch (error) {
      const latest = error.status === 409 ? await storage.read() : null;
      if (!latest?.versions.some(item => item.id === 'agreement-sale-gpa-v5')) throw error;
    }
  }
  async function seedGeneralPoaLibrary() {
    const current = await read();
    let changed = false;
    for (const source of [
      { id: 'general-poa-v1', filename: 'general-poa-template-v1.docx', sourceDocument: 'G.P.A FOR CONSIDERATION.docx' },
      { id: 'general-poa-v2', filename: 'general-poa-template-v2.docx', sourceDocument: 'G.P.A FOR CONSIDERATION (1).docx' },
      { id: 'general-poa-v3', filename: 'general-poa-template-v3.docx', sourceDocument: 'G.P.A FOR CONSIDERATION (2).docx' },
      { id: 'general-poa-v4', filename: 'general-poa-template-v4.docx', sourceDocument: 'G.P.A FOR CONSIDERATION (3).docx' },
    ]) {
      if (current.versions.some(item => item.id === source.id)) continue;
      const bytes = await readFile(join(ROOT, source.filename));
      const runtime = await loadTemplateRuntime();
      const validation = await runtime.validateGeneralPoaTemplate(bytes);
      if (!validation.valid) throw fail(503, `Bundled General Power of Attorney ${source.id} failed validation: ${validation.errors.join('; ')}`);
      const at = new Date().toISOString();
      const version = { ...source, instrumentId: 'power_of_attorney', hash: hash(bytes), sourceHash: hash(bytes), createdAt: at, publishedAt: at, contractVersion: 'general-poa-fields-1', validation, samples: [] };
      await atomic(version.id + '.docx', bytes);
      current.versions.push(version);
      current.history.push({ versionId: version.id, at, action: 'seed' });
      changed = true;
    }
    if (!current.active.power_of_attorney || (!wasRestored(current, 'power_of_attorney') && ['general-poa-v1', 'general-poa-v2', 'general-poa-v3'].includes(current.active.power_of_attorney))) { current.active.power_of_attorney = 'general-poa-v4'; changed = true; }
    if (!changed) return;
    try { await save(current); }
    catch (error) {
      const latest = error.status === 409 ? await storage.read() : null;
      if (!latest?.versions.some(item => item.id === 'general-poa-v4')) throw error;
    }
  }
  async function seedAdditionalFamilies() {
    const runtime = await loadTemplateRuntime();
    const current = await read();
    const families = Object.entries(runtime.TEMPLATE_FAMILIES).filter(([id]) => !['sale', 'agreement_of_sale', 'power_of_attorney'].includes(id));
    let changed = false;
    for (const [family, { instrumentId, variantId, defaultId }] of families) {
      if (!current.versions.some(item => item.id === defaultId)) {
        const asset = runtime.TEMPLATE_VERSIONS.find(item => item.id === defaultId);
        const bytes = await readFile(join(ROOT, asset.asset));
        const digest = hash(bytes);
        if (digest !== asset.sha256) throw fail(503, `Bundled template ${defaultId} failed its integrity check.`);
        const validation = await runtime.validateDeedTemplate(bytes, instrumentId, variantId, asset.asset);
        if (!validation.valid) throw fail(503, `Bundled template ${defaultId} failed validation. ${validation.errors.join(' ')}`);
        const at = new Date().toISOString();
        await atomic(defaultId + '.docx', bytes);
        current.versions.push({ id: defaultId, instrumentId, variantId, filename: asset.asset, hash: digest, createdAt: at, contractVersion: contractFor(family), validation, publishedAt: at, samples: [] });
        current.history.push({ versionId: defaultId, at, action: 'seed' });
        changed = true;
      }
      if (!current.active[family]) { current.active[family] = defaultId; changed = true; }
    }
    if (!changed) return;
    try { await save(current); }
    catch (error) {
      const latest = error.status === 409 ? await storage.read() : null;
      if (!latest || !families.every(([family]) => latest.active[family])) throw error;
    }
  }
  let initialization;
  const ensureInitialized = () => initialization ??= serial(async () => { await seedLibrary(); await seedAgreementLibrary(); await seedGeneralPoaLibrary(); await seedAdditionalFamilies(); }).catch(error => { initialization = undefined; throw error; });

  async function body(req, limit = 65536) {
    if (Number(req.headers['content-length']) > limit) { req.resume(); throw fail(413, 'The upload exceeds the allowed size.'); }
    const chunks = []; let size = 0;
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      if (size > limit) { req.resume(); throw fail(413, 'The upload exceeds the allowed size.'); }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  const jsonBody = async (req, limit = 65536) => { try { return JSON.parse((await body(req, limit)).toString()); } catch (error) { if (error.status) throw error; throw fail(400, 'Invalid JSON request.'); } };
  function session(req) {
    const id = /(?:^|;\s*)deedcraft_template_admin=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
    const current = sessions.get(id);
    if (!current || current.expires < Date.now() || !password()) { sessions.delete(id); return null; }
    return { ...current, id };
  }
  function sameOrigin(req) {
    if (req.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'Cross-site requests are not permitted.');
    if (req.headers.origin) {
      let host;
      try { host = new URL(req.headers.origin).host; } catch { throw fail(403, 'Invalid request origin.'); }
      if (host !== req.headers.host) throw fail(403, 'Invalid request origin.');
    }
  }
  function requireAdmin(req, mutation = false) {
    const current = session(req);
    if (!current) throw fail(401, 'Sign in as the template administrator.');
    if (mutation) {
      sameOrigin(req);
      if (req.headers['x-csrf-token'] !== current.csrf) throw fail(403, 'Invalid session token. Sign in again.');
    }
    return current;
  }
  async function checkedBytes(version) {
    const bytes = await storage.get(version.id + '.docx');
    if (hash(bytes) !== version.hash) throw fail(503, 'Stored template failed its integrity check.');
    return bytes;
  }
  async function validateAndSample(version, bytes, generateSamples = true) {
    const runtime = await loadTemplateRuntime();
    const family = runtime.libraryFamilyFor(version.instrumentId, version.variantId);
    const contract = contractFor(family);
    version.fieldContract ||= runtime.EMPTY_FIELD_CONTRACT;
    version.inspection = await runtime.inspectTemplateFields(bytes, version.fieldContract);
    version.fieldContract = { version: 1, fields: version.fieldContract.fields.map(field => {
      const locations = version.inspection.occurrences.filter(item => item.placeholder.replace(/\s+/g, ' ').trim().toLowerCase() === field.placeholder.replace(/\s+/g, ' ').trim().toLowerCase());
      return { ...field, variants: locations.some(item => !item.variants.length) ? [] : [...new Set(locations.flatMap(item => item.variants))] };
    }) };
    version.schemaHash = hash(runtime.canonicalContract(version.fieldContract));
    version.packageHash = hash(version.hash + ':' + version.schemaHash + ':' + contract);
    version.schemaRevision ||= 0;
    version.contractVersion = contract;
    // Use the same vocabulary and structural checks as browser validation.
    version.validation = await runtime.validateDeedTemplate(bytes, version.instrumentId, version.variantId || '', version.filename, version.fieldContract);
    version.preservationVersion = runtime.DEED_PRESERVATION_VERSION;
    const cases = runtime.sampleCasesFor(version.fieldContract, version.validation, family);
    version.expectedSampleCount = cases.length;
    for (const field of version.fieldContract.fields) if (version.inspection.occurrences.some(item => item.placeholder.trim().toLowerCase() === field.placeholder.trim().toLowerCase() && !item.supported)) { version.validation.valid = false; version.validation.errors.push(`<${field.placeholder}> is in an unsupported Word location.`); }
    version.samples = [];
    delete version.samplesSchemaHash;
    delete version.samplesPreservationVersion;
    if (!version.validation.valid || !generateSamples) return;
    const source = { kind: 'custom', name: version.filename, hash: version.hash, bytes, validation: version.validation, fieldContract: version.fieldContract };
    for (const [id, label] of cases) {
      try {
        const output = await runtime.renderSample(id, source, family);
        const file = version.id + '-' + id + '-' + hash(output) + '.docx';
        await atomic(file, output);
        version.samples.push({ id, label, file });
      } catch (error) { version.samples.push({ id, label, error: error.message }); }
    }
    version.samplesSchemaHash = version.schemaHash;
    version.samplesPreservationVersion = runtime.DEED_PRESERVATION_VERSION;
  }

  return async function templateApi(req, res, next) {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/templates')) { if (next) return next(); return false; }
    const route = url.pathname.slice('/api/templates'.length);
    const send = (status, data) => {
      res.statusCode = status;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
    try {
      if (route === '/session' && req.method === 'GET') {
        const current = session(req);
        return send(200, { configured: !!password(), authenticated: !!current, csrf: current?.csrf });
      }
      if (route === '/login' && req.method === 'POST') {
        sameOrigin(req);
        if (!password()) throw fail(503, 'Template management is disabled until TEMPLATE_ADMIN_PASSWORD is configured.');
        const ip = req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        for (const [key, item] of attempts) if (now - item.start > 15 * 60 * 1000) attempts.delete(key);
        for (const [key, item] of sessions) if (item.expires < now) sessions.delete(key);
        const counter = attempts.get(ip) || { start: now, count: 0 };
        if (counter.count >= 5) throw fail(429, 'Too many login attempts. Try again in 15 minutes.');
        counter.count++; attempts.set(ip, counter);
        const input = await jsonBody(req);
        const expected = createHash('sha256').update(password()).digest();
        const actual = createHash('sha256').update(typeof input.password === 'string' ? input.password : '').digest();
        if (!timingSafeEqual(expected, actual)) throw fail(401, 'Incorrect administrator password.');
        attempts.delete(ip);
        const id = randomBytes(32).toString('hex'); const csrf = randomBytes(32).toString('hex');
        sessions.set(id, { csrf, expires: now + SESSION_MS });
        const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
        res.setHeader('Set-Cookie', `deedcraft_template_admin=${id}; HttpOnly; SameSite=Strict; Path=/api/templates; Max-Age=28800${secure ? '; Secure' : ''}`);
        return send(200, { authenticated: true, csrf });
      }
      if (route === '/logout' && req.method === 'POST') {
        const current = requireAdmin(req, true); sessions.delete(current.id);
        res.setHeader('Set-Cookie', 'deedcraft_template_admin=; HttpOnly; SameSite=Strict; Path=/api/templates; Max-Age=0');
        return send(200, { authenticated: false });
      }
      await ensureInitialized();
      if (route === '/placement-catalog' && req.method === 'GET') {
        requireAdmin(req);
        if ((url.searchParams.get('instrument') || 'sale') !== 'sale') throw fail(400, 'Only Sale is onboarded.');
        return send(200, (await loadTemplateRuntime()).PLACEMENT_CATALOG);
      }
      if (route === '/binding-catalog' && req.method === 'GET') {
        requireAdmin(req);
        if ((url.searchParams.get('instrument') || 'sale') !== 'sale') throw fail(400, 'Only Sale is onboarded.');
        return send(200, await (await loadTemplateRuntime()).templateBindingCatalog());
      }
      if (route === '/guide' && req.method === 'GET') {
        const runtime = await loadTemplateRuntime();
        const result = await runtime.validateSaleDeedTemplate(await readFile(join(ROOT, 'sale-deed-template-v10.docx')));
        return send(200, { placeholders: [...new Set([...result.detectedPlaceholders, ...result.omittedPlaceholders])].sort() });
      }
      if ((route === '' || route === '/') && req.method === 'GET') {
        const data = await read();
        data.preservationVersion = (await loadTemplateRuntime()).DEED_PRESERVATION_VERSION;
        if (session(req)) data.deletedVersions = data.versions.filter(version => version.deletedAt);
        data.versions = data.versions.filter(version => !version.deletedAt);
        if (!session(req)) {
          data.versions = data.versions.filter(version => version.publishedAt).map(({ validation, samples, inspection, ...version }) => ({ ...version, saleOpenings: validation?.saleOpenings }));
          delete data.history;
        }
        return send(200, data);
      }
      if (route === '/upload' && req.method === 'POST') {
        requireAdmin(req, true);
        const runtime = await loadTemplateRuntime();
        const family = url.searchParams.get('family') || url.searchParams.get('instrument') || 'sale';
        if (!Object.hasOwn(runtime.TEMPLATE_FAMILIES, family)) throw fail(400, 'Choose a deed type with an approved template and rendering rules.');
        const { instrumentId, variantId } = runtime.TEMPLATE_FAMILIES[family];
        const filename = (url.searchParams.get('filename') || '').split(/[/\\]/).pop();
        if (!filename || filename.length > 200 || !/\.docx$/i.test(filename)) throw fail(400, 'Choose a .docx filename of at most 200 characters.');
        const bytes = await body(req, LIMIT);
        const version = { id: family.replaceAll('_', '-') + '-' + randomUUID(), instrumentId, variantId, filename, hash: hash(bytes), createdAt: new Date().toISOString(), contractVersion: contractFor(family) };
        const currentLibrary = await read();
        const parent = currentLibrary.versions.find(item => item.id === (url.searchParams.get('parentVersionId') || currentLibrary.active[family]));
        if (!parent?.publishedAt || runtime.libraryFamilyFor(parent.instrumentId, parent.variantId) !== family) throw fail(400, 'Choose a published parent template for this deed type.');
        version.fieldContract = { version: 1, fields: (parent.fieldContract?.fields || []).map(field => ({ ...field })) };
        await validateAndSample(version, bytes);
        await serial(async () => {
          const data = await read();
          await atomic(version.id + '.docx', bytes);
          data.versions.unshift(version); await save(data);
        });
        return send(201, version);
      }
      const match = /^\/versions\/([a-z0-9-]+)(?:\/(download|validate|publish|rollback|samples|fields|restore)(?:\/([a-z0-9-]+))?)?$/.exec(route);
      if (!match) throw fail(404, 'Template endpoint not found.');
      const [, id, action, sampleId] = match;
      const data = await read();
      const version = data.versions.find(version => version.id === id);
      if (!version) throw fail(404, 'Template version not found.');
      if ((!action && req.method === 'DELETE') || (action === 'restore' && req.method === 'POST')) {
        requireAdmin(req, true);
        const input = await jsonBody(req);
        await serial(async () => {
          const current = await read(); const item = current.versions.find(item => item.id === id);
          if (!item) throw fail(404, 'Template version not found.');
          if (item.publishedAt || Object.values(current.active).includes(id) || current.history.some(event => event.versionId === id || event.previousVersionId === id)) throw fail(409, 'Published templates cannot be deleted. Saved deeds may still use them.');
          if (action === 'restore') {
            if (!item.deletedAt) throw fail(409, 'This revision is not in Trash. Refresh the library.');
            delete item.deletedAt;
          } else {
            if (item.deletedAt) return;
            if (input.expectedSchemaRevision !== (item.schemaRevision || 0) || input.expectedHash !== item.hash) throw fail(409, 'This revision changed. Refresh the library before deleting it.');
            item.deletedAt = new Date().toISOString();
          }
          await save(current);
        });
        return send(200, { deleted: action !== 'restore', restored: action === 'restore' });
      }
      if (version.deletedAt) throw fail(404, 'This revision is in Trash. Restore it before using it.');
      if (action === 'download' && req.method === 'GET') {
        if (!version.publishedAt) requireAdmin(req);
        const bytes = await checkedBytes(version);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="template-${id}.docx"`);
        res.setHeader('Cache-Control', 'no-store'); res.end(bytes); return;
      }
      requireAdmin(req, req.method !== 'GET');
      if (action === 'fields' && req.method === 'GET') return send(200, { contract: version.fieldContract || { version: 1, fields: [] }, schemaRevision: version.schemaRevision || 0, inspection: version.inspection });
      if (action === 'fields' && req.method === 'PATCH') {
        if (version.instrumentId !== 'sale') throw fail(400, 'Additional dashboard fields are available for Sale templates. Use the existing bindings for this deed type.');
        const input = await jsonBody(req, 2 * 1024 * 1024);
        const updated = await serial(async () => {
          const current = await read(); const item = current.versions.find(item => item.id === id);
          if (!item || item.deletedAt) throw fail(404, 'Template revision is no longer available. Refresh the library.');
          if (item.publishedAt) throw fail(409, 'Published revisions are immutable. Upload a new revision.');
          if (input.expectedSchemaRevision !== (item.schemaRevision || 0)) throw fail(409, 'Field configuration changed. Refresh before saving.');
          const runtime = await loadTemplateRuntime(); const bytes = await checkedBytes(item);
          const inspection = await runtime.inspectTemplateFields(bytes, item.fieldContract);
          try { item.fieldContract = runtime.validateFieldContract(input.contract, await runtime.templateBindingCatalog(), inspection.occurrences, item.fieldContract, true); } catch (error) { throw fail(400, error.message); }
          item.schemaRevision = (item.schemaRevision || 0) + 1;
          await validateAndSample(item, bytes, false); await save(current); return item;
        });
        return send(200, updated);
      }
      if (action === 'samples' && sampleId && req.method === 'GET') {
        const sample = version.samples.find(item => item.id === sampleId);
        if (!sample || sample.error) throw fail(404, 'Sample is not available.');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="SAMPLE-${sampleId}.docx"`);
        res.setHeader('Cache-Control', 'no-store');
        res.end(await storage.get(sample.file || version.id + '-' + sampleId + '.docx')); return;
      }
      if (!action && req.method === 'GET') return send(200, version);
      if (action === 'validate' && req.method === 'POST') {
        const updated = await serial(async () => {
          const current = await read(); const item = current.versions.find(item => item.id === id);
          if (!item || item.deletedAt) throw fail(404, 'Template revision is no longer available. Refresh the library.');
          if (item.publishedAt) throw fail(409, 'Published revisions are immutable. Upload a new revision.');
          await validateAndSample(item, await checkedBytes(item)); await save(current); return item;
        });
        return send(200, updated);
      }
      if (['publish', 'rollback'].includes(action) && req.method === 'POST') {
        const input = await jsonBody(req);
        const result = await serial(async () => {
          const current = await read(); const item = current.versions.find(item => item.id === id);
          if (!item || item.deletedAt) throw fail(404, 'Template revision is no longer available. Refresh the library.');
          const runtime = await loadTemplateRuntime();
          const family = runtime.libraryFamilyFor(item.instrumentId, item.variantId);
          const previousVersionId = current.active[family];
          if (input.expectedActive !== previousVersionId) throw fail(409, 'The active template changed. Refresh the library before publishing.');
          if (action === 'rollback' && !item.publishedAt) throw fail(400, 'Rollback requires a previously published version.');
          const currentValidation = await runtime.validateDeedTemplate(await checkedBytes(item), item.instrumentId, item.variantId || '', item.filename, item.fieldContract);
          if (!currentValidation.valid) throw fail(400, 'This template conflicts with current deed preservation rules: ' + currentValidation.errors.join(' '));
          if (action === 'publish') {
            if (item.preservationVersion !== runtime.DEED_PRESERVATION_VERSION || item.samplesPreservationVersion !== runtime.DEED_PRESERVATION_VERSION) throw fail(400, 'Deed preservation rules changed. Validate this revision and review fresh samples before publishing.');
            if (item.fieldContract?.fields.length && (input.expectedSchemaRevision !== item.schemaRevision || input.expectedSchemaHash !== item.schemaHash)) throw fail(409, 'Field configuration changed. Refresh and review the current samples before publishing.');
            if (!item.validation.valid || item.contractVersion !== contractFor(family) || item.samples.length !== runtime.sampleCasesFor(item.fieldContract, currentValidation, family).length || item.samples.some(sample => sample.error) || item.samplesSchemaHash !== item.schemaHash) throw fail(400, 'Validation and every sample must succeed for the current field configuration before publishing.');
            if (input.reviewed !== true) throw fail(400, 'Confirm that sample wording and layout have been reviewed.');
            for (const sample of item.samples) await storage.get(sample.file || item.id + '-' + sample.id + '.docx');
          }
          await checkedBytes(item);
          const at = new Date().toISOString();
          item.publishedAt ||= at;
          if (action === 'publish') { item.publishedBy = 'template-admin'; item.reviewedAt = at; }
          current.active[family] = id;
          current.history.unshift({ versionId: id, previousVersionId, at, action });
          await save(current); return current;
        });
        return send(200, result);
      }
      throw fail(405, 'Method not allowed.');
    } catch (error) {
      if (!error.status) console.error('Template library:', error.message);
      if (!res.headersSent) send(error.status || 503, { error: error.status ? error.message : 'Template storage is unavailable. Check server configuration and retry.' });
      else res.end();
    }
  };
}
