import { lazy, Suspense } from 'react';

import type { Screenplay } from '@/types';

const ReaderEvidencePanel = lazy(() =>
  import('@/components/screenplay/modal/ReaderEvidencePanel').then((module) => ({
    default: module.ReaderEvidencePanel,
  })),
);

export function DeferredReaderEvidence({ screenplay }: { screenplay: Screenplay }) {
  return (
    <Suspense
      fallback={(
        <div className="rounded-xl border border-black-700 bg-black-900/30 p-4">
          <p className="text-sm text-black-400">Opening specialist evidence…</p>
        </div>
      )}
    >
      <ReaderEvidencePanel screenplay={screenplay} />
    </Suspense>
  );
}
