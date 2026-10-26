import { describe, it, expect, vi } from 'vitest';
import { createRegistrationLookupApi } from './registration-lookup-api.mjs';

async function call(handler, query, method = 'GET') {
  const headers = {};
  const res = { statusCode: 200, setHeader: (name, value) => headers[name] = value, end: body => { res.body = body ? JSON.parse(body) : null; } };
  let next = false;
  await handler({ method, url: query }, res, () => { next = true; });
  return { ...res, headers, next };
}
const response = data => new Response(JSON.stringify(data), { status: 200 });
describe('public registration lookup adapter', () => {
  it('retains the captured district codes and source order without an upstream request', async () => {
    const fetchImpl = vi.fn();
    const result = await call(createRegistrationLookupApi({ fetchImpl }), '/api/registration/lookups?kind=districts');
    expect(result.body.options[0]).toEqual({ code: '19_1', label: 'ADILABAD' });
    expect(result.body.options.find(option => option.code === '16_1').label).toBe('HYDERABAD');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each([
    ['mandals&district=16_1', 'MandalDetails.htm', 'mandalDetails', '00'],
    ['villages&district=16_1&mandal=00', 'VillageDetails.htm', 'villageDetails', '1600001'],
    ['jurisdiction&sro=1602', 'getJurisdicionName.htm', 'SrDetails', '1602'],
  ])('uses the fixed endpoint for %s and retains zero-prefixed codes', async (query, path, key, code) => {
    const fetchImpl = vi.fn(async () => response({ message: 'success', [key]: [{ code, name: 'SOURCE NAME' }] }));
    const result = await call(createRegistrationLookupApi({ fetchImpl }), `/api/registration/lookups?kind=${query}&url=https://attacker.invalid/`);
    expect(result.body.options).toEqual([{ code, label: 'SOURCE NAME' }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url.origin).toBe('https://registration.telangana.gov.in');
    expect(url.pathname).toBe(`/PDE/${path}`);
    expect(url.searchParams.has('url')).toBe(false);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('preserves locality display text, canonical name, ward/block, SRO, ULB and local body order', async () => {
    const fetchImpl = async () => response({ message: 'success', localityDetails: [
      { code: '1516013#1525#0#0#ALIZAPUR', name: '[W-B:0-0] ALIZAPUR', locality: 'ALIZAPUR' },
    ], ulbDetails: [{ code: '41', name: 'GHMC' }], localbodyDetails: [{ code: '0', name: 'GHMC' }] });
    const result = await call(createRegistrationLookupApi({ fetchImpl }), '/api/registration/lookups?kind=localities&district=15_1&village=1516013');
    expect(result.body).toEqual({ options: [{ code: '1516013#1525#0#0#ALIZAPUR', label: '[W-B:0-0] ALIZAPUR', value: 'ALIZAPUR', ward: '0', block: '0', sroCode: '1525' }], ulbs: [{ code: '41', label: 'GHMC' }], localBodies: [{ code: '0', label: 'GHMC' }] });
  });
  it('shares in-flight requests and expires successful cached data', async () => {
    let time = 0;
    const fetchImpl = vi.fn(async () => response({ message: 'success', mandalDetails: [{ code: '00', name: 'HYDERABAD' }] }));
    const handler = createRegistrationLookupApi({ fetchImpl, now: () => time });
    const path = '/api/registration/lookups?kind=mandals&district=16_1';
    await Promise.all([call(handler, path), call(handler, path)]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    time = 600001; await call(handler, path);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('does not cache failed requests and keeps private upstream details out of errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('private upstream trace')).mockResolvedValueOnce(response({ message: 'success', mandalDetails: [] }));
    const handler = createRegistrationLookupApi({ fetchImpl });
    const path = '/api/registration/lookups?kind=mandals&district=16_1';
    const first = await call(handler, path);
    expect(first.statusCode).toBe(502); expect(first.body.error).toContain('manually'); expect(first.body.error).not.toContain('private');
    expect((await call(handler, path)).statusCode).toBe(200);
  });
  it('rejects invalid parameters, methods and malformed upstream responses', async () => {
    const fetchImpl = vi.fn(async () => response({ message: 'success', mandalDetails: 'invalid' }));
    const handler = createRegistrationLookupApi({ fetchImpl });
    for (const path of ['?kind=mandals&district=https://other.test', '?kind=villages&district=16_1&mandal=../', '?kind=localities&district=16_1&village=x', '?kind=jurisdiction&sro=1234%26token=x']) expect((await call(handler, '/api/registration/lookups' + path)).statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await call(handler, '/api/registration/lookups?kind=districts', 'POST')).statusCode).toBe(405);
    expect((await call(handler, '/api/registration/lookups?kind=mandals&district=16_1')).statusCode).toBe(502);
    expect((await call(handler, '/other')).next).toBe(true);
  });
  it('times out an unavailable service and returns an actionable manual-entry fallback', async () => {
    const fetchImpl = vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))));
    const result = await call(createRegistrationLookupApi({ fetchImpl, timeoutMs: 5 }), '/api/registration/lookups?kind=mandals&district=16_1');
    expect(result.statusCode).toBe(502); expect(result.body.error).toContain('Retry or enter the details manually');
  });
});
