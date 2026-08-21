import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { getScreenplayDisplayAuthor, getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import type { Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

interface DiscoveryFavoritesMenuProps {
  screenplays: Screenplay[];
  onOpen: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
}

type FavoriteSelection = 'quick' | string;

export function DiscoveryFavoritesMenu({ screenplays, onOpen }: DiscoveryFavoritesMenuProps) {
  const { t } = useTranslation();
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
      ? t('Quick Favorites')
      : (lists.find((list) => list.id === selectedListId)?.name ?? t('Favorites'));

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

  const handleOpenScreenplay = (screenplay: Screenplay, trigger: HTMLButtonElement) => {
    setIsOpen(false);
    onOpen(screenplay, trigger);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="dsc-btn dsc-btn-ghost shrink-0"
        aria-haspopup="dialog"
      >
        {t('Favorites')}
        {totalSaved > 0 && (
          <span className="dsc-num rounded-full bg-[var(--dsc-accent)] px-2 py-0.5 text-xs font-bold !text-[var(--dsc-on-accent)]">
            {totalSaved}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="dsc-drawer-scrim fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discovery-favorites-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div className="dsc-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden !rounded-b-none sm:!rounded-b-[var(--dsc-radius-card)]">
            <header className="dsc-hairline flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div>
                <p className="dsc-kicker">{t('Saved slate')}</p>
                <h2 id="discovery-favorites-title" className="dsc-display mt-1 text-2xl">
                  {t('Favorites')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="dsc-btn dsc-btn-ghost !h-11 !min-h-11 !w-11 !min-w-11 !p-0 text-xl"
                aria-label={t('Close favorites')}
              >
                ×
              </button>
            </header>

            <div className="grid min-h-0 flex-1 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
              <nav
                aria-label={t('Favorite lists')}
                className="dsc-hairline flex gap-2 overflow-x-auto border-b bg-[var(--dsc-surface-2)] p-3 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-4"
              >
                <button
                  type="button"
                  onClick={() => setSelectedListId('quick')}
                  aria-pressed={selectedListId === 'quick'}
                  className={clsx(
                    'min-h-11 shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ease-out',
                    selectedListId === 'quick'
                      ? 'bg-[var(--dsc-accent-soft)] font-semibold text-[var(--dsc-accent)]'
                      : 'text-[var(--dsc-ink-2)] hover:bg-[var(--dsc-surface-3)] hover:text-[var(--dsc-ink)]',
                  )}
                >
                  {t('Quick Favorites')}
                  <span className="dsc-num ml-2 text-xs opacity-70">{quickFavorites.length}</span>
                </button>
                {lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    aria-pressed={selectedListId === list.id}
                    className={clsx(
                      'min-h-11 shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ease-out',
                      selectedListId === list.id
                        ? 'bg-[var(--dsc-accent-soft)] font-semibold text-[var(--dsc-accent)]'
                        : 'text-[var(--dsc-ink-2)] hover:bg-[var(--dsc-surface-3)] hover:text-[var(--dsc-ink)]',
                    )}
                  >
                    {list.name}
                    <span className="dsc-num ml-2 text-xs opacity-70">
                      {list.screenplayIds.length}
                    </span>
                  </button>
                ))}
              </nav>

              <section
                className="min-h-0 overflow-y-auto p-4 sm:p-6"
                aria-labelledby="favorite-list-title"
              >
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <h3
                      id="favorite-list-title"
                      className="text-lg font-semibold text-[var(--dsc-ink)]"
                    >
                      {selectedName}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--dsc-ink-2)]">
                      {t('{{count}} available screenplay', {
                        count: selectedScreenplays.length,
                      })}
                    </p>
                  </div>
                </div>

                {selectedScreenplays.length === 0 ? (
                  <p className="dsc-well px-4 py-8 text-center text-sm text-[var(--dsc-ink-2)]">
                    {t('No screenplays are saved in this list yet.')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedScreenplays.map((screenplay) => {
                      const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;
                      const displayAuthor = getScreenplayDisplayAuthor(screenplay.author);
                      return (
                        <li key={screenplay.id}>
                          <button
                            type="button"
                            onClick={(event) =>
                              handleOpenScreenplay(screenplay, event.currentTarget)
                            }
                            aria-label={t('Open {{title}} from favorites', {
                              title: displayTitle,
                            })}
                            className="dsc-card dsc-card-hover group flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-[var(--dsc-ink)]">
                                {displayTitle}
                              </span>
                              {(screenplay.genre || displayAuthor) && (
                                <span className="mt-1 block truncate text-xs text-[var(--dsc-ink-3)]">
                                  {[
                                    screenplay.genre && t(screenplay.genre),
                                    displayAuthor && t(displayAuthor),
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              )}
                            </span>
                            <span className="dsc-num shrink-0 text-lg font-semibold">
                              {screenplay.weightedScore.toFixed(1)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
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
