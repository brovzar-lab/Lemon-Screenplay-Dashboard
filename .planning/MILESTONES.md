# Milestones

## v6.8 Dev Exec Insights + Sharing (Shipped: 2026-03-17)

**Phases completed:** 7 phases, 16 plans

**Key accomplishments:**
- Firestore security hardening with anonymous auth
- Sync status visibility with retry UI
- Soft-delete with 30-day recovery + quarantine
- UX polish (skeletons, empty states, toasts)
- Partner sharing via secure token links
- Shared partner view (read-only standalone)
- Coverage PDF export

---

## v7.0 Pipeline Scale & Bulk Operations (Shipped: 2026-03-24)

**Phases completed:** 5 phases, 10 plans
**Requirements:** 14/14 complete (PDF-01, PERF-01-02, BULK-01-12)

**Key accomplishments:**
- Fixed coverage PDF cover page spacing (score/verdict separation)
- Virtual scrolling with @tanstack/react-virtual for 500-1000+ screenplays
- Always-on multi-select checkboxes with Set-based Zustand selection store
- Sticky bulk action bar with 6 wired actions (CSV, PDF, Compare, Upload, Category, Favorites)
- Bulk PDF export as zip download via JSZip with inline progress
- SetCategoryModal and AddToFavoritesModal for batch operations
- Bulk PDF upload modal with per-row dropzones, batch zone, Firebase progress/retry

**Stats:**
- Files changed: 140 (+11,851 / -506 lines)
- LOC: 28,755 TypeScript
- Timeline: 2 days (2026-03-23 → 2026-03-24)
- Tests: 417 passing (50 bulk-specific)

---
