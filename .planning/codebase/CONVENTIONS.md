# Coding Conventions

**Analysis Date:** 2026-03-13

## Naming Patterns

**Files:**
- PascalCase for React components: `ScreenplayCard.tsx`, `FilterPanel.tsx`, `ErrorBoundary.tsx`
- camelCase for utility/service files: `filterStore.ts`, `api.ts`, `normalize.ts`, `calculations.ts`, `analysisService.ts`
- PascalCase for directories containing components: `src/components/screenplay/`, `src/components/filters/`
- camelCase for hook files: `useScreenplays.ts`, `useFilteredScreenplays.ts`, `usePosterBackground.ts`
- Store files end with "Store": `filterStore.ts`, `comparisonStore.ts`, `favoritesStore.ts`, `themeStore.ts`
- Test files suffix with `.test.ts` or `.test.tsx`: `filterStore.test.ts`, `ScreenplayCard.test.tsx`

**Functions:**
- React components: PascalCase `function ScreenplayCard()`
- Utility functions: camelCase `export function toNumber()`, `export function canonicalizeGenre()`
- Zustand store methods: camelCase with verb prefix: `setSearchQuery()`, `toggleRecommendationTier()`, `resetFilters()`
- Internal helper functions: camelCase with underscore prefix when private: `const updateRange = () => {}`
- Hook functions: camelCase with `use` prefix: `useScreenplays()`, `useFilteredScreenplays()`
- Event handlers: camelCase with `handle` prefix: `handleSelectClick()`, `handleConfirmDelete()`, `handleTrashClick()`

**Variables:**
- Component props interfaces: PascalCase ending with `Props`: `ScreenplayCardProps`, `FilterPanelProps`
- State variables: camelCase: `isOpen`, `showDeleteConfirm`, `searchQuery`, `selectedCount`
- Constants: SCREAMING_SNAKE_CASE for true constants: `DEFAULT_FILTER_STATE`, `SCREENPLAYS_QUERY_KEY`, `GENRE_CANONICAL_MAP`
- Type aliases and interfaces: PascalCase: `FilterState`, `Screenplay`, `RangeFilter`, `CriticalFailureDetail`

**Types:**
- Interface names: PascalCase, descriptive: `Screenplay`, `FilterState`, `DimensionScores`, `ProducerMetrics`
- Enum-like types (union types): camelCase values with single quotes: `type RecommendationTier = 'film_now' | 'recommend' | 'consider' | 'pass'`
- Type names with "Props": `ScreenplayCardProps`, `FilterPanelProps`
- Zustand store types: `FilterStore`, `ComparisonStore`, `FavoritesStore`

## Code Style

**Formatting:**
- No explicit formatter configured (no Prettier config file detected)
- TypeScript strict mode enforced: `strict: true` in tsconfig
- Line length: appears to follow ~100 character limit based on codebase
- Two-space indentation observed
- No trailing semicolons on JSX closing tags

**Linting:**
- ESLint using flat config: `eslint.config.js`
- Extends: `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- Browser globals configured
- ECMAScript 2020 target
- React Hooks rules enforced via `eslint-plugin-react-hooks`
- React Refresh plugin for HMR
- Run with: `npm run lint`

## Import Organization

**Order:**
1. React and third-party libraries: `import { useState } from 'react'`
2. Third-party packages: `import { create } from 'zustand'`, `import { useQuery } from '@tanstack/react-query'`
3. Type imports: `import type { Screenplay, FilterState } from '@/types'`
4. Local absolute imports: `import { getScoreColorClass } from '@/lib/calculations'`
5. Local relative imports (rare): `import { ProductionBadge } from './ProductionBadge'`

**Path Aliases:**
- `@/*` resolves to `./src/*`
- Prefer absolute imports via `@/` over relative paths
- Example: `import { createTestScreenplay } from '@/test/factories'`

**Barrel Files:**
- Every feature folder has an `index.ts` barrel export
- Example: `src/components/screenplay/index.ts` exports `ScreenplayCard`, `ScreenplayGrid`, `ScreenplayModal`
- Use barrel exports in imports: `import { ScreenplayCard } from '@/components/screenplay'`

## Error Handling

**Patterns:**
- Try/catch blocks with logging: wrap API calls and data parsing
- Named errors with context: `throw new Error('Failed to parse analysis JSON from Claude response')`
- Error messages include context prefix: `[Lemon]`, `[Poster]`, `[ErrorBoundary]` in console logs
- Network errors detected by message substring: `if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))`
- Error Boundary component class available at `src/components/ui/ErrorBoundary.tsx` for React tree errors
- Graceful degradation: missing data returns null, fallback to defaults
- Type guards on caught errors: `analysisErr instanceof Error ? analysisErr.message : 'Unknown error'`

## Logging

**Framework:** Console object (no dedicated logger library)

**Patterns:**
- Context prefixes in square brackets: `console.log('[Lemon] Found 132 screenplays')`
- Warning level: `console.warn('[Poster] Storage upload failed, falling back to data URL:', error)`
- Error level: `console.error('[ErrorBoundary] Caught error:', error)`
- Info logs use `[Lemon]` or feature-specific prefix like `[Poster]`
- Used sparingly in production code, more in service/utility files
- Performance timing captured: `const t0 = performance.now()` in critical paths

## Comments

**When to Comment:**
- Complex algorithms or non-obvious logic paths
- Section dividers using ASCII lines: `// ── Load user-uploaded screenplays from Firestore ────`
- Migration-related code paths: `// ── Pre-migration fallback: fetch static files ──`
- Type guard explanations
- Comments explain *why*, not *what*: code speaks for itself

**JSDoc/TSDoc:**
- File-level JSDoc at top: `/** TypeScript interfaces for Screenplay Analysis Data */`
- Function-level JSDoc for public APIs:
  ```typescript
  /**
   * Hook to fetch all screenplays
   */
  export function useScreenplays() { }

  /**
   * Load all screenplay data.
   * POST-MIGRATION: Reads exclusively from Firestore/localStorage.
   * PRE-MIGRATION:  Falls back to static file fetching + triggers migration.
   */
  export async function loadAllScreenplaysVite() { }
  ```
- Parameter descriptions in JSDoc rarely used; types are explicit
- Zustand store actions documented with single-line comments above methods

## Function Design

**Size:** Keep functions focused, typically 20-50 lines, max ~100 for complex data transformations

**Parameters:**
- Explicit parameters over options objects for simple cases
- Options object for optional parameters: `{ timeout: 60000, reuseExistingServer: true }`
- Type annotations required (strict mode): `(query: string)`, `(range: Partial<RangeFilter>)`
- Destructured props in function signature: `function ScreenplayCard({ screenplay, onClick }: ScreenplayCardProps)`

**Return Values:**
- Explicit return types on public functions: `function useScreenplays(): UseQueryResult`
- Null returned for optional/missing data: `marketPotential: aiData?.marketPotential ?? null`
- Arrays returned for collections: `function getScreenplays(): Screenplay[]`
- Boolean for predicates: `function matchesSearch(sp: Screenplay, query: string): boolean`

## Module Design

**Exports:**
- Barrel files export public API only
- Example `src/components/screenplay/index.ts`:
  ```typescript
  export { ScreenplayCard } from './ScreenplayCard';
  export { ScreenplayGrid } from './ScreenplayGrid';
  export { ScreenplayModal } from './ScreenplayModal';
  ```
- Type exports separate: `export type { Screenplay, FilterState } from '@/types'`
- Private utilities use leading underscore or remain in single file

**Barrel Files:**
- Required pattern: every component/feature folder has `index.ts`
- Centralized exports reduce cross-folder imports
- Types centralized in `src/types/` with barrel at `src/types/index.ts`
- Stores centralized with barrel at `src/stores/index.ts`

## Type Safety

**TypeScript Strict Mode:**
- `strict: true` enforces: no implicit `any`, check functions return, check properties exist
- `noUnusedLocals: true` and `noUnusedParameters: true` prevent dead code
- `noUncheckedSideEffectImports: true` flags modules with side effects
- `noFallthroughCasesInSwitch: true` enforces explicit case handling
- Imports use `import type` for type-only imports to enable proper tree-shaking

**Type Definitions:**
- Always define interfaces for object shapes: `interface FilterState { ... }`
- Union types for enums: `type RecommendationTier = 'film_now' | 'recommend' | 'consider' | 'pass'`
- Partial types for optional updates: `setWeightedScoreRange(range: Partial<RangeFilter>)`
- Avoid `any` — use `unknown` with type guards if needed
- Use `Record<string, T>` for object maps: `Record<string, string>`

## State Management

**Zustand Stores:**
- One store per domain: `filterStore`, `sortStore`, `comparisonStore`, `favoritesStore`, `notesStore`
- Stores located in `src/stores/` with name pattern `{domain}Store.ts`
- Actions defined inline in store creation
- Selectors extracted as separate hooks: `export const useIsSelectedForExport = (id: string) => useExportSelectionStore(s => s.isSelected(id))`
- Persist middleware for user preferences: `persist({ name: 'lemon-filters' })`

**React Query:**
- Server state managed via React Query
- Query key constants defined: `export const SCREENPLAYS_QUERY_KEY = ['screenplays']`
- Hooks in `src/hooks/useScreenplays.ts` wrap useQuery/useMutation
- Stale time: `1000 * 60 * 30` (30 minutes for screenplay data)
- Cache time (gcTime): `1000 * 60 * 60` (1 hour)
- Query invalidation on mutations: `queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY })`

---

*Convention analysis: 2026-03-13*
