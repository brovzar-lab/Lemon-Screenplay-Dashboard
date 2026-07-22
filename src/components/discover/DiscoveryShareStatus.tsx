import { useShareStore } from '@/stores/shareStore';
import type { Screenplay } from '@/types';

export function DiscoveryShareStatus({ screenplay }: { screenplay: Screenplay }) {
  const hasActiveShare = useShareStore((state) => Boolean(state.tokens[screenplay.sourceFile]));

  return (
    <span
      aria-label={`${hasActiveShare ? 'Active share link' : 'Not shared'} for ${screenplay.title}`}
      className={`inline-flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] ${
        hasActiveShare ? 'text-emerald-300' : 'text-black-500'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${hasActiveShare ? 'bg-emerald-400' : 'bg-black-600'}`}
      />
      {hasActiveShare ? 'Shared' : 'Private'}
    </span>
  );
}
