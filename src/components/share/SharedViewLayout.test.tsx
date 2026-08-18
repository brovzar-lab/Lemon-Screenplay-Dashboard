import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SharedViewDocument } from '@/lib/shareService';
import { SharedViewLayout } from './SharedViewLayout';

vi.mock('./SharedScoresPanel', () => ({ SharedScoresPanel: () => null }));
vi.mock('./SharedContentDetails', () => ({ SharedContentDetails: () => null }));

function passShare(posterUrl: string | null): SharedViewDocument {
  return {
    posterUrl,
    pdfUrl: null,
    analysis: {
      title: 'Will',
      author: 'Writer',
      genre: 'Romantic Comedy',
      subgenres: [],
      recommendation: 'pass',
    },
  } as unknown as SharedViewDocument;
}

describe('SharedViewLayout poster policy', () => {
  it.each([null, 'https://example.com/old-paid-poster.png'])(
    'always replaces a Pass poster with the archive cloth (%s)',
    (posterUrl) => {
      render(<SharedViewLayout data={passShare(posterUrl)} />);

      expect(
        screen.getByRole('img', { name: 'Poster withheld for a Pass verdict' }),
      ).toHaveAttribute('src', '/pass-poster-archive.jpg');
    },
  );
});
