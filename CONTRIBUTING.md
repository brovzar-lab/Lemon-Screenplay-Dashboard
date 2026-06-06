# Contributing to Lemon Screenplay Dashboard

## Getting Started

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/brovzar-lab/Lemon-Screenplay-Dashboard.git
   cd Lemon-Screenplay-Dashboard
   npm install
   ```

2. Copy environment config:
   ```bash
   cp .env.example .env
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Strategy

- `main` — Production. Always deployable.
- Feature branches — Create from `main`, prefix with type:
  - `feat/description` — New features
  - `fix/description` — Bug fixes
  - `chore/description` — Maintenance, refactoring

### Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Run checks before pushing:
   ```bash
   npm run lint          # Lint
   npm run build         # TypeScript + build
   npm run test:run      # Unit tests
   ```
4. Push and open a PR against `main`
5. CI will run lint + build + tests automatically
6. After review, merge to `main` → auto-deploys to Firebase Hosting

### Commit Messages

Use conventional commits:
```
feat(component): add screenplay comparison view
fix(normalize): handle missing collection_id field
chore(deps): update firebase to v12.3
docs(readme): add VPS deployment section
```

## Code Standards

### TypeScript

- **Strict mode is on** — no `any`, no implicit returns
- Use proper types from `src/types/screenplay.ts` and `src/types/filters.ts`
- Check BOTH type files before modifying data structures

### Components

- **PascalCase** for components, **camelCase** for utilities
- Every feature folder must have a barrel export (`index.ts`)
- Use Tailwind for styling — no inline styles or CSS modules
- Wrap complex components with `ErrorBoundary`

### State Management

- **Zustand** for client state (UI, filters, preferences)
- **React Query** for server state (Firestore data)
- Don't put server state in Zustand stores
- Check existing stores in `src/stores/` before creating new state

### Testing

- Tests go next to source files: `Component.test.tsx`
- Use Vitest + Testing Library for unit tests
- Use Playwright for E2E tests (in `e2e/` directory)
- Run `npm run test:run` before every PR

## Architecture Quick Reference

```
Firebase/API → useScreenplays (React Query) → useFilteredScreenplays (Zustand) → Components
```

### Key Conventions

- Analysis data flows through `normalize.ts` before reaching components
- The V9 engine writes to Firestore via Admin SDK (bypasses security rules)
- The dashboard reads from Firestore via client SDK (respects security rules)
- Two analysis formats exist: V6 (legacy) and V9 (current). `normalize.ts` handles both.

## Deployment

### Frontend
```bash
npm run deploy  # Builds + deploys to Firebase Hosting
```

### VPS Daemon (Admin only)
```bash
ssh root@187.124.251.98
cd /opt/lemon-ingest
git pull origin main
sudo systemctl restart lemon-daemon
```

## Need Help?

- Check `docs/AGENT-CHEATSHEET.md` for agent-specific patterns
- Check `GEMINI.md` for the full project context and skill routing
- Check `docs/FIREBASE_SETUP.md` for Firebase configuration details
