/**
 * Component Tests for ScreenplayCard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenplayCard } from './ScreenplayCard';
import type { Screenplay } from '@/types';

// Mock the comparison store
vi.mock('@/stores/comparisonStore', () => ({
  useComparisonStore: () => vi.fn(),
  useIsSelectedForComparison: () => false,
  useIsComparisonFull: () => false,
}));

// Mock screenplay factory
function createMockScreenplay(overrides: Partial<Screenplay> = {}): Screenplay {
  return {
    id: 'test-id',
    title: 'The Test Movie',
    author: 'John Doe',
    logline: 'A gripping tale of testing React components.',
    genre: 'Drama',
    subgenres: ['Indie'],
    themes: ['Identity', 'Family'],
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
      protagonist: 8,
      supportingCast: 7,
      dialogue: 6,
      genreExecution: 7,
      originality: 8,
      weightedScore: 7.5,
    },
    cvsFactors: {
      targetAudience: { score: 2, note: 'Good audience' },
      highConcept: { score: 2, note: 'Solid concept' },
      castAttachability: { score: 2, note: 'Castable' },
      marketingHook: { score: 2, note: 'Has hook' },
      budgetReturn: { score: 2, note: 'Good ratio' },
      comparableSuccess: { score: 2, note: 'Has comps' },
    },
    producerMetrics: {
      marketPotential: 7,
      productionRisk: 'Medium',
      starVehiclePotential: 8,
      festivalAppeal: 7,
      roiIndicator: 4,
      uspStrength: 'Moderate',
    },
    strengths: ['Strong characters', 'Unique voice'],
    weaknesses: ['Pacing issues'],
    comparableFilms: ['Film A', 'Film B'],
    standoutScenes: ['Opening sequence'],
    developmentNotes: ['Polish dialogue'],
    criticalFailures: [],
    characters: [],
    verdictStatement: 'A solid screenplay with potential.',
    metadata: {
      sourceFile: 'test.pdf',
      pageCount: 110,
      wordCount: 20000,
      analysisVersion: 'v3',
    },
    sourceFile: 'test.pdf',
    ...overrides,
  };
}

describe('ScreenplayCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders screenplay title and author', () => {
    const screenplay = createMockScreenplay();
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('The Test Movie')).toBeInTheDocument();
    expect(screen.getByText('by John Doe')).toBeInTheDocument();
  });

  it('renders recommendation badge', () => {
    const screenplay = createMockScreenplay({ recommendation: 'recommend' });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('RECOMMEND')).toBeInTheDocument();
  });

  it('renders FILM NOW badge with special styling', () => {
    const screenplay = createMockScreenplay({
      recommendation: 'film_now',
      isFilmNow: true,
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('FILM NOW')).toBeInTheDocument();
  });

  it('renders genre and budget tags', () => {
    const screenplay = createMockScreenplay({
      genre: 'Thriller',
      budgetCategory: 'high',
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('Thriller')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('renders logline text', () => {
    const screenplay = createMockScreenplay({
      logline: 'A unique story about something special.',
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('A unique story about something special.')).toBeInTheDocument();
  });

  it('renders weighted score', () => {
    const screenplay = createMockScreenplay({ weightedScore: 8.5 });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('8.5')).toBeInTheDocument();
  });

  it('renders CVS total', () => {
    const screenplay = createMockScreenplay({ cvsTotal: 14 });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('14/18')).toBeInTheDocument();
  });

  it('renders producer metrics (Market, ROI stars)', () => {
    const screenplay = createMockScreenplay({
      producerMetrics: {
        marketPotential: 9,
        productionRisk: 'Low',
        starVehiclePotential: 8,
        festivalAppeal: 7,
        roiIndicator: 4,
        uspStrength: 'Strong',
      },
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('Market')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('ROI')).toBeInTheDocument();
    // 4 filled stars + 1 empty star = "★★★★☆"
    expect(screen.getByText('★★★★☆')).toBeInTheDocument();
  });

  it('renders collection year', () => {
    const screenplay = createMockScreenplay({ collection: '2020 Black List' });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('2020')).toBeInTheDocument();
  });

  it('shows critical failures warning when present', () => {
    const screenplay = createMockScreenplay({
      criticalFailures: ['Plot holes', 'Weak ending'],
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('⚠ 2 Critical Failures')).toBeInTheDocument();
  });

  it('does not show critical failures warning when empty', () => {
    const screenplay = createMockScreenplay({ criticalFailures: [] });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.queryByText(/Critical Failure/)).not.toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const handleClick = vi.fn();
    const screenplay = createMockScreenplay();
    render(<ScreenplayCard screenplay={screenplay} onClick={handleClick} />);

    fireEvent.click(screen.getByRole('article'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders dimension score bars', () => {
    const screenplay = createMockScreenplay({
      dimensionScores: {
        concept: 9,
        structure: 8,
        protagonist: 7,
        supportingCast: 6,
        dialogue: 5,
        genreExecution: 4,
        originality: 8,
        weightedScore: 7.5,
      },
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    // Should show first 4 dimension scores
    expect(screen.getByText('Concept')).toBeInTheDocument();
    expect(screen.getByText('Structure')).toBeInTheDocument();
    expect(screen.getByText('Protagonist')).toBeInTheDocument();
    expect(screen.getByText('Supporting Cast')).toBeInTheDocument();
  });

  it('has comparison button with correct aria-label', () => {
    const screenplay = createMockScreenplay();
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByLabelText('Add to comparison')).toBeInTheDocument();
  });

  it('handles screenplay with missing producerMetrics gracefully', () => {
    const screenplay = createMockScreenplay();
    // @ts-expect-error - Testing defensive coding
    delete screenplay.producerMetrics;

    // Should not throw
    expect(() => render(<ScreenplayCard screenplay={screenplay} />)).not.toThrow();
  });

  it('handles screenplay with string weightedScore', () => {
    const screenplay = createMockScreenplay();
    // @ts-expect-error - Testing defensive coding for data from API
    screenplay.weightedScore = '7.5';

    // Should not throw
    expect(() => render(<ScreenplayCard screenplay={screenplay} />)).not.toThrow();
    expect(screen.getByText('7.5')).toBeInTheDocument();
  });
});
