import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HybridDiscoverShell } from '@/components/discover/hybrid/HybridDiscoverShell';
import { createCoverageTestScreenplay } from '@/test/factories';

vi.mock('@/stores/authStore', () => ({ useIsAdmin: () => false }));
vi.mock('@/stores/selectionStore', () => ({
  useHasSelection: () => false,
  useSelectionCount: () => 0,
  useSelectionStore: (selector: (state: { deselectAll: () => void }) => unknown) =>
    selector({ deselectAll: vi.fn() }),
}));
vi.mock('@/stores/sortStore', () => ({
  useSortStore: (selector: (state: { sortConfigs: never[] }) => unknown) =>
    selector({ sortConfigs: [] }),
}));
vi.mock('@/hooks/usePercentiles', () => ({ usePercentiles: () => new Map() }));
vi.mock('@/hooks/useProducerAssessments', () => ({
  useProducerAssessmentHeads: () => ({ data: [] }),
}));
vi.mock('@/components/discover/DiscoverDrawer', () => ({ DiscoverDrawer: () => null }));
vi.mock('@/components/discover/DiscoverySelectionBar', () => ({
  DiscoverySelectionBar: () => null,
}));
vi.mock('@/components/discover/hybrid/HybridCommandRail', () => ({
  HybridCommandRail: () => <div>Controls</div>,
}));
vi.mock('@/components/discover/hybrid/HybridHeader', () => ({
  HybridHeader: () => <header>Header</header>,
}));
vi.mock('@/components/discover/hybrid/HybridResults', () => ({
  HybridFeatureStage: () => null,
  HybridFilmNowRail: () => null,
  HybridSlateGrid: () => <div>Coverage grid</div>,
}));

describe('HybridDiscoverShell Coverage V1', () => {
  it('explains an all-Coverage slate without trust-remediation copy', () => {
    const coverage = createCoverageTestScreenplay();
    render(
      <HybridDiscoverShell
        screenplays={[coverage]}
        allScreenplays={[coverage]}
        totalCount={1}
        filteredCount={1}
        genres={[]}
        themes={[]}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        producedHiddenCount={0}
        onRevealProduced={vi.fn()}
        nonScreenplayHiddenCount={0}
        onRevealNonScreenplays={vi.fn()}
        stats={{ total: 1, avgWeightedScore: 0, filmNowCount: 0 }}
        selectedScreenplay={null}
        onOpenScreenplay={vi.fn()}
        onCloseScreenplay={vi.fn()}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Coverage reports are unscored by design' }))
      .toBeInTheDocument();
    expect(screen.getByText('1 coverage report')).toBeInTheDocument();
    expect(screen.queryByText(/specialist reader panel is incomplete/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Needs review')).not.toBeInTheDocument();
  });
});
