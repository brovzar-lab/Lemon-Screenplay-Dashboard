/**
 * Component Tests for AnalyticsDashboard
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { createTestScreenplay } from '@/test/factories';

// Mock Recharts sub-components to avoid SVG rendering issues in jsdom
vi.mock('./ScoreDistribution', () => ({
  ScoreDistribution: () => <div data-testid="score-distribution" />,
}));

vi.mock('./TierBreakdown', () => ({
  TierBreakdown: () => <div data-testid="tier-breakdown" />,
}));

vi.mock('./GenreChart', () => ({
  GenreChart: () => <div data-testid="genre-chart" />,
}));

vi.mock('./BudgetChart', () => ({
  BudgetChart: () => <div data-testid="budget-chart" />,
}));

const mockScreenplays = [
  createTestScreenplay({ id: 'sp-1', recommendation: 'recommend', weightedScore: 8 }),
  createTestScreenplay({ id: 'sp-2', recommendation: 'film_now', weightedScore: 9.5 }),
  createTestScreenplay({ id: 'sp-3', recommendation: 'pass', weightedScore: 4 }),
];

const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal('ResizeObserver', class {
    observe = observe;
    disconnect = disconnect;
  });
});

describe('AnalyticsDashboard', () => {
  it('renders the Analytics Dashboard heading', () => {
    render(<AnalyticsDashboard screenplays={mockScreenplays} />);

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
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

  it('renders all four chart sub-components when expanded', () => {
    render(<AnalyticsDashboard screenplays={mockScreenplays} />);

    // Default state is expanded
    expect(screen.getByTestId('score-distribution')).toBeInTheDocument();
    expect(screen.getByTestId('tier-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('genre-chart')).toBeInTheDocument();
    expect(screen.getByTestId('budget-chart')).toBeInTheDocument();
  });

  it('remeasures when asynchronous analytics content changes size', () => {
    const { unmount } = render(<AnalyticsDashboard screenplays={mockScreenplays} />);

    expect(observe).toHaveBeenCalledOnce();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('renders correctly with an empty screenplays array', () => {
    render(<AnalyticsDashboard screenplays={[]} />);

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
  });

  it('shows filtered label when totalScreenplays differs from screenplays', () => {
    const all = [
      ...mockScreenplays,
      createTestScreenplay({ id: 'sp-4', recommendation: 'consider' }),
    ];
    render(<AnalyticsDashboard screenplays={mockScreenplays} totalScreenplays={all} />);

    expect(screen.getByText('(filtered)')).toBeInTheDocument();
  });
});
