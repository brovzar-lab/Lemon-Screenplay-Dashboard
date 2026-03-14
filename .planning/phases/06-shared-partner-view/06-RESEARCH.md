# Phase 6: Shared Partner View - Research

**Researched:** 2026-03-14
**Domain:** React lazy-loaded route, Firestore public read, standalone read-only view
**Confidence:** HIGH

## Summary

Phase 6 builds a standalone `/share/:token` page that partners open via a shared link. The page resolves the token from the `shared_views` Firestore collection (publicly readable -- no auth required), displays full screenplay analysis data, and handles expired/invalid tokens gracefully. The route must be lazy-loaded to exclude all dashboard bundle code.

The critical architectural decision is the **data access strategy**. The `shared_views` doc currently stores only `token`, `screenplayId`, `screenplayTitle`, `includeNotes`, and `createdAt`. The actual analysis data lives in `uploaded_analyses` (requires auth) and notes live in `notesStore` (localStorage -- inaccessible to partners). The shared view must embed/snapshot all necessary data into the `shared_views` document at token creation time, because the partner has no auth session and no localStorage context.

**Primary recommendation:** Extend `createShareToken()` in `shareService.ts` to snapshot the full analysis data (and optionally notes) into the `shared_views` Firestore document. The shared view reads only from `shared_views` -- no auth, no additional Firestore reads, no anonymous sign-in for partners.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Standalone page** -- purpose-built, not a modal. No dashboard frame, header, or navigation
- **Full analysis** shown: logline, synopsis, all dimension scores, strengths, weaknesses, recommendation, and producer notes (if `includeNotes` is true)
- **Same premium gold/black theme** as the dashboard -- consistent Lemon Studios branding
- **AI-generated poster** shown as visual header if one exists
- **Download Script button** -- links directly to Firebase Storage URL (already publicly readable)
- Read-only -- no editing, no navigation to other screenplays, no settings access
- **Subtle Lemon Studios branding** -- small logo in header/footer, professional but not overbearing
- **No AI attribution** -- don't mention the analysis is AI-generated
- **No producer name** -- no "Shared by [name]"
- **Branded error page** for invalid/expired tokens -- "This link is no longer available"

### Claude's Discretion
- Page layout structure (single column vs sidebar, section ordering)
- Score visualization (reuse existing ScoreBar or simplified display)
- Loading state design while fetching from Firestore
- Whether to lazy-load the `/share/:token` route (ROADMAP says yes)
- Poster image sizing and placement

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHARE-02 | Partner can open a share link and see a read-only view with analysis, scores, and producer notes | Data snapshot strategy, SharedViewPage component, resolveShareToken function |
| SHARE-03 | Partner can download the screenplay PDF from the shared view | pdfUrl field in shared_views doc, direct Firebase Storage link |
| SHARE-04 | Shared view is clean and standalone (no dashboard chrome, no settings access) | React.lazy route isolation, no Header/FilterBar/ComparisonBar imports |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI rendering | Project standard |
| React Router | 7 | `/share/:token` route with `useParams` | Already used for `/` and `/settings` |
| Firebase Firestore | (project ver) | Read `shared_views` doc by token ID | Public read rule already in place |
| TypeScript | strict | Type safety | Project convention |
| Tailwind CSS | 4 | Styling (gold/black theme) | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | (project ver) | Conditional class names | Reuse from existing components |

### Reusable Components (NO new dependencies)
| Component | Path | Reuse Strategy |
|-----------|------|----------------|
| ScoreBar | `src/components/ui/ScoreBar.tsx` | Import directly -- works with score/max/label props |
| RecommendationBadge | `src/components/ui/RecommendationBadge.tsx` | Import directly -- works with tier prop |
| LoadingFallback | `src/components/ui/LoadingFallback.tsx` | Use for Suspense boundary |
| ErrorBoundary | `src/components/ui/ErrorBoundary.tsx` | Wrap shared view route |

**Installation:** No new packages needed. Everything is already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── pages/
│   └── SharedViewPage.tsx          # Lazy-loaded page component (Route entry)
├── components/
│   └── share/
│       ├── SharedViewLayout.tsx     # Full page layout (branding, sections)
│       ├── SharedScoresPanel.tsx    # Dimension scores + CVS (read-only)
│       ├── SharedContentDetails.tsx # Strengths, weaknesses, synopsis
│       └── index.ts                # Barrel export
├── lib/
│   └── shareService.ts             # Add resolveShareToken() + snapshot logic
```

### Pattern 1: Lazy-Loaded Isolated Route
**What:** The `/share/:token` route is registered in `main.tsx` with `React.lazy()`, exactly like the existing SettingsPage pattern.
**When to use:** Always -- this is a hard requirement (SHARE-04).
**Example:**
```typescript
// Source: Existing pattern in src/main.tsx
const SharedViewPage = lazy(() => import('./pages/SharedViewPage'));

// In Routes:
<Route path="/share/:token" element={<SharedViewPage />} />
```

**Key insight:** The route MUST be in `main.tsx`, NOT inside `App.tsx`. App.tsx is the dashboard shell (Header, FilterBar, ComparisonBar, DevExecProvider). The shared view must bypass all of that. The existing routing in `main.tsx` already shows this pattern -- `SettingsPage` and `App` are sibling routes.

### Pattern 2: Data Snapshot at Token Creation
**What:** When `createShareToken()` is called, it snapshots the screenplay analysis data into the `shared_views` document. The shared view reads ONLY from this single document.
**When to use:** Always -- partners have no auth and cannot read `uploaded_analyses`.
**Why:**
- `uploaded_analyses` requires `request.auth != null` (Firestore rules)
- `screenplay_feedback` requires `request.auth != null`
- `notesStore` is localStorage (browser-specific, not available to partner)
- Adding anonymous auth for partners adds complexity and security surface area

**Snapshot data shape:**
```typescript
interface SharedViewDocument {
  // Existing fields
  token: string;
  screenplayId: string;
  screenplayTitle: string;
  includeNotes: boolean;
  createdAt: string;

  // New snapshot fields
  pdfUrl: string | null;          // Firebase Storage URL for PDF download
  posterUrl: string | null;       // AI-generated poster URL
  analysis: {                     // Snapshot of analysis data
    title: string;
    author: string;
    genre: string;
    subgenres: string[];
    logline: string;
    tone: string;
    recommendation: RecommendationTier;
    recommendationRationale: string;
    verdictStatement: string;
    isFilmNow: boolean;
    weightedScore: number;
    cvsTotal: number;
    dimensionScores: DimensionScores;
    dimensionJustifications: DimensionJustifications;
    commercialViability: CommercialViability;
    strengths: string[];
    weaknesses: string[];
    majorWeaknesses: string[];
    developmentNotes: string[];
    characters: Characters;
    comparableFilms: ComparableFilm[];
    standoutScenes: StandoutScene[];
    targetAudience: TargetAudience;
    budgetCategory: BudgetCategory;
    budgetJustification: string;
    marketability: Marketability;
  };
  notes?: Array<{                 // Snapshotted if includeNotes=true
    content: string;
    createdAt: string;
  }>;
}
```

**Firestore document size:** A single screenplay analysis snapshot is roughly 5-15KB of JSON. Firestore's max document size is 1MB. This is well within limits.

### Pattern 3: Token Resolution
**What:** `resolveShareToken(token)` reads a single Firestore document by ID (the token IS the document ID).
**When to use:** SharedViewPage on mount.
**Example:**
```typescript
// Source: Existing shareService.ts pattern
export async function resolveShareToken(token: string): Promise<SharedViewDocument | null> {
  // NO authReady gate -- this is a public read
  const docRef = doc(db, 'shared_views', token);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return snapshot.data() as SharedViewDocument;
}
```

**Critical:** This function must NOT call `await authReady`. The partner does not have an auth session. The `shared_views` collection has `allow read: if true` in Firestore rules, so no auth is needed.

### Pattern 4: Firebase Init Without Auth for Share Route
**What:** The shared view imports `db` from `firebase.ts` but must not trigger anonymous sign-in.
**When to use:** Always for the share route.
**Risk:** Currently `firebase.ts` calls `signInAnonymously()` at module level via the `authReady` promise. This runs on import. Since the shared view only needs Firestore reads on a public collection, the anonymous auth call is unnecessary but harmless (it just creates an anonymous session the partner never uses).
**Mitigation:** No change needed to `firebase.ts`. The `authReady` promise runs but `resolveShareToken()` does not await it. The Firestore read succeeds because `shared_views` has `allow read: if true`.

### Anti-Patterns to Avoid
- **Importing dashboard components:** Never import Header, FilterBar, ComparisonBar, DevExecChat, or any Zustand store that pulls in dashboard dependencies. This breaks bundle isolation.
- **Using `authReady` in the share view:** The partner has no auth context. Never gate share view reads on `authReady`.
- **Reading from `uploaded_analyses` or `screenplay_feedback`:** These require auth. All data must come from the `shared_views` snapshot.
- **Using `notesStore`:** This is localStorage-based. The partner's browser has no data. Notes must be snapshotted into the share doc.
- **Adding React Query for the share view:** A single `getDoc()` call is simpler than spinning up React Query for one read. Use a local `useEffect` + `useState` pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Score visualization | Custom score bars | Existing `ScoreBar` component | Already handles color gradients, labels, all score ranges |
| Recommendation badge | Custom tier badges | Existing `RecommendationBadge` | Already handles all 4 tiers with correct styling |
| Loading spinner | Custom spinner | Existing `LoadingFallback` | Branded gold spinner already built |
| Route code splitting | Manual dynamic import | `React.lazy()` + Suspense | Established project pattern |

**Key insight:** The shared view can and should reuse UI primitives from `src/components/ui/`. These are small, self-contained components with no dashboard state dependencies. The shared view should NOT reuse `ScoresPanel`, `ContentDetails`, etc. from the modal -- those are tightly coupled to the `Screenplay` type and modal context.

## Common Pitfalls

### Pitfall 1: Importing Dashboard Bundles
**What goes wrong:** Importing a component that transitively imports a Zustand store, which imports React Query, which pulls the entire dashboard into the share bundle.
**Why it happens:** Components like `ScoresPanel` import from stores, hooks, and other components that form a dependency chain.
**How to avoid:** The shared view components must only import from: `@/types`, `@/components/ui/*` (ScoreBar, RecommendationBadge), `@/lib/calculations` (score color helpers), `@/lib/utils` (toNumber), and `clsx`. Nothing from `@/stores/`, `@/hooks/`, `@/components/screenplay/`, `@/components/layout/`, `@/components/charts/`, `@/components/comparison/`.
**Warning signs:** Build output shows the share chunk exceeding 50KB.

### Pitfall 2: Auth Gating on Public Route
**What goes wrong:** `resolveShareToken()` awaits `authReady`, which triggers `signInAnonymously()`. This works but is unnecessary and adds latency.
**Why it happens:** Copy-pasting from existing shareService functions that all gate on `authReady`.
**How to avoid:** The new `resolveShareToken()` function must NOT await `authReady`. It reads directly from Firestore using the public rule.

### Pitfall 3: Missing Data in Snapshot
**What goes wrong:** The share view shows empty sections because `createShareToken()` didn't snapshot certain fields (e.g., `dimensionJustifications`, `comparableFilms`).
**Why it happens:** The snapshot was built from an incomplete field list.
**How to avoid:** Define a clear `SharedViewDocument` type. Ensure `createShareToken()` maps ALL fields the view needs. Test with real data.

### Pitfall 4: Notes Handling When includeNotes=false
**What goes wrong:** Notes section renders empty/broken when notes were not included.
**Why it happens:** Component doesn't check `includeNotes` flag or `notes` field existence.
**How to avoid:** Conditionally render notes section only when `includeNotes === true && notes?.length > 0`.

### Pitfall 5: Firebase SPA Routing for /share/:token
**What goes wrong:** Direct navigation to `/share/:token` returns a 404 from Firebase Hosting.
**Why it happens:** Firebase Hosting serves static files. Without rewrite rules, `/share/abc-123` tries to find a literal file.
**How to avoid:** The project's `firebase.json` must have the SPA rewrite rule: `{ "source": "**", "destination": "/index.html" }`. **This is almost certainly already configured** since the app uses React Router with `/settings`. Verify in `firebase.json`.

### Pitfall 6: Snapshot Staleness
**What goes wrong:** Producer updates the analysis after sharing, but the partner sees old data.
**Why it happens:** Snapshot is taken at share creation time and never updated.
**How to avoid:** This is acceptable behavior for v1. The producer can revoke and re-share to update. Document this as a known limitation, not a bug.

## Code Examples

### Route Registration (main.tsx)
```typescript
// Source: Existing pattern in src/main.tsx
const SharedViewPage = lazy(() => import('./pages/SharedViewPage'));

// Inside Routes:
<Route path="/share/:token" element={
  <ErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
      <SharedViewPage />
    </Suspense>
  </ErrorBoundary>
} />
```

### Token Resolution (shareService.ts)
```typescript
// Source: Pattern from existing getDoc calls in shareService.ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function resolveShareToken(token: string): Promise<SharedViewDocument | null> {
  const docRef = doc(db, 'shared_views', token);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return snapshot.data() as SharedViewDocument;
}
```

### SharedViewPage State Machine
```typescript
// Source: Standard React pattern for async data loading
type ViewState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'ready'; data: SharedViewDocument };

function SharedViewPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'not_found' });
      return;
    }
    resolveShareToken(token).then((doc) => {
      setState(doc ? { status: 'ready', data: doc } : { status: 'not_found' });
    }).catch(() => {
      setState({ status: 'not_found' });
    });
  }, [token]);

  if (state.status === 'loading') return <LoadingFallback />;
  if (state.status === 'not_found') return <ExpiredLinkPage />;
  return <SharedViewLayout data={state.data} />;
}
```

### Extending createShareToken for Snapshot
```typescript
// Source: Extended from existing createShareToken in shareService.ts
export async function createShareToken(
  screenplayId: string,
  screenplay: Screenplay,  // Pass full screenplay object
  includeNotes: boolean,
  notes?: Array<{ content: string; createdAt: string }>,
): Promise<{ token: string; url: string }> {
  await authReady;
  const token = crypto.randomUUID();

  const sharedView = {
    token,
    screenplayId,
    screenplayTitle: screenplay.title,
    includeNotes,
    createdAt: new Date().toISOString(),
    pdfUrl: /* construct Firebase Storage URL */ null,
    posterUrl: screenplay.posterUrl || null,
    analysis: {
      title: screenplay.title,
      author: screenplay.author,
      genre: screenplay.genre,
      // ... all fields from SharedViewDocument.analysis
    },
    ...(includeNotes && notes?.length ? { notes } : {}),
  };

  await setDoc(doc(db, 'shared_views', token), sharedView);
  return { token, url: `${SHARE_BASE_URL}/${token}` };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Reference-based sharing (store ID, read at view time) | Snapshot-based sharing (embed data at creation time) | Industry standard for capability URLs | Eliminates auth requirement for partner, simplifies security |
| Single route component file | Route + layout + section components | React best practice | Maintainable, testable sections |

## Open Questions

1. **PDF URL construction at share time**
   - What we know: `ModalHeader` constructs the Storage path as `screenplays/{category}/{safeName}.pdf` and calls `getDownloadURL()`. The share doc needs a pre-resolved URL.
   - What's unclear: Should `createShareToken()` call `getDownloadURL()` to get the actual download URL, or construct the path for the partner to resolve?
   - Recommendation: Call `getDownloadURL()` at share creation time and store the resolved URL in the `pdfUrl` field. Firebase Storage download URLs are long-lived (they contain an access token). This avoids the partner needing Storage SDK access.

2. **Poster URL availability**
   - What we know: Poster URLs are stored in `posterStore` (Zustand, ephemeral) and sometimes in `screenplay.posterUrl` (from Firestore doc).
   - What's unclear: Is `posterUrl` reliably present on the Screenplay object at share time?
   - Recommendation: Include `posterUrl` in the snapshot if available. The shared view should gracefully hide the poster section if `posterUrl` is null.

3. **Notes source for snapshot**
   - What we know: `notesStore` uses localStorage (`lemon-notes` key). `screenplay_feedback` is Firestore (producer feedback). The CONTEXT.md says "producer notes" should be shown.
   - What's unclear: Does "producer notes" mean `notesStore` notes or `screenplay_feedback` data?
   - Recommendation: Based on CONTEXT.md and the ShareButton's "Include notes" toggle, this refers to `notesStore` notes (the simple text notes). At share creation time, read from `useNotesStore.getState().notes[screenplayId]` and snapshot into the doc.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vite.config.ts) |
| Config file | `vite.config.ts` (inline test config) |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHARE-02 | resolveShareToken returns doc or null | unit | `npx vitest run src/lib/shareService.test.ts -t "resolveShareToken"` | Needs new tests in existing file |
| SHARE-02 | SharedViewPage renders analysis from snapshot data | unit | `npx vitest run src/pages/SharedViewPage.test.tsx` | Wave 0 |
| SHARE-03 | Download button renders with pdfUrl from snapshot | unit | `npx vitest run src/components/share/SharedViewLayout.test.tsx` | Wave 0 |
| SHARE-04 | Share route is lazy-loaded in main.tsx | manual-only | Verify build output chunks | N/A |
| SHARE-04 | SharedViewPage imports no dashboard stores | unit | `npx vitest run src/pages/SharedViewPage.test.tsx -t "no dashboard"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run && npm run build`
- **Phase gate:** Full suite green + build succeeds before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/pages/SharedViewPage.test.tsx` -- covers SHARE-02 (token resolution, rendering states)
- [ ] `src/components/share/SharedViewLayout.test.tsx` -- covers SHARE-03, SHARE-04 (PDF download, no dashboard chrome)
- [ ] Add `resolveShareToken` tests to existing `src/lib/shareService.test.ts` -- covers SHARE-02

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/main.tsx`, `src/App.tsx`, `src/lib/shareService.ts`, `src/lib/firebase.ts` -- routing patterns, share service API, auth model
- Codebase inspection: `firestore.rules` -- `shared_views` collection has `allow read: if true`
- Codebase inspection: `src/components/screenplay/modal/*` -- existing analysis display patterns, reusable UI components
- Codebase inspection: `src/types/screenplay.ts` -- full Screenplay type definition, all fields needed for snapshot

### Secondary (MEDIUM confidence)
- Firebase Firestore docs -- 1MB document size limit, `getDoc` without auth on public collections

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries, all existing project dependencies
- Architecture: HIGH -- Data snapshot pattern is the only viable approach given auth constraints; verified by inspecting Firestore rules
- Pitfalls: HIGH -- Identified from direct codebase analysis (auth gating, bundle isolation, SPA routing)
- Data access strategy: HIGH -- Firestore rules confirm `uploaded_analyses` requires auth, `shared_views` is public

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- no external dependencies changing)
