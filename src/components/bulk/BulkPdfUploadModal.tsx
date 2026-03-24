/**
 * BulkPdfUploadModal
 * Modal for bulk PDF upload with per-row drag-and-drop targets,
 * batch drop zone with auto-matching, immediate upload with progress bars,
 * auto-retry on failure, and live summary bar.
 *
 * D-02: Per-row drop targets
 * D-03: Batch drop zone with auto-matching
 * D-04: Immediate upload on drop
 * D-07: Auto-retry once on failure
 * D-09: Ephemeral state only (no Zustand)
 * D-10: Live summary bar
 * D-11: Done button always enabled
 * D-12: No toast on close
 * D-13: Info note for already-attached count
 * D-15: Stray drop prevention
 * D-16: Filename middle-truncation
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { useQueryClient } from '@tanstack/react-query';
import { storage } from '@/lib/firebase';
import { buildStoragePath } from '@/components/settings/pdfUploadPanel.helpers';
import { patchAnalysisField } from '@/lib/analysisStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useScreenplays, SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import {
  validatePdfFile,
  validationMessage,
  matchFilesToScreenplays,
  middleTruncate,
} from './bulkPdfUpload.helpers';
import type { RowUploadState } from './bulkPdfUpload.helpers';
import type { Screenplay } from '@/types';

interface BulkPdfUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BulkPdfUploadModal({ isOpen, onClose }: BulkPdfUploadModalProps) {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const { data: allScreenplays } = useScreenplays();
  const queryClient = useQueryClient();

  // Component-local state (D-09: ephemeral, not Zustand)
  const [rowStates, setRowStates] = useState<Record<string, RowUploadState>>({});
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [batchDragActive, setBatchDragActive] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [_retriedIds, setRetriedIds] = useState<Set<string>>(new Set());

  // Per-row hidden file input refs
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Early return when not open
  if (!isOpen) return null;

  // Data derivation
  const missingPdfScreenplays = useMemo(() => {
    if (!allScreenplays) return [];
    return allScreenplays.filter((sp) => selectedIds.has(sp.id) && !sp.hasPdf);
  }, [allScreenplays, selectedIds]);

  const alreadyAttachedCount = selectedIds.size - missingPdfScreenplays.length;

  // Live summary counts from rowStates
  const doneCount = Object.values(rowStates).filter((s) => s.status === 'done').length;
  const errorCount = Object.values(rowStates).filter((s) => s.status === 'error').length;
  const uploadingCount = Object.values(rowStates).filter((s) => s.status === 'uploading').length;
  const totalRows = missingPdfScreenplays.length;
  const remainingCount = totalRows - doneCount - errorCount - uploadingCount;

  // Upload function (D-04: immediate, D-07: auto-retry once)
  const startUpload = useCallback(
    (file: File, screenplay: Screenplay) => {
      setRowStates((prev) => ({
        ...prev,
        [screenplay.id]: { status: 'uploading', progress: 0 },
      }));

      const path = buildStoragePath(screenplay);
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: 'application/pdf',
        customMetadata: {
          originalFilename: file.name,
          category: screenplay.category || 'OTHER',
          uploadedAt: new Date().toISOString(),
        },
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setRowStates((prev) => ({
            ...prev,
            [screenplay.id]: { status: 'uploading', progress },
          }));
        },
        (error) => {
          // Auto-retry once (D-07)
          setRetriedIds((prev) => {
            if (!prev.has(screenplay.id)) {
              const next = new Set(prev);
              next.add(screenplay.id);
              // Retry with a fresh call
              setTimeout(() => startUpload(file, screenplay), 0);
              return next;
            }
            // Already retried, show error
            setRowStates((prevStates) => ({
              ...prevStates,
              [screenplay.id]: { status: 'error', message: error.message, file },
            }));
            return prev;
          });
        },
        async () => {
          await patchAnalysisField(screenplay.sourceFile, 'hasPdf', true);
          usePdfStatusStore.getState().setStatus(screenplay.id, 'found');
          queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
          setRowStates((prev) => ({
            ...prev,
            [screenplay.id]: { status: 'done' },
          }));
        }
      );
    },
    [queryClient]
  );

  // Per-row drop handler (D-02, D-15)
  const handleRowDrop = useCallback(
    (e: React.DragEvent, screenplay: Screenplay) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActiveId(null);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 1) {
        setRowStates((prev) => ({
          ...prev,
          [screenplay.id]: { status: 'error', message: 'One file per title' },
        }));
        return;
      }

      const file = files[0];
      const validationError = validatePdfFile(file);
      if (validationError) {
        setRowStates((prev) => ({
          ...prev,
          [screenplay.id]: {
            status: 'error',
            message: validationMessage(validationError),
          },
        }));
        return;
      }

      startUpload(file, screenplay);
    },
    [startUpload]
  );

  // Per-row browse handler
  const handleRowBrowse = useCallback(
    (file: File, screenplay: Screenplay) => {
      const validationError = validatePdfFile(file);
      if (validationError) {
        setRowStates((prev) => ({
          ...prev,
          [screenplay.id]: {
            status: 'error',
            message: validationMessage(validationError),
          },
        }));
        return;
      }
      startUpload(file, screenplay);
    },
    [startUpload]
  );

  // Batch drop zone handler (D-03)
  const handleBatchDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setBatchDragActive(false);

      const files = Array.from(e.dataTransfer.files);
      const { matched, unmatched } = matchFilesToScreenplays(
        files,
        missingPdfScreenplays
      );

      for (const { file, screenplay } of matched) {
        const validationError = validatePdfFile(file);
        if (validationError) {
          setRowStates((prev) => ({
            ...prev,
            [screenplay.id]: {
              status: 'error',
              message: validationMessage(validationError),
            },
          }));
        } else {
          startUpload(file, screenplay);
        }
      }

      if (unmatched.length > 0) {
        setBatchError(
          `${unmatched.length} file${unmatched.length !== 1 ? 's' : ''} could not be matched to any title`
        );
        setTimeout(() => setBatchError(null), 4000);
      }
    },
    [missingPdfScreenplays, startUpload]
  );

  // Retry handler for error rows
  const handleRetry = useCallback(
    (screenplay: Screenplay, file: File) => {
      startUpload(file, screenplay);
    },
    [startUpload]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal container with stray drop prevention (D-15) */}
      <div
        className="relative w-full max-w-lg glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in flex flex-col max-h-[85vh]"
        onDrop={(e) => e.preventDefault()}
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="px-6 py-4 shrink-0">
          <h3 className="text-lg font-heading font-semibold text-gold-200">
            Upload PDFs
          </h3>
        </div>

        {/* Info note (D-13) */}
        {alreadyAttachedCount > 0 && (
          <div className="px-6 pb-2 shrink-0">
            <p className="text-xs text-black-400">
              {alreadyAttachedCount} of {selectedIds.size} selected screenplay
              {selectedIds.size !== 1 ? 's' : ''} already have PDFs attached
            </p>
          </div>
        )}

        {/* Summary bar (D-10) */}
        <div className="px-6 pb-3 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            {doneCount > 0 && doneCount === totalRows ? (
              <span className="text-emerald-400 font-medium">
                {doneCount} of {totalRows} PDFs uploaded successfully
              </span>
            ) : doneCount > 0 || uploadingCount > 0 || errorCount > 0 ? (
              <span className="text-black-300">
                Uploaded {doneCount} of {totalRows}
                {remainingCount > 0 && (
                  <span className="text-black-500">
                    {' '}&mdash; {remainingCount} remaining
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-400">
                    {' '}&mdash; {errorCount} failed
                  </span>
                )}
              </span>
            ) : (
              <span className="text-black-500">
                {totalRows} screenplay{totalRows !== 1 ? 's' : ''} need PDFs
              </span>
            )}
          </div>
        </div>

        {/* Batch drop zone (D-03) */}
        <div className="px-6 pb-3 shrink-0">
          <div
            onDrop={handleBatchDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setBatchDragActive(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setBatchDragActive(true);
            }}
            onDragLeave={() => setBatchDragActive(false)}
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
              batchDragActive
                ? 'border-gold-400 bg-gold-500/10'
                : 'border-black-600 hover:border-gold-500/30'
            }`}
          >
            <p className="text-sm text-black-400">
              Drop multiple PDFs here to auto-match by filename
            </p>
            {batchError && (
              <p className="text-xs text-red-400 mt-1">{batchError}</p>
            )}
          </div>
        </div>

        {/* Scrollable row list */}
        <div className="px-6 overflow-y-auto flex-1 min-h-0 max-h-[60vh]">
          <div className="space-y-1 pb-2">
            {missingPdfScreenplays.map((screenplay) => {
              const state = rowStates[screenplay.id] ?? { status: 'idle' };

              return (
                <div
                  key={screenplay.id}
                  onDrop={(e) => handleRowDrop(e, screenplay)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActiveId(screenplay.id);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragActiveId(screenplay.id);
                  }}
                  onDragLeave={() => setDragActiveId(null)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                    dragActiveId === screenplay.id
                      ? 'border border-gold-400 bg-gold-500/10'
                      : state.status === 'done'
                        ? 'border border-emerald-500/20 bg-emerald-500/5'
                        : state.status === 'error'
                          ? 'border border-red-500/20 bg-red-500/5'
                          : state.status === 'uploading'
                            ? 'border border-gold-500/20 bg-gold-500/5'
                            : 'border border-transparent hover:border-black-600'
                  }`}
                >
                  {/* Left: title + category */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gold-200 truncate">
                        {screenplay.title}
                      </p>
                      {screenplay.category && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-black-700 text-black-400">
                          {screenplay.category}
                        </span>
                      )}
                    </div>

                    {/* Status-specific content */}
                    {state.status === 'uploading' && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-black-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold-500/70 rounded-full transition-all duration-300"
                            style={{ width: `${state.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-black-400 tabular-nums shrink-0">
                          {state.progress}%
                        </span>
                      </div>
                    )}

                    {state.status === 'done' && (
                      <p className="text-[10px] text-emerald-400/70 mt-0.5">
                        Uploaded
                      </p>
                    )}

                    {state.status === 'error' && (
                      <p className="text-[10px] text-red-400 mt-0.5 truncate">
                        {state.file
                          ? `${middleTruncate(state.file.name, 35)} — ${state.message}`
                          : state.message}
                      </p>
                    )}
                  </div>

                  {/* Right: action buttons based on state */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {state.status === 'idle' && (
                      <>
                        <input
                          ref={(el) => {
                            fileInputRefs.current[screenplay.id] = el;
                          }}
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleRowBrowse(file, screenplay);
                            e.target.value = '';
                          }}
                        />
                        <button
                          onClick={() =>
                            fileInputRefs.current[screenplay.id]?.click()
                          }
                          className="text-xs px-2.5 py-1 rounded-md border border-black-600 text-black-300 hover:border-gold-500/40 hover:text-gold-300 transition-all"
                        >
                          Browse
                        </button>
                      </>
                    )}

                    {state.status === 'done' && (
                      <svg
                        className="w-4 h-4 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}

                    {state.status === 'error' && state.file && (
                      <button
                        onClick={() => handleRetry(screenplay, state.file!)}
                        className="text-xs px-2.5 py-1 rounded-md border border-red-500/30 text-red-400 hover:border-red-500/60 hover:bg-red-500/10 transition-all"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {missingPdfScreenplays.length === 0 && (
              <p className="text-center text-black-500 py-6 text-sm">
                All selected screenplays already have PDFs attached.
              </p>
            )}
          </div>
        </div>

        {/* Footer: Done button (always enabled per D-11) */}
        <div className="px-6 py-4 flex justify-end shrink-0 border-t border-black-700/50">
          <button onClick={onClose} className="btn btn-primary text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
