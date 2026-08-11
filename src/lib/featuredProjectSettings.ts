import { DEFAULT_FEATURED_POLICY } from '@/lib/featuredProject';
import type { FeaturedEngagement, FeaturedPolicy } from '@/types';

const POLICY_KEY = 'lemon.featured-policy.preview.v1';
const ENGAGEMENT_KEY = 'lemon.featured-engagement.preview.v1';
export const FEATURED_POLICY_EVENT = 'lemon:featured-policy-changed';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function loadFeaturedPolicy(): FeaturedPolicy {
  if (!canUseStorage()) return DEFAULT_FEATURED_POLICY;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(POLICY_KEY) ?? '') as Partial<FeaturedPolicy>;
    if (parsed.schemaVersion !== 1) return DEFAULT_FEATURED_POLICY;
    return { ...DEFAULT_FEATURED_POLICY, ...parsed };
  } catch {
    return DEFAULT_FEATURED_POLICY;
  }
}

export function saveFeaturedPolicy(policy: FeaturedPolicy): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(POLICY_KEY, JSON.stringify(policy));
  window.dispatchEvent(new CustomEvent(FEATURED_POLICY_EVENT));
}

export function loadFeaturedEngagements(): Map<string, FeaturedEngagement> {
  if (!canUseStorage()) return new Map();
  try {
    const values = JSON.parse(
      window.localStorage.getItem(ENGAGEMENT_KEY) ?? '[]',
    ) as FeaturedEngagement[];
    return new Map(values.map((value) => [value.projectId, value]));
  } catch {
    return new Map();
  }
}

export function recordFeaturedEngagement(
  projectId: string,
  identity: { uid: string; role: 'admin' },
): void {
  if (!canUseStorage()) return;
  const engagements = loadFeaturedEngagements();
  const previous = engagements.get(projectId);
  engagements.set(projectId, {
    schemaVersion: 1,
    projectId,
    lastOpenedAt: new Date().toISOString(),
    openedByUid: identity.uid,
    openedByRole: identity.role,
    openCount: (previous?.openCount ?? 0) + 1,
  });
  window.localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify([...engagements.values()]));
  window.dispatchEvent(new CustomEvent(FEATURED_POLICY_EVENT));
}
