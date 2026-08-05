import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { UserMenu } from '@/components/auth';
import { DiscoveryFavoritesMenu } from '@/components/discover/DiscoveryFavoritesMenu';
import { LensMenu } from '@/components/filters/LensMenu';
import { SyncStatusIndicator } from '@/components/layout/SyncStatusIndicator';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useIsAdmin } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { useThemeStore } from '@/stores/themeStore';
import type { Screenplay } from '@/types';

interface HybridHeaderProps {
  screenplays: Screenplay[];
  shortcutsEnabled: boolean;
  onOpenScreenplay: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
}

export function HybridHeader({
  screenplays,
  shortcutsEnabled,
  onOpenScreenplay,
}: HybridHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = useIsAdmin();
  const isDark = useThemeStore((state) => state.isDark);
  const searchQuery = useFilterStore((state) => state.searchQuery);
  const setSearchQuery = useFilterStore((state) => state.setSearchQuery);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { threshold: 1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shortcutsEnabled) return;

    const handleSlash = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
    };

    document.addEventListener('keydown', handleSlash);
    return () => document.removeEventListener('keydown', handleSlash);
  }, [shortcutsEnabled]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `hybrid-nav-link ${isActive ? 'hybrid-nav-link--active' : ''}`;

  return (
    <>
      <span ref={sentinelRef} className="hybrid-header-sentinel" aria-hidden="true" />
      <header
        role="banner"
        className="hybrid-header"
        data-scrolled={isScrolled ? 'true' : 'false'}
      >
        <div className="hybrid-header__inner">
          <NavLink to="/discover?ui=hybrid" className="hybrid-brand" aria-label="Discovery home">
            <img
              src={isDark ? '/lemon-logo-white.png' : '/lemon-logo-black.png'}
              alt=""
              className="hybrid-brand__mark"
            />
            <span>
              <strong>LEMON</strong>
              <small>Discovery</small>
            </span>
          </NavLink>

          <nav className="hybrid-primary-nav" aria-label="Discovery navigation">
            <NavLink to="/discover?ui=hybrid" end={false} className={navClass}>
              Discover
            </NavLink>
            {isAdmin && (
              <NavLink to="/intake" className={navClass}>
                Intake
              </NavLink>
            )}
          </nav>

          <label className="hybrid-global-search" htmlFor="hybrid-discovery-search">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              ref={searchInputRef}
              id="hybrid-discovery-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search screenplays, writers, themes"
              aria-label="Discovery search"
            />
            <kbd aria-label="Keyboard shortcut slash">/</kbd>
          </label>

          <div className="hybrid-header__actions">
            <LensMenu presentation="discovery" triggerLabel="Saved Views" />
            <DiscoveryFavoritesMenu
              screenplays={screenplays}
              onOpen={onOpenScreenplay}
            />
            <span className="hybrid-header__divider" aria-hidden="true" />
            {isAdmin && (
              <NavLink
                to="/settings"
                className="hybrid-icon-link"
                aria-label="Settings"
                title="Settings"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
                </svg>
              </NavLink>
            )}
            <SyncStatusIndicator />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
    </>
  );
}
