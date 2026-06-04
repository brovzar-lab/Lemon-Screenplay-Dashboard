# Backlog

Items left undone as of 2026-05-09. Pick up anytime.

---

## HIGH

### Firestore: `brain_verdicts` rules deployed, but Obsidian sync script missing
BillysTake writes to `brain_verdicts/{screenplayId}` in Firestore.
The component comment says synced to Obsidian Brain via `raw/notes/screenplay-sync.py (daily cron)` — that script does not exist yet.
**What's needed:** Python sync script that reads `brain_verdicts` and appends to Obsidian vault as daily note entries.

---

## MEDIUM

### Security: Move `service-account.json` out of project tree
Currently at project root, git-ignored but one accidental `git add .` away from committing.
**Fix:** Move to `~/.config/lemon-dashboard/service-account.json` or use Application Default Credentials (`gcloud auth application-default login`).
**Why:** Audit 2026-05-08 flagged as HIGH security risk.


### README.md: Replace Vite template boilerplate
`README.md` still contains Vite template content (ESLint, Babel/SWC notes).
Replace with actual project description, setup instructions, and commands.

### normalize.ts: Extract `normalizeV7Screenplay` into its own module
At ~600 lines post-V6-removal, still the largest source file.
Low priority — no functional problem, just size.

---

## DONE (session 2026-05-09)
- [x] BillysTake component — Brain verdict capture wired into ScreenplayModal
- [x] Brain verdict Firestore CRUD in feedbackStore (`saveBrainVerdict`, `loadBrainVerdict`)
- [x] `brain_verdicts` Firestore security rule deployed
- [x] V6 types fully removed (`screenplay-v6.ts` deleted, normalize.ts cleaned)
- [x] Collection renamed from `'V6 Analysis'` → `'Analysis'`
- [x] Audit cleanup: AlertBanners, UploadPanel, analysisService, dimensionDisplay slimmed
- [x] CLAUDE.md updated to V7-only engine description
- [x] All 8 pre-existing test failures fixed — 458/458 pass (FilterBar QueryClient + analysisStore fast-path seeding)
- [x] feedbackStore import conflict: already static in analysisService.ts (backlog stale)
- [x] proxyClient.ts `any` types: already properly typed (backlog stale)
- [x] api.ts dead code: no isMigrationComplete() present (backlog stale)
- [x] V6→V7 migration: 84 screenplays running (PID 67802, started 2026-05-09)
