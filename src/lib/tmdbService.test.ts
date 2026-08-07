import { beforeEach, describe, expect, it, vi } from 'vitest';

import { searchTmdbComparable } from '@/lib/tmdbService';

describe('searchTmdbComparable', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns poster metadata without changing the analysis-authored title', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      results: [{
        id: 550,
        title: 'Fight Club',
        release_date: '1999-10-15',
        popularity: 80,
        poster_path: '/fight-club.jpg',
      }],
      total_results: 1,
    }), { status: 200 }));

    const result = await searchTmdbComparable('Fight Club', 'local-test-key');

    expect(result).toMatchObject({
      tmdbId: 550,
      matchedTitle: 'Fight Club',
      releaseYear: '1999',
      posterUrl: 'https://image.tmdb.org/t/p/w342/fight-club.jpg',
      confidence: 'high',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('query=Fight+Club');
  });

  it('uses its local cache instead of spending another lookup', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      results: [{ id: 1, title: 'Arrival', poster_path: '/arrival.jpg' }],
      total_results: 1,
    }), { status: 200 }));

    await searchTmdbComparable('Arrival', 'local-test-key');
    await searchTmdbComparable('Arrival', 'local-test-key');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('separates a parenthetical release year from the movie title search', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      results: [{ id: 3, title: "Pan's Labyrinth", release_date: '2006-10-11', poster_path: '/pan.jpg' }],
      total_results: 1,
    }), { status: 200 }));

    await searchTmdbComparable("Pan's Labyrinth (2006)", 'local-test-key');

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('query=Pan%27s+Labyrinth');
    expect(url).toContain('year=2006');
  });

  it('returns no enrichment when a trustworthy poster match is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      results: [{ id: 2, title: 'Unrelated Movie', poster_path: '/other.jpg' }],
      total_results: 1,
    }), { status: 200 }));

    await expect(searchTmdbComparable('Moonlight', 'local-test-key')).resolves.toBeNull();
  });
});
