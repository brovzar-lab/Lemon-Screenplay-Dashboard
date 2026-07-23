import { clsx } from 'clsx';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import type { Screenplay } from '@/types';

function ScriptCover({
  screenplay,
  compact = false,
}: {
  screenplay: Screenplay;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        'relative flex shrink-0 flex-col justify-between overflow-hidden rounded-lg border border-black-600 bg-black-100 p-3 text-black-950 shadow-[0_16px_35px_rgba(0,0,0,0.22)]',
        compact ? 'h-32 w-20 sm:h-36 sm:w-24' : 'aspect-[3/4] w-full max-w-48 p-5',
      )}
      aria-hidden="true"
    >
      <span className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-black-600">
        Screenplay
      </span>
      <div className="border-y border-black-300 py-3 text-center">
        <p
          className={clsx(
            'font-display font-semibold uppercase leading-tight',
            compact ? 'text-sm' : 'text-xl',
          )}
        >
          {screenplay.title}
        </p>
        <p className="mt-2 text-[0.55rem] uppercase tracking-[0.08em] text-black-600">
          {screenplay.author || 'Unknown writer'}
        </p>
      </div>
      <span className="text-[0.5rem] uppercase tracking-[0.16em] text-black-500">
        Lemon Studios
      </span>
    </div>
  );
}

function Score({ screenplay, large = false }: { screenplay: Screenplay; large?: boolean }) {
  return (
    <div className="text-right">
      <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-black-500">
        Score
      </span>
      <span
        className={clsx('font-sans font-semibold leading-none tracking-tight text-black-50 tabular-nums', large ? 'text-5xl sm:text-6xl' : 'text-3xl')}
        aria-label={`Score ${screenplay.weightedScore.toFixed(1)}`}
      >
        {screenplay.weightedScore.toFixed(1)}
      </span>
    </div>
  );
}

interface DiscoverShowcaseProps {
  featured: Screenplay;
  topMatches: Screenplay[];
  onOpen: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
}

export function DiscoverShowcase({ featured, topMatches, onOpen }: DiscoverShowcaseProps) {
  return (
    <section
      aria-label="Top ranked screenplays"
      className="mb-14 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"
    >
      <article
        data-testid="discovery-featured"
        data-discovery-result
        data-screenplay-id={featured.id}
        className={clsx(
          'relative overflow-hidden rounded-2xl p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] sm:p-7 dark:border dark:border-black-700',
          featured.isFilmNow ? 'bg-gold-50' : 'bg-black-900',
        )}
      >
        <DiscoverySelectionCheckbox screenplay={featured} />
        <button
          type="button"
          aria-label={`Open ${featured.title} details`}
          onClick={(event) => onOpen(featured, event.currentTarget)}
          className="block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black-950"
        >
          <div className="mb-5 flex items-center justify-between gap-4 pl-12">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gold-400">
              Featured screenplay · #1
            </p>
            <DiscoveryShareStatus screenplay={featured} />
          </div>
          <div className="grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[11rem_minmax(0,1fr)]">
            <ScriptCover screenplay={featured} />
            <div className="flex min-w-0 flex-col">
              <div className="flex items-start justify-between gap-4">
                <RecommendationBadge tier={featured.recommendation} />
                <Score screenplay={featured} large />
              </div>
              <h2 className="mt-6 font-display text-4xl leading-tight text-black-50 sm:text-5xl">
                {featured.title}
              </h2>
              <p className="mt-2 text-xs uppercase tracking-[0.15em] text-black-500">
                {featured.genre} · {featured.author || 'Unknown writer'}
              </p>
              <p className="mt-auto pt-6 text-base leading-7 text-black-200">
                {featured.logline || 'Logline not yet available.'}
              </p>
            </div>
          </div>
        </button>
      </article>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl text-black-50">Top matches</h2>
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-black-500">
            Current ranking
          </span>
        </div>
        {topMatches.length > 0 ? (
          <ol className="grid gap-3 sm:grid-cols-2">
            {topMatches.map((screenplay, index) => (
              <li
                key={screenplay.id}
                data-testid="discovery-shelf-result"
                data-discovery-result
                data-screenplay-id={screenplay.id}
                className="relative overflow-hidden rounded-xl bg-black-900 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] dark:border dark:border-black-700"
              >
                <DiscoverySelectionCheckbox screenplay={screenplay} />
                <button
                  type="button"
                  aria-label={`Open ${screenplay.title} details`}
                  onClick={(event) => onOpen(screenplay, event.currentTarget)}
                  className="group flex min-h-44 w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-black-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:gap-4"
                >
                  <ScriptCover screenplay={screenplay} compact />
                  <div className="flex min-w-0 flex-1 flex-col py-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[0.6rem] text-black-500">#{index + 2}</span>
                      <span className="font-display text-2xl text-black-50">
                        {screenplay.weightedScore.toFixed(1)}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-xl leading-tight text-black-50">
                      {screenplay.title}
                    </h3>
                    <p className="mt-2 text-[0.6rem] uppercase tracking-[0.12em] text-black-500">
                      {screenplay.genre}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <RecommendationBadge tier={screenplay.recommendation} />
                      <DiscoveryShareStatus screenplay={screenplay} />
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl bg-black-900 p-6 text-sm text-black-400 shadow-[var(--shadow-card)] dark:border dark:border-black-700">
            More matches will appear as analyses are added.
          </p>
        )}
      </div>
    </section>
  );
}

interface DiscoverGridProps {
  screenplays: Screenplay[];
  onOpen: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
}

export function DiscoverGrid({ screenplays, onOpen }: DiscoverGridProps) {
  if (screenplays.length === 0) {
    return (
      <p className="rounded-xl bg-black-900 p-6 text-sm text-black-400 shadow-[var(--shadow-card)] dark:border dark:border-black-700">
            Every matching screenplay is shown on the shelf above.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {screenplays.map((screenplay, index) => (
        <li
          key={screenplay.id}
          data-testid="discovery-grid-result"
          data-discovery-result
          data-screenplay-id={screenplay.id}
          className="relative overflow-hidden rounded-2xl bg-black-900 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] dark:border dark:border-black-700"
        >
          <DiscoverySelectionCheckbox screenplay={screenplay} />
          <button
            type="button"
            aria-label={`Open ${screenplay.title} details`}
            onClick={(event) => onOpen(screenplay, event.currentTarget)}
            className="relative flex min-h-72 w-full flex-col overflow-hidden rounded-2xl p-5 text-left transition-colors hover:bg-black-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            <div className="flex w-full items-start justify-between gap-4 pl-12">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-black-500">
                Archive {String(index + 1).padStart(2, '0')}
              </span>
              <Score screenplay={screenplay} />
            </div>
            <div className="mt-7">
              <div className="flex items-center justify-between gap-3">
                <RecommendationBadge tier={screenplay.recommendation} />
                <DiscoveryShareStatus screenplay={screenplay} />
              </div>
              <h3 className="mt-4 font-display text-3xl leading-tight text-black-50">
                {screenplay.title}
              </h3>
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.14em] text-black-500">
                {screenplay.genre} · {screenplay.author || 'Unknown writer'}
              </p>
            </div>
            <p className="mt-auto line-clamp-3 pt-6 text-sm leading-6 text-black-300">
              {screenplay.logline || 'Logline not yet available.'}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
