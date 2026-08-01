import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DiscoverAppHeader } from '@/components/discover/DiscoverAppHeader';
import { UploadPanel } from '@/components/settings/UploadPanel';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import { getScreenplayStats } from '@/lib/api';
import '@/components/discover/discovery.css';

function IntakePage() {
  const navigate = useNavigate();
  const { data: screenplays = [], isLoading } = useScreenplays();

  useLiveScreenplaySync();

  const stats = useMemo(() => getScreenplayStats(screenplays), [screenplays]);

  return (
    <div className="discovery-root min-h-screen">
      <DiscoverAppHeader
        total={stats.total}
        averageScore={stats.avgWeightedScore}
        filmNowCount={stats.filmNowCount}
        isLoading={isLoading}
        sectionTitle="Intake Desk"
      />

      <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-[1800px]">
          <section className="mb-8 grid gap-6 border-b border-[var(--dsc-line)] pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.7fr)] lg:items-end">
            <div>
              <p className="dsc-kicker">Lemon Studios · New material</p>
              <h1 className="dsc-display mt-3 text-5xl leading-none sm:text-6xl lg:text-7xl">
                Intake
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--dsc-ink-2)] sm:text-lg">
                Bring a screenplay into the slate, verify its identity, and follow it until
                the complete five-reader analysis is ready to open.
              </p>
            </div>

            <ol className="grid grid-cols-3 overflow-hidden rounded-[var(--dsc-radius-card)] border border-[var(--dsc-line)] bg-[var(--dsc-surface)] shadow-[var(--dsc-shadow-card)]" aria-label="Intake stages">
              {[
                ['01', 'File verified'],
                ['02', 'Readers working'],
                ['03', 'Slate ready'],
              ].map(([number, label], index) => (
                <li
                  key={number}
                  className={`min-w-0 px-4 py-4 sm:px-5 ${index > 0 ? 'border-l border-[var(--dsc-line)]' : ''}`}
                >
                  <span className="block font-mono text-xs font-semibold tracking-[0.15em] text-[var(--dsc-accent)]">
                    {number}
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-[var(--dsc-ink)]">
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <UploadPanel
            presentation="intake"
            initialModel="hybrid"
            onOpenAnalysis={(projectId) => navigate(`/discover/${encodeURIComponent(projectId)}`)}
          />
        </div>
      </main>
    </div>
  );
}

export default IntakePage;
