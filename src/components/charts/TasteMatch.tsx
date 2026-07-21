import { useEffect, useMemo, useState } from 'react';
import { loadAllBrainVerdicts, type BrainVerdict } from '@/lib/feedbackStore';
import { calculateTasteMatch } from '@/lib/tasteMatch';

function verdictLabel(value: string): string {
  return value === 'film_now' ? 'Film Now' : value.charAt(0).toUpperCase() + value.slice(1);
}

export function TasteMatch() {
  const [verdicts, setVerdicts] = useState<BrainVerdict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const stats = useMemo(() => calculateTasteMatch(verdicts), [verdicts]);

  useEffect(() => {
    let active = true;
    loadAllBrainVerdicts().then((loaded) => {
      if (active) {
        setVerdicts(loaded);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mt-6 rounded-lg bg-black-800 p-6 text-sm text-black-300">
        Loading Taste Match...
      </div>
    );
  }

  if (stats.reviewed === 0) {
    return (
      <div className="mt-6 rounded-lg bg-black-800 p-6">
        <h2 className="font-heading text-xl font-semibold text-black-50">Taste Match</h2>
        <p className="mt-1 text-sm text-black-300">
          Record Billy's Take on screenplay details to start measuring AI agreement.
        </p>
      </div>
    );
  }

  const confidence =
    stats.reviewed < 10 ? 'Early signal' : stats.reviewed < 30 ? 'Developing' : 'Strong sample';

  return (
    <section
      className="mt-6 rounded-lg bg-black-900 p-5 shadow-sm md:p-6"
      aria-labelledby="taste-match-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="taste-match-title" className="font-heading text-xl font-semibold text-black-50">
            Taste Match
          </h2>
          <p className="mt-1 text-sm text-black-300">
            AI verdicts compared with Billy's recorded decisions
          </p>
        </div>
        <span className="rounded-full bg-black-800 px-3 py-1.5 text-sm text-black-300">
          {confidence} · {stats.reviewed} reviewed
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="metric-tile">
          <p className="text-2xl font-semibold text-black-50">{stats.matchRate.toFixed(0)}%</p>
          <p className="mt-1 text-sm text-black-300">Exact agreement</p>
        </div>
        <div className="metric-tile">
          <p className="text-2xl font-semibold text-black-50">{stats.matched}</p>
          <p className="mt-1 text-sm text-black-300">Same verdict</p>
        </div>
        <div className="metric-tile">
          <p className="text-2xl font-semibold text-black-50">{stats.aiTooHigh}</p>
          <p className="mt-1 text-sm text-black-300">AI too generous</p>
        </div>
        <div className="metric-tile">
          <p className="text-2xl font-semibold text-black-50">{stats.aiTooLow}</p>
          <p className="mt-1 text-sm text-black-300">AI too harsh</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.05em] text-black-300">
            Agreement by genre
          </h3>
          <div className="mt-2 space-y-2">
            {stats.genreStats.slice(0, 5).map((genre) => (
              <div
                key={genre.genre}
                className="grid grid-cols-[minmax(0,1fr)_5rem_3rem] items-center gap-3 text-sm"
              >
                <span className="truncate text-black-200">{genre.genre}</span>
                <progress
                  className="h-1.5 w-full accent-gold-500"
                  max={100}
                  value={genre.matchRate}
                  aria-label={`${genre.genre} agreement`}
                />
                <span className="text-right text-black-400 tabular-nums">
                  {genre.matchRate.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.05em] text-black-300">
            Biggest disagreements
          </h3>
          {stats.disagreements.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-400">Every recorded verdict matches.</p>
          ) : (
            <div className="mt-2 divide-y divide-black-700">
              {stats.disagreements.slice(0, 4).map((item) => (
                <div
                  key={item.screenplayId}
                  className="py-2 flex items-center justify-between gap-4 text-sm"
                >
                  <span className="truncate text-black-200">{item.screenplayTitle}</span>
                  <span className="shrink-0 text-sm text-black-300">
                    AI {verdictLabel(item.aiVerdict)} · Billy {verdictLabel(item.billyVerdict)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
