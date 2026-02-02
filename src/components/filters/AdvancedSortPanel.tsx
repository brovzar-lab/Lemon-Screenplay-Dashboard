/**
 * AdvancedSortPanel Component
 * Multi-column sorting with drag-to-reorder
 */

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortStore } from '@/stores/sortStore';
import { SORT_FIELD_CONFIG } from '@/types/filters';
import type { SortField } from '@/types';
import { SortableItem } from './SortableItem';

interface AdvancedSortPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdvancedSortPanel({ isOpen, onClose }: AdvancedSortPanelProps) {
  const {
    sortConfigs,
    prioritizeFilmNow,
    addSortColumn,
    removeSortColumn,
    toggleSortDirection,
    reorderSortColumns,
    setPrioritizeFilmNow,
    resetSort,
  } = useSortStore();

  const [selectedField, setSelectedField] = useState<SortField | ''>('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortConfigs.findIndex((c) => c.field === active.id);
      const newIndex = sortConfigs.findIndex((c) => c.field === over.id);
      reorderSortColumns(oldIndex, newIndex);
    }
  };

  const handleAddColumn = () => {
    if (selectedField && !sortConfigs.find((c) => c.field === selectedField)) {
      addSortColumn(selectedField, 'desc');
      setSelectedField('');
    }
  };

  // Get available fields (not already in sort)
  const availableFields = SORT_FIELD_CONFIG.filter(
    (f) => !sortConfigs.find((c) => c.field === f.field)
  );

  // Group available fields
  const groupedFields = {
    score: availableFields.filter((f) => f.group === 'score'),
    producer: availableFields.filter((f) => f.group === 'producer'),
    dimension: availableFields.filter((f) => f.group === 'dimension'),
    text: availableFields.filter((f) => f.group === 'text'),
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black-700">
          <h3 className="text-lg font-display text-gold-200">Advanced Sorting</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-black-700 text-black-400 hover:text-gold-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* FILM NOW Priority Toggle */}
          <label className="flex items-center gap-3 p-3 rounded-lg bg-black-900/50 cursor-pointer hover:bg-black-800/50">
            <input
              type="checkbox"
              checked={prioritizeFilmNow}
              onChange={(e) => setPrioritizeFilmNow(e.target.checked)}
              className="w-4 h-4 rounded border-black-600 bg-black-800 text-gold-500 focus:ring-gold-500"
            />
            <div>
              <span className="text-sm font-medium text-gold-300">FILM NOW First</span>
              <p className="text-xs text-black-500">Always show FILM NOW screenplays at the top</p>
            </div>
          </label>

          {/* Current Sort Columns */}
          <div>
            <h4 className="text-sm font-medium text-black-400 mb-2">
              Sort Priority {sortConfigs.length > 0 && `(${sortConfigs.length})`}
            </h4>

            {sortConfigs.length === 0 ? (
              <p className="text-sm text-black-500 text-center py-4">
                No sort columns. Add one below.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortConfigs.map((c) => c.field)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {sortConfigs.map((config, index) => (
                      <SortableItem
                        key={config.field}
                        config={config}
                        index={index}
                        onToggleDirection={() => toggleSortDirection(config.field)}
                        onRemove={() => removeSortColumn(config.field)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Add Column */}
          {availableFields.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-black-400 mb-2">Add Sort Column</h4>
              <div className="flex gap-2">
                <select
                  value={selectedField}
                  onChange={(e) => setSelectedField(e.target.value as SortField)}
                  className="flex-1 input py-2 text-sm"
                >
                  <option value="">Select field...</option>
                  {groupedFields.score.length > 0 && (
                    <optgroup label="Scores">
                      {groupedFields.score.map((f) => (
                        <option key={f.field} value={f.field}>{f.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {groupedFields.producer.length > 0 && (
                    <optgroup label="Producer Metrics">
                      {groupedFields.producer.map((f) => (
                        <option key={f.field} value={f.field}>{f.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {groupedFields.dimension.length > 0 && (
                    <optgroup label="Dimensions">
                      {groupedFields.dimension.map((f) => (
                        <option key={f.field} value={f.field}>{f.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {groupedFields.text.length > 0 && (
                    <optgroup label="Text">
                      {groupedFields.text.map((f) => (
                        <option key={f.field} value={f.field}>{f.label}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  onClick={handleAddColumn}
                  disabled={!selectedField}
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-black-700 bg-black-900/30">
          <button onClick={resetSort} className="btn btn-ghost text-sm">
            Reset to Default
          </button>
          <button onClick={onClose} className="btn btn-primary">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdvancedSortPanel;
