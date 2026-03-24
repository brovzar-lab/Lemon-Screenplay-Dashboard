/**
 * Category Selector
 * Displays category buttons and inline form to create new categories
 */

import { useState } from 'react';
import { clsx } from 'clsx';

interface CategorySelectorProps {
  categoryIds: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onAddCategory: (cat: { id: string; name: string; description: string }) => void;
}

export function CategorySelector({ categoryIds, selectedCategory, onSelectCategory, onAddCategory }: CategorySelectorProps) {
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatError, setNewCatError] = useState('');

  return (
    <div>
      <label className="block text-sm font-medium text-gold-300 mb-2">
        Assign Category
      </label>
      <div className="flex flex-wrap gap-2">
        {categoryIds.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              selectedCategory === cat
                ? 'bg-gold-500/30 text-gold-300 border border-gold-500/50'
                : 'bg-black-800/50 text-black-300 border border-black-700 hover:border-gold-500/30'
            )}
          >
            {cat}
          </button>
        ))}

        {/* New + Button */}
        <button
          onClick={() => setShowNewCatForm(!showNewCatForm)}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            showNewCatForm
              ? 'bg-gold-500/30 text-gold-300 border border-gold-500/50'
              : 'bg-black-800/50 text-black-400 border border-dashed border-black-600 hover:border-gold-500/30 hover:text-gold-300'
          )}
        >
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New
          </span>
        </button>
      </div>

      {/* Inline New Category Form */}
      {showNewCatForm && (
        <div className="mt-3 p-3 rounded-lg bg-black-800/50 border border-black-700 space-y-3">
          <div>
            <label className="block text-xs text-black-400 mb-1">Category Name</label>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Independent Films"
              className="input w-full text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).form?.querySelector<HTMLButtonElement>('.btn-primary')?.click();
                }
              }}
            />
          </div>
          {newCatError && <p className="text-xs text-red-400">{newCatError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setNewCatError('');
                const name = newCatName.trim();
                if (!name) { setNewCatError('Enter a category name'); return; }
                // Auto-generate ID from name: uppercase, no spaces, max 10 chars
                const id = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                if (id.length < 2) { setNewCatError('Name too short'); return; }
                if (categoryIds.includes(id)) { setNewCatError(`"${id}" already exists`); return; }
                onAddCategory({ id, name, description: `Created during upload` });
                onSelectCategory(id);
                setNewCatName('');
                setShowNewCatForm(false);
              }}
              className="btn btn-primary text-xs"
            >
              Create & Select
            </button>
            <button
              onClick={() => { setShowNewCatForm(false); setNewCatName(''); setNewCatError(''); }}
              className="btn text-xs text-black-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
