import { useEffect, useRef } from 'react';
import {
  AnalysisWarnings,
  ContentDetails,
  DeferredReaderEvidence,
  ModalHeader,
  NotesSection,
  ProducerTake,
  ScoresPanel,
  ShareButton,
} from '@/components/screenplay/modal';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { DiscoveryExportActions } from '@/components/discover/DiscoveryExportActions';
import type { Screenplay } from '@/types';
import { useIsAdmin } from '@/stores/authStore';

interface DiscoverDrawerProps {
  screenplay: Screenplay;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DiscoverDrawer({ screenplay, onClose }: DiscoverDrawerProps) {
  const isAdmin = useIsAdmin();
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
      className="dsc-drawer-scrim fixed inset-0 z-[100] flex justify-end sm:p-3 sm:pl-10"
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
        className="dsc-drawer animate-slide-in-right relative flex h-full w-full max-w-[76rem] flex-col overflow-hidden rounded-[var(--dsc-radius-card)]"
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
            authorFallback="Unknown writer"
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

        <div className="dsc-drawer-body relative z-10 min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-5 lg:p-6">
            <AnalysisWarnings screenplay={screenplay} />
            <section className="dsc-card p-5 sm:p-6" aria-labelledby="drawer-executive-read">
              <p className="dsc-kicker">The read</p>
              <h3 id="drawer-executive-read" className="dsc-display mt-2 text-3xl">
                Executive read
              </h3>
              <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
                <div>
                  <p className="dsc-label dsc-label-faint">Logline</p>
                  <p className="mt-2 text-base leading-7 text-[var(--dsc-ink-2)]">
                    {screenplay.logline || 'Logline not yet available.'}
                  </p>
                  {screenplay.verdictStatement && (
                    <div className="dsc-executive-verdict mt-5">
                      <p className="dsc-label">Recommendation</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--dsc-ink)]">
                        {screenplay.verdictStatement}
                      </p>
                    </div>
                  )}
                </div>

                <div className="dsc-executive-evidence">
                  <div>
                    <p className="dsc-label">Strengths</p>
                    {screenplay.strengths.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {screenplay.strengths.slice(0, 3).map((strength) => (
                          <li key={strength} className="flex gap-2 text-sm leading-5 text-[var(--dsc-ink-2)]">
                            <span aria-hidden="true" className="text-[var(--dsc-success)]">●</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--dsc-ink-3)]">Not yet available.</p>
                    )}
                  </div>

                  <div>
                    <p className="dsc-label">Watch points</p>
                    {screenplay.weaknesses.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {screenplay.weaknesses.slice(0, 2).map((weakness) => (
                          <li key={weakness} className="flex gap-2 text-sm leading-5 text-[var(--dsc-ink-2)]">
                            <span aria-hidden="true" className="text-[var(--dsc-pass)]">●</span>
                            <span>{weakness}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--dsc-ink-3)]">No watch points recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section
              data-testid="discovery-scores-panel"
              className="dsc-card p-4 sm:p-5"
              aria-label="Screenplay scores"
            >
              <ScoresPanel screenplay={screenplay} />
            </section>
            {isAdmin && <ProducerTake screenplay={screenplay} />}
            <section
              data-testid="discovery-content-details"
              className="dsc-card space-y-7 p-4 sm:p-5"
              aria-label="Screenplay details"
            >
              <ContentDetails screenplay={screenplay} />
            </section>
            <section
              className="dsc-card p-4 sm:p-5"
              aria-label="Specialist reader evidence"
            >
              <DeferredReaderEvidence screenplay={screenplay} />
            </section>
            <section
              data-testid="discovery-notes-panel"
              className="dsc-card p-4 sm:p-5"
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
