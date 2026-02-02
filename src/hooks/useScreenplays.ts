/**
 * React Query hooks for screenplay data
 */

import { useQuery } from '@tanstack/react-query';
import { loadAllScreenplaysVite, getScreenplayStats } from '@/lib/api';
// Screenplay type imported for documentation - used in JSDoc and return types
import type { Screenplay as _Screenplay } from '@/types';

/**
 * Query key for screenplays
 */
export const SCREENPLAYS_QUERY_KEY = ['screenplays'];

/**
 * Hook to fetch all screenplays
 */
export function useScreenplays() {
  return useQuery({
    queryKey: SCREENPLAYS_QUERY_KEY,
    queryFn: loadAllScreenplaysVite,
    staleTime: 1000 * 60 * 30, // 30 minutes (data doesn't change often)
    gcTime: 1000 * 60 * 60, // 1 hour cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get screenplay statistics
 */
export function useScreenplayStats() {
  const { data: screenplays, ...rest } = useScreenplays();

  return {
    ...rest,
    data: screenplays ? getScreenplayStats(screenplays) : null,
    screenplays,
  };
}

/**
 * Hook to get a single screenplay by ID
 */
export function useScreenplay(id: string | null) {
  const { data: screenplays, ...rest } = useScreenplays();

  return {
    ...rest,
    data: id && screenplays ? screenplays.find((s) => s.id === id) : null,
  };
}

/**
 * Hook to get unique genres from all screenplays
 */
export function useGenres() {
  const { data: screenplays } = useScreenplays();

  if (!screenplays) return [];

  const genres = new Set<string>();
  screenplays.forEach((s) => {
    genres.add(s.genre);
    s.subgenres.forEach((g) => genres.add(g));
  });

  return Array.from(genres).sort();
}

/**
 * Hook to get unique themes from all screenplays
 */
export function useThemes() {
  const { data: screenplays } = useScreenplays();

  if (!screenplays) return [];

  const themes = new Set<string>();
  screenplays.forEach((s) => {
    s.themes.forEach((t) => themes.add(t));
  });

  return Array.from(themes).sort();
}
