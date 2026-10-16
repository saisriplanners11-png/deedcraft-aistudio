import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadTemplateRuntime } from './template-runtime-loader.mjs';
async function changed(edit: (xml: string) => string) {
  const runtime = await loadTemplateRuntime();
  const entries = await runtime.readZip(await readFile(new URL('./sale-deed-template-v6.docx', import.meta.url)));
  const doc = entries.find((entry: any) => entry.name === 'word/document.xml');
  doc.data = new TextEncoder().encode(edit(new TextDecoder().decode(doc.data)));
  return { runtime, bytes: await runtime.writeZip(entries) };
}
describe('template conditional markers', () => {
  it('accepts supported flat marker aliases and renders them using the same parser', async () => {
    const { runtime, bytes } = await changed(xml => xml.replaceAll('IF FLAT SEMI FINISHED', 'IF SEMI-FINISHED FLAT').replaceAll('IF FLAT FINISHED', 'IF FINISHED FLAT'));
    const validation = await runtime.validateSaleDeedTemplate(bytes);
    expect(validation.errors).toEqual([]);
    const inspection = await runtime.inspectTemplateFields(bytes);
    expect(inspection.unresolved.some((name: string) => /^IF\b/.test(name))).toBe(false);
    const sample = await runtime.renderSample('flat-semi', { kind: 'custom', bytes, name: 'sale.docx', hash: '', validation });
    expect(await runtime.docxToText(sample)).not.toContain('<IF SEMI-FINISHED FLAT>');
  }, 30000);
  it('reports unsupported conditions as structure, never as configurable input fields', async () => {
    const { runtime, bytes } = await changed(xml => xml.replace('<w:body>', '<w:body><w:p><w:r><w:t>&lt;IF HOUSE FINISHED&gt;</w:t></w:r></w:p>'));
    const validation = await runtime.validateSaleDeedTemplate(bytes);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error: string) => error.includes('Unsupported conditional marker'))).toBe(true);
    const inspection = await runtime.inspectTemplateFields(bytes);
    expect(inspection.unresolved).not.toContain('IF HOUSE FINISHED');
    expect(inspection.structureErrors.some((error: string) => error.includes('Unsupported conditional marker'))).toBe(true);
  });
  it('explains Gift uploads without pretending that adding Sale markers enables Gift generation', async () => {
    const { runtime, bytes } = await changed(xml => xml.replace('<w:body>', '<w:body><w:p><w:r><w:t>GIFT SETTLEMENT DEED IN FAVOUR OF FAMILY MEMBER</w:t></w:r></w:p>'));
    const validation = await runtime.validateSaleDeedTemplate(bytes, 'GIFT SETTLEMENT.docx');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0]).toContain('Gift template uploaded to the Sale library');
  });
});
