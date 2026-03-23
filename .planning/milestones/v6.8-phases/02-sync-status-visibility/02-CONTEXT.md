# Phase 2: Sync Status Visibility - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Producer can see at a glance how many screenplays are pending Firestore sync and can manually trigger a retry when writes fail. No changes to the sync mechanism itself — only visibility and manual retry controls.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User deferred all implementation choices to Claude. The following areas are all open for Claude to decide based on what's most efficient:

- **Indicator placement & style** — Where the sync status lives (header badge, floating pill, status bar), how prominent it is during normal operation vs failure states
- **Failure feedback** — What the producer sees when writes fail (count only vs per-screenplay detail), visual urgency level
- **Retry behavior** — Manual retry button only vs auto-retry on reconnect, progress feedback during retry (spinner vs count)
- **Zero-state presence** — Whether the indicator vanishes when synced or shows a reassuring "All synced" state

</decisions>

<specifics>
## Specific Ideas

No specific requirements — user wants the most efficient implementation approach.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `analysisStore.ts`: `PENDING_QUEUE_KEY` localStorage key tracks failed writes as JSON array
- `analysisStore.ts`: `queueForRetry(raw)` adds failed writes to the pending queue
- `analysisStore.ts`: `flushPendingWrites()` retries queued writes in batches of 10, removes succeeded entries
- `analysisStore.ts`: `backgroundFirestoreSync()` calls `flushPendingWrites()` then does full Firestore sync
- Header component (`src/components/layout/Header.tsx`): Existing header bar where sync indicator would naturally fit

### Established Patterns
- Zustand stores for client state with localStorage persistence — sync status store follows this pattern
- React Query for server state — sync status is client state (Zustand), not server state
- Premium gold/black theme with glassmorphism — indicator must match existing visual language

### Integration Points
- `src/lib/analysisStore.ts` — Read pending queue count, expose retry trigger
- `src/components/layout/Header.tsx` — Mount sync status indicator
- `src/stores/` — New syncStatusStore.ts for reactive pending/failed counts

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-sync-status-visibility*
*Context gathered: 2026-03-14*
