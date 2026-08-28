import { Link, useLocation } from 'react-router-dom';
import { useIsAdmin } from '@/stores/authStore';
import { useTranslation } from 'react-i18next';
import './authenticated-navigation.css';

interface AuthenticatedNavigationProps {
  className?: string;
  settingsIssueCount?: number;
}

export function AuthenticatedNavigation({
  className = '',
  settingsIssueCount = 0,
}: AuthenticatedNavigationProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isAdmin = useIsAdmin();

  const isHome = location.pathname === '/';
  const isDiscovery =
    location.pathname.startsWith('/discover') || location.pathname.startsWith('/projects/');
  const isSettings =
    location.pathname.startsWith('/settings') || location.pathname.startsWith('/intake');

  return (
    <nav
      className={`authenticated-navigation ${className}`.trim()}
      aria-label={t('Primary navigation')}
    >
      <Link
        to="/"
        className={`authenticated-navigation__link ${isHome ? 'authenticated-navigation__link--active' : ''}`}
        aria-current={isHome ? 'page' : undefined}
      >
        {t('Intelligence')}
      </Link>
      <Link
        to="/discover"
        className={`authenticated-navigation__link ${isDiscovery ? 'authenticated-navigation__link--active' : ''}`}
        aria-current={isDiscovery ? 'page' : undefined}
      >
        {t('Screenplays')}
      </Link>
      {isAdmin && (
        <Link
          to="/settings?tab=analysis"
          className={`authenticated-navigation__link ${isSettings ? 'authenticated-navigation__link--active' : ''}`}
          aria-current={isSettings ? 'page' : undefined}
        >
          {t('Settings')}
          {settingsIssueCount > 0 && (
            <span
              className="authenticated-navigation__issue-count"
              aria-label={t('{{count}} issue needs attention', { count: settingsIssueCount })}
            >
              {settingsIssueCount}
            </span>
          )}
        </Link>
      )}
    </nav>
  );
}

export default AuthenticatedNavigation;
