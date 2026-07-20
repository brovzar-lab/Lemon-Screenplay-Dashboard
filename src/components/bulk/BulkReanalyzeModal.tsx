/**
 * BulkReanalyzeModal — BULK-02
 * Re-analysis progress queue modal for eligible screenplays (hasPdf=true).
 * Explicit confirmation, budget preflight, sequential processing, and cancellation.
 */

import { useRef, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { reanalyzeFromStorage } from '@/lib/analysisService';
import { useExportSelectionStore } from '@/stores/exportSelectionStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import { useApiConfigStore } from '@/stores/apiConfigStore';

const ESTIMATED_COST_PER_SCREENPLAY = 1;

type ReanalyzeItemStatus = 'queued' | 'analyzing' | 'done' | 'failed';

interface ReanalyzeItem {
  status: ReanalyzeItemStatus;
}

interface BulkReanalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenplays: Screenplay[]; // ALL selected; component filters by hasPdf internally
}

export function BulkReanalyzeModal({ isOpen, onClose, screenplays }: BulkReanalyzeModalProps) {
  const cancelledRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [items, setItems] = useState<Record<string, ReanalyzeItem>>({});
  const [completedCount, setCompletedCount] = useState(0);
  const [summary, setSummary] = useState('');
  const queryClient = useQueryClient();
  const pdfStatuses = usePdfStatusStore((s) => s.statuses);
  const hasScanResult = usePdfStatusStore((s) => s.hasScanResult);
  const budgetRemaining = useApiConfigStore((s) => s.getBudgetRemaining());
  const requestsRemaining = useApiConfigStore((s) => s.getDailyRequestsRemaining());

  // Derived — not stored in state
  // Use live Storage scan results when available; fall back to Firestore hasPdf field.
  const eligible = screenplays.filter((sp) =>
    hasScanResult ? pdfStatuses[sp.id] === 'found' : sp.hasPdf === true
  );
  const ineligibleCount = screenplays.length - eligible.length;
  const estimatedCost = eligible.length * ESTIMATED_COST_PER_SCREENPLAY;
  const canAffordBatch = eligible.length <= requestsRemaining && estimatedCost <= budgetRemaining;

  function setItemStatus(id: string, status: ReanalyzeItemStatus) {
    setItems((prev) => ({ ...prev, [id]: { status } }));
  }

  async function runBulkReanalyze() {
    const apiConfig = useApiConfigStore.getState();
    apiConfig.checkAndResetIfNeeded();
    if (
      eligible.length > apiConfig.getDailyRequestsRemaining() ||
      estimatedCost > apiConfig.getBudgetRemaining()
    ) {
      setSummary('This batch exceeds the current daily request or monthly budget limit.');
      return;
    }

    cancelledRef.current = false;
    setIsProcessing(true);
    let completed = 0;
    const failed: string[] = [];

    for (const sp of eligible) {
      if (cancelledRef.current) {
        setSummary(`Cancelled — ${completed} completed before cancellation`);
        break;
      }

      setItemStatus(sp.id, 'analyzing');
      let success = false;
      try {
        await reanalyzeFromStorage(sp, 'sonnet');
        success = true;
      } catch {
        success = false;
      } finally {
        useApiConfigStore.getState().incrementUsage(ESTIMATED_COST_PER_SCREENPLAY);
      }

      if (success) {
        setItemStatus(sp.id, 'done');
        completed++;
        setCompletedCount(completed);
      } else {
        setItemStatus(sp.id, 'failed');
        failed.push(sp.title);
      }
    }

    if (!cancelledRef.current) {
      if (failed.length > 0) {
        setSummary(`Complete — ${completed} re-analyzed. ${failed.length} could not be processed: ${failed.join(', ')}`);
      } else {
        setSummary(`Complete — ${completed} re-analyzed`);
      }
    }

    setIsProcessing(false);
    setIsDone(true);
  }

  // Initialize the review screen when the modal opens. Paid work starts only
  // after explicit confirmation.
  useEffect(() => {
    if (!isOpen) return;

    // Initialize all items as queued
    const initial: Record<string, ReanalyzeItem> = {};
    for (const sp of eligible) {
      initial[sp.id] = { status: 'queued' };
    }
    setItems(initial);
    setCompletedCount(0);
    setIsDone(false);
    setSummary('');
    cancelledRef.current = false;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleClose() {
    queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
    useExportSelectionStore.getState().deselectAll();
    onClose();
  }

  if (!isOpen) return null;

  // Header text — only shown in sub-header, summary shown separately once done
  const headerText =
    !isProcessing && !isDone
      ? `${eligible.length} eligible screenplay${eligible.length === 1 ? '' : 's'} ready for review`
      : ineligibleCount > 0
      ? `${eligible.length} of ${screenplays.length} selected are eligible. Processing ${eligible.length}...`
      : `Re-analyzing ${completedCount} of ${eligible.length}...`;

  // Status icon per item
  function StatusIcon({ status }: { status: ReanalyzeItemStatus }) {
    if (status === 'analyzing') {
      return (
        <svg className="animate-spin w-4 h-4 text-gold-400 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      );
    }
    if (status === 'done') {
      return (
        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (status === 'failed') {
      return (
        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }
    // queued
    return (
      <svg className="w-4 h-4 text-black-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — blocked during processing */}
      <div
        className="fixed inset-0 bg-black-950/80 backdrop-blur-sm"
        onClick={isProcessing ? undefined : handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black-700">
          <h3 className="text-lg font-display text-gold-200">Re-Analyze Screenplays</h3>
          <button
            onClick={isProcessing ? undefined : handleClose}
            disabled={isProcessing}
            className={clsx(
              'p-1 rounded text-black-400',
              isProcessing ? 'opacity-40 cursor-not-allowed' : 'hover:bg-black-700 hover:text-gold-400'
            )}
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-header: status/eligibility text */}
        <div className="px-4 pt-3 pb-1">
          {!isDone && <p className="text-sm text-black-400">{headerText}</p>}
          {!isProcessing && !isDone && eligible.length > 0 && (
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-black-300">
                Estimated maximum cost: ${estimatedCost.toFixed(2)}
              </p>
              <p className="text-black-400">
                Remaining: ${budgetRemaining.toFixed(2)} monthly budget and {requestsRemaining} daily jobs
              </p>
              {!canAffordBatch && (
                <p className="text-red-400">This batch exceeds your current budget or daily job limit.</p>
              )}
            </div>
          )}
          {isDone && summary && (
            <p className="text-sm text-black-400">{summary}</p>
          )}
          {eligible.length === 0 && (
            <p className="text-sm text-amber-400 mt-1">
              No eligible screenplays — all selected items are missing their PDF.
            </p>
          )}
        </div>

        {/* Item list */}
        {eligible.length > 0 && (
          <div className="max-h-96 overflow-y-auto px-4 pb-2">
            {eligible.map((sp) => {
              const item = items[sp.id] ?? { status: 'queued' as const };
              return (
                <div
                  key={sp.id}
                  className="flex items-center gap-3 py-2.5 border-b border-black-800 last:border-0"
                >
                  <StatusIcon status={item.status} />
                  <span className="flex-1 text-sm text-black-300 truncate">{sp.title}</span>
                  <span className="text-xs text-black-500 capitalize">{item.status}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-black-700 bg-black-900/30">
          {isProcessing && (
            <button
              onClick={() => { cancelledRef.current = true; }}
              className="btn btn-ghost text-sm"
              aria-label="Cancel"
            >
              Cancel
            </button>
          )}
          {!isProcessing && (
            <>
              <button onClick={handleClose} className="btn btn-ghost text-sm" aria-label="Close">
                Close
              </button>
              {!isDone && eligible.length > 0 && (
                <button
                  onClick={runBulkReanalyze}
                  disabled={!canAffordBatch}
                  className="btn btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Start Reanalysis
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
