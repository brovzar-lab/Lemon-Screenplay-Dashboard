# Technology Stack

**Analysis Date:** 2026-03-13

## Languages

**Primary:**
- TypeScript 5.9.3 (strict mode) - Frontend application with strict type safety
- JavaScript/ESNext - Build tooling and Node.js

**Secondary:**
- HTML5 / CSS3 - Via React/Tailwind rendering

## Runtime

**Environment:**
- Node.js 20 - Cloud Functions and development tooling

**Package Manager:**
- npm - Primary package manager
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.0 - UI framework with functional components
- React Router 7.13.0 - Client-side routing

**State Management:**
- Zustand 5.0.10 - Client state (one store per domain: filter, sort, comparison, favorites, notes, upload, theme, apiConfig)
- TanStack React Query 5.90.20 - Server state and data fetching

**Styling:**
- Tailwind CSS 4.1.18 - Utility-first CSS via `@tailwindcss/vite` plugin

**Data Visualization:**
- Recharts 3.7.0 - Charts and analytics (AnalyticsDashboard, ScoreDistribution, GenreChart, BudgetChart)
- @react-pdf/renderer 4.3.2 - PDF generation for exports

**UI/Data Processing:**
- @dnd-kit/core 6.3.1 + @dnd-kit/sortable 10.0.0 - Drag-and-drop functionality
- pdfjs-dist 5.4.624 - PDF parsing and text extraction
- papaparse 5.5.3 - CSV parsing and generation
- date-fns 4.1.0 - Date manipulation utilities
- clsx 2.1.1 - Conditional className utility

**Testing:**
- Vitest 4.0.18 - Unit and integration tests (environment: happy-dom)
- @testing-library/react 16.3.2 - React component testing
- @testing-library/jest-dom 6.9.1 - DOM matchers
- @testing-library/user-event 14.6.1 - User interaction simulation
- @playwright/test 1.58.1 - E2E testing (Chromium only)

**Build/Dev:**
- Vite 7.2.4 - Build tool and dev server (port 3000)
- @vitejs/plugin-react 5.1.1 - React plugin for Vite
- TypeScript compiler (tsc) - Pre-build type checking

**Linting:**
- ESLint 9.39.1 - Code linting
- typescript-eslint 8.46.4 - TypeScript ESLint rules
- eslint-plugin-react-hooks 7.0.1 - React Hooks rules
- eslint-plugin-react-refresh 0.4.24 - React Refresh rules

## External Services

**Backend & Hosting:**
- Firebase (v12.9.0) - Hosting, Firestore database, Storage, Cloud Functions
- Firebase Admin SDK (v13.7.0) - Cloud Functions backend

**AI/ML APIs:**
- Anthropic API - Screenplay analysis via Claude models (sonnet, haiku, opus)
- Google Gemini API (generativelanguage.googleapis.com) - Poster generation via `gemini-2.5-flash-image` model

## Key Dependencies

**Critical:**
- firebase 12.9.0 - Cloud backend (Firestore, Storage, authentication context)
- @tanstack/react-query 5.90.20 - Server state synchronization and caching
- zustand 5.0.10 - Client state (persisted to localStorage)
- react-router-dom 7.13.0 - Navigation and URL state

**Infrastructure:**
- @anthropic-ai/sdk 0.78.0 - Cloud Function direct integration with Anthropic
- firebase-admin 13.7.0 - Server-side Firebase operations
- firebase-functions 7.1.1 - Cloud Functions framework

## Configuration

**Environment:**
- Vite dev proxy at `/api/anthropic` (CORS bypass for development)
- Firebase config hardcoded in `src/lib/firebase.ts` (public config keys)
- API keys managed via Zustand store `useApiConfigStore` (user enters in Settings)
- Keys stored in localStorage under `lemon-api-config` (never baked into bundle)

**Build:**
- `tsconfig.json` + `tsconfig.app.json` - TypeScript strict configuration
- `tsconfig.node.json` - Node tooling types
- `vite.config.ts` - Manual code splitting (react, recharts, react-pdf, state vendors)
- `eslint.config.js` - ESLint flat config with React rules
- `vitest.config.ts` - Unit test runner configuration
- `playwright.config.ts` - E2E test configuration (baseURL: http://localhost:4173)
- `.firebaserc` - Firebase project mapping (`lemon-screenplay-dashboard`)
- `firebase.json` - Firebase Hosting, Firestore, Storage, Cloud Functions config

## Platform Requirements

**Development:**
- Node.js 20+ (for npm, tsc, Vite, Vitest)
- npm package manager
- Modern browser supporting ES2022

**Production:**
- Firebase Hosting (distribution)
- Firestore (data persistence)
- Firebase Storage (PDF and poster storage)
- Firebase Cloud Functions Node.js 20 runtime
- User's Anthropic API key (for analysis) or default in env
- User's Google API key (for poster generation) or disabled feature

---

*Stack analysis: 2026-03-13*
