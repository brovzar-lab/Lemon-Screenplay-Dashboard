/**
 * SortableItem Component
 * Draggable sort column item using @dnd-kit
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import type { SortConfig } from '@/types';
import { SORT_FIELD_CONFIG } from '@/types/filters';

interface SortableItemProps {
  config: SortConfig;
  index: number;
  onToggleDirection: () => void;
  onRemove: () => void;
}

export function SortableItem({ config, index, onToggleDirection, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.field });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fieldConfig = SORT_FIELD_CONFIG.find((f) => f.field === config.field);
  const label = fieldConfig?.label || config.field;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
        isDragging
          ? 'bg-gold-500/20 border-gold-500 shadow-lg z-50'
          : 'bg-black-800 border-black-700 hover:border-gold-500/50'
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-black-500 hover:text-gold-400"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </button>

      {/* Priority Badge */}
      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
        {index + 1}
      </span>

      {/* Field Name */}
      <span className="flex-1 text-sm text-black-200">{label}</span>

      {/* Direction Toggle */}
      <button
        onClick={onToggleDirection}
        className="p-1 rounded hover:bg-black-700 text-black-400 hover:text-gold-400 transition-colors"
        title={config.direction === 'asc' ? 'Ascending' : 'Descending'}
      >
        {config.direction === 'asc' ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-red-500/20 text-black-500 hover:text-red-400 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default SortableItem;
