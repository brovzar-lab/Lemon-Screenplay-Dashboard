/**
 * ScreenplayModal Component
 * Full detail view for a screenplay with all V3/V5/V6 analysis data.
 *
 * Decomposed into sub-components under ./modal/ for maintainability.
 * Shell handles: open/close, focus trap, backdrop, ARIA.
 */

import { useEffect, useRef } from 'react';
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
  ModalFooter,
} from './modal';

interface ScreenplayModalProps {
  screenplay: Screenplay | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ScreenplayModal({ screenplay, isOpen, onClose }: ScreenplayModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on escape key and manage focus / body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
  }, [isOpen, onClose]);

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
      className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className={clsx(
          'relative w-full max-w-4xl my-8 rounded-2xl overflow-hidden animate-scale-in',
          'glass border',
          screenplay.isFilmNow ? 'border-gold-400 film-now-glow' : 'border-gold-500/20'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          screenplay={screenplay}
          closeButtonRef={closeButtonRef}
          onClose={onClose}
        />

        {/* Scrollable Content */}
        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
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
          <ModalFooter screenplay={screenplay} />
        </div>
      </div>
    </div>
  );
}

export default ScreenplayModal;
