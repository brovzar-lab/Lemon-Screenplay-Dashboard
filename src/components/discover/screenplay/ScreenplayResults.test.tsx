import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { createTestScreenplay } from '@/test/factories';
import { useShareStore } from '@/stores/shareStore';
import { ScreenplayGrid } from './ScreenplayResults';

describe('Discovery screenplay cards', () => {
  beforeEach(() => useShareStore.setState({ tokens: {} }));
  afterEach(async () => i18n.changeLanguage('en'));

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

  it('never shows untranslated analysis text silently in Spanish', async () => {
    await i18n.changeLanguage('es');
    const screenplay = createTestScreenplay({
      logline: 'An English analysis logline that must not leak into Spanish.',
      genre: 'Society (Power/Tyranny)',
      subgenres: ['TV Pilot'],
    });

    render(<ScreenplayGrid entries={[{ screenplay, rank: 1 }]} onOpen={vi.fn()} />);

    expect(screen.getByText('Análisis disponible en inglés')).toBeInTheDocument();
    expect(screen.queryByText(screenplay.logline)).not.toBeInTheDocument();
    expect(screen.getByText('Sociedad (poder/tiranía)')).toBeInTheDocument();
    expect(screen.getByText('Piloto de TV')).toBeInTheDocument();
  });
});
