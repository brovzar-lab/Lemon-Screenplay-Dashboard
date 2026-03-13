# Testing Patterns

**Analysis Date:** 2026-03-13

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`
- Environment: `happy-dom` (lightweight DOM implementation)
- Globals enabled: `describe`, `it`, `expect`, `beforeEach` available without import

**Assertion Library:**
- Vitest built-in assertions via `expect()`
- Testing Library matchers via `@testing-library/jest-dom` (v6.9.1)
- Matchers include: `toBeInTheDocument()`, `toBeVisible()`, `toHaveValue()`

**Run Commands:**
```bash
npm run test              # Watch mode (interactive Vitest)
npm run test:run         # Single run (CI mode)
npm run test:coverage    # Coverage report (v8 provider, HTML output)
npm run test:e2e         # Playwright e2e tests
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:headed  # Playwright headed mode
```

## Test File Organization

**Location:**
- Co-located with source files (same directory)
- Test files next to source: `src/stores/filterStore.ts` → `src/stores/filterStore.test.ts`
- E2E tests separate: `e2e/dashboard.spec.ts`
- Test setup: `src/test/setup.ts` for global test configuration
- Test factories: `src/test/factories.ts` for shared mock builders

**Naming:**
- `.test.ts` for unit tests of utilities and hooks
- `.test.tsx` for component tests
- `.spec.ts` for e2e tests (Playwright)

**Structure:**
```
src/
├── stores/
│   ├── filterStore.ts
│   └── filterStore.test.ts          # Tests co-located
├── components/
│   ├── screenplay/
│   │   ├── ScreenplayCard.tsx
│   │   └── ScreenplayCard.test.tsx  # Tests in same dir
├── hooks/
│   ├── useFilteredScreenplays.ts
│   └── useFilteredScreenplays.test.ts
├── lib/
│   ├── calculations.ts
│   ├── calculations.test.ts
│   └── normalize.test.ts
└── test/
    ├── setup.ts                      # Global test setup
    └── factories.ts                  # Shared mock factories
```

## Test Structure

**Suite Organization:**
```typescript
describe('filterStore', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
  });

  describe('searchQuery', () => {
    it('sets search query', () => {
      const { setSearchQuery } = useFilterStore.getState();
      setSearchQuery('thriller');
      expect(useFilterStore.getState().searchQuery).toBe('thriller');
    });
  });

  describe('recommendationTiers', () => {
    it('toggles recommendation tier on', () => {
      const { toggleRecommendationTier } = useFilterStore.getState();
      toggleRecommendationTier('film_now');
      expect(useFilterStore.getState().recommendationTiers).toContain('film_now');
    });
  });
});
```

**Patterns:**
- `describe()` for test grouping (mirrors functionality areas)
- Nested `describe()` blocks for related test groups
- `it()` for individual test cases with descriptive names
- `beforeEach()` for setup (especially Zustand store reset)
- No `afterEach()` in most tests; Zustand cleanup via reset methods

## Mocking

**Framework:** Vitest `vi` module

**Patterns:**
```typescript
// Mock Zustand stores
vi.mock('@/stores/comparisonStore', () => ({
  useComparisonStore: () => vi.fn(),
  useIsSelectedForComparison: () => false,
  useIsComparisonFull: () => false,
}));

// Mock hooks with return values
vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [], isLoading: false }),
  useDeleteScreenplays: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  SCREENPLAYS_QUERY_KEY: ['screenplays'],
}));

// Clear mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
```

**What to Mock:**
- React Query hooks (they require QueryClientProvider): mock return values
- Zustand stores that depend on persistence or complex initialization
- External API calls (not tested at unit level)
- Component children/prop handlers that are complex

**What NOT to Mock:**
- Pure utility functions like `toNumber()`, `canonicalizeGenre()`
- Data transformation functions like `normalizeScreenplay()`
- Store state directly — reset via `resetFilters()` or equivalent
- Test factories — import and use directly

## Fixtures and Factories

**Test Data Pattern:**
Located at `src/test/factories.ts`, provides type-complete mock builders:

```typescript
export function createTestScreenplay(overrides: Partial<Screenplay> = {}): Screenplay {
    return {
        id: 'test-id',
        title: 'Test Screenplay',
        author: 'Test Author',
        logline: 'A gripping tale that tests our components.',
        genre: 'Drama',
        subgenres: ['Indie'],
        themes: ['Identity', 'Family'],
        tone: 'Atmospheric',
        // ... 50+ fields with sensible defaults ...
        dimensionScores: { concept: 7, structure: 7, /* ... */ },
        // Override any field as needed
        ...overrides,
    } as Screenplay;
}
```

**Usage:**
```typescript
const screenplay = createTestScreenplay({ title: 'The Test Movie', author: 'John Doe' });
const thrillerScreenplay = createTestScreenplay({ genre: 'Thriller', budgetCategory: 'high' });
```

**Patterns:**
- Factories return fully populated objects with sensible defaults
- All required fields pre-populated to avoid TypeScript errors
- Override only fields relevant to your test
- Update factory when interface changes (note at top of `factories.ts`)

## Coverage

**Requirements:** Not enforced at CI level (no coverage thresholds in config)

**Configuration (vitest.config.ts):**
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/lib/**/*.ts'],  // Only lib utilities tracked
}
```

**View Coverage:**
```bash
npm run test:coverage    # Generates HTML report
# Open coverage/index.html in browser
```

**Target Areas:**
- `src/lib/` utilities have highest coverage (pure functions)
- Component tests cover main interaction paths
- Store tests cover action methods
- E2E tests cover critical user flows

## Test Types

**Unit Tests:**
- **Scope:** Single function or component in isolation
- **Location:** `src/lib/`, `src/stores/`, component files
- **Setup:** Factories for test data, mocks for dependencies
- **Examples:**
  - `calculations.test.ts`: pure function tests like `getScoreColorClass()`
  - `normalize.test.ts`: data transformation functions
  - `filterStore.test.ts`: Zustand actions and state mutations

**Integration Tests:**
- **Scope:** Multiple components/hooks working together
- **Examples:**
  - `useFilteredScreenplays.test.ts`: filter + sort pipeline (functions extracted from hook)
  - `ScreenplayCard.test.tsx`: card rendering with store integration
  - `FilterPanel.test.tsx`: filter UI with store mutations

**E2E Tests:**
- **Framework:** Playwright 1.58.1
- **Config:** `playwright.config.ts`
- **Location:** `e2e/dashboard.spec.ts`
- **Scope:** Full user workflows in browser
- **Examples:**
  - Page load with screenplay grid visible
  - Search filtering updates
  - Filter chips applying filters
  - Sorting screenplay lists
  - Modal opening/closing
  - Export/delete actions (via mock)
- **Setup:**
  ```typescript
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible({ timeout: 60000 });
  });
  ```
- **Timeouts:** Extended to 90 seconds for data-heavy tests

## Common Patterns

**Async Testing (Vitest):**
```typescript
it('loads screenplays on mount', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useScreenplays());

  expect(result.current.isLoading).toBe(true);

  await waitForNextUpdate();

  expect(result.current.data).toHaveLength(132);
});

// Or with React Testing Library:
it('renders loaded screenplay data', async () => {
  render(<ScreenplayGrid />);

  const screenplay = await screen.findByText('Test Screenplay');
  expect(screenplay).toBeInTheDocument();
});
```

**Store Testing (Zustand):**
```typescript
describe('filterStore', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
  });

  it('toggles recommendation tier', () => {
    const { toggleRecommendationTier } = useFilterStore.getState();
    toggleRecommendationTier('film_now');

    expect(useFilterStore.getState().recommendationTiers).toContain('film_now');
  });
});
```

**Component Testing (Testing Library):**
```typescript
it('renders screenplay title and author', () => {
  const screenplay = createTestScreenplay({
    title: 'The Test Movie',
    author: 'John Doe'
  });
  render(<ScreenplayCard screenplay={screenplay} />);

  expect(screen.getByText('The Test Movie')).toBeInTheDocument();
  expect(screen.getByText('by John Doe')).toBeInTheDocument();
});

it('calls onClick when card is clicked', async () => {
  const handleClick = vi.fn();
  const screenplay = createTestScreenplay();
  render(<ScreenplayCard screenplay={screenplay} onClick={handleClick} />);

  await userEvent.click(screen.getByText(screenplay.title));
  expect(handleClick).toHaveBeenCalled();
});
```

**Error Testing:**
```typescript
it('handles API errors gracefully', async () => {
  const { result } = renderHook(() => useScreenplays());

  // Mock error response
  global.fetch = vi.fn(() =>
    Promise.reject(new Error('Network error'))
  );

  await waitForNextUpdate();

  expect(result.current.error).toBeDefined();
});
```

**Mock Factory Pattern:**
```typescript
function createMockScreenplay(overrides: Partial<Screenplay> = {}): Screenplay {
    return {
        id: 'test-id',
        title: 'Test Screenplay',
        // ... defaults ...
        ...overrides,
    } as Screenplay;
}

// Usage
const testScreenplay = createMockScreenplay({
  title: 'Dark Waters',
  author: 'Mark Ruffalo',
  genre: 'Drama'
});
```

## Global Test Setup

**File:** `src/test/setup.ts`

**Mocks provided:**
- `window.matchMedia()` — for responsive design tests
- `ResizeObserver` — for layout-dependent components
- `IntersectionObserver` — for scroll visibility tests
- `localStorage` — full Storage API mock (required for Zustand persist middleware)

**Why needed:** happy-dom doesn't implement these browser APIs, tests would fail without mocks.

## Test Commands in CI

Based on `package.json` scripts:

```bash
# Unit tests (single run)
npm run test:run

# Unit tests with coverage
npm run test:coverage

# E2E tests (after npm run preview)
npm run test:e2e
```

**CI considerations:**
- E2E tests retry twice on failure
- E2E workers set to 1 (serial) in CI mode
- Screenshots captured on e2e failure
- Trace recording on first retry

---

*Testing analysis: 2026-03-13*
