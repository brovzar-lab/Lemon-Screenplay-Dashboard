/**
 * Component Tests for AnalyticsDashboard
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { createCoverageTestScreenplay, createTestScreenplay } from '@/test/factories';

// Mock Recharts sub-components to avoid SVG rendering issues in jsdom
vi.mock('./ScoreDistribution', () => ({
  ScoreDistribution: () => <div data-testid="score-distribution" />,
}));

vi.mock('./TierBreakdown', () => ({
  TierBreakdown: () => <div data-testid="tier-breakdown" />,
}));

vi.mock('./GenreChart', () => ({
  GenreChart: ({ screenplays }: { screenplays: Array<{ genre?: string }> }) => (
    <div data-testid="genre-chart">{screenplays.map((screenplay) => screenplay.genre).join(',')}</div>
  ),
}));

vi.mock('./BudgetChart', () => ({
  BudgetChart: () => <div data-testid="budget-chart" />,
}));

vi.mock('./FormatChart', () => ({
  FormatChart: () => <div data-testid="format-chart" />,
}));

const mockScreenplays = [
  createTestScreenplay({
    id: 'sp-1',
    recommendation: 'recommend',
    weightedScore: 8,
    budgetCategory: 'unknown',
  }),
  createTestScreenplay({
    id: 'sp-2',
    recommendation: 'film_now',
    weightedScore: 9.5,
    budgetCategory: 'unknown',
  }),
  createTestScreenplay({
    id: 'sp-3',
    recommendation: 'pass',
    weightedScore: 4,
    budgetCategory: 'unknown',
  }),
];

const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = observe;
      disconnect = disconnect;
    },
  );
});

describe('AnalyticsDashboard', () => {
  it('renders the Slate Overview heading', () => {
    render(<AnalyticsDashboard screenplays={mockScreenplays} />);

    expect(screen.getByText('Slate Overview')).toBeInTheDocument();
  });

  it('renders a toggle button', () => {
    render(<AnalyticsDashboard screenplays={mockScreenplays} />);

    // The heading is inside the toggle button
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toBeInTheDocument();
  });

  it('displays screenplay count', () => {
    render(<AnalyticsDashboard screenplays={mockScreenplays} />);

    expect(screen.getByText(/screenplays/)).toBeInTheDocument();
  });

  it('uses format mix when the slate has no recorded budget data', () => {
    render(<AnalyticsDashboard screenplays={mockScreenplays} />);

    // Default state is expanded
    expect(screen.getByTestId('score-distribution')).toBeInTheDocument();
    expect(screen.getByTestId('tier-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('genre-chart')).toBeInTheDocument();
    expect(screen.getByTestId('format-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('budget-chart')).not.toBeInTheDocument();
  });

  it('keeps the operational format mix instead of the legacy budget chart', () => {
    render(
      <AnalyticsDashboard
        screenplays={[createTestScreenplay({ id: 'budgeted', budgetCategory: 'micro' })]}
      />,
    );

    expect(screen.getByTestId('format-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('budget-chart')).not.toBeInTheDocument();
  });

  it('remeasures when asynchronous analytics content changes size', () => {
    const { unmount } = render(<AnalyticsDashboard screenplays={mockScreenplays} />);

    expect(observe).toHaveBeenCalledOnce();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('renders correctly with an empty screenplays array', () => {
    render(<AnalyticsDashboard screenplays={[]} />);

    expect(screen.getByText('Slate Overview')).toBeInTheDocument();
  });

  it('shows filtered label when totalScreenplays differs from screenplays', () => {
    const all = [
      ...mockScreenplays,
      createTestScreenplay({ id: 'sp-4', recommendation: 'consider' }),
    ];
    render(<AnalyticsDashboard screenplays={mockScreenplays} totalScreenplays={all} />);

    expect(screen.getByText('(filtered)')).toBeInTheDocument();
  });

  it('preserves the old expanded default when no presentation props are supplied', () => {
    render(<AnalyticsDashboard screenplays={mockScreenplays} />);

    expect(screen.getByRole('button', { name: /Slate Overview/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByTestId('score-distribution')).toBeInTheDocument();
  });

  it('defers chart rendering until a collapsed disclosure is opened', async () => {
    const user = userEvent.setup();
    render(
      <AnalyticsDashboard
        screenplays={mockScreenplays}
        title="Slate Insights"
        initiallyExpanded={false}
        deferContentUntilExpanded
      />,
    );

    const toggle = screen.getByRole('button', { name: /Slate Insights/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('score-distribution')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('score-distribution')).toBeInTheDocument();
  });

  it('counts Coverage separately while omitting unverified model genres from portfolio analytics', () => {
    render(
      <AnalyticsDashboard
        screenplays={[
          createTestScreenplay({ genre: 'Comedy' }),
          createCoverageTestScreenplay({ id: 'coverage', genre: 'Drama' }),
          createTestScreenplay({
            id: 'unverified',
            genre: 'Horror',
            producerProjection: undefined,
          }),
        ]}
      />,
    );

    expect(screen.getByTestId('genre-chart')).toHaveTextContent('Comedy');
    expect(screen.getByTestId('genre-chart')).not.toHaveTextContent('Horror');
    expect(screen.getByTestId('genre-chart')).not.toHaveTextContent('Drama');
    expect(screen.getByText('1 unverified omitted')).toBeInTheDocument();
    expect(screen.getByText('1 coverage')).toBeInTheDocument();
  });

  it('shows no average instead of zero when the slate has no scored analyses', () => {
    render(<AnalyticsDashboard screenplays={[createCoverageTestScreenplay()]} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });
});
