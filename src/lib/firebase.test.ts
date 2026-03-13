import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock firebase/app before any imports that use it
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

// Mock firebase/storage
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
}));

// Mock firebase/auth
const mockUser = { uid: 'test-uid-123', isAnonymous: true };
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  signInAnonymously: vi.fn(() => Promise.resolve({ user: mockUser })),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: { type: 'LOCAL' },
}));

describe('firebase module', () => {
  let firebaseModule: typeof import('./firebase');

  beforeAll(async () => {
    firebaseModule = await import('./firebase');
  });

  it('auth export is not null or undefined', () => {
    expect(firebaseModule.auth).toBeDefined();
    expect(firebaseModule.auth).not.toBeNull();
  });

  it('authReady resolves to an object with a non-empty uid string', async () => {
    const user = await firebaseModule.authReady;
    expect(user).toBeDefined();
    expect(typeof user.uid).toBe('string');
    expect(user.uid.length).toBeGreaterThan(0);
    expect(user.uid).toBe('test-uid-123');
  });

  it('authReady resolves (not rejects) when signInAnonymously succeeds', async () => {
    await expect(firebaseModule.authReady).resolves.toBeDefined();
  });

  it('calling authReady multiple times returns the same promise (module singleton)', () => {
    const p1 = firebaseModule.authReady;
    const p2 = firebaseModule.authReady;
    expect(p1).toBe(p2);
  });
});
