import { partyWording } from './party-wording';
import { municipalCouncilRecital } from './municipal-gift';
import { partyPronouns } from './party-pronouns';
import { giftPartyWording } from './gift-wording';
import { regularGiftSourcePolicy } from './gift-template-policy';
import { DEED_PRESERVATION_VERSION, preservationProfileFor, protectedSourceWording, type PreservationProfile } from './deed-preservation';
import type { InstrumentId } from './instruments';
// Fills the Sale Deed template and re-zips it, so the generated file is a real
// .docx carrying the template's own fonts, spacing, tables and annexures —
// not a rebuilt approximation of them.
//
// Two things make this more than a string replace:
//   1. Word splits text across <w:r> runs at arbitrary points, so a placeholder
//      like <Extent in Sq.yards> is usually spread over several runs. Only 58 of
//      the template's 145 placeholders sit inside a single run. So each paragraph
//      is merged, substituted, then written back into its first run.
//   2. The template carries all five SCHEDULE OF PROPERTY variants, marked
//      <IF OPEN PLACE>, <IF OPEN PLOT>, <IF HOUSE>, <IF FLAT>,
//      <IF DIMOLISHED HOUSE> and <IF PART OPEN PLACE>.
//      The variant the property category selects is kept; the rest are removed.

import { loadSaleDeedTemplate, loadTemplate } from './template';
import { releaseGate } from './legal-registry';
import { titleAmendmentValues, type TitleAmendmentKind } from './title-amendments';
import { ALL_FIELDS, STRUCTURE_TYPE_OPTIONS, type StructureDetails } from './fields';
import { flatVariant } from './flat-options';
import { loadLibraryBytes } from './template-library-client';
import type { TemplatePin } from './template-library-types';
import { EMPTY_FIELD_CONTRACT, fieldName, type TemplateFieldContract, type BindingCatalogItem, type PlaceholderOccurrence, type TemplateFieldInspection } from './template-fields';

const VARIANTS = ['IF OPEN PLACE', 'IF OPEN PLOT', 'IF HOUSE', 'IF FLAT', 'IF DIMOLISHED HOUSE', 'IF PART OPEN PLACE'];
const FLAT_VARIANTS = ['IF FLAT SEMI FINISHED', 'IF FLAT FINISHED'];
const ALL_VARIANTS = [...VARIANTS, 'IF HOUSE SEMI FINISHED', ...FLAT_VARIANTS];
const OPERATIVE_CLAUSE_MARKERS = ['IF VACANT PLOT/OPEN PLACE/PART OPEN PLACE/DEMOLISHED HOUSE', 'IF HOUSE'] as const;
const AUTHORITY_DECLARATION_START = 'IF GPA AGPA DECLARATION';
const AUTHORITY_DECLARATION_END = 'END GPA AGPA DECLARATION';
const STRUCTURAL_TAGS = new Set([...ALL_VARIANTS, 'IF HOUSE FINISHED', 'IF SALE DEED', 'IF SALE DEED WITH G.P.A', 'IF SALE DEED WITH A.G.P.A', AUTHORITY_DECLARATION_START, AUTHORITY_DECLARATION_END, 'FOR ALL THE DOCUMENTS', 'IF OPEN PLACE/VACANT PLOT/PART OPEN PLACE/DEMOLISHED HOUSE'].map(value => value.toLowerCase()));
const CONDITION_ALIASES: Record<string, string> = { 'IF HOUSE FINISHED': 'IF HOUSE', 'IF FINISHED FLAT': 'IF FLAT FINISHED', 'IF SEMI FINISHED FLAT': 'IF FLAT SEMI FINISHED', 'IF DEMOLISHED HOUSE': 'IF DIMOLISHED HOUSE', 'IF VACANT PLOT': 'IF OPEN PLOT' };
const conditionName = (value: string) => value.replace(/^<|>$/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
const conditionTag = (value: string) => /^(?:IF|FOR|END)\b/i.test(value.trim());
const AMENDMENT_TAGS = ['Rectification', 'Supplemental'].flatMap(kind => ['Type', 'No.', 'Date', 'SRO', 'SRO Code'].map(suffix => kind + ' Deed ' + suffix));
const LEGACY_TEMPLATE_TAGS = new Set([
  'Executant Share', 'Claimant Share',
  'Structure Type', 'Building Age', 'Total Built-up Area', 'Age of House', 'Floors', 'Nala Order No', 'P.T.I. No.', 'PAN',
  'Pass Book Khata No', 'Pattadar Pass Book No', 'Remitting Bank',
  'Utr/Reference No.', 'V.L.T. No.', 'Execution Date', 'Housing Loan Branch', 'Ground Floor Area', 'First Floor Area', 'Authority SRO', 'Authority SRO Code', 'Represented Principals', 'Attorney Share', 'Authority Book Number', 'Authority Holder Label', 'Authority Principal Names',
].map(value => value.toLowerCase()));
export const MAX_CUSTOM_TEMPLATE_BYTES = 20 * 1024 * 1024;

export type TemplateValidationResult = {
  valid: boolean;
  preservationVersion?: string;
  saleOpenings?: boolean;
  errors: string[];
  detectedPlaceholders: string[];
  omittedPlaceholders: string[];
};

export type DeedTemplateSource =
  | { kind: 'built-in' }
  | ({ kind: 'library' } & TemplatePin)
  | { kind: 'custom'; name: string; hash: string; bytes: Uint8Array; validation: TemplateValidationResult; fieldContract?: TemplateFieldContract };

export const BUILT_IN_TEMPLATE_SOURCE: DeedTemplateSource = { kind: 'built-in' };

/** Preview the selected source's actual recital, using the download merge path. */
export async function loadTitleAmendmentTemplates(instrument: InstrumentId, variant: string, source: DeedTemplateSource = BUILT_IN_TEMPLATE_SOURCE): Promise<Partial<Record<TitleAmendmentKind, string>>> {
  const version = source.kind === 'built-in' ? releaseGate(instrument, variant).reference?.templateVersionId : undefined;
  if (source.kind === 'built-in' && !version) throw new Error('This deed requires an approved reference.');
  const bytes = version ? await loadTemplate(version) : await templateBytes(source);
  const validation = await validateDeedTemplate(bytes, instrument, variant, 'template.docx', source.kind === 'built-in' ? EMPTY_FIELD_CONTRACT : source.fieldContract || EMPTY_FIELD_CONTRACT);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const entries = await readZip(bytes), document = entries.find(entry => entry.name === 'word/document.xml')!;
  const xml = protectDeedTemplateSource(new TextDecoder().decode(document.data), preservationProfileFor(instrument, variant));
  const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
  return Object.fromEntries((['rectification', 'supplemental'] as const).flatMap(kind => {
    const paragraph = paragraphs.find(p => new RegExp('^' + kind + ' Deed:', 'i').test(plainText(p).trim()));
    return paragraph ? [[kind, replaceRunText(paragraph, /\s*\(Hereinafter called[\s\S]*$/i, () => '')]] : [];
  }));
}

export function titleAmendmentPreview(paragraph: string, values: Record<string, string>, kind: TitleAmendmentKind): string {
  const map = new Map(Object.entries(titleAmendmentValues(values, kind)).map(([key, value]) => [norm(key), value]));
  return plainText(fillParagraph(paragraph, map, new Set(), [])).trim();
}

/** Shared browser/server replacement gate. Unknown instruments stay blocked. */
export async function validateDeedTemplate(bytes: Uint8Array, instrument: InstrumentId, variant = '', filename = 'template.docx', contract: TemplateFieldContract = EMPTY_FIELD_CONTRACT): Promise<TemplateValidationResult> {
  try {
    if (!/\.docx$/i.test(filename) || !bytes.length || bytes.length > MAX_CUSTOM_TEMPLATE_BYTES) throw new Error('Choose a non-empty .docx template no larger than 20 MB.');
    const profile = preservationProfileFor(instrument, variant);
    if (contract.fields.length) {
      const entries = await readZip(bytes);
      const document = entries.find(entry => entry.name === 'word/document.xml');
      const tags = new Set(angleTags(document ? new TextDecoder().decode(document.data) : '').map(norm));
      const missing = contract.fields.filter(field => !tags.has(norm(field.placeholder)));
      if (missing.length) throw new Error(`The replacement omits configured fields: ${missing.map(field => '<' + field.placeholder + '>').join(', ')}. Restore their placeholders; existing field definitions and saved values must be retained.`);
    }
    if (profile === 'sale') return validateSaleDeedTemplate(bytes, filename, undefined, contract);
    if (profile === 'gift') return validateGiftDeedTemplate(bytes);
    if (profile === 'municipal-gift') return validateMunicipalGiftTemplate(bytes);
    if (profile === 'agreement_of_sale') return validateAgreementSaleGpaTemplate(bytes, contract);
    return validateGeneralPoaTemplate(bytes, contract);
  } catch (error) {
    return { valid: false, preservationVersion: DEED_PRESERVATION_VERSION, errors: [error instanceof Error ? error.message : String(error)], detectedPlaceholders: [], omittedPlaceholders: [] };
  }
}

export async function templateBytes(source: DeedTemplateSource = BUILT_IN_TEMPLATE_SOURCE): Promise<Uint8Array> {
  if (source.kind === 'library') return loadLibraryBytes(source);
  if (source.kind === 'custom') {
    if (!source.validation.valid) throw new Error(`Custom template is not compatible: ${source.validation.errors.join(' ')}`);
    return source.bytes;
  }
  return loadSaleDeedTemplate();
}

/** A literal phrase in the template to rewrite once the placeholders are filled. */
export type Rewrite = {
  find: RegExp;
  replace: string;
  records?: Record<string, string>[];
  partyRole?: 'executant' | 'claimant';
  /** Restrict a rewrite to template paragraphs with the intended structure. */
  when?: (paragraph: string) => boolean;
  /** Clear direct bold formatting from the generated paragraph. */
  regularWeight?: boolean;
  finalSuffix?: RegExp;
};

// ---------------------------------------------------------------- zip reading

type Entry = { name: string; data: Uint8Array };
type ZipReadLimits = { maxEntries?: number; maxEntryBytes?: number; maxTotalBytes?: number };

const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

async function inflateRaw(bytes: Uint8Array, maxOutputBytes = Number.POSITIVE_INFINITY): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream('deflate-raw');
    const reader = new Blob([bytes as any]).stream().pipeThrough(ds).getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value as Uint8Array;
      length += chunk.length;
      if (length > maxOutputBytes) {
        await reader.cancel();
        throw new Error('Template contains an oversized file.');
      }
      chunks.push(chunk);
    }
    const output = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
  } catch (error: any) {
    if (error?.message === 'Template contains an oversized file.') throw error;
    // Node 24 exposes the web stream classes but does not implement the ZIP
    // deflate-raw format. Keep browser builds dependency-free while allowing
    // tests and server-side rendering to use the native zlib implementation.
    if (typeof process === 'undefined' || !process.versions?.node) throw error;
    const moduleName = 'node:zlib';
    const { inflateRawSync } = await import(/* @vite-ignore */ moduleName);
    const options = Number.isFinite(maxOutputBytes) ? { maxOutputLength: maxOutputBytes } : undefined;
    try {
      return new Uint8Array(inflateRawSync(bytes, options));
    } catch (inflateError: any) {
      if (/larger than|output length|buffer too large/i.test(inflateError?.message || '')) throw new Error('Template contains an oversized file.');
      throw inflateError;
    }
  }
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const cs = new CompressionStream('deflate-raw');
    const buf = await new Response(new Blob([bytes as any]).stream().pipeThrough(cs)).arrayBuffer();
    return new Uint8Array(buf);
  } catch (error) {
    if (typeof process === 'undefined' || !process.versions?.node) throw error;
    const moduleName = 'node:zlib';
    const { deflateRawSync } = await import(/* @vite-ignore */ moduleName);
    return new Uint8Array(deflateRawSync(bytes));
  }
}

/** Read a zip via its End of Central Directory record. */
export async function readZip(zip: Uint8Array, limits: ZipReadLimits = {}): Promise<Entry[]> {
  const v = dv(zip);
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0 && i > zip.length - 65558; i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Template is not a readable .docx (no zip directory).');

  const count = v.getUint16(eocd + 10, true);
  if (count > (limits.maxEntries ?? Number.POSITIVE_INFINITY)) throw new Error('Template contains too many files.');
  let p = v.getUint32(eocd + 16, true);
  const entries: Entry[] = [];
  let declaredTotalSize = 0;
  let actualTotalSize = 0;

  for (let i = 0; i < count; i++) {
    if (p < 0 || p + 46 > zip.length) throw new Error('Corrupt zip directory in template.');
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt zip directory in template.');
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const localOff = v.getUint32(p + 42, true);
    if (flags & 1) throw new Error('Encrypted Word templates are not supported.');
    if (method !== 0 && method !== 8) throw new Error('Template uses an unsupported ZIP compression method.');
    if (size > (limits.maxEntryBytes ?? Number.POSITIVE_INFINITY)) throw new Error('Template contains an oversized file.');
    declaredTotalSize += size;
    if (declaredTotalSize > (limits.maxTotalBytes ?? Number.POSITIVE_INFINITY)) throw new Error('Template expands beyond the allowed size.');
    if (localOff < 0 || localOff + 30 > zip.length) throw new Error('Corrupt local file header in template.');
    if (v.getUint32(localOff, true) !== 0x04034b50) throw new Error('Corrupt local file header in template.');
    if (p + 46 + nameLen + extraLen + commentLen > zip.length) throw new Error('Corrupt zip directory in template.');
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    if (name.startsWith('/') || name.includes('..\\') || name.split('/').includes('..')) throw new Error('Template contains an unsafe file path.');

    // The local header repeats the name and carries its own extra field.
    const lNameLen = v.getUint16(localOff + 26, true);
    const lExtraLen = v.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    if (start < 0 || start + compSize > zip.length) throw new Error('Corrupt file data in template.');
    const raw = zip.subarray(start, start + compSize);

    const data = method === 8 ? await inflateRaw(raw, limits.maxEntryBytes) : raw.slice();
    if (data.length > (limits.maxEntryBytes ?? Number.POSITIVE_INFINITY)) throw new Error('Template contains an oversized file.');
    actualTotalSize += data.length;
    if (actualTotalSize > (limits.maxTotalBytes ?? Number.POSITIVE_INFINITY)) throw new Error('Template expands beyond the allowed size.');
    entries.push({ name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------------------------------------------------------------- zip writing

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function writeZip(entries: Entry[]): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.name);
    const comp = await deflateRaw(e.data);
    const crc = crc32(e.data);

    const local = new Uint8Array(30 + name.length + comp.length);
    const lv = dv(local);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);          // version needed
    lv.setUint16(6, 0, true);           // flags
    lv.setUint16(8, 8, true);           // deflate
    // Word 2007's ZIP reader is stricter than modern Office and rejects the
    // all-zero DOS date emitted by some browser ZIP writers. Keep output
    // reproducible, but use the earliest valid DOS timestamp: 1980-01-01.
    lv.setUint32(10, 0x00210000, true); // time 00:00:00, date 1980-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, comp.length, true);
    lv.setUint32(22, e.data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(comp, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = dv(central);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(12, 0x00210000, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, comp.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = dv(end);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ------------------------------------------------------------ xml text helpers

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Placeholder names vary in spacing/case between occurrences — normalize to match. */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Split `<w:body>` into its top-level `<w:p>` / `<w:tbl>` / `<w:sectPr>` children. */
function topLevelChildren(body: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const pat = /<(\/?)(w:p|w:tbl|w:sectPr)(?=[ />])/g;
  const stack: string[] = [];
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = pat.exec(body))) {
    const closing = m[1] === '/';
    const endOfTag = body.indexOf('>', m.index);
    if (!closing) {
      if (!stack.length) start = m.index;
      stack.push(m[2]);
      if (body[endOfTag - 1] === '/') {
        stack.pop();
        if (!stack.length) out.push({ start, end: endOfTag + 1 });
      }
    } else {
      if (stack[stack.length - 1] === m[2]) stack.pop();
      if (!stack.length) out.push({ start, end: endOfTag + 1 });
    }
    pat.lastIndex = endOfTag + 1;
  }
  return out;
}

const plainText = (xml: string) =>
  unescapeXml((xml.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [])
    .map(t => t.replace(/<[^>]+>/g, '')).join(''));

/** Drop the source template's trailing blank row from market-value tables. */
function removeTrailingEmptyTableRow(table: string): string {
  const rows = [...table.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)];
  const last = rows.at(-1);
  if (!last || plainText(last[0]).trim() || last.index == null) return table;
  return table.slice(0, last.index) + table.slice(last.index + last[0].length);
}

const angleTags = (xml: string) => [...new Set(
  (plainText(xml).match(/<[^<>]{2,60}>/g) || [])
    .map(tag => tag.slice(1, -1).replace(/\s+/g, ' ').trim())
)];

/**
 * Validate an uploaded template against the renderer's structural contract and
 * the bundled template's placeholder vocabulary. Validation is deliberately
 * local: customer templates are never sent to an extraction provider.
 */
/** One policy entry point for every source, independent of cached validation. */
function normalContinuationSection(section: string): string {
  return section.replace(/(<w:pgMar\b[^>]*\bw:top=")(\d+)(")/g, (match, before, top, after) => Number(top) > 2160 ? before + '1080' + after : match);
}

/** Word revisions may split one identity at a section break. Repeat the whole
 * identity, while retaining its section boundary once outside the repeat. */
function joinSplitPartyRecitals(xml: string): string {
  const start = xml.indexOf('<w:body>') + 8, end = xml.lastIndexOf('</w:body>');
  if (start < 8 || end < start) return xml;
  const body = xml.slice(start, end);
  const chunks = topLevelChildren(body).map(child => body.slice(child.start, child.end));
  let scheduled = false;
  for (let index = 0; index < chunks.length; index++) {
    const text = plainText(chunks[index]);
    if (/^\s*SCHEDULE OF PROPERTY\b/i.test(text)) scheduled = true;
    if (scheduled || !/^<w:p\b/.test(chunks[index])) continue;
    const identity = text.match(/^\s*<\s*(EXECUTANT|CLAIMANT|PRINCIPAL|ATTORNEY) NAME\s*>/i);
    if (!identity) continue;
    let joined = chunks[index], boundary = '', count = 0;
    while (index + 1 < chunks.length && count++ < 4) {
      const next = chunks[index + 1], nextText = plainText(next).trim();
      const role = identity[1];
      const fieldsContinue = new RegExp(`<\\s*${role} (?:State|Pin Code|Adhar Number|Cell\\.No\\.|PAN)\\s*>`, 'i').test(nextText)
        && /^(?:State:|Pin Code:|Aadhaar No:|Cell No:|PAN:)/i.test(nextText);
      const definitionContinues = /hereinafter[\s\S]*\bSECOND\s*$/i.test(plainText(joined)) && /^PARTY\/S\/ATTORNEY HOLDER\/S/i.test(nextText);
      if (!/^<w:p\b/.test(next) || !(fieldsContinue || definitionContinues)) break;
      const sections = (joined + next).match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g) || [];
      boundary += sections.map(section => `<w:p><w:pPr>${section}</w:pPr></w:p>`).join('');
      joined = joined.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, '');
      const runs = next.replace(/^<w:p(?:\s[^>]*)?>/, '').replace(/<\/w:p>$/, '').replace(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/, '');
      joined = joined.replace(/<\/w:p>$/, '<w:r><w:t xml:space="preserve"> </w:t></w:r>' + runs + '</w:p>');
      chunks.splice(index + 1, 1);
    }
    chunks[index] = joined + boundary;
  }
  return xml.slice(0, start) + chunks.join('') + xml.slice(end);
}

function protectDeedTemplateSource(xml: string, profile: PreservationProfile): string {
  xml = joinSplitPartyRecitals(xml);
  if (profile === 'sale') xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const text = plainText(paragraph);
    const change = (find: RegExp, to: string) => { paragraph = replaceRunText(paragraph, find, () => to); };
    // Recognized older source aliases cannot collapse independent facts.
    if (/^THIS SALE DEED/i.test(text)) { change(/<State>/gi, '<Property State>'); change(/DD[-/.]?MM[-/.]?YYYY|<Date>/gi, '<Execution Date>'); }
    if (/^<ATTORNEY NAME>/i.test(text) && /Power of Attorney Document No\./i.test(text)) {
      if (!/<Represented Principals>/i.test(text)) change(/<ATTORNEY NAME>/i, '<ATTORNEY NAME> (representing <Represented Principals>)');
      change(/<Sub Registrar>/gi, '<Authority SRO>');
      change(/<Sub Registrar Code>/gi, '<Authority SRO Code>');
      if (/General Power of Attorney Document No\.<G\.P\.A\.Doct\.No\.>,/i.test(text)) change(/<G\.P\.A\.Doct\.No\.>,/i, '<G.P.A.Doct.No.> in Book <Authority Book Number>,');
    }
    if (/jointly executed a Registered Development Agreement/i.test(text)) {
      change(/<Sub Registrar>/gi, '<Development SRO>');
      change(/<Sub Registrar Code>/gi, '<Development SRO Code>');
    }
    if (/was allotted to the share of the Vendor/i.test(text)) {
      change(/<Link Doct\.No\.>/gi, '<Supplemental Agreement No.>');
      change(/<Sub Registrar>/gi, '<Supplemental SRO>');
      change(/<Sub Registrar Code>/gi, '<Supplemental SRO Code>');
    }
    if (/House Permission:|jointly executed a Registered Development Agreement/i.test(text)) {
      change(/<1>/g, '<Stilt Floors>'); change(/<5>/g, '<Upper Floors>');
    }
    if (/^All that/i.test(text) && /Ground Floor:/.test(text)) {
      change(/Ground Floor:\s*<\s*Plinth Area>/gi, 'Ground Floor: <Ground Floor Area>');
      change(/First Floor:\s*<\s*Plinth Area>/gi, 'First Floor: <First Floor Area>');
    }
    return paragraph;
  });
  let inSchedule = false;
  const identities = new Set<string>();
  const protectedXml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const amendment = plainText(paragraph).trim().match(/^(Rectification|Supplemental) Deed:/i)?.[1];
    if (amendment) {
      const kind = amendment[0].toUpperCase() + amendment.slice(1).toLowerCase();
      for (const [from, to] of [['Link Doc Type', kind + ' Deed Type'], ['Sub Registrar', kind + ' Deed SRO'], ['Sub Registrar Code', kind + ' Deed SRO Code']]) {
        paragraph = replaceRunText(paragraph, new RegExp('<' + from + '>', 'gi'), () => '<' + to + '>');
      }
    }
    const original = plainText(paragraph);
    if (/^\s*SCHEDULE OF PROPERTY\b/i.test(original)) inSchedule = true;
    const identity = !inSchedule && (original.match(/^\s*(?:\d+[.)]\s*)?<\s*(EXECUTANT|CLAIMANT|PRINCIPAL|ATTORNEY) NAME\s*>/i)
      || /<\s*(?:EXECUTANT|CLAIMANT|PRINCIPAL|ATTORNEY) RELATION NAME\s*>/i.test(original) && original.match(/<\s*(EXECUTANT|CLAIMANT|PRINCIPAL|ATTORNEY) NAME\s*>/i));
    const role = identity ? identity[1][0].toUpperCase() + identity[1].slice(1).toLowerCase() : undefined;
    if (role) identities.add(role);
    const result = protectedSourceWording(original, profile, inSchedule, role, (find, replacement) => {
      paragraph = replaceRunText(paragraph, find, match => replacement.replace(/\$(\$|&|\d{1,2})/g, (_, token: string) => token === '$' ? '$' : token === '&' ? match[0] : match[Number(token)] || ''));
    });
    if (profile === 'sale' && /^THIS SALE DEED/i.test(original)) paragraph = replaceRunText(paragraph, /<Date>/gi, () => '<Execution Date>');
    return original.trim() && !result.trim() && !/<w:(?:sectPr|drawing)\b/.test(paragraph) ? '' : paragraph;
  });
  for (const role of profile === 'municipal-gift' ? ['Executant'] : ['Executant', 'Claimant']) {
    if (!identities.has(role)) throw new Error(`Retain the complete ${role} identity paragraph. A replacement template cannot remove saved party, guardian or representative details.`);
  }
  // Fixed examples in total-value rows must resolve to the entered document
  // value. Per-unit rates and ordinary property measurements are independent.
  let sectionIndex = 0;
  return protectedXml.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, row => {
    if (!/Total\s+Market\s+Value|Executant.?s\s+estimate\s+M\.?V\.?/i.test(plainText(row))) return row;
    const cells = [...row.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)];
    const last = cells.at(-1);
    if (!last || cells.length < 2 || /<[^<>]+>/.test(plainText(last[0])) || !/\d/.test(plainText(last[0]))) return row;
    return row.slice(0, last.index) + last[0].replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => replaceRunText(paragraph, /[\s\S]+/, () => ': Rs.<Market of Value Rs./->/-')) + row.slice(last.index! + last[0].length);
  }).replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, section => sectionIndex++ === 0 ? section : normalContinuationSection(section));
}

export async function validateSaleDeedTemplate(
  bytes: Uint8Array,
  filename = 'template.docx',
  referenceBytes?: Uint8Array,
  fieldContract: TemplateFieldContract = EMPTY_FIELD_CONTRACT,
): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  const empty = { valid: false, errors, detectedPlaceholders: [], omittedPlaceholders: [], preservationVersion: DEED_PRESERVATION_VERSION };
  if (!/\.docx$/i.test(filename)) errors.push('Choose a Word document with a .docx extension.');
  if (!bytes.length) errors.push('The template file is empty.');
  if (bytes.length > MAX_CUSTOM_TEMPLATE_BYTES) errors.push('The template is larger than 20 MB.');
  if (errors.length) return empty;

  try {
    const entries = await readZip(bytes, { maxEntries: 2_000, maxEntryBytes: 30 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024 });
    const requiredParts = ['[Content_Types].xml', 'word/document.xml', 'word/_rels/document.xml.rels'];
    for (const part of requiredParts) if (!entries.some(entry => entry.name === part)) errors.push(`Template is missing ${part}.`);
    const document = entries.find(entry => entry.name === 'word/document.xml');
    if (!document) return empty;

    const xml = protectDeedTemplateSource(new TextDecoder().decode(document.data), 'sale');
    const heading = plainText(xml).slice(0, 500).replace(/\s+/g, ' ');
    if (/^(?:\s*)(?:DEED OF )?GIFT(?: SETTLEMENT)?(?: DEED)?\b/i.test(heading)) {
      errors.push('This is a Gift template uploaded to the Sale library. Only Sale templates are currently supported. Select a Gift draft to use the Gift renderer; changing IF markers will not make this a Sale template.');
      return empty;
    }
    const bodyOpen = xml.indexOf('<w:body>');
    const bodyEnd = xml.lastIndexOf('</w:body>');
    if (bodyOpen < 0 || bodyEnd < 0 || bodyEnd <= bodyOpen) {
      errors.push('Template is missing a readable Word document body.');
      return empty;
    }
    const prepared = prepareTemplate(xml.slice(bodyOpen + '<w:body>'.length, bodyEnd));
    const body = prepared.body;
    const children = topLevelChildren(body);
    const paragraphs = children.map(child => plainText(body.slice(child.start, child.end)).trim());
    for (const marker of VARIANTS.filter(marker => marker !== 'IF FLAT')) if (!paragraphs.includes(`<${marker}>`)) errors.push(`Template is missing the <${marker}> schedule marker.`);
    if (!paragraphs.includes('<IF FLAT>')) for (const marker of FLAT_VARIANTS) if (!paragraphs.includes(`<${marker}>`)) errors.push(`Template is missing the <${marker}> schedule marker.`);
    const markerIndexes = ALL_VARIANTS.map(marker => paragraphs.indexOf(`<${marker}>`)).filter(index => index >= 0);
    const firstMarker = markerIndexes.length ? Math.min(...markerIndexes) : -1;
    const lastMarker = markerIndexes.length ? Math.max(...markerIndexes) : -1;
    const flowStart = paragraphs.findIndex(text => text.startsWith('1. FLOW OF TITLE & LINK DEED DETAILS:'));
    const flowEnd = paragraphs.findIndex(text => text.startsWith('2. CONSIDERATION & PAYMENT TERMS:'));
    if (flowStart < 0) errors.push('Template is missing the “1. FLOW OF TITLE & LINK DEED DETAILS:” boundary.');
    if (flowEnd < 0) errors.push('Template is missing the “2. CONSIDERATION & PAYMENT TERMS:” boundary.');
    if (flowStart >= 0 && flowEnd >= 0 && (flowEnd <= flowStart || (firstMarker >= 0 && flowEnd >= firstMarker))) {
      errors.push('The flow-of-title and consideration sections are not in the required order.');
    }
    const sharedTail = paragraphs.findIndex((text, index) => index > lastMarker && ['<FOR ALL THE DOCUMENTS>', 'DECLARATION'].includes(text));
    if (lastMarker >= 0 && sharedTail < 0) errors.push('Template is missing the declaration/shared-tail boundary after the schedule sections.');
    if (!/<w:sectPr(?:\s|>)/.test(body)) errors.push('Template is missing its final page-section settings.');
    const clauseIndexes = OPERATIVE_CLAUSE_MARKERS.map(marker => paragraphs.indexOf(marker));
    if ((clauseIndexes[0] >= 0) !== (clauseIndexes[1] >= 0)) {
      errors.push('Template has an incomplete operative-clause marker pair.');
    } else if (clauseIndexes[0] >= 0 && (clauseIndexes[0] >= clauseIndexes[1] || clauseIndexes[1] >= firstMarker)) {
      errors.push('The operative-clause markers are not in the required order before the schedule sections.');
    }

    const customTags = angleTags(xml);
    if (paragraphs.includes('<IF SALE DEED WITH G.P.A>') || paragraphs.includes('<IF SALE DEED WITH A.G.P.A>')) {
      for (const mode of ['gpa', 'agpa']) {
        try { await selectSaleOpening(body, { 'Sale Document Mode': mode }); }
        catch (error: any) { errors.push(error.message); }
      }
    }
    const declarationStart = paragraphs.indexOf(`<${AUTHORITY_DECLARATION_START}>`);
    const declarationEnd = paragraphs.indexOf(`<${AUTHORITY_DECLARATION_END}>`);
    if ((declarationStart >= 0) !== (declarationEnd >= 0) || (declarationStart >= 0 && (declarationEnd <= declarationStart || declarationStart <= sharedTail))) errors.push('The GPA/AGPA declaration condition must have a matching end marker after the declaration heading.');
    if (declarationStart >= 0 && declarationEnd > declarationStart && !['<Authority Holder Label>', '<Authority Principal Names>'].every(tag => paragraphs.slice(declarationStart + 1, declarationEnd).join(' ').includes(tag))) errors.push('The GPA/AGPA declaration must retain Authority Holder Label and Authority Principal Names.');
    const unsupportedConditions = customTags.filter(tag => conditionTag(tag) && !STRUCTURAL_TAGS.has(norm(CONDITION_ALIASES[conditionName(tag)] || conditionName(tag))));
    for (const tag of unsupportedConditions) errors.push(`Unsupported conditional marker <${tag}>. Conditional markers are document structure, not input fields. Use a supported Sale section marker or retain the active template's original markers.`);
    const reference = referenceBytes ?? await loadSaleDeedTemplate();
    const referenceEntries = await readZip(reference);
    const referenceDocument = referenceEntries.find(entry => entry.name === 'word/document.xml');
    if (!referenceDocument) throw new Error('The built-in template is missing word/document.xml.');
    const supported = angleTags(new TextDecoder().decode(referenceDocument.data))
      .filter(tag => !STRUCTURAL_TAGS.has(norm(tag)));
    if (!referenceBytes) {
      const legacy = await readZip(await loadTemplate('sale-deed-v3'));
      const legacyDoc = legacy.find(entry => entry.name === 'word/document.xml');
      if (legacyDoc) supported.push(...angleTags(new TextDecoder().decode(legacyDoc.data)).filter(tag => !STRUCTURAL_TAGS.has(norm(tag)) && !supported.some(value => norm(value) === norm(tag))));
    }
    const supportedByName = new Map(supported.map(tag => [norm(tag), tag]));
    for (const field of ALL_FIELDS) for (const tag of field.ph ? Array.isArray(field.ph) ? field.ph : [field.ph] : []) if (!supportedByName.has(norm(tag))) supportedByName.set(norm(tag), tag);
    for (const field of fieldContract.fields) supportedByName.set(norm(field.placeholder), field.placeholder);
    const detectedPlaceholders = customTags.filter(tag => supportedByName.has(norm(tag)));
    const unknown = customTags.filter(tag => !conditionTag(tag) && !STRUCTURAL_TAGS.has(norm(tag)) && !supportedByName.has(norm(tag)) && !LEGACY_TEMPLATE_TAGS.has(norm(tag)));
    if (unknown.length) errors.push(`Unsupported placeholder${unknown.length === 1 ? '' : 's'}: ${unknown.map(tag => `<${tag}>`).join(', ')}.`);
    const detectedNames = new Set(detectedPlaceholders.map(norm));
    const omittedPlaceholders = supported.filter(tag => !detectedNames.has(norm(tag))).sort();
    return { valid: errors.length === 0, preservationVersion: DEED_PRESERVATION_VERSION, saleOpenings: customTags.includes('IF SALE DEED WITH G.P.A') && customTags.includes('IF SALE DEED WITH A.G.P.A'), errors, detectedPlaceholders: detectedPlaceholders.sort(), omittedPlaceholders };
  } catch (error: any) {
    errors.push(error?.message || 'Template is not a readable Word document.');
    return empty;
  }
}

export async function templateBindingCatalog(): Promise<BindingCatalogItem[]> {
  const validation = await validateSaleDeedTemplate(await loadSaleDeedTemplate());
  return [...new Set([...validation.detectedPlaceholders, ...validation.omittedPlaceholders])].map(placeholder => {
    const field = ALL_FIELDS.find(field => (field.ph ? Array.isArray(field.ph) ? field.ph : [field.ph] : []).some(name => norm(name) === norm(placeholder)));
    const party = field?.id.startsWith('executant') || /^executant/i.test(placeholder) ? 'vendor' : field?.id.startsWith('claimant') || /^claimant/i.test(placeholder) || norm(placeholder) === 'pan' ? 'purchaser' : undefined;
    const transaction = /consideration|amount|payment|execution|stamp|prepared|words|^cheque\.|remitting bank|utr\/reference|market of value/i.test(placeholder) || ['executionDate', 'consid', 'stampValue'].includes(field?.id || '');
    return { placeholder, label: field?.label || placeholder, scope: party ? 'party' : transaction ? 'transaction' : 'property', roleId: party, type: field?.type === 'money' ? 'currency' : field?.type === 'date' || field?.type === 'month' ? 'date' : field?.type === 'number' ? 'number' : 'text' } as BindingCatalogItem;
  });
}

/** Inspect unknown/configured tags without treating configuration as structural damage. */
export async function inspectTemplateFields(bytes: Uint8Array, contract: TemplateFieldContract = EMPTY_FIELD_CONTRACT): Promise<TemplateFieldInspection> {
  const baseline = await validateSaleDeedTemplate(bytes);
  const structureErrors = baseline.errors.filter(error => !error.startsWith('Unsupported placeholder'));
  const catalog = await templateBindingCatalog();
  const known = new Set([...catalog.map(item => norm(item.placeholder)), ...STRUCTURAL_TAGS, ...LEGACY_TEMPLATE_TAGS]);
  const configured = new Set(contract.fields.map(field => norm(field.placeholder)));
  const occurrences: PlaceholderOccurrence[] = [];
  try {
    const entries = await readZip(bytes, { maxEntries: 2000, maxEntryBytes: 30 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024 });
    const doc = entries.find(entry => entry.name === 'word/document.xml');
    if (!doc) return { occurrences, unresolved: [], structureErrors };
    const xml = new TextDecoder().decode(doc.data);
    if (plainText(xml).includes('AGREEMENT OF SALE-CUM-GPA')) known.add(norm('WITHOUT POSSESSION'));
    const variantUses = new Map<string, Set<string>>();
    const use = (text: string, variant: string) => { for (const tag of angleTags(text)) { const key = norm(tag); const set = variantUses.get(key) || new Set<string>(); set.add(variant); variantUses.set(key, set); } };
    try {
      const prepared = prepareTemplate(xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>')));
      let variant = '';
      for (const child of topLevelChildren(prepared.body)) {
        const chunk = prepared.body.slice(child.start, child.end); const text = plainText(chunk).trim();
        const marker = ALL_VARIANTS.find(name => text === `<${name}>`);
        if (marker) { variant = marker; continue; }
        if (text === '<FOR ALL THE DOCUMENTS>' || text === 'DECLARATION') variant = '';
        use(chunk, variant);
      }
      for (const [name, block] of [...Object.entries(prepared.titles), ...Object.entries(prepared.clauses)]) use(block, name);
    } catch { /* Structural errors are already reported. */ }
    for (const entry of entries.filter(entry => /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/.test(entry.name))) {
      const content = new TextDecoder().decode(entry.data);
      const textboxes = (content.match(/<w:txbxContent\b[\s\S]*?<\/w:txbxContent>/g) || []).map(plainText).join('\n');
      for (const paragraph of content.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || []) {
        for (const placeholder of angleTags(paragraph).filter(tag => !conditionTag(tag) && (!known.has(norm(tag)) || configured.has(norm(tag))))) {
          const uses = variantUses.get(norm(placeholder));
          occurrences.push({ placeholder, text: plainText(paragraph).slice(0, 500), part: entry.name, variants: uses?.has('') ? [] : [...(uses || [])], supported: entry.name === 'word/document.xml' && !angleTags(textboxes).some(tag => norm(tag) === norm(placeholder)) && !!uses });
        }
      }
    }
  } catch { /* Return the existing bounded ZIP validation errors. */ }
  return { occurrences, unresolved: [...new Set(occurrences.filter(item => !configured.has(norm(item.placeholder))).map(item => item.placeholder))], structureErrors };
}

/** Clone one paragraph's formatting while replacing its visible text. */
function paragraphLike(sample: string, text: string, alignment?: 'left' | 'center'): string {
  const open = sample.match(/^<w:p(?:\s[^>]*)?>/)?.[0] ?? '<w:p>';
  let pPr = sample.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] ?? '';
  if (alignment) {
    const jc = `<w:jc w:val="${alignment}"/>`;
    pPr = pPr
      ? /<w:jc\b[^>]*\/>/.test(pPr)
        ? pPr.replace(/<w:jc\b[^>]*\/>/, jc)
        : pPr.replace('</w:pPr>', `${jc}</w:pPr>`)
      : `<w:pPr>${jc}</w:pPr>`;
  }
  const rPr = sample.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/)?.[0] ?? '';
  return `${open}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function keepWithNext(paragraph: string): string {
  if (/<w:keepNext\b/.test(paragraph)) return paragraph.replace(/<w:keepNext\b[^>]*\/>/, '<w:keepNext/>');
  return /<w:pPr(?:\s[^>]*)?>/.test(paragraph)
    ? paragraph.replace(/<w:pPr(?:\s[^>]*)?>/, tag => tag + '<w:keepNext/>')
    : paragraph.replace(/<w:p(?:\s[^>]*)?>/, tag => tag + '<w:pPr><w:keepNext/></w:pPr>');
}

/** Insert uploaded supporting evidence before the schedule's market statement. */
function insertSupportingRecords(block: string, records: string[]): string {
  if (!records.length) return block;
  const children = topLevelChildren(block);
  const statementIndex = children.findIndex(child =>
    plainText(block.slice(child.start, child.end)).trim().startsWith('STATEMENT OF MARKET VALUE')
  );
  if (statementIndex < 0) return block;
  const statement = block.slice(children[statementIndex].start, children[statementIndex].end);
  let bodySample = statement;
  for (let index = statementIndex - 1; index >= 0; index--) {
    const candidate = block.slice(children[index].start, children[index].end);
    if (candidate.startsWith('<w:p') && plainText(candidate).trim()) {
      bodySample = candidate;
      break;
    }
  }
  const evidence = paragraphLike(statement, 'SUPPORTING PROPERTY RECORDS')
    + records.map((record, index) => paragraphLike(bodySample, `${index + 1}. ${record}`, 'left')).join('');
  const at = children[statementIndex].start;
  return block.slice(0, at) + evidence + block.slice(at);
}

/**
 * Substitute inside one paragraph. Runs are merged so placeholders split across
 * them still match; the result goes into the first <w:t> and the others are
 * emptied, which preserves the paragraph's own formatting.
 */
/** Replace a text span across runs, retaining all untouched XML and formatting. */
export function replaceRunText(p: string, find: RegExp, replacement: (match: RegExpExecArray) => string): string {
  // Empty Word text nodes must not be mistaken for the opening of the next run.
  p = p.replace(/<w:t(?:\s[^>]*)?\/>/g, tag => tag.replace(/\/>$/, '></w:t>'));
  const tags = [...p.matchAll(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g)];
  const texts = tags.map(t => unescapeXml(t[0].replace(/^<w:t(?:\s[^>]*)?>/, '').replace(/<\/w:t>$/, '')));
  const lengths = texts.map(t => t.length);
  const starts: number[] = [];
  let offset = 0;
  for (const text of texts) { starts.push(offset); offset += text.length; }
  const joined = texts.join('');
  const regex = new RegExp(find.source, find.flags.includes('g') ? find.flags : find.flags + 'g');
  const matches = [...joined.matchAll(regex)];
  for (const match of matches.reverse()) {
    const start = match.index!;
    const end = start + match[0].length;
    const first = starts.findIndex((at, i) => start >= at && start < at + lengths[i]);
    if (first < 0) continue;
    let last = first;
    while (last + 1 < texts.length && starts[last + 1] < end) last++;
    const before = texts[first].slice(0, start - starts[first]);
    const after = texts[last].slice(end - starts[last]);
    texts[first] = before + replacement(match) + (first === last ? after : '');
    for (let i = first + 1; i <= last; i++) texts[i] = i === last ? after : '';
  }
  let index = 0;
  return p.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, tag => {
    const original = tags[index][0];
    const value = texts[index++];
    if (unescapeXml(original.replace(/^<w:t(?:\s[^>]*)?>/, '').replace(/<\/w:t>$/, '')) === value) return tag;
    const opening = tag.slice(0, tag.indexOf('>')).replace(/\s+xml:space="[^"]*"/, '');
    return opening + ' xml:space="preserve">' + escapeXml(value).replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">') + '</w:t>';
  });
}

/**
 * Remove every empty placeholder inside its original Word paragraph.
 * This intentionally operates through replaceRunText, so text split across
 * Word runs keeps every untouched run's character formatting and paragraph XML.
 */
function removeEmptyFields(p: string, values: Map<string, string>, missing: Set<string>): string {
  let changed = false;
  const names = [...new Set((plainText(p).match(/<([^<>]{2,60}?)>/g) || [])
    .map(tag => tag.slice(1, -1).trim())
    .filter(name => !STRUCTURAL_TAGS.has(norm(name)) && !values.get(norm(name))))];
  for (const name of names) {
    missing.add(name);
    // Templates commonly put cosmetic spaces inside angle brackets
    // (`< Claimant Village>`), so match the logical field name rather than
    // requiring an exact tag spelling.
    const tag = `<\\s*${escapeRegExp(name)}\\s*>`;
    // A short conventional label owns the label and its closing punctuation.
    // Limiting the label to words (no commas) prevents removal from reaching a
    // preceding populated field in the same recital.
    const labelled = new RegExp(`(?:[A-Za-z][A-Za-z0-9./-]*\\s+){0,3}[A-Za-z][A-Za-z0-9./-]*:\\s*${tag}\\s*([.,;])?`, 'gi');
    p = replaceRunText(p, labelled, match => {
      changed = true;
      return match[1] === '.' ? '.' : '';
    });

    // Common non-colon labels in deed templates: H.No.<value>, Document
    // No.<value>, Rs.<value>/-. They are removed together with the empty tag.
    p = replaceRunText(p, new RegExp(`(?:R\\/o\\s+)?H\\.?\\s*No\\.?\\s*${tag}`, 'gi'), () => { changed = true; return ''; });
    p = replaceRunText(p, new RegExp(`(?:Document\\s+)?No\\.?\\s*${tag}`, 'gi'), () => { changed = true; return ''; });
    p = replaceRunText(p, new RegExp(`Rs\\.\\s*${tag}\\s*\\/-`, 'gi'), () => { changed = true; return ''; });

    // For an unlabeled address component, prefer its following separator so
    // "<Locality>, <Village> Village" becomes "<Village> Village". If it is
    // the final component instead, remove its preceding separator instead.
    const standaloneWithFollowingComma = new RegExp(`${tag}\\s*,\\s*`, 'gi');
    p = replaceRunText(p, standaloneWithFollowingComma, () => { changed = true; return ''; });
    const standaloneWithLeadingComma = new RegExp(`,\\s*${tag}`, 'gi');
    p = replaceRunText(p, standaloneWithLeadingComma, () => { changed = true; return ''; });
    const standalone = new RegExp(tag, 'gi');
    p = replaceRunText(p, standalone, () => { changed = true; return ''; });
  }
  if (!changed) return p;

  // Removing several adjacent values can create a new invalid separator after
  // each pass, so normalize a few times until the paragraph is stable.
  for (let pass = 0; pass < 4; pass++) {
    const before = plainText(p);
    p = replaceRunText(p, /\s+([,.;:])/g, match => match[1]);
    p = replaceRunText(p, /[:,]\s*([,.])/g, match => match[1]);
    p = replaceRunText(p, /,\s*,+/g, () => ',');
    p = replaceRunText(p, /\(\s*\)/g, () => '');
    p = replaceRunText(p, / {2,}/g, () => ' ');
    if (plainText(p) === before) break;
  }
  return p;
}

function fillParagraph(p: string, values: Map<string, string>, missing: Set<string>, rewrites: Rewrite[]): string {
  const landmark = values.get(norm('Near / Adjacent'))?.toLowerCase();
  if (landmark === 'near' || landmark === 'adjacent') {
    p = replaceRunText(p, /<[^<>]*>|\b(?:near\s*\/\s*a?djacent|near|adjacent)\s+(?:house\s+no\.?|h\.?\s*no\.?)/gi,
      match => match[0].startsWith('<') ? match[0] : `${landmark} house No.`);
  }
  for (const tag of ['Executant Share', 'Attorney Share', 'Claimant Share']) {
    if (values.has(norm(tag)) && !values.get(norm(tag))) p = replaceRunText(p, new RegExp(`,?\\s*holding\\s+(?:an\\s+)?undivided\\s+share\\s+of\\s*<${tag}>(?:\\s+in the schedule property)?\\.?`, 'gi'), () => '.');
  }
  const authority = values.get(norm('Local Authority Type'));
  if (authority) p = replaceRunText(p, /Competent Local Authority\s*,\s*(?=<Village>)/gi, () => `${authority}, `);
  // Apply structural recitals first, then merge placeholders into their own runs.
  const repeat = rewrites.find(rw => rw.records && rw.find.test(plainText(p)) && (!rw.when || rw.when(p)));
  if (repeat) return repeat.records!.map((record, index) => {
    if (repeat.partyRole === 'claimant' && record['MUNICIPAL COUNCIL RECITAL']) {
      return replaceRunText(p, /[\s\S]+/, () => (repeat.records!.length > 1 ? `${index + 1}. ` : '') + record['MUNICIPAL COUNCIL RECITAL']);
    }
    if (repeat.partyRole && record['ENTITY RECITAL']) {
      const originalClosing = plainText(p).match(/\(Hereinafter[\s\S]*$/i)?.[0];
      const closing = index === repeat.records!.length - 1 ? originalClosing || (repeat.partyRole === 'executant' ? '(Hereinafter called the "VENDOR/S") of the ONE PART.' : '(Hereinafter called the "VENDEE/S") of the OTHER PART.') : '';
      const recital = (repeat.records!.length > 1 ? (index + 1) + '. ' : '') + '<ENTITY RECITAL>' + (record['UNDIVIDED SHARE RECITAL'] ? ', ' + record['UNDIVIDED SHARE RECITAL'] : '') + (closing ? ', ' + closing : '.');
      const paragraph = replaceRunText(p, /[\s\S]+/, () => recital);
      return fillParagraph(paragraph, new Map([...values, ...Object.entries(record).map(([k, v]) => [norm(k), v] as [string, string])]), missing, rewrites.filter(rw => rw !== repeat));
    }
    let paragraph = repeat.partyRole && repeat.records!.length > 1 ? replaceRunText(p, repeat.find, match => `${index + 1}. ${match[0]}`) : p;
    if (record['PARTY CAPACITY PREFIX']) {
      paragraph = replaceRunText(paragraph, repeat.find, match => record['PARTY CAPACITY PREFIX'] + match[0]);
    }
    if (record['MINOR GUARDIAN RECITAL']) {
      const recital = ', <MINOR GUARDIAN RECITAL>';
      if (/\s*\(Hereinafter|\s+represented herein/i.test(plainText(paragraph))) paragraph = replaceRunText(paragraph, /,?\s*\(Hereinafter|\s+represented herein/i, match => recital + ' ' + match[0].replace(/^,\s*/, ''));
      else paragraph = replaceRunText(paragraph, /[\s\S]+/, match => match[0] + recital);
    }
    if (record['Executant Share'] && /<PRINCIPAL NAME>/i.test(plainText(paragraph)) && !/<Executant Share>/i.test(plainText(paragraph))) {
      paragraph = replaceRunText(paragraph, /<\s*Principal Pin Code\s*>/i, match => match[0] + ', holding an undivided share of <Executant Share> in the schedule property');
    }
    if (record['Attorney Share'] && !/<Attorney Share>/i.test(plainText(paragraph))) {
      paragraph = replaceRunText(paragraph, /<\s*Attorney Pin Code\s*>/i, match => match[0] + ', holding an undivided share of <Attorney Share> in the schedule property');
    }
    if (repeat.finalSuffix && index < repeat.records!.length - 1) paragraph = replaceRunText(paragraph, repeat.finalSuffix, () => '.');
    if (repeat.partyRole && record['UNDIVIDED SHARE RECITAL'] && !/<(?:Executant|Claimant) Share>/i.test(plainText(paragraph))) {
      const panField = repeat.partyRole === 'executant' ? /<Executant PAN>/i : /<Claimant PAN>/i;
      if (panField.test(plainText(paragraph))) paragraph = replaceRunText(paragraph, panField, match => `${match[0]}, ${record['UNDIVIDED SHARE RECITAL']}`);
      else paragraph = replaceRunText(paragraph, /\s*\(Hereinafter called the/i, match => `, ${record['UNDIVIDED SHARE RECITAL']} ${match[0].trimStart()}`);
    }
    if (repeat.partyRole && index < repeat.records!.length - 1) {
      const closing = repeat.partyRole === 'executant'
        ? /,?\s*\(Hereinafter called the "VENDOR\/S"\) of the ONE PART\./i
        : /,?\s*\(Hereinafter called the "VENDEE\/S"\) of the OTHER PART\./i;
      paragraph = replaceRunText(paragraph, closing, () => '.');
    }
    const filled = fillParagraph(paragraph, new Map([...values, ...Object.entries(record).map(([key, value]) => [norm(key), value] as [string, string])]), missing, rewrites.filter(rw => rw !== repeat));
    const completed = repeat.partyRole && index < repeat.records!.length - 1
      ? replaceRunText(filled, /[.,;]{2,}$/, () => '.')
      : filled;
    return repeat.regularWeight ? regularWeight(completed) : completed;
  }).join('');
  // This placeholder is reused by the original template for different concepts.
  if (/WHEREAS[\s\S]*agreed consideration amount/i.test(plainText(p))) {
    const hasDedicatedWordsField = /<\s*Consideration in words\s*>/i.test(plainText(p));
    p = replaceRunText(p, /<Market of Value Rs\.\/->/gi, () => hasDedicatedWordsField ? '<Sale Consideration>' : '<Sale Consideration> <Sale Consideration Words>');
  } else if (/sale consideration|consideration value/i.test(plainText(p))) {
    p = replaceRunText(p, /<Market of Value Rs\.\/->/gi, () => '<Sale Consideration>');
  }
  // The source template reuses the link-deed date in two unrelated recitals.
  // Resolve each occurrence to its own record before filling the paragraph.
  if (/Nala Order:/i.test(plainText(p))) {
    p = replaceRunText(p, /<Link Doct\.Date>/gi, () => '<Nala Order Date>');
  } else if (/Property Tax:/i.test(plainText(p))) {
    p = replaceRunText(p, /<Link Doct\.Date>/gi, () => '<Tax Paid Date>');
  }
  if (/Property Tax:/i.test(plainText(p))) {
    p = replaceRunText(p, /<Village>/gi, () => '<Local Body Name>');
  }
  if (!values.get(norm('Authority Book Number'))) p = replaceRunText(p, /\s+in Book\s*<Authority Book Number>\s*,?/gi, () => ',');
  // The supplied template accidentally uses the housing-loan bank placeholder
  // twice. The second value is the separately collected loan branch.
  if (/Housing Loan:\s*Amount of Rs\./i.test(plainText(p))) {
    p = replaceRunText(p, /<Housing Loan Bank>\s*,\s*<Housing Loan Bank>\s+Branch/i, () => '<Housing Loan Bank>, <Housing Loan Branch> Branch');
    p = replaceRunText(p, /,\s*<Housing Loan Branch>\s+Branch(?=,?\s*Cheque)/i, match =>
      values.get(norm('Housing Loan Branch')) ? match[0] : '');
  }
  // Amounts written in words are consistently parenthesized throughout the deed.
  p = replaceRunText(p, /<\s*(Consideration in words|Sale Consideration Words)\s*>/gi, match => `(${match[0]})`);
  for (const rw of rewrites.filter(rw => !rw.records && (!rw.when || rw.when(p)))) {
    p = replaceRunText(p, rw.find, () => rw.replace);
  }
  // Remove the whole optional phrase, including its comma, while the field
  // name is still available. This works when Word split it across runs.
  p = replaceRunText(p, /,?\s+dated\s*:?\s+<([^<>]*date[^<>]*)>/gi, match =>
    values.get(norm(match[1])) ? match[0] : '');
  p = replaceRunText(p, /\s+on\s+<Date>/gi, match =>
    values.get(norm('Date')) ? match[0] : '');
  if (!values.get(norm('District Registrar'))) p = replaceRunText(p, /\s+and\s+within the Registration District:\s*<District Registrar>/gi, () => '');
  partyWording(plainText(p), Number(values.get(norm('Ownership Vendor Count')) || 1), Number(values.get(norm('Ownership Vendee Count')) || 1), (find, replacement) => { p = replaceRunText(p, find, match => match[0].replace(find, replacement)); }, Number(values.get(norm('Authority Attorney Count')) || values.get(norm('Ownership Vendee Count')) || 1));
  const pronounValues = Object.fromEntries(['Executant Gender', 'Claimant Gender', 'Attorney Gender', 'Ownership Vendor Count', 'Ownership Vendee Count', 'Authority Attorney Count'].map(key => [key, values.get(norm(key)) || '']));
  partyPronouns(plainText(p), pronounValues, (find, replacement) => { p = replaceRunText(p, find, () => replacement); });
  p = removeEmptyFields(p, values, missing);
  p = replaceRunText(p, /<([^<>]{2,60}?)>/g, match => {
    const name = match[1].trim();
    return values.get(norm(name)) || '';
  });
  return replaceRunText(p, /\uE000/g, () => '    ');
}

/** Remove direct bold styling while preserving the template's fonts and size. */
function regularWeight(paragraph: string): string {
  return paragraph
    .replace(/<w:b(?:\s[^>]*)?\/>/g, '<w:b w:val="0"/>')
    .replace(/<w:bCs(?:\s[^>]*)?\/>/g, '<w:bCs w:val="0"/>')
    .replace(/<w:rStyle w:val="Strong"\s*\/>/g, '');
}

function markConsiderationRows(xml: string): string {
  return xml.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, row => {
    const text = plainText(row);
    if (/Total\s+Market\s+Value/i.test(text)) {
      return row.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p =>
        replaceRunText(p, /<Market of Value Rs\.\/->/gi, () => '<Statement of Market Value Consideration>'));
    }
    return /\bConsideration\b/i.test(text)
      ? row.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => replaceRunText(p, /<Market of Value Rs\.\/->/gi, () => '<Sale Consideration>'))
      : row;
  });
}

/** Remove optional source-template title recitals when their source facts are absent. */
function removeOptionalTitleRecitals(body: string, values: Map<string, string>, variant: string): string {
  const has = (...names: string[]) => names.every(name => !!values.get(norm(name)));
  const optional: Array<{ test: RegExp; keep: () => boolean }> = [
    { test: /^Rectification Deed:/i, keep: () => has('Rectification Deed No.') },
    { test: /^Supplemental Deed:/i, keep: () => has('Supplemental Deed No.') },
    { test: /jointly executed a Registered Development Agreement/i, keep: () => has('Document No.') },
    { test: /was allotted to the share of the Vendor/i, keep: () => has('Supplemental Agreement No.') },
    { test: /Registered Deed:/i, keep: () => has('Link Doc Type', 'Link Doct.No.') },
    { test: /Vacant Land Tax\/Assessment/i, keep: () => has('V.L.T. No.') },
    { test: /Approved Layout:/i, keep: () => has('Layout File No.') },
    { test: /Title Deed:/i, keep: () => has('Pattadar Pass Book No', 'Pass Book Khata No') },
    { test: /Nala Order:/i, keep: () => has('Nala Order No') },
    { test: /Property Tax:/i, keep: () => has('House Tax Receipt', 'Local Body Name') },
    { test: /Tax\/Assessment & Identification Particulars:/i, keep: () => has('P.T.I.No.') },
    { test: /House Permission:/i, keep: () => has('House Permission No.', 'Municipality/Gram Panchayat Name') },
    { test: /L\.R\.S\.-2020 Application:/i, keep: () => has('LRS Application No.') },
    { test: /L\.R\.S\. Proceeding:/i, keep: () => has('LRS Proceeding No.') },
  ];
  return topLevelChildren(body).map(child => {
    const chunk = body.slice(child.start, child.end);
    const titleText = plainText(chunk);
    if (/Tax\/Assessment & Identification Particulars:/i.test(titleText)) {
      const partRecital = /\(Part\)/i.test(titleText);
      if (partRecital !== (variant === 'IF PART OPEN PLACE')) return '';
    }
    const rule = optional.find(item => item.test.test(titleText));
    if (rule && !rule.keep()) return '';
    if (/jointly executed a Registered Development Agreement/i.test(titleText) && !has('Stilt Floors') && !has('Upper Floors')) {
      return replaceRunText(chunk, /for the development and construction of\s*<Stilt Floors>\s*Stilt\s*\+\s*<Upper Floors>\s*Upper Floors/i, () => 'for the development and construction');
    }
    return chunk;
  }).join('');
}

function amendmentRewrites(schedule: ScheduleMerge): Rewrite[] {
  return (['rectification', 'supplemental'] as const).flatMap(kind => {
    const records = schedule.amendmentRecords?.[kind];
    return records?.length ? [{ find: new RegExp('^' + kind + ' Deed:', 'i'), replace: '', records }] : [];
  });
}

function assertTitleAmendmentBindings(xml: string, schedules: ScheduleMerge[]): void {
  const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
  for (const kind of ['rectification', 'supplemental'] as const) {
    if (!schedules.some(schedule => schedule.amendmentRecords?.[kind].length)) continue;
    const paragraph = paragraphs.find(p => new RegExp('^' + kind + ' Deed:', 'i').test(plainText(p).trim()));
    const present = new Set(paragraph ? angleTags(paragraph).map(norm) : []);
    const missing = Object.keys(titleAmendmentValues({}, kind)).filter(key => !present.has(norm(key)));
    if (missing.length) throw new Error(`The selected Word template would omit ${kind} deed details. Restore its ${kind} recital and bindings (${missing.join(', ')}), or select the current default. Entered records are preserved.`);
  }
}
/** Keep the property-appropriate operative clauses when a v2 template supplies both blocks. */
function selectOperativeClauses(body: string, variant: string): string {
  const children = topLevelChildren(body);
  const textAt = (index: number) => plainText(body.slice(children[index].start, children[index].end)).trim();
  const vacantMarker = children.findIndex((_, index) => textAt(index) === OPERATIVE_CLAUSE_MARKERS[0]);
  const houseMarker = children.findIndex((_, index) => textAt(index) === OPERATIVE_CLAUSE_MARKERS[1]);
  if (vacantMarker < 0 && houseMarker < 0) return body; // v1/custom templates retain their author-selected clauses.
  if (vacantMarker < 0 || houseMarker < 0 || vacantMarker >= houseMarker) {
    throw new Error('Template operative-clause markers are missing or damaged.');
  }
  const firstSchedule = children.findIndex((_, index) => VARIANTS.some(marker => textAt(index) === `<${marker}>`));
  if (firstSchedule < 0 || houseMarker >= firstSchedule) {
    throw new Error('Template operative-clause markers are not before the schedule sections.');
  }
  const keepHouse = variant === 'IF HOUSE' || variant === 'IF FLAT';
  const kept = children.filter((_, index) =>
    index < vacantMarker
    || (keepHouse ? index > houseMarker && index < firstSchedule : index > vacantMarker && index < houseMarker)
    || index >= firstSchedule
  );
  return kept.map(child => body.slice(child.start, child.end)).join('');
}

type PreparedTemplate = { body: string; titles: Record<string, string>; clauses: Record<string, string> };

/** Use one fresh source-styled list per schedule: the final reference splits
 * its semi-finished clauses across lists that start at 1, 5 and 13. */
function restartClauseNumbering(block: string, entries: Entry[]): string {
  const first = block.match(/<w:numId\b[^>]*w:val="(\d+)"[^>]*\/>/);
  if (!first) return block;
  const numbering = entries.find(entry => entry.name === 'word/numbering.xml');
  if (!numbering) throw new Error('Template is missing its clause numbering definitions.');
  let xml = new TextDecoder().decode(numbering.data);
  const definitions = [...xml.matchAll(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>[\s\S]*?<\/w:num>/g)];
  const original = definitions.find(match => match[1] === first[1]);
  const abstract = original?.[0].match(/<w:abstractNumId\b[^>]*w:val="(\d+)"/);
  if (!abstract) throw new Error('Template clause numbering is damaged.');
  const id = Math.max(0, ...definitions.map(match => Number(match[1]))) + 1;
  const definition = `<w:num w:numId="${id}"><w:abstractNumId w:val="${abstract[1]}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`;
  xml = xml.replace('</w:numbering>', definition + '</w:numbering>');
  numbering.data = new TextEncoder().encode(xml);
  return block.replace(/<w:numId\b[^>]*w:val="\d+"[^>]*\/>/g, `<w:numId w:val="${id}"/>`);
}

/** The supplied final draft has complete flat deeds and unmarked land schedules.
 * Keep its actual XML paragraphs/tables, arranging them into the merge contract. */
function prepareTemplate(body: string): PreparedTemplate {
  // Recognise supported section-label spellings consistently in validation and merge.
  body = body.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const text = plainText(paragraph).trim();
    if (!/^<[^<>]+>$/.test(text)) return paragraph;
    const name = conditionName(text);
    const canonical = CONDITION_ALIASES[name] || name;
    if (text !== `<${canonical}>` && STRUCTURAL_TAGS.has(norm(canonical)) && conditionTag(canonical) && !/<w:(?:tbl|drawing|txbxContent)\b/.test(paragraph)) return replaceRunText(paragraph, /[\s\S]+/, () => `<${canonical}>`);
    return paragraph;
  });
  // Numeric examples are editable slots, including legacy single-digit tags.
  body = body.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    if (/Stilt|Upper Floors/.test(plainText(paragraph))) {
      paragraph = replaceRunText(paragraph, /<1>/g, () => '<Stilt Floors>');
      paragraph = replaceRunText(paragraph, /<5>/g, () => '<Upper Floors>');
    }
    if (/Car Parking/i.test(plainText(paragraph))) paragraph = replaceRunText(paragraph, /<100>/g, () => '<Car Parking Area>');
    if (/RTGS\/NEFT:/i.test(plainText(paragraph))) paragraph = replaceRunText(paragraph, /Transaction No\.\/UTR No\.(?=\s+dated)/i, () => 'Transaction No./UTR No. <Utr/Reference No.>');
    return paragraph;
  });
  const children = topLevelChildren(body);
  const chunks = children.map(child => body.slice(child.start, child.end));
  const text = chunks.map(chunk => plainText(chunk).trim());
  const titles: Record<string, string> = {}, clauses: Record<string, string> = {};
  const land = text.indexOf('<IF OPEN PLACE/VACANT PLOT/PART OPEN PLACE/DEMOLISHED HOUSE>');
  if (land < 0 || text.includes('<IF OPEN PLACE>')) return { body, titles, clauses };
  const house = text.indexOf('<IF HOUSE>');
  const houseSemi = text.indexOf('<IF HOUSE SEMI FINISHED>');
  const semi = text.indexOf('<IF FLAT SEMI FINISHED>');
  const finished = text.indexOf('<IF FLAT FINISHED>');
  const tail = text.findIndex((value, index) => index > finished && value === 'DECLARATION');
  const flow = text.findIndex(value => /^(?:1\.\s*)?FLOW OF TITLE & LINK DEED DETAILS:/.test(value));
  const payment = text.findIndex(value => /^2\.\s*CONSIDERATION & PAYMENT TERMS:/.test(value));
  const landSchedules = text.map((value, index) => value === 'SCHEDULE OF PROPERTY' && index > land && index < house ? index : -1).filter(index => index >= 0);
  const houseSchedule = text.findIndex((value, index) => value === 'SCHEDULE OF PROPERTY' && index > house && index < semi);
  if (flow < 0 || payment <= flow || landSchedules.length !== 4 || houseSchedule < 0 || semi <= house || finished <= semi || tail < 0) throw new Error('Final template deed sections are missing or damaged.');
  const join = (start: number, stop: number) => chunks.slice(start, stop).join('');
  const trimBlock = (start: number, stop: number) => {
    while (stop > start && !text[stop - 1] && !/<w:(?:tbl|drawing|br)\b/.test(chunks[stop - 1])) stop--;
    return join(start, stop);
  };
  const marker = (name: string) => paragraphLike(chunks[semi], `<${name}>`);
  const schedules: Record<string, string> = {};
  const landNames = ['IF OPEN PLACE', 'IF OPEN PLOT', 'IF DIMOLISHED HOUSE', 'IF PART OPEN PLACE'];
  landNames.forEach((name, index) => {
    schedules[name] = trimBlock(landSchedules[index], landSchedules[index + 1] ?? house);
    clauses[name] = trimBlock(land + 1, landSchedules[0]);
  });
  schedules['IF HOUSE'] = trimBlock(houseSchedule, houseSemi >= 0 ? houseSemi : semi);
  if (houseSemi >= 0) {
    const semiSchedule = text.findIndex((value, index) => index > houseSemi && index < semi && value === 'SCHEDULE OF PROPERTY');
    if (semiSchedule < 0) throw new Error('Semi-finished house schedule is missing.');
    clauses['IF HOUSE SEMI FINISHED'] = trimBlock(houseSemi + 1, semiSchedule);
    schedules['IF HOUSE SEMI FINISHED'] = trimBlock(semiSchedule, semi);
  }
  clauses['IF HOUSE'] = trimBlock(house + 1, houseSchedule);
  for (const [name, start, stop] of [['IF FLAT SEMI FINISHED', semi, finished], ['IF FLAT FINISHED', finished, tail]] as const) {
    const pay = text.findIndex((value, index) => index > start && index < stop && /^2\.\s*CONSIDERATION & PAYMENT TERMS:/.test(value));
    const operative = text.findIndex((value, index) => index > pay && index < stop && /^3\.\s*OPERATIVE CLAUSES & COVENANTS:/.test(value));
    const schedule = text.findIndex((value, index) => index > operative && index < stop && value === 'SCHEDULE OF PROPERTY');
    if (pay < 0 || operative < 0 || schedule < 0) throw new Error(`Final template ${name} sections are missing or damaged.`);
    titles[name] = join(start + 1, pay).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph =>
      /^(?:1\.\s*)?FLOW OF TITLE & LINK DEED DETAILS:/.test(plainText(paragraph).trim())
        ? replaceRunText(paragraph, /^(?:1\.\s*)?FLOW OF TITLE & LINK DEED DETAILS:/, () => '1. FLOW OF TITLE & LINK DEED DETAILS:') : paragraph);
    // The refreshed source places amendment prose in its common title block.
    // Reuse those exact styled paragraphs in its standalone flat branches too.
    const amendments = chunks.slice(flow + 1, payment).filter(chunk => /^(?:Rectification|Supplemental) Deed:/i.test(plainText(chunk).trim()));
    if (amendments.length && !/(?:Rectification|Supplemental) Deed:/i.test(plainText(titles[name]))) {
      titles[name] = titles[name].replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => /^Registered Deed:/i.test(plainText(paragraph).trim()) ? paragraph + amendments.join('') : paragraph);
    }
    // The supplemental agreement is independent of the registered title deed.
    titles[name] = titles[name].replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph =>
      /was allotted to the share of the Vendor/i.test(plainText(paragraph))
        ? replaceRunText(paragraph, /<Link Doct\.No\.>/g, () => '<Supplemental Agreement No.>') : paragraph);
    clauses[name] = trimBlock(operative, schedule);
    schedules[name] = trimBlock(schedule, stop);
  }
  // The approved finished-flat source omits these recitals. Reuse its own
  // semi-finished paragraphs, including run formatting, for both flat stages.
  const agreementTests = [/jointly executed a Registered Development Agreement/i, /was allotted to the share of the Vendor/i];
  const agreementParagraphs = (titles['IF FLAT SEMI FINISHED'].match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [])
    .filter(paragraph => agreementTests.some(test => test.test(plainText(paragraph))));
  const finishedTitle = titles['IF FLAT FINISHED'];
  const missingAgreements = agreementParagraphs.filter(paragraph => {
    const test = agreementTests.find(test => test.test(plainText(paragraph)))!;
    return !test.test(plainText(finishedTitle));
  }).join('');
  if (missingAgreements) {
    const buyerRecital = topLevelChildren(finishedTitle).find(child => /WHEREAS[\s\S]*Vendee[\s\S]*after duly satisfying/i.test(plainText(finishedTitle.slice(child.start, child.end))));
    const insertion = buyerRecital?.start ?? finishedTitle.length;
    titles['IF FLAT FINISHED'] = finishedTitle.slice(0, insertion) + missingAgreements + finishedTitle.slice(insertion);
  }
  return { body: join(0, land) + Object.entries(schedules).map(([name, block]) => marker(name) + block).join('') + join(tail, chunks.length), titles, clauses };
}

/** Restore application-required flat records even when both source branches omit them. */
async function preserveFlatAgreementRecitals(block: string, values: Map<string, string>, variant: string): Promise<string> {
  if (!variant.startsWith('IF FLAT')) return block;
  const required: [RegExp, string][] = [[/jointly executed a Registered Development Agreement/i, 'Document No.'], [/was allotted to the share of the Vendor/i, 'Supplemental Agreement No.']];
  const missing = required.filter(([test, binding]) => values.get(norm(binding)) && !test.test(plainText(block)));
  if (!missing.length) return block;
  const approved = await readZip(await loadTemplate('sale-deed-v10'));
  const xml = new TextDecoder().decode(approved.find(entry => entry.name === 'word/document.xml')!.data);
  const body = xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>'));
  const reference = prepareTemplate(body).titles['IF FLAT SEMI FINISHED'];
  const candidates = reference?.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
  const children = topLevelChildren(block);
  const buyer = children.find(child => /WHEREAS[\s\S]*Vendee[\s\S]*after duly satisfying/i.test(plainText(block.slice(child.start, child.end))));
  const style = buyer ? block.slice(buyer.start, buyer.end) : block.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/)?.[0];
  if (!style) throw new Error('The replacement cannot safely restore the required flat agreement recitals. Retain a title recital paragraph.');
  const restored = missing.map(([test]) => {
    const source = candidates.find(paragraph => test.test(plainText(paragraph)));
    if (!source) throw new Error('The approved flat agreement recital is unavailable.');
    return paragraphLike(style, plainText(source));
  }).join('');
  const at = buyer?.start ?? block.length;
  return block.slice(0, at) + restored + block.slice(at);
}

/** Template revisions supply wording, but cannot override party-count/share rules. */
function enforcePartySharePolicy(body: string, values: Record<string, string>): string {
  const chunks = topLevelChildren(body).map(child => body.slice(child.start, child.end));
  const flow = chunks.findIndex(chunk => /^(?:1\.\s*)?FLOW OF TITLE & LINK DEED DETAILS:/.test(plainText(chunk).trim()));
  if (flow < 0) return body; // Structural validation reports an absent title boundary.
  return chunks.map((chunk, index) => {
    if (index >= flow) return chunk; // Flat land UDS and property schedules are independent.
    return chunk.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
      const text = plainText(paragraph);
      const side = /<\s*CLAIMANT NAME\s*>/i.test(text) ? 'Vendee' : /<\s*(?:EXECUTANT|PRINCIPAL|ATTORNEY) NAME\s*>/i.test(text) ? 'Vendor' : '';
      if (!side || !values[`Ownership ${side} Count`]) return paragraph;
      const tag = side === 'Vendee' ? 'Claimant Share' : /<\s*ATTORNEY NAME\s*>/i.test(text) ? 'Attorney Share' : 'Executant Share';
      const expected = [...text.matchAll(/holding\s+(?:(?:an?\s+)?undivided\s+shares?\b|\d+(?:\.\d+)?\s*%\s+(?:ownership\s+)?shares?\b)/gi)].length;
      let handled = 0;
      // Accept source placeholders or fixed percentages; actual values always come from the draft.
      const patterns = [
        /,?\s*holding\s+(?:an?\s+)?undivided\s+shares?\s+of\s*(?:<[^<>]+>|\d+(?:\.\d+)?\s*%)(?:\s+in\s+(?:the\s+)?schedule(?:d)?\s+property)?\.?/gi,
        /,?\s*holding\s+\d+(?:\.\d+)?\s*%\s+(?:ownership\s+)?shares?(?:\s+in\s+(?:the\s+)?schedule(?:d)?\s+property)?\.?/gi,
      ];
      for (const pattern of patterns) paragraph = replaceRunText(paragraph, pattern, () => {
        handled++;
        return tag !== 'Attorney Share' && values[`Ownership ${side} Enabled`] === 'false' ? '.' : `, holding an undivided share of <${tag}> in the schedule property.`;
      });
      if (expected > handled) throw new Error(`The ${side.toLowerCase()} share clause in this template is not supported. Correct its share wording before generating or publishing; ownership percentages must come from the draft.`);
      return paragraph;
    });
  }).join('');
}

async function selectAuthorityDeclaration(body: string, values: Record<string, string>): Promise<string> {
  const chunks = topLevelChildren(body).map(child => body.slice(child.start, child.end));
  const texts = chunks.map(chunk => plainText(chunk).trim());
  const start = texts.indexOf(`<${AUTHORITY_DECLARATION_START}>`);
  const end = texts.indexOf(`<${AUTHORITY_DECLARATION_END}>`);
  if (start < 0 && end < 0) {
    if (!['gpa', 'agpa'].includes(values['Sale Document Mode'])) return body;
    // Older/replacement Word files cannot silently remove the approved declaration.
    const approved = await readZip(await loadTemplate('sale-deed-v10'));
    const document = approved.find(entry => entry.name === 'word/document.xml');
    if (!document) throw new Error('The approved GPA/AGPA declaration is unavailable.');
    const xml = new TextDecoder().decode(document.data);
    const approvedBody = xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>'));
    const approvedChunks = topLevelChildren(approvedBody).map(child => approvedBody.slice(child.start, child.end));
    const first = approvedChunks.findIndex(chunk => plainText(chunk).trim() === `<${AUTHORITY_DECLARATION_START}>`);
    const last = approvedChunks.findIndex(chunk => plainText(chunk).trim() === `<${AUTHORITY_DECLARATION_END}>`);
    const signature = texts.findIndex((text, index) => /SIGN\/S OF (?:THE )?VENDOR\/S/i.test(text) && texts.slice(0, index).some(value => /^DECLARATION$/i.test(value)));
    if (first < 0 || last <= first || signature < 0) throw new Error('This template cannot safely place the required GPA/AGPA declaration. Retain the declaration and vendor signature sections from the latest default.');
    chunks.splice(signature, 0, ...approvedChunks.slice(first + 1, last));
    return chunks.join('');
  }
  if (start < 0 || end <= start) throw new Error('The GPA/AGPA declaration condition is incomplete.');
  const declaration = texts.slice(start + 1, end).join(' ');
  if (!declaration.includes('<Authority Holder Label>') || !declaration.includes('<Authority Principal Names>')) throw new Error('The GPA/AGPA declaration must retain Authority Holder Label and Authority Principal Names.');
  const include = ['gpa', 'agpa'].includes(values['Sale Document Mode']);
  return chunks.filter((_, index) => index < start || index > end || (include && index > start && index < end)).join('');
}

async function selectSaleOpening(body: string, values: Record<string, string>): Promise<string> {
  const mode = values['Sale Document Mode'] || 'ordinary';
  const children = topLevelChildren(body);
  const chunks = children.map(child => body.slice(child.start, child.end));
  const text = chunks.map(chunk => plainText(chunk).trim());
  const markers = ['<IF SALE DEED>', '<IF SALE DEED WITH G.P.A>', '<IF SALE DEED WITH A.G.P.A>'];
  const starts = markers.map(marker => text.indexOf(marker));
  if (starts.every(index => index < 0)) {
    if (mode !== 'ordinary') throw new Error('This template does not support sale through GPA/AGPA. Select the v7 template.');
    return body;
  }
  const flow = text.findIndex(value => /^1\.\s*FLOW OF TITLE & LINK DEED DETAILS:/.test(value));
  if (starts.some(index => index < 0) || flow <= starts[2]) throw new Error('Sale opening markers are incomplete or out of order.');
  const selected = mode === 'gpa' ? 1 : mode === 'agpa' ? 2 : 0;
  let opening = chunks.slice(starts[selected] + 1, selected === 2 ? flow : starts[selected + 1]).join('');
  if (selected) {
    // A replacement draft must not turn confirmed authority identities into static text.
    const approved = await readZip(await loadTemplate('sale-deed-v10'));
    const reference = new TextDecoder().decode(approved.find(entry => entry.name === 'word/document.xml')!.data);
    const referenceBody = reference.slice(reference.indexOf('<w:body>') + 8, reference.lastIndexOf('</w:body>'));
    const sections = topLevelChildren(referenceBody).map(child => referenceBody.slice(child.start, child.end));
    const first = sections.findIndex(chunk => plainText(chunk).trim() === markers[selected]);
    const last = sections.findIndex((chunk, index) => index > first && (plainText(chunk).trim() === markers[selected + 1] || /^1\.\s*FLOW OF TITLE & LINK DEED DETAILS:/.test(plainText(chunk).trim())));
    const required = angleTags(sections.slice(first + 1, last).join('')).filter(tag => !/share/i.test(tag));
    const present = new Set(angleTags(opening).map(norm));
    const missing = [...new Set(required)].filter(tag => !present.has(norm(tag)));
    if (missing.length) throw new Error(`This replacement template would omit GPA/AGPA details: ${missing.join(', ')}. Restore these fields from the latest default before downloading.`);
  }
  if (selected) opening = opening.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    if (!/<ATTORNEY NAME>/i.test(plainText(paragraph))) return paragraph;
    paragraph = replaceRunText(paragraph, /<Sub Registrar>/gi, () => '<Authority SRO>');
    paragraph = replaceRunText(paragraph, /<Sub Registrar Code>/gi, () => '<Authority SRO Code>');
    // Explicit links remain visible when several principals appoint different attorneys.
    return /<Represented Principals>/i.test(plainText(paragraph)) ? paragraph : replaceRunText(paragraph, /<ATTORNEY NAME>/i, () => '<ATTORNEY NAME> (representing <Represented Principals>)');
  });
  let resultBody = chunks.slice(0, starts[0]).join('') + opening + chunks.slice(flow).join('');
  // The ordinary opening owns the source's footer relationship. The other
  // openings inherit that footer in Word and must retain it after selection.
  for (const type of ['headerReference', 'footerReference']) {
    const refs = body.match(new RegExp(`<w:${type}\\b[^>]*/>`, 'g')) || [];
    if (refs.length && !new RegExp(`<w:${type}\\b`).test(resultBody)) resultBody = resultBody.replace(/<w:sectPr\b[^>]*>/, tag => tag + [...new Set(refs)].join(''));
  }
  return resultBody;
}

function selectedTemplateVariant(variant: string, markers: Map<string, number>, values: Record<string, string>): string {
  if (markers.has(variant)) return variant;
  if (variant === 'IF HOUSE SEMI FINISHED' && markers.has('IF HOUSE')) throw new Error('This template has no semi-finished house section. Upgrade the draft to v7.');
  if (FLAT_VARIANTS.includes(variant) && markers.has('IF FLAT')) return 'IF FLAT';
  if (variant === 'IF FLAT') {
    const selected = flatVariant(values.Stage || '');
    if (markers.has(selected)) return selected;
    throw new Error('Choose Finished Flat or Semi-finished Flat before downloading this deed.');
  }
  throw new Error(`Template does not contain the selected ${variant} schedule.`);
}

// ------------------------------------------------------------------- the merge

/**
 * Plain text of a .docx, for handing an uploaded document to the model.
 * Reuses the same zip reader and run-flattening the deed merge relies on.
 */
export async function docxToText(bytes: Uint8Array): Promise<string> {
  const entries = await readZip(bytes);
  const doc = entries.find(e => e.name === 'word/document.xml');
  if (!doc) throw new Error('Not a Word document (no word/document.xml).');
  const xml = new TextDecoder().decode(doc.data);
  // One line per paragraph so the model sees the document's structure.
  return (xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [])
    .map(p => plainText(p).trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Plain text of just the selected SCHEDULE OF PROPERTY block, filled with
 * `values` — the same template paragraph `fillSaleDeed` will use for the real
 * document, so a preview of it reads exactly like the generated deed will.
 * Reuses the same zip reader, paragraph splitter and run-filler as the full
 * merge below; no separate parsing logic.
 */
export async function scheduleText(
  variant: string,
  values: Record<string, string>,
  supportingRecords: string[] = [],
  structureDetails?: StructureDetails,
  vendeeShares?: VendeeShare[],
  vendorShares?: VendeeShare[],
  templateSource: DeedTemplateSource = BUILT_IN_TEMPLATE_SOURCE,
): Promise<string> {
  const bin = await templateBytes(templateSource);
  const entries = await readZip(bin);
  const doc = entries.find(e => e.name === 'word/document.xml');
  if (!doc) throw new Error('Template is missing word/document.xml.');
  const xml = new TextDecoder().decode(doc.data);
  const bodyStart = xml.indexOf('<w:body>') + '<w:body>'.length;
  const bodyEnd = xml.lastIndexOf('</w:body>');
  if (plainText(xml).includes('AGREEMENT OF SALE-CUM-GPA')) {
    const selected = agreementTemplateParts(xml).blocks.get(variant);
    if (!selected) throw new Error(`No Agreement of Sale Cum GPA schedule is available for ${variant}.`);
    const block = prepareLandmarkBlock(addOwnershipShareParagraphs(['IF HOUSE', 'IF HOUSE SEMI FINISHED'].includes(variant)
      ? prepareHouseBlock(selected, values, structureDetails) : prepareNonHouseIdentifiers(selected, variant, values), vendorShares, vendeeShares), values, variant);
    const record = { ...values };
    if (variant.startsWith('IF FLAT') && record.UDS) record['Extent in Sq.Meters'] = (Number(record.UDS.replace(/,/g, '')) * 0.836127).toFixed(2);
    return (block.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || []).map(paragraph => plainText(fillParagraph(paragraph, new Map(Object.entries(record).map(([key, value]) => [norm(key), value])), new Set(), [])).trim()).filter(Boolean).join('\n\n');
  }
  if (Object.hasOwn(values, 'ULB')) {
    const { blocks } = giftTemplateParts(xml.slice(bodyStart, bodyEnd), true);
    const selected = blocks.get(variant);
    if (!selected) throw new Error('Choose a supported Municipal Gift land-property type.');
    const block = prepareLandmarkBlock(addOwnershipShareParagraphs(prepareNonHouseIdentifiers(selected, variant, values), vendorShares, undefined), values, variant).replace(/The vendors convey/gi, 'The Donors gift');
    const mapped = new Map(Object.entries(values).map(([key, value]) => [norm(key), value ?? '']));
    return (block.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || []).map(paragraph => plainText(fillParagraph(paragraph, mapped, new Set(), [])).trim()).filter(Boolean).join('\n\n');
  }
  const body = prepareTemplate(xml.slice(bodyStart, bodyEnd)).body;

  const children = topLevelChildren(body);
  const markerAt = new Map<string, number>();
  children.forEach((c, i) => {
    const t = plainText(body.slice(c.start, c.end)).trim();
    for (const v of ALL_VARIANTS) if (t === `<${v}>`) markerAt.set(v, i);
  });
  variant = selectedTemplateVariant(variant, markerAt, values);

  const order = ALL_VARIANTS
    .filter(v => markerAt.has(v))
    .map(v => ({ v, i: markerAt.get(v)! }))
    .sort((a, b) => a.i - b.i);
  const idx = order.findIndex(o => o.v === variant);
  const start = order[idx].i + 1; // skip the <IF ...> marker paragraph itself
  const sharedTail = children.findIndex((c, i) =>
    i > order[order.length - 1].i && ['<FOR ALL THE DOCUMENTS>', 'DECLARATION'].includes(plainText(body.slice(c.start, c.end)).trim())
  );
  const stop = idx + 1 < order.length ? order[idx + 1].i : sharedTail >= 0 ? sharedTail : children.length;

  const values_ = new Map<string, string>();
  for (const [k, v] of Object.entries(values)) values_.set(norm(k), v ?? '');
  const missing = new Set<string>();

  const selected = markConsiderationRows(children.slice(start, stop).map(c => body.slice(c.start, c.end)).join(''));
  const withEvidence = prepareLandmarkBlock(addOwnershipShareParagraphs(['IF HOUSE', 'IF HOUSE SEMI FINISHED'].includes(variant)
    ? prepareHouseBlock(selected, values, structureDetails)
    : prepareNonHouseIdentifiers(selected, variant, values), vendorShares, vendeeShares), values, variant);
  return (withEvidence.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [])
    .map(paragraph => plainText(fillParagraph(paragraph, values_, missing, [])).trim())
    .filter(Boolean)
    .join('\n\n').replace(/\uE100[^\uE101]*\uE101/g, '');
}

export type MergeResult = {
  blob: Blob;
  /** Placeholders the template wanted that the form had no value for. */
  missing: string[];
  /** Placeholders in the template that no field maps to. */
  unmapped: string[];
};

export type ScheduleMerge = {
  variant: string;
  values: Record<string, string>;
  /** Flow-of-title values and registered link deeds owned by this schedule. */
  titleValues?: Record<string, string>;
  titleLinkRecords?: Record<string, string>[];
  amendmentRecords?: { rectification: Record<string, string>[]; supplemental: Record<string, string>[] };
  /** Source-backed recitals shown only when supporting files were uploaded. */
  supportingRecords?: string[];
  /** Repeatable Annexure I-A rows belonging only to this property schedule. */
  structureDetails?: StructureDetails;
  vendorShares?: VendeeShare[];
  vendeeShares?: VendeeShare[];
};

export type VendeeShare = { partyNumber: number; name: string; percentage: string };

/** Place each side's ownership allocation inside its schedule, after the boundaries. */
function addOwnershipShareParagraphs(block: string, vendorShares?: VendeeShare[], vendeeShares?: VendeeShare[]): string {
  vendorShares = vendorShares?.filter(share => share.percentage.trim());
  vendeeShares = vendeeShares?.filter(share => share.percentage.trim());
  if (!vendorShares?.length && !vendeeShares?.length) return block;
  const children = topLevelChildren(block);
  const boundary = children.find(child => {
    const chunk = block.slice(child.start, child.end);
    return /North\s*:/i.test(plainText(chunk)) && /West\s*:/i.test(plainText(chunk));
  });
  if (!boundary) throw new Error('Template schedule boundaries are missing; ownership shares could not be placed.');
  const description = children.map(child => block.slice(child.start, child.end))
    .find(chunk => /^\s*All that the\b/i.test(plainText(chunk)));
  const properties = description?.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] || '<w:pPr/>';
  const paragraph = (shares: VendeeShare[], side: 'vendors' | 'vendees') => {
    const allocations = shares.map(share => `(${share.partyNumber}) ${share.name || '________________'} — ${share.percentage}%`).join('; ');
    const sentence = `The ${side} ${side === 'vendors' ? 'convey' : 'acquire'} this Schedule Property in the following undivided shares: ${allocations}.`;
    return `<w:p>${properties}<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${escapeXml(sentence)}</w:t></w:r></w:p>`;
  };
  const paragraphs = (vendorShares?.length ? paragraph(vendorShares, 'vendors') : '') + (vendeeShares?.length ? paragraph(vendeeShares, 'vendees') : '');
  return block.slice(0, boundary.end) + paragraphs + block.slice(boundary.end);
}

/** Add compact name-free writing lines under the source signature headings. */
function addPartySignatureLines(body: string, values: Map<string, string>, rewrites: Rewrite[]): string {
  const partyRewrite = (role: 'executant' | 'claimant') => rewrites.find(rewrite => rewrite.partyRole === role);
  const attorneyCount = Number(values.get(norm('Authority Attorney Count')) || 0);
  const vendors = values.get(norm('Sale Document Mode')) !== 'ordinary' && attorneyCount > 0 ? Array.from({ length: attorneyCount }, () => '') : partyRewrite('executant')?.records?.map(record => record['EXECUTANT NAME'] || '')
    || [values.get(norm('EXECUTANT NAME')) || ''];
  const vendees = partyRewrite('claimant')?.records?.map(record => record['CLAIMANT NAME'] || '')
    || [values.get(norm('CLAIMANT NAME')) || ''];
  const heading = topLevelChildren(body).find(child =>
    /SIGN(?:\/S|ATURES?)\s+OF\s+(?:THE\s+)?VENDOR(?:\/S|S)?[\s\S]*SIGN(?:\/S|ATURES?)\s+OF\s+(?:THE\s+)?VENDEE(?:\/S|S)?/i.test(plainText(body.slice(child.start, child.end)))
  );
  if (!heading) throw new Error('Template signature headings are missing; party signature lines could not be placed.');
  const lines = Array.from({ length: Math.max(vendors.length, vendees.length) }, (_, index) => {
    const vendor = index < vendors.length ? '________________' : '';
    const vendee = index < vendees.length ? '________________' : '';
    const cell = (value: string) => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p></w:tc>`;
    return `<w:tr>${cell(vendor)}${cell(vendee)}</w:tr>`;
  }).join('');
  const table = `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid>${lines}</w:tbl>`;
  return body.slice(0, heading.end) + table + body.slice(heading.end);
}

/** Fill the source house layout without adding a second table after Annexure I-A. */
function prepareHouseBlock(block: string, values: Record<string, string>, details?: StructureDetails): string {
  const rows = details?.rows || [];
  const floorRows = rows.filter(row => row.floorNo.trim());
  const floorName = (name: string) => {
    const number = name.match(/^Floor(?: No\.)?\s+(\d+)$/i);
    if (!number) return /^Ground$/i.test(name) ? 'Ground Floor' : name;
    const ordinal = ['','First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth'];
    return Number(number[1]) < ordinal.length ? `${ordinal[Number(number[1])]} Floor` : name;
  };
  const structureName = (row: StructureDetails['rows'][number]) =>
    row.structureType === 'Other / Custom Structure' ? row.customStructureType || values['Roof Material'] || ''
      : STRUCTURE_TYPE_OPTIONS.includes(row.structureType) ? values['Roof Material'] || ''
        : row.structureType || values['Roof Material'] || '';
  const filled = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, original => {
    const text = plainText(original);
    let paragraph = original;
    if (/^\s*All that the\b/i.test(text) && /having a plinth area[\s\S]*consisting of Ground Floor/i.test(text)) {
      const colon = /Ground Floor:/i.test(text);
      const floors = floorRows.map(floor => `${floorName(floor.floorNo)}${colon ? ':' : ','} ${floor.builtUpAreaSqFt ? Number(floor.builtUpAreaSqFt.replace(/,/g, '')).toLocaleString('en-IN') + ' square feet' : 'area not supplied'}`).join('; ');
      paragraph = replaceRunText(paragraph, /having a plinth area[\s\S]*?(?=\s+in plot no\.)/i, () => floors ? `consisting of ${floors}${colon ? ',' : ''}` : '');
    }
    // Keep the house schedule opening and floor-table heading with their content.
    if (/SCHEDULE OF PROPERTY|Description of the property hereby sold|^\s*All that the\b|BUILDING\s*\/\s*FLOOR DETAILS/i.test(text) && !/<w:keepNext\b/.test(paragraph)) {
      paragraph = /<w:pPr(?:\s[^>]*)?>/.test(paragraph)
        ? paragraph.replace(/<w:pPr(?:\s[^>]*)?>/, tag => tag + '<w:keepNext/>')
        : paragraph.replace(/<w:p(?:\s[^>]*)?>/, tag => tag + '<w:pPr><w:keepNext/></w:pPr>');
    }
    if (text.includes('<Nature of House>') && /roof house/i.test(text)) {
      paragraph = replaceRunText(paragraph, /<Nature of House>\s+roof house/gi,
        () => values['Nature of House'] ? '<Nature of House>' : 'house');
    }
    if (/^\s*All that the\b/i.test(text) && /<Plinth Area>/i.test(text)) {
      const floorSummary = rows.filter(row => row.floorNo).map(row => {
        const parts = [structureName(row), row.builtUpAreaSqFt ? `${row.builtUpAreaSqFt} square feet` : ''].filter(Boolean);
        return `${floorName(row.floorNo)}${parts.length ? ` (${parts.join(', ')})` : ''}`;
      }).join(', ');
      paragraph = replaceRunText(paragraph,
        /,?\s*having a plinth area of <\s*Plinth Area\s*> square feets consisting of (?:<Floors> Floor\/s|Ground Floor: <Ground Floor Area> square feets First Floor: <First Floor Area> square feets)/i,
        () => floorSummary ? `, consisting of ${floorSummary}` : '');
    }
    if (/^\s*:\s*<Nature Of House>\s*$/i.test(text)) {
      return replaceRunText(paragraph, /<Nature Of House>/i, () => '<Roof Material>');
    }
    if (/^\s*:\s*Framed with walls only\s*$/i.test(text)) {
      return replaceRunText(paragraph, /Framed with walls only/i, () => '<Construction Description>');
    }
    return paragraph;
  });
  const areaText = (value: string) => {
    if (!value.trim()) return '';
    const number = Number(value.replace(/,/g, ''));
    return `${Number.isFinite(number) ? number.toLocaleString('en-IN') : value.trim()} Sq.Ft.`;
  };
  const keepRowTogether = (row: string) => {
    if (/<w:cantSplit\b/.test(row)) return row;
    return /<w:trPr(?:\s[^>]*)?>/.test(row)
      ? row.replace(/<w:trPr(?:\s[^>]*)?>/, match => `${match}<w:cantSplit/>`)
      : row.replace(/<w:tr(?:\s[^>]*)?>/, match => `${match}<w:trPr><w:cantSplit/></w:trPr>`);
  };
  // The revised draft's five-column schedule table contains example floors.
  // Use its first body row as the styled prototype for the actual floor count.
  const withFloorTable = filled.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, table => {
    if (/Built-up area of the property/i.test(plainText(table)) && /Ground Floor/.test(plainText(table)) && /<Nature of House>\s*<Plinth Area>/i.test(plainText(table))) {
      const sourceRows = table.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) || [];
      const ground = sourceRows.find(row => /Ground Floor/.test(plainText(row)));
      const first = sourceRows.find(row => /First Floor/.test(plainText(row)));
      if (ground) {
        const actualRows = floorRows.map(floor => {
          let row = replaceRunText(ground, /Ground Floor/, () => floorName(floor.floorNo));
          row = replaceRunText(row, /<Nature of House>/i, () => structureName(floor));
          row = replaceRunText(row, /<Plinth Area>/i, () => floor.builtUpAreaSqFt ? Number(floor.builtUpAreaSqFt.replace(/,/g, '')).toLocaleString('en-IN') : '');
          return keepRowTogether(row);
        }).join('');
        return table.replace(ground, () => actualRows).replace(first || /$^/, '');
      }
    }
    if (!/Floor No\./i.test(plainText(table))) return table;
    const tableRows = table.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) || [];
    const exampleRows = tableRows.filter(row => /(?:Ground|First|Second) Floor/.test(plainText(row)) && !/<Floor No\.>/.test(plainText(row)));
    const sourcePrototype = tableRows.find(row => /<Floor No\.>/.test(plainText(row))) || exampleRows[0];
    const sourceTotal = tableRows.find(row => /<Total Built-up Area>/.test(plainText(row)) || /TOTAL/i.test(plainText(row)));
    const prototype = sourcePrototype && exampleRows.length ? sourcePrototype.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, (() => {
      let column = 0; const names = ['Floor No.', 'Structure Type', 'Stage', 'Building Age', 'Built-up Area'];
      return (cell: string) => { const name = names[column++]; let written = false; return cell.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => { if (written) return ''; written = true; return paragraphLike(paragraph, `<${name}>`); }); };
    })()) : sourcePrototype;
    const totalRow = sourceTotal && !/<Total Built-up Area>/.test(plainText(sourceTotal)) ? replaceRunText(sourceTotal, /[\d,]+\s*Sq\.Ft\./i, () => '<Total Built-up Area>') : sourceTotal;
    if (!prototype || !totalRow) return table;
    const floorEntries = floorRows.map(floor => {
      let entry = prototype;
      for (const [field, value] of [
        ['Floor No.', floorName(floor.floorNo.trim())],
        ['Structure Type', structureName(floor)],
        ['Stage', floor.stage],
        ['Building Age', floor.buildingAge ? `${floor.buildingAge} Years` : ''],
        ['Built-up Area', areaText(floor.builtUpAreaSqFt)],
      ]) {
        entry = replaceRunText(entry, new RegExp(`<${escapeRegExp(field)}>`), () => value);
      }
      return keepRowTogether(entry);
    }).join('');
    const areas = floorRows.map(floor => Number(floor.builtUpAreaSqFt.replace(/,/g, '')))
      .filter(number => Number.isFinite(number) && number > 0);
    const total = areas.length ? areaText(String(areas.reduce((sum, area) => sum + area, 0))) : '';
    const header = tableRows.find(row => /Structure Type/i.test(plainText(row)) && !/<Structure Type>/.test(plainText(row)));
    const labelledTable = header ? table.replace(header, () => replaceRunText(header, /Structure Type/i, () => 'Nature of Roof')) : table;
    let result = labelledTable.replace(sourcePrototype!, () => floorEntries);
    for (const example of exampleRows.slice(1)) result = result.replace(example, '');
    return result.replace(sourceTotal!, () => replaceRunText(totalRow, /<Total Built-up Area>/, () => total));
  });
  // Older compatible templates use an Annexure item 4 with separate number,
  // description and value cells. Preserve their floor-row behavior too.
  return withFloorTable.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, row => {
    if (!/Total built-up area of the property/i.test(plainText(row))) return row;
    if (!floorRows.length) return replaceRunText(row, /<Plinth Area>\s*sq\.fts/i, () => '');
    const cellPattern = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
    if ((row.match(cellPattern) || []).length !== 3) return row;
    const itemNumber = plainText((row.match(cellPattern) || [])[0]).trim();
    return floorRows.map((floor, index) => {
      let cellIndex = 0;
      let floorRow = row.replace(cellPattern, cell => {
        const column = cellIndex++;
        if (column === 0) return index === 0 ? cell : replaceRunText(cell, new RegExp(`^${escapeRegExp(itemNumber)}`), () => '');
        if (column === 1) return replaceRunText(cell, /Total built-up area of the property/i, () => floorName(floor.floorNo.trim()));
        // The source value cell has a blank paragraph before the actual value.
        // Remove it so the area starts at the same height as the floor name.
        let valueCell = cell.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/, paragraph =>
          plainText(paragraph).trim() ? paragraph : '');
        valueCell = floor.builtUpAreaSqFt
          ? replaceRunText(valueCell, /<Plinth Area>/i, () => floor.builtUpAreaSqFt)
          : replaceRunText(valueCell, /:\s*<Plinth Area>\s*sq\.fts/i, () => '');
        const stage = floor.stage.trim();
        if (floor.builtUpAreaSqFt && stage && stage.toLowerCase() !== 'finished') {
          valueCell = replaceRunText(valueCell, /sq\.fts/i, () => `sq.fts (${stage})`);
        }
        return valueCell;
      });
      return keepRowTogether(floorRow);
    }).join('');
  });
}

/** Recite identifiers the non-house template variants leave out of their description. */
function prepareNonHouseIdentifiers(block: string, variant: string, values: Record<string, string>): string {
  if (variant.startsWith('IF FLAT')) return block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    if (/^\s*:\s*Framed with pillars and columns\.\s*$/.test(plainText(paragraph))) paragraph = replaceRunText(paragraph, /Framed with pillars and columns\./, () => '<Construction Description>');
    if (!values['Car Parking Area']) {
      if (/^\s*:\s*<Car Parking Area>\s*sq\.fts\s*\(Car Parking\)/i.test(plainText(paragraph))) return '';
      paragraph = replaceRunText(paragraph, /Car Parking area\s*<Car Parking Area>\s*sq\.fts/i, () => 'Car Parking area');
    }
    return paragraph;
  });
  if (!['IF OPEN PLACE', 'IF DIMOLISHED HOUSE', 'IF PART OPEN PLACE'].includes(variant)) return block;
  return block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const text = plainText(paragraph);
    if (!/^\s*All that\b/i.test(text)) return paragraph;
    const plot = values['Plot No.'] && !/<Plot No\.>/i.test(text);
    const survey = values['Survey No.'] && !/<Survey No\.>/i.test(text);
    if (!plot && !survey) return paragraph;
    if (variant === 'IF OPEN PLACE' && plot) {
      return replaceRunText(paragraph, /in Survey No\/s\.<Survey No\.>/i,
        () => values['Survey No.'] ? 'in plot no.<Plot No.> & Survey No/s.<Survey No.>' : 'in plot no.<Plot No.>');
    }
    const identifiers = [plot ? 'plot no.<Plot No.>' : '', survey ? 'Survey No/s.<Survey No.>' : ''].filter(Boolean).join(' & ');
    return replaceRunText(paragraph, /,\s*situated at/i, () => `, in ${identifiers}, situated at`);
  });
}

/** Add a supplied landmark wherever a source schedule/valuation omits its slot. */
function prepareLandmarkBlock(block: string, values: Record<string, string>, variant: string): string {
  const valuationLandmark = ['IF OPEN PLACE', 'IF OPEN PLOT'].includes(variant) && values['Landmark Valuation Enabled'] !== 'false';
  if (!valuationLandmark) block = block.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, table => {
    if (!/Total\s+Market\s+Value|estimate\s+M\.V\.|PARTICULARS[\s\S]*DETAILS/i.test(plainText(table))) return table;
    return table.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, row =>
      /^\s*(?:\d+[.)]?\s*)?(?:near(?:\s*\/\s*adjacent)?|adjacent)\s+(?:house\s*no\.?|h\.?\s*no\.?)/i.test(plainText(row)) ? '' : row);
  });
  if (values['NALA Converted Extent']) block = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    if (!/^\s*All that\b/i.test(plainText(paragraph))) return paragraph;
    return replaceRunText(paragraph, /[\s\S]+/, match => match[0] + ' NALA converted extent: ' + values['NALA Converted Extent'] + ' Sq. Yards.');
  });
  const relation = values['Near / Adjacent']?.toLowerCase();
  const landmarkNumber = values['Landmark House No.'] ?? values['Near H.No.'];
  if (!['near', 'adjacent'].includes(relation) || !landmarkNumber?.trim()) return block;
  block = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const text = plainText(paragraph);
    if (!/^\s*All that\b/i.test(text) || /<\s*Landmark House No\.\s*>/i.test(text) || (/near\s*\/\s*adjacent|near house|adjacent house/i.test(text) && /<\s*Near H\.No\.\s*>/i.test(text))) return paragraph;
    return replaceRunText(paragraph, /\bsituated\s+at\b/i, () => `situated ${relation} house No.<Landmark House No.> at`);
  });
  return block.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, table => {
    if (!valuationLandmark) return table;
    const text = plainText(table);
    if (!/Total\s+Market\s+Value|estimate\s+M\.V\.|PARTICULARS[\s\S]*DETAILS/i.test(text) || /<\s*Landmark House No\.\s*>/i.test(text) || (/near\s*\/\s*adjacent|near house|adjacent house/i.test(text) && /<\s*Near H\.No\.\s*>/i.test(text))) return table;
    const rows = [...table.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)];
    const sample = rows.find(row => /Market Value per|Total Market Value|estimate\s+M\.V\./i.test(plainText(row[0])));
    if (!sample) return table;
    const cells = [...sample[0].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)];
    if (cells.length < 2) return table;
    let index = 0;
    const row = sample[0].replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, cell => {
      const column = index++;
      let first = true;
      return cell.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
        const value = first ? column === cells.length - 1 ? ': <Landmark House No.>' : column === cells.length - 2 ? `${relation} house No.` : '' : '';
        first = false;
        return replaceRunText(paragraph, /[\s\S]+/, () => value);
      });
    });
    return table.slice(0, sample.index) + row + table.slice(sample.index);
  });
}

/**
 * @param values   placeholder name -> value, keyed exactly as the template writes it
 * @param variant  which SCHEDULE OF PROPERTY block to keep, e.g. 'IF OPEN PLOT'
 * @param rewrites literal phrases to fix up after substitution
 */
/** Apply the mandatory Sale-sized stamp area to every generated deed package. */
export function ensureStampPaperSpace(xml: string, selection = 'Legacy'): string {
  const top = ({ '100': '8352', '50': '8640', '20': '8640', None: '1080' } as Record<string, string>)[selection] || '8208';
  const sections = xml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g) || [];
  const stampSection = (section: string) => {
    if (/<w:pgMar\b/.test(section)) return section.replace(/<w:pgMar\b[^>]*\/>/, margin =>
      /\bw:top="[^"]*"/.test(margin) ? margin.replace(/\bw:top="[^"]*"/, `w:top="${top}"`) : margin.replace('/>', ` w:top="${top}"/>`));
    return section.replace('</w:sectPr>', `<w:pgMar w:top="${top}" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`);
  };
  if (sections.length >= 2) {
    let index = 0;
    return xml.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, section => index++ === 0 ? stampSection(section) : normalContinuationSection(section));
  }

  // A single-section replacement needs a separate opening section so the
  // continuation pages do not inherit the large stamp-paper margin.
  const start = xml.indexOf('<w:body>') + 8, end = xml.lastIndexOf('</w:body>');
  if (start < 8 || end < start) throw new Error('Document body is missing; stamp-paper space could not be reserved.');
  const body = xml.slice(start, end);
  const children = topLevelChildren(body);
  const paragraphs = children.filter(child => /^<w:p(?:\s|>)/.test(body.slice(child.start, child.end)));
  const boundary = [...paragraphs].reverse().find(child => /(?:of the OTHER PART|hereinafter[^\n]*(?:DONEE|CLAIMANT))/i.test(plainText(body.slice(child.start, child.end))))
    || paragraphs.find(child => plainText(body.slice(child.start, child.end)).trim());
  if (!boundary) throw new Error('Opening paragraph is missing; stamp-paper space could not be reserved.');
  const continuation = normalContinuationSection(sections[0] || '<w:sectPr><w:pgSz w:w="11920" w:h="16840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>');
  const opening = stampSection(continuation).replace(/<w:type\b[^>]*\/>/g, '').replace(/<w:(?:pgSz|pgMar)\b/, tag => '<w:type w:val="nextPage"/>' + tag);
  const sectionBreak = `<w:p><w:pPr>${opening}</w:pPr></w:p>`;
  const continuedBody = sections.length ? body.replace(sections[0], continuation) : body;
  const rebuilt = continuedBody.slice(0, boundary.end) + sectionBreak + continuedBody.slice(boundary.end) + (sections.length ? '' : continuation);
  return xml.slice(0, start) + rebuilt + xml.slice(end);
}

const AGREEMENT_32A_HEADING = 'PHOTOGRAPHS AND FINGERPRINTS AS PER SECTION 32A OF REGISTRATION ACT, 1908.';

/** This reference has its own clauses; only its schedule markers share Sale's vocabulary. */
function agreementTemplateParts(xml: string) {
  const body = xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>'));
  const normalized = body.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const aliases: Record<string, string> = { '<IF FINISHED HOUSE>': '<IF HOUSE>', '<IF SEMI FINISHED HOUSE>': '<IF HOUSE SEMI FINISHED>' };
    const alias = aliases[plainText(paragraph).trim()];
    return alias ? replaceRunText(paragraph, /[\s\S]+/, () => alias) : paragraph;
  });
  return giftTemplateParts(normalized);
}

/** The revised source supplies separate operative blocks before the shared schedules. */
function selectAgreementPossession(xml: string, variant: string): string {
  const start = xml.indexOf('<w:body>') + 8, end = xml.lastIndexOf('</w:body>');
  const body = xml.slice(start, end);
  const chunks = topLevelChildren(body).map(child => body.slice(child.start, child.end));
  const texts = chunks.map(chunk => plainText(chunk).trim());
  const markers = texts.flatMap((text, index) => text === '<WITHOUT POSSESSION>' ? [index] : []);
  const openings = texts.flatMap((text, index) => /^NOW THIS DEED WITNESSETH/i.test(text) ? [index] : []);
  if (!markers.length) {
    if (openings.length !== 1) throw new Error('Retain the <WITHOUT POSSESSION> boundary between the two Agreement clause blocks.');
    return xml; // Explicit older custom templates retain their original single-block wording.
  }
  const boundary = markers[0];
  const schedule = texts.findIndex((text, index) => index > boundary && /^<IF /.test(text));
  if (markers.length !== 1 || openings.length !== 2 || openings[0] >= boundary || openings[1] <= boundary || schedule <= openings[1]) throw new Error('Retain both complete possession clause blocks before the property schedules.');
  const withBlock = chunks.slice(openings[0], boundary).join('');
  const withoutBlock = chunks.slice(boundary + 1, schedule).join('');
  if (!plainText(withBlock).includes('5. POSSESSION') || !plainText(withoutBlock).includes('5. APPOINTMENT OF ATTORNEY') || !plainText(withoutBlock).includes('13. GENERAL AUTHORITY') || plainText(withoutBlock).includes('5. POSSESSION')) throw new Error('Retain the separate With Possession and Without Possession clauses and numbering.');
  const selected = variant === 'without-possession' ? withoutBlock : withBlock;
  return xml.slice(0, start) + chunks.slice(0, openings[0]).join('') + selected + chunks.slice(schedule).join('') + xml.slice(end);
}

export async function validateAgreementSaleGpaTemplate(bytes: Uint8Array, contract: TemplateFieldContract = EMPTY_FIELD_CONTRACT): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  let detectedPlaceholders: string[] = [];
  try {
    const entries = await readZip(bytes, { maxEntries: 2000, maxEntryBytes: 30 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024 });
    const document = entries.find(entry => entry.name === 'word/document.xml');
    if (!document) throw new Error('Missing word/document.xml.');
    const xml = protectDeedTemplateSource(new TextDecoder().decode(document.data), 'agreement_of_sale');
    const parts = agreementTemplateParts(xml);
    const openingText = parts.chunks.slice(0, parts.first).map(plainText);
    selectAgreementPossession(xml, 'with-possession');
    selectAgreementPossession(xml, 'without-possession');
    for (const side of ['Executant', 'Claimant']) {
      if (!openingText.some(text => new RegExp(`<\\s*${side} NAME\\s*>`, 'i').test(text) && new RegExp(`<\\s*${side} Age\\s*>`, 'i').test(text))) errors.push(`Retain the complete ${side} identity paragraph.`);
    }
    if (!openingText.some(text => /^Registered Deed:/i.test(text.trim())) || !openingText.some(text => /^NOW THIS DEED WITNESSETH/i.test(text.trim()))) errors.push('Retain the Agreement title-record boundaries.');
    const approved = await readZip(await loadTemplate(openingText.includes('<WITHOUT POSSESSION>') ? 'agreement-sale-gpa-v3' : 'agreement-sale-gpa-v1'));
    const reference = new TextDecoder().decode(approved.find(entry => entry.name === 'word/document.xml')!.data);
    detectedPlaceholders = angleTags(xml);
    const supported = new Set([...AMENDMENT_TAGS, ...angleTags(reference), ...contract.fields.map(field => field.placeholder), 'Date', 'Executant Share', 'Claimant Share', 'Landmark House No.', 'Housing Loan Branch', 'UTR No.'].map(norm));
    const detected = new Set(detectedPlaceholders.map(norm));
    for (const tag of angleTags(reference)) if (!detected.has(norm(tag))) errors.push(`Retain the Agreement of Sale Cum GPA binding <${tag}>.`);
    for (const tag of detectedPlaceholders) if (!supported.has(norm(tag))) errors.push(`Unsupported Agreement of Sale Cum GPA placeholder <${tag}>.`);
    for (const phrase of ['AGREEMENT OF SALE-CUM-GPA WITH POSSESSION', '5. POSSESSION', '6. APPOINTMENT OF ATTORNEY', 'DECLARATION', AGREEMENT_32A_HEADING, 'SIGNATURES OF WITNESSES']) {
      if (!plainText(xml).includes(phrase)) errors.push(`Retain the Agreement of Sale Cum GPA section: ${phrase}.`);
    }
    const form = topLevelChildren(xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>')))
      .map(child => xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>')).slice(child.start, child.end))
      .find(chunk => /^<w:tbl\b/.test(chunk) && /FINGER PRINT/.test(plainText(chunk)));
    if (!form || (form.match(/<w:gridCol\b/g) || []).length !== 3) errors.push('Retain the three-column Section 32A form.');
  } catch (error) { errors.push((error instanceof Error ? error.message : String(error)).replace(/Gift/g, 'Agreement of Sale Cum GPA')); }
  return { valid: !errors.length, preservationVersion: DEED_PRESERVATION_VERSION, errors, detectedPlaceholders, omittedPlaceholders: [] };
}

export async function validateGeneralPoaTemplate(bytes: Uint8Array, contract: TemplateFieldContract = EMPTY_FIELD_CONTRACT): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  let detectedPlaceholders: string[] = [];
  try {
    const entries = await readZip(bytes, { maxEntries: 2000, maxEntryBytes: 30 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024 });
    const document = entries.find(entry => entry.name === 'word/document.xml');
    if (!document) throw new Error('Missing word/document.xml.');
    const xml = protectDeedTemplateSource(new TextDecoder().decode(document.data), 'power_of_attorney');
    const text = plainText(xml);
    const { chunks, first } = agreementTemplateParts(xml);
    const opening = chunks.slice(0, first).map(plainText);
    for (const side of ['Executant', 'Claimant']) {
      if (!opening.some(paragraph => new RegExp(`<\\s*${side} NAME\\s*>`, 'i').test(paragraph) && new RegExp(`<\\s*${side} Age\\s*>`, 'i').test(paragraph))) errors.push(`Retain the complete ${side} identity paragraph.`);
    }
    if (!opening.some(paragraph => /<Friend\/Relationship>\s*<CLAIMANT NAME>/i.test(paragraph))) errors.push('Retain <Friend/Relationship> <CLAIMANT NAME> together in the appointment recital.');
    const approved = await readZip(await loadTemplate('general-poa-v2'));
    const reference = new TextDecoder().decode(approved.find(entry => entry.name === 'word/document.xml')!.data);
    detectedPlaceholders = angleTags(xml);
    const detected = new Set(detectedPlaceholders.map(norm));
    const supported = new Set([...AMENDMENT_TAGS, ...angleTags(reference), ...contract.fields.map(field => field.placeholder), 'Date', 'Executant Share', 'Claimant Share', 'Landmark House No.', 'Executant Address', 'Claimant Address'].map(norm));
    for (const tag of angleTags(reference)) {
      const side = /^(Executant|Claimant) (?:H\.No\.|Locality|Village|Mandal|District|State|Pin Code)$/i.exec(tag.trim())?.[1];
      if (!detected.has(norm(tag)) && !(side && detected.has(norm(side + ' Address')))) errors.push(`Retain the GPA binding <${tag}> so saved details are not omitted.`);
    }
    for (const tag of detectedPlaceholders) if (!supported.has(norm(tag))) errors.push(`Unsupported GPA placeholder <${tag}>.`);
    for (const phrase of ['GENERAL POWER OF ATTORNEY', 'FOR SALE OF IMMOVABLE PROPERTY', 'Registered Deed:', 'WHEREAS, I/We have decided', 'NOW THIS GENERAL POWER OF ATTORNEY WITNESSETH', 'TO SELL AND CONVEY', 'TO RECEIVE', 'TO ENTER INTO AND EXECUTE', 'TO EXECUTE AND SIGN', 'TO PRESENT', 'TO ADMIT EXECUTION', 'TO DELIVER', 'TO SIGN AND SUBMIT', 'TO REPRESENT ME/US', 'TO DO ALL SUCH OTHER ACTS', 'AND I/WE HEREBY AGREE TO RATIFY', 'THIS POWER OF ATTORNEY shall remain valid', 'DECLARATION', 'IN WITNESS WHEREOF', AGREEMENT_32A_HEADING, 'SIGNATURES OF WITNESSES']) {
      if (!text.includes(phrase)) errors.push(`Retain the GPA section: ${phrase}.`);
    }
    const form = chunks.find(chunk => /^<w:tbl\b/.test(chunk) && /FINGER PRINT/.test(plainText(chunk)));
    if (!form || (form.match(/<w:gridCol\b/g) || []).length !== 3) errors.push('Retain the three-column GPA Section 32A form.');
  } catch (error) { errors.push((error instanceof Error ? error.message : String(error)).replace(/Gift/g, 'GPA')); }
  return { valid: !errors.length, preservationVersion: DEED_PRESERVATION_VERSION, errors, detectedPlaceholders, omittedPlaceholders: [] };
}

/** Each page owns a table and an adjacent signature block, rather than a footer. */
function agreementRegistrationForm(table: string, heading: string, rewrites: Rewrite[], signatures: string, pageSection: string) {
  const rows = table.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) || [];
  const sample = rows[1];
  if (!sample) throw new Error('Section 32A has no person row.');
  const paragraph = sample.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/)?.[0] || '<w:p/>';
  // The source form's paragraph style contains fixed positioning for its floating
  // boxes. Retain its run font, but use normal wrapping and valid pPr ordering.
  let font = (paragraph.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)?.[0] || '<w:rPr></w:rPr>')
    .replace(/<w:u\b[^>]*\/>/g, '').replace(/<\/w:rPr>/, '<w:u w:val="none"/></w:rPr>');
  if (!/<w:sz\b/.test(font)) font = font.replace('</w:rPr>', `<w:sz w:val="${font.match(/<w:szCs\b[^>]*w:val="(\d+)"/)?.[1] || '28'}"/></w:rPr>`);
  const text = (value: string) => `<w:p><w:pPr><w:keepLines/><w:spacing w:before="80" w:after="80" w:line="240" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:r>${font}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
  const cell = (width: number, content: string) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${content}</w:tc>`;
  const headingRow = `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9749" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>${keepWithNext(heading)}</w:tc></w:tr>`;
  const labels = `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${cell(2700, text('FINGER PRINT / THUMB'))}${cell(2700, text('PHOTO'))}${cell(4349, text('NAME AND ADDRESS'))}</w:tr>`;
  const fontPoints = Number(font.match(/<w:sz\b[^>]*w:val="(\d+)"/)?.[1] || '28') / 2;
  const lineCapacity = Math.max(12, Math.floor((4349 - 216) / (fontPoints * 10)));
  const lines = (value: string) => {
    let count = 1, used = 0;
    for (const word of value.split(/\s+/)) {
      const width = [...word].reduce((sum, char) => sum + (/[^\u0000-\u024f]/.test(char) ? 2 : 1), 0);
      if (used && used + width + 1 > lineCapacity) { count++; used = 0; }
      count += Math.max(0, Math.ceil(width / lineCapacity) - 1);
      used = used ? used + width + 1 : width % lineCapacity || Math.min(width, lineCapacity);
    }
    return count;
  };
  const people = (['executant', 'claimant'] as const).flatMap(side => {
    const records = rewrites.find(rewrite => rewrite.partyRole === side)?.records;
    if (!records?.length) throw new Error(`Add at least one ${side} for Section 32A.`);
    const prefix = side === 'executant' ? 'Executant' : 'Claimant';
    return records.map(record => {
      const values = new Map(Object.entries(record).map(([key, value]) => [norm(key), value]));
      const name = values.get(norm('Registration Name')) || values.get(norm(prefix + ' Name')) || '';
      const relation = values.get(norm(prefix + ' Relation Name')) || '';
      const address = values.get(norm('Registration Address')) || values.get(norm(prefix + ' Address')) || '';
      const fields = [[name, relation].filter(Boolean).join(', '), address ? `R/o ${address}` : '', side === 'executant' ? 'EXECUTANT / PRINCIPAL' : 'CLAIMANT / ATTORNEY HOLDER'];
      const identity = fields.map(text).join('');
      return { xml: `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="2800" w:hRule="atLeast"/></w:trPr>${cell(2700, '<w:p/>')}${cell(2700, '<w:p/>')}${cell(4349, identity)}</w:tr>`, height: Math.max(2800, Math.ceil(fields.reduce((sum, field) => sum + lines(field), 0) * fontPoints * 22 + 640)) };
    });
  });
  const properties = (table.match(/<w:tblPr\b[^>]*>[\s\S]*?<\/w:tblPr>/)?.[0] || '<w:tblPr/>')
    .replace(/<w:tblW\b[^>]*\/>/, '<w:tblW w:w="9749" w:type="dxa"/>')
    .replace(/<w:tblInd\b[^>]*\/>/, '<w:tblInd w:w="0" w:type="dxa"/>');
  const pageHeight = Number(pageSection.match(/<w:pgSz\b[^>]*\bw:h="(\d+)"/)?.[1] || '16834');
  const margin = pageSection.match(/<w:pgMar\b[^>]*\/>/)?.[0] || '';
  const rowBudget = pageHeight - Number(margin.match(/\bw:top="(\d+)"/)?.[1] || '1440') - Number(margin.match(/\bw:bottom="(\d+)"/)?.[1] || '1080') - 3500;
  const pages: typeof people[] = [];
  let current: typeof people = [], height = 0;
  for (const person of people) {
    if (person.height > rowBudget) throw new Error('A Section 32A address is too long to fit with its signature area on one page. Shorten the address before downloading.');
    if (current.length && (height + person.height > rowBudget || current.length === 3)) { pages.push(current); current = []; height = 0; }
    current.push(person); height += person.height;
  }
  if (current.length) pages.push(current);
  const signatureParagraphs = signatures.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
  const signatureText = signatureParagraphs.filter(paragraph => plainText(paragraph).trim());
  const signatureBlock = signatureText.join('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="280" w:lineRule="exact"/></w:pPr></w:p>');
  const gap = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="exact"/></w:pPr></w:p>';
  const pageBreak = '<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>';
  return pages.map((page, index) => {
    let block = `<w:tbl>${properties}<w:tblGrid><w:gridCol w:w="2700"/><w:gridCol w:w="2700"/><w:gridCol w:w="4349"/></w:tblGrid>${headingRow}${labels}${page.map(person => person.xml).join('')}</w:tbl>${gap}${signatureBlock}`;
    const paragraphs = block.match(/<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
    let position = 0;
    block = block.replace(/<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
      paragraph = paragraph.replace(/<w:keepNext\b[^>]*\/>/g, '');
      if (++position === paragraphs.length) return paragraph;
      if (/^<w:p\s*\/>$/.test(paragraph)) return '<w:p><w:pPr><w:keepNext/></w:pPr></w:p>';
      if (/<w:pStyle\b[^>]*\/>/.test(paragraph)) return paragraph.replace(/<w:pStyle\b[^>]*\/>/, tag => tag + '<w:keepNext/>');
      return keepWithNext(paragraph);
    });
    return (index ? pageBreak : '') + block;
  }).join('');
}

export async function fillAgreementSaleGpaDeed(values: Record<string, string>, rewrites: Rewrite[], schedules: ScheduleMerge[], source: DeedTemplateSource = BUILT_IN_TEMPLATE_SOURCE): Promise<MergeResult> {
  return fillPropertyAuthorityDeed(values, rewrites, schedules, source, false);
}

export async function fillGeneralPoaDeed(values: Record<string, string>, rewrites: Rewrite[], schedules: ScheduleMerge[], source: DeedTemplateSource = BUILT_IN_TEMPLATE_SOURCE): Promise<MergeResult> {
  return fillPropertyAuthorityDeed(values, rewrites, schedules, source, true);
}

async function fillPropertyAuthorityDeed(values: Record<string, string>, rewrites: Rewrite[], schedules: ScheduleMerge[], source: DeedTemplateSource, generalPoa: boolean): Promise<MergeResult> {
  if (!schedules.length) throw new Error('Add an Agreement of Sale Cum GPA property schedule.');
  if (generalPoa && !['general-power-of-attorney', 'general-power-of-attorney-family'].includes(values['Poa Variant'])) throw new Error('Choose a supported General Power of Attorney variant.');
  if (generalPoa && (values['Poa Relationship Complete'] !== 'true' || !values['Poa Attorney Appointment'])) throw new Error('Choose the family relationship to principal(s) for every attorney.');
  if (!generalPoa && !['with-possession', 'without-possession'].includes(values['Agreement Possession Variant'])) throw new Error('Choose With Possession or Without Possession.');
  const bytes = source.kind === 'built-in' ? await loadTemplate(generalPoa ? 'general-poa-v3' : 'agreement-sale-gpa-v4') : await templateBytes(source);
  const validation = await (generalPoa ? validateGeneralPoaTemplate : validateAgreementSaleGpaTemplate)(bytes, source.kind === 'built-in' ? undefined : source.fieldContract);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const entries = await readZip(bytes);
  const document = entries.find(entry => entry.name === 'word/document.xml')!;
  let xml = protectDeedTemplateSource(new TextDecoder().decode(document.data), generalPoa ? 'power_of_attorney' : 'agreement_of_sale');
  assertTitleAmendmentBindings(xml, schedules);
  if (!generalPoa) xml = selectAgreementPossession(xml, values['Agreement Possession Variant']);
  const start = xml.indexOf('<w:body>') + 8, end = xml.lastIndexOf('</w:body>');
  const { chunks, first, tail, blocks } = agreementTemplateParts(xml);
  const missing = new Set<string>();
  const map = (record: Record<string, string>) => new Map(Object.entries(record).map(([key, value]) => [norm(key), value ?? '']));
  const fill = (block: string, record: Record<string, string>, edits: Rewrite[] = []) => block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    paragraph = replaceRunText(paragraph, /DD[-/.]?MM[-/.]?YYYY/g, () => '<Execution Date>');
    paragraph = replaceRunText(paragraph, /Transaction No\.\/UTR No\./g, () => 'Transaction No./UTR No. <UTR No.>');
    return fillParagraph(paragraph, map(record), missing, edits);
  });
  // Keep only data-driven repeats: Sale-specific wording rewrites do not belong to this deed.
  const partyRewrites = rewrites.filter(rewrite => rewrite.partyRole).map(rewrite => ({ ...rewrite, finalSuffix: generalPoa ? /\s*hereinafter[\s\S]*$/i : /\s*\(Hereinafter[\s\S]*$/i }));
  const paymentRewrites = rewrites.filter(rewrite => rewrite.records && !rewrite.partyRole && /^(?:RTGS|Cheque|Demand Draft|UPI|Cash|Housing Loan|Through Bank)/.test(rewrite.find.source))
    .filter(rewrite => !rewrite.when || rewrite.regularWeight).map(rewrite => ({ ...rewrite, when: undefined }));
  let opening = chunks.slice(0, first).join('');
  const titleChunks = topLevelChildren(opening);
  const titleStart = titleChunks.find(child => /^Registered Deed:/i.test(plainText(opening.slice(child.start, child.end)).trim()));
  const titleEnd = titleChunks.find(child => (generalPoa ? /^WHEREAS, I\/We have decided/i : /^NOW THIS DEED WITNESSETH/i).test(plainText(opening.slice(child.start, child.end)).trim()));
  if (!titleStart || !titleEnd) throw new Error('Retain the Agreement title-record boundaries.');
  const titleBlock = opening.slice(titleStart.start, titleEnd.start);
  const titles = schedules.map(schedule => fill(removeOptionalTitleRecitals(titleBlock, map(schedule.titleValues || schedule.values), schedule.variant), schedule.titleValues || schedule.values,
    [...amendmentRewrites(schedule), ...(schedule.titleLinkRecords?.length ? [{ find: /^Registered Deed:/i, replace: '', records: schedule.titleLinkRecords }] : [])])).join('');
  opening = opening.slice(0, titleStart.start) + titles + opening.slice(titleEnd.start);
  if (generalPoa && !/<w:sectPr\b/.test(opening)) {
    const section = xml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/)?.[0];
    if (section) opening += `<w:p><w:pPr>${section}</w:pPr></w:p>`;
  }
  if (generalPoa) opening = opening.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => replaceRunText(paragraph, /<Friend\/Relationship>\s*<CLAIMANT NAME>/i, () => '<Poa Attorney Appointment>'));
  opening = fill(opening, values, [...partyRewrites, ...paymentRewrites]);
  // Repeated parties must continue with normal margins rather than carrying
  // the source's first-section stamp margin across all their opening pages.
  if (generalPoa || partyRewrites.reduce((sum, rewrite) => sum + (rewrite.records?.length || 0), 0) > 2) {
    const stamp = opening.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/)?.[0];
    const principal = partyRewrites.find(rewrite => rewrite.partyRole === 'executant')?.records?.[0];
    const principalName = principal?.['Registration Name'] || principal?.['EXECUTANT NAME'] || principal?.['Executant Name'];
    if (stamp && principalName) {
      opening = opening.replace(stamp, '');
      const firstPrincipal = topLevelChildren(opening).find(child => plainText(opening.slice(child.start, child.end)).toLocaleUpperCase('en-IN').includes(principalName.toLocaleUpperCase('en-IN')));
      if (!firstPrincipal) throw new Error('Cannot place the Agreement continuation section after the first principal.');
      opening = opening.slice(0, firstPrincipal.end) + `<w:p><w:pPr>${stamp}</w:pPr></w:p>` + opening.slice(firstPrincipal.end);
    }
  }
  if (!generalPoa) opening = opening.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/, paragraph => replaceRunText(paragraph, /AGREEMENT OF SALE-CUM-GPA WITH POSSESSION/, () => values['Agreement Possession Variant'] === 'without-possession' ? 'AGREEMENT OF SALE-CUM-GPA WITHOUT POSSESION' : 'AGREEMENT OF SALE-CUM-GPA WITH POSSESSION').replace(/<w:t(?:\s[^>]*)?>/, '<w:t xml:space="preserve">'));
  const selected = schedules.map((schedule, index) => {
    const variant = schedule.variant === 'IF FLAT' ? schedule.values['Flat Stage'] === 'Semi Finished' ? 'IF FLAT SEMI FINISHED' : 'IF FLAT FINISHED' : schedule.variant;
    let block = blocks.get(variant);
    if (!block) throw new Error(`No Agreement of Sale Cum GPA schedule is available for ${variant}.`);
    block = ['IF HOUSE', 'IF HOUSE SEMI FINISHED'].includes(variant) ? prepareHouseBlock(block, schedule.values, schedule.structureDetails) : prepareNonHouseIdentifiers(block, variant, schedule.values);
    block = prepareLandmarkBlock(block, schedule.values, variant);
    block = addOwnershipShareParagraphs(block, schedule.vendorShares, schedule.vendeeShares);
    if (schedules.length > 1) block = block.replace('SCHEDULE OF PROPERTY', `SCHEDULE OF PROPERTY - ${index + 1}`);
    const record = { ...schedule.values };
    if (variant.startsWith('IF FLAT') && record.UDS) record['Extent in Sq.Meters'] = (Number(record.UDS.replace(/,/g, '')) * 0.836127).toFixed(2);
    return fill(block, record);
  }).join('');
  const closingChunks = chunks.slice(tail);
  const headingIndex = closingChunks.findIndex(chunk => plainText(chunk).trim() === AGREEMENT_32A_HEADING);
  const tableIndex = closingChunks.findIndex((chunk, index) => index > headingIndex && /^<w:tbl\b/.test(chunk));
  if (headingIndex < 0 || tableIndex < 0) throw new Error('Section 32A heading or form is missing.');
  const beforeForm = closingChunks.slice(0, headingIndex);
  let lastText = beforeForm.length - 1;
  while (lastText >= 0 && !plainText(beforeForm[lastText]).trim()) lastText--;
  // The GPA source carries its form section break on the Prepared By paragraph.
  const sectionStartsForm = beforeForm.slice(generalPoa ? Math.max(0, lastText) : lastText + 1).some(chunk => /<w:sectPr\b/.test(chunk));
  const afterForm = closingChunks.slice(tableIndex + 1);
  const signatureStart = afterForm.findIndex(chunk => /SIGNATURES OF WITNESSES/i.test(plainText(chunk)));
  const signatureEnd = afterForm.findIndex((chunk, index) => index > signatureStart && /^1\.\s+2\.$/.test(plainText(chunk).trim()));
  if (signatureStart < 0 || signatureEnd < 0) throw new Error('Retain the Section 32A witness and executant signature area, including witness numbers 1 and 2.');
  const signatureBlock = fill(afterForm.slice(signatureStart, signatureEnd + 1).join(''), values);
  // Isolate the form pages from every preceding deed page, even
  // when a compatible replacement has removed the source's section boundary.
  if (!sectionStartsForm) {
    const previousSection = xml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)?.at(-1);
    if (!previousSection) throw new Error('Section 32A requires continuation page settings.');
    const boundary = previousSection.replace(/<w:type\b[^>]*\/>/g, '').replace(/(<w:sectPr\b[^>]*>)/, '$1<w:type w:val="nextPage"/>');
    beforeForm.push(`<w:p><w:pPr>${boundary}</w:pPr></w:p>`);
  }
  const formSection = xml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)?.at(-1) || '';
  const form = agreementRegistrationForm(closingChunks[tableIndex], closingChunks[headingIndex], rewrites, signatureBlock, formSection);
  const closing = fill(beforeForm.join(''), values) + form + fill([...afterForm.slice(0, signatureStart), ...afterForm.slice(signatureEnd + 1)].join(''), values);
  // Catalogue spacers and printed page-number samples must not control dynamic pagination.
  let blanks = 0;
  const combined = opening + selected + closing;
  let signing = false;
  let headingPending = false;
  const keepAgreementParagraph = (paragraph: string) => {
    paragraph = paragraph.replace(/<w:keepNext\b[^>]*\/>/g, '');
    // pStyle must precede direct pagination properties in Word's pPr sequence.
    return /<w:pStyle\b[^>]*\/>/.test(paragraph)
      ? paragraph.replace(/<w:pStyle\b[^>]*\/>/, tag => tag + '<w:keepNext/>')
      : keepWithNext(paragraph);
  };
  let result = topLevelChildren(combined).map(child => combined.slice(child.start, child.end)).map(chunk => {
    if (!/^<w:p\b/.test(chunk)) {
      headingPending = false;
      if (plainText(chunk).includes(AGREEMENT_32A_HEADING)) signing = false;
      // The refreshed GPA puts the deed signatures and witness numbers in
      // separate table rows. Keep that closing table together like the prose
      // closing, without linking its last paragraph to the following form.
      if (signing && /^<w:tbl\b/.test(chunk)) {
        const paragraphs = [...chunk.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)];
        let index = 0;
        chunk = chunk.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph =>
          ++index < paragraphs.length ? keepAgreementParagraph(paragraph) : paragraph.replace(/<w:keepNext\b[^>]*\/>/g, ''));
        chunk = chunk.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, row => /<w:cantSplit\b/.test(row) ? row
          : /<w:trPr(?:\s[^>]*)?>/.test(row) ? row.replace(/<w:trPr(?:\s[^>]*)?>/, tag => tag + '<w:cantSplit/>')
          : row.replace(/<w:tr(?:\s[^>]*)?>/, tag => tag + '<w:trPr><w:cantSplit/></w:trPr>'));
        signing = false;
      }
      return chunk;
    }
    const text = plainText(chunk).trim();
    const heading = /^(?:SCHEDULE OF PROPERTY|ANNEXURE|DECLARATION|\d+\. [A-Z])/i.test(text)
      || (!generalPoa && /^STATEMENT OF MARKET VALUE/i.test(text));
    if (heading) headingPending = true;
    else if (text) headingPending = false;
    if (/^IN WITNESS/i.test(text)) signing = true;
    if (/^(?:Typed|Prepared) By:/i.test(text)) signing = false;
    if (/<w:sectPr\b/.test(chunk)) signing = false;
    if (signing || headingPending) chunk = keepAgreementParagraph(chunk);
    if (/^All that\b/i.test(text) && !/<w:keepLines\b/.test(chunk)) chunk = chunk.replace(/<w:pPr\b[^>]*>/, tag => tag + '<w:keepLines/>');
    return chunk;
  }).filter(chunk => {
    if (/^-\d+-$/.test(plainText(chunk).trim())) return false;
    if (plainText(chunk).trim() || /<w:(?:sectPr|tbl|drawing|pageBreakBefore)\b/.test(chunk)) { blanks = 0; return true; }
    return ++blanks <= 1;
  }).join('');
  const unmapped = [...new Set((plainText(result).match(/<[^<>]{2,60}>/g) || []).map(tag => tag.slice(1, -1).trim()))];
  document.data = new TextEncoder().encode(ensureStampPaperSpace(xml.slice(0, start) + result + xml.slice(end), values['Stamp Paper Margin']));
  return { blob: new Blob([await writeZip(entries) as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), missing: [...missing].sort(), unmapped: unmapped.sort() };
}

export async function fillSaleDeed(
  values: Record<string, string>,
  variant: string,
  rewrites: Rewrite[] = [],
  schedules: ScheduleMerge[] = [],
  templateSource: DeedTemplateSource = BUILT_IN_TEMPLATE_SOURCE,
): Promise<MergeResult> {
  if (templateSource.kind === 'custom' && !templateSource.validation.valid) {
    throw new Error(`Custom template is not compatible: ${templateSource.validation.errors.join(' ')}`);
  }
  const bin = await templateBytes(templateSource);
  if (templateSource.kind !== 'built-in') {
    const checked = await validateSaleDeedTemplate(bin, 'template.docx', undefined, templateSource.fieldContract);
    if (!checked.valid) throw new Error(checked.errors.join(' '));
  }
  const entries = await readZip(bin);

  const doc = entries.find(e => e.name === 'word/document.xml');
  if (!doc) throw new Error('Template is missing word/document.xml.');

  let xml = protectDeedTemplateSource(new TextDecoder().decode(doc.data), 'sale');
  assertTitleAmendmentBindings(xml, schedules);
  const hasSaleOpenings = plainText(xml).includes('<IF SALE DEED>');
  const bodyStart = xml.indexOf('<w:body>') + '<w:body>'.length;
  const bodyEnd = xml.lastIndexOf('</w:body>');
  const selectedBody = enforcePartySharePolicy(await selectAuthorityDeclaration(await selectSaleOpening(xml.slice(bodyStart, bodyEnd), values), values), values);
  const prepared = prepareTemplate(markConsiderationRows(selectedBody));
  if (Object.keys(prepared.clauses).length) rewrites = rewrites
    .filter(rewrite => !(rewrite.find.source.startsWith('Housing Loan:') && rewrite.records?.length === 0 && rewrite.when && !rewrite.regularWeight))
    .map(rewrite => rewrite.find.source.startsWith('Housing Loan:') ? { ...rewrite, when: undefined } : rewrite);
  let body = Object.keys(prepared.clauses).length ? prepared.body : selectOperativeClauses(prepared.body, variant.startsWith('IF FLAT') ? 'IF FLAT' : variant);
  // Older templates have no Through Bank sample. Reuse their payment paragraph
  // formatting so the new mode is also emitted when such a template is used.
  if (!/Through Bank:\s*Amount of Rs\./i.test(plainText(body)) && rewrites.some(rewrite => rewrite.find.source.startsWith('Through Bank:') && rewrite.records?.length)) {
    const paymentParagraph = topLevelChildren(body).find(child => /Cash:\s*Amount of Rs\./i.test(plainText(body.slice(child.start, child.end))));
    if (paymentParagraph) {
      const paragraph = body.slice(paymentParagraph.start, paymentParagraph.end);
      const bankParagraph = replaceRunText(paragraph, /[\s\S]+/, () => 'Through Bank: Amount of Rs.<Amount>/- paid through bank by the Vendee/s, namely <Claimant Name>, to the Vendor/s, namely <Executant Name>.');
      body = body.slice(0, paymentParagraph.end) + bankParagraph + body.slice(paymentParagraph.end);
    }
  }
  const values_ = new Map<string, string>();
  for (const [k, v] of Object.entries(values)) values_.set(norm(k), v ?? '');

  // --- keep only the selected schedule variant -----------------------------
  const children = topLevelChildren(body);
  const markerAt = new Map<string, number>();
  children.forEach((c, i) => {
    const t = plainText(body.slice(c.start, c.end)).trim();
    for (const v of ALL_VARIANTS) if (t === `<${v}>`) markerAt.set(v, i);
  });

  const missing = new Set<string>();
  if (VARIANTS.filter(v => v !== 'IF FLAT').some(v => !markerAt.has(v)) || (!markerAt.has('IF FLAT') && FLAT_VARIANTS.some(v => !markerAt.has(v)))) throw new Error('Template schedule markers are missing or damaged.');
  {
    const order = ALL_VARIANTS.filter(v => markerAt.has(v)).map(v => ({ v, i: markerAt.get(v)! })).sort((a, b) => a.i - b.i);
    // Everything from this marker onward is shared by every property schedule.
    // Without this boundary the final schedule variant incorrectly owns the
    // declaration, signatures, witnesses and prepared-by paragraphs too.
    const sharedTail = children.findIndex((c, i) =>
      i > order[order.length - 1].i && ['<FOR ALL THE DOCUMENTS>', 'DECLARATION'].includes(plainText(body.slice(c.start, c.end)).trim())
    );
    const selected = (schedules.length ? schedules : [{ variant, values }]).map(schedule => ({ ...schedule, variant: selectedTemplateVariant(schedule.variant, markerAt, schedule.values) }));
    const firstMarker = order[0].i;
    const flowStart = children.findIndex(child =>
      plainText(body.slice(child.start, child.end)).trim().startsWith('1. FLOW OF TITLE & LINK DEED DETAILS:')
    );
    const flowEnd = children.findIndex((child, index) =>
      index > flowStart && plainText(body.slice(child.start, child.end)).trim().startsWith('2. CONSIDERATION & PAYMENT TERMS:')
    );
    if (flowStart < 0 || flowEnd < 0 || flowEnd >= firstMarker) {
      throw new Error('Template flow-of-title boundaries are missing or damaged.');
    }
    const tailIsMarker = sharedTail >= 0 && plainText(body.slice(children[sharedTail].start, children[sharedTail].end)).trim() === '<FOR ALL THE DOCUMENTS>';
    const tailStart = sharedTail >= 0 ? sharedTail + (tailIsMarker ? 1 : 0) : children.length;
    const titleBlocks = (await Promise.all(selected.map(async (schedule, scheduleIndex) => {
      const titleValues = new Map<string, string>();
      for (const [key, value] of Object.entries(schedule.titleValues || values)) titleValues.set(norm(key), value ?? '');
      const titleRewrites: Rewrite[] = [...amendmentRewrites(schedule), ...(schedule.titleLinkRecords && schedule.titleLinkRecords.length > 1
        ? [{ find: /(?:\(a\)\s+)?Registered Deed:/i, replace: '', records: schedule.titleLinkRecords }]
        : [])];
      let block = removeOptionalTitleRecitals(
        await preserveFlatAgreementRecitals(prepared.titles[schedule.variant] || children.slice(flowStart, flowEnd).map(child => body.slice(child.start, child.end)).join(''), titleValues, schedule.variant),
        titleValues,
        schedule.variant,
      );
      block = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
        if (selected.length > 1 && /FLOW OF TITLE & LINK DEED DETAILS:/i.test(plainText(paragraph))) {
          paragraph = replaceRunText(paragraph, /FLOW OF TITLE & LINK DEED DETAILS:/i, () => `FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE ${scheduleIndex + 1}`);
        }
        return fillParagraph(paragraph, titleValues, missing, titleRewrites);
      });
      return block;
    }))).join('');
    const clauseBlocks = selected.map((schedule, index) => {
      const block = prepared.clauses[schedule.variant];
      if (!block) return '';
      const clauseValues = new Map(Object.entries(schedule.values).map(([key, value]) => [norm(key), value ?? '']));
      return restartClauseNumbering(block, entries).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
        if (selected.length > 1) paragraph = replaceRunText(paragraph, /3\. OPERATIVE CLAUSES & COVENANTS:/, () => `3. OPERATIVE CLAUSES & COVENANTS - SCHEDULE ${index + 1}:`);
        return fillParagraph(paragraph, clauseValues, missing, []);
      });
    }).join('');
    const scheduleBlocks = selected.map((schedule, scheduleIndex) => {
      const selectedIndex = order.findIndex(item => item.v === schedule.variant);
      if (selectedIndex < 0) return '';
      const start = order[selectedIndex].i + 1;
      const stop = selectedIndex + 1 < order.length
        ? order[selectedIndex + 1].i
        : sharedTail >= 0 ? sharedTail : children.length;
      const scheduleValues = new Map<string, string>();
      for (const [key, value] of Object.entries(schedule.values)) scheduleValues.set(norm(key), value ?? '');
      if (schedule.variant.startsWith('IF FLAT')) {
        const uds = Number((schedule.values.UDS || '').replace(/,/g, ''));
        scheduleValues.set(norm('Extent in Sq.Meters'), Number.isFinite(uds) && uds > 0 ? (uds * 0.836127).toFixed(2) : '');
      }
      const landmarkRelation = scheduleValues.get(norm('Near / Adjacent'))?.toLowerCase();
      let block = children.slice(start, stop).map(c => body.slice(c.start, c.end)).join('');
      block = ['IF HOUSE', 'IF HOUSE SEMI FINISHED'].includes(schedule.variant)
        ? prepareHouseBlock(block, schedule.values, schedule.structureDetails)
        : prepareNonHouseIdentifiers(block, schedule.variant, schedule.values);
      block = prepareLandmarkBlock(block, schedule.values, schedule.variant);
      block = addOwnershipShareParagraphs(block, schedule.vendorShares, schedule.vendeeShares);
      block = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p =>
          fillParagraph(
            landmarkRelation
              ? replaceRunText(p, /near\/adjacent(?=\s+H\.No\.)/gi, () => landmarkRelation)
              : p,
            scheduleValues, missing, [],
          )
        );
      // Supporting evidence fills existing fields; the template wording is unchanged.
      if (selected.length > 1) {
        block = block.replace('SCHEDULE OF PROPERTY', `SCHEDULE OF PROPERTY - ${scheduleIndex + 1}`);
        // Repeated headings must travel with their description when a schedule wraps.
        let heading = false;
        block = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => {
          const text = plainText(p).trim();
          if (text.startsWith('SCHEDULE OF PROPERTY')) heading = true;
          else if (text && !text.startsWith('(Description of the property')) heading = false;
          if (!heading) return p;
          if (/<w:keepNext\b/.test(p)) return p.replace(/<w:keepNext\b[^>]*\/>/, '<w:keepNext/>');
          return p.includes('<w:pPr>') ? p.replace('<w:pPr>', '<w:pPr><w:keepNext/>') : p.replace(/(<w:p(?:\s[^>]*)?>)/, '$1<w:pPr><w:keepNext/></w:pPr>');
        });
      }
      return block;
    }).join('');
    body = children.slice(0, flowStart).map(c => body.slice(c.start, c.end)).join('')
      + titleBlocks
      + children.slice(flowEnd, firstMarker).map(c => body.slice(c.start, c.end)).join('')
      + clauseBlocks
      + scheduleBlocks
      + children.slice(tailStart).map(c => body.slice(c.start, c.end)).join('');
  }

  // --- fill the placeholders ------------------------------------------------
  const kept = topLevelChildren(body);
  body = kept
    .map(c => {
      const chunk = body.slice(c.start, c.end);
      // Tables hold many paragraphs; fill each one.
      const filled = chunk.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p =>
        fillParagraph(p, values_, missing, rewrites)
      );
      // The template's market-value table ends with an empty row after a
      // repeating header. When a two-schedule deed pushes the table across a
      // page, Word can render that header by itself on the next page.
      return /Market Value per Sq\.\s*Yard/i.test(plainText(filled))
        ? removeTrailingEmptyTableRow(filled)
        : filled;
    })
    .join('');
  body = addPartySignatureLines(body, values_, rewrites);
  if (Object.keys(prepared.clauses).length) {
    let signing = false;
    body = body.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
      const text = plainText(paragraph).trim();
      if (/SIGN\/S OF (?:THE )?VENDOR\/S/.test(text)) signing = true;
      if (signing && /^2\.\s*$/.test(text)) { signing = false; return paragraph; }
      return signing ? keepWithNext(paragraph) : paragraph;
    });
  }

  // This optional attribution belongs after the witness signature block at the
  // end of the deed, including when a compatible custom template is selected.
  if (values_.get(norm('Include Prepared By'))) {
    // Keep the label, writing line and contact inside the printable width.
    // Word then moves this single line together if a page boundary is reached.
    const preparedBy = '<w:p><w:pPr><w:keepLines/><w:tabs><w:tab w:val="left" w:pos="4800"/></w:tabs><w:spacing w:before="120" w:line="264" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="28"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">Prepared By:____________________</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="28"/><w:u w:val="single"/></w:rPr><w:t>Gundlapelli Sampath (98662 70006)</w:t></w:r></w:p>';
    const sectionAt = body.lastIndexOf('<w:sectPr');
    body = sectionAt >= 0 ? body.slice(0, sectionAt) + preparedBy + body.slice(sectionAt) : body + preparedBy;
  }

  // The source is a catalogue with manual blank separator paragraphs. Once its
  // alternatives are removed, trailing separators must not create empty pages.
  // Retain the source's stamp-paper first-page section and witness writing space.
  if (hasSaleOpenings) {
    const chunks = topLevelChildren(body).map(child => body.slice(child.start, child.end));
    let empty = 0;
    body = chunks.map(chunk => !plainText(chunk).trim() && !/<w:sectPr\b/.test(chunk)
      ? chunk.replace(/<w:br\b[^>]*w:type="page"[^>]*\/>/g, '').replace(/<w:pageBreakBefore\b[^>]*\/>/g, '') : chunk).filter(chunk => {
      if (plainText(chunk).trim() || /<w:(?:sectPr|drawing|tbl)\b/.test(chunk)) { empty = 0; return true; }
      return ++empty <= 1;
    }).join('');
    let closing = false;
    body = body.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
      const text = plainText(paragraph).trim();
      if (text === 'DECLARATION') closing = true;
      if (closing && /^2\.\s*$/.test(text)) { closing = false; return paragraph; }
      return closing ? keepWithNext(paragraph) : paragraph;
    });
    const kept = topLevelChildren(body);
    let lastContent = kept.length - 1;
    while (lastContent >= 0 && (!plainText(body.slice(kept[lastContent].start, kept[lastContent].end)).trim()) && !/<w:(?:drawing|tbl)\b/.test(body.slice(kept[lastContent].start, kept[lastContent].end))) lastContent--;
    if (lastContent >= 0) body = body.slice(0, kept[lastContent].end) + kept.slice(lastContent + 1).map(child => body.slice(child.start, child.end)).filter(chunk => /^<w:sectPr\b/.test(chunk)).join('');
  }

  // Anything still in <Angle Brackets> is a placeholder no field maps to.
  const unmapped = [
    ...new Set(
      (plainText(body).match(/<[^<>]{2,60}>/g) || []).map(s => s.slice(1, -1).trim())
    ),
  ];

  if (['gpa', 'agpa'].includes(values['Sale Document Mode']) || Number(values['Ownership Vendor Count']) + Number(values['Ownership Vendee Count']) > 2) {
    const sections = body.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g) || [];
    const stamp = sections[0];
    const first = rewrites.find(rewrite => rewrite.partyRole === 'executant')?.records?.[0];
    const name = first?.['Registration Name'] || first?.['EXECUTANT NAME'];
    if (stamp && name) {
      const continued = body.replace(stamp, '');
      const principal = topLevelChildren(continued).find(child => /^<w:p\b/.test(continued.slice(child.start, child.end)) && plainText(continued.slice(child.start, child.end)).toLocaleUpperCase('en-IN').includes(name.toLocaleUpperCase('en-IN')));
      if (!principal) throw new Error('Cannot place the Sale continuation section after the first principal.');
      body = continued.slice(0, principal.end) + `<w:p><w:pPr>${stamp}</w:pPr></w:p>` + continued.slice(principal.end)
        + (sections.length === 1 ? normalContinuationSection(stamp) : '');
    }
  }
  xml = ensureStampPaperSpace(xml.slice(0, bodyStart) + body + xml.slice(bodyEnd), values['Stamp Paper Margin']);
  doc.data = new TextEncoder().encode(xml);
  for (const part of entries.filter(entry => /^word\/(?:header|footer)\d+\.xml$/.test(entry.name))) {
    const filled = new TextDecoder().decode(part.data).replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => fillParagraph(p, values_, missing, []));
    part.data = new TextEncoder().encode(filled);
  }

  const zipped = await writeZip(entries);
  return {
    blob: new Blob([zipped as any], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    missing: [...missing].sort(),
    unmapped: unmapped.sort(),
  };
}

/** Append reviewed registration-plan images after the approved deed template's text. */
export async function appendRegistrationPlans(blob: Blob, plans: { schedule: number; png: Uint8Array }[]): Promise<Blob> {
  if (!plans.length) return blob;
  const entries = await readZip(new Uint8Array(await blob.arrayBuffer()));
  const document = entries.find(entry => entry.name === 'word/document.xml');
  const relationships = entries.find(entry => entry.name === 'word/_rels/document.xml.rels');
  const contentTypes = entries.find(entry => entry.name === '[Content_Types].xml');
  if (!document || !relationships || !contentTypes) throw new Error('The deed is missing a required Word package part.');
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let xml = decoder.decode(document.data);
  let rels = decoder.decode(relationships.data);
  let types = decoder.decode(contentTypes.data);
  if (!types.includes('Extension="png"')) types = types.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
  const used = new Set([...rels.matchAll(/Id="(rId\d+)"/g)].map(match => match[1]));
  const planParagraphs: string[] = [];
  for (const plan of plans) {
    let number = 1;
    while (used.has(`rId${number}`)) number++;
    const id = `rId${number}`; used.add(id);
    const imageName = `deedcraft-plan-${plan.schedule}.png`;
    entries.push({ name: `word/media/${imageName}`, data: plan.png });
    rels = rels.replace('</Relationships>', `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageName}"/></Relationships>`);
    const title = escapeXml(`PLAN FOR REGISTRATION — SCHEDULE ${plan.schedule}`);
    planParagraphs.push(
      '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' +
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${title}</w:t></w:r></w:p>` +
      '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>' +
      '<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="5486400" cy="7760000"/><wp:docPr id="' + (9000 + plan.schedule) + '" name="Registration Plan"/>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="' + imageName + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="' + id + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="7760000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
    );
  }
  xml = xml.replace(/<w:sectPr\b/, planParagraphs.join('') + '<w:sectPr');
  document.data = encoder.encode(xml);
  relationships.data = encoder.encode(rels);
  contentTypes.data = encoder.encode(types);
  const zipped = await writeZip(entries);
  return new Blob([zipped as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


const GIFT_SCHEDULE_NAMES = ['IF OPEN PLACE', 'IF OPEN PLOT', 'IF DIMOLISHED HOUSE', 'IF PART OPEN PLACE', 'IF HOUSE', 'IF HOUSE SEMI FINISHED', 'IF FLAT SEMI FINISHED', 'IF FLAT FINISHED'];

function giftTemplateParts(body: string, municipal = false) {
  const chunks = topLevelChildren(body).map(child => body.slice(child.start, child.end));
  const texts = chunks.map(chunk => plainText(chunk).trim());
  const headings = texts.map((text, index) => text === 'SCHEDULE OF PROPERTY' ? index : -1).filter(index => index >= 0);
  const first = texts.findIndex(text => /^<IF /.test(text));
  const tail = texts.findIndex((text, index) => index > (headings.at(-1) ?? Infinity) && (text === '<FOR ALL THE DOCUMENTS>' || text === 'The schedule property is not the assigned property.' || text === 'DECLARATION' || (municipal && /^THE PLAN of schedule property/i.test(text))));
  const blocks = new Map<string, string>();
  for (const [index, heading] of headings.entries()) {
    const marker = texts.slice(0, heading).reverse().find(text => /^<IF /.test(text)) || '';
    const label = conditionName(marker);
    const name = label === 'IF DEMOLISHE HOUSE' ? 'IF DIMOLISHED HOUSE' : CONDITION_ALIASES[label] || label;
    if (!GIFT_SCHEDULE_NAMES.includes(name) || blocks.has(name)) throw new Error(`Missing, duplicate or unsupported Gift schedule marker: ${marker || 'none'}.`);
    blocks.set(name, chunks.slice(heading, headings[index + 1] ?? tail).filter(chunk => !/^<IF |^<FOR ALL/.test(plainText(chunk).trim())).join(''));
  }
  if (first < 0 || tail < 0 || blocks.size !== (municipal ? 4 : 8)) throw new Error(municipal ? 'Retain all four Municipal Gift land schedules and closing clauses.' : 'Retain all eight labelled Gift property schedules and the closing declaration.');
  return { chunks, first, tail, blocks };
}

function giftParagraphWording(paragraph: string, donors: number, donees: number, values: Record<string, string> = {}): string {
  giftPartyWording(plainText(paragraph), donors, donees, (find, replacement) => {
    paragraph = replaceRunText(paragraph, find, () => replacement);
  }, !!values['Executant Gender']);
  partyPronouns(plainText(paragraph), values, (find, replacement) => { paragraph = replaceRunText(paragraph, find, () => replacement); });
  return paragraph;
}

function enforceRegularGiftSourcePolicy(body: string): string {
  let inSchedule = false;
  return body.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const text = plainText(paragraph).trim();
    if (/^<IF /i.test(text)) inSchedule = true;
    if (/^<FOR ALL|^DECLARATION$|^The schedule property is not the assigned property\./i.test(text)) inSchedule = false;
    const result = regularGiftSourcePolicy(plainText(paragraph), inSchedule, (find, replacement) => {
      paragraph = replaceRunText(paragraph, find, () => replacement);
    });
    return text && !result.trim() && !/<w:(?:sectPr|drawing)\b/.test(paragraph) ? '' : paragraph;
  });
}

/** Gift uses its supplied reference package, with application-owned relationship and agreement. */
export async function validateGiftDeedTemplate(bytes: Uint8Array): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  let detectedPlaceholders: string[] = [];
  try {
    const entries = await readZip(bytes, { maxEntries: 2000, maxEntryBytes: 30 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024 });
    const document = entries.find(entry => entry.name === 'word/document.xml');
    if (!document) throw new Error('Missing word/document.xml.');
    const xml = protectDeedTemplateSource(new TextDecoder().decode(document.data), 'gift');
    const text = plainText(xml);
    detectedPlaceholders = angleTags(xml);
    const approved = await readZip(await loadTemplate('gift-deed-v5'));
    const approvedDocument = approved.find(entry => entry.name === 'word/document.xml')!;
    const supported = new Set([...AMENDMENT_TAGS, ...angleTags(new TextDecoder().decode(approvedDocument.data)), ...GIFT_SCHEDULE_NAMES, 'Executant Address', 'Claimant Address', 'Executant Share', 'Claimant Share', 'NALA Converted Extent', 'FOR ALL THE DOCUMENTS', 'Gift Relationship Recital', 'FAMILY MEMBER/OTHER THAN FAMILY MEMBER', 'Date', 'Executant Share', 'Claimant Share', 'Landmark House No.', 'IF OPEN PLACE/VACANT PLOT/PART OPEN PLACE/DEMOLISHED HOUSE/ HOUSE', 'IF HOUSE FINISHED', 'IF SEMI FINISHED FLAT', 'IF FINISHED FLAT', 'Date'].map(norm));
    for (const tag of detectedPlaceholders) if (!supported.has(norm(tag))) errors.push(`Unsupported Gift placeholder <${tag}>. Keep the starter bindings so details are not silently discarded.`);
    if (!/GIFT SETTLEMENT/i.test(text) || !/without any monetary consideration/i.test(text)) errors.push('Choose the supplied Gift Settlement reference, not a Sale deed.');
    const detected = new Set(detectedPlaceholders.map(norm));
    for (const tag of ['EXECUTANT NAME', 'EXECUTANT RELATION NAME', 'Executant Age', 'Executant Dob', 'Executant Occupation', 'Executant Adhar Number', 'Executant Cell.No.', 'CLAIMANT NAME', 'CLAIMANT RELATION NAME', 'Claimant Age', 'Claimant Dob', 'Claimant Occupation', 'Claimant Adhar Number', 'Claimant Cell.No.']) if (!detected.has(norm(tag))) errors.push(`The Gift template must retain <${tag}> so saved party details are not lost.`);
    for (const party of ['Executant', 'Claimant']) {
      if (detected.has(norm(`${party} Address`))) continue;
      for (const part of ['H.No.', 'Locality', 'Village', 'Mandal', 'District', 'State', 'Pin Code']) if (!detected.has(norm(`${party} ${part}`))) errors.push(`Retain <${party} ${part}> or the combined <${party} Address> so saved address details are not lost.`);
    }
    if ((text.match(/SCHEDULE OF PROPERTY/g) || []).length !== 8 || !/DECLARATION/.test(text) || !/SIGN\/S OF THE DONOR\/S/i.test(text) || !/SIGN\/S OF THE DONEE\/S/i.test(text)) errors.push('Retain all eight Gift property schedules, declaration and donor/donee signature sections.');
    const sections = xml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g) || [];
    if (sections.length < 2 || !/w:top="8208"/.test(sections[0])) errors.push('Retain the Gift page sections, including the first-page stamp space.');
    giftTemplateParts(xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>')));
    enforceRegularGiftSourcePolicy(xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>')));
  } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  return { valid: !errors.length, preservationVersion: DEED_PRESERVATION_VERSION, errors, detectedPlaceholders, omittedPlaceholders: [] };
}

export async function validateMunicipalGiftTemplate(bytes: Uint8Array): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  let detectedPlaceholders: string[] = [];
  try {
    const entries = await readZip(bytes);
    const document = entries.find(entry => entry.name === 'word/document.xml');
    if (!document) throw new Error('Missing word/document.xml.');
    const xml = protectDeedTemplateSource(new TextDecoder().decode(document.data), 'municipal-gift');
    const text = plainText(xml);
    detectedPlaceholders = angleTags(xml);
    const approved = await readZip(await loadTemplate('gift-municipal-v2'));
    const approvedXml = new TextDecoder().decode(approved.find(entry => entry.name === 'word/document.xml')!.data);
    const required = angleTags(approvedXml);
    const bindingName = (tag: string) => conditionTag(tag) ? norm(CONDITION_ALIASES[conditionName(tag)] || conditionName(tag)) : norm(tag);
    const detected = new Set(detectedPlaceholders.map(bindingName));
    const supported = new Set([...AMENDMENT_TAGS, ...required, 'ULB', 'Date', 'Executant Share', 'Claimant Share', 'Landmark House No.'].map(bindingName));
    if (/constitute under Hyderabad Municipal Corporation Act/i.test(text) && !/MUNICIPAL COUNCIL, SIRCILLA/i.test(text) && !detected.has(norm('ULB'))) errors.push('Retain the Municipal Gift binding <ULB>.');
    for (const tag of required) if (!detected.has(bindingName(tag))) errors.push(`Retain the Municipal Gift binding <${tag}>.`);
    for (const tag of detectedPlaceholders) if (!supported.has(bindingName(tag))) errors.push(`Unsupported Municipal Gift placeholder <${tag}>.`);
    // Municipal wording belongs to this source, independently of regular Gift protections.
    for (const phrase of ['GIFT DEED', 'Represented by its Commissioner', 'public purpose free of any cost and consideration', 'the said purpose only', 'THIS INDENTURE', 'THE AFORESAID']) {
      if (!text.includes(phrase)) errors.push(`Retain the Municipal Gift clause: ${phrase}.`);
    }
    if (!/(?:SIGNATURE\/S OF DONOR\/S|SIGN\/S OF THE DONOR\/S)/i.test(text)) errors.push('Retain the Municipal Gift donor signature section.');
    giftTemplateParts(xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>')), true);
    if ((xml.match(/<w:sectPr\b/g) || []).length < 2) errors.push('Retain the municipal stamp-space and continuation sections.');
  } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  return { valid: !errors.length, preservationVersion: DEED_PRESERVATION_VERSION, errors, detectedPlaceholders, omittedPlaceholders: [] };
}

async function fillMunicipalGiftDeed(values: Record<string, string>, rewrites: Rewrite[], schedules: ScheduleMerge[], source: DeedTemplateSource): Promise<MergeResult> {
  if (!schedules.length) throw new Error('Add a Municipal Gift property schedule.');
  for (const schedule of schedules) {
    if (!['IF OPEN PLACE', 'IF OPEN PLOT', 'IF DIMOLISHED HOUSE', 'IF PART OPEN PLACE'].includes(schedule.variant)) throw new Error('The Municipal Gift reference supports open place, plot, dismantled house and part open place only.');
    if (!schedule.values.ULB?.trim() || !schedule.values.VILLAGE?.trim()) throw new Error('Complete the property ULB / municipality and village for each municipal schedule.');
  }
  const bytes = source.kind === 'custom' ? source.bytes : source.kind === 'library' && source.versionId.startsWith('gift-municipal-') ? await loadLibraryBytes(source) : await loadTemplate('gift-municipal-v3');
  const validation = await validateMunicipalGiftTemplate(bytes);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const entries = await readZip(bytes);
  const document = entries.find(entry => entry.name === 'word/document.xml')!;
  const xml = protectDeedTemplateSource(new TextDecoder().decode(document.data), 'municipal-gift');
  assertTitleAmendmentBindings(xml, schedules);
  const start = xml.indexOf('<w:body>') + 8, end = xml.lastIndexOf('</w:body>');
  const { chunks, first: firstIndex, tail, blocks } = giftTemplateParts(xml.slice(start, end), true);
  const missing = new Set<string>();
  const donors = Number(values['Ownership Vendor Count']) || 1;
  const donees = Number(values['Ownership Vendee Count']) || 1;
  const fill = (block: string, record: Record<string, string>, edits: Rewrite[] = []) => block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    paragraph = replaceRunText(paragraph, /DD[-/.]?MM[-/.]?YYYY/g, () => '<Date>');
    paragraph = giftParagraphWording(paragraph, donors, donees, record);
    paragraph = replaceRunText(paragraph, /title holder\/s/gi, () => donors > 1 ? 'title holders' : 'title holder');
    paragraph = replaceRunText(paragraph, /his\/their/gi, () => donors > 1 ? 'their' : 'the Donor’s');
    paragraph = replaceRunText(paragraph, /SIGNATURE\/S OF DONORS?/gi, () => donors > 1 ? 'SIGNATURES OF DONORS' : 'SIGNATURE OF DONOR');
    if (/^\s*SIGNATURES? OF (?:THE )?DONORS?\.?\s*$/i.test(plainText(paragraph))) {
      // The new source pads this label with spaces; after grammatical expansion
      // Word otherwise wraps the donor name onto a separate, left-aligned line.
      const label = plainText(paragraph).trim();
      paragraph = replaceRunText(paragraph, /[\s\S]+/, () => label).replace(/<w:ind\b[^>]*\/>/g, '').replace(/<w:jc\b[^>]*\/>/g, '');
      paragraph = paragraph.replace(/<w:pPr\b[^>]*>/, tag => tag + '<w:jc w:val="right"/><w:keepNext/>');
    }
    return fillParagraph(paragraph, new Map(Object.entries(record).map(([key, value]) => [norm(key), value ?? ''])), missing, edits);
  });
  const partyRewrites = rewrites.filter(rewrite => rewrite.partyRole).map(rewrite => ({ ...rewrite, records: rewrite.partyRole === 'claimant' ? rewrite.records?.map(record => ({ ...record, 'MUNICIPAL COUNCIL RECITAL': municipalCouncilRecital(record['Registration Name'] || record['CLAIMANT NAME'] || '') })) : rewrite.records, finalSuffix: rewrite.partyRole === 'claimant' ? /\s*\(Hereinafter called the [\s\S]*$/i : rewrite.finalSuffix }));
  let opening = chunks.slice(0, firstIndex).join('');
  const donorParagraph = (opening.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || []).find(paragraph => /<EXECUTANT NAME>/i.test(plainText(paragraph)));
  if (!donorParagraph) throw new Error('Municipal Gift donor identity paragraph is missing.');
  const claimantParagraph = replaceRunText(donorParagraph, /Executant/gi, match => match[0] === match[0].toUpperCase() ? 'CLAIMANT' : 'Claimant')
    .replace('</w:p>', '<w:r><w:t xml:space="preserve"> (Hereinafter called the &quot;DONEE/S&quot;) of the OTHER PART.</w:t></w:r></w:p>');
  opening = opening.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => /Represented by its Commissioner/i.test(plainText(paragraph)) ? claimantParagraph : paragraph);
  // Repeat the source title recital for every linked deed, keeping its donor definition once.
  opening = opening.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    if (!/Whereas the donor\/s.*title holder/i.test(plainText(paragraph))) return paragraph;
    const records = schedules.flatMap(schedule => schedule.titleLinkRecords?.length ? schedule.titleLinkRecords : [schedule.titleValues || schedule.values]);
    return records.map((record, index) => fill(index < records.length - 1 ? replaceRunText(paragraph, /\s*\(Hereinafter called[\s\S]*$/i, () => '') : paragraph, record)).join('');
  });
  opening = opening.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const kind = plainText(paragraph).trim().match(/^(Rectification|Supplemental) Deed:/i)?.[1].toLowerCase() as 'rectification' | 'supplemental' | undefined;
    if (!kind) return paragraph;
    const suffix = plainText(paragraph).match(/\s*\(Hereinafter called[\s\S]*$/i)?.[0] || '';
    const prototype = suffix ? replaceRunText(paragraph, /\s*\(Hereinafter called[\s\S]*$/i, () => '') : paragraph;
    return schedules.flatMap(schedule => schedule.amendmentRecords?.[kind] || []).map(record => fill(prototype, record)).join('')
      + (suffix ? paragraphLike(paragraph, suffix.trim()) : '');
  });
  opening = fill(opening, values, partyRewrites);
  // The source puts its first section break after the recipient. Expanded
  // title/amendment records before that point must use continuation margins.
  const openingStamp = opening.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/)?.[0];
  const firstDonor = partyRewrites.find(rewrite => rewrite.partyRole === 'executant')?.records?.[0];
  const firstDonorName = firstDonor?.['Registration Name'] || firstDonor?.['EXECUTANT NAME'] || firstDonor?.['Executant Name'];
  if (openingStamp && firstDonorName) {
    opening = opening.replace(openingStamp, '');
    const donor = topLevelChildren(opening).find(child => plainText(opening.slice(child.start, child.end)).toLocaleUpperCase('en-IN').includes(firstDonorName.toLocaleUpperCase('en-IN')));
    if (!donor) throw new Error('Cannot place the Municipal Gift continuation section after the first donor.');
    opening = opening.slice(0, donor.end) + `<w:p><w:pPr>${openingStamp}</w:pPr></w:p>` + opening.slice(donor.end);
  }
  const selected = schedules.map((schedule, index) => {
    let block = prepareNonHouseIdentifiers(blocks.get(schedule.variant)!, schedule.variant, schedule.values);
    block = prepareLandmarkBlock(block, schedule.values, schedule.variant);
    if (schedules.length > 1) block = block.replace('SCHEDULE OF PROPERTY', `SCHEDULE OF PROPERTY - ${index + 1}`);
    block = addOwnershipShareParagraphs(block, schedule.vendorShares, undefined).replace(/The vendors convey/gi, 'The Donors gift');
    return fill(block, schedule.values);
  }).join('');
  let closing = chunks.slice(tail).join('');
  closing = closing.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => !values['Include Prepared By'] && /Prepared By:/i.test(plainText(paragraph)) ? '' : paragraph);
  const result = opening + selected + fill(closing, values);
  const unmapped = [...new Set((plainText(result).match(/<[^<>]{2,60}>/g) || []).map(tag => tag.slice(1, -1).trim()))];
  let sectionIndex = 0;
  const numbered = (xml.slice(0, start) + result + xml.slice(end)).replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, section => sectionIndex++ === 0 ? section : section.replace(/(<w:pgNumType\b[^>]*?)\s+w:start="[^"]*"/g, '$1'));
  document.data = new TextEncoder().encode(ensureStampPaperSpace(numbered, values['Stamp Paper Margin']));
  return { blob: new Blob([await writeZip(entries) as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), missing: [...missing].sort(), unmapped: unmapped.sort() };
}

export async function fillGiftDeed(values: Record<string, string>, rewrites: Rewrite[], schedules: ScheduleMerge[], source: DeedTemplateSource = BUILT_IN_TEMPLATE_SOURCE): Promise<MergeResult> {
  if (values['Gift Variant'] === 'municipal-gift') return fillMunicipalGiftDeed(values, rewrites, schedules, source);
  if (!values.Relationship?.trim()) throw new Error('Select the relationship of the Donee to the Donor before downloading the Gift deed.');
  if (!schedules.length) throw new Error('Add a Gift property schedule.');
  const bytes = source.kind === 'custom' ? source.bytes : source.kind === 'library' && !source.versionId.startsWith('gift-deed-') ? await loadTemplate('gift-deed-v6') : source.kind === 'library' ? await loadLibraryBytes(source) : await loadTemplate('gift-deed-v6');
  const validation = await validateGiftDeedTemplate(bytes);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const entries = await readZip(bytes);
  const document = entries.find(entry => entry.name === 'word/document.xml')!;
  let xml = protectDeedTemplateSource(new TextDecoder().decode(document.data), 'gift');
  assertTitleAmendmentBindings(xml, schedules);
  const start = xml.indexOf('<w:body>') + 8, end = xml.lastIndexOf('</w:body>');
  const body = enforceRegularGiftSourcePolicy(xml.slice(start, end));
  const { chunks, first, tail, blocks } = giftTemplateParts(body);
  const donors = Number(values['Ownership Vendor Count']) || 1, donees = Number(values['Ownership Vendee Count']) || 1;
  const missing = new Set<string>();
  const map = (record: Record<string, string>) => new Map(Object.entries(record).map(([key, value]) => [norm(key), value ?? '']));
  // The reviewed Gift output omits ownership allocation wording, while the
  // draft retains those values for other instruments and future editing.
  const withoutShares = (record: Record<string, string>) => ({ ...record, 'Executant Share': '', 'Claimant Share': '', 'UNDIVIDED SHARE RECITAL': '' });
  const giftRewrites = rewrites.filter(rewrite => rewrite.partyRole).map(rewrite => ({ ...rewrite, records: rewrite.records?.map(withoutShares), finalSuffix: /\s*\(Hereinafter called the [\s\S]*$/i }));
  const fill = (block: string, record: Record<string, string>, partyRewrites: Rewrite[] = []) => block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => fillParagraph(paragraph, map(record), missing, partyRewrites));
  let opening = chunks.slice(0, first).join('');
  const headingChunks = topLevelChildren(opening).map(child => opening.slice(child.start, child.end));
  const headingIndex = headingChunks.findIndex(chunk => /^GIFT SETTLEMENT DEED IN FAVOUR OF/i.test(plainText(chunk).trim()));
  if (headingIndex >= 0) {
    const separateCategory = /^(?:FAMILY MEMBERS?|OTHER|OTHERS|TRUST OR CHARITY|<FAMILY MEMBER\/OTHER THAN FAMILY MEMBER>)$/i.test(plainText(headingChunks[headingIndex + 1] || '').trim());
    const category = values['Gift Variant'] === 'gift-to-trust-or-charity' ? 'TRUST OR CHARITY'
      : values['Gift Variant'] && values['Gift Variant'] !== 'family-gift' ? 'OTHERS' : donees > 1 ? 'FAMILY MEMBERS' : 'FAMILY MEMBER';
    let heading = replaceRunText(headingChunks[headingIndex], /[\s\S]+/, () => `GIFT SETTLEMENT DEED IN FAVOUR OF ${category}`);
    heading = heading.replace(/<w:(?:br|cr)\b[^>]*\/>/g, '').replace(/<w:ind\b[^>]*\/>/g, '').replace(/<w:spacing\b[^>]*w:val="[^"]*"[^>]*\/>/g, '')
      .replace(/<w:sz(Cs)?\b[^>]*\/>/g, '<w:sz$1 w:val="24"/>');
    heading = heading.replace(/<w:jc\b[^>]*\/>/g, '').replace('<w:pPr>', '<w:pPr><w:jc w:val="center"/>');
    headingChunks[headingIndex] = heading;
    if (separateCategory) headingChunks.splice(headingIndex + 1, 1);
    opening = headingChunks.join('');
  }
  let relationshipFound = false;
  opening = opening.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    const text = plainText(paragraph);
    for (const [name, party] of [['EXECUTANT', 'Executant'], ['CLAIMANT', 'Claimant']]) {
      if (new RegExp(`<\\s*${name} NAME\\s*>`, 'i').test(text) && !new RegExp(`<\\s*${party} PAN\\s*>`, 'i').test(text)) paragraph = replaceRunText(paragraph, /[.,]?\s*\(Hereinafter called the/i, () => `, PAN: <${party} PAN>. (Hereinafter called the`);
    }
    if (/WHEREAS\s+the\s+Donee|<Gift Relationship Recital>/i.test(text)) {
      relationshipFound = true;
      return replaceRunText(paragraph, /[\s\S]+/, () => values['Gift Relationship Recital']);
    }
    paragraph = replaceRunText(paragraph, /DD[-/.]?MM[-/.]?YYYY/g, () => '<Date>');
    if (values['Gift Variant'] && values['Gift Variant'] !== 'family-gift') paragraph = replaceRunText(paragraph, /FAMILY MEMBERS?/gi, () => values['Gift Variant'] === 'gift-to-trust-or-charity' ? 'TRUST OR CHARITY' : 'OTHER');
    return giftParagraphWording(paragraph, donors, donees, values);
  });
  if (!relationshipFound) {
    const children = topLevelChildren(opening);
    const claimant = children.find(child => /<\s*CLAIMANT NAME\s*>/i.test(plainText(opening.slice(child.start, child.end))));
    if (!claimant) throw new Error('Cannot safely place the required Gift relationship clause.');
    opening = opening.slice(0, claimant.end) + paragraphLike(opening.slice(claimant.start, claimant.end), values['Gift Relationship Recital']) + opening.slice(claimant.end);
  }
  // Title/link records are independent for each property.
  const titleStart = topLevelChildren(opening).find(child => /^Registered Deed:/i.test(plainText(opening.slice(child.start, child.end)).trim()));
  const titleEnd = topLevelChildren(opening).find(child => /^WHEREAS the Donor/i.test(plainText(opening.slice(child.start, child.end)).trim()) && child.start > (titleStart?.start ?? Infinity));
  if (titleStart && titleEnd) {
    const block = opening.slice(titleStart.start, titleEnd.start);
    const titleBlocks = schedules.map(schedule => {
      const title = map(schedule.titleValues || values);
      const titleRewrites: Rewrite[] = [...amendmentRewrites(schedule), ...(schedule.titleLinkRecords && schedule.titleLinkRecords.length > 1 ? [{ find: /^Registered Deed:/i, replace: '', records: schedule.titleLinkRecords }] : [])];
      return fill(removeOptionalTitleRecitals(block, title, schedule.variant), schedule.titleValues || values, titleRewrites);
    }).join('');
    opening = opening.slice(0, titleStart.start) + titleBlocks + opening.slice(titleEnd.start);
  }
  opening = fill(opening, withoutShares(values), giftRewrites);
  const selected = schedules.map((schedule, index) => {
    const variant = schedule.variant === 'IF FLAT' ? schedule.values['Flat Stage'] === 'Semi Finished' ? 'IF FLAT SEMI FINISHED' : 'IF FLAT FINISHED' : schedule.variant;
    let block = blocks.get(variant);
    if (!block) throw new Error(`No Gift schedule is available for ${variant}.`);
    block = ['IF HOUSE', 'IF HOUSE SEMI FINISHED'].includes(variant) ? prepareHouseBlock(block, schedule.values, schedule.structureDetails) : prepareNonHouseIdentifiers(block, variant, schedule.values);
    if (variant === 'IF HOUSE SEMI FINISHED') block = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => /^\s*All that the\b/i.test(plainText(paragraph)) && !/semi.finished/i.test(plainText(paragraph)) ? replaceRunText(paragraph, /All that the\s+/i, () => 'All that the semi-finished ') : paragraph);
    const { 'NALA Converted Extent': omittedNalaExtent, ...giftScheduleValues } = schedule.values;
    block = prepareLandmarkBlock(block, giftScheduleValues, variant);
    block = block.replace(/property hereby sold/gi, 'property hereby gifted');
    // Gift is without monetary consideration, including every annexure variant.
    block = block.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, row => {
      if (!/Consideration/i.test(plainText(row))) return row;
      const cells = [...row.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)];
      const lastCell = cells[cells.length - 1];
      if (lastCell) row = row.slice(0, lastCell.index) + lastCell[0].replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => replaceRunText(paragraph, /[\s\S]+/, () => ': Nil')) + row.slice(lastCell.index! + lastCell[0].length);
      return row.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => replaceRunText(paragraph, /Consideration(?:\s*:\s*Nil)?/gi, () => 'Consideration'));
    });
    if (schedules.length > 1) block = block.replace('SCHEDULE OF PROPERTY', `SCHEDULE OF PROPERTY - ${index + 1}`);
    const giftValues = { ...schedule.values };
    if (variant.startsWith('IF FLAT') && giftValues.UDS) giftValues['Extent in Sq.Meters'] = (Number(giftValues.UDS.replace(/,/g, '')) * 0.836127).toFixed(2);
    return fill(block, giftValues);
  }).join('');
  let closing = chunks.slice(tail).filter(chunk => !/^<FOR ALL/.test(plainText(chunk).trim())).join('');
  closing = closing.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => giftParagraphWording(paragraph, donors, donees, values));
  closing = closing.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => !values['Include Prepared By'] && /Prepared By:/i.test(plainText(paragraph)) ? '' : paragraph);
  closing = fill(closing, values);
  // Match Sale's registration page setup, including the first-page stamp
  // space. Keep section boundaries while removing catalogue-only spacers.
  let result = opening + selected + closing;
  let empty = 0;
  let signing = false;
  result = topLevelChildren(result).map(child => result.slice(child.start, child.end)).map(chunk => {
    chunk = chunk.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
      if (/SIGNATURES? OF THE|^\s*\(Accepted\)/i.test(plainText(paragraph))) {
        paragraph = paragraph.replace(/<w:ind\b[^>]*\/>/g, '').replace(/<w:jc\b[^>]*\/>/g, '<w:jc w:val="right"/>');
        paragraph = paragraph.replace(/<w:spacing\b[^>]*\/>/g, '<w:spacing w:before="360" w:after="240"/>');
        if (/SIGNATURES? OF THE DONORS?/i.test(plainText(paragraph)) && /SIGNATURES? OF THE DONEES?/i.test(plainText(paragraph))) {
          // A right tab keeps both source-styled labels on one line even when
          // singular/plural agreement makes them longer than the source labels.
          paragraph = replaceRunText(paragraph, /[ \t]+(?=SIGNATURES? OF THE DONEES?)/i, () => '__GIFT_SIGNATURE_TAB__');
          paragraph = paragraph.replace('__GIFT_SIGNATURE_TAB__', '</w:t><w:tab/><w:t xml:space="preserve">');
          paragraph = paragraph.replace(/<w:tabs\b[^>]*>[\s\S]*?<\/w:tabs>/g, '').replace(/<w:jc\b[^>]*\/>/g, '<w:jc w:val="left"/>');
          paragraph = paragraph.replace(/<w:pPr\b[^>]*>/, tag => tag + '<w:tabs><w:tab w:val="right" w:pos="9760"/></w:tabs>');
        }
      }
      if (/^\s*(?:SCHEDULE OF PROPERTY|\(Description of the property|ANNEXURE|Boundaries of (?:Apartment|Flat)|DECLARATION)/i.test(plainText(paragraph))) paragraph = keepWithNext(paragraph);
      if (/^\s*THIS DEED of gift/i.test(plainText(paragraph))) paragraph = paragraph.replace(/<w:pPr\b[^>]*>/, tag => tag + '<w:keepLines/>');
      if (/^\s*IN WITNESS/i.test(plainText(paragraph))) signing = true;
      if (signing) paragraph = keepWithNext(paragraph);
      if (signing && /^\s*2\.\s*$/.test(plainText(paragraph))) signing = false;
      return paragraph;
    });
    return /Market Value per Sq\.\s*Yard/i.test(plainText(chunk)) ? removeTrailingEmptyTableRow(chunk) : chunk;
  }).filter(chunk => {
    if (plainText(chunk).trim() || /<w:(?:sectPr|drawing|tbl)\b/.test(chunk)) { empty = 0; return true; }
    return ++empty <= 1;
  }).join('');
  let sectionIndex = 0;
  result = result.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, section => {
    const top = sectionIndex++ === 0 && /w:top="8208"/.test(section) ? '8208' : '1080';
    return section
      .replace(/<w:pgSz\b[^>]*\/>/, '<w:pgSz w:w="11920" w:h="16840"/>')
      .replace(/<w:pgMar\b[^>]*\/>/, `<w:pgMar w:top="${top}" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>`);
  });
  const unmapped = [...new Set((plainText(result).match(/<[^<>]{2,60}>/g) || []).map(tag => tag.slice(1, -1).trim()))];
  document.data = new TextEncoder().encode(ensureStampPaperSpace(xml.slice(0, start) + result + xml.slice(end), values['Stamp Paper Margin']));
  return { blob: new Blob([await writeZip(entries) as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), missing: [...missing].sort(), unmapped: unmapped.sort() };
}
