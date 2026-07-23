import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useFilterStore } from '@/stores/filterStore';
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

async function select(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole('button', { name: `Select ${title}` }));
}

describe('Discovery bulk actions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.screenplays = buildScreenplays();
    shareMocks.createShareToken.mockReset().mockImplementation(async (id: string) => ({
      token: `token-${id}`,
      url: `http://localhost:3000/share/token-${id}`,
      expiresAt: '2099-07-22T00:00:00.000Z',
    }));
    shareMocks.revokeShareToken.mockReset();
    shareMocks.getExistingShareToken.mockReset().mockResolvedValue(null);
    shareMocks.getAllSharedViews.mockReset().mockResolvedValue([]);
    shareMocks.isScreenplaySynced.mockReset().mockResolvedValue(true);
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
    useSelectionStore.getState().deselectAll();
    useShareStore.getState().clearAll();
    useFavoritesStore.setState({ lists: [], quickFavorites: [] });
  });

  it('selects featured, shelf, and grid cards and preserves selection through find changes', async () => {
    const user = userEvent.setup();
    renderPage();

    await select(user, 'Atlas Fall');
    await select(user, 'Bravo Room');
    await select(user, 'Foxtrot House');

    expect(screen.getByText('3 screenplays selected')).toBeInTheDocument();
    expect(useSelectionStore.getState().selectedIds).toEqual(
      new Set(['atlas', 'bravo', 'foxtrot']),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Discovery search' }), 'Atlas Fall');
    await waitFor(() => expect(screen.queryByText('Bravo Room')).not.toBeInTheDocument());
    expect(screen.getByText('3 screenplays selected')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort results' }), 'title');
    await user.clear(screen.getByRole('searchbox', { name: 'Discovery search' }));

    expect(await screen.findByRole('button', { name: 'Deselect Atlas Fall' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deselect Bravo Room' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deselect Foxtrot House' })).toBeInTheDocument();
  });

  it('generates links for the selection through the existing bulk share modal', async () => {
    const user = userEvent.setup();
    renderPage();
    await select(user, 'Atlas Fall');
    await select(user, 'Bravo Room');

    await user.click(screen.getByRole('button', { name: 'Bulk share links' }));

    expect(await screen.findByText('http://localhost:3000/share/token-atlas')).toBeInTheDocument();
    expect(await screen.findByText('http://localhost:3000/share/token-bravo')).toBeInTheDocument();
    expect(shareMocks.createShareToken).toHaveBeenCalledWith(
      'atlas',
      expect.objectContaining({ title: 'Atlas Fall' }),
      false,
    );
    expect(shareMocks.createShareToken).toHaveBeenCalledWith(
      'bravo',
      expect.objectContaining({ title: 'Bravo Room' }),
      false,
    );
  });

  it('adds the selection through the existing favorites modal', async () => {
    const user = userEvent.setup();
    renderPage();
    await select(user, 'Atlas Fall');
    await select(user, 'Foxtrot House');

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }));
    await user.click(screen.getByRole('button', { name: 'Add to Favorites' }));

    expect(useFavoritesStore.getState().quickFavorites).toEqual(['atlas', 'foxtrot']);
  });

  it('clears the selection from the bar', async () => {
    const user = userEvent.setup();
    renderPage();
    await select(user, 'Atlas Fall');
    await select(user, 'Bravo Room');

    await user.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    expect(screen.queryByText(/screenplays? selected/)).not.toBeInTheDocument();
  });

  it('closes the drawer before Escape clears the selection', async () => {
    const user = userEvent.setup();
    renderPage();
    await select(user, 'Atlas Fall');
    await user.click(screen.getByRole('button', { name: 'Open Atlas Fall details' }));
    expect(await screen.findByRole('dialog', { name: 'Atlas Fall' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(useSelectionStore.getState().selectedIds).toEqual(new Set(['atlas']));
    expect(screen.getByText('1 screenplay selected')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
  });
});
