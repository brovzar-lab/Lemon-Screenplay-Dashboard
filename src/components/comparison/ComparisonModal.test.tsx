import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';
import { ComparisonModal } from './ComparisonModal';

let screenplays: Screenplay[] = [];

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: screenplays }),
}));

vi.mock('@/stores/comparisonStore', () => ({
  useComparisonStore: () => ({
    selectedIds: ['trusted-1', 'trusted-2', 'legacy'],
    isComparing: true,
    viewMode: 'side-by-side',
    setViewMode: vi.fn(),
    removeFromComparison: vi.fn(),
    clearComparison: vi.fn(),
    closeComparison: vi.fn(),
  }),
}));

vi.mock('./ComparisonSideBySide', () => ({
  ComparisonSideBySide: ({ screenplays: selected }: { screenplays: Screenplay[] }) => (
    <p>Compared {selected.map((screenplay) => screenplay.id).join(',')}</p>
  ),
}));

vi.mock('./ComparisonRadar', () => ({ ComparisonRadar: () => null }));

describe('ComparisonModal trust boundary', () => {
  beforeEach(() => {
    screenplays = [
      createTestScreenplay({ id: 'trusted-1' }),
      createTestScreenplay({ id: 'trusted-2' }),
      createTestScreenplay({ id: 'legacy', producerProjection: undefined }),
    ];
  });

  it('excludes unverified analyses from decision comparison', () => {
    render(<ComparisonModal />);

    expect(screen.getByText('Compared trusted-1,trusted-2')).toBeInTheDocument();
    expect(screen.getByText('Comparing 2 screenplays')).toBeInTheDocument();
    expect(screen.queryByText(/legacy/)).not.toBeInTheDocument();
  });

  it('does not open a comparison when fewer than two verified analyses remain', () => {
    screenplays = [
      createTestScreenplay({ id: 'trusted-1' }),
      createTestScreenplay({ id: 'legacy', producerProjection: undefined }),
    ];

    const { container } = render(<ComparisonModal />);
    expect(container).toBeEmptyDOMElement();
  });
});
