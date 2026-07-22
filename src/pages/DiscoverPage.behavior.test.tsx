import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { useFilterStore } from '@/stores/filterStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSortStore } from '@/stores/sortStore';
import type { Screenplay } from '@/types';

const hookState = vi.hoisted(() => ({
  screenplays: [] as unknown[],
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({
    data: hookState.screenplays,
    isLoading: false,
    error: null,
  }),
  useLiveScreenplaySync: vi.fn(),
}));

import DiscoverPage from '@/pages/DiscoverPage';

function screenplay(
  id: string,
  title: string,
  weightedScore: number,
  marketPotential: number,
  overrides: Partial<Screenplay> = {},
): Screenplay {
  return createTestScreenplay({
    id,
    projectId: id,
    sourceFile: `${id}.pdf`,
    title,
    weightedScore,
    cvsTotal: Math.round(weightedScore * 2),
    recommendation: 'consider',
    genre: 'Drama',
    themes: ['Family'],
    logline: `${title} follows a family facing an impossible choice.`,
    producerMetrics: {
      marketPotential,
      marketPotentialRationale: 'Test rationale',
      uspStrength: 'Moderate',
      uspStrengthRationale: 'Test rationale',
    },
    ...overrides,
  });
}

function buildScreenplays(): Screenplay[] {
  return [
    screenplay('amber', 'Amber Sky', 5, 10, { recommendation: 'recommend' }),
    screenplay('buried', 'Buried Signal', 6, 6, { recommendation: 'pass' }),
    screenplay('cinder', 'Cinder House', 7, 5, { recommendation: 'recommend' }),
    screenplay('delta', 'Delta Run', 8, 4, {
      logline: 'A detective follows a buried lighthouse signal through the desert.',
    }),
    screenplay('echo', 'Echo Park', 9, 1, {
      recommendation: 'recommend',
      genre: 'Thriller',
      themes: ['Memory'],
    }),
    screenplay('shared-one', 'Shared Title', 4, 3, { genre: 'Comedy' }),
    screenplay('shared-two', 'Shared Title', 3, 2, { genre: 'Horror' }),
  ];
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/discover']}>
      <DiscoverPage />
    </MemoryRouter>,
  );
}

function discoveryResults() {
  return document.querySelectorAll('[data-discovery-result]');
}

async function waitForWeightedDefault() {
  await waitFor(() => {
    expect(within(screen.getByTestId('discovery-featured')).getByRole('heading')).toHaveTextContent(
      'Echo Park',
    );
  });
}

describe('DiscoverPage find toolchain', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.screenplays = buildScreenplays();
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
  });

  it('defaults the Discovery ranking to weighted score descending', async () => {
    renderPage();

    await waitForWeightedDefault();
    expect(discoveryResults()).toHaveLength(7);
  });

  it('uses the existing verdict filter to narrow every result surface', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForWeightedDefault();

    await user.click(screen.getByRole('button', { name: 'RECOMMEND' }));

    await waitFor(() => expect(discoveryResults()).toHaveLength(3));
    expect(screen.getByText('Showing 3 of 7 screenplays')).toBeInTheDocument();
  });

  it('searches both titles and loglines through the existing filter hook', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForWeightedDefault();
    const search = screen.getByRole('searchbox', { name: 'Discovery search' });

    await user.type(search, 'Cinder House');
    await waitFor(() => expect(discoveryResults()).toHaveLength(1));
    expect(screen.getByRole('heading', { name: 'Cinder House' })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'buried lighthouse');
    await waitFor(() => expect(discoveryResults()).toHaveLength(1));
    expect(screen.getByRole('heading', { name: 'Delta Run' })).toBeInTheDocument();
  });

  it('applies one active sort consistently to featured, shelf, and grid', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForWeightedDefault();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort results' }), 'title');

    await waitFor(() =>
      expect(
        within(screen.getByTestId('discovery-featured')).getByRole('heading'),
      ).toHaveTextContent('Amber Sky'),
    );
    const shelfTitles = screen
      .getAllByTestId('discovery-shelf-result')
      .map((card) => within(card).getByRole('heading').textContent);
    const gridTitles = screen
      .getAllByTestId('discovery-grid-result')
      .map((card) => within(card).getByRole('heading').textContent);

    expect(shelfTitles).toEqual(['Buried Signal', 'Cinder House', 'Delta Run', 'Echo Park']);
    expect(gridTitles).toEqual(['Shared Title', 'Shared Title']);
  });

  it('explains an empty filtered view and clear-filters recovers the archive', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForWeightedDefault();

    await user.type(screen.getByRole('searchbox', { name: 'Discovery search' }), 'no such script');
    expect(
      await screen.findByRole('heading', { name: 'No scripts match this view' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(discoveryResults()).toHaveLength(7));
  });

  it('keeps same-title screenplays from different projects as separate grid cards', async () => {
    renderPage();
    await waitForWeightedDefault();

    const sharedTitleCards = screen
      .getAllByTestId('discovery-grid-result')
      .filter((card) => within(card).getByRole('heading').textContent === 'Shared Title');

    expect(sharedTitleCards).toHaveLength(2);
    expect(sharedTitleCards.map((card) => card.getAttribute('data-screenplay-id'))).toEqual([
      'shared-one',
      'shared-two',
    ]);
  });
});
