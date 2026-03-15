import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 animate-fade-in">
      <div className="text-gold-500/40 mb-6">
        {icon}
      </div>
      <h3 className="font-heading text-xl text-black-200 mb-2 tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-black-400 max-w-xs text-center mb-6">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

export function SpotlightIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M32 8L20 48h24L32 8z" opacity="0.3" />
      <circle cx="32" cy="52" r="8" opacity="0.5" />
      <line x1="32" y1="4" x2="32" y2="12" />
      <line x1="24" y1="6" x2="28" y2="13" />
      <line x1="40" y1="6" x2="36" y2="13" />
    </svg>
  );
}

export function DimmedStarIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M32 8l6 18h18l-14 10 5 18-15-11-15 11 5-18L8 26h18z" opacity="0.4" />
    </svg>
  );
}

export function FilmReelIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="32" cy="32" r="24" opacity="0.3" />
      <circle cx="32" cy="32" r="8" opacity="0.5" />
      <circle cx="32" cy="12" r="3" opacity="0.4" />
      <circle cx="32" cy="52" r="3" opacity="0.4" />
      <circle cx="12" cy="32" r="3" opacity="0.4" />
      <circle cx="52" cy="32" r="3" opacity="0.4" />
    </svg>
  );
}

export function SearchEmptyIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="28" cy="28" r="16" opacity="0.4" />
      <line x1="40" y1="40" x2="54" y2="54" opacity="0.5" strokeWidth="2" />
      <path d="M20 28h16M28 20v16" opacity="0.2" />
    </svg>
  );
}
