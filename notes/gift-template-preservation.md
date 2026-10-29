# Gift rules preserved across template replacements

Permanent policy: [MASTER_DEED_RULES.md](../MASTER_DEED_RULES.md), explicitly confirmed by the user on 29-10-2026. Preserve its common rules and Gift/Municipal exceptions across every replacement; only an explicit user request can change a rule.

Confirmed against the earlier chats on 28 October 2026. A replacement Word draft changes the source prose and formatting. It does not supersede an existing application rule unless the user explicitly changes that rule.

## Earlier requirements checked

| Requirement | Applies to | Protection and verification |
| --- | --- | --- |
| One-line title with the selected family, others or trust category | Regular Gift | Renderer-owned title; Gift generation and replacement preservation checks |
| Relationship recital and donor/donee agreement | Regular Gift | Renderer restores a missing relationship line and resolves party counts |
| No party share recitals or allocation paragraphs below schedules | Regular Gift | Saved share values remain; source policy also removes known fixed or placeholder clauses from replacements |
| No appended NALA converted-extent sentence | Regular Gift | Source policy and schedule merge omit the sentence; linked NALA records and actual property extent remain |
| Optional blank signing day and DD-MM-YYYY dates | Both | Shared date formatter; preserved month-only execution dates |
| Selected stamp-paper margin and continuation sections | Both | Output policy and build regression matrix |
| Entered document value and nil monetary consideration | Regular Gift | Merge values and Gift annexure normalization |
| Near/Adjacent House No. valuation row only for open place/open plot | Regular Gift | Property-specific valuation policy; property descriptions retain the selected landmark |
| Full entered claimant identities instead of the forced council/Commissioner | Municipal Gift | Renderer replaces either legacy variable or new literal council recipient with claimant records |
| Calculated square metres, including 30 square yards = 25.08 square metres | Municipal Gift | Derived from verified yard extent; stale metre disagreements cannot erase the result |
| Uppercase claimant and property village | Municipal Gift | Existing identity/property merge rules |
| Guardian/Minor identity, ward, relationship and executant court permission | Both | Shared party recitals and validation; actual compiler/download checks on both sides |
| Selected gender and per-party capacity prefixes | Both | Existing party rewrite and pronoun rules |
| Entity representatives, designations and shared member list | Both | Existing entity recital and saved-party migration code; unchanged by the Word replacement |
| Automatic default refresh without losing entered facts; custom sources remain selected | Both | Saved-template migration regressions |
| Municipal public-purpose clauses and separate closing; no regular Gift relationship/valuation annexure injected | Municipal Gift | Separate renderer and source validation |

The principal earlier chats checked were **Transcribe and fix audio**, **Add party type labels to executants**, and **Update existing deeds to new default**. Later claimant-entry instructions supersede the original automatic municipal recipient requirement.

## Gap found and corrected

The current defaults already retained the main earlier corrections. However, a compatible replacement could contain literal ownership-share prose or an appended NALA extent sentence, causing that old wording to reappear. This was reproduced with a replacement containing a fixed 50% party share and a fixed NALA sentence.

`gift-template-policy.ts` now applies the regular Gift omissions to source text before entered facts are merged. Supported conflicting clauses are removed. Unfamiliar conflicting share/allocation wording is rejected. It preserves linked NALA title records, flat land UDS, saved facts and unrelated source formatting. Municipal Gift retains its separate rules.

`qa/gift-preservation-flow.mjs` runs in every production build. Its 23 cases exercise all five historical/current regular Gift source versions, fixed and placeholder clauses in changed replacements, plot/house/flat output, and Guardian/Minor downloads for both roles in regular and Municipal Gift. Existing Gift, Municipal, output-format, gender, saved-data and other deed checks remain in the build.
