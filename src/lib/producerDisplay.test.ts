import { describe, expect, it } from 'vitest';

import {
  formatAnalysisVersion,
  formatProducerHeading,
  formatProducerTaxonomy,
  formatProducerText,
  formatReaderPosition,
} from '@/lib/producerDisplay';

describe('producer-facing formatting', () => {
  it('turns analysis versions into readable labels', () => {
    expect(formatAnalysisVersion('v9_archaeology')).toBe('V9 Archaeology');
    expect(formatAnalysisVersion('v8')).toBe('V8');
  });

  it('humanizes internal taxonomy without changing stored data', () => {
    expect(formatProducerTaxonomy('craft_scene')).toBe('Craft & Scene');
    expect(formatProducerTaxonomy('supporting_cast')).toBe('Supporting Cast');
  });

  it('replaces internal tokens inside producer-facing prose', () => {
    expect(formatProducerText('craft_warning_red flag vs. craft_scene score')).toBe(
      'craft warning flag vs. Craft & Scene score',
    );
  });

  it('keeps long editorial headings in readable sentence case', () => {
    expect(formatProducerHeading('internal consistency of the craft_scene pillar: craft_warning_red flag')).toBe(
      'Internal consistency of the Craft & Scene pillar: craft warning flag',
    );
  });

  it('labels reader positions as decisions', () => {
    expect(formatReaderPosition('unchanged')).toBe('Position unchanged');
  });
});
