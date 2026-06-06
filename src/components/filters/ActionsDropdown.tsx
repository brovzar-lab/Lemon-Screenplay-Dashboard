/**
 * ActionsDropdown
 *
 * Dropdown button in the FilterBar providing bulk actions:
 * - Generate Share Links (opens BulkShareModal)
 * - Re-analyze Selected (opens BulkReanalyzeModal; disabled when no hasPdf eligible)
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface ActionsDropdownProps {
  onGenerateShareLinks: () => void;
  onReanalyze: () => void;
  /** Number of selected screenplays with hasPdf=true */
  reanalyzeEligibleCount: number;
  /** Total selected count (for button badge) */
  selectionCount: number;
}

export function ActionsDropdown({
  onGenerateShareLinks,
  onReanalyze,
  reanalyzeEligibleCount,
  selectionCount,
}: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation for the menu
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    const menu = menuRef.current;
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])'));
    const currentIndex = items.findIndex((item) => item === document.activeElement);

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        items[currentIndex + 1 < items.length ? currentIndex + 1 : 0]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        items[currentIndex - 1 >= 0 ? currentIndex - 1 : items.length - 1]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
    }
  }, [isOpen]);

  // Focus first menu item when menu opens
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
      firstItem?.focus();
    }
  }, [isOpen]);

  const canReanalyze = reanalyzeEligibleCount > 0;

  function handleGenerateShareLinks() {
    onGenerateShareLinks();
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleReanalyze() {
    if (!canReanalyze) return;
    onReanalyze();
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={dropdownRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className="btn btn-secondary text-sm"
        aria-label="Actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        Actions
        {selectionCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
            {selectionCount}
          </span>
        )}
        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Actions menu"
          className="absolute right-0 top-full mt-1 w-52 glass border border-gold-500/20 rounded-lg shadow-xl z-40 overflow-hidden animate-scale-in"
        >
          {/* Generate Share Links */}
          <button
            role="menuitem"
            tabIndex={0}
            onClick={handleGenerateShareLinks}
            className="w-full text-left px-4 py-2.5 text-sm text-black-200 hover:bg-black-700 hover:text-gold-400 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Generate Share Links
          </button>

          {/* Re-analyze Selected */}
          <button
            role="menuitem"
            tabIndex={0}
            onClick={handleReanalyze}
            disabled={!canReanalyze}
            aria-disabled={!canReanalyze}
            title={
              !canReanalyze
                ? 'No eligible screenplays selected (hasPdf required)'
                : undefined
            }
            className="w-full text-left px-4 py-2.5 text-sm text-black-200 hover:bg-black-700 hover:text-gold-400 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Re-analyze Selected
          </button>
        </div>
      )}
    </div>
  );
}
