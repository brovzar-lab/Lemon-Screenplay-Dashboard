import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComparisonBar } from '@/components/comparison/ComparisonBar';
import { createCoverageTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const mocks = vi.hoisted(() => ({ screenplays: [] as Screenplay[] }));

vi.mock('@/stores/comparisonStore', () => ({
  useComparisonStore: () => ({
    selectedIds: ['coverage-test-id'],
    removeFromComparison: vi.fn(),
    clearComparison: vi.fn(),
    setIsComparing: vi.fn(),
  }),
  useIsComparisonFull: () => false,
}));
vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: mocks.screenplays }),
}));

describe('ComparisonBar', () => {
  it('never exposes a Coverage V1 placeholder score', () => {
    mocks.screenplays = [createCoverageTestScreenplay()];
    render(<ComparisonBar />);

    expect(screen.getByText('Coverage · unscored by design')).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });
});
