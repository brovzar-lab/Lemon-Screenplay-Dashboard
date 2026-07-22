import { useEffect, useMemo } from 'react';
import { DiscoverShell } from '@/components/discover';
import { useFilteredScreenplays, useHasActiveFilters } from '@/hooks/useFilteredScreenplays';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';

function isDashboardDefaultSort() {
  const { sortConfigs, prioritizeFilmNow } = useSortStore.getState();

  return (
    prioritizeFilmNow &&
    sortConfigs.length === 2 &&
    sortConfigs[0]?.field === 'marketPotential' &&
    sortConfigs[0]?.direction === 'desc' &&
    sortConfigs[1]?.field === 'weightedScore' &&
    sortConfigs[1]?.direction === 'desc'
  );
}

function DiscoverPage() {
  const { data: allScreenplays = [] } = useScreenplays();
  const { screenplays, totalCount, filteredCount, isLoading, error } = useFilteredScreenplays();
  const hasActiveFilters = useHasActiveFilters();
  const resetFilters = useFilterStore((state) => state.resetFilters);

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

  return (
    <DiscoverShell
      screenplays={screenplays}
      totalCount={totalCount}
      filteredCount={filteredCount}
      genres={genres}
      themes={themes}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={resetFilters}
      isLoading={isLoading}
      isError={Boolean(error)}
    />
  );
}

export default DiscoverPage;
