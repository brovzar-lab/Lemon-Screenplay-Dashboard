/**
 * BackToTopButton Component
 * Floating pill button that scrolls the user back to the top of the grid.
 * Appears after scrolling past a threshold (D-06).
 * Shifts upward when BulkActionBar is visible to avoid overlap.
 */

import { clsx } from 'clsx';
import { useHasSelection } from '@/stores/selectionStore';

interface BackToTopButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function BackToTopButton({ visible, onClick }: BackToTopButtonProps) {
  const hasSelection = useHasSelection();

  return (
    <button
      onClick={onClick}
      className={clsx(
        'fixed right-6 z-40',
        'px-4 py-2 rounded-full',
        'bg-black-800/90 backdrop-blur-sm border border-gold-500/20',
        'text-sm text-gold-300 font-medium',
        'shadow-lg shadow-black-950/50',
        'transition-all duration-300 ease-out',
        'hover:bg-black-700 hover:border-gold-500/40 hover:text-gold-200',
        hasSelection ? 'bottom-20' : 'bottom-6',
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
      aria-label="Scroll to top"
      title="Back to top"
    >
      <span className="flex items-center gap-1.5">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
        Top
      </span>
    </button>
  );
}
