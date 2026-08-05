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

const hookState = vi.hoisted(() => ({
  screenplays: [] as Screenplay[],
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

import DiscoverPage from '@/pages/DiscoverPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-probe">{location.pathname}{location.search}</output>;
}

function screenplay(
  id: string,
  title: string,
  weightedScore: number,
  overrides: Partial<Screenplay> = {},
): Screenplay {
  return createTestScreenplay({
    id,
    projectId: id,
    sourceFile: `${id}.pdf`,
    title,
    weightedScore,
    recommendation: 'consider',
    genre: 'Drama',
    themes: ['Family'],
    logline: `${title} follows a family facing an impossible choice.`,
    analysisQuality: {
      status: 'complete',
      completedReaders: 5,
      expectedReaders: 5,
      failedReaders: [],
    },
    ...overrides,
  });
}

function buildScreenplays(): Screenplay[] {
  return [
    screenplay('amber', 'Amber Sky', 5, { recommendation: 'recommend' }),
    screenplay('buried', 'Buried Signal', 6, { recommendation: 'pass' }),
    screenplay('cinder', 'Cinder House', 7, { recommendation: 'recommend' }),
    screenplay('delta', 'Delta Run', 8, {
      logline: 'A detective follows a buried lighthouse signal through the desert.',
    }),
    screenplay('echo', 'Echo Park', 9, {
      recommendation: 'recommend',
      genre: 'Thriller',
      themes: ['Memory'],
    }),
    screenplay('shared-one', 'Shared Title', 4, { genre: 'Comedy' }),
    screenplay('shared-two', 'Shared Title', 3, { genre: 'Horror' }),
  ];
}

function renderPage(path = '/discover?ui=hybrid') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/discover/:projectId?" element={<DiscoverPage />} />
          <Route path="/projects/:projectId" element={<div>Project workspace</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function waitForHybridFeature(title = 'Echo Park') {
  await waitFor(() => {
    expect(within(screen.getByTestId('discovery-featured')).getByRole('heading')).toHaveTextContent(
      title,
    );
  });
}

describe('cleaned hybrid Discovery presentation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.screenplays = buildScreenplays();
    hookState.isLoading = false;
    hookState.error = null;
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
  });

  it('keeps the current Discovery as the default and explicit classic fallback', () => {
    const first = renderPage('/discover');
    expect(screen.getByRole('heading', { name: 'Cinema Browse' })).toBeInTheDocument();
    first.unmount();

    renderPage('/discover?ui=classic');
    expect(screen.getByRole('heading', { name: 'Cinema Browse' })).toBeInTheDocument();
  });

  it('renders the approved feature, next four folders, and non-duplicated slate', async () => {
    renderPage();
    await waitForHybridFeature();

    expect(screen.queryByRole('heading', { name: 'Cinema Browse' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The slate' })).toBeInTheDocument();
    expect(screen.getAllByTestId('discovery-shelf-result')).toHaveLength(4);
    expect(screen.getAllByTestId('discovery-grid-result')).toHaveLength(2);
    expect(document.querySelectorAll('[data-discovery-result]')).toHaveLength(7);
    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Readers' })).not.toBeInTheDocument();
  });

  it('uses the same search and active sort to update every hybrid surface', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForHybridFeature();

    const search = screen.getByRole('searchbox', { name: 'Discovery search' });
    await user.type(search, 'buried lighthouse');
    await waitForHybridFeature('Delta Run');
    expect(document.querySelectorAll('[data-discovery-result]')).toHaveLength(1);

    await user.clear(search);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort results' }), 'title');
    await waitForHybridFeature('Amber Sky');
    expect(
      within(screen.getByTestId('discovery-featured')).getByText('First in title order'),
    ).toBeInTheDocument();
  });

  it('filters through the existing store and clears from the hybrid panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForHybridFeature();

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const dialog = screen.getByRole('dialog', { name: 'Discovery filters' });
    await user.click(within(dialog).getByRole('button', { name: 'RECOMMEND' }));

    await waitFor(() => expect(document.querySelectorAll('[data-discovery-result]')).toHaveLength(3));
    expect(screen.getByText('Showing 3 of 7 screenplays')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(document.querySelectorAll('[data-discovery-result]')).toHaveLength(7));
  });

  it('focuses the hybrid header search with the slash shortcut', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForHybridFeature();

    await user.keyboard('/');
    expect(screen.getByRole('searchbox', { name: 'Discovery search' })).toHaveFocus();
  });

  it('preserves the hybrid query while opening and closing the drawer fallback', async () => {
    const user = userEvent.setup();
    renderPage('/discover?ui=hybrid&preview=drawer');
    await waitForHybridFeature();

    await user.click(screen.getByRole('button', { name: 'Open Echo Park project' }));
    expect(await screen.findByRole('dialog', { name: 'Echo Park' })).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/discover/echo?ui=hybrid&preview=drawer',
    );

    await user.click(screen.getByRole('button', { name: 'Close details' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent(
        '/discover?ui=hybrid&preview=drawer',
      );
    });
  });

  it('keeps the hybrid header present for loading, empty, and error states', async () => {
    hookState.isLoading = true;
    hookState.screenplays = [];
    const loading = renderPage();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('Loading Discovery')).toBeInTheDocument();
    loading.unmount();

    hookState.isLoading = false;
    const empty = renderPage();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No analyzed screenplays yet' })).toBeInTheDocument();
    empty.unmount();

    hookState.error = new Error('offline');
    renderPage();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Discovery is temporarily unavailable' }),
    ).toBeInTheDocument();
  });
});
