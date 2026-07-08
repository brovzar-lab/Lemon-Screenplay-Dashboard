/**
 * ThemeSwitcher — dropdown to swap between design systems.
 * Each design system has light/dark variants that react to the
 * sun/moon toggle already in the Header.
 */
import { useState, useRef, useEffect } from 'react';
import { useThemeStore, DESIGN_SYSTEMS, type DesignSystem } from '../../stores/themeStore';

export function ThemeSwitcher() {
  const { designSystem, setDesignSystem, isDark } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const current = DESIGN_SYSTEMS.find((d) => d.id === designSystem) ?? DESIGN_SYSTEMS[0];

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
        style={{
          background: open ? 'var(--sp-accent-soft)' : 'transparent',
          color: open ? 'var(--sp-accent)' : 'var(--sp-text-2)',
          border: 'none',
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'var(--sp-sunken)';
            e.currentTarget.style.color = 'var(--sp-text)';
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--sp-text-2)';
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch design system"
        title="Switch design system"
      >
        {/* Palette icon */}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.88 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
        </svg>
        <span className="hidden sm:inline">{current.label}</span>
        {/* Chevron */}
        <svg
          className="w-3 h-3 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden z-50"
          style={{
            background: 'var(--sp-surface)',
            boxShadow: 'var(--sp-shadow-lg)',
            border: '1px solid var(--sp-border)',
            animation: 'scale-in 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          role="listbox"
          aria-label="Design systems"
        >
          {/* Header */}
          <div
            className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--sp-text-3)', borderBottom: '1px solid var(--sp-border)' }}
          >
            Design System
          </div>

          {/* Options */}
          <div className="p-1.5 max-h-[400px] overflow-y-auto">
            {DESIGN_SYSTEMS.map((ds) => {
              const isActive = ds.id === designSystem;
              const swatch = isDark ? ds.accentDark : ds.accentLight;

              return (
                <button
                  key={ds.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    setDesignSystem(ds.id as DesignSystem);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                  style={{
                    background: isActive ? 'var(--sp-accent-soft)' : 'transparent',
                    color: isActive ? 'var(--sp-accent)' : 'var(--sp-text)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--sp-sunken)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Color swatch */}
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{
                      background: swatch,
                      boxShadow: isActive ? `0 0 0 2px var(--sp-surface), 0 0 0 3.5px ${swatch}` : 'none',
                    }}
                  />

                  {/* Label + description */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold leading-tight">{ds.label}</div>
                    <div
                      className="text-xs leading-tight mt-0.5 truncate"
                      style={{ color: 'var(--sp-text-3)' }}
                    >
                      {ds.description}
                    </div>
                  </div>

                  {/* Checkmark for active */}
                  {isActive && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div
            className="px-4 py-2.5 text-[10px] leading-tight"
            style={{ color: 'var(--sp-text-3)', borderTop: '1px solid var(--sp-border)' }}
          >
            Use the ☀/🌙 toggle to switch light/dark within any design system
          </div>
        </div>
      )}
    </div>
  );
}
