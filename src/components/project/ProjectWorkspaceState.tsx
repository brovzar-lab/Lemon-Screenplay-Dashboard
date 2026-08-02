import { DiscoverAppHeader } from '@/components/discover/DiscoverAppHeader';
import type { ProjectWorkspaceStats } from '@/components/project/ProjectWorkspace';

interface ProjectWorkspaceStateProps {
  title: string;
  message: string;
  stats: ProjectWorkspaceStats;
  onBack?: () => void;
  loading?: boolean;
}
export function ProjectWorkspaceState({
  title,
  message,
  stats,
  onBack,
  loading = false,
}: ProjectWorkspaceStateProps) {
  return (
    <div className="discovery-root min-h-screen">
      <DiscoverAppHeader
        total={stats.total}
        averageScore={stats.avgWeightedScore}
        filmNowCount={stats.filmNowCount}
        isLoading={loading}
      />
      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <section className="dsc-card mx-auto max-w-3xl p-8 text-center sm:p-12" role={loading ? 'status' : undefined}>
          <p className="dsc-kicker">Project workspace</p>
          <h1 className="dsc-display mt-3 text-3xl sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-[var(--dsc-ink-2)]">{message}</p>
          {onBack && (
            <button type="button" onClick={onBack} className="dsc-btn dsc-btn-primary mt-7">
              Return to Discovery
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
