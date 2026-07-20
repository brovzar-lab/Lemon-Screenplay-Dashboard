import { useState } from 'react';
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

export function LensMenu() {
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
        className="btn btn-secondary text-sm shrink-0 min-h-[44px]"
        title="Saved Lenses"
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
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lenses-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-lg border border-black-600 bg-black-900 shadow-2xl">
            <header className="flex items-center justify-between border-b border-black-700 px-5 py-4">
              <div>
                <h2 id="lenses-title" className="font-display text-xl text-gold-200">Lenses</h2>
                <p className="text-xs text-black-400">Saved filters and sorting</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 text-xl text-black-300"
                aria-label="Close Lenses"
              >
                ×
              </button>
            </header>

            <div className="p-5">
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSave();
                  }}
                  className="input flex-1"
                  placeholder="Name this view"
                  aria-label="Lens name"
                  maxLength={60}
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="btn btn-primary min-h-[44px]"
                >
                  Save current
                </button>
              </div>

              <div className="mt-5 max-h-80 overflow-y-auto divide-y divide-black-700">
                {lenses.length === 0 ? (
                  <p className="py-8 text-center text-sm text-black-400">No saved Lenses yet.</p>
                ) : (
                  lenses.map((lens) => (
                    <div key={lens.id} className="flex items-center gap-2 py-2">
                      <button
                        onClick={() => handleApply(lens.id)}
                        className="min-w-0 flex-1 px-3 py-2 text-left rounded hover:bg-black-800"
                      >
                        <span className="block truncate text-sm text-black-100">{lens.name}</span>
                        <span className="block text-xs text-black-500">
                          {activeLensId === lens.id ? 'Active' : new Date(lens.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteLens(lens.id)}
                        className="w-10 h-10 text-black-400 hover:text-red-400"
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
