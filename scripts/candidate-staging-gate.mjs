import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { deploymentConfigSha256 } = require('../functions/lib/benchmarkRelease.js');
const { llmPricingSha256 } = require('../functions/lib/llmCost.js');

const STAGING_PROJECTS = new Set([
  'lemon-screenplay-staging',
]);
const SHA = /^[a-f0-9]{40}$/;
const RUN_ID = /^(?:[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/;
const MONEY = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,6}))?$/;
const PILOT_MICROUSD = 106_425;
const AUDIT_LIMIT_MICROUSD = 40_000_000;
const EXPECTED_INVOKER =
  'serviceAccount:benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com';
const EXPECTED_DEPLOYER = (
  'benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com'
);
const REVIEWED_STAGING_OWNER = 'user:billyrovzar@gmail.com';
const RUN_INVOKE_PERMISSION = 'run.routes.invoke';
const GITHUB_REPOSITORY = 'brovzar-lab/Lemon-Screenplay-Dashboard';
const GITHUB_REF = 'refs/heads/main';
const GITHUB_ENVIRONMENT = 'staging';
const WIF_POOL = 'github-staging';
const WIF_PROVIDER = 'github-lemon-screenplay';
const WIF_ISSUER = 'https://token.actions.githubusercontent.com';
const EXPECTED_WIF_PROVIDER = (
  'projects/549848020392/locations/global/workloadIdentityPools/'
  + `${WIF_POOL}/providers/${WIF_PROVIDER}`
);
export const REVIEWED_STAGING_STORAGE_BUCKETS = Object.freeze([
  'gcf-v2-sources-549848020392-us-central1',
  'gcf-v2-uploads-549848020392.us-central1.cloudfunctions.appspot.com',
]);
const PRODUCTION_PROJECT_ID = 'lemon-screenplay-dashboard';
const PRODUCTION_AUDITOR_SERVICE_ACCOUNT = (
  `v9-production-auditor@${PRODUCTION_PROJECT_ID}.iam.gserviceaccount.com`
);
const PRODUCTION_AUDITOR_ROLE = (
  `projects/${PRODUCTION_PROJECT_ID}/roles/v9ProductionMetadataAuditor`
);
const STAGING_IDENTITY_READER_ROLE = (
  'projects/lemon-screenplay-staging/roles/v9StagingIdentityProofReader'
);
export const STAGING_IDENTITY_READER_PERMISSIONS = [
  'iam.googleapis.com/workloadIdentityPoolProviders.get',
  'iam.googleapis.com/workloadIdentityPoolProviders.list',
  'iam.googleapis.com/workloadIdentityPools.get',
  'iam.googleapis.com/workloadIdentityPools.getIamPolicy',
  'iam.roles.get',
  'iam.serviceAccountKeys.list',
  'iam.serviceAccounts.getIamPolicy',
].sort();
export const PRODUCTION_AUDITOR_PERMISSIONS = [
  'datastore.backupSchedules.list',
  'datastore.backups.list',
  'datastore.databases.list',
  'datastore.locations.get',
  'datastore.locations.list',
  'iam.roles.get',
  'iam.serviceAccounts.getIamPolicy',
  'iam.serviceAccounts.list',
  'resourcemanager.projects.get',
  'resourcemanager.projects.getIamPolicy',
  'storage.buckets.get',
  'storage.buckets.getIamPolicy',
  'storage.objects.getIamPolicy',
  'storage.objects.list',
].sort();
const FORBIDDEN_SOURCE_FILE = /(?:^|\/)(?:\.env(?:\..*)?|.*(?:credential|service-account|adminsdk).*\.json|.*\.(?:pem|key|p12|log|tmp))$/i;
export const STAGING_CONTROL_PERMISSION = 'datastore.entities.get';
const FIRESTORE_DATABASE_MUTATION_PERMISSIONS = [
  'datastore.databases.bulkDelete',
  'datastore.databases.clone',
  'datastore.databases.createTagBinding',
  'datastore.databases.delete',
  'datastore.databases.deleteTagBinding',
  'datastore.databases.export',
  'datastore.databases.import',
  'datastore.databases.update',
  'datastore.entities.create',
  'datastore.entities.delete',
  'datastore.entities.update',
  'datastore.schemas.create',
  'datastore.schemas.delete',
  'datastore.schemas.update',
];
const FIRESTORE_DATA_READ_PERMISSIONS = [
  'datastore.entities.get',
  'datastore.entities.list',
];
const FIRESTORE_BACKUP_SCHEDULE_MUTATION_PERMISSIONS = [
  'datastore.backupSchedules.create',
  'datastore.backupSchedules.delete',
  'datastore.backupSchedules.update',
];
const FIRESTORE_BACKUP_MUTATION_PERMISSIONS = [
  'datastore.backups.delete',
  'datastore.backups.restoreDatabase',
];
const FIRESTORE_OPERATION_MUTATION_PERMISSIONS = [
  'datastore.operations.cancel',
  'datastore.operations.delete',
];
const FIRESTORE_USER_CREDENTIAL_MUTATION_PERMISSIONS = [
  'datastore.userCreds.create',
  'datastore.userCreds.delete',
  'datastore.userCreds.update',
];
const STORAGE_BUCKET_MUTATION_PERMISSIONS = [
  'storage.buckets.createTagBinding',
  'storage.buckets.delete',
  'storage.buckets.deleteTagBinding',
  'storage.buckets.enableObjectRetention',
  'storage.buckets.exemptFromIpFilter',
  'storage.buckets.relocate',
  'storage.buckets.restore',
  'storage.buckets.setIamPolicy',
  'storage.buckets.setIpFilter',
  'storage.buckets.update',
];
const STORAGE_BUCKET_READ_PERMISSIONS = [
  'storage.buckets.get',
  'storage.buckets.getIamPolicy',
  'storage.objects.list',
];
const STORAGE_CACHE_MUTATION_PERMISSIONS = [
  'storage.anywhereCaches.create',
  'storage.anywhereCaches.disable',
  'storage.anywhereCaches.pause',
  'storage.anywhereCaches.resume',
  'storage.anywhereCaches.update',
  'storage.bucketOperations.cancel',
];
const STORAGE_FOLDER_MUTATION_PERMISSIONS = [
  'storage.folders.create',
  'storage.folders.delete',
  'storage.folders.rename',
];
const STORAGE_FEATURE_MUTATION_PERMISSIONS = [
  'storage.featureConfigs.create',
  'storage.featureConfigs.delete',
  'storage.featureConfigs.update',
];
const STORAGE_BATCH_MUTATION_PERMISSIONS = [
  'storagebatchoperations.jobs.cancel',
  'storagebatchoperations.jobs.create',
  'storagebatchoperations.jobs.delete',
  'storagebatchoperations.operations.cancel',
  'storagebatchoperations.operations.delete',
];
const STORAGE_OBJECT_MUTATION_PERMISSIONS = [
  'storage.multipartUploads.abort',
  'storage.multipartUploads.create',
  'storage.objects.create',
  'storage.objects.createContext',
  'storage.objects.delete',
  'storage.objects.deleteContext',
  'storage.objects.dropContexts',
  'storage.objects.move',
  'storage.objects.overrideUnlockedRetention',
  'storage.objects.restore',
  'storage.objects.setIamPolicy',
  'storage.objects.setRetention',
  'storage.objects.update',
  'storage.objects.updateContext',
];
const STORAGE_OBJECT_READ_PERMISSIONS = [
  'storage.objects.get',
  'storage.objects.getIamPolicy',
];
const STORAGE_MANAGED_FOLDER_MUTATION_PERMISSIONS = [
  'storage.managedFolders.create',
  'storage.managedFolders.delete',
  'storage.managedFolders.setIamPolicy',
];
const STORAGE_HMAC_MUTATION_PERMISSIONS = [
  'storage.hmacKeys.create',
  'storage.hmacKeys.delete',
  'storage.hmacKeys.update',
];
const STORAGE_INSIGHTS_MUTATION_PERMISSIONS = [
  'storageinsights.datasetConfigs.create',
  'storageinsights.datasetConfigs.delete',
  'storageinsights.datasetConfigs.linkDataset',
  'storageinsights.datasetConfigs.unlinkDataset',
  'storageinsights.datasetConfigs.update',
  'storageinsights.reportConfigs.create',
  'storageinsights.reportConfigs.delete',
  'storageinsights.reportConfigs.update',
];

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function microusd(value, field) {
  const match = MONEY.exec(value ?? '');
  if (!match) throw new Error(`${field} must use at most six decimal places.`);
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(6, '0'));
  const result = whole * 1_000_000 + fraction;
  if (!Number.isSafeInteger(result)) throw new Error(`${field} is too large.`);
  return result;
}

export function validateCandidateGate(input) {
  if (!STAGING_PROJECTS.has(input.stagingProjectId)) {
    throw new Error('Refusing unapproved staging project.');
  }
  const accountPattern = new RegExp(
    `^[a-z][a-z0-9-]*@${input.stagingProjectId.replaceAll('.', '\\.')}\\.iam\\.gserviceaccount\\.com$`,
  );
  if (!accountPattern.test(input.deployerServiceAccount ?? '')) {
    throw new Error('Refusing a deployer outside the staging project.');
  }
  if (input.deployerServiceAccount !== EXPECTED_DEPLOYER) {
    throw new Error('Refusing an unreviewed staging deployer identity.');
  }
  if (input.productionAuditorServiceAccount !== PRODUCTION_AUDITOR_SERVICE_ACCOUNT) {
    throw new Error('Refusing an unreviewed production auditor identity.');
  }
  if (input.workloadIdentityProvider !== EXPECTED_WIF_PROVIDER) {
    throw new Error('Refusing an unreviewed Workload Identity provider.');
  }
  if (!SHA.test(input.approvedSourceSha ?? '')) {
    throw new Error('Approved source must be one lowercase 40-character Git SHA.');
  }
  if (!RUN_ID.test(input.runId ?? '')) {
    throw new Error('Run ID must be an opaque UUIDv4 or SHA-256 value.');
  }
  if (input.inferenceGeo !== 'global' && input.inferenceGeo !== 'us') {
    throw new Error('Inference geography must be explicitly global or us.');
  }
  const capMicrousd = microusd(input.benchmarkCapUsd, 'Benchmark cap');
  const priorMicrousd = microusd(input.priorAuditSpendUsd, 'Prior audit spend');
  if (capMicrousd <= 0) throw new Error('Benchmark cap must be positive.');
  if (priorMicrousd < PILOT_MICROUSD) {
    throw new Error('Prior audit spend must include the settled pilot.');
  }
  if (capMicrousd + priorMicrousd > AUDIT_LIMIT_MICROUSD) {
    throw new Error('Cumulative audit spend exceeds the authorized ceiling.');
  }
  if (input.headSha !== input.approvedSourceSha
      || input.originMainSha !== input.approvedSourceSha) {
    throw new Error('HEAD, origin/main, and the approved source must be identical.');
  }
  if (input.cleanStatus !== '') throw new Error('Approved source is dirty.');
  return { capMicrousd, priorMicrousd };
}

export function assertPrivateIamPolicy(policy) {
  const bindings = Array.isArray(policy?.bindings) ? policy.bindings : [];
  if (bindings.some((binding) => binding?.condition)) {
    throw new Error('Candidate Cloud Run invoker policy contains an unexpected condition.');
  }
  if (bindings.length !== 1
      || bindings[0]?.role !== 'roles/run.invoker'
      || !Array.isArray(bindings[0]?.members)
      || bindings[0].members.length !== 1
      || bindings[0].members[0] !== EXPECTED_INVOKER) {
    throw new Error(
      'Candidate Cloud Run resource policy is not the exact benchmark caller binding.',
    );
  }
  return true;
}

function normalizedBindings(policy) {
  if (!Array.isArray(policy?.bindings)) throw new Error('IAM policy is incomplete.');
  return policy.bindings.map((binding) => ({
    role: binding?.role,
    members: Array.isArray(binding?.members) ? [...binding.members].sort() : [],
    ...(binding?.condition ? { condition: binding.condition } : {}),
  })).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function normalizedOptionalBindings(policy, label) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)
      || (policy.bindings !== undefined && !Array.isArray(policy.bindings))) {
    throw new Error(`${label} IAM policy is incomplete.`);
  }
  return normalizedBindings({ bindings: policy.bindings ?? [] });
}

function assertOnlyConcreteIdentityMembers(policy, label) {
  for (const binding of normalizedBindings(policy)) {
    if (typeof binding.role !== 'string' || !binding.members.length) {
      throw new Error(`${label} IAM policy is incomplete.`);
    }
    if (binding.members.some((member) => (
      !member.startsWith('user:') && !member.startsWith('serviceAccount:')
    ))) {
      throw new Error(`${label} IAM policy contains an indirect or public principal.`);
    }
  }
}

function assertNoUnreviewedIdentityMembers(policy, expectedProjectId, label) {
  const stagingSuffix = `@${STAGING_PROJECTS.values().next().value}.iam.gserviceaccount.com`;
  for (const binding of normalizedBindings(policy)) {
    if (typeof binding.role !== 'string' || !binding.members.length) {
      throw new Error(`${label} IAM policy is incomplete.`);
    }
    for (const member of binding.members) {
      const reviewedProjectTeam = new Set([
        `projectOwner:${expectedProjectId}`,
        `projectEditor:${expectedProjectId}`,
        `projectViewer:${expectedProjectId}`,
      ]).has(member);
      const reviewedDirectPrincipal = (
        member.startsWith('user:')
        || member.startsWith('serviceAccount:')
      ) && !member.endsWith(stagingSuffix);
      if (!reviewedProjectTeam && !reviewedDirectPrincipal) {
        throw new Error(`${label} IAM policy contains an unreviewed principal.`);
      }
    }
  }
}

function assertExactBindings(policy, expectedBindings, label) {
  if (canonicalJson(normalizedBindings(policy)) !== canonicalJson(
    [...expectedBindings].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))),
  )) {
    throw new Error(`${label} IAM policy does not match the reviewed contract.`);
  }
}

export function reviewedStorageBindings(projectId, includeObjectRoles = false) {
  const owners = [`projectEditor:${projectId}`, `projectOwner:${projectId}`];
  const viewers = [`projectViewer:${projectId}`];
  return [
    { role: 'roles/storage.legacyBucketOwner', members: owners },
    { role: 'roles/storage.legacyBucketReader', members: viewers },
    ...(includeObjectRoles ? [
      { role: 'roles/storage.legacyObjectOwner', members: owners },
      { role: 'roles/storage.legacyObjectReader', members: viewers },
    ] : []),
  ];
}

function reviewedStagingMetadataReader(expected) {
  const contract = {
    role: STAGING_IDENTITY_READER_ROLE,
    member: `serviceAccount:${expected.deployerServiceAccount}`,
    permissions: STAGING_IDENTITY_READER_PERMISSIONS,
  };
  return { ...contract, contract_sha256: sha256(contract) };
}

export function reviewedStagingProjectBindings(expected) {
  const number = expected.projectNumber;
  const id = expected.projectId;
  const deployer = `serviceAccount:${expected.deployerServiceAccount}`;
  const runtime = `serviceAccount:${expected.runtimeServiceAccount}`;
  return [
    {
      role: 'roles/artifactregistry.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-artifactregistry.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/cloudbuild.builds.builder',
      members: [`serviceAccount:${number}@cloudbuild.gserviceaccount.com`],
    },
    {
      role: 'roles/cloudbuild.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-cloudbuild.iam.gserviceaccount.com`],
    },
    { role: 'roles/cloudfunctions.developer', members: [deployer] },
    {
      role: 'roles/cloudfunctions.serviceAgent',
      members: [`serviceAccount:service-${number}@gcf-admin-robot.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/cloudfunctions.standardServiceAgent',
      members: [`serviceAccount:service-${number}@gcf-admin-robot.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/containerregistry.ServiceAgent',
      members: [`serviceAccount:service-${number}@containerregistry.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/datastore.user',
      members: [runtime],
      condition: {
        title: 'model-benchmarks-only',
        description: 'Restrict benchmark runtime to the named database',
        expression: "resource.name=='projects/lemon-screenplay-staging/databases/model-benchmarks'",
      },
    },
    {
      role: 'roles/editor',
      members: [
        `serviceAccount:${number}-compute@developer.gserviceaccount.com`,
        `serviceAccount:${id}@appspot.gserviceaccount.com`,
      ],
    },
    {
      role: 'roles/firebase.managementServiceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-firebase.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/firebase.sdkAdminServiceAgent',
      members: [`serviceAccount:firebase-adminsdk-fbsvc@${id}.iam.gserviceaccount.com`],
    },
    { role: 'roles/firebase.viewer', members: [deployer] },
    {
      role: 'roles/firebaserules.system',
      members: [`serviceAccount:service-${number}@firebase-rules.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/firestore.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-firestore.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/iam.serviceAccountTokenCreator',
      members: [`serviceAccount:firebase-adminsdk-fbsvc@${id}.iam.gserviceaccount.com`],
    },
    { role: 'roles/logging.logWriter', members: [runtime] },
    { role: 'roles/owner', members: [REVIEWED_STAGING_OWNER] },
    {
      role: 'roles/pubsub.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-pubsub.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/run.serviceAgent',
      members: [`serviceAccount:service-${number}@serverless-robot-prod.iam.gserviceaccount.com`],
    },
    { role: 'roles/secretmanager.viewer', members: [deployer] },
    { role: 'roles/serviceusage.serviceUsageConsumer', members: [deployer] },
    { role: STAGING_IDENTITY_READER_ROLE, members: [deployer] },
  ];
}

export function reviewedProductionProjectBindings(expected) {
  const number = expected.productionProjectNumber;
  const id = expected.productionProjectId;
  const firebaseAdmin = `serviceAccount:firebase-adminsdk-fbsvc@${id}.iam.gserviceaccount.com`;
  return [
    {
      role: 'roles/artifactregistry.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-artifactregistry.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/cloudbuild.builds.builder',
      members: [`serviceAccount:${number}@cloudbuild.gserviceaccount.com`],
    },
    {
      role: 'roles/cloudbuild.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-cloudbuild.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/cloudfunctions.serviceAgent',
      members: [`serviceAccount:service-${number}@gcf-admin-robot.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/containerregistry.ServiceAgent',
      members: [`serviceAccount:service-${number}@containerregistry.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/editor',
      members: [
        `serviceAccount:${number}-compute@developer.gserviceaccount.com`,
        `serviceAccount:${number}@cloudservices.gserviceaccount.com`,
        `serviceAccount:${id}@appspot.gserviceaccount.com`,
      ],
    },
    {
      role: 'roles/eventarc.eventReceiver',
      members: [`serviceAccount:${number}-compute@developer.gserviceaccount.com`],
    },
    {
      role: 'roles/eventarc.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-eventarc.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/firebase.managementServiceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-firebase.iam.gserviceaccount.com`],
    },
    { role: 'roles/firebase.sdkAdminServiceAgent', members: [firebaseAdmin] },
    { role: 'roles/firebaseappcheck.admin', members: [firebaseAdmin] },
    { role: 'roles/firebaseauth.admin', members: [firebaseAdmin] },
    {
      role: 'roles/firebasemods.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-firebasemods.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/firebaserules.system',
      members: [`serviceAccount:service-${number}@firebase-rules.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/firebasestorage.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-firebasestorage.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/firestore.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-firestore.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/iam.serviceAccountTokenCreator',
      members: [
        firebaseAdmin,
        `serviceAccount:service-${number}@gcp-sa-pubsub.iam.gserviceaccount.com`,
      ],
    },
    { role: 'roles/owner', members: [REVIEWED_STAGING_OWNER] },
    {
      role: 'roles/pubsub.publisher',
      members: [`serviceAccount:service-${number}@gs-project-accounts.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/pubsub.serviceAgent',
      members: [`serviceAccount:service-${number}@gcp-sa-pubsub.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/run.invoker',
      members: [`serviceAccount:${number}-compute@developer.gserviceaccount.com`],
    },
    {
      role: 'roles/run.serviceAgent',
      members: [`serviceAccount:service-${number}@serverless-robot-prod.iam.gserviceaccount.com`],
    },
    {
      role: 'roles/storage.admin',
      members: [
        firebaseAdmin,
        `serviceAccount:service-${number}@gcp-sa-eventarc.iam.gserviceaccount.com`,
      ],
    },
    {
      role: PRODUCTION_AUDITOR_ROLE,
      members: [`serviceAccount:${PRODUCTION_AUDITOR_SERVICE_ACCOUNT}`],
    },
  ];
}

function reviewedEffectiveInvokers(expected) {
  return [
    EXPECTED_INVOKER,
    `serviceAccount:${expected.deployerServiceAccount}`,
    `serviceAccount:firebase-adminsdk-fbsvc@${expected.projectId}.iam.gserviceaccount.com`,
    `serviceAccount:${expected.projectNumber}-compute@developer.gserviceaccount.com`,
    `serviceAccount:${expected.projectId}@appspot.gserviceaccount.com`,
    `serviceAccount:service-${expected.projectNumber}@gcf-admin-robot.iam.gserviceaccount.com`,
    `serviceAccount:service-${expected.projectNumber}@serverless-robot-prod.iam.gserviceaccount.com`,
    REVIEWED_STAGING_OWNER,
  ].sort();
}

function reviewedProviderManagedInvokerServiceAgents(expected) {
  return [
    `service-${expected.projectNumber}@gcf-admin-robot.iam.gserviceaccount.com`,
    `service-${expected.projectNumber}@serverless-robot-prod.iam.gserviceaccount.com`,
  ].sort();
}

function reviewedUserManagedStagingServiceAccountPolicies(expected) {
  const deployerMember = `serviceAccount:${expected.deployerServiceAccount}`;
  const workloadIdentity = reviewedWorkloadIdentity(expected);
  return new Map([
    [
      'benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com',
      [{
        role: 'roles/iam.serviceAccountTokenCreator',
        members: [REVIEWED_STAGING_OWNER],
      }],
    ],
    [
      expected.runtimeServiceAccount,
      [{ role: 'roles/iam.serviceAccountUser', members: [deployerMember] }],
    ],
    [
      expected.deployerServiceAccount,
      [{
        role: 'roles/iam.workloadIdentityUser',
        members: [workloadIdentity.subject],
      }],
    ],
    [
      `${expected.projectNumber}-compute@developer.gserviceaccount.com`,
      [{ role: 'roles/iam.serviceAccountUser', members: [deployerMember] }],
    ],
    [
      `${expected.projectId}@appspot.gserviceaccount.com`,
      [{ role: 'roles/iam.serviceAccountUser', members: [deployerMember] }],
    ],
    [
      `firebase-adminsdk-fbsvc@${expected.projectId}.iam.gserviceaccount.com`,
      [],
    ],
  ]);
}

function buildStagingPrivilegedServiceAccountInventory(resources, expected) {
  const expectedPolicies = reviewedUserManagedStagingServiceAccountPolicies(expected);
  if (!Array.isArray(resources) || resources.length !== expectedPolicies.size) {
    throw new Error('Staging privileged service-account inventory is incomplete.');
  }
  const inventory = resources.map((resource) => {
    const email = String(resource?.email ?? '');
    const expectedBindings = expectedPolicies.get(email);
    if (!expectedBindings || !Array.isArray(resource?.keys)) {
      throw new Error('Staging privileged service-account inventory is incomplete.');
    }
    assertExactBindings({
      bindings: normalizedOptionalBindings(
        resource.policy,
        `Staging service account ${email}`,
      ),
    }, expectedBindings, `Staging service account ${email}`);
    if (resource.keys.some((key) => (
      key?.keyType !== 'SYSTEM_MANAGED'
      || typeof key?.name !== 'string'
      || !key.name.startsWith(`projects/${expected.projectId}/serviceAccounts/${email}/keys/`)
    ))) {
      throw new Error('Staging privileged service account has an unreviewed key.');
    }
    return {
      email,
      policy_sha256: sha256(resource.policy),
      key_inventory_sha256: sha256(resource.keys),
      system_managed_key_count: resource.keys.length,
    };
  }).sort((left, right) => left.email.localeCompare(right.email));
  if (canonicalJson(inventory.map((item) => item.email))
      !== canonicalJson([...expectedPolicies.keys()].sort())) {
    throw new Error('Staging privileged service-account inventory is incomplete.');
  }
  return inventory;
}

function reviewedWorkloadIdentity(expected) {
  const providerName = (
    `projects/${expected.projectNumber}/locations/global/`
    + `workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}`
  );
  return {
    provider_name: providerName,
    subject: (
      `principal://iam.googleapis.com/projects/${expected.projectNumber}/locations/global/`
      + `workloadIdentityPools/${WIF_POOL}/subject/repo:${GITHUB_REPOSITORY}:`
      + `environment:${GITHUB_ENVIRONMENT}`
    ),
    attribute_condition: (
      `assertion.repository_owner=='brovzar-lab' && `
      + `assertion.repository=='${GITHUB_REPOSITORY}' && `
      + `assertion.ref=='${GITHUB_REF}' && `
      + `assertion.environment=='${GITHUB_ENVIRONMENT}'`
    ),
    attribute_mapping: {
      'attribute.environment': 'assertion.environment',
      'attribute.ref': 'assertion.ref',
      'attribute.repository': 'assertion.repository',
      'attribute.repository_owner': 'assertion.repository_owner',
      'google.subject': 'assertion.sub',
    },
  };
}

function reviewedProductionAuditor(expected) {
  if (expected.productionProjectId !== PRODUCTION_PROJECT_ID
      || expected.productionAuditorServiceAccount !== PRODUCTION_AUDITOR_SERVICE_ACCOUNT) {
    throw new Error('Production auditor identity is not the reviewed account.');
  }
  if (!/^[1-9][0-9]*$/.test(String(expected.stagingProjectNumber ?? ''))) {
    throw new Error('Staging project number is invalid.');
  }
  if (reviewedWorkloadIdentity({
    projectNumber: String(expected.stagingProjectNumber),
  }).provider_name !== EXPECTED_WIF_PROVIDER) {
    throw new Error('Production auditor trusts an unreviewed Workload Identity pool.');
  }
  const contract = {
    service_account: PRODUCTION_AUDITOR_SERVICE_ACCOUNT,
    role: PRODUCTION_AUDITOR_ROLE,
    workload_identity_principal: reviewedWorkloadIdentity({
      projectNumber: String(expected.stagingProjectNumber),
    }).subject,
    permissions: PRODUCTION_AUDITOR_PERMISSIONS,
  };
  return { ...contract, contract_sha256: sha256(contract) };
}

export function buildStagingIdentityProof(resources, expected) {
  const {
    projectResource,
    projectIamPolicy,
    directRunPolicy,
    secretPolicy,
    privilegedServiceAccountResources,
    workloadIdentityProvider,
    workloadIdentityProviders,
    workloadIdentityPool,
    workloadIdentityPoolPolicy,
    roleDefinitions,
    stagingStorageResources,
  } = resources;
  if (projectResource?.projectId !== expected.projectId
      || String(projectResource?.projectNumber) !== expected.projectNumber
      || projectResource?.lifecycleState !== 'ACTIVE'
      || projectResource?.parent !== undefined
      || projectResource?.labels?.environment !== 'staging'
      || projectResource?.labels?.application !== 'lemon-screenplay-dashboard') {
    throw new Error('Staging project hierarchy is not the reviewed standalone project.');
  }
  if (expected.deployerServiceAccount !== EXPECTED_DEPLOYER) {
    throw new Error('Staging deployer identity is not the reviewed account.');
  }
  assertPrivateIamPolicy(directRunPolicy);
  const runtimeMember = `serviceAccount:${expected.runtimeServiceAccount}`;
  const callerMember = EXPECTED_INVOKER;
  const deployerMember = `serviceAccount:${expected.deployerServiceAccount}`;
  const projectBindings = normalizedBindings(projectIamPolicy);
  assertOnlyConcreteIdentityMembers(projectIamPolicy, 'Staging project');
  const reviewedProjectBindings = reviewedStagingProjectBindings(expected);
  assertExactBindings(projectIamPolicy, reviewedProjectBindings, 'Staging project');
  const memberBindings = (member) => projectBindings.filter(
    (binding) => binding.members.includes(member),
  );
  const expectedRuntimeBindings = [
    {
      role: 'roles/datastore.user',
      members: [runtimeMember],
      condition: {
        title: 'model-benchmarks-only',
        description: 'Restrict benchmark runtime to the named database',
        expression: "resource.name=='projects/lemon-screenplay-staging/databases/model-benchmarks'",
      },
    },
    { role: 'roles/logging.logWriter', members: [runtimeMember] },
  ];
  if (canonicalJson(memberBindings(runtimeMember)) !== canonicalJson(
    expectedRuntimeBindings.sort(
      (left, right) => canonicalJson(left).localeCompare(canonicalJson(right)),
    ),
  ) || memberBindings(callerMember).length !== 0) {
    throw new Error('Benchmark runtime or caller has an unreviewed project binding.');
  }
  assertExactBindings(secretPolicy, [{
    role: 'roles/secretmanager.secretAccessor', members: [runtimeMember],
  }], 'Benchmark secret');
  const workloadIdentity = reviewedWorkloadIdentity(expected);
  if (expected.workloadIdentityProvider !== EXPECTED_WIF_PROVIDER
      || workloadIdentity.provider_name !== EXPECTED_WIF_PROVIDER) {
    throw new Error('Workflow Workload Identity provider does not match the reviewed contract.');
  }
  const privilegedServiceAccounts = buildStagingPrivilegedServiceAccountInventory(
    privilegedServiceAccountResources,
    expected,
  );
  if (workloadIdentityProvider?.name !== workloadIdentity.provider_name
      || workloadIdentityProvider?.state !== 'ACTIVE'
      || workloadIdentityProvider?.disabled === true
      || workloadIdentityProvider?.displayName !== 'Lemon staging workflow'
      || canonicalJson({
        issuerUri: workloadIdentityProvider?.oidc?.issuerUri,
        allowedAudiences: workloadIdentityProvider?.oidc?.allowedAudiences ?? [],
      }) !== canonicalJson({ issuerUri: WIF_ISSUER, allowedAudiences: [] })
      || workloadIdentityProvider?.oidc?.jwksJson !== undefined
      || workloadIdentityProvider?.attributeCondition !== workloadIdentity.attribute_condition
      || canonicalJson(workloadIdentityProvider?.attributeMapping)
        !== canonicalJson(workloadIdentity.attribute_mapping)) {
    throw new Error('Staging Workload Identity provider does not match the reviewed contract.');
  }
  const workloadIdentityPoolName = (
    `projects/${expected.projectNumber}/locations/global/workloadIdentityPools/${WIF_POOL}`
  );
  if (workloadIdentityPool?.name !== workloadIdentityPoolName
      || workloadIdentityPool?.displayName !== 'GitHub staging deployments'
      || workloadIdentityPool?.state !== 'ACTIVE'
      || workloadIdentityPool?.disabled === true) {
    throw new Error('Staging Workload Identity pool does not match the reviewed contract.');
  }
  assertExactBindings({
    bindings: normalizedOptionalBindings(
      workloadIdentityPoolPolicy,
      'Staging Workload Identity pool',
    ),
  }, [], 'Staging Workload Identity pool');
  if (!Array.isArray(workloadIdentityProviders)
      || workloadIdentityProviders.length !== 1
      || workloadIdentityProviders[0]?.name !== workloadIdentity.provider_name
      || workloadIdentityProviders[0]?.state !== 'ACTIVE') {
    throw new Error('Staging Workload Identity provider inventory is not exclusive.');
  }
  if (!Array.isArray(roleDefinitions)) {
    throw new Error('Staging role inventory is incomplete.');
  }
  const permissionsByRole = new Map(roleDefinitions.map((definition) => {
    if (typeof definition?.name !== 'string' || !Array.isArray(definition?.includedPermissions)) {
      throw new Error('Staging role inventory is incomplete.');
    }
    return [definition.name, new Set(definition.includedPermissions)];
  }));
  if (permissionsByRole.size !== new Set(projectBindings.map((binding) => binding.role)).size
      || projectBindings.some((binding) => !permissionsByRole.has(binding.role))) {
    throw new Error('Staging role inventory is incomplete.');
  }
  const metadataReader = reviewedStagingMetadataReader(expected);
  const metadataReaderDefinition = roleDefinitions.find(
    (definition) => definition?.name === metadataReader.role,
  );
  if (metadataReaderDefinition?.title !== 'V9 Staging Identity Proof Reader'
      || metadataReaderDefinition?.description
        !== 'Read-only V9 staging identity proof metadata; no deploy, invoke, secret, or data access.'
      || metadataReaderDefinition?.stage !== 'GA'
      || metadataReaderDefinition?.deleted === true
      || canonicalJson([...(metadataReaderDefinition?.includedPermissions ?? [])].sort())
        !== canonicalJson(metadataReader.permissions)) {
    throw new Error('Staging identity reader custom role is not metadata-only.');
  }
  const requiredRuntimePermissions = {
    'roles/datastore.user': [
      'datastore.entities.get',
      'datastore.entities.list',
      'datastore.entities.create',
      'datastore.entities.update',
      'datastore.entities.delete',
    ],
    'roles/logging.logWriter': ['logging.logEntries.create'],
  };
  for (const [role, permissions] of Object.entries(requiredRuntimePermissions)) {
    if (permissions.some((permission) => !permissionsByRole.get(role)?.has(permission))) {
      throw new Error('Benchmark runtime role definition is incomplete.');
    }
  }
  if (!Array.isArray(stagingStorageResources) || !stagingStorageResources.length) {
    throw new Error('Staging Storage resource inventory is incomplete.');
  }
  const stagingStorageBuckets = stagingStorageResources.map((resource) => {
    const name = String(resource?.metadata?.name ?? '');
    if (!name || resource?.metadata?.uniform_bucket_level_access !== true) {
      throw new Error('Staging Storage resource inventory is incomplete.');
    }
    assertExactBindings(
      resource.policy,
      reviewedStorageBindings(expected.projectId, true),
      'Staging Storage bucket',
    );
    return name;
  }).sort();
  if (new Set(stagingStorageBuckets).size !== stagingStorageBuckets.length
      || canonicalJson(stagingStorageBuckets)
        !== canonicalJson([...expected.stagingStorageBuckets].sort())) {
    throw new Error('Staging Storage resource inventory is incomplete.');
  }
  const effectiveInvokers = new Set([EXPECTED_INVOKER]);
  for (const binding of projectBindings) {
    if (!permissionsByRole.get(binding.role).has(RUN_INVOKE_PERMISSION)) continue;
    if (binding.condition) {
      throw new Error('Effective candidate invoker binding contains a condition.');
    }
    for (const member of binding.members) effectiveInvokers.add(member);
  }
  // A project-level token minter can impersonate the directly bound benchmark caller.
  for (const binding of projectBindings) {
    if (!permissionsByRole.get(binding.role).has('iam.serviceAccounts.getAccessToken')) continue;
    if (binding.condition) {
      throw new Error('Effective candidate impersonation binding contains a condition.');
    }
    for (const member of binding.members) effectiveInvokers.add(member);
  }
  const reviewedInvokers = reviewedEffectiveInvokers(expected);
  if (canonicalJson([...effectiveInvokers].sort()) !== canonicalJson(reviewedInvokers)) {
    throw new Error('Effective candidate invokers do not match the reviewed allowlist.');
  }
  const projectIamContractSha256 = sha256(reviewedProjectBindings);
  const storageIamContractSha256 = sha256({
    buckets: stagingStorageBuckets,
    bindings: reviewedStorageBindings(expected.projectId, true),
  });
  const contract = {
    project_id: expected.projectId,
    project_number: expected.projectNumber,
    runtime_service_account: expected.runtimeServiceAccount,
    caller_service_account: callerMember.slice('serviceAccount:'.length),
    deployer_service_account: expected.deployerServiceAccount,
    reviewed_effective_invokers: reviewedInvokers,
    staging_storage_buckets: stagingStorageBuckets,
    workload_identity_provider: workloadIdentity.provider_name,
    workload_identity_pool: workloadIdentityPoolName,
    workload_identity_subject: workloadIdentity.subject,
    github_repository: GITHUB_REPOSITORY,
    github_ref: GITHUB_REF,
    github_environment: GITHUB_ENVIRONMENT,
    github_ref_protected_required: true,
    staging_project_iam_contract_sha256: projectIamContractSha256,
    staging_storage_iam_contract_sha256: storageIamContractSha256,
    staging_metadata_reader_contract_sha256: metadataReader.contract_sha256,
    privileged_service_accounts: privilegedServiceAccounts.map((item) => item.email),
    provider_managed_invoker_service_agents:
      reviewedProviderManagedInvokerServiceAgents(expected),
  };
  const proof = {
    status: 'passed_reviewed_staging_identity_contract',
    scanner_version: 'staging-identity-and-effective-invokers-v2',
    verified_at: expected.verifiedAt,
    ...contract,
    identity_contract_sha256: sha256(contract),
    project_resource_sha256: sha256(projectResource),
    project_iam_policy_sha256: sha256(projectIamPolicy),
    direct_run_policy_sha256: sha256(directRunPolicy),
    secret_policy_sha256: sha256(secretPolicy),
    privileged_service_account_inventory_sha256: sha256(privilegedServiceAccounts),
    privileged_service_account_inventory: privilegedServiceAccounts,
    workload_identity_provider_sha256: sha256(workloadIdentityProvider),
    workload_identity_provider_inventory_sha256: sha256(workloadIdentityProviders),
    workload_identity_pool_sha256: sha256(workloadIdentityPool),
    workload_identity_pool_policy_sha256: sha256(workloadIdentityPoolPolicy),
    role_definitions_sha256: sha256(roleDefinitions),
    staging_metadata_reader_role_definition_sha256: sha256(metadataReaderDefinition),
    staging_storage_resources_sha256: sha256(stagingStorageResources),
  };
  return { ...proof, proof_sha256: sha256(proof) };
}

export function assertStagingIdentityProof(proof, expected) {
  const body = proof && Object.fromEntries(
    Object.entries(proof).filter(([key]) => key !== 'proof_sha256'),
  );
  const workloadIdentity = reviewedWorkloadIdentity(expected);
  const metadataReader = reviewedStagingMetadataReader(expected);
  const privilegedEmails = [
    ...reviewedUserManagedStagingServiceAccountPolicies(expected).keys(),
  ].sort();
  const storageBuckets = [...expected.stagingStorageBuckets].sort();
  const contract = {
    project_id: expected.projectId,
    project_number: expected.projectNumber,
    runtime_service_account: expected.runtimeServiceAccount,
    caller_service_account: EXPECTED_INVOKER.slice('serviceAccount:'.length),
    deployer_service_account: expected.deployerServiceAccount,
    reviewed_effective_invokers: reviewedEffectiveInvokers(expected),
    staging_storage_buckets: storageBuckets,
    workload_identity_provider: workloadIdentity.provider_name,
    workload_identity_pool: (
      `projects/${expected.projectNumber}/locations/global/workloadIdentityPools/${WIF_POOL}`
    ),
    workload_identity_subject: workloadIdentity.subject,
    github_repository: GITHUB_REPOSITORY,
    github_ref: GITHUB_REF,
    github_environment: GITHUB_ENVIRONMENT,
    github_ref_protected_required: true,
    staging_project_iam_contract_sha256: sha256(reviewedStagingProjectBindings(expected)),
    staging_storage_iam_contract_sha256: sha256({
      buckets: storageBuckets,
      bindings: reviewedStorageBindings(expected.projectId, true),
    }),
    staging_metadata_reader_contract_sha256: metadataReader.contract_sha256,
    privileged_service_accounts: privilegedEmails,
    provider_managed_invoker_service_agents:
      reviewedProviderManagedInvokerServiceAgents(expected),
  };
  const privilegedInventory = proof?.privileged_service_account_inventory;
  if (!proof || proof.status !== 'passed_reviewed_staging_identity_contract'
      || proof.scanner_version !== 'staging-identity-and-effective-invokers-v2'
      || expected.workloadIdentityProvider !== EXPECTED_WIF_PROVIDER
      || workloadIdentity.provider_name !== EXPECTED_WIF_PROVIDER
      || proof.identity_contract_sha256 !== sha256(contract)
      || canonicalJson(proof.reviewed_effective_invokers)
        !== canonicalJson(contract.reviewed_effective_invokers)
      || !Array.isArray(privilegedInventory)
      || canonicalJson(privilegedInventory.map((item) => item?.email))
        !== canonicalJson(privilegedEmails)
      || privilegedInventory.some((item) => (
        !/^[a-f0-9]{64}$/.test(String(item?.policy_sha256 ?? ''))
        || !/^[a-f0-9]{64}$/.test(String(item?.key_inventory_sha256 ?? ''))
        || !Number.isInteger(item?.system_managed_key_count)
        || item.system_managed_key_count < 0
      ))
      || proof.privileged_service_account_inventory_sha256
        !== sha256(privilegedInventory)
      || !['project_resource_sha256', 'project_iam_policy_sha256', 'direct_run_policy_sha256',
        'secret_policy_sha256', 'privileged_service_account_inventory_sha256',
        'workload_identity_provider_sha256',
        'workload_identity_provider_inventory_sha256', 'workload_identity_pool_sha256',
        'workload_identity_pool_policy_sha256', 'role_definitions_sha256',
        'staging_metadata_reader_role_definition_sha256',
        'staging_storage_resources_sha256']
        .every((field) => /^[a-f0-9]{64}$/.test(String(proof[field] ?? '')))
      || proof.proof_sha256 !== sha256(body)) {
    throw new Error('Candidate staging identity proof is invalid.');
  }
  return true;
}

function probe(id, principal, permission, fullResourceName, resourceName, service, type, state) {
  return {
    id,
    principal,
    permission,
    full_resource_name: fullResourceName,
    expected_overall_access_state: state,
    ...(resourceName ? {
      resource_name: resourceName,
      resource_service: service,
      resource_type: type,
    } : {}),
  };
}

export function buildProductionFirestoreInventory(
  databaseResources,
  backupResources,
  scheduleResources,
  expected,
) {
  if (![databaseResources, backupResources, scheduleResources].every(Array.isArray)) {
    throw new Error('Production Firestore inventory is incomplete.');
  }
  const databasePrefix = `projects/${expected.productionProjectId}/databases/`;
  const databases = databaseResources.map((item) => {
    const name = String(item?.name ?? '');
    const locationId = String(item?.locationId ?? item?.location_id ?? '');
    const databaseId = name.startsWith(databasePrefix) ? name.slice(databasePrefix.length) : '';
    if (!databaseId || databaseId.includes('/') || !/^[a-z0-9-]+$/.test(locationId)) {
      throw new Error('Production Firestore database inventory is invalid.');
    }
    return { name, database_id: databaseId, location_id: locationId };
  }).sort((left, right) => left.name.localeCompare(right.name));
  if (!databases.length || new Set(databases.map((item) => item.name)).size !== databases.length) {
    throw new Error('Production Firestore database inventory is invalid.');
  }
  const databaseNames = new Set(databases.map((item) => item.name));
  const backups = backupResources.map((item) => {
    const name = String(item?.name ?? '');
    const database = String(item?.database ?? '');
    const prefix = `projects/${expected.productionProjectId}/locations/`;
    if (!name.startsWith(prefix) || !/^projects\/[^/]+\/locations\/[^/]+\/backups\/[^/]+$/.test(name)
        || !databaseNames.has(database)) {
      throw new Error('Production Firestore backup inventory is invalid.');
    }
    return { name, database };
  }).sort((left, right) => left.name.localeCompare(right.name));
  const backupSchedules = scheduleResources.map((item) => {
    const name = String(item?.name ?? '');
    const database = name.split('/backupSchedules/')[0];
    if (!databaseNames.has(database) || !/^projects\/[^/]+\/databases\/[^/]+\/backupSchedules\/[^/]+$/.test(name)) {
      throw new Error('Production Firestore backup-schedule inventory is invalid.');
    }
    return { name, database };
  }).sort((left, right) => left.name.localeCompare(right.name));
  for (const resources of [backups, backupSchedules]) {
    if (new Set(resources.map((item) => item.name)).size !== resources.length) {
      throw new Error('Production Firestore inventory contains duplicate resources.');
    }
  }
  return { databases, backups, backup_schedules: backupSchedules };
}

export function buildIsolationProbePlan(expected) {
  const principal = expected.runtimeServiceAccount;
  const stagingDatabase = `projects/${expected.stagingProjectId}/databases/model-benchmarks`;
  const stagingDatabasePrefix = `projects/${expected.stagingProjectId}/databases/`;
  const stagingDatabases = expected.stagingFirestoreDatabases;
  const stagingBuckets = expected.stagingStorageBuckets;
  if (!Array.isArray(stagingDatabases) || !Array.isArray(stagingBuckets)
      || !stagingDatabases.includes(stagingDatabase)
      || stagingDatabases.some((name) => !String(name).startsWith(stagingDatabasePrefix))
      || stagingBuckets.some((name) => !/^[a-z0-9][a-z0-9._-]+$/.test(String(name)))
      || new Set(stagingDatabases).size !== stagingDatabases.length
      || new Set(stagingBuckets).size !== stagingBuckets.length) {
    throw new Error('Staging data-resource inventory is invalid.');
  }
  const inventory = buildProductionFirestoreInventory(
    expected.productionFirestoreInventory?.databases,
    expected.productionFirestoreInventory?.backups,
    expected.productionFirestoreInventory?.backup_schedules,
    expected,
  );
  const productionProject = `projects/${expected.productionProjectId}`;
  const bucket = `projects/_/buckets/${expected.productionStorageBucket}`;
  const object = `${bucket}/objects/__v9_isolation_probe__`;
  const folder = `${bucket}/folders/__v9_isolation_probe__`;
  const managedFolder = `${bucket}/managedFolders/__v9_isolation_probe__`;
  const cache = `${bucket}/anywhereCaches/__v9_isolation_probe__`;
  const feature = `${bucket}/featureConfigs/__v9_isolation_probe__`;
  const batchJob = `projects/${expected.productionProjectId}/locations/us-central1/jobs/__v9_isolation_probe__`;
  const intelligenceConfig = `projects/${expected.productionProjectId}/locations/global/intelligenceConfig`;
  const datasetConfig = `projects/${expected.productionProjectId}/locations/us-central1/datasetConfigs/__v9_isolation_probe__`;
  const reportConfig = `projects/${expected.productionProjectId}/locations/us-central1/reportConfigs/__v9_isolation_probe__`;
  const probes = [probe(
    'staging-firestore-read-control',
    principal,
    STAGING_CONTROL_PERMISSION,
    `//firestore.googleapis.com/${stagingDatabase}`,
    stagingDatabase,
    'firestore.googleapis.com',
    'firestore.googleapis.com/Database',
    'CAN_ACCESS',
  )];
  const add = (prefix, permissions, fullResourceName, resourceName, service, type) => {
    for (const permission of permissions) {
      probes.push(probe(
        `${prefix}-${permission.replaceAll('.', '-')}`,
        principal,
        permission,
        fullResourceName,
        resourceName,
        service,
        type,
        'CANNOT_ACCESS',
      ));
    }
  };
  const deniedStagingDatabases = new Set([
    ...stagingDatabases.filter((name) => name !== stagingDatabase),
    `projects/${expected.stagingProjectId}/databases/(default)`,
  ]);
  for (const database of [...deniedStagingDatabases].sort()) {
    add(
      `staging-firestore-denied-${sha256(database).slice(0, 12)}`,
      [...FIRESTORE_DATABASE_MUTATION_PERMISSIONS, ...FIRESTORE_DATA_READ_PERMISSIONS],
      `//firestore.googleapis.com/${database}`,
      database,
      'firestore.googleapis.com',
      'firestore.googleapis.com/Database',
    );
  }
  for (const bucketName of [...stagingBuckets].sort()) {
    const stagingBucket = `projects/_/buckets/${bucketName}`;
    add(
      `staging-storage-bucket-denied-${sha256(bucketName).slice(0, 12)}`,
      [...STORAGE_BUCKET_MUTATION_PERMISSIONS, ...STORAGE_BUCKET_READ_PERMISSIONS],
      `//storage.googleapis.com/${stagingBucket}`,
      stagingBucket,
      'storage.googleapis.com',
      'storage.googleapis.com/Bucket',
    );
    const stagingObject = `${stagingBucket}/objects/__v9_isolation_probe__`;
    add(
      `staging-storage-object-denied-${sha256(bucketName).slice(0, 12)}`,
      [...STORAGE_OBJECT_MUTATION_PERMISSIONS, ...STORAGE_OBJECT_READ_PERMISSIONS],
      `//storage.googleapis.com/${stagingObject}`,
      stagingObject,
      'storage.googleapis.com',
      'storage.googleapis.com/Object',
    );
  }
  for (const database of inventory.databases) {
    const suffix = sha256(database.name).slice(0, 12);
    add(
      `production-firestore-database-${suffix}`,
      [...FIRESTORE_DATABASE_MUTATION_PERMISSIONS, ...FIRESTORE_DATA_READ_PERMISSIONS],
      `//firestore.googleapis.com/${database.name}`,
      database.name,
      'firestore.googleapis.com',
      'firestore.googleapis.com/Database',
    );
    add(
      `production-firestore-backup-schedule-${suffix}`,
      FIRESTORE_BACKUP_SCHEDULE_MUTATION_PERMISSIONS,
      `//firestore.googleapis.com/${database.name}/backupSchedules/__v9_isolation_probe__`,
    );
    add(
      `production-firestore-backup-${suffix}`,
      FIRESTORE_BACKUP_MUTATION_PERMISSIONS,
      `//firestore.googleapis.com/projects/${expected.productionProjectId}/locations/${database.location_id}/backups/__v9_isolation_probe__`,
    );
    add(
      `production-firestore-operation-${suffix}`,
      FIRESTORE_OPERATION_MUTATION_PERMISSIONS,
      `//firestore.googleapis.com/${database.name}/operations/__v9_isolation_probe__`,
    );
    add(
      `production-firestore-user-credential-${suffix}`,
      FIRESTORE_USER_CREDENTIAL_MUTATION_PERMISSIONS,
      `//firestore.googleapis.com/${database.name}/userCreds/__v9_isolation_probe__`,
    );
  }
  for (const schedule of inventory.backup_schedules) {
    add(
      `production-firestore-existing-backup-schedule-${sha256(schedule.name).slice(0, 12)}`,
      FIRESTORE_BACKUP_SCHEDULE_MUTATION_PERMISSIONS,
      `//firestore.googleapis.com/${schedule.name}`,
    );
  }
  for (const backupResource of inventory.backups) {
    add(
      `production-firestore-existing-backup-${sha256(backupResource.name).slice(0, 12)}`,
      FIRESTORE_BACKUP_MUTATION_PERMISSIONS,
      `//firestore.googleapis.com/${backupResource.name}`,
    );
  }
  add(
    'production-firestore-project',
    ['datastore.databases.create', 'datastore.databases.list'],
    `//cloudresourcemanager.googleapis.com/${productionProject}`,
    `projects/${expected.productionProjectId}/databases/__v9_isolation_probe__`,
    'firestore.googleapis.com',
    'firestore.googleapis.com/Database',
  );
  add(
    'production-storage-bucket',
    [...STORAGE_BUCKET_MUTATION_PERMISSIONS, ...STORAGE_BUCKET_READ_PERMISSIONS],
    `//storage.googleapis.com/${bucket}`,
    bucket,
    'storage.googleapis.com',
    'storage.googleapis.com/Bucket',
  );
  add(
    'production-storage-object',
    [...STORAGE_OBJECT_MUTATION_PERMISSIONS, ...STORAGE_OBJECT_READ_PERMISSIONS],
    `//storage.googleapis.com/${object}`,
    object,
    'storage.googleapis.com',
    'storage.googleapis.com/Object',
  );
  add(
    'production-storage-managed-folder',
    STORAGE_MANAGED_FOLDER_MUTATION_PERMISSIONS,
    `//storage.googleapis.com/${managedFolder}`,
    managedFolder,
    'storage.googleapis.com',
    'storage.googleapis.com/ManagedFolder',
  );
  add(
    'production-storage-folder',
    STORAGE_FOLDER_MUTATION_PERMISSIONS,
    `//storage.googleapis.com/${folder}`,
  );
  add(
    'production-storage-cache',
    STORAGE_CACHE_MUTATION_PERMISSIONS,
    `//storage.googleapis.com/${cache}`,
  );
  add(
    'production-storage-feature',
    STORAGE_FEATURE_MUTATION_PERMISSIONS,
    `//storage.googleapis.com/${feature}`,
  );
  add(
    'production-storage-batch',
    STORAGE_BATCH_MUTATION_PERMISSIONS,
    `//storagebatchoperations.googleapis.com/${batchJob}`,
  );
  add(
    'production-storage-hmac',
    STORAGE_HMAC_MUTATION_PERMISSIONS,
    `//cloudresourcemanager.googleapis.com/${productionProject}`,
    productionProject,
    'storage.googleapis.com',
    'cloudresourcemanager.googleapis.com/Project',
  );
  add(
    'production-storage-intelligence',
    ['storage.intelligenceConfigs.update'],
    `//storage.googleapis.com/${intelligenceConfig}`,
  );
  add(
    'production-storage-insights-dataset',
    STORAGE_INSIGHTS_MUTATION_PERMISSIONS.filter((permission) => (
      permission.startsWith('storageinsights.datasetConfigs.')
    )),
    `//storageinsights.googleapis.com/${datasetConfig}`,
  );
  add(
    'production-storage-insights-report',
    STORAGE_INSIGHTS_MUTATION_PERMISSIONS.filter((permission) => (
      permission.startsWith('storageinsights.reportConfigs.')
    )),
    `//storageinsights.googleapis.com/${reportConfig}`,
  );
  add(
    'production-storage-project',
    ['storage.buckets.create'],
    `//cloudresourcemanager.googleapis.com/${productionProject}`,
    `projects/_/buckets/${expected.productionStorageBucket}-v9-isolation-probe`,
    'storage.googleapis.com',
    'storage.googleapis.com/Bucket',
  );
  return probes;
}

function buildProductionServiceAccountInventory(resources, expected) {
  if (!Array.isArray(resources) || !resources.length) {
    throw new Error('Production service-account inventory is incomplete.');
  }
  const prefix = `projects/${expected.productionProjectId}/serviceAccounts/`;
  const stagingSuffix = '@lemon-screenplay-staging.iam.gserviceaccount.com';
  const auditor = reviewedProductionAuditor(expected);
  const inventory = resources.map((entry) => {
    const account = entry?.service_account;
    const policy = entry?.policy;
    const email = String(account?.email ?? '');
    if (account?.projectId !== expected.productionProjectId
        || account?.name !== `${prefix}${email}`
        || !email.includes('@')
        || !/^[1-9][0-9]*$/.test(String(account?.uniqueId ?? ''))
        || typeof account?.disabled !== 'boolean') {
      throw new Error('Production service-account inventory is invalid.');
    }
    const bindings = normalizedOptionalBindings(
      policy,
      'Production service account',
    );
    if (email === auditor.service_account) {
      assertExactBindings(policy, [{
        role: 'roles/iam.workloadIdentityUser',
        members: [auditor.workload_identity_principal],
      }], 'Production auditor service account');
    } else {
      assertExactBindings({ bindings }, [], 'Production service account');
    }
    for (const binding of bindings) {
      if (typeof binding.role !== 'string' || !binding.members.length) {
        throw new Error('Production service-account IAM policy is incomplete.');
      }
      for (const member of binding.members) {
        if (email === auditor.service_account
            && member === auditor.workload_identity_principal) continue;
        if (member.endsWith(stagingSuffix)) {
          throw new Error('Production service account grants a staging identity access.');
        }
        if (!member.startsWith('user:') && !member.startsWith('serviceAccount:')) {
          throw new Error(
            'Production service-account IAM policy contains an indirect or public principal.',
          );
        }
      }
    }
    return {
      email,
      disabled: account.disabled,
      unique_id: String(account.uniqueId),
      resource_sha256: sha256(account),
      policy_sha256: sha256(policy),
      binding_count: bindings.length,
    };
  }).sort((left, right) => left.email.localeCompare(right.email));
  if (new Set(inventory.map((item) => item.email)).size !== inventory.length) {
    throw new Error('Production service-account inventory is invalid.');
  }
  if (!inventory.some((item) => item.email === auditor.service_account)) {
    throw new Error('Production service-account inventory omitted the auditor.');
  }
  return inventory;
}

export function buildProductionIsolationProof(projectResource, projectIamPolicy, expected) {
  const inventory = buildProductionFirestoreInventory(
    expected.productionFirestoreInventory?.databases,
    expected.productionFirestoreInventory?.backups,
    expected.productionFirestoreInventory?.backup_schedules,
    expected,
  );
  const plan = buildIsolationProbePlan(expected);
  if (projectResource?.projectId !== expected.productionProjectId
      || String(projectResource?.projectNumber) !== expected.productionProjectNumber
      || projectResource?.lifecycleState !== 'ACTIVE'
      || projectResource?.parent !== undefined) {
    throw new Error('Production project hierarchy is not the reviewed standalone project.');
  }
  const reviewedProjectBindings = reviewedProductionProjectBindings(expected);
  assertExactBindings(projectIamPolicy, reviewedProjectBindings, 'Production project');
  const auditor = reviewedProductionAuditor(expected);
  const auditorMember = `serviceAccount:${auditor.service_account}`;
  assertExactBindings({
    bindings: normalizedBindings(projectIamPolicy).filter(
      (binding) => binding.members.includes(auditorMember),
    ),
  }, [{
    role: auditor.role,
    members: [auditorMember],
  }], 'Production auditor project access');
  const roleDefinition = expected.productionAuditorRoleDefinition;
  if (roleDefinition?.name !== auditor.role
      || roleDefinition?.title !== 'V9 Production Metadata Auditor'
      || roleDefinition?.description
        !== 'Read-only V9 staging isolation metadata; no screenplay bytes or Firestore documents.'
      || roleDefinition?.stage !== 'GA'
      || roleDefinition?.deleted === true
      || canonicalJson([...(roleDefinition?.includedPermissions ?? [])].sort())
        !== canonicalJson(auditor.permissions)) {
    throw new Error('Production auditor custom role is not metadata-only.');
  }
  const serviceAccounts = buildProductionServiceAccountInventory(
    expected.productionServiceAccountResources,
    expected,
  );
  const proof = {
    status: 'passed_complete_static_iam_inventory',
    scanner_version: 'standalone-project-iam-and-resource-inventory-v2',
    runtime_service_account: expected.runtimeServiceAccount,
    staging_project_id: expected.stagingProjectId,
    staging_project_number: String(expected.stagingProjectNumber),
    production_project_id: expected.productionProjectId,
    production_storage_bucket: expected.productionStorageBucket,
    staging_firestore_databases: [...expected.stagingFirestoreDatabases],
    staging_storage_buckets: [...expected.stagingStorageBuckets],
    staging_data_resource_inventory_sha256: sha256({
      databases: expected.stagingFirestoreDatabases,
      buckets: expected.stagingStorageBuckets,
    }),
    production_firestore_inventory: inventory,
    production_firestore_inventory_sha256: sha256(inventory),
    production_firestore_database_count: inventory.databases.length,
    production_firestore_backup_count: inventory.backups.length,
    production_firestore_backup_schedule_count: inventory.backup_schedules.length,
    verified_at: expected.verifiedAt,
    production_project_number: expected.productionProjectNumber,
    production_project_resource_sha256: sha256(projectResource),
    production_project_iam_policy_sha256: sha256(projectIamPolicy),
    production_project_iam_contract_sha256: sha256(reviewedProjectBindings),
    production_project_binding_count: normalizedBindings(projectIamPolicy).length,
    production_service_accounts: serviceAccounts,
    production_service_account_count: serviceAccounts.length,
    production_service_account_inventory_sha256: sha256(serviceAccounts),
    production_auditor_service_account: auditor.service_account,
    production_auditor_role: auditor.role,
    production_auditor_wif_principal: auditor.workload_identity_principal,
    production_auditor_permissions: auditor.permissions,
    production_auditor_contract_sha256: auditor.contract_sha256,
    production_auditor_role_definition_sha256: sha256(roleDefinition),
    permission_contract_sha256: sha256(plan),
    production_project_scope_state: 'STANDALONE_NO_PARENT',
    production_access_state: 'NO_STAGING_IDENTITY_ALLOW_BINDING',
  };
  return { ...proof, proof_sha256: sha256(proof) };
}

function gcloudStorageJson(arguments_, description, allowNoObjects = false) {
  try {
    return JSON.parse(execFileSync('gcloud', arguments_, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }));
  } catch (error) {
    if (allowNoObjects && String(error?.stderr ?? '').includes('matched no objects')) return [];
    throw new Error(`Could not read ${description}.`);
  }
}

function runStagingIdentityAudit(expected) {
  const projectResource = gcloudStorageJson(
    ['projects', 'describe', expected.projectId, '--format=json'],
    'staging project resource',
  );
  const projectIamPolicy = gcloudStorageJson(
    ['projects', 'get-iam-policy', expected.projectId, '--format=json'],
    'staging project IAM policy',
  );
  const directRunPolicy = gcloudStorageJson(
    [
      'run', 'services', 'get-iam-policy', 'llmproxycandidate',
      `--project=${expected.projectId}`, '--region=us-central1', '--format=json',
    ],
    'candidate direct Cloud Run IAM policy',
  );
  const secretPolicy = gcloudStorageJson(
    [
      'secrets', 'get-iam-policy', 'BENCHMARK_ANTHROPIC_API_KEY',
      `--project=${expected.projectId}`, '--format=json',
    ],
    'benchmark secret IAM policy',
  );
  const serviceAccountPolicy = (email, description) => gcloudStorageJson(
    [
      'iam', 'service-accounts', 'get-iam-policy', email,
      `--project=${expected.projectId}`, '--format=json',
    ],
    description,
  );
  const privilegedServiceAccount = (email) => ({
    email,
    policy: serviceAccountPolicy(email, `staging service-account IAM policy for ${email}`),
    keys: gcloudStorageJson(
      [
        'iam', 'service-accounts', 'keys', 'list',
        `--iam-account=${email}`,
        `--project=${expected.projectId}`,
        '--format=json',
      ],
      `staging service-account key inventory for ${email}`,
    ),
  });
  const roles = [...new Set(normalizedBindings(projectIamPolicy).map((binding) => binding.role))];
  const roleDefinitions = roles.map((role) => gcloudStorageJson(
    ['iam', 'roles', 'describe', role, '--format=json'],
    'staging role definition',
  ));
  const stagingStorageResources = gcloudStorageJson(
    ['storage', 'buckets', 'list', `--project=${expected.projectId}`, '--format=json'],
    'staging Storage bucket inventory',
  ).map((metadata) => ({
    metadata,
    policy: gcloudStorageJson(
      ['storage', 'buckets', 'get-iam-policy', `gs://${metadata.name}`, '--format=json'],
      'staging Storage bucket IAM policy',
    ),
  }));
  return buildStagingIdentityProof({
    projectResource,
    projectIamPolicy,
    directRunPolicy,
    secretPolicy,
    privilegedServiceAccountResources: [
      'benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com',
      expected.runtimeServiceAccount,
      expected.deployerServiceAccount,
      `${expected.projectNumber}-compute@developer.gserviceaccount.com`,
      `${expected.projectId}@appspot.gserviceaccount.com`,
      `firebase-adminsdk-fbsvc@${expected.projectId}.iam.gserviceaccount.com`,
    ].map(privilegedServiceAccount),
    workloadIdentityProvider: gcloudStorageJson(
      [
        'iam', 'workload-identity-pools', 'providers', 'describe', WIF_PROVIDER,
        `--project=${expected.projectId}`,
        '--location=global',
        `--workload-identity-pool=${WIF_POOL}`,
        '--format=json',
      ],
      'staging Workload Identity provider',
    ),
    workloadIdentityProviders: gcloudStorageJson(
      [
        'iam', 'workload-identity-pools', 'providers', 'list',
        `--project=${expected.projectId}`,
        '--location=global',
        `--workload-identity-pool=${WIF_POOL}`,
        '--format=json',
      ],
      'staging Workload Identity provider inventory',
    ),
    workloadIdentityPool: gcloudStorageJson(
      [
        'iam', 'workload-identity-pools', 'describe', WIF_POOL,
        `--project=${expected.projectId}`,
        '--location=global',
        '--format=json',
      ],
      'staging Workload Identity pool',
    ),
    workloadIdentityPoolPolicy: gcloudStorageJson(
      [
        'iam', 'workload-identity-pools', 'get-iam-policy', WIF_POOL,
        `--project=${expected.projectId}`,
        '--location=global',
        '--format=json',
      ],
      'staging Workload Identity pool IAM policy',
    ),
    roleDefinitions,
    stagingStorageResources,
  }, expected);
}

export function stagingIdentityAuditExpected(environment = process.env) {
  return {
    projectId: environment.STAGING_PROJECT_ID,
    projectNumber: environment.STAGING_PROJECT_NUMBER,
    runtimeServiceAccount: environment.RUNTIME_SERVICE_ACCOUNT,
    deployerServiceAccount: environment.DEPLOYER_SERVICE_ACCOUNT,
    workloadIdentityProvider: environment.WORKLOAD_IDENTITY_PROVIDER,
    stagingStorageBuckets: [...REVIEWED_STAGING_STORAGE_BUCKETS],
    verifiedAt: environment.STAGING_IDENTITY_VERIFIED_AT,
  };
}

function runProductionFirestoreInventory(expected) {
  const databases = gcloudStorageJson(
    ['firestore', 'databases', 'list', `--project=${expected.productionProjectId}`, '--format=json'],
    'production Firestore database inventory',
  );
  const schedules = databases.flatMap((database) => {
    const prefix = `projects/${expected.productionProjectId}/databases/`;
    const databaseId = String(database?.name ?? '').startsWith(prefix)
      ? String(database.name).slice(prefix.length)
      : '';
    if (!databaseId || databaseId.includes('/')) {
      throw new Error('Production Firestore database inventory is invalid.');
    }
    return gcloudStorageJson(
      [
        'firestore', 'backups', 'schedules', 'list',
        `--database=${databaseId}`,
        `--project=${expected.productionProjectId}`,
        '--format=json',
      ],
      'production Firestore backup-schedule inventory',
    );
  });
  const backups = gcloudStorageJson(
    ['firestore', 'backups', 'list', `--project=${expected.productionProjectId}`, '--format=json'],
    'production Firestore backup inventory',
  );
  return buildProductionFirestoreInventory(databases, backups, schedules, expected);
}

function reviewedProductionAclContract(projectNumber) {
  return [
    `project-owners-${projectNumber}:OWNER`,
    `project-editors-${projectNumber}:OWNER`,
    `project-viewers-${projectNumber}:READER`,
    `user-${projectNumber}-compute@developer.gserviceaccount.com:OWNER`,
    'user-billyrovzar@gmail.com:OWNER',
    `user-firebase-adminsdk-fbsvc@${PRODUCTION_PROJECT_ID}.iam.gserviceaccount.com:OWNER`,
    `user-service-${projectNumber}@gcp-sa-firebasestorage.iam.gserviceaccount.com:OWNER`,
  ].sort();
}

function assertNoRuntimeAcl(entries, expected) {
  if (!Array.isArray(entries)) throw new Error('Production Storage ACL inventory is incomplete.');
  const runtimeEntity = `user-${expected.runtimeServiceAccount}`;
  const allowed = new Set(reviewedProductionAclContract(expected.productionProjectNumber));
  for (const entry of entries) {
    if (!entry || !['OWNER', 'WRITER', 'READER'].includes(entry.role)) {
      throw new Error('Production Storage ACL inventory is incomplete.');
    }
    const entity = String(entry.entity ?? '');
    if (entity === runtimeEntity
        || entity.endsWith('@lemon-screenplay-staging.iam.gserviceaccount.com')) {
      throw new Error('Production Storage ACL grants a staging identity access.');
    }
    if (allowed.has(`${entity}:${entry.role}`)) continue;
    throw new Error('Production Storage ACL contains an unprovable principal.');
  }
}

function storageObjectRecords(listing, expected, softDeleted) {
  if (!Array.isArray(listing) || listing.some((item) => item?.type !== 'cloud_object')) {
    throw new Error('Production Storage object inventory is incomplete.');
  }
  return listing.map((item) => {
    const metadata = item.metadata;
    if (!metadata || metadata.bucket !== expected.productionStorageBucket
        || typeof metadata.name !== 'string' || !metadata.name
        || !/^[1-9][0-9]*$/.test(String(metadata.generation ?? ''))) {
      throw new Error('Production Storage object metadata is incomplete.');
    }
    assertNoRuntimeAcl(metadata.acl, expected);
    return {
      object_name_sha256: sha256(metadata.name),
      generation: String(metadata.generation),
      acl_sha256: sha256(metadata.acl),
      soft_deleted: softDeleted,
    };
  });
}

export function buildProductionStorageAclProof(
  bucketMetadata,
  bucketIamPolicy,
  liveListing,
  softDeletedListing,
  expected,
) {
  if (bucketMetadata?.name !== expected.productionStorageBucket
      || bucketMetadata.uniform_bucket_level_access !== false
      || bucketMetadata.hierarchical_namespace?.enabled === true) {
    throw new Error('Production Storage access mode is not the reviewed ACL-audit contract.');
  }
  assertNoRuntimeAcl(bucketMetadata.acl, expected);
  assertNoRuntimeAcl(bucketMetadata.default_acl, expected);
  if (!bucketIamPolicy || typeof bucketIamPolicy !== 'object' || Array.isArray(bucketIamPolicy)) {
    throw new Error('Production Storage bucket IAM policy is incomplete.');
  }
  const bucketIamContract = reviewedStorageBindings(PRODUCTION_PROJECT_ID);
  assertExactBindings(
    bucketIamPolicy,
    bucketIamContract,
    'Production Storage bucket',
  );
  const aclContract = reviewedProductionAclContract(expected.productionProjectNumber);
  const records = [
    ...storageObjectRecords(liveListing, expected, false),
    ...storageObjectRecords(softDeletedListing, expected, true),
  ].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const unique = new Set(records.map((record) => (
    `${record.object_name_sha256}:${record.generation}:${record.soft_deleted}`
  )));
  if (unique.size !== records.length) {
    throw new Error('Production Storage object inventory contains duplicate versions.');
  }
  const proof = {
    status: 'passed_no_runtime_access_acl',
    scanner_version: 'legacy-acl-full-object-version-inventory-v2',
    runtime_service_account: expected.runtimeServiceAccount,
    production_storage_bucket: expected.productionStorageBucket,
    production_project_number: expected.productionProjectNumber,
    verified_at: expected.verifiedAt,
    bucket_access_mode: 'legacy_acl_full_inventory',
    bucket_metadata_sha256: sha256(bucketMetadata),
    bucket_iam_policy_sha256: sha256(bucketIamPolicy),
    bucket_iam_contract_sha256: sha256(bucketIamContract),
    acl_principal_contract_sha256: sha256(aclContract),
    object_version_count: records.filter((item) => !item.soft_deleted).length,
    soft_deleted_object_count: records.filter((item) => item.soft_deleted).length,
    object_acl_inventory_sha256: sha256(records),
  };
  return { ...proof, proof_sha256: sha256(proof) };
}

export function assertProductionStorageAclProof(proof, expected) {
  const body = proof && Object.fromEntries(
    Object.entries(proof).filter(([key]) => key !== 'proof_sha256'),
  );
  if (!proof || proof.status !== 'passed_no_runtime_access_acl'
      || proof.scanner_version !== 'legacy-acl-full-object-version-inventory-v2'
      || proof.runtime_service_account !== expected.runtimeServiceAccount
      || proof.production_storage_bucket !== expected.productionStorageBucket
      || proof.production_project_number !== expected.productionProjectNumber
      || proof.bucket_access_mode !== 'legacy_acl_full_inventory'
      || !Number.isInteger(proof.object_version_count) || proof.object_version_count < 0
      || !Number.isInteger(proof.soft_deleted_object_count)
      || proof.soft_deleted_object_count < 0
      || !/^[a-f0-9]{64}$/.test(String(proof.bucket_metadata_sha256 ?? ''))
      || !/^[a-f0-9]{64}$/.test(String(proof.bucket_iam_policy_sha256 ?? ''))
      || proof.bucket_iam_contract_sha256
        !== sha256(reviewedStorageBindings(PRODUCTION_PROJECT_ID))
      || proof.acl_principal_contract_sha256
        !== sha256(reviewedProductionAclContract(expected.productionProjectNumber))
      || !/^[a-f0-9]{64}$/.test(String(proof.object_acl_inventory_sha256 ?? ''))
      || proof.proof_sha256 !== sha256(body)) {
    throw new Error('Candidate production Storage ACL proof is invalid.');
  }
  return true;
}

function runProductionStorageAclAudit(expected) {
  const bucketUrl = `gs://${expected.productionStorageBucket}`;
  const wildcard = `${bucketUrl}/**`;
  return buildProductionStorageAclProof(
    gcloudStorageJson(
      ['storage', 'buckets', 'describe', bucketUrl, '--format=json'],
      'production Storage bucket metadata',
    ),
    gcloudStorageJson(
      ['storage', 'buckets', 'get-iam-policy', bucketUrl, '--format=json'],
      'production Storage bucket IAM policy',
    ),
    gcloudStorageJson(
      ['storage', 'ls', '--json', '--all-versions', wildcard],
      'production Storage object ACL inventory',
    ),
    gcloudStorageJson(
      ['storage', 'ls', '--json', '--soft-deleted', '--exhaustive', wildcard],
      'production soft-deleted Storage object ACL inventory',
      true,
    ),
    expected,
  );
}

function normalizedUploadPath(value) {
  const path = value.trim().replace(/^\.\//, '').replace(/^functions\//, '');
  if (!path || path.startsWith('/') || path.includes('../')) {
    throw new Error('Candidate upload list contains an invalid path.');
  }
  return path;
}

function isReviewedDeployInput(path) {
  return path === 'package.json'
    || path === 'package-lock.json'
    || /^lib\/.+\.(?:js|json)$/.test(path);
}

export function assertCandidateUploadFiles(uploadText, trackedFiles) {
  const actual = new Set(uploadText.split(/\r?\n/).filter(Boolean).map(normalizedUploadPath));
  const expected = new Set(trackedFiles
    .map(normalizedUploadPath)
    .filter(isReviewedDeployInput));
  if ([...actual].some((path) => FORBIDDEN_SOURCE_FILE.test(path))) {
    throw new Error('Candidate upload contains a forbidden secret or temporary file.');
  }
  const unexpected = [...actual].filter((path) => !expected.has(path)).sort();
  const missing = [...expected].filter((path) => !actual.has(path)).sort();
  if (unexpected.length || missing.length) {
    throw new Error(
      `Candidate upload differs from reviewed deploy inputs: unexpected=${unexpected.join(',') || 'none'} missing=${missing.join(',') || 'none'}`,
    );
  }
  return true;
}

export function assertCandidateSourceTree(paths) {
  const forbidden = paths
    .map((path) => path.replace(/^\.\//, ''))
    .filter((path) => (
      path !== 'functions/.env.example'
      && !path.includes('/node_modules/')
      && FORBIDDEN_SOURCE_FILE.test(path)
    ));
  if (forbidden.length) {
    throw new Error('Candidate source tree contains a forbidden secret or temporary file.');
  }
  return true;
}

export function assertPredeployPlatformConfig(functionResource, expected) {
  const service = functionResource?.serviceConfig;
  const build = functionResource?.buildConfig;
  const expectedName = `projects/${expected.projectId}/locations/${expected.region}/functions/llmProxyCandidate`;
  const expectedBuildServiceAccount = (
    `projects/${expected.projectId}/serviceAccounts/`
    + `${expected.projectNumber}-compute@developer.gserviceaccount.com`
  );
  const expectedDockerRepository = (
    `projects/${expected.projectId}/locations/${expected.region}/repositories/gcf-artifacts`
  );
  if (functionResource?.name !== expectedName || functionResource?.state !== 'ACTIVE'
      || !service || !build) {
    throw new Error('Candidate function resource is not the exact active staging function.');
  }
  if (service.serviceAccountEmail !== expected.runtimeServiceAccount
      || !new Set(['512M', '512Mi', '512MiB']).has(service.availableMemory)
      || service.timeoutSeconds !== 3600
      || service.maxInstanceCount !== 5
      || ![undefined, 0].includes(service.minInstanceCount)
      || service.maxInstanceRequestConcurrency !== 1
      || service.allTrafficOnLatestRevision !== true
      || service.availableCpu !== '0.3333'
      || service.ingressSettings !== 'ALLOW_ALL'
      || service.vpcConnector
      || ![undefined, 'PRIVATE_RANGES_ONLY'].includes(service.vpcConnectorEgressSettings)
      || (Array.isArray(service.directVpcNetworkInterface)
        && service.directVpcNetworkInterface.length !== 0)
      || (!Array.isArray(service.directVpcNetworkInterface)
        && service.directVpcNetworkInterface !== undefined)
      || ![undefined, 'PRIVATE_RANGES_ONLY'].includes(service.directVpcEgress)
      || service.binaryAuthorizationPolicy
      || (Array.isArray(service.secretVolumes) && service.secretVolumes.length !== 0)
      || (!Array.isArray(service.secretVolumes) && service.secretVolumes !== undefined)
      || functionResource.kmsKeyName
      || build.runtime !== 'nodejs22'
      || build.entryPoint !== 'llmProxyCandidate'
      || (build.environmentVariables
        && Object.keys(build.environmentVariables).length !== 0)
      || build.workerPool
      || build.dockerRepository !== expectedDockerRepository
      || ![undefined, 'ARTIFACT_REGISTRY'].includes(build.dockerRegistry)
      || build.serviceAccount !== expectedBuildServiceAccount
      || !build.automaticUpdatePolicy
      || build.onDeployUpdatePolicy !== undefined) {
    throw new Error('Candidate platform runtime does not match the reviewed contract.');
  }
  return true;
}

export function buildDeploymentReceipt(functionResource, revisionResource, expected) {
  assertPredeployPlatformConfig(functionResource, expected);
  const service = functionResource.serviceConfig;
  const build = functionResource.buildConfig;
  if (service.uri !== expected.serviceUri) {
    throw new Error('Candidate platform runtime does not match the reviewed contract.');
  }
  const environment = service.environmentVariables ?? {};
  const expectedBenchmarkEnvironment = {
    BENCHMARK_RUN_ID: expected.runId,
    BENCHMARK_CAP_USD: expected.benchmarkCapUsd,
    BENCHMARK_PRIOR_AUDIT_SPEND_USD: expected.priorAuditSpendUsd,
    BENCHMARK_INFERENCE_GEO: expected.inferenceGeo,
    BENCHMARK_GIT_SHA: expected.gitSha,
    BENCHMARK_SOURCE_CLEAN: 'true',
    BENCHMARK_CATALOG_SHA256: expected.catalogSha256,
    BENCHMARK_BUILD_TIMESTAMP: expected.buildTimestamp,
    BENCHMARK_RUNTIME_SERVICE_ACCOUNT: expected.runtimeServiceAccount,
    BENCHMARK_STAGING_FIRESTORE_PROJECT_ID: expected.projectId,
    BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID: 'lemon-screenplay-dashboard',
    BENCHMARK_STORAGE_BUCKET: 'lemon-screenplay-dashboard.firebasestorage.app',
  };
  for (const [key, value] of Object.entries(expectedBenchmarkEnvironment)) {
    if (environment[key] !== value) {
      throw new Error('Candidate platform environment does not match the approved source.');
    }
  }
  const benchmarkKeys = Object.keys(environment).filter((key) => key.startsWith('BENCHMARK_'));
  if (canonicalJson(benchmarkKeys.sort())
      !== canonicalJson(Object.keys(expectedBenchmarkEnvironment).sort())) {
    throw new Error('Candidate platform has an unexpected benchmark environment variable.');
  }
  let firebaseConfig;
  try {
    firebaseConfig = JSON.parse(environment.FIREBASE_CONFIG);
  } catch {
    throw new Error('Candidate FIREBASE_CONFIG is invalid.');
  }
  if (canonicalJson(firebaseConfig) !== canonicalJson({ projectId: expected.projectId })) {
    throw new Error('Candidate FIREBASE_CONFIG targets the wrong project.');
  }
  const environmentWithoutPlatformLogging = { ...environment };
  if (environmentWithoutPlatformLogging.LOG_EXECUTION_ID !== undefined) {
    if (environmentWithoutPlatformLogging.LOG_EXECUTION_ID !== 'true') {
      throw new Error('Candidate platform logging environment is invalid.');
    }
    delete environmentWithoutPlatformLogging.LOG_EXECUTION_ID;
  }
  if (canonicalJson(environmentWithoutPlatformLogging) !== canonicalJson({
    ...expectedBenchmarkEnvironment,
    FIREBASE_CONFIG: JSON.stringify({ projectId: expected.projectId }),
  })) {
    throw new Error('Candidate platform has an unexpected runtime environment variable.');
  }
  const secretEnvironment = service.secretEnvironmentVariables;
  if (!Array.isArray(secretEnvironment) || secretEnvironment.length !== 1) {
    throw new Error('Candidate secret binding is not exact.');
  }
  const secret = secretEnvironment[0];
  if (secret?.key !== 'BENCHMARK_ANTHROPIC_API_KEY'
      || secret?.secret !== 'BENCHMARK_ANTHROPIC_API_KEY'
      || !/^[1-9][0-9]*$/.test(String(secret?.version ?? ''))
      || String(secret.version) !== String(expected.secretVersion)
      || !new Set([expected.projectId, expected.projectNumber]).has(String(secret?.projectId))) {
    throw new Error('Candidate secret binding is not exact.');
  }
  const capMicrousd = microusd(expected.benchmarkCapUsd, 'benchmark cap');
  const priorAuditSpendMicrousd = microusd(
    expected.priorAuditSpendUsd,
    'prior audit spend',
  );
  const deploymentConfig = deploymentConfigSha256(
    expected.runId,
    capMicrousd,
    priorAuditSpendMicrousd,
    expected.runtimeServiceAccount,
    expected.projectId,
    expected.projectId,
    'lemon-screenplay-dashboard',
    'lemon-screenplay-dashboard.firebasestorage.app',
    expected.inferenceGeo,
  );
  const isolationProof = expected.productionIsolationProof;
  const storageAclProof = expected.productionStorageAclProof;
  const stagingIdentityProof = expected.stagingIdentityProof;
  const expectedIsolation = {
    runtimeServiceAccount: expected.runtimeServiceAccount,
    stagingProjectId: expected.projectId,
    stagingProjectNumber: expected.projectNumber,
    productionProjectId: 'lemon-screenplay-dashboard',
    productionProjectNumber: expected.productionProjectNumber,
    productionAuditorServiceAccount: PRODUCTION_AUDITOR_SERVICE_ACCOUNT,
    productionStorageBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
    productionFirestoreInventory: isolationProof?.production_firestore_inventory,
    stagingFirestoreDatabases: isolationProof?.staging_firestore_databases,
    stagingStorageBuckets: isolationProof?.staging_storage_buckets,
  };
  const expectedIsolationPlan = buildIsolationProbePlan(expectedIsolation);
  const productionServiceAccounts = isolationProof?.production_service_accounts;
  const productionAuditor = reviewedProductionAuditor(expectedIsolation);
  if (!isolationProof || isolationProof.status !== 'passed_complete_static_iam_inventory'
      || isolationProof.scanner_version
        !== 'standalone-project-iam-and-resource-inventory-v2'
      || isolationProof.runtime_service_account !== expected.runtimeServiceAccount
      || isolationProof.staging_project_id !== expected.projectId
      || isolationProof.staging_project_number !== expected.projectNumber
      || isolationProof.production_project_id !== 'lemon-screenplay-dashboard'
      || isolationProof.production_project_number !== expected.productionProjectNumber
      || isolationProof.production_storage_bucket
        !== 'lemon-screenplay-dashboard.firebasestorage.app'
      || isolationProof.staging_data_resource_inventory_sha256 !== sha256({
        databases: isolationProof.staging_firestore_databases,
        buckets: isolationProof.staging_storage_buckets,
      })
      || isolationProof.production_project_scope_state !== 'STANDALONE_NO_PARENT'
      || isolationProof.production_access_state !== 'NO_STAGING_IDENTITY_ALLOW_BINDING'
      || isolationProof.production_firestore_inventory_sha256
        !== sha256(isolationProof.production_firestore_inventory)
      || isolationProof.production_firestore_database_count
        !== isolationProof.production_firestore_inventory?.databases?.length
      || isolationProof.production_firestore_backup_count
        !== isolationProof.production_firestore_inventory?.backups?.length
      || isolationProof.production_firestore_backup_schedule_count
        !== isolationProof.production_firestore_inventory?.backup_schedules?.length
      || isolationProof.permission_contract_sha256 !== sha256(expectedIsolationPlan)
      || !/^[a-f0-9]{64}$/.test(String(isolationProof.production_project_resource_sha256 ?? ''))
      || !/^[a-f0-9]{64}$/.test(String(isolationProof.production_project_iam_policy_sha256 ?? ''))
      || isolationProof.production_project_iam_contract_sha256
        !== sha256(reviewedProductionProjectBindings(expectedIsolation))
      || !Number.isInteger(isolationProof.production_project_binding_count)
      || isolationProof.production_project_binding_count < 1
      || !Array.isArray(productionServiceAccounts)
      || productionServiceAccounts.length < 1
      || isolationProof.production_service_account_count
        !== productionServiceAccounts.length
      || isolationProof.production_service_account_inventory_sha256
        !== sha256(productionServiceAccounts)
      || isolationProof.production_auditor_service_account
        !== productionAuditor.service_account
      || isolationProof.production_auditor_role !== productionAuditor.role
      || isolationProof.production_auditor_wif_principal
        !== productionAuditor.workload_identity_principal
      || canonicalJson(isolationProof.production_auditor_permissions)
        !== canonicalJson(productionAuditor.permissions)
      || isolationProof.production_auditor_contract_sha256
        !== productionAuditor.contract_sha256
      || !/^[a-f0-9]{64}$/.test(String(
        isolationProof.production_auditor_role_definition_sha256 ?? '',
      ))
      || productionServiceAccounts.some((account) => (
        typeof account?.email !== 'string'
        || !account.email
        || typeof account.disabled !== 'boolean'
        || !/^[1-9][0-9]*$/.test(String(account.unique_id ?? ''))
        || !/^[a-f0-9]{64}$/.test(String(account.resource_sha256 ?? ''))
        || !/^[a-f0-9]{64}$/.test(String(account.policy_sha256 ?? ''))
        || !Number.isInteger(account.binding_count)
        || account.binding_count < 0
      ))
      || isolationProof.proof_sha256 !== sha256(
        Object.fromEntries(Object.entries(isolationProof).filter(([key]) => key !== 'proof_sha256')),
      )) {
    throw new Error('Candidate production-isolation proof is invalid.');
  }
  assertProductionStorageAclProof(storageAclProof, {
    runtimeServiceAccount: expected.runtimeServiceAccount,
    productionStorageBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
    productionProjectNumber: expected.productionProjectNumber,
  });
  assertStagingIdentityProof(stagingIdentityProof, {
    projectId: expected.projectId,
    projectNumber: expected.projectNumber,
    runtimeServiceAccount: expected.runtimeServiceAccount,
    deployerServiceAccount: expected.deployerServiceAccount,
    workloadIdentityProvider: expected.workloadIdentityProvider,
    stagingStorageBuckets: isolationProof.staging_storage_buckets,
  });
  const revisionName = String(service.revision ?? '').split('/').at(-1);
  const actualRevisionName = String(
    revisionResource?.name ?? revisionResource?.metadata?.name ?? '',
  ).split('/').at(-1);
  const spec = revisionResource?.spec ?? {};
  const serviceAccount = revisionResource?.serviceAccount ?? spec.serviceAccountName;
  const concurrency = revisionResource?.maxInstanceRequestConcurrency
    ?? spec.containerConcurrency;
  const containers = revisionResource?.containers ?? spec.containers;
  const image = Array.isArray(containers) ? containers[0]?.image : undefined;
  const digestSource = revisionResource?.status?.imageDigest ?? image;
  const imageDigest = String(digestSource ?? '').match(/sha256:[a-f0-9]{64}/)?.[0];
  const expectedImagePrefix = (
    `${expected.region}-docker.pkg.dev/${expected.projectId}/gcf-artifacts/`
  );
  if (!/^llmproxycandidate-[0-9]{5}-[a-z0-9]{3}$/.test(revisionName)
      || actualRevisionName !== revisionName
      || serviceAccount !== expected.runtimeServiceAccount
      || concurrency !== 1
      || typeof image !== 'string'
      || !image.startsWith(expectedImagePrefix)
      || !imageDigest
      || !image.endsWith(`@${imageDigest}`)) {
    throw new Error('Candidate Cloud Run revision does not match the reviewed contract.');
  }
  const receipt = {
    project_id: expected.projectId,
    region: expected.region,
    function_name: 'llmProxyCandidate',
    function_uri: expected.serviceUri,
    cloud_run_service: service.service,
    cloud_run_revision: revisionName,
    runtime_service_account: expected.runtimeServiceAccount,
    runtime: build.runtime,
    entry_point: build.entryPoint,
    runtime_update_policy: 'automatic',
    runtime_version: null,
    build_service_account: build.serviceAccount,
    docker_repository: build.dockerRepository,
    available_memory: service.availableMemory,
    available_cpu: service.availableCpu,
    ingress_settings: service.ingressSettings,
    timeout_seconds: service.timeoutSeconds,
    max_instance_count: service.maxInstanceCount,
    concurrency: service.maxInstanceRequestConcurrency,
    build_resource: build.build,
    container_image: image,
    container_image_digest: imageDigest,
    function_resource_sha256: sha256(functionResource),
    revision_resource_sha256: sha256(revisionResource),
    git_sha: expected.gitSha,
    catalog_sha256: expected.catalogSha256,
    pricing_sha256: llmPricingSha256(),
    inference_geo: expected.inferenceGeo,
    run_id: expected.runId,
    cap_microusd: capMicrousd,
    prior_audit_spend_microusd: priorAuditSpendMicrousd,
    build_timestamp: new Date(expected.buildTimestamp).toISOString(),
    deployment_config_sha256: deploymentConfig,
    firebase_config_project_id: expected.projectId,
    runtime_environment_sha256: sha256(environment),
    secret_environment_variables: [{
      key: secret.key,
      projectId: String(secret.projectId),
      secret: secret.secret,
      version: String(secret.version),
    }],
    staging_project_number: expected.projectNumber,
    production_isolation_proof: isolationProof,
    production_storage_acl_proof: storageAclProof,
    staging_identity_proof: stagingIdentityProof,
  };
  return { ...receipt, receipt_sha256: sha256(receipt) };
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function main() {
  if (process.argv[2] === '--assert-private-iam') {
    const path = process.argv[3];
    if (!path) throw new Error('IAM policy path is required.');
    assertPrivateIamPolicy(JSON.parse(fs.readFileSync(path, 'utf8')));
    process.stdout.write('Candidate IAM policy has only the exact benchmark caller.\n');
    return;
  }
  if (process.argv[2] === '--assert-predeploy-platform') {
    const [path, projectNumber] = process.argv.slice(3);
    if (!path || !/^[1-9][0-9]*$/.test(projectNumber ?? '')) {
      throw new Error('Function resource path and staging project number are required.');
    }
    assertPredeployPlatformConfig(JSON.parse(fs.readFileSync(path, 'utf8')), {
      projectId: 'lemon-screenplay-staging',
      region: 'us-central1',
      projectNumber,
      runtimeServiceAccount:
        'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
    });
    process.stdout.write('Existing candidate platform configuration is staging-only.\n');
    return;
  }
  if (process.argv[2] === '--write-deployment-receipt') {
    const [functionPath, revisionPath, outputPath] = process.argv.slice(3);
    if (!functionPath || !revisionPath || !outputPath) {
      throw new Error('Function, revision, and receipt paths are required.');
    }
    const isolationProofPath = process.env.PRODUCTION_ISOLATION_PROOF_FILE;
    if (!isolationProofPath) throw new Error('Production isolation proof path is required.');
    const storageAclProofPath = process.env.PRODUCTION_STORAGE_ACL_PROOF_FILE;
    if (!storageAclProofPath) throw new Error('Production Storage ACL proof path is required.');
    const stagingIdentityProofPath = process.env.STAGING_IDENTITY_PROOF_FILE;
    if (!stagingIdentityProofPath) throw new Error('Staging identity proof path is required.');
    const receipt = buildDeploymentReceipt(
      JSON.parse(fs.readFileSync(functionPath, 'utf8')),
      JSON.parse(fs.readFileSync(revisionPath, 'utf8')),
      {
        projectId: process.env.STAGING_PROJECT_ID,
        region: 'us-central1',
        serviceUri: process.env.SERVICE_URI,
        runtimeServiceAccount: process.env.RUNTIME_SERVICE_ACCOUNT,
        gitSha: process.env.APPROVED_SOURCE_SHA,
        catalogSha256: process.env.CATALOG_SHA256,
        inferenceGeo: process.env.BENCHMARK_INFERENCE_GEO,
        runId: process.env.RUN_ID,
        benchmarkCapUsd: process.env.BENCHMARK_CAP_USD,
        priorAuditSpendUsd: process.env.BENCHMARK_PRIOR_AUDIT_SPEND_USD,
        buildTimestamp: process.env.BUILD_TIMESTAMP,
        projectNumber: process.env.STAGING_PROJECT_NUMBER,
        secretVersion: process.env.BENCHMARK_SECRET_VERSION,
        deployerServiceAccount: process.env.DEPLOYER_SERVICE_ACCOUNT,
        workloadIdentityProvider: process.env.WORKLOAD_IDENTITY_PROVIDER,
        productionProjectNumber: process.env.PRODUCTION_PROJECT_NUMBER,
        productionIsolationProof: JSON.parse(
          fs.readFileSync(isolationProofPath, 'utf8'),
        ),
        productionStorageAclProof: JSON.parse(
          fs.readFileSync(storageAclProofPath, 'utf8'),
        ),
        stagingIdentityProof: JSON.parse(
          fs.readFileSync(stagingIdentityProofPath, 'utf8'),
        ),
      },
    );
    fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    process.stdout.write(`Candidate deployment receipt ${receipt.receipt_sha256}.\n`);
    return;
  }
  if (process.argv[2] === '--write-production-isolation-proof') {
    const outputPath = process.argv[3];
    if (!outputPath) throw new Error('An isolation proof path is required.');
    const expected = {
      runtimeServiceAccount: process.env.RUNTIME_SERVICE_ACCOUNT,
      stagingProjectId: process.env.STAGING_PROJECT_ID,
      stagingProjectNumber: process.env.STAGING_PROJECT_NUMBER,
      productionProjectId: process.env.PRODUCTION_FIRESTORE_PROJECT_ID,
      productionProjectNumber: process.env.PRODUCTION_PROJECT_NUMBER,
      productionStorageBucket: process.env.PRODUCTION_STORAGE_BUCKET,
      productionAuditorServiceAccount: process.env.PRODUCTION_AUDITOR_SERVICE_ACCOUNT,
      verifiedAt: process.env.ISOLATION_VERIFIED_AT,
    };
    const readInventory = (path, fallback, description) => (
      path
        ? JSON.parse(fs.readFileSync(path, 'utf8'))
        : gcloudStorageJson(fallback, description)
    );
    expected.stagingFirestoreDatabases = readInventory(
      process.env.STAGING_FIRESTORE_INVENTORY_FILE,
      ['firestore', 'databases', 'list', `--project=${expected.stagingProjectId}`, '--format=json'],
      'staging Firestore database inventory',
    ).map((database) => database?.name).sort();
    expected.stagingStorageBuckets = readInventory(
      process.env.STAGING_STORAGE_INVENTORY_FILE,
      ['storage', 'buckets', 'list', `--project=${expected.stagingProjectId}`, '--format=json'],
      'staging Storage bucket inventory',
    ).map((bucket) => bucket?.name).sort();
    expected.productionFirestoreInventory = runProductionFirestoreInventory(expected);
    expected.productionServiceAccountResources = gcloudStorageJson(
      [
        'iam', 'service-accounts', 'list',
        `--project=${expected.productionProjectId}`,
        '--format=json',
      ],
      'production service-account inventory',
    ).map((serviceAccount) => ({
      service_account: serviceAccount,
      policy: gcloudStorageJson(
        [
          'iam', 'service-accounts', 'get-iam-policy', serviceAccount.email,
          `--project=${expected.productionProjectId}`,
          '--format=json',
        ],
        'production service-account IAM policy',
      ),
    }));
    expected.productionAuditorRoleDefinition = gcloudStorageJson(
      [
        'iam', 'roles', 'describe', 'v9ProductionMetadataAuditor',
        `--project=${expected.productionProjectId}`,
        '--format=json',
      ],
      'production auditor custom role',
    );
    const proof = buildProductionIsolationProof(
      gcloudStorageJson(
        ['projects', 'describe', expected.productionProjectId, '--format=json'],
        'production project resource',
      ),
      gcloudStorageJson(
        ['projects', 'get-iam-policy', expected.productionProjectId, '--format=json'],
        'production project IAM policy',
      ),
      expected,
    );
    fs.writeFileSync(outputPath, `${JSON.stringify(proof, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    process.stdout.write(`Candidate production-isolation proof ${proof.proof_sha256}.\n`);
    return;
  }
  if (process.argv[2] === '--write-production-storage-acl-proof') {
    const outputPath = process.argv[3];
    if (!outputPath) throw new Error('A production Storage ACL proof path is required.');
    const expected = {
      runtimeServiceAccount: process.env.RUNTIME_SERVICE_ACCOUNT,
      productionStorageBucket: process.env.PRODUCTION_STORAGE_BUCKET,
      productionProjectNumber: process.env.PRODUCTION_PROJECT_NUMBER,
      verifiedAt: process.env.STORAGE_ACL_VERIFIED_AT,
    };
    const proof = runProductionStorageAclAudit(expected);
    fs.writeFileSync(outputPath, `${JSON.stringify(proof, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    process.stdout.write(`Candidate production Storage ACL proof ${proof.proof_sha256}.\n`);
    return;
  }
  if (process.argv[2] === '--write-staging-identity-proof') {
    const outputPath = process.argv[3];
    if (!outputPath) throw new Error('A staging identity proof path is required.');
    const proof = runStagingIdentityAudit(stagingIdentityAuditExpected());
    fs.writeFileSync(outputPath, `${JSON.stringify(proof, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    process.stdout.write(`Candidate staging identity proof ${proof.proof_sha256}.\n`);
    return;
  }
  if (process.argv[2] === '--assert-upload-list') {
    const [uploadPath, approvedSha] = process.argv.slice(3);
    if (!uploadPath || !SHA.test(approvedSha ?? '')) {
      throw new Error('Upload list and approved source SHA are required.');
    }
    const tracked = execFileSync(
      'git',
      ['ls-tree', '-r', '--name-only', approvedSha, '--', 'functions'],
      { encoding: 'utf8' },
    ).split(/\r?\n/).filter(Boolean);
    assertCandidateUploadFiles(fs.readFileSync(uploadPath, 'utf8'), tracked);
    process.stdout.write('Candidate upload exactly matches reviewed deploy inputs.\n');
    return;
  }
  if (process.argv[2] === '--assert-source-tree') {
    const root = process.argv[3];
    if (root !== 'functions') throw new Error('Candidate source root must be functions.');
    const paths = execFileSync(
      'find',
      [root, '-type', 'f', '-print'],
      { encoding: 'utf8' },
    ).split(/\r?\n/).filter(Boolean);
    assertCandidateSourceTree(paths);
    process.stdout.write('Candidate source tree contains no forbidden artifacts.\n');
    return;
  }
  const result = validateCandidateGate({
    stagingProjectId: process.env.STAGING_PROJECT_ID,
    deployerServiceAccount: process.env.DEPLOYER_SERVICE_ACCOUNT,
    productionAuditorServiceAccount: process.env.PRODUCTION_AUDITOR_SERVICE_ACCOUNT,
    workloadIdentityProvider: process.env.WORKLOAD_IDENTITY_PROVIDER,
    approvedSourceSha: process.env.APPROVED_SOURCE_SHA,
    runId: process.env.RUN_ID,
    benchmarkCapUsd: process.env.BENCHMARK_CAP_USD,
    priorAuditSpendUsd: process.env.BENCHMARK_PRIOR_AUDIT_SPEND_USD,
    inferenceGeo: process.env.BENCHMARK_INFERENCE_GEO,
    headSha: git('rev-parse', 'HEAD'),
    originMainSha: git('rev-parse', 'origin/main'),
    cleanStatus: git('status', '--porcelain=v1', '--untracked-files=all'),
  });
  process.stdout.write(
    `Candidate gate passed: cap=${result.capMicrousd} prior=${result.priorMicrousd}.\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Candidate gate refused: ${error.message}\n`);
    process.exitCode = 1;
  }
}
