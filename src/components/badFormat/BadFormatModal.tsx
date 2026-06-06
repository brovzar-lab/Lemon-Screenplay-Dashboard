/**
 * Bad Format Modal
 *
 * Lists every PDF the daemon skipped: bad-format files (moved to
 * bad-formats/{collection}/), TMDB-matched produced films, content
 * duplicates. The producer can scan the list, decide if any false
 * positives need rescue, then move on.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  subscribeToSkippedJobs,
  SKIP_REASON_LABELS,
  BAD_FORMAT_REASONS,
  type BadFormatJob,
  type SkipReason,
} from '@/lib/badFormatStore';

interface BadFormatModalProps {
  open: boolean;
  onClose: () => void;
}

function reasonLabel(reason: SkipReason): string {
  return SKIP_REASON_LABELS[reason] || reason;
}

function reasonTint(reason: SkipReason): 'sand' | 'clay' | 'sage' | 'neutral' {
  if (BAD_FORMAT_REASONS.includes(reason)) return 'clay'; // genuine errors
  if (reason === 'tmdb_already_produced') return 'sand'; // informational
  if (reason === 'already_complete') return 'sage';      // duplicate, harmless
  return 'neutral';
}

export function BadFormatModal({ open, onClose }: BadFormatModalProps) {
  const [jobs, setJobs] = useState<BadFormatJob[]>([]);
  const [filter, setFilter] = useState<'all' | 'bad' | 'tmdb' | 'dup'>('bad');

  useEffect(() => {
    if (!open) return;
    const unsub = subscribeToSkippedJobs(setJobs);
    return () => { unsub(); };
  }, [open]);

  const filtered = useMemo(() => {
    if (filter === 'all') return jobs;
    if (filter === 'bad') return jobs.filter((j) => BAD_FORMAT_REASONS.includes(j.skip_reason));
    if (filter === 'tmdb') return jobs.filter((j) => j.skip_reason === 'tmdb_already_produced');
    if (filter === 'dup') return jobs.filter((j) => j.skip_reason === 'already_complete');
    return jobs;
  }, [jobs, filter]);

  const counts = useMemo(
    () => ({
      bad: jobs.filter((j) => BAD_FORMAT_REASONS.includes(j.skip_reason)).length,
      tmdb: jobs.filter((j) => j.skip_reason === 'tmdb_already_produced').length,
      dup: jobs.filter((j) => j.skip_reason === 'already_complete').length,
      all: jobs.length,
    }),
    [jobs],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bad format and skipped files"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'color-mix(in srgb, var(--sp-text) 38%, transparent)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col"
        style={{
          background: 'var(--sp-surface)',
          border: '1px solid var(--sp-border)',
          borderRadius: 'var(--sp-r-xl)',
          boxShadow: 'var(--sp-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3" style={{ borderBottom: '1px solid var(--sp-border)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--sp-text)', margin: 0 }}>
              Skipped Files
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--sp-text-2)' }}>
              Files the daemon did not analyze, with the reason.
            </p>
          </div>
          <button
            aria-label="Close"
            className="px-2 py-1 text-sm"
            onClick={onClose}
            style={{ color: 'var(--sp-text-3)', background: 'transparent', border: 0, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Filter row */}
        <div className="flex gap-2 px-5 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--sp-border)' }}>
          {([
            { id: 'bad', label: 'Bad Format', count: counts.bad },
            { id: 'tmdb', label: 'TMDB Match', count: counts.tmdb },
            { id: 'dup', label: 'Duplicates', count: counts.dup },
            { id: 'all', label: 'All Skipped', count: counts.all },
          ] as const).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--sp-r-full)',
                  fontSize: 'var(--sp-text-xs)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: active ? 'var(--sp-rose-tint)' : 'var(--sp-surface-2)',
                  color: active ? 'var(--sp-rose-strong)' : 'var(--sp-text-2)',
                  border: `1px solid ${active ? 'var(--sp-rose)' : 'var(--sp-border)'}`,
                }}
              >
                {tab.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* Body — list */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--sp-text-3)' }}>
              {jobs.length === 0
                ? 'No skipped files. Once the daemon starts processing uploads, anything it rejects will appear here.'
                : 'No files match this filter.'}
            </div>
          ) : (
            <ul className="space-y-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filtered.map((job) => {
                const tint = reasonTint(job.skip_reason);
                const tintMap: Record<string, { bg: string; color: string }> = {
                  clay: { bg: 'var(--sp-clay-tint)', color: 'var(--sp-clay)' },
                  sand: { bg: 'var(--sp-sand-tint)', color: 'var(--sp-sand)' },
                  sage: { bg: 'var(--sp-sage-tint)', color: 'var(--sp-sage)' },
                  neutral: { bg: 'var(--sp-surface-2)', color: 'var(--sp-text-2)' },
                };
                const reasonColors = tintMap[tint];
                return (
                  <li
                    key={job.id}
                    style={{
                      padding: 'var(--sp-3) var(--sp-4)',
                      borderRadius: 'var(--sp-r-md)',
                      border: '1px solid var(--sp-border)',
                      background: 'var(--sp-surface)',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 'var(--sp-3)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--sp-text)', fontSize: 'var(--sp-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.filename || job.id}
                      </div>
                      <div style={{ color: 'var(--sp-text-3)', fontSize: 11, marginTop: 2, fontFamily: 'var(--sp-mono)' }}>
                        {job.collection_id}
                        {job.tmdb_status?.detail ? ` · ${job.tmdb_status.detail}` : ''}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--sp-r-full)',
                        fontSize: 'var(--sp-text-xs)',
                        fontWeight: 600,
                        background: reasonColors.bg,
                        color: reasonColors.color,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {reasonLabel(job.skip_reason)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 text-xs" style={{ borderTop: '1px solid var(--sp-border)', color: 'var(--sp-text-3)' }}>
          Bad-format PDFs are quarantined in <code style={{ fontFamily: 'var(--sp-mono)' }}>bad-formats/&#123;collection&#125;/</code> on Storage. To rescue one, fix the PDF locally and re-upload — the duplicate-detection will route it back through analysis.
        </div>
      </div>
    </div>
  );
}

export default BadFormatModal;
