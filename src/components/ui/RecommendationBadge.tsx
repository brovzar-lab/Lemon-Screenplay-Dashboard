import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { RECOMMENDATION_CONFIG } from '@/types';

interface RecommendationBadgeProps {
  tier: Screenplay['recommendation'];
  size?: 'sm' | 'lg';
}

export function RecommendationBadge({ tier, size = 'sm' }: RecommendationBadgeProps) {
  const config = RECOMMENDATION_CONFIG[tier];

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center font-bold uppercase tracking-wider rounded-lg',
        size === 'lg' ? 'px-6 py-3 text-lg' : 'px-3 py-1 text-xs',
        tier === 'film_now' && 'badge-film-now animate-pulse-glow',
        tier === 'recommend' && 'badge-recommend',
        tier === 'consider' && 'badge-consider',
        tier === 'pass' && 'badge-pass'
      )}
    >
      {config.label}
    </span>
  );
}
