import type { Screenplay } from '@/types';

interface DiscoverShellProps {
  screenplays: Screenplay[];
  isLoading: boolean;
  isError: boolean;
}

function Score({ value }: { value: number }) {
  return (
    <span
      className="font-mono text-sm font-semibold text-black-50"
      aria-label={`Score ${value.toFixed(1)}`}
    >
      {value.toFixed(1)}
    </span>
  );
}

export function DiscoverShell({ screenplays, isLoading, isError }: DiscoverShellProps) {
  if (isLoading) {
    return (
      <main className="min-h-screen bg-black-950 px-6 py-12" role="status">
        <div className="mx-auto max-w-[1600px] animate-pulse">
          <div className="mb-10 h-10 w-72 rounded bg-black-800" />
          <div className="h-72 rounded-xl border border-black-700 bg-black-900" />
        </div>
        <span className="sr-only">Loading Discovery</span>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="min-h-screen bg-black-950 px-6 py-12">
        <div className="mx-auto max-w-[1600px] rounded-xl border border-red-500/30 bg-black-900 p-8">
          <h1 className="text-2xl text-black-50">Discovery is temporarily unavailable</h1>
          <p className="mt-3 text-black-300">
            The existing dashboard is still available at the main route.
          </p>
        </div>
      </main>
    );
  }

  if (screenplays.length === 0) {
    return (
      <main className="min-h-screen bg-black-950 px-6 py-12">
        <div className="mx-auto max-w-[1600px]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-gold-400">
            Lemon Studios
          </p>
          <h1 className="font-display text-4xl text-black-50">Discover</h1>
          <p className="mt-8 rounded-xl border border-black-700 bg-black-900 p-8 text-black-300">
            No analyzed screenplays are available yet.
          </p>
        </div>
      </main>
    );
  }

  const [featured, ...remaining] = screenplays;
  const topMatches = remaining.slice(0, 4);
  const library = remaining.slice(4);

  return (
    <main className="min-h-screen bg-black-950 px-6 py-10 text-black-50">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-black-700 pb-6">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-gold-400">
              Lemon Studios
            </p>
            <h1 className="font-display text-4xl sm:text-5xl">Discover</h1>
          </div>
          <p className="font-mono text-sm text-black-400">
            {screenplays.length} analyzed screenplays
          </p>
        </header>

        <section aria-labelledby="featured-screenplay" className="mb-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-black-400">
            Featured
          </p>
          <article className="grid gap-6 rounded-xl border border-gold-500/30 bg-black-900 p-6 md:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)] md:p-8">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-black-300">
                <span>{featured.genre}</span>
                <span aria-hidden="true">•</span>
                <span className="capitalize">{featured.recommendation.replace('_', ' ')}</span>
              </div>
              <h2
                id="featured-screenplay"
                className="font-display text-3xl text-black-50 sm:text-4xl"
              >
                {featured.title}
              </h2>
              <p className="mt-3 text-sm text-black-400">
                by {featured.author || 'Unknown writer'}
              </p>
              {featured.logline && (
                <p className="mt-6 max-w-3xl text-base leading-7 text-black-200">
                  {featured.logline}
                </p>
              )}
            </div>
            <div className="flex items-end justify-between border-t border-black-700 pt-5 md:flex-col md:items-end md:justify-between md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black-400">
                V9 score
              </span>
              <span className="font-display text-6xl text-black-50">
                {featured.weightedScore.toFixed(1)}
              </span>
            </div>
          </article>
        </section>

        <section aria-labelledby="top-matches" className="mb-12">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="top-matches" className="font-display text-2xl text-black-50">
              Top matches
            </h2>
            <span className="text-xs uppercase tracking-[0.14em] text-black-400">
              Highest V9 scores
            </span>
          </div>
          {topMatches.length > 0 ? (
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {topMatches.map((screenplay, index) => (
                <li
                  key={screenplay.id}
                  className="rounded-xl border border-black-700 bg-black-900 p-5"
                >
                  <div className="mb-6 flex items-center justify-between gap-3 text-xs text-black-400">
                    <span>#{index + 2}</span>
                    <Score value={screenplay.weightedScore} />
                  </div>
                  <h3 className="font-display text-xl text-black-50">{screenplay.title}</h3>
                  <p className="mt-2 text-sm text-black-400">{screenplay.genre}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl border border-black-700 bg-black-900 p-6 text-sm text-black-400">
              More matches will appear as analyses are added.
            </p>
          )}
        </section>

        <section aria-labelledby="discovery-library">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="discovery-library" className="font-display text-2xl text-black-50">
              Library
            </h2>
            <span className="font-mono text-xs text-black-400">{library.length} more</span>
          </div>
          {library.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {library.map((screenplay) => (
                <li
                  key={screenplay.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-black-700 bg-black-900 p-4"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-black-50">
                      {screenplay.title}
                    </h3>
                    <p className="mt-1 truncate text-sm text-black-400">{screenplay.genre}</p>
                  </div>
                  <Score value={screenplay.weightedScore} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-black-700 bg-black-900 p-6 text-sm text-black-400">
              Every available screenplay is shown above.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
