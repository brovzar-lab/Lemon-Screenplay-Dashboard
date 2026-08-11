import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserMenu } from '@/components/auth';
import { SettingsThemeControl } from '@/components/settings/SettingsThemeControl';
import { AuthenticatedNavigation } from '@/components/layout/AuthenticatedNavigation';
import { SyncStatusIndicator } from '@/components/layout/SyncStatusIndicator';
import { useThemeStore } from '@/stores/themeStore';
import '@/components/layout/application-header.css';

export function ApplicationHeader() {
  const setDesignSystem = useThemeStore((state) => state.setDesignSystem);

  useEffect(() => {
    setDesignSystem('instrument');
  }, [setDesignSystem]);

  return (
    <header
      className="application-header"
      data-testid="application-header"
      data-application-shell="lemon"
    >
      <div className="application-header__inner">
        <Link to="/" className="application-header__brand" aria-label="Discovery home">
          <img src="/lemon-logo-white.png" alt="" />
          <span>
            <strong>LEMON</strong>
            <small>Discovery</small>
          </span>
        </Link>

        <AuthenticatedNavigation className="application-header__navigation" />

        <div className="application-header__actions">
          <SyncStatusIndicator />
          <SettingsThemeControl />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
