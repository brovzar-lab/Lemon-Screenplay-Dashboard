import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

const PROJECT_ID = 'lemon-screenplay-dashboard-rules-test';
const [firestoreHost = '127.0.0.1', firestorePort = '8080'] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const [storageHost = '127.0.0.1', storagePort = '9199'] =
  (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199').split(':');

let testEnv: RulesTestEnvironment;
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const readerClaims = { email: 'reader@lemonfilms.com', email_verified: true };

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
      host: storageHost,
      port: Number(storagePort),
      rules: readFileSync('storage.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/reader-user'), {
      role: 'reader',
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

function adminStorage() {
  return testEnv.authenticatedContext('admin-user', {
    email: 'billy@lemonfilms.com',
    email_verified: true,
  }).storage();
}

function readerStorage() {
  return testEnv.authenticatedContext('reader-user', readerClaims).storage();
}

describe('screenplay storage', () => {
  it('allows admins to upload valid PDFs and readers to download them', async () => {
    const path = 'screenplays/development/script.pdf';
    await assertSucceeds(uploadBytes(ref(adminStorage(), path), pdf, {
      contentType: 'application/pdf',
    }));
    await assertSucceeds(getBytes(ref(readerStorage(), path)));
  });

  it('denies reader uploads and public downloads', async () => {
    const path = 'screenplays/development/script.pdf';
    await assertFails(uploadBytes(ref(readerStorage(), path), pdf, {
      contentType: 'application/pdf',
    }));
    await assertSucceeds(uploadBytes(ref(adminStorage(), path), pdf, {
      contentType: 'application/pdf',
    }));
    await assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(), path)));
  });

  it('denies non-PDF content and reader ingest jobs', async () => {
    await assertFails(uploadBytes(ref(adminStorage(), 'screenplays/bad.pdf'), pdf, {
      contentType: 'text/plain',
    }));
    await assertFails(uploadBytes(ref(readerStorage(), 'ingest-queue/new/script.pdf'), pdf, {
      contentType: 'application/pdf',
    }));
  });
});
