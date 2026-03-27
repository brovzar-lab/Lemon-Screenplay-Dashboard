/**
 * ScreenplayModal Component
 * Full detail view for a screenplay with all V3/V5/V6 analysis data.
 *
 * Decomposed into sub-components under ./modal/ for maintainability.
 * Shell handles: open/close, focus trap, backdrop, ARIA.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import {
  ModalHeader,
  AlertBanners,
  FilmNowSection,
  ScoresPanel,
  ProducerMetricsPanel,
  ContentDetails,
  NotesSection,
  FeedbackSection,
  ModalFooter,
  PosterSection,
} from './modal';

interface ScreenplayModalProps {
  screenplay: Screenplay | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ScreenplayModal({ screenplay, isOpen, onClose }: ScreenplayModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 150);
  }, [onClose]);

  // Close on escape key and manage focus / body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, handleClose]);

  // Focus trap — keep focus within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  if (!isOpen || !screenplay) return null;

  return (
    <div
      data-testid="screenplay-modal"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 bg-black-950/80 backdrop-blur-sm transition-opacity duration-150',
          isClosing ? 'opacity-0' : 'opacity-100'
        )}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className={clsx(
          'relative w-full max-w-4xl my-8 rounded-2xl flex flex-col',
          'glass border',
          isClosing ? 'animate-scale-out' : 'animate-scale-in',
          screenplay.isFilmNow ? 'border-gold-400 film-now-glow' : 'border-gold-500/20'
        )}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '85vh' }}
      >
        {/* 1. Header — OUTSIDE scroll container so popovers aren't clipped */}
        <div className="relative z-40 shrink-0 rounded-t-2xl overflow-visible">
          <ModalHeader
            screenplay={screenplay}
            closeButtonRef={closeButtonRef}
            onClose={handleClose}
          />
        </div>

        {/* 2. Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          {/* Bottom scroll affordance */}
          <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black-950/80 to-transparent z-30 rounded-b-2xl" aria-hidden="true" />
          <div className="modal-body p-6 space-y-8 bg-black-950/50">
            <AlertBanners screenplay={screenplay} />
            <FilmNowSection screenplay={screenplay} />

            {/* Logline */}
            <div>
              <h3 className="text-lg font-display text-gold-200 mb-4 flex items-center gap-2">
                <span>📄</span>Logline
              </h3>
              <p className="text-black-300 leading-relaxed">{screenplay.logline}</p>
            </div>

            <ScoresPanel screenplay={screenplay} />
            <ProducerMetricsPanel screenplay={screenplay} />
            <ContentDetails screenplay={screenplay} />
            <NotesSection screenplayId={screenplay.id} />
            <FeedbackSection screenplay={screenplay} />
            <ModalFooter screenplay={screenplay} />
          </div>

          {/* 3. Cinematic Poster — generated in background, shown at bottom */}
          <PosterSection screenplay={screenplay} />
        </div>
      </div>
    </div>
  );
}

export default ScreenplayModal;
