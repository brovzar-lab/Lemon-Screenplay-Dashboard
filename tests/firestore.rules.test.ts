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
  Timestamp,
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
      token: 'live-token',
      expiresAtMillis: Date.now() + 60_000,
      title: 'Partner view',
      sealedVersion: {
        analysis_version: 'v9_archaeology',
        trust_manifest_version: 'lemon-trust-manifest-v6',
        server_trust_attestation: { writer: 'firebase_admin' },
      },
    });
  });

  it('denies direct public reads even for a live token', async () => {
    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(publicDb, 'shared_views/live-token')));
    await assertFails(getDocs(collection(publicDb, 'shared_views')));
  });

  it('denies a public fetch for an expired token', async () => {
    await seed('shared_views/expired-token', {
      token: 'expired-token',
      expiresAtMillis: Date.now() - 60_000,
      title: 'Expired partner view',
      sealedVersion: {
        analysis_version: 'v9_archaeology',
        trust_manifest_version: 'lemon-trust-manifest-v6',
        server_trust_attestation: { writer: 'firebase_admin' },
      },
    });
    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(publicDb, 'shared_views/expired-token')));
  });

  it('denies public reads of legacy or token-mismatched share snapshots', async () => {
    await seed('shared_views/legacy-token', {
      token: 'legacy-token',
      expiresAtMillis: Date.now() + 60_000,
      analysis: { recommendation: 'film_now' },
    });
    await seed('shared_views/mismatched-token', {
      token: 'different-token',
      expiresAtMillis: Date.now() + 60_000,
      sealedVersion: {
        analysis_version: 'v9_archaeology',
        trust_manifest_version: 'lemon-trust-manifest-v6',
        server_trust_attestation: { writer: 'firebase_admin' },
      },
    });
    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(publicDb, 'shared_views/legacy-token')));
    await assertFails(getDoc(doc(publicDb, 'shared_views/mismatched-token')));
  });

  it('allows a team reader to list but not forge share records', async () => {
    await assertSucceeds(getDocs(collection(readerDb(), 'shared_views')));
    await assertFails(setDoc(doc(readerDb(), 'shared_views/new-token'), {
      expiresAtMillis: Date.now() + 60_000,
      title: 'Reader share',
    }));
    await assertFails(deleteDoc(doc(readerDb(), 'shared_views/live-token')));
  });

  it('keeps share authority receipts server-only', async () => {
    await seed('share_authorities/live-token', {
      authorityVersion: 'lemon-share-authority-v1',
      token: 'live-token',
    });
    await assertFails(getDoc(doc(adminDb(), 'share_authorities/live-token')));
    await assertFails(setDoc(doc(adminDb(), 'share_authorities/forged'), {
      authorityVersion: 'lemon-share-authority-v1',
      token: 'forged',
    }));
    await assertFails(deleteDoc(doc(adminDb(), 'share_authorities/live-token')));
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

  it('allows Lemon readers and admins to read while denying public and authenticated outsiders', async () => {
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const outsiderDb = testEnv.authenticatedContext('outsider', outsiderClaims).firestore();

    await assertSucceeds(getDoc(doc(readerDb(), 'uploaded_analyses/script-one')));
    await assertSucceeds(getDoc(doc(adminDb(), 'uploaded_analyses/script-one')));
    await assertFails(getDoc(doc(publicDb, 'uploaded_analyses/script-one')));
    await assertFails(getDoc(doc(outsiderDb, 'uploaded_analyses/script-one')));
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

  it('prevents browser clients from writing or changing server trust fields', async () => {
    await assertFails(setDoc(doc(adminDb(), 'uploaded_analyses/forged'), {
      source_file: 'forged.pdf',
      analysis_version: 'v9_archaeology',
      server_trust_attestation: { writer: 'firebase_admin' },
    }));
    await assertFails(updateDoc(doc(adminDb(), 'uploaded_analyses/script-one'), {
      analysis: { verdict: 'RECOMMEND' },
    }));
    await assertFails(updateDoc(doc(adminDb(), 'uploaded_analyses/script-one'), {
      analysis_model: 'claude-fake',
      usage: { actual_cost_usd: 0 },
      metadata: { page_count: 1 },
    }));
    await assertFails(updateDoc(doc(adminDb(), 'uploaded_analyses/script-one'), {
      source_file: 'different.pdf',
    }));
    await assertFails(updateDoc(doc(adminDb(), 'uploaded_analyses/script-one'), {
      _trust_authority: 'immutable_server',
    }));
    await assertFails(updateDoc(doc(adminDb(), 'uploaded_analyses/script-one'), {
      poster_url: 'https://example.test/forged.jpg',
      poster_version_id: 'forged-version',
    }));
  });

  it('allows team reads but denies every client write to version authority receipts', async () => {
    await seed('uploaded_analyses/script-one/version_authorities/version-1', {
      authorityVersion: 'lemon-analysis-version-authority-v1',
      writer: 'firebase_admin',
    });
    const receipt = doc(
      readerDb(),
      'uploaded_analyses/script-one/version_authorities/version-1',
    );
    await assertSucceeds(getDoc(receipt));
    await assertFails(setDoc(
      doc(adminDb(), 'uploaded_analyses/script-one/version_authorities/forged'),
      { authorityVersion: 'lemon-analysis-version-authority-v1' },
    ));
    await assertFails(updateDoc(
      doc(adminDb(), 'uploaded_analyses/script-one/version_authorities/version-1'),
      { writer: 'browser' },
    ));
    await assertFails(deleteDoc(
      doc(adminDb(), 'uploaded_analyses/script-one/version_authorities/version-1'),
    ));
  });

  it('denies hard-delete even for admins', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'uploaded_analyses/script-one')));
  });
});

describe('immutable analysis versions', () => {
  const contentHash = 'ab'.repeat(32);
  const queuedAtMs = 1_784_588_800_123;
  const versionId = `${contentHash}_${queuedAtMs}`;
  const versionPath = `uploaded_analyses/script-one/versions/${versionId}`;

  function validVersion() {
    return {
      source_file: 'script-one.pdf',
      analysis_version: 'v9_archaeology',
      project_id: 'script-one',
      version_id: versionId,
      version_number: 1,
      created_at: Timestamp.fromMillis(queuedAtMs),
      content_hash: contentHash,
      identity_status: 'verified',
    };
  }

  it('allows readers to view Admin-SDK versions but rejects browser creation', async () => {
    await seed(versionPath, validVersion());
    await assertSucceeds(getDoc(doc(readerDb(), versionPath)));
    await assertFails(setDoc(doc(adminDb(), `${versionPath}-browser`), validVersion()));
  });

  it('rejects an ISO string in place of a Firestore Timestamp', async () => {
    await assertFails(setDoc(doc(adminDb(), versionPath), {
      ...validVersion(),
      created_at: new Date(queuedAtMs).toISOString(),
    }));
  });

  it('rejects a non-integer version number', async () => {
    await assertFails(setDoc(doc(adminDb(), versionPath), {
      ...validVersion(),
      version_number: 1.5,
    }));
  });

  it('prevents version edits and deletes after creation', async () => {
    await seed(versionPath, validVersion());
    await assertFails(updateDoc(doc(adminDb(), versionPath), { version_number: 2 }));
    await assertFails(deleteDoc(doc(adminDb(), versionPath)));
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
  it('keeps producer calibration projections server-authored', async () => {
    await assertFails(setDoc(doc(readerDb(), 'screenplay_feedback/feedback-one'), {
      screenplayId: 'script-one',
      text: 'Strong concept.',
    }));
    await assertFails(setDoc(doc(readerDb(), 'brain_verdicts/script-one'), {
      screenplayId: 'script-one',
      billyVerdict: 'recommend',
    }));
    await assertFails(setDoc(doc(adminDb(), 'brain_verdicts/script-one'), {
      screenplayId: 'script-one',
      billyVerdict: 'recommend',
    }));
  });

  it('allows admins to read calibration evidence but blocks browser writes', async () => {
    await seed('producer_assessments/assessment-one', {
      assessmentId: 'assessment-one',
      producerUid: 'admin-user',
    });
    await seed('producer_assessment_heads/admin-user__script-one', {
      latestAssessmentId: 'assessment-one',
      producerUid: 'admin-user',
      projectId: 'script-one',
    });
    await seed('producer_profiles/admin', {
      enabled: false,
      activeVersionId: null,
    });
    await seed('producer_profiles/admin/versions/candidate-one', {
      candidateId: 'candidate-one',
      status: 'candidate',
    });
    await seed('producer_profiles/admin/publications/publication-one', {
      publicationId: 'publication-one',
      action: 'activate',
      candidateId: 'candidate-one',
    });

    await assertSucceeds(
      getDoc(doc(adminDb(), 'producer_assessments/assessment-one')),
    );
    await assertSucceeds(
      getDoc(
        doc(
          adminDb(),
          'producer_assessment_heads/admin-user__script-one',
        ),
      ),
    );
    await assertSucceeds(
      getDoc(doc(adminDb(), 'producer_profiles/admin/versions/candidate-one')),
    );
    await assertSucceeds(
      getDoc(
        doc(
          adminDb(),
          'producer_profiles/admin/publications/publication-one',
        ),
      ),
    );

    await assertFails(
      setDoc(doc(adminDb(), 'producer_assessments/assessment-two'), {
        assessmentId: 'assessment-two',
      }),
    );
    await assertFails(
      updateDoc(doc(adminDb(), 'producer_profiles/admin'), {
        enabled: true,
      }),
    );
    await assertFails(
      setDoc(
        doc(
          adminDb(),
          'producer_profiles/admin/publications/publication-two',
        ),
        { action: 'activate' },
      ),
    );
  });

  it('keeps producer calibration private from readers', async () => {
    await seed('producer_assessments/assessment-one', {
      assessmentId: 'assessment-one',
      producerUid: 'admin-user',
    });
    await seed('producer_profiles/admin', {
      enabled: false,
      activeVersionId: null,
    });

    await assertFails(
      getDoc(doc(readerDb(), 'producer_assessments/assessment-one')),
    );
    await assertFails(getDoc(doc(readerDb(), 'producer_profiles/admin')));
  });
});
