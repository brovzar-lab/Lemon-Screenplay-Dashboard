import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCoverageTestScreenplay } from '@/test/factories';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { DiscoveryExportActions } from '@/components/discover/DiscoveryExportActions';
import { DiscoveryFavoritesMenu } from '@/components/discover/DiscoveryFavoritesMenu';
import { DiscoverySelectionBar } from '@/components/discover/DiscoverySelectionBar';
import { DiscoverGrid } from '@/components/discover/DiscoverResults';
import { HybridSlateGrid } from '@/components/discover/hybrid/HybridResults';
import { ScreenplaySlateStats } from '@/components/discover/screenplay/ScreenplaySlateStats';

const mocks = vi.hoisted(() => ({ downloadCoveragePdf: vi.fn() }));

vi.mock('@/components/export/exportCoverage', () => ({
  downloadCoveragePdf: mocks.downloadCoveragePdf,
}));

vi.mock('@/components/bulk/AddToFavoritesModal', () => ({ AddToFavoritesModal: () => null }));
vi.mock('@/components/bulk/BulkShareModal', () => ({ BulkShareModal: () => null }));
vi.mock('@/components/discover/DiscoveryPitchDeckModal', () => ({
  DiscoveryPitchDeckModal: () => null,
}));
vi.mock('@/components/discover/ScriptCover', () => ({ ScriptCover: () => <span>Cover</span> }));
vi.mock('@/components/discover/DiscoverySelectionCheckbox', () => ({
  DiscoverySelectionCheckbox: () => <span>Select</span>,
}));

describe('Coverage discovery surfaces', () => {
  const coverage = createCoverageTestScreenplay();

  beforeEach(() => {
    vi.clearAllMocks();
    useFavoritesStore.setState({ lists: [], quickFavorites: [] });
    useSelectionStore.getState().deselectAll();
  });

  it('keeps Coverage PDF available while decision exports remain disabled', async () => {
    const user = userEvent.setup();
    render(<DiscoveryExportActions screenplay={coverage} />);

    const coverageButton = screen.getByRole('button', { name: 'Download coverage PDF' });
    expect(coverageButton).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Pitch-deck PDF' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Coverage · unscored by design');

    await user.click(coverageButton);
    expect(mocks.downloadCoveragePdf).toHaveBeenCalledWith(coverage);
  });

  it('labels saved and selected Coverage without calling it unverified', async () => {
    const user = userEvent.setup();
    useFavoritesStore.setState({ quickFavorites: [coverage.id] });
    const favorites = render(
      <DiscoveryFavoritesMenu screenplays={[coverage]} onOpen={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /Favorites/ }));
    expect(screen.getByText('Coverage · unscored by design')).toBeInTheDocument();
    expect(screen.getByText('RECOMMEND')).toBeInTheDocument();
    expect(screen.queryByText('Not verified')).not.toBeInTheDocument();
    favorites.unmount();

    useSelectionStore.setState({ selectedIds: new Set([coverage.id]) });
    render(
      <DiscoverySelectionBar
        screenplays={[coverage]}
        visibleScreenplays={[coverage]}
        escapeEnabled
      />,
    );

    expect(screen.getAllByText('Coverage · unscored by design')).not.toHaveLength(0);
    expect(screen.getByText('RECOMMEND')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bulk share links' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pitch-deck PDFs' })).toBeDisabled();
    expect(screen.queryByText('Decision data unavailable until verification')).not.toBeInTheDocument();
  });

  it('keeps Coverage score-free in classic, hybrid, and slate summary views', () => {
    const classic = render(
      <DiscoverGrid screenplays={[coverage]} onOpen={vi.fn()} />,
    );
    expect(screen.getAllByText('Coverage · unscored by design')).not.toHaveLength(0);
    expect(screen.getByText('Unscored by design')).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    classic.unmount();

    const hybrid = render(
      <HybridSlateGrid
        screenplays={[coverage]}
        onOpen={vi.fn()}
        percentiles={new Map()}
      />,
    );
    expect(screen.getByText('Coverage · unscored by design')).toBeInTheDocument();
    expect(screen.getByText('Confidence: high')).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    hybrid.unmount();

    render(
      <ScreenplaySlateStats
        screenplays={[coverage]}
        totalCount={1}
        producerLookCount={0}
      />,
    );
    expect(screen.getByText('coverage')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    expect(screen.queryByText('Unverified omitted')).not.toBeInTheDocument();
  });
});
