/**
 * BulkShareModal — BULK-01
 * Progressive share URL generation modal. Opens from Actions dropdown.
 * Sequentially generates share tokens for all selected screenplays.
 */

import { useRef, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Screenplay } from '@/types';
import { getExistingShareToken, createShareToken } from '@/lib/shareService';
import { useShareStore } from '@/stores/shareStore';

type ShareRowStatus = 'pending' | 'generating' | 'done' | 'failed';

interface ShareRow {
  status: ShareRowStatus;
  url?: string;
}

interface BulkShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenplays: Screenplay[];
  screenplayIdentity?: 'id' | 'sourceFile';
  presentation?: 'default' | 'discovery';
}

export function BulkShareModal({
  isOpen,
  onClose,
  screenplays,
  screenplayIdentity = 'id',
  presentation = 'default',
}: BulkShareModalProps) {
  const { t } = useTranslation();
  const isDiscovery = presentation === 'discovery';
  const [rows, setRows] = useState<Record<string, ShareRow>>(() =>
    Object.fromEntries(screenplays.map((sp) => [sp.id, { status: 'pending' as const }]))
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const hasStartedRef = useRef(false);

  function setRowStatus(id: string, update: Partial<ShareRow>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  }

  async function generateForScreenplay(sp: Screenplay) {
    const screenplayId = screenplayIdentity === 'sourceFile' ? sp.sourceFile : sp.id;

    // 1. Check in-memory cache synchronously (fast path — no service calls needed)
    const cachedToken = useShareStore.getState().tokens[screenplayId];
    const cachedWithUrl = cachedToken as typeof cachedToken & { url?: string };
    if (cachedWithUrl?.token) {
      const url = cachedWithUrl.url ?? `${window.location.origin}/share/${cachedWithUrl.token}`;
      setRowStatus(sp.id, { status: 'done', url });
      // Fall through to refresh via services below
    }

    try {
      // 2. Check Firestore for existing token
      // null = explicit "no existing" → create new
      // undefined = service not configured (test mock) → keep current state
      const existing = await getExistingShareToken(screenplayId);

      if (existing === null) {
        // No existing token in Firestore → create new
        setRowStatus(sp.id, { status: 'generating' });
        const result = await createShareToken(
          screenplayId,
          sp as Parameters<typeof createShareToken>[1],
          false,
        );
        if (result?.url) {
          useShareStore.getState().setToken(screenplayId, {
            token: result.token,
            screenplayId,
            screenplayTitle: sp.title,
            includeNotes: false,
            createdAt: new Date().toISOString(),
          });
          setRowStatus(sp.id, { status: 'done', url: result.url });
        }
      } else if (existing) {
        // Existing token found in Firestore
        const url = `${window.location.origin}/share/${existing.token}`;
        useShareStore.getState().setToken(screenplayId, existing);
        setRowStatus(sp.id, { status: 'done', url });
      }
      // existing === undefined: service returned nothing (not configured) → keep current state
    } catch {
      setRowStatus(sp.id, { status: 'failed' });
    }
  }

  async function runBulkShare(items: Screenplay[]) {
    for (const sp of items) {
      await generateForScreenplay(sp);
    }
  }

  // Start loop once when modal opens
  useEffect(() => {
    if (!isOpen || hasStartedRef.current) return;
    hasStartedRef.current = true;

    // Initialize all rows as pending
    const initial: Record<string, ShareRow> = {};
    for (const sp of screenplays) {
      initial[sp.id] = { status: 'pending' };
    }
    setRows(initial);

    runBulkShare(screenplays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const doneRows = Object.entries(rows).filter(([, r]) => r.status === 'done');
  const doneCount = doneRows.length;
  const total = screenplays.length;

  const doneUrls = doneRows
    .map(([id]) => rows[id]?.url)
    .filter((u): u is string => Boolean(u));

  async function handleCopyAll() {
    await navigator.clipboard.writeText(doneUrls.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  async function handleCopyOne(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className={clsx(
      'fixed inset-0 z-50 flex justify-center',
      isDiscovery ? 'items-end p-0 sm:items-center sm:p-4' : 'items-center p-4',
    )}>
      {/* Backdrop */}
      <div
        className={isDiscovery ? 'fixed inset-0 dsc-scrim' : 'fixed inset-0 bg-black-950/80 backdrop-blur-sm'}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        data-testid="bulk-share-surface"
        data-presentation={presentation}
        className={clsx(
          'relative w-full max-w-lg overflow-hidden animate-scale-in',
          isDiscovery
            ? 'dsc-modal rounded-t-2xl sm:rounded-2xl'
            : 'glass rounded-xl border border-gold-500/20',
        )}
      >
        {/* Header */}
        <div className={clsx('flex items-center justify-between border-b border-black-700', isDiscovery && 'dsc-modal-header', isDiscovery ? 'p-5 sm:px-6' : 'p-4')}>
          <div>
            {isDiscovery && (
              <p className="dsc-modal-kicker mb-1">
                {t('Selected slate')}
              </p>
            )}
            <h3 className={isDiscovery ? 'dsc-modal-title text-2xl' : 'font-display text-lg text-gold-200'}>{t('Generate Share Links')}</h3>
            <p className={isDiscovery ? 'dsc-muted mt-1 text-sm' : 'mt-0.5 text-xs text-black-400'}>
              {t('{{done}} of {{total}} complete', { done: doneCount, total })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              disabled={doneCount === 0}
              aria-label={t('Copy All')}
              className={clsx(
                'btn btn-secondary text-sm',
                doneCount === 0 && 'opacity-40 cursor-not-allowed'
              )}
            >
              {copiedAll ? t('Copied!') : t('Copy All')}
            </button>
            <button
              onClick={onClose}
              className={isDiscovery ? 'rounded p-1 text-[var(--dsc-ink-2)] hover:bg-[var(--dsc-surface-2)] hover:text-[var(--dsc-ink)]' : 'p-1 rounded hover:bg-black-700 text-black-400 hover:text-gold-400'}
              aria-label={t('Close')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Row list */}
        <div className="max-h-96 overflow-y-auto px-4 py-2">
          {screenplays.map((sp) => {
            const row = rows[sp.id] ?? { status: 'pending' as const };
            return (
              <div
                key={sp.id}
              className={clsx(
                'flex items-center gap-3 py-2',
                isDiscovery
                  ? 'dsc-row mb-2 min-h-14 rounded-xl px-3 last:mb-0'
                  : 'border-b border-black-800 last:border-0',
              )}
              >
                <span className={clsx('flex-1 text-sm text-black-300 truncate', isDiscovery && 'text-[var(--dsc-ink)]')}>{sp.title}</span>

                {row.status === 'pending' && (
                  <span className={clsx('text-xs text-black-500', isDiscovery && 'dsc-muted-faint')}>{t('Pending')}</span>
                )}
                {row.status === 'generating' && (
                  <svg className={isDiscovery ? 'animate-spin w-4 h-4 text-[var(--dsc-accent)] shrink-0' : 'animate-spin w-4 h-4 text-gold-400 shrink-0'} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {row.status === 'done' && row.url && (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={clsx('text-xs text-emerald-400 truncate max-w-[200px]', isDiscovery && 'dsc-status-success')}>{row.url}</span>
                    <button
                      onClick={() => handleCopyOne(sp.id, row.url!)}
                      className={isDiscovery ? 'dsc-muted shrink-0 text-xs hover:text-[var(--dsc-accent)]' : 'text-xs text-black-400 hover:text-gold-400 shrink-0'}
                      aria-label={t('Copy {{title}}', { title: sp.title })}
                    >
                      {copiedId === sp.id ? t('Copied!') : t('Copy')}
                    </button>
                  </div>
                )}
                {row.status === 'failed' && (
                  <button
                    onClick={() => generateForScreenplay(sp)}
                    className={clsx('text-xs text-red-400 hover:text-red-300', isDiscovery && 'dsc-status-error hover:text-[var(--error)]')}
                    aria-label={t('Retry')}
                  >
                    {t('Retry')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={clsx('flex justify-end border-t border-black-700 p-4', isDiscovery && 'dsc-modal-footer', !isDiscovery && 'bg-black-900/30')}>
          <button onClick={onClose} className="btn btn-ghost text-sm">
            {t('Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
