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
});

afterAll(async () => {
  await testEnv.cleanup();
});

async function seed(path: string, data: Record<string, unknown>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

describe('shared_views capability links', () => {
  it('allows a public single-document fetch for a live token', async () => {
    await seed('shared_views/live-token', {
      expiresAtMillis: Date.now() + 60_000,
      title: 'Partner view',
    });

    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, 'shared_views/live-token')));
  });

  it('denies a public single-document fetch for an expired token', async () => {
    await seed('shared_views/expired-token', {
      expiresAtMillis: Date.now() - 60_000,
      title: 'Expired partner view',
    });

    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(publicDb, 'shared_views/expired-token')));
  });

  it('denies unauthenticated collection enumeration', async () => {
    await seed('shared_views/live-token', {
      expiresAtMillis: Date.now() + 60_000,
      title: 'Partner view',
    });

    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(publicDb, 'shared_views')));
  });

  it('allows authenticated dashboard users to list share records', async () => {
    await seed('shared_views/live-token', {
      expiresAtMillis: Date.now() + 60_000,
      title: 'Partner view',
    });

    const dashboardDb = testEnv.authenticatedContext('dashboard-user').firestore();
    await assertSucceeds(getDocs(collection(dashboardDb, 'shared_views')));
  });
});

describe('uploaded_analyses lifecycle', () => {
  it('denies hard-delete even for authenticated clients', async () => {
    await seed('uploaded_analyses/script-one', {
      source_file: 'script-one.pdf',
      title: 'Script One',
    });

    const dashboardDb = testEnv.authenticatedContext('dashboard-user').firestore();
    await assertFails(deleteDoc(doc(dashboardDb, 'uploaded_analyses/script-one')));
  });

  it('allows authenticated clients to soft-quarantine an analysis', async () => {
    await seed('uploaded_analyses/script-one', {
      source_file: 'script-one.pdf',
      title: 'Script One',
    });

    const dashboardDb = testEnv.authenticatedContext('dashboard-user').firestore();
    await assertSucceeds(updateDoc(doc(dashboardDb, 'uploaded_analyses/script-one'), {
      _quarantined_at: new Date().toISOString(),
      _quarantine_reason: 'invalid analysis format',
    }));
  });
});
