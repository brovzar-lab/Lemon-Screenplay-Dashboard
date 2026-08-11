import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { ScreenplaySlateInsights } from './ScreenplaySlateInsights';

vi.mock('@/components/charts/AnalyticsDashboard', () => ({
  AnalyticsDashboard: ({
    expanded,
    onExpandedChange,
    maxGenres,
  }: {
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    maxGenres?: number;
  }) => (
    <button
      type="button"
      aria-expanded={expanded}
      data-max-genres={maxGenres}
      onClick={() => onExpandedChange?.(!expanded)}
    >
      Slate Insights
    </button>
  ),
}));

describe('ScreenplaySlateInsights', () => {
  beforeEach(() => window.localStorage.clear());

  it('loads expanded and remembers the user’s collapsed preference', async () => {
    const user = userEvent.setup();
    render(
      <ScreenplaySlateInsights
        screenplays={[createTestScreenplay({ id: 'visible' })]}
        allScreenplays={[createTestScreenplay({ id: 'visible' })]}
      />,
    );

    const disclosure = await screen.findByRole('button', { name: 'Slate Insights' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(disclosure).toHaveAttribute('data-max-genres', '4');
    await user.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem('lemon:discovery:slate-insights-collapsed')).toBe('true');
  });

  it('contains lazy-load failures without removing sibling results', async () => {
    const Broken = () => {
      throw new Error('analytics unavailable');
    };
    render(
      <div>
        <button type="button">Screenplay result</button>
        <ScreenplaySlateInsights
          screenplays={[createTestScreenplay({ id: 'visible' })]}
          allScreenplays={[createTestScreenplay({ id: 'visible' })]}
          AnalyticsComponent={Broken}
        />
      </div>,
    );

    expect(screen.getByText(/Slate Insights are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Screenplay result' })).toBeInTheDocument();
  });
});
