/**
 * ShareButton — Gold share button with inline popover.
 * Generates a shareable URL via shareService, copies to clipboard,
 * toggles notes inclusion, and supports revoking.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Screenplay } from '@/types';
import {
    createShareToken,
    revokeShareToken,
    getExistingShareToken,
    isScreenplaySynced,
} from '@/lib/shareService';
import { useShareStore } from '@/stores/shareStore';
import { useToastStore } from '@/stores/toastStore';

interface ShareButtonProps {
    screenplay: Screenplay;
}

const SHARE_BASE_URL = 'https://lemon-screenplay-dashboard.web.app/share';

export function ShareButton({ screenplay }: ShareButtonProps) {
    const screenplayId = screenplay.sourceFile;

    const [showPopover, setShowPopover] = useState(false);
    const [copied, setCopied] = useState(false);
    const [includeNotes, setIncludeNotes] = useState(false);
    const [synced, setSynced] = useState<boolean | null>(null);
    const [confirmRevoke, setConfirmRevoke] = useState(false);

    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const cachedToken = useShareStore((s) => s.tokens[screenplayId]);

    // Check sync status on mount
    useEffect(() => {
        let cancelled = false;
        isScreenplaySynced(screenplayId).then((result) => {
            if (!cancelled) setSynced(result);
        }).catch(() => {
            if (!cancelled) setSynced(false);
        });
        return () => { cancelled = true; };
    }, [screenplayId]);

    // Check for existing token on mount (cache miss -> Firestore lookup)
    useEffect(() => {
        if (cachedToken) {
            setIncludeNotes(cachedToken.includeNotes);
            return;
        }

        let cancelled = false;
        getExistingShareToken(screenplayId).then((view) => {
            if (!cancelled && view) {
                useShareStore.getState().setToken(screenplayId, view);
                setIncludeNotes(view.includeNotes);
            }
        }).catch(() => {
            // Silently ignore lookup failures
        });
        return () => { cancelled = true; };
    }, [screenplayId, cachedToken]);

    // Close popover on outside click
    useEffect(() => {
        if (!showPopover) return;

        const handleClick = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target as Node)
            ) {
                setShowPopover(false);
                setConfirmRevoke(false);
            }
        };

        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showPopover]);

    // Create token mutation
    const createMutation = useMutation({
        mutationFn: () =>
            createShareToken(screenplayId, screenplay.title, includeNotes),
        onSuccess: (result) => {
            useShareStore.getState().setToken(screenplayId, {
                token: result.token,
                screenplayId,
                screenplayTitle: screenplay.title,
                includeNotes,
                createdAt: new Date().toISOString(),
            });
            setShowPopover(true);
        },
        onError: () => {
            useToastStore.getState().addToast('Failed to create share link');
        },
    });

    // Revoke token mutation
    const revokeMutation = useMutation({
        mutationFn: () => {
            if (!cachedToken) throw new Error('No token to revoke');
            return revokeShareToken(cachedToken.token, screenplayId);
        },
        onSuccess: () => {
            setShowPopover(false);
            setConfirmRevoke(false);
        },
        onError: () => {
            useToastStore.getState().addToast('Failed to revoke share link');
        },
    });

    const handleClick = () => {
        if (synced === false) {
            useToastStore
                .getState()
                .addToast(
                    "This screenplay hasn't synced to Firestore yet. Wait for sync to complete before sharing.",
                    'warning',
                );
            return;
        }

        if (cachedToken) {
            setShowPopover(true);
        } else {
            createMutation.mutate();
        }
    };

    const shareUrl = cachedToken
        ? `${SHARE_BASE_URL}/${cachedToken.token}`
        : '';

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            useToastStore
                .getState()
                .addToast('Failed to copy to clipboard');
        }
    }, [shareUrl]);

    const handleNotesToggle = useCallback(async () => {
        const newValue = !includeNotes;
        setIncludeNotes(newValue);

        if (cachedToken) {
            // Update Firestore doc
            try {
                const docRef = doc(db, 'shared_views', cachedToken.token);
                await setDoc(docRef, { includeNotes: newValue }, { merge: true });
                // Update cache
                useShareStore.getState().setToken(screenplayId, {
                    ...cachedToken,
                    includeNotes: newValue,
                });
            } catch {
                useToastStore
                    .getState()
                    .addToast('Failed to update notes setting');
                setIncludeNotes(!newValue); // Revert
            }
        }
    }, [includeNotes, cachedToken, screenplayId]);

    const isDisabled =
        synced === false || createMutation.isPending || synced === null;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={handleClick}
                disabled={isDisabled}
                className={`text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-all border ${
                    isDisabled
                        ? 'bg-black-700/50 text-black-500 border-black-600/30 cursor-not-allowed'
                        : 'bg-gold-500/90 hover:bg-gold-400 text-black-900 border-gold-400/50 shadow-sm shadow-gold-500/20'
                }`}
                title={
                    synced === false
                        ? 'Sync pending -- wait for Firestore sync before sharing'
                        : synced === null
                          ? 'Checking sync status...'
                          : 'Share this screenplay'
                }
            >
                {createMutation.isPending ? (
                    <svg
                        className="w-3.5 h-3.5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                        />
                    </svg>
                ) : (
                    <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                    </svg>
                )}
                Share
            </button>

            {/* Popover */}
            {showPopover && cachedToken && (
                <div
                    ref={popoverRef}
                    className="absolute top-full mt-2 right-0 z-50 w-80 rounded-lg border border-gold-500/20 bg-black-800 shadow-xl shadow-black/40 p-4"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gold-200">
                            Share Link
                        </span>
                        <button
                            onClick={() => {
                                setShowPopover(false);
                                setConfirmRevoke(false);
                            }}
                            className="text-black-400 hover:text-black-200 p-0.5"
                            aria-label="Close popover"
                        >
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* URL display + copy */}
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 bg-black-900/60 rounded px-2.5 py-1.5 text-xs text-black-300 truncate border border-black-700/50 select-all">
                            {shareUrl}
                        </div>
                        <button
                            onClick={handleCopy}
                            className={`shrink-0 text-xs px-2.5 py-1.5 rounded font-medium transition-all border ${
                                copied
                                    ? 'bg-green-600/20 text-green-400 border-green-500/30'
                                    : 'bg-gold-500/20 text-gold-300 border-gold-500/30 hover:bg-gold-500/30'
                            }`}
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>

                    {/* Include Notes toggle */}
                    <label className="flex items-center gap-2 mb-3 cursor-pointer text-sm text-black-300 hover:text-black-200">
                        <input
                            type="checkbox"
                            checked={includeNotes}
                            onChange={handleNotesToggle}
                            className="w-3.5 h-3.5 rounded border-black-600 bg-black-900 text-gold-500 focus:ring-gold-500/30"
                        />
                        Include notes
                    </label>

                    {/* Revoke button */}
                    <div className="border-t border-black-700/50 pt-3">
                        {confirmRevoke ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-red-400">
                                    Revoke this link?
                                </span>
                                <button
                                    onClick={() => revokeMutation.mutate()}
                                    disabled={revokeMutation.isPending}
                                    className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 font-medium transition-all"
                                >
                                    {revokeMutation.isPending
                                        ? 'Revoking...'
                                        : 'Confirm'}
                                </button>
                                <button
                                    onClick={() => setConfirmRevoke(false)}
                                    className="text-xs px-2 py-1 rounded text-black-400 hover:text-black-200 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmRevoke(true)}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                                Revoke link
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
