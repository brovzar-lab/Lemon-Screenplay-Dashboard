import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface IntakeConfirmationDialogProps {
  isOpen: boolean;
  projectCount: number;
  modelName: string;
  costEstimate: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function IntakeConfirmationDialog({
  isOpen,
  projectCount,
  modelName,
  costEstimate,
  onCancel,
  onConfirm,
}: IntakeConfirmationDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

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
        className="dsc-modal w-full max-w-xl rounded-[var(--dsc-radius-card)] p-6 sm:p-8"
      >
        <p className="dsc-kicker">Final check</p>
        <h2 id="intake-confirm-title" className="dsc-display mt-2 text-4xl">
          Send to the reader room?
        </h2>
        <p id="intake-confirm-description" className="mt-4 leading-7 text-[var(--dsc-ink-2)]">
          {projectCount} screenplay{projectCount === 1 ? '' : 's'} will begin analysis with{' '}
          <strong className="text-[var(--dsc-ink)]">{modelName}</strong>.
          {costEstimate ? ` Estimated batch cost: ${costEstimate}.` : ''}
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--dsc-ink-3)]">
          Closing this window starts nothing. Confirm only when the slate is ready for paid analysis.
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="dsc-btn" onClick={onCancel}>
            Keep editing
          </button>
          <button type="button" className="dsc-btn dsc-btn-primary" onClick={onConfirm}>
            Confirm and start analysis
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
