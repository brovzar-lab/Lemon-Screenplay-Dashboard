/**
 * AddToFavoritesModal
 * Adds all selected screenplays to a chosen favorites list.
 * Shows Quick Favorites as default option, plus any user-created lists.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useToastStore } from '@/stores/toastStore';

interface AddToFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  presentation?: 'default' | 'discovery';
}

export function AddToFavoritesModal({
  isOpen,
  onClose,
  presentation = 'default',
}: AddToFavoritesModalProps) {
  const isDiscovery = presentation === 'discovery';
  const [selectedList, setSelectedList] = useState<string>('quick');
  const lists = useFavoritesStore((s) => s.lists);
  const selectedIds = useSelectionStore((s) => s.selectedIds);

  if (!isOpen) return null;

  const handleApply = () => {
    const ids = Array.from(selectedIds);
    if (selectedList === 'quick') {
      for (const id of ids) {
        if (!useFavoritesStore.getState().isQuickFavorite(id)) {
          useFavoritesStore.getState().toggleQuickFavorite(id);
        }
      }
      useToastStore.getState().addToast(
        `Added ${ids.length} to Quick Favorites`,
        'success'
      );
    } else {
      for (const id of ids) {
        useFavoritesStore.getState().addToList(selectedList, id);
      }
      const listName = useFavoritesStore.getState().lists.find((l) => l.id === selectedList)?.name || 'list';
      useToastStore.getState().addToast(
        `Added ${ids.length} to ${listName}`,
        'success'
      );
    }
    onClose();
  };

  return (
    <div className={clsx(
      'fixed inset-0 z-50 flex justify-center',
      isDiscovery ? 'items-end p-0 sm:items-center sm:p-4' : 'items-center p-4',
    )}>
      <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" onClick={onClose} />
      <div
        data-testid="add-to-favorites-surface"
        data-presentation={presentation}
        className={clsx(
          'relative w-full max-w-md overflow-hidden animate-scale-in',
          isDiscovery
            ? 'rounded-t-2xl bg-black-900 shadow-[var(--shadow-pop)] sm:rounded-2xl dark:border dark:border-black-700'
            : 'glass rounded-xl border border-gold-500/20',
        )}
      >
        {/* Header */}
        <div className={clsx('px-6 py-4', isDiscovery && 'border-b border-black-700 py-5')}>
          {isDiscovery && (
            <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold-400">
              Save selection
            </p>
          )}
          <h3 className={clsx('font-heading font-semibold text-gold-200', isDiscovery ? 'text-xl' : 'text-lg')}>
            Add to Favorites
          </h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          {/* Quick Favorites row */}
          <div
            onClick={() => setSelectedList('quick')}
            className={clsx(
              'flex items-center gap-3 p-3 cursor-pointer transition-colors',
              isDiscovery ? 'min-h-14 rounded-xl' : 'rounded-lg border',
              selectedList === 'quick'
                ? isDiscovery
                  ? 'bg-gold-500/10 ring-2 ring-gold-500/40'
                  : 'border-gold-500/30 bg-gold-500/10'
                : isDiscovery
                  ? 'bg-black-950 hover:bg-black-800'
                  : 'border-black-700 bg-black-800/50 hover:border-black-600',
            )}
          >
            <input
              type="radio"
              name="favorites-list"
              value="quick"
              checked={selectedList === 'quick'}
              onChange={() => setSelectedList('quick')}
              className="sr-only"
            />
            <svg className="w-5 h-5 text-gold-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-sm text-gold-200 flex-1">Quick Favorites</span>
            <div className={`w-4 h-4 rounded-full ${selectedList === 'quick' ? 'bg-gold-500' : 'bg-black-600'}`} />
          </div>

          {/* Named lists */}
          {lists.map((list) => (
            <div
              key={list.id}
              onClick={() => setSelectedList(list.id)}
              className={clsx(
                'flex items-center gap-3 p-3 cursor-pointer transition-colors',
                isDiscovery ? 'min-h-14 rounded-xl' : 'rounded-lg border',
                selectedList === list.id
                  ? isDiscovery
                    ? 'bg-gold-500/10 ring-2 ring-gold-500/40'
                    : 'border-gold-500/30 bg-gold-500/10'
                  : isDiscovery
                    ? 'bg-black-950 hover:bg-black-800'
                    : 'border-black-700 bg-black-800/50 hover:border-black-600',
              )}
            >
              <input
                type="radio"
                name="favorites-list"
                value={list.id}
                checked={selectedList === list.id}
                onChange={() => setSelectedList(list.id)}
                className="sr-only"
              />
              <span className="text-sm text-black-200 flex-1">{list.name}</span>
              <div className={`w-4 h-4 rounded-full ${selectedList === list.id ? 'bg-gold-500' : 'bg-black-600'}`} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={clsx('flex justify-end gap-3 px-6 py-4', isDiscovery && 'border-t border-black-700')}>
          <button onClick={onClose} className="btn btn-ghost text-sm">
            Keep Favorites
          </button>
          <button onClick={handleApply} className="btn btn-primary text-sm">
            Add to Favorites
          </button>
        </div>
      </div>
    </div>
  );
}
