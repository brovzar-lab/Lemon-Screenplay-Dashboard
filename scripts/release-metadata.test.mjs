import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import { cacheBustedReleaseUrl, validateReleaseMetadata } from './release-metadata.mjs';

test('release verification is cache-busted by the full Git SHA', () => {
  const sha = 'a'.repeat(40);
  assert.equal(
    cacheBustedReleaseUrl('https://lemon-screenplay-dashboard.web.app', sha),
    `https://lemon-screenplay-dashboard.web.app/release.json?verification=${sha}`,
  );
});

test('Firebase serves release.json with no-store', () => {
  const firebase = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url)));
  const release = firebase.hosting.headers.find((entry) => entry.source === '/release.json');
  assert.ok(release);
  assert.ok(release.headers.some(
    (header) => header.key === 'Cache-Control' && header.value === 'no-store',
  ));
});

test('release identity requires exact hashes and a build timestamp', () => {
  assert.doesNotThrow(() => validateReleaseMetadata({
    git_sha: 'a'.repeat(40),
    source_clean: true,
    catalog_sha256: 'b'.repeat(64),
    hosting_config_sha256: 'c'.repeat(64),
    build_timestamp: '2026-08-21T12:00:00Z',
  }));
});

test('staging candidate workflow is WIF-only and deploys only the candidate', () => {
  const workflow = fs.readFileSync(
    new URL('../.github/workflows/deploy-candidate-staging.yml', import.meta.url),
    'utf8',
  );
  const gate = fs.readFileSync(
    new URL('./candidate-staging-gate.mjs', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /environment: staging/);
  const validationJob = workflow.match(/validate-source:[\s\S]*?\n  deploy-candidate:/)?.[0] ?? '';
  const deploymentJob = workflow.slice(workflow.indexOf('\n  deploy-candidate:'));
  assert.match(validationJob, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(
    validationJob,
    /id-token: write/,
  );
  assert.match(validationJob, /Install dependencies without cloud authority/);
  assert.match(validationJob, /Run complete offline gates without cloud authority/);
  assert.doesNotMatch(validationJob, /vars\.GCP_/);
  assert.match(validationJob, /STAGING_PROJECT_ID: lemon-screenplay-staging/);
  assert.doesNotMatch(deploymentJob, /npm (?:ci|install)|pip install|test:python|test:run/);
  const trustedGate = deploymentJob.indexOf('Repeat the trusted inline source authorization gate');
  const repositoryGate = deploymentJob.indexOf('Run the repository source gate as defense in depth');
  const cloudAuth = deploymentJob.indexOf('Authenticate as the staging deployer');
  assert.ok(trustedGate > 0 && trustedGate < repositoryGate);
  assert.ok(repositoryGate < cloudAuth);
  assert.match(workflow, /test "\$\(git rev-parse origin\/main\)" = "\$\{APPROVED_SOURCE_SHA\}"/);
  assert.equal((workflow.match(/github\.ref_protected/g) ?? []).length, 3);
  assert.equal((workflow.match(/GITHUB_REF_PROTECTED/g) ?? []).length, 4);
  assert.match(workflow, /ref: \$\{\{ inputs\.approved_source_sha \}\}/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /id-token: write/);
  assert.match(gate, /lemon-screenplay-staging/);
  assert.doesNotMatch(gate, /lemon-sp-dashboard-stg-493694/);
  assert.match(gate, /Refusing unapproved staging project/);
  assert.match(gate, /deployerServiceAccount/);
  assert.match(
    workflow,
    /google-github-actions\/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093/,
  );
  assert.match(workflow, /NODE_VERSION: '22\.22\.3'/);
  assert.match(workflow, /NPM_VERSION: '10\.9\.8'/);
  assert.match(workflow, /PYTHON_VERSION: '3\.13\.13'/);
  assert.match(workflow, /JAVA_VERSION: '21\.0\.12'/);
  assert.match(workflow, /FIREBASE_TOOLS_VERSION: '15\.14\.0'/);
  for (const tool of ['Node', 'npm', 'Python', 'Java']) {
    assert.match(workflow, new RegExp(`${tool} version mismatch`));
  }
  const javaVersionPattern = workflow.match(/sed -nE '([^']+)' <<< "\$\{ACTUAL_JAVA_OUTPUT\}"/)?.[1];
  assert.ok(javaVersionPattern);
  const javaProbe = spawnSync('sed', ['-nE', javaVersionPattern], {
    input: 'Picked up JAVA_TOOL_OPTIONS: canary="21.0.12"\nopenjdk version "17.0.12" 2025-07-15\n',
    encoding: 'utf8',
  });
  assert.equal(javaProbe.status, 0);
  assert.equal(javaProbe.stdout.trim(), '17.0.12');
  assert.match(workflow, /test "\$\{ACTUAL_JAVA_VERSION\}" = "\$\{JAVA_VERSION\}"/);
  assert.match(workflow, /GCLOUD_VERSION: '574\.0\.0'/);
  assert.match(workflow, /gcloud functions deploy llmProxyCandidate/);
  for (const flag of ['--min-instances=0', '--cpu=0.3333']) {
    assert.match(workflow, new RegExp(flag));
  }
  for (const forbiddenFlag of [
    '--clear-build-service-account',
    '--clear-build-worker-pool',
    '--clear-docker-repository',
    '--clear-kms-key',
    '--clear-binary-authorization',
    '--clear-vpc-connector',
    '--clear-network',
    '--runtime-update-policy',
  ]) assert.doesNotMatch(workflow, new RegExp(forbiddenFlag));
  assert.match(workflow, /--assert-predeploy-platform/);
  assert.match(workflow, /Candidate bootstrap is not authorized without an existing private service/);
  assert.doesNotMatch(workflow, /firebase deploy/);
  assert.match(workflow, /git fetch origin main/);
  assert.match(workflow, /node scripts\/candidate-staging-gate\.mjs/);
  assert.match(gate, /git\('rev-parse', 'origin\/main'\)/);
  assert.doesNotMatch(workflow, /codex\/anthropic-model-modernization/);
  assert.match(workflow, /benchmark_cap_usd:[\s\S]*default: '8'/);
  assert.match(workflow, /gcloud run services get-iam-policy/);
  assert.equal((workflow.match(/--assert-private-iam/g) ?? []).length, 2);
  assert.equal((workflow.match(/401\|403/g) ?? []).length, 2);
  assert.doesNotMatch(workflow, /2>\/dev\/null \|\| true/);
  assert.match(workflow, /DESCRIBE_STATUS=\$\?/);
  assert.match(workflow, /status=\\\[404\\\].*NOT_FOUND/);
  assert.match(workflow, /401\|403/);
  assert.doesNotMatch(workflow, /add-iam-policy-binding|allow-unauthenticated/);
  assert.match(workflow, /gcloud meta list-files-for-upload functions/);
  assert.match(workflow, /--write-deployment-receipt/);
  assert.match(gate, /'projects', 'get-iam-policy'/);
  assert.match(gate, /standalone-project-iam-and-resource-inventory-v2/);
  assert.doesNotMatch(gate, /policy-intelligence|troubleshoot-policy/);
  assert.match(workflow, /BENCHMARK_SECRET_VERSION/);
  assert.match(workflow, /BENCHMARK_ANTHROPIC_API_KEY:\$\{BENCHMARK_SECRET_VERSION\}/);
  assert.doesNotMatch(workflow, /BENCHMARK_ANTHROPIC_API_KEY:latest/);
  assert.match(
    workflow,
    /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/,
  );
  assert.match(workflow, /serviceConfig\.revision/);
  assert.match(workflow, /gcloud run revisions describe/);
  assert.match(workflow, /GCP_PRODUCTION_AUDITOR_SERVICE_ACCOUNT/);
  assert.match(workflow, /WORKLOAD_IDENTITY_PROVIDER: \$\{\{ vars\.GCP_WORKLOAD_IDENTITY_PROVIDER \}\}/);
  assert.equal((workflow.match(/workload_identity_provider: \$\{\{ env\.WORKLOAD_IDENTITY_PROVIDER \}\}/g) ?? []).length, 3);
  assert.doesNotMatch(workflow, /workload_identity_provider: \$\{\{ vars\./);
  assert.match(gate, /projects\/549848020392\/locations\/global\/workloadIdentityPools/);
  assert.equal((workflow.match(/google-github-actions\/auth@/g) ?? []).length, 3);
  const productionAuth = workflow.indexOf('Authenticate as the production metadata auditor');
  const productionProof = workflow.indexOf('Prove the runtime identity has no production write permission');
  const stagingReauth = workflow.indexOf('Restore the staging deployer identity');
  const deploy = workflow.indexOf('Deploy only the private candidate function');
  assert.ok(productionAuth > 0 && productionAuth < productionProof);
  assert.ok(productionProof < stagingReauth && stagingReauth < deploy);
  const predeployIdentity = workflow.indexOf('Write the complete predeployment staging identity proof');
  assert.ok(predeployIdentity > 0 && predeployIdentity < productionAuth);
  assert.equal((workflow.match(/--write-staging-identity-proof/g) ?? []).length, 2);
  const gcloudIgnore = fs.readFileSync(
    new URL('../functions/.gcloudignore', import.meta.url),
    'utf8',
  );
  assert.match(gcloudIgnore, /^node_modules\/$/m);
  assert.doesNotMatch(workflow, /FIREBASE_TOKEN|SERVICE_ACCOUNT_JSON|credentials_json/);
  const functionsPackage = JSON.parse(fs.readFileSync(
    new URL('../functions/package.json', import.meta.url),
    'utf8',
  ));
  assert.equal(functionsPackage.scripts['gcp-build'], '');
});
