/**
 * VirtualRow Component
 * Renders a single row of screenplay cards inside a virtual scrolling grid.
 * Each card is wrapped in an ErrorBoundary for resilience.
 */

import type { VirtualItem } from '@tanstack/react-virtual';
import { ScreenplayCard } from './ScreenplayCard';
import { ErrorBoundary } from '@/components/ui';
import type { Screenplay } from '@/types';

interface VirtualRowProps {
  virtualRow: VirtualItem;
  screenplays: Screenplay[];
  columnCount: number;
  onCardClick?: (screenplay: Screenplay) => void;
  staggerDelay?: number; // ms delay for initial load animation, 0 = no animation
}

export function VirtualRow({
  virtualRow,
  screenplays,
  columnCount,
  onCardClick,
  staggerDelay = 0,
}: VirtualRowProps) {
  const startIndex = virtualRow.index * columnCount;
  const rowItems = screenplays.slice(startIndex, startIndex + columnCount);

  return (
    <div
      className="absolute top-0 left-0 w-full flex gap-4 md:gap-6"
      style={{
        transform: `translateY(${virtualRow.start}px)`,
        height: `${virtualRow.size}px`,
        ...(staggerDelay > 0
          ? {
              opacity: 0,
              animation: `slide-up-fade 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${staggerDelay}ms forwards`,
            }
          : {}),
      }}
      role="group"
      aria-label={`Row ${virtualRow.index + 1}`}
    >
      {rowItems.map((sp) => (
        <div key={sp.id} className="flex-1 min-w-0" role="listitem">
          <ErrorBoundary
            fallback={
              <div className="card bg-red-500/10 border-red-500/30 h-full">
                <p className="text-red-400 text-sm">
                  Error rendering: {sp.title || 'Unknown'}
                </p>
              </div>
            }
          >
            <ScreenplayCard
              screenplay={sp}
              onClick={() => onCardClick?.(sp)}
            />
          </ErrorBoundary>
        </div>
      ))}
      {/* Fill empty slots in last row for even spacing */}
      {Array.from({ length: columnCount - rowItems.length }).map((_, i) => (
        <div key={`empty-${i}`} className="flex-1 min-w-0" />
      ))}
    </div>
  );
}
