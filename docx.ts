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

const VARIANTS = ['IF OPEN PLACE', 'IF OPEN PLOT', 'IF HOUSE', 'IF DIMOLISHED HOUSE', 'IF PART OPEN PLACE'];

/** A literal phrase in the template to rewrite once the placeholders are filled. */
export type Rewrite = { find: RegExp; replace: string; records?: Record<string, string>[] };

// ---------------------------------------------------------------- zip reading

type Entry = { name: string; data: Uint8Array };

const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([bytes as any]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  } catch (error) {
    // Node 24 exposes the web stream classes but does not implement the ZIP
    // deflate-raw format. Keep browser builds dependency-free while allowing
    // tests and server-side rendering to use the native zlib implementation.
    if (typeof process === 'undefined' || !process.versions?.node) throw error;
    const moduleName = 'node:zlib';
    const { inflateRawSync } = await import(/* @vite-ignore */ moduleName);
    return new Uint8Array(inflateRawSync(bytes));
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
export async function readZip(zip: Uint8Array): Promise<Entry[]> {
  const v = dv(zip);
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0 && i > zip.length - 65558; i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Template is not a readable .docx (no zip directory).');

  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const entries: Entry[] = [];

  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt zip directory in template.');
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const localOff = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));

    // The local header repeats the name and carries its own extra field.
    const lNameLen = v.getUint16(localOff + 26, true);
    const lExtraLen = v.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = zip.subarray(start, start + compSize);

    entries.push({ name, data: method === 8 ? await inflateRaw(raw) : raw.slice() });
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
    lv.setUint32(10, 0, true);          // time+date (zeroed: reproducible output)
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
    cv.setUint32(12, 0, true);
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
  if (/sale consideration|consideration value/i.test(plainText(p))) {
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
  for (const rw of rewrites.filter(rw => !rw.records)) {
    p = replaceRunText(p, rw.find, () => rw.replace);
  }
  return replaceRunText(p, /<([^<>]{2,60}?)>/g, match => {
    const name = match[1].trim();
    const value = values.get(norm(name));
    if (value) return value;
    missing.add(name);
    return '__________';
  });
}

function markConsiderationRows(xml: string): string {
  return xml.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, row => /\bConsideration\b/i.test(plainText(row))
    ? row.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => replaceRunText(p, /<Market of Value Rs\.\/->/gi, () => '<Sale Consideration>')) : row);
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
    { test: /Tax\/Assessment & Identification Particulars:/i, keep: () => has('BLT No.') },
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
  planPages: Uint8Array[] = [],
): Promise<MergeResult> {
  const bin = await loadSaleDeedTemplate();
  const entries = await readZip(bin);

  const doc = entries.find(e => e.name === 'word/document.xml');
  if (!doc) throw new Error('Template is missing word/document.xml.');

  let xml = new TextDecoder().decode(doc.data);
  const bodyStart = xml.indexOf('<w:body>') + '<w:body>'.length;
  const bodyEnd = xml.lastIndexOf('</w:body>');
  let body = markConsiderationRows(xml.slice(bodyStart, bodyEnd));
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
        ? [{ find: /\(a\) Registered Deed:/i, replace: '', records: schedule.titleLinkRecords }]
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
      let block = children.slice(start, stop).map(c => {
        const chunk = body.slice(c.start, c.end);
        return chunk.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p =>
          fillParagraph(p, scheduleValues, missing, [])
        );
      }).join('');
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
  if (planPages.length) appendPlanPages(entries, planPages);

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

/** The deed keeps its original sections; plans get independent A4 page sections. */
function appendPlanPages(entries: Entry[], pages: Uint8Array[]) {
  const decode = (name: string) => new TextDecoder().decode(entries.find(e => e.name === name)!.data);
  const put = (name: string, value: string) => {
    const entry = entries.find(e => e.name === name);
    if (entry) entry.data = new TextEncoder().encode(value);
    else entries.push({ name, data: new TextEncoder().encode(value) });
  };
  let xml = decode('word/document.xml');
  let rels = decode('word/_rels/document.xml.rels');
  let types = decode('[Content_Types].xml');
  if (!/Extension="png"/.test(types)) types = types.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
  const tail = xml.slice(xml.lastIndexOf('<w:sectPr')).match(/^<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>(?=<\/w:body>)/);
  if (!tail) throw new Error('Template is missing its final page section.');
  const oldSection = `<w:p><w:pPr>${tail[0]}</w:pPr></w:p>`;
  const pageSection = '<w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0"/></w:sectPr>';
  // Explicit blank footer prevents the deed footer from inheriting into the plan.
  const footerId = 'rIdDeedCraftPlanFooter';
  put('word/deedcraft-plan-footer.xml', '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>');
  rels = rels.replace('</Relationships>', `<Relationship Id="${footerId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="deedcraft-plan-footer.xml"/></Relationships>`);
  types = types.replace('</Types>', '<Override PartName="/word/deedcraft-plan-footer.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>');
  const planSection = pageSection.replace('<w:sectPr>', `<w:sectPr><w:footerReference w:type="default" r:id="${footerId}"/>`);
  const paragraphs = pages.map((png, i) => {
    const id = `rIdDeedCraftPlan${i}`;
    const name = `deedcraft-plan-${i}.png`;
    entries.push({ name: `word/media/${name}`, data: png });
    rels = rels.replace('</Relationships>', `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/></Relationships>`);
    // A floating page-relative picture avoids creating an overflow text line.
    return `<w:p><w:pPr><w:spacing w:after="0" w:before="0" w:line="1" w:lineRule="exact"/>${i < pages.length - 1 ? planSection : ''}</w:pPr><w:r><w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="7560310" cy="10692130"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${9000+i}" name="Registration plan ${i+1}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${9000+i}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="7560310" cy="10692130"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
  }).join('');
  xml = xml.replace(tail[0] + '</w:body>', oldSection + paragraphs + planSection + '</w:body>');
  put('word/document.xml', xml); put('word/_rels/document.xml.rels', rels); put('[Content_Types].xml', types);
}
