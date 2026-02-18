/**
 * Category Management Settings
 * Manage screenplay source categories — all are deletable.
 * Deleting a category moves its screenplays to "Uncategorized".
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';

interface Category {
  id: string;
  name: string;
  description: string;
}

// Initial default categories — stored in localStorage just like custom ones
const INITIAL_CATEGORIES: Category[] = [
  { id: 'BLKLST', name: 'Black List', description: 'Annual Black List selections' },
  { id: 'LEMON', name: 'Lemon', description: 'Lemon internal submissions' },
  { id: 'SUBMISSION', name: 'Submission', description: 'Writer submissions' },
  { id: 'CONTEST', name: 'Contest', description: 'Contest winners and finalists' },
  { id: 'OTHER', name: 'Other', description: 'Other sources' },
];

const STORAGE_KEY = 'lemon-categories';

/**
 * Load all categories from localStorage.
 * On first run (no stored data), seeds with INITIAL_CATEGORIES.
 */
function loadCategories(): Category[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Category[];
    } catch {
      return INITIAL_CATEGORIES;
    }
  }
  // First run — seed and persist
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CATEGORIES));
  return INITIAL_CATEGORIES;
}

/** Persist to localStorage and notify listeners */
function saveCategories(cats: Category[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
  window.dispatchEvent(new Event('lemon-categories-updated'));
}

export function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>(loadCategories);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Persist whenever categories change
  useEffect(() => {
    saveCategories(categories);
  }, [categories]);

  const handleAddCategory = () => {
    setError('');

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setError('Enter a category name');
      return;
    }

    // Auto-generate ID from name
    const id = trimmedName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (id.length < 2) {
      setError('Name too short');
      return;
    }

    if (id === 'UNCATEGORIZED') {
      setError('"UNCATEGORIZED" is reserved');
      return;
    }

    if (categories.some(c => c.id === id)) {
      setError(`"${id}" already exists`);
      return;
    }

    setCategories([...categories, {
      id,
      name: trimmedName,
      description: `Custom category`,
    }]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (id: string) => {
    if (confirmDeleteId === id) {
      // Second click — actually delete
      setCategories(categories.filter(c => c.id !== id));
      setConfirmDeleteId(null);
    } else {
      // First click — ask confirmation
      setConfirmDeleteId(id);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-display text-gold-200 mb-2">Categories</h2>
        <p className="text-sm text-black-400">
          Manage screenplay categories. These are used when uploading and for dashboard filtering.
        </p>
      </div>

      {/* Category List */}
      <div className="space-y-3">
        {categories.map((category) => (
          <div
            key={category.id}
            className={clsx(
              'flex items-center gap-4 p-4 rounded-lg bg-black-800/50 border transition-colors',
              confirmDeleteId === category.id
                ? 'border-red-500/50'
                : 'border-black-700'
            )}
          >
            {/* Category Badge */}
            <div className="w-12 h-12 rounded-lg bg-gold-500/20 flex items-center justify-center shrink-0">
              <span className="text-gold-400 font-bold text-sm">
                {category.id.slice(0, 2)}
              </span>
            </div>

            {/* Category Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gold-200">{category.name}</p>
                <span className="px-2 py-0.5 rounded text-xs bg-black-700 text-black-400">
                  {category.id}
                </span>
              </div>
              <p className="text-sm text-black-500">{category.description}</p>
            </div>

            {/* Delete Button */}
            <button
              onClick={() => handleDeleteCategory(category.id)}
              className={clsx(
                'p-2 transition-colors text-sm flex items-center gap-1',
                confirmDeleteId === category.id
                  ? 'text-red-400 font-medium'
                  : 'text-black-400 hover:text-red-400'
              )}
              title={confirmDeleteId === category.id
                ? 'Click again to confirm — screenplays will move to Uncategorized'
                : 'Delete category'
              }
            >
              {confirmDeleteId === category.id ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Confirm
                </>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="text-center py-8 text-black-500 text-sm">
            No categories defined. Add one below.
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-black-800/30 border border-black-700">
        <h4 className="text-sm font-medium text-gold-300 mb-2">How Categories Work</h4>
        <ul className="text-sm text-black-400 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-gold-500">•</span>
            <span>Choose a category when you <strong>upload</strong> — it gets saved with the analysis</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-500">•</span>
            <span>The <strong>dashboard tabs</strong> match these categories exactly</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-500">•</span>
            <span>Deleting a category moves its screenplays to <strong>Uncategorized</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-500">•</span>
            <span>Click a tab, then <strong>Export</strong> to get only that category</span>
          </li>
        </ul>
      </div>

      {/* Add Category Form */}
      <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
        <h4 className="text-sm font-medium text-gold-300 mb-4">Add Category</h4>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-black-400 mb-1">Category Name</label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g., Independent Films"
              className="input w-full text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={handleAddCategory}
            className="btn btn-primary text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Category
          </button>
        </div>
      </div>
    </div>
  );
}

export default CategoryManagement;
