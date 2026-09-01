import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createCoverageTestScreenplay, createTestScreenplay } from '@/test/factories';
import { ScreenplayRanking } from '@/components/discover/screenplay/ScreenplayRanking';

describe('ScreenplayRanking decision data', () => {
  it('shows a manually surfaced Coverage project as unscored, not unverified', () => {
    render(
      <ScreenplayRanking
        screenplay={createCoverageTestScreenplay()}
        rank={1}
        reason={{
          code: 'manual_pin',
          headline: 'Manually pinned',
          detail: '',
          selectedProjectId: 'coverage-test-id',
          selectedForDate: '2026-09-01',
          mandateFallback: false,
          invalidPin: false,
        }}
        outsideCurrentView={false}
        producerAssessments={new Map()}
        onOpen={vi.fn()}
      />,
    );

    const decision = screen.getByLabelText('AI decision');
    expect(within(decision).getByText('Coverage · unscored by design')).toBeInTheDocument();
    expect(within(decision).getByText('RECOMMEND')).toBeInTheDocument();
    expect(within(decision).getByText('high')).toBeInTheDocument();
    expect(screen.queryByText('Not verified / not rankable')).not.toBeInTheDocument();
    expect(screen.queryByText('Decision data unavailable until verification')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });

  it('keeps the score and verdict but omits the featured percentile', () => {
    render(
      <ScreenplayRanking
        screenplay={createTestScreenplay({ weightedScore: 7.4, recommendation: 'consider' })}
        rank={1}
        reason={{
          code: 'highest_overall',
          headline: 'Highest-scoring eligible project',
          detail: '',
          selectedProjectId: 'test-id',
          selectedForDate: '2026-08-20',
          mandateFallback: false,
          invalidPin: false,
        }}
        outsideCurrentView={false}
        producerAssessments={new Map()}
        onOpen={vi.fn()}
      />,
    );

    const decision = screen.getByLabelText('AI decision');
    expect(within(decision).getByText('7.4')).toBeInTheDocument();
    expect(within(decision).getByText('CONSIDER')).toBeInTheDocument();
    expect(within(decision).queryByText(/percentile/i)).not.toBeInTheDocument();
  });
});
