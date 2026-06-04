/**
 * TMDB Service
 *
 * Checks whether a screenplay has already been produced as a film
 * by querying The Movie Database (TMDB) Search API.
 *
 * Accepts EITHER credential from your TMDB account settings:
 *   - API Key (v3)       — short hex string, sent as ?api_key= query param
 *   - Read Access Token  — long JWT (eyJ...), sent as Authorization: Bearer header
 *
 * Free tier: https://www.themoviedb.org/settings/api
 * This call is always client-side — TMDB data is public, no sensitive info.
 */

export interface TmdbCheckResult {
  isProduced: boolean;
  tmdbId?: number;
  tmdbTitle?: string;
  releaseDate?: string;
  /** TMDB production status string, e.g. "Released", "In Production" */
  status?: string;
  /** Confidence of the title match */
  confidence: 'high' | 'medium' | 'low';
  checkedAt: string;
}

interface TmdbMovie {
  id: number;
  title: string;
  release_date?: string;
  status?: string;
  popularity?: number;
}

interface TmdbSearchResponse {
  results: TmdbMovie[];
  total_results: number;
}

/**
 * Normalize a title for comparison:
 * lowercase, strip punctuation, collapse whitespace.
 */
function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score a TMDB result against the screenplay title.
 * Returns 'high' | 'medium' | 'low' confidence.
 */
function scoreMatch(
  screenplayTitle: string,
  tmdbTitle: string,
): 'high' | 'medium' | 'low' {
  const a = normalizeTitle(screenplayTitle);
  const b = normalizeTitle(tmdbTitle);

  if (a === b) return 'high';

  // One title fully contains the other (handles "The Arrival" vs "Arrival")
  if (a.includes(b) || b.includes(a)) return 'medium';

  // Word-overlap heuristic
  const aWords = new Set(a.split(' ').filter(Boolean));
  const bWords = b.split(' ').filter(Boolean);
  const overlap = bWords.filter((w) => aWords.has(w)).length;
  const ratio = overlap / Math.max(aWords.size, bWords.length, 1);
  if (ratio >= 0.7) return 'medium';

  return 'low';
}

/**
 * Check TMDB for an existing produced film matching the screenplay title.
 *
 * - Returns `isProduced: false` (not `null`) when no match is found — explicit negative.
 * - Never throws. Network / auth errors are caught and returned as `isProduced: false`.
 * - Treats only 'high' or 'medium' confidence matches as "produced".
 */
export async function checkTmdb(
  title: string,
  apiKey: string,
): Promise<TmdbCheckResult> {
  const checkedAt = new Date().toISOString();
  const notProduced: TmdbCheckResult = { isProduced: false, confidence: 'low', checkedAt };

  if (!title || !apiKey) return notProduced;

  try {
    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('query', title);
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('page', '1');

    // Auto-detect credential type:
    //   JWT (Read Access Token) → Authorization: Bearer header
    //   Short hex string (API Key v3) → ?api_key= query param
    const isJwt = apiKey.startsWith('eyJ');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isJwt) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      url.searchParams.set('api_key', apiKey);
    }

    const resp = await fetch(url.toString(), { headers });
    if (!resp.ok) {
      console.warn('[TMDB] API error', resp.status, resp.statusText);
      return notProduced;
    }

    const data = (await resp.json()) as TmdbSearchResponse;

    if (!data.results || data.results.length === 0) return notProduced;

    // Score each result and pick the best one
    const scored = data.results
      .map((movie) => ({
        movie,
        confidence: scoreMatch(title, movie.title),
      }))
      .filter((r) => r.confidence !== 'low')
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 } as const;
        return order[a.confidence] - order[b.confidence];
      });

    if (scored.length === 0) return notProduced;

    const best = scored[0];
    return {
      isProduced: true,
      tmdbId: best.movie.id,
      tmdbTitle: best.movie.title,
      releaseDate: best.movie.release_date ?? undefined,
      status: best.movie.status ?? 'Released',
      confidence: best.confidence,
      checkedAt,
    };
  } catch (err) {
    console.warn('[TMDB] Check failed (non-critical):', err);
    return notProduced;
  }
}

/**
 * Test the API key by searching for a known film ("Inception").
 * Returns { ok: boolean; message: string }.
 */
export async function testTmdbKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await checkTmdb('Inception', apiKey);
    if (result.isProduced && result.tmdbTitle) {
      return { ok: true, message: `Connected — found "${result.tmdbTitle}" (${result.releaseDate ?? 'N/A'})` };
    }
    return { ok: false, message: 'Key accepted but search returned no results. Check the key.' };
  } catch {
    return { ok: false, message: 'Connection failed. Check your API key.' };
  }
}
