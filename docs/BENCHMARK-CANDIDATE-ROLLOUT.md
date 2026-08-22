# Candidate proxy rollout

This is an approval-gated runbook. Committing this file does not authorize project creation, billing, IAM, secrets, a push, a deployment, paid inference, credential revocation, or function deletion.

## Fixed design

- Staging project: `lemon-screenplay-staging`, falling back to `lemon-sp-dashboard-stg-493694` only if the primary ID is unavailable.
- Named Firestore database: `model-benchmarks`, Native mode, `nam5`, deletion protection enabled.
- Candidate function: `llmProxyCandidate`, direct URL only, no Hosting rewrite, private invocation.
- Runtime service account: access to only `projects/PROJECT_ID/databases/model-benchmarks`, the benchmark Anthropic secret, and sanitized logging. It receives no Storage role and no default-database grant.
- Caller service account: Cloud Run invoker only. The local harness impersonates it for a short-lived identity token.
- The candidate stores only run and call metadata under `model_benchmark_runs/{runId}/calls/{callId}`. Full inputs, prompts, and outputs stay local.

The Admin SDK bypasses Firestore Security Rules. Isolation therefore depends on the dedicated runtime identity and a per-database IAM condition, not on a separate collection or client rules.

## Approval sequence

1. Finish the offline suite and commit the clean modernization branch.
2. Obtain approval for branch push.
3. Obtain staging approval for project creation, billing, named database, service accounts, IAM, secret creation, Workload Identity Federation, GitHub staging environment, and candidate deployment.
4. Deploy only `llmProxyCandidate` from the approved clean Git SHA.
5. Run the authenticated no-spend preflight. It must report named database `allowed`, default database `denied`, and Storage `denied`.
6. Obtain separate approval for the $1 staging smoke, then prove only the staging named database changed.
7. Obtain production-infrastructure approval. Record the screenplay, Hosting, Storage, queue, and normal-proxy baseline before changing anything.
8. Deploy the identical candidate commit only. Obtain separate approval for each paid phase: $1 smoke, $75 three-screenplay pilot, then $300 twelve-screenplay blinded benchmark.
9. After every phase, compare the protected production fingerprints. Only the named benchmark database may change.
10. Obtain teardown approval before deleting the candidate, removing its invoker grant, disabling secret versions, or revoking the benchmark Anthropic key. Retain the deletion-protected named database unless its deletion is separately approved.

## Release proof

The candidate preflight returns the full Git SHA, clean-source flag, catalog SHA-256, build timestamp, deployment-configuration SHA-256, and `K_REVISION`. The release receipt must add the deployed image digest and Firebase function hash obtained from the platform after deployment.

Hosting builds emit `/release.json` with `Cache-Control: no-store`. Verification must use `/release.json?verification=FULL_GIT_SHA` and compare the returned full SHA with the approved commit. A function listing alone is not release proof.

Use GitHub Workload Identity Federation identities dedicated to staging and production. Keep production behind the existing protected `production` environment. Do not add Firebase tokens or service-account JSON keys.

## Rollback proof

Deletion is not the first rollback. First stop new calls by removing the candidate invoker grant. Then, with teardown approval, delete only `llmProxyCandidate`, disable its benchmark secret versions, and revoke its Anthropic benchmark key. Recheck that the normal proxy revision, Hosting release, default Firestore fingerprint, Storage fingerprint, and ingest queue still match the baseline.

Post-benchmark browser hardening remains a later release. It migrates DevExec text to a narrow Google endpoint and fresh Model Comparison calls to an admin-only endpoint, then removes browser access to `/api/llm`. Ordinary and bulk reanalysis already use the VPS queue and are not redesigned.
