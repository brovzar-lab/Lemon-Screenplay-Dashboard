import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'lemon-screenplay-dashboard-rules-test';
const [emulatorHost = '127.0.0.1', emulatorPort = '8080'] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');

let testEnv: RulesTestEnvironment;

const readerClaims = {
  email: 'reader@lemonfilms.com',
  email_verified: true,
};
const outsiderClaims = {
  email: 'outsider@gmail.com',
  email_verified: true,
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: emulatorHost,
      port: Number(emulatorPort),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed('users/reader-user', {
    uid: 'reader-user',
    email: readerClaims.email,
    displayName: 'Lemon Reader',
    photoURL: null,
    role: 'reader',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

async function seed(path: string, data: Record<string, unknown>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

function adminDb() {
  return testEnv.authenticatedContext('admin-user', {
    email: 'billy@lemonfilms.com',
    email_verified: true,
  }).firestore();
}

function readerDb() {
  return testEnv.authenticatedContext('reader-user', readerClaims).firestore();
}

describe('shared_views capability links', () => {
  beforeEach(async () => {
    await seed('shared_views/live-token', {
      expiresAtMillis: Date.now() + 60_000,
      title: 'Partner view',
    });
  });

  it('allows a public fetch for a live token but denies enumeration', async () => {
    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, 'shared_views/live-token')));
    await assertFails(getDocs(collection(publicDb, 'shared_views')));
  });

  it('denies a public fetch for an expired token', async () => {
    await seed('shared_views/expired-token', {
      expiresAtMillis: Date.now() - 60_000,
      title: 'Expired partner view',
    });
    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(publicDb, 'shared_views/expired-token')));
  });

  it('allows a team reader to list and create share records', async () => {
    await assertSucceeds(getDocs(collection(readerDb(), 'shared_views')));
    await assertSucceeds(setDoc(doc(readerDb(), 'shared_views/new-token'), {
      expiresAtMillis: Date.now() + 60_000,
      title: 'Reader share',
    }));
  });

  it('denies a verified non-Lemon account', async () => {
    const outsiderDb = testEnv
      .authenticatedContext('outsider', outsiderClaims)
      .firestore();
    await assertFails(getDocs(collection(outsiderDb, 'shared_views')));
  });
});

describe('uploaded_analyses lifecycle', () => {
  beforeEach(async () => {
    await seed('uploaded_analyses/script-one', {
      source_file: 'script-one.pdf',
      title: 'Script One',
    });
  });

  it('allows readers to view analyses but not mutate them', async () => {
    await assertSucceeds(getDoc(doc(readerDb(), 'uploaded_analyses/script-one')));
    await assertFails(updateDoc(doc(readerDb(), 'uploaded_analyses/script-one'), {
      title: 'Tampered',
    }));
  });

  it('allows admins to create and soft-update analyses', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'uploaded_analyses/script-two'), {
      source_file: 'script-two.pdf',
      title: 'Script Two',
    }));
    await assertSucceeds(updateDoc(doc(adminDb(), 'uploaded_analyses/script-one'), {
      _quarantined_at: new Date().toISOString(),
      _quarantine_reason: 'invalid analysis format',
    }));
  });

  it('denies hard-delete even for admins', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'uploaded_analyses/script-one')));
  });
});

describe('user roles', () => {
  it('lets a Lemon user create only their own reader profile', async () => {
    const newReaderDb = testEnv.authenticatedContext('new-reader', {
      email: 'new.reader@lemonfilms.com',
      email_verified: true,
    }).firestore();
    const profile = {
      uid: 'new-reader',
      email: 'new.reader@lemonfilms.com',
      displayName: 'New Reader',
      photoURL: null,
      role: 'reader',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    await assertSucceeds(setDoc(doc(newReaderDb, 'users/new-reader'), profile));
    await assertFails(setDoc(doc(newReaderDb, 'users/new-reader'), {
      ...profile,
      role: 'admin',
    }));
  });

  it('lets Billy bootstrap an admin profile', async () => {
    const profile = {
      uid: 'admin-user',
      email: 'billy@lemonfilms.com',
      displayName: 'Billy Rovzar',
      photoURL: null,
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    await assertSucceeds(setDoc(doc(adminDb(), 'users/admin-user'), profile));
  });

  it('prevents a reader from promoting themselves', async () => {
    await assertFails(updateDoc(doc(readerDb(), 'users/reader-user'), {
      role: 'admin',
    }));
  });

  it('prevents non-Lemon identities from creating profiles', async () => {
    const outsiderDb = testEnv
      .authenticatedContext('outsider', outsiderClaims)
      .firestore();
    await assertFails(setDoc(doc(outsiderDb, 'users/outsider'), {
      uid: 'outsider',
      email: outsiderClaims.email,
      displayName: 'Outsider',
      photoURL: null,
      role: 'reader',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    }));
  });
});

describe('role-specific collections', () => {
  it('allows readers to write feedback but not Billy verdicts', async () => {
    await assertSucceeds(setDoc(doc(readerDb(), 'screenplay_feedback/feedback-one'), {
      screenplayId: 'script-one',
      text: 'Strong concept.',
    }));
    await assertFails(setDoc(doc(readerDb(), 'brain_verdicts/script-one'), {
      screenplayId: 'script-one',
      billyVerdict: 'recommend',
    }));
  });

  it('allows admins to write Billy verdicts', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'brain_verdicts/script-one'), {
      screenplayId: 'script-one',
      billyVerdict: 'recommend',
    }));
  });
});
