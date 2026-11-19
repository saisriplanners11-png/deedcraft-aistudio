import { prepareDocument, visuallyRead } from './document-pages';

export type PlanDocumentScope = 'both' | 'parties' | 'property';

export async function planDocumentInput(file: File, signal: AbortSignal) {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const word = /\.docx$/i.test(file.name);
  const mimeType = pdf ? 'application/pdf' : file.type || 'image/jpeg';
  if (pdf || word || file.type.startsWith('text/') || /\.(?:txt|md)$/i.test(file.name)) {
    const document = await prepareDocument(file, signal);
    try {
      const text = document.pages.filter(page => !visuallyRead(page) && page.text?.trim())
        .map(page => 'SOURCE PAGE ' + page.number + ':\n' + page.text).join('\n\n');
      if (text && (word || document.pages.every(page => !visuallyRead(page)))) return { textContent: text, mimeType };
      if (word) {
        const images = document.pages.flatMap(page => page.parts.flatMap(part =>
          part.type === 'image' && part.source.type === 'base64' ? [part.source] : []));
        if (images.length === 1) return { fileBase64: images[0].data, mimeType: images[0].media_type };
        if (!images.length) throw new Error('No readable text or scan was found in the Word file.');
        const { PDFDocument } = await import('pdf-lib');
        const pdf = await PDFDocument.create();
        for (const image of images) {
          signal.throwIfAborted();
          const embedded = image.media_type === 'image/png' ? await pdf.embedPng(image.data) : await pdf.embedJpg(image.data);
          const page = pdf.addPage([embedded.width, embedded.height]);
          page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
        }
        return { fileBase64: await pdf.saveAsBase64(), mimeType: 'application/pdf' };
      }
    } finally { await document.dispose(); }
  }
  signal.throwIfAborted();
  return new Promise<{ fileBase64: string; mimeType: string }>((resolve, reject) => {
    const reader = new FileReader();
    const cancel = () => reader.abort();
    signal.addEventListener('abort', cancel, { once: true });
    reader.onloadend = () => signal.removeEventListener('abort', cancel);
    reader.onabort = () => reject(signal.reason);
    reader.onerror = () => reject(new Error('The selected file could not be read.'));
    reader.onload = () => resolve({ fileBase64: String(reader.result), mimeType });
    reader.readAsDataURL(file);
  });
}

const boundaryKeys = ['northBoundary', 'southBoundary', 'eastBoundary', 'westBoundary', 'roadWidth', 'roadSides', 'roadLayoutType', 'tJunctionSide'] as const;
const propertyKeys = ['propertyType', 'areaSqYards', 'areaSqMtrs', 'surveyNo', 'plotNo', 'houseNo', 'houseAuthority', 'locationTemplateType', 'nearHNo', 'locality', 'village', 'mandal', 'district'] as const;
type ReadPlan = Partial<Record<typeof boundaryKeys[number] | typeof propertyKeys[number], unknown>> & {
  northDim?: string; southDim?: string; eastDim?: string; westDim?: string;
  dimensionUnit?: 'Feet' | 'Metres';
  house?: object; houses?: object[];
};
type PlanWithProperty = { boundaries: { dimensionUnit: 'Feet' | 'Metres' }; property: { house?: object; houses?: object[] } };

/** Apply the document's verified fields without deriving dimensions from example geometry. */
export function withPlanDocumentProperty<T extends PlanWithProperty>(
  plan: T, read: ReadPlan, parseDimension: (raw: string, unit: 'Feet' | 'Metres') => unknown,
): T {
  const specified = (keys: readonly (keyof ReadPlan)[]) => Object.fromEntries(keys.flatMap(key =>
    read[key] === undefined ? [] : [[key, read[key]]]));
  const unit = read.dimensionUnit || plan.boundaries.dimensionUnit;
  const dimensions = Object.fromEntries((['northDim', 'southDim', 'eastDim', 'westDim'] as const).flatMap(key =>
    read[key] ? [[key, parseDimension(read[key], unit)]] : []));
  const house = read.house ? { ...plan.property.house, ...read.house } : plan.property.house;
  return {
    ...plan,
    boundaries: { ...plan.boundaries, dimensionUnit: unit, ...specified(boundaryKeys), ...dimensions },
    property: { ...plan.property, ...specified(propertyKeys), house, houses: read.houses ?? plan.property.houses },
  };
}
