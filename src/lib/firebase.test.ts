import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRef, mockUploadBytes } = vi.hoisted(() => ({
  mockRef: vi.fn((_storage: unknown, path: string) => ({ path })),
  mockUploadBytes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: mockRef,
  uploadBytes: mockUploadBytes,
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

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('gives same-filename revisions unique ingest paths', async () => {
    const file = new File(['revised screenplay'], 'Same Draft.pdf', {
      type: 'application/pdf',
    });

    const first = await firebaseModule.uploadPdfToIngestQueue(file, 'LEMON', {
      uploadId: 'upload-one',
    });
    const second = await firebaseModule.uploadPdfToIngestQueue(file, 'LEMON', {
      uploadId: 'upload-two',
    });

    expect(first.objectName).toBe('ingest-queue/LEMON/upload-one/Same_Draft.pdf');
    expect(second.objectName).toBe('ingest-queue/LEMON/upload-two/Same_Draft.pdf');
    expect(first.storagePath).not.toBe(second.storagePath);
    expect(mockUploadBytes).toHaveBeenCalledTimes(2);
  });

  it('places the target project on Storage metadata for renamed revisions', async () => {
    const file = new File(['new draft'], 'Completely New Filename.pdf', {
      type: 'application/pdf',
    });

    await firebaseModule.uploadPdfToIngestQueue(file, 'LEMON', {
      uploadId: 'revision-upload',
      targetProjectId: 'Original_Draft.pdf',
    });

    expect(mockUploadBytes).toHaveBeenCalledWith(
      { path: 'ingest-queue/LEMON/revision-upload/Completely_New_Filename.pdf' },
      file,
      expect.objectContaining({
        customMetadata: expect.objectContaining({
          targetProjectId: 'Original_Draft.pdf',
        }),
      }),
    );
  });
});
