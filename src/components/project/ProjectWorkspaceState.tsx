import { ApplicationHeader } from '@/components/layout/ApplicationHeader';
import { useTranslation } from 'react-i18next';
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
  onBack,
  loading = false,
}: ProjectWorkspaceStateProps) {
  const { t } = useTranslation();
  return (
    <div className="discovery-root min-h-screen">
      <ApplicationHeader />
      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <section className="dsc-card mx-auto max-w-3xl p-8 text-center sm:p-12" role={loading ? 'status' : undefined}>
          <p className="dsc-kicker">{t('Project workspace')}</p>
          <h1 className="dsc-display mt-3 text-3xl sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-[var(--dsc-ink-2)]">{message}</p>
          {onBack && (
            <button type="button" onClick={onBack} className="dsc-btn dsc-btn-primary mt-7">
              {t('Return to Discovery')}
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
