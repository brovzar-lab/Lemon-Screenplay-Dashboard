/**
 * ProductionBadge Component
 * Displays a badge for screenplays that have been produced as films
 */

import type { TmdbStatus } from '@/types';

interface ProductionBadgeProps {
  tmdbStatus: TmdbStatus | null;
  compact?: boolean;
  className?: string;
}

export function ProductionBadge({ tmdbStatus, compact = false, className = '' }: ProductionBadgeProps) {
  if (!tmdbStatus?.isProduced) return null;

  const tmdbUrl = tmdbStatus.tmdbId
    ? `https://www.themoviedb.org/movie/${tmdbStatus.tmdbId}`
    : null;

  const releaseYear = tmdbStatus.releaseDate
    ? new Date(tmdbStatus.releaseDate).getFullYear()
    : null;

  const title = tmdbStatus.tmdbTitle || 'Unknown';
  const displayText = compact
    ? 'PRODUCED'
    : `PRODUCED${releaseYear ? ` (${releaseYear})` : ''}`;

  const badge = (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        bg-purple-500/20 text-purple-300 text-xs font-medium
        border border-purple-500/30
        ${className}
      `}
      title={`Produced as "${title}"${releaseYear ? ` in ${releaseYear}` : ''}`}
    >
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
      {displayText}
    </span>
  );

  // Wrap in link if we have a TMDB ID
  if (tmdbUrl) {
    return (
      <a
        href={tmdbUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {badge}
      </a>
    );
  }

  return badge;
}

export default ProductionBadge;
