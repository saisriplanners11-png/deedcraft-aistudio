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
export type Rewrite = { find: RegExp; replace: string; records?: Record<string, string>[]; partyRole?: 'executant' | 'claimant' };

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
  // Apply structural recitals first, then merge placeholders into their own runs.
  const repeat = rewrites.find(rw => rw.records && rw.find.test(plainText(p)));
  if (repeat) return repeat.records!.map((record, index) => {
    const numbered = repeat.partyRole ? replaceRunText(p, repeat.find, match => `${index + 1}. ${match[0]}`) : p;
    return fillParagraph(numbered, new Map([...values, ...Object.entries(record).map(([key, value]) => [norm(key), value] as [string, string])]), missing, rewrites.filter(rw => rw !== repeat));
  }).join('');
  // This placeholder is reused by the original template for different concepts.
  if (/WHEREAS[\s\S]*agreed consideration amount/i.test(plainText(p))) {
    const hasDedicatedWordsField = /<\s*Consideration in words\s*>/i.test(plainText(p));
    p = replaceRunText(p, /<Market of Value Rs\.\/->/gi, () => hasDedicatedWordsField ? '<Sale Consideration>' : '<Sale Consideration> <Sale Consideration Words>');
  } else if (/sale consideration|consideration value/i.test(plainText(p))) {
    p = replaceRunText(p, /<Market of Value Rs\.\/->/gi, () => '<Sale Consideration>');
  }
  // The supplied template intentionally retains its source wording, including
  // two date placeholders that are also used by the link-deed recital. Make
  // those two occurrences unambiguous before the generic placeholder pass.
  if (/Nala Order:|Property Tax:/i.test(plainText(p)) && !values.get(norm('Link Doct.Date'))) {
    p = replaceRunText(p, /<Link Doct\.Date>/gi, () => '__________');
  }
  if (/Property Tax:/i.test(plainText(p))) {
    p = replaceRunText(p, /<Village>/gi, () => '<Local Body Name>');
  }
  // Amounts written in words are consistently parenthesized throughout the deed.
  p = replaceRunText(p, /<\s*(Consideration in words|Sale Consideration Words)\s*>/gi, match => `(${match[0]})`);
  for (const rw of rewrites.filter(rw => !rw.records)) {
    p = replaceRunText(p, rw.find, () => rw.replace);
  }
  p = removeEmptyFields(p, values, missing);
  p = replaceRunText(p, /<([^<>]{2,60}?)>/g, match => {
    const name = match[1].trim();
    return values.get(norm(name)) || '';
  });
  return replaceRunText(p, /\uE000/g, () => '    ');
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
    { test: /Registered Deed:/i, keep: () => has('Link Doc Type', 'Link Doct.No.', 'Link Doct.Date') },
    { test: /Vacant Land Tax\/Assessment/i, keep: () => has('V.L.T. No.') },
    { test: /Approved Layout:/i, keep: () => has('Layout File No.') },
    { test: /Title Deed:/i, keep: () => has('Pattadar Pass Book No', 'Pass Book Khata No') },
    { test: /Nala Order:/i, keep: () => has('Nala Order No') },
    { test: /Property Tax:/i, keep: () => has('House Tax Receipt', 'Local Body Name') },
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
  structureDetails?: StructureDetails,
  vendeeShares?: VendeeShare[],
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
  const withEvidence = addVendeeShareParagraph(variant === 'IF HOUSE'
    ? prepareHouseBlock(selected, values, structureDetails)
    : prepareNonHouseIdentifiers(selected, variant, values), vendeeShares);
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
  vendeeShares?: VendeeShare[];
};

export type VendeeShare = { partyNumber: number; name: string; percentage: string };

/** Place an ownership allocation inside its own schedule, after the boundaries. */
function addVendeeShareParagraph(block: string, shares?: VendeeShare[]): string {
  if (!shares?.length) return block;
  const children = topLevelChildren(block);
  const boundary = children.find(child => {
    const chunk = block.slice(child.start, child.end);
    return /North\s*:/i.test(plainText(chunk)) && /West\s*:/i.test(plainText(chunk));
  });
  if (!boundary) throw new Error('Template schedule boundaries are missing; vendee shares could not be placed.');
  const description = children.map(child => block.slice(child.start, child.end))
    .find(chunk => /^\s*All that the\b/i.test(plainText(chunk)));
  const properties = description?.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] || '<w:pPr/>';
  const allocations = shares.map(share =>
    `(${share.partyNumber}) ${share.name || '________________'} — ${share.percentage || '____'}%`
  ).join('; ');
  const sentence = `The vendees acquire this Schedule Property in the following undivided shares: ${allocations}.`;
  const paragraph = `<w:p>${properties}<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${escapeXml(sentence)}</w:t></w:r></w:p>`;
  return block.slice(0, boundary.end) + paragraph + block.slice(boundary.end);
}

/** Add a labelled writing line for each party under the source signature headings. */
function addPartySignatureLines(body: string, values: Map<string, string>, rewrites: Rewrite[]): string {
  const partyRewrite = (role: 'executant' | 'claimant') => rewrites.find(rewrite => rewrite.partyRole === role);
  const vendors = partyRewrite('executant')?.records?.map(record => record['EXECUTANT NAME'] || '')
    || [values.get(norm('EXECUTANT NAME')) || ''];
  const vendees = partyRewrite('claimant')?.records?.map(record => record['CLAIMANT NAME'] || '')
    || [values.get(norm('CLAIMANT NAME')) || ''];
  if (vendors.length < 2 && vendees.length < 2) return body;
  const heading = topLevelChildren(body).find(child =>
    /SIGN\/S OF VENDOR\/S[\s\S]*SIGN\/S OF VENDEE\/S/i.test(plainText(body.slice(child.start, child.end)))
  );
  if (!heading) throw new Error('Template signature headings are missing; party signatures could not be numbered.');
  const source = body.slice(heading.start, heading.end);
  const properties = (source.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] || '<w:pPr/>')
    .replace(/<w:tabs(?:\s[^>]*)?>[\s\S]*?<\/w:tabs>/, '')
    .replace(/<w:jc w:val="both"\/>/, '<w:jc w:val="left"/>');
  const label = (name: string, index: number, numbered: boolean) =>
    `${numbered ? `${index + 1}. ` : ''}________________ (${name || 'NAME'})`;
  const lines = Array.from({ length: Math.max(vendors.length, vendees.length) }, (_, index) => {
    const vendor = index < vendors.length ? label(vendors[index], index, vendors.length > 1) : '';
    const vendee = index < vendees.length ? label(vendees[index], index, vendees.length > 1) : '';
    const cell = (value: string) => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr><w:p>${properties}<w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p></w:tc>`;
    return `<w:tr>${cell(vendor)}${cell(vendee)}</w:tr>`;
  }).join('');
  const table = `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid>${lines}</w:tbl>`;
  return body.slice(0, heading.end) + table + body.slice(heading.end);
}

/** Fill the source house layout without adding a second table after Annexure I-A. */
function prepareHouseBlock(block: string, values: Record<string, string>, details?: StructureDetails): string {
  const rows = details?.rows || [];
  const floorName = (name: string) => {
    const number = name.match(/^Floor(?: No\.)?\s+(\d+)$/i);
    if (!number) return /^Ground$/i.test(name) ? 'Ground Floor' : name;
    const ordinal = ['','First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth'];
    return Number(number[1]) < ordinal.length ? `${ordinal[Number(number[1])]} Floor` : name;
  };
  const structureName = (row: StructureDetails['rows'][number]) =>
    row.structureType === 'Other / Custom Structure' ? row.customStructureType || row.structureType : row.structureType;
  const setFloorParagraphIndent = (paragraph: string) => {
    const indentation = '<w:ind w:left="480" w:hanging="480"/>';
    const tabs = '<w:tabs><w:tab w:val="left" w:pos="480"/></w:tabs>';
    return paragraph.replace(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/, pPr => {
      let next = pPr.replace(/<w:(?:ind|tabs)(?:\s[^>]*)?\/>|<w:tabs(?:\s[^>]*)?>[\s\S]*?<\/w:tabs>/g, '');
      const additions = tabs + indentation;
      return /<w:rPr(?:\s[^>]*)?>/.test(next)
        ? next.replace(/<w:rPr(?:\s[^>]*)?>/, additions + '$&')
        : next.replace('</w:pPr>', additions + '</w:pPr>');
    });
  };
  const filled = block.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, original => {
    const text = plainText(original);
    let paragraph = original;
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
        /,?\s*having a plinth area of <Plinth Area> square feets consisting of <Floors> Floor\/s/i,
        () => floorSummary ? `, consisting of ${floorSummary}` : '');
    }
    if (/^\s*:\s*<Nature Of House>\s*$/i.test(text)) {
      return replaceRunText(paragraph, /<Nature Of House>/i, () => '<Roof Material>');
    }
    if (/^\s*:\s*Framed with walls only\s*$/i.test(text)) {
      return replaceRunText(paragraph, /Framed with walls only/i, () => '<Construction Description>');
    }
    if (/<Plinth Area>\s*sq\.fts/i.test(text)) {
      if (!rows.length) return replaceRunText(paragraph, /<Plinth Area>\s*sq\.fts/i, () => '');
      return rows.map((row, index) => {
        let floorParagraph = replaceRunText(paragraph, /<Plinth Area>\s*sq\.fts/i, () => {
          const particulars = [floorName(row.floorNo), structureName(row), row.stage,
            row.buildingAge !== '' ? `${row.buildingAge} years` : '',
            row.builtUpAreaSqFt !== '' ? `${row.builtUpAreaSqFt} sq.fts` : ''].filter(Boolean);
          return particulars.join(' — ');
        });
        // Give every floor the same first-line tab and hanging indent. Keep
        // the draft's colon only on the first line, in a separate prefix run.
        floorParagraph = replaceRunText(floorParagraph, /^:\s*/, () => '');
        const prefix = `<w:r>${index === 0 ? '<w:t>:</w:t>' : ''}<w:tab/></w:r>`;
        floorParagraph = floorParagraph.replace('</w:pPr>', `</w:pPr>${prefix}`);
        return setFloorParagraphIndent(floorParagraph);
      }).join('');
    }
    return paragraph;
  });
  // The item 4 label and all its floor paragraphs share one template row.
  // Keep that row on a single page so a later floor cannot become detached
  // from the label and the first floor at a page boundary.
  return rows.length ? filled.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, row => {
    if (!/Total built-up area of the property/i.test(plainText(row))) return row;
    if (/<w:trPr(?:\s[^>]*)?>/.test(row)) return row.replace(/<w:trPr(?:\s[^>]*)?>/, match => `${match}<w:cantSplit/>`);
    return row.replace(/<w:tr(?:\s[^>]*)?>/, match => `${match}<w:trPr><w:cantSplit/></w:trPr>`);
  }) : filled;
}

/** Recite identifiers the non-house template variants leave out of their description. */
function prepareNonHouseIdentifiers(block: string, variant: string, values: Record<string, string>): string {
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
      let block = children.slice(start, stop).map(c => body.slice(c.start, c.end)).join('');
      block = schedule.variant === 'IF HOUSE'
        ? prepareHouseBlock(block, schedule.values, schedule.structureDetails)
        : prepareNonHouseIdentifiers(block, schedule.variant, schedule.values);
      block = addVendeeShareParagraph(block, schedule.vendeeShares);
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
