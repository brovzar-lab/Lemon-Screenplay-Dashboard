import { useEffect, useRef } from 'react';
import {
  ContentDetails,
  ModalHeader,
  NotesSection,
  ScoresPanel,
  ShareButton,
} from '@/components/screenplay/modal';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { DiscoveryExportActions } from '@/components/discover/DiscoveryExportActions';
import type { Screenplay } from '@/types';

interface DiscoverDrawerProps {
  screenplay: Screenplay;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DiscoverDrawer({ screenplay, onClose }: DiscoverDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = [...drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    drawer.addEventListener('keydown', handleTab);
    return () => drawer.removeEventListener('keydown', handleTab);
  }, []);

  return (
    <div
      className="dsc-drawer-scrim fixed inset-0 z-50 flex justify-end sm:p-3 sm:pl-10"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discovery-drawer-title"
        data-presentation="discovery"
        className="dsc-drawer animate-slide-in-right flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[var(--dsc-radius-card)]"
      >
        <div className="dsc-drawer-head relative z-10 shrink-0">
          <ModalHeader
            screenplay={screenplay}
            closeButtonRef={closeButtonRef}
            onClose={onClose}
            showActions={false}
            titleId="discovery-drawer-title"
            closeLabel="Close details"
            presentation="discovery"
            supplementalActions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <DiscoveryShareStatus screenplay={screenplay} />
                <ShareButton
                  key={screenplay.sourceFile}
                  screenplay={screenplay}
                  waitForExistingLink
                  presentation="discovery"
                />
                <DiscoveryExportActions screenplay={screenplay} />
              </div>
            }
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-6 p-4 sm:p-6 lg:p-8">
            <section className="dsc-card p-5 sm:p-6" aria-labelledby="drawer-logline">
              <p className="dsc-kicker">The read</p>
              <h3 id="drawer-logline" className="dsc-display mt-2 text-2xl">
                Logline
              </h3>
              <p className="mt-3 text-base leading-7 text-[var(--dsc-ink-2)]">
                {screenplay.logline || 'Logline not yet available.'}
              </p>
              {screenplay.verdictStatement && (
                <p className="mt-4 text-sm italic leading-6 text-[var(--dsc-ink-3)]">
                  {screenplay.verdictStatement}
                </p>
              )}
            </section>

            <section
              data-testid="discovery-scores-panel"
              className="dsc-card p-5 sm:p-6"
              aria-label="Screenplay scores"
            >
              <ScoresPanel screenplay={screenplay} />
            </section>
            <section
              data-testid="discovery-content-details"
              className="dsc-card space-y-8 p-5 sm:p-6"
              aria-label="Screenplay details"
            >
              <ContentDetails screenplay={screenplay} />
            </section>
            <section
              data-testid="discovery-notes-panel"
              className="dsc-card p-5 sm:p-6"
              aria-label="Private notes"
            >
              <NotesSection screenplayId={screenplay.id} />
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}
