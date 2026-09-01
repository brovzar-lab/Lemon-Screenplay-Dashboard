import { DevelopmentOpportunityBadge } from '@/components/discover/DevelopmentOpportunityBadge';
import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import type { OpenScreenplay } from '@/components/discover/screenplay/screenplayPresentationTypes';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import {
  getScreenplayDisplayAuthor,
  getScreenplayDisplayGenre,
  getScreenplayDisplayTitle,
  getScreenplayFormatInfo,
} from '@/lib/screenplayDisplay';
import { localizedScreenplayPreview } from '@/lib/localizedAnalysis';
import { isCoverageV1Screenplay, isDecisionReady } from '@/lib/producerProjection';
import type { FeaturedSelectionReason, ProducerAssessmentHead, Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

interface ScreenplayRankingProps {
  screenplay: Screenplay;
  rank: number;
  reason: FeaturedSelectionReason;
  outsideCurrentView: boolean;
  producerAssessments: ReadonlyMap<string, ProducerAssessmentHead>;
  producerLookIds?: ReadonlySet<string>;
  onOpen: OpenScreenplay;
}

export function ScreenplayRanking({
  screenplay,
  rank,
  reason,
  outsideCurrentView,
  producerAssessments,
  producerLookIds,
  onOpen,
}: ScreenplayRankingProps) {
  const { t, i18n } = useTranslation();
  const title = getScreenplayDisplayTitle(screenplay.title);
  const format = getScreenplayFormatInfo(screenplay);
  const author = getScreenplayDisplayAuthor(screenplay.author);
  const genre = getScreenplayDisplayGenre(screenplay.genre);
  const projectKey = screenplay.projectId ?? screenplay.id;
  const score = screenplay.producerProjection?.finalScore ?? screenplay.weightedScore;
  const confidence = screenplay.producerProjection?.trustStatus;
  const language = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const localized = localizedScreenplayPreview(screenplay, language);
  const decisionReady = isDecisionReady(screenplay);
  const isCoverage = isCoverageV1Screenplay(screenplay);
  const metadata = [
    format.format && t(format.format),
    genre && t(genre),
    author && t(author),
  ].filter(Boolean);
  const narrativeFallback = language === 'es' && !localized;
  const featuredDetail = (() => {
    if (isCoverage) {
      if (narrativeFallback) return t('Analysis available in English');
      return screenplay.coverage?.championReason || screenplay.logline;
    }
    if (!decisionReady) {
      return t('Decision data unavailable until verification');
    }
    if (narrativeFallback) return t('Analysis available in English');
    if (reason.code === 'manual_pin') {
      return t('This project remains Featured until an administrator removes the pin.');
    }
    if (reason.code === 'dust_resurfacing') {
      return t('This project meets the resurfacing policy and is ready for another look.');
    }

    let detail: string;
    if (reason.headline === 'Strongest structure among eligible projects') {
      detail = t('Its structure score of {{score}} leads today’s eligible slate.', {
        score: screenplay.dimensionScores.structure.toFixed(1),
      });
    } else if (reason.headline === 'Strongest commercial signal among eligible projects') {
      detail = t(
        'Market potential, commercial viability, and final score place it first under the studio policy.',
      );
    } else if (reason.headline === 'Fastest qualifying read') {
      detail =
        Number.isFinite(screenplay.metadata.pageCount) && screenplay.metadata.pageCount > 0
          ? t('At {{count}} pages, it is the shortest eligible project above the required score.', {
              count: screenplay.metadata.pageCount,
            })
          : t(
              'It is the shortest eligible project with a recorded page count above the required score.',
            );
    } else if (reason.headline === 'Strongest development opportunity') {
      detail =
        localized?.developmentOpportunity?.rationale ||
        t('Its upside and fixability make it the most useful project to review now.');
    } else {
      detail = t('Its {{score}} final score leads the projects allowed by today’s studio policy.', {
        score: score.toFixed(1),
      });
    }

    if (reason.mandateFallback) return `${t('No current mandate match.')} ${detail}`;
    if (reason.invalidPin) return `${t('The pinned project is unavailable.')} ${detail}`;
    return detail;
  })();

  return (
    <section
      className="screenplay-ranking screenplay-featured"
      data-testid="screenplay-discovery-ranking"
      aria-labelledby="screenplay-ranking-title"
      data-verdict={decisionReady || isCoverage ? screenplay.recommendation : 'unverified'}
    >
      <header className="screenplay-ranking__heading">
        <div>
          <p className="screenplay-ui-eyebrow">{t('Today’s studio focus')}</p>
          <h2 id="screenplay-ranking-title">{t('Featured project')}</h2>
        </div>
        <p>{t('Stable for today · based on the studio Featured policy')}</p>
      </header>
      <article
        className="screenplay-featured__layout"
        data-testid="screenplay-featured-project"
        data-screenplay-id={screenplay.id}
        data-verdict={decisionReady || isCoverage ? screenplay.recommendation : 'unverified'}
      >
        <button
          type="button"
          className="screenplay-featured__open"
          onClick={(event) => onOpen(screenplay, event.currentTarget)}
          aria-label={t('Open {{title}} screenplay file', { title: title.title })}
        >
          <span className="screenplay-featured__object">
            <BlueSpineScript screenplay={screenplay} featured rank={decisionReady ? rank : undefined} />
          </span>
          <span className="screenplay-featured__brief">
            <span className="screenplay-featured__kicker">{t('Featured screenplay')}</span>
            <span className="screenplay-featured__title">{title.title}</span>
            {title.qualifier && (
              <span className="screenplay-featured__qualifier">{title.qualifier}</span>
            )}
            <span className="screenplay-featured__meta">{metadata.join(' · ')}</span>
            {(localized?.logline || narrativeFallback) && (
              <span className="screenplay-featured__logline">
                {localized?.logline || t('Analysis available in English')}
              </span>
            )}
            <span className="screenplay-featured__why">
              <b>{t('Why featured')}</b>
              <strong>
                {decisionReady
                  ? t(reason.headline)
                  : isCoverage
                    ? t('Coverage · unscored by design')
                  : t('Decision data unavailable until verification')}
              </strong>
              <small>{featuredDetail}</small>
              {outsideCurrentView && (
                <em>{t('This recommendation sits outside your temporary browse filters.')}</em>
              )}
            </span>
            <span className="screenplay-featured__action">{t('Open screenplay file →')}</span>
          </span>
        </button>
        <aside className="screenplay-featured__decision" aria-label={t('AI decision')}>
          <span>{t('AI verdict')}</span>
          {decisionReady ? <>
            <strong>{score.toFixed(1)}</strong>
            <RecommendationBadge tier={screenplay.recommendation} />
          </> : isCoverage ? <>
            <RecommendationBadge tier={screenplay.recommendation} />
            <strong>{t('Coverage · unscored by design')}</strong>
          </> : <strong>{t('Not verified / not rankable')}</strong>}
          <dl>
            {(isCoverage ? screenplay.coverage?.confidence : confidence) && (
              <div>
                <dt>{t('Confidence')}</dt>
                <dd>
                  {(isCoverage ? screenplay.coverage?.confidence : confidence)?.replaceAll('_', ' ')}
                </dd>
              </div>
            )}
          </dl>
          <DevelopmentOpportunityBadge
            screenplay={screenplay}
            assessment={producerAssessments.get(projectKey)}
            routed={producerLookIds?.has(projectKey)}
          />
          <div className="screenplay-featured__selection">
            <span>{t('Select project')}</span>
            <DiscoverySelectionCheckbox screenplay={screenplay} />
          </div>
        </aside>
      </article>
    </section>
  );
}
