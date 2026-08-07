import { beforeEach, describe, expect, it } from 'vitest';

import {
  EMPTY_PRODUCER_JUDGMENT,
  loadLocalProducerAssessmentHeads,
  loadLocalProducerWorkingDraft,
  loadLocalProducerTakeDraft,
  producerAssessmentHeadId,
  saveLocalProducerWorkingDraft,
  saveLocalProducerTakeDraft,
  validateProducerJudgment,
} from '@/lib/producerCalibration';

describe('producerCalibration client contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('builds a stable latest-assessment identity per producer and project', () => {
    expect(producerAssessmentHeadId('billy-uid', 'will-2010')).toBe(
      'billy-uid__will-2010',
    );
  });

  it('normalizes a producer judgment without changing the AI result', () => {
    const judgment = validateProducerJudgment({
      ...EMPTY_PRODUCER_JUDGMENT,
      producerScore: 8.46,
      producerVerdict: 'recommend',
      tasteSignals: ['comedy', 'comedy', 'voice'],
      aiMissed: '  It undervalued the comic engine.  ',
    });

    expect(judgment.producerScore).toBe(8.5);
    expect(judgment.producerVerdict).toBe('recommend');
    expect(judgment.tasteSignals).toEqual(['comedy', 'voice']);
    expect(judgment.aiMissed).toBe('It undervalued the comic engine.');
  });

  it('requires an explicit note explaining the producer correction', () => {
    expect(() =>
      validateProducerJudgment({
        ...EMPTY_PRODUCER_JUDGMENT,
        aiMissed: '',
        aiGotRight: '',
      }),
    ).toThrow('what the analysis missed or got right');
  });

  it('treats a tentative judgment as held out of calibration evidence', () => {
    const judgment = validateProducerJudgment({
      ...EMPTY_PRODUCER_JUDGMENT,
      confidence: 'low',
      includeInCalibration: true,
      aiMissed: 'I need more time with the material.',
    });

    expect(judgment.confidence).toBe('low');
    expect(judgment.includeInCalibration).toBe(false);
  });

  it('preserves an unfinished Producer Draft without requiring publication fields', () => {
    saveLocalProducerWorkingDraft({
      projectId: 'legacy-project',
      versionId: 'legacy-unverified',
      judgment: {
        ...EMPTY_PRODUCER_JUDGMENT,
        producerScore: 8.2,
        aiMissed: 'The read undervalued',
      },
    });

    expect(loadLocalProducerWorkingDraft('legacy-project')).toEqual(
      expect.objectContaining({
        projectId: 'legacy-project',
        versionId: 'legacy-unverified',
        judgment: expect.objectContaining({
          producerScore: 8.2,
          aiMissed: 'The read undervalued',
        }),
      }),
    );
  });

  it('keeps local review evidence through refresh without publishing it', () => {
    const input = {
      projectId: 'will-2010',
      versionId: 'sealed-version-1',
      title: 'Will 2010',
      aiFinalScore: 5.1,
      aiVerdict: 'pass' as const,
      judgment: {
        ...EMPTY_PRODUCER_JUDGMENT,
        producerScore: 8.8,
        producerVerdict: 'recommend' as const,
        aiMissed: 'It undervalued the comedy.',
      },
    };

    expect(saveLocalProducerTakeDraft(input).revision).toBe(1);
    expect(saveLocalProducerTakeDraft(input).revision).toBe(2);
    expect(loadLocalProducerTakeDraft('will-2010')).toEqual(
      expect.objectContaining({
        projectId: 'will-2010',
        revision: 2,
      }),
    );
    expect(loadLocalProducerAssessmentHeads()).toEqual([
      expect.objectContaining({
        producerUid: 'local-preview',
        latestAssessmentId: 'local-preview__will-2010',
        producerScore: 8.8,
        revision: 2,
      }),
    ]);
  });
});
