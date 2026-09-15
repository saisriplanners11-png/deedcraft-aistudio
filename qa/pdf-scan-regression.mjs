import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Exercises the actual upload renderer, without calling the extraction API.
// Use a scanned page known to contain text, not an intentionally blank page.
const source = process.argv[2] || '../docs/1-2016-1263.pdf';
const pageNumber = Number(process.argv[3] || 3);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173');
  const bytes = [...await readFile(source)];
  const result = await page.evaluate(async ({ bytes, name, pageNumber }) => {
    const { prepare } = await import('/upload-extraction.ts');
    const prepared = await prepare(new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }), new AbortController().signal);
    const link = await prepare(new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }), new AbortController().signal,'phase1:linkDoc');
    if(link.pages.length!==prepared.pages.length)throw new Error('Link deed must render every page');
    const evidence = prepared.pages.find(p => p.number === pageNumber)?.parts.find(p => p.type === 'image');
    if (!evidence) throw new Error('Expected page image evidence');
    const picture = new Image();
    picture.src = `data:${evidence.source.media_type};base64,${evidence.source.data}`;
    await picture.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 420;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(picture, 0, 0, 300, 420);
    const pixels = ctx.getImageData(0, 0, 300, 420).data;
    let dark = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 600) dark++;
    return { pages: prepared.pages.length, darkFraction: dark / (300 * 420),linkPages:link.pages.length,linkBytes:link.pages.reduce((sum,p)=>sum+p.parts.filter(part=>part.type==='image').reduce((size,part)=>size+Math.ceil(part.source.data.length*3/4),0),0) };
  }, { bytes, name: path.basename(source), pageNumber });
  assert(result.darkFraction > 0.01, `Scan decoder lost page ${pageNumber}: only ${(result.darkFraction * 100).toFixed(2)}% visible ink`);
  console.log(`PASS: ${result.pages} pages preserved; scanned page ${pageNumber} has ${(result.darkFraction * 100).toFixed(1)}% visible ink.`);
  console.log(`Link fast path: ${result.linkPages} pages; ${(result.linkBytes/1024/1024).toFixed(2)} MB image payload before base64 transport.`);
} finally {
  await browser.close();
}
