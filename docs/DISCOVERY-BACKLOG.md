# Discovery Redesign — Backlog (Later / Skip)

Source of truth for every original-app feature that is intentionally NOT part of the
Discovery reconnection (phases R0-R6). The "Add now" items are NOT listed here — they
are in the reconnection plan and its phase prompts. Decisions recorded 2026-07-22 from
the feature-parity audit; Billy approved the split.

Legend: **Later** = build after the reconnection ships. **Skip** = deliberately not
planned; revisit only if a real need appears.

## Later — Browsing & Finding

| Feature | What it does | Why later |
|---|---|---|
| Advanced multi-column sort | Prioritized, drag-to-reorder sort of up to 5 columns (`AdvancedSortPanel.tsx`) | Quick sort covers 90% of daily use first |
| Source category filter + tabs | Filter/tab by script origin (BLKLST, LEMON, Submission) (`CategoryFilter.tsx`, `CollectionTabs.tsx`) | Secondary to score/verdict filtering |
| Missing/Has-PDF filter | Filter to scripts with or without an attached PDF | Admin housekeeping, not partner-facing |
| FILM NOW First toggle | Pin top-tier scripts to the top of any sort | Exceptional Finds view partly covers it |
| Production badge (TMDB) | "Produced (year)" badge for already-filmed scripts (`ProductionBadge.tsx`) | Useful, not launch-blocking |
| Reading Room | Full-screen distraction-free reader (`ReadingRoom.tsx`) | The detail drawer covers the need first |
| Header stats pills | Total, average score, Film Now count | Dashboard flavor, not essential |
| Sync status indicator | Shows unsaved/disconnected state (`SyncStatusIndicator.tsx`) | Matters once heavy writing happens in the new UI |
| Full keyboard shortcuts | Hotkeys for search, filters, navigation | Power nicety; add after core works |

## Later — Screenplay Detail

| Feature | What it does | Why later |
|---|---|---|
| AI market analysis panel | Market potential + USP strength with reasoning (`ProducerMetricsPanel.tsx`) | Scores + content come first |
| Field position (percentile) | Rank against the whole slate (`FieldPositionPanel.tsx`, `percentileRanking.ts`) | Needs a bigger library to be meaningful |
| Film Now qualifiers | The special checks a top-tier script passed (`FilmNowSection.tsx`) | Partly served by Exceptional Finds |
| Similar Projects (Twins) | Ranked similar scripts to jump to (`SimilarProjects.tsx`) | Exploration feature, not launch-critical |
| Footer metadata | Page/word count, source file, engine version (`ModalFooter.tsx`) | Reference detail |
| Version history panel | Browse the immutable revision history (Chunk 2 `versions` subcollection; `versionService.ts`) | Included in R2 only if trivial; otherwise it lands here |

## Later — Sharing & Export

| Feature | What it does | Why later |
|---|---|---|
| Include-notes toggle on share | Choose whether your notes show to the partner | Refinement once basic share works (may come free with reused ShareButton) |
| Share a whole filtered view | Share the current dashboard view as URL or email | Single-script share matters more |
| CSV export | Scripts + scores as a spreadsheet (`csvExport.ts`) | Less urgent than PDFs |
| Bulk PDF export (zip) | One zip with a PDF per selected script (`bulkPdfExport.tsx`) | Convenience layer on single export |

## Later — Bulk & Compare & Analytics

| Feature | What it does | Why later |
|---|---|---|
| Bulk re-analyze | Re-run analysis on many scripts with cost preflight (`BulkReanalyzeModal.tsx`) | Expensive; gate behind the live cost controls |
| Bulk PDF upload | Attach missing PDFs to many scripts (`BulkPdfUploadModal.tsx`) | Admin housekeeping |
| Bulk set category | Reassign source category (`SetCategoryModal.tsx`) | Admin tidy-up |
| Head-to-head comparison | 2-3 scripts on all scores: bars, radar, side-by-side (`components/comparison/*`) | Useful for finalists, not launch-blocking |
| Analytics dashboard + charts | Slate stats, score/tier/genre/budget charts, click-to-filter (`components/charts/*`) | Redesign keeps analytics subordinate; needs data volume |

## Later — AI & Taste

| Feature | What it does | Why later |
|---|---|---|
| Per-script re-analyze (UI) | Re-run V9 on one script with model picker (`ReanalyzeButton.tsx`; backend queue path is live) | Wire once new scripts flow in |
| Billy's Take | One-click your-verdict-vs-AI capture (`BillysTake.tsx`) | Feeds taste profile; not needed for partner triage |
| Feedback / calibration UI | Trains the AI to Billy's taste (`FeedbackSection.tsx`, `CalibrationPanel.tsx`; VPS side is live) | Long-term value; engine works without it |
| Taste Match scoreboard | How often the AI agrees with Billy (`TasteMatch.tsx`) | Depends on calibration data existing |

## Later — Settings & Admin & Ingest

| Feature | What it does | Why later |
|---|---|---|
| Delete script (admin) | Remove with confirm (`DeleteConfirmDialog.tsx`) | Needed eventually |
| Cost controls UI | Budget limits + spend view (`ApiConfigPanel.tsx`; the REAL $100/day ceiling is server-side and live) | Tie to re-analyze features |
| Category management | Add/rename/delete categories (`CategoryManagement.tsx`) | Admin config |
| Data management | Export all, soft-delete, restore (`DataManagement.tsx`) | Safety net once data volume exists |
| PDF file management | Which scripts have their PDF; rescan/fix | Pairs with ingest surface |
| Analysis overview | V9 engine explainer (`AnalysisOverview.tsx`) | Onboarding nicety |
| Upload/ingest surface in new UI | Dropzone, queue status, duplicate/revision choices, error resolution (`PdfUploadPanel.tsx` + `upload/*`) | The OLD dashboard's upload panel keeps working throughout; reconnect the new Ingest screen after R6 |

## Skip — deliberately not planned

| Feature | Why skip |
|---|---|
| Dev Exec AI chat + voice (`components/devexec/*`) | Impressive but complex and costly; not part of triage-and-share. Revisit as a phase-2 delight feature |
| AI-generated posters (`PosterSection.tsx`) | Decorative; the redesign itself warns against posters crowding out evidence |
| Card hover peek | Redesign deliberately uses a visible evidence panel instead of hover-only reveals |
| Multi-theme design switcher | One good theme + working light/dark is enough |
| Password PIN gate (`PasswordGate.tsx`) | Google sign-in already gates access; redundant |
| Model comparison lab (`ModelComparisonPanel.tsx`) | Power/experimental tool, unrelated to sharing scripts |
| Back-to-top button | Trivial; add opportunistically if ever missed |

## Standing constraints (apply to all future work on these)

1. The backend (functions/, daemon.py, execution/, rules) is finished and live. Backlog items reconnect to it; they never modify it.
2. The old dashboard at `/` keeps working until Billy orders the swap.
3. Any shared component change must be additive (optional props, old behavior default).
