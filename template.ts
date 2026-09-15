// The Word file is the source of truth for the generated deed. Keeping it as
// a bundled asset prevents template revisions from drifting from a base64 copy.
import saleDeedTemplateUrl from './sale-deed-template.docx?url';

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
