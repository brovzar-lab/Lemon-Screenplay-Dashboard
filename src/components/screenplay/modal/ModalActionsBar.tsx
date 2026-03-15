/**
 * ModalActionsBar — floating sticky bottom bar with Share, Coverage,
 * Reanalyze, PDF download, and Delete actions.
 * Extracted from ModalHeader to support the split-panel layout.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { ReanalyzeButton } from './ReanalyzeButton';
import { ShareButton } from './ShareButton';
import { useDeleteScreenplays } from '@/hooks/useScreenplays';
import { storage } from '@/lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { downloadCoveragePdf } from '@/components/export/exportCoverage';
import { useToastStore } from '@/stores/toastStore';

interface ModalActionsBarProps {
  screenplay: Screenplay;
  onClose: () => void;
}

export function ModalActionsBar({ screenplay, onClose }: ModalActionsBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteScreenplays();

  /* ── PDF Download ──────────────────────────────── */
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'error'>('idle');

  const handleDownloadPdf = async () => {
    if (pdfState === 'loading') return;
    setPdfState('loading');

    const category = screenplay.category || 'OTHER';
    const safeName = (screenplay.title || screenplay.sourceFile || 'untitled')
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    const storagePath = `screenplays/${category}/${safeName}.pdf`;

    try {
      const fileRef = ref(storage, storagePath);
      const url = await getDownloadURL(fileRef);
      window.open(url, '_blank');
      setPdfState('idle');
      return;
    } catch (err) {
      console.warn('[PDF Download] Primary path failed:', err);
    }

    // Fallback: try without category subfolder
    try {
      const fallbackRef = ref(storage, `screenplays/${safeName}.pdf`);
      const url = await getDownloadURL(fallbackRef);
      window.open(url, '_blank');
      setPdfState('idle');
      return;
    } catch {
      console.warn('[PDF Download] PDF not found in storage. Path tried:', storagePath);
    }

    setPdfState('error');
    setTimeout(() => setPdfState('idle'), 3000);
  };

  /* ── Coverage PDF ──────────────────────────────── */
  const [coverageState, setCoverageState] = useState<'idle' | 'loading' | 'error'>('idle');

  const handleDownloadCoverage = async () => {
    if (coverageState === 'loading') return;
    setCoverageState('loading');
    try {
      await downloadCoveragePdf(screenplay);
      setCoverageState('idle');
    } catch (error) {
      console.error('[Coverage PDF] Generation failed:', error);
      useToastStore.getState().addToast('Coverage PDF generation failed — please try again');
      setCoverageState('error');
      setTimeout(() => setCoverageState('idle'), 3000);
    }
  };

  /* ── Delete ────────────────────────────────────── */
  const handleDelete = () => {
    const sourceFile = screenplay.sourceFile || screenplay.title;
    deleteMutation.mutate(sourceFile, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        onClose();
      },
    });
  };

  return (
    <>
      <div className="sticky bottom-0 z-20 glass-dark border-t border-gold-500/10 px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        {/* Left: Share, Coverage, Reanalyze, PDF */}
        <div className="flex items-center gap-2 flex-wrap">
          <ShareButton screenplay={screenplay} />

          {/* Coverage button */}
          <button
            onClick={handleDownloadCoverage}
            disabled={coverageState === 'loading'}
            className={clsx(
              'btn text-xs flex items-center gap-1.5 py-1.5 px-3 transition-all',
              coverageState === 'error'
                ? 'bg-red-600/20 text-red-400 border border-red-500/30 cursor-default'
                : 'btn-primary',
              coverageState === 'loading' && 'opacity-60 cursor-wait',
            )}
            title={
              coverageState === 'error'
                ? 'Coverage PDF generation failed'
                : 'Download coverage report as PDF'
            }
          >
            {coverageState === 'loading' ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : coverageState === 'error' ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {coverageState === 'error' ? 'Failed' : 'Coverage'}
          </button>

          <ReanalyzeButton screenplay={screenplay} />

          {/* PDF download button */}
          <button
            onClick={handleDownloadPdf}
            disabled={pdfState === 'loading'}
            className={clsx(
              'btn text-xs flex items-center gap-1.5 py-1.5 px-3 transition-all',
              pdfState === 'error'
                ? 'bg-red-600/20 text-red-400 border border-red-500/30 cursor-default'
                : 'btn-primary',
              pdfState === 'loading' && 'opacity-60 cursor-wait',
            )}
            title={
              pdfState === 'error'
                ? 'PDF not found in storage — upload the PDF first'
                : `Download ${screenplay.sourceFile || screenplay.title}`
            }
          >
            {pdfState === 'loading' ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : pdfState === 'error' ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {pdfState === 'error' ? 'Not Found' : 'PDF'}
          </button>
        </div>

        {/* Right: Delete */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="modal-delete-btn text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-all border"
          title="Delete this screenplay"
          aria-label="Delete screenplay"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title={`Delete "${screenplay.title}"?`}
        message={`This will permanently remove the analysis for "${screenplay.title}" from your database.`}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
