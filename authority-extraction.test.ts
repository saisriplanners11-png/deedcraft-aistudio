import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ active: 0, peak: 0, calls: [] as any[], disputed: false }));
vi.mock('./upload-extraction', () => ({
  prepare: async () => ({ pages: [1, 2, 3].map(number => ({ number, region: 'Page ' + number, parts: [{ type: 'text', text: 'Principal: PERSON P' + number + '\nDocument No. AUTH-1 executed 02/01/2026' }] })), notes: [], dispose: async () => {} }),
  extractUpload: vi.fn(),
}));
vi.mock('./claude', () => ({ VISION_MODEL: 'vision', VERIFY_MODEL: 'verify', readableError: (error: unknown) => error,
  getClient: () => ({ messages: { create: async (request: any) => {
    api.calls.push(request); api.active++; api.peak = Math.max(api.peak, api.active);
    await new Promise(resolve => setTimeout(resolve, 10)); api.active--;
    const name = request.messages[0].content[0].text.split('\n')[0].slice('Principal: '.length);
    return { stop_reason: 'end_turn', content: [{ type: 'tool_use', name: 'record_authority', input: {
      kind: 'authority', details: { documentNo: 'AUTH-1', documentDate: '02/01/2026' },
      detailQuotes: { documentNo: 'Document No. AUTH-1', documentDate: 'executed 02/01/2026' },
      people: [{ role: 'principal', values: { Name: name, Dob: '02/01/1990', Aadhaar: api.disputed && request.model === 'verify' ? '9999 5678 9012' : '1234 5678 9012' }, principalNames: [], quote: 'Principal: ' + name }], notes: [],
    } }] };
  } } }) }));
import { extractAuthorityDocuments } from './authority-extraction';
beforeEach(() => { api.active = 0; api.peak = 0; api.calls = []; api.disputed = false; });
it('independently verifies every authority page while respecting the shared four-request limit', async () => {
  const result = await extractAuthorityDocuments([], [], new AbortController().signal, () => {});
  expect(api.calls).toHaveLength(6); expect(api.peak).toBe(4);
  expect(api.calls.every(request => !JSON.stringify(request.messages).includes('First read:'))).toBe(true);
  expect(result.people).toHaveLength(3);
  expect(result.people.every(person => person.values.Aadhaar === '123456789012' && person.values.Dob === '1990-01-02')).toBe(true);
  expect(result.details.documentDate).toBe('2026-01-02');
});
it('retains only independently agreed authority identifiers and flags disputed Aadhaar digits', async () => {
  api.disputed = true;
  const result = await extractAuthorityDocuments([], [], new AbortController().signal, () => {});
  expect(result.people.every(person => !person.values.Aadhaar)).toBe(true);
  expect(result.notes.some(note => note.includes('Aadhaar'))).toBe(true);
});
