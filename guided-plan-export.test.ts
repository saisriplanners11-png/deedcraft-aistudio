import { describe, expect, it, vi } from 'vitest';
import { saveAs } from 'file-saver';
import mammoth from 'mammoth';
import { downloadWord2007DeedDocx } from './guided-reference-plan/src/utils/deedDocxExporter';
import { SAMPLE_TEMPLATES } from './guided-reference-plan/src/components/SavedPlansModal';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('./exact-reference-plan/src/utils/capturePlan', () => ({
  capturePlan: vi.fn(async () => ({
    width: 1, height: 1,
    toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  })),
}));

describe('new generator Word export', () => {
  it('produces a readable Word file with the selected plan facts and separate party identities', async () => {
    const plan = structuredClone(SAMPLE_TEMPLATES[0]);
    plan.property.surveyNo = 'EXPORT/123';
    plan.executant[0].name = 'EXPORT SELLER';
    plan.claimant[0].name = 'EXPORT BUYER';
    await downloadWord2007DeedDocx(plan, {} as HTMLElement);
    const [blob, filename] = vi.mocked(saveAs).mock.calls.at(-1)!;
    expect(filename).toMatch(/\.docx$/);
    expect(blob).toBeInstanceOf(Blob);
    const bytes = Buffer.from(await (blob as Blob).arrayBuffer());
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    expect(value).toContain('EXPORT/123');
    expect(value).toContain('EXPORT SELLER');
    expect(value).toContain('EXPORT BUYER');
    expect(value).toContain('572');
  });
});
