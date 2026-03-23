# Phase 2: Sync Status Visibility - Research

**Researched:** 2026-03-13
**Domain:** Zustand reactive state + UI indicator for Firestore sync queue
**Confidence:** HIGH

## Summary

This phase adds a visible sync status indicator to the dashboard header so the producer can see pending Firestore writes and retry failures. The existing `analysisStore.ts` already has all the sync machinery (`PENDING_QUEUE_KEY`, `queueForRetry`, `flushPendingWrites`). The work is purely about making this invisible queue **observable** via a new Zustand store and rendering a compact indicator in the Header.

The implementation is straightforward: a new `syncStatusStore.ts` reads from `localStorage(PENDING_QUEUE_KEY)`, a `SyncStatusIndicator` component renders conditionally in the Header, and a `useSyncRetry` hook wraps the retry logic with loading/error states.

**Primary recommendation:** Build a thin Zustand store that polls/subscribes to the pending queue in localStorage, expose a `retryAll()` action that calls the existing `flushPendingWrites()`, and mount a conditional badge in the Header's stats pills area.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices deferred to Claude.

### Claude's Discretion
- Indicator placement & style -- Where the sync status lives (header badge, floating pill, status bar), how prominent it is during normal operation vs failure states
- Failure feedback -- What the producer sees when writes fail (count only vs per-screenplay detail), visual urgency level
- Retry behavior -- Manual retry button only vs auto-retry on reconnect, progress feedback during retry (spinner vs count)
- Zero-state presence -- Whether the indicator vanishes when synced or shows a reassuring "All synced" state

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-01 | User can see how many screenplays are pending Firestore sync | syncStatusStore reads PENDING_QUEUE_KEY length; SyncStatusIndicator renders count badge |
| SYNC-02 | User can force retry failed Firestore writes with a "Retry Now" button | useSyncRetry hook wraps existing flushPendingWrites(); button in SyncStatusIndicator |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | 5 | Reactive sync status state | Already used for all client state in this project |
| React | 19 | Component rendering | Project framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand/middleware (persist) | 5 | NOT needed here | Sync status is ephemeral session state -- no persistence needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand store | React context | Zustand is the project standard; context would break conventions |
| Polling localStorage | Storage event listener | Storage events only fire across tabs, not same-tab; polling is simpler |
| Custom retry logic | Existing flushPendingWrites() | Never re-implement -- the existing function handles batching, error handling, queue cleanup |

**Installation:**
```bash
# No new packages needed -- everything is already in the project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── stores/
│   └── syncStatusStore.ts       # NEW: Zustand store for pending/failed counts
├── hooks/
│   └── useSyncRetry.ts          # NEW: Hook wrapping retry logic with loading state
├── components/
│   └── layout/
│       ├── Header.tsx           # MODIFIED: Mount SyncStatusIndicator
│       └── SyncStatusIndicator.tsx  # NEW: Badge + retry button component
└── lib/
    └── analysisStore.ts         # MODIFIED: Export PENDING_QUEUE_KEY, expose getPendingCount()
```

### Pattern 1: Zustand Store Without Persistence
**What:** A Zustand store that tracks ephemeral UI state (pending count, isRetrying, lastError) without localStorage persistence.
**When to use:** When the state is session-scoped and derived from an external source (localStorage queue).
**Example:**
```typescript
// Source: Project convention from existing stores
import { create } from 'zustand';

interface SyncStatusState {
  pendingCount: number;
  isRetrying: boolean;
  lastRetryError: string | null;
  setPendingCount: (count: number) => void;
  setRetrying: (retrying: boolean) => void;
  setLastRetryError: (error: string | null) => void;
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  pendingCount: 0,
  isRetrying: false,
  lastRetryError: null,
  setPendingCount: (count) => set({ pendingCount: count }),
  setRetrying: (retrying) => set({ isRetrying: retrying }),
  setLastRetryError: (error) => set({ lastRetryError: error }),
}));
```

### Pattern 2: Polling localStorage for Reactive Updates
**What:** Since `PENDING_QUEUE_KEY` is written by `analysisStore.ts` (not a Zustand store), the syncStatusStore needs to poll localStorage to detect changes.
**When to use:** When the source of truth is localStorage and you need Zustand reactivity.
**Example:**
```typescript
// Poll every 2 seconds (matches the backgroundFirestoreSync delay)
function startSyncStatusPolling() {
  const update = () => {
    try {
      const raw = localStorage.getItem(PENDING_QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      useSyncStatusStore.getState().setPendingCount(Array.isArray(queue) ? queue.length : 0);
    } catch {
      useSyncStatusStore.getState().setPendingCount(0);
    }
  };
  update(); // immediate first read
  return setInterval(update, 2000);
}
```

### Pattern 3: Conditional Header Indicator
**What:** Show sync indicator only when pendingCount > 0 or isRetrying. Vanish completely when synced.
**When to use:** To avoid visual noise during normal operation (success criterion #4).
**Rationale:** The producer manages 500+ screenplays daily. A permanent "All synced" badge is noise. The indicator should only appear when action is needed.

### Anti-Patterns to Avoid
- **Don't re-implement retry logic:** `flushPendingWrites()` already handles batching (5 concurrent), individual error tracking, and queue cleanup. The hook should call it directly.
- **Don't persist sync status:** The pending queue in localStorage IS the persistence. The Zustand store is just a reactive view of it.
- **Don't use `window.addEventListener('storage')`:** The `storage` event only fires in OTHER tabs, not the current tab. Same-tab localStorage changes are invisible to storage events. Use polling instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry with batching | Custom retry loop | `flushPendingWrites()` from analysisStore | Already handles batch size, Promise.allSettled, queue cleanup |
| Firestore auth gating | Manual auth checks | `authReady` promise from firebase.ts | Already used by all Firestore operations |
| State management | React useState/context | Zustand `create()` | Project convention; enables cross-component reactivity without prop drilling |

**Key insight:** This phase is a thin UI layer over existing infrastructure. The sync queue, retry mechanism, and error handling all exist already. The only new code is observability and a manual trigger.

## Common Pitfalls

### Pitfall 1: Storage Event Misunderstanding
**What goes wrong:** Developer uses `window.addEventListener('storage')` expecting it to fire on same-tab localStorage changes.
**Why it happens:** MDN docs describe storage events but bury the "other tabs only" limitation.
**How to avoid:** Use `setInterval` polling or inject a notification callback into `analysisStore.ts` functions.
**Warning signs:** Indicator never updates after a write failure in the same tab.

### Pitfall 2: Race Condition During Retry
**What goes wrong:** User clicks "Retry Now" while `backgroundFirestoreSync` is already running, causing concurrent `flushPendingWrites()` calls that process the same queue items twice.
**Why it happens:** `_bgSyncDone` flag prevents re-entry of backgroundFirestoreSync, but doesn't guard flushPendingWrites directly.
**How to avoid:** Add an `isRetrying` guard in the hook. Set it before calling flush, clear after. If already retrying, no-op the button click.
**Warning signs:** Duplicate Firestore writes or "document already exists" errors in console.

### Pitfall 3: JSON.parse on Corrupted Queue
**What goes wrong:** `PENDING_QUEUE_KEY` contains invalid JSON (truncated write, quota exceeded), causing uncaught parse errors.
**Why it happens:** localStorage writes can be truncated if quota is hit.
**How to avoid:** Always wrap `JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY))` in try/catch with fallback to empty array. (The existing `flushPendingWrites` already does this.)
**Warning signs:** TypeError in console mentioning JSON.parse.

### Pitfall 4: Stale Count After Successful Retry
**What goes wrong:** After retry completes, the indicator still shows the old count until the next poll cycle.
**Why it happens:** Polling interval hasn't fired yet.
**How to avoid:** After `flushPendingWrites()` resolves, immediately re-read the queue count and update the store.
**Warning signs:** Brief flash of old count after retry.

## Code Examples

### Reading Pending Queue Count
```typescript
// Source: analysisStore.ts PENDING_QUEUE_KEY pattern
export function getPendingWriteCount(): number {
  try {
    const raw = localStorage.getItem('lemon-pending-writes');
    if (!raw) return 0;
    const queue = JSON.parse(raw);
    return Array.isArray(queue) ? queue.length : 0;
  } catch {
    return 0;
  }
}
```

### SyncStatusIndicator Component Pattern
```typescript
// Source: Header.tsx StatPill pattern adapted for sync status
function SyncStatusIndicator() {
  const { pendingCount, isRetrying } = useSyncStatusStore();
  const { retryAll } = useSyncRetry();

  if (pendingCount === 0 && !isRetrying) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <span className="text-sm text-amber-400">
        {isRetrying ? 'Syncing...' : `${pendingCount} pending`}
      </span>
      {!isRetrying && pendingCount > 0 && (
        <button
          onClick={retryAll}
          className="text-xs px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
        >
          Retry Now
        </button>
      )}
    </div>
  );
}
```

### useSyncRetry Hook Pattern
```typescript
// Source: Project hook conventions
export function useSyncRetry() {
  const { setRetrying, setPendingCount, setLastRetryError } = useSyncStatusStore();

  const retryAll = async () => {
    setRetrying(true);
    setLastRetryError(null);
    try {
      await flushPendingWrites();
      // Immediately refresh count after flush
      setPendingCount(getPendingWriteCount());
    } catch (err) {
      setLastRetryError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  return { retryAll };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Silent queue failures | Visible pending count + manual retry | This phase | Producer gains sync awareness |

**No deprecated APIs involved:** All Zustand 5, React 19, and Firebase APIs used here are current.

## Open Questions

1. **Should `flushPendingWrites` be exported from analysisStore.ts?**
   - What we know: Currently it's a module-private function (no `export` keyword)
   - What's unclear: Whether to export it directly or create a wrapper
   - Recommendation: Export it directly -- it's already well-encapsulated with error handling. Add a `getPendingWriteCount()` export too.

2. **Should the indicator also show during backgroundFirestoreSync?**
   - What we know: backgroundFirestoreSync runs 2s after page load and calls flushPendingWrites
   - What's unclear: Whether the initial auto-flush should show in the indicator
   - Recommendation: Yes -- the polling will naturally pick up any items in the queue during the initial sync window. No special handling needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vite.config.ts) |
| Config file | vite.config.ts (test section) |
| Quick run command | `npm run test:run -- --testPathPattern syncStatus` |
| Full suite command | `npm run test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Pending count reflects localStorage queue length | unit | `npm run test:run -- src/stores/syncStatusStore.test.ts` | No -- Wave 0 |
| SYNC-01 | SyncStatusIndicator shows count when > 0, hidden when 0 | unit | `npm run test:run -- src/components/layout/SyncStatusIndicator.test.tsx` | No -- Wave 0 |
| SYNC-02 | Retry button calls flushPendingWrites and updates count | unit | `npm run test:run -- src/hooks/useSyncRetry.test.ts` | No -- Wave 0 |
| SYNC-02 | Retry button disabled while retrying | unit | `npm run test:run -- src/components/layout/SyncStatusIndicator.test.tsx` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run && npm run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/syncStatusStore.test.ts` -- covers SYNC-01 store logic
- [ ] `src/components/layout/SyncStatusIndicator.test.tsx` -- covers SYNC-01 rendering and SYNC-02 button
- [ ] `src/hooks/useSyncRetry.test.ts` -- covers SYNC-02 retry logic

*(No framework install needed -- Vitest + Testing Library already configured)*

## Sources

### Primary (HIGH confidence)
- `src/lib/analysisStore.ts` -- Read in full. Contains PENDING_QUEUE_KEY, queueForRetry, flushPendingWrites, backgroundFirestoreSync
- `src/components/layout/Header.tsx` -- Read in full. Existing header structure with StatPill pattern
- `src/stores/filterStore.ts` -- Read partially. Zustand store pattern with create + persist
- `src/stores/uploadStore.ts` -- Read partially. Zustand store pattern without persistence for ephemeral state
- `src/stores/index.ts` -- Barrel export pattern
- `src/test/setup.ts` -- Test infrastructure with localStorage mock
- `vite.config.ts` -- Vitest configuration

### Secondary (MEDIUM confidence)
- Zustand 5 API (`create`, `getState`, `set`) -- verified via existing project stores

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, uses existing project stack
- Architecture: HIGH -- follows established Zustand + component patterns from this codebase
- Pitfalls: HIGH -- derived from reading actual implementation code (storage events, race conditions, JSON.parse)

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain, no fast-moving dependencies)
