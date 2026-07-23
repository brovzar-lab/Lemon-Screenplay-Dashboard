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
        'absolute left-3 top-3 z-20 flex h-7 w-7 items-center justify-center border shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300',
        isSelected
          ? 'border-gold-300 bg-gold-400 text-black-950 shadow-gold-500/20'
          : 'border-black-500 bg-black-950/85 text-transparent hover:border-gold-400 hover:text-gold-300',
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
