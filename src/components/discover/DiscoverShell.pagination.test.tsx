import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

vi.mock('@/stores/authStore', () => ({ useIsAdmin: () => true }));
vi.mock('@/stores/selectionStore', () => ({ useHasSelection: () => false }));
vi.mock('@/hooks/useProducerAssessments', () => ({
  useProducerAssessmentHeads: () => ({ data: [] }),
}));
vi.mock('@/components/discover/DiscoverAppHeader', () => ({
  DiscoverAppHeader: () => <header>Header</header>,
}));
vi.mock('@/components/discover/DiscoverControls', () => ({
  DiscoverControls: () => <div>Controls</div>,
}));
vi.mock('@/components/discover/DiscoverDrawer', () => ({
  DiscoverDrawer: () => null,
}));
vi.mock('@/components/discover/DiscoverySelectionBar', () => ({
  DiscoverySelectionBar: () => null,
}));
vi.mock('@/components/discover/DiscoverResults', () => ({
  DiscoverFeature: () => <div>Featured</div>,
  DiscoverFilmNowShelf: () => null,
  DiscoverRankedShelf: () => <div>Top Picks</div>,
  DiscoverGrid: ({ screenplays, rankOffset = 0 }: { screenplays: Screenplay[]; rankOffset?: number }) => (
    <div data-testid="archive-page" data-rank-offset={rankOffset}>
      {screenplays.map((screenplay) => <span key={screenplay.id}>{screenplay.title}</span>)}
    </div>
  ),
}));

import { DiscoverShell } from '@/components/discover/DiscoverShell';

function scripts(count: number): Screenplay[] {
  return Array.from({ length: count }, (_, index) => createTestScreenplay({
    id: `script-${index + 1}`,
    projectId: `project-${index + 1}`,
    title: `Script ${index + 1}`,
    weightedScore: 10 - index / 100,
  }));
}

function props(screenplays: Screenplay[]) {
  return {
    screenplays,
    allScreenplays: screenplays,
    totalCount: screenplays.length,
    filteredCount: screenplays.length,
    genres: [],
    themes: [],
    hasActiveFilters: false,
    onClearFilters: vi.fn(),
    producedHiddenCount: 0,
    onRevealProduced: vi.fn(),
    nonScreenplayHiddenCount: 0,
    onRevealNonScreenplays: vi.fn(),
    stats: { total: screenplays.length, avgWeightedScore: 6.4, filmNowCount: 0 },
    selectedScreenplay: null,
    onOpenScreenplay: vi.fn(),
    onCloseScreenplay: vi.fn(),
    isLoading: false,
    isError: false,
  };
}

describe('Discover archive pagination', () => {
  it('keeps the browse grid to 50 projects and moves through the remaining page', async () => {
    const user = userEvent.setup();
    render(<DiscoverShell {...props(scripts(60))} />);

    expect(screen.getByTestId('archive-page').children).toHaveLength(50);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next 50 →' }));
    expect(screen.getByTestId('archive-page').children).toHaveLength(5);
    expect(screen.getByTestId('archive-page')).toHaveAttribute('data-rank-offset', '50');
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });
});
