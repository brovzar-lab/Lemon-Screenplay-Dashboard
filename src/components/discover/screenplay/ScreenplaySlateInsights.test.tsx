import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { ScreenplaySlateInsights } from './ScreenplaySlateInsights';

vi.mock('@/components/charts/AnalyticsDashboard', () => ({
  AnalyticsDashboard: ({
    initiallyExpanded,
    maxGenres,
  }: {
    initiallyExpanded?: boolean;
    maxGenres?: number;
  }) => (
    <button type="button" aria-expanded={initiallyExpanded} data-max-genres={maxGenres}>
      Slate Insights
    </button>
  ),
}));

describe('ScreenplaySlateInsights', () => {
  it('loads the screenplay analytics disclosure collapsed', async () => {
    const user = userEvent.setup();
    render(
      <ScreenplaySlateInsights
        screenplays={[createTestScreenplay({ id: 'visible' })]}
        allScreenplays={[createTestScreenplay({ id: 'visible' })]}
      />,
    );

    const disclosure = screen.getByRole('button', { name: /Show Slate Insights/i });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await user.click(disclosure);
    expect(await screen.findByRole('button', { name: 'Slate Insights' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Slate Insights' })).toHaveAttribute(
      'data-max-genres',
      '4',
    );
  });

  it('contains lazy-load failures without removing sibling results', async () => {
    const Broken = () => {
      throw new Error('analytics unavailable');
    };
    const user = userEvent.setup();

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

    await user.click(await screen.findByRole('button', { name: 'Show Slate Insights' }));

    expect(screen.getByText(/Slate Insights are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Screenplay result' })).toBeInTheDocument();
  });
});
