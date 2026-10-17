// The Word file is the source of truth for the generated deed. Keeping it as
// a bundled asset prevents template revisions from drifting from a base64 copy.
import saleDeedTemplateUrl from './sale-deed-template-v10.docx?url';
import saleDeedTemplateV9Url from './sale-deed-template-v9.docx?url';
import saleDeedTemplateV7Url from './sale-deed-template-v7.docx?url';
import saleDeedTemplateV6Url from './sale-deed-template-v6.docx?url';
import saleDeedTemplateV5Url from './sale-deed-template-v5.docx?url';
import saleDeedTemplateV4Url from './sale-deed-template-v4.docx?url';
import saleDeedTemplateV3Url from './sale-deed-template.docx?url';
import saleDeedTemplateV2Url from './sale-deed-template-v2.docx?url';
import type { InstrumentId } from './instruments';
import { TEMPLATE_VERSIONS } from './legal-registry';

export const DEED_TEMPLATES = { Sale: { id: 'sale-deed-v10', url: saleDeedTemplateUrl } } as const;

let cachedTemplate: Promise<Uint8Array> | undefined;

export function loadSaleDeedTemplate(): Promise<Uint8Array> {
  cachedTemplate ??= fetch(saleDeedTemplateUrl)
    .then(response => {
      if (!response.ok) throw new Error('Could not load the sale deed template.');
      return response.arrayBuffer();
    })
    .then(buffer => new Uint8Array(buffer))
    .catch(error => { cachedTemplate = undefined; throw error; });
  return cachedTemplate;
}

/** Instrument-neutral loader. Unknown or unapproved assets fail closed. */
export async function loadTemplate(templateVersionId: string): Promise<Uint8Array> {
  const version = TEMPLATE_VERSIONS.find(item => item.id === templateVersionId);
  if (!version) throw new Error(`Template version ${templateVersionId} is not registered.`);
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template-v10.docx') return loadSaleDeedTemplate();
  if (version.asset === 'sale-deed-template-v9.docx') { const response = await fetch(saleDeedTemplateV9Url); if (!response.ok) throw new Error('Could not load v9 template.'); return new Uint8Array(await response.arrayBuffer()); }
  if (version.asset === 'sale-deed-template-v7.docx') { const response = await fetch(saleDeedTemplateV7Url); if (!response.ok) throw new Error('Could not load v7 template.'); return new Uint8Array(await response.arrayBuffer()); }
  if (version.asset === 'sale-deed-template-v6.docx') { const response = await fetch(saleDeedTemplateV6Url); if (!response.ok) throw new Error('Could not load v6 template.'); return new Uint8Array(await response.arrayBuffer()); }
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template-v5.docx') {
    const response = await fetch(saleDeedTemplateV5Url);
    if (!response.ok) throw new Error('Could not load the earlier sale deed template.');
    return new Uint8Array(await response.arrayBuffer());
  }
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template-v4.docx') {
    const response = await fetch(saleDeedTemplateV4Url);
    if (!response.ok) throw new Error('Could not load the earlier sale deed template.');
    return new Uint8Array(await response.arrayBuffer());
  }
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template.docx') {
    const response = await fetch(saleDeedTemplateV3Url);
    if (!response.ok) throw new Error('Could not load the earlier sale deed template.');
    return new Uint8Array(await response.arrayBuffer());
  }
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template-v2.docx') {
    const response = await fetch(saleDeedTemplateV2Url);
    if (!response.ok) throw new Error('Could not load the earlier sale deed template.');
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error(`Template asset for ${version.instrumentId} has not been onboarded.`);
}

export function templateVersionFor(instrumentId: InstrumentId): string | undefined {
  return TEMPLATE_VERSIONS.find(item => item.instrumentId === instrumentId)?.id;
}
