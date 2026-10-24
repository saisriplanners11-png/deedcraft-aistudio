# Deedcraft UI/UX review — 15 October 2026

Reviewed the React drafting workspace with the UI/UX Pro Max skill, including its accessibility, form, responsive-layout, and legal-product guidance. Retained Deedcraft's warm paper, ink, gold, and existing typefaces; applied the skill's accessible-interface recommendations to the working app.

## Findings and changes

- The starting screen offered little guidance. Added a document illustration, a first-deed action, and three concise workflow steps. Clarified that drafts are stored in the current browser.
- Saved drafts lacked search. Added filtering by party name and deed type, a result-empty message, and a clear-search action.
- Many labels were 9px, and form controls used faint underline borders. Increased labels and controls, added full control boundaries, and retained source/evidence indicators and read-only states.
- Four-column form groups did not adapt to phones. Added two-column tablet and single-column phone layouts using shared form classes.
- Mobile navigation showed a long scrolling list and hid the brand. Restored the brand and replaced the list on small screens with a labeled native step selector.
- Primary-button hover could put light text on a light surface. Added separate action/foreground tokens for light and dark themes and consistent hover/pressed states.
- Navigation lacked announced selection and predictable focus. Added current-step semantics, completion indicators, a skip link, and focus transfer to the heading on step changes.
- Workspace creation offered no pending feedback. Added a busy label and disabled creation actions while the template loads.
- Added reduced-motion support and consistent 44px control heights.

## Verification

`qa/design-review-flow.mjs` runs with `UI_REVIEW_URL` (default `http://127.0.0.1:5198`) and `PLAYWRIGHT_CHANNEL` (default `msedge`). Start the Vite development server at that address before running it. The test uses the real bundled Word template through mocked template API responses; it does not modify the shared template backend.

The browser checks cover creation, saving, search and clearing, reopening, reload persistence, selected-step semantics, focus transfer, 375/768/1024/1440px form layouts, all ten core screens on mobile, landscape, dark mode, and reduced motion. Screenshots are written to `tmp/design-review/`.

Validation completed: TypeScript checking passed, the production build passed (with bundle-size warnings), and all 292 unit tests passed. The browser checks above also passed.

Use the project's required Node 24 runtime for the unit suite. The system default Node 18 lacks runtime features used by the existing template tests.

## Scope

Changes cover the saved-deed library, shared app header, overview, wizard navigation, and shared field controls. Embedded plan editors retain their own styling. Document-generation rules, extraction logic, template publication, and storage architecture are unchanged. This review is not a full WCAG certification.

## Second design pass

Focused on helping the drafter act on outstanding details:

- Replaced flat review lists with sections that show issue counts, expandable explanations and source guidance, and direct navigation back to the relevant drafting step. The generation screen uses a compact version of the same guidance.
- Added an overview shortcut to final review and moved optional document formatting into a disclosure.
- Added shared document upload areas for jurisdiction, property details and title documents, with a native file picker, drag-and-drop, format guidance, busy feedback, file-type errors, and protection against a second upload while busy.
- Added saved-deed sorting, source-document counts, last-viewed section labels, and document illustrations.
- Simplified shared form sections and displayed the existing Telugu heading translations.
- Preserved concurrent changes to setup, supporting-document layout and plan navigation. Those screens were validated in their current form.

Validation: 293 unit tests pass under Node 24; TypeScript checking and production build pass. The build retains bundle-size warnings. Browser checks cover review navigation, upload errors, file-picker and drop callbacks, blocking uploads while busy, sorting, search, persistence, all ten core screens on mobile, 375/768/1024/1440px form layouts, landscape, dark mode, and reduced motion. Layout screenshots are in `tmp/design-review/`.

## Modern dashboard and drafting presentation

Added `workspace-polish.css` as the shared presentation layer after the existing workflow styles. The dashboard now has a forest-green summary, a circular field-progress indicator backed by the existing accessible progressbar, metric icons, grouped supporting cards, and compact workflow rows on phones. The sidebar includes the current deed and drafting-step progress. Drafting screens use a breadcrumb back to Overview, consistent sans-serif interface headings, sentence-case field labels, aligned two-column desktop forms, single-column phone forms, and consistent card, upload and navigation surfaces. Document previews retain their serif typeface.

Validation for this presentation pass: TypeScript and production build pass; the full browser design-review flow passes. Checked six key text-token pairs in each theme: measured contrast ranges from 5.06:1 to 14:1 in light mode and 7.55:1 to 13.07:1 in dark mode. This is a targeted contrast check, not a complete accessibility audit. Production build continues to report bundle-size warnings.

## Payment, final review and download refinement

Matched these three screens to the modern dashboard while retaining the compact form layout:

- Payment summary cards show consideration, recorded payments and the remaining balance, with direct access to the consideration screen. Payment records separate identity/actions, payment-method controls, proof upload, editable fields and net totals. Added a keyboard-accessible proof picker alongside drag/drop. Rejected overpayments now show an announced error linked to the amount field; the previous valid value is retained.
- Final review has a forest-green summary showing the existing readiness-check count, consistent issue cards and separate disclosures for the full checklist and property-schedule wording.
- Download separates template selection from Word and plan-PDF export cards. Each card explains its file and shows the reason when unavailable. Incomplete-draft notices remain visible beside the Word action; the full outstanding list is available below. Existing download eligibility and generation rules are retained.
- Fixed duplicate currency symbols in displayed payment totals.

Verification: TypeScript and production build pass; 293 unit tests pass. `qa/finish-workflow.mjs` checks payment method/value retention, balance calculations, overpayment rejection and error semantics, TDS controls, review navigation, custom-template gating, a real Word download, and 320/375/768/1024/1440px layouts in light and dark modes. Screenshots and the generated test deed are in `tmp/finish-workflow/`. The system Edge version required an isolated Playwright 1.56.1 runner for clean download/browser teardown; the app's dependencies were not changed. The test supports selecting this through `PLAYWRIGHT_MODULE`. Build retains its existing bundle-size warnings.

## Property schedules, parties and compact step titles

Consolidated the title area across every drafting step: breadcrumbs, save status and an on-demand template disclosure share one toolbar; the step number is beside the title. The mobile step selector retains its accessible label without a separate visible label row. Measured headers are 87–105px across the checked widths.

Property cards now have a compact schedule identity, modern record styling and an expandable generated-wording preview. Executant and claimant cards place the party-type selector beside the record identity on desktop, and separate individual details from residential-address fields. Entity, representative, source and field bindings are preserved. Additional-party/property actions use matching compact cards.

Validation: TypeScript and build pass; 293 unit tests pass. `qa/property-party-polish.mjs` verifies header heights and layout from 320px to 1440px in both themes, isolation between property schedules, the generated wording preview, individual/address field retention through party-type changes, entity/representative values, template disclosure, and saving/reopening. It supports `QUICK_LAYOUT=1` for a focused check of the three changed screens at 375px and 1440px, and `PLAYWRIGHT_MODULE` for the isolated current browser runner. Screenshots are in `tmp/property-party/`.

## Instrument selection and conditional forms — 24 October 2026

Added accessible quick choices for ordinary Sale, Sale through GPA, Sale through AGPA and Gift, retaining the full instrument and variant selectors. Selected choices have a border, check icon and pressed semantics. Refined conditional Gift relationship/recital, authority and attorney panels using existing theme tokens, responsive form grids and consistent controls. Improved optional party-share fields, keyboard focus, mobile navigation targets and dashboard metric readability.

Validation: required TypeScript check and production build including document regressions and 290 tests passed after the final party-share styling adjustment. The existing browser design review passed (dark mode, reduced motion, landscape, persistence and responsive forms). Additional local browser checks visited every available step for Sale, GPA, AGPA and Gift at 375px and 1440px without page overflow. Screenshots are in tmp/instrument-review/. These checks use isolated template API fixtures and do not publish templates or change saved user drafts.


## Compact guided workspace — 24 October 2026

Redesigned the shared field presentation around the user's preference for density: 36px desktop controls, 12px sentence-case labels, 10–12px field gaps, four columns at 1440px and above, three at 1000px and above, and responsive narrower layouts. Tightened record headings, upload areas, section spacing and navigation. All 17 individual-party controls fit within a 1440×900 viewport in the measured browser scenario. Mobile controls retain 16px text to avoid input zoom.

Screen instructions are collapsed under “Help with this step”; field descriptions are off by default and can be enabled with “Show field guidance”. Added plain-language step descriptions, accessible field-help associations, explicit empty select prompts, contextual authority guidance, and optional saved-deed onboarding. Existing document wording, IDs, bindings and generation logic are retained. Other concurrent source/template changes in this working tree were preserved.

Validation: browser design-review flow passed, including saved drafts, source uploads, responsive forms, dark mode, reduced motion and focus. Additional browser checks visited every available Sale, GPA, AGPA and Gift step at 375px and 1440px. Density checks confirmed 17 visible party controls at 36px, four aligned columns, value retention when toggling hints, and no overflow with expanded help at 320/375/768/1024/1440px. Evidence is in tmp/instrument-review/. Required typecheck and production build/regressions are run for the final source.

## Flat agreements and template-to-dashboard coverage — 24 October 2026

Exposed a compact Landowner–developer agreements card in Link Deed & Enclosures for flat sales, with the same property-scoped values also grouped in Property Schedules. It collects the development agreement-cum-GPA number/date/SRO/code, separate supplemental agreement number/SRO/code, and the source's stilt/upper-floor counts. Agreement uploads use a restricted extraction profile so they cannot replace title-deed, current sale-authority, payment or party facts. Existing saved IDs are retained.

The build now audits all 303 placeholders across the current Sale v10, Gift v4 and Municipal Gift v1 sources, recording direct inputs and calculated/combined bindings in tmp/template-field-coverage/report.md. It also verifies development/allotment values at their own source recitals for ordinary/GPA/AGPA semi-finished flat sales, both default and replacement templates, multiple properties and saved drafts. Splitting the flat field group retains existing custom-placement anchors and avoids duplicate end-of-section fields.

Validation: TypeScript check and required build passed, including 300 core tests and the new coverage/download regressions. The focused extraction, placement and field suites passed 119 tests. A browser flow verified document-screen entry, property-screen synchronization, save/reopen, 375px/1440px layouts and the actual Word download. The current isolated Playwright runner completed cleanly. Evidence is in tmp/agreement-browser/.
