# Rules applied over every replacement deed draft

Permanent policy: [MASTER_DEED_RULES.md](../MASTER_DEED_RULES.md), explicitly confirmed by the user on 29-10-2026. Read that full register for all common rules, instrument exceptions and explicit-change requirements; this note describes their implementation.

The user's instruction on 28 October 2026 applies to every deed type: a new Word draft changes source wording and formatting, while existing application rules and entered facts continue to apply. A Word upload alone never authorizes removing a prior modification.

## Common protections

- Browser upload, server validation, publication/rollback and actual download use current preservation checks. Cached validation cannot bypass the download checks.
- The dashboard can export an incomplete draft after the user confirms the reported issues with Download Anyway. It uses the selected compatible source where possible. If the selected source is incompatible it tries the same instrument's default. If no deed can be rendered, it exports a clearly labelled Word details draft. This confirmation applies only to that download and does not approve a template or clear validation issues.
- Existing configured-field definitions and values are retained. A replacement missing their placeholders is rejected instead of silently trimming the field contract. An incompatible browser replacement keeps the previously valid custom source selected.
- Complete party identities remain required, including split or combined addresses. Missing PAN slots are restored using each party's own binding. Party repeats retain guardian/ward/court details, capacities, entity representatives and selected genders through the existing merge layer.
- Recognized fixed party percentages become bindings to the draft's optional percentages. Fixed allocation paragraphs are removed before property-specific allocations are regenerated. Regular Gift continues to omit party allocations altogether while retaining saved values and flat land UDS.
- Recognized literal execution dates and declared market values are replaced with their existing bindings. The shared formatters keep complete dates as DD-MM-YYYY and deliberate month-only execution dates with a blank signing day.
- Fixed appended NALA extent examples are removed before the applicable schedule rule is applied. Regular Gift omits that added sentence; other supported deeds derive it from the property's entered records.
- The selected stamp-paper margin remains authoritative. A replacement's large continuation margin is normalized before pagination, including Section 32A layout.
- Total market-value and estimate rows resolve to the entered document value. Per-unit rates and property measurements retain their separate meanings.
- House structure rows apply their own roof rate and construction-stage percentage. The schedule’s manual structure subtotal, when set, feeds the dashboard’s combined market value and duty calculation. The declared Word value continues to follow COM-02.
- Source bytes, historical versions, styles and supporting package parts are retained. Normalization edits document content in memory before entered facts merge.

## Separate instrument protections

Sale, Sale through GPA and Sale through AGPA retain authority identity/representation/declaration rules, payment behavior, property-specific schedules and valuation exclusions. Finished and semi-finished flat agreement recitals are restored from the approved reference if the replacement omits them from both branches, using the replacement's recital formatting and each property's own entered agreement numbers.

Regular Gift retains its title/category, relationship, nil consideration, ownership/NALA omissions and declaration/signature policies. Municipal Gift retains entered claimants, calculated square metres and its separate public-purpose wording and closing.

Agreement of Sale Cum GPA retains the selected possession block and Section 32A party/signature groups. General and Family GPA retain attorney relationships, powers and Section 32A. Replacement validation rejects incompatible source structures rather than inventing legal clauses or silently dropping saved facts.

The refreshed authority defaults are General/Family GPA v2 (`G.P.A FOR CONSIDERATION (1).docx`) and Agreement Sale Cum GPA v3 (`AGREEMENT OF SALE CUM GPA (2).docx`). Earlier versions remain available with their original hashes. Recognized claimant identity fragments split across source section boundaries are joined before repetition, preserving the boundary once and every recipient's own details. The GPA's closing signature/witness table stays together, with its witness numbers, before the separate Section 32A pages. `qa/authority-template-refresh-flow.mjs` checks historical and current sources and both possession branches.

## Enclosure and GPA corrections, 02-11-2026

Policy version `2026-11-02.1` applies SRC-05, COM-10/14/15 and GPA-07/08. One Step 2 Link Document upload projects its own title facts and any available jurisdiction, property schedule/boundary and market-rate/structure values to the selected property, without requiring another upload at later steps. Enclosure SRO selectors show the office name and code together while persisting separate record-scoped values for their existing template bindings. Property locality, village, mandal, registration SRO/sub-district and municipal/Gram Panchayat authority are normalized to Title Case; source quotations and party addresses remain unchanged. Landmarks print “near H.No.” / “adjacent H.No.” General/Family GPA downloads omit recorded payment receipts and payment schedules while preserving saved payment entries, the payment workflow, consideration/market/stamp rows and the attorney's power to receive sale proceeds. General heading remains unchanged; Family prints “G.P.A. (FAMILY MEMBERS)”. SAL-04/05 remain in force, including property-scoped DGPA/supplemental inputs and recitals for semi-finished flats. Regressions cover the single-upload projection, enclosure field mapping, extraction, flat inputs, and generated GPA text and sample files.

Policy version `2026-11-03.1` additionally applies COM-16. Part open place and house schedules use repeatable H.No./PTIN rows persisted per property schedule. Link Document extraction keeps every explicitly supported pair; ambiguous associations stay unpaired for review. The existing schedule placeholders receive all rows in order, older single-value drafts remain valid, and vacant-land tax identifiers remain separate.

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

Council-only recipient exception confirmed 30-10-2026: MUN-02 now prints the entered Municipal Council name followed by the supplied fixed Act 1965, Commissioner and DONEE definition. Recognition uses each active recipient name, including an entity's name, never ULB/village or inactive personal fields. Non-council identities and all saved records remain unchanged. Policy version 2026-10-30.1 invalidates stale generation metadata; immutable Word sources stay untouched.

Master rule SRC-04 and policy 2026-10-29.1 implement the supplied voice-note request: a typed Rectification Deed/Supplemental Deed in an ordinary Link Document card uses that same record for the matching recital. A shared classifier/value resolver is used by the form preview, restored-source projection and download merge. The live preview reads the actual selected Word paragraph and uses the download formatter. Typing does not move cards, change field/record IDs or clear facts/evidence. Missing amendment numbers omit clauses; missing source paragraphs or registration bindings block generation with an actionable error even with cached valid metadata. Original titles and flat allotment records remain separate. `qa/title-amendment-flow.mjs` checks matching previews/downloads and omissions across nine supported variants; browser checks cover focus, edits, switching and save/reload.

## Principal relation dashboard correction, 29-10-2026

Signature-heading compatibility correction, 30-10-2026: Sale signature-line placement accepts both “OF VENDOR/VENDEE” and the supplied replacement's “OF THE VENDOR/VENDEE”, including plural/slash captions and whitespace. Retain the source headings and reject genuinely missing signature sections. `qa/sale-v10.mjs` exercises the additional wording for ordinary/GPA/AGPA downloads. This restores source compatibility without changing master rules or immutable Word assets.

An imported GPA/AGPA principal with no verified relation correctly remained unresolved under COM-04/SAL-01, but the form independently displayed an unsaved S/O default. The party form now takes its relation fallback from that same record's application state used for validation. Missing imported relations show an empty, required Relation dropdown with field-level guidance; choosing S/O, W/O, D/O or C/O updates the existing record and enables download once all required details are complete. Existing ordinary-party defaults, supplied relations, evidence, record IDs and authority details remain intact. No master rule or preservation version changed. Run `npm run test:principal-relation` for desktop/mobile GPA/AGPA checks covering separate principals, save/reload and actual Word downloads.

04-11-2026 (GPA-07): General/Family GPA omit Payment Details and payment reconciliation. Preserve saved payments, declared values, powers and output omission. Runtime policy: 2026-11-04.1.

04-11-2026 title correction (COM-13/GPA-08/GIF-01/AGR-03), runtime 2026-11-04.2: all deed titles retain source wording and formatting. Remove forced Family GPA heading and Gift single-line/font reconstruction; resolve only explicit source category/possession choices. This supersedes historical title policies above, without changing immutable assets or other master rules.

04-11-2026 COM-16/17 clarification, runtime 2026-11-04.3: H.No./PTIN rows live only in Step 2. Link-deed and house-tax/assessment workers retain all pairs; saved/legacy rows survive. Preserve the source identification point and append only each supported bearing H.No. to its assessment value, without changing the receipt-number binding.

05-11-2026 SRC-06, runtime 2026-11-05.1: every Step 2 option uses repeated independent cards. Grouped tax/land cards no longer reuse or merge records. Source paragraph repeats retain each enclosure’s own values, dates and authority. Preserve legacy narrow cards, source assets, saved evidence, property isolation, H.No./PTIN handling and instrument-specific exceptions.

05-11-2026 PTY-05, runtime 2026-11-05.2: minor-recipient output follows the user photo/voice note. Keep minor identity first and mark (MINOR) after age/DOB, followed by the selected guardianship wording and full guardian identity before the source definition. Both Minor and Guardian entry modes retain their saved fields; rendered ward identity never borrows the guardian address/Aadhaar. Include guardian occupation and entered PAN; preserve adult recipients, minor-executant court checks, immutable sources and source closing labels.

12-11-2026 PTY-01/05, runtime 2026-11-12.3: render each explicitly linked guardian once under the last minor assigned that guardian. A shared recital identifies all minors the guardian represents by their numbered points. Guardian-only cards stay available for editing and validation. Word recipient numbering and recipient counts exclude linked guardian-only cards. The production build checks separate and shared guardians with built-in and custom sources.

12-11-2026 COM-03, runtime 2026-11-12.4. The saved stamp count controls opening stamp sheets across instruments and compatible replacements. The selected denomination supplies the top margin and the independently entered rupee value supplies the existing Word bindings. The continuation retains normal page geometry.

12-11-2026 COM-25, runtime 2026-11-12.5. Step 10 saves the optional typing stamp selection, name and mobile number per draft. Recognized source attribution is removed during Word generation, and the selected stamp is appended after the attached plans.

## Release integration — 07-11-2026

`release-deed-v1` retains the original uploaded RELEASE DEED.docx bytes and SHA-256 d3077f53109780af91f60d77299737ce5f190198d8a46a126e03eb7237db33f1. Both existing Release variant IDs select it. Source normalization resolves known generic amendment slots to record-specific bindings and restores the missing RTGS reference slot; immutable bytes are unchanged. Eight schedules map to the existing property variants. Release has an independent renderer, validation profile and publication samples.

`Draft.releaseData` / `AppState.releaseData` are optional additive fields: `releasedBySchedule[propertyId][releasorId]`, `allocatedBySchedule[propertyId][releaseeId]`, and `relationships[]` with stable ID, releasorId, releaseeId and wording. Fractions represent a share of the whole property; bare decimals represent percentages. Ordinary ownership percentages are separate. Removing one party/property cleans only its Release entries. Existing legacy `form.releasedShare` remains combined and does not become a party allocation. Missing shares do not authorize inferred totals/extents. Whole-property value is explicitly entered in `totalPropertyValue`; released-rights consideration remains `consid`. No money is inferred from shares.

The user approved REL-01–05 and implementation of this behavior on 07-11-2026. Preservation version 2026-11-07.1 adds these rules without weakening any previous instrument profile. Build gates include Release source validation and actual default-renderer downloads for all eight property branches, plus focused multi-party, shares, payments, saved-data, replacement and stamp-space tests. No rate or deployment change is included.

Reconveyance REC-01–03 (07-11-2026): independent per-link mortgage interest is summed with exact currency arithmetic; Step 5 restores all original valuation fields alongside repayment totals and retained principal override/reset. Bank Releasor requests only existing bank name/branch/designation and omits the officer's personal segment; saved identity data survives switching. Legacy deed-level interest remains readable. Runtime preservation version is 2026-11-07.2.

COM-19 (09-11-2026): Suggestions must not restrict the text printed for editable deed fields. The shared house merge now prefers the full roof description before a floor fallback. Runtime preservation version: 2026-11-09.1.

09-11-2026 House update (COM-10 and COM-16/17): retain partial tax identification in the existing source point, restore the schedule Bearing H.No. editor, and hide the finished-house landmark inputs. Runtime preservation version: 2026-11-09.2.

COM-20 (09-11-2026): group currency with Indian commas and omit zero fractional parts in output. Preserve nonzero decimals, keep exact Reconveyance paise arithmetic, and leave area measurements and survey identifiers outside the money formatter. Runtime preservation version: 2026-11-09.3.

12-11-2026 COM-25, runtime 2026-11-12.6. The typing stamp is right-aligned in a narrow block, and its statement wraps within the block.

12-11-2026 COM-03, runtime 2026-11-12.7. Step 5 calculates the stamp paper value by multiplying the selected denomination by the stamp count. The same calculation feeds the Word binding. When the selection has no numeric denomination, retain the existing recorded value.

12-11-2026 COM-25/26, runtime 2026-11-12.8. The stamp follows the supplied layout, with uppercase name, optional place and a validated mobile in 5+5 format. Party and representative mobile bindings apply the same ten-digit rule. Aadhaar digit grouping applies in dashboard inputs.
