/**
 * DeleteConfirmDialog Component
 * Reusable confirmation dialog for destructive delete actions
 */

import { useEffect, useRef } from 'react';

interface DeleteConfirmDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
    count?: number;
    isPending?: boolean;
}

export function DeleteConfirmDialog({
    isOpen,
    onConfirm,
    onCancel,
    title,
    message,
    count,
    isPending = false,
}: DeleteConfirmDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);

    // Focus cancel button on open, handle Escape
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };

        document.addEventListener('keydown', handleEscape);
        setTimeout(() => cancelRef.current?.focus(), 100);

        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={onCancel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
        >
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" aria-hidden="true" />

            {/* Dialog */}
            <div
                className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-black-900 p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                    <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                </div>

                {/* Content */}
                <h3 id="delete-dialog-title" className="text-center text-lg font-display text-gold-100 mb-2">
                    {title}
                </h3>
                <p id="delete-dialog-desc" className="text-center text-sm text-black-400 mb-1">
                    {message}
                </p>
                {count !== undefined && count > 1 && (
                    <p className="text-center text-xs text-red-400 font-medium mb-4">
                        {count} screenplay{count > 1 ? 's' : ''} will be permanently deleted
                    </p>
                )}
                <p className="text-center text-xs text-black-500 mb-6">
                    This action cannot be undone.
                </p>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button
                        ref={cancelRef}
                        onClick={onCancel}
                        className="btn btn-secondary text-sm px-4 py-2"
                        disabled={isPending}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="text-sm px-4 py-2 rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                        disabled={isPending}
                    >
                        {isPending ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DeleteConfirmDialog;
