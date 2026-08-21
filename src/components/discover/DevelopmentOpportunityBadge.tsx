import {
  evaluateDevelopmentOpportunity,
  localizedOpportunityRationale,
} from '@/lib/developmentOpportunity';
import type { ProducerAssessmentHead, Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

export function DevelopmentOpportunityBadge({
  screenplay,
  assessment,
  compact = false,
  routed,
}: {
  screenplay: Screenplay;
  assessment?: ProducerAssessmentHead;
  compact?: boolean;
  routed?: boolean;
}) {
  const { t } = useTranslation();
  if (routed === false) return null;
  const opportunity = evaluateDevelopmentOpportunity(screenplay, assessment);
  if (!opportunity.requiresProducerLook) return null;

  return (
    <span
      className={
        compact
          ? 'development-opportunity-badge development-opportunity-badge--compact'
          : 'development-opportunity-badge'
      }
      title={localizedOpportunityRationale(opportunity, t)}
      data-testid="development-opportunity-badge"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3 9.8 8.6 4 11l5.8 2.4L12 19l2.2-5.6L20 11l-5.8-2.4L12 3Z" />
      </svg>
      {t('Producer Look')}
    </span>
  );
}
