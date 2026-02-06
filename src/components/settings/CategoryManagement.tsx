/**
 * Category Management Settings
 * Manage screenplay source categories
 */

import { useState, useEffect } from 'react';
import { notifyCategoriesUpdated } from '@/hooks/useCategories';

interface Category {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

// Default categories - always present
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'BLKLST', name: 'Black List', description: 'Annual Black List selections', isDefault: true },
  { id: 'LEMON', name: 'Lemon', description: 'Lemon internal submissions', isDefault: true },
  { id: 'SUBMISSION', name: 'Submission', description: 'Writer submissions', isDefault: true },
  { id: 'CONTEST', name: 'Contest', description: 'Contest winners and finalists', isDefault: true },
  { id: 'OTHER', name: 'Other', description: 'Other sources', isDefault: true },
];

const STORAGE_KEY = 'lemon-custom-categories';

export function CategoryManagement() {
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [error, setError] = useState('');

  // Load custom categories from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCustomCategories(JSON.parse(stored));
      } catch {
        console.error('Failed to parse custom categories');
      }
    }
  }, []);

  // Save custom categories to localStorage when they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customCategories));
    // Notify other components that categories have changed
    notifyCategoriesUpdated();
  }, [customCategories]);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const handleAddCategory = () => {
    setError('');

    // Validation
    const trimmedId = newCategoryId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const trimmedName = newCategoryName.trim();

    if (!trimmedId || !trimmedName) {
      setError('Category ID and name are required');
      return;
    }

    if (trimmedId.length < 2 || trimmedId.length > 10) {
      setError('Category ID must be 2-10 characters');
      return;
    }

    if (allCategories.some(c => c.id === trimmedId)) {
      setError('A category with this ID already exists');
      return;
    }

    if (allCategories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('A category with this name already exists');
      return;
    }

    // Add the new category
    const newCategory: Category = {
      id: trimmedId,
      name: trimmedName,
      description: newCategoryDescription.trim() || `Custom category: ${trimmedName}`,
      isDefault: false,
    };

    setCustomCategories([...customCategories, newCategory]);
    setNewCategoryId('');
    setNewCategoryName('');
    setNewCategoryDescription('');
  };

  const handleDeleteCategory = (id: string) => {
    setCustomCategories(customCategories.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-display text-gold-200 mb-2">Categories</h2>
        <p className="text-sm text-black-400">
          Manage screenplay source categories. Categories help organize screenplays by their origin.
        </p>
      </div>

      {/* Category List */}
      <div className="space-y-3">
        {allCategories.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-4 p-4 rounded-lg bg-black-800/50 border border-black-700"
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

            {/* Default Badge or Delete Button */}
            {category.isDefault ? (
              category.id === 'BLKLST' && (
                <span className="px-2 py-1 rounded text-xs bg-gold-500/20 text-gold-400">
                  Default
                </span>
              )
            ) : (
              <button
                onClick={() => handleDeleteCategory(category.id)}
                className="p-2 text-black-400 hover:text-red-400 transition-colors"
                title="Delete category"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-black-800/30 border border-black-700">
        <h4 className="text-sm font-medium text-gold-300 mb-2">About Categories</h4>
        <ul className="text-sm text-black-400 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-gold-500">•</span>
            <span>Categories are assigned during upload and cannot be changed afterward</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-500">•</span>
            <span>Use the filter panel to view screenplays by category</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-500">•</span>
            <span>New screenplays default to BLKLST if no category is specified</span>
          </li>
        </ul>
      </div>

      {/* Add Custom Category Form */}
      <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
        <h4 className="text-sm font-medium text-gold-300 mb-4">Add Custom Category</h4>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-black-400 mb-1">Category ID</label>
              <input
                type="text"
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value.toUpperCase())}
                placeholder="e.g., INDIE"
                maxLength={10}
                className="input w-full text-sm"
              />
              <p className="text-xs text-black-500 mt-1">2-10 uppercase letters/numbers</p>
            </div>
            <div>
              <label className="block text-xs text-black-400 mb-1">Display Name</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Independent Films"
                className="input w-full text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-black-400 mb-1">Description (optional)</label>
            <input
              type="text"
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
              placeholder="e.g., Low-budget independent productions"
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

      {/* Custom Categories Count */}
      {customCategories.length > 0 && (
        <p className="text-xs text-black-500 text-center">
          {customCategories.length} custom {customCategories.length === 1 ? 'category' : 'categories'} added
        </p>
      )}
    </div>
  );
}

export default CategoryManagement;
