import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip, brotliCompress, constants } from 'node:zlib';

const encoders = { br: promisify(brotliCompress), gzip: promisify(gzip) };
const variants = new Map();
let cachedBytes = 0;
const LIMIT = 16 * 1024 * 1024;

export async function sendStatic(req, res, body, { type, immutable = false }) {
  const etag = `W/"${createHash('sha256').update(body).digest('hex')}"`;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.setHeader('ETag', etag);
  res.setHeader('Vary', 'Accept-Encoding');
  if ((req.headers['if-none-match'] || '').split(',').some(value => value.trim() === etag || value.trim() === '*')) {
    res.statusCode = 304;
    return res.end();
  }
  const accepted = (req.headers['accept-encoding'] || '').split(',').map(part => {
    const [name, ...params] = part.trim().split(';');
    const q = params.find(value => value.trim().startsWith('q='));
    return { name, quality: q ? Number(q.trim().slice(2)) : 1 };
  });
  const quality = name => accepted.find(item => item.name === name)?.quality ?? accepted.find(item => item.name === '*')?.quality ?? 0;
  const encoding = ['br', 'gzip'].filter(name => quality(name) > 0).sort((a, b) => quality(b) - quality(a))[0];
  if (body.length > 1024 && /^(text\/|application\/(javascript|json|wasm)|image\/svg)/.test(type) && encoding) {
    const key = etag + ':' + encoding;
    let compressed = variants.get(key);
    if (!compressed) {
      compressed = await encoders[encoding](body, encoding === 'br' ? { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } } : { level: 6 });
      if (compressed.length <= LIMIT) {
        while (cachedBytes + compressed.length > LIMIT && variants.size) {
          const oldest = variants.keys().next().value;
          cachedBytes -= variants.get(oldest).length;
          variants.delete(oldest);
        }
        variants.set(key, compressed);
        cachedBytes += compressed.length;
      }
    }
    if (compressed.length < body.length) {
      body = compressed;
      res.setHeader('Content-Encoding', encoding);
    }
  }
  res.setHeader('Content-Length', body.length);
  res.end(req.method === 'HEAD' ? undefined : body);
}
