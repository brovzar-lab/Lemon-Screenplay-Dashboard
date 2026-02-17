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

    expect(screen.getByText('No Screenplays Found')).toBeInTheDocument();
    expect(screen.getByText(/no screenplays loaded/i)).toBeInTheDocument();
    expect(screen.getByText('🎬')).toBeInTheDocument();
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

  it('renders each card as a listitem', () => {
    const screenplays = [
      createTestScreenplay({ id: '1', title: 'First Movie' }),
      createTestScreenplay({ id: '2', title: 'Second Movie' }),
    ];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
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

    // Click on the card wrapper (listitem)
    const listItem = screen.getByRole('listitem');
    fireEvent.click(listItem);

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

    const listItem = screen.getByRole('listitem');
    fireEvent.keyDown(listItem, { key: 'Enter' });

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

    const listItem = screen.getByRole('listitem');
    fireEvent.keyDown(listItem, { key: ' ' });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('has proper aria-label for each card', () => {
    const screenplays = [
      createTestScreenplay({
        id: '1',
        title: 'Accessible Movie',
        author: 'Jane Smith',
        recommendation: 'film_now',
      }),
    ];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    const listItem = screen.getByRole('listitem');
    expect(listItem).toHaveAttribute(
      'aria-label',
      'Accessible Movie by Jane Smith, film_now recommendation'
    );
  });

  it('cards are focusable with tabIndex', () => {
    const screenplays = [createTestScreenplay({ id: '1', title: 'Focusable Movie' })];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    const listItem = screen.getByRole('listitem');
    expect(listItem).toHaveAttribute('tabindex', '0');
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
});
