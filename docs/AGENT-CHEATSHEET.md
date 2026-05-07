# Lemon Dashboard — Agent & Skill Cheat Sheet

> Pin this. Drag prompts into Claude Code or Gemini CLI as needed.
> Skills are invoked automatically when you paste the prompt — just hit enter.

---

## Feature Development

### Add a New Filter

**What it does:** Brainstorms the filter design, plans the implementation across filterStore + FilterPanel + useFilteredScreenplays, then executes with subagents.

```
Use the feature-dev skill to add a new filter: [FILTER NAME]. It should filter screenplays by [FIELD/CRITERIA]. Check filterStore.ts and FilterPanel before touching anything. Follow existing MultiSelect/RangeSlider patterns.
```

---

### Add a New Chart to Analytics Dashboard

**What it does:** Plans and builds a new Recharts chart inside AnalyticsDashboard, respecting the lazy-load boundary.

```
Use the feature-dev skill to add a new chart to AnalyticsDashboard showing [METRIC]. Use Recharts. AnalyticsDashboard is lazy-loaded — keep it inside that boundary. Match the existing chart components in src/components/charts/.
```

---

### Add a New Screenplay Modal Tab / Panel

**What it does:** Adds a new panel inside ScreenplayModal, following the modal sub-component pattern in src/components/screenplay/modal/.

```
Use the feature-dev skill to add a new panel to ScreenplayModal for [PURPOSE]. Check src/components/screenplay/modal/ for existing sub-components and follow that pattern. Read screenplay.ts and screenplay-v6.ts before touching data types.
```

---

### Add a New Zustand Store

**What it does:** Creates a typed Zustand 5 store, barrel-exports it, and wires it up.

```
Use the feature-dev skill to create a new Zustand store called [NAME]Store for managing [STATE]. Follow the pattern of existing stores in src/stores/. Barrel-export it from stores/index.ts.
```

---

### New Settings Panel

**What it does:** Adds a new settings panel to SettingsPage following the existing ApiConfigPanel/AppearanceSettings pattern.

```
Use the feature-dev skill to add a new settings panel to SettingsPage for [PURPOSE]. Check src/components/settings/ for existing panel patterns. SettingsPage is lazy-loaded.
```

---

## Debugging

### Debug a Bug or Broken Feature

**What it does:** Systematic root-cause investigation before any fix attempt. Prevents thrashing.

```
Use the systematic-debugging skill. Bug: [DESCRIBE WHAT'S WRONG AND WHAT YOU EXPECTED]. Relevant area: [FILE OR FEATURE].
```

---

### Debug a Firestore / Firebase Issue

**What it does:** Investigates read/write/auth failures. Checks security rules, anonymous auth state, and query logic.

```
Use the systematic-debugging skill. Firestore issue: [DESCRIBE]. Check firestore.rules, src/lib/firebase.ts, and the relevant hook (useScreenplays or useFilteredScreenplays). Anonymous auth is required for writes.
```

---

### Debug a TypeScript Build Failure

**What it does:** Finds the type error, traces it to screenplay.ts or screenplay-v6.ts if data-related, fixes it without introducing `any`.

```
Use the systematic-debugging skill. TypeScript build is failing with: [PASTE ERROR]. No `any` allowed. Check both types/screenplay.ts and types/screenplay-v6.ts if it's a data type issue.
```

---

### Debug a Failing Test

**What it does:** Diagnoses Vitest test failures. Aware of the pre-existing FilterBar/analysisStore mock issues.

```
Use the systematic-debugging skill. Test failing: [TEST NAME OR FILE]. Run: npm run test:run. Known pre-existing failures: FilterBar (needs QueryClientProvider) and analysisStore (needs Firebase auth mock) — don't fix those unless asked.
```

---

## Planning & Architecture

### Plan a Multi-Step Feature

**What it does:** Writes a structured implementation plan before touching any code. Use this before anything non-trivial.

```
Use the writing-plans skill to plan: [DESCRIBE THE FEATURE OR CHANGE]. Relevant files: [LIST KEY FILES IF KNOWN]. Stack: React 19, TypeScript strict, Zustand 5, React Query 5, Firebase 12, Tailwind 4.
```

---

### Brainstorm Before Building

**What it does:** Explores design options and tradeoffs before committing to an approach. Good for anything with UI or architecture decisions.

```
Use the brainstorming skill. I want to [DESCRIBE GOAL]. Consider: existing patterns in this codebase, Tailwind-only styling, no inline styles, Zustand for client state, React Query for server state.
```

---

### Research + Plan a Phase (GSD)

**What it does:** Runs research then produces a detailed PLAN.md for a development phase.

```
/gsd:plan-phase [PHASE NUMBER] — [PHASE TITLE]
```

---

## Auditing & Review

### Full UI/UX Audit (with Screenshots)

**What it does:** Playwright screenshots at 3 viewports + design scoring + a11y + engineering analysis. Takes a few minutes.

```
/audit:full
```

---

### Quick Engineering Audit (No Browser)

**What it does:** Code quality, architecture, and pattern analysis only. Fast.

```
/audit:quick
```

---

### Visual Design Audit Only

**What it does:** Playwright screenshots + design quality scoring. No code analysis.

```
/audit:visual
```

---

### Accessibility Audit

**What it does:** WCAG violations, aria coverage, contrast ratios, semantic HTML.

```
/audit:a11y
```

---

### Review Before Merging

**What it does:** Checks that implementation matches requirements, runs verification, confirms tests pass before claiming done.

```
Use the requesting-code-review skill. I just finished: [DESCRIBE WHAT YOU BUILT]. Verify against: [REQUIREMENTS OR TICKET]. Run npm run build and npm run test:run first.
```

---

## Execution

### Execute a Plan with Parallel Subagents

**What it does:** Runs independent tasks in parallel using subagents. Fastest way to execute a written plan.

```
Use the subagent-driven-development skill to execute this plan: [PASTE PLAN OR REFERENCE PLAN.md]. Stack: React 19 + TypeScript strict + Tailwind 4 + Zustand 5 + Firebase 12. Path alias: @/ → src/.
```

---

### Execute a GSD Phase Plan

**What it does:** Runs all tasks in a phase plan with atomic commits and state tracking.

```
/gsd:execute-phase [PHASE NUMBER]
```

---

### Verify Work Before Claiming Done

**What it does:** Forces running build + tests and confirming output before any success claim. No assertion without evidence.

```
Use the verification-before-completion skill. I believe [FEATURE/FIX] is complete. Run: npm run build, npm run test:run. Report actual output — do not assume passing.
```

---

## Shipping

### Wrap Up a Branch and Ship

**What it does:** Guides commit, PR creation, and cleanup after implementation is complete.

```
Use the finishing-a-development-branch skill. Implementation complete: [DESCRIBE WHAT WAS BUILT]. Branch is ready to ship.
```

---

### Create a PR

**What it does:** Runs build + tests, commits, pushes, creates PR with summary.

```
/gsd:ship
```

---

## App-Specific Workflows

### Re-analyze a Screenplay

**What it does:** Triggers the Cloud Function at functions/src/analyzeScreenplay.ts for a screenplay already in Firestore.

```
Use the systematic-debugging skill to trace the re-analyze flow. Start from BulkReanalyzeModal → Cloud Function analyzeScreenplay → Firestore write. I need to [DESCRIBE WHAT YOU'RE DOING].
```

---

### Change the PDF Export

**What it does:** Modifies the @react-pdf/renderer document. Components are in src/components/export/ and src/components/export/coverage/.

```
Use the feature-dev skill to change the PDF export: [DESCRIBE CHANGE]. Components are in src/components/export/ and src/components/export/coverage/. Use @react-pdf/renderer primitives only — no HTML elements inside PDF components.
```

---

### Modify Share Links

**What it does:** Changes share token generation, link expiry, or SharedViewPage. Touches shareStore + shareService + /share/:token route.

```
Use the feature-dev skill to modify the share link feature: [DESCRIBE CHANGE]. Relevant: src/lib/shareService.ts, stores/shareStore.ts, src/pages/SharedViewPage, src/components/share/. firestore.rules controls public read access.
```

---

### Add a New Cloud Function

**What it does:** Adds a new Firebase Cloud Function in Node 20, exports it from functions/src/index.ts.

```
Use the feature-dev skill to add a new Cloud Function: [DESCRIBE FUNCTION PURPOSE]. Add to functions/src/, export from functions/src/index.ts. Deploy separately: cd functions && npm run deploy.
```

---

## Reference

| Command | When to Use |
|---|---|
| `npm run build` | Before every commit — TypeScript check |
| `npm run test:run` | Before every commit — Vitest |
| `npm run test:e2e` | After build changes — Playwright against port 4173 |
| `npm run deploy` | Hosting only — functions deploy separately |
| `npm run dev` | Always port 3000 — never change this |
