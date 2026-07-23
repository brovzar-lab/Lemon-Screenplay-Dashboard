import { clsx } from 'clsx';
import { useIsSelected, useSelectionStore } from '@/stores/selectionStore';
import type { Screenplay } from '@/types';

export function DiscoverySelectionCheckbox({ screenplay }: { screenplay: Screenplay }) {
  const isSelected = useIsSelected(screenplay.id);
  const toggle = useSelectionStore((state) => state.toggle);

  return (
    <button
      type="button"
      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${screenplay.title}`}
      aria-pressed={isSelected}
      onClick={() => toggle(screenplay.id)}
      className={clsx(
        'absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-lg border transition-colors duration-150 ease-out',
        isSelected
          ? 'border-[var(--dsc-accent)] bg-[var(--dsc-accent)] text-[var(--dsc-on-accent)]'
          : 'border-[var(--dsc-line)] bg-[var(--dsc-surface)] text-transparent shadow-[var(--dsc-shadow-card)] hover:border-[var(--dsc-accent)] hover:text-[var(--dsc-accent)]',
      )}
    >
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d="m5 12 4 4L19 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      </svg>
    </button>
  );
}
