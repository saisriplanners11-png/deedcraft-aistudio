# New generator source

Copied directly from the AI Studio source export of app `4a10f954-4f22-4673-a7cc-e4ece2766b2e` on 29 October 2026:
https://ai.studio/apps/4a10f954-4f22-4673-a7cc-e4ece2766b2e

Published reference: https://remix-remix-remix-property-plan-generator-2026-1.ai.studio/

Downloaded archive: `remix-remix-remix,-property-plan-generator-2026.1.zip`.
SHA-256: `8c22031f5c47c4a597f0e7ac4843ae86e430ed96b913865bba72c47f9fccf6f0`.
Only application source and its HTML entry were imported; exported server/configuration, secrets, lockfiles and patch scripts are not used.

The source retains its English/Telugu guided and all-sections modes, geometry controls, samples, library and plan exports. Host adaptations match the retained exact-reference editor: blank initial facts, no sample injection on property-type changes, a same-origin draft/schedule/session bridge, independent library storage, selective deed refresh, selection snapshot checks, compatible canvas capture, drop zones, narrow-screen control wrapping and a reachable sketch-modal footer. Type declarations were repaired to match the source's actual controls and supported saved values.

Step 12 has separate `guidedPlanDrafts` and `guidedPlanSelectedSvgs` in each saved deed. The shared `selectedPlanSvgs` map still records exactly one chosen plan per schedule. Editing an editor's selected plan clears that selection; editing the other editor leaves it selected. Deed changes require selecting a reviewed plan again. Legacy removed step IDs reopen in Step 11; drafts with workflow version 2 can reopen in the new Step 12.

AI uploads use the existing `/api/analyze-sketch` and `/api/parse-document` server contracts. No browser API key or external iframe is used. Permanent master deed rules remain unchanged.
