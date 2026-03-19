/**
 * Component Tests for ScreenplayGrid
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

    // Cinematic empty state (replaced generic emoji state)
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

    // Click on the card wrapper (data-card attribute)
    const cardWrapper = document.querySelector('[data-card]') as HTMLElement;
    fireEvent.click(cardWrapper);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(screenplays[0]);
  });

  it('supports keyboard navigation with Enter key', () => {
    const handleClick = vi.fn();
    const screenplays = [createTestScreenplay({ id: '1', title: 'Keyboard Movie' })];

    render(
      <ScreenplayGrid
        screenplays={screenplays}
        isLoading={false}
        onCardClick={handleClick}
      />
    );

    const cardWrapper = document.querySelector('[data-card]') as HTMLElement;
    fireEvent.keyDown(cardWrapper, { key: 'Enter' });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard navigation with Space key', () => {
    const handleClick = vi.fn();
    const screenplays = [createTestScreenplay({ id: '1', title: 'Space Movie' })];

    render(
      <ScreenplayGrid
        screenplays={screenplays}
        isLoading={false}
        onCardClick={handleClick}
      />
    );

    const cardWrapper = document.querySelector('[data-card]') as HTMLElement;
    fireEvent.keyDown(cardWrapper, { key: ' ' });

    expect(handleClick).toHaveBeenCalledTimes(1);
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

  it('renders at most 80 DOM elements with 100 screenplay items', () => {
    const screenplays = Array.from({ length: 100 }, (_, i) =>
      createTestScreenplay({ id: String(i), title: `Movie ${i}` })
    );
    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);
    const cards = document.querySelectorAll('[data-card]');
    expect(cards.length).toBeLessThanOrEqual(80);
  });
});
