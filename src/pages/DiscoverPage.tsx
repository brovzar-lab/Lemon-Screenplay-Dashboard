import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DiscoverShell } from '@/components/discover';
import { useDiscoveryShareStatuses } from '@/components/discover/useDiscoveryShareStatuses';
import {
  passesFilters,
  useFilteredScreenplays,
  useHasActiveFilters,
} from '@/hooks/useFilteredScreenplays';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import { getScreenplayStats } from '@/lib/api';
import { useFilterStore } from '@/stores/filterStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
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
  const [searchParams] = useSearchParams();
  const { data: allScreenplays = [] } = useScreenplays();
  const { screenplays, totalCount, filteredCount, isLoading, error } = useFilteredScreenplays();
  const hasActiveFilters = useHasActiveFilters();
  const filters = useFilterStore();
  const pdfStatuses = usePdfStatusStore((state) => state.statuses);
  const hasPdfScanResult = usePdfStatusStore((state) => state.hasScanResult);

  // Match the existing dashboard data spine: the query supplies normalized
  // startup data and the live listener replaces it with normalized snapshots.
  useLiveScreenplaySync();
  useDiscoveryShareStatuses();

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
  const { producedHiddenCount, nonScreenplayHiddenCount } = useMemo(() => {
    const pdfScanData = { statuses: pdfStatuses, hasScanResult: hasPdfScanResult };
    const withoutDefaultHides = {
      ...filters,
      hideProduced: false,
      hideNonScreenplays: false,
    };
    const withNonScreenplayHide = {
      ...withoutDefaultHides,
      hideNonScreenplays: true,
    };
    let produced = 0;
    let nonScreenplay = 0;

    allScreenplays.forEach((screenplay) => {
      if (!passesFilters(screenplay, withoutDefaultHides, pdfScanData)) return;

      // Classify overlaps in filter order. Revealing produced films will then
      // surface any remaining non-screenplay exclusion as the next disclosure.
      if (filters.hideProduced && screenplay.tmdbStatus?.isProduced) {
        produced += 1;
      } else if (
        filters.hideNonScreenplays &&
        !passesFilters(screenplay, withNonScreenplayHide, pdfScanData)
      ) {
        nonScreenplay += 1;
      }
    });

    return {
      producedHiddenCount: produced,
      nonScreenplayHiddenCount: nonScreenplay,
    };
  }, [allScreenplays, filters, hasPdfScanResult, pdfStatuses]);
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
    const targetId = encodeURIComponent(screenplay.projectId ?? screenplay.id);
    if (searchParams.get('preview') === 'drawer') {
      navigate(`/discover/${targetId}?preview=drawer`);
      return;
    }
    navigate(`/projects/${targetId}`, { state: { fromDiscovery: true } });
  };

  const closeScreenplay = () => {
    navigate(
      searchParams.get('preview') === 'drawer' ? '/discover?preview=drawer' : '/discover',
      { replace: true },
    );
  };

  return (
    <DiscoverShell
      screenplays={screenplays}
      allScreenplays={allScreenplays}
      totalCount={totalCount}
      filteredCount={filteredCount}
      genres={genres}
      themes={themes}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={filters.resetFilters}
      producedHiddenCount={producedHiddenCount}
      onRevealProduced={() => filters.setHideProduced(false)}
      nonScreenplayHiddenCount={nonScreenplayHiddenCount}
      onRevealNonScreenplays={() => filters.setHideNonScreenplays(false)}
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
