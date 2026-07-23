import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('@react-pdf/renderer', () => ({ pdf: vi.fn() }));
vi.mock('@/components/export/PdfDocument', () => ({ PdfDocument: () => null }));

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

describe('Discovery Compact Shelf surface smoke tests', () => {
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
    useLensStore.setState({ lenses: [], activeLensId: null });
    useFavoritesStore.setState({ lists: [], quickFavorites: [] });
  });

  it('keeps the drawer close behavior while presenting every reused analysis panel as Discovery', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Open Atlas Fall details' }));

    const drawer = await screen.findByRole('dialog', { name: 'Atlas Fall' });
    expect(drawer).toHaveAttribute('data-presentation', 'discovery');
    expect(within(drawer).getByTestId('discovery-scores-panel')).toBeInTheDocument();
    expect(within(drawer).getByTestId('discovery-content-details')).toBeInTheDocument();
    expect(within(drawer).getByTestId('discovery-notes-panel')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Atlas Fall' })).not.toBeInTheDocument());
  });

  it('keeps share and export controls working inside their Discovery-styled surfaces', async () => {
    const user = userEvent.setup();
    useShareStore.getState().setToken('atlas.pdf', {
      token: 'existing-atlas',
      screenplayId: 'atlas.pdf',
      screenplayTitle: 'Atlas Fall',
      includeNotes: false,
      createdAt: '2026-07-22T00:00:00.000Z',
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Open Atlas Fall details' }));

    await user.click(await screen.findByRole('button', { name: 'Share' }));
    expect(screen.getByTestId('share-popover')).toHaveAttribute('data-presentation', 'discovery');
    await user.click(screen.getByRole('button', { name: 'Close popover' }));

    await user.click(screen.getByRole('button', { name: 'Pitch-deck PDF' }));
    const exportModal = await screen.findByTestId('export-modal');
    expect(within(exportModal).getByTestId('export-modal-surface')).toHaveAttribute(
      'data-presentation',
      'discovery',
    );
    await user.click(within(exportModal).getByRole('button', { name: 'Cancel' }));
  });

  it('keeps selection, favorites, and bulk sharing behavior inside the restyled bar and modals', async () => {
    const user = userEvent.setup();
    for (let index = 1; index <= 12; index += 1) {
      useFavoritesStore.getState().createList(`Producer List ${index}`);
    }
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Select Atlas Fall' }));
    await user.click(screen.getByRole('button', { name: 'Select Foxtrot House' }));

    const selectionBar = screen.getByRole('region', { name: 'Discovery selection actions' });
    expect(selectionBar).toHaveAttribute('data-presentation', 'discovery');

    await user.click(within(selectionBar).getByRole('button', { name: 'Add to favorites' }));
    const favoritesModal = screen.getByTestId('add-to-favorites-surface');
    expect(favoritesModal).toHaveAttribute('data-presentation', 'discovery');
    expect(favoritesModal).toHaveClass('max-h-[100dvh]');
    expect(within(favoritesModal).getByTestId('favorites-list-options')).toHaveClass(
      'overflow-y-auto',
    );
    expect(within(favoritesModal).getByText('Producer List 12')).toBeInTheDocument();
    await user.click(within(favoritesModal).getByRole('button', { name: 'Add to Favorites' }));
    expect(useFavoritesStore.getState().quickFavorites).toEqual(['atlas', 'foxtrot']);

    await user.click(within(selectionBar).getByRole('button', { name: 'Bulk share links' }));
    const bulkShareModal = await screen.findByTestId('bulk-share-surface');
    expect(bulkShareModal).toHaveAttribute('data-presentation', 'discovery');
    expect(await screen.findByText('http://localhost:3000/share/token-atlas.pdf')).toBeInTheDocument();
  });

  it('keeps saved-view behavior inside the restyled Lenses surface', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Lenses/ }));

    const dialog = screen.getByRole('dialog', { name: 'Lenses' });
    expect(dialog).toHaveAttribute('data-presentation', 'discovery');
    await user.type(within(dialog).getByRole('textbox', { name: 'Lens name' }), 'Polished view');
    await user.click(within(dialog).getByRole('button', { name: 'Save current' }));

    expect(useLensStore.getState().lenses[0]?.name).toBe('Polished view');
  });
});
