export type DiscoveryPresentation = 'classic' | 'hybrid' | 'screenplay';

/** The approved signed-in home; explicit query parameters preserve both review fallbacks. */
export const DEFAULT_DISCOVERY_PRESENTATION: DiscoveryPresentation = 'screenplay';

export function resolveDiscoveryPresentation(
  value: string | null | undefined,
): DiscoveryPresentation {
  if (value === 'classic' || value === 'hybrid' || value === 'screenplay') return value;
  return DEFAULT_DISCOVERY_PRESENTATION;
}
