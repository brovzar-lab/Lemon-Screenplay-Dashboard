import { describe, expect, it } from 'vitest';

import { parseReaderReports } from '@/lib/readerReportService';

describe('parseReaderReports', () => {
  it('preserves the real specialist score evidence and page citations', () => {
    const reports = parseReaderReports({
      craft_scene: {
        reader: 'craft_scene',
        pillar_score: 7.4,
        one_sentence_verdict: 'The pages move with confident scene craft.',
        red_flags: ['Dialogue becomes expositional in act two.'],
        sub_scores: {
          dialogue_voice: {
            score: 7.8,
            justification: 'Distinct voices are visible in the confrontation.',
            page_citations: [42, 44],
          },
        },
      },
    });

    expect(reports).toEqual([
      {
        reader: 'craft_scene',
        label: 'Craft Scene',
        pillarScore: 7.4,
        oneSentenceVerdict: 'The pages move with confident scene craft.',
        redFlags: ['Dialogue becomes expositional in act two.'],
        subScores: [
          {
            key: 'dialogue_voice',
            label: 'Dialogue Voice',
            score: 7.8,
            justification: 'Distinct voices are visible in the confrontation.',
            pageCitations: [42, 44],
          },
        ],
      },
    ]);
  });

  it('rejects malformed report payloads without inventing evidence', () => {
    expect(parseReaderReports(null)).toEqual([]);
    expect(parseReaderReports(['not', 'a', 'map'])).toEqual([]);
  });
});
