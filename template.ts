// The Word file is the source of truth for the generated deed. Keeping it as
// a bundled asset prevents template revisions from drifting from a base64 copy.
import saleDeedTemplateUrl from './sale-deed-template.docx?url';
import type { InstrumentId } from './instruments';
import { TEMPLATE_VERSIONS } from './legal-registry';

export const DEED_TEMPLATES = { Sale: { id: 'sale-deed-v1', url: saleDeedTemplateUrl } } as const;

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
  if (version.instrumentId === 'sale' && version.asset === 'sale-deed-template.docx') return loadSaleDeedTemplate();
  throw new Error(`Template asset for ${version.instrumentId} has not been onboarded.`);
}

export function templateVersionFor(instrumentId: InstrumentId): string | undefined {
  return TEMPLATE_VERSIONS.find(item => item.instrumentId === instrumentId)?.id;
}
