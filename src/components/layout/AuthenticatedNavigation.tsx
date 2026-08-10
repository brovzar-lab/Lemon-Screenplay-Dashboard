import { Link, useLocation } from 'react-router-dom';
import { useIsAdmin } from '@/stores/authStore';
import './authenticated-navigation.css';

interface AuthenticatedNavigationProps {
  className?: string;
}

export function AuthenticatedNavigation({ className = '' }: AuthenticatedNavigationProps) {
  const location = useLocation();
  const isAdmin = useIsAdmin();

  const isDashboard = location.pathname === '/';
  const isDiscovery =
    location.pathname.startsWith('/discover') || location.pathname.startsWith('/projects/');
  const isSettings =
    location.pathname.startsWith('/settings') || location.pathname.startsWith('/intake');

  return (
    <nav
      className={`authenticated-navigation ${className}`.trim()}
      aria-label="Primary navigation"
    >
      <Link
        to="/"
        className={`authenticated-navigation__link ${isDashboard ? 'authenticated-navigation__link--active' : ''}`}
        aria-current={isDashboard ? 'page' : undefined}
      >
        Dashboard
      </Link>
      <Link
        to="/discover?ui=screenplay"
        className={`authenticated-navigation__link ${isDiscovery ? 'authenticated-navigation__link--active' : ''}`}
        aria-current={isDiscovery ? 'page' : undefined}
      >
        Discover
      </Link>
      {isAdmin && (
        <Link
          to="/settings?tab=analysis"
          className={`authenticated-navigation__link ${isSettings ? 'authenticated-navigation__link--active' : ''}`}
          aria-current={isSettings ? 'page' : undefined}
        >
          Settings
        </Link>
      )}
    </nav>
  );
}

export default AuthenticatedNavigation;
