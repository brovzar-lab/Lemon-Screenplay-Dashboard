import { DevelopmentOpportunityBadge } from '@/components/discover/DevelopmentOpportunityBadge';
import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import type {
  OpenScreenplay,
  PercentileMap,
} from '@/components/discover/screenplay/screenplayPresentationTypes';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import {
  getScreenplayDisplayAuthor,
  getScreenplayDisplayGenre,
  getScreenplayDisplayTitle,
  getScreenplayFormatInfo,
} from '@/lib/screenplayDisplay';
import type {
  FeaturedSelectionReason,
  ProducerAssessmentHead,
  Screenplay,
} from '@/types';
import { useTranslation } from 'react-i18next';

function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

interface ScreenplayRankingProps {
  screenplay: Screenplay;
  rank: number;
  reason: FeaturedSelectionReason;
  outsideCurrentView: boolean;
  percentiles: PercentileMap;
  producerAssessments: ReadonlyMap<string, ProducerAssessmentHead>;
  producerLookIds?: ReadonlySet<string>;
  onOpen: OpenScreenplay;
}

export function ScreenplayRanking({
  screenplay,
  rank,
  reason,
  outsideCurrentView,
  percentiles,
  producerAssessments,
  producerLookIds,
  onOpen,
}: ScreenplayRankingProps) {
  const { t, i18n } = useTranslation();
  const title = getScreenplayDisplayTitle(screenplay.title);
  const format = getScreenplayFormatInfo(screenplay);
  const author = getScreenplayDisplayAuthor(screenplay.author);
  const genre = getScreenplayDisplayGenre(screenplay.genre);
  const percentile = percentiles.get(screenplay.id);
  const projectKey = screenplay.projectId ?? screenplay.id;
  const score = screenplay.producerProjection?.finalScore ?? screenplay.weightedScore;
  const confidence = screenplay.producerProjection?.trustStatus;
  const metadata = [format.format, genre, author].filter(Boolean);

  return (
    <section
      className="screenplay-ranking screenplay-featured"
      data-testid="screenplay-discovery-ranking"
      aria-labelledby="screenplay-ranking-title"
      data-verdict={screenplay.recommendation}
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
        data-verdict={screenplay.recommendation}
      >
        <button
          type="button"
          className="screenplay-featured__open"
          onClick={(event) => onOpen(screenplay, event.currentTarget)}
          aria-label={t('Open {{title}} screenplay file', { title: title.title })}
        >
          <span className="screenplay-featured__object">
            <BlueSpineScript screenplay={screenplay} featured rank={rank} />
          </span>
          <span className="screenplay-featured__brief">
            <span className="screenplay-featured__kicker">{t('Featured screenplay')}</span>
            <span className="screenplay-featured__title">{title.title}</span>
            {title.qualifier && <span className="screenplay-featured__qualifier">{title.qualifier}</span>}
            <span className="screenplay-featured__meta">{metadata.join(' · ')}</span>
            {screenplay.logline && (
              <span className="screenplay-featured__logline">{screenplay.logline}</span>
            )}
            <span className="screenplay-featured__why">
              <b>{t('Why featured')}</b>
              <strong>{reason.headline}</strong>
              <small>{reason.detail}</small>
              {outsideCurrentView && (
                <em>{t('This recommendation sits outside your temporary browse filters.')}</em>
              )}
            </span>
            <span className="screenplay-featured__action">{t('Open screenplay file →')}</span>
          </span>
        </button>
        <aside className="screenplay-featured__decision" aria-label={t('AI decision')}>
          <span>{t('AI verdict')}</span>
          <strong>{score.toFixed(1)}</strong>
          <RecommendationBadge tier={screenplay.recommendation} />
          <dl>
            {percentile && (
              <div>
                <dt>{t('Percentile')}</dt>
                <dd>
                  {i18n.resolvedLanguage === 'es'
                    ? percentile.overall
                    : ordinal(percentile.overall)}
                </dd>
              </div>
            )}
            {confidence && (
              <div>
                <dt>{t('Confidence')}</dt>
                <dd>{confidence.replaceAll('_', ' ')}</dd>
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
