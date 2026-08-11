import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISCOVERY_PRESENTATION,
  resolveDiscoveryPresentation,
} from '@/lib/discoveryPresentation';

describe('Discovery presentation resolver', () => {
  it('uses the approved screenplay presentation by default', () => {
    expect(DEFAULT_DISCOVERY_PRESENTATION).toBe('screenplay');
    expect(resolveDiscoveryPresentation(null)).toBe('screenplay');
    expect(resolveDiscoveryPresentation('unknown')).toBe('screenplay');
  });

  it('supports explicit hybrid and classic fallback links', () => {
    expect(resolveDiscoveryPresentation('hybrid')).toBe('hybrid');
    expect(resolveDiscoveryPresentation('classic')).toBe('classic');
  });
});
