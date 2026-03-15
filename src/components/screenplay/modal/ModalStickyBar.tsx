/**
 * ModalStickyBar — compact title + score bar that appears
 * when the hero banner scrolls out of view.
 */

import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import type { Screenplay } from '@/types';

interface ModalStickyBarProps {
  screenplay: Screenplay;
  visible: boolean;
}

export function ModalStickyBar({ screenplay, visible }: ModalStickyBarProps) {
  return (
    <div
      className={`sticky top-0 z-10 glass-dark h-12 flex items-center justify-between px-4
        border-b border-gold-500/10 transition-all duration-200
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RecommendationBadge tier={screenplay.recommendation} size="sm" />
        <h4 className="font-heading text-sm text-black-100 truncate">
          {screenplay.title}
        </h4>
      </div>
      <span className="font-mono text-sm font-bold text-gold-400">
        {screenplay.weightedScore?.toFixed(1) ?? '\u2014'}
      </span>
    </div>
  );
}
