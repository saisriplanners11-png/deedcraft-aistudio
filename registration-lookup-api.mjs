import { DISTRICTS } from './registration-districts.mjs';

const BASE = 'https://registration.telangana.gov.in/PDE/';
const PATH = '/api/registration/lookups';
const TTL = 10 * 60 * 1000;
const asOptions = rows => {
  if (!Array.isArray(rows)) throw new Error('Invalid lookup response');
  return rows.map(row => {
    if (row.code == null || typeof row.name !== 'string') throw new Error('Invalid lookup option');
    return { code: String(row.code), label: row.name };
  });
};
export function lookupRequest(params) {
  const kind = params.get('kind'); const district = params.get('district');
  if (kind === 'districts') return null;
  if (kind === 'jurisdiction') {
    const sro = params.get('sro');
    if (!/^\d{4}$/.test(sro || '')) throw new Error('Choose a valid registration office code.');
    return ['getJurisdicionName.htm', { sr_code: sro }];
  }
  if (!DISTRICTS.some(row => row.code === district)) throw new Error('Choose a valid Telangana district.');
  if (kind === 'mandals') return ['MandalDetails.htm', { dist_code: district, local_body: '' }];
  if (kind === 'villages') {
    const mandal = params.get('mandal');
    if (!/^\d{2}$/.test(mandal || '')) throw new Error('Choose a valid mandal code.');
    return ['VillageDetails.htm', { dist_code: district, mandal, local_body: '' }];
  }
  if (kind === 'localities') {
    const village = params.get('village');
    if (!/^\d{7}$/.test(village || '')) throw new Error('Choose a valid village code.');
    return ['LocalityDetails.htm', { dist_code: district, vill_code: village }];
  }
  throw new Error('Choose a supported lookup kind.');
}
export function normalizeLookup(kind, data) {
  if (data?.message !== 'success') throw new Error('Registration lookup unavailable');
  if (kind === 'mandals') return { options: asOptions(data.mandalDetails) };
  if (kind === 'villages') return { options: asOptions(data.villageDetails) };
  if (kind === 'jurisdiction') return { options: asOptions(data.SrDetails) };
  return {
    options: asOptions(data.localityDetails).map((option, i) => {
      const [village, sroCode, ward, block, ...name] = option.code.split('#');
      if (!/^\d{7}$/.test(village) || !/^\d{4}$/.test(sroCode) || !/^\d+$/.test(ward) || !/^\d+$/.test(block)) throw new Error('Invalid locality response');
      return { ...option, value: data.localityDetails[i].locality || name.join('#'), sroCode, ward, block };
    }),
    localBodies: asOptions(data.localbodyDetails), ulbs: asOptions(data.ulbDetails),
  };
}
/** Fixed public location endpoints only; no cookies, uploads, identities or arbitrary URLs. */
export function createRegistrationLookupApi({ fetchImpl = fetch, now = Date.now, timeoutMs = 15000 } = {}) {
  const cache = new Map();
  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname !== PATH) return next?.();
    const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'Use GET for registration lookups.' }); }
    let request;
    try { request = lookupRequest(url.searchParams); } catch (error) { return send(400, { error: error.message }); }
    if (!request) return send(200, { options: DISTRICTS });
    const kind = url.searchParams.get('kind');
    const upstream = new URL(request[0], BASE); upstream.search = new URLSearchParams(request[1]).toString();
    const key = upstream.href;
    try {
      let entry = cache.get(key);
      if (!entry || entry.expires <= now()) {
        const promise = (async () => {
          const response = await fetchImpl(upstream, { method: 'POST', headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
          if (!response.ok) throw new Error('Registration service returned an error');
          const text = await response.text();
          if (text.length > 5_000_000) throw new Error('Lookup response too large');
          return normalizeLookup(kind, JSON.parse(text));
        })();
        entry = { promise, expires: now() + TTL };
        if (cache.size >= 500) cache.delete(cache.keys().next().value);
        cache.set(key, entry);
        promise.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
      }
      return send(200, await entry.promise);
    } catch {
      return send(502, { error: 'Telangana registration records are unavailable. Retry or enter the details manually.' });
    }
  };
}
