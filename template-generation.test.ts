import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { docxToText, readZip, writeZip, scheduleText, type DeedTemplateSource } from './docx';
import { compileDeed, renderArtifact } from './deed-compiler';
import { DEED_DEFINITIONS } from './instruments';
import { loadLibraryBytes } from './template-library-client';

describe('pinned library generation', () => {
  const originalFetch = globalThis.fetch;
  beforeAll(() => { globalThis.fetch = async input => new Response(await readFile(new URL('./' + String(input).split('/').pop()!.split('?')[0], import.meta.url))); });
  afterAll(() => { globalThis.fetch = originalFetch; });
  it('retries failed downloads, rejects tampered bytes and reuses only verified cached bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const pin = { versionId: 'retry-integrity-test', name: 'test.docx', hash };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([9, 9])))
      .mockResolvedValueOnce(new Response(bytes));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(loadLibraryBytes(pin)).rejects.toThrow(/Retry/);
      await expect(loadLibraryBytes(pin)).rejects.toThrow(/integrity/);
      expect(await loadLibraryBytes(pin)).toEqual(bytes);
      expect(await loadLibraryBytes(pin)).toEqual(bytes);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      // Saved bytes must still be verified even when this version is cached.
      await expect(loadLibraryBytes({ ...pin, bytes: new Uint8Array([9]) })).rejects.toThrow(/integrity/);
    } finally { vi.unstubAllGlobals(); }
  });
  it('uses verified uploaded bytes and records the actual selected version', async () => {
    const entries = await readZip(new Uint8Array(await readFile(new URL('./sale-deed-template.docx', import.meta.url))));
    const document = entries.find(item => item.name === 'word/document.xml')!;
    document.data = new TextEncoder().encode(new TextDecoder().decode(document.data).replace('<w:body>', '<w:body><w:p><w:r><w:t>SHARED LIBRARY WORDING</w:t></w:r></w:p>'));
    const bytes = await writeZip(entries);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const source: DeedTemplateSource = { kind: 'library', name: 'shared.docx', versionId: 'sale-test-revision', hash, bytes };
    const compiled = compileDeed({ instrumentId: 'sale', variantId: DEED_DEFINITIONS.sale.variants[0].id, snapshotHash: 'test-input', values: { 'Executant Name': 'TEST VENDOR', 'Claimant Name': 'TEST BUYER' }, schedules: [{ variant: 'IF OPEN PLOT', values: { 'Extent in Sq.yards': '222' } }], unresolvedWarnings: [] }, source);
    expect(compiled.templateVersionId).toBe('sale-test-revision');
    const { result, manifest } = await renderArtifact(compiled, 'docx');
    expect(await docxToText(new Uint8Array(await result.blob.arrayBuffer()))).toContain('SHARED LIBRARY WORDING');
    expect(manifest.templateVersionId).toBe('sale-test-revision');
    expect(manifest.templateHash).toBe(hash);
    expect(await scheduleText('IF OPEN PLOT', { 'Extent in Sq.yards': '222' }, [], undefined, undefined, undefined, source)).toContain('222');
    await expect(loadLibraryBytes({ ...source, hash: '0'.repeat(64) })).rejects.toThrow(/integrity/i);
  });
  it('does not open unsupported deed generation when supplied a library template', () => {
    expect(() => compileDeed({ instrumentId: 'will', variantId: DEED_DEFINITIONS.will.variants[0].id, snapshotHash: '', values: {}, schedules: [], unresolvedWarnings: [] }, { kind: 'library', versionId: 'sale-test', name: '', hash: '' })).toThrow(/approved legal reference/i);
  });
});
