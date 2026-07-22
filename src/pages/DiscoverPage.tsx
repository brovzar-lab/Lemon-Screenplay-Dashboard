import { useMemo } from 'react';
import { DiscoverShell } from '@/components/discover';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';

function DiscoverPage() {
  const { data: screenplays = [], isLoading, isError } = useScreenplays();

  // Match the existing dashboard data spine: the query supplies normalized
  // startup data and the live listener replaces it with normalized snapshots.
  useLiveScreenplaySync();

  const rankedScreenplays = useMemo(
    () => [...screenplays].sort((a, b) => b.weightedScore - a.weightedScore),
    [screenplays],
  );

  return <DiscoverShell screenplays={rankedScreenplays} isLoading={isLoading} isError={isError} />;
}

export default DiscoverPage;
