# Lemon Screenplay Dashboard — System Audit

**Date**: 2026-02-06
**Codebase version**: 6.5.0
**Scope**: Full application — types, scoring logic, normalization, data loading, state management, UI components, export pipeline

---

## PHASE 1 — SYSTEM RECONSTRUCTION

### 1.1 Architecture Overview

This is a **client-side-only** single-page application. There is no backend server, no database, no authentication system (beyond a hardcoded password on the upload panel).

```
┌─────────────────────────────────────────────────────────────────┐
│                        Firebase Hosting                         │
│                         (static files)                          │
├─────────────────────────────────────────────────────────────────┤
│  Vite SPA (React 19 + TypeScript)                               │
│                                                                 │
│  ┌─────────┐   ┌─────────────┐   ┌───────────────────────┐     │
│  │  React   │   │ TanStack    │   │   Zustand Stores      │     │
│  │  Router  │   │ React Query │   │  (localStorage)       │     │
│  │ (2 pages)│   │ (data fetch)│   │                       │     │
│  └─────────┘   └──────┬──────┘   │ filterStore            │     │
│                        │          │ sortStore              │     │
│                        ▼          │ comparisonStore        │     │
│               ┌────────────────┐  │ favoritesStore         │     │
│               │  /data/*.json  │  │ notesStore             │     │
│               │  (static JSON  │  │ themeStore             │     │
│               │   analysis     │  │ apiConfigStore         │     │
│               │   results)     │  │ uploadStore            │     │
│               └────────────────┘  └───────────────────────┘     │
│                        │                                        │
│                        ▼                                        │
│               ┌────────────────┐                                │
│               │  normalize.ts  │──► V5/V6 raw → Screenplay      │
│               │  api.ts        │     type normalization          │
│               └────────┬───────┘                                │
│                        │                                        │
│                        ▼                                        │
│               ┌────────────────┐                                │
│               │ calculations.ts│──► Producer metrics calculated  │
│               │                │    (marketPotential, ROI, etc.) │
│               └────────────────┘                                │
│                        │                                        │
│                        ▼                                        │
│               ┌────────────────────────────────────────────┐    │
│               │            UI Layer                        │    │
│               │  Grid → Cards → Modal → Comparison         │    │
│               │  Filters → Sort → Search → Charts          │    │
│               │  Export (PDF / CSV) → Share (URL)           │    │
│               └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Stack**: React 19, Vite 7, TypeScript 5.9 (strict), TailwindCSS 4, Zustand 5, TanStack React Query 5, Recharts, @react-pdf/renderer, PapaParse, @dnd-kit.

**Deployment**: Firebase Hosting. `npm run build` (tsc + vite build) → `firebase deploy`.

### 1.2 How Screenplay Data Flows

1. **Ingestion**: Pre-analyzed JSON files sit in `/data/analysis_v5/` and `/data/analysis_v6/` as static assets served by Vite. Each directory has an `index.json` manifest listing filenames. There is no runtime analysis pipeline connected to the UI — the upload panel stubs out with `alert()`.

2. **Loading** (`api.ts → loadAllScreenplaysVite()`):
   - Fetches `index.json` for V5 and V6 directories.
   - Fetches each individual JSON file in parallel.
   - Dispatches to `normalizeScreenplay()` (V5) or `normalizeV6Screenplay()` (V6) based on `analysis_version` field.
   - Deduplicates by title (case-insensitive), preferring V6 over V5.

3. **Normalization** (`normalize.ts`):
   - V5: Direct field mapping with type coercion (`toNumber`), camelCase conversion.
   - V6: Maps a fundamentally different scoring model (4 weighted pillars) down to the legacy 7-dimension model. Specific mappings:
     - `genreExecution` ← `voice_and_tone.score` (semantic mismatch)
     - `originality` ← `conceptual_strength.theme.score` (semantic mismatch)
   - V6 hardcodes `marketability: 'medium'`, `filmNowAssessment: null`, empty `targetAudience`.

4. **Derived Metrics** (`calculations.ts → calculateProducerMetrics()`):
   - Computed at normalization time, not on demand.
   - Six metrics: `marketPotential` (1-10), `productionRisk` (Low/Med/High), `starVehiclePotential` (1-10), `festivalAppeal` (1-10), `roiIndicator` (1-5 stars), `uspStrength` (Weak/Mod/Strong).
   - All use additive scoring with clamped results. Genre matching is substring-based.

5. **Display**: React Query caches the full dataset (30 min stale, 1 hr cache). Zustand stores manage filters, sorts, comparison selections, notes, and favorites — all persisted to localStorage. Filtering and sorting are computed in `useMemo` inside `useFilteredScreenplays`.

6. **Decision Output**: The recommendation tier (`film_now` / `recommend` / `consider` / `pass`) comes directly from the pre-analyzed JSON. The app does not compute or override this tier — it only displays it and allows filtering by it.

### 1.3 Where Business Logic Lives

| Concern | Location | Notes |
|---|---|---|
| Recommendation tier | Pre-computed in analysis JSON | App displays, never overrides |
| Weighted score | Pre-computed in analysis JSON | App trusts `weighted_score` field |
| CVS total | Pre-computed in analysis JSON | App trusts `cvs_total` field |
| Critical failure penalties | Pre-computed in analysis JSON | Normalized with -3.0 cap |
| V6 false positive detection | Pre-computed in analysis JSON | Displayed but not actionable |
| Dimension weights | `DIMENSION_CONFIG` in `screenplay.ts` | Used for display only — actual weighting happens in analysis |
| Producer metrics | `calculations.ts` | Computed at load time from normalized data |
| Budget tier definitions | `BUDGET_TIERS` in `screenplay.ts` | Display labels and levels |
| Score color thresholds | `calculations.ts` | 70%+ = excellent, 50%+ = good, else poor |
| Filter logic | `useFilteredScreenplays.ts` | Client-side filtering over full dataset |
| Sort logic | `useFilteredScreenplays.ts` | Multi-column sort with Film Now priority |

### 1.4 State, Persistence, and Versioning

- **Data versioning**: The app handles V3, V4, V5, and V6 analysis formats. V6 is a structurally different model (4 pillars with sub-criteria vs 7 flat dimensions). Normalization flattens V6 into the V5 schema.
- **Persistence**: All user state (filters, sorts, theme, favorites, notes, API config, upload jobs) persists to `localStorage` via Zustand's `persist` middleware.
- **No server-side state**: No database, no user accounts, no audit trail, no versioning of user decisions.

### 1.5 Assumptions I Am Making

1. The pre-analysis pipeline (the Python scripts in `/execution/`) is what produces the JSON files. That pipeline is out of scope for this audit but its output quality is the single most important variable in system decision quality.
2. The "upload" feature is aspirational — it stubs out with `alert('API processing will start. This feature requires backend integration.')`.
3. The hardcoded password `'1234'` on the upload panel is intentionally placeholder.
4. The LatAm market lens and co-production assessment types suggest this is for a Latin American production company or a company with significant LatAm operations.
5. Firebase Storage is used for PDF hosting (original screenplays), though the bucket config is an env var with a placeholder default.

---

## PHASE 2 — EXPERT DIAGNOSES

### 2.1 UX / Product Expert

**Where users may misunderstand the system:**

1. **The V6 dimension mapping is invisible and misleading.** When a V6-analyzed screenplay shows "Genre Execution: 7.2" in the UI, that number actually comes from `voice_and_tone.score`. When it shows "Originality: 6.8", that comes from `conceptual_strength.theme.score`. A producer reading these labels is evaluating the screenplay against the wrong criteria. This is the single most dangerous UX problem in the system.

2. **Producer metrics appear authoritative but are crude heuristics.** Market Potential is a score from 5-10 driven by genre keyword matching and weighted score thresholds. Festival Appeal uses substring matches against a list of 8 genres and 7 themes. These are presented with the same visual weight as the AI-analyzed dimension scores, but they are fundamentally less trustworthy. Users cannot distinguish AI-analyzed scores from locally-computed heuristics.

3. **"Film Now" implies operational readiness, but the system has no workflow beyond the label.** There is no way to advance a screenplay from "Film Now" to any next step — no pipeline, no assignment, no notes workflow tied to greenlight decisions. The label creates urgency that the tool doesn't service.

4. **Filter chips reset all other filters.** Clicking "FILM NOW" clears search, collections, score ranges, genre filters — everything. This is destructive for users who have built a complex filter state and want to narrow further. The "Clear All" button exists separately but the chips already do this implicitly.

5. **The comparison tool caps at 3 screenplays.** For a producer deciding between 5-8 finalists, this is too low. The side-by-side view also duplicates all metric sections rather than showing a delta-focused view that highlights where screenplays diverge.

6. **Notes use `window.prompt()`.** The NotesSection bypasses React state updates (`useNotesStore.getState()` called directly instead of via hooks), and the input method is a browser `prompt()` dialog. This breaks the visual language of the app and provides no rich text, no tagging, no mention of other screenplays.

7. **The analytics dashboard always shows unfiltered data.** The `AnalyticsDashboard` component receives `allScreenplays` (the full dataset), not the filtered set. When a user filters to "2020 Black List" and sees 15 results in the grid, the charts still show all 300+ screenplays. The charts and the grid are answering different questions.

8. **Critical failure penalty amounts are not surfaced.** The system normalizes penalty values (-0.3 to -1.2 per failure, capped at -3.0 total) but the modal only shows failure descriptions. A producer cannot see whether a critical failure cost 0.3 or 1.2 points, making it impossible to gauge severity.

9. **PDF export says "V3 Analysis" in the footer** (`PdfDocument.tsx:346`) regardless of the actual analysis version. This is a factual error in exported documents.

**Cognitive load issues:**

- The ScreenplayCard shows 4 of 7 dimension scores, two headline scores (weighted + CVS), three producer metrics, genre, budget, collection, recommendation tier, critical failure count, and production status. This is ~15 data points per card. In a grid of 20+ cards, this creates scanning paralysis rather than enabling quick triage.
- The ScreenplayModal has no information hierarchy beyond scroll order. Every section has equal visual weight. There is no executive summary view vs deep-dive toggle.

### 2.2 Frontend Specialist

**Component structure:**

1. **`App.tsx` is a god component.** It manages 6 modal/panel open states, all filter chip logic, chart click handlers, search state subscriptions, and the full page layout in a single 370-line file. This is the primary contributor to coupling in the UI layer.

2. **Duplicated `toNumber` / `toNum` functions.** `normalize.ts` has `toNumber()`, `ScreenplayModal.tsx` has `toNum()`, and `ScreenplayCard.tsx` has inline defensive checks. Three implementations of the same safety pattern.

3. **`RecommendationBadge` is defined separately in both `ScreenplayCard.tsx` and `ScreenplayModal.tsx`** with different styling logic. These should be a single shared component.

4. **Zustand store subscriptions in `useFilteredScreenplays` are coarse.** The hook calls `useFilterStore()` without selectors, which means it re-renders on any filter change — even changes to filters that don't affect the current view. The comment says "selective subscription to avoid re-renders" but the implementation does the opposite.

5. **`NotesSection` bypasses React's reactive model.** It calls `useNotesStore.getState()` directly (lines 149, 155, 158 of `ScreenplayModal.tsx`), meaning the notes list does not reactively update when notes are added or deleted. The user must close and reopen the modal to see changes.

6. **Export triggers multiple sequential downloads.** PDF export iterates through screenplays with a 500ms delay between each, triggering individual file downloads. For 20+ screenplays, this creates a cascade of download dialogs. No ZIP bundling.

7. **`useHasActiveFilters` has a logic bug.** Line 322: `!filters.hideProduced` — this means the filter is considered "active" when `hideProduced` is `false`, which is the non-default state. But if the default is `true` (hide produced), then having it `true` should not count as active. The logic is inverted and would show "Clear All" in confusing states.

**State management:**

8. **Eight Zustand stores with no coordination layer.** Filters, sorts, comparisons, favorites, notes, theme, API config, and upload state are all independent atoms. There's no mechanism for cross-store reactions (e.g., clearing comparison when filters change to exclude compared items).

9. **localStorage is the only persistence.** Clearing browser data destroys all user notes, favorites, and filter presets. For a production decision tool, this is a data loss risk.

### 2.3 Backend / Systems Specialist

**Scoring engine:**

1. **Producer metrics are computed from already-lossy normalized data.** The `calculateProducerMetrics()` function receives a `Screenplay` object that has already been through V5 or V6 normalization. For V6 screenplays, the dimension scores it reads have been remapped (voice→genreExecution, theme→originality). So `evaluateStarVehiclePotential()` checks `dimensionScores.protagonist >= 8`, but this value comes from `coreQuality.character_system.protagonist.score` — which is correct. However, `assessUSPStrength()` checks `dimensionScores.originality >= 8`, which for V6 is actually `theme.score` — a different construct than originality. The scoring is operating on semantically incorrect inputs for V6 screenplays.

2. **Genre matching is fragile.** `genreMatches()` uses substring inclusion: `"science fiction".includes("sci-fi")` returns `false`. The `COMMERCIAL_GENRES` list includes both `"sci-fi"` and `"science fiction"` to compensate, but if the analysis produces `"Sci-Fi"` (capitalized), the match works only because of `.toLowerCase()`. If the analysis says `"Science-Fiction"`, the match fails because `"science-fiction".includes("science fiction")` is `false`. There is no fuzzy matching or canonical genre mapping.

3. **ROI Indicator has a degenerate case.** `calculateROIIndicator(marketPotential, budgetCategory)` computes `(marketPotential / getBudgetLevel(budgetCategory)) * 2`. For `micro` budget (level 1), any `marketPotential >= 2` yields `ratio >= 4`, which is 5 stars. This means nearly every micro-budget screenplay gets 5-star ROI regardless of other factors. The metric is effectively useless for micro-budget comparisons.

4. **USP Strength uses logline word count as a quality signal.** `assessUSPStrength()` adds 1 indicator if `logline.split(' ').length > 50`. A long logline correlates with a *bad* logline (verbose, unfocused), not a strong USP. This heuristic works against its stated purpose.

5. **`normalizeCommercialViability` for V6 uses hardcoded defaults when the commercial lens is disabled.** All 6 CVS factors default to `score: 2, note: 'Not assessed (lens disabled)'` with `cvsTotal: 12`. This means V6 screenplays without the commercial lens appear to have "average" commercial viability (12/18 = 67th percentile), when in fact they have no assessment at all. These scores are then used in filters, sorts, and comparisons alongside real assessments.

6. **Deduplication by title is lossy.** If two different screenplays have the same title (common in the industry — drafts, rewrites, different authors), only the V6 version survives. There is no warning, no merge, no disambiguation.

**Performance:**

7. **All screenplays are fetched in a single waterfall.** `loadAllScreenplaysVite()` fetches `index.json`, then fetches every file listed in it in parallel. For 300+ files, this creates 300+ concurrent HTTP requests. There is no pagination, no lazy loading, no progressive rendering.

8. **Filtering and sorting run on every render cycle.** The `useMemo` in `useFilteredScreenplays` depends on the entire filter store object (no selector granularity), so any filter change re-runs the full filter+sort pipeline over all screenplays. For the current dataset size this is fine, but it's O(n × m) where m is the number of filter dimensions.

**Observability:**

9. **Console logging is the only observability.** Data loading logs counts and errors to `console.log/warn/error`. There are no structured logs, no error reporting service, no analytics on which screenplays users view, filter, compare, or export. There is no way to audit what decisions were made or when.

### 2.4 Architecture / Tech Lead

**Separation of concerns:**

1. **The type system conflates display, storage, and analysis concerns.** `screenplay.ts` is a 562-line file that defines raw JSON types, normalized app types, configuration objects, and display constants all together. There is no boundary between "what the analysis produces", "what the app stores", and "what the UI needs to render".

2. **The V5-to-V6 normalization layer is a permanent compatibility shim that will compound debt.** Every V6 feature (false positive detection, lenses, sub-criteria, page citations) must be either: (a) force-fit into the V5 schema, or (b) bolted on via `ScreenplayWithV6` extension. The system has two mental models trying to occupy one type. This will get worse with every analysis version.

3. **Business logic is spread across four layers with no clear owner:**
   - Pre-analysis JSON: recommendation tier, weighted score, CVS, critical failures
   - `calculations.ts`: producer metrics (6 derived metrics)
   - `normalize.ts`: V6-to-V5 mapping decisions, default values, penalty caps
   - `useFilteredScreenplays.ts`: which fields are filterable, what constitutes "active"

4. **No test coverage on scoring correctness.** `calculations.test.ts` exists but the test coverage for the normalization layer — the most critical correctness boundary — is minimal. There are no tests verifying that V6 normalization produces expected outputs, no tests for edge cases like missing fields, no tests for the genre matching logic.

**Risks to future iteration:**

5. **Adding a new analysis version (V7) requires changes in 5+ files.** Types, normalization function, API loader, type guard, and potentially every component that uses `hasV6Fields()`. There is no plugin or adapter pattern.

6. **The upload pipeline is a dead feature consuming complexity.** `UploadPanel`, `uploadStore`, `apiConfigStore`, and `ApiConfigPanel` together represent ~500 lines of code that produce zero user value (the "Start Analysis" button calls `alert()`). These components are maintained, styled, and tested despite being non-functional.

7. **No environment separation.** The same build deploys to production. There are no feature flags, no staging environment, no A/B testing capability for scoring changes. If you want to experiment with different producer metric formulas, you ship to everyone or no one.

---

## PHASE 3 — ROOT PROBLEM SYNTHESIS

### Root Problems (not symptoms)

| # | Problem | Type | Impact |
|---|---|---|---|
| **R1** | V6-to-V5 normalization destroys semantic meaning of scores | Logic / Correctness | **Critical** — users see mislabeled data, derived metrics use wrong inputs |
| **R2** | Producer metrics are crude heuristics presented as authoritative analytics | Trust / Interpretability | **High** — creates false confidence in scores that are genre-keyword lookups |
| **R3** | No separation between "analysis-provided" and "locally-derived" scores | Structural | **High** — users cannot distinguish AI assessment from heuristic calculation |
| **R4** | The system has no decision workflow beyond display | UX / Product Gap | **Medium** — the tool helps triage but provides no path from triage to action |
| **R5** | Analytics dashboard and grid show different data populations | Logic / Correctness | **Medium** — charts use unfiltered data while grid uses filtered data |
| **R6** | The V5 type schema is the system's backbone but V6 is the future | Engineering Debt | **High** — every V6 feature requires a compatibility shim |
| **R7** | Zero observability into decision-making patterns | Structural | **Medium** — no way to know which screenplays get evaluated, compared, or exported |
| **R8** | Dead upload pipeline adds maintenance surface for zero value | Engineering Debt | **Low** — but sends misleading signal about system capabilities |

### Ranked by Impact

**On Decision Quality:**
1. R1 — Mislabeled V6 scores directly corrupt the information users rely on
2. R2 — Crude producer metrics create false precision in commercial viability assessment
3. R5 — Charts telling a different story than the grid undermines trust in the tool
4. R3 — Users cannot calibrate their trust in different score types

**On Team Velocity:**
1. R6 — Every V6/V7 feature requires multi-file changes through compatibility shims
2. R8 — Dead code is maintained alongside working code
3. R3 — No clear ownership of business logic makes changes risky

**On Long-term Scalability:**
1. R6 — The V5 schema is a ceiling on what V6+ can express
2. R7 — Without observability, you cannot measure if changes help or hurt
3. R4 — Decision workflow will be needed eventually and retrofitting is harder than designing

---

## PHASE 4 — SKILL & WORKFLOW REFRAMING

### Skill 1: Display Correct Score Labels for Any Analysis Version

**The system should**: Render dimension labels that match what the analysis actually measured, regardless of version.

- **Inputs**: Screenplay object with analysis version identifier
- **Outputs**: Array of `{ label: string, score: number, weight: number, justification: string }` tuples
- **Success criteria**: A V6 screenplay shows "Execution Craft", "Character System", "Conceptual Strength", "Voice & Tone" — not the V5 labels "Genre Execution" and "Originality"
- **Owner**: UI layer + a thin adapter in the normalization layer
- **Layer**: Create a `getDimensionDisplay(screenplay)` function that returns version-appropriate labels and scores. The UI calls this instead of directly accessing `dimensionScores`.

### Skill 2: Distinguish AI-Assessed vs Locally-Derived Metrics

**The system should**: Visually and structurally separate metrics that came from the AI analysis from metrics computed by the dashboard's heuristic engine.

- **Inputs**: Screenplay data
- **Outputs**: Two distinct data groups: `analysisMetrics` (from JSON) and `derivedMetrics` (from `calculations.ts`), each with provenance labels
- **Success criteria**: The UI renders these in separate sections with different visual treatment. A tooltip or label explains "Calculated by dashboard from genre + score heuristics" vs "Assessed by AI model"
- **Owner**: Types layer (structural separation) + UI layer (visual separation)

### Skill 3: Explain Why a Screenplay Scored the Way It Did

**The system should**: Present a readable explanation of how a screenplay's scores, tier, and metrics relate — especially when there are apparent contradictions (e.g., high weighted score but PASS tier due to critical failures).

- **Inputs**: Full Screenplay object
- **Outputs**: A structured "score story" — what drove the tier, what penalties applied, which dimensions were strongest/weakest, and how producer metrics relate to the underlying data
- **Success criteria**: A non-technical producer reads the explanation and understands why this screenplay was rated CONSIDER instead of RECOMMEND, without needing to cross-reference multiple sections
- **Owner**: A new `buildScoreNarrative(screenplay)` function in the lib layer, rendered by the modal

### Skill 4: Filter and Analyze a Consistent Dataset

**The system should**: Apply the same population to charts and grid, so analytics and results tell the same story.

- **Inputs**: Current filter state + full screenplay dataset
- **Outputs**: One filtered dataset used by both AnalyticsDashboard and ScreenplayGrid
- **Success criteria**: When filtering to "2020 Black List", charts show distribution of only that collection
- **Owner**: Prop change in `App.tsx` — pass `filteredScreenplays` to `AnalyticsDashboard` instead of `allScreenplays`

### Skill 5: Support Version-Native Data Display

**The system should**: Render V6-specific features (false positive traps, lens assessments, sub-criteria) in their native structure rather than force-fitting them into V5 display patterns.

- **Inputs**: `ScreenplayWithV6` data
- **Outputs**: V6-native UI sections showing the 4-pillar model, trap details, lens results, sub-criteria breakdowns
- **Success criteria**: V6 screenplays show richer, more accurate information than V5 screenplays. V5 screenplays continue to render correctly.
- **Owner**: UI layer — conditional rendering based on `hasV6Fields()` (already partially implemented for false positive warnings)

### Workflow Mapping

**Submission Intake**: Skills needed — none currently (upload is non-functional). When implemented: file upload → analysis trigger → result ingestion → display.

**Script Analysis** (core loop):
1. Skill 1 (correct labels) — see accurate scores
2. Skill 2 (provenance separation) — know which scores to trust
3. Skill 3 (score narrative) — understand the verdict
4. Skill 5 (V6 native display) — access deeper analysis when available

**Comparison and Ranking**:
1. Skill 4 (consistent dataset) — charts and grid agree
2. Skill 1 + 2 (correct labels + provenance) — compare apples to apples

**Final Greenlight Decisions**:
1. Skill 3 (score narrative) — defensible rationale for the decision
2. Skill 2 (provenance) — know what's AI-assessed vs heuristic

---

## PHASE 5 — EXECUTION-READY RECOMMENDATIONS

### Tier 1: Fix Now (correctness and trust)

#### 1a. Fix V6 dimension label display

**File**: Create `src/lib/dimensionDisplay.ts`

Instead of always showing the V5 labels ("Genre Execution", "Originality") for V6 data, create an adapter:

```typescript
function getDimensionDisplay(screenplay: Screenplay): DimensionDisplayItem[] {
  if (hasV6Fields(screenplay) && screenplay.v6CoreQuality) {
    return [
      { label: 'Execution Craft', score: screenplay.v6CoreQuality.execution_craft.score, weight: 0.40 },
      { label: 'Character System', score: screenplay.v6CoreQuality.character_system.score, weight: 0.30 },
      { label: 'Conceptual Strength', score: screenplay.v6CoreQuality.conceptual_strength.score, weight: 0.20 },
      { label: 'Voice & Tone', score: screenplay.v6CoreQuality.voice_and_tone.score, weight: 0.10 },
    ];
  }
  return DIMENSION_CONFIG.map(({ key, label, weight }) => ({
    label, score: screenplay.dimensionScores[key], weight,
  }));
}
```

Use this in `ScreenplayModal`, `ScreenplayCard`, `ComparisonSideBySide`, `PdfDocument`, and `csvExport`. This is the highest-leverage fix in the system.

**Effort**: ~2 hours. **Risk**: Low.

#### 1b. Fix analytics dashboard data source

**File**: `src/App.tsx:302`

Change:
```tsx
<AnalyticsDashboard screenplays={allScreenplays} ... />
```
To:
```tsx
<AnalyticsDashboard screenplays={screenplays} ... />
```

Where `screenplays` is already the filtered set from `useFilteredScreenplays()`. Optionally add a toggle for "Show all / Show filtered" in the dashboard header.

**Effort**: 5 minutes. **Risk**: None.

#### 1c. Fix PDF footer version string

**File**: `src/components/export/PdfDocument.tsx:346`

Change `V3 Analysis` to `{screenplay.analysisVersion || 'Unknown'}`.

**Effort**: 1 minute. **Risk**: None.

#### 1d. Fix `useHasActiveFilters` logic bug

**File**: `src/hooks/useFilteredScreenplays.ts:322`

The line `!filters.hideProduced` incorrectly marks the filter as active when `hideProduced` is `false`. If `hideProduced: true` is the default, this condition should be removed or inverted. Audit what the actual default is in `filterStore.ts` and fix the boolean direction.

**Effort**: 10 minutes. **Risk**: Low.

#### 1e. Fix V6 CVS defaults that masquerade as real assessments

**File**: `src/lib/normalize.ts` — V6 commercial viability normalization

When the commercial lens is disabled, instead of defaulting all CVS factors to `score: 2`, set them to `score: 0` and flag `cvsTotal` as `0` or add a `cvsAssessed: false` flag. Then update the UI to show "Not assessed" rather than rendering fake numbers.

**Effort**: 1 hour. **Risk**: Medium — requires UI changes in CVS display.

### Tier 2: Improve Next (trust and clarity)

#### 2a. Separate AI-assessed vs locally-derived metrics in the UI

Add a visual separator in `ScreenplayModal` between the "Analysis Results" section (dimension scores, CVS, recommendation, critical failures — all from the JSON) and the "Dashboard Metrics" section (market potential, festival appeal, ROI, star vehicle, USP, production risk — all from `calculations.ts`).

Add a small label: "Computed by dashboard heuristics" under the producer metrics section. This costs nothing and immediately calibrates user trust.

#### 2b. Fix producer metric heuristics

Specific fixes in `calculations.ts`:
- **ROI Indicator**: Add a minimum market potential threshold. Micro-budget with `marketPotential < 5` should not get 5 stars.
- **USP Strength**: Remove the logline word count check (`logline.split(' ').length > 50`). Replace with logline presence + originality score check.
- **Genre matching**: Replace substring matching with a canonical genre map. Map "Sci-Fi", "sci-fi", "Science Fiction", "science fiction", "Science-Fiction" all to a canonical entry.

#### 2c. Make NotesSection reactive

Replace `useNotesStore.getState()` calls with proper Zustand hook subscriptions so notes update in real-time. Replace `window.prompt()` with an inline text input within the modal.

#### 2d. Extract App.tsx into composable layout

Split `App.tsx` into:
- `DashboardLayout` (structural shell)
- `FilterBar` (search, chips, sort dropdown, action buttons)
- `ModalManager` (centralized modal state, renders all modals)

This reduces App.tsx from 370 lines to ~80 and makes each concern independently testable.

#### 2e. Consolidate duplicated utilities

- Merge `toNumber()` (normalize.ts) and `toNum()` (ScreenplayModal.tsx) into a single export
- Extract `RecommendationBadge` into `src/components/ui/RecommendationBadge.tsx`
- Extract `ScoreBar` into `src/components/ui/ScoreBar.tsx`

### Tier 3: Redesign Later (architecture and scale)

#### 3a. Build a version-native rendering system

Instead of normalizing V6 into V5 and then rendering V5, build a component system that accepts either and renders the best available view:

```
ScreenplayDetailView
  ├── V5DetailView (7 dimensions, flat CVS)
  └── V6DetailView (4 pillars with sub-criteria, lenses, traps)
```

This eliminates the normalization layer's lossy mapping and lets V6 screenplays show their full richness. The comparison system would need a shared metric abstraction for cross-version comparisons.

#### 3b. Add structured observability

Track which screenplays users open, how long they spend in the modal, which comparisons they make, and which screenplays they export or add to favorites. This data — even if only logged to a simple analytics endpoint — would let you measure whether scoring changes improve decision quality.

#### 3c. Remove or complete the upload pipeline

The upload panel, upload store, API config store, and API config panel are ~500 lines of dead code. Either connect them to a real backend or remove them entirely. Half-built features erode user trust in the tool.

#### 3d. Add decision workflow

Once the analysis and display layers are trustworthy, add:
- "Shortlist" action on screenplays (distinct from favorites — a formal pipeline step)
- Decision log: "Passed on X because Y" (structured, not free-text notes)
- Export of decision rationale for greenlight meetings

### Verification Signals

After implementing Tier 1 fixes, measure:

1. **Correctness**: V6 screenplays should display 4 dimension labels, not 7 remapped ones. Write a unit test that normalizes a V6 fixture and asserts `getDimensionDisplay()` returns pillar-level labels.
2. **Consistency**: When a collection filter is active, verify chart data matches grid count. Automate with an E2E test.
3. **Trust calibration**: After separating AI vs heuristic metrics, conduct a brief user test — ask a producer "which scores do you trust more?" The answer should track the provenance labels.
4. **Scoring accuracy**: After fixing ROI and USP heuristics, spot-check 10 micro-budget screenplays. ROI should show variance (not all 5 stars). USP should not be boosted by long loglines.

### What Should Not Be Built

- **Auto-upload with client-side API keys**: The current architecture stores API keys in localStorage and would send them directly from the browser. This is a security liability. Upload should go through a server-side proxy or be a separate tool.
- **More producer metrics**: The current 6 metrics are already low-confidence. Adding more heuristics (e.g., "sequel potential", "IP value") without improving the underlying methodology would compound the false-precision problem.
- **A/B testing on the scoring engine**: The scoring engine is deterministic and runs at load time. A/B testing would require either server-side computation or versioned scoring configs — both are architectural changes that should wait until the current correctness issues are resolved.

---

## Summary

The Lemon Screenplay Dashboard is a well-built React application with clean component structure, comprehensive type safety, and a thoughtful feature set. Its primary risk is not engineering quality — it's **epistemic integrity**. The system's most impactful problems are about users seeing labels that don't match the underlying data, trusting heuristics that don't merit trust, and reading charts that answer the wrong question.

Fix the data accuracy first. Then improve the decision-support clarity. Architecture can evolve after the system tells the truth.
