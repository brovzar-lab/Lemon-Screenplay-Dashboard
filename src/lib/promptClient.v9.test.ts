import { describe, expect, it } from 'vitest';
import {
  buildAllReaderPrompts,
  buildSynthesisPrompt,
  type ReaderName,
} from '@/lib/promptClient.v9';

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

describe('V9 synthesis critical-failure contract', () => {
  it('requests the severity-bearing structure used by verdict arithmetic', () => {
    const reports = Object.fromEntries(
      ([
        'structure',
        'character',
        'craft_scene',
        'concept',
        'emotional_resonance',
      ] as ReaderName[]).map((reader) => [reader, { reader }]),
    ) as Record<ReaderName, Record<string, unknown>>;
    const prompt = buildSynthesisPrompt({
      title: 'Reliability Test',
      readerReports: reports,
      lenses: [],
    }).userPrompt;

    expect(prompt).toContain(
      '{ "description": "", "severity": "minor|moderate|major|critical", "penalty": 0.0 }',
    );
    expect(prompt).toContain('minor=0.3, moderate=0.5, major=0.8, critical=1.2');
    expect(prompt).not.toContain('{ "failure": "", "why_structural": "" }');
  });
});
