---
trigger: always_on
---

# GEMINI.md — Lemon Screenplay Dashboard

## Project Context
Screenplay analysis dashboard for Lemon Studios. React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + Zustand 5 + TanStack React Query 5 + Firebase.

## Stack
| Layer | Tech |
|-------|------|
| UI | React 19, Tailwind CSS 4, Recharts 3, @dnd-kit |
| State | Zustand 5 (client), TanStack React Query 5 (server) |
| Build | Vite 7, TypeScript strict |
| PDF | @react-pdf/renderer (export), pdfjs-dist (parse) |
| Backend | Firebase (hosting + data) |
| Test | Vitest + Testing Library + Playwright |

## Commands
```bash
npm run dev          # Dev server
npm run build        # TS check + build
npm run test:run     # Unit tests
npm run test:e2e     # E2E tests
npm run lint         # Lint
npm run deploy       # Build + Firebase deploy
```

---

## AGENT & SKILL PROTOCOL

### Relevant Agents (Use ONLY These)

| Agent | When to Use |
|-------|-------------|
| `frontend-specialist` | UI components, React patterns, Tailwind, design |
| `debugger` | Root cause analysis, bug fixing |
| `test-engineer` | Vitest + Playwright tests |
| `performance-optimizer` | Core Web Vitals, bundle, render perf |
| `orchestrator` | Multi-file or cross-cutting changes |

> Agents: `agent/agents/`. Read agent file before implementation.

### Relevant Skills (Use ONLY These)

| Skill | When |
|-------|------|
| `react-patterns` | Hooks, state, component patterns |
| `clean-code` | Always (global) |
| `testing-patterns` | After logic changes |
| `performance-profiling` | Before deploy |
| `systematic-debugging` | When debugging |
| `frontend-design` | UI/UX changes |
| `architecture` | Structural decisions |

> Skills: `agent/skills/`. Load SKILL.md first, then only relevant sections.

### Skill Loading
```
Agent activated → Check skills: field → Load SKILL.md (index) → Read ONLY relevant sections
```

### Ignore These (Not Applicable)
mobile-developer, game-developer, penetration-tester, database-architect, devops-engineer, seo-specialist, backend-specialist, qa-automation-engineer, code-archaeologist, explorer-agent, mobile-design, docker-expert, prisma-expert, nestjs-expert, redis-patterns, game-development, server-management, powershell-windows, bash-linux, mcp-builder, geo-fundamentals, i18n-localization, red-team-tactics, tdd-workflow, code-review-checklist, lint-and-validate, app-builder, parallel-agents

---

## SOURCE ARCHITECTURE

### Directory Map
```
src/
├── App.tsx / main.tsx           # Entry + routing
├── pages/                       # Route pages
├── components/
│   ├── screenplay/              # Core: Card, Grid, Modal
│   ├── filters/                 # FilterPanel, SortPanel, CollectionTabs
│   ├── charts/                  # Analytics, score/genre/budget/tier charts
│   ├── comparison/              # Side-by-side, radar, bar/modal
│   ├── export/                  # CSV + PDF export
│   ├── settings/                # Upload, API config, appearance, categories
│   ├── layout/                  # Header, FilterBar
│   ├── ui/                      # Shared primitives
│   ├── share/ notes/ sorting/
├── stores/                      # Zustand: filter, sort, comparison, favorites, notes, upload, theme, apiConfig
├── hooks/                       # useScreenplays, useFilteredScreenplays, useCategories, useUrlState
├── lib/                         # api, analysisService, promptClient, calculations, normalize, pdfParser, utils
├── types/                       # screenplay.ts, screenplay-v6.ts, filters.ts
└── styles/                      # Premium CSS (glassmorphism, gradients, animations)
```

### Data Flow
```
Firebase/API → useScreenplays (React Query) → useFilteredScreenplays (Zustand) → Components
```

### Key Patterns
- **Zustand stores** = UI state. One per domain. All in `src/stores/`.
- **React Query** = server state via `useScreenplays.ts`.
- **Filter pipeline**: `useFilteredScreenplays.ts` composes stores into derived data.
- **Feature folders** with barrel exports (`index.ts`).
- **Two type files**: `screenplay.ts` + `screenplay-v6.ts` — check BOTH before modifying.
- **Tailwind** inline. Custom effects in `src/styles/`.

---

## OPERATING RULES

### Always Apply
- TypeScript strict — no `any`
- Barrel exports in every feature folder
- PascalCase components, camelCase utilities
- Tests next to source files
- Tailwind only — no inline styles or CSS modules
- Zustand = client state, React Query = server state

### Before Coding
1. `npm run build` — compiles?
2. `npm run test:run` — passes?
3. Check `types/screenplay.ts` AND `screenplay-v6.ts` before data changes
4. Check Zustand store before adding local state

### Socratic Gate
Complex/multi-file requests → ask clarifying questions first. Single-file fixes → proceed.

---

## DEPLOYMENT
Firebase Hosting: `npm run deploy`. Config in `.firebaserc`.

## VALIDATION SCRIPTS
```bash
python agent/scripts/checklist.py .                        # Pre-commit
python agent/scripts/verify_all.py . --url http://localhost:3000  # Pre-deploy
```
