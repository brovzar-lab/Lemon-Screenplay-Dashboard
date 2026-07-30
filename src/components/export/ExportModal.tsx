/**
 * ExportModal Component
 * Modal for exporting screenplays to PDF or CSV
 */

import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { exportToCSV } from './csvExport';
import { PdfDocument } from './PdfDocument';
import { useToastStore } from '@/stores/toastStore';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenplays: Screenplay[];
  mode: 'single' | 'multiple' | 'filtered' | 'selected' | 'all';
  pdfOnly?: boolean;
  showInlineFailure?: boolean;
  presentation?: 'default' | 'discovery';
}

type ExportFormat = 'pdf' | 'csv';

export function ExportModal({
  isOpen,
  onClose,
  screenplays,
  mode,
  pdfOnly = false,
  showInlineFailure = false,
  presentation = 'default',
}: ExportModalProps) {
  const isDiscovery = presentation === 'discovery';
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const effectiveFormat: ExportFormat = pdfOnly ? 'pdf' : format;

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);

    try {
      if (effectiveFormat === 'csv') {
        // CSV export
        const filename = mode === 'single'
          ? screenplays[0].title.replace(/\s+/g, '_')
          : mode === 'filtered'
            ? 'filtered_screenplays'
            : mode === 'all'
              ? 'all_screenplays'
              : 'selected_screenplays';

        exportToCSV(screenplays, filename);
        setExportProgress(100);
      } else {
        // PDF export - generate one PDF per screenplay
        for (let i = 0; i < screenplays.length; i++) {
          const sp = screenplays[i];
          const blob = await pdf(<PdfDocument screenplay={sp} />).toBlob();

          // Create download link
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${sp.title.replace(/\s+/g, '_')}_PitchDeck.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          setExportProgress(Math.round(((i + 1) / screenplays.length) * 100));

          // Small delay between downloads
          if (i < screenplays.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      // Close modal after short delay
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Export failed:', error);
      useToastStore.getState().addToast('Export failed — please try again');
      setExportError('Pitch-deck PDF generation failed. Please try again.');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div
      data-testid="export-modal"
      className={clsx(
        'fixed inset-0 z-50 flex justify-center',
        isDiscovery ? 'items-end p-0 sm:items-center sm:p-4' : 'items-center p-4',
      )}
    >
      {/* Backdrop */}
      <div
        className={isDiscovery ? 'fixed inset-0 dsc-scrim' : 'fixed inset-0 bg-black-950/80 backdrop-blur-sm'}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        data-testid="export-modal-surface"
        data-presentation={presentation}
        className={clsx(
          'relative w-full max-w-md overflow-hidden animate-scale-in',
          isDiscovery
            ? 'dsc-modal max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl'
            : 'glass rounded-xl border border-gold-500/20',
        )}
      >
        {/* Header */}
        <div className={clsx('flex items-center justify-between border-b border-black-700', isDiscovery && 'dsc-modal-header', isDiscovery ? 'p-5 sm:px-6' : 'p-4')}>
          <div>
            {isDiscovery && (
              <p className="dsc-modal-kicker mb-1">
                Presentation ready
              </p>
            )}
            <h3 className={isDiscovery ? 'dsc-modal-title text-2xl' : 'font-display text-lg text-gold-200'}>Export Screenplays</h3>
          </div>
          <button
            onClick={onClose}
            className={isDiscovery ? 'rounded p-1 text-[var(--dsc-ink-2)] hover:bg-[var(--dsc-surface-2)] hover:text-[var(--dsc-ink)]' : 'p-1 rounded hover:bg-black-700 text-black-400 hover:text-gold-400'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={clsx('space-y-4', isDiscovery ? 'p-5 sm:p-6' : 'p-4')}>
          {/* Export Summary */}
          <div className={clsx('p-3', isDiscovery ? 'dsc-row rounded-xl' : 'rounded-lg bg-black-900/50')}>
            <p className={isDiscovery ? 'dsc-muted text-sm' : 'text-sm text-black-400'}>
              <strong className={isDiscovery ? 'text-[var(--dsc-accent)]' : 'text-gold-400'}>
                {mode === 'selected'
                  ? `Exporting ${screenplays.length} selected ${screenplays.length === 1 ? 'screenplay' : 'screenplays'}`
                  : mode === 'filtered'
                    ? `Exporting ${screenplays.length} filtered ${screenplays.length === 1 ? 'screenplay' : 'screenplays'}`
                    : mode === 'all'
                      ? `Exporting all ${screenplays.length} ${screenplays.length === 1 ? 'screenplay' : 'screenplays'}`
                      : mode === 'single'
                        ? `Exporting ${screenplays.length} ${screenplays.length === 1 ? 'screenplay' : 'screenplays'}`
                        : /* 'multiple' */ `Exporting ${screenplays.length} selected ${screenplays.length === 1 ? 'screenplay' : 'screenplays'}`}
              </strong>
            </p>
            {screenplays.length <= 5 && (
              <ul className="mt-2 space-y-1">
                {screenplays.map((sp) => (
                  <li key={sp.id} className={clsx('text-xs text-black-300 flex items-center gap-2', isDiscovery && 'text-[var(--dsc-ink-2)]')}>
                    <span className={clsx(
                      'w-2 h-2 rounded-full',
                      sp.isFilmNow && (isDiscovery ? 'bg-[var(--dsc-success)]' : 'bg-gold-500'),
                      sp.recommendation === 'recommend' && (isDiscovery ? 'bg-[var(--dsc-success)]' : 'bg-emerald-500'),
                      sp.recommendation === 'consider' && (isDiscovery ? 'bg-[var(--dsc-consider)]' : 'bg-amber-500'),
                      sp.recommendation === 'pass' && (isDiscovery ? 'bg-[var(--dsc-pass)]' : 'bg-red-500')
                    )} />
                    {sp.title}
                  </li>
                ))}
              </ul>
            )}
            {screenplays.length > 5 && (
              <p className={clsx('text-xs text-black-500 mt-1', isDiscovery && 'dsc-muted-faint')}>
                {screenplays.slice(0, 3).map((sp) => sp.title).join(', ')} +{screenplays.length - 3} more
              </p>
            )}
          </div>

          {/* Format Selection */}
          {!pdfOnly && <div>
            <label className={clsx('text-sm font-medium text-black-400 block mb-2', isDiscovery && 'dsc-muted')}>Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={clsx(
                  'p-4 rounded-lg border-2 transition-all',
                  format === 'pdf'
                    ? isDiscovery ? 'border-[var(--dsc-accent)] bg-[var(--dsc-accent-soft)]' : 'border-gold-500 bg-gold-500/10'
                    : isDiscovery ? 'border-[var(--dsc-line)] hover:border-[var(--dsc-accent)]' : 'border-black-700 hover:border-black-600'
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className={clsx('w-8 h-8 text-red-500', isDiscovery && 'text-[var(--dsc-pass)]')} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm3-7h6v1H9v-1zm0 2h6v1H9v-1zm0 2h4v1H9v-1z" />
                  </svg>
                  <span className={clsx('text-sm font-medium text-black-200', isDiscovery && 'text-[var(--dsc-ink)]')}>PDF Pitch Deck</span>
                  <span className={clsx('text-xs text-black-500', isDiscovery && 'dsc-muted-faint')}>Professional format</span>
                </div>
              </button>

              <button
                onClick={() => setFormat('csv')}
                className={clsx(
                  'p-4 rounded-lg border-2 transition-all',
                  format === 'csv'
                    ? isDiscovery ? 'border-[var(--dsc-accent)] bg-[var(--dsc-accent-soft)]' : 'border-gold-500 bg-gold-500/10'
                    : isDiscovery ? 'border-[var(--dsc-line)] hover:border-[var(--dsc-accent)]' : 'border-black-700 hover:border-black-600'
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className={clsx('w-8 h-8 text-emerald-500', isDiscovery && 'text-[var(--dsc-success)]')} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 11H7v-1h6v1zm3-3H7V9h9v1zm0-3H7V6h9v1z" />
                  </svg>
                  <span className={clsx('text-sm font-medium text-black-200', isDiscovery && 'text-[var(--dsc-ink)]')}>CSV Spreadsheet</span>
                  <span className={clsx('text-xs text-black-500', isDiscovery && 'dsc-muted-faint')}>Excel compatible</span>
                </div>
              </button>
            </div>
          </div>}

          {/* Format Info */}
          <div className={clsx(
            'p-3',
            isDiscovery ? 'dsc-row rounded-xl' : 'rounded-lg border border-black-700 bg-black-900/30',
          )}>
            {effectiveFormat === 'pdf' ? (
              <div className={clsx('text-xs text-black-400', isDiscovery && 'dsc-muted')}>
                <p className={clsx('font-medium text-black-300 mb-1', isDiscovery && 'text-[var(--dsc-ink)]')}>PDF Pitch Deck includes:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Title page with recommendation badge</li>
                  <li>Core scores and producer metrics</li>
                  <li>Five-pillar or legacy score breakdown</li>
                  <li>Strengths, weaknesses, and development notes</li>
                  <li>Comparable films and production details</li>
                </ul>
              </div>
            ) : (
              <div className={clsx('text-xs text-black-400', isDiscovery && 'dsc-muted')}>
                <p className={clsx('font-medium text-black-300 mb-1', isDiscovery && 'text-[var(--dsc-ink)]')}>CSV Export includes:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>All screenplay metadata and scores</li>
                  <li>Five specialist pillars or legacy scores, plus CVS factors</li>
                  <li>Producer metrics</li>
                  <li>Assessment details</li>
                  <li>Compatible with Excel, Google Sheets</li>
                </ul>
              </div>
            )}
          </div>

          {/* Export Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className={isDiscovery ? 'dsc-muted' : 'text-black-400'}>Exporting...</span>
                <span className={isDiscovery ? 'text-[var(--dsc-accent)]' : 'text-gold-400'}>{exportProgress}%</span>
              </div>
              <div className={isDiscovery ? 'h-2 overflow-hidden rounded-full bg-[var(--dsc-surface-2)]' : 'h-2 bg-black-800 rounded-full overflow-hidden'}>
                <div
                  className={isDiscovery ? 'h-full bg-[var(--dsc-accent)] transition-all duration-300' : 'h-full bg-gold-500 transition-all duration-300'}
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}
          {showInlineFailure && exportError && (
            <p
              role="alert"
              className={clsx('border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300', isDiscovery && 'border-[var(--error)] bg-[var(--error-soft)] text-[var(--on-error)]')}
            >
              {exportError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={clsx('flex items-center justify-end gap-3 border-t border-black-700 p-4', isDiscovery && 'dsc-modal-footer', !isDiscovery && 'bg-black-900/30')}>
          <button onClick={onClose} className="btn btn-ghost" disabled={isExporting}>
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || screenplays.length === 0}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export {screenplays.length} Screenplay{screenplays.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
