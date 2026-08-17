import { lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  if (!isOpen) return null;
  const host = document.querySelector('.discovery-root') ?? document.body;

  return createPortal(
    <Suspense
      fallback={
        <div
          role="status"
          className="dsc-drawer-scrim fixed inset-0 z-50 flex items-center justify-center text-sm font-medium text-[oklch(0.94_0.012_250)]"
        >
          {t('Loading PDF export tools…')}
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
    </Suspense>,
    host,
  );
}
