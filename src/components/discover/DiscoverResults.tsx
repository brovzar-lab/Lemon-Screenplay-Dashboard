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
        className={clsx('dsc-num block font-semibold leading-none', large ? 'text-5xl sm:text-6xl' : 'text-3xl')}
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
        className="dsc-card dsc-card-hover relative overflow-hidden"
      >
        <DiscoverySelectionCheckbox screenplay={featured} />
        <button
          type="button"
          aria-label={`Open ${featured.title} details`}
          onClick={(event) => onOpen(featured, event.currentTarget)}
          className="grid h-full w-full text-left sm:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)]"
        >
          <div className="dsc-cover-zone p-6 sm:p-7">
            <ScriptCover
              title={featured.title}
              author={featured.author}
              seed={featured.projectId ?? featured.id}
              className="max-w-56"
            />
          </div>
          <div className="flex min-w-0 flex-col p-5 sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <p className="dsc-kicker">Featured screenplay · #1</p>
              <DiscoveryShareStatus screenplay={featured} />
            </div>
            <h2 className="dsc-display mt-3 text-4xl sm:text-[2.6rem]">{featured.title}</h2>
            <p className="dsc-label dsc-label-faint mt-2">
              {featured.genre} · {featured.author || 'Unknown writer'}
            </p>
            <p className="mt-5 text-base leading-7 text-[var(--dsc-ink-2)]">
              {featured.logline || 'Logline not yet available.'}
            </p>
            <div className="mt-auto flex items-center justify-between gap-4 border-y py-4 dsc-hairline">
              <RecommendationBadge tier={featured.recommendation} />
              <Score screenplay={featured} large />
            </div>
          </div>
        </button>
      </article>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="dsc-display text-2xl">Top matches</h2>
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
                  className="flex min-h-44 w-full gap-3 p-3 text-left sm:gap-4"
                >
                  <ScriptCover
                    title={screenplay.title}
                    author={screenplay.author}
                    seed={screenplay.projectId ?? screenplay.id}
                    className="w-20 shrink-0 self-start sm:w-24"
                  />
                  <div className="flex min-w-0 flex-1 flex-col py-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="dsc-label dsc-label-faint">#{index + 2}</span>
                      <span className="dsc-num text-2xl font-semibold">
                        {screenplay.weightedScore.toFixed(1)}
                      </span>
                    </div>
                    <h3 className="dsc-display mt-3 text-xl">{screenplay.title}</h3>
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
            className="relative flex w-full flex-col p-5 text-left"
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
                className="w-16 shrink-0 sm:w-20"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <RecommendationBadge tier={screenplay.recommendation} />
                  <DiscoveryShareStatus screenplay={screenplay} />
                </div>
                <h3 className="dsc-display mt-4 text-2xl sm:text-3xl">{screenplay.title}</h3>
                <p className="dsc-label dsc-label-faint mt-2">
                  {screenplay.genre} · {screenplay.author || 'Unknown writer'}
                </p>
              </div>
            </div>
            <p className="mt-auto line-clamp-3 pt-6 text-sm leading-6 text-[var(--dsc-ink-2)]">
              {screenplay.logline || 'Logline not yet available.'}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
