import { useState } from 'react';
import { clsx } from 'clsx';
import { DEFAULT_FILTER_STATE, type FilterState, type SortState } from '@/types';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';
import { useLensStore, type LensSnapshot } from '@/stores/lensStore';

function captureFilters(): FilterState {
  const state = useFilterStore.getState();
  const entries = (Object.keys(DEFAULT_FILTER_STATE) as Array<keyof FilterState>).map((key) => [
    key,
    structuredClone(state[key]),
  ]);
  return Object.fromEntries(entries) as unknown as FilterState;
}

function captureSort(): SortState {
  const state = useSortStore.getState();
  return {
    sortConfigs: structuredClone(state.sortConfigs),
    prioritizeFilmNow: state.prioritizeFilmNow,
  };
}

function applyLensSnapshot(snapshot: LensSnapshot): void {
  useFilterStore.getState().applyFilters(structuredClone(snapshot.filters));
  useSortStore.getState().setSortConfigs(structuredClone(snapshot.sort.sortConfigs));
  useSortStore.getState().setPrioritizeFilmNow(snapshot.sort.prioritizeFilmNow);
}

interface LensMenuProps {
  presentation?: 'default' | 'discovery';
}

export function LensMenu({ presentation = 'default' }: LensMenuProps) {
  const isDiscovery = presentation === 'discovery';
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const lenses = useLensStore((state) => state.lenses);
  const activeLensId = useLensStore((state) => state.activeLensId);
  const saveLens = useLensStore((state) => state.saveLens);
  const deleteLens = useLensStore((state) => state.deleteLens);
  const setActiveLens = useLensStore((state) => state.setActiveLens);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    saveLens(trimmedName, { filters: captureFilters(), sort: captureSort() });
    setName('');
  };

  const handleApply = (id: string) => {
    const lens = lenses.find((item) => item.id === id);
    if (!lens) return;
    applyLensSnapshot(lens.snapshot);
    setActiveLens(id);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          'btn btn-secondary shrink-0 text-sm',
          isDiscovery && 'min-h-11 rounded-xl px-4',
          !isDiscovery && 'min-h-[44px]',
        )}
        title="Saved Lenses"
        aria-haspopup="dialog"
      >
        Lenses
        {lenses.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
            {lenses.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={clsx(
            'fixed inset-0 z-[80] flex justify-center',
            isDiscovery
              ? 'items-end bg-black-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4'
              : 'items-center bg-black-950/80 p-4',
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="lenses-title"
          data-presentation={presentation}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className={clsx(
              'w-full max-w-lg bg-black-900',
              isDiscovery
                ? 'overflow-hidden rounded-t-2xl shadow-[var(--shadow-pop)] sm:rounded-2xl dark:border dark:border-black-700'
                : 'rounded-lg border border-black-600 shadow-2xl',
            )}
          >
            <header className={clsx(
              'flex items-center justify-between border-b border-black-700',
              isDiscovery ? 'px-5 py-5 sm:px-6' : 'px-5 py-4',
            )}>
              <div>
                {isDiscovery && (
                  <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold-400">
                    Saved views
                  </p>
                )}
                <h2 id="lenses-title" className={clsx('font-display text-gold-200', isDiscovery ? 'text-2xl' : 'text-xl')}>Lenses</h2>
                <p className={clsx('text-black-400', isDiscovery ? 'mt-1 text-sm' : 'text-xs')}>
                  {isDiscovery
                    ? 'Save the exact search, filters, and ranking you are using.'
                    : 'Saved filters and sorting'}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className={clsx(
                  'text-xl text-black-300',
                  isDiscovery
                    ? 'btn btn-ghost !h-11 !min-h-11 !w-11 !min-w-11 !p-0'
                    : 'h-10 w-10',
                )}
                aria-label="Close Lenses"
              >
                ×
              </button>
            </header>

            <div className={clsx(isDiscovery ? 'p-5 sm:p-6' : 'p-5')}>
              <div className={clsx('flex gap-2', isDiscovery && 'flex-col sm:flex-row')}>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSave();
                  }}
                  className={clsx('input flex-1', isDiscovery && 'min-h-11')}
                  placeholder="Name this view"
                  aria-label="Lens name"
                  maxLength={60}
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className={clsx(
                    'btn btn-primary shrink-0',
                    isDiscovery ? 'min-h-11' : 'min-h-[44px]',
                  )}
                >
                  Save current
                </button>
              </div>

              <div className={clsx(
                'mt-5 max-h-80 overflow-y-auto',
                isDiscovery ? 'space-y-2' : 'divide-y divide-black-700',
              )}>
                {lenses.length === 0 ? (
                  <p className="py-8 text-center text-sm text-black-400">No saved Lenses yet.</p>
                ) : (
                  lenses.map((lens) => (
                    <div
                      key={lens.id}
                      className={clsx(
                        'flex items-center gap-2',
                        isDiscovery && 'rounded-xl bg-black-950 p-1 shadow-sm',
                        !isDiscovery && 'py-2',
                      )}
                    >
                      <button
                        onClick={() => handleApply(lens.id)}
                        className={clsx(
                          'min-w-0 flex-1 px-3 py-2 text-left hover:bg-black-800',
                          isDiscovery
                            ? 'min-h-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400'
                            : 'rounded',
                        )}
                      >
                        <span className="block truncate text-sm text-black-100">{lens.name}</span>
                        <span className="block text-xs text-black-500">
                          {activeLensId === lens.id ? 'Active' : new Date(lens.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteLens(lens.id)}
                        className={clsx(
                          'shrink-0 text-black-400 hover:text-red-400',
                          isDiscovery
                            ? 'h-11 w-11 rounded-lg hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400'
                            : 'h-10 w-10',
                        )}
                        aria-label={`Delete ${lens.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
