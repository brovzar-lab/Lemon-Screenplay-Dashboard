import { describe, expect, it } from 'vitest';

import { createTestScreenplay } from '@/test/factories';
import { getScreenplayDisplayTitle, getScreenplayFormatInfo } from '@/lib/screenplayDisplay';

describe('screenplay display formatting', () => {
  it('removes an ingestion hash without changing the actual title words', () => {
    expect(
      getScreenplayDisplayTitle(
        'c8a16cdfe6b740ce8c39370728265074 ASSASSINATION OF A HIGH SCHOOL PRESIDENT',
      ),
    ).toMatchObject({
      title: 'ASSASSINATION OF A HIGH SCHOOL PRESIDENT',
      length: 'long',
    });
  });

  it('moves a working-title note out of the primary title', () => {
    expect(getScreenplayDisplayTitle('DRACULA UNTOLD (working title: DRACULA YEAR ZERO)')).toEqual({
      title: 'DRACULA UNTOLD',
      qualifier: 'Working title: DRACULA YEAR ZERO',
      length: 'standard',
    });
  });

  it('makes filename-like underscores readable for display only', () => {
    expect(getScreenplayDisplayTitle('A_KILLING_ON_CARNIVAL_ROW').title).toBe(
      'A KILLING ON CARNIVAL ROW',
    );
  });

  it('repairs a known run-on source title and applies compact cover sizing', () => {
    expect(getScreenplayDisplayTitle('HERMANOSMARQUEZCASTILLO')).toEqual({
      title: 'Hermanos Márquez Castillo',
      length: 'standard',
    });
  });

  it('labels explicitly described pilots and adaptations', () => {
    const screenplay = createTestScreenplay({
      genre: 'Family Drama (TV Pilot)',
      recommendationRationale: 'An adaptation of the novel with a strong series engine.',
    });

    expect(getScreenplayFormatInfo(screenplay)).toEqual({
      format: 'TV pilot',
      source: 'Adaptation',
    });
  });

  it('uses page count for length but never invents source material', () => {
    const screenplay = createTestScreenplay({
      genre: 'Romantic Comedy',
      metadata: { filename: 'Will.pdf', pageCount: 118, wordCount: 20_000 },
    });

    expect(getScreenplayFormatInfo(screenplay)).toEqual({
      format: 'Feature film',
      source: 'Source not recorded',
    });
  });

  it('does not mistake ordinary prose containing short for a short film', () => {
    const screenplay = createTestScreenplay({
      metadata: { filename: 'legacy.pdf', pageCount: 12, wordCount: 2_000 },
      recommendationRationale: 'The ending falls short of the concept.',
    });

    expect(getScreenplayFormatInfo(screenplay).format).toBe('Format not recorded');
  });
});
