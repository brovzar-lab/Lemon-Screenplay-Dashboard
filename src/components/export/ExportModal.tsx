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

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenplays: Screenplay[];
  mode: 'single' | 'multiple' | 'filtered';
}

type ExportFormat = 'pdf' | 'csv';

export function ExportModal({ isOpen, onClose, screenplays, mode }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      if (format === 'csv') {
        // CSV export
        const filename = mode === 'single'
          ? screenplays[0].title.replace(/\s+/g, '_')
          : mode === 'filtered'
            ? 'filtered_screenplays'
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
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black-700">
          <h3 className="text-lg font-display text-gold-200">Export Screenplays</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-black-700 text-black-400 hover:text-gold-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Export Summary */}
          <div className="p-3 bg-black-900/50 rounded-lg">
            <p className="text-sm text-black-400">
              Exporting <strong className="text-gold-400">{screenplays.length}</strong>{' '}
              {screenplays.length === 1 ? 'screenplay' : 'screenplays'}
              {mode === 'multiple' && screenplays.length > 0 && (
                <span className="text-black-500 ml-1">(selected)</span>
              )}
            </p>
            {screenplays.length <= 5 && (
              <ul className="mt-2 space-y-1">
                {screenplays.map((sp) => (
                  <li key={sp.id} className="text-xs text-black-300 flex items-center gap-2">
                    <span className={clsx(
                      'w-2 h-2 rounded-full',
                      sp.isFilmNow && 'bg-gold-500',
                      sp.recommendation === 'recommend' && 'bg-emerald-500',
                      sp.recommendation === 'consider' && 'bg-amber-500',
                      sp.recommendation === 'pass' && 'bg-red-500'
                    )} />
                    {sp.title}
                  </li>
                ))}
              </ul>
            )}
            {screenplays.length > 5 && (
              <p className="text-xs text-black-500 mt-1">
                {screenplays.slice(0, 3).map((sp) => sp.title).join(', ')} +{screenplays.length - 3} more
              </p>
            )}
          </div>

          {/* Format Selection */}
          <div>
            <label className="text-sm font-medium text-black-400 block mb-2">Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={clsx(
                  'p-4 rounded-lg border-2 transition-all',
                  format === 'pdf'
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-black-700 hover:border-black-600'
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm3-7h6v1H9v-1zm0 2h6v1H9v-1zm0 2h4v1H9v-1z" />
                  </svg>
                  <span className="text-sm font-medium text-black-200">PDF Pitch Deck</span>
                  <span className="text-xs text-black-500">Professional format</span>
                </div>
              </button>

              <button
                onClick={() => setFormat('csv')}
                className={clsx(
                  'p-4 rounded-lg border-2 transition-all',
                  format === 'csv'
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-black-700 hover:border-black-600'
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 11H7v-1h6v1zm3-3H7V9h9v1zm0-3H7V6h9v1z" />
                  </svg>
                  <span className="text-sm font-medium text-black-200">CSV Spreadsheet</span>
                  <span className="text-xs text-black-500">Excel compatible</span>
                </div>
              </button>
            </div>
          </div>

          {/* Format Info */}
          <div className="p-3 bg-black-900/30 rounded-lg border border-black-700">
            {format === 'pdf' ? (
              <div className="text-xs text-black-400">
                <p className="font-medium text-black-300 mb-1">PDF Pitch Deck includes:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Title page with recommendation badge</li>
                  <li>Core scores and producer metrics</li>
                  <li>Dimension score breakdown</li>
                  <li>Strengths, weaknesses, and development notes</li>
                  <li>Comparable films and production details</li>
                </ul>
              </div>
            ) : (
              <div className="text-xs text-black-400">
                <p className="font-medium text-black-300 mb-1">CSV Export includes:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>All screenplay metadata and scores</li>
                  <li>Dimension scores and CVS factors</li>
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
                <span className="text-black-400">Exporting...</span>
                <span className="text-gold-400">{exportProgress}%</span>
              </div>
              <div className="h-2 bg-black-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold-500 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-black-700 bg-black-900/30">
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
                Export {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
