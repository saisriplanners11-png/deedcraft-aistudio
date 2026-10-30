# Telangana presentation and workflow coverage

The original `WizardApp` owns all workflow state, sources, extraction, review, persistence and generation. The registration presentation receives controlled navigation/library/jurisdiction props through `workspace-presentation.ts`. It has no separate draft store, upload queue, document generator or step sequence.

## Enable and roll back

Use **Dashboard version** in the header to choose **Classic** or **Registration (Preview)** in development or production. No environment setting or rebuild is needed to switch. New browsers start with Classic; each browser remembers its own choice under `deedcraft.dashboard-version`. Registration components/styles load on demand. Changing versions updates the presentation on the same mounted wizard: the current deed, step, manual edits, uploads, extraction jobs and template selection remain in place. Both versions share the existing IndexedDB saved deeds and source files. Different ports are different browser storage origins. The previous `VITE_REGISTRATION_UI` environment setting is no longer used.

## Coverage checklist

| Existing surface | Registration presentation | Preserved implementation |
| --- | --- | --- |
| Saved deeds | Search/sort toolbar and compact semantic table; stacked rows on phones | Existing list, open, save-before-switch and delete actions |
| Overview | Readiness, section links, existing progress and checks | Existing view model and navigation |
| 1. Deed setup | Portal section bars and existing property/instrument controls | Existing variants, applicability, stamp settings and placement slots |
| 2. Link Deed & Enclosures | Existing multi-document picker, per-document uploads and fields | Existing bundle assignment, phase extraction, candidate review, retry/cancel |
| 3. Jurisdiction | Existing upload, then dependent lookup fields and remaining original fields | Existing jurisdiction extraction, canonical values, date control and placement slots |
| 4. Property Schedules | Existing per-property upload, switcher, fields, boundaries, structures and agreements | Existing scoped extraction, evidence/review and schedule editing |
| 5. Market Value | Existing combined/per-property sections | Existing value extraction, declared value, computed rate and duty meanings |
| 6. Payment Details | Existing payment forms and balance checks | Existing payment records and validation; omitted for Gift |
| 7. Executant Details | Existing repeated party forms and identity uploads | Existing individual/entity/guardian/authorisation/representative extraction and authority editor |
| 8. Claimant Details | Existing repeated party forms and identity uploads | Existing recipient/entity/guardian uploads, shares and personal data |
| 9. Reverify | Existing grouped outstanding details and configured template fields | Existing validation, issue navigation and candidate confirmation |
| 10. Generate Deed | Existing readiness, template selection and export actions | Existing Word compiler, template assets, margins, wording and download policy |
| 11. Property Plan | Existing optional editor and exports | Existing property-specific exact-reference plan implementation |
| 12. Property Plan — New Generator | Additional optional guided plan editor | Independent per-schedule drafts/library; shared explicit attachment selection |
| Templates | Shared library and field configuration with portal styling | Existing immutable versions, publication, configured extraction and field placement |
| Additional template fields | Existing inline slots and fallback sections on the same steps | Existing field contract, repeated records, source reading and template review |
| Extraction dialog | Existing foreground progress, cancellation and review | Existing background continuation, stale-job guards and source precedence |

The jurisdiction presentation retains original field IDs and before/after/end anchors. Fields added to the core jurisdiction group later are appended automatically; configured template fields continue through the existing placement registry.

## Reference and tools

Reference: https://registration.telangana.gov.in/PDE/Pre_Reg_Property_Details.htm

REA source stays at `C:\Users\hp\Downloads\rea-reference`; the independent CLI/evidence workspace is `C:\Users\hp\Downloads\rea-workspace`. Saved public controllers, CSS, screenshot and REA analyses were captured on 25 October 2026. Live public POST contracts were rechecked on 26 October. The CSS reference supplies the blue gradient, labelled four-column form and chevron-step pattern. UI/UX Pro Max supplies keyboard/focus, contrast, responsive and progress-feedback guidance. No REA code executes in Deedcraft.

The representative designs use sample names and live public location records. At the user's request, the 1247 × 702 layout now uses one compact row for all eleven steps (42 pixels for the step strip), short visible labels and full accessible names/tooltips. The context row remains separate. Tablets use six columns over two rows; phones use a single selector between Previous/Next controls. The four-column jurisdiction form retains compact labels and inputs. Review messages and repeated records can extend the page normally.

Final screenshots are in the external REA workspace: `output/deedcraft-telangana-dashboard.png`, `output/deedcraft-telangana-compact.png`, `output/deedcraft-telangana-parties.png`.

The expanded dashboard acceptance results and remaining template limitations are recorded in [dashboard-acceptance.md](dashboard-acceptance.md). Run `node qa/dashboard-deed-matrix.mjs` to reproduce all approved variant/property generation cases and missing-reference rejection checks. Its machine-readable output is `tmp/dashboard-qa/deed-matrix.json`.

## Public lookup API

GET `/api/registration/lookups` is mounted in Vite development/preview and the production server. JSON option lists retain `{code,label}`; locality options additionally carry canonical `value`, ward, block and SRO code. Village-level locality responses also return ULB and property-location lists.

| kind | Required inputs | Fixed upstream POST |
| --- | --- | --- |
| districts | None | Public district snapshot captured from the reference, in original order |
| mandals | district | `MandalDetails.htm?dist_code=…&local_body=` |
| villages | district, mandal | `VillageDetails.htm?dist_code=…&mandal=…&local_body=` |
| localities | district, village | `LocalityDetails.htm?dist_code=…&vill_code=…` |
| jurisdiction | sro | `getJurisdicionName.htm?sr_code=…` |

Unknown/invalid inputs return 400, non-GET returns 405, and upstream failures return 502 with a manual-entry fallback message. Only fixed allowlisted endpoints are contacted; no credentials, cookies, source files or identities are sent. Requests time out after 15 seconds. Successful responses and in-flight requests are shared for ten minutes, with a bounded cache; failures are not cached.

## Data protection and compatibility

Optional `Draft.jurisdictionLookups[propertyId]` stores selected codes, canonical label snapshots, manual-mode choices and descendant review flags. Canonical field names remain in the existing property fields. Locality is the existing deed field; `registrationUlbName` and `registrationPropertyLocation` are supplemental names, distinct from the existing legal `localAuthorityType` category. Ward/block are derived from a matched locality. Linked-document SROs are never changed by property lookups.

Loading options never writes deed facts. Auto-matching accepts only an unambiguous name within its parent. An explicit code choice can disambiguate duplicate locality names; it remains valid only while its canonical name and parent options still match. Changing a parent invalidates dependent codes and marks retained text for confirmation. Manual entry works without the government service. Non-Telangana jurisdiction renders the original fields. Requests are aborted on dependency/schedule changes and old response keys are hidden immediately.

No additional government-only requirement blocks deed generation. Existing template safeguards and generation checks remain authoritative. Government submission, payments and slot booking are not implemented.

## Verification and browser fixture reproduction

- Required typecheck and complete build/regression suite; targeted public lookup, metadata, section extraction, additional-template extraction and repeated-party tests.
- Actual browser checks at 375 × 812, 768 × 1024, 1024 × 768, 1247 × 702 and 1440 × 1000: one/two/four field columns as appropriate, mobile step selector and no horizontal overflow. Dark-mode fields and visible keyboard focus were checked. The reduced-motion CSS disables nonessential animation/transition; OS preferences were not changed.
- Live Hyderabad → Hyderabad Division → Ashok Nagar → Chikkadpally, Rangareddy → Gandipet → Alizapur, and Adilabad Rural → Ankapoor option contracts were checked, including urban and Gram Panchayat bodies.
- Real UI file-choice flows with synthetic multi-page link-deed and identity files populated property fields and independent parties. Manual name corrections survived re-upload; party values and the retained source files survived save/reload. A Word download was generated through the new layout and its package/text checked for the sample buyer, both sellers and selected SRO.
- The repeated-party check found a pre-existing empty manual-name placeholder that blocked extracted names. Shared `add-party` registration now uses the existing party-type field to retain an untouched card, without writing a manual name. Explicit user name edits/clears still override uploads; existing legal capacities remain intact. Both layouts use this correction.
- False/unset mode was checked in a separate browser origin: original root/layout and no registration stylesheet loaded. The production lookup mount was smoke-checked independently.

For deterministic browser extraction checks, start the registration Vite server on 5174, then run `node qa/registration-fixture-server.mjs` and open 5176. The helper creates synthetic files under ignored `tmp/registration-qa/` and intercepts extraction responses, making no paid AI calls. Upload all four `REGISTRATION_QA_DEED_page*.txt` files together: the existing link-deed pipeline reads opening pages 1–2 and later schedule pages separately. Use the seller/buyer files in their respective identity upload controls. `REGISTRATION_QA_PORT` and `REGISTRATION_QA_TARGET_PORT` can select separate local test origins. Reload the QA page after code edits; the HTTP proxy does not relay HMR websockets. Existing fixture files are never overwritten because changing a live File's backing file invalidates browser IndexedDB blob writes.
