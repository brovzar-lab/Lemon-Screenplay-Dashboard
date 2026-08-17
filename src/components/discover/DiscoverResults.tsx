import { clsx } from 'clsx';
import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { ScriptCover } from '@/components/discover/ScriptCover';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { AnalysisTrustBadge } from '@/components/screenplay/AnalysisTrustBadge';
import { ProducerScoreBadge } from '@/components/screenplay/ProducerScoreBadge';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { getScreenplayDisplayAuthor, getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import type { ProducerAssessmentHead, Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

type ProducerAssessmentMap = ReadonlyMap<string, ProducerAssessmentHead>;

interface ResultSurfaceProps {
  screenplay: Screenplay;
  onOpen: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
  producerAssessments?: ProducerAssessmentMap;
}

function assessmentFor(
  assessments: ProducerAssessmentMap | undefined,
  screenplay: Screenplay,
): ProducerAssessmentHead | undefined {
  const assessment = assessments?.get(screenplay.projectId ?? screenplay.id);
  return assessment?.versionId === screenplay.latestVersionId ? assessment : undefined;
}

function Score({ screenplay, large = false }: { screenplay: Screenplay; large?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={large ? 'cinema-score-lockup' : 'cinema-card-score'}>
      {large && <span className="dsc-label dsc-label-faint block">{t('Final score')}</span>}
      <span
        className={clsx(
          'dsc-num block font-semibold leading-none',
          large ? 'text-6xl' : 'text-2xl',
        )}
        aria-label={t('Score {{score}}', { score: screenplay.weightedScore.toFixed(1) })}
      >
        {screenplay.weightedScore.toFixed(1)}
      </span>
    </div>
  );
}

function PillarReadout({ screenplay }: { screenplay: Screenplay }) {
  const { t } = useTranslation();
  return (
    <div className="cinema-pillars" aria-label={t('Analysis pillars')}>
      {getDimensionDisplay(screenplay)
        .slice(0, 5)
        .map((pillar) => (
          <div key={pillar.key} className="cinema-pillar">
            <span>{t(pillar.label)}</span>
            <progress
              className="dsc-pillar-progress"
              value={Math.max(0, Math.min(10, pillar.score))}
              max={10}
              aria-label={t('{{label}} {{score}} out of 10', { label: t(pillar.label), score: pillar.score.toFixed(1) })}
            />
            <strong>{pillar.score.toFixed(1)}</strong>
          </div>
        ))}
    </div>
  );
}

function RankedCard({
  screenplay,
  rank,
  onOpen,
  producerAssessments,
}: ResultSurfaceProps & { rank: number }) {
  const { t } = useTranslation();
  const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;

  return (
    <li
      data-testid="discovery-shelf-result"
      data-discovery-result
      data-screenplay-id={screenplay.id}
      className="cinema-poster-card"
    >
      <DiscoverySelectionCheckbox screenplay={screenplay} />
      <button
        type="button"
        aria-label={t('Open {{title}} details', { title: displayTitle })}
        onClick={(event) => onOpen(screenplay, event.currentTarget)}
        className="cinema-poster-button"
      >
        <ScriptCover
          title={screenplay.title}
          author={screenplay.author}
          seed={screenplay.projectId ?? screenplay.id}
          analysisVersion={screenplay.analysisVersion}
          className="cinema-poster-cover"
        />
        <span className="cinema-rank">#{rank}</span>
        <span className="cinema-score-chip">{screenplay.weightedScore.toFixed(1)}</span>
        <span className="cinema-poster-meta">
          <span className="flex items-center justify-between gap-2">
            <RecommendationBadge tier={screenplay.recommendation} />
            <span className="flex items-center gap-1.5">
              <AnalysisTrustBadge screenplay={screenplay} />
              <DiscoveryShareStatus screenplay={screenplay} />
              <ProducerScoreBadge
                assessment={assessmentFor(producerAssessments, screenplay)}
                compact
              />
            </span>
          </span>
          <h3 className="cinema-poster-title">{displayTitle}</h3>
          <span className="cinema-poster-genre">{screenplay.genre}</span>
        </span>
      </button>
    </li>
  );
}

export function DiscoverFeature({
  featured,
  onOpen,
  producerAssessments,
}: {
  featured: Screenplay;
  onOpen: ResultSurfaceProps['onOpen'];
  producerAssessments?: ProducerAssessmentMap;
}) {
  const { t } = useTranslation();
  const displayTitle = getScreenplayDisplayTitle(featured.title).title;
  const displayAuthor = getScreenplayDisplayAuthor(featured.author);

  return (
    <article
      data-testid="discovery-featured"
      data-discovery-result
      data-screenplay-id={featured.id}
      className="cinema-feature relative mb-7 overflow-hidden"
    >
      <DiscoverySelectionCheckbox screenplay={featured} />
      <button
        type="button"
        aria-label={t('Open {{title}} details', { title: displayTitle })}
        onClick={(event) => onOpen(featured, event.currentTarget)}
        className="cinema-feature-button"
      >
        <div className="cinema-feature-cover-wrap">
          <ScriptCover
            title={featured.title}
            author={featured.author}
            seed={featured.projectId ?? featured.id}
            analysisVersion={featured.analysisVersion}
            className="cinema-feature-cover"
          />
        </div>

        <div className="cinema-feature-copy">
          <div className="flex flex-wrap items-center gap-3">
            <span className="dsc-kicker">{t('Featured screenplay')}</span>
            <AnalysisTrustBadge screenplay={featured} />
            <DiscoveryShareStatus screenplay={featured} />
            <ProducerScoreBadge assessment={assessmentFor(producerAssessments, featured)} />
          </div>
          <h2 className="cinema-feature-title">{displayTitle}</h2>
          <p className="cinema-feature-genre">
            {[featured.genre, displayAuthor].filter(Boolean).join(' · ')}
          </p>
          {featured.logline && <p className="cinema-feature-logline">{featured.logline}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="dsc-open-analysis">
              {t('Open analysis')}
              <span aria-hidden="true">↗</span>
            </span>
            <RecommendationBadge tier={featured.recommendation} />
          </div>
        </div>

        <div className="cinema-feature-evidence">
          <Score screenplay={featured} large />
          <PillarReadout screenplay={featured} />
          <div className="cinema-feature-metrics">
            <span>
              <small>{t('Market')}</small>
              <strong>{t(screenplayMetric(featured.producerMetrics.marketPotential))}</strong>
            </span>
            <span>
              <small>CVS</small>
              <strong>
                {featured.commercialViability.cvsAssessed === false
                  ? t('Not assessed')
                  : `${featured.cvsTotal}/18`}
              </strong>
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

function screenplayMetric(value: number | null): string {
  return value !== null && Number.isFinite(value) ? `${value.toFixed(1)}/10` : 'Not assessed';
}

export function DiscoverRankedShelf({
  screenplays,
  onOpen,
  producerAssessments,
}: {
  screenplays: Screenplay[];
  onOpen: ResultSurfaceProps['onOpen'];
  producerAssessments?: ProducerAssessmentMap;
}) {
  const { t } = useTranslation();
  if (screenplays.length === 0) return null;

  return (
    <section aria-labelledby="discovery-ranked" className="cinema-shelf">
      <div className="cinema-shelf-head">
        <h2 id="discovery-ranked">{t('Top Picks')}</h2>
        <span>{t('Current sort · best first')}</span>
      </div>
      <ol className="cinema-poster-rail">
        {screenplays.map((screenplay, index) => (
          <RankedCard
            key={screenplay.id}
            screenplay={screenplay}
            rank={index + 2}
            onOpen={onOpen}
            producerAssessments={producerAssessments}
          />
        ))}
      </ol>
    </section>
  );
}

export function DiscoverFilmNowShelf({
  screenplays,
  onOpen,
  producerAssessments,
}: {
  screenplays: Screenplay[];
  onOpen: ResultSurfaceProps['onOpen'];
  producerAssessments?: ProducerAssessmentMap;
}) {
  const { t } = useTranslation();
  if (screenplays.length === 0) return null;

  return (
    <section aria-labelledby="discovery-film-now" className="cinema-shelf cinema-film-now">
      <div className="cinema-shelf-head">
        <div>
          <span className="dsc-kicker">{t('Exceptional finds')}</span>
          <h2 id="discovery-film-now">FILM NOW</h2>
        </div>
        <span>{t('{{count}} ready to move', { count: screenplays.length })}</span>
      </div>
      <ul className="cinema-film-rail">
        {screenplays.map((screenplay) => {
          const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;
          return (
            <li
              key={screenplay.id}
              data-testid="discovery-film-now-result"
              data-screenplay-id={screenplay.id}
              className="cinema-film-card"
            >
              <DiscoverySelectionCheckbox screenplay={screenplay} />
              <button
                type="button"
                aria-label={t('Open FILM NOW {{title}} details', { title: displayTitle })}
                onClick={(event) => onOpen(screenplay, event.currentTarget)}
              >
                <ScriptCover
                  title={screenplay.title}
                  author={screenplay.author}
                  seed={screenplay.projectId ?? screenplay.id}
                  analysisVersion={screenplay.analysisVersion}
                  className="w-24 shrink-0"
                />
                <span className="min-w-0">
                  <RecommendationBadge tier="film_now" />
                  <ProducerScoreBadge
                    assessment={assessmentFor(producerAssessments, screenplay)}
                    compact
                  />
                  <span className="cinema-film-title">{displayTitle}</span>
                  <span className="cinema-film-logline">
                    {screenplay.recommendationRationale || screenplay.logline}
                  </span>
                </span>
                <Score screenplay={screenplay} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface DiscoverGridProps {
  screenplays: Screenplay[];
  onOpen: ResultSurfaceProps['onOpen'];
  producerAssessments?: ProducerAssessmentMap;
  rankOffset?: number;
}

export function DiscoverGrid({
  screenplays,
  onOpen,
  producerAssessments,
  rankOffset = 0,
}: DiscoverGridProps) {
  const { t } = useTranslation();
  if (screenplays.length === 0) {
    return <p className="cinema-empty-rail">{t('Every matching screenplay is shown above.')}</p>;
  }

  return (
    <ul className="cinema-archive-rail">
      {screenplays.map((screenplay, index) => {
        const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;
        return (
          <li
            key={screenplay.id}
            data-testid="discovery-grid-result"
            data-discovery-result
            data-screenplay-id={screenplay.id}
            className="cinema-poster-card"
          >
            <DiscoverySelectionCheckbox screenplay={screenplay} />
            <button
              type="button"
              aria-label={t('Open {{title}} details', { title: displayTitle })}
              onClick={(event) => onOpen(screenplay, event.currentTarget)}
              className="cinema-poster-button"
            >
              <ScriptCover
                title={screenplay.title}
                author={screenplay.author}
                seed={screenplay.projectId ?? screenplay.id}
                analysisVersion={screenplay.analysisVersion}
                className="cinema-poster-cover"
              />
              <span className="cinema-rank">
                {screenplay.producerProjection?.rankable === false
                  ? t('Review')
                  : `#${rankOffset + index + 6}`}
              </span>
              <span className="cinema-score-chip">{screenplay.weightedScore.toFixed(1)}</span>
              <span className="cinema-poster-meta">
                <span className="flex items-center justify-between gap-2">
                  <RecommendationBadge tier={screenplay.recommendation} />
                  <span className="flex items-center gap-1.5">
                    <AnalysisTrustBadge screenplay={screenplay} />
                    <DiscoveryShareStatus screenplay={screenplay} />
                    <ProducerScoreBadge
                      assessment={assessmentFor(producerAssessments, screenplay)}
                      compact
                    />
                  </span>
                </span>
                <h3 className="cinema-poster-title">{displayTitle}</h3>
                <span className="cinema-poster-genre">{screenplay.genre}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
