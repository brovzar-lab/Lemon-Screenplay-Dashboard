# Plan Review Log: Lemon Studios Intelligence Briefing

Phases 0-1 (recon + interrogation) complete. The plan is locked with Billy Rovzar. MAX_ROUNDS=5.

## Round 1 — Codex

The plan has several material gaps and should not be implemented unchanged.

1. **Critical, client-side privacy:** The plan puts internal decisions and predictions into bundled JSON, but [`AuthGate`](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/src/main.tsx:43) protects rendering, not publicly downloadable JavaScript assets.  
   **Fix:** Keep the bundled snapshot public-safe and defer confidential decision and prediction records until they can be loaded from an authorization-protected store.

2. **Authorization is assumed, not proven:** The root route permits any authenticated account, while the proposed privacy test renders the page directly with mocked private data and never exercises authentication or database rules ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:79)).  
   **Fix:** Define the permitted role and add an integration test proving unauthorized and public-share users cannot fetch or render slate titles or scores.

3. **The creative score and PASS source are ambiguous:** The plan says “existing creative score,” but the model identifies `producerProjection.finalScore` as canonical and separately exposes legacy `weightedScore` and `recommendation` fields ([screenplay.ts](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/src/types/screenplay.ts:77)).  
   **Fix:** Use `producerProjection.finalScore` and `finalVerdict` only when `rankable` and `trustStatus === 'verified'`; show every other project as unrankable instead of silently falling back.

4. **The geography contract contradicts itself:** The plan promises individual Latin American markets remain separate, but the schema retains one `latin-america` territory bucket ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:17)).  
   **Fix:** Require an ISO country code on every claim, source, and signal, reserving `latin-america` only for genuinely regional evidence.

5. **“Append-only” cannot be enforced by one replaceable snapshot:** A weekly candidate can remove or rewrite prior predictions because there is no persistent baseline or comparison rule ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:18)).  
   **Fix:** Store the ledger separately and make validation compare it with the previous checked-in version, rejecting changed or deleted historical records.

6. **Artifact hashing is circular and underspecified:** The research contract expects an artifact hash inside snapshot identity, but a file cannot contain its own full-file SHA-256 deterministically.  
   **Fix:** Put the SHA-256 of the exact candidate bytes in a separate human-approved manifest and verify it during publication.

7. **Schema version 2 is only a feature list:** Required fields, nullable fields, enums, ID scopes, timestamp formats, ordering, cross-reference direction, and upgrade behavior are not defined ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:32)).  
   **Fix:** Freeze one exact V2 TypeScript contract, representative fixture, and runtime validator before building the UI, with unknown-field rejection and explicit cross-field rules.

8. **Untrusted source links are not constrained:** The planned source ledger can supply clickable URLs, but no rule rejects `javascript:`, credential-bearing URLs, local addresses, or malicious redirects.  
   **Fix:** Accept only validated external HTTPS URLs without embedded credentials or private-network hosts, and render them with `rel="noopener noreferrer"`.

9. **Research prompt-injection and social privacy are not handled:** Public webpages are untrusted input, yet the workflow does not explicitly reject source-supplied instructions or mechanically prevent usernames and raw social posts from entering artifacts.  
   **Fix:** Tell Paperclip to treat all source content as data, ignore embedded instructions, and emit only aggregated social observations without handles, profiles, or unnecessary quotations.

10. **Matching semantics remain dangerously vague:** The current matcher performs raw substring searches across private fields, so terms can false-match words such as `action` inside `transaction` ([studioPulse.ts](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/src/lib/studioPulse.ts:104)).  
    **Fix:** Define structured field-specific AND/OR terms with case, accent, and word-boundary normalization, plus tests for false positives and Spanish variants.

11. **Stale evidence can still produce “Advance” or “Acquire”:** Freshness is displayed, but the plan has no rule preventing expired or future-dated evidence from driving an action.  
    **Fix:** Reject future dates and force expired decision-critical evidence or missing required channels to `watch` or `insufficientEvidence`.

12. **The plan can manufacture three decisions:** It requires three cards even when no reviewed evidence supports three distinct moves ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:42)).  
    **Fix:** Allow zero to three cards, define a single action enum and unique rank, and render an explicit insufficient-evidence state instead of filling slots.

13. **Evidence-health labels are not reproducible:** “Derive deterministically” does not define how independence groups, conflicting sources, stale evidence, ties, or missing dimensions affect each label.  
    **Fix:** Specify independent per-dimension rules, deduplicate sources by independence group, and never derive an overall confidence label from those dimensions.

14. **Forecast statistics have no denominator policy:** “Minimum sample” and “comparable resolutions” are undefined, making accuracy easy to cherry-pick ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:62)).  
    **Fix:** Show `Not enough history` throughout V1 and defer statistics until an approved cohort key, resolution eligibility rule, and fixed minimum sample exist.

15. **Bilingual ownership is unclear:** Dynamic research copy and application chrome could both pass through `i18next`, causing untranslated keys, double translation, or silent English fallback.  
    **Fix:** Store artifact copy strictly as `{ en, "es-MX" }`, keep chrome in `i18next`, validate both strings as nonempty, and show a visible unavailable state rather than fallback.

16. **Accessibility proof is too manual:** The plan requires an accessible Recharts/table experience but adds no automated check despite the installed Playwright and axe tooling ([package.json](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/package.json:61)).  
    **Fix:** Add one authenticated Playwright test covering axe, keyboard order, native disclosure, table headers and sorting, visible focus, and desktop/mobile behavior, with the chart hidden from assistive technology.

17. **Invalid data still crashes the homepage:** The current parser throws during module initialization ([studioPulse.ts](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/src/lib/studioPulse.ts:51)), and the plan adds a much larger failure surface without a safe runtime state.  
    **Fix:** Fail publication during validation, then retain a runtime “briefing unavailable” state that logs only snapshot ID and validation code, never the private joined slate data.

VERDICT: REVISE

## Round 1 — Revision

- Made every bundled research artifact explicitly public-safe and deferred confidential decision and prediction records.
- Defined the authorized Firestore join and verified-score-only rules.
- Required ISO country codes, strict V2 keys and cross-field validation, a separate hash manifest, safe external HTTPS links, prompt-injection handling, aggregate-only social evidence, structured matching, stale-evidence downgrades, zero-to-three actions, reproducible evidence dimensions, no forecast statistics, strict bilingual ownership, automated accessibility and authorization proof, and safe runtime failure.

## Round 2 — Codex

The revision fully addresses 11 of the 17 prior findings. Six are only partially resolved.

| Prior finding | Status |
|---|---|
| 1. Bundled-data privacy | Addressed |
| 2. Authorization proof | Partial |
| 3. Canonical score/verdict | Addressed |
| 4. Geographic modeling | Partial |
| 5. Append-only ledger | Addressed by deferral |
| 6. Circular artifact hash | Addressed |
| 7. Exact V2 schema | Addressed |
| 8. Unsafe source URLs | Addressed |
| 9. Prompt injection/social privacy | Partial |
| 10. Substring matching | Addressed |
| 11. Freshness action gate | Partial |
| 12. Manufactured decisions | Partial |
| 13. Evidence-health derivation | Partial |
| 14. Forecast denominator | Addressed by deferral |
| 15. Bilingual ownership | Addressed |
| 16. Accessibility proof | Addressed |
| 17. Parser failure handling | Addressed |

Remaining and new material problems:

1. **Authenticated outsiders remain untested:** The tests cover unauthenticated identities and approved `reader`/`admin` roles, but not a logged-in account without team membership ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:91)).  
   **Fix:** Add Firestore and route tests proving an authenticated non-team account cannot read or render portfolio data.

2. **`insufficient_evidence` is incorrectly modeled as an action:** It is mixed into the same enum as `advance`, `acquire`, and `dismiss`, allowing a non-decision to become a ranked decision card ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:49)).  
   **Fix:** Keep `action` limited to real actions and represent `insufficient_evidence` as a separate evidence state or empty-state reason.

3. **Conversation evidence is wrongly mandatory for every strong action:** The freshness rule blocks direct buyer mandates or observed performance from supporting action unless conversation data also exists ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:41)).  
   **Fix:** Require conversation plus context only for zeitgeist-derived actions; allow direct verified buyer evidence or observed outcomes to support other actions independently.

4. **The geography rule cannot represent global or diaspora evidence cleanly:** Requiring country codes on every record conflicts with genuinely global evidence and US Latino audience evidence ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:39)).  
   **Fix:** Use `scope: country | regional | diaspora | global` plus a country-code array, permitting an empty array only for explicitly global evidence.

5. **Evidence health and card confidence still conflict:** The plan forbids deriving a combined confidence label from evidence dimensions but requires every action card to show one without defining its source ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:43)).  
   **Fix:** Define card confidence as a separately reviewed claim classification with explicit rules, or remove it and show the independent evidence dimensions.

6. **“Mechanically reject unnecessary quotations” is not implementable:** A validator can detect forbidden fields and patterns, but cannot reliably decide whether prose is necessary ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:79)).  
   **Fix:** Mechanically reject raw-post fields, handles, and profile URLs, then assign quotation necessity and privacy review to the human publication checklist.

7. **The chart still hides timing uncertainty:** Plotting only the range midpoint visually converts an uncertain interval into an apparently precise value ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:60)).  
   **Fix:** Display the timing range with an error bar or interval marker, and omit the point when no defensible range exists.

VERDICT: REVISE

## Round 2 — Revision

- Added authenticated non-team denial tests at both the route and Firestore layers.
- Separated evidence insufficiency from the action enum and allowed zero supported cards.
- Made evidence requirements source-specific, added country, regional, diaspora, and global scopes, and made card confidence a human-reviewed claim classification.
- Replaced impossible quotation validation with mechanical forbidden-field checks plus human privacy review.
- Required visible timing intervals and omitted unsupported portfolio points.

## Round 3 — Codex

All seven Round 2 problems are now addressed. Five material implementation gaps remain:

1. **A failed slate query can masquerade as an empty slate:** The plan defines an acquisition state for zero projects but never separates successful-empty, loading, authorization failure, and network failure ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:66)).  
   **Fix:** Render acquisition gaps only after a successful empty query; loading and query errors need distinct non-decision states and tests.

2. **Market timing still has no defined unit or scale:** The chart requires a numeric interval, but the plan never defines its domain, derivation, or meaning ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:60)).  
   **Fix:** Freeze a transparent timing scale with named endpoints and derivation rules, or omit the plotted point when timing cannot be quantified defensibly.

3. **Manifest integrity lacks an executable test:** The plan requires hash verification but does not add a manifest path, parser contract, or tampering test to the proof section ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:38)).  
   **Fix:** Name the manifest file and add one test proving publication fails when either the JSON or evidence Markdown differs by one byte.

4. **Project “evidence confidence” is ambiguous:** It could incorrectly blend reviewed market confidence with the acknowledged approximate text match ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:64)).  
   **Fix:** Show the reviewed market claim classification and deterministic-match caveat separately; do not calculate project-level confidence.

5. **“Weakest evidence dimension” is not deterministic:** The plan defines how dimensions are populated but not their status values, severity order, or tie behavior ([PLAN.md](/private/tmp/lemon-intelligence-plan-review.M0ZKY6/PLAN.md:70)).  
   **Fix:** Give every dimension the same ordered status enum and display all dimensions tied for weakest.

VERDICT: REVISE

## Round 3 — Revision

- Split loading, authorization failure, network or data error, successful empty, and successful populated slate states.
- Replaced unexplained market-timing numbers with reviewed ordinal bands and visible intervals.
- Named the manifest and added one-byte tampering proof.
- Separated reviewed market classification from the approximate local match and eliminated project-level confidence.
- Standardized evidence dimension statuses and required all weakest ties to remain visible.

## Round 4 — Codex

All five Round 3 gaps are resolved:

- Slate loading, authorization, error, empty, and populated states are separated and tested.
- Market timing now uses a defined ordinal band with visible intervals.
- The manifest has an exact path, byte-level hashes, validation, and tampering test.
- Market classification and approximate project matching remain separate.
- Evidence dimensions have an ordered status enum with deterministic tie handling.

I found no remaining material security, privacy, schema, accessibility, observability, or decision-integrity blocker. The plan is sound enough to implement.

VERDICT: APPROVED

