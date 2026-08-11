import { useEffect, useRef } from 'react';
import { useFilterStore } from '@/stores/filterStore';

interface DiscoverySearchProps {
  id: string;
  className: string;
  shortcutsEnabled: boolean;
}

export function DiscoverySearch({ id, className, shortcutsEnabled }: DiscoverySearchProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchQuery = useFilterStore((state) => state.searchQuery);
  const setSearchQuery = useFilterStore((state) => state.setSearchQuery);

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

  return (
    <label className={className} htmlFor={id}>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <input
        ref={searchInputRef}
        id={id}
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search screenplays, writers, themes"
        aria-label="Discovery search"
      />
      <kbd aria-label="Keyboard shortcut slash">/</kbd>
    </label>
  );
}
