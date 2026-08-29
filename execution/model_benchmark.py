"""Local, persistence-free old-vs-candidate screenplay benchmark.

The default is a dry-run manifest. Paid execution requires an exact SHA-256
approval for every local PDF, an explicit paid flag, the dedicated candidate
proxy URL, and a hard request ceiling derived before each call. Benchmark mode
does not initialize Firebase Admin and blocks the ingestion persistence functions.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import os
import re
import stat
import base64
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence
from urllib.parse import urlparse

import requests

from execution.local_artifacts import secure_local_path
from execution.trust_manifest import (
    correction_call_lineage_matches,
    correction_delivery_state_for_call,
    correction_release_lineage_matches,
    validate_correction_chronology,
)
from execution.verdict_contract import READER_WEIGHTS

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_ROOT = ROOT / "benchmark-artifacts"
CATALOG_PATH = ROOT / "src/config/anthropic-model-catalog.json"
PRICING_PATH = ROOT / "functions/src/anthropicPricing.json"
OPAQUE_RUN_ID_PATTERN = re.compile(
    r"^(?:[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-"
    r"[89ab][a-f0-9]{3}-[a-f0-9]{12})$"
)
LOCAL_PROXY_HOSTS = {"127.0.0.1", "localhost"}
STAGING_PROJECT_ID = "lemon-screenplay-staging"
STAGING_REGION = "us-central1"
CANDIDATE_FUNCTION_NAME = "llmProxyCandidate"
BENCHMARK_RUNTIME_SERVICE_ACCOUNT = (
    "benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com"
)
BENCHMARK_CALLER_SERVICE_ACCOUNT = (
    "benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com"
)
BENCHMARK_DEPLOYER_SERVICE_ACCOUNT = (
    "benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com"
)
REVIEWED_STAGING_OWNER = "user:billyrovzar@gmail.com"
GITHUB_REPOSITORY = "brovzar-lab/Lemon-Screenplay-Dashboard"
GITHUB_REF = "refs/heads/main"
GITHUB_ENVIRONMENT = "staging"
WORKLOAD_IDENTITY_PROVIDER = (
    "projects/549848020392/locations/global/workloadIdentityPools/"
    "github-staging/providers/github-lemon-screenplay"
)
WORKLOAD_IDENTITY_POOL = (
    "projects/549848020392/locations/global/workloadIdentityPools/github-staging"
)
REVIEWED_STAGING_STORAGE_BUCKETS = [
    "gcf-v2-sources-549848020392-us-central1",
    "gcf-v2-uploads-549848020392.us-central1.cloudfunctions.appspot.com",
]
STAGING_IDENTITY_READER_PERMISSIONS = sorted([
    "iam.googleapis.com/workloadIdentityPoolProviders.get",
    "iam.googleapis.com/workloadIdentityPoolProviders.list",
    "iam.googleapis.com/workloadIdentityPools.get",
    "iam.googleapis.com/workloadIdentityPools.getIamPolicy",
    "iam.roles.get",
    "iam.serviceAccountKeys.list",
    "iam.serviceAccounts.getIamPolicy",
])
STAGING_PROJECT_IAM_CONTRACT_SHA256 = (
    "4d78b1b4ef99867909086a53404d74b9865674d42293762ee1d031c9fee4b9d6"
)
PRODUCTION_PROJECT_IAM_CONTRACT_SHA256 = (
    "602667fc1abd0b1c856651567ed61db3ef734cf98bd56244ee61d495cc1c655c"
)
STAGING_STORAGE_IAM_CONTRACT_SHA256 = (
    "ea071573a1902171c584d61f763d39e102c15924988f1dcb7b91c9bdcb15febd"
)
PRODUCTION_STORAGE_IAM_CONTRACT_SHA256 = (
    "894b67961e61070f2de0f83fe926ef200833b90e5bde4560f5e9fbbe89071e38"
)
PRODUCTION_STORAGE_ACL_CONTRACT_SHA256 = (
    "30c87be7dcd1033b1fc3374333858b4b4fc94c76eb130d1e035fecb7a9863945"
)
STAGING_IDENTITY_READER_CONTRACT_SHA256 = (
    "dd292adfda22688f3b0ac70d31744b3a96a22237bd6a035545bd9a21305385f5"
)
PRODUCTION_PROJECT_ID = "lemon-screenplay-dashboard"
PRODUCTION_AUDITOR_SERVICE_ACCOUNT = (
    f"v9-production-auditor@{PRODUCTION_PROJECT_ID}.iam.gserviceaccount.com"
)
PRODUCTION_AUDITOR_ROLE = (
    f"projects/{PRODUCTION_PROJECT_ID}/roles/v9ProductionMetadataAuditor"
)
PRODUCTION_AUDITOR_PERMISSIONS = sorted([
    "datastore.backupSchedules.list",
    "datastore.backups.list",
    "datastore.databases.list",
    "datastore.locations.get",
    "datastore.locations.list",
    "iam.roles.get",
    "iam.serviceAccounts.getIamPolicy",
    "iam.serviceAccounts.list",
    "resourcemanager.projects.get",
    "resourcemanager.projects.getIamPolicy",
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
    "storage.objects.getIamPolicy",
    "storage.objects.list",
])
AUDIT_CEILING_MICROUSD = 40_000_000
SETTLED_PRIOR_PILOT_MICROUSD = 106_425
SETTLED_PRIOR_PILOT_CALL_COUNT = 2
LOCAL_REQUEST_ENVELOPE_OVERHEAD_BYTES = 16_384
DEPLOYMENT_PROOF_MAX_AGE_SECONDS = 6 * 60 * 60
DEPLOYMENT_PROOF_MAX_FUTURE_SKEW_SECONDS = 5 * 60


class BenchmarkSafetyError(ValueError):
    pass


def _sanitize_failure_text(value: Any) -> str:
    text = " ".join(str(value).replace("\x00", " ").split())[:1_000]
    text = re.sub(r"(?i)bearer\s+\S+", "Bearer [REDACTED]", text)
    text = re.sub(r"sk-ant-[A-Za-z0-9_-]+", "[REDACTED]", text)
    return text


def _sanitize_failure_value(value: Any) -> Any:
    if isinstance(value, str):
        return _sanitize_failure_text(value)
    if isinstance(value, list):
        return [_sanitize_failure_value(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): _sanitize_failure_value(item)
            for key, item in value.items()
            if str(key).lower() not in {
                "authorization",
                "api_key",
                "token",
                "credential",
                "secret",
            }
        }
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return _sanitize_failure_text(value)


def _usage_call_ids(usage: Any) -> set[str]:
    if not isinstance(usage, dict):
        return set()
    return {
        call["call_id"]
        for collection in ("calls", "failed_calls")
        for call in usage.get(collection, [])
        if isinstance(call, dict)
        and isinstance(call.get("call_id"), str)
        and call["call_id"]
    }


def _usage_from_call_records(
    records: Sequence[tuple[Dict[str, Any], str]],
    prior_usage: Any = None,
) -> Dict[str, Any]:
    """Rebuild aggregate usage from exact checkpointed call records."""
    from execution.ingest_v9 import empty_usage, merge_usage

    per_call: List[Dict[str, Any]] = []
    for call, collection in records:
        call_usage = call.get("usage")
        call_usage = call_usage if isinstance(call_usage, dict) else {}
        usage = empty_usage()
        for field in (
            "input_tokens",
            "output_tokens",
            "cache_creation_input_tokens",
            "cache_read_input_tokens",
            "call_count",
            "actual_cost_microusd",
            "estimated_cost_nanousd",
            "rounding_variance_nanousd",
        ):
            value = call_usage.get(field)
            if type(value) is int and value >= 0:
                usage[field] = value
        usage[collection] = [copy.deepcopy(call)]
        model = call.get("returned_model") or call.get("requested_model")
        if isinstance(model, str) and model:
            usage["by_model"][model] = {
                field: usage[field]
                for field in (
                    "input_tokens",
                    "output_tokens",
                    "cache_creation_input_tokens",
                    "cache_read_input_tokens",
                    "call_count",
                    "actual_cost_microusd",
                )
            }
        if call.get("stop_reason") == "max_tokens":
            usage["finish_reason"] = "max_tokens"
        per_call.append(usage)

    rebuilt = merge_usage(*per_call)
    if isinstance(prior_usage, dict):
        for field in (
            "input_tokens",
            "output_tokens",
            "cache_creation_input_tokens",
            "cache_read_input_tokens",
            "call_count",
            "actual_cost_microusd",
            "estimated_cost_nanousd",
            "rounding_variance_nanousd",
        ):
            value = prior_usage.get(field)
            if type(value) is int and value >= 0:
                rebuilt[field] = max(rebuilt[field], value)
    rebuilt["actual_cost_usd"] = rebuilt["actual_cost_microusd"] / 1_000_000
    rebuilt["estimated_cost_usd"] = (
        rebuilt["estimated_cost_nanousd"] / 1_000_000_000
    )
    rebuilt["rounding_variance_usd"] = (
        rebuilt["rounding_variance_nanousd"] / 1_000_000_000
    )
    return rebuilt


def _reconciled_failure_usage(run: Mapping[str, Any], usage: Any) -> Dict[str, Any] | None:
    journal = run.get("checkpointed_calls")
    if not isinstance(journal, list) or not journal:
        return copy.deepcopy(usage) if isinstance(usage, dict) else None
    journal_calls = [call for call in journal if isinstance(call, dict)]
    journal_ids = {
        call["call_id"]
        for call in journal_calls
        if isinstance(call.get("call_id"), str) and call["call_id"]
    }
    if isinstance(usage, dict) and journal_ids.issubset(_usage_call_ids(usage)):
        return copy.deepcopy(usage)

    records: Dict[str, tuple[Dict[str, Any], str]] = {}
    unkeyed: List[tuple[Dict[str, Any], str]] = []
    if isinstance(usage, dict):
        for collection in ("calls", "failed_calls"):
            for call in usage.get(collection, []):
                if not isinstance(call, dict):
                    continue
                call_id = call.get("call_id")
                if isinstance(call_id, str) and call_id:
                    records[call_id] = (call, collection)
                else:
                    unkeyed.append((call, collection))
    failed_states = {
        "provider_rejected_before_generation",
        "candidate_provider_configuration_unavailable",
        "model_provenance_mismatch",
        "candidate_release_mismatch",
        "missing_stop_reason",
        "benchmark_spend_uncertain",
    }
    for call in journal_calls:
        call_id = call.get("call_id")
        collection = (
            records.get(call_id, ({}, "calls"))[1]
            if isinstance(call_id, str) and call_id
            else "failed_calls" if call.get("failure_state") in failed_states else "calls"
        )
        if call.get("failure_state") in failed_states:
            collection = "failed_calls"
        if isinstance(call_id, str) and call_id:
            records[call_id] = (call, collection)
        else:
            unkeyed.append((call, collection))
    return _usage_from_call_records([*records.values(), *unkeyed], usage)


def _record_run_failure(run: Dict[str, Any], error: BaseException) -> None:
    error_type = type(error).__name__
    run["status"] = "failed"
    run["error"] = error_type
    failure: Dict[str, Any] = {
        "type": error_type,
        "message": _sanitize_failure_text(error),
    }
    review_kind = getattr(error, "review_kind", None)
    review_evidence = getattr(error, "review_evidence", None)
    if isinstance(review_kind, str) and review_kind:
        failure["review_kind"] = review_kind
    if isinstance(review_evidence, dict):
        failure["review_evidence"] = _sanitize_failure_value(review_evidence)
    run["failure"] = failure

    usage = _reconciled_failure_usage(run, getattr(error, "usage", None))
    if usage is None:
        return
    run["usage"] = usage
    calls = usage.get("calls", [])
    failed_calls = usage.get("failed_calls", [])
    run["provenance"] = {
        "calls": calls if isinstance(calls, list) else [],
        "failed_calls": failed_calls if isinstance(failed_calls, list) else [],
        "response_ids": [
            call["response_id"]
            for call in calls
            if isinstance(call, dict)
            and isinstance(call.get("response_id"), str)
        ] if isinstance(calls, list) else [],
    }


def _is_lower_hex(value: Any, length: int) -> bool:
    return (
        isinstance(value, str)
        and len(value) == length
        and all(char in "0123456789abcdef" for char in value)
    )


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_json(value: Any) -> str:
    return _sha256_bytes(_canonical_json(value).encode("utf-8"))


def _engine_output_sha256(value: Any) -> str:
    def normalize(item: Any) -> Any:
        if isinstance(item, float) and item.is_integer():
            return int(item)
        if isinstance(item, list):
            return [normalize(child) for child in item]
        if isinstance(item, dict):
            return {key: normalize(child) for key, child in item.items()}
        return item

    return _sha256_json(normalize(value))


def _runtime_pricing_sha256() -> str:
    return _sha256_json(json.loads(PRICING_PATH.read_text(encoding="utf-8")))


def _catalog_sha256() -> str:
    return _sha256_bytes(CATALOG_PATH.read_bytes())


def _approved_benchmark_model_list(catalog: Mapping[str, Any]) -> List[str]:
    return [
        catalog["analysisRoutes"]["haiku"]["modelId"],
        catalog["analysisRoutes"]["sonnet"]["modelId"],
        catalog["candidateAnalysisRoutes"]["sonnet"]["modelId"],
        catalog["analysisRoutes"]["opus"]["modelId"],
        catalog["candidateAnalysisRoutes"]["opus"]["modelId"],
    ]


def _approved_benchmark_models(catalog: Mapping[str, Any]) -> set[str]:
    return set(_approved_benchmark_model_list(catalog))


def _deployment_config_sha256(
    catalog: Mapping[str, Any],
    run_id: str,
    cap_microusd: int,
    prior_audit_spend_microusd: int,
    inference_geo: str,
) -> str:
    return _sha256_json({
        "region": STAGING_REGION,
        "timeoutSeconds": 3600,
        "memory": "512MiB",
        "cpu": "0.3333",
        "maxInstances": 5,
        "minInstances": 0,
        "concurrency": 1,
        "invoker": "private",
        "ingress": "all",
        "runtimeUpdatePolicy": "automatic",
        "buildEnvironment": "empty",
        "buildWorkerPool": "none",
        "dockerRepository": "regional-staging-gcf-artifacts",
        "vpcConnector": "none",
        "directVpc": "none",
        "binaryAuthorization": "none",
        "kmsKey": "none",
        "databaseId": "model-benchmarks",
        "models": _approved_benchmark_model_list(catalog),
        "auditId": "v9-trust-remediation-20260827",
        "auditLimitMicrousd": AUDIT_CEILING_MICROUSD,
        "runId": run_id,
        "capMicrousd": cap_microusd,
        "priorAuditSpendMicrousd": prior_audit_spend_microusd,
        "runtimeServiceAccount": BENCHMARK_RUNTIME_SERVICE_ACCOUNT,
        "runtimeProjectId": STAGING_PROJECT_ID,
        "stagingFirestoreProjectId": STAGING_PROJECT_ID,
        "productionFirestoreProjectId": "lemon-screenplay-dashboard",
        "productionStorageBucket": (
            "lemon-screenplay-dashboard.firebasestorage.app"
        ),
        "inferenceGeo": inference_geo,
    })


def _verify_local_source(expected_git_sha: str) -> Dict[str, Any]:
    head = subprocess.run(
        ["git", "-C", str(ROOT), "rev-parse", "HEAD"],
        check=False,
        capture_output=True,
        text=True,
    )
    status = subprocess.run(
        [
            "git",
            "-C",
            str(ROOT),
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    git_sha = head.stdout.strip()
    clean = status.returncode == 0 and not status.stdout.strip()
    if head.returncode != 0 or git_sha != expected_git_sha or not clean:
        raise BenchmarkSafetyError(
            "Paid benchmark requires the local V9 engine to be the exact clean merged commit."
        )
    return {
        "git_sha": git_sha,
        "clean": True,
        "checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def _empty_usage() -> Dict[str, Any]:
    return {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
        "call_count": 0,
        "actual_cost_microusd": 0,
        "actual_cost_usd": 0.0,
        "estimated_cost_nanousd": 0,
        "estimated_cost_usd": 0.0,
        "rounding_variance_nanousd": 0,
        "rounding_variance_usd": 0.0,
        "estimated_cost_nanousd": 0,
        "estimated_cost_usd": 0.0,
        "rounding_variance_nanousd": 0,
        "rounding_variance_usd": 0.0,
        "independent_cost_status": "complete",
        "budget_checks": [],
        "by_model": {},
        "calls": [],
        "failed_calls": [],
    }


def _validated_inputs(paths: Sequence[str], approved_hashes: Iterable[str]) -> List[Dict[str, Any]]:
    approvals = {value.lower() for value in approved_hashes}
    if not paths:
        raise BenchmarkSafetyError("At least one explicit local PDF input is required.")
    records: List[Dict[str, Any]] = []
    for raw_path in paths:
        path = Path(raw_path).expanduser().resolve()
        if not path.is_file() or path.suffix.lower() != ".pdf":
            raise BenchmarkSafetyError(f"Approved input must be a local PDF file: {path}")
        content_sha256 = _sha256_bytes(path.read_bytes())
        if content_sha256 not in approvals:
            raise BenchmarkSafetyError(
                f"Input was not explicitly approved by SHA-256: {path.name} ({content_sha256})"
            )
        records.append({
            "path": str(path),
            "filename": path.name,
            "content_sha256": content_sha256,
            "size_bytes": path.stat().st_size,
        })
    return records


def _route_configs(
    catalog: Mapping[str, Any],
    route: str,
    generation: str = "both",
) -> List[Dict[str, Any]]:
    active = catalog["analysisRoutes"]
    candidate = catalog["candidateAnalysisRoutes"]
    routes = [route] if route != "all" else ["sonnet", "opus", "hybrid"]
    result: List[Dict[str, Any]] = []
    for route_name in routes:
        if route_name == "hybrid":
            result.extend([
                {
                    "route": route_name,
                    "generation": "old",
                    "sonnet_model_id": active["sonnet"]["modelId"],
                    "opus_model_id": active["opus"]["modelId"],
                    "promotion_verdicts": catalog["activeHybridRoute"]["promotionVerdicts"],
                },
                {
                    "route": route_name,
                    "generation": "candidate",
                    "sonnet_model_id": candidate["sonnet"]["modelId"],
                    "opus_model_id": candidate["opus"]["modelId"],
                    "promotion_verdicts": candidate["hybrid"]["promotionVerdicts"],
                },
            ])
        else:
            result.extend([
                {
                    "route": route_name,
                    "generation": "old",
                    "model_id": active[route_name]["modelId"],
                    "sonnet_model_id": active["sonnet"]["modelId"],
                },
                {
                    "route": route_name,
                    "generation": "candidate",
                    "model_id": candidate[route_name]["modelId"],
                    "sonnet_model_id": candidate["sonnet"]["modelId"],
                },
            ])
    if generation == "both":
        return result
    return [item for item in result if item["generation"] == generation]


def _smoke_route_configs(catalog: Mapping[str, Any]) -> List[Dict[str, Any]]:
    return [
        {
            "route": "sonnet",
            "generation": "candidate",
            "model_id": catalog["analysisRoutes"]["haiku"]["modelId"],
            "pipeline_stage": "smoke",
            "reader_name": None,
        },
        {
            "route": "sonnet",
            "generation": "candidate",
            "model_id": catalog["candidateAnalysisRoutes"]["sonnet"]["modelId"],
            "pipeline_stage": "smoke",
            "reader_name": None,
        },
        {
            "route": "opus",
            "generation": "candidate",
            "model_id": catalog["candidateAnalysisRoutes"]["opus"]["modelId"],
            "pipeline_stage": "smoke",
            "reader_name": None,
        },
    ]


def _validate_candidate_proxy(proxy_url: str) -> bool:
    parsed = urlparse(proxy_url)
    hostname = parsed.hostname or ""
    candidate_name = "llmproxycandidate"
    if candidate_name not in parsed.path.lower() and candidate_name not in hostname.lower():
        raise BenchmarkSafetyError("Paid execution accepts only the dedicated llmProxyCandidate URL.")
    if hostname in LOCAL_PROXY_HOSTS:
        raise BenchmarkSafetyError(
            "Paid execution cannot use a local candidate proxy."
        )
    if parsed.scheme != "https":
        raise BenchmarkSafetyError("Online candidate execution requires HTTPS.")
    if not (
        hostname.endswith(".cloudfunctions.net")
        or hostname.endswith(".run.app")
    ):
        raise BenchmarkSafetyError("Online candidate URL must be a Google Functions or Cloud Run URL.")
    return True


def _gcloud_json(arguments: Sequence[str], description: str) -> Dict[str, Any]:
    result = subprocess.run(
        ["gcloud", *arguments, "--format=json"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise BenchmarkSafetyError(
            f"Could not read the {description} from Google Cloud."
        )
    try:
        value = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise BenchmarkSafetyError(
            f"Google Cloud returned invalid {description} JSON."
        ) from error
    if not isinstance(value, dict):
        raise BenchmarkSafetyError(f"Google Cloud returned invalid {description}.")
    return value


def _resolve_candidate_deployment(
    proxy_url: str,
    expected_git_sha: str,
    expected_catalog_sha256: str,
    approved_receipt: Mapping[str, Any] | None = None,
) -> Dict[str, Any]:
    """Bind paid execution to the platform resource, not endpoint self-reporting."""
    function = _gcloud_json([
        "functions", "describe", CANDIDATE_FUNCTION_NAME,
        f"--project={STAGING_PROJECT_ID}",
        "--gen2",
        f"--region={STAGING_REGION}",
    ], "candidate function resource")
    expected_name = (
        f"projects/{STAGING_PROJECT_ID}/locations/{STAGING_REGION}/functions/"
        f"{CANDIDATE_FUNCTION_NAME}"
    )
    service = function.get("serviceConfig")
    build = function.get("buildConfig")
    if (
        function.get("name") != expected_name
        or function.get("state") != "ACTIVE"
        or not isinstance(service, dict)
        or not isinstance(build, dict)
    ):
        raise BenchmarkSafetyError("Candidate function resource is not the exact active staging function.")
    if service.get("uri") != proxy_url:
        raise BenchmarkSafetyError("--proxy-url does not equal the deployed staging function URI.")
    expected_build_service_account = (
        f"projects/{STAGING_PROJECT_ID}/serviceAccounts/"
        f"{approved_receipt.get('staging_project_number') if approved_receipt else ''}"
        "-compute@developer.gserviceaccount.com"
    )
    expected_docker_repository = (
        f"projects/{STAGING_PROJECT_ID}/locations/{STAGING_REGION}/"
        "repositories/gcf-artifacts"
    )
    if (
        service.get("serviceAccountEmail") != BENCHMARK_RUNTIME_SERVICE_ACCOUNT
        or service.get("availableMemory") not in {"512M", "512Mi", "512MiB"}
        or service.get("availableCpu") != "0.3333"
        or service.get("timeoutSeconds") != 3600
        or service.get("maxInstanceCount") != 5
        or service.get("minInstanceCount") not in {None, 0}
        or service.get("maxInstanceRequestConcurrency") != 1
        or service.get("allTrafficOnLatestRevision") is not True
        or service.get("ingressSettings") != "ALLOW_ALL"
        or service.get("vpcConnector")
        or service.get("vpcConnectorEgressSettings")
        not in {None, "PRIVATE_RANGES_ONLY"}
        or service.get("directVpcNetworkInterface") not in (None, [])
        or service.get("directVpcEgress") not in {None, "PRIVATE_RANGES_ONLY"}
        or service.get("binaryAuthorizationPolicy")
        or service.get("secretVolumes") not in (None, [])
        or function.get("kmsKeyName")
        or build.get("runtime") != "nodejs22"
        or build.get("entryPoint") != CANDIDATE_FUNCTION_NAME
        or bool(build.get("environmentVariables"))
        or build.get("workerPool")
        or build.get("dockerRepository") != expected_docker_repository
        or build.get("dockerRegistry") not in {None, "ARTIFACT_REGISTRY"}
        or approved_receipt is not None
        and build.get("serviceAccount") != expected_build_service_account
        or not isinstance(build.get("automaticUpdatePolicy"), dict)
        or build.get("onDeployUpdatePolicy") is not None
    ):
        raise BenchmarkSafetyError("Candidate platform runtime does not match the reviewed contract.")
    environment = service.get("environmentVariables")
    inference_geo = environment.get("BENCHMARK_INFERENCE_GEO") if isinstance(
        environment, dict
    ) else None
    if inference_geo not in {"global", "us"}:
        raise BenchmarkSafetyError(
            "Candidate platform environment lacks a reviewed inference geography."
        )
    if not isinstance(environment, dict) or any(
        environment.get(field) != value
        for field, value in {
            "BENCHMARK_GIT_SHA": expected_git_sha,
            "BENCHMARK_SOURCE_CLEAN": "true",
            "BENCHMARK_CATALOG_SHA256": expected_catalog_sha256,
            "BENCHMARK_STAGING_FIRESTORE_PROJECT_ID": STAGING_PROJECT_ID,
            "BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID": "lemon-screenplay-dashboard",
            "BENCHMARK_STORAGE_BUCKET": (
                "lemon-screenplay-dashboard.firebasestorage.app"
            ),
        }.items()
    ):
        raise BenchmarkSafetyError("Candidate platform environment does not match the approved source.")
    if approved_receipt is not None:
        benchmark_keys = sorted(
            key for key in environment if key.startswith("BENCHMARK_")
        )
        expected_benchmark_keys = sorted([
            "BENCHMARK_RUN_ID",
            "BENCHMARK_CAP_USD",
            "BENCHMARK_PRIOR_AUDIT_SPEND_USD",
            "BENCHMARK_INFERENCE_GEO",
            "BENCHMARK_GIT_SHA",
            "BENCHMARK_SOURCE_CLEAN",
            "BENCHMARK_CATALOG_SHA256",
            "BENCHMARK_BUILD_TIMESTAMP",
            "BENCHMARK_RUNTIME_SERVICE_ACCOUNT",
            "BENCHMARK_STAGING_FIRESTORE_PROJECT_ID",
            "BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID",
            "BENCHMARK_STORAGE_BUCKET",
        ])
        benchmark_environment = {
            key: environment[key] for key in expected_benchmark_keys
            if key in environment
        }
        environment_without_platform_logging = dict(environment)
        platform_logging = environment_without_platform_logging.pop(
            "LOG_EXECUTION_ID", None
        )
        try:
            firebase_config = json.loads(environment.get("FIREBASE_CONFIG", ""))
            cap_microusd = Decimal(environment["BENCHMARK_CAP_USD"]) * 1_000_000
            prior_microusd = (
                Decimal(environment["BENCHMARK_PRIOR_AUDIT_SPEND_USD"])
                * 1_000_000
            )
            environment_build_time = datetime.fromisoformat(
                environment["BENCHMARK_BUILD_TIMESTAMP"].replace("Z", "+00:00")
            )
            receipt_build_time = datetime.fromisoformat(
                str(approved_receipt.get("build_timestamp", "")).replace(
                    "Z", "+00:00"
                )
            )
        except (KeyError, ValueError, json.JSONDecodeError, ArithmeticError) as error:
            raise BenchmarkSafetyError(
                "Candidate platform environment is invalid."
            ) from error
        if (
            benchmark_keys != expected_benchmark_keys
            or platform_logging not in {None, "true"}
            or set(environment_without_platform_logging)
            != set(expected_benchmark_keys) | {"FIREBASE_CONFIG"}
            or _sha256_json(environment)
            != approved_receipt.get("runtime_environment_sha256")
            or firebase_config != {"projectId": STAGING_PROJECT_ID}
            or cap_microusd != cap_microusd.to_integral_value()
            or int(cap_microusd) != approved_receipt.get("cap_microusd")
            or prior_microusd != prior_microusd.to_integral_value()
            or int(prior_microusd)
            != approved_receipt.get("prior_audit_spend_microusd")
            or environment.get("BENCHMARK_RUN_ID")
            != approved_receipt.get("run_id")
            or environment_build_time != receipt_build_time
            or environment.get("BENCHMARK_RUNTIME_SERVICE_ACCOUNT")
            != BENCHMARK_RUNTIME_SERVICE_ACCOUNT
        ):
            raise BenchmarkSafetyError(
                "Candidate platform environment drifted from the deployment receipt."
            )
    revision_name = str(service.get("revision") or "").rsplit("/", 1)[-1]
    if re.fullmatch(r"llmproxycandidate-[0-9]{5}-[a-z0-9]{3}", revision_name) is None:
        raise BenchmarkSafetyError("Candidate platform revision is invalid.")
    revision = _gcloud_json([
        "run", "revisions", "describe", revision_name,
        f"--project={STAGING_PROJECT_ID}",
        f"--region={STAGING_REGION}",
    ], "candidate Cloud Run revision")
    actual_revision_name = str(
        revision.get("name")
        or (revision.get("metadata") or {}).get("name")
        or ""
    ).rsplit("/", 1)[-1]
    revision_spec = revision.get("spec") if isinstance(revision.get("spec"), dict) else {}
    revision_service_account = (
        revision.get("serviceAccount")
        or revision_spec.get("serviceAccountName")
    )
    revision_concurrency = (
        revision.get("maxInstanceRequestConcurrency")
        if revision.get("maxInstanceRequestConcurrency") is not None
        else revision_spec.get("containerConcurrency")
    )
    containers = revision.get("containers")
    if not isinstance(containers, list):
        containers = revision_spec.get("containers")
    container = containers[0] if isinstance(containers, list) and containers else {}
    image = container.get("image") if isinstance(container, dict) else None
    digest_source = (
        (revision.get("status") or {}).get("imageDigest")
        if isinstance(revision.get("status"), dict)
        else None
    ) or image
    digest_match = re.search(r"sha256:[a-f0-9]{64}", str(digest_source))
    expected_image_prefix = (
        f"{STAGING_REGION}-docker.pkg.dev/{STAGING_PROJECT_ID}/gcf-artifacts/"
    )
    if (
        actual_revision_name != revision_name
        or revision_service_account != BENCHMARK_RUNTIME_SERVICE_ACCOUNT
        or revision_concurrency != 1
        or not isinstance(image, str)
        or not image.startswith(expected_image_prefix)
        or digest_match is None
        or not image.endswith(f"@{digest_match.group(0)}")
    ):
        raise BenchmarkSafetyError("Candidate Cloud Run revision does not match the reviewed contract.")
    receipt = {
        "project_id": STAGING_PROJECT_ID,
        "region": STAGING_REGION,
        "function_name": CANDIDATE_FUNCTION_NAME,
        "function_uri": proxy_url,
        "cloud_run_service": service.get("service"),
        "cloud_run_revision": revision_name,
        "runtime_service_account": BENCHMARK_RUNTIME_SERVICE_ACCOUNT,
        "runtime": build.get("runtime"),
        "entry_point": build.get("entryPoint"),
        "runtime_update_policy": "automatic",
        "runtime_version": None,
        "build_service_account": build.get("serviceAccount"),
        "docker_repository": build.get("dockerRepository"),
        "available_memory": service.get("availableMemory"),
        "available_cpu": service.get("availableCpu"),
        "ingress_settings": service.get("ingressSettings"),
        "timeout_seconds": service.get("timeoutSeconds"),
        "max_instance_count": service.get("maxInstanceCount"),
        "concurrency": service.get("maxInstanceRequestConcurrency"),
        "build_resource": build.get("build"),
        "container_image": image,
        "container_image_digest": digest_match.group(0),
        "function_resource_sha256": _sha256_json(function),
        "revision_resource_sha256": _sha256_json(revision),
        "git_sha": expected_git_sha,
        "catalog_sha256": expected_catalog_sha256,
        "inference_geo": inference_geo,
    }
    receipt["receipt_sha256"] = _sha256_json(receipt)
    if approved_receipt is not None:
        secret_environment = service.get("secretEnvironmentVariables")
        approved_secrets = approved_receipt.get("secret_environment_variables")
        if (
            not isinstance(secret_environment, list)
            or len(secret_environment) != 1
            or not isinstance(approved_secrets, list)
            or len(approved_secrets) != 1
            or {
                "key": secret_environment[0].get("key"),
                "projectId": str(secret_environment[0].get("projectId")),
                "secret": secret_environment[0].get("secret"),
                "version": str(secret_environment[0].get("version")),
            } != approved_secrets[0]
            or not str(secret_environment[0].get("version", "")).isdigit()
        ):
            raise BenchmarkSafetyError(
                "Candidate provider secret binding drifted from the deployment receipt."
            )
        immutable_live_fields = {
            "project_id": STAGING_PROJECT_ID,
            "region": STAGING_REGION,
            "function_name": CANDIDATE_FUNCTION_NAME,
            "function_uri": proxy_url,
            "cloud_run_service": service.get("service"),
            "cloud_run_revision": revision_name,
            "runtime_service_account": BENCHMARK_RUNTIME_SERVICE_ACCOUNT,
            "runtime": build.get("runtime"),
            "entry_point": build.get("entryPoint"),
            "runtime_update_policy": "automatic",
            "runtime_version": None,
            "build_service_account": build.get("serviceAccount"),
            "docker_repository": build.get("dockerRepository"),
            "available_memory": service.get("availableMemory"),
            "available_cpu": service.get("availableCpu"),
            "ingress_settings": service.get("ingressSettings"),
            "timeout_seconds": service.get("timeoutSeconds"),
            "max_instance_count": service.get("maxInstanceCount"),
            "concurrency": service.get("maxInstanceRequestConcurrency"),
            "build_resource": build.get("build"),
            "container_image": image,
            "container_image_digest": digest_match.group(0),
            "function_resource_sha256": _sha256_json(function),
            "revision_resource_sha256": _sha256_json(revision),
            "git_sha": expected_git_sha,
            "catalog_sha256": expected_catalog_sha256,
            "pricing_sha256": _runtime_pricing_sha256(),
            "inference_geo": inference_geo,
        }
        if any(
            approved_receipt.get(key) != value
            for key, value in immutable_live_fields.items()
        ):
            raise BenchmarkSafetyError(
                "Candidate platform resource drifted from the deployment receipt."
            )
        secret_version = approved_secrets[0]["version"]
        secret_metadata = _gcloud_json([
            "secrets", "versions", "describe", secret_version,
            "--secret=BENCHMARK_ANTHROPIC_API_KEY",
            f"--project={STAGING_PROJECT_ID}",
        ], "candidate provider secret version")
        if (
            secret_metadata.get("state") != "ENABLED"
            or str(secret_metadata.get("name", "")).rsplit("/", 1)[-1]
            != secret_version
        ):
            raise BenchmarkSafetyError(
                "Candidate provider secret version is not the exact enabled version."
            )
        return dict(approved_receipt)
    return receipt


def _assert_private_candidate_iam_policy(policy: Mapping[str, Any]) -> None:
    bindings = policy.get("bindings")
    expected_member = f"serviceAccount:{BENCHMARK_CALLER_SERVICE_ACCOUNT}"
    if (
        not isinstance(bindings, list)
        or len(bindings) != 1
        or not isinstance(bindings[0], dict)
        or bindings[0].get("role") != "roles/run.invoker"
        or bindings[0].get("members") != [expected_member]
        or bindings[0].get("condition") is not None
    ):
        raise BenchmarkSafetyError(
            "Candidate Cloud Run resource policy is not the exact benchmark caller binding."
        )


def _production_auditor_contract(staging_project_number: str) -> Dict[str, Any]:
    return {
        "service_account": PRODUCTION_AUDITOR_SERVICE_ACCOUNT,
        "role": PRODUCTION_AUDITOR_ROLE,
        "workload_identity_principal": (
            f"principal://iam.googleapis.com/projects/{staging_project_number}/"
            "locations/global/workloadIdentityPools/github-staging/subject/"
            f"repo:{GITHUB_REPOSITORY}:environment:{GITHUB_ENVIRONMENT}"
        ),
        "permissions": PRODUCTION_AUDITOR_PERMISSIONS,
    }


def _valid_production_auditor_contract(proof: Mapping[str, Any]) -> bool:
    staging_project_number = str(proof.get("staging_project_number", ""))
    if re.fullmatch(r"[1-9][0-9]*", staging_project_number) is None:
        return False
    contract = _production_auditor_contract(staging_project_number)
    return (
        proof.get("production_auditor_service_account")
        == contract["service_account"]
        and proof.get("production_auditor_role") == contract["role"]
        and proof.get("production_auditor_wif_principal")
        == contract["workload_identity_principal"]
        and proof.get("production_auditor_permissions") == contract["permissions"]
        and proof.get("production_auditor_contract_sha256")
        == _sha256_json(contract)
        and _is_lower_hex(
            proof.get("production_auditor_role_definition_sha256"), 64
        )
    )


def _valid_production_service_account_inventory(proof: Mapping[str, Any]) -> bool:
    accounts = proof.get("production_service_accounts")
    project_number = str(proof.get("production_project_number", ""))
    if not isinstance(accounts, list) or not accounts:
        return False
    emails = [account.get("email") for account in accounts if isinstance(account, dict)]
    if len(emails) != len(accounts) or emails != sorted(set(emails)):
        return False
    auditor_accounts = [
        account for account in accounts
        if account.get("email") == PRODUCTION_AUDITOR_SERVICE_ACCOUNT
    ]
    if len(auditor_accounts) != 1 or auditor_accounts[0].get("binding_count") != 1:
        return False
    allowed_defaults = {
        "lemon-screenplay-dashboard@appspot.gserviceaccount.com",
        f"{project_number}-compute@developer.gserviceaccount.com",
    }
    if any(
        not isinstance(account.get("email"), str)
        or account["email"] not in allowed_defaults
        and re.fullmatch(
            r"[a-z][a-z0-9-]{4,28}[a-z0-9]@lemon-screenplay-dashboard\."
            r"iam\.gserviceaccount\.com",
            account["email"],
        ) is None
        or type(account.get("disabled")) is not bool
        or re.fullmatch(r"[1-9][0-9]*", str(account.get("unique_id", ""))) is None
        or not _is_lower_hex(account.get("resource_sha256"), 64)
        or not _is_lower_hex(account.get("policy_sha256"), 64)
        or type(account.get("binding_count")) is not int
        or account["binding_count"] < 0
        for account in accounts
    ):
        return False
    return (
        proof.get("production_service_account_count") == len(accounts)
        and proof.get("production_service_account_inventory_sha256")
        == _sha256_json(accounts)
    )


def _validate_live_isolation_proof(
    proof: Mapping[str, Any],
    approved_receipt: Mapping[str, Any],
    verified_at: str,
) -> Dict[str, Any]:
    approved = approved_receipt.get("production_isolation_proof")
    proof_body = {key: value for key, value in proof.items() if key != "proof_sha256"}
    inventory = proof.get("production_firestore_inventory")
    if (
        not isinstance(approved, dict)
        or not isinstance(inventory, dict)
        or proof.get("proof_sha256") != _sha256_json(proof_body)
        or proof.get("status") != "passed_complete_static_iam_inventory"
        or proof.get("scanner_version")
        != "standalone-project-iam-and-resource-inventory-v2"
        or proof.get("permission_contract_sha256")
        != approved.get("permission_contract_sha256")
        or proof.get("runtime_service_account")
        != BENCHMARK_RUNTIME_SERVICE_ACCOUNT
        or proof.get("staging_project_id") != STAGING_PROJECT_ID
        or proof.get("staging_project_number")
        != approved_receipt.get("staging_project_number")
        or proof.get("production_project_id") != "lemon-screenplay-dashboard"
        or proof.get("production_storage_bucket")
        != "lemon-screenplay-dashboard.firebasestorage.app"
        or proof.get("production_project_number")
        != approved.get("production_project_number")
        or proof.get("verified_at") != verified_at
        or proof.get("production_project_scope_state") != "STANDALONE_NO_PARENT"
        or proof.get("production_access_state")
        != "NO_STAGING_IDENTITY_ALLOW_BINDING"
        or not _is_lower_hex(proof.get("production_project_resource_sha256"), 64)
        or not _is_lower_hex(proof.get("production_project_iam_policy_sha256"), 64)
        or proof.get("production_project_iam_contract_sha256")
        != PRODUCTION_PROJECT_IAM_CONTRACT_SHA256
        or proof.get("production_project_iam_contract_sha256")
        != approved.get("production_project_iam_contract_sha256")
        or type(proof.get("production_project_binding_count")) is not int
        or proof["production_project_binding_count"] < 1
        or inventory
        != approved.get("production_firestore_inventory")
        or proof.get("production_firestore_inventory_sha256")
        != _sha256_json(inventory)
        or proof.get("production_firestore_database_count")
        != len(inventory.get("databases", []))
        or proof.get("production_firestore_backup_count")
        != len(inventory.get("backups", []))
        or proof.get("production_firestore_backup_schedule_count")
        != len(inventory.get("backup_schedules", []))
        or proof.get("production_firestore_inventory_sha256")
        != approved.get("production_firestore_inventory_sha256")
        or proof.get("staging_firestore_databases")
        != approved.get("staging_firestore_databases")
        or proof.get("staging_storage_buckets")
        != approved.get("staging_storage_buckets")
        or proof.get("staging_data_resource_inventory_sha256")
        != _sha256_json({
            "databases": proof.get("staging_firestore_databases"),
            "buckets": proof.get("staging_storage_buckets"),
        })
        or proof.get("staging_data_resource_inventory_sha256")
        != approved.get("staging_data_resource_inventory_sha256")
        or not _valid_production_service_account_inventory(proof)
        or not _valid_production_service_account_inventory(approved)
        or proof.get("production_service_accounts")
        != approved.get("production_service_accounts")
        or proof.get("production_service_account_inventory_sha256")
        != approved.get("production_service_account_inventory_sha256")
        or not _valid_production_auditor_contract(proof)
        or not _valid_production_auditor_contract(approved)
        or proof.get("production_auditor_role_definition_sha256")
        != approved.get("production_auditor_role_definition_sha256")
    ):
        raise BenchmarkSafetyError(
            "Live production-isolation proof does not match the approved contract."
        )
    return {
        "verified_at": verified_at,
        "proof_sha256": proof["proof_sha256"],
        "permission_contract_sha256": proof["permission_contract_sha256"],
        "production_project_iam_policy_sha256": proof[
            "production_project_iam_policy_sha256"
        ],
        "production_firestore_database_count": proof[
            "production_firestore_database_count"
        ],
        "production_firestore_backup_count": proof[
            "production_firestore_backup_count"
        ],
        "production_firestore_backup_schedule_count": proof[
            "production_firestore_backup_schedule_count"
        ],
        "production_service_account_count": proof[
            "production_service_account_count"
        ],
        "production_service_account_inventory_sha256": proof[
            "production_service_account_inventory_sha256"
        ],
        "production_auditor_contract_sha256": proof[
            "production_auditor_contract_sha256"
        ],
    }


def _validate_production_storage_acl_proof(
    proof: Mapping[str, Any],
    production_project_number: str,
    expected_verified_at: str | None = None,
) -> Dict[str, Any]:
    proof_body = {key: value for key, value in proof.items() if key != "proof_sha256"}
    if (
        proof.get("proof_sha256") != _sha256_json(proof_body)
        or proof.get("status") != "passed_no_runtime_access_acl"
        or proof.get("scanner_version")
        != "legacy-acl-full-object-version-inventory-v2"
        or proof.get("runtime_service_account")
        != BENCHMARK_RUNTIME_SERVICE_ACCOUNT
        or proof.get("production_storage_bucket")
        != "lemon-screenplay-dashboard.firebasestorage.app"
        or proof.get("production_project_number") != production_project_number
        or proof.get("bucket_access_mode") != "legacy_acl_full_inventory"
        or type(proof.get("object_version_count")) is not int
        or proof["object_version_count"] < 0
        or type(proof.get("soft_deleted_object_count")) is not int
        or proof["soft_deleted_object_count"] < 0
        or not _is_lower_hex(proof.get("bucket_metadata_sha256"), 64)
        or not _is_lower_hex(proof.get("bucket_iam_policy_sha256"), 64)
        or proof.get("bucket_iam_contract_sha256")
        != PRODUCTION_STORAGE_IAM_CONTRACT_SHA256
        or proof.get("acl_principal_contract_sha256")
        != PRODUCTION_STORAGE_ACL_CONTRACT_SHA256
        or not _is_lower_hex(proof.get("object_acl_inventory_sha256"), 64)
        or expected_verified_at is not None
        and proof.get("verified_at") != expected_verified_at
    ):
        raise BenchmarkSafetyError("Production Storage ACL proof is invalid.")
    try:
        verified_at = datetime.fromisoformat(
            str(proof.get("verified_at", "")).replace("Z", "+00:00")
        )
    except ValueError as error:
        raise BenchmarkSafetyError("Production Storage ACL proof timestamp is invalid.") from error
    if verified_at.tzinfo is None:
        raise BenchmarkSafetyError("Production Storage ACL proof timestamp is invalid.")
    return {
        "verified_at": proof["verified_at"],
        "proof_sha256": proof["proof_sha256"],
        "scanner_version": proof["scanner_version"],
        "object_version_count": proof["object_version_count"],
        "soft_deleted_object_count": proof["soft_deleted_object_count"],
        "object_acl_inventory_sha256": proof["object_acl_inventory_sha256"],
    }


def _reviewed_effective_invokers(project_number: str) -> List[str]:
    return sorted([
        f"serviceAccount:{BENCHMARK_CALLER_SERVICE_ACCOUNT}",
        f"serviceAccount:{BENCHMARK_DEPLOYER_SERVICE_ACCOUNT}",
        (
            "serviceAccount:firebase-adminsdk-fbsvc@"
            f"{STAGING_PROJECT_ID}.iam.gserviceaccount.com"
        ),
        f"serviceAccount:{project_number}-compute@developer.gserviceaccount.com",
        f"serviceAccount:{STAGING_PROJECT_ID}@appspot.gserviceaccount.com",
        (
            f"serviceAccount:service-{project_number}@gcp-sa-cloudbuild."
            "iam.gserviceaccount.com"
        ),
        (
            f"serviceAccount:service-{project_number}@gcf-admin-robot."
            "iam.gserviceaccount.com"
        ),
        (
            f"serviceAccount:service-{project_number}@gcp-sa-pubsub."
            "iam.gserviceaccount.com"
        ),
        (
            f"serviceAccount:service-{project_number}@serverless-robot-prod."
            "iam.gserviceaccount.com"
        ),
        REVIEWED_STAGING_OWNER,
    ])


def _reviewed_workload_identity(project_number: str) -> Dict[str, Any]:
    return {
        "workload_identity_provider": (
            f"projects/{project_number}/locations/global/workloadIdentityPools/"
            "github-staging/providers/github-lemon-screenplay"
        ),
        "workload_identity_pool": (
            f"projects/{project_number}/locations/global/workloadIdentityPools/"
            "github-staging"
        ),
        "workload_identity_subject": (
            f"principal://iam.googleapis.com/projects/{project_number}/locations/global/"
            "workloadIdentityPools/github-staging/subject/"
            f"repo:{GITHUB_REPOSITORY}:environment:{GITHUB_ENVIRONMENT}"
        ),
        "github_repository": GITHUB_REPOSITORY,
        "github_ref": GITHUB_REF,
        "github_environment": GITHUB_ENVIRONMENT,
        "github_ref_protected_required": True,
    }


def _validate_staging_identity_proof(
    proof: Mapping[str, Any],
    project_number: str,
    expected_verified_at: str | None = None,
    expected_staging_storage_buckets: Sequence[str] | None = None,
) -> Dict[str, Any]:
    invokers = _reviewed_effective_invokers(project_number)
    staging_storage_buckets = proof.get("staging_storage_buckets")
    privileged_emails = sorted([
        BENCHMARK_CALLER_SERVICE_ACCOUNT,
        BENCHMARK_RUNTIME_SERVICE_ACCOUNT,
        BENCHMARK_DEPLOYER_SERVICE_ACCOUNT,
        (
            "firebase-adminsdk-fbsvc@"
            f"{STAGING_PROJECT_ID}.iam.gserviceaccount.com"
        ),
        f"{project_number}-compute@developer.gserviceaccount.com",
        f"{STAGING_PROJECT_ID}@appspot.gserviceaccount.com",
    ])
    provider_managed_agents = sorted([
        f"service-{project_number}@gcp-sa-cloudbuild.iam.gserviceaccount.com",
        f"service-{project_number}@gcf-admin-robot.iam.gserviceaccount.com",
        f"service-{project_number}@gcp-sa-pubsub.iam.gserviceaccount.com",
        f"service-{project_number}@serverless-robot-prod.iam.gserviceaccount.com",
    ])
    contract = {
        "project_id": STAGING_PROJECT_ID,
        "project_number": project_number,
        "runtime_service_account": BENCHMARK_RUNTIME_SERVICE_ACCOUNT,
        "caller_service_account": BENCHMARK_CALLER_SERVICE_ACCOUNT,
        "deployer_service_account": BENCHMARK_DEPLOYER_SERVICE_ACCOUNT,
        "reviewed_effective_invokers": invokers,
        "staging_storage_buckets": staging_storage_buckets,
        **_reviewed_workload_identity(project_number),
        "staging_project_iam_contract_sha256": STAGING_PROJECT_IAM_CONTRACT_SHA256,
        "staging_storage_iam_contract_sha256": STAGING_STORAGE_IAM_CONTRACT_SHA256,
        "staging_metadata_reader_contract_sha256": (
            STAGING_IDENTITY_READER_CONTRACT_SHA256
        ),
        "privileged_service_accounts": privileged_emails,
        "provider_managed_invoker_service_agents": provider_managed_agents,
    }
    body = {key: value for key, value in proof.items() if key != "proof_sha256"}
    privileged_inventory = proof.get("privileged_service_account_inventory")
    fingerprint_fields = (
        "project_resource_sha256",
        "project_iam_policy_sha256",
        "direct_run_policy_sha256",
        "secret_policy_sha256",
        "privileged_service_account_inventory_sha256",
        "workload_identity_provider_sha256",
        "workload_identity_provider_inventory_sha256",
        "workload_identity_pool_sha256",
        "workload_identity_pool_policy_sha256",
        "role_definitions_sha256",
        "staging_metadata_reader_role_definition_sha256",
        "staging_storage_resources_sha256",
    )
    if (
        proof.get("proof_sha256") != _sha256_json(body)
        or proof.get("status") != "passed_reviewed_staging_identity_contract"
        or proof.get("scanner_version")
        != "staging-identity-and-effective-invokers-v2"
        or proof.get("identity_contract_sha256") != _sha256_json(contract)
        or proof.get("project_id") != STAGING_PROJECT_ID
        or proof.get("project_number") != project_number
        or proof.get("runtime_service_account")
        != BENCHMARK_RUNTIME_SERVICE_ACCOUNT
        or proof.get("caller_service_account")
        != BENCHMARK_CALLER_SERVICE_ACCOUNT
        or proof.get("deployer_service_account")
        != BENCHMARK_DEPLOYER_SERVICE_ACCOUNT
        or proof.get("workload_identity_provider")
        != WORKLOAD_IDENTITY_PROVIDER
        or proof.get("workload_identity_pool") != WORKLOAD_IDENTITY_POOL
        or proof.get("reviewed_effective_invokers") != invokers
        or not isinstance(staging_storage_buckets, list)
        or staging_storage_buckets != REVIEWED_STAGING_STORAGE_BUCKETS
        or any(
            not isinstance(bucket, str)
            or re.fullmatch(r"[a-z0-9][a-z0-9._-]+", bucket) is None
            for bucket in staging_storage_buckets
        )
        or expected_staging_storage_buckets is not None
        and staging_storage_buckets != list(expected_staging_storage_buckets)
        or not isinstance(privileged_inventory, list)
        or [item.get("email") for item in privileged_inventory]
        != privileged_emails
        or any(
            not isinstance(item, dict)
            or not _is_lower_hex(item.get("policy_sha256"), 64)
            or not _is_lower_hex(item.get("key_inventory_sha256"), 64)
            or type(item.get("system_managed_key_count")) is not int
            or item["system_managed_key_count"] < 0
            for item in privileged_inventory
        )
        or proof.get("privileged_service_account_inventory_sha256")
        != _sha256_json(privileged_inventory)
        or any(not _is_lower_hex(proof.get(field), 64) for field in fingerprint_fields)
        or expected_verified_at is not None
        and proof.get("verified_at") != expected_verified_at
    ):
        raise BenchmarkSafetyError("Candidate staging identity proof is invalid.")
    try:
        verified_at = datetime.fromisoformat(
            str(proof.get("verified_at", "")).replace("Z", "+00:00")
        )
    except ValueError as error:
        raise BenchmarkSafetyError(
            "Candidate staging identity proof timestamp is invalid."
        ) from error
    if verified_at.tzinfo is None:
        raise BenchmarkSafetyError(
            "Candidate staging identity proof timestamp is invalid."
        )
    return {
        "verified_at": proof["verified_at"],
        "proof_sha256": proof["proof_sha256"],
        "identity_contract_sha256": proof["identity_contract_sha256"],
        "effective_invoker_count": len(invokers),
    }


def _validate_deployment_receipt_freshness(
    receipt: Mapping[str, Any],
    now: datetime | None = None,
) -> Dict[str, Any]:
    checked_at = now or datetime.now(timezone.utc)
    if checked_at.tzinfo is None:
        raise BenchmarkSafetyError("Deployment receipt freshness clock is invalid.")
    timestamps = {
        "build": receipt.get("build_timestamp"),
        "production_isolation": (
            receipt.get("production_isolation_proof") or {}
        ).get("verified_at"),
        "production_storage_acl": (
            receipt.get("production_storage_acl_proof") or {}
        ).get("verified_at"),
        "staging_identity": (
            receipt.get("staging_identity_proof") or {}
        ).get("verified_at"),
    }
    ages: Dict[str, int] = {}
    for label, value in timestamps.items():
        try:
            parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
        except ValueError as error:
            raise BenchmarkSafetyError(
                "Deployment receipt proof timestamp is invalid."
            ) from error
        if parsed.tzinfo is None:
            raise BenchmarkSafetyError("Deployment receipt proof timestamp is invalid.")
        age_seconds = int((checked_at - parsed).total_seconds())
        if (
            age_seconds > DEPLOYMENT_PROOF_MAX_AGE_SECONDS
            or age_seconds < -DEPLOYMENT_PROOF_MAX_FUTURE_SKEW_SECONDS
        ):
            raise BenchmarkSafetyError(
                "Deployment receipt proofs are stale or future-dated."
            )
        ages[label] = age_seconds
    return {
        "maximum_age_seconds": DEPLOYMENT_PROOF_MAX_AGE_SECONDS,
        "proof_ages_seconds": ages,
    }


def _verify_live_candidate_safety(
    proxy_url: str,
    approved_receipt: Mapping[str, Any],
) -> Dict[str, Any]:
    freshness = _validate_deployment_receipt_freshness(approved_receipt)
    private_endpoint = _verify_live_private_endpoint(proxy_url, approved_receipt)
    proof = approved_receipt.get("production_isolation_proof")
    storage_acl_proof = approved_receipt.get("production_storage_acl_proof")
    staging_identity_proof = approved_receipt.get("staging_identity_proof")
    if not isinstance(proof, dict):
        raise BenchmarkSafetyError("Deployment receipt lacks production isolation proof.")
    if not isinstance(storage_acl_proof, dict):
        raise BenchmarkSafetyError("Deployment receipt lacks production Storage ACL proof.")
    if not isinstance(staging_identity_proof, dict):
        raise BenchmarkSafetyError("Deployment receipt lacks staging identity proof.")
    isolation = _validate_live_isolation_proof(
        proof,
        approved_receipt,
        str(proof.get("verified_at", "")),
    )
    storage_acl = _validate_production_storage_acl_proof(
        storage_acl_proof,
        str(storage_acl_proof.get("production_project_number", "")),
        str(storage_acl_proof.get("verified_at", "")),
    )
    staging_identity = _validate_staging_identity_proof(
        staging_identity_proof,
        str(approved_receipt.get("staging_project_number", "")),
        str(staging_identity_proof.get("verified_at", "")),
        proof.get("staging_storage_buckets", []),
    )
    return {
        **private_endpoint,
        "checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "proof_source": "github_workflow_deployment_receipt",
        "deployment_receipt_sha256": approved_receipt.get("receipt_sha256"),
        "receipt_freshness": freshness,
        "production_isolation": isolation,
        "production_storage_acl": storage_acl,
        "staging_identity": staging_identity,
    }


def _verify_live_private_endpoint(
    proxy_url: str,
    approved_receipt: Mapping[str, Any],
) -> Dict[str, Any]:
    service_name = str(approved_receipt.get("cloud_run_service", "")).rsplit("/", 1)[-1]
    if service_name != "llmproxycandidate":
        raise BenchmarkSafetyError("Deployment receipt targets the wrong Cloud Run service.")
    iam_policy = _gcloud_json([
        "run", "services", "get-iam-policy", service_name,
        f"--project={STAGING_PROJECT_ID}",
        f"--region={STAGING_REGION}",
    ], "candidate Cloud Run IAM policy")
    _assert_private_candidate_iam_policy(iam_policy)
    anonymous = requests.get(proxy_url, timeout=30, allow_redirects=False)
    if anonymous.status_code not in {401, 403}:
        raise BenchmarkSafetyError("Candidate endpoint did not reject anonymous invocation.")
    return {
        "checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "direct_resource_iam": "exact_benchmark_caller_only",
        "anonymous_http_status": anonymous.status_code,
    }


def _paid_dispatch_platform_recheck(
    proxy_url: str,
    expected_git_sha: str,
    expected_catalog_sha256: str,
    approved_receipt: Mapping[str, Any],
) -> Dict[str, Any]:
    freshness = _validate_deployment_receipt_freshness(approved_receipt)
    _resolve_candidate_deployment(
        proxy_url,
        expected_git_sha,
        expected_catalog_sha256,
        approved_receipt,
    )
    private_endpoint = _verify_live_private_endpoint(proxy_url, approved_receipt)
    return {
        **private_endpoint,
        "deployment_receipt_sha256": approved_receipt["receipt_sha256"],
        "cloud_run_revision": approved_receipt["cloud_run_revision"],
        "container_image_digest": approved_receipt["container_image_digest"],
        "receipt_freshness": freshness,
    }


class IdentityTokenProvider:
    def __init__(self, audience: str, service_account: str):
        if service_account != BENCHMARK_CALLER_SERVICE_ACCOUNT:
            raise BenchmarkSafetyError(
                "Paid execution requires the dedicated staging benchmark caller."
            )
        self.audience = audience
        self.service_account = service_account
        self._token = ""
        self._expires_at = 0
        self._lock = threading.Lock()

    @staticmethod
    def _expiration(token: str) -> int:
        try:
            payload = token.split(".")[1]
            payload += "=" * (-len(payload) % 4)
            decoded = json.loads(base64.urlsafe_b64decode(payload.encode("ascii")))
            return int(decoded["exp"])
        except (IndexError, KeyError, ValueError, json.JSONDecodeError) as error:
            raise BenchmarkSafetyError("gcloud returned an invalid identity token.") from error

    def __call__(self) -> str:
        with self._lock:
            if self._token and time.time() < self._expires_at - 300:
                return self._token
            result = subprocess.run(
                [
                    "gcloud", "auth", "print-identity-token",
                    f"--impersonate-service-account={self.service_account}",
                    f"--audiences={self.audience}",
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                raise BenchmarkSafetyError("Could not obtain the short-lived benchmark identity token.")
            token = result.stdout.strip()
            self._expires_at = self._expiration(token)
            self._token = token
            return token


def _candidate_preflight(
    proxy_url: str,
    token_provider: IdentityTokenProvider,
    run_id: str,
    cap_usd: float,
    verify_isolation: bool,
    expected_git_sha: str | None,
    expected_catalog_sha256: str | None,
    prior_audit_spend_usd: float = 0.106425,
    include_ledger: bool = False,
    deployment_receipt: Mapping[str, Any] | None = None,
) -> Dict[str, Any]:
    live_safety: Dict[str, Any] | None = None
    if deployment_receipt is not None:
        if expected_git_sha is None or expected_catalog_sha256 is None:
            raise BenchmarkSafetyError(
                "Deployment receipt verification requires exact source hashes."
            )
        _resolve_candidate_deployment(
            proxy_url,
            expected_git_sha,
            expected_catalog_sha256,
            deployment_receipt,
        )
        live_safety = _verify_live_candidate_safety(proxy_url, deployment_receipt)
    query: Dict[str, str] = {}
    if verify_isolation:
        query["isolation"] = "1"
    if include_ledger:
        query["ledger"] = "1"
    response = requests.get(
        proxy_url,
        params=query or None,
        headers={"Authorization": f"Bearer {token_provider()}"},
        timeout=60,
        allow_redirects=False,
    )
    if 300 <= response.status_code < 400:
        raise BenchmarkSafetyError(
            f"Candidate preflight refused HTTP redirect {response.status_code}."
        )
    if response.status_code != 200:
        raise BenchmarkSafetyError(
            f"Candidate preflight failed with HTTP {response.status_code}."
        )
    data = response.json()
    if data.get("service") != "llmProxyCandidate" or data.get("run_id") != run_id:
        raise BenchmarkSafetyError("Candidate preflight returned the wrong service or run ID.")
    if data.get("database_id") != "model-benchmarks":
        raise BenchmarkSafetyError("Candidate preflight returned the wrong Firestore database.")
    if (
        data.get("inference_geo") not in {"global", "us"}
        or data.get("service_tier") != "standard_only"
    ):
        raise BenchmarkSafetyError(
            "Candidate preflight did not prove its provider routing contract."
        )
    runtime_project_id = data.get("runtime_project_id")
    if runtime_project_id != "lemon-screenplay-staging":
        raise BenchmarkSafetyError("Candidate preflight was not running in an approved staging project.")
    local_catalog_sha256 = _catalog_sha256()
    if expected_catalog_sha256 != local_catalog_sha256:
        raise BenchmarkSafetyError(
            "Approved catalog hash does not match the local committed catalog."
        )
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    allowed_models = set(data.get("allowed_models") or [])
    if allowed_models != _approved_benchmark_models(catalog):
        raise BenchmarkSafetyError("Candidate preflight model catalog is not exact.")
    expected_cap_microusd = Decimal(str(cap_usd)) * 1_000_000
    if (
        expected_cap_microusd != expected_cap_microusd.to_integral_value()
        or data.get("cap_microusd") != int(expected_cap_microusd)
    ):
        raise BenchmarkSafetyError("Candidate preflight cap does not match --max-cost-usd.")
    expected_prior_microusd = Decimal(str(prior_audit_spend_usd)) * 1_000_000
    if (
        expected_prior_microusd != expected_prior_microusd.to_integral_value()
        or data.get("prior_audit_spend_microusd") != int(expected_prior_microusd)
    ):
        raise BenchmarkSafetyError("Candidate preflight prior spend does not match.")
    if (
        data.get("audit_id") != "v9-trust-remediation-20260827"
        or data.get("audit_limit_microusd") != AUDIT_CEILING_MICROUSD
    ):
        raise BenchmarkSafetyError("Candidate cumulative audit ledger is invalid.")
    release = data.get("release") if isinstance(data.get("release"), dict) else {}
    if release.get("source_clean") is not True:
        raise BenchmarkSafetyError("Candidate release was not built from clean source.")
    if release.get("inference_geo") != data.get("inference_geo"):
        raise BenchmarkSafetyError(
            "Candidate release does not bind its provider inference geography."
        )
    if not _is_lower_hex(release.get("deployment_config_sha256"), 64):
        raise BenchmarkSafetyError("Candidate deployment configuration hash is invalid.")
    if re.fullmatch(
        r"llmproxycandidate-[0-9]{5}-[a-z0-9]{3}",
        str(release.get("cloud_run_revision", "")),
    ) is None:
        raise BenchmarkSafetyError("Candidate preflight Cloud Run revision is invalid.")
    if release.get("git_sha") != expected_git_sha:
        raise BenchmarkSafetyError("Candidate Git SHA does not match the approved revision.")
    if release.get("catalog_sha256") != expected_catalog_sha256:
        raise BenchmarkSafetyError("Candidate catalog hash does not match the approved catalog.")
    if deployment_receipt is not None and any((
        deployment_receipt.get("function_uri") != proxy_url,
        deployment_receipt.get("cloud_run_revision")
        != release.get("cloud_run_revision"),
        deployment_receipt.get("git_sha") != release.get("git_sha"),
        deployment_receipt.get("catalog_sha256")
        != release.get("catalog_sha256"),
        deployment_receipt.get("inference_geo")
        != release.get("inference_geo"),
        deployment_receipt.get("deployment_config_sha256")
        != release.get("deployment_config_sha256"),
        deployment_receipt.get("pricing_sha256")
        != release.get("pricing_sha256"),
    )):
        raise BenchmarkSafetyError(
            "Candidate self-report does not match the platform deployment receipt."
        )
    if release.get("pricing_sha256") != _runtime_pricing_sha256():
        raise BenchmarkSafetyError("Candidate runtime pricing hash does not match the local catalog.")
    build_timestamp = release.get("build_timestamp")
    try:
        parsed_build_timestamp = datetime.fromisoformat(
            str(build_timestamp).replace("Z", "+00:00")
        )
    except ValueError as error:
        raise BenchmarkSafetyError("Candidate build timestamp is invalid.") from error
    if parsed_build_timestamp.tzinfo is None:
        raise BenchmarkSafetyError("Candidate build timestamp is invalid.")
    if deployment_receipt is not None:
        try:
            receipt_build_timestamp = datetime.fromisoformat(
                str(deployment_receipt.get("build_timestamp", "")).replace(
                    "Z", "+00:00"
                )
            )
        except ValueError as error:
            raise BenchmarkSafetyError(
                "Deployment receipt build timestamp is invalid."
            ) from error
        if parsed_build_timestamp != receipt_build_timestamp:
            raise BenchmarkSafetyError(
                "Candidate build timestamp drifted from the deployment receipt."
            )
    if verify_isolation:
        isolation = data.get("isolation") if isinstance(data.get("isolation"), dict) else {}
        expected_statuses = {
            "named_database": "allowed",
            "staging_default_database": "denied",
            "production_default_database": "denied",
            "production_storage": "denied",
        }
        if any(isolation.get(key) != value for key, value in expected_statuses.items()):
            raise BenchmarkSafetyError("Candidate IAM isolation preflight did not pass.")
        targets = isolation.get("targets") if isinstance(isolation.get("targets"), dict) else {}
        staging_default = targets.get("staging_default_database")
        production_default = targets.get("production_default_database")
        production_storage = targets.get("production_storage_bucket")
        if production_default != (
            "projects/lemon-screenplay-dashboard/databases/(default)"
        ):
            raise BenchmarkSafetyError("Candidate preflight targeted the wrong production Firestore database.")
        if production_storage != "lemon-screenplay-dashboard.firebasestorage.app":
            raise BenchmarkSafetyError("Candidate preflight targeted the wrong production Storage bucket.")
        if staging_default != f"projects/{runtime_project_id}/databases/(default)":
            raise BenchmarkSafetyError("Candidate preflight confused staging and production Firestore.")
    if include_ledger:
        ledger = data.get("ledger")
        if not isinstance(ledger, dict):
            raise BenchmarkSafetyError("Candidate preflight omitted the resume ledger.")
        bootstrap_status = ledger.get("audit_bootstrap_status")
        if bootstrap_status not in {"not_needed", "ready_from_known_pilot"}:
            raise BenchmarkSafetyError(
                "Candidate cumulative audit history cannot be bootstrapped safely."
            )
        if ledger.get("audit") is None and bootstrap_status != "ready_from_known_pilot":
            raise BenchmarkSafetyError(
                "Candidate cumulative audit ledger is missing without exact pilot evidence."
            )
    if live_safety is not None:
        data["live_safety"] = live_safety
        data["deployment_receipt_sha256"] = deployment_receipt["receipt_sha256"]
    return data


def _validated_audit_budget(
    cap_usd: float,
    prior_spend_usd: float,
) -> tuple[int, int]:
    cap = Decimal(str(cap_usd)) * 1_000_000
    prior = Decimal(str(prior_spend_usd)) * 1_000_000
    if cap != cap.to_integral_value() or prior != prior.to_integral_value():
        raise BenchmarkSafetyError("Audit spend values support at most six decimals.")
    cap_microusd = int(cap)
    prior_microusd = int(prior)
    if cap_microusd <= 0:
        raise BenchmarkSafetyError("Paid execution requires a positive --max-cost-usd.")
    if prior_microusd < SETTLED_PRIOR_PILOT_MICROUSD:
        raise BenchmarkSafetyError(
            "Prior audit spend must include the settled Santa pilot."
        )
    if cap_microusd + prior_microusd > AUDIT_CEILING_MICROUSD:
        raise BenchmarkSafetyError(
            "Prior spend plus this run cap exceeds the authorized $40 audit ceiling."
        )
    return cap_microusd, prior_microusd


class LocalCostCap:
    def __init__(
        self,
        maximum_usd: float,
        catalog: Mapping[str, Any],
        pre_dispatch_check: Any = None,
        output_token_ceiling: Any = None,
    ):
        if maximum_usd <= 0:
            raise BenchmarkSafetyError("Paid execution requires a positive --max-cost-usd.")
        maximum_microusd = Decimal(str(maximum_usd)) * 1_000_000
        if maximum_microusd != maximum_microusd.to_integral_value():
            raise BenchmarkSafetyError("--max-cost-usd supports at most six decimals.")
        self.maximum_microusd = int(maximum_microusd)
        self.catalog = catalog
        self.spent_microusd = 0
        self.reserved_microusd = 0
        self.checks: List[Dict[str, Any]] = []
        self.pre_dispatch_check = pre_dispatch_check
        self.output_token_ceiling = output_token_ceiling
        self._lock = threading.Lock()

    @property
    def maximum_usd(self) -> float:
        return self.maximum_microusd / 1_000_000

    @property
    def spent_usd(self) -> float:
        return self.spent_microusd / 1_000_000

    @property
    def reserved_usd(self) -> float:
        return self.reserved_microusd / 1_000_000

    def call(self, original: Any, model_ids: Mapping[str, str], **kwargs: Any):
        model_id = model_ids.get(str(kwargs.get("model_key")))
        profile = self.catalog["modelProfiles"].get(model_id)
        if not profile:
            raise BenchmarkSafetyError(f"No benchmark pricing profile exists for {model_id}.")
        request_content_bytes = len(_canonical_json([
            kwargs.get("system_blocks", []), kwargs.get("user_blocks", []), kwargs.get("tool"),
        ]).encode("utf-8"))
        request_bytes = request_content_bytes + LOCAL_REQUEST_ENVELOPE_OVERHEAD_BYTES
        input_tokens = request_bytes + 4_096
        max_tokens = int(kwargs.get("max_tokens", 4_000))
        thinking_budget = int(kwargs.get("thinking_budget", 0))
        max_output_tokens = (
            self.output_token_ceiling(model_id, thinking_budget, max_tokens)
            if self.output_token_ceiling is not None
            else max_tokens + thinking_budget
        )
        profiles = list(self.catalog["modelProfiles"].values())
        ceiling_microusd = math.ceil(Decimal("1.1") * (
            Decimal(input_tokens)
            * max(
                Decimal(str(candidate["inputUsdPerMillion"])) * 2
                for candidate in profiles
            )
            + Decimal(max_output_tokens)
            * max(
                Decimal(str(candidate["outputUsdPerMillion"]))
                for candidate in profiles
            )
        ))
        ceiling_usd = ceiling_microusd / 1_000_000
        check: Dict[str, Any] = {
            "requested_model": model_id,
            "stage": kwargs.get("stage", "unspecified"),
            "logical_retry": int(kwargs.get("logical_retry", 0)),
            "request_content_bytes": request_content_bytes,
            "request_envelope_overhead_bytes": LOCAL_REQUEST_ENVELOPE_OVERHEAD_BYTES,
            "request_bytes_upper_bound": request_bytes,
            "input_tokens_upper_bound": input_tokens,
            "output_tokens_upper_bound": max_output_tokens,
            "request_ceiling_microusd": ceiling_microusd,
            "request_ceiling_usd": ceiling_usd,
        }
        with self._lock:
            remaining = (
                self.maximum_microusd
                - self.spent_microusd
                - self.reserved_microusd
            )
            check.update({
                "sequence": len(self.checks) + 1,
                "spent_before_microusd": self.spent_microusd,
                "spent_before_usd": self.spent_usd,
                "reserved_before_microusd": self.reserved_microusd,
                "reserved_before_usd": self.reserved_usd,
                "remaining_before_microusd": remaining,
                "remaining_before_usd": remaining / 1_000_000,
            })
            self.checks.append(check)
            if ceiling_microusd > remaining:
                check["decision"] = "rejected_before_dispatch"
                raise BenchmarkSafetyError(
                    f"Next request ceiling ${ceiling_usd:.4f} exceeds the remaining local cap."
                )
            self.reserved_microusd += ceiling_microusd
            check["decision"] = "reserved_before_dispatch"
        if self.pre_dispatch_check is not None:
            try:
                platform_evidence = self.pre_dispatch_check()
            except Exception as error:
                with self._lock:
                    self.reserved_microusd -= ceiling_microusd
                    check["reserved_after_microusd"] = self.reserved_microusd
                    check["reserved_after_usd"] = self.reserved_usd
                    check["decision"] = "rejected_platform_drift_before_dispatch"
                    check["platform_failure"] = {
                        "type": type(error).__name__,
                        "message": _sanitize_failure_text(error),
                    }
                raise
            check["platform_recheck"] = platform_evidence
        try:
            result = original(**kwargs)
        except Exception as error:
            failure_usage = getattr(error, "usage", None)
            from execution.ingest_v9 import (
                canonical_failed_call,
                checkpoint_benchmark_usage,
            )
            failure_cost_microusd = (
                failure_usage.get("actual_cost_microusd")
                if isinstance(failure_usage, dict)
                else None
            )
            failed_calls = (
                failure_usage.get("failed_calls")
                if isinstance(failure_usage, dict)
                else None
            )
            release_mismatch = isinstance(failed_calls, list) and any(
                isinstance(call, dict)
                and call.get("failure_state") == "candidate_release_mismatch"
                for call in failed_calls
            )
            if release_mismatch:
                failure_cost_microusd = None
            if (
                type(failure_cost_microusd) is int
                and failure_cost_microusd >= 0
            ):
                with self._lock:
                    self.reserved_microusd -= ceiling_microusd
                    self.spent_microusd += failure_cost_microusd
                    check["settled_cost_microusd"] = failure_cost_microusd
                    check["settled_cost_usd"] = failure_cost_microusd / 1_000_000
                    check["spent_after_usd"] = self.spent_usd
                    check["spent_after_microusd"] = self.spent_microusd
                    check["reserved_after_usd"] = self.reserved_usd
                    check["reserved_after_microusd"] = self.reserved_microusd
                    check["decision"] = (
                        "settled_failure_exceeds_preflight_ceiling"
                        if failure_cost_microusd > ceiling_microusd
                        else "settled_failure"
                    )
                    check["preflight_ceiling_exceeded"] = (
                        failure_cost_microusd > ceiling_microusd
                    )
                for collection in ("calls", "failed_calls"):
                    calls = failure_usage.get(collection)
                    if not isinstance(calls, list):
                        continue
                    for call in calls:
                        if isinstance(call, dict):
                            call["budget_check"] = check
                failed_calls = failure_usage.get("failed_calls")
                if isinstance(failed_calls, list):
                    failure_usage["failed_calls"] = [
                        canonical_failed_call(
                            call,
                            aggregate_cost_microusd=failure_cost_microusd,
                        )
                        for call in failed_calls
                        if isinstance(call, dict)
                    ]
            else:
                attempt_history = getattr(error, "attempt_history", None)
                proven_zero_spend = (
                    not release_mismatch
                    and (
                        (
                            isinstance(attempt_history, list)
                            and bool(attempt_history)
                            and all(
                                isinstance(attempt, dict)
                                and attempt.get("error_type")
                                == "LlmPreCallRetryableError"
                                for attempt in attempt_history
                            )
                        )
                        or type(error).__name__ in {
                            "BenchmarkCapExceededError",
                            "DailyBudgetExceededError",
                            "LlmRequestRejectedError",
                        }
                    )
                )
                if proven_zero_spend:
                    with self._lock:
                        self.reserved_microusd -= ceiling_microusd
                        check["settled_cost_microusd"] = 0
                        check["settled_cost_usd"] = 0.0
                        check["spent_after_usd"] = self.spent_usd
                        check["spent_after_microusd"] = self.spent_microusd
                        check["reserved_after_usd"] = self.reserved_usd
                        check["reserved_after_microusd"] = self.reserved_microusd
                        check["decision"] = "proven_zero_spend_failure"
                    zero_usage = (
                        failure_usage
                        if isinstance(failure_usage, dict)
                        else _empty_usage()
                    )
                    zero_usage["actual_cost_microusd"] = 0
                    zero_usage["actual_cost_usd"] = 0.0
                    failed_calls = zero_usage.setdefault("failed_calls", [])
                    if not failed_calls:
                        failed_calls.append({
                            **getattr(error, "call_evidence", {}),
                            "requested_model": model_id,
                            "stage": kwargs.get("stage", "unspecified"),
                            "pipeline_pass": kwargs.get("pipeline_pass", "unspecified"),
                            "boundary_run": max(1, int(kwargs.get("boundary_run", 1))),
                            "reader_name": kwargs.get("reader_name"),
                            "logical_retry": int(kwargs.get("logical_retry", 0)),
                            "attempt_history": getattr(error, "attempt_history", None),
                            "uncertainty_status": "proven_zero_spend_pre_generation",
                        })
                    zero_usage["failed_calls"] = [
                        canonical_failed_call(call, aggregate_cost_microusd=0)
                        for call in failed_calls
                        if isinstance(call, dict)
                    ]
                    for failed_call in zero_usage["failed_calls"]:
                        failed_call["budget_check"] = check
                    error.usage = zero_usage
                else:
                    with self._lock:
                        self.reserved_microusd -= ceiling_microusd
                        self.spent_microusd += ceiling_microusd
                        check["settled_cost_microusd"] = ceiling_microusd
                        check["settled_cost_usd"] = ceiling_usd
                        check["spent_after_usd"] = self.spent_usd
                        check["spent_after_microusd"] = self.spent_microusd
                        check["reserved_after_usd"] = self.reserved_usd
                        check["reserved_after_microusd"] = self.reserved_microusd
                        check["decision"] = "charged_conservative_uncertain_ceiling"
                    uncertain_usage = (
                        failure_usage
                        if isinstance(failure_usage, dict)
                        else _empty_usage()
                    )
                    uncertain_usage["actual_cost_microusd"] = ceiling_microusd
                    uncertain_usage["actual_cost_usd"] = ceiling_usd
                    failed_calls = uncertain_usage.setdefault("failed_calls", [])
                    if not failed_calls:
                        failed_calls.append({
                            **getattr(error, "call_evidence", {}),
                            "requested_model": model_id,
                            "stage": kwargs.get("stage", "unspecified"),
                            "pipeline_pass": kwargs.get("pipeline_pass", "unspecified"),
                            "boundary_run": max(1, int(kwargs.get("boundary_run", 1))),
                            "reader_name": kwargs.get("reader_name"),
                            "logical_retry": int(kwargs.get("logical_retry", 0)),
                            "attempt_history": getattr(error, "attempt_history", None),
                            "uncertainty_status": "client_result_unsettled",
                            "disposition": "discarded_unusable",
                            "failure_state": "client_result_unsettled",
                            "downstream_consumption": "not_consumed",
                        })
                    uncertain_usage["failed_calls"] = [
                        canonical_failed_call(
                            failed_call,
                            aggregate_cost_microusd=ceiling_microusd,
                        )
                        for failed_call in failed_calls
                        if isinstance(failed_call, dict)
                    ]
                    for failed_call in uncertain_usage["failed_calls"]:
                        failed_call.update({
                            "budget_check": check,
                            "uncertainty_status": "client_result_unsettled",
                            "charged_cost_microusd": ceiling_microusd,
                            "charged_cost_usd": ceiling_usd,
                            "cap_cost_microusd": ceiling_microusd,
                            "cap_cost_usd": ceiling_usd,
                        })
                    error.usage = uncertain_usage
            checkpoint_benchmark_usage(getattr(error, "usage", None))
            raise
        usage = result[2]
        actual_cost_microusd = (
            usage.get("actual_cost_microusd") if isinstance(usage, dict) else None
        )
        if type(actual_cost_microusd) is not int or actual_cost_microusd < 0:
            with self._lock:
                self.reserved_microusd -= ceiling_microusd
                self.spent_microusd += ceiling_microusd
                check["settled_cost_microusd"] = ceiling_microusd
                check["settled_cost_usd"] = ceiling_usd
                check["spent_after_usd"] = self.spent_usd
                check["spent_after_microusd"] = self.spent_microusd
                check["reserved_after_usd"] = self.reserved_usd
                check["reserved_after_microusd"] = self.reserved_microusd
                check["decision"] = "charged_conservative_invalid_settlement"
            from execution.ingest_v9 import (
                canonical_failed_call,
                checkpoint_benchmark_usage,
            )
            source_calls = usage.get("calls") if isinstance(usage, dict) else None
            source_call = (
                copy.deepcopy(source_calls[0])
                if isinstance(source_calls, list)
                and len(source_calls) == 1
                and isinstance(source_calls[0], dict)
                else {}
            )
            source_usage = (
                source_call.get("usage")
                if isinstance(source_call.get("usage"), dict)
                else {}
            )
            charged_usage = {
                field: (
                    source_usage.get(field)
                    if type(source_usage.get(field)) is int
                    and source_usage[field] >= 0
                    else 0
                )
                for field in (
                    "input_tokens",
                    "output_tokens",
                    "cache_creation_input_tokens",
                    "cache_read_input_tokens",
                    "call_count",
                )
            }
            charged_usage.update({
                "actual_cost_microusd": ceiling_microusd,
                "actual_cost_usd": ceiling_usd,
                "charged_cost_microusd": ceiling_microusd,
                "estimated_cost_nanousd": ceiling_microusd * 1_000,
                "estimated_cost_usd": ceiling_usd,
                "rounding_variance_nanousd": 0,
                "rounding_variance_usd": 0.0,
                "rounding_reason": "conservative_ceiling_for_invalid_settlement",
            })
            failed_call = canonical_failed_call({
                **source_call,
                "requested_model": source_call.get("requested_model", model_id),
                "stage": source_call.get("stage", kwargs.get("stage", "unspecified")),
                "pipeline_pass": source_call.get(
                    "pipeline_pass", kwargs.get("pipeline_pass", "unspecified")
                ),
                "boundary_run": source_call.get(
                    "boundary_run", max(1, int(kwargs.get("boundary_run", 1)))
                ),
                "reader_name": source_call.get("reader_name", kwargs.get("reader_name")),
                "logical_retry": source_call.get(
                    "logical_retry", int(kwargs.get("logical_retry", 0))
                ),
                "usage": charged_usage,
                "validation_result": "failed_accounting",
                "validation_reason": "Proxy response omitted exact settled cost",
                "failure_state": "invalid_cost_settlement",
                "failure_message": "Proxy response omitted exact settled cost",
                "uncertainty_status": "charged_conservative_invalid_settlement",
                "disposition": "discarded_unusable",
                "downstream_consumption": "not_consumed",
                "independent_cost_status": "unavailable_invalid_provider_settlement",
                "budget_check": check,
            }, aggregate_cost_microusd=ceiling_microusd)
            invalid_usage = _usage_from_call_records(
                [(failed_call, "failed_calls")]
            )
            error = BenchmarkSafetyError("Proxy response omitted exact settled cost.")
            error.usage = invalid_usage
            checkpoint_benchmark_usage(invalid_usage)
            raise error
        with self._lock:
            self.reserved_microusd -= ceiling_microusd
            self.spent_microusd += actual_cost_microusd
            check["settled_cost_microusd"] = actual_cost_microusd
            check["settled_cost_usd"] = actual_cost_microusd / 1_000_000
            check["spent_after_usd"] = self.spent_usd
            check["spent_after_microusd"] = self.spent_microusd
            check["reserved_after_usd"] = self.reserved_usd
            check["reserved_after_microusd"] = self.reserved_microusd
            check["decision"] = (
                "settled_exceeds_preflight_ceiling"
                if actual_cost_microusd > ceiling_microusd
                else "settled"
            )
            check["preflight_ceiling_exceeded"] = (
                actual_cost_microusd > ceiling_microusd
            )
        calls = usage.get("calls")
        if isinstance(calls, list):
            for call in calls:
                if isinstance(call, dict):
                    call["budget_check"] = check
        from execution.ingest_v9 import checkpoint_benchmark_usage
        checkpoint_benchmark_usage(usage)
        if actual_cost_microusd > ceiling_microusd:
            error = BenchmarkSafetyError(
                "Settled provider cost exceeded the conservative local request ceiling."
            )
            error.usage = usage
            raise error
        return result


def _contract_data(engine: Any) -> Dict[str, Any]:
    from execution.trust_manifest import benchmark_contract_fingerprints

    schemas = {
        "genre": engine.GENRE_DETECTION_TOOL,
        "readers": engine.READER_TOOLS,
        "synthesis": engine.SYNTHESIS_TOOL,
        "claim_verification": engine.CLAIM_VERIFICATION_TOOL,
    }
    return {
        **benchmark_contract_fingerprints(),
        "schema_bundle_sha256": _sha256_json(schemas),
    }


def _assert_benchmark_artifact_path(path: Path) -> Path:
    """Reject any symlink before local benchmark data is read or written."""
    try:
        secure_local_path(ARTIFACTS_ROOT, ROOT)
        return secure_local_path(path, ARTIFACTS_ROOT)
    except ValueError as error:
        raise BenchmarkSafetyError(
            str(error)
        ) from error


def _load_deployment_receipt(
    raw_path: str | None,
    expected_receipt_sha256: str | None,
    *,
    proxy_url: str,
    expected_git_sha: str,
    expected_catalog_sha256: str,
    run_id: str,
    cap_microusd: int,
    prior_audit_spend_microusd: int,
    catalog: Mapping[str, Any],
) -> Dict[str, Any]:
    if not raw_path or not _is_lower_hex(expected_receipt_sha256, 64):
        raise BenchmarkSafetyError(
            "Paid execution requires the immutable deployment receipt and its SHA-256."
        )
    path = Path(raw_path).expanduser()
    if not path.is_absolute():
        path = ROOT / path
    path = _assert_benchmark_artifact_path(path)
    if not path.is_file():
        raise BenchmarkSafetyError("Deployment receipt is not a local benchmark artifact.")
    try:
        receipt = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise BenchmarkSafetyError("Deployment receipt is invalid JSON.") from error
    if not isinstance(receipt, dict):
        raise BenchmarkSafetyError("Deployment receipt must be a JSON object.")
    receipt_sha256 = receipt.get("receipt_sha256")
    receipt_body = {
        key: value for key, value in receipt.items() if key != "receipt_sha256"
    }
    proof = receipt.get("production_isolation_proof")
    if not isinstance(proof, dict):
        raise BenchmarkSafetyError("Deployment receipt omitted the isolation proof.")
    storage_acl_proof = receipt.get("production_storage_acl_proof")
    if not isinstance(storage_acl_proof, dict):
        raise BenchmarkSafetyError(
            "Deployment receipt omitted the production Storage ACL proof."
        )
    staging_identity_proof = receipt.get("staging_identity_proof")
    if not isinstance(staging_identity_proof, dict):
        raise BenchmarkSafetyError(
            "Deployment receipt omitted the staging identity proof."
        )
    proof_body = {
        key: value for key, value in proof.items() if key != "proof_sha256"
    }
    secrets = receipt.get("secret_environment_variables")
    if (
        receipt_sha256 != expected_receipt_sha256
        or receipt_sha256 != _sha256_json(receipt_body)
        or proof.get("proof_sha256") != _sha256_json(proof_body)
        or proof.get("status") != "passed_complete_static_iam_inventory"
        or proof.get("scanner_version")
        != "standalone-project-iam-and-resource-inventory-v2"
        or not _is_lower_hex(proof.get("permission_contract_sha256"), 64)
        or proof.get("production_project_scope_state") != "STANDALONE_NO_PARENT"
        or proof.get("production_access_state")
        != "NO_STAGING_IDENTITY_ALLOW_BINDING"
        or not _is_lower_hex(proof.get("production_project_resource_sha256"), 64)
        or not _is_lower_hex(proof.get("production_project_iam_policy_sha256"), 64)
        or type(proof.get("production_project_binding_count")) is not int
        or proof["production_project_binding_count"] < 1
        or not isinstance(proof.get("production_firestore_inventory"), dict)
        or proof.get("production_firestore_inventory_sha256")
        != _sha256_json(proof.get("production_firestore_inventory"))
        or proof.get("production_firestore_database_count")
        != len(proof["production_firestore_inventory"].get("databases", []))
        or proof.get("production_firestore_backup_count")
        != len(proof["production_firestore_inventory"].get("backups", []))
        or proof.get("production_firestore_backup_schedule_count")
        != len(proof["production_firestore_inventory"].get("backup_schedules", []))
        or proof.get("staging_data_resource_inventory_sha256")
        != _sha256_json({
            "databases": proof.get("staging_firestore_databases"),
            "buckets": proof.get("staging_storage_buckets"),
        })
        or not _valid_production_service_account_inventory(proof)
        or not _valid_production_auditor_contract(proof)
        or proof.get("staging_project_number")
        != str(receipt.get("staging_project_number", ""))
        or not isinstance(secrets, list)
        or len(secrets) != 1
        or not re.fullmatch(r"[1-9][0-9]*", str(secrets[0].get("version", "")))
        or secrets[0].get("key") != "BENCHMARK_ANTHROPIC_API_KEY"
        or secrets[0].get("secret") != "BENCHMARK_ANTHROPIC_API_KEY"
    ):
        raise BenchmarkSafetyError("Deployment receipt integrity validation failed.")
    expected_config_sha256 = _deployment_config_sha256(
        catalog,
        run_id,
        cap_microusd,
        prior_audit_spend_microusd,
        str(receipt.get("inference_geo")),
    )
    expected_fields = {
        "project_id": STAGING_PROJECT_ID,
        "region": STAGING_REGION,
        "function_name": CANDIDATE_FUNCTION_NAME,
        "function_uri": proxy_url,
        "runtime_service_account": BENCHMARK_RUNTIME_SERVICE_ACCOUNT,
        "git_sha": expected_git_sha,
        "catalog_sha256": expected_catalog_sha256,
        "pricing_sha256": _runtime_pricing_sha256(),
        "run_id": run_id,
        "cap_microusd": cap_microusd,
        "prior_audit_spend_microusd": prior_audit_spend_microusd,
        "deployment_config_sha256": expected_config_sha256,
        "firebase_config_project_id": STAGING_PROJECT_ID,
    }
    if any(receipt.get(key) != value for key, value in expected_fields.items()):
        raise BenchmarkSafetyError(
            "Deployment receipt does not match the approved paid benchmark."
        )
    production_project_number = str(
        storage_acl_proof.get("production_project_number", "")
    )
    _validate_production_storage_acl_proof(
        storage_acl_proof,
        production_project_number,
    )
    _validate_staging_identity_proof(
        staging_identity_proof,
        str(receipt.get("staging_project_number", "")),
        expected_staging_storage_buckets=proof.get("staging_storage_buckets", []),
    )
    project_number = str(receipt.get("staging_project_number", ""))
    expected_build_service_account = (
        f"projects/{STAGING_PROJECT_ID}/serviceAccounts/"
        f"{project_number}-compute@developer.gserviceaccount.com"
    )
    expected_docker_repository = (
        f"projects/{STAGING_PROJECT_ID}/locations/{STAGING_REGION}/"
        "repositories/gcf-artifacts"
    )
    expected_image_prefix = (
        f"{STAGING_REGION}-docker.pkg.dev/{STAGING_PROJECT_ID}/gcf-artifacts/"
    )
    image_digest = str(receipt.get("container_image_digest", ""))
    image = str(receipt.get("container_image", ""))
    if (
        receipt.get("inference_geo") not in {"global", "us"}
        or receipt.get("cloud_run_service") != (
            f"projects/{STAGING_PROJECT_ID}/locations/{STAGING_REGION}/"
            "services/llmproxycandidate"
        )
        or receipt.get("runtime") != "nodejs22"
        or receipt.get("entry_point") != CANDIDATE_FUNCTION_NAME
        or receipt.get("runtime_update_policy") != "automatic"
        or receipt.get("runtime_version") is not None
        or not re.fullmatch(r"[1-9][0-9]*", project_number)
        or not re.fullmatch(r"[1-9][0-9]*", production_project_number)
        or receipt.get("build_service_account")
        != expected_build_service_account
        or receipt.get("docker_repository") != expected_docker_repository
        or receipt.get("available_memory") not in {"512M", "512Mi", "512MiB"}
        or receipt.get("available_cpu") != "0.3333"
        or receipt.get("ingress_settings") != "ALLOW_ALL"
        or receipt.get("timeout_seconds") != 3600
        or receipt.get("max_instance_count") != 5
        or receipt.get("concurrency") != 1
        or not isinstance(receipt.get("build_resource"), str)
        or not receipt["build_resource"]
        or not image.startswith(expected_image_prefix)
        or not image.endswith(f"@{image_digest}")
        or not _is_lower_hex(receipt.get("function_resource_sha256"), 64)
        or not _is_lower_hex(receipt.get("revision_resource_sha256"), 64)
        or not _is_lower_hex(receipt.get("runtime_environment_sha256"), 64)
        or not re.fullmatch(
            r"llmproxycandidate-[0-9]{5}-[a-z0-9]{3}",
            str(receipt.get("cloud_run_revision", "")),
        )
        or not re.fullmatch(
            r"sha256:[a-f0-9]{64}",
            image_digest,
        )
        or str(secrets[0].get("projectId"))
        not in {STAGING_PROJECT_ID, project_number}
        or proof.get("runtime_service_account")
        != BENCHMARK_RUNTIME_SERVICE_ACCOUNT
        or proof.get("staging_project_id") != STAGING_PROJECT_ID
        or proof.get("production_project_id") != "lemon-screenplay-dashboard"
        or proof.get("production_project_number") != production_project_number
        or proof.get("production_storage_bucket")
        != "lemon-screenplay-dashboard.firebasestorage.app"
    ):
        raise BenchmarkSafetyError("Deployment receipt provenance is incomplete.")
    try:
        build_timestamp = datetime.fromisoformat(
            str(receipt.get("build_timestamp", "")).replace("Z", "+00:00")
        )
        isolation_timestamp = datetime.fromisoformat(
            str(proof.get("verified_at", "")).replace("Z", "+00:00")
        )
    except ValueError as error:
        raise BenchmarkSafetyError("Deployment receipt timestamp is invalid.") from error
    if build_timestamp.tzinfo is None or isolation_timestamp.tzinfo is None:
        raise BenchmarkSafetyError("Deployment receipt timestamp is invalid.")
    return receipt


def _load_engine(run_dir: Path):
    engine_dir = run_dir / "engine"
    _assert_benchmark_artifact_path(engine_dir)
    engine_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    engine_dir.chmod(0o700)
    os.environ["LEMON_LOCAL_ARTIFACT_DIR"] = str(engine_dir)
    os.environ["LEMON_LOCAL_ARTIFACT_ROOT"] = str(run_dir)
    from execution import ingest_v9

    def block_remote_persistence(*_args: Any, **_kwargs: Any) -> None:
        raise BenchmarkSafetyError("Production persistence is disabled in benchmark mode.")

    for name in (
        "init_firebase",
        "write_analysis_transaction",
        "write_to_firestore",
        "persist_analysis_or_save_fallback",
        "archive_cli_pdf_version",
        "check_already_in_firestore",
    ):
        setattr(ingest_v9, name, block_remote_persistence)
    return ingest_v9


def _run_paid(
    engine: Any,
    run: Dict[str, Any],
    input_record: Mapping[str, Any],
    proxy_url: str,
    calibration_prompt: str | None,
    cap: LocalCostCap,
    run_id: str,
    contracts: Mapping[str, str],
    token_provider: Any,
    expected_release: Mapping[str, Any],
    local_source_before: Mapping[str, Any],
    call_checkpoint: Any = None,
) -> None:
    current_source_sha256 = _sha256_bytes(
        Path(str(input_record["path"])).read_bytes()
    )
    if current_source_sha256 != input_record["content_sha256"]:
        raise BenchmarkSafetyError(
            "Approved screenplay bytes changed before parse; no model call was made."
        )
    parsed = engine.parse_pdf(
        Path(str(input_record["path"])),
        content_hash=str(input_record["content_sha256"]),
    )
    if not parsed:
        raise BenchmarkSafetyError(f"Parser rejected {input_record['filename']}.")
    engine.validate_parsed_source(parsed)
    metadata = parsed.get("metadata") if isinstance(parsed.get("metadata"), dict) else {}
    run["source_evidence"] = {
        "filename": input_record["filename"],
        "source_sha256": input_record["content_sha256"],
        "physical_page_count": parsed["page_count"],
        "word_count": parsed["word_count"],
        "scene_heading_count": parsed.get("scene_count"),
        "scene_count_evidence": metadata.get("scene_count_evidence"),
        "extraction_method": metadata.get("extraction_method"),
        "extraction_quality": metadata.get("extraction_quality"),
        "native_cross_check": metadata.get("native_cross_check"),
        "page_evidence_sha256": metadata.get("page_evidence_sha256"),
    }

    original_ids = dict(engine.MODEL_IDS)
    original_call = engine.call_llm
    try:
        if run["route"] == "hybrid":
            engine.MODEL_IDS["sonnet"] = run["sonnet_model_id"]
            engine.MODEL_IDS["opus"] = run["opus_model_id"]
        else:
            engine.MODEL_IDS["sonnet"] = run["sonnet_model_id"]
            engine.MODEL_IDS[run["route"]] = run["model_id"]
        engine.configure_benchmark_online_transport(
            {
                "run_id": run_id,
                "screenplay_sha256": input_record["content_sha256"],
                "route": run["route"],
                "generation": run["generation"],
                "prompt_bundle_sha256": contracts["prompt_bundle_sha256"],
                "schema_bundle_sha256": contracts["schema_bundle_sha256"],
            },
            token_provider,
            dict(expected_release),
            call_checkpoint,
        )
        engine.call_llm = lambda **kwargs: cap.call(original_call, engine.MODEL_IDS, **kwargs)

        cold_usage = engine.empty_usage()
        try:
            cold_read, cold_usage = engine.run_nonbinding_cold_read(
                text=parsed["text"],
                title=Path(str(input_record["filename"])).stem,
                page_count=parsed["page_count"],
                word_count=parsed["word_count"],
                proxy_url=proxy_url,
            )
            common = {
                "text": parsed["text"],
                "title": Path(str(input_record["filename"])).stem,
                "page_count": parsed["page_count"],
                "word_count": parsed["word_count"],
                "proxy_url": proxy_url,
                "cold_read": cold_read,
                "calibration_prompt": calibration_prompt,
                "page_content_signals": metadata.get("page_content_signals"),
            }
            if run["route"] == "hybrid":
                analysis, usage = engine.run_v9_hybrid(**common)
            else:
                analysis, usage = engine.run_v9_stable(
                    **common,
                    model_key=run["route"],
                    pipeline_pass=run["route"],
                )
        except Exception as error:
            error.usage = engine.merge_usage(
                cold_usage,
                getattr(error, "usage", engine.empty_usage()),
            )
            raise
        usage = engine.merge_usage(cold_usage, usage)
        try:
            engine.attach_verified_citation_quality(
                analysis,
                parsed.get("metadata") or {},
                parsed["page_count"],
                parsed["text"],
            )
        except Exception as error:
            error.usage = usage
            raise
        model_configuration = _model_configuration(run)
        effective_model_tier = run["route"]
        if run["route"] == "hybrid":
            effective_model_tier = str(
                (analysis.get("_hybrid_mode") or {}).get("final_model", "sonnet")
            )
        boundary = analysis.get("_boundary_reruns")
        boundary_run = (
            boundary.get("selected_run_number", 1)
            if isinstance(boundary, dict)
            else 1
        )
        try:
            claim_verification, claim_usage = engine.run_claim_verification(
                text=parsed["text"],
                analysis=analysis,
                model_key=effective_model_tier,
                proxy_url=proxy_url,
                pipeline_pass=effective_model_tier,
                boundary_run=boundary_run,
            )
            analysis["_claim_verification"] = claim_verification
            usage = engine.merge_usage(usage, claim_usage)
            engine.attach_verified_citation_quality(
                analysis,
                parsed.get("metadata") or {},
                parsed["page_count"],
                parsed["text"],
            )
        except Exception as error:
            error.usage = engine.merge_usage(
                usage,
                getattr(error, "usage", engine.empty_usage()),
            )
            raise
        local_source_proof = {
            "before": dict(local_source_before),
            "after": _verify_local_source(str(expected_release["git_sha"])),
        }
        parser_metadata = {
            **metadata,
            "page_count": parsed["page_count"],
            "word_count": parsed["word_count"],
            "character_count": len(str(parsed["text"])),
        }
        from execution.trust_manifest import (
            build_benchmark_trust_seal,
            validate_benchmark_trust_seal,
        )
        seal_inputs = {
            "analysis": analysis,
            "usage": usage,
            "source": run["source_evidence"],
            "parser_metadata": parser_metadata,
            "route": run["route"],
            "effective_model_tier": effective_model_tier,
            "model_ids": dict(engine.MODEL_IDS),
            "contracts": dict(contracts),
            "release": dict(expected_release),
            "local_source_proof": local_source_proof,
            "authorized_benchmark_cap_microusd": cap.maximum_microusd,
        }
        trust_seal = build_benchmark_trust_seal(**seal_inputs)
        validate_benchmark_trust_seal(trust_seal, **seal_inputs)
        locked_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        output_lock = {
            "locked_at": locked_at,
            "source_sha256": input_record["content_sha256"],
            "page_evidence_sha256": metadata.get("page_evidence_sha256"),
            "scene_count_evidence_sha256": (
                (metadata.get("scene_count_evidence") or {}).get("evidence_sha256")
                if isinstance(metadata.get("scene_count_evidence"), dict)
                else None
            ),
            "model_configuration": model_configuration,
            "model_configuration_sha256": _sha256_json(model_configuration),
            "contract_bundle": dict(contracts),
            "local_source_proof": local_source_proof,
            "trust_seal_integrity_sha256": trust_seal["integrity_sha256"],
            "analysis_sha256": _sha256_json(analysis),
            "usage_sha256": _sha256_json(usage),
            "verdict": analysis.get("verdict"),
        }
        output_lock["machine_output_sha256"] = _sha256_json({
            "locked_at": locked_at,
            "source_evidence": run["source_evidence"],
            "model_configuration": model_configuration,
            "contracts": contracts,
            "analysis": analysis,
            "usage": usage,
            "trust_seal": trust_seal,
        })
        run.update({
            "status": "complete",
            "analysis": analysis,
            "usage": usage,
            "trust_seal": trust_seal,
            "output_lock": output_lock,
            "parser_metadata": parser_metadata,
            "effective_model_tier": effective_model_tier,
            "model_ids": dict(engine.MODEL_IDS),
            "release": dict(expected_release),
            "local_source_proof": local_source_proof,
            "checkpointed_calls": copy.deepcopy(usage.get("calls", [])),
            "provenance": {
                "calls": usage.get("calls", []),
                "response_ids": [call["response_id"] for call in usage.get("calls", [])],
            },
        })
    finally:
        engine.clear_benchmark_online_transport()
        engine.MODEL_IDS.clear()
        engine.MODEL_IDS.update(original_ids)
        engine.call_llm = original_call


def _run_smoke(
    run: Dict[str, Any],
    input_record: Mapping[str, Any],
    proxy_url: str,
    cap: LocalCostCap,
    run_id: str,
    token_provider: Any,
    expected_release: Mapping[str, Any],
) -> None:
    payload: Dict[str, Any] = {
        "model": run["model_id"],
        "messages": [{
            "role": "user",
            "content": "Reply with the single word READY.",
        }],
        "max_tokens": 16,
    }
    prompt_bundle_sha256 = _sha256_json({
        "system": [],
        "messages": payload["messages"],
    })
    schema_bundle_sha256 = _sha256_json({"smoke_response": "schema_free"})
    provider_payload = copy.deepcopy(payload)
    if run["model_id"] != "claude-haiku-4-5-20251001":
        provider_payload["inference_geo"] = expected_release["inference_geo"]
    provider_payload["service_tier"] = "standard_only"
    benchmark = {
        "run_id": run_id,
        "screenplay_sha256": input_record["content_sha256"],
        "route": run["route"],
        "generation": run["generation"],
        "pipeline_stage": run["pipeline_stage"],
        "pipeline_pass": "smoke",
        "reader_name": run["reader_name"],
        "retry_number": 0,
        "boundary_run": 1,
        "prompt_bundle_sha256": prompt_bundle_sha256,
        "schema_bundle_sha256": schema_bundle_sha256,
        "prompt_sha256": prompt_bundle_sha256,
        "schema_mode": "schema_free",
        "schema_sha256": None,
        "transport_schema_sha256": None,
        "request_sha256": _sha256_json(provider_payload),
        "requested_model": run["model_id"],
    }
    benchmark["call_id"] = _sha256_json(benchmark)
    payload["benchmark"] = benchmark

    def dispatch(**_kwargs: Any):
        response = requests.post(
            proxy_url,
            json=payload,
            headers={"Authorization": f"Bearer {token_provider()}"},
            timeout=60,
            allow_redirects=False,
        )
        if 300 <= response.status_code < 400:
            raise BenchmarkSafetyError(
                f"Candidate smoke call refused HTTP redirect {response.status_code}."
            )
        if response.status_code != 200:
            raise BenchmarkSafetyError(
                f"Candidate smoke call failed with HTTP {response.status_code}."
            )
        data = response.json()
        if data.get("model") != run["model_id"] or not data.get("response_id"):
            raise BenchmarkSafetyError("Candidate smoke response omitted exact provenance.")
        if data.get("release") != dict(expected_release):
            raise BenchmarkSafetyError("Candidate smoke response release changed after preflight.")
        usage = data.get("usage")
        if not isinstance(usage, dict):
            raise BenchmarkSafetyError("Candidate smoke response omitted usage and cost.")
        run.update({
            "status": "complete",
            "response": data.get("text"),
            "usage": usage,
            "prompt_bundle_sha256": prompt_bundle_sha256,
            "schema_bundle_sha256": schema_bundle_sha256,
            "provenance": {
                "call_id": benchmark["call_id"],
                "response_id": data["response_id"],
                "model": data["model"],
                "stop_reason": data.get("stop_reason"),
                "release": data.get("release"),
            },
        })
        return None, str(data.get("text", "")), usage

    cap.call(
        dispatch,
        {"smoke": run["model_id"]},
        model_key="smoke",
        system_blocks=[],
        user_blocks=payload["messages"],
        max_tokens=payload["max_tokens"],
    )


def _record_preflight_failure(run_id: str, error: BaseException) -> Path:
    failure_dir = ARTIFACTS_ROOT / "preflight-failures"
    _assert_benchmark_artifact_path(failure_dir)
    failure_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    failure_dir.chmod(0o700)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    path = failure_dir / f"{run_id}-{timestamp}.json"
    _atomic_write_json(path, {
            "benchmark_version": "lemon-model-benchmark-v1",
            "status": "failed",
            "run_id": run_id,
            "failed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "failure": {
                "stage": "preflight",
                "type": type(error).__name__,
                "message": _sanitize_failure_text(error),
            },
            "paid_calls_dispatched": 0,
            "actual_cost_microusd": 0,
            "actual_cost_usd": 0.0,
        })
    return path


def _atomic_write_json(path: Path, payload: Mapping[str, Any]) -> None:
    _assert_benchmark_artifact_path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.parent.chmod(0o700)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary = Path(handle.name)
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        temporary = None
        path.chmod(0o600)
        directory_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _validate_local_rejected_artifacts(
    run: Mapping[str, Any],
    run_dir: Path,
) -> None:
    usage = run.get("usage")
    calls = usage.get("calls") if isinstance(usage, dict) else None
    if not isinstance(calls, list):
        return
    failed_calls = usage.get("failed_calls") if isinstance(usage, dict) else None
    failed_calls = failed_calls if isinstance(failed_calls, list) else []
    all_call_records = [
        call for call in [*calls, *failed_calls] if isinstance(call, dict)
    ]
    source_records = [
        call for call in calls
        if isinstance(call, dict) and call.get("correction_replay") is not None
    ]
    linked_source_response_ids = set()
    for target in all_call_records:
        source_link = target.get("correction_source")
        if source_link is None:
            if target.get("correction_delivery_state") is not None:
                raise BenchmarkSafetyError(
                    "Correction delivery state lacks its source lineage."
                )
            continue
        if not isinstance(source_link, dict):
            raise BenchmarkSafetyError("Correction target source lineage is invalid.")
        matching_sources = [
            call for call in calls
            if isinstance(call, dict)
            and call.get("response_id") == source_link.get("source_response_id")
        ]
        source = matching_sources[0] if len(matching_sources) == 1 else None
        replay = source.get("correction_replay") if isinstance(source, dict) else None
        successful_target = any(target is call for call in calls)
        delivery_state = target.get("correction_delivery_state")
        target_response_id = target.get("response_id")
        response_id_status = (
            "available" if target_response_id is not None else "unavailable"
        )
        expected_source = {
            "source_response_id": source.get("response_id") if source else None,
            "source_request_sha256": source.get("request_sha256") if source else None,
            "source_attempt_number": source.get("attempt_number") if source else None,
            "rejected_output_sha256": (
                source.get("rejected_output_sha256") if source else None
            ),
            "rejected_artifact_sha256": (
                source.get("rejected_artifact_sha256") if source else None
            ),
            "replay_report_sha256": (
                replay.get("replay_report_sha256")
                if isinstance(replay, dict)
                else None
            ),
        }
        if (
            not isinstance(source, dict)
            or source["response_id"] in linked_source_response_ids
            or source_link != expected_source
            or not isinstance(replay, dict)
            or not correction_call_lineage_matches(source, target)
            or not correction_release_lineage_matches(
                source,
                target,
                successful=successful_target,
            )
            or delivery_state
            != correction_delivery_state_for_call(
                target,
                successful=successful_target,
            )
            or source.get("downstream_consumption") != (
                "correction_only"
                if delivery_state == "settled_after_dispatch"
                else "correction_attempted"
            )
            or replay.get("delivery_state") != delivery_state
            or replay.get("target_call_id") != target.get("call_id")
            or replay.get("target_response_id") != target_response_id
            or replay.get("target_response_id_status") != response_id_status
            or replay.get("target_request_sha256")
            != target.get("request_sha256")
            or replay.get("target_prompt_sha256") != target.get("prompt_sha256")
            or replay.get("target_attempt_number") != target.get("attempt_number")
        ):
            raise BenchmarkSafetyError(
                "Correction replay is not bound to one exact source and target call."
            )
        try:
            validate_correction_chronology(source, target)
        except ValueError as error:
            raise BenchmarkSafetyError(str(error)) from error
        linked_source_response_ids.add(source["response_id"])
    replay_source_response_ids = {
        call.get("response_id") for call in source_records
    }
    if linked_source_response_ids != replay_source_response_ids:
        raise BenchmarkSafetyError(
            "Correction replay source lacks one exact target call."
        )
    discarded_calls = [
        call
        for call in [*calls, *failed_calls]
        if isinstance(call, dict)
        and call.get("disposition") == "discarded_unusable"
    ]
    allowed_output_statuses = {
        "available",
        "unavailable_before_complete_response",
    }
    if any(
        call.get("rejected_output_status") not in allowed_output_statuses
        for call in discarded_calls
    ):
        raise BenchmarkSafetyError(
            "Every discarded call must declare exact rejected-output availability."
        )
    artifact_required_calls = [
        call
        for call in calls
        if isinstance(call, dict)
        and call.get("disposition") == "discarded_unusable"
    ] + [
        call
        for call in failed_calls
        if isinstance(call, dict)
        and call.get("disposition") == "discarded_unusable"
        and (
            call.get("failure_state") in {
                "model_provenance_mismatch",
                "candidate_call_id_mismatch",
                "candidate_release_mismatch",
                "missing_stop_reason",
            }
            or call.get("rejected_output_status") == "available"
        )
    ]
    for call in artifact_required_calls:
        if not all(
            isinstance(call.get(field), str) and call[field]
            for field in (
                "rejected_artifact_path",
                "rejected_artifact_sha256",
                "rejected_output_sha256",
            )
        ):
            raise BenchmarkSafetyError(
                "Every discarded settled call needs an exact private rejected artifact."
            )
    engine_root = run_dir / "engine"
    artifact_root_path = engine_root / "rejected-responses"
    if any(path.is_symlink() for path in (run_dir, engine_root, artifact_root_path)):
        raise BenchmarkSafetyError("Rejected artifact directory cannot be a symlink.")
    try:
        artifact_root = artifact_root_path.resolve(strict=True)
    except OSError as error:
        if any(
            isinstance(call, dict) and "rejected_artifact_path" in call
            for call in [*calls, *failed_calls]
        ):
            raise BenchmarkSafetyError("Rejected artifact directory is missing.") from error
        return
    for call in [*calls, *failed_calls]:
        if not isinstance(call, dict) or "rejected_artifact_path" not in call:
            continue
        raw_path = call.get("rejected_artifact_path")
        if not isinstance(raw_path, str):
            raise BenchmarkSafetyError("Rejected artifact path is invalid.")
        path = Path(raw_path)
        if path.is_symlink():
            raise BenchmarkSafetyError("Rejected artifact cannot be a symlink.")
        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(artifact_root)
        except (OSError, ValueError) as error:
            raise BenchmarkSafetyError(
                "Rejected artifact is missing or outside the private run root."
            ) from error
        if (
            stat.S_IMODE(artifact_root.stat().st_mode) != 0o700
            or stat.S_IMODE(resolved.stat().st_mode) != 0o600
        ):
            raise BenchmarkSafetyError("Rejected artifact permissions are not private.")
        encoded = resolved.read_bytes()
        if _sha256_bytes(encoded) != call.get("rejected_artifact_sha256"):
            raise BenchmarkSafetyError("Rejected artifact hash does not match the call.")
        try:
            artifact = json.loads(encoded)
        except json.JSONDecodeError as error:
            raise BenchmarkSafetyError("Rejected artifact is not valid JSON.") from error
        rejected_output = artifact.get("rejected_output")
        expected = {
            "stage": call.get("stage"),
            "attempt": int(call.get("logical_retry", 0)) + 1,
            "request_sha256": call.get("request_sha256"),
            "prompt_sha256": call.get("prompt_sha256"),
            "schema_sha256": call.get("schema_sha256"),
            "response_id": call.get("response_id"),
            "requested_model": call.get("requested_model"),
            "returned_model": call.get("returned_model"),
            "validation_rule": call.get("validation_reason"),
            "disposition": "discarded_unusable",
            "rejected_output_sha256": call.get("rejected_output_sha256"),
        }
        if (
            any(artifact.get(key) != value for key, value in expected.items())
            or _engine_output_sha256(rejected_output)
            != call.get("rejected_output_sha256")
        ):
            raise BenchmarkSafetyError(
                "Rejected artifact is not bound to its exact failed call."
            )
        replay = call.get("correction_replay")
        if replay is None:
            if call.get("downstream_consumption") in {
                "correction_attempted",
                "correction_only",
            }:
                raise BenchmarkSafetyError(
                    "Correction-only consumption lacks replay lineage."
                )
            continue
        tool_uses = [
            block
            for block in rejected_output
            if isinstance(block, dict) and block.get("type") == "tool_use"
        ] if isinstance(rejected_output, list) else []
        envelope = tool_uses[0].get("input") if len(tool_uses) == 1 else None
        expected_tool_name = (
            f"submit_{call.get('reader_name')}_report"
            if call.get("stage") == "reader"
            and call.get("reader_name") in READER_WEIGHTS
            else "submit_synthesis_report"
            if call.get("stage") == "synthesis"
            else None
        )
        if (
            expected_tool_name is None
            or len(tool_uses) != 1
            or tool_uses[0].get("name") != expected_tool_name
            or not isinstance(envelope, dict)
            or set(envelope) != {
                "contract", "application_schema_sha256", "report_json"
            }
            or envelope.get("contract") != expected_tool_name
            or envelope.get("application_schema_sha256")
            != call.get("schema_sha256")
        ):
            raise BenchmarkSafetyError(
                "Correction replay source does not match its exact tool and schema."
            )
        try:
            replay_report = json.loads(envelope["report_json"])
        except (KeyError, TypeError, json.JSONDecodeError) as error:
            raise BenchmarkSafetyError(
                "Correction replay report is not valid JSON."
            ) from error
        replay_report_sha256 = _engine_output_sha256(replay_report)
        matching_targets = [
            record
            for record in all_call_records
            if record.get("request_sha256")
            == replay.get("target_request_sha256")
            and record.get("call_id") == replay.get("target_call_id")
        ]
        target = matching_targets[0] if len(matching_targets) == 1 else None
        expected_source = {
            "source_response_id": call.get("response_id"),
            "source_request_sha256": call.get("request_sha256"),
            "source_attempt_number": call.get("attempt_number"),
            "rejected_output_sha256": call.get("rejected_output_sha256"),
            "rejected_artifact_sha256": call.get("rejected_artifact_sha256"),
            "replay_report_sha256": replay_report_sha256,
        }
        delivery_state = replay.get("delivery_state")
        expected_downstream = (
            "correction_only"
            if delivery_state == "settled_after_dispatch"
            else "correction_attempted"
        )
        target_response_id = target.get("response_id") if isinstance(target, dict) else None
        if (
            delivery_state not in {
                "settled_after_dispatch",
                "uncertain_after_dispatch",
            }
            or call.get("downstream_consumption") != expected_downstream
            or not isinstance(target, dict)
            or target.get("correction_source") != expected_source
            or target.get("correction_delivery_state") != delivery_state
            or replay != {
                "delivery_state": delivery_state,
                "target_call_id": target.get("call_id"),
                "target_response_id": target_response_id,
                "target_response_id_status": (
                    "available" if target_response_id is not None else "unavailable"
                ),
                "target_request_sha256": target.get("request_sha256"),
                "target_prompt_sha256": target.get("prompt_sha256"),
                "target_attempt_number": target.get("attempt_number"),
                "replay_report_sha256": replay_report_sha256,
            }
        ):
            raise BenchmarkSafetyError(
                "Correction replay is not bound to its source and target calls."
            )


def _refresh_manifest_cost_totals(manifest: Dict[str, Any]) -> None:
    actual_microusd = 0
    estimated_nanousd = 0
    rounding_nanousd = 0
    exact = True
    for item in manifest.get("runs", []):
        if not isinstance(item, dict):
            continue
        usage = item.get("usage")
        if item.get("status") == "failed":
            usage = _reconciled_failure_usage(item, usage)
        if item.get("status") in {"complete", "failed"} and isinstance(usage, dict):
            records = [usage]
        else:
            journal = item.get("checkpointed_calls")
            records = [
                entry["usage"]
                for entry in journal if isinstance(entry, dict)
                and isinstance(entry.get("usage"), dict)
            ] if isinstance(journal, list) else []
        for record in records:
            charged = record.get("actual_cost_microusd")
            if type(charged) is not int or charged < 0:
                exact = False
                continue
            actual_microusd += charged
            estimated = record.get("estimated_cost_nanousd")
            variance = record.get("rounding_variance_nanousd")
            if (
                type(estimated) is not int
                or estimated < 0
                or type(variance) is not int
                or variance < 0
                or charged * 1_000 - estimated != variance
            ):
                exact = False
                continue
            estimated_nanousd += estimated
            rounding_nanousd += variance
    manifest.update({
        "actual_cost_microusd": actual_microusd,
        "actual_cost_usd": actual_microusd / 1_000_000,
        "estimated_cost_nanousd": estimated_nanousd if exact else None,
        "estimated_cost_usd": (
            estimated_nanousd / 1_000_000_000 if exact else None
        ),
        "rounding_variance_nanousd": rounding_nanousd if exact else None,
        "rounding_variance_usd": (
            rounding_nanousd / 1_000_000_000 if exact else None
        ),
        "independent_cost_status": (
            "complete" if exact else "unavailable_for_unsettled_spend"
        ),
    })


def _checkpoint_run_call(
    manifest: Dict[str, Any],
    run: Dict[str, Any],
    artifact_path: Path,
    call: Dict[str, Any],
    lock: threading.Lock,
) -> None:
    """Atomically upsert one settled call before downstream processing continues."""
    call_id = call.get("call_id")
    if not isinstance(call_id, str) or not call_id:
        raise BenchmarkSafetyError("A benchmark call checkpoint omitted its call ID.")
    if any(
        field in call
        for field in ("text", "messages", "system", "tool_uses", "rejected_output")
    ):
        raise BenchmarkSafetyError("A benchmark checkpoint contained screenplay payload data.")
    with lock:
        checkpoints = run.setdefault("checkpointed_calls", [])
        if not isinstance(checkpoints, list):
            raise BenchmarkSafetyError("Benchmark call checkpoints are invalid.")
        by_id = {
            item.get("call_id"): item
            for item in checkpoints
            if isinstance(item, dict) and isinstance(item.get("call_id"), str)
        }
        by_id[call_id] = copy.deepcopy(call)
        run["checkpointed_calls"] = [by_id[key] for key in sorted(by_id)]

        _refresh_manifest_cost_totals(manifest)
        _atomic_write_json(artifact_path, manifest)


def _run_identity(run: Mapping[str, Any]) -> Dict[str, Any]:
    return {
        key: run.get(key)
        for key in (
            "input_sha256", "input_filename", "route", "generation",
            "model_id", "sonnet_model_id", "opus_model_id",
            "promotion_verdicts", "pipeline_stage", "reader_name",
        )
        if run.get(key) is not None
    }


def _model_configuration(run: Mapping[str, Any]) -> Dict[str, Any]:
    return {
        key: run[key]
        for key in (
            "route",
            "generation",
            "model_id",
            "sonnet_model_id",
            "opus_model_id",
            "promotion_verdicts",
        )
        if key in run
    }


def _validate_completed_run_lock(
    run: Mapping[str, Any],
    *,
    contracts: Mapping[str, Any],
    release: Mapping[str, Any],
    authorized_benchmark_cap_microusd: int,
) -> None:
    required_mappings = (
        "analysis",
        "usage",
        "source_evidence",
        "parser_metadata",
        "trust_seal",
        "output_lock",
        "model_ids",
        "local_source_proof",
    )
    if any(not isinstance(run.get(field), dict) for field in required_mappings):
        raise BenchmarkSafetyError(
            "Resume stopped because a completed run lacks its immutable lock evidence."
        )
    effective_model_tier = run.get("effective_model_tier")
    if not isinstance(effective_model_tier, str) or not effective_model_tier:
        raise BenchmarkSafetyError(
            "Resume stopped because a completed run lacks its effective model tier."
        )
    if run.get("release") != dict(release):
        raise BenchmarkSafetyError(
            "Resume stopped because a completed run has different release evidence."
        )

    analysis = run["analysis"]
    usage = run["usage"]
    source = run["source_evidence"]
    parser_metadata = run["parser_metadata"]
    trust_seal = run["trust_seal"]
    output_lock = run["output_lock"]
    model_ids = run["model_ids"]
    local_source_proof = run["local_source_proof"]
    model_configuration = _model_configuration(run)
    expected_lock = {
        "source_sha256": run.get("input_sha256"),
        "page_evidence_sha256": source.get("page_evidence_sha256"),
        "scene_count_evidence_sha256": (
            (source.get("scene_count_evidence") or {}).get("evidence_sha256")
            if isinstance(source.get("scene_count_evidence"), dict)
            else None
        ),
        "model_configuration": model_configuration,
        "model_configuration_sha256": _sha256_json(model_configuration),
        "contract_bundle": dict(contracts),
        "local_source_proof": local_source_proof,
        "trust_seal_integrity_sha256": trust_seal.get("integrity_sha256"),
        "analysis_sha256": _sha256_json(analysis),
        "usage_sha256": _sha256_json(usage),
        "verdict": analysis.get("verdict"),
    }
    locked_at = output_lock.get("locked_at")
    if not isinstance(locked_at, str) or any(
        output_lock.get(field) != value
        for field, value in expected_lock.items()
    ):
        raise BenchmarkSafetyError(
            "Resume stopped because a completed run output lock was altered."
        )
    machine_output_sha256 = _sha256_json({
        "locked_at": locked_at,
        "source_evidence": source,
        "model_configuration": model_configuration,
        "contracts": contracts,
        "analysis": analysis,
        "usage": usage,
        "trust_seal": trust_seal,
    })
    if output_lock.get("machine_output_sha256") != machine_output_sha256:
        raise BenchmarkSafetyError(
            "Resume stopped because a completed machine output hash was altered."
        )
    provenance = run.get("provenance")
    calls = usage.get("calls")
    checkpointed_calls = run.get("checkpointed_calls")
    if (
        not isinstance(provenance, dict)
        or not isinstance(calls, list)
        or not isinstance(checkpointed_calls, list)
        or provenance.get("calls") != calls
        or provenance.get("response_ids") != [call.get("response_id") for call in calls]
        or {
            call.get("call_id"): call
            for call in checkpointed_calls
            if isinstance(call, dict)
        } != {
            call.get("call_id"): call
            for call in calls
            if isinstance(call, dict)
        }
    ):
        raise BenchmarkSafetyError(
            "Resume stopped because completed call provenance was altered."
        )

    from execution.trust_manifest import validate_benchmark_trust_seal

    try:
        validate_benchmark_trust_seal(
            trust_seal,
            analysis=analysis,
            usage=usage,
            source=source,
            parser_metadata=parser_metadata,
            route=str(run.get("route")),
            effective_model_tier=effective_model_tier,
            model_ids=model_ids,
            contracts=dict(contracts),
            release=dict(release),
            local_source_proof=local_source_proof,
            authorized_benchmark_cap_microusd=(
                authorized_benchmark_cap_microusd
            ),
        )
    except (TypeError, ValueError) as error:
        raise BenchmarkSafetyError(
            "Resume stopped because a completed run trust seal is invalid."
        ) from error


def _resumable_runs(runs: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    pending: List[Dict[str, Any]] = []
    for run in runs:
        status = run.get("status")
        if status == "complete":
            continue
        if status != "planned":
            raise BenchmarkSafetyError(
                "Resume stopped because a paid run is failed or in progress; "
                "its provider state requires manual review."
            )
        pending.append(run)
    return pending


def _validate_resume_budget_journal(manifest: Mapping[str, Any]) -> None:
    journal = manifest.get("budget_checks")
    if not isinstance(journal, list):
        raise BenchmarkSafetyError(
            "Resume stopped because the audit-wide budget journal is missing."
        )
    expected: List[Dict[str, Any]] = []
    for run in manifest.get("runs", []):
        if not isinstance(run, dict) or run.get("status") != "complete":
            continue
        usage = run.get("usage")
        calls = usage.get("calls") if isinstance(usage, dict) else None
        if not isinstance(calls, list):
            raise BenchmarkSafetyError(
                "Resume stopped because completed call receipts are missing."
            )
        for call in calls:
            check = call.get("budget_check") if isinstance(call, dict) else None
            if not isinstance(check, dict):
                raise BenchmarkSafetyError(
                    "Resume stopped because a completed call lacks its budget receipt."
                )
            expected.append(check)
    if journal != expected:
        raise BenchmarkSafetyError(
            "Resume stopped because the audit-wide budget journal does not match "
            "completed call receipts."
        )

    cap = manifest.get("cost_cap_microusd")
    if type(cap) is not int or cap <= 0:
        raise BenchmarkSafetyError("Resume budget cap is invalid.")
    spent = 0
    reserved = 0
    for sequence, check in enumerate(journal, start=1):
        if (
            check.get("sequence") != sequence
            or check.get("spent_before_microusd") != spent
            or check.get("reserved_before_microusd") != reserved
            or check.get("remaining_before_microusd") != cap - spent - reserved
            or check.get("decision") != "settled"
            or type(check.get("settled_cost_microusd")) is not int
            or check["settled_cost_microusd"] < 0
            or check.get("spent_after_microusd")
            != spent + check["settled_cost_microusd"]
            or check.get("reserved_after_microusd") != reserved
        ):
            raise BenchmarkSafetyError(
                "Resume stopped because the audit-wide budget sequence or state "
                "handoff is invalid."
            )
        spent = check["spent_after_microusd"]
        reserved = check["reserved_after_microusd"]
    if reserved != 0 or manifest.get("actual_cost_microusd") != spent:
        raise BenchmarkSafetyError(
            "Resume stopped because the audit-wide budget journal total is invalid."
        )


def _validate_resume_ledger(
    manifest: Mapping[str, Any],
    ledger: Mapping[str, Any],
) -> None:
    calls = ledger.get("calls")
    if not isinstance(calls, list):
        raise BenchmarkSafetyError("Resume preflight omitted the server call ledger.")
    server_calls = {
        call.get("call_id"): call
        for call in calls
        if isinstance(call, dict) and isinstance(call.get("call_id"), str)
    }
    local_calls: Dict[
        str,
        tuple[Dict[str, Any], Dict[str, Any], str],
    ] = {}
    for run in manifest.get("runs", []):
        if not isinstance(run, dict):
            continue
        records = (
            (run.get("provenance") or {}).get("calls", [])
            if run.get("status") in {"complete", "failed"}
            else run.get("checkpointed_calls", [])
            if run.get("status") == "running"
            else []
        )
        if not isinstance(records, list):
            continue
        for call in records:
            call_id = call.get("call_id") if isinstance(call, dict) else None
            if not isinstance(call_id, str):
                continue
            if call_id in local_calls:
                raise BenchmarkSafetyError(
                    "Resume stopped because a call ID appears in more than one local run."
                )
            local_calls[call_id] = (call, run, "settled")
        if run.get("status") != "failed":
            continue
        failed_records = (run.get("provenance") or {}).get("failed_calls", [])
        if not isinstance(failed_records, list):
            continue
        for call in failed_records:
            call_id = call.get("call_id") if isinstance(call, dict) else None
            if not isinstance(call_id, str):
                continue
            failure_state = call.get("failure_state")
            if failure_state in {
                "provider_rejected_before_generation",
                "candidate_provider_configuration_unavailable",
            }:
                expected_status = "rejected"
            elif failure_state in {
                "model_provenance_mismatch",
                "candidate_release_mismatch",
                "missing_stop_reason",
            }:
                expected_status = "settled"
            elif (
                failure_state == "benchmark_spend_uncertain"
                and call.get("uncertainty_status") == "charged_reservation"
            ):
                expected_status = "uncertain"
            elif (
                failure_state == "benchmark_spend_uncertain"
                and call.get("uncertainty_status")
                == "settled_after_ambiguous_ack"
            ):
                expected_status = "settled"
            elif (
                failure_state == "benchmark_spend_uncertain"
                and call.get("uncertainty_status") == "reservation_held"
            ):
                raise BenchmarkSafetyError(
                    "Resume stopped because a provider reservation is still held."
                )
            else:
                continue
            if call_id in local_calls:
                raise BenchmarkSafetyError(
                    "Resume stopped because a call ID appears twice locally."
                )
            local_calls[call_id] = (call, run, expected_status)
    if set(server_calls) != set(local_calls):
        raise BenchmarkSafetyError(
            "Resume stopped because local and server call ledgers differ."
        )
    contracts = manifest.get("contracts")
    contracts = contracts if isinstance(contracts, dict) else {}
    for call_id, (local, run, expected_status) in local_calls.items():
        server = server_calls[call_id]
        local_usage = local.get("usage") if isinstance(local.get("usage"), dict) else {}
        local_budget_check = (
            local.get("budget_check")
            if isinstance(local.get("budget_check"), dict)
            else {}
        )
        server_usage = (
            server.get("usage") if isinstance(server.get("usage"), dict) else {}
        )
        common_mismatch = (
            server.get("status") != expected_status
            or server.get("requested_model") != local.get("requested_model")
            or server.get("request_sha256") != local.get("request_sha256")
            or server.get("prompt_sha256") != local.get("prompt_sha256")
            or server.get("schema_mode") != local.get("schema_mode")
            or server.get("schema_sha256") != local.get("schema_sha256")
            or server.get("transport_schema_sha256")
            != local.get("transport_schema_sha256")
            or server.get("screenplay_sha256") != run.get("input_sha256")
            or server.get("route") != run.get("route")
            or server.get("generation") != run.get("generation")
            or server.get("pipeline_stage") != local.get("stage")
            or server.get("pipeline_pass") != local.get("pipeline_pass")
            or server.get("reader_name") != local.get("reader_name")
            or server.get("retry_number") != local.get("logical_retry")
            or server.get("boundary_run") != local.get("boundary_run")
            or server.get("prompt_bundle_sha256")
            != contracts.get("prompt_bundle_sha256")
            or server.get("schema_bundle_sha256")
            != contracts.get("schema_bundle_sha256")
            or type(server.get("reservation_ceiling_microusd")) is not int
            or server.get("reservation_ceiling_microusd") <= 0
            or server.get("reservation_ceiling_microusd")
            > local_budget_check.get("request_ceiling_microusd", -1)
            or server.get("reserved_microusd") != 0
        )
        settled_mismatch = expected_status == "settled" and (
            server.get("returned_model") != local.get("returned_model")
            or server.get("response_id") != local.get("response_id")
            or server.get("stop_reason") != local.get("stop_reason")
            or server.get("actual_cost_microusd")
            != local_usage.get("actual_cost_microusd")
            or server.get("charged_cost_microusd")
            != local_usage.get("charged_cost_microusd")
            or server.get("estimated_cost_nanousd")
            != local_usage.get("estimated_cost_nanousd")
            or server.get("rounding_variance_nanousd")
            != local_usage.get("rounding_variance_nanousd")
            or server.get("rounding_reason")
            != local_usage.get("rounding_reason")
            or any(
                server_usage.get(field) != local_usage.get(field)
                for field in (
                    "input_tokens",
                    "output_tokens",
                    "cache_creation_input_tokens",
                    "cache_read_input_tokens",
                )
            )
            or server_usage.get("cache_creation")
            != local_usage.get("cache_creation")
            or server_usage.get("inference_geo")
            != local_usage.get("inference_geo")
            or server_usage.get("service_tier")
            != local_usage.get("service_tier")
            or server_usage.get("normalizations", [])
            != local_usage.get("normalizations", [])
        )
        expected_rejection_kind = (
            "candidate_provider_configuration_before_dispatch"
            if local.get("failure_state")
            == "candidate_provider_configuration_unavailable"
            else "anthropic_invalid_request_before_generation"
        )
        rejected_mismatch = expected_status == "rejected" and (
            server.get("rejection_kind")
            != expected_rejection_kind
            or server.get("disposition") != "released_before_generation"
            or server.get("validation_failure_code")
            != local.get("validation_failure_code")
            or server.get("validation_failure_reason")
            != local.get("validation_failure_reason")
            or server.get("provider_error_sha256")
            != local.get("provider_error_sha256")
            or server.get("configuration_error_sha256")
            != local.get("configuration_error_sha256")
            or server.get("settlement_error_sha256")
            != local.get("settlement_error_sha256")
            or server.get("reserved_microusd") != 0
            or server.get("actual_cost_microusd") != 0
            or server.get("charged_cost_microusd") != 0
            or any(
                local_usage.get(field) != value
                for field, value in (
                    ("input_tokens", 0),
                    ("output_tokens", 0),
                    ("cache_creation_input_tokens", 0),
                    ("cache_read_input_tokens", 0),
                    ("actual_cost_microusd", 0),
                )
            )
        )
        uncertain_mismatch = expected_status == "uncertain" and (
            server.get("returned_model") != local.get("returned_model")
            or server.get("response_id") != local.get("response_id")
            or server.get("stop_reason") != local.get("stop_reason")
            or server.get("charged_cost_microusd")
            != local.get("charged_cost_microusd")
            or server.get("charged_cost_microusd")
            != local.get("cap_cost_microusd")
            or server.get("provider_usage")
            != local.get("provider_usage_unverified")
            or server.get("provider_usage_validation")
            != local.get("provider_usage_validation")
            or server.get("validation_failure_code")
            != local.get("validation_failure_code")
            or server.get("validation_failure_reason")
            != local.get("validation_reason")
            or server.get("provider_error_sha256")
            != local.get("provider_error_sha256")
            or server.get("settlement_error_sha256")
            != local.get("settlement_error_sha256")
        )
        if (
            common_mismatch
            or settled_mismatch
            or rejected_mismatch
            or uncertain_mismatch
        ):
            raise BenchmarkSafetyError(
                "Resume stopped because a completed call does not reconcile."
            )
    settled_count = sum(
        status == "settled"
        for _call, _run, status in local_calls.values()
    )
    uncertain_calls = [
        call
        for call, _run, status in local_calls.values()
        if status == "uncertain"
    ]
    uncertain_count = len(uncertain_calls)
    uncertain_spend = sum(
        int(call.get("charged_cost_microusd", -1))
        for call in uncertain_calls
    )
    run_ledger = ledger.get("run")
    if local_calls:
        if not isinstance(run_ledger, dict):
            raise BenchmarkSafetyError("Resume preflight omitted the server run ledger.")
        local_cost = int(manifest.get("actual_cost_microusd", -1))
        if (
            run_ledger.get("reserved_microusd") != 0
            or run_ledger.get("uncertain_call_count") != uncertain_count
            or run_ledger.get("uncertain_spend_microusd") != uncertain_spend
            or run_ledger.get("spent_microusd") != local_cost
            or run_ledger.get("call_count") != settled_count
        ):
            raise BenchmarkSafetyError(
                "Resume stopped because the server run ledger is unsettled."
            )
    elif isinstance(run_ledger, dict) and any(
        int(run_ledger.get(field, 0)) != 0
        for field in (
            "spent_microusd",
            "reserved_microusd",
            "call_count",
            "uncertain_call_count",
            "uncertain_spend_microusd",
        )
    ):
        raise BenchmarkSafetyError(
            "Resume stopped because the server has unrecorded paid activity."
        )
    audit_ledger = ledger.get("audit")
    expected_audit_spend = int(
        manifest.get("prior_audit_spend_microusd", -1)
    ) + int(manifest.get("actual_cost_microusd", -1))
    expected_audit_uncertain_count = int(
        manifest.get("prior_audit_uncertain_call_count", -1)
    ) + uncertain_count
    expected_audit_uncertain_spend = int(
        manifest.get("prior_audit_uncertain_spend_microusd", -1)
    ) + uncertain_spend
    if (
        not isinstance(audit_ledger, dict)
        or audit_ledger.get("reserved_microusd") != 0
        or audit_ledger.get("uncertain_call_count")
        != expected_audit_uncertain_count
        or audit_ledger.get("uncertain_spend_microusd")
        != expected_audit_uncertain_spend
        or audit_ledger.get("spent_microusd") != expected_audit_spend
        or audit_ledger.get("call_count")
        != int(manifest.get("prior_audit_call_count", -1)) + settled_count
    ):
        raise BenchmarkSafetyError(
            "Resume stopped because the cumulative audit ledger is unsettled."
        )


def _validate_resume_manifest(
    manifest: Mapping[str, Any],
    *,
    inputs: Sequence[Mapping[str, Any]],
    planned_runs: Sequence[Mapping[str, Any]],
    contracts: Mapping[str, Any],
    release: Mapping[str, Any],
    max_cost_usd: float,
    prior_audit_spend_usd: float,
    calibration: Mapping[str, Any],
    ledger: Mapping[str, Any] | None,
) -> None:
    expected_inputs = [
        {key: value for key, value in item.items() if key != "path"}
        for item in inputs
    ]
    if manifest.get("inputs") != expected_inputs:
        raise BenchmarkSafetyError("Resume source identity does not match the manifest.")
    existing_runs = manifest.get("runs")
    if (
        not isinstance(existing_runs, list)
        or [_run_identity(run) for run in existing_runs]
        != [_run_identity(run) for run in planned_runs]
    ):
        raise BenchmarkSafetyError("Resume route matrix does not match the manifest.")
    if manifest.get("contracts") != dict(contracts):
        raise BenchmarkSafetyError("Resume contracts do not match the manifest.")
    if manifest.get("calibration") != dict(calibration):
        raise BenchmarkSafetyError("Resume calibration does not match the manifest.")
    prior_preflight = manifest.get("candidate_preflight")
    prior_release = (
        prior_preflight.get("release")
        if isinstance(prior_preflight, dict)
        else None
    )
    if prior_release != dict(release):
        raise BenchmarkSafetyError("Resume release does not match the manifest.")
    if (
        manifest.get("cost_cap_microusd") != int(Decimal(str(max_cost_usd)) * 1_000_000)
        or manifest.get("prior_audit_spend_microusd")
        != int(Decimal(str(prior_audit_spend_usd)) * 1_000_000)
    ):
        raise BenchmarkSafetyError("Resume budget does not match the manifest.")
    for run in existing_runs:
        if run.get("status") == "complete":
            _validate_completed_run_lock(
                run,
                contracts=contracts,
                release=release,
                authorized_benchmark_cap_microusd=manifest[
                    "cost_cap_microusd"
                ],
            )
    _validate_resume_budget_journal(manifest)
    if ledger is not None:
        _validate_resume_ledger(manifest, ledger)
    _resumable_runs(existing_runs)


def build_manifest(args: argparse.Namespace) -> tuple[Path, Dict[str, Any]]:
    if getattr(args, "execute", False) and getattr(args, "smoke", False):
        raise BenchmarkSafetyError(
            "Paid smoke mode is disabled because it lacks full trust provenance."
        )
    if getattr(args, "execute", False) and getattr(
        args,
        "calibration_prompt_file",
        None,
    ):
        raise BenchmarkSafetyError(
            "Paid trust benchmarking must lock blinded machine output before calibration."
        )
    route = getattr(args, "route", None)
    generation = getattr(args, "generation", None)
    if getattr(args, "execute", False) and (
        route not in {"sonnet", "opus", "hybrid"}
        or generation not in {"old", "candidate"}
    ):
        raise BenchmarkSafetyError(
            "Paid execution requires one explicit --route and --generation; "
            "all/both matrices are refused."
        )
    _assert_benchmark_artifact_path(ARTIFACTS_ROOT)
    ARTIFACTS_ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    run_id = args.run_id or str(uuid.uuid4())
    if not OPAQUE_RUN_ID_PATTERN.fullmatch(run_id):
        raise BenchmarkSafetyError(
            "--run-id must be an opaque UUIDv4 or lowercase SHA-256 value."
        )
    resume = bool(getattr(args, "resume", False))
    if resume and not args.execute:
        raise BenchmarkSafetyError("--resume is available only for paid execution.")
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    inputs = _validated_inputs(args.input, args.approve_sha256)
    if args.smoke and len(inputs) != 1:
        raise BenchmarkSafetyError("Smoke mode requires exactly one approved local PDF.")
    calibration_prompt = None
    calibration_sha256 = None
    if args.calibration_prompt_file:
        prompt_path = Path(args.calibration_prompt_file).expanduser().resolve()
        calibration_prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not calibration_prompt:
            raise BenchmarkSafetyError("Calibration prompt file is empty.")
        calibration_sha256 = _sha256_bytes(calibration_prompt.encode("utf-8"))

    if args.smoke and args.calibration_prompt_file:
        raise BenchmarkSafetyError("Smoke mode does not accept a calibration prompt.")
    route_configs = _smoke_route_configs(catalog) if args.smoke else _route_configs(
        catalog, route or "all", generation or "both"
    )

    token_provider: Any = None
    candidate_preflight: Dict[str, Any] | None = None
    deployment_receipt: Dict[str, Any] | None = None
    local_source_before: Dict[str, Any] | None = None
    prior_audit_spend_usd = float(
        getattr(args, "prior_audit_spend_usd", 0.106425)
    )
    budget_microusd = (0, 0)
    prior_audit_call_count = 0
    prior_audit_uncertain_call_count = 0
    prior_audit_uncertain_spend_microusd = 0
    try:
        if args.execute:
            if not args.i_understand_paid_inference:
                raise BenchmarkSafetyError(
                    "Paid execution requires --i-understand-paid-inference."
                )
            budget_microusd = _validated_audit_budget(
                args.max_cost_usd,
                prior_audit_spend_usd,
            )
            _validate_candidate_proxy(args.proxy_url)
            if not args.run_id:
                raise BenchmarkSafetyError(
                    "Paid execution requires an explicit immutable --run-id."
                )
            if not _is_lower_hex(args.expected_git_sha, 40):
                raise BenchmarkSafetyError(
                    "Paid execution requires --expected-git-sha with the approved full SHA."
                )
            local_source_before = _verify_local_source(args.expected_git_sha)
            if not args.caller_service_account:
                raise BenchmarkSafetyError(
                    "Online execution requires --caller-service-account."
                )
            if not args.verify_isolation:
                raise BenchmarkSafetyError(
                    "Online execution requires --verify-isolation before paid calls."
                )
            if not _is_lower_hex(args.expected_catalog_sha256, 64):
                raise BenchmarkSafetyError(
                    "Online execution requires --expected-catalog-sha256."
                )
            if args.expected_catalog_sha256 != _catalog_sha256():
                raise BenchmarkSafetyError(
                    "--expected-catalog-sha256 does not match the local committed catalog."
                )
            deployment_receipt = _load_deployment_receipt(
                getattr(args, "deployment_receipt_file", None),
                getattr(args, "expected_deployment_receipt_sha256", None),
                proxy_url=args.proxy_url,
                expected_git_sha=args.expected_git_sha,
                expected_catalog_sha256=args.expected_catalog_sha256,
                run_id=run_id,
                cap_microusd=budget_microusd[0],
                prior_audit_spend_microusd=budget_microusd[1],
                catalog=catalog,
            )
            token_provider = IdentityTokenProvider(
                args.proxy_url,
                args.caller_service_account,
            )
            candidate_preflight = _candidate_preflight(
                args.proxy_url,
                token_provider,
                run_id,
                args.max_cost_usd,
                args.verify_isolation,
                args.expected_git_sha,
                args.expected_catalog_sha256,
                prior_audit_spend_usd,
                True,
                deployment_receipt,
            )
            ledger = candidate_preflight["ledger"]
            if not resume and (
                ledger.get("run") is not None or ledger.get("calls")
            ):
                raise BenchmarkSafetyError(
                    "Server ledger already contains this run ID; use the exact local "
                    "manifest with --resume."
                )
            if not resume:
                audit = ledger.get("audit")
                if audit is None:
                    if budget_microusd[1] != SETTLED_PRIOR_PILOT_MICROUSD:
                        raise BenchmarkSafetyError(
                            "Cumulative audit call history is missing for declared prior spend."
                        )
                    prior_audit_call_count = SETTLED_PRIOR_PILOT_CALL_COUNT
                elif (
                    not isinstance(audit, dict)
                    or audit.get("spent_microusd") != budget_microusd[1]
                    or audit.get("reserved_microusd") != 0
                    or type(audit.get("call_count")) is not int
                    or audit["call_count"] < SETTLED_PRIOR_PILOT_CALL_COUNT
                    or type(audit.get("uncertain_call_count")) is not int
                    or audit["uncertain_call_count"] < 0
                    or type(audit.get("uncertain_spend_microusd")) is not int
                    or audit["uncertain_spend_microusd"] < 0
                    or audit["uncertain_spend_microusd"] > budget_microusd[1]
                    or (audit["uncertain_call_count"] == 0)
                    != (audit["uncertain_spend_microusd"] == 0)
                ):
                    raise BenchmarkSafetyError(
                        "Cumulative audit ledger does not match declared prior activity."
                    )
                else:
                    prior_audit_call_count = audit["call_count"]
                    prior_audit_uncertain_call_count = audit[
                        "uncertain_call_count"
                    ]
                    prior_audit_uncertain_spend_microusd = audit[
                        "uncertain_spend_microusd"
                    ]
    except Exception as error:
        _record_preflight_failure(run_id, error)
        raise

    run_dir = ARTIFACTS_ROOT / run_id
    artifact_path = run_dir / "benchmark-manifest.json"
    _assert_benchmark_artifact_path(artifact_path)
    if resume:
        if not artifact_path.is_file():
            raise BenchmarkSafetyError("Resume manifest does not exist.")
    else:
        run_dir.mkdir(mode=0o700, parents=True)
        ARTIFACTS_ROOT.chmod(0o700)
        run_dir.chmod(0o700)
    engine = _load_engine(run_dir)
    contracts = _contract_data(engine)
    planned_runs = [
        {
            **route,
            "input_sha256": input_record["content_sha256"],
            "input_filename": input_record["filename"],
            "status": "planned",
            "contract_bundle": {
                "prompt_bundle_sha256": contracts["prompt_bundle_sha256"],
                "schema_bundle_sha256": contracts["schema_bundle_sha256"],
            },
            "provenance": {"calls": [], "response_ids": []},
            "usage": _empty_usage(),
        }
        for input_record in inputs
        for route in route_configs
    ]
    calibration = {
        "applied": calibration_prompt is not None,
        "prompt_sha256": calibration_sha256,
        "prompt_stored": False,
    }
    new_manifest: Dict[str, Any] = {
        "benchmark_version": "lemon-model-benchmark-v1",
        "status": "dry_run" if not args.execute else "running",
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "dry_run": not args.execute,
        "production_persistence": "disabled_by_design",
        "inputs": [
            {key: value for key, value in item.items() if key != "path"}
            for item in inputs
        ],
        "route_configurations": route_configs,
        "contracts": contracts,
        "calibration": calibration,
        "cost_cap_usd": args.max_cost_usd if args.execute else 0.0,
        "cost_cap_microusd": budget_microusd[0] if args.execute else 0,
        "prior_audit_spend_usd": prior_audit_spend_usd if args.execute else 0.0,
        "prior_audit_spend_microusd": budget_microusd[1] if args.execute else 0,
        "prior_audit_call_count": prior_audit_call_count if args.execute else 0,
        "prior_audit_uncertain_call_count": (
            prior_audit_uncertain_call_count if args.execute else 0
        ),
        "prior_audit_uncertain_spend_microusd": (
            prior_audit_uncertain_spend_microusd if args.execute else 0
        ),
        "authorized_audit_ceiling_microusd": AUDIT_CEILING_MICROUSD,
        "actual_cost_microusd": 0,
        "actual_cost_usd": 0.0,
        "budget_checks": [],
        "candidate_preflight": candidate_preflight,
        "deployment_receipt": deployment_receipt,
        "local_source_before": local_source_before,
        "runs": planned_runs,
    }
    if resume:
        manifest = json.loads(artifact_path.read_text(encoding="utf-8"))
        for stored_run in manifest.get("runs", []):
            if isinstance(stored_run, dict) and stored_run.get("status") == "complete":
                _validate_local_rejected_artifacts(stored_run, run_dir)
        assert candidate_preflight is not None
        if manifest.get("deployment_receipt") != deployment_receipt:
            raise BenchmarkSafetyError(
                "Resume platform deployment receipt does not match the manifest."
            )
        _validate_resume_manifest(
            manifest,
            inputs=inputs,
            planned_runs=planned_runs,
            contracts=contracts,
            release=candidate_preflight["release"],
            max_cost_usd=args.max_cost_usd,
            prior_audit_spend_usd=prior_audit_spend_usd,
            calibration=calibration,
            ledger=(
                candidate_preflight.get("ledger")
                if isinstance(candidate_preflight.get("ledger"), dict)
                else None
            ),
        )
        manifest["resume_preflight"] = candidate_preflight
        manifest["resumed_at"] = datetime.now(timezone.utc).isoformat().replace(
            "+00:00", "Z"
        )
        runs = manifest["runs"]
    else:
        manifest = new_manifest
        runs = planned_runs
    _atomic_write_json(artifact_path, manifest)

    if args.execute:
        assert token_provider is not None
        assert candidate_preflight is not None
        assert local_source_before is not None
        assert deployment_receipt is not None
        cap = LocalCostCap(
            args.max_cost_usd,
            catalog,
            lambda: _paid_dispatch_platform_recheck(
                args.proxy_url,
                args.expected_git_sha,
                args.expected_catalog_sha256,
                deployment_receipt,
            ),
            engine.effective_max_tokens,
        )
        checkpoint_lock = threading.Lock()
        if resume:
            cap.spent_microusd = int(manifest.get("actual_cost_microusd", 0))
            cap.checks = manifest["budget_checks"]
        for run in _resumable_runs(runs):
            input_record = next(
                item for item in inputs if item["content_sha256"] == run["input_sha256"]
            )
            run["status"] = "running"
            manifest["status"] = "running"
            _atomic_write_json(artifact_path, manifest)
            try:
                if args.smoke:
                    _run_smoke(
                        run,
                        input_record,
                        args.proxy_url,
                        cap,
                        run_id,
                        token_provider,
                        candidate_preflight["release"],
                    )
                else:
                    _run_paid(
                        engine,
                        run,
                        input_record,
                        args.proxy_url,
                        calibration_prompt,
                        cap,
                        run_id,
                        contracts,
                        token_provider,
                        candidate_preflight["release"],
                        local_source_before,
                        lambda call, current_run=run: _checkpoint_run_call(
                            manifest,
                            current_run,
                            artifact_path,
                            call,
                            checkpoint_lock,
                        ),
                    )
            except Exception as error:
                _record_run_failure(run, error)
                manifest["status"] = "failed"
                _refresh_manifest_cost_totals(manifest)
                try:
                    failure_preflight = _candidate_preflight(
                        args.proxy_url,
                        token_provider,
                        run_id,
                        args.max_cost_usd,
                        args.verify_isolation,
                        args.expected_git_sha,
                        args.expected_catalog_sha256,
                        prior_audit_spend_usd,
                        True,
                        deployment_receipt,
                    )
                    _validate_resume_ledger(
                        manifest,
                        failure_preflight["ledger"],
                    )
                    _validate_local_rejected_artifacts(run, run_dir)
                    manifest["failure_reconciliation"] = {
                        "status": "reconciled_failure",
                        "manual_review_required": False,
                        "checked_at": datetime.now(timezone.utc).isoformat().replace(
                            "+00:00", "Z"
                        ),
                        "release": failure_preflight["release"],
                        "ledger": failure_preflight["ledger"],
                    }
                except Exception as reconciliation_error:
                    manifest["failure_reconciliation"] = {
                        "status": "accounting_unreconciled",
                        "manual_review_required": True,
                        "error": {
                            "type": type(reconciliation_error).__name__,
                            "message": _sanitize_failure_text(reconciliation_error),
                        },
                    }
                raise
            finally:
                _refresh_manifest_cost_totals(manifest)
                cost_cap_matches = (
                    manifest["actual_cost_microusd"] == cap.spent_microusd
                )
                manifest["cost_cap_reconciliation"] = (
                    "reconciled" if cost_cap_matches else "mismatch"
                )
                if not cost_cap_matches:
                    manifest["status"] = "failed"
                manifest["budget_checks"] = cap.checks
                _atomic_write_json(artifact_path, manifest)
                if not cost_cap_matches and sys.exc_info()[0] is None:
                    raise BenchmarkSafetyError(
                        "Local call journal does not reconcile with the cost cap."
                    )
        for completed_run in runs:
            if completed_run.get("status") == "complete":
                _validate_local_rejected_artifacts(completed_run, run_dir)
        manifest["local_source_after"] = _verify_local_source(args.expected_git_sha)
        try:
            final_preflight = _candidate_preflight(
                args.proxy_url,
                token_provider,
                run_id,
                args.max_cost_usd,
                args.verify_isolation,
                args.expected_git_sha,
                args.expected_catalog_sha256,
                prior_audit_spend_usd,
                True,
                deployment_receipt,
            )
            _validate_resume_ledger(manifest, final_preflight["ledger"])
        except Exception as error:
            manifest["status"] = "failed"
            manifest["final_reconciliation_failure"] = {
                "type": type(error).__name__,
                "message": _sanitize_failure_text(error),
            }
            _atomic_write_json(artifact_path, manifest)
            raise
        manifest["final_reconciliation"] = {
            "checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "release": final_preflight["release"],
            "ledger": final_preflight["ledger"],
        }
        manifest["status"] = "complete"
        _atomic_write_json(artifact_path, manifest)
    return artifact_path, manifest


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", action="append", required=True, help="Explicit local screenplay PDF")
    parser.add_argument(
        "--approve-sha256", action="append", required=True,
        help="Exact SHA-256 approval for each input PDF",
    )
    parser.add_argument("--route", choices=["sonnet", "opus", "hybrid", "all"])
    parser.add_argument(
        "--generation", choices=["old", "candidate", "both"],
        help="Run only the selected model generation; paid execution requires one exact generation.",
    )
    parser.add_argument(
        "--smoke", action="store_true",
        help="Build a dry-run route matrix only; paid smoke calls are disabled",
    )
    parser.add_argument("--calibration-prompt-file")
    parser.add_argument("--execute", action="store_true", help="Run paid inference through llmProxyCandidate")
    parser.add_argument("--i-understand-paid-inference", action="store_true")
    parser.add_argument("--run-id")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume only planned runs after reconciling the immutable local and server ledgers.",
    )
    parser.add_argument("--proxy-url", default="http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/llmProxyCandidate")
    parser.add_argument("--caller-service-account")
    parser.add_argument("--verify-isolation", action="store_true")
    parser.add_argument("--expected-git-sha")
    parser.add_argument("--expected-catalog-sha256")
    parser.add_argument(
        "--deployment-receipt-file",
        help="Immutable staging deployment receipt downloaded into benchmark-artifacts.",
    )
    parser.add_argument(
        "--expected-deployment-receipt-sha256",
        help="Exact receipt SHA-256 printed by the reviewed staging workflow.",
    )
    parser.add_argument("--max-cost-usd", type=float, default=0.0)
    parser.add_argument(
        "--prior-audit-spend-usd",
        type=float,
        default=0.106425,
        help="Settled and uncertain V9 audit spend before this run.",
    )
    args = parser.parse_args(argv)
    try:
        artifact_path, manifest = build_manifest(args)
    except (BenchmarkSafetyError, OSError, json.JSONDecodeError) as error:
        print(f"benchmark refused: {error}", file=sys.stderr)
        return 2
    print(f"{manifest['status']}: {artifact_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
