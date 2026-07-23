import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useFavoritesStore } from '@/stores/favoritesStore';
import type { Screenplay } from '@/types';

interface DiscoveryFavoritesMenuProps {
  screenplays: Screenplay[];
  onOpen: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
}

type FavoriteSelection = 'quick' | string;

export function DiscoveryFavoritesMenu({
  screenplays,
  onOpen,
}: DiscoveryFavoritesMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<FavoriteSelection>('quick');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lists = useFavoritesStore((state) => state.lists ?? []);
  const quickFavorites = useFavoritesStore((state) => state.quickFavorites ?? []);

  const totalSaved = useMemo(
    () => new Set([...quickFavorites, ...lists.flatMap((list) => list.screenplayIds)]).size,
    [lists, quickFavorites],
  );
  const selectedIds = useMemo(
    () =>
      selectedListId === 'quick'
        ? quickFavorites
        : (lists.find((list) => list.id === selectedListId)?.screenplayIds ?? []),
    [lists, quickFavorites, selectedListId],
  );
  const selectedScreenplays = useMemo(() => {
    const byId = new Map(screenplays.map((screenplay) => [screenplay.id, screenplay]));
    return selectedIds.flatMap((id) => {
      const screenplay = byId.get(id);
      return screenplay ? [screenplay] : [];
    });
  }, [screenplays, selectedIds]);
  const selectedName =
    selectedListId === 'quick'
      ? 'Quick Favorites'
      : (lists.find((list) => list.id === selectedListId)?.name ?? 'Favorites');

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleOpenScreenplay = (screenplay: Screenplay) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setIsOpen(false);
    onOpen(screenplay, trigger);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary min-h-11 shrink-0 text-sm"
        aria-haspopup="dialog"
      >
        Favorites
        {totalSaved > 0 && (
          <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-bold text-gold-400">
            {totalSaved}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discovery-favorites-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-black-900 shadow-xl sm:rounded-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-black-700 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold-400">
                  Saved slate
                </p>
                <h2 id="discovery-favorites-title" className="mt-1 font-display text-2xl text-black-50">
                  Favorites
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-ghost !h-11 !min-h-11 !w-11 !min-w-11 !p-0 text-xl"
                aria-label="Close favorites"
              >
                ×
              </button>
            </header>

            <div className="grid min-h-0 flex-1 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
              <nav
                aria-label="Favorite lists"
                className="flex gap-2 overflow-x-auto border-b border-black-700 bg-black-950 p-3 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-4"
              >
                <button
                  type="button"
                  onClick={() => setSelectedListId('quick')}
                  aria-pressed={selectedListId === 'quick'}
                  className={clsx(
                    'min-h-11 shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    selectedListId === 'quick'
                      ? 'bg-gold-500/15 font-semibold text-gold-400'
                      : 'text-black-300 hover:bg-black-800 hover:text-black-50',
                  )}
                >
                  Quick Favorites
                  <span className="ml-2 text-xs text-black-500">{quickFavorites.length}</span>
                </button>
                {lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    aria-pressed={selectedListId === list.id}
                    className={clsx(
                      'min-h-11 shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      selectedListId === list.id
                        ? 'bg-gold-500/15 font-semibold text-gold-400'
                        : 'text-black-300 hover:bg-black-800 hover:text-black-50',
                    )}
                  >
                    {list.name}
                    <span className="ml-2 text-xs text-black-500">{list.screenplayIds.length}</span>
                  </button>
                ))}
              </nav>

              <section className="min-h-0 overflow-y-auto p-4 sm:p-6" aria-labelledby="favorite-list-title">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <h3 id="favorite-list-title" className="text-lg font-semibold text-black-50">
                      {selectedName}
                    </h3>
                    <p className="mt-1 text-sm text-black-400">
                      {selectedScreenplays.length} available screenplay{selectedScreenplays.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {selectedScreenplays.length === 0 ? (
                  <p className="rounded-xl bg-black-800 px-4 py-8 text-center text-sm text-black-400">
                    No screenplays are saved in this list yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedScreenplays.map((screenplay) => (
                      <li key={screenplay.id}>
                        <button
                          type="button"
                          onClick={() => handleOpenScreenplay(screenplay)}
                          aria-label={`Open ${screenplay.title} from favorites`}
                          className="group flex min-h-16 w-full items-center justify-between gap-4 rounded-xl bg-black-950 px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-black-50">
                              {screenplay.title}
                            </span>
                            <span className="mt-1 block truncate text-xs text-black-400">
                              {screenplay.genre} · {screenplay.author || 'Unknown writer'}
                            </span>
                          </span>
                          <span className="shrink-0 text-lg font-semibold tabular-nums text-black-50">
                            {screenplay.weightedScore.toFixed(1)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
