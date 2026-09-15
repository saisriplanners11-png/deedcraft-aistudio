// Production server: serves dist/ and mounts the same Anthropic proxy the Vite
// dev server uses, so the key stays server-side outside dev too.
//
//   npm run build && npm start
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createProxyHandler, PROXY_PREFIX } from './proxy.mjs';

const PORT = Number(process.env.PORT) || 4173;
const DIST = new URL('./dist/', import.meta.url).pathname;

// Load .env.local without a dependency.
try {
  const env = await readFile(new URL('./.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env.local — the proxy will say so on the first request */
}

const proxy = createProxyHandler(() => ({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  extractionProvider: (process.env.EXTRACTION_PROVIDER || 'anthropic').toLowerCase(),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  draftModel: process.env.DRAFT_MODEL || 'claude-sonnet-4-6',
}));

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.map': 'application/json',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pdf': 'application/pdf',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg',
};

createServer(async (req, res) => {
  if (req.url?.startsWith(PROXY_PREFIX)) return proxy(req, res, () => {});

  // Static files, with a directory-traversal guard.
  const path = (req.url || '/').split('?')[0];
  const rel = normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, '');
  const file = join(DIST, rel);
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  try {
    const body = await readFile(file);
    res.setHeader('content-type', MIME[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch {
    // Single-page app: unknown paths fall back to index.html.
    try {
      res.setHeader('content-type', 'text/html');
      res.end(await readFile(join(DIST, 'index.html')));
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  }
}).listen(PORT, () => console.log(`DeedCraft on http://localhost:${PORT}`));
