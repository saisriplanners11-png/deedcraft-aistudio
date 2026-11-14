# Compact dashboard acceptance — 26 October 2026

## UI changes

- At 1247 × 702, all eleven steps fit in one 42-pixel strip. The entire navigation including deed context is approximately 72 pixels, down from approximately 150 pixels in the previous design.
- Short visible labels retain full step names, status and optional-plan information in accessible names and tooltips. Complete/review icons supplement colour; the active section retains `aria-current`.
- Gift uses ten equal-width steps and continues omitting Payment Details. Tablets use two rows of six columns; phones use one selector between Previous/Next buttons with 44-pixel targets.
- Upload panels and surrounding spacing are tighter at short desktop heights. Field fonts remain 13 pixels, labels 12 pixels; document-preview typography is unchanged.

## Executed checks

| Coverage | Result |
| --- | --- |
| Root Vitest suites | 409 tests passed across 39 files |
| Required typecheck | Passed |
| Required complete build | Passed, including every existing Word/template regression script and its 206-test selection |
| Provider media-transfer Node suite | 11 passed; synthetic traffic only |
| Catalogue/compiler matrix | 16 instruments, 43 catalogue variants; 107 DOCX cases generated and inspected; all 32 unapproved variants rejected |
| Browser deed selection | All 39 forms exposed by the selector visited; approved/reference-required feedback checked |
| Browser workflow navigation | 175 section visits across all 16 families, including Gift's ten-section workflow; no horizontal overflow at the audit desktop viewport |
| Browser party options | All 12 nonblank party types/capacities rendered for executants and claimants: 24 configurations, including identity/entity/guardian/representative upload controls |
| Browser payment proofs | All seven modes uploaded independently: RTGS/NEFT, cheque, DD, UPI, cash, housing loan and Through Bank; each populated its own ₹10,000 record |
| Browser upload → export | Multipage title upload populated plot 42, survey QA-100, extent 240 and boundaries; identity uploads populated separate parties; all 11 supported forms downloaded |
| Browser downloaded packages | All 11 files inspected for valid Word packages, uploaded party names and property facts; GPA/AGPA include the separate attorney and authority number |
| Save/reload | Uploaded names, supporting source and GPA/AGPA registration/identity bindings retained after reopening |
| Responsive/keyboard/dark | 375 × 812, 768 × 1024, 1024 × 768, 1247 × 702, 1440 × 1000; no page overflow, mobile selector/Next navigation worked; dark fields and visible keyboard focus checked |

The complete build also checks replacement-template package preservation, stamp margins, dates, shares, minor representation, gender wording, DGPA/allotment recitals, multiple properties/parties and template field placement. Root suites cover section-scoped extraction, conflicts/manual precedence, cancellation/stale results, repeated entities, additional template fields, persistence and plan integrations.

Six legacy flat-suite expectations referred to superseded slash wording, old signature labels and title-reference omission for finished flats. They now assert the existing current wording and retained title references, and scope covenant numbering to the operative section. No legal rendering code or immutable Word template was changed for this update. `vitest.config.ts` prevents the default test command from crawling generated copies under `tmp` or treating standalone `node:test` suites as Vitest files.

## Generation availability

| Instrument | Catalogue variants | Template-backed variants | Generated property/stage cases |
| --- | ---: | ---: | ---: |
| Sale | 7 | 3 | 33 |
| Gift | 4 | 4 | 34 |
| Agreement of Sale Cum GPA | 2 | 2 | 20 |
| GPA / Power of Attorney | 4 | 2 | 20 |
| Will | 3 | 0 | 0 |
| Mortgage | 3 | 0 | 0 |
| Partition | 2 | 0 | 0 |
| Release | 2 | 0 | 0 |
| Exchange | 1 | 0 | 0 |
| Lease | 3 | 0 | 0 |
| Rectification | 1 | 0 | 0 |
| Cancellation | 2 | 0 | 0 |
| Trust | 3 | 0 | 0 |
| Settlement | 2 | 0 | 0 |
| Development Agreement / AGPA | 2 | 0 | 0 |
| Family Arrangement | 2 | 0 | 0 |

Sale exposes its three template-backed choices in normal setup; four additional catalogue variants are not exposed there. This accounts for 39 browser choices versus 43 catalogue entries. Unsupported variants require approved templates and renderers; the redesign does not enable generation for them.

The eleven browser downloads cover ordinary Sale, Sale through GPA, Sale through AGPA, four Gift forms, both Agreement possession variants and both approved general GPA forms. Municipal Gift correctly rejected missing municipality details until supplied. Sale authority required registration details, identity values and principal links; family GPA required a family relationship. These checks were retained.

## Reproduction and evidence

- `npm test`, `npm run typecheck`, `npm run build`, `npm run test:ai-bandwidth`.
- `node qa/dashboard-deed-matrix.mjs` writes `tmp/dashboard-qa/deed-matrix.json`.
- Browser evidence: `tmp/dashboard-qa/browser-sections.json`, `browser-party-options.json`, `browser-payments.json`, `browser-downloads.json`, and `responsive.json`.
- `node qa/dashboard-download-audit.mjs <browser-download-directory>` inspects the eleven named synthetic downloads and moves them into ignored `tmp/dashboard-qa/downloads`.
- Latest screenshot: external REA workspace `output/deedcraft-telangana-compact.png`.

## Practical limits

Extraction responses were deterministic synthetic fixtures, so this run validates upload wiring, record scope, population and export without spending AI credits. It does not measure real OCR/model accuracy on every document format or every possible combination of fields. Those formats and source handlers also have automated coverage.

Shared template storage briefly returned an unavailable message, then recovered with HTTP 200; saved/built-in downloads remained usable. Live template administration is disabled by the current server configuration, so no live upload/publication or library mutation was performed. Local automated API/template tests cover those operations. Reduced-motion rules were inspected; system preferences were not changed.
