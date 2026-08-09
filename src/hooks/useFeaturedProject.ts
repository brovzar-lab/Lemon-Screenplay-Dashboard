import { useEffect, useMemo, useState } from 'react';
import { selectFeaturedProject } from '@/lib/featuredProject';
import {
  FEATURED_POLICY_EVENT,
  loadFeaturedEngagements,
  loadFeaturedPolicy,
} from '@/lib/featuredProjectSettings';
import type { FeaturedPolicy, Screenplay } from '@/types';

export function useFeaturedProject(
  screenplays: Screenplay[],
  producerLookIds?: ReadonlySet<string>,
) {
  const [policy, setPolicy] = useState<FeaturedPolicy>(() => loadFeaturedPolicy());
  const [engagements, setEngagements] = useState(() => loadFeaturedEngagements());

  useEffect(() => {
    const refresh = () => {
      setPolicy(loadFeaturedPolicy());
      setEngagements(loadFeaturedEngagements());
    };
    window.addEventListener(FEATURED_POLICY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(FEATURED_POLICY_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return useMemo(
    () => selectFeaturedProject(screenplays, policy, { producerLookIds, engagements }),
    [engagements, policy, producerLookIds, screenplays],
  );
}
