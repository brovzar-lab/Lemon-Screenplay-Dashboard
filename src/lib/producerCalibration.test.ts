import { describe, expect, it } from 'vitest';

import {
  EMPTY_PRODUCER_JUDGMENT,
  producerAssessmentHeadId,
  validateProducerJudgment,
} from '@/lib/producerCalibration';

describe('producerCalibration client contract', () => {
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
});
