import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { UserMenu } from '@/components/auth';
import { DiscoveryFavoritesMenu } from '@/components/discover/DiscoveryFavoritesMenu';
import { DiscoverySearch } from '@/components/discover/DiscoverySearch';
import { LensMenu } from '@/components/filters/LensMenu';
import { SyncStatusIndicator } from '@/components/layout/SyncStatusIndicator';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useThemeStore } from '@/stores/themeStore';
import { AuthenticatedNavigation } from '@/components/layout/AuthenticatedNavigation';
import type { Screenplay } from '@/types';

interface HybridHeaderProps {
  screenplays: Screenplay[];
  shortcutsEnabled: boolean;
  onOpenScreenplay: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
  darkChrome?: boolean;
}

export function HybridHeader({
  screenplays,
  shortcutsEnabled,
  onOpenScreenplay,
  darkChrome = false,
}: HybridHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const isDark = useThemeStore((state) => state.isDark);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => setIsScrolled(!entry.isIntersecting), {
      threshold: 1,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span ref={sentinelRef} className="hybrid-header-sentinel" aria-hidden="true" />
      <header role="banner" className="hybrid-header" data-scrolled={isScrolled ? 'true' : 'false'}>
        <div className="hybrid-header__inner">
          <NavLink to="/" className="hybrid-brand" aria-label="Discovery home">
            <img
              src={isDark || darkChrome ? '/lemon-logo-white.png' : '/lemon-logo-black.png'}
              alt=""
              className="hybrid-brand__mark"
            />
            <span>
              <strong>LEMON</strong>
              <small>Discovery</small>
            </span>
          </NavLink>

          <AuthenticatedNavigation className="hybrid-primary-nav" />

          <DiscoverySearch
            id="hybrid-discovery-search"
            className="hybrid-global-search"
            shortcutsEnabled={shortcutsEnabled}
          />

          <div className="hybrid-header__actions">
            <LensMenu presentation="discovery" triggerLabel="Saved Views" />
            <DiscoveryFavoritesMenu screenplays={screenplays} onOpen={onOpenScreenplay} />
            <span className="hybrid-header__divider" aria-hidden="true" />
            <SyncStatusIndicator />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
    </>
  );
}
