/**
 * CategoryFilter Component
 * Filter screenplays by source category (BLKLST, LEMON, SUBMISSION, etc.)
 */

import { useFilterStore } from '@/stores/filterStore';
import { MultiSelect } from './MultiSelect';

// Available categories - these will grow as user adds more sources
const AVAILABLE_CATEGORIES = ['BLKLST', 'LEMON', 'SUBMISSION'];

export function CategoryFilter() {
  const categories = useFilterStore((s) => s.categories);
  const setCategories = useFilterStore((s) => s.setCategories);

  return (
    <MultiSelect
      label="Source Category"
      options={AVAILABLE_CATEGORIES}
      selected={categories}
      onChange={setCategories}
      placeholder="All Categories"
    />
  );
}

export default CategoryFilter;
