# Upload-first sale deed validation — 12 September 2026

## Implemented behavior

Three screens accept mixed uploads, with optional corrections and downloads even when fields are blank. Draft and source revisions isolate asynchronous reads. Replacement/removal rebuilds accepted fields from surviving evidence. Source conflicts remain blank; intentional manual entries remain separate. Per-property previews and plans share the accepted draft revision with Word/PDF exports.

The supplied Word file is unchanged. Exports patch its text runs and preserve numbered clauses, selected schedules, tables, declarations, signatures and Prepared By. Consideration is separate from valuation. Multiple property schedules do not inherit missing facts from the first property. Repeated schedule headings stay with their description.

Plan geometry can be reproduced as source-ink vectors when AI-generated geometry fails comparison. The locator uses a coordinate guide, crop margins, and a source-pixel proposal for nearby circular direction marks. Every proposed drawing still undergoes comparison against the source. This preserves photographed strokes and their imperfections; it is not a clean CAD reconstruction. Unverified drawings remain blank. The printed page layout is shared across preview, appended Word image, and separate PDF.

## Checks completed

- TypeScript checks and production build passed.
- 73 unit/regression tests passed across eight files.
- Development and production browser journeys passed: three screens, source removal/re-upload, blank-field Word/PDF downloads, mobile overflow, draft reset, and PDF page ingestion. AI responses in these journey tests are mocked; they test application behavior, not extraction accuracy.
- Fixed the production PDF-worker MIME type and used PDF.js's compatibility build after the older browser exposed an unsupported `Uint8Array.toHex` call.
- Rendered and inspected a nine-page Word example containing two sellers, two claimants, long names, two property schedules, and two appended plans. Also inspected both separate plan PDF pages. The second property's missing survey and address remain blank.
- Live AI text-note check: seller name, phone and occupation extracted; embedded instruction to invent a claimant rejected. Approximately 11 seconds, zero manual edits. This is typed text, not a handwriting benchmark.
- Latest live reference-photo check: approximately 62 seconds, 19 accepted candidates, four uncertain candidates, one verified source-ink plan, zero manual edits. Source crops preserve the direction symbol, dimensional strokes, boundary labels and both road lines. Source photograph noise remains visible. Earlier runs exposed wrong house-number shortening and incomplete plan crops; focused identifier reads and source-ink tracing address those observed cases, but wider accuracy is unverified.

## Release gate still open

`npm run benchmark` returns `not-verified` and exits 2 because the held-out, manually checked corpus is empty. No 99% accuracy claim is made. The template and one development reference photograph cannot establish English/Telugu handwriting accuracy, critical-identifier precision, mixed-bundle association accuracy, or general plan fidelity. A representative independently annotated corpus must satisfy the precision and coverage gates in `benchmarks/README.md` before release certification.

Very crowded plan party blocks report a layout error rather than clipping. Native Word drawing shapes require a PDF/image upload. Drawings copied from low-resolution photographs retain source printing and photographic imperfections. These limits are documented in the README.
