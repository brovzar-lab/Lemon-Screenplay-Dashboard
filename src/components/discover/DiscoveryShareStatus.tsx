import { useShareStore } from '@/stores/shareStore';
import { getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import type { Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

export function DiscoveryShareStatus({ screenplay }: { screenplay: Screenplay }) {
  const { t } = useTranslation();
  const hasActiveShare = useShareStore((state) => Boolean(state.tokens[screenplay.sourceFile]));

  if (!hasActiveShare) return null;

  const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;

  return (
    <span
      aria-label={t('Active share link for {{title}}', { title: displayTitle })}
      className="dsc-label inline-flex items-center gap-1.5 !text-[var(--dsc-success)]"
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-[var(--dsc-success)]"
      />
      {t('Active share link')}
    </span>
  );
}
