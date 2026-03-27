---
phase: 3
slug: selection-mode-foundation
created: 2026-03-23
---

# Phase 3: Selection Mode Foundation — Validation Strategy

## Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | vitest.config.ts |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run && npm run build` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Status |
|--------|----------|-----------|-------------------|-------------|
| BULK-01 | Always-visible checkbox on card, toggles selection | unit | `npx vitest run src/stores/selectionStore.test.ts -x` | New (Wave 0) |
| BULK-02 | BulkActionBar renders when count > 0, shows count + clear | unit | `npx vitest run src/components/screenplay/BulkActionBar.test.tsx -x` | New (Wave 0) |
| BULK-03 | Select All dispatches all filtered IDs; Deselect All clears | unit | `npx vitest run src/stores/selectionStore.test.ts -x` | New (Wave 0) |
| BULK-10 | Disabled buttons render with title tooltips | unit | `npx vitest run src/components/screenplay/BulkActionBar.test.tsx -x` | New (Wave 0) |
| BULK-11 | Selected cards get ring-2 class; unselected cards unchanged | unit | `npx vitest run src/components/screenplay/ScreenplayGrid.test.tsx -x` | Exists — needs update |

## Sampling Rate

- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run && npm run build`
- **Phase gate:** Full suite green before verification

## Wave 0 Gaps

- [ ] `src/stores/selectionStore.test.ts` — covers BULK-01, BULK-03 (store logic: toggle, selectAll, deselectAll, derived hooks)
- [ ] `src/components/screenplay/BulkActionBar.test.tsx` — covers BULK-02, BULK-10 (renders when selection > 0, disabled buttons with tooltips)
- [ ] Update `src/components/screenplay/ScreenplayGrid.test.tsx` — covers BULK-11 (mock selectionStore, verify ring class on selected cards)
- [ ] Mock pattern: `vi.mock('@/stores/selectionStore')` needed in ScreenplayGrid and ScreenplayCard tests
