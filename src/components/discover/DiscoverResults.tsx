import { clsx } from 'clsx';
import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { ScriptCover } from '@/components/discover/ScriptCover';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { AnalysisTrustBadge } from '@/components/screenplay/AnalysisTrustBadge';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import type { Screenplay } from '@/types';

interface ResultSurfaceProps {
  screenplay: Screenplay;
  onOpen: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
}

function Score({
  screenplay,
  large = false,
}: {
  screenplay: Screenplay;
  large?: boolean;
}) {
  return (
    <div className={large ? 'cinema-score-lockup' : 'cinema-card-score'}>
      {large && <span className="dsc-label dsc-label-faint block">Final score</span>}
      <span
        className={clsx('dsc-num block font-semibold leading-none', large ? 'text-6xl' : 'text-2xl')}
        aria-label={`Score ${screenplay.weightedScore.toFixed(1)}`}
      >
        {screenplay.weightedScore.toFixed(1)}
      </span>
    </div>
  );
}

function PillarReadout({ screenplay }: { screenplay: Screenplay }) {
  return (
    <div className="cinema-pillars" aria-label="Analysis pillars">
      {getDimensionDisplay(screenplay)
        .slice(0, 5)
        .map((pillar) => (
          <div key={pillar.key} className="cinema-pillar">
            <span>{pillar.label}</span>
            <progress
              className="dsc-pillar-progress"
              value={Math.max(0, Math.min(10, pillar.score))}
              max={10}
              aria-label={`${pillar.label} ${pillar.score.toFixed(1)} out of 10`}
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
}: ResultSurfaceProps & { rank: number }) {
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
        aria-label={`Open ${screenplay.title} details`}
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
            </span>
          </span>
          <h3 className="cinema-poster-title">{screenplay.title}</h3>
          <span className="cinema-poster-genre">{screenplay.genre}</span>
        </span>
      </button>
    </li>
  );
}

export function DiscoverFeature({
  featured,
  onOpen,
}: {
  featured: Screenplay;
  onOpen: ResultSurfaceProps['onOpen'];
}) {
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
        aria-label={`Open ${featured.title} details`}
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
            <span className="dsc-kicker">Featured screenplay</span>
            <AnalysisTrustBadge screenplay={featured} />
            <DiscoveryShareStatus screenplay={featured} />
          </div>
          <h2 className="cinema-feature-title">{featured.title}</h2>
          <p className="cinema-feature-genre">
            {featured.genre} · {featured.author || 'Unknown writer'}
          </p>
          <p className="cinema-feature-logline">
            {featured.logline || 'Logline not yet available.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="dsc-open-analysis">
              Open analysis
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
              <small>Market</small>
              <strong>{screenplayMetric(featured.producerMetrics.marketPotential)}</strong>
            </span>
            <span>
              <small>CVS</small>
              <strong>
                {featured.commercialViability.cvsAssessed === false
                  ? 'Not assessed'
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
}: {
  screenplays: Screenplay[];
  onOpen: ResultSurfaceProps['onOpen'];
}) {
  if (screenplays.length === 0) return null;

  return (
    <section aria-labelledby="discovery-ranked" className="cinema-shelf">
      <div className="cinema-shelf-head">
        <h2 id="discovery-ranked">Top ranked this view</h2>
        <span>Current sort · best first</span>
      </div>
      <ol className="cinema-poster-rail">
        {screenplays.map((screenplay, index) => (
          <RankedCard
            key={screenplay.id}
            screenplay={screenplay}
            rank={index + 2}
            onOpen={onOpen}
          />
        ))}
      </ol>
    </section>
  );
}

export function DiscoverFilmNowShelf({
  screenplays,
  onOpen,
}: {
  screenplays: Screenplay[];
  onOpen: ResultSurfaceProps['onOpen'];
}) {
  if (screenplays.length === 0) return null;

  return (
    <section aria-labelledby="discovery-film-now" className="cinema-shelf cinema-film-now">
      <div className="cinema-shelf-head">
        <div>
          <span className="dsc-kicker">Exceptional finds</span>
          <h2 id="discovery-film-now">FILM NOW</h2>
        </div>
        <span>{screenplays.length} ready to move</span>
      </div>
      <ul className="cinema-film-rail">
        {screenplays.map((screenplay) => (
          <li
            key={screenplay.id}
            data-testid="discovery-film-now-result"
            data-screenplay-id={screenplay.id}
            className="cinema-film-card"
          >
            <DiscoverySelectionCheckbox screenplay={screenplay} />
            <button
              type="button"
              aria-label={`Open FILM NOW ${screenplay.title} details`}
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
                <span className="cinema-film-title">{screenplay.title}</span>
                <span className="cinema-film-logline">
                  {screenplay.recommendationRationale || screenplay.logline}
                </span>
              </span>
              <Score screenplay={screenplay} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface DiscoverGridProps {
  screenplays: Screenplay[];
  onOpen: ResultSurfaceProps['onOpen'];
}

export function DiscoverGrid({ screenplays, onOpen }: DiscoverGridProps) {
  if (screenplays.length === 0) {
    return <p className="cinema-empty-rail">Every matching screenplay is shown above.</p>;
  }

  return (
    <ul className="cinema-archive-rail">
      {screenplays.map((screenplay, index) => (
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
            aria-label={`Open ${screenplay.title} details`}
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
                ? 'Review'
                : `#${index + 6}`}
            </span>
            <span className="cinema-score-chip">{screenplay.weightedScore.toFixed(1)}</span>
            <span className="cinema-poster-meta">
              <span className="flex items-center justify-between gap-2">
                <RecommendationBadge tier={screenplay.recommendation} />
                <span className="flex items-center gap-1.5">
                  <AnalysisTrustBadge screenplay={screenplay} />
                  <DiscoveryShareStatus screenplay={screenplay} />
                </span>
              </span>
              <h3 className="cinema-poster-title">{screenplay.title}</h3>
              <span className="cinema-poster-genre">{screenplay.genre}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
