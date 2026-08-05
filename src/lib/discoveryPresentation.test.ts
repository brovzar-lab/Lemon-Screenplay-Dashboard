import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISCOVERY_PRESENTATION,
  resolveDiscoveryPresentation,
} from '@/lib/discoveryPresentation';

describe('Discovery presentation resolver', () => {
  it('keeps the current presentation as the pre-approval default', () => {
    expect(DEFAULT_DISCOVERY_PRESENTATION).toBe('classic');
    expect(resolveDiscoveryPresentation(null)).toBe('classic');
    expect(resolveDiscoveryPresentation('unknown')).toBe('classic');
  });

  it('supports explicit hybrid and classic fallback links', () => {
    expect(resolveDiscoveryPresentation('hybrid')).toBe('hybrid');
    expect(resolveDiscoveryPresentation('classic')).toBe('classic');
  });
});
