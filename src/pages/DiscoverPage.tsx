import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DiscoverShell } from '@/components/discover';
import { useFilteredScreenplays, useHasActiveFilters } from '@/hooks/useFilteredScreenplays';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import { getScreenplayStats } from '@/lib/api';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';
import { DEFAULT_SORT_STATE } from '@/types/filters';
import type { Screenplay } from '@/types';

function isDashboardDefaultSort() {
  const { sortConfigs, prioritizeFilmNow } = useSortStore.getState();

  return (
    prioritizeFilmNow === DEFAULT_SORT_STATE.prioritizeFilmNow &&
    sortConfigs.length === DEFAULT_SORT_STATE.sortConfigs.length &&
    sortConfigs.every((config, index) => {
      const defaultConfig = DEFAULT_SORT_STATE.sortConfigs[index];
      return config.field === defaultConfig?.field && config.direction === defaultConfig.direction;
    })
  );
}

function DiscoverPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const { data: allScreenplays = [] } = useScreenplays();
  const { screenplays, totalCount, filteredCount, isLoading, error } = useFilteredScreenplays();
  const hasActiveFilters = useHasActiveFilters();
  const resetFilters = useFilterStore((state) => state.resetFilters);
  const hideProduced = useFilterStore((state) => state.hideProduced);
  const setHideProduced = useFilterStore((state) => state.setHideProduced);

  // Match the existing dashboard data spine: the query supplies normalized
  // startup data and the live listener replaces it with normalized snapshots.
  useLiveScreenplaySync();

  // Discovery answers "best first" by weighted score unless the user already
  // chose a sort. This uses the existing shared sort machinery without changing
  // the dashboard's store defaults.
  useEffect(() => {
    if (!isDashboardDefaultSort()) return;

    useSortStore.getState().setSortConfigs([{ field: 'weightedScore', direction: 'desc' }]);
    useSortStore.getState().setPrioritizeFilmNow(false);
  }, []);

  const { genres, themes } = useMemo(() => {
    const genreSet = new Set<string>();
    const themeSet = new Set<string>();

    allScreenplays.forEach((screenplay) => {
      if (screenplay.genre) genreSet.add(screenplay.genre);
      screenplay.subgenres.forEach((genre) => genreSet.add(genre));
      screenplay.themes.forEach((theme) => themeSet.add(theme));
    });

    return {
      genres: [...genreSet].sort((a, b) => a.localeCompare(b)),
      themes: [...themeSet].sort((a, b) => a.localeCompare(b)),
    };
  }, [allScreenplays]);

  const stats = useMemo(() => getScreenplayStats(allScreenplays), [allScreenplays]);
  const producedHiddenCount = useMemo(
    () =>
      hideProduced
        ? allScreenplays.filter((screenplay) => screenplay.tmdbStatus?.isProduced).length
        : 0,
    [allScreenplays, hideProduced],
  );
  const selectedScreenplay = useMemo(
    () =>
      projectId
        ? (allScreenplays.find(
            (screenplay) => screenplay.projectId === projectId || screenplay.id === projectId,
          ) ?? null)
        : null,
    [allScreenplays, projectId],
  );

  const openScreenplay = (screenplay: Screenplay) => {
    navigate(`/discover/${encodeURIComponent(screenplay.projectId ?? screenplay.id)}`);
  };

  const closeScreenplay = () => {
    navigate('/discover', { replace: true });
  };

  return (
    <DiscoverShell
      screenplays={screenplays}
      totalCount={totalCount}
      filteredCount={filteredCount}
      genres={genres}
      themes={themes}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={resetFilters}
      producedHiddenCount={producedHiddenCount}
      onRevealProduced={() => setHideProduced(false)}
      stats={stats}
      selectedScreenplay={selectedScreenplay}
      onOpenScreenplay={openScreenplay}
      onCloseScreenplay={closeScreenplay}
      isLoading={isLoading}
      isError={Boolean(error)}
    />
  );
}

export default DiscoverPage;
