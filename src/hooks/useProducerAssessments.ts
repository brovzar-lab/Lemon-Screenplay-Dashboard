import { useEffect, useState } from 'react';

import { loadProducerAssessmentHeads } from '@/lib/producerCalibration';
import type { ProducerAssessmentHead } from '@/types';

export const PRODUCER_ASSESSMENT_UPDATED_EVENT =
  'lemon:producer-assessment-updated';

export function useProducerAssessmentHeads(enabled = true) {
  const [data, setData] = useState<ProducerAssessmentHead[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const assessments = await loadProducerAssessmentHeads();
        if (!active) return;
        setData(assessments);
        setError(null);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError
            : new Error('Producer assessments could not be loaded.'),
        );
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    window.addEventListener(PRODUCER_ASSESSMENT_UPDATED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(PRODUCER_ASSESSMENT_UPDATED_EVENT, load);
    };
  }, [enabled]);

  return { data, isLoading, error };
}
