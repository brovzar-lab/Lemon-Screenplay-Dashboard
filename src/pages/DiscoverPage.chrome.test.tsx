import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterStore } from '@/stores/filterStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSortStore } from '@/stores/sortStore';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const hookState = vi.hoisted(() => ({
  screenplays: [] as unknown[],
  isLoading: false,
  error: null as Error | null,
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({
    data: hookState.screenplays,
    isLoading: hookState.isLoading,
    error: hookState.error,
  }),
  useLiveScreenplaySync: vi.fn(),
  useDeleteScreenplays: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/components/layout/SyncStatusIndicator', () => ({
  SyncStatusIndicator: () => <span>Live sync</span>,
}));

vi.mock('@/components/auth', () => ({
  UserMenu: () => <button type="button">Account</button>,
}));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => true,
}));

vi.mock('@/lib/shareService', () => ({
  getAllSharedViews: vi.fn().mockResolvedValue([]),
  getExistingShareToken: vi.fn().mockResolvedValue(null),
  isScreenplaySynced: vi.fn().mockResolvedValue(true),
  createShareToken: vi.fn(),
  revokeShareToken: vi.fn(),
}));

import DiscoverPage from '@/pages/DiscoverPage';

function screenplay(id: string, title: string, weightedScore: number): Screenplay {
  return createTestScreenplay({
    id,
    projectId: id,
    sourceFile: `${id}.pdf`,
    title,
    weightedScore,
    recommendation: id === 'atlas' ? 'film_now' : 'recommend',
    isFilmNow: id === 'atlas',
  });
}

function makeRouter(initialEntries: string[], initialIndex?: number) {
  return createMemoryRouter(
    [
      {
        path: '/discover/:projectId?',
        element: <DiscoverPage />,
      },
      {
        path: '/settings',
        element: <div>Settings destination</div>,
      },
    ],
    { initialEntries, initialIndex },
  );
}

function renderRouter(router: ReturnType<typeof makeRouter>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Discovery app shell and route state', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.screenplays = [
      screenplay('atlas', 'Atlas Fall', 9.4),
      screenplay('bravo', 'Bravo Room', 8.25),
    ];
    hookState.isLoading = false;
    hookState.error = null;
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
  });

  it('opens the correct real screenplay from a direct project link', async () => {
    const router = makeRouter(['/discover/bravo']);
    renderRouter(router);

    expect(await screen.findByRole('dialog', { name: 'Bravo Room' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/discover/bravo');
  });

  it('browser back closes the drawer and leaves Discovery open', async () => {
    const router = makeRouter(['/discover', '/discover/bravo'], 1);
    renderRouter(router);
    await screen.findByRole('dialog', { name: 'Bravo Room' });

    await act(async () => {
      await router.navigate(-1);
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/discover');
    expect(screen.getByRole('heading', { name: 'Discover' })).toBeInTheDocument();
  });

  it.each([
    ['loading', true, null, []],
    ['empty', false, null, []],
    ['error', false, new Error('offline'), []],
  ] as const)(
    'keeps the app header visible in the %s state',
    async (_state, loading, error, data) => {
      hookState.isLoading = loading;
      hookState.error = error;
      hookState.screenplays = [...data];
      const router = makeRouter(['/discover']);

      renderRouter(router);

      expect(await screen.findByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Discovery navigation' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Discover' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    },
  );
});
