import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { formatAnalysisVersion } from '@/lib/producerDisplay';
import { getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import '@/components/discover/screenplay/blue-spine-script.css';

interface BlueSpineScriptProps {
  screenplay: Screenplay;
  className?: string;
  featured?: boolean;
  rank?: number;
}

export function BlueSpineScript({
  screenplay,
  className,
  featured = false,
  rank,
}: BlueSpineScriptProps) {
  const displayTitle = getScreenplayDisplayTitle(screenplay.title);

  return (
    <div
      className={clsx('screenplay-object', featured && 'screenplay-object--featured', className)}
      aria-hidden="true"
    >
      <span className="screenplay-object__spine" />
      <span className="screenplay-object__brad screenplay-object__brad--top" />
      <span className="screenplay-object__brad screenplay-object__brad--bottom" />
      {rank && <span className="screenplay-object__rank">#{rank}</span>}
      <div
        className={clsx(
          'screenplay-object__title-page',
          `screenplay-object__title-page--${displayTitle.length}`,
        )}
      >
        <strong>{displayTitle.title}</strong>
        {displayTitle.qualifier && <em>{displayTitle.qualifier}</em>}
      </div>
      <div className="screenplay-object__byline">
        <span>Written by</span>
        <small>{screenplay.author || 'Unknown writer'}</small>
      </div>
      <div className="screenplay-object__folio">
        <span>LEMON STUDIOS</span>
        <span>{formatAnalysisVersion(screenplay.analysisVersion)}</span>
      </div>
    </div>
  );
}
