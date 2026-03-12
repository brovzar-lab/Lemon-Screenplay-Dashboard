/**
 * Settings Page
 * Tabbed interface for all application settings
 * Consolidated from 8 → 6 tabs. Upload & Calibration are password-gated.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { UploadPanel } from '@/components/settings/UploadPanel';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { FavoritesPanel } from '@/components/settings/FavoritesPanel';
import { DataManagement } from '@/components/settings/DataManagement';
import { CategoryManagement } from '@/components/settings/CategoryManagement';
import { ModelComparisonPanel } from '@/components/settings/ModelComparisonPanel';
import { CalibrationPanel } from '@/components/settings/CalibrationPanel';
import { PdfUploadPanel } from '@/components/settings/PdfUploadPanel';
import { SettingsPasswordGate } from '@/components/settings/SettingsPasswordGate';

type Tab = 'appearance' | 'upload' | 'favorites' | 'data' | 'calibration' | 'pdf';

interface TabConfig {
  id: Tab;
  label: string;
  locked?: boolean;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    id: 'upload',
    label: 'Upload',
    locked: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: 'favorites',
    label: 'Favorites',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    id: 'data',
    label: 'Data',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
  {
    id: 'calibration',
    label: 'Calibration',
    locked: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: 'pdf',
    label: 'PDF Files',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

/** Data tab content — includes exports AND model comparison as a sub-section */
function DataTab() {
  const [showCompare, setShowCompare] = useState(false);

  return (
    <div className="space-y-8">
      <DataManagement />

      {/* Model Comparison — collapsible sub-section */}
      <div className="border-t border-gold-500/10 pt-6">
        <button
          onClick={() => setShowCompare((v) => !v)}
          className="flex items-center gap-3 w-full text-left group"
        >
          <svg className="w-5 h-5 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="font-display text-gold-200 text-lg">Model Comparison</span>
          <svg
            className={clsx('w-4 h-4 text-black-400 ml-auto transition-transform', showCompare && 'rotate-180')}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <p className="text-sm text-black-500 mt-1 ml-8">Compare analysis results across different AI models</p>

        {showCompare && (
          <div className="mt-6">
            <ModelComparisonPanel />
          </div>
        )}
      </div>
    </div>
  );
}

/** Upload tab content — includes upload panel + categories as a sub-section */
function UploadTab() {
  return (
    <div className="space-y-8">
      <UploadPanel />

      {/* Categories — sub-section */}
      <div className="border-t border-gold-500/10 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-5 h-5 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="font-display text-gold-200 text-lg">Categories</span>
        </div>
        <CategoryManagement />
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('appearance');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceSettings />;
      case 'upload':
        return (
          <SettingsPasswordGate label="Upload" key="upload-gate">
            <UploadTab />
          </SettingsPasswordGate>
        );
      case 'favorites':
        return <FavoritesPanel />;
      case 'data':
        return <DataTab />;
      case 'calibration':
        return (
          <SettingsPasswordGate label="Calibration" key="calibration-gate">
            <CalibrationPanel />
          </SettingsPasswordGate>
        );
      case 'pdf':
        return <PdfUploadPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gold-500/20 bg-black-900/50 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gold-400 hover:text-gold-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <h1 className="text-xl font-display text-gold-200">Settings</h1>
          <div className="w-32" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar Tabs */}
          <aside className="w-48 shrink-0">
            <nav className="sticky top-8 space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all',
                    activeTab === tab.id
                      ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                      : 'text-black-300 hover:bg-black-800/50 hover:text-gold-200'
                  )}
                >
                  {tab.icon}
                  <span className="font-medium flex-1">{tab.label}</span>
                  {tab.locked && (
                    <svg className="w-3.5 h-3.5 text-black-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Tab Content */}
          <div className="flex-1 min-w-0">
            <div className="glass rounded-xl p-6 border border-gold-500/10">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gold-500/10 py-4">
        <div className="max-w-[1400px] mx-auto px-6 text-center text-sm text-black-500">
          <p>Lemon Screenplay Dashboard v{__APP_VERSION__}</p>
        </div>
      </footer>
    </div>
  );
}

export default SettingsPage;
