import { useRef, useState } from 'react';
import { clsx } from 'clsx';
import { DiscoveryPitchDeckModal } from '@/components/discover/DiscoveryPitchDeckModal';
import { useToastStore } from '@/stores/toastStore';
import type { Screenplay } from '@/types';

type CoverageState = 'idle' | 'loading' | 'error';

export function DiscoveryExportActions({ screenplay }: { screenplay: Screenplay }) {
  const [coverageState, setCoverageState] = useState<CoverageState>('idle');
  const [showPitchDeckModal, setShowPitchDeckModal] = useState(false);
  const pitchDeckButtonRef = useRef<HTMLButtonElement>(null);

  const closePitchDeck = () => {
    setShowPitchDeckModal(false);
    window.requestAnimationFrame(() => pitchDeckButtonRef.current?.focus());
  };

  const downloadCoverage = async () => {
    if (coverageState === 'loading') return;

    setCoverageState('loading');
    try {
      const { downloadCoveragePdf } = await import('@/components/export/exportCoverage');
      await downloadCoveragePdf(screenplay);
      setCoverageState('idle');
    } catch (error) {
      console.error('[Discovery Coverage PDF] Generation failed:', error);
      useToastStore.getState().addToast('Coverage PDF generation failed — please try again');
      setCoverageState('error');
    }
  };

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            ref={pitchDeckButtonRef}
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
              'dsc-btn !px-3',
              coverageState === 'error' &&
                '!border-[color-mix(in_oklch,var(--dsc-pass)_45%,var(--dsc-line))] !bg-[var(--dsc-pass-soft)] !text-[var(--dsc-pass)]',
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
            className="dsc-btn !px-3"
          >
            Pitch-deck PDF
          </button>
        </div>
        {coverageState === 'error' && (
          <span
            role="alert"
            className="rounded-md bg-[var(--dsc-pass-soft)] px-2 py-1 text-xs text-[var(--dsc-pass)]"
          >
            Coverage PDF failed. Please try again.
          </span>
        )}
      </div>

      <DiscoveryPitchDeckModal
        isOpen={showPitchDeckModal}
        onClose={closePitchDeck}
        screenplays={[screenplay]}
        mode="single"
      />
    </>
  );
}
