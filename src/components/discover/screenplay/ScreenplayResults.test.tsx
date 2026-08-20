import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { useShareStore } from '@/stores/shareStore';
import { ScreenplayGrid } from './ScreenplayResults';

describe('Discovery screenplay cards', () => {
  beforeEach(() => useShareStore.setState({ tokens: {} }));

  it('shows the decision hierarchy without percentile or inactive-share noise', () => {
    const screenplay = createTestScreenplay({
      sourceFile: 'oro.pdf',
      title: 'Oro de Acapulco',
      weightedScore: 6.8,
      recommendation: 'consider',
      genre: 'Society (Power/Tyranny)',
      subgenres: ['TV Pilot'],
    });

    render(<ScreenplayGrid entries={[{ screenplay, rank: 1 }]} onOpen={vi.fn()} />);

    expect(screen.getAllByText('Oro de Acapulco')).toHaveLength(2);
    expect(screen.getByText('6.8')).toBeInTheDocument();
    expect(screen.getByText('Lemon score')).toBeInTheDocument();
    expect(screen.getByText(/consider/i)).toBeInTheDocument();
    expect(screen.getByText(/tv pilot/i)).toBeInTheDocument();
    expect(screen.getByText('Society (Power/Tyranny)')).toBeInTheDocument();
    expect(screen.queryByText(/percentile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not shared externally/i)).not.toBeInTheDocument();
  });

  it('keeps active-share information when a link exists', () => {
    const screenplay = createTestScreenplay({ sourceFile: 'shared.pdf' });
    useShareStore.setState({
      tokens: {
        'shared.pdf': {
          token: 'active-token',
          screenplayId: screenplay.id,
          screenplayTitle: screenplay.title,
          includeNotes: false,
          createdAt: '2026-08-20T00:00:00.000Z',
        },
      },
    });

    render(<ScreenplayGrid entries={[{ screenplay, rank: 1 }]} onOpen={vi.fn()} />);

    expect(screen.getByText('Active share link')).toBeInTheDocument();
  });
});
