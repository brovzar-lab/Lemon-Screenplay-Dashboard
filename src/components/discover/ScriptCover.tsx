import { clsx } from 'clsx';
import { getScreenplayDisplayAuthor, getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

interface ScriptCoverProps {
  title: string;
  author?: string;
  /** Stable seed (project id) so each script keeps its cover tint. */
  seed?: string;
  analysisVersion?: string;
  className?: string;
}

const TINT_COUNT = 5;

function tintFromSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % TINT_COUNT;
}

/**
 * A physical screenplay cover: neutral stock, title block,
 * "Written by" author line, binding dots, and a rev footer. Pure presentation,
 * ported from the approved Compact Shelf reference (.script-cover).
 */
function revisionLabel(analysisVersion: string | undefined, t: TFunction): string {
  const match = analysisVersion?.match(/^v(\d+)(?:_(triage))?/i);
  if (!match) return t('Legacy analysis');
  return t('Revision {{version}}{{triage}}', {
    version: `V${match[1]}`,
    triage: match[2] ? ` ${t('triage')}` : '',
  });
}

export function ScriptCover({ title, author, seed, analysisVersion, className }: ScriptCoverProps) {
  const { t } = useTranslation();
  const displayTitle = getScreenplayDisplayTitle(title).title;
  const displayAuthor = getScreenplayDisplayAuthor(author);
  return (
    <div
      aria-hidden="true"
      data-tint={seed ? tintFromSeed(seed) : 0}
      className={clsx('dsc-cover dsc-cover--container w-full', className)}
    >
      <span className="dsc-cover-art" />
      <span className="dsc-cover-rule" />
      <p className="dsc-cover-title">{displayTitle}</p>
      {displayAuthor && (
        <p className="dsc-cover-author">
          {t('Written by')}
          <br />
          {t(displayAuthor)}
        </p>
      )}
      <span className="dsc-cover-foot">Lemon Studios · {revisionLabel(analysisVersion, t)}</span>
    </div>
  );
}
