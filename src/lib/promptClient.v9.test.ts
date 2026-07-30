import { describe, expect, it } from 'vitest';
import { buildAllReaderPrompts } from '@/lib/promptClient.v9';

describe('V9 reader citation contract', () => {
  it('requires a physical-page citation array on every reader sub-score', () => {
    const prompts = buildAllReaderPrompts('[PAGE 1]\nINT. HOUSE - DAY', {
      title: 'Evidence Test',
      pageCount: 1,
      wordCount: 4,
    });

    prompts.forEach((prompt) => {
      const subScoreBlock = prompt.userPrompt.match(
        /"sub_scores": \{([\s\S]*?)\n\s{2}\},/,
      )?.[1];
      expect(subScoreBlock, `${prompt.reader} must show its sub-score contract`).toBeDefined();
      const metricLines = subScoreBlock
        ?.split('\n')
        .filter((line) => line.includes('"score": 0'));
      expect(metricLines?.length).toBeGreaterThan(0);
      metricLines?.forEach((line) => {
        expect(line, `${prompt.reader} metric must include page_citations`).toContain(
          '"page_citations": []',
        );
      });
    });
  });
});
