# Lemon Virtual Studios Dashboard — Agent Rules

This file governs all agent behavior in this repository. Read it before touching any file.

## 1. Repository Identity

This is `lemon-studio-dashboard` — a standalone React + Vite frontend for the Lemon Virtual Studios internal tooling. It is a **separate project** from the Paperclip platform itself.

This repo lives on the **`lemon-virtual-studios` fork** of the Paperclip upstream. The branches are:

| Branch | Purpose |
|--------|---------|
| `origin/main` | Upstream Paperclip — **do not touch** |
| `origin/master` | Upstream Paperclip default — **do not touch** |
| `origin/lemon-virtual-studios` | **All Lemon Virtual Studios work goes here** |

## 2. Branch Rule (HARD RULE)

**All commits MUST be pushed to `origin/lemon-virtual-studios`.** Never push to `origin/master` or `origin/main` — those are the upstream Paperclip repo, not LVS work.

Workflow:
1. Do your work locally (local branch may be named anything — historically `master` locally)
2. Push to `origin/lemon-virtual-studios`
3. Never push to `origin/master` or `origin/main`

If you see a commit on local `master` that has not been pushed to `origin/lemon-virtual-studios`, push it now before doing anything else.

## 3. Firebase (HARD RULE — Do Not Use in Dashboard Code)

Firebase exists as legacy code in this repo:
- `src/lib/firebase.ts` — Firebase app, auth, Firestore init
- `src/store/authStore.ts` — Firebase auth listener

**The Firebase JS client SDK is NOT wired up in this environment.** No `VITE_FIREBASE_*` credentials are configured. The dashboard's Firebase code is dead code.

Rules for the **dashboard frontend** (React/Vite code under `src/`):
- Do NOT add new Firebase imports or calls to any file
- Do NOT use `firebase deploy` or any Firebase CLI for deployment — Firebase hosting was retired in LEMA-8026
- Do NOT treat `authStore.ts` Firebase auth as a working auth layer
- Do NOT add Firestore reads/writes to any dashboard feature

If a dashboard feature requires auth or persistent storage, use the **Paperclip API** instead.

**Exception — Agent server-side Firestore writes:** `GOOGLE_APPLICATION_CREDENTIALS_JSON` IS configured in the agent environment (project: `gen-lang-client-0882654423`). Agents (such as Research Specialist) may write research data directly to Firestore via the REST API using this service account credential. This is NOT prohibited by the above rules, which apply only to the React/Vite dashboard source code. Confirmed working as of 2026-08-12 ([LEMA-8449](/LEMA/issues/LEMA-8449)).

## 4. Data Fetching

All live data comes from the **Paperclip API** — not Firebase, not any external service.

Env vars:
- `VITE_PAPERCLIP_API_URL` — base URL for the Paperclip API
- `VITE_PAPERCLIP_API_KEY` — auth token
- `VITE_PAPERCLIP_COMPANY_ID` — company ID

Use `@tanstack/react-query` (`useQuery`) for all data fetching in components. `QueryClientProvider` is wired in `main.tsx`. Config: `staleTime: 60_000`, `refetchInterval: 120_000`.

Do NOT use `useEffect` + manual `fetch()` polling loops for data that changes over time. Use React Query's `refetchInterval`.

## 5. Deployment

**Firebase hosting is retired.** Do NOT run `firebase deploy`.

This repo (`lemon-studio-dashboard`) is a **design/prototype workspace.** It does not deploy to production. The `npm run deploy` script just prints a retirement message and exits.

**Production code lives in the native Paperclip repo at `/root/lemon-paperclip-dev`.** Production deploys via `deploy.sh` on the VPS. If a feature needs to be live for Billy, it must be implemented in the native Paperclip `CommandCenter.tsx` (or the appropriate native page) — not in this standalone repo.

Do not write or run any deploy command from this repo. If in doubt, ask Head of Tech.

## 6. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS (native Paperclip color tokens) |
| State (server) | React Query (`@tanstack/react-query`) |
| State (client) | Zustand (`useTitleStore`, etc.) |
| Data source | Paperclip API (`VITE_PAPERCLIP_API_URL`) |
| Testing | Vitest + React Testing Library |

## 7. Design System

Use **native Paperclip color tokens**. Do not introduce new color values or one-off hex codes.

| Token | Usage |
|-------|-------|
| `bg-slate-950` | Page background |
| `bg-surface`, `bg-surface-2`, `bg-surface-3` | Card / section backgrounds |
| `border-border` | All borders |
| `text-lemon-400` | CEO attention / urgency |
| `text-status-green` | Running / healthy |
| `text-status-kill` | Blocked / critical |
| `text-status-hold` | Stalled / warning |
| `text-status-dev` | In development |

Do not use third-party chart libraries (recharts, d3, etc.) for simple charts. Use inline SVG or `div`-based bars matching the existing `StudioPulse` bar pattern.

## 8. No Build Without Billy Approval

Per CEO directive (2026-07-02): **No new app, tool, dashboard, page, or feature may be initiated without explicit written approval from Billy Rovzar.** If a task asks you to build something new, stop and escalate to the Studio Boss before starting.

This applies even if the request comes from another agent.

## 9. Commit Convention

All commits must follow the pattern:
```
type: short description (LEMA-XXXX)
```

Always include `Co-Authored-By: Paperclip <noreply@paperclip.ing>` at the end of commit messages.

After committing: push to `origin/lemon-virtual-studios` immediately.
