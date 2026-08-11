import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { getDownloadURL, ref } from 'firebase/storage';

import { storage, uploadScreenplayPdf } from '@/lib/firebase';
import { getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import { useIsAdmin } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { Screenplay } from '@/types';

type PdfState = 'idle' | 'loading' | 'error' | 'uploading';

interface ScreenplayPdfButtonProps {
  screenplay: Screenplay;
  presentation?: 'default' | 'workspace';
  allowReupload?: boolean;
}

function compatibilityPdfPath(screenplay: Screenplay): string {
  const category = screenplay.category || 'OTHER';
  const safeName = (screenplay.title || screenplay.sourceFile || 'untitled')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `screenplays/${category}/${safeName}.pdf`;
}

export function ScreenplayPdfButton({
  screenplay,
  presentation = 'default',
  allowReupload = true,
}: ScreenplayPdfButtonProps) {
  const isAdmin = useIsAdmin();
  const [pdfState, setPdfState] = useState<PdfState>('idle');
  const reuploadRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  const canReupload = allowReupload && isAdmin;
  const isWorkspace = presentation === 'workspace';
  const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const openPdf = async () => {
    if (pdfState === 'loading') return;
    setPdfState('loading');

    if (screenplay.storagePath) {
      try {
        const archivedUrl = await getDownloadURL(ref(storage, screenplay.storagePath));
        window.open(archivedUrl, '_blank');
        setPdfState('idle');
        return;
      } catch (error) {
        console.warn('[PDF Download] Immutable archive pointer failed:', error);
      }
    }

    const primaryPath = compatibilityPdfPath(screenplay);
    try {
      const primaryUrl = await getDownloadURL(ref(storage, primaryPath));
      window.open(primaryUrl, '_blank');
      setPdfState('idle');
      return;
    } catch (error) {
      console.warn('[PDF Download] Primary path failed:', error);
    }

    const safeName = primaryPath.split('/').at(-1) ?? 'untitled.pdf';
    try {
      const fallbackUrl = await getDownloadURL(ref(storage, `screenplays/${safeName}`));
      window.open(fallbackUrl, '_blank');
      setPdfState('idle');
      return;
    } catch {
      console.warn('[PDF Download] PDF not found in storage. Path tried:', primaryPath);
    }

    setPdfState('error');
    if (isWorkspace) {
      useToastStore.getState().addToast('The source screenplay PDF is not available.', 'warning');
    } else {
      resetTimerRef.current = window.setTimeout(() => setPdfState('idle'), 3000);
    }
  };

  const reuploadPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPdfState('uploading');
    try {
      await uploadScreenplayPdf(file, screenplay.category || 'OTHER', screenplay.title);
      useToastStore.getState().addToast(`PDF uploaded for "${displayTitle}"`);
      setPdfState('idle');
    } catch (error) {
      console.error('[PDF Re-upload]', error);
      useToastStore.getState().addToast('PDF upload failed — please try again');
      setPdfState('error');
    }
    if (reuploadRef.current) reuploadRef.current.value = '';
  };

  const busy = pdfState === 'loading' || pdfState === 'uploading';
  const unavailable = pdfState === 'error' && !canReupload;
  const label =
    pdfState === 'uploading'
      ? 'Uploading…'
      : pdfState === 'loading'
        ? 'Opening…'
        : pdfState === 'error'
          ? isWorkspace && !canReupload
            ? 'Source unavailable'
            : 'Re-Upload PDF'
          : isWorkspace
            ? 'Open screenplay'
            : 'PDF';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={pdfState === 'error' && canReupload ? () => reuploadRef.current?.click() : openPdf}
        disabled={busy || unavailable}
        className={clsx(
          isWorkspace ? 'dsc-btn' : 'btn text-xs',
          'flex items-center gap-1.5 transition-all',
          !isWorkspace && 'px-3 py-1.5',
          !isWorkspace && pdfState !== 'error' && 'btn-primary',
          pdfState === 'error' &&
            !isWorkspace &&
            'border border-amber-500/30 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30',
          busy && 'cursor-wait opacity-60',
          unavailable && 'cursor-not-allowed opacity-55',
        )}
        aria-label={
          busy
            ? `${label} ${displayTitle}`
            : unavailable
              ? `Source screenplay unavailable for ${displayTitle}`
              : isWorkspace
                ? `Open source screenplay for ${displayTitle}`
                : undefined
        }
        title={
          pdfState === 'error'
            ? isWorkspace && !canReupload
              ? 'Source screenplay PDF is unavailable'
              : 'PDF not found — click to re-upload'
            : pdfState === 'uploading'
              ? 'Uploading PDF...'
              : `${isWorkspace ? 'Open' : 'Download'} ${screenplay.sourceFile || screenplay.title}`
        }
      >
        <span aria-hidden="true">{busy ? '◌' : pdfState === 'error' ? '!' : '↗'}</span>
        {label}
      </button>
      {canReupload && (
        <input
          ref={reuploadRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={reuploadPdf}
        />
      )}
    </div>
  );
}
