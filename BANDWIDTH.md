# Render bandwidth

The production Node server compresses text, JavaScript and WASM with Brotli or
gzip when the client supports it. Compression uses moderate CPU settings and
a bounded 16 MiB cache. DOCX, PDF and images are not recompressed.

Vite's content-hashed `/assets/` files are cached for one year. New deployments
generate new URLs for changed files. HTML and other unversioned files use ETags
and revalidation so clients receive updates without downloading unchanged files.
Production source maps are disabled and map requests return 404. Missing asset
requests also return 404 rather than downloading the app HTML.

Run `npm run typecheck`, `npm run build`, and `node qa/bandwidth.mjs` with Node 24.
The bandwidth script verifies byte-for-byte decompression, disabled encodings,
HEAD, 304 and cache headers, and measures the built JS/CSS corpus. That corpus
includes optional screens and is not a measurement of one page visit.

Deploy these files through the normal production deployment to apply the changes.
After deployment, inspect a JS response in browser DevTools for `Content-Encoding`
and `Cache-Control`. Repeat navigation should reuse content-hashed assets.

The 5 GB monthly allowance cannot be guaranteed by static asset changes. Render
also counts outbound calls to AI providers, including uploaded documents forwarded
by the proxy, and API responses. These optimizations leave private API responses
and template-library administration uncached. Review Render's per-service outbound
metrics over a representative week; usage should average below about 160 MB/day
to fit a 31-day month. Previously used bandwidth is not recovered by deployment.

## AI document processing

Gemini extraction now uploads each unique PNG, JPEG, WebP or PDF input of at
least 64 KiB through Gemini's Files API as raw bytes. Subsequent reads send its
file URI, avoiding repeated base64 images in every model request. Hashes include
the exact bytes and MIME type, and references are isolated by provider API key.
Concurrent reads share the upload, but every AI extraction and independent
verification still runs with its original prompt, model, fields and source.
The image resolution and quality are unchanged; this is a transport change.

This applies to the wizard, custom fields, party/authority reads, and the separate
plan/document APIs when they use Gemini. Anthropic calls retain their current
transport. Small inputs remain inline, as do text-only inputs.

Gemini Files stores uploaded files for up to 48 hours and deletes them
automatically. The app caches only reference metadata, never AI results, on the
server. After a restart it discovers up to 1,000 existing files from Gemini and
retains at most 512 references per key. Expired entries are uploaded again when
needed. Identical copies under different names can reuse a reference; changed
bytes, crops, MIME types or provider accounts cannot share one.

Files API outages fall back to the exact original inline input, with a one-minute
backoff on file reuse. If a referenced file has been removed or is unavailable,
the model request retries once with inline evidence. Ordinary model errors and
rate limits do not trigger that fallback. Cancellation stops unused uploads;
cancelling one reader does not interrupt another reader sharing the same upload.

`GEMINI_FILE_REUSE=false` restores inline uploads. `AI_BANDWIDTH_LOG=false`
disables the numeric `ai_media_transfer` logs. Logs contain upload byte counts,
reference counts and fallbacks, without filenames, prompts, keys or document
content. `base64BytesAvoided` measures base64 omitted from model calls; subtract
`uploadedBytes` and allow for request/metadata headers when estimating net savings.
These counters are estimates, not the Render billing meter.

Run `npm run test:ai-bandwidth` with Node 24. The tests mock Gemini; they check
exact uploaded bytes, independent model calls, concurrent deduplication, restart
discovery, changed inputs/accounts, both provider hash representations, processing
states, cancellation, expiry, fallback and the production proxy response format.
The six-read synthetic case reduced request payloads by about 87%; actual monthly
savings depend on how often each page is reused and how much other traffic exists.

For further reduction, use direct browser uploads to private object storage and
let Gemini fetch a short-lived signed URL. This requires a separate authenticated
upload flow and moves document transfer to the storage provider's bandwidth
allowance. Keep API keys server-side and never make identity documents public.
An OCR/text-first mode can reduce traffic further, but should be evaluated on real
Telugu scans, handwritten annotations, tables and identity fields before replacing
the current visual checks. No such accuracy tradeoff is enabled in this change.

References: [Gemini Files API](https://ai.google.dev/gemini-api/docs/files) and
[file input methods](https://ai.google.dev/gemini-api/docs/file-input-methods).
