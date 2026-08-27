import { clsx } from 'clsx';
import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { DevelopmentOpportunityBadge } from '@/components/discover/DevelopmentOpportunityBadge';
import { ScriptCover } from '@/components/discover/ScriptCover';
import { AnalysisTrustBadge } from '@/components/screenplay/AnalysisTrustBadge';
import { ProducerScoreBadge } from '@/components/screenplay/ProducerScoreBadge';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { localizedScreenplayPreview } from '@/lib/localizedAnalysis';
import { getScreenplayDisplayAuthor, getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import type { PercentileRank } from '@/lib/percentileRanking';
import type { ProducerAssessmentHead, Screenplay, SortField } from '@/types';
import { useTranslation } from 'react-i18next';

type ProducerAssessmentMap = ReadonlyMap<string, ProducerAssessmentHead>;
type PercentileMap = ReadonlyMap<string, PercentileRank>;

interface OpenScreenplay {
  (screenplay: Screenplay, trigger: HTMLButtonElement): void;
}

function assessmentFor(
  assessments: ProducerAssessmentMap | undefined,
  screenplay: Screenplay,
): ProducerAssessmentHead | undefined {
  const assessment = assessments?.get(screenplay.projectId ?? screenplay.id);
  return assessment?.versionId === screenplay.latestVersionId ? assessment : undefined;
}

function percentileFor(
  percentiles: PercentileMap,
  screenplay: Screenplay,
): PercentileRank | undefined {
  return percentiles.get(screenplay.id);
}

function ordinal(value: number): string {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function trustLabel(screenplay: Screenplay): string {
  switch (screenplay.producerProjection?.trustStatus) {
    case 'verified':
      return 'Evidence verified';
    case 'incomplete':
      return 'Evidence incomplete';
    case 'legacy_unverified':
      return 'Legacy evidence';
    default:
      return screenplay.analysisQuality?.status === 'complete'
        ? 'Analysis complete'
        : 'Evidence status unknown';
  }
}

function rankingLabel(sortField: SortField): string {
  switch (sortField) {
    case 'marketPotential':
      return 'Ranked #1 by market potential';
    case 'cvsTotal':
      return 'Ranked #1 by CVS';
    case 'title':
      return 'First in title order';
    default:
      return 'Ranked #1 by weighted score';
  }
}

function whySurfaced(screenplay: Screenplay): string | undefined {
  return (
    screenplay.verdictStatement ||
    screenplay.recommendationRationale ||
    screenplay.strengths[0] ||
    screenplay.logline ||
    undefined
  );
}

export function HybridFeatureStage({
  featured,
  topMatches,
  sortField,
  onOpen,
  producerAssessments,
  producerLookIds,
  percentiles,
}: {
  featured: Screenplay;
  topMatches: Screenplay[];
  sortField: SortField;
  onOpen: OpenScreenplay;
  producerAssessments?: ProducerAssessmentMap;
  producerLookIds?: ReadonlySet<string>;
  percentiles: PercentileMap;
}) {
  const { t, i18n } = useTranslation();
  const percentile = percentileFor(percentiles, featured);
  const pillars = getDimensionDisplay(featured).slice(0, 5);
  const displayTitle = getScreenplayDisplayTitle(featured.title).title;
  const displayAuthor = getScreenplayDisplayAuthor(featured.author);
  const language = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const localized = localizedScreenplayPreview(featured, language);
  const surfacedReason = localized
    ? whySurfaced(localized)
    : t('Analysis available in English');

  return (
    <article
      className="hybrid-feature-stage"
      data-testid="discovery-featured"
      data-discovery-result
      data-screenplay-id={featured.id}
    >
      <DiscoverySelectionCheckbox screenplay={featured} />

      <div className="hybrid-feature-stage__cover">
        <span className="hybrid-stage-light" aria-hidden="true" />
        <ScriptCover
          title={featured.title}
          author={featured.author}
          seed={featured.projectId ?? featured.id}
          analysisVersion={featured.analysisVersion}
          className="hybrid-feature-cover"
        />
      </div>

      <div className="hybrid-feature-stage__copy">
        <p className="hybrid-eyebrow">{t('Featured screenplay')}</p>
        <h1>{displayTitle}</h1>
        {(featured.genre || displayAuthor) && (
          <p className="hybrid-feature-byline">
            {[featured.genre && t(featured.genre), displayAuthor && t(displayAuthor)].filter(Boolean).join(' · ')}
          </p>
        )}
        {(localized?.logline || language === 'es') && (
          <p className="hybrid-feature-logline">
            {localized?.logline || t('Analysis available in English')}
          </p>
        )}

        <div className="hybrid-feature-decision">
          <RecommendationBadge tier={featured.recommendation} />
          <DevelopmentOpportunityBadge
            screenplay={featured}
            assessment={assessmentFor(producerAssessments, featured)}
            routed={producerLookIds?.has(featured.projectId ?? featured.id)}
          />
          <span>{t(rankingLabel(sortField))}</span>
          <ProducerScoreBadge assessment={assessmentFor(producerAssessments, featured)} />
        </div>

        {surfacedReason && (
          <div className="hybrid-why-surfaced">
            <strong>{t('Why this surfaced')}</strong>
            <p>{surfacedReason}</p>
          </div>
        )}

        <button
          type="button"
          className="hybrid-open-project"
          onClick={(event) => onOpen(featured, event.currentTarget)}
          aria-label={t('Open {{title}} project', { title: displayTitle })}
        >
          {t('Open project')}
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
        </button>
      </div>

      <div className="hybrid-feature-stage__evidence">
        <div className="hybrid-score-stamp">
          <span>{t('Weighted score')}</span>
          <strong>{featured.weightedScore.toFixed(1)}</strong>
          <small>
            {percentile ? t('{{ordinal}} percentile', { ordinal: i18n.language === 'es' ? percentile.overall : ordinal(percentile.overall) }) : t('Slate position pending')}
          </small>
        </div>

        <div className="hybrid-pillar-list" aria-label={t('Five screenplay analysis pillars')}>
          <span className="hybrid-evidence-label">{t('Pillar scores')}</span>
          {pillars.map((pillar) => (
            <div key={pillar.key}>
              <span>{t(pillar.label)}</span>
              <progress
                value={Math.max(0, Math.min(10, pillar.score))}
                max={10}
                aria-label={t('{{label}} {{score}} out of 10', { label: t(pillar.label), score: pillar.score.toFixed(1) })}
              />
              <strong>{pillar.score.toFixed(1)}</strong>
            </div>
          ))}
        </div>

        <div className="hybrid-trust-list">
          <span className="hybrid-evidence-label">{t('Trust and verification')}</span>
          <span>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
              <path d="m8.5 12 2.2 2.2 4.8-5" />
            </svg>
            {t(trustLabel(featured))}
          </span>
          <span>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
              <path d="m8.5 12 2.2 2.2 4.8-5" />
            </svg>
            {featured.analysisQuality
              ? t('{{completed}} of {{expected}} readers complete', { completed: featured.analysisQuality.completedReaders, expected: featured.analysisQuality.expectedReaders })
              : t('Legacy reader evidence')}
          </span>
          <DiscoveryShareStatus screenplay={featured} />
        </div>
      </div>

      <ol className="hybrid-ranked-folders" aria-label={t('Next four projects in the current ranking')}>
        {topMatches.map((screenplay, index) => {
          const itemPercentile = percentileFor(percentiles, screenplay);
          const runnerTitle = getScreenplayDisplayTitle(screenplay.title).title;
          return (
            <li
              key={screenplay.id}
              data-folder-index={index}
              data-testid="discovery-shelf-result"
              data-discovery-result
              data-screenplay-id={screenplay.id}
            >
              <DiscoverySelectionCheckbox screenplay={screenplay} />
              <button
                type="button"
                onClick={(event) => onOpen(screenplay, event.currentTarget)}
                aria-label={t('Open {{title}} project, ranked {{rank}}', { title: runnerTitle, rank: index + 2 })}
              >
                <ScriptCover
                  title={screenplay.title}
                  author={screenplay.author}
                  seed={screenplay.projectId ?? screenplay.id}
                  analysisVersion={screenplay.analysisVersion}
                />
                <span className="hybrid-folder-score">{screenplay.weightedScore.toFixed(1)}</span>
                <span className="hybrid-folder-rank">#{index + 2}</span>
                {itemPercentile && (
                  <span className="hybrid-folder-percentile">
                    {t('{{ordinal}} percentile', { ordinal: i18n.language === 'es' ? itemPercentile.overall : ordinal(itemPercentile.overall) })}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export function HybridFilmNowRail({
  screenplays,
  onOpen,
}: {
  screenplays: Screenplay[];
  onOpen: OpenScreenplay;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  if (screenplays.length === 0) return null;

  return (
    <section className="hybrid-film-now" aria-labelledby="hybrid-film-now-title">
      <header>
        <div>
          <p className="hybrid-eyebrow">{t('Exceptional finds')}</p>
          <h2 id="hybrid-film-now-title">FILM NOW</h2>
        </div>
        <span>{t('{{count}} ready to move', { count: screenplays.length })}</span>
      </header>
      <ul>
        {screenplays.map((screenplay) => {
          const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;
          const localized = localizedScreenplayPreview(screenplay, language);
          return (
            <li key={screenplay.id} data-testid="discovery-film-now-result">
              <button
                type="button"
                onClick={(event) => onOpen(screenplay, event.currentTarget)}
                aria-label={t('Open FILM NOW {{title}} project', { title: displayTitle })}
              >
                <span>
                  <strong>{displayTitle}</strong>
                  <small>
                    {localized?.recommendationRationale ||
                      localized?.logline ||
                      (language === 'es' ? t('Analysis available in English') : '')}
                  </small>
                </span>
                <b>{screenplay.weightedScore.toFixed(1)}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function HybridSlateGrid({
  screenplays,
  onOpen,
  producerAssessments,
  producerLookIds,
  percentiles,
  rankOffset = 0,
}: {
  screenplays: Screenplay[];
  onOpen: OpenScreenplay;
  producerAssessments?: ProducerAssessmentMap;
  producerLookIds?: ReadonlySet<string>;
  percentiles: PercentileMap;
  rankOffset?: number;
}) {
  const { t, i18n } = useTranslation();
  if (screenplays.length === 0) {
    return <p className="hybrid-slate-empty">{t('Every matching screenplay is shown above.')}</p>;
  }

  return (
    <ul className="hybrid-slate-grid">
      {screenplays.map((screenplay, index) => {
        const percentile = percentileFor(percentiles, screenplay);
        const isRankable = screenplay.producerProjection?.rankable !== false;
        const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;
        const displayAuthor = getScreenplayDisplayAuthor(screenplay.author);
        return (
          <li
            key={screenplay.id}
            className={clsx('hybrid-slate-card', !isRankable && 'hybrid-slate-card--review')}
            data-testid="discovery-grid-result"
            data-discovery-result
            data-screenplay-id={screenplay.id}
          >
            <DiscoverySelectionCheckbox screenplay={screenplay} />
            <button
              type="button"
              className="hybrid-slate-card__open"
              onClick={(event) => onOpen(screenplay, event.currentTarget)}
              aria-label={t('Open {{title}} project', { title: displayTitle })}
            >
              <ScriptCover
                title={screenplay.title}
                author={screenplay.author}
                seed={screenplay.projectId ?? screenplay.id}
                analysisVersion={screenplay.analysisVersion}
                className="hybrid-slate-card__cover"
              />
              <span className="hybrid-slate-card__copy">
                <span className="hybrid-slate-card__title-row">
                  <span>
                    <strong>{displayTitle}</strong>
                    {displayAuthor && <small>{t(displayAuthor)}</small>}
                  </span>
                  <span className="hybrid-slate-card__score">
                    <b>{screenplay.weightedScore.toFixed(1)}</b>
                    <small>{percentile ? t('{{ordinal}} percentile', { ordinal: i18n.language === 'es' ? percentile.overall : ordinal(percentile.overall) }) : ''}</small>
                  </span>
                </span>

                <span className="hybrid-slate-card__genre">{t(screenplay.genre)}</span>

                <span className="hybrid-slate-card__status">
                  <span>
                    {isRankable ? t(trustLabel(screenplay)) : t('Review · #{{rank}}', { rank: rankOffset + index + 6 })}
                  </span>
                  <span>{screenplay.analysisQuality ? `${screenplay.analysisQuality.completedReaders}/${screenplay.analysisQuality.expectedReaders}` : t('Legacy')}</span>
                </span>

                <span className="hybrid-slate-card__footer">
                  <RecommendationBadge tier={screenplay.recommendation} />
                  <DevelopmentOpportunityBadge
                    screenplay={screenplay}
                    assessment={assessmentFor(producerAssessments, screenplay)}
                    routed={producerLookIds?.has(screenplay.projectId ?? screenplay.id)}
                    compact
                  />
                  <span>
                    <AnalysisTrustBadge screenplay={screenplay} />
                    <DiscoveryShareStatus screenplay={screenplay} />
                    <ProducerScoreBadge
                      assessment={assessmentFor(producerAssessments, screenplay)}
                      compact
                    />
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
