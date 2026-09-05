import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface IntakeConfirmationDialogProps {
  filenames: string[];
  modelName: string;
  engine: 'coverage_v1' | 'v9';
  costEstimate: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function IntakeConfirmationDialog({
  filenames,
  modelName,
  engine,
  costEstimate,
  onCancel,
  onConfirm,
}: IntakeConfirmationDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [paidAnalysisAcknowledged, setPaidAnalysisAcknowledged] = useState(false);
  const projectCount = filenames.length;

  useEffect(() => {
    const priorFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      priorFocus?.focus();
    };
  }, [onCancel]);

  return createPortal(
    <div
      className="discovery-root dsc-scrim fixed inset-0 z-[200] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="intake-confirm-title"
        aria-describedby="intake-confirm-description"
        className="dsc-modal max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[var(--dsc-radius-card)]"
      >
        <div className="border-b border-red-500/25 bg-red-500/10 px-6 py-5 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600 dark:text-red-300">
            {t('Paid analysis authorization')}
          </p>
          <h2 id="intake-confirm-title" className="dsc-display mt-2 text-4xl">
            {t('Authorize paid analysis?')}
          </h2>
          <p id="intake-confirm-description" className="mt-3 max-w-xl text-sm leading-6 text-[var(--dsc-ink-2)]">
            {t(engine === 'coverage_v1'
              ? 'This uploads every screenplay below to the Coverage V1.2 queue. Processing continues in the background, and only sealed reports become Ready.'
              : 'This immediately sends the screenplays below to the emergency V9 reader room. Once submitted, an active screenplay cannot be canceled from this screen.')}
          </p>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="grid gap-px overflow-hidden rounded-xl border border-[var(--dsc-line)] bg-[var(--dsc-line)] sm:grid-cols-3">
            <div className="bg-[var(--dsc-surface-2)] p-4">
              <p className="text-xs uppercase tracking-wider text-[var(--dsc-ink-3)]">{t('Screenplays')}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--dsc-ink)]">{projectCount}</p>
            </div>
            <div className="bg-[var(--dsc-surface-2)] p-4">
              <p className="text-xs uppercase tracking-wider text-[var(--dsc-ink-3)]">{t('Reading route')}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--dsc-ink)]">{modelName}</p>
            </div>
            <div className="bg-[var(--dsc-surface-2)] p-4">
              <p className="text-xs uppercase tracking-wider text-[var(--dsc-ink-3)]">{t('Estimated batch cost')}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--dsc-ink)]">{costEstimate ?? t('Unavailable')}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dsc-ink-3)]">
              {t('Screenplays entering the room')}
            </p>
            <ol className="mt-3 max-h-48 divide-y divide-[var(--dsc-line)] overflow-y-auto rounded-xl border border-[var(--dsc-line)] bg-[var(--dsc-surface-2)]">
              {filenames.map((filename, index) => (
                <li key={`${filename}-${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                  <span className="font-mono text-xs text-[var(--dsc-ink-3)]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="truncate text-sm font-medium text-[var(--dsc-ink)]" title={filename}>{filename}</span>
                </li>
              ))}
            </ol>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <input
              type="checkbox"
              checked={paidAnalysisAcknowledged}
              onChange={(event) => setPaidAnalysisAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 accent-red-600"
            />
            <span>
              <strong className="block text-sm text-[var(--dsc-ink)]">
                {t('I understand that this starts paid AI analysis now.')}
              </strong>
              <span className="mt-1 block text-xs leading-5 text-[var(--dsc-ink-3)]">
                {t('No analysis starts unless you authorize it below. Closing this window or returning to Intake starts nothing.')}
              </span>
            </span>
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button ref={cancelRef} type="button" className="dsc-btn" onClick={onCancel}>
              {t('Return to Intake, start nothing')}
            </button>
            <button
              type="button"
              className="dsc-btn dsc-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!paidAnalysisAcknowledged}
              onClick={onConfirm}
            >
              {t('Authorize paid analysis for {{count}} screenplay', { count: projectCount })}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
