import { create } from 'zustand';
import type { Unsubscribe, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  isLemonEmail,
  signInWithGoogle,
  signOutUser,
} from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export type UserRole = 'admin' | 'reader';
export type AuthStatus = 'initializing' | 'signed_out' | 'loading_profile' | 'ready';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  status: AuthStatus;
  isSigningIn: boolean;
  error: string | null;
  initialize: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const ADMIN_EMAILS = new Set(['billy@lemonfilms.com']);
let authUnsubscribe: Unsubscribe | null = null;
let authSequence = 0;

function roleForEmail(email: string): UserRole {
  return ADMIN_EMAILS.has(email.toLowerCase()) ? 'admin' : 'reader';
}

async function loadOrCreateProfile(user: User): Promise<UserProfile> {
  const email = user.email?.toLowerCase() ?? '';
  const profileRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(profileRef);
  const now = new Date().toISOString();

  if (snapshot.exists()) {
    const existing = snapshot.data() as UserProfile;
    const updated: UserProfile = {
      ...existing,
      uid: user.uid,
      email,
      displayName: user.displayName ?? existing.displayName ?? email,
      photoURL: user.photoURL ?? existing.photoURL ?? null,
      lastLoginAt: now,
    };
    await setDoc(profileRef, updated);
    return updated;
  }

  const profile: UserProfile = {
    uid: user.uid,
    email,
    displayName: user.displayName ?? email,
    photoURL: user.photoURL,
    role: roleForEmail(email),
    createdAt: now,
    lastLoginAt: now,
  };
  await setDoc(profileRef, profile);
  return profile;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Sign-in failed. Please try again.';
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  status: 'initializing',
  isSigningIn: false,
  error: null,

  initialize: () => {
    if (authUnsubscribe) return;
    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      const sequence = ++authSequence;
      if (!user) {
        set({ user: null, profile: null, status: 'signed_out', isSigningIn: false });
        return;
      }

      if (!user.emailVerified || !isLemonEmail(user.email)) {
        await signOutUser().catch(() => undefined);
        if (sequence === authSequence) {
          set({
            user: null,
            profile: null,
            status: 'signed_out',
            isSigningIn: false,
            error: 'Use your @lemonfilms.com Google account.',
          });
        }
        return;
      }

      set({ user, profile: null, status: 'loading_profile', error: null });
      try {
        const profile = await loadOrCreateProfile(user);
        if (sequence === authSequence) {
          set({ user, profile, status: 'ready', isSigningIn: false });
        }
      } catch (error) {
        await signOutUser();
        set({
          user: null,
          profile: null,
          status: 'signed_out',
          isSigningIn: false,
          error: getErrorMessage(error),
        });
      }
    });
  },

  signIn: async () => {
    set({ isSigningIn: true, error: null });
    try {
      await signInWithGoogle();
    } catch (error) {
      set({ isSigningIn: false, error: getErrorMessage(error) });
    }
  },

  signOut: async () => {
    await signOutUser();
    set({ user: null, profile: null, status: 'signed_out', error: null });
  },

  clearError: () => set({ error: null }),
}));

export function useIsAdmin(): boolean {
  return useAuthStore((state) => state.profile?.role === 'admin');
}
