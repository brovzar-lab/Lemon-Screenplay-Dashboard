import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserMenu } from '@/components/auth';
import { SettingsThemeControl } from '@/components/settings/SettingsThemeControl';
import { AuthenticatedNavigation } from '@/components/layout/AuthenticatedNavigation';
import { SyncStatusIndicator } from '@/components/layout/SyncStatusIndicator';
import { LanguageControl } from '@/components/layout/LanguageControl';
import { useTranslation } from 'react-i18next';
import '@/components/layout/application-header.css';

interface ApplicationHeaderProps {
  settingsIssueCount?: number;
}

export function ApplicationHeader({ settingsIssueCount = 0 }: ApplicationHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const locationKey = `${location.pathname}${location.search}`;
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const isMenuOpen = openMenuPath === locationKey;

  return (
    <header
      className={`application-header ${isMenuOpen ? 'is-menu-open' : ''}`}
      data-testid="application-header"
      data-application-shell="lemon"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpenMenuPath(null);
      }}
    >
      <div className="application-header__inner">
        <Link
          to="/"
          className="application-header__brand"
          aria-label={t('Lemon Screenplay Dashboard home')}
        >
          <img src="/lemon-logo-white.png" alt="" />
          <span>
            <strong>LEMON</strong>
            <small>Screenplay Dashboard</small>
          </span>
        </Link>

        <button
          type="button"
          className="application-header__menu-toggle"
          aria-expanded={isMenuOpen}
          aria-controls="application-header-menu"
          aria-label={t(
            isMenuOpen ? 'Close navigation and preferences' : 'Open navigation and preferences',
          )}
          onClick={() => setOpenMenuPath(isMenuOpen ? null : locationKey)}
        >
          <span />
          <span />
          <span />
        </button>

        <div id="application-header-menu" className="application-header__menu">
          <AuthenticatedNavigation
            className="application-header__navigation"
            settingsIssueCount={settingsIssueCount}
          />

          <div className="application-header__actions">
            <SyncStatusIndicator />
            <div className="application-header__preferences">
              <LanguageControl />
              <span className="application-header__divider" aria-hidden="true" />
              <span
                className="application-header__system-name"
                aria-label={`${t('Design system')}: Instrument`}
              >
                Instrument
              </span>
              <span className="application-header__divider" aria-hidden="true" />
              <SettingsThemeControl />
            </div>
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
