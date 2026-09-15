// Reads an uploaded document with Claude and returns values for the form fields
// it can actually find. The response schema is generated from the field registry
// in fields.ts, so there is no second copy of the field list to keep in step.

import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { getClient, EXTRACT_MODEL, readableError } from './claude';
import { ALL_FIELDS, SUPPORTING_RECORD_FIELDS, type Field } from './fields';
import { docxToText } from './docx';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type DocKind = 'link-deed' | 'executant-id' | 'claimant-id' | 'plan' | 'supporting';
export type BulkKind = DocKind | 'payment' | 'unknown';

export type BulkClassification = {
  kind: BulkKind;
  /** Present only for payment instruments. */
  paymentMode: 'rtgs' | 'cheque' | 'dd' | 'upi' | 'cash' | null;
  /** Sale is the only template currently supported by this application. */
  deedType: 'Sale' | null;
  category: string | null;
  reason: string;
};

/** Apply reliable document classification to the regular upload flow too. */
export function classificationSelections(
  current: { deedType: string; category: string; draft: string },
  classification: BulkClassification | null,
): Partial<{ deedType: string; category: string; draft: string }> {
  if (!classification) return {};
  const patch: Partial<{ deedType: string; category: string; draft: string }> = {};
  if (classification.deedType && !current.deedType) {
    patch.deedType = classification.deedType;
    patch.draft = 'Outright Absolute Sale Deed';
  }
  if (classification.category && !current.category) patch.category = classification.category;
  return patch;
}

/** Registrar exports commonly use Book-Year-DocumentNo.pdf. */
export function linkDocumentNumberFromFilename(name: string): string | null {
  const base = name.trim().match(/^(?:bk[-_ ]*)?(?:book[-_ ]*)?\d+[-_ ]+(\d{4})[-_ ]+(\d{1,10})\.pdf$/i);
  return base ? `${base[2]}/${base[1]}` : null;
}

export const DOC_KINDS: Record<DocKind, { label: string; blurb: string; accept: string }> = {
  'link-deed': {
    label: 'Link / title document',
    blurb:
      'The prior registered deed. Its particulars, jurisdiction, property, extent, boundaries and valuation are read from it and placed into the relevant later steps.',
    accept: '.pdf,.docx,.doc,.txt,image/*',
  },
  'executant-id': {
    label: 'Executant identity documents',
    blurb: 'Aadhaar, PAN or an address proof for the vendor / first party.',
    accept: '.pdf,.docx,.txt,image/*',
  },
  'claimant-id': {
    label: 'Claimant identity documents',
    blurb: 'Aadhaar, PAN or an address proof for the purchaser / second party.',
    accept: '.pdf,.docx,.txt,image/*',
  },
  plan: {
    label: 'Plan / property document',
    blurb:
      'A layout plan, survey sketch, pahani or tax receipt. Plot and survey numbers, extent and the four boundaries are read from it.',
    accept: '.pdf,.docx,.txt,image/*',
  },
  supporting: {
    label: 'Supporting property documents',
    blurb: 'House-tax receipts, electricity or water bills, NALA conversion orders, pattadar/passbooks and other property records. Only visibly supported fields are merged.',
    accept: '.pdf,.docx,.txt,image/*',
  },
};

const party = (side: 'executant' | 'claimant') =>
  ALL_FIELDS.filter(f => f.id.startsWith(side) && !f.id.endsWith('Age')).map(f => f.id);

const JURISDICTION = ['district', 'mandal', 'village', 'locality', 'pinCode', 'sro', 'districtRegistrar', 'propState'];
const PROPERTY = ['plotNo', 'bearingHNo', 'nearHNo', 'surveyNo', 'extentValue', 'extentSqYards', 'extentSqMeters'];
const BOUNDARIES = ['boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest'];
const STRUCTURE = ['natureOfHouse', 'floors', 'ageOfHouse', 'plinthArea', 'bltNo'];
const UTILITIES = ['taxesPerAnnum', 'annualRentalValue', 'tapConnectionNo', 'metersNo'];
const SUPPORTING = SUPPORTING_RECORD_FIELDS.map(field => field.id);

/**
 * Which fields each kind of document may fill. The link deed deliberately spans
 * later phases — one upload should populate the whole chain, not just Step 02.
 */
export const TARGETS: Record<DocKind, string[]> = {
  'link-deed': [
    'linkDocType', 'linkDocNo', 'linkDocDate', 'linkSro',
    ...JURISDICTION, ...PROPERTY, ...BOUNDARIES, ...STRUCTURE, ...UTILITIES,
    'govtRate',
  ],
  'executant-id': party('executant'),
  'claimant-id': party('claimant'),
  plan: [
    ...PROPERTY, ...BOUNDARIES, ...STRUCTURE, ...UTILITIES,
    'propState', 'village', 'mandal', 'district', 'locality', 'pinCode',
  ],
  supporting: [
    ...SUPPORTING,
  ],
};

const field = (id: string) => [...ALL_FIELDS, ...SUPPORTING_RECORD_FIELDS].find(f => f.id === id);

export const supportingFieldLabel = (id: string) =>
  SUPPORTING_RECORD_FIELDS.find(item => item.id === id)?.label ?? id;

function describe(f: Field, kind: DocKind): string {
  const bits = [f.label];
  if (f.hint) bits.push(f.hint);
  if (/^(executant|claimant)Name$/.test(f.id)) {
    bits.push('Copy the holder name character-for-character from the identity document. Do not correct spelling or substitute a similar name.');
  }
  if (/^(executant|claimant)Dob$/.test(f.id)) {
    bits.push('Aadhaar DOB is printed as DD/MM/YYYY: the first number is the day and the second is the month. Example: 12/05/1996 must be returned as 1996-05-12.');
  }
  if (f.id === 'linkDocNo') bits.push('Read the registration/document number assigned to this uploaded deed, including its year. Do not return an earlier title deed number mentioned in the recitals.');
  if (f.id === 'linkDocDate') bits.push('Read the date on which this uploaded deed was executed from its opening execution sentence. Do not use a presentation, registration, stamp-paper or digital-signature date.');
  if (/RelationName$/.test(f.id)) {
    bits.push('Return the relationship label together with the related person name, for example "S/O Rajender". A bare S/O, W/O or D/O is not a usable value.');
  }
  if (/Occupation$/.test(f.id)) {
    bits.push('Occupation only. Gender words such as MALE or FEMALE are not occupations.');
  }
  if (/Mobile$/.test(f.id)) bits.push('Return only a visibly printed 10-digit Indian mobile number.');
  if (/HNo$/.test(f.id) && /^(executant|claimant)/.test(f.id)) bits.push('Copy the house or door number from the printed address block.');
  if (/^(executant|claimant)(Locality|Village|Mandal|District|State|PinCode)$/.test(f.id)) {
    bits.push('Use only the printed address block. Never geocode, look up a PIN code, or infer a place that is not printed.');
  }
  if (/aadhaar/i.test(f.id)) {
    bits.push('Read the printed Aadhaar number only: exactly 12 digits, normally grouped 4-4-4. Do not return the VID or enrolment number.');
  }
  if (f.id === 'supportingDocType') bits.push('Use the printed heading and document layout. A green Telangana booklet with a holder photo, barcode/passbook number and khata number is a Pattadar Passbook, not an identity card.');
  if (f.id === 'supportingAssessmentNo') bits.push('Use only a value explicitly labelled AST, ASST, Assessment No., Property Tax ID or PTIN. Never use Demand No., D.No., survey number, electricity SC number or an amount.');
  if (f.id === 'supportingHouseNo') bits.push('Use only the property/site number explicitly labelled H.No., House No., Door No. or Premises No. Never copy the applicant residence address, a locality phrase, assessment number, survey number or electricity account number. If a permit site table says House No. NA, omit this field.');
  if (f.id === 'supportingPassbookNo') bits.push('For a Telangana pattadar passbook, copy the alphanumeric value beside పాస్ బుక్ నెం. or the barcode, commonly beginning with T.');
  if (f.id === 'supportingKhataNo') bits.push('Copy only the number beside ఖాతా నెం. or Khata No.');
  if (f.id === 'supportingNalaOrderNo') bits.push('Copy only the proceedings/order number labelled Procdgs. No., Proceedings No. or Order No.; never use the survey number.');
  if (f.id === 'supportingPermitNo') bits.push('Copy only FILE No. or PERMIT No. from a building permit order.');
  if (f.id === 'supportingElectricityScNo') bits.push('Copy the complete value on the line labelled SC No.; do not shorten it to a bill number or section code.');
  if (f.id === 'supportingElectricityUscNo') bits.push('Copy the complete value on the line labelled USC No.');
  if (f.id === 'supportingHolder') bits.push('Use only the applicant, owner, pattadar, assessee or consumer. Never return an officer named under Present, Tahsildar, Commissioner or signature.');
  if (f.id === 'supportingExtent') bits.push('Return the visibly labelled extent/site area together with its printed unit when one is shown. A house number or account number is not an extent.');
  if (f.id === 'supportingDate') bits.push('Copy the date character-for-character from the document label. Interpret DD/MM/YYYY as day/month/year; for example 06/07/2021 is 2021-07-06, never 2021-06-07 or 2021-06-08.');
  if (f.type === 'date') bits.push('Return strictly as YYYY-MM-DD.');
  if (f.type === 'number' || f.type === 'money') bits.push('Return digits only, no currency symbol, commas or units.');
  if (f.options) bits.push(`One of: ${f.options.join(', ')}.`);
  return bits.join(' ');
}

/**
 * A JSON schema for exactly the fields named in `ids`.
 *
 * Every property is optional: a field the document does not mention must be
 * omitted, not guessed at. `required` is therefore left empty by design.
 *
 * The schema is kept deliberately small. The Messages API rejects an
 * over-large structured-output schema with "Schema is too complex", so the
 * field list for a document kind is read in several stages (see STAGES) rather
 * than as one schema covering every field at once.
 */
export function schemaForIds(ids: string[], kind: DocKind) {
  const properties: Record<string, { type: 'string'; description: string }> = {};
  for (const id of ids) {
    const f = field(id);
    if (!f || f.derived) continue;
    properties[id] = { type: 'string', description: describe(f, kind) };
  }
  return {
    type: 'object' as const,
    properties: {
      ...properties,
      ...(kind === 'executant-id' || kind === 'claimant-id' ? {
        _addressText: {
          type: 'string' as const,
          description: 'Transcribe the complete English address block as one comma-separated line, including relationship, house number, locality, places, state and PIN exactly as printed. Do not interpret or rearrange it.',
        },
      } : {}),
      _unreadable: {
        type: 'string' as const,
        description:
          'If the document is not the expected kind, or is too unclear to read, say so in one short sentence. Otherwise omit this field.',
      },
    },
    additionalProperties: false,
  };
}

/** The whole field list for a kind, as one schema. Kept for tests/inspection. */
export function schemaFor(kind: DocKind) {
  return schemaForIds(TARGETS[kind], kind);
}

/**
 * The reading passes for each document kind. One pass = one API call with a
 * small schema, and one line in the progress dialog the user watches.
 */
export type Stage = { title: string; ids: string[] };

/**
 * Groups are kept to ~5-6 fields each. The Messages API's structured-output
 * schema has a real complexity ceiling well below a document kind's full field
 * list (observed: ~19 fields is rejected, ~6 is accepted) — a group sized
 * above that ceiling doesn't just risk the `complexSchema` halving fallback,
 * it *guarantees* it, turning one read into a failed call plus one or two
 * retries, each resending the whole document. Pre-splitting this small keeps
 * every pass a single successful round trip instead.
 */
export const STAGES: Record<DocKind, Stage[]> = {
  'link-deed': [
    { title: 'Document & registration', ids: ['linkDocType', 'linkDocNo', 'linkDocDate', 'linkSro', 'sro', 'districtRegistrar'] },
    { title: 'Jurisdiction', ids: ['district', 'mandal', 'village', 'locality', 'pinCode', 'propState'] },
    { title: 'Property & extent', ids: [...PROPERTY] },
    { title: 'Boundaries', ids: [...BOUNDARIES] },
    { title: 'Structure & valuation', ids: [...STRUCTURE, 'govtRate'] },
    { title: 'Utilities', ids: [...UTILITIES] },
  ],
  'executant-id': [
    { title: 'Executant particulars', ids: ['executantName', 'executantRelationName', 'executantDob', 'executantOccupation'] },
    { title: 'Aadhaar verification', ids: ['executantAadhaar'] },
    { title: 'Executant identity & contact', ids: ['executantPan', 'executantMobile', 'executantHNo', 'executantLocality'] },
    { title: 'Executant address', ids: ['executantVillage', 'executantMandal', 'executantDistrict', 'executantState', 'executantPinCode'] },
  ],
  'claimant-id': [
    { title: 'Claimant particulars', ids: ['claimantName', 'claimantRelationName', 'claimantDob', 'claimantOccupation'] },
    { title: 'Aadhaar verification', ids: ['claimantAadhaar'] },
    { title: 'Claimant identity & contact', ids: ['claimantPan', 'claimantMobile', 'claimantHNo', 'claimantLocality'] },
    { title: 'Claimant address', ids: ['claimantVillage', 'claimantMandal', 'claimantDistrict', 'claimantState', 'claimantPinCode'] },
  ],
  plan: [
    { title: 'Property & extent', ids: [...PROPERTY] },
    { title: 'Location', ids: ['propState', 'village', 'mandal', 'district', 'locality', 'pinCode'] },
    { title: 'Boundaries', ids: [...BOUNDARIES] },
    { title: 'Structure', ids: [...STRUCTURE] },
    { title: 'Utilities', ids: [...UTILITIES] },
  ],
  supporting: [
    { title: 'Record identity', ids: ['supportingDocType', 'supportingDate', 'supportingAuthority', 'supportingHolder'] },
    { title: 'Tax & passbook', ids: ['supportingAssessmentNo', 'supportingHouseNo', 'supportingPassbookNo', 'supportingKhataNo'] },
    { title: 'Permissions', ids: ['supportingNalaOrderNo', 'supportingPermitNo', 'supportingSurveyNo', 'supportingPlotNo', 'supportingExtent'] },
    { title: 'Utilities & particulars', ids: ['supportingElectricityScNo', 'supportingElectricityUscNo', 'supportingDetails'] },
  ],
};

const SYSTEM = `You read Indian property and identity documents for a sub-registrar's office in Telangana / Andhra Pradesh and transcribe their particulars into a form.

Rules you must follow:
- Transcribe only what the document actually says. Never infer, complete or invent a value.
- If a field is not present in the document, omit it entirely. An omitted field is correct; a guessed one is a serious error.
- Copy names, survey numbers, door numbers and boundaries exactly as written, including punctuation such as 182/Part or 3-4-12/A.
- For identity documents, copy each value only from its printed label or address block. Never derive age from date of birth, map gender into occupation, or infer village/district/state from a PIN code.
- Aadhaar numbers are 12 digits; PAN is 10 characters. Do not "fix" a number that does not match — omit it instead.
- Dates: return YYYY-MM-DD. Indian documents usually write DD-MM-YYYY, so read the order carefully.
- Amounts: digits only, no rupee sign, commas or words.`;

export const EXTRACTION_PROMPTS: Record<DocKind, string> = {
  'link-deed':
    'This registered deed is being used as the link/title document for a new sale deed. A registered sale deed is a valid link deed for a later transaction, so do not reject it merely because it is itself a sale deed. Transcribe its particulars, including the link deed execution date shown in the opening recital on the first page (not the SRO registration/presentation date), the property it describes, its jurisdiction, extent, boundaries and valuation. For nearHNo, inspect the complete schedule/property description and return a value only when it explicitly identifies a nearby, adjacent or neighbouring H.No./door number as a landmark. Never copy the subject property house number into nearHNo. Do not extract party identity details here; those are read from the dedicated executant and claimant uploads.',
  'executant-id':
    'These are identity documents for the executant (vendor / first party) of a sale deed. Transcribe the party particulars. When an Aadhaar card or letter is shown, read its printed 12-digit Aadhaar number; do not substitute its VID or enrolment number.',
  'claimant-id':
    'These are identity documents for the claimant (purchaser / second party) of a sale deed. Transcribe the party particulars. When an Aadhaar card or letter is shown, read its printed 12-digit Aadhaar number; do not substitute its VID or enrolment number.',
  plan:
    'This is a property plan, survey sketch or related property record. Transcribe the property identification, extent and the four boundaries.',
  supporting:
    'This is one independent uploaded record: a house-tax receipt, electricity or water bill, NALA conversion order, pattadar passbook, building permit, pahani, municipal record or similar property evidence. Identify this record type and transcribe every requested value that is explicitly printed on this record only. Do not treat a passbook as an identity card. Do not infer missing property details from an account number or address.',
};

// ------------------------------------------------------------------ file → part

const base64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
};

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const pdf = await task.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => typeof item.str === 'string' ? item.str : '').filter(Boolean).join(' '));
    }
  } finally {
    await task.destroy();
  }
  return pages.join('\n');
}

/** Read a labelled/repeated Aadhaar number from selectable document text. */
export function aadhaarFromDocumentText(text: string): string | null {
  const candidates = [...text.matchAll(/(?:^|\D)([2-9]\d{3})[\s-]+(\d{4})[\s-]+(\d{4})(?![\s-]+\d{4})/g)]
    .map(match => ({ value: `${match[1]} ${match[2]} ${match[3]}`, index: match.index ?? 0 }));
  for (const candidate of candidates) {
    const repeats = candidates.filter(item => item.value === candidate.value).length;
    const nearby = text.slice(Math.max(0, candidate.index - 100), candidate.index).toLowerCase();
    if (repeats >= 2 || /aadhaar(?:\s+no\.?|\s+number)?\s*[:.-]?\s*$/.test(nearby)) return candidate.value;
  }
  return null;
}

/** The image types the Messages API accepts. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

/**
 * The API resizes anything larger than about 1568px on its long edge before the
 * model sees it, so sending a 12-megapixel phone photograph buys no accuracy —
 * it only spends seconds uploading. Shrink to exactly that threshold, which is
 * where accuracy stops improving and upload time starts dominating.
 */
const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.82;

async function shrinkImage(file: File, bytes: Uint8Array): Promise<{ mime: string; bytes: Uint8Array } | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const long = Math.max(bitmap.width, bitmap.height);
    if (long <= MAX_EDGE) {
      bitmap.close?.();
      return null;
    }
    const scale = MAX_EDGE / long;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // White ground: a transparent PNG would otherwise flatten to black.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= bytes.byteLength) return null;
    return { mime: 'image/jpeg', bytes: new Uint8Array(await blob.arrayBuffer()) };
  } catch {
    // A format the browser cannot decode is sent through as it is.
    return null;
  }
}

/**
 * Times one phase of a read and logs it, so a slow upload can be told apart
 * from a slow model at the console instead of by guesswork.
 */
async function timed<T>(what: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    console.info(`[extract] ${what} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}

/**
 * Claude reads images and PDFs natively as content blocks; .docx has no native
 * block type, so it is flattened to text locally using the zip reader in docx.ts.
 *
 * Everything is inlined as base64 rather than staged through the Files API:
 * uploading first would add a round trip before extraction could even begin,
 * and the wall-clock time to the drafter matters more than the token cost of
 * resending the same bytes to each parallel stage (see extractFrom below).
 */
export async function fileToPart(file: File, signal?: AbortSignal): Promise<Anthropic.ContentBlockParam> {
  stopIfCancelled(signal);
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (file.type === DOCX || name.endsWith('.docx')) {
    const text = await docxToText(bytes);
    if (!text.trim()) throw new Error('The Word document has no readable text.');
    return { type: 'text', text: `--- ${file.name} (Word document, text extracted) ---\n${text}` };
  }

  if (file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    return { type: 'text', text: `--- ${file.name} ---\n${new TextDecoder().decode(bytes)}` };
  }

  const mime =
    file.type ||
    (name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.png') ? 'image/png' : 'image/jpeg');

  if (mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64(bytes) } };
  }

  if (IMAGE_TYPES.includes(mime as any)) {
    const small = await shrinkImage(file, bytes);
    const outMime = (small?.mime ?? mime) as (typeof IMAGE_TYPES)[number];
    const outBytes = small?.bytes ?? bytes;
    return { type: 'image', source: { type: 'base64', media_type: outMime, data: base64(outBytes) } };
  }

  throw new Error(
    `${file.name}: ${mime || 'this file type'} cannot be read. Use a PDF, a JPEG/PNG/GIF/WebP image, or a .docx.`
  );
}

/**
 * Cheques are frequently photographed sideways. Supply rotated copies only to
 * payment reading so the model can inspect an upright leaf without guessing
 * from sideways text. Non-image documents keep their single native part.
 */
export async function fileToVisualParts(file: File): Promise<Anthropic.ContentBlockParam[]> {
  const primary = await fileToPart(file);
  if (primary.type !== 'image' || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return [primary];
  try {
    const bitmap = await createImageBitmap(file);
    const rotated: Anthropic.ContentBlockParam[] = [];
    for (const direction of [1, -1]) {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.height;
      canvas.height = bitmap.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(direction * Math.PI / 2);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
      if (blob) rotated.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64(new Uint8Array(await blob.arrayBuffer())) },
      });
    }
    bitmap.close?.();
    return [primary, ...rotated];
  } catch {
    return [primary];
  }
}

/** Add a high-resolution copy of a small identity-card photo for OCR. */
async function fileToIdentityParts(file: File, signal?: AbortSignal): Promise<Anthropic.ContentBlockParam[]> {
  const primary = await fileToPart(file, signal);
  if (primary.type === 'document') {
    try {
      const text = await pdfText(new Uint8Array(await file.arrayBuffer()));
      return text.trim() ? [primary, { type: 'text', text: `--- ${file.name} selectable PDF text ---\n${text}` }] : [primary];
    } catch {
      return [primary];
    }
  }
  if (primary.type !== 'image' || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return [primary];
  try {
    const bitmap = await createImageBitmap(file);
    const long = Math.max(bitmap.width, bitmap.height);
    if (long >= 1200) {
      bitmap.close?.();
      return [primary];
    }
    const scale = Math.min(3, MAX_EDGE / long);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return [primary];
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = 'contrast(1.18) saturate(0.85)';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    ctx.filter = 'grayscale(1) contrast(1.65)';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const grayscale: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96));
    // Aadhaar cards are often photographed front-and-back side by side. The
    // number is printed near the lower edge of each half; supply enlarged
    // lower-half crops so digit verification is not forced to read tiny text
    // from the whole photograph.
    const numberCrops: Blob[] = [];
    for (const half of [0, 1]) {
      const sx = Math.round((bitmap.width / 2) * half);
      const sy = Math.round(bitmap.height * 0.55);
      const sw = Math.round(bitmap.width / 2);
      const sh = Math.round(bitmap.height * 0.4);
      const crop = document.createElement('canvas');
      crop.width = 1200;
      crop.height = Math.max(260, Math.round((sh / sw) * crop.width));
      const cropCtx = crop.getContext('2d');
      if (!cropCtx) continue;
      cropCtx.fillStyle = '#FFFFFF';
      cropCtx.fillRect(0, 0, crop.width, crop.height);
      cropCtx.imageSmoothingEnabled = true;
      cropCtx.imageSmoothingQuality = 'high';
      cropCtx.filter = 'grayscale(1) contrast(1.7)';
      cropCtx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
      const cropBlob: Blob | null = await new Promise(resolve => crop.toBlob(resolve, 'image/jpeg', 0.97));
      if (cropBlob) numberCrops.push(cropBlob);
    }
    bitmap.close?.();
    if (!blob) return [primary];
    const enhanced: Anthropic.ContentBlockParam[] = [primary, {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64(new Uint8Array(await blob.arrayBuffer())) },
    }];
    if (grayscale) enhanced.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64(new Uint8Array(await grayscale.arrayBuffer())) },
    });
    for (const crop of numberCrops) enhanced.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64(new Uint8Array(await crop.arrayBuffer())) },
    });
    return enhanced;
  } catch {
    return [primary];
  }
}

/** Supply a sharper visual/text copy for small receipts, booklets and permits. */
async function fileToSupportingParts(file: File, signal?: AbortSignal): Promise<Anthropic.ContentBlockParam[]> {
  const primary = await fileToPart(file, signal);
  if (primary.type === 'document') {
    try {
      const text = await pdfText(new Uint8Array(await file.arrayBuffer()));
      return text.trim() ? [primary, { type: 'text', text: `--- ${file.name} selectable PDF text ---\n${text}` }] : [primary];
    } catch {
      return [primary];
    }
  }
  if (primary.type !== 'image' || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return [primary];
  try {
    const bitmap = await createImageBitmap(file);
    const long = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(2.2, 2400 / long);
    const renderRect = async (sx: number, sy: number, sw: number, sh: number, cropScale: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sw * cropScale));
      canvas.height = Math.max(1, Math.round(sh * cropScale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = 'contrast(1.25) saturate(0.78)';
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96));
    };
    const render = (sy: number, sh: number, cropScale: number) =>
      renderRect(0, sy, bitmap.width, sh, cropScale);
    const topHeight = Math.round(bitmap.height * 0.62);
    const identifierHeight = Math.round(bitmap.height * 0.35);
    const bottomY = Math.round(bitmap.height * 0.46);
    const bottomHeight = bitmap.height - bottomY;
    const cropScale = Math.min(2.5, 2200 / bitmap.width);
    const isHouseTax = /house\s*tax|property\s*tax/i.test(file.name);
    const receiptTop = isHouseTax
      ? renderRect(
          Math.round(bitmap.width * 0.08),
          Math.round(bitmap.height * 0.07),
          Math.round(bitmap.width * 0.72),
          Math.round(bitmap.height * 0.30),
          Math.min(3.6, 2400 / (bitmap.width * 0.72)),
        )
      : Promise.resolve(null);
    const receiptIdentifiers = isHouseTax
      ? renderRect(
          Math.round(bitmap.width * 0.10),
          Math.round(bitmap.height * 0.10),
          Math.round(bitmap.width * 0.62),
          Math.round(bitmap.height * 0.12),
          Math.min(4, 2600 / (bitmap.width * 0.62)),
        )
      : Promise.resolve(null);
    const assessmentOnly = isHouseTax
      ? renderRect(
          Math.round(bitmap.width * 0.10), Math.round(bitmap.height * 0.11),
          Math.round(bitmap.width * 0.27), Math.round(bitmap.height * 0.055),
          Math.min(8, 2200 / (bitmap.width * 0.27)),
        )
      : Promise.resolve(null);
    const dateOnly = isHouseTax
      ? renderRect(
          Math.round(bitmap.width * 0.47), Math.round(bitmap.height * 0.11),
          Math.round(bitmap.width * 0.24), Math.round(bitmap.height * 0.065),
          Math.min(8, 2000 / (bitmap.width * 0.24)),
        )
      : Promise.resolve(null);
    const houseOnly = isHouseTax
      ? renderRect(
          Math.round(bitmap.width * 0.17), Math.round(bitmap.height * 0.17),
          Math.round(bitmap.width * 0.42), Math.round(bitmap.height * 0.065),
          Math.min(7, 2200 / (bitmap.width * 0.42)),
        )
      : Promise.resolve(null);
    const blobs = await Promise.all([
      render(0, bitmap.height, scale),
      render(0, identifierHeight, cropScale),
      render(0, topHeight, cropScale),
      render(bottomY, bottomHeight, cropScale),
      receiptTop,
      receiptIdentifiers,
      assessmentOnly,
      dateOnly,
      houseOnly,
    ]);
    bitmap.close?.();
    const enhanced: Anthropic.ContentBlockParam[] = [primary];
    const cropLabels = [
      '', '', '', '',
      'Enlarged house-tax receipt header.',
      'Tight house-tax identifier strip.',
      'Assessment-only crop: read the value immediately following handwritten AST/ASST.',
      'Date-only crop: read only the underlined date at the upper right.',
      'House-number-only crop: read only the H.No. line below the owner name.',
    ];
    for (let index = 0; index < blobs.length; index++) {
      const blob = blobs[index];
      if (!blob) continue;
      if (cropLabels[index]) enhanced.push({ type: 'text', text: cropLabels[index] });
      enhanced.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64(new Uint8Array(await blob.arrayBuffer())) },
      });
    }
    return enhanced;
  } catch {
    return [primary];
  }
}

const CLASSIFY_SYSTEM = `You classify Indian property-registration documents. Read only what is visibly present. Do not guess a party role from a person's name alone.

Return link-deed for a prior registered title/conveyance document; plan for a layout plan or survey sketch; supporting for a tax receipt, electricity/water bill, NALA conversion order, passbook, pahani, municipal record or other property evidence; executant-id only when the document itself identifies the vendor/first party; claimant-id only when it identifies the purchaser/second party; payment for a cheque, DD, bank-transfer receipt, UPI receipt or cash receipt; otherwise unknown. If an Aadhaar or PAN does not establish whether its holder is vendor or purchaser, return unknown.

For property category, use Part open place when the schedule explicitly says "part open plot", "part open place" or equivalent. Use Vacant Plot only for a whole open/vacant plot, not a part. Omit category when the distinction is not explicit.`;

const CLASSIFY_SCHEMA = {
  type: 'object' as const,
  properties: {
    kind: { type: 'string' as const, description: 'One of link-deed, executant-id, claimant-id, plan, supporting, payment, unknown.' },
    paymentMode: { type: 'string' as const, description: 'For payment only: rtgs, cheque, dd, upi or cash. Otherwise omit.' },
    deedType: { type: 'string' as const, description: 'Return Sale only if this is clearly a sale-deed document. Otherwise omit.' },
    category: { type: 'string' as const, description: 'Property category when clearly shown: Vacant Plot, Agricultural land, Residential, Commercial, Flat, Demolished or Part open place. Otherwise omit.' },
    reason: { type: 'string' as const, description: 'A short description of visible evidence supporting the classification.' },
  },
  additionalProperties: false,
};

const BULK_KINDS: BulkKind[] = ['link-deed', 'executant-id', 'claimant-id', 'plan', 'supporting', 'payment', 'unknown'];
const PAY_MODES = ['rtgs', 'cheque', 'dd', 'upi', 'cash'] as const;
const CATEGORIES = ['Vacant Plot', 'Agricultural land', 'Residential', 'Commercial', 'Flat', 'Demolished', 'Part open place'];

/** Classify a single upload before extraction. Ambiguous identity documents stay unknown. */
export async function classifyFile(file: File, signal?: AbortSignal): Promise<BulkClassification> {
  try {
    const part = await fileToPart(file, signal);
    const ai = getClient();
    const read = (instruction: string) => ai.messages.parse(
      {
        model: EXTRACT_MODEL,
        max_tokens: 500,
        system: CLASSIFY_SYSTEM,
        messages: [{ role: 'user', content: [part, { type: 'text', text: instruction }] }],
        output_config: { format: jsonSchemaOutputFormat(CLASSIFY_SCHEMA) },
      },
      { signal }
    );
    const [a, b, c] = await Promise.all([
      read('Classify this one uploaded document from visible evidence only.'),
      read('Independently classify the document again. Do not infer party role or property category.'),
      read('Tie-break verification: classify the document and inspect the property schedule wording closely. "Part open plot/place" means Part open place, not Vacant Plot.'),
    ]);
    const first = (a.parsed_output ?? {}) as Record<string, unknown>;
    const second = (b.parsed_output ?? {}) as Record<string, unknown>;
    const third = (c.parsed_output ?? {}) as Record<string, unknown>;
    const majority = (items: string[]) => {
      const clean = items.filter(Boolean);
      return clean.find(value => clean.filter(item => item === value).length >= 2) ?? '';
    };
    const rawKind = majority([first.kind, second.kind, third.kind].map(value => String(value ?? '').toLowerCase())) as BulkKind;
    const kind = BULK_KINDS.includes(rawKind) ? rawKind : 'unknown';
    const rawMode = majority([first.paymentMode, second.paymentMode, third.paymentMode].map(value => String(value ?? '').toLowerCase()));
    const paymentMode = kind === 'payment' && PAY_MODES.includes(rawMode as any)
      ? rawMode as BulkClassification['paymentMode'] : null;
    const rawCategory = majority([first.category, second.category, third.category].map(value => String(value ?? '').trim()));
    const category = CATEGORIES.includes(rawCategory) ? rawCategory : null;
    const saleVotes = [first.deedType, second.deedType, third.deedType]
      .filter(value => String(value ?? '').toLowerCase() === 'sale').length;
    return {
      kind,
      paymentMode,
      deedType: saleVotes >= 2 ? 'Sale' : null,
      category,
      reason: [first.reason, second.reason, third.reason].filter(Boolean).map(String).map(s => s.trim()).filter(Boolean).join(' / ') || 'No reliable classification evidence was returned.',
    };
  } catch (e) {
    throw readableError(e);
  }
}

// ------------------------------------------------------------------ normalizing

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Coerce a model-supplied string into what the field's input expects, or drop it. */
export function normalize(f: Field, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let v = String(raw).replace(/\s+/g, ' ').trim();
  if (!v || /^(n\/?a|nil|none|null|unknown|not (available|mentioned|stated|found))$/i.test(v)) return null;
  if (!/[\p{L}\p{N}]/u.test(v)) return null;

  if (/^(executant|claimant)Name$/.test(f.id) && /^(male|female|transgender|address|aadhaar|uidai)$/i.test(v)) return null;
  if (/RelativeName$/.test(f.id)) {
    // The relation prefix is its own field now; strip a stray one the model
    // still included, and reject a value that turns out to be nothing else.
    const withoutLabel = v.replace(/^\s*(?:s\s*\/?\s*o|w\s*\/?\s*o|d\s*\/?\s*o|c\s*\/?\s*o)\s*[:.-]?\s*/i, '').trim();
    if (!withoutLabel || !/\p{L}/u.test(withoutLabel)) return null;
    v = withoutLabel;
  }
  if (/Occupation$/.test(f.id) && /^(male|female|transgender|m|f)$/i.test(v)) return null;
  if (/Mobile$/.test(f.id)) {
    const digits = v.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    return /^\d{10}$/.test(digits) ? digits : null;
  }
  if (/PinCode$/.test(f.id)) {
    const digits = v.replace(/\D/g, '');
    return /^\d{6}$/.test(digits) ? digits : null;
  }
  if (/HNo$/.test(f.id) && /^(executant|claimant)/.test(f.id) && !/\d/.test(v)) return null;
  if (/Locality$/.test(f.id) && /^(?:telangana|andhra pradesh)\s*[-–,:]?\s*\d{6}$/i.test(v)) return null;

  if (f.id === 'supportingHouseNo') {
    if (!/\d/.test(v)) return null;
    // A handwritten receipt date is often near the H.No. line. Never accept
    // an unlabelled DD/MM/YY value as the premises number.
    if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(v)) return null;
  }
  if (f.id === 'supportingAssessmentNo') {
    const clean = v.replace(/^(?:ast|asst|assessment(?:\s+no\.?)?|ptin)\s*[:.-]?\s*/i, '').replace(/\s/g, '');
    return /^\d{5,15}$/.test(clean) ? clean : null;
  }
  if (f.id === 'supportingPassbookNo') {
    const clean = v.replace(/\s/g, '').toUpperCase();
    return /^[A-Z]\d{8,15}$/.test(clean) ? clean : null;
  }
  if (f.id === 'supportingKhataNo') {
    const clean = v.replace(/\D/g, '');
    return /^\d{2,15}$/.test(clean) ? clean : null;
  }
  if (f.id === 'supportingElectricityScNo') {
    const digits = v.replace(/\D/g, '');
    return /^\d{10}$/.test(digits) ? `${digits.slice(0, 5)} ${digits.slice(5)}` : null;
  }
  if (f.id === 'supportingElectricityUscNo') {
    const digits = v.replace(/\D/g, '');
    return /^\d{8,16}$/.test(digits) ? digits : null;
  }
  if (f.id === 'supportingExtent' && /^(?:\d+[-/]){2,}\d+$/.test(v.replace(/\s/g, ''))) return null;

  if (f.type === 'number' || f.type === 'money') {
    const n = v.replace(/[₹,\s]/g, '').replace(/\/-$/, '');
    if (!/^-?\d+(\.\d+)?$/.test(n)) return null;
    return n;
  }

  if (f.type === 'date') {
    if (ISO.test(v)) return v;
    const dmy = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const parsed = new Date(v);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  if (f.options) {
    const hit = f.options.find(o => o.toLowerCase() === v.toLowerCase());
    if (hit) return hit;
    const loose = f.options.find(o => v.toLowerCase().includes(o.toLowerCase()));
    return loose ?? null;
  }

  // Guard the two identity formats the deed relies on.
  if (/aadhaar/i.test(f.id)) {
    const digits = v.replace(/\D/g, '');
    return digits.length === 12 ? digits.replace(/(\d{4})(?=\d)/g, '$1 ') : null;
  }
  if (/pan$/i.test(f.id)) {
    const pan = v.replace(/\s/g, '').toUpperCase();
    return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan) ? pan : null;
  }

  return v;
}

/** A filename may safely classify a record type, but never supplies its facts. */
export function supportingDocumentTypeFromFilename(name: string): string | null {
  const lower = name.toLowerCase();
  if (/\bppb\b|pass\s*book|pattadar/.test(lower)) return 'Pattadar Passbook';
  if (/\bnala\b/.test(lower)) return 'NALA Conversion Order';
  if (/house\s*tax|property\s*tax/.test(lower)) return 'House Tax Receipt';
  if (/electric/.test(lower)) return 'Electricity Bill';
  if (/permit|permission/.test(lower)) return 'Building Permit Order';
  return null;
}

/** Limit a known record to fields that its document type can actually carry. */
export function supportingStagesForFilename(name: string): Stage[] {
  const type = supportingDocumentTypeFromFilename(name)?.toLowerCase() || '';
  const identity = STAGES.supporting[0];
  if (/house|property.*tax|tax.*receipt/.test(type)) {
    return [identity, { ...STAGES.supporting[1], ids: ['supportingAssessmentNo', 'supportingHouseNo'] }];
  }
  if (/pattadar|passbook/.test(type)) {
    return [identity, { ...STAGES.supporting[1], ids: ['supportingPassbookNo', 'supportingKhataNo'] }];
  }
  if (/nala|conversion/.test(type)) {
    return [identity, { ...STAGES.supporting[2], ids: ['supportingNalaOrderNo', 'supportingSurveyNo', 'supportingExtent'] }];
  }
  if (/permit|permission/.test(type)) {
    return [identity, { ...STAGES.supporting[2], ids: ['supportingHouseNo', 'supportingPermitNo', 'supportingSurveyNo', 'supportingPlotNo', 'supportingExtent'] }];
  }
  if (/electric/.test(type)) {
    return [identity, { ...STAGES.supporting[3], ids: ['supportingElectricityScNo', 'supportingElectricityUscNo', 'supportingDetails'] }];
  }
  return STAGES.supporting;
}

function supportingCriticalFields(type: string): string[] {
  const lower = type.toLowerCase();
  if (/house|property.*tax|tax.*receipt/.test(lower)) return ['supportingDate', 'supportingAssessmentNo', 'supportingHouseNo'];
  if (/pattadar|passbook/.test(lower)) return ['supportingPassbookNo', 'supportingKhataNo'];
  if (/nala|conversion/.test(lower)) return ['supportingHolder', 'supportingNalaOrderNo', 'supportingSurveyNo', 'supportingExtent'];
  if (/permit|permission/.test(lower)) return ['supportingHouseNo', 'supportingPermitNo', 'supportingSurveyNo', 'supportingPlotNo', 'supportingExtent'];
  if (/electric/.test(lower)) return ['supportingElectricityScNo', 'supportingElectricityUscNo'];
  return [];
}

function supportingCriticalInstruction(type: string): string {
  const lower = type.toLowerCase();
  if (/house|property.*tax|tax.*receipt/.test(lower)) {
    return 'Focused house-tax identifier check: inspect the tight enlarged crop of the receipt header. Assessment No. must be beside AST/ASST/Assessment/PTIN. House No. must be beside H.No./House No. Date must be beside the handwritten date label and interpreted DD/MM/YY. Do not use demand number, receipt number or amount for any of these fields.';
  }
  if (/pattadar|passbook/.test(lower)) {
    return 'Focused pattadar-passbook check: read only the passbook number beside the passbook label/barcode and the khata number beside Khata No. Do not treat this green booklet as an identity card.';
  }
  if (/nala|conversion/.test(lower)) {
    return 'Focused NALA check: the person printed after Present is the presiding officer and is never the property holder. Return holder only when explicitly labelled applicant, owner or pattadar. Separately copy Procdgs./Order No., survey number and extent from their printed labels or schedule.';
  }
  if (/permit|permission/.test(lower)) {
    return 'Focused building-permit SITE DETAILS check: House No. comes only from the site/property table, never from the applicant residential address. If the site table says House No. NA, omit it. Extent means the Site Area/Plot Area in the SITE DETAILS table, never the built-up, plinth or floor area. Copy the permit/file number, survey number, plot number and site extent from their labelled fields.';
  }
  return 'Focused electricity-account check: copy the complete SC No. and USC No. only from their labelled lines.';
}

const canonical = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Keep a document field only when two independent visual reads agree. */
export function agreeFieldReads(
  kind: DocKind,
  ids: string[],
  first: Record<string, unknown>,
  second: Record<string, unknown>,
): { values: Record<string, string>; rejected: string[] } {
  const values: Record<string, string> = {};
  const rejected: string[] = [];
  for (const id of ids) {
    const f = field(id);
    if (!f || f.derived) continue;
    const a = normalize(f, first[id]);
    const b = normalize(f, second[id]);
    if (a && b && canonical(a) === canonical(b)) values[id] = a;
    else if (a || b) rejected.push(id);
  }
  return { values, rejected };
}

/** Resolve OCR variation by requiring the same normalized value in 2 of 3 reads. */
export function majorityFieldReads(
  kind: DocKind,
  ids: string[],
  reads: Record<string, unknown>[],
): { values: Record<string, string>; rejected: string[] } {
  const values: Record<string, string> = {};
  const rejected: string[] = [];
  for (const id of ids) {
    const f = field(id);
    if (!f || f.derived) continue;
    const candidates = reads.map(read => normalize(f, read[id])).filter((value): value is string => !!value);
    const threshold = Math.floor(reads.length / 2) + 1;
    const winner = candidates.find(value => candidates.filter(item => canonical(item) === canonical(value)).length >= threshold);
    if (winner) values[id] = winner;
    else if (candidates.length) rejected.push(id);
  }
  return { values, rejected };
}

/** Parse a literal Aadhaar address line without geocoding or PIN lookup. */
export function parseIdentityAddress(text: string, side: 'executant' | 'claimant'): Record<string, string> {
  const out: Record<string, string> = {};
  const clean = text.replace(/^.*?address\s*:\s*/i, '').replace(/\s+/g, ' ').trim();
  if (!clean) return out;
  const parts = clean.split(/\s*,\s*/).map(part => part.trim()).filter(Boolean);
  const key = (suffix: string) => `${side}${suffix}`;

  const relationIndex = parts.findIndex(part => /^(?:s|w|d|c)\s*\/?\s*o\s*[:.-]?/i.test(part));
  if (relationIndex >= 0) {
    const relation = parts[relationIndex].replace(/^((?:s|w|d|c)\s*\/?\s*o)\s*[:.-]?\s*/i, (_, label) => `${String(label).replace(/\s+/g, '').toUpperCase()} `).trim();
    if (relation && !/^(?:S|W|D|C)\/O$/i.test(relation)) out[key('RelationName')] = relation;
  }

  const pinIndex = parts.findIndex(part => /\b\d{6}\b/.test(part));
  if (pinIndex >= 0) {
    const pin = parts[pinIndex].match(/\b\d{6}\b/)?.[0];
    if (pin) out[key('PinCode')] = pin;
    const state = parts[pinIndex].replace(/[-–,:]?\s*\d{6}.*$/, '').trim();
    if (/^(?:Telangana|Andhra Pradesh)$/i.test(state)) out[key('State')] = state.replace(/\b\w/g, letter => letter.toUpperCase());
  }

  const houseIndex = parts.findIndex((part, index) => index !== pinIndex && /\d+(?:[-\/]\w+){1,}/.test(part));
  if (houseIndex >= 0) out[key('HNo')] = parts[houseIndex].replace(/^(?:h\.?\s*no\.?|house\s*no\.?)\s*[:.-]?\s*/i, '').trim();

  const beforeState = pinIndex >= 0 ? parts.slice(0, pinIndex) : parts;
  const explicit = (pattern: RegExp) => beforeState.find(part => pattern.test(part));
  const village = explicit(/^(?:village|v\.?)[\s:.-]/i);
  const mandal = explicit(/^(?:mandal|m\.?|taluk|tehsil)[\s:.-]/i);
  const district = explicit(/^(?:district|dist\.?)[\s:.-]/i);
  const strip = (value: string, pattern: RegExp) => value.replace(pattern, '').trim();
  if (village) out[key('Village')] = strip(village, /^(?:village|v\.?)\s*[:.-]?\s*/i);
  if (mandal) out[key('Mandal')] = strip(mandal, /^(?:mandal|m\.?|taluk|tehsil)\s*[:.-]?\s*/i);
  if (district) out[key('District')] = strip(district, /^(?:district|dist\.?)\s*[:.-]?\s*/i);

  // Aadhaar commonly prints unlabelled locality, town/village, district,
  // state+PIN in that order. Use only that printed order; never infer a place.
  const unlabeled = beforeState.filter((_, index) => index !== relationIndex && index !== houseIndex)
    .filter(part => !/^(?:village|v\.?|mandal|m\.?|taluk|tehsil|district|dist\.?)[\s:.-]/i.test(part));
  if (unlabeled.length >= 3) {
    if (!district) out[key('District')] = unlabeled[unlabeled.length - 1];
    if (!village) out[key('Village')] = unlabeled[unlabeled.length - 2];
    out[key('Locality')] = unlabeled.slice(0, -2).join(', ');
  } else if (unlabeled.length === 2) {
    // Low-resolution cards sometimes lose the comma between town and a
    // two-word district. Preserve the first address component as locality and
    // split only the final printed phrase into town + its final two words.
    out[key('Locality')] = unlabeled[0];
    const hierarchy = unlabeled[1].split(/\s+/).filter(Boolean);
    if (hierarchy.length >= 3) {
      if (!village) out[key('Village')] = hierarchy.slice(0, -2).join(' ');
      if (!district) out[key('District')] = hierarchy.slice(-2).join(' ');
    } else {
      if (!district) out[key('District')] = unlabeled[1];
    }
  } else if (unlabeled.length === 1 && !district) {
    out[key('District')] = unlabeled[0];
  }
  return out;
}

// --------------------------------------------------------------------- the call

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Thrown when the drafter presses Cancel. The UI shows no error for it. */
export const CANCELLED = 'cancelled';
export const isCancel = (e: any) =>
  e?.name === 'AbortError' || String(e?.message ?? e) === CANCELLED;

const stopIfCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new Error(CANCELLED);
};

/**
 * The SDK already retries 429s and 5xx twice on its own. This wrapper adds one
 * longer retry for an overloaded_error, and tells the UI it is waiting.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  onWait?: (s: number) => void,
  signal?: AbortSignal
): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (isCancel(e)) throw new Error(CANCELLED);
    const overloaded = e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503);
    if (!overloaded) throw readableError(e);
    onWait?.(RETRY_WAIT);
    await sleep(RETRY_WAIT * 1000);
    stopIfCancelled(signal);
    try {
      return await fn();
    } catch (again) {
      if (isCancel(again)) throw new Error(CANCELLED);
      throw readableError(again);
    }
  }
}

/** How long to sit out an overloaded API before the one extra try. */
const RETRY_WAIT = 3;

export type Extraction = {
  values: Record<string, string>;
  /** Why nothing (or little) came back, when the model says so. */
  unreadable: string;
};

/** What the UI is told while a document is being read. */
export type Progress = {
  /** 0-based index of the pass now running. */
  index: number;
  total: number;
  title: string;
  phase: 'reading' | 'done' | 'waiting';
  /** Fields this pass returned, once it is done. */
  filled?: number;
  /** Set while `withRetry` is sitting out an overloaded API. */
  waitSeconds?: number;
};

// `withRetry` wraps API failures in a plain Error, so match on the text rather
// than on the error class.
const complexSchema = (e: any) => /schema is too complex/i.test(String(e?.message ?? e));

/**
 * One pass over the document for one group of fields.
 *
 * If the API still calls the schema too complex, the group is halved and each
 * half read on its own, so a large field group degrades into more calls rather
 * than into a failed upload.
 */
async function readFields(
  kind: DocKind,
  ids: string[],
  parts: Anthropic.ContentBlockParam[],
  onWait?: (s: number) => void,
  signal?: AbortSignal,
  instruction = '',
): Promise<Record<string, unknown>> {
  stopIfCancelled(signal);
  const prompt = [
    EXTRACTION_PROMPTS[kind],
    instruction,
    'Fill only the fields in the response schema. Omit any the document does not state.',
  ].filter(Boolean).join(' ');

  try {
    const ai = getClient();
    const message = await withRetry(
      () =>
        ai.messages.parse(
          {
            model: EXTRACT_MODEL,
            max_tokens: 2000,
            system: SYSTEM,
            messages: [{ role: 'user', content: [...parts, { type: 'text', text: prompt }] }],
            output_config: { format: jsonSchemaOutputFormat(schemaForIds(ids, kind)) },
          },
          { signal }
        ),
      onWait,
      signal
    );
    if (message.stop_reason === 'refusal') {
      throw new Error('The model declined to read this document.');
    }
    return (message.parsed_output ?? {}) as Record<string, unknown>;
  } catch (e: any) {
    if (complexSchema(e) && ids.length > 1) {
      const half = Math.ceil(ids.length / 2);
      const [a, b] = await Promise.all([
        readFields(kind, ids.slice(0, half), parts, onWait, signal, instruction),
        readFields(kind, ids.slice(half), parts, onWait, signal, instruction),
      ]);
      return { ...a, ...b };
    }
    throw e;
  }
}

/**
 * Read `files` as a document of `kind` and return the field values found.
 *
 * The read runs as several small passes (STAGES) rather than one call over
 * every field: the Messages API rejects a structured-output schema that covers
 * the whole field list with "Schema is too complex". `onProgress` reports each
 * pass so the UI can show what is happening.
 */
export async function extractFrom(
  kind: DocKind,
  files: File[],
  onProgress?: (p: Progress) => void,
  signal?: AbortSignal
): Promise<Extraction> {
  // Files are prepared together: shrinking a photograph and uploading a PDF are
  // independent, and a two-file upload should not pay for both in turn.
  const parts = await timed('prepare files', async () => {
    const grouped = await Promise.all(files.map(f =>
      kind === 'executant-id' || kind === 'claimant-id'
        ? fileToIdentityParts(f, signal)
        : kind === 'supporting'
        ? fileToSupportingParts(f, signal)
        : fileToPart(f, signal).then(part => [part])
    ));
    return grouped.flat();
  });
  if (kind === 'supporting' && files.length === 1) {
    const sourceName = files[0].name;
    const lower = sourceName.toLowerCase();
    const typeHint = /\bppb\b|pass\s*book|pattadar/.test(lower)
      ? 'The filename identifies a pattadar passbook. Confirm it from the green Telangana booklet, the holder photo, the passbook-number barcode and the khata-number label; do not reject it as a voter/identity card merely because it contains a photo.'
      : /nala/.test(lower)
      ? 'The filename identifies a NALA order. Read its Procdgs. No., Dated label and bottom Schedule table carefully.'
      : /house\s*tax|property\s*tax/.test(lower)
      ? 'The filename identifies a house-tax receipt. Distinguish the AST/assessment number from Demand No., H.No. and payment amount.'
      : /electric/.test(lower)
      ? 'The filename identifies an electricity bill. Read the complete SC No. and USC No. lines.'
      : /permit|permission/.test(lower)
      ? 'The filename identifies a building permit/permission. Read the FILE/PERMIT No. and the SITE DETAILS table.'
      : '';
    parts.push({
      type: 'text',
      text: `Source filename: ${sourceName}. ${typeHint} Use the filename only as a document-type hint; never derive any field value from it.`,
    });
  }
  stopIfCancelled(signal);
  // Cacheable so a second upload of the same document skips re-reading it.
  const last = parts[parts.length - 1];
  if (last) (last as any).cache_control = { type: 'ephemeral' };

  const stages = kind === 'supporting' && files.length === 1
    ? supportingStagesForFilename(files[0].name)
    : STAGES[kind];
  const parsed: Record<string, unknown> = {};
  const notes: string[] = [];

  const runStage = async (stage: Stage, index: number) => {
    const base = { index, total: stages.length, title: stage.title };
    onProgress?.({ ...base, phase: 'reading' });

    const out = await timed(`pass ${index + 1}/${stages.length} ${stage.title}`, async () => {
      const wait = (secs: number) => onProgress?.({ ...base, phase: 'waiting', waitSeconds: secs });
      const focus = kind === 'link-deed' && stage.title === 'Document & registration'
        ? 'Identify this uploaded deed itself. Read its own registered document number and year from the registration endorsement/margin/certificate, not an older deed number in the title recital. Read its execution date only from the opening execution sentence.'
        : kind === 'link-deed' && stage.title === 'Property & extent'
        ? 'Inspect the complete property schedule. Preserve separately printed square-yard and square-metre figures exactly, even if their arithmetic conversion appears inconsistent.'
        : kind === 'link-deed' && stage.title === 'Boundaries'
        ? 'Copy each of the four boundary lines from the property schedule exactly and do not swap directions.'
        : kind === 'plan'
        ? 'Read only visible handwriting or print. A dimension such as 30 feet is not a plot number or house number.'
        : kind === 'supporting' && stage.title === 'Record identity'
        ? 'Identify the document from its printed heading and issuing authority. Copy only the date, authority and recorded holder or consumer visibly printed on this one document.'
        : kind === 'supporting' && stage.title === 'Tax & passbook'
        ? 'For a house-tax receipt, copy the assessment number and premises H.No. For a pattadar passbook, copy the passbook number and khata number. These identifiers are different; never move one into another field.'
        : kind === 'supporting' && stage.title === 'Permissions'
        ? 'For a NALA order, copy the proceedings/order number separately from its survey number and extent. For a building permit, copy the permit/file number, survey number, plot number and sanctioned site extent exactly as printed.'
        : kind === 'supporting' && stage.title === 'Utilities & particulars'
        ? 'For an electricity bill, copy SC No. and USC No. separately. Use Other visibly printed particulars only for a concise factual property detail that is printed but has no dedicated field.'
        : (kind === 'executant-id' || kind === 'claimant-id') && /particulars/.test(stage.title.toLowerCase())
        ? 'The same identity card may appear twice, with the second image enlarged for OCR. Inspect the front and back. Copy the English holder name exactly; when a supported field is only in Telugu, return a clear English translation or faithful English transliteration in the field value, while preserving the original Telugu wording in the evidence quote. RelationName must include both S/O, W/O or D/O and the printed related-person name. Aadhaar DOB uses DD/MM/YYYY: 12/05/1996 means 12 May 1996 and must be 1996-05-12. Do not turn gender into occupation or calculate age.'
        : (kind === 'executant-id' || kind === 'claimant-id') && /address/.test(stage.title.toLowerCase())
        ? 'Copy only the literal printed address block, line by line. Do not geocode the PIN or substitute another village, mandal or district.'
        : '';
      const instructions = [
        `${focus} First visual transcription. Do not calculate or infer any value.`,
        `${focus} Independent verification. Read the document again character-for-character. Omit anything not literally visible.`,
        `${focus} Tie-break transcription. Re-inspect each requested field and omit it unless its characters are visibly supported.`,
      ];
      if ((kind === 'executant-id' || kind === 'claimant-id') && /aadhaar verification/i.test(stage.title)) {
        instructions.push(
          `${focus} Aadhaar digit check four. Read only the 12 large printed digits, group them 4-4-4, and ignore VID or enrolment numbers.`,
          `${focus} Aadhaar digit check five. Zoom into the Aadhaar number and copy all 12 digits independently; omit it if any digit is hidden.`,
        );
      }
      if (kind === 'supporting' && /record identity|tax & passbook|permissions/i.test(stage.title)) {
        instructions.push(
          `${focus} Fourth verification read. Use the enlarged crops and copy labels and characters exactly; do not move a number into a merely similar field.`,
          `${focus} Fifth verification read. Recheck the printed label beside every returned identifier and date. Omit a value unless this exact document supports it.`,
        );
      }
      const reads = await Promise.all(instructions.map(instruction =>
        readFields(kind, stage.ids, parts, wait, signal, instruction)
      ));
      if (kind === 'executant-id' || kind === 'claimant-id') {
        const side = kind === 'executant-id' ? 'executant' : 'claimant';
        const addressSuffixes = ['RelationName', 'HNo', 'Locality', 'Village', 'Mandal', 'District', 'State', 'PinCode'];
        for (const read of reads) {
          const parsedAddress = parseIdentityAddress(String(read._addressText ?? ''), side);
          for (const suffix of addressSuffixes) {
            const id = `${side}${suffix}`;
            if (!stage.ids.includes(id)) continue;
            delete read[id];
            if (parsedAddress[id]) read[id] = parsedAddress[id];
          }
        }
      }
      const agreed = majorityFieldReads(kind, stage.ids, reads);
      if (agreed.rejected.length) notes.push(`Could not independently verify ${agreed.rejected.map(id => field(id)?.label ?? id).join(', ')}; those fields were left blank.`);
      for (const note of reads.map(read => read._unreadable).filter(Boolean).map(String).map(s => s.trim())) {
        if (note && !notes.includes(note)) notes.push(note);
      }
      return agreed.values;
    });

    let filled = 0;
    for (const id of stage.ids) {
      const f = field(id);
      if (!f || f.derived) continue;
      const clean = normalize(f, out[id]);
      if (clean !== null) {
        parsed[id] = clean;
        filled++;
      }
    }
    const note = String(out._unreadable ?? '').trim();
    if (note && !notes.includes(note)) notes.push(note);

    onProgress?.({ ...base, phase: 'done', filled });
  };

  // Every pass runs at once. Serializing the first one to warm the prompt cache
  // saved tokens but cost a whole extra round trip, and the wall-clock time the
  // drafter waits is what matters here: all passes together is one round trip.
  await timed('all passes', () => Promise.all(stages.map(runStage)));

  if (kind === 'executant-id' || kind === 'claimant-id') {
    const id = kind === 'executant-id' ? 'executantAadhaar' : 'claimantAadhaar';
    if (!parsed[id]) {
      const searchableText = parts.filter((part: any) => part.type === 'text').map((part: any) => String(part.text || '')).join('\n');
      const fromText = aadhaarFromDocumentText(searchableText);
      if (fromText) parsed[id] = fromText;
    }
  }

  // The two fields most often missed in a scanned link deed are visually
  // verified in dedicated passes over the opening recital and property
  // schedule. A value from the broad pass is cleared unless both focused
  // reads agree; a value found only by both focused reads is added.
  if (kind === 'link-deed') {
    const critical = ['linkDocNo', 'linkDocDate', 'nearHNo'];
    const [first, second] = await Promise.all([
      readFields(kind, critical, parts, undefined, signal, 'Focused verification: the uploaded deed number is printed on the presentation/registration endorsement, often beside the words Doct No.; include its year and do not use the older title recital number or U/R number. Inspect the opening recital for execution date and the complete schedule for wording such as "situated at near H.No."; that explicit phrase is nearHNo.'),
      readFields(kind, critical, parts, undefined, signal, 'Independent focused verification: read this uploaded deed\'s own Doct No. and year from its registration endorsement, not any earlier registered sale deed number in the recitals. Re-read the opening execution sentence and property schedule. An H.No. introduced by "near H.No." is an adjacent landmark, not the subject plot number.'),
    ]);
    const agreed = agreeFieldReads(kind, critical, first, second);
    for (const id of critical) {
      if (agreed.values[id]) parsed[id] = agreed.values[id];
      else if (parsed[id]) {
        delete parsed[id];
        if (!agreed.rejected.includes(id)) agreed.rejected.push(id);
      }
    }
    if (agreed.rejected.length) notes.push(`Could not independently verify ${agreed.rejected.map(id => field(id)?.label ?? id).join(', ')}; those fields were left blank.`);

    // Official registrar downloads encode the uploaded deed's own number in
    // Book-Year-DocumentNo.pdf. This source metadata is more reliable than a
    // blurred vertical margin digit and cannot be confused with an older deed
    // number inside the recitals.
    if (files.length === 1) {
      const fromFilename = linkDocumentNumberFromFilename(files[0].name);
      if (fromFilename) parsed.linkDocNo = fromFilename;
    }
  }

  if (kind === 'supporting' && files.length === 1) {
    // Classifying the record from an explicit filename is safe metadata; the
    // filename is never used for a legal identifier, date, person or extent.
    const filenameType = supportingDocumentTypeFromFilename(files[0].name);
    if (filenameType) parsed.supportingDocType = filenameType;
    const type = String(parsed.supportingDocType || '');
    const critical = supportingCriticalFields(type);
    if (critical.length) {
      const focus = supportingCriticalInstruction(type);
      let agreed: { values: Record<string, string>; rejected: string[] };
      if (/house|property.*tax|tax.*receipt/i.test(type)) {
        const verified = await Promise.all(critical.map(async id => {
          const position = id === 'supportingAssessmentNo'
            ? 'Use the image explicitly labelled Assessment-only crop. Read only the handwritten value immediately following AST/ASST at the upper left.'
            : id === 'supportingHouseNo'
            ? 'Use the image explicitly labelled House-number-only crop. Read only the value on the H.No. line immediately below the owner name. It may contain hyphens and a slash; do not use the date.'
            : 'Use the image explicitly labelled Date-only crop. Read only the underlined date at the upper right beside the date label. Do not use the H.No.';
          const [first, second] = await Promise.all([
            readFields(kind, [id], parts, undefined, signal, `${focus} ${position} First dedicated read.`),
            readFields(kind, [id], parts, undefined, signal, `${focus} ${position} Independent dedicated read.`),
          ]);
          return agreeFieldReads(kind, [id], first, second);
        }));
        agreed = {
          values: Object.assign({}, ...verified.map(result => result.values)),
          rejected: verified.flatMap(result => result.rejected),
        };
      } else {
        const [first, second] = await Promise.all([
          readFields(kind, critical, parts, undefined, signal, `${focus} First dedicated verification. Omit every unsupported field.`),
          readFields(kind, critical, parts, undefined, signal, `${focus} Independent dedicated verification. Re-read labels and characters; do not infer.`),
        ]);
        agreed = agreeFieldReads(kind, critical, first, second);
      }
      for (const id of critical) {
        if (agreed.values[id]) parsed[id] = agreed.values[id];
        else delete parsed[id];
      }
      if (agreed.rejected.length) {
        notes.push(`Could not independently verify ${agreed.rejected.map(id => field(id)?.label ?? id).join(', ')}; those supporting-record fields were left blank.`);
      }
    }
  }

  const filteredNotes = notes.filter(note => !(
    (parsed.linkDocDate && /(?:link deed )?execution date[^.]*cannot (?:be )?(?:determined|read|found)/i.test(note)) ||
    (parsed.linkDocNo && /document number[^.]*could not independently verify/i.test(note)) ||
    (parsed.nearHNo && /(?:nearby house number|nearhno)/i.test(note)) ||
    (kind === 'link-deed' && /not an identity document/i.test(note)) ||
    ((parsed.executantAadhaar || parsed.claimantAadhaar) && /aadhaar number/i.test(note))
  ));

  return { values: parsed as Record<string, string>, unreadable: filteredNotes.join(' ') };
}
