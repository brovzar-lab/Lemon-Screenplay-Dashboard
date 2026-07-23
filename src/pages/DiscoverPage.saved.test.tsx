import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LensMenu } from '@/components/filters/LensMenu';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useFilterStore } from '@/stores/filterStore';
import { useLensStore } from '@/stores/lensStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useShareStore } from '@/stores/shareStore';
import { useSortStore } from '@/stores/sortStore';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const hookState = vi.hoisted(() => ({
  screenplays: [] as unknown[],
}));

const shareMocks = vi.hoisted(() => ({
  createShareToken: vi.fn(),
  revokeShareToken: vi.fn(),
  getExistingShareToken: vi.fn(),
  getAllSharedViews: vi.fn(),
  isScreenplaySynced: vi.fn(),
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: hookState.screenplays, isLoading: false, error: null }),
  useLiveScreenplaySync: vi.fn(),
  useDeleteScreenplays: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/shareService', () => shareMocks);

import DiscoverPage from '@/pages/DiscoverPage';

function screenplay(id: string, title: string, weightedScore: number): Screenplay {
  return createTestScreenplay({
    id,
    projectId: id,
    sourceFile: `${id}.pdf`,
    title,
    weightedScore,
    recommendation: 'recommend',
    genre: 'Drama',
    themes: ['Family'],
    logline: `${title} tests the limits of a family under pressure.`,
  });
}

function buildScreenplays(): Screenplay[] {
  return [
    screenplay('atlas', 'Atlas Fall', 9.5),
    screenplay('bravo', 'Bravo Room', 8.5),
    screenplay('charlie', 'Charlie North', 7.5),
    screenplay('delta', 'Delta Run', 6.5),
    screenplay('echo', 'Echo Park', 5.5),
    screenplay('foxtrot', 'Foxtrot House', 4.5),
  ];
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/discover']}>
        <Routes>
          <Route path="/discover/:projectId?" element={<DiscoverPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openLenses(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Lenses/ }));
}

async function saveCurrentLens(user: ReturnType<typeof userEvent.setup>, name: string) {
  await openLenses(user);
  await user.type(screen.getByRole('textbox', { name: 'Lens name' }), name);
  await user.click(screen.getByRole('button', { name: 'Save current' }));
}

describe('Discovery saved views and favorites', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.screenplays = buildScreenplays();
    shareMocks.createShareToken.mockReset();
    shareMocks.revokeShareToken.mockReset();
    shareMocks.getExistingShareToken.mockReset().mockResolvedValue(null);
    shareMocks.getAllSharedViews.mockReset().mockResolvedValue([]);
    shareMocks.isScreenplaySynced.mockReset().mockResolvedValue(true);
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
    useSelectionStore.getState().deselectAll();
    useShareStore.getState().clearAll();
    useLensStore.setState({ lenses: [], activeLensId: null });
    useFavoritesStore.setState({ lists: [], quickFavorites: [] });
  });

  it('saves the current Discovery search, filters, and sort as a named view', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByRole('searchbox', { name: 'Discovery search' }), 'Bravo');
    await user.click(screen.getByRole('button', { name: 'RECOMMEND' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort results' }), 'title');
    await saveCurrentLens(user, 'Bravo recommends');

    const saved = useLensStore.getState().lenses[0];
    expect(saved.name).toBe('Bravo recommends');
    expect(saved.snapshot.filters.searchQuery).toBe('Bravo');
    expect(saved.snapshot.filters.recommendationTiers).toEqual(['recommend']);
    expect(saved.snapshot.sort.sortConfigs).toEqual([{ field: 'title', direction: 'asc' }]);
  });

  it('switches back to a saved view after the current find settings change', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByRole('searchbox', { name: 'Discovery search' }), 'Bravo');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort results' }), 'title');
    await saveCurrentLens(user, 'Bravo by title');
    await user.click(screen.getByRole('button', { name: 'Close Lenses' }));

    await user.clear(screen.getByRole('searchbox', { name: 'Discovery search' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort results' }), 'weightedScore');
    await openLenses(user);
    await user.click(screen.getByRole('button', { name: /^Bravo by title/ }));

    expect(screen.getByRole('searchbox', { name: 'Discovery search' })).toHaveValue('Bravo');
    expect(screen.getByRole('combobox', { name: 'Sort results' })).toHaveValue('title');
    expect(await screen.findByRole('heading', { name: 'Bravo Room' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Atlas Fall' })).not.toBeInTheDocument();
  });

  it('deletes a saved view from Discovery', async () => {
    const user = userEvent.setup();
    renderPage();
    await saveCurrentLens(user, 'Temporary lens');

    await user.click(screen.getByRole('button', { name: 'Delete Temporary lens' }));

    expect(useLensStore.getState().lenses).toEqual([]);
    expect(screen.getByText('No saved Lenses yet.')).toBeInTheDocument();
  });

  it('shows a Discovery-created view in the old dashboard Lens menu', async () => {
    const user = userEvent.setup();
    const page = renderPage();
    await saveCurrentLens(user, 'Shared slate view');
    page.unmount();

    render(<LensMenu />);
    await user.click(screen.getByTitle('Saved Lenses'));

    expect(screen.getByRole('button', { name: /^Shared slate view/ })).toBeInTheDocument();
    expect(window.localStorage.getItem('lemon-lenses')).toContain('Shared slate view');
  });

  it('opens a screenplay from a named favorites list', async () => {
    const user = userEvent.setup();
    useFavoritesStore.setState({
      quickFavorites: ['atlas'],
      lists: [
        {
          id: 'weekend',
          name: 'Weekend picks',
          screenplayIds: ['bravo', 'echo'],
          createdAt: '2026-07-22T00:00:00.000Z',
          updatedAt: '2026-07-22T00:00:00.000Z',
        },
      ],
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Favorites/ }));
    await user.click(screen.getByRole('button', { name: /Weekend picks/ }));
    await user.click(screen.getByRole('button', { name: 'Open Bravo Room from favorites' }));

    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Bravo Room' })).toBeInTheDocument(),
    );
  });
});
