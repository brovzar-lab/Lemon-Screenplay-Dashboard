import { describe, expect, it } from 'vitest';

import { createTestScreenplay } from '@/test/factories';
import {
  getScreenplayDisplayAuthor,
  getScreenplayDisplayTitle,
  getScreenplayFormatInfo,
} from '@/lib/screenplayDisplay';

describe('screenplay display formatting', () => {
  it('removes an ingestion hash without changing the actual title words', () => {
    expect(
      getScreenplayDisplayTitle(
        'c8a16cdfe6b740ce8c39370728265074 ASSASSINATION OF A HIGH SCHOOL PRESIDENT',
      ),
    ).toMatchObject({
      title: 'Assassination of a High School President',
      length: 'long',
    });
  });

  it('moves a working-title note out of the primary title', () => {
    expect(getScreenplayDisplayTitle('DRACULA UNTOLD (working title: DRACULA YEAR ZERO)')).toEqual({
      title: 'Dracula Untold',
      qualifier: 'Working title: Dracula Year Zero',
      length: 'standard',
    });
  });

  it('makes filename-like underscores readable for display only', () => {
    expect(getScreenplayDisplayTitle('A_KILLING_ON_CARNIVAL_ROW').title).toBe(
      'A Killing on Carnival Row',
    );
  });

  it.each([
    ['PAPA EN LA LUNA', 'Papa en la Luna'],
    ['WILL', 'Will'],
    ['LAS PURAS C1 D5', 'Las Puras C1 D5'],
    ['3:10 TO YUMA', '3:10 to Yuma'],
  ])('title-cases %j as %j for display only', (rawTitle, expected) => {
    expect(getScreenplayDisplayTitle(rawTitle).title).toBe(expected);
  });

  it('repairs a known run-on source title and applies compact cover sizing', () => {
    expect(getScreenplayDisplayTitle('HERMANOSMARQUEZCASTILLO')).toEqual({
      title: 'Hermanos Márquez Castillo',
      length: 'standard',
    });
  });

  it('replaces a machine-only title without changing the stored record', () => {
    expect(getScreenplayDisplayTitle('c8a16cdfe6b740ce8c39370728265074')).toMatchObject({
      title: 'Untitled Submission',
    });
  });

  it.each([
    ['Quiet City', 'standard'],
    ['A Deliberately Longer Screenplay Title', 'long'],
    [
      'A Very Long Screenplay Title That Must Remain Readable Without Colliding With Metadata',
      'very-long',
    ],
    ['', 'standard'],
  ] as const)('classifies %j as a %s display title', (rawTitle, expectedLength) => {
    expect(getScreenplayDisplayTitle(rawTitle).length).toBe(expectedLength);
  });

  it.each([
    ['Anonymized (be352ab614f549dc891d6c7a4ff05eef)', 'Anonymized submission'],
    ['Anonymous (submission anonymised)', 'Anonymized submission'],
    ['Uncredited (Submission ee466e77bf740d3909e6f0ca426)', 'Uncredited submission'],
    ['c8a16cdfe6b740ce8c39370728265074', 'Uncredited submission'],
    ['', undefined],
    ['Unknown writer', undefined],
    ['Aaron Sorkin', 'Aaron Sorkin'],
  ])('formats the author %j as %j for display only', (rawAuthor, expected) => {
    expect(getScreenplayDisplayAuthor(rawAuthor)).toBe(expected);
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
    });
  });

  it('does not mistake ordinary prose containing short for a short film', () => {
    const screenplay = createTestScreenplay({
      metadata: { filename: 'legacy.pdf', pageCount: 12, wordCount: 2_000 },
      recommendationRationale: 'The ending falls short of the concept.',
    });

    expect(getScreenplayFormatInfo(screenplay).format).toBeUndefined();
  });
});
