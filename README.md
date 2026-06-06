# 🍋 Lemon Screenplay Dashboard

> AI-powered screenplay analysis platform for Lemon Studios. Ingests screenplays, runs multi-pass AI analysis via the **V9 Archaeology Engine**, and provides filtering, scoring, comparison, analytics, PDF export, and shareable partner links.

[![CI](https://github.com/brovzar-lab/Lemon-Screenplay-Dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/brovzar-lab/Lemon-Screenplay-Dashboard/actions/workflows/ci.yml)
[![Deploy](https://github.com/brovzar-lab/Lemon-Screenplay-Dashboard/actions/workflows/deploy.yml/badge.svg)](https://github.com/brovzar-lab/Lemon-Screenplay-Dashboard/actions/workflows/deploy.yml)

**Live:** https://lemon-screenplay-dashboard.web.app

---

## Stack

| Layer | Technology |
|-------|-----------|
| **UI** | React 19, TypeScript (strict), Vite 7, Tailwind CSS 4 |
| **Client State** | Zustand 5 |
| **Server State** | TanStack React Query 5 |
| **Charts** | Recharts 3 |
| **PDF** | @react-pdf/renderer (export), pdfjs-dist (parse) |
| **Backend** | Firebase 12 — Firestore, Storage, Auth, Hosting |
| **Cloud Functions** | Node 22 (Anthropic proxy endpoint) |
| **Analysis Engine** | V9 Archaeology Engine (Python, runs on VPS) |
| **Testing** | Vitest 4 (unit), Playwright 1.58 (E2E) |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/brovzar-lab/Lemon-Screenplay-Dashboard.git
cd Lemon-Screenplay-Dashboard

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your Firebase + API keys (see below)

# 4. Start dev server
npm run dev
# Open http://localhost:5173
```

### Environment Variables

Create `.env` from `.env.example`:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase Storage bucket (e.g. `lemon-screenplay-dashboard.firebasestorage.app`) |
| `VITE_ANTHROPIC_API_KEY` | Dev only | Anthropic key for dev proxy. Production uses Cloud Function proxy |
| `VITE_GOOGLE_API_KEY` | Optional | Google API key for Gemini (poster generation + AI chat) |

> **Note:** Firebase config (apiKey, projectId, etc.) is hardcoded in `src/lib/firebase.ts`. This is standard for Firebase web apps — these are public identifiers, not secrets.

---

## Commands

```bash
npm run dev              # Dev server (Vite, port 5173)
npm run build            # TypeScript check + production build
npm run test:run         # Unit tests (Vitest)
npm run test:e2e         # E2E tests (Playwright, needs preview server)
npm run lint             # ESLint
npm run deploy           # Build + Firebase Hosting deploy
npm run deploy:functions # Deploy Cloud Functions only
```

---

## Architecture

### Data Flow

```
PDF Upload → Firebase Storage → Ingest Queue (Firestore)
                                       ↓
                              VPS Daemon (Python)
                                       ↓
                            V9 Archaeology Engine
                           (5 readers + synthesis)
                                       ↓
                        Firestore (uploaded_analyses)
                                       ↓
              React Dashboard ← useScreenplays (React Query)
                                       ↓
                         useFilteredScreenplays (Zustand)
                                       ↓
                        ScreenplayGrid → ScreenplayCard
```

### Analysis Pipeline — V9 Archaeology Engine

The V9 engine runs **5 parallel specialist readers** plus a synthesis pass:

| Reader | Weight | What It Analyzes |
|--------|--------|-----------------|
| **Structure** | 20% | Plot architecture, pacing, act breaks, setup/payoff |
| **Character** | 25% | Protagonist depth, arcs, relationships, ensemble |
| **Concept** | 20% | Premise originality, commercial viability, hook |
| **Craft & Scene** | 15% | Dialogue, visual storytelling, scene construction |
| **Emotional Resonance** | 20% | Emotional engagement, stakes, audience connection |

**V9-specific features:**
- Code-computed pillar scores (prevents LLM arithmetic errors)
- Code-computed weighted scores with cross-validation
- Triage pre-screen (fast Haiku pass before full analysis)
- TMDB integration for produced-film detection
- 11 false-positive traps for score inflation

### Source Map

```
src/
├── App.tsx / main.tsx           # Entry + routing
├── pages/                       # Route pages (Dashboard, Settings, Analytics)
├── components/
│   ├── screenplay/              # Core: Card, Grid, Modal, VirtualRow
│   ├── filters/                 # FilterPanel, SortPanel, CollectionTabs
│   ├── charts/                  # Analytics, score/genre/budget/tier charts
│   ├── comparison/              # Side-by-side radar, bar, modal
│   ├── export/                  # CSV + PDF export
│   ├── settings/                # Upload, API config, appearance, categories
│   ├── layout/                  # Header, FilterBar
│   └── ui/                      # Shared primitives (ErrorBoundary, etc.)
├── stores/                      # Zustand: filter, sort, comparison, favorites, etc.
├── hooks/                       # useScreenplays, useFilteredScreenplays, etc.
├── lib/                         # api, normalize, calculations, pdfParser, utils
├── types/                       # screenplay.ts, screenplay-v6.ts, filters.ts
└── styles/                      # Premium CSS (glassmorphism, gradients)
```

---

## VPS Daemon (Python)

The analysis daemon runs on a Hostinger VPS at `/opt/lemon-ingest`, managed by `systemd`.

```bash
# SSH into VPS
ssh root@187.124.251.98

# Check daemon status
systemctl status lemon-daemon

# View logs
tail -f /var/log/lemon-daemon/daemon.log

# Restart after code changes
cd /opt/lemon-ingest && git pull origin main && sudo systemctl restart lemon-daemon
```

### Daemon Requirements

| Dependency | Location |
|-----------|----------|
| Python 3.12+ | System |
| Firebase service account | `/opt/lemon-ingest/service-account.json` |
| `ANTHROPIC_API_KEY` | Environment (set in systemd unit) |
| Virtual environment | `/opt/lemon-ingest/venv/` |

---

## Deployment

### Frontend (Firebase Hosting)

```bash
npm run deploy
# Builds → uploads to Firebase → live at https://lemon-screenplay-dashboard.web.app
```

### VPS Daemon

```bash
ssh root@187.124.251.98
cd /opt/lemon-ingest
git pull origin main
sudo systemctl restart lemon-daemon
```

### Firebase Project

- **Project ID:** `lemon-screenplay-dashboard`
- **Console:** https://console.firebase.google.com/project/lemon-screenplay-dashboard
- **Config:** `.firebaserc`, `firebase.json`

---

## Testing

```bash
# Unit tests
npm run test:run

# Unit tests in watch mode
npm run test

# E2E tests (starts preview server automatically)
npm run test:e2e

# Lint
npm run lint

# Type check
npx tsc -b
```

**Test coverage** is scoped to `src/lib/` (core business logic). 37 test files, 458+ tests.

---

## Key Files

| File | Purpose |
|------|---------|
| `daemon.py` | VPS ingest daemon (polls Firestore queue, runs V9 engine) |
| `execution/ingest_v9.py` | V9 analysis engine (5 readers + synthesis) |
| `src/lib/normalize.ts` | Normalizes V6/V9 analysis formats for dashboard |
| `src/lib/calculations.ts` | Score computations, tier assignments |
| `src/hooks/useScreenplays.ts` | React Query hook for loading screenplays |
| `src/hooks/useFilteredScreenplays.ts` | Filter/sort pipeline using Zustand |
| `src/stores/filterStore.ts` | Filter state management |

---

## License

Private — Lemon Studios. All rights reserved.
