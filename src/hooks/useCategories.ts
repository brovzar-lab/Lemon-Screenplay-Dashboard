/**
 * useCategories Hook
 * Single source of truth for categories.
 * Reads from localStorage key 'lemon-categories'.
 * Seeds initial defaults on first load.
 */

import { useState, useEffect, useCallback } from 'react';

export interface Category {
  id: string;
  name: string;
  description: string;
}

const INITIAL_CATEGORIES: Category[] = [
  { id: 'BLKLST', name: 'Black List', description: 'Annual Black List selections' },
  { id: 'LEMON', name: 'Lemon', description: 'Lemon internal submissions' },
  { id: 'SUBMISSION', name: 'Submission', description: 'Writer submissions' },
  { id: 'CONTEST', name: 'Contest', description: 'Contest winners and finalists' },
  { id: 'OTHER', name: 'Other', description: 'Other sources' },
];

const STORAGE_KEY = 'lemon-categories';

function loadFromStorage(): Category[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Category[];
    }
  } catch {
    // ignore
  }
  // First run — seed
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CATEGORIES));
  return INITIAL_CATEGORIES;
}

/**
 * Hook to get all categories.
 * Returns full category objects, just IDs, and helpers.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(loadFromStorage);

  const reload = useCallback(() => {
    setCategories(loadFromStorage());
  }, []);

  // Listen for changes (same tab via custom event, other tabs via storage event)
  useEffect(() => {
    const handleUpdate = () => reload();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) reload();
    };

    window.addEventListener('lemon-categories-updated', handleUpdate);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('lemon-categories-updated', handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [reload]);

  const categoryIds = categories.map(c => c.id);

  const getCategoryById = (id: string): Category | undefined => {
    return categories.find(c => c.id === id);
  };

  const isValidCategory = (id: string): boolean => {
    return categoryIds.includes(id);
  };

  /** Add a new category, persist, and notify */
  const addCategory = (cat: Category) => {
    const updated = [...categories, cat];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setCategories(updated);
    window.dispatchEvent(new Event('lemon-categories-updated'));
  };

  return {
    categories,
    categoryIds,
    getCategoryById,
    isValidCategory,
    addCategory,
    refresh: reload,
  };
}

/**
 * Utility function to trigger category update events.
 * Call this after modifying categories in localStorage.
 */
export function notifyCategoriesUpdated() {
  window.dispatchEvent(new Event('lemon-categories-updated'));
}

export default useCategories;
