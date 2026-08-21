import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SharedViewDocument } from '@/lib/shareService';
import i18n from '@/i18n';
import { SharedViewLayout } from './SharedViewLayout';

vi.mock('./SharedScoresPanel', () => ({ SharedScoresPanel: () => null }));
vi.mock('./SharedContentDetails', () => ({ SharedContentDetails: () => null }));

function share(recommendation: 'pass' | 'consider', posterUrl: string | null): SharedViewDocument {
  return {
    posterUrl,
    pdfUrl: null,
    analysis: {
      title: 'Will',
      author: 'Writer',
      genre: 'Romantic Comedy',
      subgenres: [],
      recommendation,
      verdictStatement: 'Original English analysis.',
    },
  } as unknown as SharedViewDocument;
}

describe('SharedViewLayout poster policy', () => {
  it.each(['pass', 'consider'] as const)(
    'keeps %s poster art inside the authenticated project Poster tab',
    (recommendation) => {
      render(
        <SharedViewLayout
          data={share(recommendation, 'https://example.com/old-paid-poster.png')}
        />,
      );

      expect(screen.queryByRole('img', { name: /poster/i })).not.toBeInTheDocument();
    },
  );

  it('shows an explicit Spanish fallback instead of silently presenting English analysis', async () => {
    await i18n.changeLanguage('es');
    render(<SharedViewLayout data={share('consider', null)} />);

    expect(screen.getByText('Análisis disponible en inglés')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Cambia a inglés para leer el análisis original o vuelve cuando se haya guardado la traducción al español.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Original English analysis.')).not.toBeInTheDocument();
  });

  it('uses a saved Spanish narrative while preserving the original title', async () => {
    await i18n.changeLanguage('es');
    const data = share('consider', null);
    data.analysis.verdictStatement = 'Original English analysis.';
    data.localizedAnalysis = {
      es: {
        sourceVersionId: 'v1',
        generatedAt: '2026-08-20T12:00:00.000Z',
        model: 'test-translator',
        content: { verdictStatement: 'Análisis guardado en español.' },
      },
    };

    render(<SharedViewLayout data={data} />);

    expect(screen.getByRole('heading', { name: 'Will' })).toBeInTheDocument();
    expect(screen.getByText('Análisis guardado en español.')).toBeInTheDocument();
    expect(screen.queryByText('Análisis disponible en inglés')).not.toBeInTheDocument();
  });
});
