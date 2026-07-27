import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { ScriptCover } from '@/components/discover/ScriptCover';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';

function Score({ screenplay, large = false }: { screenplay: Screenplay; large?: boolean }) {
  return (
    <div className="text-right">
      <span className="dsc-label dsc-label-faint block">Score</span>
      <span
        className={clsx('dsc-num block font-semibold leading-none', large ? 'text-4xl' : 'text-2xl')}
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
      className="mb-10 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(27rem,0.9fr)]"
    >
      <article
        data-testid="discovery-featured"
        data-discovery-result
        data-screenplay-id={featured.id}
        className="dsc-card dsc-card-hover relative overflow-hidden"
      >
        <DiscoverySelectionCheckbox screenplay={featured} />
        <button
          type="button"
          aria-label={`Open ${featured.title} details`}
          onClick={(event) => onOpen(featured, event.currentTarget)}
          className="grid h-full w-full text-left sm:grid-cols-[9.5rem_minmax(0,1fr)] lg:grid-cols-[11rem_minmax(0,1fr)]"
        >
          <div className="dsc-cover-zone p-5">
            <ScriptCover
              title={featured.title}
              author={featured.author}
              seed={featured.projectId ?? featured.id}
              className="w-28 sm:w-32 lg:w-36"
            />
          </div>
          <div className="flex min-w-0 flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="dsc-kicker">Featured screenplay · #1</p>
              <DiscoveryShareStatus screenplay={featured} />
            </div>
            <h2 className="dsc-display mt-3 text-3xl sm:text-[2.15rem]">{featured.title}</h2>
            <p className="dsc-label dsc-label-faint mt-2">
              {featured.genre} · {featured.author || 'Unknown writer'}
            </p>
            <p className="mt-4 line-clamp-5 text-[15px] leading-7 text-[var(--dsc-ink-2)]">
              {featured.logline || 'Logline not yet available.'}
            </p>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-[var(--sp-r-md)] bg-[var(--dsc-surface-2)] px-4 py-3">
              <RecommendationBadge tier={featured.recommendation} />
              <Score screenplay={featured} large />
            </div>
          </div>
        </button>
      </article>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold text-[var(--dsc-ink)]">Top matches</h2>
          <span className="dsc-label dsc-label-faint">Current ranking</span>
        </div>
        {topMatches.length > 0 ? (
          <ol className="grid gap-3 sm:grid-cols-2">
            {topMatches.map((screenplay, index) => (
              <li
                key={screenplay.id}
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
                  className="flex min-h-32 w-full gap-3 p-3 text-left sm:gap-4"
                >
                  <ScriptCover
                    title={screenplay.title}
                    author={screenplay.author}
                    seed={screenplay.projectId ?? screenplay.id}
                    className="w-16 shrink-0 self-start sm:w-[4.5rem]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col py-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="dsc-label dsc-label-faint">#{index + 2}</span>
                      <span className="dsc-num text-2xl font-semibold">
                        {screenplay.weightedScore.toFixed(1)}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug text-[var(--dsc-ink)]">
                      {screenplay.title}
                    </h3>
                    <p className="dsc-label dsc-label-faint mt-2">{screenplay.genre}</p>
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
          <p className="dsc-card p-6 text-sm text-[var(--dsc-ink-2)]">
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
      <p className="dsc-card p-6 text-sm text-[var(--dsc-ink-2)]">
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
          className="dsc-card dsc-card-hover relative overflow-hidden"
        >
          <DiscoverySelectionCheckbox screenplay={screenplay} />
          <button
            type="button"
            aria-label={`Open ${screenplay.title} details`}
            onClick={(event) => onOpen(screenplay, event.currentTarget)}
            className="relative flex min-h-64 w-full flex-col p-4 text-left"
          >
            <div className="flex w-full items-start justify-between gap-4 pl-12">
              <span className="dsc-label dsc-label-faint">
                Archive {String(index + 1).padStart(2, '0')}
              </span>
              <Score screenplay={screenplay} />
            </div>
            <div className="mt-6 flex items-start gap-4">
              <ScriptCover
                title={screenplay.title}
                author={screenplay.author}
                seed={screenplay.projectId ?? screenplay.id}
                className="w-14 shrink-0 sm:w-16"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <RecommendationBadge tier={screenplay.recommendation} />
                  <DiscoveryShareStatus screenplay={screenplay} />
                </div>
                <h3 className="mt-3 line-clamp-2 text-xl font-semibold leading-snug text-[var(--dsc-ink)]">
                  {screenplay.title}
                </h3>
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
