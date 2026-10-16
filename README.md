# DeedCraft

Create a sale deed through an 11-step wizard, covering deed setup, supporting documents, jurisdiction, property schedules, valuation, payment, parties, review, deed generation and one property-plan editor. Choose each schedule's property type in Step 1; Step 2 shows that selection and links back to Step 1 to change it. Mixed PDFs, Word files, photos, text and handwritten notes can be uploaded on any step. Manual entry is optional. Missing or uncertain fields remain blank and do not prevent download.

The output uses the supplied sale-deed Word template by default. A reviewed plan explicitly selected in the Property Plan step is appended to the deed; the separate combined plan PDF uses that plan or an unambiguous verified source plan for each schedule. On the Generate Deed step, a drafter may instead upload a compatible tagged `.docx` derived from the downloadable starter template. Clause wording, numbering, formatting, schedule variants, declaration and signatures come from the selected template. Supporting records populate existing fields; they do not add paragraphs. New drafts contain no sample parties, properties, dimensions, stamp values or payments.

Step 11, **Property Plan — Exact Reference** (formerly Step 13), is the single plan editor. It imports the current Google AI Studio reference in a separate iframe, pre-fills current deed facts per schedule, offers selective refresh from the deed, and keeps plan edits and library storage separate. “Use this plan in deed” selects the rendered registration page for that schedule; editing it requires selecting it again. Standalone print, PDF and Word exports remain available. Sample templates are opt-in. The two earlier plan steps have been removed from navigation; existing saved plan data and selected attachments are retained. Drafts saved on any former plan step reopen in this editor.

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

Saved deeds, uploaded evidence, plans, and per-deed custom templates are kept in this browser's IndexedDB. Shared master templates are stored separately on the server. The AI provider receives uploaded evidence to perform extraction; shared template uploads are never sent to the extraction AI. Successful reads are cached by content hash and extraction version within the current draft. Separate API and file queues bound concurrency. Failed pages do not discard successfully read pages.

The prior deed's purchaser becomes the new seller. Prior payments, age, occupation, phone, consideration, stamp value and valuation do not silently become current facts. Current ages are calculated only when both DOB and execution date are supported. Unlabelled party notes remain unassigned until the user selects their role. Multiple named people, property records, title documents and payment instruments remain separate.

## Documents and plans

`sale-deed-template-v6.docx` is the current bundled Sale reference and seeds the shared library. Earlier files remain available for compatibility. `docx.ts` patches placeholders across their original text runs; it preserves run properties, line breaks and paragraph numbering. The selected schedule is retained, consideration is separated from market value, and blank fields become write-in spaces. Plan PNGs are embedded in separate page sections at print resolution. The same plan images form the PDF, avoiding a second independent layout.

Per-deed custom templates stay with their saved deed in browser storage and are never sent to the extraction AI. They must be `.docx` files that retain the starter template's schedule markers, flow-of-title and consideration boundaries, declaration boundary, and supported `<Placeholder>` names. The app validates these requirements locally and blocks custom generation with actionable errors rather than silently falling back. Structural validation does not constitute legal approval of customer-authored wording.

## Shared template library

### Choosing where new fields appear

In **Configure fields**, choose **Dashboard step → Section → Position** for each additional placeholder. Steps 1–8 are available regardless of record scope. Position can be before/after an existing input or at the end of its section; **Display order** sorts fields sharing a location. Saving requires a placement for every field in the edited contract, invalidates sample approval, and requires revalidation before publication. Previously published contracts without placement retain their original Additional Fields panels until explicitly replaced.

Fields use the regular input layout in their chosen step. Their scope stays independent: a field for each property still stores separate property values even when placed in Vendor Details. Matching scopes follow the current property/party card; other scopes show one labelled collection without multiplying values by host records. Hidden sections/anchors fall back to the end of the selected step. Document-category applicability still determines whether a field is needed. Reverify shows a linked summary; missing fields affect the owner step, readiness and generation. Moving a field preserves its ID, manual values and reviewed evidence, but creates a new schema/package hash and only reaches existing drafts through an explicit template update.

Conditional labels such as `<IF FLAT FINISHED>` are document structure, not configurable inputs. The parser accepts the flat aliases `<IF FINISHED FLAT>` and `<IF SEMI FINISHED FLAT>` (including semi-finished spelling), plus `<IF DEMOLISHED HOUSE>` and `<IF VACANT PLOT>`, without changing stored Word bytes. Unsupported conditions get structural errors and never appear as new data fields. A Gift template uploaded to the Sale library gets a specific wrong-instrument message; it cannot be made compatible merely by adding Sale markers. Gift still requires separate legal onboarding.

Open **Templates** in the dashboard. Download the current Word template, edit it in Microsoft Word while preserving placeholders and section markers, then sign in as the template administrator to upload a revision (maximum 20 MB). Server validation uses the same Sale contract as per-deed validation. Review all eight downloadable synthetic samples in Word, acknowledge the review, and publish. The samples cover all Sale property categories, both flat stages, and multiple parties/properties. Invalid revisions remain unpublished with actionable reports. Publishing requires successful validation and sample generation; it does not automatically certify legal wording.

Administrators can choose **Delete revision → Move to Trash** on an unpublished upload. It disappears from the main list and cannot be downloaded, edited, validated or published until restored through **Trash → Restore revision**. This is a recoverable deletion: DOCX files, samples and metadata are retained and still count toward storage usage. Active and previously published versions cannot be deleted because saved deeds may reference them. Trash is shared between local and Render when they use the same Supabase project. Deletion requires administrator authentication, CSRF validation and the current field revision/hash; concurrent metadata saves retain database conflict protection.

New deeds pin the active template version and SHA-256 hash and cache verified template bytes with their browser-saved deed. Existing drafts retain their version and offer an explicit update when a newer template is available. Legacy built-in drafts retain Sale v6; custom-template drafts retain their file. The same selected template feeds generation, schedule previews, and starter downloads. Generated manifests record the template version/hash, input hash, and output hash. Other instruments remain gated by their approved legal references and renderers.

The DOCX package retains its Word styles, fonts, spacing, tables, and page-section settings. Added ownership paragraphs, annexures, prepared-by text, and plan attachments have renderer-controlled formatting. Longer inserted text changes line wrapping and pagination. Template publishing cannot retrofit already downloaded Word files.

Configure these **server-side** variables (never use a `VITE_` prefix):

- `TEMPLATE_ADMIN_PASSWORD`: a strong shared administrator password. An empty value disables management. Login expires after eight hours; server restarts require a fresh login.
- `TEMPLATE_STORAGE_BACKEND`: `disk` (default for local development) or `supabase` (Render Free).
- `TEMPLATE_STORAGE_DIR`: disk backend only; an absolute directory on a persistent disk, outside `dist`. Development/preview default to `./template-storage`; production disk storage requires an explicitly configured directory. Do not run multiple app instances against this filesystem store.
- Supabase backend: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), and `SUPABASE_TEMPLATE_BUCKET=deed-templates`. Keep keys on the server. See [Supabase setup](supabase/README.md).

The library automatically seeds Sale v6 once. Original bundled historical templates remain available for existing compatibility paths. Template bytes and metadata are immutable after publication; rollback changes only the active pointer and records a history entry. Publication uses an expected-active-version check to reject stale admin views. Unavailable or damaged storage produces a retryable error rather than choosing a different template.

`render.yaml` describes a Free web service using Supabase for persistence, without a Render disk. Configure the existing service's environment variables manually, or apply the Blueprint with the required secrets. Pushing this file alone does not reconfigure an existing service. Provider quotas and idle startup delays still apply. No Supabase or Render resources are provisioned by this code change.

For backups, stop the service or otherwise prevent all library writes, then copy the **entire** `TEMPLATE_STORAGE_DIR`, including `library.json`, immutable version files, and sample files. Restore the complete directory while the service is stopped, preserve read/write permissions, point `TEMPLATE_STORAGE_DIR` at it, and restart. Keep the password configuration separate from backups. A deployment rebuild does not reset a library on the persistent disk.

Run `npm run test:templates-e2e` for the isolated browser workflow. API tests exercise authentication, CSRF, validation, sample formatting, concurrent-publication conflicts, persistence, rollback, integrity checks, and storage failures.

### New wording and configurable placeholders

Add new clauses in Word using `<Placeholder Name>` tags in normal body paragraphs or table cells. After uploading, click **Configure fields**. Each unfamiliar placeholder can map to an existing field or become a new text, multiline, number, currency, date, dropdown, or yes/no input. Configure its scope (whole deed, property, vendor or purchaser), required status, sample value, and extraction description. Required defaults to enabled. AI extraction defaults to enabled for new fields; mappings reuse existing information. Names, IDs, types and sample values are checked on the server. Unsupported locations, such as headers/footers or text boxes, are reported rather than silently losing custom data.

Click **Save field configuration**, then **Revalidate and rebuild samples**. Editing configuration clears samples and review acknowledgement. Review every sample and publish. Party-scoped contracts also generate a company-vendor sample. Publication verifies both the active version and the exact reviewed schema revision/hash. The Word file and field contract are published as one immutable package; old templates without contracts continue to work.

Drafts show **Additional template fields** on Overview and Review, and scoped fields on Property Schedules and Vendor/Purchaser Details. Required inputs block Word generation only when their template sections apply; optional empty values print `____` and keep surrounding wording. Currency values use Indian digit grouping, dates print DD-MM-YYYY, and multiline values preserve Word line breaks. For property/party placeholders in shared text, values are labelled by record instead of silently using the first record. In standard repeated sections, the corresponding record's value is used.

New fields can be entered manually or extracted from PDFs, Word files, text and images. Relevant section uploads start a separate custom-field pass after the standard reading. Use the additional-fields uploader for whole-deed evidence, or **Read new fields from saved documents** for already stored record-scoped documents. Custom extraction uses the configured provider and two independent reads in batches of at most 20 fields. Field sample values and the master template are not sent to the model. Additional extraction requires the same provider key as existing extraction and incurs additional provider calls.

Every custom AI value stays a proposal until explicitly accepted. Review its original file, quotation, page/region and record, then accept, reject or enter a corrected value. Disagreeing readings, unsupported quotations, invalid types, ambiguous attribution and historical facts for current-only fields require correction or clearer evidence. Removing/replacing the underlying source removes its extracted contribution; intentional manual values remain. Conflicts are displayed, and unresolved required fields block generation. Schema/package changes and cancellation prevent late results from entering another draft. Field meanings that change receive new IDs; compatible manual values and reviewed evidence remain available after an explicit upgrade.

Custom-field values and evidence remain in the browser's saved deed. They are not template defaults and are not shared with other clients. Gift and other instruments still require their own approved legal references and renderer integrations. User-defined conditional-clause rules are outside this release; the existing Sale property variants remain supported.

`registration-plan.tsx` renders the reference page structure using the current parties and source drawing. There are no fallback sample dimensions, roads or north arrows. If a new plan is unavailable, the linked deed's verified plan is used. If a drawing cannot be reproduced confidently, its region remains blank and the UI offers another plan/sketch upload. Source text is escaped and cannot execute as SVG markup.

PDFs are read by page with the full source as context. DOCX text and embedded PNG/JPEG drawings are read; native Word shapes require the plan page as PDF/image. This explicit fallback avoids substituting invented geometry. Documents with too many party details to fit a single plan page report a layout error rather than clipping text.

The release supports the Sale renderer only, using its pinned shared-library version, a legacy built-in template, or a compatible per-deed customer template. Other deed types require their own approved templates and rendering contracts.

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
