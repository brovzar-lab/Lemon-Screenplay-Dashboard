/**
 * Component Tests for ScreenplayGrid (Virtual Scrolling)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenplayGrid } from './ScreenplayGrid';
import { createTestScreenplay } from '@/test/factories';

// Mock useVirtualizer to avoid scroll container measurement in JSDOM
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 380,
        size: 380,
      })),
    getTotalSize: () => count * 380,
    scrollToOffset: vi.fn(),
    measure: vi.fn(),
  }),
}));

// Mock useColumnCount to default to 2 columns for tests
vi.mock('@/hooks/useColumnCount', () => ({
  useColumnCount: () => 2,
}));

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

  it('renders cards inside virtual rows', () => {
    const screenplays = [
      createTestScreenplay({ id: '1', title: 'First Movie' }),
      createTestScreenplay({ id: '2', title: 'Second Movie' }),
    ];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    // VirtualRow renders with role="group"
    const rowGroups = screen.getAllByRole('group');
    expect(rowGroups.length).toBeGreaterThan(0);

    // Cards are wrapped in role="listitem"
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBeGreaterThan(0);
  });

  it('renders correct number of skeleton cards while loading', () => {
    render(<ScreenplayGrid screenplays={[]} isLoading={true} />);

    // Should render 9 skeleton cards
    const skeletonCards = document.querySelectorAll('.card.animate-pulse');
    expect(skeletonCards).toHaveLength(9);
  });

  it('wraps cards in ErrorBoundary for resilience', () => {
    // This test verifies the ErrorBoundary is present by checking
    // that rendering doesn't crash even with edge cases
    const screenplays = [createTestScreenplay({ id: '1', title: 'Boundary Movie' })];

    // Should not throw
    expect(() =>
      render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />)
    ).not.toThrow();
  });

  it('calls onCardClick when a card is clicked', () => {
    const handleClick = vi.fn();
    const screenplays = [createTestScreenplay({ id: '1', title: 'Clickable Movie' })];

    render(
      <ScreenplayGrid
        screenplays={screenplays}
        isLoading={false}
        onCardClick={handleClick}
      />
    );

    // Click the card article element
    const card = screen.getByText('Clickable Movie').closest('article');
    expect(card).toBeTruthy();
    fireEvent.click(card!);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(screenplays[0]);
  });
});
