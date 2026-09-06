import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRef, mockUploadBytes, mockMetadata } = vi.hoisted(() => ({
  mockRef: vi.fn((_storage: unknown, path: string) => ({ path })),
  mockUploadBytes: vi.fn().mockResolvedValue({ metadata: { generation: '12345' } }),
  mockMetadata: vi.fn().mockRejectedValue({ code: 'storage/object-not-found' }),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: mockRef,
  uploadBytes: mockUploadBytes,
  getMetadata: mockMetadata,
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
const mockSignInWithPopup = vi.fn().mockResolvedValue({ user: mockUser });
const mockSignInWithRedirect = vi.fn().mockResolvedValue(undefined);
const mockSignInWithCredential = vi.fn().mockResolvedValue({ user: mockUser });
const mockSignInWithCustomToken = vi.fn().mockResolvedValue({ user: mockUser });
const mockGetRedirectResult = vi.fn().mockResolvedValue(null);
const mockGoogleCredential = { providerId: 'google.com', signInMethod: 'google.com' };

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: { type: 'LOCAL' },
  getAuth: vi.fn(() => ({ currentUser: mockUser })),
  GoogleAuthProvider: class GoogleAuthProvider {
    static credential = vi.fn(() => mockGoogleCredential);
    setCustomParameters = vi.fn();
  },
  getRedirectResult: mockGetRedirectResult,
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(mockUser);
    return vi.fn();
  }),
  setPersistence: vi.fn().mockResolvedValue(undefined),
  signInWithPopup: mockSignInWithPopup,
  signInWithRedirect: mockSignInWithRedirect,
  signInWithCredential: mockSignInWithCredential,
  signInWithCustomToken: mockSignInWithCustomToken,
  signOut: mockSignOut,
}));

describe('firebase module', () => {
  let firebaseModule: typeof import('./firebase');
  let redirectResultCallsAtImport = 0;

  beforeAll(async () => {
    firebaseModule = await import('./firebase');
    await firebaseModule.authReady;
    redirectResultCallsAtImport = mockGetRedirectResult.mock.calls.length;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores the persisted Google session', async () => {
    await expect(firebaseModule.authReady).resolves.toEqual(mockUser);
    expect(redirectResultCallsAtImport).toBe(1);
  });

  it('recognizes only Lemon Studios email addresses', () => {
    expect(firebaseModule.isLemonEmail('reader@lemonfilms.com')).toBe(true);
    expect(firebaseModule.isLemonEmail('READER@LEMONFILMS.COM')).toBe(true);
    expect(firebaseModule.isLemonEmail('reader@gmail.com')).toBe(false);
    expect(firebaseModule.isLemonEmail(null)).toBe(false);
  });

  it('starts Google sign-in without leaving the dashboard', async () => {
    await expect(firebaseModule.signInWithGoogle()).resolves.toBeUndefined();
    expect(mockSignInWithPopup).toHaveBeenCalledOnce();
    expect(mockSignInWithRedirect).not.toHaveBeenCalled();
  });

  it('falls back to redirect when the browser blocks the popup', async () => {
    mockSignInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-blocked' });

    await expect(firebaseModule.signInWithGoogle()).resolves.toBeUndefined();

    expect(mockSignInWithRedirect).toHaveBeenCalledOnce();
  });

  it('accepts a Google Identity Services token without a popup handoff', async () => {
    await expect(
      firebaseModule.signInWithGoogleIdToken('google-id-token'),
    ).resolves.toBeUndefined();

    expect(mockSignInWithCredential).toHaveBeenCalledWith(
      firebaseModule.auth,
      mockGoogleCredential,
    );
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
    expect(first.storageGeneration).toBe('12345');
  });

  it('rejects unsupported queue categories before uploading bytes', async () => {
    await expect(firebaseModule.uploadPdfToIngestQueue(
      new File(['script'], 'Script.pdf'), 'CUSTOM',
    )).rejects.toThrow(/category/i);
    expect(mockUploadBytes).not.toHaveBeenCalled();
  });

  it('never overwrites an already accepted upload identity', async () => {
    mockMetadata.mockResolvedValueOnce({ generation: 'older-generation' });
    await expect(firebaseModule.uploadPdfToIngestQueue(
      new File(['different bytes'], 'Script.pdf'), 'LEMON', { uploadId: 'existing-id' },
    )).rejects.toThrow(/already exists/i);
    expect(mockUploadBytes).not.toHaveBeenCalled();
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

  it('binds Coverage and its same-batch parent to Storage metadata', async () => {
    const file = new File(['new draft'], 'Draft Two.pdf', {
      type: 'application/pdf',
    });

    await firebaseModule.uploadPdfToIngestQueue(file, 'LEMON', {
      uploadId: 'child-upload',
      engine: 'coverage_v1',
      targetProjectId: 'Draft_One.pdf',
      dependsOnUploadId: 'parent-upload',
    });

    expect(mockUploadBytes).toHaveBeenCalledWith(
      { path: 'ingest-queue/LEMON/child-upload/Draft_Two.pdf' },
      file,
      expect.objectContaining({
        customMetadata: expect.objectContaining({
          engine: 'coverage_v1',
          dependsOnUploadId: 'parent-upload',
        }),
      }),
    );
  });

  it('marks a title collision as an explicitly separate project', async () => {
    const file = new File(['different screenplay'], 'Shared Title.pdf', {
      type: 'application/pdf',
    });

    await firebaseModule.uploadPdfToIngestQueue(file, 'LEMON', {
      uploadId: 'separate-upload',
      separateProject: true,
    });

    expect(mockUploadBytes).toHaveBeenCalledWith(
      { path: 'ingest-queue/LEMON/separate-upload/Shared_Title.pdf' },
      file,
      expect.objectContaining({
        customMetadata: expect.objectContaining({ separateProject: 'true' }),
      }),
    );
  });

  it('rejects contradictory revision and separate-project metadata', async () => {
    const file = new File(['different screenplay'], 'Shared Title.pdf', {
      type: 'application/pdf',
    });

    await expect(
      firebaseModule.uploadPdfToIngestQueue(file, 'LEMON', {
        uploadId: 'invalid-choice',
        targetProjectId: 'Original_Draft.pdf',
        separateProject: true,
      }),
    ).rejects.toThrow(/both a revision and a separate project/i);
    expect(mockUploadBytes).not.toHaveBeenCalled();
  });
});
