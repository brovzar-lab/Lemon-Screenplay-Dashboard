import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DiscoverShell } from '@/components/discover';
import type { DiscoverShellProps } from '@/components/discover/DiscoverShell';
import { HybridDiscoverShell } from '@/components/discover/hybrid/HybridDiscoverShell';
import { ScreenplayDiscoverShell } from '@/components/discover/screenplay/ScreenplayDiscoverShell';
import { useDiscoveryShareStatuses } from '@/components/discover/useDiscoveryShareStatuses';
import {
  passesFilters,
  useFilteredScreenplays,
  useHasActiveFilters,
} from '@/hooks/useFilteredScreenplays';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import { useUrlState } from '@/hooks/useUrlState';
import { useProducerAssessmentHeads } from '@/hooks/useProducerAssessments';
import { getScreenplayStats } from '@/lib/api';
import { selectProducerLookCandidates } from '@/lib/developmentOpportunity';
import { resolveDiscoveryPresentation } from '@/lib/discoveryPresentation';
import { useIsAdmin } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSortStore } from '@/stores/sortStore';
import { DEFAULT_SORT_STATE } from '@/types/filters';
import type { ProducerAssessmentHead, Screenplay } from '@/types';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPresentation = resolveDiscoveryPresentation(searchParams.get('ui'));
  const presentation = import.meta.env.PROD ? 'screenplay' : requestedPresentation;
  const producerLookActive = searchParams.get('view') === 'producer-look';
  const isAdmin = useIsAdmin();
  const { data: producerAssessmentHeads = [] } = useProducerAssessmentHeads(isAdmin);
  const { data: allScreenplays = [] } = useScreenplays();
  const { screenplays, totalCount, filteredCount, isLoading, error } = useFilteredScreenplays();
  const hasActiveFilters = useHasActiveFilters();
  const filters = useFilterStore();
  const pdfStatuses = usePdfStatusStore((state) => state.statuses);
  const hasPdfScanResult = usePdfStatusStore((state) => state.hasScanResult);
  useUrlState();

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
  const producerAssessments = useMemo(
    () =>
      new Map<string, ProducerAssessmentHead>(
        producerAssessmentHeads.map((assessment) => [assessment.projectId, assessment]),
      ),
    [producerAssessmentHeads],
  );
  const producerLookCandidates = useMemo(
    () => selectProducerLookCandidates(screenplays, producerAssessments),
    [producerAssessments, screenplays],
  );
  const producerLookIds = useMemo(
    () =>
      new Set(
        producerLookCandidates.map(({ screenplay }) => screenplay.projectId ?? screenplay.id),
      ),
    [producerLookCandidates],
  );
  const displayedScreenplays = producerLookActive
    ? producerLookCandidates.map(({ screenplay }) => screenplay)
    : screenplays;

  const toggleProducerLook = () => {
    const nextParams = new URLSearchParams(searchParams);
    if (producerLookActive) nextParams.delete('view');
    else nextParams.set('view', 'producer-look');
    setSearchParams(nextParams, { replace: true });
  };

  const clearDiscoveryView = () => {
    filters.resetFilters();
    if (!producerLookActive) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('view');
    setSearchParams(nextParams, { replace: true });
  };
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
      const nextParams = new URLSearchParams(searchParams);
      const query = nextParams.toString();
      navigate(`/discover/${targetId}${query ? `?${query}` : ''}`);
      return;
    }
    if (presentation === 'screenplay') {
      sessionStorage.setItem('lemon.discovery.screenplay.scrollY', String(window.scrollY));
      navigate(`/projects/${targetId}?workspace=screenplay`, {
        state: { fromDiscovery: true },
      });
      return;
    }
    navigate(`/projects/${targetId}`, { state: { fromDiscovery: true } });
  };

  const closeScreenplay = () => {
    const nextParams = new URLSearchParams(searchParams);
    const query = nextParams.toString();
    navigate(`/discover${query ? `?${query}` : ''}`, { replace: true });
  };

  const shellProps: DiscoverShellProps = {
    screenplays: displayedScreenplays,
    allScreenplays,
    totalCount,
    filteredCount: producerLookActive ? displayedScreenplays.length : filteredCount,
    genres,
    themes,
    hasActiveFilters: hasActiveFilters || producerLookActive,
    onClearFilters: clearDiscoveryView,
    producedHiddenCount,
    onRevealProduced: () => filters.setHideProduced(false),
    nonScreenplayHiddenCount,
    onRevealNonScreenplays: () => filters.setHideNonScreenplays(false),
    stats,
    selectedScreenplay,
    onOpenScreenplay: openScreenplay,
    onCloseScreenplay: closeScreenplay,
    isLoading,
    isError: Boolean(error),
    producerAssessments,
    producerLookIds,
    producerLookCount: producerLookCandidates.length,
    producerLookActive,
    onToggleProducerLook: toggleProducerLook,
  };

  useEffect(() => {
    if (presentation !== 'screenplay') return;
    const savedPosition = sessionStorage.getItem('lemon.discovery.screenplay.scrollY');
    if (!savedPosition) return;
    sessionStorage.removeItem('lemon.discovery.screenplay.scrollY');
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: Number(savedPosition), behavior: 'auto' }),
    );
  }, [presentation]);

  if (presentation === 'screenplay') return <ScreenplayDiscoverShell {...shellProps} />;
  if (presentation === 'hybrid') return <HybridDiscoverShell {...shellProps} />;
  return <DiscoverShell {...shellProps} />;
}

export default DiscoverPage;
