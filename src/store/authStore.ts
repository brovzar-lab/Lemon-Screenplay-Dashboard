import { create } from 'zustand'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  init: () => () => void    // returns unsubscribe fn
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  signIn: async () => {
    set({ error: null })
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  signOut: async () => {
    await signOut(auth)
    set({ user: null })
  },

  init: () => {
    return onAuthStateChanged(auth, (user) => {
      set({ user, loading: false })
    })
  },
}))
