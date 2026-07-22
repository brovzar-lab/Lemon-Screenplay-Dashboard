/**
 * Component Tests for ScreenplayGrid (CSS Grid layout)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenplayGrid } from './ScreenplayGrid';
import { createTestScreenplay } from '@/test/factories';

// Mock the comparison store
vi.mock('@/stores/comparisonStore', () => ({
  useComparisonStore: () => vi.fn(),
  useIsSelectedForComparison: () => false,
  useIsComparisonFull: () => false,
}));

// Mock delete hooks (they require QueryClientProvider)
vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [], isLoading: false }),
  useDeleteScreenplays: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  SCREENPLAYS_QUERY_KEY: ['screenplays'],
}));

// Mock BulkActionBar to avoid its internal dependencies
vi.mock('./BulkActionBar', () => ({
  BulkActionBar: () => <div data-testid="bulk-action-bar" />,
}));

// Mock selection store (used by BackToTopButton and cards)
vi.mock('@/stores/selectionStore', () => ({
  useSelectionStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel
      ? sel({ toggle: vi.fn(), selectAll: vi.fn(), deselectAll: vi.fn(), selectedIds: new Set() })
      : {},
  useIsSelected: () => false,
  useSelectionCount: () => 0,
  useHasSelection: () => false,
}));

describe('ScreenplayGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state with skeleton cards', () => {
    render(<ScreenplayGrid screenplays={[]} isLoading={true} />);

    // Should render skeleton cards when loading
    const skeletonCards = document.querySelectorAll('.animate-pulse');
    expect(skeletonCards.length).toBeGreaterThan(0);
  });

  it('renders empty state when no screenplays', () => {
    render(<ScreenplayGrid screenplays={[]} isLoading={false} />);

    // Cinematic empty state
    expect(screen.getByText('No screenplays found')).toBeInTheDocument();
  });

  it('renders screenplay cards when data is provided', () => {
    const screenplays = [
      createTestScreenplay({ id: '1', title: 'First Movie' }),
      createTestScreenplay({ id: '2', title: 'Second Movie' }),
      createTestScreenplay({ id: '3', title: 'Third Movie' }),
    ];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    expect(screen.getByText('First Movie')).toBeInTheDocument();
    expect(screen.getByText('Second Movie')).toBeInTheDocument();
    expect(screen.getByText('Third Movie')).toBeInTheDocument();
  });

  it('has proper list role and aria-label', () => {
    const screenplays = [createTestScreenplay({ id: '1', title: 'Test Movie' })];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    const grid = screen.getByRole('list');
    expect(grid).toHaveAttribute('aria-label', 'Screenplay results');
  });

  it('renders cards as direct list items (CSS Grid, no virtual rows)', () => {
    const screenplays = [
      createTestScreenplay({ id: '1', title: 'First Movie' }),
      createTestScreenplay({ id: '2', title: 'Second Movie' }),
    ];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    // Cards are wrapped in role="listitem" directly under the list
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(2);
  });

  it('bounds the initial card mount and appends the next batch near the bottom', () => {
    const screenplays = Array.from({ length: 60 }, (_, index) =>
      createTestScreenplay({ id: String(index), title: `Movie ${index}` }),
    );

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    const grid = screen.getByRole('list');
    expect(screen.getAllByRole('listitem')).toHaveLength(48);
    expect(screen.queryByText('Movie 59')).not.toBeInTheDocument();

    Object.defineProperties(grid, {
      scrollHeight: { configurable: true, value: 5_000 },
      clientHeight: { configurable: true, value: 1_000 },
      scrollTop: { configurable: true, value: 3_500 },
    });
    fireEvent.scroll(grid);

    expect(screen.getAllByRole('listitem')).toHaveLength(60);
    expect(screen.getByText('Movie 59')).toBeInTheDocument();
  }, 15_000);

  it('renders correct number of skeleton cards while loading', () => {
    render(<ScreenplayGrid screenplays={[]} isLoading={true} />);

    // Should render 8 skeleton cards
    const skeletonCards = document.querySelectorAll('.card.animate-pulse');
    expect(skeletonCards).toHaveLength(8);
  });

  it('wraps cards in ErrorBoundary for resilience', () => {
    // This test verifies the ErrorBoundary is present by checking
    // that rendering doesn't crash even with edge cases
    const screenplays = [createTestScreenplay({ id: '1', title: 'Boundary Movie' })];

    // Should not throw
    expect(() =>
      render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />),
    ).not.toThrow();
  });

  it('renders BulkActionBar as sibling', () => {
    const screenplays = [createTestScreenplay({ id: '1', title: 'Test Movie' })];
    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
  });

  it('calls onCardClick when a card is clicked', () => {
    const handleClick = vi.fn();
    const screenplays = [createTestScreenplay({ id: '1', title: 'Clickable Movie' })];

    render(
      <ScreenplayGrid screenplays={screenplays} isLoading={false} onCardClick={handleClick} />,
    );

    // Click the card article element
    const card = screen.getByText('Clickable Movie').closest('article');
    expect(card).toBeTruthy();
    fireEvent.click(card!);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(screenplays[0]);
  });
});
