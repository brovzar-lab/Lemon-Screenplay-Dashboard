import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { AlertBanners } from './AlertBanners';

describe('AlertBanners analysis quality', () => {
  it('blocks decisions when readers are missing without claiming a reweighted score', () => {
    const screenplay = createTestScreenplay({
      analysisQuality: {
        status: 'partial',
        completedReaders: 3,
        expectedReaders: 5,
        failedReaders: ['concept', 'emotional_resonance'],
      },
    });

    render(<AlertBanners screenplay={screenplay} />);

    expect(screen.getByText('Incomplete reader panel')).toBeInTheDocument();
    expect(screen.getByText('Decision blocked')).toBeInTheDocument();
    expect(screen.getByText(/3 of 5 readers completed/i)).toBeInTheDocument();
    expect(screen.getByText(/concept, emotional resonance/i)).toBeInTheDocument();
    expect(screen.queryByText(/reweighted/i)).not.toBeInTheDocument();
  });

  it('does not show a quality warning for a complete analysis', () => {
    const screenplay = createTestScreenplay({
      analysisQuality: {
        status: 'complete',
        completedReaders: 5,
        expectedReaders: 5,
        failedReaders: [],
      },
    });

    render(<AlertBanners screenplay={screenplay} />);

    expect(screen.queryByText('Incomplete reader panel')).not.toBeInTheDocument();
  });

  it('surfaces unstable, disputed, and legacy warnings from the producer projection', () => {
    const screenplay = createTestScreenplay({
      producerProjection: {
        rawScore: 7.4,
        finalScore: 7.1,
        scoreSource: 'adjusted',
        penaltyApplied: 0.3,
        reportedPenalty: 0.3,
        finalVerdict: 'consider',
        verdictAdjustments: [],
        gates: [],
        rankable: true,
        trustStatus: 'legacy_unverified',
        boundary: {
          checked: true,
          runCount: 3,
          failedRunCount: 0,
          scoreSpread: 0.8,
          verdicts: ['consider', 'recommend'],
          stable: false,
        },
        readerDisagreementCount: 1,
        warnings: [
          {
            code: 'unstable_boundary',
            severity: 'warning',
            title: 'Verdict stability warning',
            detail: 'Three scoring runs did not agree.',
          },
          {
            code: 'reader_disagreement',
            severity: 'warning',
            title: 'Specialist readers disagreed',
            detail: 'One material disagreement was recorded.',
          },
          {
            code: 'legacy_unverified',
            severity: 'information',
            title: 'Legacy analysis',
            detail: 'This record predates the trust manifest.',
          },
        ],
      },
    });

    render(<AlertBanners screenplay={screenplay} />);

    expect(screen.getByText('Verdict stability warning')).toBeInTheDocument();
    expect(screen.getByText('Specialist readers disagreed')).toBeInTheDocument();
    expect(screen.getByText('Legacy analysis')).toBeInTheDocument();
  });
});
