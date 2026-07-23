import { lazy, Suspense } from 'react';
import type { Screenplay } from '@/types';

const ExportModal = lazy(() =>
  import('@/components/export/ExportModal').then((module) => ({
    default: module.ExportModal,
  })),
);

interface DiscoveryPitchDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenplays: Screenplay[];
  mode: 'single' | 'selected';
}

export function DiscoveryPitchDeckModal({
  isOpen,
  onClose,
  screenplays,
  mode,
}: DiscoveryPitchDeckModalProps) {
  if (!isOpen) return null;

  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="dsc-drawer-scrim fixed inset-0 z-50 flex items-center justify-center text-sm font-medium text-[oklch(0.94_0.012_250)]"
        >
          Loading PDF export tools…
        </div>
      }
    >
      <ExportModal
        isOpen
        onClose={onClose}
        screenplays={screenplays}
        mode={mode}
        pdfOnly
        showInlineFailure
        presentation="discovery"
      />
    </Suspense>
  );
}
