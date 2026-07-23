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
      className="group/check absolute left-1 top-1 z-20 flex h-11 w-11 items-center justify-center"
    >
      <span
        aria-hidden="true"
        className={clsx(
          'flex h-[22px] w-[22px] items-center justify-center rounded-md border transition-colors duration-150 ease-out',
          isSelected
            ? 'border-[var(--dsc-accent)] bg-[var(--dsc-accent)] text-[var(--dsc-on-accent)]'
            : 'border-[var(--dsc-line-strong,var(--dsc-line))] bg-[var(--dsc-surface)] text-transparent group-hover/check:border-[var(--dsc-accent)] group-hover/check:text-[var(--dsc-accent)]',
        )}
      >
      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
        <path
          d="m5 12 4 4L19 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      </svg>
      </span>
    </button>
  );
}
