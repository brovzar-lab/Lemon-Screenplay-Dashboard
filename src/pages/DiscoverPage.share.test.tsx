import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterStore } from '@/stores/filterStore';
import { useNotesStore } from '@/stores/notesStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useShareStore } from '@/stores/shareStore';
import { useSortStore } from '@/stores/sortStore';
import { createTestScreenplay } from '@/test/factories';
import type { SharedView, SharedViewDocument } from '@/lib/shareService';
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
  resolveShareToken: vi.fn(),
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: hookState.screenplays, isLoading: false, error: null }),
  useLiveScreenplaySync: vi.fn(),
  useDeleteScreenplays: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/shareService', () => shareMocks);

import DiscoverPage from '@/pages/DiscoverPage';
import SharedViewPage from '@/pages/SharedViewPage';

function screenplay(): Screenplay {
  return createTestScreenplay({
    id: 'bravo',
    projectId: 'bravo',
    sourceFile: 'Bravo Room.pdf',
    title: 'Bravo Room',
    weightedScore: 8.25,
    recommendation: 'recommend',
  });
}

function sharedView(token = 'share-existing'): SharedView {
  return {
    token,
    screenplayId: 'Bravo Room.pdf',
    screenplayTitle: 'Bravo Room',
    includeNotes: false,
    createdAt: '2026-07-22T00:00:00.000Z',
    expiresAt: '2099-07-22T00:00:00.000Z',
  };
}

function sharedDocument(item: Screenplay, token: string): SharedViewDocument {
  return {
    ...sharedView(token),
    pdfUrl: null,
    posterUrl: null,
    analysis: {
      title: item.title,
      author: item.author,
      genre: item.genre,
      subgenres: item.subgenres,
      logline: item.logline,
      tone: item.tone,
      themes: item.themes,
      recommendation: item.recommendation,
      recommendationRationale: item.recommendationRationale,
      verdictStatement: item.verdictStatement,
      isFilmNow: item.isFilmNow,
      weightedScore: item.weightedScore,
      cvsTotal: item.cvsTotal,
      dimensionScores: item.dimensionScores,
      dimensionJustifications: item.dimensionJustifications,
      commercialViability: item.commercialViability,
      strengths: item.strengths,
      weaknesses: item.weaknesses,
      majorWeaknesses: item.majorWeaknesses,
      developmentNotes: item.developmentNotes,
      characters: item.characters,
      comparableFilms: item.comparableFilms,
      standoutScenes: item.standoutScenes,
      targetAudience: item.targetAudience,
      budgetCategory: item.budgetCategory,
      budgetJustification: item.budgetJustification,
      marketability: item.marketability,
    },
  };
}

function renderRoutes(initialEntries = ['/discover']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/discover/:projectId?', element: <DiscoverPage /> },
      { path: '/share/:token', element: <SharedViewPage /> },
    ],
    { initialEntries },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

async function openDrawer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Open Bravo Room details' }));
  return screen.getByRole('dialog', { name: 'Bravo Room' });
}

describe('Discovery sharing', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.screenplays = [screenplay()];
    shareMocks.createShareToken.mockReset();
    shareMocks.revokeShareToken.mockReset();
    shareMocks.getExistingShareToken.mockReset().mockResolvedValue(null);
    shareMocks.getAllSharedViews.mockReset().mockResolvedValue([]);
    shareMocks.isScreenplaySynced.mockReset().mockResolvedValue(true);
    shareMocks.resolveShareToken.mockReset();
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
    useNotesStore.getState().clearAllNotes();
    useShareStore.getState().clearAll();
  });

  it('creates through the existing service and resolves that token on the public page', async () => {
    const user = userEvent.setup();
    const item = screenplay();
    shareMocks.createShareToken.mockResolvedValue({
      token: 'share-new',
      url: 'http://localhost:3000/share/share-new',
      expiresAt: '2099-07-22T00:00:00.000Z',
    });
    shareMocks.resolveShareToken.mockResolvedValue(sharedDocument(item, 'share-new'));
    const router = renderRoutes();
    const drawer = await openDrawer(user);
    const shareButton = within(drawer).getByRole('button', { name: 'Share' });
    await waitFor(() => expect(shareButton).toBeEnabled());

    await user.click(shareButton);

    await waitFor(() =>
      expect(shareMocks.createShareToken).toHaveBeenCalledWith(
        'Bravo Room.pdf',
        expect.objectContaining({ title: 'Bravo Room' }),
        false,
        undefined,
      ),
    );
    const sharePanel = await screen.findByRole('dialog', {
      name: 'Share screenplay',
    });
    expect(within(sharePanel).getByText(/share-new/)).toBeInTheDocument();
    await user.click(within(sharePanel).getByRole('button', { name: 'Copy' }));
    expect(await within(sharePanel).findByRole('button', { name: 'Copied!' })).toBeInTheDocument();

    await act(async () => {
      await router.navigate('/share/share-new');
    });

    expect(await screen.findByRole('heading', { name: 'Bravo Room' })).toBeInTheDocument();
    expect(shareMocks.resolveShareToken).toHaveBeenCalledWith('share-new');
  });

  it('reuses an existing link and surfaces active status on the card and drawer', async () => {
    const user = userEvent.setup();
    shareMocks.getExistingShareToken.mockResolvedValue(sharedView());
    renderRoutes();
    const drawer = await openDrawer(user);

    await waitFor(() =>
      expect(shareMocks.getExistingShareToken).toHaveBeenCalledWith('Bravo Room.pdf'),
    );
    await waitFor(() =>
      expect(screen.getAllByLabelText('Active share link for Bravo Room')).toHaveLength(2),
    );
    await user.click(within(drawer).getByRole('button', { name: 'Share' }));

    const sharePanel = await screen.findByRole('dialog', {
      name: 'Share screenplay',
    });
    expect(within(sharePanel).getByText(/share-existing/)).toBeInTheDocument();
    expect(shareMocks.createShareToken).not.toHaveBeenCalled();
  });

  it('waits for existing-link lookup before sharing and restores its notes setting', async () => {
    const user = userEvent.setup();
    const existing = { ...sharedView('share-delayed'), includeNotes: true };
    let resolveLookup!: (view: SharedView | null) => void;
    const lookup = new Promise<SharedView | null>((resolve) => {
      resolveLookup = resolve;
    });
    shareMocks.getExistingShareToken.mockReturnValue(lookup);
    renderRoutes();
    const drawer = await openDrawer(user);
    const shareButton = within(drawer).getByRole('button', { name: 'Share' });

    await waitFor(() => expect(shareMocks.isScreenplaySynced).toHaveBeenCalled());
    expect(shareButton).toBeDisabled();

    await act(async () => {
      resolveLookup(existing);
      await lookup;
    });
    await waitFor(() => expect(shareButton).toBeEnabled());
    await user.click(shareButton);

    expect(shareMocks.createShareToken).not.toHaveBeenCalled();
    const sharePanel = await screen.findByRole('dialog', {
      name: 'Share screenplay',
    });
    expect(within(sharePanel).getByText(/share-delayed/)).toBeInTheDocument();
    expect(within(sharePanel).getByRole('checkbox', { name: 'Include notes' })).toBeChecked();
  });

  it('revokes through the existing service and clears active status', async () => {
    const user = userEvent.setup();
    shareMocks.getExistingShareToken.mockResolvedValue(sharedView());
    shareMocks.revokeShareToken.mockImplementation(async (_token, screenplayId) => {
      shareMocks.getExistingShareToken.mockResolvedValue(null);
      useShareStore.getState().removeToken(screenplayId);
    });
    renderRoutes();
    const drawer = await openDrawer(user);
    await waitFor(() =>
      expect(screen.getAllByLabelText('Active share link for Bravo Room')).toHaveLength(2),
    );
    await user.click(within(drawer).getByRole('button', { name: 'Share' }));
    const sharePanel = await screen.findByRole('dialog', {
      name: 'Share screenplay',
    });
    await user.click(within(sharePanel).getByRole('button', { name: 'Revoke link' }));
    await user.click(within(sharePanel).getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(shareMocks.revokeShareToken).toHaveBeenCalledWith('share-existing', 'Bravo Room.pdf'),
    );
    await waitFor(() =>
      expect(screen.queryAllByLabelText('Active share link for Bravo Room')).toHaveLength(0),
    );
  });
});
