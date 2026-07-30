import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SharedScoresPanel } from '@/components/share/SharedScoresPanel';
import type { SharedViewDocument } from '@/lib/shareService';

function legacyAnalysis(): SharedViewDocument['analysis'] {
  return {
    weightedScore: 7.2,
    cvsTotal: 0,
    pillarScores: [],
    dimensionScores: {},
    dimensionJustifications: {},
    commercialViability: {},
  } as unknown as SharedViewDocument['analysis'];
}

describe('SharedScoresPanel score lineage', () => {
  it('does not call an unverifiable legacy stored score final', () => {
    render(<SharedScoresPanel analysis={legacyAnalysis()} />);

    expect(screen.getByText('Legacy stored score')).toBeInTheDocument();
    expect(
      screen.getByText(/does not preserve adjusted-score lineage/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Raw five-pillar score')).not.toBeInTheDocument();
  });
});
