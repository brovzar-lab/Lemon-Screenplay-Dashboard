import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { AlertBanners } from './AlertBanners';

describe('AlertBanners analysis quality', () => {
  it('shows completed and missing readers for a partial analysis', () => {
    const screenplay = createTestScreenplay({
      analysisQuality: {
        status: 'partial',
        completedReaders: 3,
        expectedReaders: 5,
        failedReaders: ['concept', 'emotional_resonance'],
      },
    });

    render(<AlertBanners screenplay={screenplay} />);

    expect(screen.getByText('Partial analysis')).toBeInTheDocument();
    expect(screen.getByText(/3 of 5 readers completed/i)).toBeInTheDocument();
    expect(screen.getByText(/concept, emotional resonance/i)).toBeInTheDocument();
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

    expect(screen.queryByText('Partial analysis')).not.toBeInTheDocument();
  });
});
