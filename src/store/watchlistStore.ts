import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WatchlistState {
  starred: string[]  // title IDs Billy has pinned
  toggle: (id: string) => void
  isStarred: (id: string) => boolean
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      starred: [],
      toggle: (id) =>
        set(s => ({
          starred: s.starred.includes(id)
            ? s.starred.filter(x => x !== id)
            : [...s.starred, id],
        })),
      isStarred: (id) => get().starred.includes(id),
    }),
    { name: 'lemon-watchlist' }
  )
)
