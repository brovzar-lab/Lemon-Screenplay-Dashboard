# Candidate proxy rollout

This is an approval-gated runbook. Committing this file does not authorize project creation, billing, IAM, secrets, a push, a deployment, paid inference, credential revocation, or function deletion.

## Fixed design

- Staging project: exactly `lemon-screenplay-staging`. If it is unavailable, stop. A fallback project would split the cumulative audit ledger.
- Named Firestore database: `model-benchmarks`, Native mode, `nam5`, deletion protection enabled.
- Candidate function: `llmProxyCandidate`, direct URL only, no Hosting rewrite, private invocation.
- Runtime service account: access to only `projects/PROJECT_ID/databases/model-benchmarks`, the benchmark Anthropic secret, and sanitized logging. It receives no Storage role and no default-database grant.
- Caller service account: Cloud Run invoker only. The local harness impersonates it for a short-lived identity token.
- Server cap: one immutable run cap, default USD 8, plus all previously settled and uncertain spend, enforced atomically against the authorized USD 80 audit ceiling. The one reviewed USD 40 to USD 80 ledger upgrade accepts only the exact audited idle snapshot (USD 37.511973 spent, 203 calls, two uncertain calls totaling USD 7.627776), preserves every counter, and rejects any drift or other limit change. A new run ID cannot reset cumulative spend or uncertain holds.
- Provider secret: one enabled numeric secret version is resolved before deployment and bound into the platform receipt. `latest` is never deployed.
- The candidate stores only run and call metadata under `model_benchmark_runs/{runId}/calls/{callId}`. Full inputs, prompts, and outputs stay local.

The Admin SDK bypasses Firestore Security Rules. Isolation therefore depends on the dedicated runtime identity and a per-database IAM condition, not on a separate collection or client rules. The authenticated preflight requires the runtime project to be exactly `lemon-screenplay-staging`, binds the runtime service account to it, then uses explicit Admin SDK apps to test the staging and production default databases separately and tests the exact production Storage bucket. All denied resource targets and the runtime project are bound into the deployment-configuration hash.

Cloud Asset Policy Analyzer and Policy Troubleshooter are not enabled in these projects. This workflow does not enable them. Both projects must remain active standalone projects with no parent. The workflow instead inventories the complete project IAM policies and exact child-resource policies, fails on any unreviewed principal, enumerates every production Firestore database, backup, and backup schedule, and hashes the complete result. Production Storage uses legacy ACLs, so the workflow also inventories the bucket metadata, bucket IAM, bucket/default ACLs, every live object version, and every soft-deleted version. Object names are represented only by SHA-256 hashes in the proof.

## Authorized V9 remediation sequence

1. Merge the reviewed remediation through the protected pull-request checks.
2. Dispatch the staging workflow from `main` with the exact merged SHA. The first job has no OIDC authority and must prove the requested SHA is the clean `origin/main` tip before the cloud-authorized job can start.
3. Deploy only `llmProxyCandidate`. The upload list must exactly equal the tracked compiled runtime inputs and must contain no source maps, local artifacts, credentials, logs, or screenplay material.
4. Before deployment, refuse any existing candidate whose platform configuration, private invocation, or direct Cloud Run IAM policy differs from the reviewed contract. Only a positively identified `404` or `NOT_FOUND` means the function is absent.
5. Before and after deployment, prove the Cloud Run resource policy contains exactly `serviceAccount:benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com`, with no condition, public member, or unrelated direct member. Separately record the complete reviewed set of effective project-level administrators and service agents.
6. Produce the production IAM/Firestore proof, production Storage ACL proof, and staging identity/resource proof. Any hierarchy, identity, role, database, bucket, secret, or resource-policy drift must stop the workflow.
7. Run the authenticated no-spend preflight. It must report named database `allowed`, staging default database `denied`, production default database `denied`, and production Storage `denied`, with exact resource names.
8. Run the authorized benchmark sequentially under the immutable server-side run cap and cumulative USD 80 audit cap.
9. Stop before any Hosting deployment, production deployment, production model-route activation, IAM change outside the reviewed auditor contract below, API enablement, or teardown.

## Release proof

The candidate preflight returns the full Git SHA, clean-source flag, catalog SHA-256, pricing SHA-256, build timestamp, deployment-configuration SHA-256, and `K_REVISION`. The immutable deployment receipt adds the exact Cloud Functions resource hash, Cloud Run revision hash, image digest, runtime/build configuration, numeric secret version, cap, prior spend, inference geography, and all three isolation proofs obtained from the platform after deployment. The receipt is uploaded as a protected workflow artifact and the paid runner requires its exact SHA-256.

Immediately before paid execution, the local runner reloads and cryptographically validates the three isolation proofs created by the protected GitHub workflow under the dedicated identities, re-describes the live function and revision, rechecks the direct private IAM policy and anonymous denial, and verifies the model catalog, pricing table, prompts, schemas, source hash, and deployment configuration. It does not regenerate production proofs with Billy's ambient local credentials. It repeats the cheap platform/private checks before each dispatch. A mismatch stops before another provider request.

Hosting builds emit `/release.json` with `Cache-Control: no-store`. Verification must use `/release.json?verification=FULL_GIT_SHA` and compare the returned full SHA with the approved commit. A function listing alone is not release proof.

Use GitHub Workload Identity Federation identities dedicated to staging and production. Production deploy identities stay behind the protected `production` environment. The metadata-only production auditor below is reachable only through the existing protected-main `staging` environment provider. Do not add Firebase tokens or service-account JSON keys.

The staging workflow is dispatchable only after the reviewed workflow exists on `main`. It checks out the explicitly approved SHA, then refuses deployment unless that SHA is also the clean `origin/main` tip. The staging GitHub environment and Workload Identity provider must independently restrict cloud authority to the reviewed repository and `main`; if either external gate is missing or unreadable, stop without deploying.

## Production metadata auditor IAM contract

The one authorized production identity is `v9-production-auditor@lemon-screenplay-dashboard.iam.gserviceaccount.com`. Its one project role is `projects/lemon-screenplay-dashboard/roles/v9ProductionMetadataAuditor`. Its one impersonation principal is:

`principal://iam.googleapis.com/projects/549848020392/locations/global/workloadIdentityPools/github-staging/subject/repo:brovzar-lab/Lemon-Screenplay-Dashboard:environment:staging`

The role contains only these metadata permissions:

| Permission | Required proof |
|---|---|
| `resourcemanager.projects.get` | Confirm the exact active standalone production project and hierarchy. |
| `resourcemanager.projects.getIamPolicy` | Inventory every production project binding. |
| `iam.roles.get` | Re-read and hash this custom role's exact permission list. |
| `iam.serviceAccounts.list` | Inventory every user-managed production service account. |
| `iam.serviceAccounts.getIamPolicy` | Inspect each service account for staging, indirect, public, or token-creation grants. |
| `datastore.databases.list` | Inventory Firestore databases without reading documents. |
| `datastore.locations.get` and `datastore.locations.list` | Resolve the locations used by the backup inventory commands. |
| `datastore.backups.list` | Inventory backup metadata without restoring or reading documents. |
| `datastore.backupSchedules.list` | Inventory backup-schedule metadata. |
| `storage.buckets.get` | Read production bucket configuration and legacy ACL metadata. |
| `storage.buckets.getIamPolicy` | Inventory the bucket IAM policy. |
| `storage.objects.getIamPolicy` | Include each object version's legacy ACL in the inventory without downloading its bytes. |
| `storage.objects.list` | Enumerate versions and legacy ACL metadata; object names are hashed before the receipt is emitted. |

The role deliberately omits `storage.objects.get`, every `datastore.entities.*` permission, Secret Manager access, deployment, invocation, service-account token creation, IAM mutation, billing, and write permissions. The only affected IAM policies are the production project policy and this new auditor service account's policy. The existing staging Workload Identity provider is not changed. GitHub receives only the non-secret staging environment variable `GCP_PRODUCTION_AUDITOR_SERVICE_ACCOUNT`.

Reviewed setup commands:

```bash
V9_PRODUCTION_PROJECT_ID='lemon-screenplay-dashboard'
V9_PRODUCTION_AUDITOR='v9-production-auditor@lemon-screenplay-dashboard.iam.gserviceaccount.com'
V9_PRODUCTION_ROLE='projects/lemon-screenplay-dashboard/roles/v9ProductionMetadataAuditor'
V9_WIF_PRINCIPAL='principal://iam.googleapis.com/projects/549848020392/locations/global/workloadIdentityPools/github-staging/subject/repo:brovzar-lab/Lemon-Screenplay-Dashboard:environment:staging'

gcloud iam service-accounts create v9-production-auditor \
  --project="${V9_PRODUCTION_PROJECT_ID}" \
  --display-name='V9 production metadata auditor'
gcloud iam roles create v9ProductionMetadataAuditor \
  --project="${V9_PRODUCTION_PROJECT_ID}" \
  --title='V9 Production Metadata Auditor' \
  --description='Read-only V9 staging isolation metadata; no screenplay bytes or Firestore documents.' \
  --stage=GA \
  --permissions='datastore.backupSchedules.list,datastore.backups.list,datastore.databases.list,datastore.locations.get,datastore.locations.list,iam.roles.get,iam.serviceAccounts.getIamPolicy,iam.serviceAccounts.list,resourcemanager.projects.get,resourcemanager.projects.getIamPolicy,storage.buckets.get,storage.buckets.getIamPolicy,storage.objects.getIamPolicy,storage.objects.list'
gcloud projects add-iam-policy-binding "${V9_PRODUCTION_PROJECT_ID}" \
  --member="serviceAccount:${V9_PRODUCTION_AUDITOR}" \
  --role="${V9_PRODUCTION_ROLE}"
gcloud iam service-accounts add-iam-policy-binding "${V9_PRODUCTION_AUDITOR}" \
  --project="${V9_PRODUCTION_PROJECT_ID}" \
  --member="${V9_WIF_PRINCIPAL}" \
  --role='roles/iam.workloadIdentityUser'
gh variable set GCP_PRODUCTION_AUDITOR_SERVICE_ACCOUNT \
  --repo brovzar-lab/Lemon-Screenplay-Dashboard \
  --env staging \
  --body="${V9_PRODUCTION_AUDITOR}"
```

Exact rollback, in reverse order:

```bash
V9_PRODUCTION_PROJECT_ID='lemon-screenplay-dashboard'
V9_PRODUCTION_AUDITOR='v9-production-auditor@lemon-screenplay-dashboard.iam.gserviceaccount.com'
V9_PRODUCTION_ROLE='projects/lemon-screenplay-dashboard/roles/v9ProductionMetadataAuditor'
V9_WIF_PRINCIPAL='principal://iam.googleapis.com/projects/549848020392/locations/global/workloadIdentityPools/github-staging/subject/repo:brovzar-lab/Lemon-Screenplay-Dashboard:environment:staging'

gh variable delete GCP_PRODUCTION_AUDITOR_SERVICE_ACCOUNT \
  --repo brovzar-lab/Lemon-Screenplay-Dashboard \
  --env staging
gcloud iam service-accounts remove-iam-policy-binding "${V9_PRODUCTION_AUDITOR}" \
  --project="${V9_PRODUCTION_PROJECT_ID}" \
  --member="${V9_WIF_PRINCIPAL}" \
  --role='roles/iam.workloadIdentityUser'
gcloud projects remove-iam-policy-binding "${V9_PRODUCTION_PROJECT_ID}" \
  --member="serviceAccount:${V9_PRODUCTION_AUDITOR}" \
  --role="${V9_PRODUCTION_ROLE}"
gcloud iam roles delete v9ProductionMetadataAuditor \
  --project="${V9_PRODUCTION_PROJECT_ID}"
gcloud iam service-accounts delete "${V9_PRODUCTION_AUDITOR}" \
  --project="${V9_PRODUCTION_PROJECT_ID}"
```

## Pending staging identity-reader IAM contract

Scanner v2 also needs to inspect the staging deployer's own service-account policy, key inventory, Workload Identity pool, exact GitHub provider, and the custom reader role itself. The live deployer does not currently have all seven permissions below. This second custom role is **not covered by the production-auditor authorization above** and must not be created without separate approval.

| Permission | Required proof |
|---|---|
| `iam.serviceAccounts.getIamPolicy` | Prove the exact principals that can impersonate each privileged staging service account. |
| `iam.serviceAccountKeys.list` | Prove those accounts have no user-managed key. |
| `iam.googleapis.com/workloadIdentityPoolProviders.get` | Verify the exact GitHub issuer, mappings, repository, protected-main ref, and staging-environment condition. |
| `iam.googleapis.com/workloadIdentityPoolProviders.list` | Prove the reviewed provider is the only active provider in the pool. |
| `iam.googleapis.com/workloadIdentityPools.get` | Verify the exact active staging pool. |
| `iam.googleapis.com/workloadIdentityPools.getIamPolicy` | Reject indirect or unreviewed principals on the pool itself. |
| `iam.roles.get` | Read the project custom role definition and prove it contains only this reviewed metadata permission set. |

Proposed setup, pending Billy's separate approval:

```bash
V9_STAGING_PROJECT_ID='lemon-screenplay-staging'
V9_STAGING_DEPLOYER='benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com'
V9_STAGING_READER_ROLE='projects/lemon-screenplay-staging/roles/v9StagingIdentityProofReader'

gcloud iam roles create v9StagingIdentityProofReader \
  --project="${V9_STAGING_PROJECT_ID}" \
  --title='V9 Staging Identity Proof Reader' \
  --description='Read-only V9 staging identity proof metadata; no deploy, invoke, secret, or data access.' \
  --stage=GA \
  --permissions='iam.googleapis.com/workloadIdentityPoolProviders.get,iam.googleapis.com/workloadIdentityPoolProviders.list,iam.googleapis.com/workloadIdentityPools.get,iam.googleapis.com/workloadIdentityPools.getIamPolicy,iam.roles.get,iam.serviceAccountKeys.list,iam.serviceAccounts.getIamPolicy'
gcloud projects add-iam-policy-binding "${V9_STAGING_PROJECT_ID}" \
  --member="serviceAccount:${V9_STAGING_DEPLOYER}" \
  --role="${V9_STAGING_READER_ROLE}"
```

Exact rollback, in reverse order:

```bash
V9_STAGING_PROJECT_ID='lemon-screenplay-staging'
V9_STAGING_DEPLOYER='benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com'
V9_STAGING_READER_ROLE='projects/lemon-screenplay-staging/roles/v9StagingIdentityProofReader'

gcloud projects remove-iam-policy-binding "${V9_STAGING_PROJECT_ID}" \
  --member="serviceAccount:${V9_STAGING_DEPLOYER}" \
  --role="${V9_STAGING_READER_ROLE}"
gcloud iam roles delete v9StagingIdentityProofReader \
  --project="${V9_STAGING_PROJECT_ID}"
```

Until that grant is separately approved and proved, the official staging workflow must fail closed before deployment. It must not substitute broad Viewer access, the production auditor, or Billy's local credentials.

The permission split was checked against the current official [Firestore IAM method table](https://cloud.google.com/firestore/docs/security/iam), [Cloud Storage IAM requirements](https://cloud.google.com/storage/docs/access-control/iam-console), and [Google Cloud Workload Identity Federation guidance](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines). In particular, the production auditor omits `storage.objects.get` and every `datastore.entities.*` permission, while the pending staging role contains no data, secret, invocation, deployment, or mutation permission.

## Rollback proof

Deletion is not the first rollback. First stop new calls by removing the candidate invoker grant. Then, with teardown approval, delete only `llmProxyCandidate`, disable its benchmark secret versions, and revoke its Anthropic benchmark key. Recheck that the normal proxy revision, Hosting release, default Firestore fingerprint, Storage fingerprint, and ingest queue still match the baseline.

Fresh browser Model Comparison is disabled. Upload and Re-analyze use the authoritative private VPS queue. Re-enabling browser inference requires a separately reviewed trust-equivalent route.
