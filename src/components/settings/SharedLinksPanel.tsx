/**
 * SharedLinksPanel — Lists all active share links with revoke.
 * Displayed as a sub-section in Settings > Data tab.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllSharedViews, revokeShareToken } from '@/lib/shareService';
import type { SharedView } from '@/lib/shareService';

const SHARED_VIEWS_KEY = ['shared-views'];

export function SharedLinksPanel() {
    const queryClient = useQueryClient();

    const { data: views, isLoading } = useQuery({
        queryKey: SHARED_VIEWS_KEY,
        queryFn: getAllSharedViews,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const revokeMutation = useMutation({
        mutationFn: ({ token, screenplayId }: { token: string; screenplayId: string }) =>
            revokeShareToken(token, screenplayId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SHARED_VIEWS_KEY });
        },
    });

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
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-black-800/40 border border-black-700/30"
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
                    <button
                        onClick={() =>
                            revokeMutation.mutate({
                                token: view.token,
                                screenplayId: view.screenplayId,
                            })
                        }
                        disabled={revokeMutation.isPending}
                        className="shrink-0 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                        {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
                    </button>
                </div>
            ))}
        </div>
    );
}
