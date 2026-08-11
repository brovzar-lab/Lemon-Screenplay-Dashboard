import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ContentDetails } from '@/components/screenplay/modal/ContentDetails';
import { createTestScreenplay } from '@/test/factories';

const searchTmdbComparable = vi.hoisted(() => vi.fn(async (title: string) => ({
  tmdbId: title.length,
  matchedTitle: title,
  releaseYear: '2024',
  posterPath: `/${title}.jpg`,
  posterUrl: `https://image.tmdb.org/t/p/w342/${title}.jpg`,
  confidence: 'high' as const,
  checkedAt: '2026-08-06T00:00:00.000Z',
})));

vi.mock('@/lib/tmdbService', () => ({ searchTmdbComparable }));
vi.mock('@/stores/apiConfigStore', () => ({
  useApiConfigStore: (selector: (state: { tmdbApiKey: string }) => unknown) =>
    selector({ tmdbApiKey: 'local-test-key' }),
}));

describe('ContentDetails workspace comparables', () => {
  it('shows at most three analysis-authored comps with display-only poster enrichment', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ContentDetails
          presentation="workspace"
          screenplay={createTestScreenplay({
            comparableFilms: [
              { title: 'Arrival', similarity: 'Tone match', comparisonLens: 'tone' },
              { title: 'Michael Clayton', similarity: 'Structural match', comparisonLens: 'structure' },
              { title: 'Sicario', similarity: 'Market position', comparisonLens: 'market' },
              { title: 'A Fourth Film', similarity: 'Must not render', comparisonLens: 'tone' },
            ],
          })}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Arrival')).toBeInTheDocument();
    expect(screen.getByText('Michael Clayton')).toBeInTheDocument();
    expect(screen.getByText('Sicario')).toBeInTheDocument();
    expect(screen.queryByText('A Fourth Film')).not.toBeInTheDocument();
    expect(screen.getByText('Tone')).toBeInTheDocument();
    expect(screen.queryByText('mixed')).not.toBeInTheDocument();
    await waitFor(() => expect(searchTmdbComparable).toHaveBeenCalledTimes(3));
    expect(await screen.findAllByRole('link', { name: 'View film details' })).toHaveLength(3);
  });
});
