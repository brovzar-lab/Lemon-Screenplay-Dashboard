import { create } from 'zustand';
import type { Unsubscribe, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  isLemonEmail,
  signInWithGoogle,
  signInWithGoogleIdToken,
  signInForLocalReview,
  signOutUser,
} from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { isLocalE2E } from '@/lib/runtimeMode';
import { setLanguageUser } from '@/i18n';

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
  signInWithIdToken: (idToken: string) => Promise<void>;
  signInLocalReview: () => Promise<void>;
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
  const now = new Date().toISOString();

  if (isLocalE2E()) {
    return {
      uid: user.uid,
      email,
      displayName: user.displayName ?? email,
      photoURL: user.photoURL,
      role: roleForEmail(email),
      createdAt: now,
      lastLoginAt: now,
    };
  }

  const profileRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(profileRef);

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

export function getAuthErrorKey(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const keys: Record<string, string> = {
    'auth/network-request-failed': 'auth.error.network',
    'auth/popup-blocked': 'auth.error.popup_blocked',
    'auth/popup-closed-by-user': 'auth.error.popup_closed',
    'auth/too-many-requests': 'auth.error.too_many_requests',
    'auth/unauthorized-domain': 'auth.error.unavailable',
    'auth/user-disabled': 'auth.error.account_disabled',
  };
  return keys[code] ?? 'auth.error.generic';
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
        setLanguageUser(null);
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
            error: 'auth.error.lemon_account_required',
          });
        }
        return;
      }

      set({ user, profile: null, status: 'loading_profile', error: null });
      try {
        const profile = await loadOrCreateProfile(user);
        if (sequence === authSequence) {
          setLanguageUser(user.uid);
          set({ user, profile, status: 'ready', isSigningIn: false });
        }
      } catch (error) {
        await signOutUser();
        set({
          user: null,
          profile: null,
          status: 'signed_out',
          isSigningIn: false,
          error: getAuthErrorKey(error),
        });
      }
    });
  },

  signIn: async () => {
    set({ isSigningIn: true, error: null });
    try {
      await signInWithGoogle();
    } catch (error) {
      set({ isSigningIn: false, error: getAuthErrorKey(error) });
    }
  },

  signInWithIdToken: async (idToken) => {
    set({ isSigningIn: true, error: null });
    try {
      await signInWithGoogleIdToken(idToken);
    } catch (error) {
      set({ isSigningIn: false, error: getAuthErrorKey(error) });
    }
  },

  signInLocalReview: async () => {
    set({ isSigningIn: true, error: null });
    try {
      await signInForLocalReview();
    } catch (error) {
      set({ isSigningIn: false, error: getAuthErrorKey(error) });
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
