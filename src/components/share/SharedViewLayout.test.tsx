import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SharedViewDocument } from '@/lib/shareService';
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
});
