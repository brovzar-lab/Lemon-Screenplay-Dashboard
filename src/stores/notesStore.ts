/**
 * Notes State Store
 * Manages screenplay notes/comments with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Note, NotesState } from '@/types';

interface NotesActions {
  // Add a note to a screenplay
  addNote: (screenplayId: string, content: string, author?: string) => void;

  // Update an existing note
  updateNote: (screenplayId: string, noteId: string, content: string) => void;

  // Delete a note
  deleteNote: (screenplayId: string, noteId: string) => void;

  // Get notes for a screenplay
  getNotesForScreenplay: (screenplayId: string) => Note[];

  // Clear all notes for a screenplay
  clearNotesForScreenplay: (screenplayId: string) => void;

  // Clear all notes
  clearAllNotes: () => void;
}

type NotesStore = NotesState & NotesActions;

/**
 * Generate a unique ID for notes
 */
function generateNoteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useNotesStore = create<NotesStore>()(
  persist(
    (set, get) => ({
      // Initial state
      notes: {},

      // Add a note
      addNote: (screenplayId, content, author = 'User') => {
        const now = new Date().toISOString();
        const newNote: Note = {
          id: generateNoteId(),
          screenplayId,
          content,
          author,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          notes: {
            ...state.notes,
            [screenplayId]: [...(state.notes[screenplayId] || []), newNote],
          },
        }));
      },

      // Update a note
      updateNote: (screenplayId, noteId, content) => {
        set((state) => {
          const screenplayNotes = state.notes[screenplayId];
          if (!screenplayNotes) return state;

          return {
            notes: {
              ...state.notes,
              [screenplayId]: screenplayNotes.map((note) =>
                note.id === noteId
                  ? { ...note, content, updatedAt: new Date().toISOString() }
                  : note
              ),
            },
          };
        });
      },

      // Delete a note
      deleteNote: (screenplayId, noteId) => {
        set((state) => {
          const screenplayNotes = state.notes[screenplayId];
          if (!screenplayNotes) return state;

          const filtered = screenplayNotes.filter((n) => n.id !== noteId);

          // Remove empty arrays
          if (filtered.length === 0) {
            const { [screenplayId]: _, ...rest } = state.notes;
            return { notes: rest };
          }

          return {
            notes: {
              ...state.notes,
              [screenplayId]: filtered,
            },
          };
        });
      },

      // Get notes for screenplay
      getNotesForScreenplay: (screenplayId) => {
        return get().notes[screenplayId] || [];
      },

      // Clear notes for screenplay
      clearNotesForScreenplay: (screenplayId) => {
        set((state) => {
          const { [screenplayId]: _, ...rest } = state.notes;
          return { notes: rest };
        });
      },

      // Clear all notes
      clearAllNotes: () => set({ notes: {} }),
    }),
    {
      name: 'lemon-notes',
    }
  )
);

/**
 * Hook to get notes count for a screenplay
 */
export function useNotesCount(screenplayId: string): number {
  return useNotesStore((state) => state.notes[screenplayId]?.length || 0);
}

/**
 * Hook to get notes for a screenplay
 */
export function useScreenplayNotes(screenplayId: string): Note[] {
  return useNotesStore((state) => state.notes[screenplayId] || []);
}
