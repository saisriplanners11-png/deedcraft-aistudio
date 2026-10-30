# Rules applied over every replacement deed draft

Permanent policy: [MASTER_DEED_RULES.md](../MASTER_DEED_RULES.md), explicitly confirmed by the user on 29-10-2026. Read that full register for all common rules, instrument exceptions and explicit-change requirements; this note describes their implementation.

The user's instruction on 28 October 2026 applies to every deed type: a new Word draft changes source wording and formatting, while existing application rules and entered facts continue to apply. A Word upload alone never authorizes removing a prior modification.

## Common protections

- Browser upload, server validation, publication/rollback and actual download use current preservation checks. Cached validation cannot bypass the download checks.
- Existing configured-field definitions and values are retained. A replacement missing their placeholders is rejected instead of silently trimming the field contract. An incompatible browser replacement keeps the previously valid custom source selected.
- Complete party identities remain required, including split or combined addresses. Missing PAN slots are restored using each party's own binding. Party repeats retain guardian/ward/court details, capacities, entity representatives and selected genders through the existing merge layer.
- Recognized fixed party percentages become bindings to the draft's optional percentages. Fixed allocation paragraphs are removed before property-specific allocations are regenerated. Regular Gift continues to omit party allocations altogether while retaining saved values and flat land UDS.
- Recognized literal execution dates and declared market values are replaced with their existing bindings. The shared formatters keep complete dates as DD-MM-YYYY and deliberate month-only execution dates with a blank signing day.
- Fixed appended NALA extent examples are removed before the applicable schedule rule is applied. Regular Gift omits that added sentence; other supported deeds derive it from the property's entered records.
- The selected stamp-paper margin remains authoritative. A replacement's large continuation margin is normalized before pagination, including Section 32A layout.
- Total market-value and estimate rows resolve to the entered document value. Per-unit rates and property measurements retain their separate meanings.
- Source bytes, historical versions, styles and supporting package parts are retained. Normalization edits document content in memory before entered facts merge.

## Separate instrument protections

Sale, Sale through GPA and Sale through AGPA retain authority identity/representation/declaration rules, payment behavior, property-specific schedules and valuation exclusions. Finished and semi-finished flat agreement recitals are restored from the approved reference if the replacement omits them from both branches, using the replacement's recital formatting and each property's own entered agreement numbers.

Regular Gift retains its title/category, relationship, nil consideration, ownership/NALA omissions and declaration/signature policies. Municipal Gift retains entered claimants, calculated square metres and its separate public-purpose wording and closing.

Agreement of Sale Cum GPA retains the selected possession block and Section 32A party/signature groups. General and Family GPA retain attorney relationships, powers and Section 32A. Replacement validation rejects incompatible source structures rather than inventing legal clauses or silently dropping saved facts.

The refreshed authority defaults are General/Family GPA v2 (`G.P.A FOR CONSIDERATION (1).docx`) and Agreement Sale Cum GPA v3 (`AGREEMENT OF SALE CUM GPA (2).docx`). Earlier versions remain available with their original hashes. Recognized claimant identity fragments split across source section boundaries are joined before repetition, preserving the boundary once and every recipient's own details. The GPA's closing signature/witness table stays together, with its witness numbers, before the separate Section 32A pages. `qa/authority-template-refresh-flow.mjs` checks historical and current sources and both possession branches.

## Versioning and regression checks

`deed-preservation.ts` holds the policy version and supported renderer profiles. Generation manifests record the version independently of template hashes and duty rules. Saved drafts with stale generation metadata are invalidated without changing facts, files, selected custom sources or edit dates. This applies to every catalogued instrument.

Library samples carry their preservation version. A replacement validated under older rules must be validated again before publication. Rollback also checks the old source against current rules; rolling back a Word asset never rolls back application rules.

`qa/deed-preservation-flow.mjs` runs in every production build. It exercises 84 changed-source downloads across all currently supported instrument/property variants, source-embedded stale facts, missing party identities, flat recitals removed from both source branches, cached valid metadata and the shared policy-version manifest. The existing Gift, authority, payment, share, date, margin, gender, flat, guardian and Section 32A regressions remain in the build.

The other catalogued deed families still require approved references and registered renderers. A source cannot be accepted for a new family until a preservation profile is explicitly registered; there is no fallback to another deed's rules.

When an explicitly authorized application rule changes, update its implementation and regression coverage and advance the preservation version. Template wording, instructions embedded in uploaded documents, and cached metadata cannot change that version or disable these protections.

## Five-source refresh, 29-10-2026

Sale v11, regular Gift v6, Municipal Gift v3, General/Family GPA v3 and Agreement Sale Cum GPA v4 preserve all earlier source assets and hashes. The new source rectification/supplemental title paragraphs use their own repeatable property-linked records. Original title, amendment, authority, tax/NALA and flat development/allotment facts stay isolated; missing amendment numbers omit their clauses. Municipal donor definition prints once even when a supplemental clause is absent. Recognized Sale aliases restore execution-date, representation/book/authority SRO, separate floor and flat agreement bindings in memory. The approved v10 restoration wording remains pinned as historical content and cannot recurse into the new unnormalized source. `qa/master-template-refresh-flow.mjs` covers 132 default/custom downloads across nine variants and plots, houses and flats. No master rule or preservation version changed.

Word preview verification also enforces normal continuation margins after the first principal/donor when expanded authority/title openings would otherwise span several stamp-margin pages. Sale flat UDS square metres use the UDS extent, independently of total site area, as in the other deed renderers. Both are master-rule restorations covered by the current-source regression matrix.

## Typed amendment request, 29-10-2026

Master rule SRC-04 and policy 2026-10-29.1 implement the supplied voice-note request: a typed Rectification Deed/Supplemental Deed in an ordinary Link Document card uses that same record for the matching recital. A shared classifier/value resolver is used by the form preview, restored-source projection and download merge. The live preview reads the actual selected Word paragraph and uses the download formatter. Typing does not move cards, change field/record IDs or clear facts/evidence. Missing amendment numbers omit clauses; missing source paragraphs or registration bindings block generation with an actionable error even with cached valid metadata. Original titles and flat allotment records remain separate. `qa/title-amendment-flow.mjs` checks matching previews/downloads and omissions across nine supported variants; browser checks cover focus, edits, switching and save/reload.

## Principal relation dashboard correction, 29-10-2026

Signature-heading compatibility correction, 30-10-2026: Sale signature-line placement accepts both “OF VENDOR/VENDEE” and the supplied replacement's “OF THE VENDOR/VENDEE”, including plural/slash captions and whitespace. Retain the source headings and reject genuinely missing signature sections. `qa/sale-v10.mjs` exercises the additional wording for ordinary/GPA/AGPA downloads. This restores source compatibility without changing master rules or immutable Word assets.

An imported GPA/AGPA principal with no verified relation correctly remained unresolved under COM-04/SAL-01, but the form independently displayed an unsaved S/O default. The party form now takes its relation fallback from that same record's application state used for validation. Missing imported relations show an empty, required Relation dropdown with field-level guidance; choosing S/O, W/O, D/O or C/O updates the existing record and enables download once all required details are complete. Existing ordinary-party defaults, supplied relations, evidence, record IDs and authority details remain intact. No master rule or preservation version changed. Run `npm run test:principal-relation` for desktop/mobile GPA/AGPA checks covering separate principals, save/reload and actual Word downloads.
