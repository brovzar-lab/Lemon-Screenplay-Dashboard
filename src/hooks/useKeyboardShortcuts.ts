/**
 * useKeyboardShortcuts — Global keyboard shortcuts for the dashboard.
 *
 * Shortcuts:
 *   / or Cmd+K  → Focus search input
 *   Cmd+F       → Open filter panel (intercepts browser find)
 *   Escape      → Clear search / close panels
 */

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutOptions {
    onFocusSearch: () => void;
    onToggleFilters: () => void;
}

export function useKeyboardShortcuts({ onFocusSearch, onToggleFilters }: KeyboardShortcutOptions) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't trigger shortcuts when user is typing in an input
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

        // Escape: blur focused input
        if (e.key === 'Escape' && isTyping) {
            (target as HTMLElement).blur();
            return;
        }

        // Cmd+K: Always focus search (even when typing)
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onFocusSearch();
            return;
        }

        // Cmd+F: Open filter panel instead of browser find
        if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onToggleFilters();
            return;
        }

        // Skip single-key shortcuts when typing
        if (isTyping) return;

        // / : Focus search
        if (e.key === '/' || e.key === 's') {
            e.preventDefault();
            onFocusSearch();
        }
    }, [onFocusSearch, onToggleFilters]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}
