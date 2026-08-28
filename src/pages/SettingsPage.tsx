import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { UploadPanel } from '@/components/settings/UploadPanel';
import { DataManagement } from '@/components/settings/DataManagement';
import { CategoryManagement } from '@/components/settings/CategoryManagement';
import { ModelComparisonPanel } from '@/components/settings/ModelComparisonPanel';
import { CalibrationPanel } from '@/components/settings/CalibrationPanel';
import { PdfUploadPanel } from '@/components/settings/PdfUploadPanel';
import { SharedLinksPanel } from '@/components/settings/SharedLinksPanel';
import { FavoritesPanel } from '@/components/settings/FavoritesPanel';
import { AnalysisOverview } from '@/components/settings/AnalysisOverview';
import { SystemStatusPanel } from '@/components/settings/SystemStatusPanel';
import { FeaturedProjectPanel } from '@/components/settings/FeaturedProjectPanel';
import { ApplicationHeader } from '@/components/layout/ApplicationHeader';
import '@/components/discover/discovery.css';
import '@/pages/settings-page.css';
import { useTranslation } from 'react-i18next';

type Tab = 'intake' | 'featured' | 'analysis' | 'compare' | 'calibration' | 'pdf' | 'data' | 'api';
type GroupLabel = 'Workflow' | 'Intelligence' | 'Library' | 'System';

interface TabConfig {
  id: Tab;
  label: string;
  description: string;
  group: GroupLabel;
}

const TABS: TabConfig[] = [
  {
    id: 'analysis',
    label: 'Analysis Health',
    description: 'Reader coverage and system readiness',
    group: 'Intelligence',
  },
  {
    id: 'compare',
    label: 'Model Comparison',
    description: 'Compare available analysis models',
    group: 'Intelligence',
  },
  {
    id: 'intake',
    label: 'Screenplay Upload System',
    description: 'Verify, route, and follow new material',
    group: 'Workflow',
  },
  {
    id: 'featured',
    label: 'Featured Project',
    description: 'Choose what deserves attention today',
    group: 'Workflow',
  },
  {
    id: 'pdf',
    label: 'Screenplays',
    description: 'Source screenplay availability',
    group: 'Library',
  },
  {
    id: 'data',
    label: 'Data & Sharing',
    description: 'Exports, links, and favorites',
    group: 'Library',
  },
  {
    id: 'api',
    label: 'System Status',
    description: 'Services, cost protection, and health',
    group: 'System',
  },
  {
    id: 'calibration',
    label: 'Calibration',
    description: 'Producer evidence and benchmarks',
    group: 'System',
  },
];

const GROUPS: GroupLabel[] = ['Intelligence', 'Workflow', 'Library', 'System'];

function normalizeTab(value: string | null): Tab {
  const normalized = value?.trim().toLowerCase().replaceAll('_', '-');
  const aliases: Record<string, Tab> = {
    upload: 'intake',
    uploads: 'intake',
    featured: 'featured',
    'featured-project': 'featured',
    health: 'analysis',
    'analysis-health': 'analysis',
    models: 'compare',
    'model-comparison': 'compare',
    'taste-calibration': 'calibration',
    files: 'pdf',
    'pdf-files': 'pdf',
    sharing: 'data',
    'data-sharing': 'data',
    connections: 'api',
    keys: 'api',
    'api-settings': 'api',
  };
  if (normalized && aliases[normalized]) return aliases[normalized];
  return TABS.some((tab) => tab.id === normalized) ? (normalized as Tab) : 'intake';
}

function SettingsIcon({ tab }: { tab: Tab }) {
  const paths: Record<Tab, string> = {
    intake: 'M12 3v12m0-12 4 4m-4-4L8 7M5 14v5h14v-5',
    featured: 'M12 3l2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9L12 3Z',
    analysis: 'M4 19V9m5 10V5m5 14v-7m5 7V3',
    compare: 'M4 7h10M4 12h16M10 17h10',
    calibration:
      'M12 3v3m0 12v3M3 12h3m12 0h3M7.1 7.1l2.1 2.1m5.6 5.6 2.1 2.1m0-9.8-2.1 2.1m-5.6 5.6-2.1 2.1',
    pdf: 'M7 3h7l4 4v14H7zM14 3v5h4M9 13h6m-6 4h6',
    data: 'M5 7c0 1.7 3.1 3 7 3s7-1.3 7-3-3.1-3-7-3-7 1.3-7 3Zm0 0v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7m-14 5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5',
    api: 'M14 7a4 4 0 1 1-2.8 6.8L8 17H5v3H2v-3l5.2-5.2A4 4 0 0 1 14 7Z',
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={paths[tab]} />
    </svg>
  );
}

function SectionFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-subsection">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function DataTab() {
  const { t } = useTranslation();
  return (
    <div className="settings-section-stack">
      <DataManagement />
      <SectionFrame title={t('Shared links')}>
        <div id="shared-links" className="scroll-mt-8">
          <SharedLinksPanel />
        </div>
      </SectionFrame>
      <section className="settings-subsection">
        <FavoritesPanel />
      </section>
    </div>
  );
}

function IntakeTab({ onOpenAnalysis }: { onOpenAnalysis: (projectId: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="settings-section-stack">
      <div className="settings-intake-intro">
        <div>
          <p className="settings-eyebrow">{t('New material')}</p>
          <h3>{t('Bring a screenplay into the slate')}</h3>
          <p>
            {t(
              'Adding files is free. Duplicate protection and routing happen before the confirmation that starts analysis.',
            )}
          </p>
        </div>
        <ol aria-label={t('Intake stages')}>
          <li>
            <strong>01</strong>
            <span>{t('File verified')}</span>
          </li>
          <li>
            <strong>02</strong>
            <span>{t('Readers working')}</span>
          </li>
          <li>
            <strong>03</strong>
            <span>{t('Slate ready')}</span>
          </li>
        </ol>
      </div>
      <UploadPanel presentation="intake" initialModel="hybrid" onOpenAnalysis={onOpenAnalysis} />
      <section className="settings-subsection">
        <CategoryManagement />
      </section>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get('tab'));
  const activeConfig = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  const setActiveTab = (tab: Tab) => setSearchParams({ tab });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'intake':
        return (
          <IntakeTab
            onOpenAnalysis={(projectId) => navigate(`/discover/${encodeURIComponent(projectId)}`)}
          />
        );
      case 'analysis':
        return <AnalysisOverview />;
      case 'featured':
        return <FeaturedProjectPanel />;
      case 'compare':
        return <ModelComparisonPanel />;
      case 'calibration':
        return <CalibrationPanel />;
      case 'pdf':
        return <PdfUploadPanel />;
      case 'data':
        return <DataTab />;
      case 'api':
        return <SystemStatusPanel />;
    }
  };

  return (
    <div className="settings-page">
      <ApplicationHeader />

      <main className="settings-main">
        <label className="settings-mobile-picker" htmlFor="settings-section-picker">
          <span>{t('Settings section')}</span>
          <select
            id="settings-section-picker"
            value={activeTab}
            onChange={(event) => setActiveTab(event.target.value as Tab)}
          >
            {GROUPS.map((group) => (
              <optgroup key={group} label={t(group)}>
                {TABS.filter((tab) => tab.group === group).map((tab) => (
                  <option key={tab.id} value={tab.id}>{t(tab.label)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <aside className="settings-sidebar">
          <nav aria-label={t('Settings sections')}>
            {GROUPS.map((group) => (
              <div key={group} className="settings-nav-group">
                <h2>{t(group)}</h2>
                {TABS.filter((tab) => tab.group === group).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-label={t(tab.label)}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    className={clsx('settings-nav-item', activeTab === tab.id && 'is-active')}
                  >
                    <SettingsIcon tab={tab.id} />
                    <span>
                      <strong>{t(tab.label)}</strong>
                      <small>{t(tab.description)}</small>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <section className="settings-workspace" aria-labelledby="settings-section-title">
          <header className="settings-workspace__heading">
            <p className="settings-eyebrow">
              {t('Administration')} · {t(activeConfig.group)}
            </p>
            <h1 id="settings-section-title">{t(activeConfig.label)}</h1>
            <p>{t(activeConfig.description)}</p>
          </header>
          <div className="settings-panel">{renderTabContent()}</div>
        </section>
      </main>

      <footer className="settings-footer">Lemon Screenplay Dashboard v{__APP_VERSION__}</footer>
    </div>
  );
}

export default SettingsPage;
