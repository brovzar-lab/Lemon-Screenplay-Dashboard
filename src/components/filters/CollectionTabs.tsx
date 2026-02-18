/**
 * CollectionTabs Component
 * Unified category tabs — same categories used for upload, display, and filtering.
 * Categories are defined in Settings and mapped from pre-loaded collection names.
 */

import { useMemo } from 'react';
import { useFilterStore } from '@/stores/filterStore';
import useCategories from '@/hooks/useCategories';
import type { Screenplay } from '@/types';

interface CollectionTabsProps {
  screenplays: Screenplay[];
}

export function CollectionTabs({ screenplays }: CollectionTabsProps) {
  const categories = useFilterStore((s) => s.categories);
  const setCategories = useFilterStore((s) => s.setCategories);
  const { getCategoryById } = useCategories();

  // Derive unique category IDs & counts from screenplay data
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const sp of screenplays) {
      const cat = sp.category || 'OTHER';
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    // Sort by count descending, then alphabetical
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [screenplays]);

  // Resolve category ID → friendly display name
  const getCategoryName = (id: string): string => {
    const cat = getCategoryById(id);
    return cat ? cat.name : id; // Fallback to raw ID if not in Settings
  };

  // Determine active tab
  const activeCategory =
    categories.length === 0
      ? 'all'
      : categories.length === 1
        ? categories[0]
        : 'all';

  const handleTabClick = (categoryId: string) => {
    if (categoryId === 'all') {
      setCategories([]);
    } else {
      setCategories([categoryId]);
    }
  };

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-black-800/50 border border-black-700 overflow-x-auto">
      {/* All tab */}
      <button
        onClick={() => handleTabClick('all')}
        className={`
          px-3 py-1.5 rounded-md text-sm font-medium transition-all
          flex items-center gap-2 whitespace-nowrap
          ${activeCategory === 'all'
            ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
            : 'text-black-400 hover:text-white hover:bg-black-700/50'
          }
        `}
        title="All Categories"
      >
        <span>All</span>
        <span
          className={`
            text-xs px-1.5 py-0.5 rounded-full font-mono
            ${activeCategory === 'all' ? 'bg-gold-500/30 text-gold-300' : 'bg-black-700 text-black-400'}
          `}
        >
          {screenplays.length}
        </span>
      </button>

      {/* Dynamic category tabs */}
      {categoryData.map(([catId, count]) => {
        const isActive = activeCategory === catId;

        return (
          <button
            key={catId}
            onClick={() => handleTabClick(catId)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-all
              flex items-center gap-2 whitespace-nowrap
              ${isActive
                ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                : 'text-black-400 hover:text-white hover:bg-black-700/50'
              }
            `}
            title={getCategoryName(catId)}
          >
            <span>{getCategoryName(catId)}</span>
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
