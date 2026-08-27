/**
 * BulkActionBar Component
 * Sticky bottom action bar that appears when 1+ screenplays are selected.
 * Shows selection count, clear/Select All/Deselect All, and six action buttons.
 * Export CSV, Compare, Export PDF, Set Category, and Favorites are wired. Upload PDFs wired in Plan 03.
 */

import { useState } from 'react';
import { useSelectionStore, useSelectionCount, useHasSelection } from '@/stores/selectionStore';
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';
import { useScreenplays } from '@/hooks/useScreenplays';
import { exportToCSV } from '@/components/export/csvExport';
import type { BulkPdfProgress } from '@/components/export/bulkPdfExport';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useToastStore } from '@/stores/toastStore';
import { SetCategoryModal, AddToFavoritesModal, BulkPdfUploadModal } from '@/components/bulk';
import { useIsAdmin } from '@/stores/authStore';
import { useTranslation } from 'react-i18next';

export function BulkActionBar() {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const count = useSelectionCount();
  const [pdfProgress, setPdfProgress] = useState<BulkPdfProgress | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const hasSelection = useHasSelection();
  const selectAll = useSelectionStore((s) => s.selectAll);
  const deselectAll = useSelectionStore((s) => s.deselectAll);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const { screenplays: filtered } = useFilteredScreenplays();
  const { data: allScreenplays } = useScreenplays();

  /** Resolve selected IDs to full Screenplay objects */
  const getSelectedScreenplays = () => {
    if (!allScreenplays) return [];
    return allScreenplays.filter((sp) => selectedIds.has(sp.id));
  };

  /** CSV Export -- direct call, no modal (D-14, BULK-04) */
  const handleExportCSV = () => {
    const selected = getSelectedScreenplays();
    if (selected.length === 0) return;
    exportToCSV(selected, 'selected_screenplays');
    useToastStore.getState().addToast(
      t('Exported {{count}} screenplay as CSV', { count: selected.length }),
      'success'
    );
  };

  /** Compare -- store call with guard (D-08, D-09, D-10, BULK-06) */
  const handleCompare = () => {
    const ids = Array.from(selectedIds);
    useComparisonStore.getState().openComparison(ids);
  };

  /** Bulk PDF Export -- zip of individual PDFs (D-11, D-12, D-13, BULK-05) */
  const handleExportPDF = async () => {
    const selected = getSelectedScreenplays();
    if (selected.length === 0) return;
    try {
      // Dynamic import — defers 1.5MB @react-pdf/renderer until user clicks
      const { bulkExportPdfs } = await import('@/components/export/bulkPdfExport');
      await bulkExportPdfs(selected, (progress) => {
        setPdfProgress(progress);
      });
      useToastStore.getState().addToast(
        t('Exported {{count}} screenplay as PDF', { count: selected.length }),
        'success'
      );
    } catch (err) {
      console.error('Bulk PDF export failed:', err);
      useToastStore.getState().addToast(
        t('PDF export failed. Try selecting fewer screenplays.'),
        'error'
      );
    } finally {
      setPdfProgress(null);
    }
  };

  const isExportingPdf = pdfProgress !== null;
  const compareDisabled = count < 2 || count > 3;

  if (!hasSelection) return null;

  const handleSelectAll = () => {
    selectAll(filtered.map((sp) => sp.id));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
      <div className="glass border-t border-gold-500/20 shadow-xl">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left side: count + clear + select all/deselect all */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gold-200">
                {t('{{count}} screenplay selected', { count })}
              </span>
              <button
                onClick={deselectAll}
                className="text-black-400 hover:text-red-400 transition-colors p-1"
                aria-label={t('Clear selection')}
                title={t('Clear selection')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="h-4 w-px bg-black-600" />
              <button
                onClick={handleSelectAll}
                className="text-xs text-black-400 hover:text-gold-300 transition-colors"
              >
                {t('Select All')}
              </button>
              <button
                onClick={deselectAll}
                className="text-xs text-black-400 hover:text-gold-300 transition-colors"
              >
                {t('Deselect All')}
              </button>
            </div>

            {/* Right side: six action buttons */}
            <div className="flex items-center gap-2">
              <button onClick={handleExportCSV} className="btn btn-ghost text-sm">
                {t('Export CSV')}
              </button>
              <button
                disabled={isExportingPdf}
                onClick={!isExportingPdf ? handleExportPDF : undefined}
                className={`btn btn-ghost text-sm ${isExportingPdf ? 'pointer-events-none' : 'disabled:opacity-40 disabled:cursor-not-allowed'}`}
              >
                {isExportingPdf && pdfProgress ? (
                  <span className="text-gold-200">
                    {t('Exporting {{current}} of {{total}}...', { ...pdfProgress })}
                  </span>
                ) : (
                  t('Export PDF')
                )}
              </button>
              <button
                disabled={compareDisabled}
                title={t(compareDisabled ? 'Select 2-3 to compare' : 'Compare selected screenplays')}
                onClick={!compareDisabled ? handleCompare : undefined}
                className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('Compare')}
              </button>
              {isAdmin && <button onClick={() => setShowUploadModal(true)} className="btn btn-ghost text-sm">
                {t('Upload PDFs')}
              </button>}
              {isAdmin && <button onClick={() => setShowCategoryModal(true)} className="btn btn-ghost text-sm">
                {t('Set Category')}
              </button>}
              <button onClick={() => setShowFavoritesModal(true)} className="btn btn-ghost text-sm">
                {t('Favorites')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {isAdmin && <SetCategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />}
      <AddToFavoritesModal
        isOpen={showFavoritesModal}
        onClose={() => setShowFavoritesModal(false)}
      />
      {isAdmin && <BulkPdfUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />}
    </div>
  );
}
