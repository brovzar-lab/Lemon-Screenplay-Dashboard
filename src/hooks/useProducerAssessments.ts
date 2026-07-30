import { useEffect, useState } from 'react';

import {
  isExpectedLocalCalibrationPredeployError,
  isLocalCalibrationPreviewMode,
  loadLocalProducerAssessmentHeads,
  loadProducerAssessmentHeads,
} from '@/lib/producerCalibration';
import type { ProducerAssessmentHead } from '@/types';

export const PRODUCER_ASSESSMENT_UPDATED_EVENT =
  'lemon:producer-assessment-updated';

function mergeAssessmentHeads(
  canonical: ProducerAssessmentHead[],
  local: ProducerAssessmentHead[],
): ProducerAssessmentHead[] {
  const byProject = new Map(
    canonical.map((assessment) => [assessment.projectId, assessment]),
  );
  for (const assessment of local) {
    byProject.set(assessment.projectId, assessment);
  }
  return [...byProject.values()].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

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
        setData(
          isLocalCalibrationPreviewMode()
            ? mergeAssessmentHeads(
                assessments,
                loadLocalProducerAssessmentHeads(),
              )
            : assessments,
        );
        setError(null);
      } catch (loadError) {
        if (!active) return;
        if (
          isLocalCalibrationPreviewMode() &&
          isExpectedLocalCalibrationPredeployError(loadError)
        ) {
          setData(loadLocalProducerAssessmentHeads());
          setError(null);
          return;
        }
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
