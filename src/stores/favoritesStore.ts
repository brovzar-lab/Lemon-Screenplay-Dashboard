/**
 * Favorites Store
 * Manages user-created lists of favorite screenplays
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FavoriteList {
  id: string;
  name: string;
  screenplayIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface FavoritesState {
  lists: FavoriteList[];

  // List management
  createList: (name: string) => string; // Returns new list ID
  deleteList: (listId: string) => void;
  renameList: (listId: string, newName: string) => void;

  // Screenplay management
  addToList: (listId: string, screenplayId: string) => void;
  removeFromList: (listId: string, screenplayId: string) => void;
  isInList: (listId: string, screenplayId: string) => boolean;
  isInAnyList: (screenplayId: string) => boolean;

  // Quick favorites (built-in list)
  quickFavorites: string[];
  toggleQuickFavorite: (screenplayId: string) => void;
  isQuickFavorite: (screenplayId: string) => boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      lists: [],
      quickFavorites: [],

      // List management
      createList: (name) => {
        const id = generateId();
        const now = new Date().toISOString();
        set((state) => ({
          lists: [
            ...state.lists,
            {
              id,
              name,
              screenplayIds: [],
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },

      deleteList: (listId) => {
        set((state) => ({
          lists: state.lists.filter((l) => l.id !== listId),
        }));
      },

      renameList: (listId, newName) => {
        set((state) => ({
          lists: state.lists.map((l) =>
            l.id === listId
              ? { ...l, name: newName, updatedAt: new Date().toISOString() }
              : l
          ),
        }));
      },

      // Screenplay management
      addToList: (listId, screenplayId) => {
        set((state) => ({
          lists: state.lists.map((l) =>
            l.id === listId && !l.screenplayIds.includes(screenplayId)
              ? {
                  ...l,
                  screenplayIds: [...l.screenplayIds, screenplayId],
                  updatedAt: new Date().toISOString(),
                }
              : l
          ),
        }));
      },

      removeFromList: (listId, screenplayId) => {
        set((state) => ({
          lists: state.lists.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  screenplayIds: l.screenplayIds.filter((id) => id !== screenplayId),
                  updatedAt: new Date().toISOString(),
                }
              : l
          ),
        }));
      },

      isInList: (listId, screenplayId) => {
        const list = get().lists.find((l) => l.id === listId);
        return list?.screenplayIds.includes(screenplayId) ?? false;
      },

      isInAnyList: (screenplayId) => {
        return get().lists.some((l) => l.screenplayIds.includes(screenplayId));
      },

      // Quick favorites
      toggleQuickFavorite: (screenplayId) => {
        set((state) => ({
          quickFavorites: state.quickFavorites.includes(screenplayId)
            ? state.quickFavorites.filter((id) => id !== screenplayId)
            : [...state.quickFavorites, screenplayId],
        }));
      },

      isQuickFavorite: (screenplayId) => {
        return get().quickFavorites.includes(screenplayId);
      },
    }),
    {
      name: 'lemon-favorites',
    }
  )
);
