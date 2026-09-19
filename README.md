# DeedCraft

Create a sale deed through an 11-step wizard: **Draft, Deed & Category → Link Deed & Enclosures → Jurisdiction → Property Details → Market Value → Payment Details → Property Schedules → Executant Details → Claimant Details → Reverify → Generate Deed**. Mixed PDFs, Word files, photos, text and handwritten notes can be uploaded on any step. Manual entry is optional. Missing or uncertain fields remain blank and do not prevent download.

The output is the supplied sale-deed Word template with a registration plan appended, plus a separate plan PDF. Clause wording, numbering, formatting, schedule variants, declaration and signatures come from the template. Supporting records populate existing fields; they do not add paragraphs. New drafts contain no sample parties, properties, dimensions, stamp values or payments.

## Run

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm start
```

Set `ANTHROPIC_API_KEY` in `.env.local` on the server. The key is never compiled into browser assets. The application needs the Node server or Vite proxy for AI extraction; it is not a static-only deployment.

To use Gemini for uploaded-file extraction while retaining Anthropic for drafting, add this to `.env.local` and restart the app:

```sh
EXTRACTION_PROVIDER=gemini
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_EXTRACT_MODEL=gemini-3.5-flash-lite
GEMINI_VISION_MODEL=gemini-3.6-flash
GEMINI_VERIFY_MODEL=gemini-3.6-flash
```

This routes document classification and straightforward field extraction through Gemini 3.5 Flash-Lite, which is optimized for high-volume lightweight tasks. Handwriting, visual source transcription, plan sketches and independent verification use Gemini 3.6 Flash. Set `GEMINI_MODEL` to use one Gemini model for every extraction stage, or override any of the three stage settings above. The Gemini free tier has usage limits and its terms/rates can change; see the [Gemini API pricing page](https://ai.google.dev/gemini-api/docs/pricing). Set `EXTRACTION_PROVIDER=anthropic` (or omit it) to switch back.

Visual extraction uses `VISION_MODEL`, defaulting to `claude-sonnet-4-6`. This is independent of the older `EXTRACT_MODEL` and `DRAFT_MODEL` settings. Two independent source reads must agree on exact values, roles and historical status. Critical identifiers receive an additional independent enlarged-source read using `VERIFY_MODEL` (default `claude-opus-4-6`). Plans undergo a source-versus-rendered-drawing check. A deterministic source-ink trace is attempted when generated geometry fails verification; an unverified trace is also rejected. Verified fields appear while plan processing continues. The default was chosen after a live reference-photo check found that the earlier Haiku pipeline accepted an oversimplified plot. Changing the model or prompts requires rerunning the held-out benchmark.

## Source lifecycle

`source-draft.ts` projects a draft from its active source evidence. Each source has a content hash, identity, revision and processing status. Every extracted field retains its source quotation and page/region. Removing or replacing a source recomputes values, rather than leaving old fields behind. Late responses for removed/replaced sources or previous drafts are ignored. Different sources that disagree leave an extracted field blank; intentional manual values are retained with the conflict visible.

For a link deed uploaded in Step 2, extraction sends only pages 1–5 to the AI. Those pages provide the document details, jurisdiction, property and schedule fields used in Steps 2–4; later pages are not read or sent for that workflow.

Files and results stay in memory for the current draft. Reloading or starting a new deed clears them. There is no cross-customer cache, browser persistence or server document storage. The AI provider receives uploaded content to perform extraction. Successful reads are cached by content hash and extraction version within the current draft. Separate API and file queues bound concurrency. Failed pages do not discard successfully read pages.

The prior deed's purchaser becomes the new seller. Prior payments, age, occupation, phone, consideration, stamp value and valuation do not silently become current facts. Current ages are calculated only when both DOB and execution date are supported. Unlabelled party notes remain unassigned until the user selects their role. Multiple named people, property records, title documents and payment instruments remain separate.

## Documents and plans

`sale-deed-template.docx` is the supplied reference, kept byte-for-byte unchanged. `docx.ts` patches placeholders across their original text runs; it preserves run properties, line breaks and paragraph numbering. The selected schedule is retained, consideration is separated from market value, and blank fields become write-in spaces. Plan PNGs are embedded in separate page sections at print resolution. The same plan images form the PDF, avoiding a second independent layout.

`registration-plan.tsx` renders the reference page structure using the current parties and source drawing. There are no fallback sample dimensions, roads or north arrows. If a new plan is unavailable, the linked deed's verified plan is used. If a drawing cannot be reproduced confidently, its region remains blank and the UI offers another plan/sketch upload. Source text is escaped and cannot execute as SVG markup.

PDFs are read by page with the full source as context. DOCX text and embedded PNG/JPEG drawings are read; native Word shapes require the plan page as PDF/image. This explicit fallback avoids substituting invented geometry. Documents with too many party details to fit a single plan page report a layout error rather than clipping text.

The release supports the existing Sale template only. Other deed types remain future template integrations through `DEED_TEMPLATES`.

## Multi-instrument foundation

The product catalogue now contains versioned workflow definitions for Sale, Gift, Will, Mortgage, Partition, Release, Exchange, Lease, Power of Attorney, Rectification, Cancellation, Trust, Settlement, Agreement of Sale, Development Agreement/AGPA and Family Arrangement. Each definition declares its variants, party roles, instrument-specific facts, evidence classes, validation gates and duty-rule identifier.

Legal output is fail-closed. An instrument/variant becomes generatable only after an effective advocate-approved reference and immutable template version are registered in `legal-registry.ts`. The supplied Sale DOCX is the only currently onboarded reference; selecting another instrument shows `Reference required` and cannot generate invented wording. Final Sale downloads also require a named professional to approve the exact current draft revision. Any subsequent edit invalidates that approval.

`deed-compiler.ts` is the instrument-neutral compilation boundary (`compileDeed`, `renderArtifact`, and `validateTemplateContract`). New reference templates must be added through that registry and renderer rather than by branching the wizard or allowing an AI model to author legal clauses.

## Validation

```sh
node qa/upload-flow.mjs
node qa/layout.mjs
node qa/live-note.mjs
node qa/live-extraction.mjs /path/to/reference-plan.jpeg
node benchmark-runner.mjs benchmarks/manifest.json benchmarks/report.json
```

The first command tests the wizard steps, source removal/re-upload, blank-field Word/PDF downloads, mobile overflow and draft reset using a deterministic mock reader. Unit tests cover stale responses, record separation, exact identifiers, blank handling, run preservation and plan packaging. Word files must also be rendered and visually inspected, since XML/text tests cannot detect page-layout failures.

**99% extraction accuracy is not yet established.** See `benchmarks/README.md` for the held-out corpus format, independent manual annotation requirements, precision and coverage gates. The empty corpus intentionally returns `not-verified`; automated tests or repeated model agreement cannot substitute for this evaluation. The supplied template and one reference photograph do not provide a representative handwriting benchmark.
