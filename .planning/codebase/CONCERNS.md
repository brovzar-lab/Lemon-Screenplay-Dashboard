# Codebase Concerns

**Analysis Date:** 2026-03-13

## Security Considerations

### API Keys in localStorage

**Risk:** Anthropic and Google API keys are stored in plain text in browser localStorage. Any XSS vulnerability exposes keys to attackers.

**Files:** `src/stores/apiConfigStore.ts` (lines 54-160), `src/components/settings/ApiConfigPanel.tsx`

**Current mitigation:**
- Keys never exposed via environment variables in production bundle
- User-entered only, never auto-detected from VITE_ vars
- Migration logic prevents stale `isConfigured: false` blocking access

**Recommendations:**
- Implement server-side API proxy for all API calls (eliminate client-side keys entirely)
- Add Content Security Policy (CSP) headers to prevent inline script execution
- Rotate API keys regularly and implement key rollover mechanism
- Monitor usage patterns for anomalies

### Firebase Security Rules are Open

**Risk:** Firestore rules require authentication for public deployment (rules state "TODO before any public exposure").

**Files:** `firestore.rules` (lines 1-83)

**Current state:**
```
allow read: if true;
allow write: if [minimal field validation]
```

**Recommendations:**
- Enable Firebase App Check with reCAPTCHA v3 (App Check was disabled due to config mismatch — see below)
- Switch all `allow read/write: if true` to `if request.auth != null`
- Implement user-specific document access controls (user ID in document path)
- Add rate limiting rules to prevent abuse

### Disabled Firebase App Check

**Issue:** App Check (reCAPTCHA v3) was disabled after 400 errors blocked ALL Firebase operations (Firestore sync + Storage reads/writes).

**Files:** `src/lib/firebase.ts` (lines 1-33)

**Root cause:** Provider type registered in Firebase Console didn't match client SDK configuration.

**Impact:**
- Currently unprotected against bot attacks
- DDoS vulnerability on Firestore reads/writes
- Storage upload endpoint accessible without verification

**Fix approach:**
1. Verify Firebase Console → App Check → Apps shows correct provider type
2. Re-enable App Check initialization in firebase.ts
3. Test with dev key before production deployment
4. Add retry logic for 400 errors (currently fails hard)

---

## Tech Debt

### Large Files (500+ lines) — Complexity Risk

**Files with high complexity:**

- `src/components/settings/UploadPanel.tsx` (745 lines) — Upload orchestration + model selection + queue management + budget tracking
- `src/components/settings/PdfUploadPanel.tsx` (682 lines) — PDF matching + drag-drop + batch scanning + Firebase sync
- `src/lib/normalize.ts` (589 lines) — V3/V4/V5/V6 data shape conversions with fallbacks
- `src/lib/analysisService.ts` (507 lines) — PDF parsing + Anthropic API + Cloud Function routing + error handling
- `src/components/export/PdfDocument.tsx` (494 lines) — PDF generation with 14+ sections, layout calculations

**Impact:** High cognitive load, difficult to test in isolation, harder to debug

**Safe modification approach:**
- Extract helper functions to separate files (e.g., `useUploadQueue.ts` from UploadPanel)
- Split by responsibility (e.g., batch operations in separate file from UI)
- Add integration tests before refactoring

**Minimal refactor (low risk):**
1. Extract `MODEL_OPTIONS` constant array → separate file
2. Extract upload status helpers → separate file
3. Extract batch delete logic → separate file

### Dual-Write Pattern with Eventual Consistency Issues

**Issue:** `analysisStore.ts` writes to localStorage (instant) then Firestore (async). Network failures or quota limits can cause divergence.

**Files:** `src/lib/analysisStore.ts` (lines 1-400), `src/stores/uploadStore.ts`

**Current approach:**
- Primary read from localStorage (instant)
- Async write to Firestore
- Retry queue on failure (`PENDING_QUEUE_KEY`)

**Problems:**
1. User uploads 100 screenplays → localStorage saved, Firestore fails silently
2. User refreshes → local data appears, but only some written to Firestore
3. Different browser/device sees incomplete dataset
4. Sync logic triggers background migration that may overwrite correct data

**Risk level:** Medium — Data loss possible if Firestore quota exceeded or network permanently fails

**Improvement path:**
1. Add explicit sync status UI (show how many items pending Firestore write)
2. Implement polling check: every 30s retry failed writes, show count
3. Add "force sync" button if user suspects data loss
4. Log all write failures to localStorage with timestamp for debugging
5. Consider: Write to Firestore first, use as single source of truth

### JSON.parse() Without Error Handling in Critical Paths

**Risk:** Unprotected JSON.parse can crash app if localStorage data corrupted.

**Files affected:**
- `src/lib/analysisStore.ts` (lines 53, 66, 79) — try-catch present, returns []
- `src/contexts/DevExecContext.tsx` (line 46) — NO try-catch
- `src/hooks/useCategories.ts` (line 30) — NO try-catch
- `src/components/settings/CategoryManagement.tsx` (line 35) — NO try-catch

**Current state:** Most locations have error boundaries, but DevExec and Category management don't.

**Fix:** Wrap all JSON.parse calls in try-catch, return sensible defaults:
```typescript
const stored = localStorage.getItem(STORAGE_KEY);
let data = DEFAULT_VALUE;
try {
  if (stored) data = JSON.parse(stored);
} catch (err) {
  console.warn('Corrupted storage, using defaults:', err);
}
```

### State Persistence Migration Risk

**Issue:** `apiConfigStore.ts` has a `migrate` function that runs on every load.

**Files:** `src/stores/apiConfigStore.ts` (lines 136-150)

**Logic:**
- v0 (old schema) detected → recompute `isConfigured` flag
- No version check — assumes any persisted state is old

**Risk:**
- If schema changes again, migration logic could silently corrupt new data
- No versioning means unknown data format causes subtle bugs

**Recommendation:**
- Add explicit version field to persisted state
- Use version-based migration (v0 → v1 → v2 path)
- Log migration attempts for debugging

### PDF Parser Synchronous Processing — Memory Spike on Large Files

**Issue:** `pdfParser.ts` loads entire PDF into memory, processes sequentially, truncates at 150K chars.

**Files:** `src/lib/pdfParser.ts`

**Current behavior:**
```typescript
const arrayBuffer = await file.arrayBuffer();  // ← Entire file in memory
const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
for (let i = 1; i <= pageCount; i++) {
  const page = await pdf.getPage(i);          // Sequential page reads
}
```

**Problems:**
- 500 MB PDF = 500 MB memory spike
- Sequential processing = slow on 1000+ page documents
- No streaming or chunking capability

**Impact:** Medium — Most screenplays <10 MB, but edge case could crash browser tab

**Improvement path:**
1. Add file size check before parsing (warn if >100 MB)
2. Implement streaming page parsing (don't load all into memory)
3. Process pages in parallel batches (not sequential)
4. Add memory usage telemetry

---

## Data Validation Gaps

### Type Safety: Loose Screenplay Normalization

**Issue:** `normalize.ts` converts V3/V4/V5/V6 raw JSON to Screenplay type, but some fields are optional with implicit defaults.

**Files:** `src/lib/normalize.ts`, `src/types/screenplay.ts`, `src/types/screenplay-v6.ts`

**Risk scenarios:**
1. Missing `recommendation` field → normalizes to undefined → Grid renders nothing
2. Missing `weighted_score` → normalizes to NaN → Charts break
3. Missing dimensions → uses 0, which looks like "intentional 0 score"

**Current pattern:**
```typescript
recommendation: normalizeRecommendation(raw.recommendation) || 'pass',  // Fallback
weightedScore: toNumber(raw.weighted_score) || 0,                      // Silent 0
```

**Safer approach:**
```typescript
// Explicit validation with detailed error logging
if (!raw.recommendation) {
  console.warn(`Screenplay missing recommendation: ${raw.source_file}`);
  errors.push({ field: 'recommendation', reason: 'missing' });
}
```

### Collection Type Coupling

**Issue:** `screenplay.ts` defines `type Collection = 'V6 Analysis'` but `normalize.ts` maps user-entered strings to collection names. Coupling is loose.

**Files:** `src/types/screenplay.ts` (line 11), `src/lib/normalize.ts` (lines 35-60)

**Risk:**
- New collections (e.g., "2025 Black List") need type update AND normalization function update
- Easy to miss synchronization

**Recommendation:**
- Move collection mapping to single source of truth (e.g., `lib/collectionMap.ts`)
- Generate type from map: `type Collection = keyof typeof COLLECTION_MAP`

---

## Performance Bottlenecks

### FilterPanel Re-filters Large Dataset on Every Filter Change

**Issue:** `useFilteredScreenplays.ts` runs `passesFilters()` on entire dataset for every state change.

**Files:** `src/hooks/useFilteredScreenplays.ts` (lines 34-200)

**Current approach:**
```typescript
export const useFilteredScreenplays = (screenplays: Screenplay[]) => {
  return useMemo(() => {
    return screenplays.filter(sp => passesFilters(sp, filters))
      .sort(...)
  }, [screenplays, filters, sort])
};
```

**Scaling issue:**
- 10K screenplays: ~10K filter checks per state change
- Genre filter alone does 3 normalization calls per screenplay

**Optimization path:**
1. Add test to verify current filtering performance (baseline)
2. Memoize `passesFilters` results by screenplay ID
3. Incrementally filter (apply quick filters first, expensive ones last)
4. Consider virtual scrolling for grid (only render visible cards)

### Charts Recompute on Every Screenplay Change

**Files:** `src/components/charts/AnalyticsDashboard.tsx`, `src/components/charts/GenreChart.tsx`, etc.

**Risk:**
- Recharts re-renders entire chart on data change
- Genre chart aggregates 10K screenplays every render

**Improvement:** Add `key` prop based on filtered data hash, prevent unnecessary re-renders.

### Batch Scanning Timeout on Large Collections

**Issue:** `PdfUploadPanel.ts` scans PDF existence in batches of 5 with small delays, but no timeout per batch.

**Files:** `src/components/settings/PdfUploadPanel.tsx` (lines 150-185)

**Risk:**
- 1000 screenplays = 200 batches × ~5 seconds each = 15+ minutes
- User could close browser mid-scan, leaving storage in unknown state

**Recommendation:**
- Add per-batch timeout (3 seconds max)
- Show progress bar with ETA
- Allow cancellation mid-scan
- Resume capability on reload

---

## Fragile Areas

### PDF Upload Matching Algorithm — False Positives

**Issue:** `buildStoragePath` and `matchScore` normalize filenames, but mismatch is subtle.

**Files:** `src/components/settings/PdfUploadPanel.tsx` (lines 40-74)

**Logic:**
```typescript
const normalize = (s) => s.toLowerCase()
  .replace(/\.pdf$/i, '')
  .replace(/[_\s-]+/g, ' ')     // Convert all separators to space
  .trim();

// Matches if: title includes dropped OR dropped includes title
if (title.includes(dropped) || dropped.includes(title)) return 80;
```

**Fragile case:**
- Screenplay title: "The Big Event"
- Dropped file: "The Big Event Revised Draft.pdf"
- Matches? NO — "the big event" vs "the big event revised draft" (second doesn't include first)
- User thinks file uploaded but it's stored under different path

**Safe modification:**
- Add test cases for filename matching (20+ examples)
- Show user which screenplay it's uploading to (before confirming)
- Implement fuzzy matching (Levenshtein distance)

### Firestore Write Failure Silent Degradation

**Issue:** If Firestore write fails, item is queued for retry, but user sees "Complete" status.

**Files:** `src/lib/analysisStore.ts` (lines 200-220)

**Code:**
```typescript
try {
  await setDoc(docRef, {...});
  console.log(`Analysis saved to Firestore: ${docId}`);
} catch (err) {
  queueForRetry(raw);  // ← Silent queue, no user notification
  console.error(`Firestore write failed for ${docId}, queuing for retry:`, err);
}
```

**Result:** User thinks upload is done, closes browser, data stuck in localStorage forever if retry never succeeds.

**Fix:**
- Add "pending sync" indicator next to completed uploads
- Show count: "3 uploads syncing to server"
- Add manual "retry sync now" button

### Analysis Version Mismatch During Migration

**Issue:** `api.ts` loads both V6 (new) and pre-V6 (old) analyses, removes pre-V6. If new analysis format is detected as old, it's deleted.

**Files:** `src/lib/api.ts` (lines 60-80)

**Code:**
```typescript
if (isV6RawAnalysis(raw)) {
  // ✅ Recognized, keep it
} else {
  // ❌ Unknown format, delete it
  console.warn('[Lemon] Removing pre-V6 uploaded analysis:', sourceFile);
  await removeAnalysis(sourceFile);  // ← DESTRUCTIVE
}
```

**Risk:** If `isV6RawAnalysis()` has a bug, valid data is permanently deleted.

**Safe modification:**
1. Rename deleted files (don't permanently remove) — move to `_archived/{timestamp}` Firestore collection
2. Add restore button in Data Management
3. Test `isV6RawAnalysis()` with actual pre-V6 and V6 samples

---

## Test Coverage Gaps

### No Tests for Data Migration Flow

**What's not tested:**
- Static files → Firestore migration
- localStorage → Firestore sync on app load
- Firestore → localStorage fallback on network failure
- Duplicate detection (title-based dedup in api.ts)

**Files:** `src/lib/api.ts`, `src/lib/analysisStore.ts`

**Risk:** Medium — Silent data loss if dedup logic breaks.

**Add tests for:**
1. Load 100 analyses from static files + 50 from Firestore → deduplicate correctly
2. Corrupted localStorage entry → skip, log error, continue
3. Firestore offline → use localStorage only
4. Network returns online → re-sync pending writes

### Limited Error Path Testing

**What's tested:** Happy paths (successful analysis, successful upload)

**What's NOT tested:**
- API rate limit error (429)
- Quota exceeded error (Firebase)
- Malformed JSON response from Claude
- PDF file corruption (unreadable PDF)
- Timeout handling (>60s analysis)

**Files:** `src/lib/analysisService.ts` (error handling lines 110, 176, 210, 225)

**Add tests:**
```typescript
it('handles Anthropic 429 rate limit', async () => { /* */ });
it('handles Firestore quota exceeded', async () => { /* */ });
it('handles truncated PDF response', async () => { /* */ });
it('recovers from analysis timeout', async () => { /* */ });
```

### No Tests for Large Dataset Performance

**What's not tested:**
- Filtering 10K screenplays (performance baseline)
- Rendering 500+ cards in grid (scroll performance)
- Exporting 1000 screenplays to CSV/PDF (memory usage)

**Files:** `src/hooks/useFilteredScreenplays.test.ts`, `src/components/screenplay/ScreenplayGrid.tsx`

**Recommendation:**
- Add benchmark tests with mock data (1K, 10K screenplays)
- Track filter time, render time, memory usage
- Set performance budgets (filter <100ms, render <16ms)

---

## Scaling Limits

### localStorage Quota (5-10 MB) — Approaching Limit

**Current usage:**
- 10K screenplays × ~2-3 KB per analysis = 20-30 MB needed

**Problem:** localStorage limit is 5-10 MB per domain on most browsers.

**Files:** `src/lib/analysisStore.ts`, `src/stores/uploadStore.ts`

**Current state:**
- Dual-write to localStorage + Firestore as fallback
- If localStorage is full, new writes silently fail
- App becomes unusable without Firestore sync

**Scaling path:**
1. Migrate fully to Firestore (remove localStorage dependency)
2. Keep localStorage only for frequently-accessed (recent 100 screenplays)
3. Add cache invalidation logic (old data expires after 30 days)
4. Implement IndexedDB instead (100+ MB capacity)

### Anthropic API Cost Scaling

**Issue:** Large batches (100+ screenplays) at Sonnet/Opus pricing = $20-90 per batch.

**Files:** `src/components/settings/UploadPanel.tsx` (MODEL_COSTS, cost estimation)

**Risk:** User could accidentally upload 1000 screenplays at Opus = $900+ cost.

**Current mitigation:** Shows estimated cost before upload, but no hard limits.

**Recommendations:**
1. Add daily spend limit enforcement (block uploads if exceeded)
2. Require confirmation for uploads >$10
3. Show running month-to-date spend in Settings
4. Implement cost alert at 75% of budget

---

## Known Issues

### App Check 400 Error Disabled (Temporary)

**Status:** Disabled as of v6.8.21

**Issue:** App Check reCAPTCHA v3 provider in Firebase Console didn't match SDK configuration.

**Workaround:** Disabled App Check, leaving Firestore open.

**Tracking:** Check Firebase Console → App Check → Apps to verify correct provider registered.

**Timeline:** Re-enable after verifying provider match (low priority, current open rules are acceptable for internal tool).

---

## Dependencies at Risk

### pdfjs-dist — Large Bundle Size

**Risk:** PDF.js adds ~500 KB to bundle (gzipped ~150 KB).

**Impact:**
- All users pay bundle cost even if they never upload PDFs
- Tree-shaking doesn't help (full library needed for parsing)

**Alternative consideration:**
- PyPDF2 / pdfplumber server-side (move to Cloud Function)
- Reduces client bundle, offloads processing

**Current approach is reasonable:** Keep client-side parsing for offline capability.

### Recharts — Limited Customization

**Issue:** Custom chart styling requires CSS workarounds (e.g., setting text color on SVG elements).

**Files:** `src/components/charts/*.tsx`

**Risk:** Low — Charts render correctly, just fragile to style updates.

### Firebase SDK Version Lock

**Risk:** Firebase SDK updates occasionally break authentication flows.

**Mitigation:** Pin to specific version in package.json, test before updating.

---

## Missing Critical Features

### No Undo/Redo for Data Operations

**What's missing:**
- Delete screenplay → undelete (currently permanent)
- Change feedback → history (no audit trail)
- Bulk delete → rollback

**Impact:** User accidentally deletes 50 screenplays → data loss, manual recovery needed.

**Low-effort improvement:**
- Add soft delete (mark as deleted, restore within 30 days)
- Keep changelog in Firestore (timestamp + operation + user)

### No Offline-First Capability

**Current behavior:**
- App is read-only offline (screenplays cached from last session)
- Cannot upload, cannot save feedback offline

**Impact:** User on flight cannot add notes to screenplay.

**Improvement (medium effort):**
- IndexedDB sync queue for notes + feedback
- Sync when connection returns
- Show "offline mode" indicator

---

## Recommendations by Priority

### CRITICAL (Fix before production use)

1. **Re-enable Firebase App Check** — Verify provider configuration, re-enable reCAPTCHA v3 (blocks bot attacks)
2. **Add Firestore read/write authentication** — Switch from `if true` to `if request.auth != null`
3. **Implement server-side API proxy** — Remove client-side API keys from localStorage

### HIGH (Next release)

1. **Implement data sync status UI** — Show pending Firestore writes, allow manual retry
2. **Add JSON.parse error handling** — Wrap all calls in try-catch with defaults
3. **Implement soft delete** — 30-day recovery window for deleted screenplays
4. **Add performance benchmarks** — Track filter time, render time with 1K/10K datasets

### MEDIUM (Plan for post-launch)

1. **Migrate fully to Firestore** — Remove localStorage dependency (hit 5-10 MB limit)
2. **Implement fuzzy filename matching** — Reduce false negatives in PDF upload
3. **Add version-based state migration** — Explicit schema versioning for localStorage
4. **Batch processing improvements** — Progress UI, cancellation, timeout handling

### LOW (Nice-to-have)

1. **Refactor large files** — Extract helpers from UploadPanel, PdfUploadPanel
2. **Implement offline-first** — IndexedDB sync queue for notes
3. **Optimize filter performance** — Memoization, incremental filtering for 10K+ datasets

---

*Concerns audit: 2026-03-13*
