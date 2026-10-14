import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fieldFingerprint, type TemplateField } from './template-fields';
const mock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('./claude', () => ({ getClient: () => ({ messages: { create: mock.create } }), EXTRACT_MODEL: 'read', DRAFT_MODEL: 'draft', VISION_MODEL: 'read', VERIFY_MODEL: 'verify', readableError: (error: any) => error }));
import { extractTemplateFields } from './upload-extraction';
const field: TemplateField = { id: 'new_amount', placeholder: 'Maintenance Amount', label: 'Maintenance amount', help: '', type: 'currency', scope: 'transaction', required: true, options: [], sampleValue: '99999', extractionEnabled: true, extractionDescription: 'Current maintenance amount', evidenceContext: 'current' };
const raw = (patch = {}) => ({ field: field.id, value: '2500', role: 'property', record: 'primary', quote: 'Maintenance: 2500', region: 'label', historical: false, handwritten: false, ...patch });
const response = (candidates: any[]) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'record_transcription', input: { candidates } }] });
describe('custom field AI proposals', () => {
  beforeEach(() => mock.create.mockReset());
  it('returns evidence and independent verification without sending sample values', async () => {
    mock.create.mockResolvedValue(response([raw()]));
    const result = await extractTemplateFields(new File(['Maintenance: 2500'], 'note.txt', { type: 'text/plain' }), [field], { id: 'deed', label: 'Whole deed' }, new AbortController().signal);
    expect(result[0]).toMatchObject({ value: '2500', quote: 'Maintenance: 2500', verified: true, fingerprint: fieldFingerprint(field) });
    expect(mock.create).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mock.create.mock.calls)).not.toContain('99999');
    expect(result[0].issue).toBeUndefined();
  });
  it('marks disagreeing, unsupported and historical proposals for correction', async () => {
    mock.create.mockResolvedValueOnce(response([raw()])).mockResolvedValueOnce(response([raw({ value: '3500' })]));
    const file = new File(['Maintenance: 2500'], 'note.txt', { type: 'text/plain' });
    const disputed = await extractTemplateFields(file, [field], { id: 'deed', label: 'Whole deed' }, new AbortController().signal);
    expect(disputed[0].issue).toMatch(/disagree/);
    mock.create.mockResolvedValue(response([raw({ quote: 'Invented quote', historical: true })]));
    const historical = await extractTemplateFields(file, [field], { id: 'deed', label: 'Whole deed' }, new AbortController().signal);
    expect(historical[0].issue).toMatch(/historical/);
    mock.create.mockResolvedValue(response([raw({ quote: 'Invented quote' })]));
    const unsupported = await extractTemplateFields(file, [field], { id: 'deed', label: 'Whole deed' }, new AbortController().signal);
    expect(unsupported[0].issue).toMatch(/quotation/);
  });
  it('batches at most twenty fields and honors cancellation', async () => {
    mock.create.mockResolvedValue(response([]));
    const file = new File(['No additional facts'], 'note.txt', { type: 'text/plain' });
    await extractTemplateFields(file, Array.from({ length: 21 }, (_, i) => ({ ...field, id: 'field_' + i })), { id: 'deed', label: 'Whole deed' }, new AbortController().signal);
    expect(mock.create).toHaveBeenCalledTimes(4);
    expect(mock.create.mock.calls.map(([args]) => args.tools[0].input_schema.properties.candidates.items.properties.field.enum.length)).toEqual([20, 20, 1, 1]);
    const controller = new AbortController(); controller.abort();
    await expect(extractTemplateFields(file, [field], { id: 'deed', label: 'Whole deed' }, controller.signal)).rejects.toThrow(/Cancelled/);
  });
});
