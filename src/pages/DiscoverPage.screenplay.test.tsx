import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterStore } from '@/stores/filterStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSortStore } from '@/stores/sortStore';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const hookState = vi.hoisted(() => ({ screenplays: [] as Screenplay[] }));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: hookState.screenplays, isLoading: false, error: null }),
  useLiveScreenplaySync: vi.fn(),
  useDeleteScreenplays: () => ({ mutate: vi.fn(), isPending: false }),
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
    ];
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
  });

  it('keeps a cinematic feature and the complete filtered slate in the grid', async () => {
    renderPage();

    expect(await screen.findByTestId('screenplay-discovery-featured')).toHaveAttribute(
      'data-screenplay-id',
      'echo',
    );
    expect(screen.getAllByTestId('screenplay-discovery-result')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'The complete slate' })).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 screenplays')).toBeInTheDocument();
  });

  it('uses the existing search and sort machinery across feature and grid', async () => {
    const user = userEvent.setup();
    renderPage();
    const search = await screen.findByRole('searchbox', { name: 'Discovery search' });

    await user.type(search, 'buried lighthouse');
    await waitFor(() =>
      expect(screen.getAllByTestId('screenplay-discovery-result')).toHaveLength(1),
    );
    expect(
      within(screen.getByTestId('screenplay-discovery-featured')).getByRole('heading'),
    ).toHaveTextContent('Delta Run');

    await user.clear(search);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort results' }), 'title');
    await waitFor(() =>
      expect(
        within(screen.getByTestId('screenplay-discovery-featured')).getByRole('heading'),
      ).toHaveTextContent('Amber Sky'),
    );
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

  it('cleans source titles and exposes verdict, format, and source context on every card', async () => {
    hookState.screenplays = [
      createTestScreenplay({
        id: 'legacy',
        projectId: 'legacy-project',
        sourceFile: 'legacy.pdf',
        title: 'c8a16cdfe6b740ce8c39370728265074 ASSASSINATION OF A HIGH SCHOOL PRESIDENT',
        recommendation: 'pass',
        genre: 'Comedic Crime / Mystery',
        metadata: { filename: 'legacy.pdf', pageCount: 102, wordCount: 19_000 },
      }),
    ];

    renderPage();

    const result = await screen.findByTestId('screenplay-discovery-result');
    expect(result).toHaveAttribute('data-verdict', 'pass');
    expect(
      within(result).getAllByText('ASSASSINATION OF A HIGH SCHOOL PRESIDENT'),
    ).not.toHaveLength(0);
    expect(within(result).getByText('Feature film')).toBeInTheDocument();
    expect(within(result).getByText('Source not recorded')).toBeInTheDocument();
    expect(within(result).queryByText(/c8a16cd/i)).not.toBeInTheDocument();
  });
});
