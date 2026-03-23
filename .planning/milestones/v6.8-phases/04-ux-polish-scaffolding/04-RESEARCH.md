# Phase 4: UX Polish Scaffolding - Research

**Researched:** 2026-03-13
**Domain:** UI feedback patterns (toast notifications, JSON.parse hardening, loading/empty states)
**Confidence:** HIGH

## Summary

Phase 4 covers four UX requirements. Two (UX-01 skeleton cards, UX-02 empty states) are **already implemented** in `ScreenplayGrid.tsx` (lines 24-129) and only need verification/marking complete. The real work is UX-03 (toast notification system for error feedback) and UX-04 (JSON.parse hardening across 16 files).

The toast system should be built as a Zustand store (`toastStore.ts`) plus a `<ToastContainer>` rendered at the app root, following the project's established pattern of one-store-per-domain. No external toast library needed -- the requirements (errors/warnings only, bottom-center, max 3, auto-dismiss) are simple enough to hand-roll with Tailwind CSS animations matching the existing glassmorphism theme. JSON.parse hardening is a systematic audit: Zustand persist stores already have built-in deserialization error handling via the middleware, but 10+ manual `JSON.parse` call sites need explicit try/catch wrapping.

**Primary recommendation:** Build a lightweight custom toast system (Zustand store + React component) and systematically wrap all `JSON.parse` sites with try/catch + safe defaults. Do NOT install a third-party toast library.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- UX-01 and UX-02 are **already implemented** -- no changes needed to SkeletonCard or EmptyState
- No modal skeleton needed (modal data comes from card click, no separate fetch)
- Toast position: **bottom-center**
- Auto-dismiss: ~5 seconds, user can dismiss early with X button
- Max 3 toasts visible; additional errors collapse into "+N more errors" on last toast
- Errors and warnings only -- no success confirmations
- Scope: Replace silent `console.error` calls in user-facing operations with toast feedback (47 calls across 18 files to audit)
- Preferences (Zustand stores): Silent reset to defaults on corrupt JSON -- no notification
- Data (Firestore/API responses): Show toast when parse fails
- Pending write queue: Discard and reset corrupt queue silently

### Claude's Discretion
- Toast component implementation details (animation, visual styling matching gold/black theme)
- Whether analytics dashboard gets skeleton/empty states
- Which of the 47 console.error calls should become user-visible toasts vs remain as debug logs
- Toast notification store implementation (Zustand or lightweight custom)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | Skeleton loading cards while screenplays load | ALREADY IMPLEMENTED in ScreenplayGrid.tsx (lines 24-69, 193-201). Verify and mark complete. |
| UX-02 | Contextual empty state with filter-reset action | ALREADY IMPLEMENTED in ScreenplayGrid.tsx (lines 74-129, 203-205). Verify and mark complete. |
| UX-03 | Inline error feedback (toast/banner) for failed operations | Build toastStore + ToastContainer; audit 47 console.error/warn calls; replace user-facing ones with addToast() |
| UX-04 | All JSON.parse calls wrapped with error handling + defaults | Audit 16 files; wrap manual JSON.parse sites; verify Zustand persist middleware behavior |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | 5.0.10 | Toast state management | Already the project standard for all client state stores |
| React | 19.2.0 | ToastContainer component | Existing framework |
| Tailwind CSS | 4.1.18 | Toast styling + animations | Project convention -- no inline styles or CSS modules |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | 2.1.1 | Conditional class composition | Already used project-wide for className merging |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom toast | react-hot-toast / sonner | Over-engineered for errors-only requirement; adds bundle weight; harder to match glassmorphism theme exactly |
| Zustand toast store | React context | Project convention is Zustand for all client state; context would be the outlier |

**Installation:**
```bash
# No new packages needed -- everything is already in the project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── stores/
│   └── toastStore.ts          # NEW: Zustand store for toast state
├── components/
│   └── ui/
│       ├── ToastContainer.tsx  # NEW: Renders toast stack at app root
│       └── index.ts            # UPDATE: Export ToastContainer
├── lib/
│   ├── analysisStore.ts        # UPDATE: Add toast calls on user-facing errors
│   ├── feedbackStore.ts        # UPDATE: Add toast calls on save failures
│   ├── localAnalysisStore.ts   # UPDATE: Add try/catch to JSON.parse
│   └── api.ts                  # UPDATE: Add try/catch hardening
├── hooks/
│   └── useCategories.ts        # UPDATE: JSON.parse already has try/catch (verify)
├── contexts/
│   └── DevExecContext.tsx       # UPDATE: JSON.parse already has try/catch (verify)
└── App.tsx                      # UPDATE: Add <ToastContainer /> at root
```

### Pattern 1: Toast Store (Zustand)
**What:** A dedicated Zustand store managing an array of toast objects with add/remove/clear actions.
**When to use:** Any file that catches an error the user should see.
**Example:**
```typescript
// src/stores/toastStore.ts
import { create } from 'zustand';

type ToastSeverity = 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
  createdAt: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, severity?: ToastSeverity) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const MAX_VISIBLE = 3;

export const useToastStore = create<ToastStore>()((set, get) => ({
  toasts: [],
  addToast: (message, severity = 'error') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      const updated = [...state.toasts, { id, message, severity, createdAt: Date.now() }];
      // Keep only recent toasts (oldest auto-evict if over limit)
      return { toasts: updated };
    });
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      get().removeToast(id);
    }, 5000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));
```

### Pattern 2: Toast Consumer in Error Handlers
**What:** Import `useToastStore.getState().addToast` in non-React code (lib files).
**When to use:** In lib/ files that catch errors but don't have React context.
**Example:**
```typescript
// In src/lib/feedbackStore.ts (non-React module)
import { useToastStore } from '@/stores/toastStore';

export async function saveFeedback(feedback: ScreenplayFeedback): Promise<void> {
  try {
    const docRef = doc(db, FEEDBACK_COLLECTION, feedback.screenplayId);
    await setDoc(docRef, { ...feedback, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Lemon] Failed to save feedback:', err);
    useToastStore.getState().addToast(
      `Failed to save feedback for "${feedback.screenplayTitle}"`,
      'error'
    );
  }
}
```

### Pattern 3: Safe JSON.parse Wrapper
**What:** A utility function that wraps JSON.parse with try/catch and returns a typed default.
**When to use:** Every manual JSON.parse call site outside of Zustand persist middleware.
**Example:**
```typescript
// src/lib/utils.ts (or inline where needed)
export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
```

### Pattern 4: Stacking + Overflow Display
**What:** ToastContainer renders max 3 toasts; if more exist, the 3rd shows "+N more errors".
**When to use:** Always -- built into the container.
**Example:**
```typescript
// In ToastContainer.tsx
const visible = toasts.slice(-MAX_VISIBLE); // Show newest 3
const overflow = toasts.length - MAX_VISIBLE;
// If overflow > 0, append "+N more" text to the last visible toast
```

### Anti-Patterns to Avoid
- **Adding toast calls to ErrorBoundary:** ErrorBoundary catches render errors (React lifecycle). Toast is for async operation failures. Keep them separate.
- **Toasting on read failures that have fallbacks:** If `loadFeedback()` fails but returns `null` gracefully, that's a warning at most -- the user can still use the app. Only toast when an explicit user action (save, delete, upload) fails.
- **Success toasts:** User decision is errors/warnings only. Success is the expected state.
- **Persisting toast store:** Toast state is ephemeral. No `persist` middleware. Matches `syncStatusStore` pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State management for toasts | Custom event system or React context | Zustand store (no persist) | Project convention; `getState()` works outside React |
| CSS animations for toast enter/exit | JavaScript animation library | Tailwind CSS `@keyframes` + `animate-*` utilities | Already used for `slide-up-fade` in animations.css |
| UUID generation for toast IDs | crypto.randomUUID() or uuid library | `Date.now() + Math.random()` | Toasts are ephemeral; collision probability is irrelevant |

**Key insight:** The toast system is simple enough that hand-rolling is actually the right call. The max-3 stacking and auto-dismiss are the only non-trivial parts, and both are ~10 lines of logic.

## Common Pitfalls

### Pitfall 1: Zustand persist middleware already catches JSON.parse errors
**What goes wrong:** Developers add redundant try/catch around Zustand persist stores thinking they need manual JSON.parse protection.
**Why it happens:** Zustand's `persist` middleware internally calls `JSON.parse` on the stored value and catches errors -- if deserialization fails, the store initializes with its default state. This is built-in behavior.
**How to avoid:** Focus JSON.parse hardening on the 10+ MANUAL `JSON.parse` call sites, not the 7 Zustand stores using `persist`. The stores to audit are: `filterStore`, `sortStore`, `favoritesStore`, `notesStore`, `themeStore`, `uploadStore`, `apiConfigStore`. These are already safe.
**Warning signs:** If you find yourself modifying a Zustand store's persist config to add error handling, you're solving a problem that doesn't exist.

### Pitfall 2: Toast store memory leak from auto-dismiss timers
**What goes wrong:** If toasts are added rapidly (e.g., batch operation fails for 50 items), setTimeout callbacks pile up and eventually fire after component unmount.
**Why it happens:** `setTimeout` in Zustand actions doesn't clean up on unmount.
**How to avoid:** Cap the toast array length in the store (e.g., keep only last 10). The UI shows max 3, but the store can accumulate. Also, `removeToast` should be idempotent (filter, not splice).
**Warning signs:** Console warnings about state updates after unmount.

### Pitfall 3: Toasting on background sync failures creates noise
**What goes wrong:** `backgroundFirestoreSync` runs periodically. If the network is down, every sync cycle produces a toast, spamming the user.
**Why it happens:** Treating all `console.error` calls equally.
**How to avoid:** Background sync failures should remain as `console.warn` only. Toast only on USER-INITIATED operations: upload, delete, note save, manual retry. The 47 console.error/warn calls need triage, not blanket replacement.
**Warning signs:** Multiple identical toasts appearing without user action.

### Pitfall 4: JSON.parse in WebSocket handler (useLiveDevExec)
**What goes wrong:** WebSocket message parsing failure crashes the live audio session.
**Why it happens:** `JSON.parse(event.data)` on line 196 of useLiveDevExec.ts is already wrapped in try/catch (line 285 catches parseErr), but the outer try/catch at line 193 may not properly handle all Blob parsing edge cases.
**How to avoid:** Verify the existing try/catch coverage; this is likely already safe. Focus hardening effort on the unwrapped sites.

### Pitfall 5: Stale toast references after hot reload
**What goes wrong:** During development, HMR preserves the Zustand store state but remounts ToastContainer, leaving orphan timers.
**Why it happens:** Zustand stores survive HMR; React components don't.
**How to avoid:** ToastContainer should clean up stale toasts (older than 10s) on mount. Minor dev-only issue, but annoying.

## Code Examples

### Console.error Call Triage

Based on audit of 47 `console.error/warn` calls across 18 files:

**Should become user-visible toasts (user-initiated action failures):**
```
src/lib/feedbackStore.ts:74     - "Failed to save feedback" (user saves)
src/lib/feedbackStore.ts:113    - "Failed to save calibration profile" (user saves)
src/lib/analysisStore.ts:48     - "localStorage write failed" (user uploads)
src/lib/analysisStore.ts:240    - "Firestore write failed" (user uploads, queued for retry)
src/lib/analysisStore.ts:294    - "Firestore soft-delete failed" (user deletes)
src/lib/analysisStore.ts:333    - "Firestore soft-delete-all failed" (user bulk deletes)
src/lib/analysisStore.ts:366    - "Firestore restore failed" (user restores)
src/components/settings/UploadPanel.tsx:259  - "Analysis failed" (user uploads)
src/components/settings/DataManagement.tsx:145 - "Failed to delete all" (user deletes)
src/components/export/ExportModal.tsx:76     - "Export failed" (user exports)
src/components/screenplay/modal/ReanalyzeButton.tsx:84 - "Reanalyze failed" (user action)
src/components/screenplay/modal/PosterSection.tsx:29   - "Poster generation failed" (user action)
src/hooks/useUrlState.ts:248    - "Failed to copy URL" (user copies)
src/contexts/DevExecContext.tsx:122 - "DevExec send error" (user sends message)
```

**Should remain as console.warn/debug only (background or non-actionable):**
```
src/lib/api.ts:41,50,69,74,82,108,128,132  - Data loading/migration (background)
src/lib/analysisStore.ts:207    - "Background Firestore sync failed" (automatic)
src/lib/analysisStore.ts:416    - "Quarantine failed" (automatic)
src/lib/analysisStore.ts:475,486 - "Firestore auth not ready / batch delete" (automatic)
src/lib/analysisStore.ts:523,549 - "Migration" (automatic, one-time)
src/lib/feedbackStore.ts:87     - "Failed to load feedback" (read, fallback exists)
src/lib/feedbackStore.ts:98     - "Failed to load all feedback" (read, fallback exists)
src/lib/feedbackStore.ts:126    - "Failed to load calibration profile" (read, fallback)
src/components/ui/ErrorBoundary.tsx:34,35 - React error boundary (has its own UI)
src/hooks/useLiveDevExec.ts:285,298,304  - WebSocket/streaming (has its own error UI)
src/hooks/usePosterBackground.ts:63 - Background poster gen (non-blocking)
src/components/screenplay/modal/ModalHeader.tsx:56,67 - PDF download fallback path
src/lib/analysisService.ts:112,374,394,405 - API/storage errors (handled by caller)
```

### JSON.parse Call Site Audit

**Sites needing hardening (no try/catch or incomplete):**
```
src/lib/localAnalysisStore.ts:30      - Has try/catch, returns [] on error -- SAFE
src/lib/analysisStore.ts:57           - Has try/catch, returns [] -- SAFE
src/lib/analysisStore.ts:70           - Has try/catch via queueForRetry -- SAFE
src/lib/analysisStore.ts:83           - Has try/catch in flushPendingWrites -- PARTIALLY SAFE (outer try)
src/lib/analysisStore.ts:129          - Inside try block of flushPendingWrites -- SAFE
src/lib/analysisService.ts:224        - Inside try/catch -- SAFE but parse error not distinguished from other errors
src/lib/analysisService.ts:247        - Inside try/catch -- SAFE but same issue
src/hooks/useLiveDevExec.ts:196,198   - Inside try/catch (line 193) -- SAFE
src/hooks/useCategories.ts:30         - Has try/catch, falls through to seed defaults -- SAFE
src/contexts/DevExecContext.tsx:46     - Has try/catch -- SAFE
src/components/settings/CategoryManagement.tsx:35 - Has try/catch, returns INITIAL_CATEGORIES -- SAFE
```

**Analysis:** Most JSON.parse sites already have try/catch. The main risk is that error recovery is silent (no toast for data corruption). Per user decision:
- Zustand persist stores: Already safe (middleware handles it). Silent reset is correct.
- Manual stores (categories, DevExec chat, analysis): Already have try/catch. Need to add toast notification for data-source parse failures (API responses, Firestore docs).
- `analysisService.ts:224,247`: These parse API responses. A parse failure here should toast.

### ToastContainer Styling (Glassmorphism Theme)
```typescript
// Toast visual: glass-panel style with colored left border
// Error: border-l-4 border-red-500, bg matching glass-panel
// Warning: border-l-4 border-amber-500
// Animation: slide up from bottom + fade, matching existing slide-up-fade keyframe
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-toastify (heavy, opinionated) | Sonner / custom with Zustand | 2024+ | Sonner is the popular choice, but custom is fine for errors-only |
| Window.alert() for errors | Inline toast/banner | Always | Never use alert() in a dashboard |
| Global error handler | Per-operation error feedback | Best practice | Users need context-specific error messages |

**Deprecated/outdated:**
- react-toastify: Still works but heavy for errors-only use case. Not needed here.
- Browser Notification API: Wrong tool -- these are in-app operation errors, not background notifications.

## Open Questions

1. **Analytics dashboard skeleton/empty states**
   - What we know: The analytics dashboard is lazy-loaded and already has a `<Suspense>` + `<LoadingFallback>` wrapper for the chunk load. Data loading state inside the dashboard is unclear.
   - What's unclear: Whether there's a visible loading gap between chunk load and data render.
   - Recommendation: Check during implementation. If analytics charts flash empty, add skeleton. If they render fast (data is already cached from main grid), skip it. This is at Claude's discretion per CONTEXT.md.

2. **Toast accessibility (ARIA)**
   - What we know: Toasts should use `role="alert"` and `aria-live="assertive"` for screen readers.
   - Recommendation: Add these attributes to the ToastContainer's toast wrapper.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + Testing Library React 16.3.2 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Skeleton cards shown during loading | unit | `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx` | Exists (verify coverage) |
| UX-02 | Empty state with filter-reset action | unit | `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx` | Exists (verify coverage) |
| UX-03 | Toast appears on user-action failure | unit | `npm run test:run -- src/stores/toastStore.test.ts` | Wave 0 |
| UX-04 | Corrupt JSON doesn't crash app | unit | `npm run test:run -- src/lib/safeJsonParse.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/toastStore.test.ts` -- covers UX-03 (addToast, removeToast, max 3 stacking, auto-dismiss)
- [ ] `src/lib/safeJsonParse.test.ts` -- covers UX-04 (corrupt JSON returns fallback, valid JSON parses correctly)

## Sources

### Primary (HIGH confidence)
- Codebase audit: `ScreenplayGrid.tsx` lines 24-129 (SkeletonCard + EmptyState confirmed implemented)
- Codebase audit: 47 `console.error/warn` calls across 18 files (grep verified)
- Codebase audit: 16 `JSON.parse` call sites across source files (grep verified)
- Codebase audit: 7 Zustand stores using `persist` middleware (grep verified)
- Zustand docs: `persist` middleware handles deserialization errors internally (returns default state)

### Secondary (MEDIUM confidence)
- Toast pattern: Zustand `getState()` for non-React usage is documented and stable in Zustand 5

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all patterns already exist in codebase
- Architecture: HIGH - Follows established one-store-per-domain pattern
- Pitfalls: HIGH - Based on direct codebase audit of all 47 error call sites and 16 JSON.parse sites
- Toast triage: MEDIUM - Classification of which errors should toast vs stay as console is judgment-based; may need adjustment during implementation

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain, no external API dependencies)
