/**
 * CollectionTabs Component
 * Quick navigation between screenplay collections
 */

import type { Collection } from '@/types';
import { useFilterStore } from '@/stores/filterStore';
import type { Screenplay } from '@/types';

interface CollectionTabsProps {
  screenplays: Screenplay[];
}

// Collection configuration
const COLLECTIONS: { id: Collection | 'all'; label: string; shortLabel: string }[] = [
  { id: 'all', label: 'All Collections', shortLabel: 'All' },
  { id: '2005 Black List', label: '2005 Black List', shortLabel: '2005' },
  { id: '2006 Black List', label: '2006 Black List', shortLabel: '2006' },
  { id: '2007 Black List', label: '2007 Black List', shortLabel: '2007' },
  { id: '2020 Black List', label: '2020 Black List', shortLabel: '2020' },
  { id: 'Randoms', label: 'Random Collection', shortLabel: 'Randoms' },
];

export function CollectionTabs({ screenplays }: CollectionTabsProps) {
  const collections = useFilterStore((s) => s.collections);
  const setCollections = useFilterStore((s) => s.setCollections);

  // Count screenplays per collection
  const counts = screenplays.reduce(
    (acc, sp) => {
      acc[sp.collection] = (acc[sp.collection] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Determine active tab
  const activeCollection = collections.length === 0 ? 'all' : collections.length === 1 ? collections[0] : 'all';

  const handleTabClick = (collectionId: Collection | 'all') => {
    if (collectionId === 'all') {
      setCollections([]);
    } else {
      setCollections([collectionId]);
    }
  };

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-black-800/50 border border-black-700">
      {COLLECTIONS.map((col) => {
        const isActive = activeCollection === col.id;
        const count = col.id === 'all' ? screenplays.length : counts[col.id] || 0;

        return (
          <button
            key={col.id}
            onClick={() => handleTabClick(col.id)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-all
              flex items-center gap-2
              ${isActive
                ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                : 'text-black-400 hover:text-white hover:bg-black-700/50'
              }
            `}
            title={col.label}
          >
            <span className="hidden sm:inline">{col.shortLabel}</span>
            <span className="sm:hidden">{col.shortLabel}</span>
            <span
              className={`
                text-xs px-1.5 py-0.5 rounded-full font-mono
                ${isActive ? 'bg-gold-500/30 text-gold-300' : 'bg-black-700 text-black-400'}
              `}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
