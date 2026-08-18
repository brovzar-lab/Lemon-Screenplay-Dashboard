export type PosterModelKey = 'economy' | 'studio' | 'premium';
export type PosterVerdict = 'pass' | 'consider' | 'recommend' | 'film_now';
export type PosterDisposition = 'withhold' | 'generate' | 'skip';
export const POSTER_LEASE_MS = 10 * 60 * 1000;

export const POSTER_MODELS: Record<
  PosterModelKey,
  {
    id: string;
    costMicrousd: number;
  }
> = {
  economy: { id: 'gemini-3.1-flash-lite-image', costMicrousd: 33_600 },
  studio: { id: 'gemini-3.1-flash-image', costMicrousd: 67_000 },
  premium: { id: 'gemini-3-pro-image', costMicrousd: 134_000 },
};

export function normalizePosterModel(value: unknown): PosterModelKey | null {
  return value === 'economy' || value === 'studio' || value === 'premium' ? value : null;
}

export function normalizePosterVerdict(value: unknown): PosterVerdict | null {
  const normalized = String(value ?? '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'pass' || normalized === 'consider' || normalized === 'recommend') {
    return normalized;
  }
  return normalized === 'film_now' ? 'film_now' : null;
}

export function isPosterEligible(verdict: PosterVerdict | null): boolean {
  return verdict !== null && verdict !== 'pass';
}

export function posterDisposition(verdict: PosterVerdict | null): PosterDisposition {
  if (verdict === 'pass') return 'withhold';
  return isPosterEligible(verdict) ? 'generate' : 'skip';
}

export function isPosterAdmin(email: unknown): boolean {
  return typeof email === 'string' && email.toLowerCase() === 'billy@lemonfilms.com';
}

export function isPosterVersionCurrent(latestVersion: unknown, expectedVersion: string): boolean {
  return latestVersion === expectedVersion;
}

export function canClaimPosterRequest(input: {
  priorJobExists: boolean;
  currentVersion: unknown;
  expectedVersion: string;
  posterStatus: unknown;
  posterVersion: unknown;
  posterRequestedAtMs: number | null;
  nowMs: number;
}): boolean {
  if (input.priorJobExists || !isPosterVersionCurrent(input.currentVersion, input.expectedVersion))
    return false;
  const activeLease =
    input.posterStatus === 'generating' &&
    input.posterVersion === input.expectedVersion &&
    input.posterRequestedAtMs !== null &&
    input.nowMs - input.posterRequestedAtMs < POSTER_LEASE_MS;
  return !activeLease;
}

export function isCurrentV9Analysis(value: unknown): boolean {
  return value === 'v9_archaeology';
}
