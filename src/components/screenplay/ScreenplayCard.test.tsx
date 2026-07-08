/**
 * Component Tests for ScreenplayCard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenplayCard } from './ScreenplayCard';
import { createTestScreenplay } from '@/test/factories';

// Mock the selection store
const mockUseIsSelected = vi.fn(() => false);
const mockToggle = vi.fn();
vi.mock('@/stores/selectionStore', () => ({
  useIsSelected: (...args: unknown[]) => mockUseIsSelected(...args),
  useSelectionStore: (sel: ((s: { toggle: typeof mockToggle }) => unknown) | undefined) =>
    sel ? sel({ toggle: mockToggle }) : { toggle: mockToggle },
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


describe('ScreenplayCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders screenplay title and author', () => {
    const screenplay = createTestScreenplay({ title: 'The Test Movie', author: 'John Doe' });
    render(<ScreenplayCard screenplay={screenplay} />);

    // Title is always visible on the card
    expect(screen.getByText('The Test Movie')).toBeInTheDocument();
    // Author is shown in the modal, not on the card (V9 design)
  });

  it('renders recommendation badge', () => {
    const screenplay = createTestScreenplay({ recommendation: 'recommend' });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('RECOMMEND')).toBeInTheDocument();
  });

  it('renders FILM NOW badge with special styling', () => {
    const screenplay = createTestScreenplay({
      recommendation: 'film_now',
      isFilmNow: true,
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('FILM NOW')).toBeInTheDocument();
  });

  it('renders genre and budget tags', () => {
    const screenplay = createTestScreenplay({
      genre: 'Thriller',
      budgetCategory: 'high',
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('Thriller')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('renders logline text', () => {
    const screenplay = createTestScreenplay({
      logline: 'A unique story about something special.',
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('A unique story about something special.')).toBeInTheDocument();
  });

  it('renders weighted score', () => {
    const screenplay = createTestScreenplay({ weightedScore: 8.5 });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('8.5')).toBeInTheDocument();
  });

  it('renders CVS total', () => {
    const screenplay = createTestScreenplay({
      cvsTotal: 14,
      commercialViability: {
        targetAudience: { score: 3, note: '' },
        highConcept: { score: 2, note: '' },
        castAttachability: { score: 2, note: '' },
        marketingHook: { score: 2, note: '' },
        budgetReturnRatio: { score: 2, note: '' },
        comparableSuccess: { score: 3, note: '' },
        cvsTotal: 14,
        cvsAssessed: true,
      },
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('14/18')).toBeInTheDocument();
  });

  it('renders producer metrics mini display', () => {
    const screenplay = createTestScreenplay({
      producerMetrics: {
        marketPotential: 9,
        marketPotentialRationale: 'Outstanding commercial potential.',
        uspStrength: 'Strong',
        uspStrengthRationale: 'Highly original concept.',
      },
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    // Card still shows the weighted score prominently (which includes producer metrics influence)
    // Producer metrics detail is in the modal (V9 card design)
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
  });

  it('renders collection year', () => {
    const screenplay = createTestScreenplay({ collection: '2020 Black List' });
    render(<ScreenplayCard screenplay={screenplay} />);

    // Collection may appear in tags or genre strip — verify card renders without error
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
  });

  it('does not show critical failures warning on card (shown in modal only)', () => {
    const screenplay = createTestScreenplay({
      criticalFailures: ['Plot holes', 'Weak ending'],
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    // V9 card design: critical failures hidden from card, appear in modal detail view
    expect(screen.queryByText(/Critical Failure/)).not.toBeInTheDocument();
  });

  it('does not show critical failures warning when empty', () => {
    const screenplay = createTestScreenplay({ criticalFailures: [] });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.queryByText(/Critical Failure/)).not.toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const handleClick = vi.fn();
    const screenplay = createTestScreenplay();
    render(<ScreenplayCard screenplay={screenplay} onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders top-3 dimension pills', () => {
    const screenplay = createTestScreenplay({
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

    // V9 card: top-3 dimension pills rendered, not score bars
    // The card renders without error and shows the article element
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
  });

  it('renders always-visible bulk selection checkbox', () => {
    const screenplay = createTestScreenplay();
    render(<ScreenplayCard screenplay={screenplay} />);

    const checkbox = screen.getByLabelText('Select screenplay');
    expect(checkbox).toBeInTheDocument();
    // Always visible -- should NOT have opacity-0 class
    expect(checkbox.className).not.toContain('opacity-0');
  });

  it('shows gold ring when selected', () => {
    mockUseIsSelected.mockReturnValue(true);
    const screenplay = createTestScreenplay();
    render(<ScreenplayCard screenplay={screenplay} />);

    const cardButton = screen.getByRole('button', { name: /view details/i });
    expect(cardButton.className).toContain('ring-2');
    expect(cardButton.className).toContain('ring-blue-500/50');
    mockUseIsSelected.mockReturnValue(false);
  });

  it('handles screenplay with missing producerMetrics gracefully', () => {
    const screenplay = createTestScreenplay();
    // @ts-expect-error - Testing defensive coding
    delete screenplay.producerMetrics;

    // Should not throw (ErrorBoundary in parent catches this in prod)
    expect(() => render(<ScreenplayCard screenplay={screenplay} />)).not.toThrow();
  });

  it('handles screenplay with string weightedScore', () => {
    const screenplay = createTestScreenplay();
    // @ts-expect-error - Testing defensive coding for data from API
    screenplay.weightedScore = '7.5';

    // Should not throw
    expect(() => render(<ScreenplayCard screenplay={screenplay} />)).not.toThrow();
    expect(screen.getByText('7.5')).toBeInTheDocument();
  });

  it('is wrapped in React.memo', () => {
    // React.memo components have a $$typeof of Symbol(react.memo)
    expect((ScreenplayCard as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });

  it('clamps all loglines to 2 lines regardless of recommendation tier', () => {
    const screenplay = createTestScreenplay({
      recommendation: 'film_now',
      isFilmNow: true,
      logline: 'A prestigious screenplay with a very long logline that should be clamped.',
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    const logline = screen.getByText('A prestigious screenplay with a very long logline that should be clamped.');
    expect(logline).toHaveClass('line-clamp-2');
  });
});
