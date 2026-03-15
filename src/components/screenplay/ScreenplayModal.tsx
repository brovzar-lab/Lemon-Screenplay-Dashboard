/**
 * ScreenplayModal Component
 * Full detail view for a screenplay with all V3/V5/V6 analysis data.
 *
 * Split-panel layout: hero banner, sticky score bar, left scores / right content,
 * and a floating actions bar at the bottom.
 */

import { useEffect, useRef, useState } from 'react';
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
import { ModalStickyBar } from './modal/ModalStickyBar';
import { ModalActionsBar } from './modal/ModalActionsBar';

interface ScreenplayModalProps {
  screenplay: Screenplay | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ScreenplayModal({ screenplay, isOpen, onClose }: ScreenplayModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const heroBannerRef = useRef<HTMLDivElement>(null);
  const [isHeroBannerHidden, setIsHeroBannerHidden] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 150);
  };

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

  // IntersectionObserver — track hero banner visibility for sticky bar
  useEffect(() => {
    const el = heroBannerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroBannerHidden(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen]);

  if (!isOpen || !screenplay) return null;

  return (
    <div
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
          'relative w-full max-w-4xl my-8 rounded-2xl overflow-hidden',
          'glass border flex flex-col',
          isClosing ? 'animate-scale-out' : 'animate-scale-in',
          screenplay.isFilmNow ? 'border-gold-400 film-now-glow' : 'border-gold-500/20'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[85vh] overflow-y-auto scrollbar-hide relative flex-1">
          {/* Bottom scroll affordance */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black-950/80 to-transparent z-30 rounded-b-2xl" aria-hidden="true" />

          {/* 1. Hero Banner */}
          <div ref={heroBannerRef}>
            <ModalHeader
              screenplay={screenplay}
              closeButtonRef={closeButtonRef}
              onClose={handleClose}
            />
          </div>

          {/* 2. Sticky Score Bar — appears when hero scrolls out */}
          <ModalStickyBar screenplay={screenplay} visible={isHeroBannerHidden} />

          {/* 3. Split Panel */}
          <div className="flex flex-col md:flex-row bg-black-950/50">
            {/* Left: Scores */}
            <div className="md:w-2/5 md:max-w-[360px] p-6 md:border-r border-gold-500/10 space-y-8">
              <ScoresPanel screenplay={screenplay} />
              <ProducerMetricsPanel screenplay={screenplay} />
            </div>

            {/* Right: Content */}
            <div className="flex-1 p-6 space-y-8">
              <AlertBanners screenplay={screenplay} />
              <FilmNowSection screenplay={screenplay} />

              {/* Logline */}
              <div>
                <h3 className="text-lg font-display text-gold-200 mb-4 flex items-center gap-2">
                  <span>📄</span>Logline
                </h3>
                <p className="text-black-300 leading-relaxed">{screenplay.logline}</p>
              </div>

              <ContentDetails screenplay={screenplay} />
              <NotesSection screenplayId={screenplay.id} />
              <FeedbackSection screenplay={screenplay} />
              <ModalFooter screenplay={screenplay} />
            </div>
          </div>

          {/* 4. Poster */}
          <PosterSection screenplay={screenplay} />
        </div>

        {/* 5. Floating Actions Bar — sticky at bottom, outside scroll container */}
        <ModalActionsBar screenplay={screenplay} onClose={handleClose} />
      </div>
    </div>
  );
}

export default ScreenplayModal;
