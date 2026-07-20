import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
}));

const mockUser = {
  uid: 'test-uid-123',
  email: 'billy@lemonfilms.com',
  emailVerified: true,
};
const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: { type: 'LOCAL' },
  getAuth: vi.fn(() => ({ currentUser: mockUser })),
  GoogleAuthProvider: class GoogleAuthProvider {
    setCustomParameters = vi.fn();
  },
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(mockUser);
    return vi.fn();
  }),
  setPersistence: vi.fn().mockResolvedValue(undefined),
  signInWithPopup: vi.fn().mockResolvedValue({ user: mockUser }),
  signOut: mockSignOut,
}));

describe('firebase module', () => {
  let firebaseModule: typeof import('./firebase');

  beforeAll(async () => {
    firebaseModule = await import('./firebase');
  });

  it('restores the persisted Google session', async () => {
    await expect(firebaseModule.authReady).resolves.toEqual(mockUser);
  });

  it('recognizes only Lemon Studios email addresses', () => {
    expect(firebaseModule.isLemonEmail('reader@lemonfilms.com')).toBe(true);
    expect(firebaseModule.isLemonEmail('READER@LEMONFILMS.COM')).toBe(true);
    expect(firebaseModule.isLemonEmail('reader@gmail.com')).toBe(false);
    expect(firebaseModule.isLemonEmail(null)).toBe(false);
  });

  it('returns the Google user after sign-in', async () => {
    await expect(firebaseModule.signInWithGoogle()).resolves.toEqual(mockUser);
  });

  it('exposes the initialized auth singleton', () => {
    expect(firebaseModule.auth).toBeDefined();
  });
});
