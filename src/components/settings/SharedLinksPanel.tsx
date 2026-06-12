/**
 * SharedLinksPanel — Lists all active share links with copy + revoke.
 * Displayed as a sub-section in Settings > Data tab.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllSharedViews, revokeShareToken } from '@/lib/shareService';
import type { SharedView } from '@/lib/shareService';
import { useToastStore } from '@/stores/toastStore';

const SHARED_VIEWS_KEY = ['shared-views'];

export function SharedLinksPanel() {
    const queryClient = useQueryClient();
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const { data: views, isLoading } = useQuery({
        queryKey: SHARED_VIEWS_KEY,
        queryFn: getAllSharedViews,
        staleTime: 1000 * 60 * 5,
    });

    const revokeMutation = useMutation({
        mutationFn: ({ token, screenplayId }: { token: string; screenplayId: string }) =>
            revokeShareToken(token, screenplayId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SHARED_VIEWS_KEY });
        },
    });

    const handleCopy = async (token: string) => {
        const url = `${window.location.origin}/share/${token}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedToken(token);
            useToastStore.getState().addToast('Link copied to clipboard');
            setTimeout(() => setCopiedToken(null), 2000);
        } catch {
            // Fallback for non-HTTPS
            const textarea = document.createElement('textarea');
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopiedToken(token);
            setTimeout(() => setCopiedToken(null), 2000);
        }
    };

    if (isLoading) {
        return (
            <p className="text-sm text-black-500">Loading shared links...</p>
        );
    }

    if (!views || views.length === 0) {
        return (
            <p className="text-sm text-black-500">No active share links</p>
        );
    }

    return (
        <div className="space-y-2">
            {views.map((view: SharedView) => (
                <div
                    key={view.token}
                    className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-black-800/40 border border-black-700/30"
                >
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-gold-200 truncate font-medium">
                            {view.screenplayTitle}
                        </p>
                        <p className="text-xs text-black-500">
                            Created{' '}
                            {new Date(view.createdAt).toLocaleDateString()}
                            {view.includeNotes && (
                                <span className="ml-2 text-black-400">
                                    (with notes)
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Copy URL */}
                        <button
                            onClick={() => handleCopy(view.token)}
                            className="p-1.5 rounded-md text-gold-400/60 hover:text-gold-400 hover:bg-gold-500/10 transition-colors"
                            title="Copy share link"
                        >
                            {copiedToken === view.token ? (
                                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                            )}
                        </button>
                        {/* Revoke */}
                        <button
                            onClick={() =>
                                revokeMutation.mutate({
                                    token: view.token,
                                    screenplayId: view.screenplayId,
                                })
                            }
                            disabled={revokeMutation.isPending}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                            {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
