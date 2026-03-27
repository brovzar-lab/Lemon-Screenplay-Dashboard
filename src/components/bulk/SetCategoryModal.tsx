/**
 * SetCategoryModal
 * Bulk-assigns a category to all selected screenplays.
 * Dropdown shows existing categories only (D-02). Replaces existing category (D-03).
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCategories } from '@/hooks/useCategories';
import { useSelectionStore } from '@/stores/selectionStore';
import { useScreenplays, SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import { patchAnalysisField } from '@/lib/analysisStore';
import { useToastStore } from '@/stores/toastStore';

interface SetCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SetCategoryModal({ isOpen, onClose }: SetCategoryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const { categories } = useCategories();
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const { data: allScreenplays } = useScreenplays();
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const getSelectedScreenplays = () => {
    if (!allScreenplays) return [];
    return allScreenplays.filter((sp) => selectedIds.has(sp.id));
  };

  const handleApply = async () => {
    if (!selectedCategory) return;
    const screenplays = getSelectedScreenplays();
    await Promise.all(
      screenplays.map((sp) =>
        patchAnalysisField(sp.sourceFile, 'collection', selectedCategory)
      )
    );
    queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
    const categoryName = categories.find((c) => c.id === selectedCategory)?.name || selectedCategory;
    useToastStore.getState().addToast(
      `Category set to ${categoryName} for ${screenplays.length} screenplay${screenplays.length !== 1 ? 's' : ''}`,
      'success'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4">
          <h3 className="text-lg font-heading font-semibold text-gold-200">Set Category</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <label className="text-xs text-black-400">
            Choose a category for {selectedIds.size} screenplay{selectedIds.size !== 1 ? 's' : ''}
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full mt-2 bg-black-800/50 border border-black-600 rounded-lg px-3 py-2 text-sm text-black-200"
          >
            <option value="">Select a category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-ghost text-sm">
            Keep Categories
          </button>
          <button
            disabled={!selectedCategory}
            onClick={handleApply}
            className="btn btn-primary text-sm"
          >
            Set Category
          </button>
        </div>
      </div>
    </div>
  );
}
