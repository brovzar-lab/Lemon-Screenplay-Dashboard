/**
 * DevExecToggle — Header button to open/close the Dev Exec chat.
 */

import { clsx } from 'clsx';
import { useDevExec } from '@/contexts/DevExecContext';

export function DevExecToggle() {
    const { toggleChat, isOpen, unreadCount } = useDevExec();

    return (
        <button
            onClick={toggleChat}
            className={clsx(
                'relative p-2 rounded-lg transition-all',
                isOpen
                    ? 'text-gold-400 bg-gold-500/10 border border-gold-500/30'
                    : 'text-black-400 hover:text-gold-400 hover:bg-black-800/50',
            )}
            title="Development Executive AI"
            aria-label="Toggle Dev Exec chat"
        >
            <span className="text-lg leading-none">🎬</span>

            {/* Unread badge */}
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold-500 text-black-950 text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount}
                </span>
            )}
        </button>
    );
}
