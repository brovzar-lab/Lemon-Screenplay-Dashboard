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
      className="fixed inset-0 z-50 flex justify-end bg-black-950/75 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discovery-drawer-title"
        className="animate-slide-in-right flex h-full w-full max-w-5xl flex-col border-l border-gold-500/30 bg-black-950 shadow-[-30px_0_80px_rgba(0,0,0,0.55)]"
      >
        <div className="relative z-10 shrink-0 border-b border-black-700 bg-black-950">
          <ModalHeader
            screenplay={screenplay}
            closeButtonRef={closeButtonRef}
            onClose={onClose}
            showActions={false}
            titleId="discovery-drawer-title"
            closeLabel="Close details"
            supplementalActions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <DiscoveryShareStatus screenplay={screenplay} />
                <ShareButton
                  key={screenplay.sourceFile}
                  screenplay={screenplay}
                  waitForExistingLink
                />
                <DiscoveryExportActions screenplay={screenplay} />
              </div>
            }
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-10 p-5 sm:p-8 lg:p-10">
            <section
              className="border-l-2 border-gold-500/60 pl-5"
              aria-labelledby="drawer-logline"
            >
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gold-400">
                The read
              </p>
              <h3 id="drawer-logline" className="mt-2 font-display text-2xl text-black-50">
                Logline
              </h3>
              <p className="mt-3 text-base leading-7 text-black-200">
                {screenplay.logline || 'Logline not yet available.'}
              </p>
              {screenplay.verdictStatement && (
                <p className="mt-4 text-sm italic leading-6 text-black-400">
                  {screenplay.verdictStatement}
                </p>
              )}
            </section>

            <ScoresPanel screenplay={screenplay} />
            <ContentDetails screenplay={screenplay} />
            <NotesSection screenplayId={screenplay.id} />
          </div>
        </div>
      </aside>
    </div>
  );
}
