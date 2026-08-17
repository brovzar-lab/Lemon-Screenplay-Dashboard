import { Link, useLocation } from 'react-router-dom';
import { useIsAdmin } from '@/stores/authStore';
import { useTranslation } from 'react-i18next';
import './authenticated-navigation.css';

interface AuthenticatedNavigationProps {
  className?: string;
}

export function AuthenticatedNavigation({ className = '' }: AuthenticatedNavigationProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isAdmin = useIsAdmin();

  const isDiscovery =
    location.pathname === '/' ||
    location.pathname.startsWith('/discover') ||
    location.pathname.startsWith('/projects/');
  const isSettings =
    location.pathname.startsWith('/settings') || location.pathname.startsWith('/intake');

  return (
    <nav
      className={`authenticated-navigation ${className}`.trim()}
      aria-label={t('Primary navigation')}
    >
      <Link
        to="/"
        className={`authenticated-navigation__link ${isDiscovery ? 'authenticated-navigation__link--active' : ''}`}
        aria-current={isDiscovery ? 'page' : undefined}
      >
        {t('Discovery')}
      </Link>
      {isAdmin && (
        <Link
          to="/settings?tab=analysis"
          className={`authenticated-navigation__link ${isSettings ? 'authenticated-navigation__link--active' : ''}`}
          aria-current={isSettings ? 'page' : undefined}
        >
          {t('Settings')}
        </Link>
      )}
    </nav>
  );
}

export default AuthenticatedNavigation;
