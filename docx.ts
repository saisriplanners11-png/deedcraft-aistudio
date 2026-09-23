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
//      <IF OPEN PLACE>, <IF OPEN PLOT>, <IF HOUSE>, <IF DIMOLISHED HOUSE> and
//      <IF PART OPEN PLACE>.
//      The variant the property category selects is kept; the rest are removed.

import { loadSaleDeedTemplate } from './template';
import type { StructureDetails } from './fields';

const VARIANTS = ['IF OPEN PLACE', 'IF OPEN PLOT', 'IF HOUSE', 'IF DIMOLISHED HOUSE', 'IF PART OPEN PLACE'];
const OPERATIVE_CLAUSE_MARKERS = ['IF VACANT PLOT/OPEN PLACE/PART OPEN PLACE/DEMOLISHED HOUSE', 'IF HOUSE'] as const;
const STRUCTURAL_TAGS = new Set([...VARIANTS, 'FOR ALL THE DOCUMENTS'].map(value => value.toLowerCase()));
const REMOVED_STRUCTURE_PLACEHOLDERS = new Set(['nature of house', 'nature of roof', 'floors', 'age of house', 'plinth area']);
export const MAX_CUSTOM_TEMPLATE_BYTES = 20 * 1024 * 1024;

export type TemplateValidationResult = {
  valid: boolean;
  errors: string[];
  detectedPlaceholders: string[];
  omittedPlaceholders: string[];
};

export type DeedTemplateSource =
  | { kind: 'built-in' }
  | { kind: 'custom'; name: string; hash: string; bytes: Uint8Array; validation: TemplateValidationResult };

export const BUILT_IN_TEMPLATE_SOURCE: DeedTemplateSource = { kind: 'built-in' };

/** A literal phrase in the template to rewrite once the placeholders are filled. */
export type Rewrite = { find: RegExp; replace: string; records?: Record<string, string>[] };

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

const angleTags = (xml: string) => [...new Set(
  (plainText(xml).match(/<[^<>]{2,60}>/g) || [])
    .map(tag => tag.slice(1, -1).replace(/\s+/g, ' ').trim())
)];

/**
 * Validate an uploaded template against the renderer's structural contract and
 * the bundled template's placeholder vocabulary. Validation is deliberately
 * local: customer templates are never sent to an extraction provider.
 */
export async function validateSaleDeedTemplate(
  bytes: Uint8Array,
  filename = 'template.docx',
  referenceBytes?: Uint8Array,
): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  const empty = { valid: false, errors, detectedPlaceholders: [], omittedPlaceholders: [] };
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

    const xml = new TextDecoder().decode(document.data);
    const bodyOpen = xml.indexOf('<w:body>');
    const bodyEnd = xml.lastIndexOf('</w:body>');
    if (bodyOpen < 0 || bodyEnd < 0 || bodyEnd <= bodyOpen) {
      errors.push('Template is missing a readable Word document body.');
      return empty;
    }
    const body = xml.slice(bodyOpen + '<w:body>'.length, bodyEnd);
    const children = topLevelChildren(body);
    const paragraphs = children.map(child => plainText(body.slice(child.start, child.end)).trim());
    for (const marker of VARIANTS) if (!paragraphs.includes(`<${marker}>`)) errors.push(`Template is missing the <${marker}> schedule marker.`);
    const markerIndexes = VARIANTS.map(marker => paragraphs.indexOf(`<${marker}>`)).filter(index => index >= 0);
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
    const reference = referenceBytes ?? await loadSaleDeedTemplate();
    const referenceEntries = await readZip(reference);
    const referenceDocument = referenceEntries.find(entry => entry.name === 'word/document.xml');
    if (!referenceDocument) throw new Error('The built-in template is missing word/document.xml.');
    const supported = angleTags(new TextDecoder().decode(referenceDocument.data))
      .filter(tag => !STRUCTURAL_TAGS.has(norm(tag)));
    const supportedByName = new Map(supported.map(tag => [norm(tag), tag]));
    const detectedPlaceholders = customTags.filter(tag => supportedByName.has(norm(tag)));
    const unknown = customTags.filter(tag => !STRUCTURAL_TAGS.has(norm(tag)) && !supportedByName.has(norm(tag)));
    if (unknown.length) errors.push(`Unsupported placeholder${unknown.length === 1 ? '' : 's'}: ${unknown.map(tag => `<${tag}>`).join(', ')}.`);
    const detectedNames = new Set(detectedPlaceholders.map(norm));
    const omittedPlaceholders = supported.filter(tag => !detectedNames.has(norm(tag))).sort();
    return { valid: errors.length === 0, errors, detectedPlaceholders: detectedPlaceholders.sort(), omittedPlaceholders };
  } catch (error: any) {
    errors.push(error?.message || 'Template is not a readable Word document.');
    return empty;
  }
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
    return opening + ' xml:space="preserve">' + escapeXml(value) + '</w:t>';
  });
}

function fillParagraph(p: string, values: Map<string, string>, missing: Set<string>, rewrites: Rewrite[]): string {
  // Apply structural recitals first, then merge placeholders into their own runs.
  const repeat = rewrites.find(rw => rw.records && rw.find.test(plainText(p)));
  if (repeat) return repeat.records!.map(record => fillParagraph(p, new Map([...values, ...Object.entries(record).map(([key, value]) => [norm(key), value] as [string, string])]), missing, rewrites.filter(rw => rw !== repeat))).join('');
  // This placeholder is reused by the original template for different concepts.
  if (/WHEREAS[\s\S]*agreed consideration amount/i.test(plainText(p))) {
    const hasDedicatedWordsField = /<\s*Consideration in words\s*>/i.test(plainText(p));
    p = replaceRunText(p, /<Market of Value Rs\.\/->/gi, () => hasDedicatedWordsField ? '<Sale Consideration>' : '<Sale Consideration> (<Sale Consideration Words>)');
  } else if (/sale consideration|consideration value/i.test(plainText(p))) {
    p = replaceRunText(p, /<Market of Value Rs\.\/->/gi, () => '<Sale Consideration>');
  }
  // The supplied template intentionally retains its source wording, including
  // two date placeholders that are also used by the link-deed recital. Make
  // those two occurrences unambiguous before the generic placeholder pass.
  if (/Nala Order/i.test(plainText(p))) p = replaceRunText(p, /<Link Doct\.Date>/gi, () => '<Nala Order Date>');
  if (/Property Tax:/i.test(plainText(p))) {
    p = replaceRunText(p, /<Link Doct\.Date>/gi, () => '<Tax Paid Date>');
    p = replaceRunText(p, /<Village>/gi, () => '<Local Body Name>');
  }
  // The old one-line Annexure fields are superseded by the repeatable table.
  if (/<\s*(?:Nature of House|Nature Of House|Nature of roof|Floors|Age of House|Plinth Area)\s*>/i.test(plainText(p))) return '';
  for (const rw of rewrites.filter(rw => !rw.records)) {
    p = replaceRunText(p, rw.find, () => rw.replace);
  }
  return replaceRunText(p, /<([^<>]{2,60}?)>/g, match => {
    const name = match[1].trim();
    // Annexure I-A now renders repeatable rows; blank the template's retired
    // scalar structure placeholders without reporting false missing facts.
    if (REMOVED_STRUCTURE_PLACEHOLDERS.has(norm(name))) return '';
    const value = values.get(norm(name));
    if (value) return value;
    missing.add(name);
    return '__________';
  });
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
function removeOptionalTitleRecitals(body: string, values: Map<string, string>): string {
  const has = (...names: string[]) => names.every(name => !!values.get(norm(name)));
  const optional: Array<{ test: RegExp; keep: () => boolean }> = [
    { test: /Vacant Land Tax\/Assessment/i, keep: () => has('VLT No.') },
    { test: /Approved Layout:/i, keep: () => has('Layout File No.') },
    { test: /Title Deed:/i, keep: () => has('Pattadar Pass Book No', 'Pass Book Khata No') },
    { test: /Nala Order:/i, keep: () => has('Nala Order No', 'Nala Order Date') },
    { test: /Property Tax:/i, keep: () => has('House Tax Receipt', 'Tax Paid Date', 'Local Body Name') },
    { test: /Tax\/Assessment & Identification Particulars:/i, keep: () => has('P.T.I.No.') },
    { test: /House Permission:/i, keep: () => has('House Permission No.', 'Permission Date', 'Municipality/Gram Panchayat Name') },
    { test: /L\.R\.S\.-2020 Application:/i, keep: () => has('LRS Application No.', 'Application Date') },
    { test: /L\.R\.S\. Proceeding:/i, keep: () => has('LRS Proceeding No.', 'Proceeding Date') },
  ];
  return topLevelChildren(body).map(child => {
    const chunk = body.slice(child.start, child.end);
    const rule = optional.find(item => item.test.test(plainText(chunk)));
    return rule && !rule.keep() ? '' : chunk;
  }).join('');
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
  const keepHouse = variant === 'IF HOUSE';
  const kept = children.filter((_, index) =>
    index < vacantMarker
    || (keepHouse ? index > houseMarker && index < firstSchedule : index > vacantMarker && index < houseMarker)
    || index >= firstSchedule
  );
  return kept.map(child => body.slice(child.start, child.end)).join('');
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
): Promise<string> {
  const bin = await loadSaleDeedTemplate();
  const entries = await readZip(bin);
  const doc = entries.find(e => e.name === 'word/document.xml');
  if (!doc) throw new Error('Template is missing word/document.xml.');
  const xml = new TextDecoder().decode(doc.data);
  const bodyStart = xml.indexOf('<w:body>') + '<w:body>'.length;
  const bodyEnd = xml.lastIndexOf('</w:body>');
  const body = xml.slice(bodyStart, bodyEnd);

  const children = topLevelChildren(body);
  const markerAt = new Map<string, number>();
  children.forEach((c, i) => {
    const t = plainText(body.slice(c.start, c.end)).trim();
    for (const v of VARIANTS) if (t === `<${v}>`) markerAt.set(v, i);
  });
  if (!markerAt.has(variant)) return '';

  const order = VARIANTS
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
  const withEvidence = selected;
  return (withEvidence.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [])
    .map(paragraph => plainText(fillParagraph(paragraph, values_, missing, [])).trim())
    .filter(Boolean)
    .join('\n\n');
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
  /** Source-backed recitals shown only when supporting files were uploaded. */
  supportingRecords?: string[];
  /** Repeatable Annexure I-A rows belonging only to this property schedule. */
  structureDetails?: StructureDetails;
};

const tableCell = (text: string, bold = false) => `<w:tc><w:tcPr><w:tcW w:w="1800" w:type="dxa"/></w:tcPr><w:p><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t>${escapeXml(text)}</w:t></w:r></w:p></w:tc>`;
const annexureStructureTable = (details?: StructureDetails) => {
  if (!details?.rows.length) return '';
  const displayType = (row: StructureDetails['rows'][number]) => row.structureType === 'Other / Custom Structure'
    ? row.customStructureType || row.structureType : row.structureType;
  const displayFloor = (floor: string) => {
    const match = floor.match(/^floor(?:\s+no\.)?\s+(\d+)$/i);
    if (!match) return floor;
    const words = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'];
    const number = Number(match[1]);
    return number <= 20 ? `${words[number]} Floor` : floor;
  };
  const header = ['Total Floors', 'Floor No.', 'Structure Type', 'Stage', 'Building Age', 'Built-up Area (Sq. Ft.)'].map(cell => tableCell(cell, true)).join('');
  const rows = details.rows.map(row => `<w:tr>${[
    details.totalFloors, displayFloor(row.floorNo), displayType(row), row.stage, row.buildingAge, row.builtUpAreaSqFt,
  ].map(cell => tableCell(cell)).join('')}</w:tr>`).join('');
  return `<w:p><w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>ANNEXURE I-A — STRUCTURE DETAILS</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/></w:tblBorders></w:tblPr><w:tr>${header}</w:tr>${rows}</w:tbl>`;
};

/** Insert after an explicit template marker when supplied, otherwise append to the schedule block. */
const insertAnnexureStructureTable = (block: string, details?: StructureDetails) => {
  const table = annexureStructureTable(details);
  if (!table) return block;
  let found = false;
  const anchored = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
    if (plainText(paragraph).trim() !== '<ANNEXURE I-A STRUCTURE DETAILS>') return paragraph;
    found = true;
    return table;
  });
  return found ? anchored : anchored + table;
};

/**
 * @param values   placeholder name -> value, keyed exactly as the template writes it
 * @param variant  which SCHEDULE OF PROPERTY block to keep, e.g. 'IF OPEN PLOT'
 * @param rewrites literal phrases to fix up after substitution
 */
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
  const bin = templateSource.kind === 'custom' ? templateSource.bytes : await loadSaleDeedTemplate();
  const entries = await readZip(bin);

  const doc = entries.find(e => e.name === 'word/document.xml');
  if (!doc) throw new Error('Template is missing word/document.xml.');

  let xml = new TextDecoder().decode(doc.data);
  const bodyStart = xml.indexOf('<w:body>') + '<w:body>'.length;
  const bodyEnd = xml.lastIndexOf('</w:body>');
  let body = selectOperativeClauses(markConsiderationRows(xml.slice(bodyStart, bodyEnd)), variant);
  const values_ = new Map<string, string>();
  for (const [k, v] of Object.entries(values)) values_.set(norm(k), v ?? '');

  // --- keep only the selected schedule variant -----------------------------
  const children = topLevelChildren(body);
  const markerAt = new Map<string, number>();
  children.forEach((c, i) => {
    const t = plainText(body.slice(c.start, c.end)).trim();
    for (const v of VARIANTS) if (t === `<${v}>`) markerAt.set(v, i);
  });

  const missing = new Set<string>();
  if (markerAt.size !== VARIANTS.length) throw new Error('Template schedule markers are missing or damaged.');
  if (markerAt.size === VARIANTS.length) {
    const order = VARIANTS.map(v => ({ v, i: markerAt.get(v)! })).sort((a, b) => a.i - b.i);
    // Everything from this marker onward is shared by every property schedule.
    // Without this boundary the final schedule variant incorrectly owns the
    // declaration, signatures, witnesses and prepared-by paragraphs too.
    const sharedTail = children.findIndex((c, i) =>
      i > order[order.length - 1].i && ['<FOR ALL THE DOCUMENTS>', 'DECLARATION'].includes(plainText(body.slice(c.start, c.end)).trim())
    );
    const selected = schedules.length ? schedules : [{ variant, values }];
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
    const titleBlocks = selected.map((schedule, scheduleIndex) => {
      const titleValues = new Map<string, string>();
      for (const [key, value] of Object.entries(schedule.titleValues || values)) titleValues.set(norm(key), value ?? '');
      const titleRewrites: Rewrite[] = schedule.titleLinkRecords && schedule.titleLinkRecords.length > 1
        ? [{ find: /(?:\(a\)\s+)?Registered Deed:/i, replace: '', records: schedule.titleLinkRecords }]
        : [];
      let block = removeOptionalTitleRecitals(
        children.slice(flowStart, flowEnd).map(child => body.slice(child.start, child.end)).join(''),
        titleValues,
      );
      block = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph => {
        if (selected.length > 1 && /FLOW OF TITLE & LINK DEED DETAILS:/i.test(plainText(paragraph))) {
          paragraph = replaceRunText(paragraph, /FLOW OF TITLE & LINK DEED DETAILS:/i, () => `FLOW OF TITLE & LINK DEED DETAILS - SCHEDULE ${scheduleIndex + 1}`);
        }
        return fillParagraph(paragraph, titleValues, missing, titleRewrites);
      });
      return block;
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
      const landmarkRelation = scheduleValues.get(norm('Near / Adjacent'))?.toLowerCase();
      let block = children.slice(start, stop).map(c => {
        const chunk = body.slice(c.start, c.end);
        return chunk.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p =>
          fillParagraph(
            landmarkRelation
              ? replaceRunText(p, /near\/adjacent(?=\s+H\.No\.)/gi, () => landmarkRelation)
              : p,
            scheduleValues, missing, [],
          )
        );
      }).join('');
      block = insertAnnexureStructureTable(block, schedule.variant === 'IF HOUSE' ? schedule.structureDetails : undefined);
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
      + scheduleBlocks
      + children.slice(tailStart).map(c => body.slice(c.start, c.end)).join('');
  }

  // --- fill the placeholders ------------------------------------------------
  const kept = topLevelChildren(body);
  body = kept
    .map(c => {
      const chunk = body.slice(c.start, c.end);
      // Tables hold many paragraphs; fill each one.
      return chunk.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p =>
        fillParagraph(p, values_, missing, rewrites)
      );
    })
    .join('');

  // Anything still in <Angle Brackets> is a placeholder no field maps to.
  const unmapped = [
    ...new Set(
      (plainText(body).match(/<[^<>]{2,60}>/g) || []).map(s => s.slice(1, -1).trim())
    ),
  ];

  xml = xml.slice(0, bodyStart) + body + xml.slice(bodyEnd);
  doc.data = new TextEncoder().encode(xml);

  const zipped = await writeZip(entries);
  return {
    blob: new Blob([zipped as any], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    missing: [...missing].sort(),
    unmapped: unmapped.sort(),
  };
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
