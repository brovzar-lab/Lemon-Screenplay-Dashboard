/**
 * Data Management Settings
 * Export, import, and cache management
 */

import { useState, useEffect } from 'react';
import { useScreenplays, useDeletedScreenplays, useRestoreScreenplay, SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import { useFilterStore } from '@/stores/filterStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { softDeleteAllAnalyses, resetMigrationFlag, getQuarantineCount } from '@/lib/analysisStore';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/stores/toastStore';

export function DataManagement() {
  const { data: screenplays = [] } = useScreenplays();
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const { lists, quickFavorites } = useFavoritesStore();
  const queryClient = useQueryClient();

  const { data: deletedScreenplays = [] } = useDeletedScreenplays();
  const restoreScreenplay = useRestoreScreenplay();

  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeletedList, setShowDeletedList] = useState(false);
  const [quarantineCount, setQuarantineCount] = useState<number>(0);
  const [restoredName, setRestoredName] = useState<string | null>(null);

  useEffect(() => {
    getQuarantineCount().then(setQuarantineCount).catch(() => setQuarantineCount(0));
  }, []);

  const handleExportJSON = () => {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        version: '6.0',
        screenplays: screenplays.map((sp) => ({
          id: sp.id,
          title: sp.title,
          author: sp.author,
          genre: sp.genre,
          subgenres: sp.subgenres,
          themes: sp.themes,
          recommendation: sp.recommendation,
          weightedScore: sp.weightedScore,
          cvsTotal: sp.cvsTotal,
          dimensionScores: sp.dimensionScores,
          producerMetrics: sp.producerMetrics,
          category: sp.category,
        })),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lemon-screenplays-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleExportCSV = () => {
    try {
      const sampleDims = screenplays.length > 0
        ? getDimensionDisplay(screenplays[0])
        : [];
      const dimHeaders = sampleDims.map((d) => d.label);

      const headers = [
        'Title',
        'Author',
        'Genre',
        'Recommendation',
        'Weighted Score',
        'CVS Total',
        ...dimHeaders,
        'Market Potential',
        'Category',
      ];

      const rows = screenplays.map((sp) => {
        const dims = getDimensionDisplay(sp);
        return [
          `"${sp.title.replace(/"/g, '""')}"`,
          `"${sp.author.replace(/"/g, '""')}"`,
          `"${sp.genre}"`,
          sp.recommendation,
          sp.weightedScore.toFixed(2),
          sp.cvsTotal.toFixed(0),
          ...dims.map((d) => d.score.toFixed(1)),
          sp.producerMetrics.marketPotential?.toFixed(1) ?? 'N/A',
          sp.category || 'BLKLST',
        ];
      });

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lemon-screenplays-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleClearCache = () => {
    if (confirm('Clear all cached data? This will reset filters and reload screenplay data.')) {
      window.location.reload();
    }
  };

  const handleResetAll = () => {
    if (confirm('Reset ALL settings? This will clear favorites, lists, filters, and preferences.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleDeleteAllScreenplays = async () => {
    setIsDeleting(true);
    try {
      await softDeleteAllAnalyses();
      resetMigrationFlag();
      await queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
      setShowDeleteAllConfirm(false);
    } catch (err) {
      console.error('[Lemon] Failed to delete all screenplays:', err);
      useToastStore.getState().addToast('Failed to delete all screenplays — please try again');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-display text-gold-200 mb-2">Data Management</h2>
        <p className="text-sm text-black-400">
          Export data, manage cache, and reset settings.
        </p>
      </div>

      {/* Export Section */}
      <div>
        <h3 className="text-lg font-medium text-gold-200 mb-4">Export Data</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleExportJSON}
            className="p-4 rounded-xl bg-black-800/50 border border-black-700 hover:border-gold-500/30 transition-colors text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gold-200">Export JSON</p>
                <p className="text-xs text-black-500">Full data with all fields</p>
              </div>
            </div>
          </button>

          <button
            onClick={handleExportCSV}
            className="p-4 rounded-xl bg-black-800/50 border border-black-700 hover:border-gold-500/30 transition-colors text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gold-200">Export CSV</p>
                <p className="text-xs text-black-500">Spreadsheet compatible</p>
              </div>
            </div>
          </button>
        </div>

        {exportStatus === 'success' && (
          <p className="text-sm text-emerald-400 mt-3">Export completed successfully!</p>
        )}
        {exportStatus === 'error' && (
          <p className="text-sm text-red-400 mt-3">Export failed. Please try again.</p>
        )}
      </div>

      {/* Statistics */}
      <div>
        <h3 className="text-lg font-medium text-gold-200 mb-4">Data Statistics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
            <p className="text-2xl font-bold text-gold-400">{screenplays.length}</p>
            <p className="text-sm text-black-500">Screenplays</p>
          </div>
          <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
            <p className="text-2xl font-bold text-gold-400">{lists.length}</p>
            <p className="text-sm text-black-500">Custom Lists</p>
          </div>
          <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
            <p className="text-2xl font-bold text-gold-400">{quickFavorites.length}</p>
            <p className="text-sm text-black-500">Quick Favorites</p>
          </div>
        </div>
      </div>

      {/* Cache Management */}
      <div>
        <h3 className="text-lg font-medium text-gold-200 mb-4">Cache Management</h3>
        <div className="space-y-3">
          <button
            onClick={() => resetFilters()}
            className="w-full p-4 rounded-lg bg-black-800/50 border border-black-700 hover:border-gold-500/30 transition-colors text-left flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-gold-200">Reset Filters</p>
              <p className="text-sm text-black-500">Clear all active filter selections</p>
            </div>
            <svg className="w-5 h-5 text-black-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            onClick={handleClearCache}
            className="w-full p-4 rounded-lg bg-black-800/50 border border-black-700 hover:border-gold-500/30 transition-colors text-left flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-gold-200">Clear Cache</p>
              <p className="text-sm text-black-500">Refresh screenplay data from source</p>
            </div>
            <svg className="w-5 h-5 text-black-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Recently Deleted */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-medium text-gold-200">Recently Deleted</h3>
          {deletedScreenplays.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400">
              {deletedScreenplays.length}
            </span>
          )}
        </div>
        {deletedScreenplays.length === 0 ? (
          <p className="text-sm text-zinc-500">No recently deleted screenplays</p>
        ) : (
          <div>
            <button
              onClick={() => setShowDeletedList(!showDeletedList)}
              className="w-full p-3 rounded-lg bg-black-800/50 border border-black-700 hover:border-gold-500/30 transition-colors text-left flex items-center justify-between mb-2"
            >
              <span className="text-sm text-gold-200">
                {showDeletedList ? 'Hide' : 'Show'} {deletedScreenplays.length} recoverable {deletedScreenplays.length === 1 ? 'screenplay' : 'screenplays'}
              </span>
              <svg
                className={`w-4 h-4 text-black-400 transition-transform ${showDeletedList ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {restoredName && (
              <div className="mb-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                <span className="text-emerald-400 text-sm">✓</span>
                <span className="text-sm text-emerald-300">
                  &quot;{restoredName}&quot; restored to dashboard
                </span>
              </div>
            )}
            {showDeletedList && (
              <div className="space-y-2">
                {deletedScreenplays.map((item) => {
                  const deletedDate = new Date(item.deletedAt);
                  const daysAgo = Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
                  const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;

                  return (
                    <div
                      key={item.sourceFile}
                      className="flex items-center justify-between p-3 rounded-lg bg-black-800/30 border border-black-700/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gold-200 truncate">{item.title}</p>
                        <p className="text-xs text-zinc-500">Deleted {timeLabel}</p>
                      </div>
                      <button
                        onClick={() => {
                          restoreScreenplay.mutate(item.sourceFile, {
                            onSuccess: () => {
                              setRestoredName(item.title);
                              setTimeout(() => setRestoredName(null), 3000);
                            },
                          });
                        }}
                        disabled={restoreScreenplay.isPending}
                        className="ml-3 px-3 py-1 text-sm font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {restoreScreenplay.isPending ? 'Restoring...' : 'Restore'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quarantine Info */}
      {quarantineCount > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-black-800/30 border border-black-700/50">
          <svg className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-zinc-500">
            {quarantineCount} quarantined {quarantineCount === 1 ? 'document' : 'documents'} with unrecognized formats have been preserved in Firestore for safety and can be reviewed manually.
          </p>
        </div>
      )}

      {/* Danger Zone */}
      <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
        <h3 className="text-lg font-medium text-red-400 mb-4">Danger Zone</h3>
        <div className="space-y-3">
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            className="w-full p-4 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors text-left flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-red-400">Delete All Screenplays</p>
              <p className="text-sm text-red-400/70">
                Soft-delete all {screenplays.length} screenplays (recoverable for 30 days)
              </p>
            </div>
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <button
            onClick={handleResetAll}
            className="w-full p-4 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors text-left flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-red-400">Reset Everything</p>
              <p className="text-sm text-red-400/70">Delete all local data, favorites, and settings</p>
            </div>
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete All Confirmation */}
      <DeleteConfirmDialog
        isOpen={showDeleteAllConfirm}
        onConfirm={handleDeleteAllScreenplays}
        onCancel={() => setShowDeleteAllConfirm(false)}
        title="Delete all screenplays?"
        message="This will remove all screenplays from the dashboard. They can be recovered from the Recently Deleted section within 30 days."
        count={screenplays.length}
        isPending={isDeleting}
      />
    </div>
  );
}

export default DataManagement;
