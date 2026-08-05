export type DiscoveryPresentation = 'classic' | 'hybrid';

/** Keep the current presentation primary until the signed-in hybrid review is approved. */
export const DEFAULT_DISCOVERY_PRESENTATION: DiscoveryPresentation = 'classic';

export function resolveDiscoveryPresentation(
  value: string | null | undefined,
): DiscoveryPresentation {
  if (value === 'classic' || value === 'hybrid') return value;
  return DEFAULT_DISCOVERY_PRESENTATION;
}
