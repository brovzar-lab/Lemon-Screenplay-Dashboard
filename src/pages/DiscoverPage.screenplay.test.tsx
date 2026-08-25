import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterStore } from '@/stores/filterStore';
import { useAuthStore } from '@/stores/authStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useSortStore } from '@/stores/sortStore';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const hookState = vi.hoisted(() => ({ screenplays: [] as Screenplay[] }));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: hookState.screenplays, isLoading: false, error: null }),
  useLiveScreenplaySync: vi.fn(),
  useDeleteScreenplays: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/components/discover/screenplay/ScreenplaySlateInsights', () => ({
  ScreenplaySlateInsights: () => <section data-testid="screenplay-insights" />,
}));

import DiscoverPage from '@/pages/DiscoverPage';

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location-probe">
      {location.pathname}
      {location.search}
    </output>
  );
}

function screenplay(id: string, title: string, weightedScore: number): Screenplay {
  return createTestScreenplay({
    id,
    projectId: `${id}-project`,
    sourceFile: `${id}.pdf`,
    title,
    author: `${title} Writer`,
    weightedScore,
    genre: id === 'delta' ? 'Thriller' : 'Drama',
    logline:
      id === 'delta' ? 'A buried lighthouse signal changes a detective.' : `${title} logline`,
    analysisQuality: {
      status: 'complete',
      completedReaders: 5,
      expectedReaders: 5,
      failedReaders: [],
    },
  });
}

function renderPage(path = '/discover?ui=screenplay') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/discover/:projectId?" element={<DiscoverPage />} />
          <Route path="/projects/:projectId" element={<div>Screenplay File route</div>} />
          <Route path="/settings" element={<div>Settings route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('I + G screenplay Discovery presentation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    hookState.screenplays = [
      screenplay('amber', 'Amber Sky', 6.2),
      screenplay('delta', 'Delta Run', 7.1),
      screenplay('echo', 'Echo Park', 8.8),
      screenplay('foxtrot', 'Foxtrot House', 8.1),
      screenplay('gamma', 'Gamma Road', 7.8),
      screenplay('hotel', 'Hotel Blue', 6.8),
    ];
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    useSortStore.getState().setSortConfigs([{ field: 'weightedScore', direction: 'desc' }]);
    useSortStore.getState().setPrioritizeFilmNow(false);
    usePdfStatusStore.getState().clearStatuses();
    useSelectionStore.getState().deselectAll();
    useAuthStore.setState({ profile: null });
  });

  it('gives administrators a direct upload action when the slate is empty', async () => {
    const user = userEvent.setup();
    hookState.screenplays = [];
    useAuthStore.setState({
      profile: {
        uid: 'admin',
        email: 'billy@lemonfilms.com',
        displayName: 'Billy',
        photoURL: null,
        role: 'admin',
        createdAt: '2026-08-25T00:00:00.000Z',
        lastLoginAt: '2026-08-25T00:00:00.000Z',
      },
    });

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Upload Screenplays' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/settings?tab=intake');
  });

  it('shows exactly one Featured project and returns every other project to the wall', async () => {
    renderPage();

    expect(await screen.findByTestId('application-header')).toBeInTheDocument();
    const ranking = await screen.findByTestId('screenplay-discovery-ranking');
    expect(within(ranking).getByText('Featured project')).toBeInTheDocument();
    expect(within(ranking).getByText(/Stable for today/)).toBeInTheDocument();
    expect(within(ranking).getByTestId('screenplay-featured-project')).toHaveAttribute(
      'data-screenplay-id',
      'echo',
    );
    expect(within(ranking).queryByTestId('screenplay-ranking-runner')).not.toBeInTheDocument();

    const wallResults = screen.getAllByTestId('screenplay-discovery-result');
    expect(wallResults).toHaveLength(5);
    expect(wallResults.map((result) => result.getAttribute('data-screenplay-id'))).toEqual([
      'foxtrot',
      'gamma',
      'delta',
      'hotel',
      'amber',
    ]);
    expect(screen.getByRole('heading', { name: 'Continue through the slate' })).toBeInTheDocument();
    expect(screen.getByText('Showing 6 of 6 screenplays')).toBeInTheDocument();

    const stats = screen.getByRole('region', { name: 'Current slate statistics' });
    expect(within(stats).getByText('Total scripts').previousSibling).toHaveTextContent('6');
    expect(within(stats).getByText('Visible').previousSibling).toHaveTextContent('6');
    expect(within(stats).getByText('Average score')).toBeInTheDocument();
    expect(within(stats).getByText('Film Now + Recommend')).toBeInTheDocument();
    expect(within(stats).getByText('Producer Look')).toBeInTheDocument();
  });

  it('keeps Featured stable while temporary search and sort controls change the wall', async () => {
    const user = userEvent.setup();
    renderPage();
    const search = await screen.findByRole('searchbox', { name: 'Discovery search' });

    await user.type(search, 'buried lighthouse');
    await waitFor(() =>
      expect(screen.getByTestId('screenplay-featured-project')).toHaveAttribute(
        'data-screenplay-id',
        'echo',
      ),
    );
    expect(screen.getByText(/outside your temporary browse filters/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('screenplay-discovery-result')).toHaveLength(1);
    expect(screen.getByTestId('screenplay-discovery-result')).toHaveAttribute(
      'data-screenplay-id',
      'delta',
    );

    await user.clear(search);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort results' }), 'title');
    await waitFor(() =>
      expect(screen.getByTestId('screenplay-featured-project')).toHaveAttribute(
        'data-screenplay-id',
        'echo',
      ),
    );
    expect(screen.getAllByTestId('screenplay-discovery-result')).toHaveLength(5);
    expect(screen.getAllByTestId('screenplay-discovery-result')[0]).toHaveAttribute(
      'data-screenplay-id',
      'amber',
    );
    expect(screen.getByRole('heading', { name: 'Continue through the slate' })).toBeInTheDocument();
  });

  it('uses browse sorts for the wall without changing today’s Featured project', async () => {
    const user = userEvent.setup();
    const alpha = screenplay('alpha', 'Alpha', 9.0);
    const bravo = screenplay('bravo', 'Bravo', 8.0);
    const charlie = screenplay('charlie', 'Charlie', 7.0);
    const delta = screenplay('delta', 'Delta', 6.0);
    const echo = screenplay('echo', 'Echo', 5.0);
    hookState.screenplays = [
      {
        ...alpha,
        producerMetrics: { ...alpha.producerMetrics, marketPotential: 3 },
        commercialViability: { ...alpha.commercialViability, cvsTotal: 18, cvsAssessed: true },
        cvsTotal: 18,
      },
      {
        ...bravo,
        producerMetrics: { ...bravo.producerMetrics, marketPotential: 10 },
        commercialViability: { ...bravo.commercialViability, cvsTotal: 12, cvsAssessed: true },
        cvsTotal: 12,
      },
      {
        ...charlie,
        producerMetrics: { ...charlie.producerMetrics, marketPotential: 8 },
        commercialViability: {
          ...charlie.commercialViability,
          cvsTotal: 14,
          cvsAssessed: true,
        },
        cvsTotal: 14,
      },
      {
        ...delta,
        producerMetrics: { ...delta.producerMetrics, marketPotential: 7 },
        commercialViability: { ...delta.commercialViability, cvsTotal: 16, cvsAssessed: true },
        cvsTotal: 16,
      },
      {
        ...echo,
        producerMetrics: { ...echo.producerMetrics, marketPotential: 6 },
        commercialViability: { ...echo.commercialViability, cvsTotal: 10, cvsAssessed: true },
        cvsTotal: 10,
      },
    ];

    renderPage();
    const sort = await screen.findByRole('combobox', { name: 'Sort results' });
    await user.selectOptions(sort, 'marketPotential');
    await waitFor(() =>
      expect(screen.getByTestId('screenplay-featured-project')).toHaveAttribute(
        'data-screenplay-id',
        'alpha',
      ),
    );
    expect(screen.getAllByTestId('screenplay-discovery-result')[0]).toHaveAttribute(
      'data-screenplay-id',
      'bravo',
    );

    await user.selectOptions(sort, 'cvsTotal');
    await waitFor(() =>
      expect(screen.getByTestId('screenplay-featured-project')).toHaveAttribute(
        'data-screenplay-id',
        'alpha',
      ),
    );
    expect(screen.getAllByTestId('screenplay-discovery-result')[0]).toHaveAttribute(
      'data-screenplay-id',
      'delta',
    );
  });

  it('keeps an unrankable project in the wall instead of silently hiding it', async () => {
    hookState.screenplays[1] = {
      ...hookState.screenplays[1],
      producerProjection: { rankable: false },
    } as Screenplay;

    renderPage();

    expect(await screen.findByTestId('screenplay-discovery-ranking')).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId('screenplay-discovery-result')
        .map((result) => result.getAttribute('data-screenplay-id')),
    ).toContain('delta');
  });

  it('opens the connected Screenplay File and preserves the drawer fallback', async () => {
    const user = userEvent.setup();
    const connected = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Open Echo Park screenplay file' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/projects/echo-project?workspace=screenplay',
    );
    connected.unmount();

    renderPage('/discover?ui=screenplay&preview=drawer');
    await user.click(await screen.findByRole('button', { name: 'Open Echo Park screenplay file' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/discover/echo-project?ui=screenplay&preview=drawer',
    );
  });

  it('selects and opens projects from Featured and the complete slate', async () => {
    const user = userEvent.setup();
    const connected = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Select Echo Park' }));
    await user.click(screen.getByRole('button', { name: 'Select Hotel Blue' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/discover?ui=screenplay');
    expect(useSelectionStore.getState().selectedIds).toEqual(new Set(['echo', 'hotel']));

    await user.click(screen.getByRole('button', { name: 'Open Echo Park screenplay file' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/projects/echo-project?workspace=screenplay',
    );
    connected.unmount();

    useSelectionStore.getState().deselectAll();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Open Hotel Blue screenplay file' }),
    );
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/projects/hotel-project?workspace=screenplay',
    );
  });

  it('keeps search accessible and the classic presentation available', async () => {
    const screenplayView = renderPage();
    expect(await screen.findByRole('searchbox', { name: 'Discovery search' })).toBeInTheDocument();
    screenplayView.unmount();

    renderPage('/discover?ui=classic');
    expect(await screen.findByRole('searchbox', { name: 'Discovery search' })).toBeInTheDocument();
    expect(screen.queryByTestId('screenplay-discovery-ranking')).not.toBeInTheDocument();
  });

  it('cleans source titles and omits non-blocking missing metadata on every card', async () => {
    hookState.screenplays = [
      createTestScreenplay({
        id: 'legacy',
        projectId: 'legacy-project',
        sourceFile: 'legacy.pdf',
        title: 'c8a16cdfe6b740ce8c39370728265074 ASSASSINATION OF A HIGH SCHOOL PRESIDENT',
        recommendation: 'consider',
        genre: 'Comedic Crime / Mystery',
        metadata: { filename: 'legacy.pdf', pageCount: 102, wordCount: 19_000 },
      }),
    ];

    renderPage();

    const result = await screen.findByTestId('screenplay-featured-project');
    expect(result).toHaveAttribute('data-verdict', 'consider');
    expect(
      within(result).getAllByText('Assassination of a High School President'),
    ).not.toHaveLength(0);
    expect(result).toHaveTextContent('Feature film');
    expect(result).not.toHaveTextContent('Source not recorded');
    expect(within(result).queryByText(/c8a16cd/i)).not.toBeInTheDocument();
  });
});
