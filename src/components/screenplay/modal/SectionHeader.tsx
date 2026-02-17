/**
 * Section header used throughout the modal for consistent heading style.
 */

import type { ReactNode } from 'react';

interface SectionHeaderProps {
    children: ReactNode;
    icon?: string;
}

export function SectionHeader({ children, icon }: SectionHeaderProps) {
    return (
        <h3 className="text-lg font-display text-gold-200 mb-4 flex items-center gap-2">
            {icon && <span>{icon}</span>}
            {children}
        </h3>
    );
}
