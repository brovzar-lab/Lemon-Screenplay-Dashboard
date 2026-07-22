import { DiscoverControls } from '@/components/discover/DiscoverControls';
import { DiscoverGrid, DiscoverShowcase } from '@/components/discover/DiscoverResults';
import type { Screenplay } from '@/types';

interface DiscoverShellProps {
  screenplays: Screenplay[];
  totalCount: number;
  filteredCount: number;
  genres: string[];
  themes: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  isLoading: boolean;
  isError: boolean;
}

function DiscoverHeader() {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-black-700 pb-6">
      <div>
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-gold-400">
          Lemon Studios · Development slate
        </p>
        <h1 className="font-display text-5xl leading-none text-black-50 sm:text-6xl">Discover</h1>
      </div>
      <p className="max-w-sm text-right text-sm leading-6 text-black-400">
        Find the strongest story for the moment, then follow the signal through the slate.
      </p>
    </header>
  );
}

function DiscoverLoading() {
  return (
    <main
      className="min-h-screen bg-black-950 px-4 py-8 text-black-50 sm:px-6 lg:px-10"
      role="status"
    >
      <div className="mx-auto max-w-[1600px] animate-pulse">
        <div className="mb-7 h-16 w-72 bg-black-800" />
        <div className="mb-8 h-48 border border-black-700 bg-black-900" />
        <div className="mb-12 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="h-[27rem] border border-black-700 bg-black-900" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-48 border border-black-700 bg-black-900" />
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 border border-black-700 bg-black-900" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading Discovery</span>
    </main>
  );
}

export function DiscoverShell({
  screenplays,
  totalCount,
  filteredCount,
  genres,
  themes,
  hasActiveFilters,
  onClearFilters,
  isLoading,
  isError,
}: DiscoverShellProps) {
  if (isLoading) return <DiscoverLoading />;

  if (isError) {
    return (
      <main className="min-h-screen bg-black-950 px-6 py-12">
        <div className="mx-auto max-w-[1600px] border border-red-500/30 bg-black-900 p-8">
          <h1 className="font-display text-3xl text-black-50">
            Discovery is temporarily unavailable
          </h1>
          <p className="mt-3 text-black-300">
            The existing dashboard is still available at the main route.
          </p>
        </div>
      </main>
    );
  }

  const [featured, ...remaining] = screenplays;
  const topMatches = remaining.slice(0, 4);
  const grid = remaining.slice(4);

  return (
    <main className="min-h-screen bg-black-950 px-4 py-8 text-black-50 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <DiscoverHeader />
        <DiscoverControls
          genres={genres}
          themes={themes}
          filteredCount={filteredCount}
          totalCount={totalCount}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
        />

        {totalCount === 0 ? (
          <section className="border border-black-700 bg-black-900 p-10 text-center">
            <h2 className="font-display text-3xl text-black-50">No analyzed screenplays yet</h2>
            <p className="mt-3 text-black-400">
              New analyses will appear here through the live data feed.
            </p>
          </section>
        ) : !featured ? (
          <section className="border border-black-700 bg-black-900 p-10 text-center">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold-400">
              No match
            </p>
            <h2 className="mt-3 font-display text-3xl text-black-50">No scripts match this view</h2>
            <p className="mx-auto mt-3 max-w-md text-black-400">
              Try a broader search or clear the active filters to reopen the full slate.
            </p>
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-6 border border-gold-500/60 px-5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-gold-300 hover:bg-gold-500/10"
            >
              Clear filters
            </button>
          </section>
        ) : (
          <>
            <DiscoverShowcase featured={featured} topMatches={topMatches} />

            <section aria-labelledby="discovery-archive">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-black-700 pb-4">
                <div>
                  <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gold-400">
                    The full read
                  </p>
                  <h2 id="discovery-archive" className="font-display text-3xl text-black-50">
                    Slate archive
                  </h2>
                </div>
                <span className="font-mono text-xs text-black-500">
                  {grid.length} beyond the shelf
                </span>
              </div>
              <DiscoverGrid screenplays={grid} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
