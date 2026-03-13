# Domain Pitfalls

**Domain:** Screenplay analysis dashboard — adding partner sharing, export packages, film data APIs, and UX polish to existing React 19 + Firebase production app
**Researched:** 2026-03-13
**Confidence:** HIGH — grounded in actual codebase audit (firestore.rules, storage.rules, CONCERNS.md, INTEGRATIONS.md, ARCHITECTURE.md, ShareModal.tsx, api.ts, analysisStore.ts)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or security incidents in production.

---

### Pitfall 1: Sharing a Dashboard Link ≠ Sharing a Screenplay

**What goes wrong:** The existing `ShareModal` shares the current dashboard URL with filter state encoded in query params. A partner who receives this link sees the entire dashboard — 500+ screenplays, the settings icon, upload controls, and the DevExec AI chat. There is no concept of "this link shows only one screenplay's analysis to a read-only viewer."

**Why it happens:** The current URL-state-sync system (`useUrlState`) was designed for internal producer use. Extending it to partner sharing assumes partners should see the same full dashboard the producer sees, which they shouldn't.

**Consequences:**
- Partners can navigate to Settings, see API key configuration UI, attempt uploads
- A script sent to one partner is visible alongside all 499 other scripts if they explore
- The producer's notes and private annotations are exposed to everyone with the link
- No way to revoke or expire a shared link

**Prevention:**
- Partner sharing must use a separate Firestore collection (`shared_links/{token}`) with a subset snapshot of one screenplay's data, not a URL to the main dashboard
- The partner view must be a distinct read-only route (e.g., `/share/:token`) that renders a stripped-down component tree with no settings access
- Implement an expiry timestamp and revocation flag on each share token in Firestore
- The existing `ShareModal` should be rebuilt (or extended) to generate tokens, not share the dashboard URL

**Detection:**
- Any "share" implementation that passes `window.location.href` to the partner is almost certainly wrong for this use case
- Check whether `/settings` is accessible to someone who received a "share" link

**Phase:** Partner Sharing phase — must be architected correctly from the start, cannot be patched in later without a full rework.

---

### Pitfall 2: Firestore Rules Are Open and "Partner Sharing" Makes This Permanent

**What goes wrong:** `firestore.rules` currently has `allow read: if true` and `allow write: if [minimal field validation]` with a comment: "TODO before any public exposure: Enable Firebase App Check and switch to `if request.auth != null`." Once partner sharing links are handed out, the app crosses from "internal tool" to "externally exposed service." The open rules become a real risk.

**Why it happens:** The team is aware of this debt (it is documented in `firestore.rules` and CONCERNS.md) but treats it as low-priority because the app is internal. The moment a shareable link is sent to a partner, partners can — with a browser console — query all 500+ screenplays from Firestore, including private notes, scores, and analysis data for scripts that were never shared with them.

**Consequences:**
- Any partner receiving one share link can enumerate all `uploaded_analyses` documents
- The `screenplay_feedback` collection (producer notes) is also `allow read: if true` — private annotations are globally readable
- With `allow write: if [minimal validation]`, anyone knowing the collection structure can inject or overwrite screenplay documents
- Firebase Storage `allow read: if true` on `screenplays/{allPaths}` means anyone who guesses a storage path can download any screenplay PDF

**Prevention:**
- Before any partner share feature ships, Firestore rules must gate `uploaded_analyses` and `screenplay_feedback` behind App Check or a share-token validation
- Implement a per-token Firestore rule: the `/shared_links/{token}` document contains a `screenplayId`, the partner route reads only that one document and its referenced screenplay — rules enforce this path restriction
- Storage rules for screenplay PDFs should require a valid download token, not blanket public read
- App Check (reCAPTCHA v3) must be re-enabled before partner sharing goes live — see `src/lib/firebase.ts` where it is currently commented out after the config mismatch

**Detection:**
- Open a browser console on the deployed app, call `getDocs(collection(db, 'uploaded_analyses'))` — if it returns data without authentication, the rules are too permissive
- Any share flow that doesn't include a Firestore rules audit first is skipping this check

**Phase:** Security hardening must happen at the start of the Partner Sharing phase, before any link generation is built.

---

### Pitfall 3: Export Package Generates PDF Client-Side with the Full Screenplay PDF Embedded — Memory Explosion

**What goes wrong:** The existing PDF export uses `@react-pdf/renderer` client-side (see `src/components/export/PdfDocument.tsx`, 494 lines). An "export package" that bundles analysis summary + producer notes + the original screenplay PDF will attempt to concatenate PDFs client-side. A 120-page screenplay PDF is 5–15 MB. `@react-pdf/renderer` does not support merging existing PDFs — it only generates new ones from React components. To include the original screenplay, teams reach for client-side PDF merge libraries (pdf-lib, PDFMerger.js), which load the entire source PDF into a `ArrayBuffer` in browser memory.

**Why it happens:** The existing PDF export feels like a natural extension point. The temptation is to add the screenplay PDF as an attachment or merge it in. The memory cost is invisible until a user exports a multi-script package on a low-RAM device.

**Consequences:**
- On a 200-page screenplay at 15 MB, plus the generated analysis PDF, the browser tab requires 50–100 MB of working memory for the merge operation
- On iOS Safari (1–2 GB RAM limit for tabs) this crashes silently
- `@react-pdf/renderer` cannot stream — the entire output is materialized in memory before download
- A "batch export" of 5 screenplays × 120 pages each would reliably crash most browser sessions

**Prevention:**
- The export package must be generated server-side via a Firebase Cloud Function that assembles the PDF from Storage + Firestore data and returns a signed download URL
- The Cloud Function can use `pdf-lib` or `puppeteer` in a Node.js environment where memory is controlled and the result can be streamed to a Storage bucket
- The client initiates the export, polls or awaits the function response, then downloads from the returned Storage URL
- Never attempt client-side merge of two PDFs larger than a few pages

**Detection:**
- If export logic uses `getBlob()` on a Firebase Storage PDF reference and then passes it to a client-side merge operation, this is the trap
- Check `pdfParser.ts`: the existing `file.arrayBuffer()` pattern (entire file into memory) is already flagged in CONCERNS.md — any export that does the same for the output is double-loading

**Phase:** Export Package phase — architecture decision must be made upfront (Cloud Function vs. client-side); choosing client-side is the wrong path.

---

### Pitfall 4: Dual-Write Pattern Will Corrupt Shared Screenplay State

**What goes wrong:** `analysisStore.ts` writes to localStorage first, then Firestore asynchronously. If the Firestore write fails, the item is silently queued for retry. When a partner accesses a share link that references a Firestore document that was never successfully written (because the retry queue was never flushed), they see a 404 or empty data — but the producer's dashboard shows the screenplay fine (it's in localStorage).

**Why it happens:** The dual-write was designed for single-user internal use where localStorage is always the reliable read source. The moment a second reader (a partner) queries Firestore directly, the two sources diverge.

**Consequences:**
- Producer shares a link to a screenplay uploaded yesterday → partner opens it → gets "not found" because the Firestore write failed silently and the retry never ran
- Producer cannot reproduce the bug because their localStorage has the data
- The CONCERNS.md explicitly documents this: "User uploads 100 screenplays → localStorage saved, Firestore fails silently"
- Firestore is the only shared data source partners can read; localStorage is producer-only

**Prevention:**
- Before the Partner Sharing phase ships, the sync status UI from the Active requirements ("visible sync status, retry UI for failed Firestore writes") must be complete — it is a prerequisite, not a parallel track
- When generating a share token, verify the screenplay exists in Firestore before creating the token (not just in localStorage)
- Consider making Firestore the write-first source for shared screenplays: write to Firestore, await confirmation, then cache to localStorage — inverting the current pattern for shared documents

**Detection:**
- Warning sign: the share link generation reads from the React Query cache (which is populated from localStorage) but does not verify the Firestore document exists
- Any `addDoc`/`setDoc` call that does not `await` the result before confirming to the user that sharing is ready

**Phase:** Data Sync Reliability phase must complete before Partner Sharing phase. These are not independent tracks.

---

## Moderate Pitfalls

Mistakes that cause significant rework or user-visible failures but don't require full rewrites.

---

### Pitfall 5: Comparable Titles API Will Return Movies That Don't Match the Screenplay's Actual Tone

**What goes wrong:** Teams integrating TMDB or similar film APIs for "comparable titles" search by genre + budget bracket and return whatever the API ranks highest. A horror-comedy screenplay gets compared to "Get Out" (prestige thriller) and "The Shining" (classic horror) because genre strings match. The tone, budget reality, and commercial context are completely different, and the producer loses trust in the feature immediately.

**Why it happens:** Film database APIs (TMDB, OMDB) have genre tags but no tone, voice, or budget-feasibility metadata. Matching on genre alone is surface-level. The screenplay's own analysis JSON from Claude contains far richer signals (themes, subgenres, tone descriptors, CVS score, recommendation tier) that the API call ignores.

**Consequences:**
- Comparable titles feel random and useless after one bad recommendation
- Producer stops using the feature
- The feature required API integration effort and is now dead weight

**Prevention:**
- Use the existing V6 analysis data as the primary matching signal: pass the screenplay's themes, subgenres, tone, and budget tier to Claude (via the existing DevExec AI infrastructure) and ask Claude to generate comparable titles with rationale — this is more reliable than a raw film API query
- If using TMDB: filter by release year range (last 10 years), add a budget bucket filter (indie vs. studio), and use the screenplay's existing `genre` + `subgenres` + `themes` fields for the query — not a single genre string
- Show the rationale for each comparable title (why it matches), not just the title — this lets the producer calibrate trust

**Detection:**
- If the comparable titles query to TMDB uses only `genre` as the filter, it will produce low-quality results
- If there is no fallback to Claude-generated comparables when API results are poor, the feature has no quality floor

**Phase:** Comparable Titles / Dev Exec Insights phase.

---

### Pitfall 6: UX Polish Breaks the Glassmorphism Theme on Lower-End Devices

**What goes wrong:** The existing premium visual design uses CSS backdrop-filter (glassmorphism), mesh gradients, and `useScrollReveal` animations. Adding more transitions, loading skeletons, and entrance animations for UX polish stacks GPU compositing layers. On integrated GPU MacBooks and Windows laptops without discrete GPUs, the dashboard becomes visibly laggy — the very opposite of "polished."

**Why it happens:** Glass effects are expensive: `backdrop-filter: blur()` forces the browser to composite every element behind the glassy surface separately. Adding skeleton loading animations (typically CSS `@keyframes` on pseudo-elements) and page transition animations on top multiplies the compositing work. Developers test on M-series MacBooks where this is invisible.

**Consequences:**
- A partner receiving a share link opens it on a Dell laptop and sees a janky, slow UI — worse first impression than the current unpolished version
- The producer uses the dashboard on a work MacBook Pro (M3) and never sees the problem

**Prevention:**
- Audit each new animation with `will-change: transform` budget: no more than 3–4 simultaneously composited layers on any given screen state
- Use `@media (prefers-reduced-motion: reduce)` to disable all non-essential animations — this is also an accessibility requirement
- Loading skeletons should use CSS `opacity` transitions (cheap) rather than `background-position` shimmer animations (expensive on glassmorphism backgrounds)
- Test on a low-end device or throttle GPU in Chrome DevTools (Rendering → "Disable hardware acceleration") before shipping any animation pass

**Detection:**
- Chrome DevTools → Performance → record a filter interaction → look for "Recalculate Style" and "Paint" frames exceeding 16ms
- If `backdrop-filter` elements animate simultaneously with scrollReveal entrance effects, that is the expensive combination

**Phase:** UX Polish phase — apply this constraint upfront, not after complaints.

---

### Pitfall 7: Market Timing Insights Built on Static Data Will Be Stale by the Time They Ship

**What goes wrong:** Teams build a "market timing" feature by scraping a few genre trend articles at build time, baking the data into the app, and presenting it as current. Three months later the data is wrong and the producer cites the wrong trends in partner conversations. Alternatively, teams call a live external API (Box Office Mojo scrape, TMDB trending) on every page load, which is slow, fragile, and may violate terms of service.

**Why it happens:** There is no obvious authoritative real-time genre trend API. The temptation is to either hardcode findings or do ad-hoc scraping. Neither is sustainable.

**Consequences:**
- Producer makes a pitch citing "superhero fatigue is at peak" based on stale dashboard data
- The data contradicts what the partner just read in Variety
- Trust in the entire insights section erodes

**Prevention:**
- Frame market timing as Claude-generated analysis, not external data: pass the screenplay's genre/themes/budget tier to the DevExec AI and ask for a current market context assessment — Claude's training includes film market knowledge and the producer can prompt-tune the analysis
- If external data is needed, use TMDB's `/trending` and `/discover` endpoints to show recent films in the screenplay's genre, with release dates — this is factual and bounded (recent films in genre X), not interpretive (is genre X hot?)
- Be explicit in the UI that market timing is an AI assessment, not live market data
- Set a staleness date on any cached external data and show it to the user ("Based on trends as of [date]")

**Detection:**
- Any hardcoded string like "superhero films are saturated" or "A24-style prestige is trending" in the codebase is a red flag
- Market timing data without a visible source and date is untrustworthy

**Phase:** Dev Exec Insights / Market Timing phase.

---

### Pitfall 8: Rendering 500+ Cards with New Polish Animations Hits the React Render Budget

**What goes wrong:** Adding entrance animations (`useScrollReveal`) to screenplay cards is already in the codebase. Adding more polish — hover transitions, tag highlights, score bar animations — causes each of the 500+ rendered cards to have more work per render cycle. When the producer applies a filter that reduces from 500 to 50 cards, React re-renders all 500 (unmount 450, mount 50), and each animation triggers. The filter interaction feels sluggish.

**Why it happens:** The existing `useFilteredScreenplays` hook uses `useMemo` to prevent unnecessary recomputation, but `useMemo` only prevents the hook from re-running — React still reconciles all component tree changes. With 500 cards each having multiple animated children, reconciliation alone is expensive.

**Consequences:**
- Filter interactions that were acceptably fast become noticeably laggy after polish animations are added
- Performance degrades proportionally to screenplay count — at 1000 screenplays the problem is severe

**Prevention:**
- Before adding any new per-card animations, measure baseline render time with 500 cards in Chrome DevTools Profiler
- The grid should use `react-window` or `@tanstack/react-virtual` for virtual scrolling — only rendering ~20 cards visible in the viewport at a time, not all 500
- Animate only the visible viewport: `useScrollReveal` with `IntersectionObserver` already does this, but newly added hover transitions fire on all 500 mounted (but off-screen) cards
- Set a performance budget: filter interaction must complete within 100ms for 500 screenplays

**Detection:**
- Chrome DevTools → Performance → record a filter toggle → if "Commit" phase takes >50ms with 500 items visible, virtual scrolling is needed before adding more animation
- The CONCERNS.md already flags this: "FilterPanel Re-filters Large Dataset on Every Filter Change" and "Rendering 500+ cards"

**Phase:** UX Polish phase AND Performance at Scale phase — these must be addressed together, not sequentially.

---

## Minor Pitfalls

Issues that cause friction or debt but don't break features.

---

### Pitfall 9: Export Package PDF Filename Collisions

**What goes wrong:** Two screenplays with similar titles (e.g., "The House" and "The House Revisited") generate export packages with filenames that are too similar or identical after the same sanitization pass used in Storage paths. The user's Downloads folder contains two files named `the-house-package.pdf`, the second overwrites the first silently in some OS/browser combinations.

**Prevention:**
- Append the screenplay's Firestore document ID or a timestamp to every export filename: `the-house-2026-03-13-abc123.pdf`
- Use the same `sanitizedFilename` function already in the codebase but add the ID suffix before returning

**Phase:** Export Package phase.

---

### Pitfall 10: `isV6RawAnalysis()` False-Negative Deletes Shared Screenplay

**What goes wrong:** The `api.ts` data load pipeline removes any document that fails `isV6RawAnalysis()`. If a future analysis format (V7) or an edge-case V6 document with missing optional fields fails this type guard, the document is permanently deleted from Firestore — not just locally. A screenplay that has been shared with a partner now 404s.

**Why it happens:** The guard was designed for the migration from pre-V6 to V6. It is destructive: `await removeAnalysis(sourceFile)`. Any schema evolution that produces a document not matching the current guard silently deletes data.

**Prevention:**
- Move unrecognized documents to a quarantine collection (`_unrecognized_analyses`) rather than deleting them: `setDoc(quarantineRef, raw)` before calling `removeAnalysis()`
- This is already recommended in CONCERNS.md ("Rename deleted files — move to `_archived/{timestamp}` Firestore collection")
- Critical to implement before sharing: a false deletion of a shared screenplay is user-visible and trust-damaging

**Phase:** Data Sync Reliability phase (prerequisite for sharing).

---

### Pitfall 11: localStorage Quota Reached During Partner Link Metadata Storage

**What goes wrong:** Each generated share token will need some client-side state (which tokens the producer generated, their expiry, which screenplay they reference). If this metadata is stored in Zustand + localStorage (the existing pattern for all stores), it adds to the already-near-limit localStorage budget. CONCERNS.md documents that 500 screenplays already push toward the 5–10 MB localStorage ceiling.

**Prevention:**
- Share token metadata belongs in Firestore only, not localStorage — the producer's "my shares" list should be a Firestore query, not a localStorage key
- Do not create a new Zustand store with localStorage persistence for share state; use React Query to fetch the producer's share tokens from Firestore

**Phase:** Partner Sharing phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|-----------|
| Partner Sharing — link generation | Sharing dashboard URL instead of per-screenplay token | Architect as `/share/:token` route reading from `shared_links` Firestore collection before writing any code |
| Partner Sharing — security | Open Firestore rules (`allow read: if true`) expose all 500 screenplays to anyone with a share link | Firestore + App Check audit must precede this phase |
| Partner Sharing — data integrity | Screenplay not yet written to Firestore when share token is generated (dual-write lag) | Firestore-first write confirmation required before token creation |
| Export Package — architecture | Client-side PDF merge causes memory explosion on large screenplays | Decide Cloud Function vs. client-side before starting; Cloud Function is the right answer |
| Comparable Titles | Genre-only API query produces low-quality matches | Use V6 analysis fields (themes, subgenres, tone, CVS) as search signals; supplement or replace raw API with Claude-generated comparables |
| Market Timing | Hardcoded or stale trend data presented as current | Use Claude-generated assessment with visible date; show recent TMDB films in genre, not interpretive trend scores |
| UX Polish | Animation layering on glassmorphism backgrounds degrades GPU performance | Test on non-M-series hardware; use `prefers-reduced-motion`; cap compositing layers |
| Performance at Scale | Adding per-card animations with 500+ cards causes slow filter interactions | Virtual scrolling prerequisite; measure baseline before adding animations |
| Data Sync | `isV6RawAnalysis()` false-negative permanently deletes shared screenplay | Quarantine pattern instead of destructive delete; implement before sharing |

---

## Sources

- `firestore.rules` — actual security rule analysis (rules are `allow read: if true` on all collections, confirmed HIGH confidence)
- `storage.rules` — confirmed `allow read: if true` on all paths (HIGH confidence)
- `.planning/codebase/CONCERNS.md` — codebase audit: dual-write risks, localStorage quota, `isV6RawAnalysis` deletion pattern, large-file memory issues, all documented (HIGH confidence)
- `.planning/codebase/ARCHITECTURE.md` — data flow, state management patterns, error handling strategy (HIGH confidence)
- `.planning/codebase/INTEGRATIONS.md` — API keys in localStorage, Firebase config, Anthropic direct-browser-access pattern (HIGH confidence)
- `src/components/share/ShareModal.tsx` — confirmed existing share implementation sends dashboard URL, not per-screenplay token (HIGH confidence)
- `src/lib/api.ts` — confirmed destructive `removeAnalysis()` on failed `isV6RawAnalysis()` check (HIGH confidence)
- `.planning/PROJECT.md` — active requirements, constraints, known dual-write concern (HIGH confidence)
