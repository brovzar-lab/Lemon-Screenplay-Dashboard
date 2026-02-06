/**
 * useCategories Hook
 * Provides access to both default and custom categories
 * Automatically updates when custom categories change in localStorage
 */

import { useState, useEffect, useCallback } from 'react';

export interface Category {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'BLKLST', name: 'Black List', description: 'Annual Black List selections', isDefault: true },
  { id: 'LEMON', name: 'Lemon Picks', description: 'Our curated selections', isDefault: true },
  { id: 'SUBMISSION', name: 'Submissions', description: 'Submitted screenplays', isDefault: true },
  { id: 'CONTEST', name: 'Contest', description: 'Contest entries', isDefault: true },
  { id: 'OTHER', name: 'Other', description: 'Uncategorized screenplays', isDefault: true },
];

const STORAGE_KEY = 'lemon-custom-categories';

/**
 * Hook to get all categories (default + custom)
 * Returns both the full category objects and just the IDs for simple use cases
 */
export function useCategories() {
  const [customCategories, setCustomCategories] = useState<Category[]>([]);

  // Load custom categories from localStorage
  const loadCustomCategories = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Category[];
        setCustomCategories(parsed);
      } else {
        setCustomCategories([]);
      }
    } catch {
      setCustomCategories([]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadCustomCategories();
  }, [loadCustomCategories]);

  // Listen for localStorage changes (e.g., from other tabs or the CategoryManagement component)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadCustomCategories();
      }
    };

    // Also listen for custom events within the same tab
    const handleCustomCategoryChange = () => {
      loadCustomCategories();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('lemon-categories-updated', handleCustomCategoryChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('lemon-categories-updated', handleCustomCategoryChange);
    };
  }, [loadCustomCategories]);

  // Combine default and custom categories
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  // Get just the IDs for simple filtering/selection
  const categoryIds = allCategories.map((c) => c.id);

  // Get default category IDs only
  const defaultCategoryIds = DEFAULT_CATEGORIES.map((c) => c.id);

  // Get custom category IDs only
  const customCategoryIds = customCategories.map((c) => c.id);

  // Helper to get category by ID
  const getCategoryById = (id: string): Category | undefined => {
    return allCategories.find((c) => c.id === id);
  };

  // Helper to check if a category ID is valid
  const isValidCategory = (id: string): boolean => {
    return categoryIds.includes(id);
  };

  return {
    // Full category objects
    categories: allCategories,
    defaultCategories: DEFAULT_CATEGORIES,
    customCategories,

    // Just IDs
    categoryIds,
    defaultCategoryIds,
    customCategoryIds,

    // Helpers
    getCategoryById,
    isValidCategory,

    // Refresh function
    refresh: loadCustomCategories,
  };
}

/**
 * Utility function to trigger category update events
 * Call this after modifying custom categories in localStorage
 */
export function notifyCategoriesUpdated() {
  window.dispatchEvent(new Event('lemon-categories-updated'));
}

export default useCategories;
