import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  assertCandidateSourceTree,
  assertCandidateUploadFiles,
  assertPrivateIamPolicy,
  assertPredeployPlatformConfig,
  buildDeploymentReceipt,
  buildIsolationProbePlan,
  buildProductionIsolationProof,
  buildProductionStorageAclProof,
  buildStagingIdentityProof,
  gcloudIamRoleDescribeArguments,
  PRODUCTION_AUDITOR_PERMISSIONS,
  REVIEWED_STAGING_STORAGE_BUCKETS,
  reviewedProductionProjectBindings,
  reviewedStagingProjectBindings,
  reviewedStorageBindings,
  STAGING_IDENTITY_READER_PERMISSIONS,
  stagingIdentityAuditExpected,
  validateCandidateGate,
} from './candidate-staging-gate.mjs';

test('IAM role scans use short custom role IDs with their exact parent flag', () => {
  assert.deepEqual(gcloudIamRoleDescribeArguments('roles/viewer'), [
    'iam', 'roles', 'describe', 'roles/viewer', '--format=json',
  ]);
  assert.deepEqual(
    gcloudIamRoleDescribeArguments(
      'projects/lemon-screenplay-staging/roles/v9StagingIdentityProofReader',
    ),
    [
      'iam', 'roles', 'describe', 'v9StagingIdentityProofReader',
      '--project=lemon-screenplay-staging', '--format=json',
    ],
  );
  assert.deepEqual(
    gcloudIamRoleDescribeArguments('organizations/123456789/roles/StudioAuditor'),
    [
      'iam', 'roles', 'describe', 'StudioAuditor',
      '--organization=123456789', '--format=json',
    ],
  );
  assert.throws(
    () => gcloudIamRoleDescribeArguments('projects/lemon-screenplay-staging/roles/'),
    /IAM role name is invalid/,
  );
});

const sha = 'a'.repeat(40);
const productionAuditor = (
  'v9-production-auditor@lemon-screenplay-dashboard.iam.gserviceaccount.com'
);
const productionAuditorRole = (
  'projects/lemon-screenplay-dashboard/roles/v9ProductionMetadataAuditor'
);
const productionAuditorPrincipal = (projectNumber) => (
  `principal://iam.googleapis.com/projects/${projectNumber}/locations/global/`
  + 'workloadIdentityPools/github-staging/subject/'
  + 'repo:brovzar-lab/Lemon-Screenplay-Dashboard:environment:staging'
);
const valid = {
  stagingProjectId: 'lemon-screenplay-staging',
  deployerServiceAccount: 'benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com',
  productionAuditorServiceAccount: productionAuditor,
  workloadIdentityProvider: (
    'projects/549848020392/locations/global/workloadIdentityPools/'
    + 'github-staging/providers/github-lemon-screenplay'
  ),
  approvedSourceSha: sha,
  runId: '123e4567-e89b-42d3-a456-426614174000',
  benchmarkCapUsd: '8',
  priorAuditSpendUsd: '0.106425',
  inferenceGeo: 'global',
  headSha: sha,
  originMainSha: sha,
  cleanStatus: '',
};

function isolationExpected() {
  const stagingProjectNumber = '549848020392';
  return {
    runtimeServiceAccount: 'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
    stagingProjectId: 'lemon-screenplay-staging',
    stagingProjectNumber,
    productionProjectId: 'lemon-screenplay-dashboard',
    productionAuditorServiceAccount: productionAuditor,
    productionStorageBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
    verifiedAt: '2026-08-28T12:00:00Z',
    stagingFirestoreDatabases: [
      'projects/lemon-screenplay-staging/databases/(default)',
      'projects/lemon-screenplay-staging/databases/model-benchmarks',
    ],
    stagingStorageBuckets: [
      'gcf-v2-sources-549848020392-us-central1',
      'gcf-v2-uploads-549848020392.us-central1.cloudfunctions.appspot.com',
    ],
    productionFirestoreInventory: {
      databases: [{
        name: 'projects/lemon-screenplay-dashboard/databases/(default)',
        database_id: '(default)',
        location_id: 'nam5',
      }],
      backups: [{
        name: 'projects/lemon-screenplay-dashboard/locations/nam5/backups/backup-1',
        database: 'projects/lemon-screenplay-dashboard/databases/(default)',
      }],
      backup_schedules: [{
        name: (
          'projects/lemon-screenplay-dashboard/databases/(default)/'
          + 'backupSchedules/schedule-1'
        ),
        database: 'projects/lemon-screenplay-dashboard/databases/(default)',
      }],
    },
    productionAuditorRoleDefinition: {
      name: productionAuditorRole,
      title: 'V9 Production Metadata Auditor',
      description: (
        'Read-only V9 staging isolation metadata; no screenplay bytes or Firestore documents.'
      ),
      stage: 'GA',
      includedPermissions: PRODUCTION_AUDITOR_PERMISSIONS,
    },
    productionServiceAccountResources: [{
      service_account: {
        projectId: 'lemon-screenplay-dashboard',
        name: (
          'projects/lemon-screenplay-dashboard/serviceAccounts/'
          + 'firebase-adminsdk-fbsvc@lemon-screenplay-dashboard.iam.gserviceaccount.com'
        ),
        email: 'firebase-adminsdk-fbsvc@lemon-screenplay-dashboard.iam.gserviceaccount.com',
        uniqueId: '123456789012345678901',
        disabled: false,
      },
      policy: { etag: 'ACAB' },
    }, {
      service_account: {
        projectId: 'lemon-screenplay-dashboard',
        name: `projects/lemon-screenplay-dashboard/serviceAccounts/${productionAuditor}`,
        email: productionAuditor,
        uniqueId: '223456789012345678901',
        disabled: false,
      },
      policy: { bindings: [{
        role: 'roles/iam.workloadIdentityUser',
        members: [productionAuditorPrincipal(stagingProjectNumber)],
      }] },
    }],
  };
}

function productionProjectPolicy(extraBindings = []) {
  return { bindings: [
    ...reviewedProductionProjectBindings({
      productionProjectId: 'lemon-screenplay-dashboard',
      productionProjectNumber: '493694843892',
    }),
    ...extraBindings,
  ] };
}

function storageAclProof(runtimeServiceAccount, overrideAcl = []) {
  const expected = {
    runtimeServiceAccount,
    productionStorageBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
    productionProjectNumber: '493694843892',
    verifiedAt: '2026-08-28T12:00:00Z',
  };
  const projectAcl = [
    { entity: 'project-owners-493694843892', role: 'OWNER' },
    { entity: 'project-editors-493694843892', role: 'OWNER' },
    { entity: 'project-viewers-493694843892', role: 'READER' },
  ];
  return buildProductionStorageAclProof(
    {
      name: expected.productionStorageBucket,
      uniform_bucket_level_access: false,
      acl: projectAcl,
      default_acl: projectAcl,
    },
    { bindings: reviewedStorageBindings('lemon-screenplay-dashboard') },
    [{
      type: 'cloud_object',
      metadata: {
        bucket: expected.productionStorageBucket,
        name: 'private/unlogged-screenplay.pdf',
        generation: '123456789',
        acl: [...projectAcl, ...overrideAcl],
      },
    }],
    [],
    expected,
  );
}

function stagingIdentityProof({
  extraProjectBinding,
  providerCondition,
  providerOidc,
  providerDisabled,
  extraProvider,
  userManagedKeyEmail,
  poolPolicy,
  openIdOnlyRole,
} = {}) {
  const projectId = 'lemon-screenplay-staging';
  const projectNumber = '549848020392';
  const providerName = (
    `projects/${projectNumber}/locations/global/workloadIdentityPools/`
    + 'github-staging/providers/github-lemon-screenplay'
  );
  const providerInventory = [{ name: providerName, state: 'ACTIVE' }];
  if (extraProvider) providerInventory.push(extraProvider);
  const runtime = `benchmark-runtime@${projectId}.iam.gserviceaccount.com`;
  const deployer = `benchmark-deployer@${projectId}.iam.gserviceaccount.com`;
  const expectedIdentity = {
    projectId,
    projectNumber,
    runtimeServiceAccount: runtime,
    deployerServiceAccount: deployer,
  };
  const projectBindings = reviewedStagingProjectBindings(expectedIdentity);
  if (extraProjectBinding) projectBindings.push(extraProjectBinding);
  const directRunPolicy = {
    bindings: [{
      role: 'roles/run.invoker',
      members: [
        'serviceAccount:benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com',
      ],
    }],
  };
  const rolesWithInvoke = new Set([
    'roles/cloudfunctions.developer',
    'roles/editor',
    'roles/owner',
    'roles/cloudfunctions.serviceAgent',
    'roles/cloudfunctions.standardServiceAgent',
    'roles/run.serviceAgent',
  ]);
  const tokenMintPermissions = (role) => [
    ...(role === openIdOnlyRole ? [] : ['iam.serviceAccounts.getAccessToken']),
    'iam.serviceAccounts.getOpenIdToken',
  ];
  const runtimePermissions = {
    'roles/cloudbuild.serviceAgent': tokenMintPermissions('roles/cloudbuild.serviceAgent'),
    'roles/cloudfunctions.serviceAgent': tokenMintPermissions('roles/cloudfunctions.serviceAgent'),
    'roles/cloudfunctions.standardServiceAgent': tokenMintPermissions(
      'roles/cloudfunctions.standardServiceAgent',
    ),
    'roles/datastore.user': [
      'datastore.entities.get',
      'datastore.entities.list',
      'datastore.entities.create',
      'datastore.entities.update',
      'datastore.entities.delete',
    ],
    'roles/logging.logWriter': ['logging.logEntries.create'],
    'roles/iam.serviceAccountTokenCreator': tokenMintPermissions(
      'roles/iam.serviceAccountTokenCreator',
    ),
    'roles/pubsub.serviceAgent': tokenMintPermissions('roles/pubsub.serviceAgent'),
    'roles/run.serviceAgent': tokenMintPermissions('roles/run.serviceAgent'),
  };
  const bucketPolicy = { bindings: reviewedStorageBindings(projectId, true) };
  const workloadIdentitySubject = (
    `principal://iam.googleapis.com/projects/${projectNumber}/locations/global/`
    + 'workloadIdentityPools/github-staging/subject/'
    + 'repo:brovzar-lab/Lemon-Screenplay-Dashboard:environment:staging'
  );
  const policyByEmail = new Map([
    ['benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com', { bindings: [{
      role: 'roles/iam.serviceAccountTokenCreator',
      members: ['user:billyrovzar@gmail.com'],
    }] }],
    [runtime, { bindings: [{
      role: 'roles/iam.serviceAccountUser',
      members: [`serviceAccount:${deployer}`],
    }] }],
    [deployer, { bindings: [{
      role: 'roles/iam.workloadIdentityUser',
      members: [workloadIdentitySubject],
    }] }],
    [`firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com`, {}],
    [`${projectNumber}-compute@developer.gserviceaccount.com`, { bindings: [{
      role: 'roles/iam.serviceAccountUser',
      members: [`serviceAccount:${deployer}`],
    }] }],
    [`${projectId}@appspot.gserviceaccount.com`, { bindings: [{
      role: 'roles/iam.serviceAccountUser',
      members: [`serviceAccount:${deployer}`],
    }] }],
  ]);
  const privilegedServiceAccountResources = [...policyByEmail].map(([email, policy]) => ({
    email,
    policy,
    keys: [{
      name: `projects/${projectId}/serviceAccounts/${email}/keys/system-1`,
      keyType: email === userManagedKeyEmail ? 'USER_MANAGED' : 'SYSTEM_MANAGED',
    }],
  }));
  return buildStagingIdentityProof({
    projectResource: {
      projectId,
      projectNumber,
      lifecycleState: 'ACTIVE',
      labels: { environment: 'staging', application: 'lemon-screenplay-dashboard' },
    },
    projectIamPolicy: { bindings: projectBindings },
    directRunPolicy,
    secretPolicy: { bindings: [{
      role: 'roles/secretmanager.secretAccessor',
      members: [`serviceAccount:${runtime}`],
    }] },
    privilegedServiceAccountResources,
    workloadIdentityProvider: {
      name: providerName,
      state: 'ACTIVE',
      ...(providerDisabled ? { disabled: true } : {}),
      displayName: 'Lemon staging workflow',
      oidc: providerOidc ?? { issuerUri: 'https://token.actions.githubusercontent.com' },
      attributeCondition: providerCondition ?? (
        "assertion.repository_owner=='brovzar-lab' && "
        + "assertion.repository=='brovzar-lab/Lemon-Screenplay-Dashboard' && "
        + "assertion.ref=='refs/heads/main' && assertion.environment=='staging'"
      ),
      attributeMapping: {
        'attribute.environment': 'assertion.environment',
        'attribute.ref': 'assertion.ref',
        'attribute.repository': 'assertion.repository',
        'attribute.repository_owner': 'assertion.repository_owner',
        'google.subject': 'assertion.sub',
      },
    },
    workloadIdentityProviders: providerInventory,
    workloadIdentityPool: {
      name: `projects/${projectNumber}/locations/global/workloadIdentityPools/github-staging`,
      displayName: 'GitHub staging deployments',
      state: 'ACTIVE',
    },
    workloadIdentityPoolPolicy: poolPolicy ?? {},
    roleDefinitions: projectBindings.map((binding) => binding.role)
      .filter((role, index, roles) => roles.indexOf(role) === index)
      .map((name) => ({
        name,
        ...(name === 'projects/lemon-screenplay-staging/roles/v9StagingIdentityProofReader'
          ? {
            title: 'V9 Staging Identity Proof Reader',
            description: (
              'Read-only V9 staging identity proof metadata; no deploy, invoke, secret, or data access.'
            ),
            stage: 'GA',
          }
          : {}),
        includedPermissions: [
          ...(name === 'projects/lemon-screenplay-staging/roles/v9StagingIdentityProofReader'
            ? STAGING_IDENTITY_READER_PERMISSIONS
            : []),
          ...(rolesWithInvoke.has(name) ? ['run.routes.invoke'] : []),
          ...(runtimePermissions[name] ?? []),
        ],
      })),
    stagingStorageResources: isolationExpected().stagingStorageBuckets.map((name) => ({
      metadata: { name, uniform_bucket_level_access: true },
      policy: bucketPolicy,
    })),
  }, {
    projectId,
    projectNumber,
    runtimeServiceAccount: runtime,
    deployerServiceAccount: deployer,
    workloadIdentityProvider: providerName,
    stagingStorageBuckets: isolationExpected().stagingStorageBuckets,
    verifiedAt: '2026-08-28T12:00:00Z',
  });
}

test('candidate gate accepts only the exact clean origin/main commit and bounded cap', () => {
  assert.deepEqual(validateCandidateGate(valid), {
    capMicrousd: 8_000_000,
    priorMicrousd: 106_425,
  });
  for (const [field, value, message] of [
    ['headSha', 'b'.repeat(40), /identical/],
    ['originMainSha', 'b'.repeat(40), /identical/],
    ['cleanStatus', ' M execution/ingest_v9.py', /dirty/],
    ['benchmarkCapUsd', '0', /positive/],
    ['benchmarkCapUsd', '1.0000001', /six decimal/],
    ['priorAuditSpendUsd', '0', /settled pilot/],
    ['benchmarkCapUsd', '39.893576', /authorized ceiling/],
    ['approvedSourceSha', 'not-a-sha', /40-character/],
    ['inferenceGeo', 'automatic', /explicitly global or us/],
    ['runId', 'v9-santa-20260827', /opaque UUIDv4 or SHA-256/],
  ]) {
    assert.throws(() => validateCandidateGate({ ...valid, [field]: value }), message);
  }
});

test('candidate gate refuses another project or deployer identity', () => {
  assert.throws(
    () => validateCandidateGate({ ...valid, stagingProjectId: 'lemon-screenplay-dashboard' }),
    /unapproved staging/,
  );
  assert.throws(
    () => validateCandidateGate({
      ...valid,
      deployerServiceAccount: 'github-deployer@lemon-screenplay-dashboard.iam.gserviceaccount.com',
    }),
    /outside the staging project/,
  );
  assert.throws(
    () => validateCandidateGate({
      ...valid,
      productionAuditorServiceAccount: valid.deployerServiceAccount,
    }),
    /unreviewed production auditor/,
  );
});

test('candidate upload accepts only reviewed runtime files and rejects local artifacts', () => {
  const tracked = [
    'functions/.gcloudignore',
    'functions/package.json',
    'functions/package-lock.json',
    'functions/lib/llmProxyCandidate.js',
    'functions/lib/anthropicPricing.json',
    'functions/reader-charters/v1/structure.md',
    'functions/src/llmProxyCandidate.ts',
    'functions/tsconfig.json',
  ];
  assert.equal(assertCandidateUploadFiles([
    'package.json',
    'package-lock.json',
    'lib/llmProxyCandidate.js',
    'lib/anthropicPricing.json',
  ].join('\n'), tracked), true);
  assert.throws(
    () => assertCandidateUploadFiles(
      'package.json\npackage-lock.json\nlib/llmProxyCandidate.js\n.env',
      tracked,
    ),
    /forbidden secret or temporary file/,
  );
  assert.throws(
    () => assertCandidateUploadFiles(
      'package.json\npackage-lock.json\nlib/llmProxyCandidate.js\nlib/unreviewed.js',
      tracked,
    ),
    /differs from reviewed deploy inputs/,
  );
  assert.throws(
    () => assertCandidateUploadFiles(
      'package.json\npackage-lock.json\nlib/llmProxyCandidate.js\nreader-charters/v1/structure.md',
      tracked,
    ),
    /differs from reviewed deploy inputs/,
  );
  assert.equal(assertCandidateSourceTree(['functions/.env.example']), true);
  assert.throws(
    () => assertCandidateSourceTree(['functions/private-service-account.json']),
    /forbidden secret or temporary file/,
  );
});

test('private IAM proof accepts only the exact benchmark caller', () => {
  assert.equal(assertPrivateIamPolicy({
    bindings: [{
      role: 'roles/run.invoker',
      members: [
        'serviceAccount:benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com',
      ],
    }],
  }), true);
  for (const member of [
    'allUsers',
    'allAuthenticatedUsers',
    'serviceAccount:unrelated@lemon-screenplay-staging.iam.gserviceaccount.com',
  ]) {
    assert.throws(() => assertPrivateIamPolicy({
      bindings: [{ role: 'roles/run.invoker', members: [member] }],
    }), /exact benchmark caller/);
  }
  assert.throws(() => assertPrivateIamPolicy({ bindings: [] }), /exact benchmark caller/);
  assert.throws(() => assertPrivateIamPolicy({
    bindings: [{
      role: 'roles/run.invoker',
      members: [
        'serviceAccount:benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com',
        'serviceAccount:unrelated@lemon-screenplay-staging.iam.gserviceaccount.com',
      ],
    }],
  }), /exact benchmark caller/);
  assert.throws(() => assertPrivateIamPolicy({
    bindings: [{
      role: 'roles/run.invoker',
      members: [
        'serviceAccount:benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com',
      ],
      condition: { expression: 'request.time < timestamp("2026-09-01T00:00:00Z")' },
    }],
  }), /unexpected condition/);
  assert.throws(() => assertPrivateIamPolicy({
    bindings: [
      {
        role: 'roles/run.invoker',
        members: [
          'serviceAccount:benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com',
        ],
      },
      {
        role: 'roles/run.admin',
        members: ['serviceAccount:unrelated@lemon-screenplay-staging.iam.gserviceaccount.com'],
      },
    ],
  }), /resource policy/);
});

test('complete production IAM inventory has no staging identity grant', () => {
  const expected = isolationExpected();
  expected.productionProjectNumber = '493694843892';
  const projectResource = {
    projectId: expected.productionProjectId,
    projectNumber: expected.productionProjectNumber,
    lifecycleState: 'ACTIVE',
  };
  const projectPolicy = productionProjectPolicy();
  const proof = buildProductionIsolationProof(
    projectResource,
    projectPolicy,
    expected,
  );
  assert.match(proof.proof_sha256, /^[a-f0-9]{64}$/);
  assert.equal(proof.status, 'passed_complete_static_iam_inventory');
  assert.equal(proof.production_project_scope_state, 'STANDALONE_NO_PARENT');
  assert.equal(proof.production_access_state, 'NO_STAGING_IDENTITY_ALLOW_BINDING');
  assert.throws(
    () => buildProductionIsolationProof(
      projectResource,
      productionProjectPolicy([{
        role: 'roles/datastore.user',
        members: [
          'serviceAccount:benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
        ],
      }]),
      expected,
    ),
    /reviewed contract/,
  );
  const serviceAccountGrant = structuredClone(expected);
  serviceAccountGrant.productionServiceAccountResources[0].policy = { bindings: [{
    role: 'roles/iam.serviceAccountTokenCreator',
    members: [
      'serviceAccount:benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
    ],
  }] };
  assert.throws(
    () => buildProductionIsolationProof(
      projectResource,
      projectPolicy,
      serviceAccountGrant,
    ),
    /reviewed contract/,
  );
  assert.throws(
    () => buildProductionIsolationProof(
      projectResource,
      productionProjectPolicy([{
        role: 'roles/datastore.viewer',
        members: ['group:unreviewed@example.com'],
      }]),
      expected,
    ),
    /reviewed contract/,
  );
  assert.throws(
    () => buildProductionIsolationProof(
      projectResource,
      productionProjectPolicy([{
        role: 'roles/viewer',
        members: ['serviceAccount:external-pivot@different-project.iam.gserviceaccount.com'],
      }]),
      expected,
    ),
    /reviewed contract/,
  );
  const downloadCapableAuditor = structuredClone(expected);
  downloadCapableAuditor.productionAuditorRoleDefinition.includedPermissions.push(
    'storage.objects.get',
  );
  assert.throws(
    () => buildProductionIsolationProof(
      projectResource,
      projectPolicy,
      downloadCapableAuditor,
    ),
    /not metadata-only/,
  );
  const plan = buildIsolationProbePlan(expected);
  const hmacProbe = plan.find((item) => item.permission === 'storage.hmacKeys.create');
  assert.deepEqual({
    resource_name: hmacProbe.resource_name,
    resource_service: hmacProbe.resource_service,
    resource_type: hmacProbe.resource_type,
  }, {
    resource_name: 'projects/lemon-screenplay-dashboard',
    resource_service: 'storage.googleapis.com',
    resource_type: 'cloudresourcemanager.googleapis.com/Project',
  });
  assert.ok(plan.some((item) => item.permission === 'datastore.entities.get'));
  assert.ok(plan.some((item) => item.full_resource_name.includes('/backups/backup-1')));
  assert.ok(plan.some((item) => item.full_resource_name.includes('/backupSchedules/schedule-1')));
});

test('staging identity proof rejects indirect principals and provider drift', () => {
  assert.throws(
    () => stagingIdentityProof({
      extraProjectBinding: {
        role: 'roles/viewer',
        members: ['group:unreviewed@example.com'],
      },
    }),
    /indirect or public principal/,
  );
  assert.throws(
    () => stagingIdentityProof({
      providerCondition: (
        "assertion.repository_owner=='brovzar-lab' && "
        + "assertion.repository=='brovzar-lab/Lemon-Screenplay-Dashboard' && "
        + "assertion.ref=='refs/heads/unreviewed' && assertion.environment=='staging'"
      ),
    }),
    /Workload Identity provider/,
  );
  assert.throws(
    () => stagingIdentityProof({
      extraProvider: {
        name: (
          'projects/549848020392/locations/global/workloadIdentityPools/'
          + 'github-staging/providers/unreviewed-provider'
        ),
        state: 'ACTIVE',
      },
    }),
    /provider inventory is not exclusive/,
  );
  assert.throws(
    () => stagingIdentityProof({
      extraProjectBinding: {
        role: 'roles/owner',
        members: [
          'serviceAccount:benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com',
        ],
      },
    }),
    /reviewed contract/,
  );
  assert.throws(
    () => stagingIdentityProof({
      extraProjectBinding: {
        role: 'roles/viewer',
        members: ['user:unreviewed@example.com'],
      },
    }),
    /reviewed contract/,
  );
  assert.throws(
    () => stagingIdentityProof({
      providerOidc: {
        issuerUri: 'https://token.actions.githubusercontent.com',
        jwksJson: '{"keys":[]}',
      },
    }),
    /Workload Identity provider/,
  );
  assert.throws(
    () => stagingIdentityProof({
      providerOidc: {
        issuerUri: 'https://token.actions.githubusercontent.com',
        allowedAudiences: ['attacker-controlled'],
      },
    }),
    /Workload Identity provider/,
  );
  assert.throws(
    () => stagingIdentityProof({ providerDisabled: true }),
    /Workload Identity provider/,
  );
  assert.throws(
    () => stagingIdentityProof({
      poolPolicy: { bindings: [{
        role: 'roles/iam.workloadIdentityPoolAdmin',
        members: ['user:unreviewed@example.com'],
      }] },
    }),
    /Workload Identity pool IAM policy/,
  );
  assert.throws(
    () => stagingIdentityProof({
      userManagedKeyEmail:
        'benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com',
    }),
    /unreviewed key/,
  );
});

test('staging identity proof inventories all reviewed caller impersonation paths', () => {
  const proof = stagingIdentityProof();
  const firebaseAdmin = (
    'firebase-adminsdk-fbsvc@lemon-screenplay-staging.iam.gserviceaccount.com'
  );
  assert.ok(proof.reviewed_effective_invokers.includes(`serviceAccount:${firebaseAdmin}`));
  assert.ok(proof.privileged_service_accounts.includes(firebaseAdmin));
  for (const agent of [
    'service-549848020392@gcp-sa-cloudbuild.iam.gserviceaccount.com',
    'service-549848020392@gcf-admin-robot.iam.gserviceaccount.com',
    'service-549848020392@gcp-sa-pubsub.iam.gserviceaccount.com',
    'service-549848020392@serverless-robot-prod.iam.gserviceaccount.com',
  ]) {
    assert.ok(proof.reviewed_effective_invokers.includes(`serviceAccount:${agent}`));
    assert.ok(proof.provider_managed_invoker_service_agents.includes(agent));
  }
  assert.throws(
    () => stagingIdentityProof({ userManagedKeyEmail: firebaseAdmin }),
    /unreviewed key/,
  );
  const openIdOnlyProof = stagingIdentityProof({
    openIdOnlyRole: 'roles/cloudbuild.serviceAgent',
  });
  assert.ok(openIdOnlyProof.reviewed_effective_invokers.includes(
    'serviceAccount:service-549848020392@gcp-sa-cloudbuild.iam.gserviceaccount.com',
  ));
  assert.throws(
    () => stagingIdentityProof({
      openIdOnlyRole: 'roles/cloudbuild.serviceAgent',
      extraProjectBinding: {
        role: 'roles/cloudbuild.serviceAgent',
        members: ['serviceAccount:unreviewed@lemon-screenplay-staging.iam.gserviceaccount.com'],
      },
    }),
    /reviewed contract/,
  );
});

test('staging identity CLI binds the exact reviewed bucket inventory', () => {
  const expected = stagingIdentityAuditExpected({
    STAGING_PROJECT_ID: 'lemon-screenplay-staging',
    STAGING_PROJECT_NUMBER: '549848020392',
    RUNTIME_SERVICE_ACCOUNT:
      'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
    DEPLOYER_SERVICE_ACCOUNT:
      'benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com',
    WORKLOAD_IDENTITY_PROVIDER: valid.workloadIdentityProvider,
    STAGING_IDENTITY_VERIFIED_AT: '2026-08-28T12:00:00Z',
  });
  assert.deepEqual(expected.stagingStorageBuckets, [...REVIEWED_STAGING_STORAGE_BUCKETS]);
  assert.equal(expected.stagingStorageBuckets.length, 2);
  assert.ok(STAGING_IDENTITY_READER_PERMISSIONS.includes('iam.roles.get'));
});

test('production Storage ACL proof inventories every version without exposing names', () => {
  const runtime = 'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com';
  const proof = storageAclProof(runtime);
  assert.equal(proof.status, 'passed_no_runtime_access_acl');
  assert.equal(proof.object_version_count, 1);
  assert.equal(proof.soft_deleted_object_count, 0);
  assert.doesNotMatch(JSON.stringify(proof), /private|screenplay\.pdf/);
  assert.throws(
    () => storageAclProof(runtime, [{ entity: `user-${runtime}`, role: 'READER' }]),
    /grants a staging identity access/,
  );
  assert.throws(
    () => storageAclProof(runtime, [{ entity: 'group-unknown@example.com', role: 'READER' }]),
    /unprovable principal/,
  );
});

test('production soft-deleted Storage inventory cannot stop after an empty page', () => {
  const source = fs.readFileSync(new URL('./candidate-staging-gate.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes(
    "['storage', 'ls', '--json', '--soft-deleted', '--exhaustive', wildcard]",
  ));
});

test('deployment receipt binds the platform runtime, revision, and image digest', () => {
  const functionResource = {
    name: 'projects/lemon-screenplay-staging/locations/us-central1/functions/llmProxyCandidate',
    state: 'ACTIVE',
    buildConfig: {
      runtime: 'nodejs22',
      entryPoint: 'llmProxyCandidate',
      build: 'projects/1/locations/us-central1/builds/build-1',
      dockerRepository: (
        'projects/lemon-screenplay-staging/locations/us-central1/'
        + 'repositories/gcf-artifacts'
      ),
      serviceAccount: (
        'projects/lemon-screenplay-staging/serviceAccounts/'
        + '549848020392-compute@developer.gserviceaccount.com'
      ),
      automaticUpdatePolicy: {},
    },
    serviceConfig: {
      uri: 'https://candidate.example',
      service: 'projects/lemon-screenplay-staging/locations/us-central1/services/llmproxycandidate',
      serviceAccountEmail: 'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
      availableMemory: '512M',
      availableCpu: '0.3333',
      timeoutSeconds: 3600,
      maxInstanceCount: 5,
      maxInstanceRequestConcurrency: 1,
      allTrafficOnLatestRevision: true,
      ingressSettings: 'ALLOW_ALL',
      revision: 'llmproxycandidate-00005-abc',
      environmentVariables: {
        FIREBASE_CONFIG: '{"projectId":"lemon-screenplay-staging"}',
        BENCHMARK_RUN_ID: valid.runId,
        BENCHMARK_CAP_USD: '8',
        BENCHMARK_PRIOR_AUDIT_SPEND_USD: '0.106425',
        BENCHMARK_INFERENCE_GEO: 'global',
        BENCHMARK_GIT_SHA: 'a'.repeat(40),
        BENCHMARK_SOURCE_CLEAN: 'true',
        BENCHMARK_CATALOG_SHA256: 'b'.repeat(64),
        BENCHMARK_BUILD_TIMESTAMP: '2026-08-28T12:00:00Z',
        BENCHMARK_RUNTIME_SERVICE_ACCOUNT:
          'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
        BENCHMARK_STAGING_FIRESTORE_PROJECT_ID: 'lemon-screenplay-staging',
        BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID: 'lemon-screenplay-dashboard',
        BENCHMARK_STORAGE_BUCKET: 'lemon-screenplay-dashboard.firebasestorage.app',
      },
      secretEnvironmentVariables: [{
        key: 'BENCHMARK_ANTHROPIC_API_KEY',
        projectId: '549848020392',
        secret: 'BENCHMARK_ANTHROPIC_API_KEY',
        version: '7',
      }],
    },
  };
  const revisionResource = {
    metadata: { name: 'llmproxycandidate-00005-abc' },
    spec: {
      serviceAccountName: 'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
      containerConcurrency: 1,
      containers: [{
        image: (
          'us-central1-docker.pkg.dev/lemon-screenplay-staging/gcf-artifacts/'
          + `candidate@sha256:${'c'.repeat(64)}`
        ),
      }],
    },
    status: { imageDigest: `sha256:${'c'.repeat(64)}` },
  };
  const expected = {
    projectId: 'lemon-screenplay-staging',
    region: 'us-central1',
    serviceUri: 'https://candidate.example',
    runtimeServiceAccount: 'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
    gitSha: 'a'.repeat(40),
    catalogSha256: 'b'.repeat(64),
    inferenceGeo: 'global',
    runId: valid.runId,
    benchmarkCapUsd: '8',
    priorAuditSpendUsd: '0.106425',
    buildTimestamp: '2026-08-28T12:00:00Z',
    projectNumber: '549848020392',
    deployerServiceAccount:
      'benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com',
    workloadIdentityProvider: valid.workloadIdentityProvider,
    secretVersion: '7',
    productionProjectNumber: '493694843892',
    productionIsolationProof: buildProductionIsolationProof(
      {
        projectId: 'lemon-screenplay-dashboard',
        projectNumber: '493694843892',
        lifecycleState: 'ACTIVE',
      },
      productionProjectPolicy(),
      { ...isolationExpected(), productionProjectNumber: '493694843892' },
    ),
    productionStorageAclProof: storageAclProof(
      'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
    ),
    stagingIdentityProof: stagingIdentityProof(),
  };
  const receipt = buildDeploymentReceipt(functionResource, revisionResource, expected);
  assert.equal(receipt.cloud_run_revision, 'llmproxycandidate-00005-abc');
  assert.equal(receipt.container_image_digest, `sha256:${'c'.repeat(64)}`);
  assert.equal(receipt.inference_geo, 'global');
  assert.equal(receipt.run_id, valid.runId);
  assert.equal(receipt.runtime_update_policy, 'automatic');
  assert.equal(assertPredeployPlatformConfig(functionResource, expected), true);
  assert.equal(receipt.available_cpu, '0.3333');
  assert.match(receipt.pricing_sha256, /^[a-f0-9]{64}$/);
  assert.match(receipt.deployment_config_sha256, /^[a-f0-9]{64}$/);
  assert.match(receipt.receipt_sha256, /^[a-f0-9]{64}$/);
  assert.throws(
    () => buildDeploymentReceipt({
      ...functionResource,
      serviceConfig: { ...functionResource.serviceConfig, maxInstanceCount: 6 },
    }, revisionResource, expected),
    /runtime/,
  );
  assert.throws(
    () => buildDeploymentReceipt({
      ...functionResource,
      serviceConfig: {
        ...functionResource.serviceConfig,
        environmentVariables: {
          ...functionResource.serviceConfig.environmentVariables,
          BENCHMARK_CAP_USD: '7',
        },
      },
    }, revisionResource, expected),
    /platform environment/,
  );
  assert.throws(
    () => buildDeploymentReceipt({
      ...functionResource,
      serviceConfig: {
        ...functionResource.serviceConfig,
        environmentVariables: {
          ...functionResource.serviceConfig.environmentVariables,
          ANTHROPIC_BASE_URL: 'https://unapproved-provider.example',
        },
      },
    }, revisionResource, expected),
    /unexpected runtime environment variable/,
  );
  assert.throws(
    () => buildDeploymentReceipt({
      ...functionResource,
      serviceConfig: {
        ...functionResource.serviceConfig,
        secretEnvironmentVariables: [{
          ...functionResource.serviceConfig.secretEnvironmentVariables[0],
          secret: 'DIFFERENT_SECRET',
        }],
      },
    }, revisionResource, expected),
    /secret binding/,
  );
  assert.throws(
    () => buildDeploymentReceipt({
      ...functionResource,
      serviceConfig: {
        ...functionResource.serviceConfig,
        secretEnvironmentVariables: [{
          ...functionResource.serviceConfig.secretEnvironmentVariables[0],
          version: 'latest',
        }],
      },
    }, revisionResource, expected),
    /secret binding/,
  );
  assert.throws(
    () => buildDeploymentReceipt({
      ...functionResource,
      buildConfig: {
        ...functionResource.buildConfig,
        dockerRepository: (
          'projects/lemon-screenplay-dashboard/locations/us-central1/'
          + 'repositories/production-images'
        ),
      },
    }, revisionResource, expected),
    /platform runtime/,
  );
  assert.throws(
    () => buildDeploymentReceipt({
      ...functionResource,
      buildConfig: {
        ...functionResource.buildConfig,
        environmentVariables: { GOOGLE_NODE_RUN_SCRIPTS: 'malicious-build-step' },
      },
    }, revisionResource, expected),
    /platform runtime/,
  );
  assert.throws(
    () => buildDeploymentReceipt({
      ...functionResource,
      buildConfig: {
        ...functionResource.buildConfig,
        automaticUpdatePolicy: undefined,
        onDeployUpdatePolicy: { runtimeVersion: 'nodejs22_20260801_22_22_3_RC00' },
      },
    }, revisionResource, expected),
    /platform runtime/,
  );
  assert.throws(
    () => buildDeploymentReceipt({
      ...functionResource,
      serviceConfig: {
        ...functionResource.serviceConfig,
        vpcConnector: (
          'projects/lemon-screenplay-dashboard/locations/us-central1/connectors/production'
        ),
      },
    }, revisionResource, expected),
    /platform runtime/,
  );
});
