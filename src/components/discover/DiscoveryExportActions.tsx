import { useState } from 'react';
import { clsx } from 'clsx';
import { DiscoveryPitchDeckModal } from '@/components/discover/DiscoveryPitchDeckModal';
import { useToastStore } from '@/stores/toastStore';
import type { Screenplay } from '@/types';

type CoverageState = 'idle' | 'loading' | 'error';

export function DiscoveryExportActions({ screenplay }: { screenplay: Screenplay }) {
  const [coverageState, setCoverageState] = useState<CoverageState>('idle');
  const [showPitchDeckModal, setShowPitchDeckModal] = useState(false);

  const downloadCoverage = async () => {
    if (coverageState === 'loading') return;

    setCoverageState('loading');
    try {
      const { downloadCoveragePdf } = await import('@/components/export/exportCoverage');
      await downloadCoveragePdf(screenplay);
      setCoverageState('idle');
    } catch (error) {
      console.error('[Discovery Coverage PDF] Generation failed:', error);
      useToastStore
        .getState()
        .addToast('Coverage PDF generation failed — please try again');
      setCoverageState('error');
    }
  };

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={downloadCoverage}
            disabled={coverageState === 'loading'}
            aria-label={
              coverageState === 'loading'
                ? 'Generating coverage PDF'
                : coverageState === 'error'
                  ? 'Retry coverage PDF'
                  : 'Download coverage PDF'
            }
            className={clsx(
              'border px-3 py-1.5 text-xs font-semibold transition-colors',
              coverageState === 'error'
                ? 'border-red-500/50 bg-red-500/10 text-red-300'
                : 'border-black-500 text-black-200 hover:border-gold-500/60 hover:text-gold-200',
              coverageState === 'loading' && 'cursor-wait opacity-60',
            )}
          >
            {coverageState === 'loading'
              ? 'Generating coverage…'
              : coverageState === 'error'
                ? 'Retry coverage'
                : 'Coverage PDF'}
          </button>
          <button
            type="button"
            onClick={() => setShowPitchDeckModal(true)}
            className="border border-black-500 px-3 py-1.5 text-xs font-semibold text-black-200 transition-colors hover:border-gold-500/60 hover:text-gold-200"
          >
            Pitch-deck PDF
          </button>
        </div>
        {coverageState === 'error' && (
          <span role="alert" className="text-xs text-red-300">
            Coverage PDF failed. Please try again.
          </span>
        )}
      </div>

      <DiscoveryPitchDeckModal
        isOpen={showPitchDeckModal}
        onClose={() => setShowPitchDeckModal(false)}
        screenplays={[screenplay]}
        mode="single"
      />
    </>
  );
}
