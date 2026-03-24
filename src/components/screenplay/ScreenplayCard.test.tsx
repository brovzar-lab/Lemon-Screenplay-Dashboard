/**
 * Component Tests for ScreenplayCard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenplayCard } from './ScreenplayCard';
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

// ─────────────────────────────────────────────────────────
// PDF Status Store mock
// ─────────────────────────────────────────────────────────

let mockPdfState = { statuses: {} as Record<string, string>, hasScanResult: false, isScanning: false };

vi.mock('@/stores/pdfStatusStore', () => ({
  usePdfStatusStore: (selector: (s: unknown) => unknown) => selector(mockPdfState),
}));

describe('ScreenplayCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPdfState = { statuses: {}, hasScanResult: false, isScanning: false };
  });

  it('renders screenplay title and author', () => {
    const screenplay = createTestScreenplay({ title: 'The Test Movie', author: 'John Doe' });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('The Test Movie')).toBeInTheDocument();
    expect(screen.getByText('by John Doe')).toBeInTheDocument();
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

    // Producer metrics mini shows market potential score
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('renders collection year', () => {
    const screenplay = createTestScreenplay({ collection: '2020 Black List' });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('2020')).toBeInTheDocument();
  });

  it('shows critical failures warning when present', () => {
    const screenplay = createTestScreenplay({
      criticalFailures: ['Plot holes', 'Weak ending'],
    });
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByText('⚠ 2 Critical Failures')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('article'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders dimension score bars', () => {
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

    // V5 shows first 4 dimension labels from DIMENSION_CONFIG
    expect(screen.getByText('Concept')).toBeInTheDocument();
    expect(screen.getByText('Structure')).toBeInTheDocument();
    expect(screen.getByText('Protagonist')).toBeInTheDocument();
    expect(screen.getByText('Supporting Cast')).toBeInTheDocument();
  });

  it('has export selection button with correct aria-label', () => {
    const screenplay = createTestScreenplay();
    render(<ScreenplayCard screenplay={screenplay} />);

    expect(screen.getByLabelText('Select for export')).toBeInTheDocument();
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

  // ────────────────────────────────────────────
  // PDF Status Badge (FILE-01)
  // ────────────────────────────────────────────

  describe('PDF status badge', () => {
    it('shows PDF found badge when hasScanResult=true and status is found', () => {
      const screenplay = createTestScreenplay({ id: 'sp-found' });
      mockPdfState = { statuses: { 'sp-found': 'found' }, hasScanResult: true, isScanning: false };

      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.getByText('PDF ✓')).toBeInTheDocument();
    });

    it('shows No PDF badge when hasScanResult=true and status is missing', () => {
      const screenplay = createTestScreenplay({ id: 'sp-missing' });
      mockPdfState = { statuses: { 'sp-missing': 'missing' }, hasScanResult: true, isScanning: false };

      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.getByText('No PDF')).toBeInTheDocument();
    });

    it('shows no PDF badge when status is unknown (no scan result, no hasPdf field)', () => {
      const screenplay = createTestScreenplay({ id: 'sp-unknown', hasPdf: undefined });
      mockPdfState = { statuses: {}, hasScanResult: false, isScanning: false };

      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.queryByText('PDF ✓')).not.toBeInTheDocument();
      expect(screen.queryByText('No PDF')).not.toBeInTheDocument();
    });

    it('falls back to hasPdf=true when no scan result', () => {
      const screenplay = createTestScreenplay({ id: 'sp-fallback-found', hasPdf: true });
      mockPdfState = { statuses: {}, hasScanResult: false, isScanning: false };

      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.getByText('PDF ✓')).toBeInTheDocument();
    });

    it('falls back to hasPdf=false when no scan result', () => {
      const screenplay = createTestScreenplay({ id: 'sp-fallback-missing', hasPdf: false });
      mockPdfState = { statuses: {}, hasScanResult: false, isScanning: false };

      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.getByText('No PDF')).toBeInTheDocument();
    });
  });

  // ────────────────────────────────────────────
  // Legacy Version Badge (FILE-02)
  // ────────────────────────────────────────────

  describe('Legacy version badge', () => {
    it('shows Legacy badge when analysisVersion is not current (v5)', () => {
      const screenplay = createTestScreenplay({ analysisVersion: 'v5' });
      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.getByText('Legacy')).toBeInTheDocument();
    });

    it('shows Legacy badge when analysisVersion is v6.0', () => {
      const screenplay = createTestScreenplay({ analysisVersion: 'v6.0' });
      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.getByText('Legacy')).toBeInTheDocument();
    });

    it('does not show Legacy badge when analysisVersion is v6_core_lenses', () => {
      const screenplay = createTestScreenplay({ analysisVersion: 'v6_core_lenses' });
      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.queryByText('Legacy')).not.toBeInTheDocument();
    });

    it('does not show Legacy badge when analysisVersion is v6_unified', () => {
      const screenplay = createTestScreenplay({ analysisVersion: 'v6_unified' });
      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.queryByText('Legacy')).not.toBeInTheDocument();
    });

    it('does not show Legacy badge when analysisVersion is undefined', () => {
      const screenplay = createTestScreenplay({ analysisVersion: undefined });
      render(<ScreenplayCard screenplay={screenplay} />);
      expect(screen.queryByText('Legacy')).not.toBeInTheDocument();
    });
  });
});
