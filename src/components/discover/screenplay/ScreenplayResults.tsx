import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { DevelopmentOpportunityBadge } from '@/components/discover/DevelopmentOpportunityBadge';
import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import type { OpenScreenplay } from '@/components/discover/screenplay/screenplayPresentationTypes';
import type { RankedScreenplay } from '@/components/discover/screenplay/screenplayRankingProjection';
import { AnalysisTrustBadge } from '@/components/screenplay/AnalysisTrustBadge';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import {
  getScreenplayDisplayAuthor,
  getScreenplayDisplayGenre,
  getScreenplayDisplayTitle,
  getScreenplayFormatInfo,
} from '@/lib/screenplayDisplay';
import { localizedScreenplayPreview } from '@/lib/localizedAnalysis';
import { isDecisionReady } from '@/lib/producerProjection';
import type { ProducerAssessmentHead } from '@/types';
import { useTranslation } from 'react-i18next';

export function ScreenplayGrid({
  entries,
  producerAssessments,
  producerLookIds,
  onOpen,
}: {
  entries: RankedScreenplay[];
  producerAssessments?: ReadonlyMap<string, ProducerAssessmentHead>;
  producerLookIds?: ReadonlySet<string>;
  onOpen: OpenScreenplay;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  return (
    <ul className="screenplay-wall" data-testid="screenplay-discovery-grid">
      {entries.map(({ screenplay, rank }) => {
        const displayTitle = getScreenplayDisplayTitle(screenplay.title);
        const displayAuthor = getScreenplayDisplayAuthor(screenplay.author);
        const displayGenre = getScreenplayDisplayGenre(screenplay.genre);
        const formatInfo = getScreenplayFormatInfo(screenplay);
        const localized = localizedScreenplayPreview(screenplay, language);
        const finalScore = screenplay.producerProjection?.finalScore ?? screenplay.weightedScore;
        const decisionReady = isDecisionReady(screenplay);
        // Coverage V1 documents are unscored BY DESIGN (never rankable) —
        // show their verdict honestly instead of the V9 "Not verified" label.
        const isCoverage =
          screenplay.producerProjection?.scoreSource === 'coverage_unscored';
        return (
          <li
            key={screenplay.id}
            className="screenplay-wall__item"
            data-testid="screenplay-discovery-result"
            data-screenplay-id={screenplay.id}
            data-verdict={
              decisionReady || isCoverage ? screenplay.recommendation : 'unverified'
            }
          >
            <DiscoverySelectionCheckbox screenplay={screenplay} />
            <button
              type="button"
              className="screenplay-wall__open"
              onClick={(event) => onOpen(screenplay, event.currentTarget)}
              aria-label={t('Open {{title}} screenplay file', { title: displayTitle.title })}
            >
              <span className="screenplay-wall__object-stage">
                <BlueSpineScript screenplay={screenplay} rank={decisionReady ? rank : undefined} />
              </span>
              <span className="screenplay-wall__copy">
                <span className="screenplay-wall__title">
                  <strong title={displayTitle.title}>{displayTitle.title}</strong>
                  {displayTitle.qualifier && <em>{displayTitle.qualifier}</em>}
                  {displayAuthor && <small>{t(displayAuthor)}</small>}
                </span>
                <span className="screenplay-wall__decision">
                  {decisionReady ? <>
                  <span className="screenplay-wall__score">
                    <strong>{finalScore.toFixed(1)}</strong>
                    <small>{t('Lemon score')}</small>
                  </span>
                  <RecommendationBadge tier={screenplay.recommendation} />
                  </> : isCoverage ? <>
                  <span className="screenplay-wall__score">
                    <strong>{t('Coverage')}</strong>
                    <small>{t('Unscored by design')}</small>
                  </span>
                  <RecommendationBadge tier={screenplay.recommendation} />
                  </> : (
                    <span className="screenplay-wall__score">
                      <strong>{t('Not verified')}</strong>
                      <small>{t('Not rankable')}</small>
                    </span>
                  )}
                </span>
                <span className="screenplay-wall__meta">
                  {formatInfo.format && (
                    <span className="screenplay-wall__format">{t(formatInfo.format)}</span>
                  )}
                  {displayGenre && (
                    <span className="screenplay-wall__genre">{t(displayGenre)}</span>
                  )}
                </span>
                {(localized?.logline?.trim() || language === 'es') && (
                  <span className="screenplay-wall__logline">
                    {localized?.logline?.trim() || t('Analysis available in English')}
                  </span>
                )}
              </span>
            </button>
            <footer className="screenplay-wall__footer">
              <span className="screenplay-wall__status">
                <AnalysisTrustBadge screenplay={screenplay} />
                <DiscoveryShareStatus screenplay={screenplay} />
                <DevelopmentOpportunityBadge
                  screenplay={screenplay}
                  assessment={producerAssessments?.get(screenplay.projectId ?? screenplay.id)}
                  routed={producerLookIds?.has(screenplay.projectId ?? screenplay.id)}
                  compact
                />
              </span>
            </footer>
          </li>
        );
      })}
    </ul>
  );
}
