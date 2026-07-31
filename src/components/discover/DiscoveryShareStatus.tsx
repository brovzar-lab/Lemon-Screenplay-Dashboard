import { useShareStore } from '@/stores/shareStore';
import type { Screenplay } from '@/types';

export function DiscoveryShareStatus({ screenplay }: { screenplay: Screenplay }) {
  const hasActiveShare = useShareStore((state) => Boolean(state.tokens[screenplay.sourceFile]));

  return (
    <span
      aria-label={`${hasActiveShare ? 'Active share link' : 'Not shared'} for ${screenplay.title}`}
      className={`dsc-label inline-flex items-center gap-1.5 ${
        hasActiveShare ? '!text-[var(--dsc-success)]' : 'dsc-label-faint'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          hasActiveShare ? 'bg-[var(--dsc-success)]' : 'bg-[var(--dsc-ink-3)]'
        }`}
      />
      {hasActiveShare ? 'Link active' : 'Private'}
    </span>
  );
}
