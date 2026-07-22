import { useEffect, useMemo, useState } from 'react';
import {
  subscribeToUploadIssues,
  resolveUploadIssues,
  SKIP_REASON_LABELS,
  BAD_FORMAT_REASONS,
  type BadFormatJob,
  type SkipReason,
} from '@/lib/badFormatStore';
import { uploadPdfToIngestQueue } from '@/lib/firebase';
import { useToastStore } from '@/stores/toastStore';

interface BadFormatModalProps {
  open: boolean;
  onClose: () => void;
}

type Filter = 'action' | 'failed' | 'bad' | 'tmdb' | 'dup' | 'all';
type Model = 'haiku' | 'sonnet' | 'opus' | 'hybrid';

function reasonLabel(reason: SkipReason): string {
  return SKIP_REASON_LABELS[reason] || reason;
}

function guidance(job: BadFormatJob): string {
  if (job.status === 'failed' && job.retryable === false) return 'This job cannot be retried safely. Dismiss it, then upload the PDF again and choose whether it is a new revision or a separate project.';
  if (job.status === 'failed') return 'The analysis service could not finish. Retry when you are ready; this starts a paid analysis.';
  if (job.skip_reason === 'insufficient_text_extracted') return 'This is probably a scanned document. Replace it with a searchable OCR PDF.';
  if (job.skip_reason === 'pdf_parse_failed') return 'The PDF is damaged, protected, or encoded in a way the parser cannot read. Replace it with a fresh PDF export.';
  if (job.skip_reason === 'not_a_screenplay_format') return 'The document did not contain standard screenplay scene headings. Replace it with the screenplay version.';
  if (job.skip_reason === 'exceeds_token_budget') return 'The file is too long for one analysis. Replace it with the screenplay only, without appendices.';
  if (job.skip_reason === 'tmdb_already_produced') return 'A produced title may share this name. Dismiss the match or analyze this PDF anyway.';
  if (job.skip_reason === 'already_complete') return 'The exact PDF was analyzed before. Dismiss it, or analyze it again as a new revision.';
  return 'Review the technical details, then dismiss this item or replace the PDF.';
}

function needsReplacement(job: BadFormatJob): boolean {
  return job.status === 'skipped' && BAD_FORMAT_REASONS.includes(job.skip_reason);
}

function canAnalyzeAnyway(job: BadFormatJob): boolean {
  return job.status === 'skipped' && ['tmdb_already_produced', 'already_complete'].includes(job.skip_reason);
}

function canRetry(job: BadFormatJob): boolean {
  return job.status === 'failed' && job.retryable !== false;
}

export function BadFormatModal({ open, onClose }: BadFormatModalProps) {
  const [jobs, setJobs] = useState<BadFormatJob[]>([]);
  const [filter, setFilter] = useState<Filter>('action');
  const [model, setModel] = useState<Model>('sonnet');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    if (!open) return;
    return subscribeToUploadIssues(setJobs);
  }, [open]);

  const retryableFailedIds = useMemo(() => jobs.filter(canRetry).map((job) => job.id), [jobs]);
  const filtered = useMemo(() => {
    if (filter === 'failed') return jobs.filter((job) => job.status === 'failed');
    if (filter === 'bad') return jobs.filter((job) => BAD_FORMAT_REASONS.includes(job.skip_reason));
    if (filter === 'tmdb') return jobs.filter((job) => job.skip_reason === 'tmdb_already_produced');
    if (filter === 'dup') return jobs.filter((job) => job.skip_reason === 'already_complete');
    return jobs;
  }, [filter, jobs]);

  const counts = useMemo(() => ({
    action: jobs.length,
    failed: jobs.filter((job) => job.status === 'failed').length,
    bad: jobs.filter((job) => BAD_FORMAT_REASONS.includes(job.skip_reason)).length,
    tmdb: jobs.filter((job) => job.skip_reason === 'tmdb_already_produced').length,
    dup: jobs.filter((job) => job.skip_reason === 'already_complete').length,
    all: jobs.length,
  }), [jobs]);

  const runAction = async (action: 'retry' | 'dismiss' | 'analyze_anyway', ids: string[]) => {
    setBusyIds((current) => new Set([...current, ...ids]));
    try {
      const updated = await resolveUploadIssues(action, ids, model);
      if (!updated) throw new Error('No eligible issues were changed. Refresh and try again.');
      addToast(
        action === 'dismiss' ? 'Issue dismissed.' : `${updated} ${updated === 1 ? 'analysis' : 'analyses'} queued.`,
        'success',
      );
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'The action failed. Please try again.');
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const confirmPaidAction = (jobIds: string[], duplicate = false) => {
    const count = jobIds.length;
    const message = duplicate
      ? 'Analyze this exact PDF again as a new revision? This starts a paid analysis.'
      : `Retry ${count} ${count === 1 ? 'analysis' : 'analyses'} using ${model}? This starts ${count} paid ${count === 1 ? 'analysis' : 'analyses'}.`;
    if (window.confirm(message)) void runAction(duplicate ? 'analyze_anyway' : 'retry', jobIds);
  };

  const replacePdf = async (job: BadFormatJob, file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      addToast('Choose a PDF file.', 'warning');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      addToast('The replacement PDF must be smaller than 50 MB.', 'warning');
      return;
    }
    setBusyIds((current) => new Set(current).add(job.id));
    try {
      await uploadPdfToIngestQueue(file, job.collection_id, { requestedModel: model });
      await resolveUploadIssues('dismiss', [job.id]);
      addToast('Replacement uploaded and queued for analysis.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'The replacement could not be uploaded.');
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(job.id);
        return next;
      });
    }
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Upload resolution center" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-black-700 bg-black-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-black-700 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-black-50">Upload Resolution Center</h2>
            <p className="mt-1 text-sm text-black-300">Fix failed and skipped uploads without leaving the dashboard.</p>
          </div>
          <button aria-label="Close" title="Close" className="h-11 w-11 text-xl text-black-300 hover:text-black-50" onClick={onClose}>×</button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black-700 px-6 py-3">
          <nav className="flex flex-wrap gap-2" aria-label="Issue filters">
            {([
              ['action', 'Needs Action'], ['failed', 'Failed'], ['bad', 'Bad PDF'],
              ['tmdb', 'Title Match'], ['dup', 'Duplicates'], ['all', 'All'],
            ] as Array<[Filter, string]>).map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} className={`min-h-11 rounded-full border px-3 text-sm ${filter === id ? 'border-blue-400 bg-blue-500/15 text-blue-300' : 'border-black-600 text-black-300 hover:text-black-50'}`}>
                {label} <span className="ml-1 opacity-70">{counts[id]}</span>
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <label className="text-sm text-black-300" htmlFor="resolution-model">Model</label>
            <select id="resolution-model" value={model} onChange={(event) => setModel(event.target.value as Model)} className="min-h-11 rounded border border-black-600 bg-black-800 px-3 text-sm text-black-50">
              <option value="haiku">Haiku, faster</option>
              <option value="sonnet">Sonnet, standard</option>
              <option value="opus">Opus, deepest</option>
              <option value="hybrid">Hybrid</option>
            </select>
            {retryableFailedIds.length > 1 && (
              <button disabled={busyIds.size > 0} onClick={() => confirmPaidAction(retryableFailedIds)} className="min-h-11 rounded bg-blue-500 px-4 text-sm font-semibold text-black-950 disabled:opacity-50">
                Retry All Failed
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-medium text-black-100">Nothing needs attention here.</p>
              <p className="mt-1 text-sm text-black-400">New upload problems will appear automatically.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((job) => {
                const busy = busyIds.has(job.id);
                return (
                  <li key={job.id} className="rounded-md border border-black-700 bg-black-850 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-all text-base font-semibold text-black-50">{job.filename || job.id}</h3>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${job.status === 'failed' || needsReplacement(job) ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>
                            {job.status === 'failed'
                              ? (job.retryable === false ? 'Cannot retry' : 'Analysis failed')
                              : reasonLabel(job.skip_reason)}
                          </span>
                        </div>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-black-200">{guidance(job)}</p>
                        <p className="mt-1 text-xs text-black-400">{job.collection_id}{job.attempt_count ? ` · ${job.attempt_count} attempts` : ''}</p>
                        {(job.last_error || job.tmdb_status?.detail) && (
                          <details className="mt-3 text-xs text-black-300">
                            <summary className="cursor-pointer font-medium text-black-200">Technical details</summary>
                            <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-black-950 p-3 font-mono leading-5">{job.last_error || job.tmdb_status?.detail}</pre>
                          </details>
                        )}
                      </div>
                      <div className="flex min-w-fit flex-wrap gap-2">
                        {canRetry(job) && <button disabled={busy} onClick={() => confirmPaidAction([job.id])} className="min-h-11 rounded bg-blue-500 px-4 text-sm font-semibold text-black-950 disabled:opacity-50">{busy ? 'Working…' : 'Retry Analysis'}</button>}
                        {needsReplacement(job) && (
                          <label className={`flex min-h-11 cursor-pointer items-center rounded bg-blue-500 px-4 text-sm font-semibold text-black-950 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                            {busy ? 'Uploading…' : 'Replace PDF'}
                            <input className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void replacePdf(job, file);
                              event.target.value = '';
                            }} />
                          </label>
                        )}
                        {canAnalyzeAnyway(job) && <button disabled={busy} onClick={() => {
                          const duplicate = job.skip_reason === 'already_complete';
                          const prompt = duplicate
                            ? 'Analyze this exact PDF again as a new revision? This starts a paid analysis.'
                            : 'Ignore the produced-title match and analyze this PDF? This starts a paid analysis.';
                          if (window.confirm(prompt)) void runAction('analyze_anyway', [job.id]);
                        }} className="min-h-11 rounded bg-blue-500 px-4 text-sm font-semibold text-black-950 disabled:opacity-50">Analyze Anyway</button>}
                        <button disabled={busy} onClick={() => void runAction('dismiss', [job.id])} className="min-h-11 rounded border border-black-600 px-4 text-sm font-medium text-black-200 hover:text-black-50 disabled:opacity-50">Dismiss</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="border-t border-black-700 px-6 py-3 text-sm text-black-400">Paid analyses always require confirmation. Replacing a PDF queues the new file and clears the old issue.</footer>
      </section>
    </div>
  );
}

export default BadFormatModal;
