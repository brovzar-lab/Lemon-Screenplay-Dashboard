import { Link } from 'react-router-dom';
import { UserMenu } from '@/components/auth';
import { SettingsThemeControl } from '@/components/settings/SettingsThemeControl';
import { AuthenticatedNavigation } from '@/components/layout/AuthenticatedNavigation';
import { SyncStatusIndicator } from '@/components/layout/SyncStatusIndicator';
import { LanguageControl } from '@/components/layout/LanguageControl';
import { useTranslation } from 'react-i18next';
import '@/components/layout/application-header.css';

export function ApplicationHeader() {
  const { t } = useTranslation();

  return (
    <header
      className="application-header"
      data-testid="application-header"
      data-application-shell="lemon"
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

        <AuthenticatedNavigation className="application-header__navigation" />

        <div className="application-header__actions">
          <SyncStatusIndicator />
          <LanguageControl />
          <SettingsThemeControl />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
