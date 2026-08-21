import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Screenplay } from '@/types';
import { formatAnalysisVersion } from '@/lib/producerDisplay';
import { getScreenplayDisplayAuthor, getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
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
  const displayAuthor = getScreenplayDisplayAuthor(screenplay.author);
  const isCompact = presentation === 'compact';

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
          {displayAuthor && (
            <div className="screenplay-object__byline">
              <span>{t('Written by')}</span>
              <small>{t(displayAuthor)}</small>
            </div>
          )}
          <div className="screenplay-object__folio">
            <span>LEMON STUDIOS</span>
            <span>{t(formatAnalysisVersion(screenplay.analysisVersion))}</span>
          </div>
        </>
      )}
    </div>
  );
}
