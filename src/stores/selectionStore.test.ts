/**
 * Unit Tests for Selection Store
 * Bulk selection state for multi-select operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './selectionStore';

describe('selectionStore', () => {
  beforeEach(() => {
    useSelectionStore.getState().deselectAll();
  });

  describe('toggle', () => {
    it('adds an unselected id to selectedIds', () => {
      useSelectionStore.getState().toggle('id-1');

      expect(useSelectionStore.getState().selectedIds.has('id-1')).toBe(true);
    });

    it('removes a selected id from selectedIds', () => {
      useSelectionStore.getState().toggle('id-1');
      useSelectionStore.getState().toggle('id-1');

      expect(useSelectionStore.getState().selectedIds.has('id-1')).toBe(false);
    });

    it('creates a new Set reference on each toggle (not mutating in place)', () => {
      const before = useSelectionStore.getState().selectedIds;
      useSelectionStore.getState().toggle('id-1');
      const after = useSelectionStore.getState().selectedIds;

      expect(before).not.toBe(after);
    });

    it('supports toggling multiple different ids', () => {
      useSelectionStore.getState().toggle('id-1');
      useSelectionStore.getState().toggle('id-2');

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.has('id-1')).toBe(true);
      expect(selectedIds.has('id-2')).toBe(true);
      expect(selectedIds.size).toBe(2);
    });
  });

  describe('selectAll', () => {
    it('replaces selectedIds with the given ids', () => {
      useSelectionStore.getState().selectAll(['a', 'b', 'c']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.size).toBe(3);
      expect(selectedIds.has('a')).toBe(true);
      expect(selectedIds.has('b')).toBe(true);
      expect(selectedIds.has('c')).toBe(true);
    });

    it('replaces (does not merge) previous selections', () => {
      useSelectionStore.getState().toggle('x');
      useSelectionStore.getState().selectAll(['a', 'b']);

      const { selectedIds } = useSelectionStore.getState();
      expect(selectedIds.has('x')).toBe(false);
      expect(selectedIds.has('a')).toBe(true);
      expect(selectedIds.has('b')).toBe(true);
      expect(selectedIds.size).toBe(2);
    });
  });

  describe('deselectAll', () => {
    it('clears all selections to an empty Set', () => {
      useSelectionStore.getState().toggle('id-1');
      useSelectionStore.getState().toggle('id-2');
      useSelectionStore.getState().deselectAll();

      expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    });
  });

  describe('derived hooks (via getState selector)', () => {
    it('useIsSelected returns true for selected ids', () => {
      useSelectionStore.getState().toggle('id-1');

      // Simulate what useIsSelected does
      const isSelected = useSelectionStore.getState().selectedIds.has('id-1');
      expect(isSelected).toBe(true);
    });

    it('useIsSelected returns false for unselected ids', () => {
      const isSelected = useSelectionStore.getState().selectedIds.has('id-1');
      expect(isSelected).toBe(false);
    });

    it('useSelectionCount returns the Set size', () => {
      useSelectionStore.getState().toggle('a');
      useSelectionStore.getState().toggle('b');
      useSelectionStore.getState().toggle('c');

      const count = useSelectionStore.getState().selectedIds.size;
      expect(count).toBe(3);
    });

    it('useHasSelection returns true when items are selected', () => {
      useSelectionStore.getState().toggle('id-1');

      const hasSelection = useSelectionStore.getState().selectedIds.size > 0;
      expect(hasSelection).toBe(true);
    });

    it('useHasSelection returns false when no items selected', () => {
      const hasSelection = useSelectionStore.getState().selectedIds.size > 0;
      expect(hasSelection).toBe(false);
    });
  });
});
