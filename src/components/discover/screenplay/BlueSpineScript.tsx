import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { formatAnalysisVersion } from '@/lib/producerDisplay';
import { getScreenplayDisplayAuthor, getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import { useTranslation } from 'react-i18next';
import '@/components/discover/screenplay/blue-spine-script.css';

interface BlueSpineScriptProps {
  screenplay: Screenplay;
  className?: string;
  featured?: boolean;
  rank?: number;
  presentation?: 'full' | 'compact';
}

export function BlueSpineScript({
  screenplay,
  className,
  featured = false,
  rank,
  presentation = 'full',
}: BlueSpineScriptProps) {
  const { t } = useTranslation();
  const displayTitle = getScreenplayDisplayTitle(screenplay.title);
  const isCompact = presentation === 'compact';
  const posterUrl =
    screenplay.recommendation === 'pass' ? '/pass-poster-archive.jpg' : screenplay.posterUrl;

  if (posterUrl) {
    return (
      <div
        className={clsx(
          'screenplay-object screenplay-object--poster',
          featured && 'screenplay-object--featured',
          isCompact && 'screenplay-object--compact',
          className,
        )}
      >
        <img
          src={posterUrl}
          loading={featured ? 'eager' : 'lazy'}
          decoding="async"
          alt={
            screenplay.recommendation === 'pass'
              ? t('Poster withheld for a Pass verdict')
              : t('{{title}} poster', { title: displayTitle.title })
          }
        />
        {!isCompact && rank && <span className="screenplay-object__rank">#{rank}</span>}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'screenplay-object',
        featured && 'screenplay-object--featured',
        isCompact && 'screenplay-object--compact',
        className,
      )}
      aria-hidden="true"
    >
      <span className="screenplay-object__spine" />
      <span className="screenplay-object__brad screenplay-object__brad--top" />
      <span className="screenplay-object__brad screenplay-object__brad--bottom" />
      {!isCompact && rank && <span className="screenplay-object__rank">#{rank}</span>}
      <div
        className={clsx(
          'screenplay-object__title-page',
          `screenplay-object__title-page--${displayTitle.length}`,
        )}
      >
        <strong>{displayTitle.title}</strong>
        {!isCompact && displayTitle.qualifier && <em>{displayTitle.qualifier}</em>}
      </div>
      {!isCompact && (
        <>
          {getScreenplayDisplayAuthor(screenplay.author) && (
            <div className="screenplay-object__byline">
              <span>Written by</span>
              <small>{getScreenplayDisplayAuthor(screenplay.author)}</small>
            </div>
          )}
          <div className="screenplay-object__folio">
            <span>LEMON STUDIOS</span>
            <span>{formatAnalysisVersion(screenplay.analysisVersion)}</span>
          </div>
        </>
      )}
    </div>
  );
}
