import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { ScriptCover } from '@/components/discover/ScriptCover';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';

function Score({ screenplay, large = false }: { screenplay: Screenplay; large?: boolean }) {
  return (
    <div className="text-right">
      <span className="dsc-label dsc-label-faint block">Weighted score</span>
      <span
        className={clsx(
          'dsc-num block font-semibold leading-none',
          large ? 'text-5xl xl:text-6xl' : 'text-2xl',
        )}
        aria-label={`Score ${screenplay.weightedScore.toFixed(1)}`}
      >
        {screenplay.weightedScore.toFixed(1)}
      </span>
    </div>
  );
}

function PillarReadout({ screenplay }: { screenplay: Screenplay }) {
  const pillars = getDimensionDisplay(screenplay).slice(0, 5);

  return (
    <div className="mt-5 space-y-3" aria-label="Analysis pillars">
      {pillars.map((pillar) => {
        return (
          <div key={pillar.key} className="grid grid-cols-[7.5rem_minmax(0,1fr)_2.25rem] items-center gap-3">
            <span className="truncate text-xs font-medium text-[var(--dsc-ink-2)]">
              {pillar.label}
            </span>
            <progress
              className="dsc-pillar-progress"
              value={Math.max(0, Math.min(10, pillar.score))}
              max={10}
              aria-label={`${pillar.label} ${pillar.score.toFixed(1)} out of 10`}
            />
            <span className="dsc-num text-right text-xs font-semibold">
              {pillar.score.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ResultSurfaceProps {
  screenplay: Screenplay;
  onOpen: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
}

function RankedCard({
  screenplay,
  rank,
  onOpen,
}: ResultSurfaceProps & { rank: number }) {
  const reason =
    screenplay.recommendationRationale ||
    screenplay.verdictStatement ||
    screenplay.logline ||
    'Complete analysis available.';

  return (
    <li
      data-testid="discovery-shelf-result"
      data-discovery-result
      data-screenplay-id={screenplay.id}
      className="dsc-card dsc-card-hover relative overflow-hidden"
    >
      <DiscoverySelectionCheckbox screenplay={screenplay} />
      <button
        type="button"
        aria-label={`Open ${screenplay.title} details`}
        onClick={(event) => onOpen(screenplay, event.currentTarget)}
        className="flex min-h-52 w-full gap-4 p-4 text-left"
      >
        <ScriptCover
          title={screenplay.title}
          author={screenplay.author}
          seed={screenplay.projectId ?? screenplay.id}
          className="w-24 shrink-0 self-start"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <span className="dsc-kicker">#{rank}</span>
            <span className="dsc-num text-2xl font-semibold">
              {screenplay.weightedScore.toFixed(1)}
            </span>
          </div>
          <h3 className="dsc-display mt-2 line-clamp-2 text-2xl">{screenplay.title}</h3>
          <p className="dsc-label dsc-label-faint mt-2 line-clamp-2">{screenplay.genre}</p>
          <p className="mt-3 line-clamp-2 text-sm leading-5 text-[var(--dsc-ink-2)]">{reason}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <RecommendationBadge tier={screenplay.recommendation} />
            <DiscoveryShareStatus screenplay={screenplay} />
          </div>
        </div>
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
      className="dsc-spotlight dsc-card dsc-card-hover relative mb-8 overflow-hidden"
    >
      <DiscoverySelectionCheckbox screenplay={featured} />
      <button
        type="button"
        aria-label={`Open ${featured.title} details`}
        onClick={(event) => onOpen(featured, event.currentTarget)}
        className="grid min-h-[23rem] w-full text-left md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_21rem]"
      >
        <div className="dsc-cover-zone p-7 xl:p-8">
          <ScriptCover
            title={featured.title}
            author={featured.author}
            seed={featured.projectId ?? featured.id}
            className="w-44 md:w-full md:max-w-48"
          />
        </div>

        <div className="flex min-w-0 flex-col justify-center p-6 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <p className="dsc-kicker">Featured screenplay</p>
            <DiscoveryShareStatus screenplay={featured} />
          </div>
          <h2 className="dsc-display mt-3 text-4xl lg:text-5xl">{featured.title}</h2>
          <p className="dsc-label dsc-label-faint mt-3">
            {featured.genre} · {featured.author || 'Unknown writer'}
          </p>
          <p className="mt-5 line-clamp-4 max-w-[70ch] text-base leading-7 text-[var(--dsc-ink-2)]">
            {featured.logline || 'Logline not yet available.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <RecommendationBadge tier={featured.recommendation} />
            <span className="dsc-open-analysis">
              Open analysis
              <span aria-hidden="true">↗</span>
            </span>
          </div>
        </div>

        <div className="dsc-spotlight-score flex flex-col justify-center p-6 md:col-span-2 md:p-8 xl:col-span-1">
          <Score screenplay={featured} large />
          <PillarReadout screenplay={featured} />
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--dsc-line)] pt-4">
            <div>
              <span className="dsc-label dsc-label-faint block">Market</span>
              <span className="dsc-num mt-1 block text-lg font-semibold">
                {screenplayMetric(featured.producerMetrics.marketPotential)}
              </span>
            </div>
            <div>
              <span className="dsc-label dsc-label-faint block">CVS</span>
              <span className="dsc-num mt-1 block text-lg font-semibold">
                {featured.commercialViability.cvsAssessed === false
                  ? 'Not assessed'
                  : `${featured.cvsTotal}/18`}
              </span>
            </div>
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
    <section aria-labelledby="discovery-ranked" className="mb-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="dsc-kicker mb-2">Current view</p>
          <h2 id="discovery-ranked" className="dsc-display text-3xl">
            Top ranked
          </h2>
        </div>
        <span className="dsc-label dsc-label-faint">Active sort order</span>
      </div>
      <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
    <section aria-labelledby="discovery-film-now" className="dsc-film-now mb-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="dsc-kicker mb-2">Exceptional finds</p>
          <h2 id="discovery-film-now" className="dsc-display text-3xl">
            FILM NOW
          </h2>
        </div>
        <span className="dsc-label dsc-label-faint">
          {screenplays.length} exceptional {screenplays.length === 1 ? 'project' : 'projects'}
        </span>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {screenplays.map((screenplay) => (
          <li
            key={screenplay.id}
            data-testid="discovery-film-now-result"
            data-screenplay-id={screenplay.id}
            className="dsc-film-now-card dsc-card dsc-card-hover relative overflow-hidden"
          >
            <DiscoverySelectionCheckbox screenplay={screenplay} />
            <button
              type="button"
              aria-label={`Open FILM NOW ${screenplay.title} details`}
              onClick={(event) => onOpen(screenplay, event.currentTarget)}
              className="flex min-h-40 w-full items-center gap-5 p-5 text-left"
            >
              <ScriptCover
                title={screenplay.title}
                author={screenplay.author}
                seed={screenplay.projectId ?? screenplay.id}
                className="w-20 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <RecommendationBadge tier="film_now" />
                  <span className="dsc-num text-3xl font-semibold">
                    {screenplay.weightedScore.toFixed(1)}
                  </span>
                </div>
                <p className="dsc-display mt-3 line-clamp-1 text-2xl">{screenplay.title}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-[var(--dsc-ink-2)]">
                  {screenplay.recommendationRationale || screenplay.logline}
                </p>
              </div>
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
    return (
      <p className="dsc-card p-6 text-sm text-[var(--dsc-ink-2)]">
        Every matching screenplay is shown above.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {screenplays.map((screenplay, index) => (
        <li
          key={screenplay.id}
          data-testid="discovery-grid-result"
          data-discovery-result
          data-screenplay-id={screenplay.id}
          className="dsc-card dsc-card-hover relative overflow-hidden"
        >
          <DiscoverySelectionCheckbox screenplay={screenplay} />
          <button
            type="button"
            aria-label={`Open ${screenplay.title} details`}
            onClick={(event) => onOpen(screenplay, event.currentTarget)}
            className="relative flex min-h-60 w-full flex-col p-5 text-left"
          >
            <div className="flex w-full items-start justify-between gap-4 pl-12">
              <span className="dsc-label dsc-label-faint">
                Slate {String(index + 1).padStart(2, '0')}
              </span>
              <Score screenplay={screenplay} />
            </div>
            <div className="mt-5 flex items-start gap-4">
              <ScriptCover
                title={screenplay.title}
                author={screenplay.author}
                seed={screenplay.projectId ?? screenplay.id}
                className="w-20 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <RecommendationBadge tier={screenplay.recommendation} />
                  <DiscoveryShareStatus screenplay={screenplay} />
                </div>
                <h3 className="dsc-display mt-3 line-clamp-2 text-2xl">{screenplay.title}</h3>
                <p className="dsc-label dsc-label-faint mt-2">
                  {screenplay.genre} · {screenplay.author || 'Unknown writer'}
                </p>
              </div>
            </div>
            <p className="mt-auto line-clamp-3 pt-5 text-sm leading-6 text-[var(--dsc-ink-2)]">
              {screenplay.logline || 'Logline not yet available.'}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
