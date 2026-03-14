/**
 * React Query hooks for screenplay data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadAllScreenplaysVite, getScreenplayStats } from '@/lib/api';
import { removeAnalysis, removeMultipleAnalyses, getDeletedAnalyses, restoreAnalysis } from '@/lib/analysisStore';
import { getExistingShareToken, revokeShareToken } from '@/lib/shareService';
import { useShareStore } from '@/stores/shareStore';
import { canonicalizeGenre } from '@/lib/calculations';



/**
 * Query key for screenplays
 */
export const SCREENPLAYS_QUERY_KEY = ['screenplays'];

/**
 * Query key for deleted screenplays
 */
export const DELETED_SCREENPLAYS_QUERY_KEY = ['deleted-screenplays'];

/**
 * Display shape for a deleted screenplay in the recovery UI.
 */
export interface DeletedScreenplayEntry {
  sourceFile: string;
  title: string;
  deletedAt: string;
}

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
 * Hook to delete one or more screenplays.
 * Accepts either a single sourceFile string or an array for bulk deletion.
 * Automatically invalidates the screenplays cache on success.
 */
export function useDeleteScreenplays() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceFiles: string | string[]) => {
      if (Array.isArray(sourceFiles)) {
        await removeMultipleAnalyses(sourceFiles);
      } else {
        await removeAnalysis(sourceFiles);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: DELETED_SCREENPLAYS_QUERY_KEY });

      // Auto-revoke share tokens for deleted screenplays (fire-and-forget)
      const sourceFiles = Array.isArray(variables) ? variables : [variables];
      try {
        for (const sf of sourceFiles) {
          const cached = useShareStore.getState().tokens[sf];
          if (cached) {
            revokeShareToken(cached.token, sf).catch(() => {
              // Best-effort: never block delete flow
            });
          } else {
            getExistingShareToken(sf)
              .then((view) => {
                if (view) {
                  revokeShareToken(view.token, sf).catch(() => {});
                }
              })
              .catch(() => {});
          }
        }
      } catch {
        // Auto-revoke must never block or error the delete operation
      }
    },
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

  // Deduplicate by canonical key, keeping the first display name encountered
  const genreMap = new Map<string, string>();
  screenplays.forEach((s) => {
    const ck = canonicalizeGenre(s.genre);
    if (!genreMap.has(ck)) genreMap.set(ck, s.genre);
    s.subgenres.forEach((g) => {
      const cg = canonicalizeGenre(g);
      if (!genreMap.has(cg)) genreMap.set(cg, g);
    });
  });

  return Array.from(genreMap.values()).sort();
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

/**
 * Hook to fetch soft-deleted screenplays within the last 30 days.
 * Returns a list of simplified display entries for the recovery UI.
 */
export function useDeletedScreenplays() {
  return useQuery({
    queryKey: DELETED_SCREENPLAYS_QUERY_KEY,
    queryFn: (): DeletedScreenplayEntry[] => {
      const raw = getDeletedAnalyses();
      return raw.map((entry) => {
        const sourceFile = (entry.source_file as string) || '';
        const metadata = entry.metadata as Record<string, unknown> | undefined;
        const title = (metadata?.title as string) || sourceFile;
        const deletedAt = (entry._deleted_at as string) || '';
        return { sourceFile, title, deletedAt };
      });
    },
    staleTime: 0,
  });
}

/**
 * Hook to restore a soft-deleted screenplay.
 * Invalidates both the deleted list and main screenplays cache on success.
 */
export function useRestoreScreenplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceFile: string) => {
      await restoreAnalysis(sourceFile);
      return sourceFile;
    },
    onMutate: async (sourceFile: string) => {
      // Optimistic update: remove from deleted list immediately
      await queryClient.cancelQueries({ queryKey: DELETED_SCREENPLAYS_QUERY_KEY });
      const previous = queryClient.getQueryData<DeletedScreenplayEntry[]>(DELETED_SCREENPLAYS_QUERY_KEY);
      queryClient.setQueryData<DeletedScreenplayEntry[]>(
        DELETED_SCREENPLAYS_QUERY_KEY,
        (old) => old?.filter((item) => item.sourceFile !== sourceFile) ?? []
      );
      return { previous };
    },
    onError: (_err, _sourceFile, context) => {
      // Roll back on error
      if (context?.previous) {
        queryClient.setQueryData(DELETED_SCREENPLAYS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DELETED_SCREENPLAYS_QUERY_KEY });
      queryClient.resetQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
    },
  });
}

