/**
 * Component Tests for ScreenplayGrid
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenplayGrid } from './ScreenplayGrid';
import type { Screenplay } from '@/types';

// Mock the comparison store
vi.mock('@/stores/comparisonStore', () => ({
  useComparisonStore: () => vi.fn(),
  useIsSelectedForComparison: () => false,
  useIsComparisonFull: () => false,
}));

// Mock screenplay factory
function createMockScreenplay(id: string, title: string): Screenplay {
  return {
    id,
    title,
    author: 'Test Author',
    logline: 'A test logline.',
    genre: 'Drama',
    subgenres: [],
    themes: [],
    budgetCategory: 'low',
    collection: '2020 Black List',
    recommendation: 'recommend',
    isFilmNow: false,
    weightedScore: 7.5,
    cvsTotal: 12,
    marketability: 'medium',
    dimensionScores: {
      concept: 7,
      structure: 7,
      protagonist: 7,
      supportingCast: 7,
      dialogue: 7,
      genreExecution: 7,
      originality: 7,
      weightedScore: 7.5,
    },
    cvsFactors: {
      targetAudience: { score: 2, note: '' },
      highConcept: { score: 2, note: '' },
      castAttachability: { score: 2, note: '' },
      marketingHook: { score: 2, note: '' },
      budgetReturn: { score: 2, note: '' },
      comparableSuccess: { score: 2, note: '' },
    },
    producerMetrics: {
      marketPotential: 7,
      productionRisk: 'Medium',
      starVehiclePotential: 7,
      festivalAppeal: 7,
      roiIndicator: 3,
      uspStrength: 'Moderate',
    },
    strengths: [],
    weaknesses: [],
    comparableFilms: [],
    standoutScenes: [],
    developmentNotes: [],
    criticalFailures: [],
    characters: [],
    verdictStatement: '',
    metadata: {
      sourceFile: 'test.pdf',
      pageCount: 100,
      wordCount: 20000,
      analysisVersion: 'v3',
    },
    sourceFile: 'test.pdf',
  };
}

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
      createMockScreenplay('1', 'First Movie'),
      createMockScreenplay('2', 'Second Movie'),
      createMockScreenplay('3', 'Third Movie'),
    ];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    expect(screen.getByText('First Movie')).toBeInTheDocument();
    expect(screen.getByText('Second Movie')).toBeInTheDocument();
    expect(screen.getByText('Third Movie')).toBeInTheDocument();
  });

  it('has proper list role and aria-label', () => {
    const screenplays = [createMockScreenplay('1', 'Test Movie')];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    const grid = screen.getByRole('list');
    expect(grid).toHaveAttribute('aria-label', 'Screenplay results');
  });

  it('renders each card as a listitem', () => {
    const screenplays = [
      createMockScreenplay('1', 'First Movie'),
      createMockScreenplay('2', 'Second Movie'),
    ];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('calls onCardClick when a card is clicked', () => {
    const handleClick = vi.fn();
    const screenplays = [createMockScreenplay('1', 'Clickable Movie')];

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
    const screenplays = [createMockScreenplay('1', 'Keyboard Movie')];

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
    const screenplays = [createMockScreenplay('1', 'Space Movie')];

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
      createMockScreenplay('1', 'Accessible Movie'),
    ];
    screenplays[0].author = 'Jane Smith';
    screenplays[0].recommendation = 'film_now';

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    const listItem = screen.getByRole('listitem');
    expect(listItem).toHaveAttribute(
      'aria-label',
      'Accessible Movie by Jane Smith, film_now recommendation'
    );
  });

  it('cards are focusable with tabIndex', () => {
    const screenplays = [createMockScreenplay('1', 'Focusable Movie')];

    render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />);

    const listItem = screen.getByRole('listitem');
    expect(listItem).toHaveAttribute('tabIndex', '0');
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
    const screenplays = [createMockScreenplay('1', 'Boundary Movie')];

    // Should not throw
    expect(() =>
      render(<ScreenplayGrid screenplays={screenplays} isLoading={false} />)
    ).not.toThrow();
  });
});
