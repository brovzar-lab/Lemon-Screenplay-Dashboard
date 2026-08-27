"""Local, persistence-free old-vs-candidate screenplay benchmark.

The default is a dry-run manifest. Paid execution requires an exact SHA-256
approval for every local PDF, an explicit paid flag, the dedicated candidate
proxy URL, and a hard request ceiling derived before each call. Benchmark mode
does not initialize Firebase Admin and blocks the ingestion persistence functions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import base64
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_ROOT = ROOT / "benchmark-artifacts"
CATALOG_PATH = ROOT / "src/config/anthropic-model-catalog.json"
LOCAL_PROXY_HOSTS = {"127.0.0.1", "localhost"}
SMOKE_MODELS = {
    "claude-haiku-4-5-20251001", "claude-sonnet-5", "claude-opus-5",
}


class BenchmarkSafetyError(ValueError):
    pass


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


def _empty_usage() -> Dict[str, Any]:
    return {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
        "call_count": 0,
        "actual_cost_microusd": 0,
        "actual_cost_usd": 0.0,
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


def _route_configs(catalog: Mapping[str, Any], route: str) -> List[Dict[str, Any]]:
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
                },
                {
                    "route": route_name,
                    "generation": "candidate",
                    "model_id": candidate[route_name]["modelId"],
                },
            ])
    return result


def _smoke_route_configs(catalog: Mapping[str, Any]) -> List[Dict[str, Any]]:
    return [
        {
            "route": "sonnet",
            "generation": "candidate",
            "model_id": catalog["analysisRoutes"]["haiku"]["modelId"],
            "pipeline_stage": "cold_read",
            "reader_name": None,
        },
        {
            "route": "sonnet",
            "generation": "candidate",
            "model_id": catalog["candidateAnalysisRoutes"]["sonnet"]["modelId"],
            "pipeline_stage": "reader",
            "reader_name": "structure",
        },
        {
            "route": "opus",
            "generation": "candidate",
            "model_id": catalog["candidateAnalysisRoutes"]["opus"]["modelId"],
            "pipeline_stage": "synthesis",
            "reader_name": None,
        },
    ]


def _validate_candidate_proxy(proxy_url: str) -> bool:
    parsed = urlparse(proxy_url)
    hostname = parsed.hostname or ""
    candidate_name = "llmproxycandidate"
    if candidate_name not in parsed.path.lower() and candidate_name not in hostname.lower():
        raise BenchmarkSafetyError("Paid execution accepts only the dedicated llmProxyCandidate URL.")
    if parsed.scheme == "http" and hostname in LOCAL_PROXY_HOSTS:
        return False
    if parsed.scheme != "https":
        raise BenchmarkSafetyError("Online candidate execution requires HTTPS.")
    if not (
        hostname.endswith(".cloudfunctions.net")
        or hostname.endswith(".run.app")
    ):
        raise BenchmarkSafetyError("Online candidate URL must be a Google Functions or Cloud Run URL.")
    return True


class IdentityTokenProvider:
    def __init__(self, audience: str, service_account: str):
        if not service_account.endswith(".iam.gserviceaccount.com"):
            raise BenchmarkSafetyError("A benchmark caller service account is required.")
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
) -> Dict[str, Any]:
    response = requests.get(
        proxy_url,
        params={"isolation": "1"} if verify_isolation else None,
        headers={"Authorization": f"Bearer {token_provider()}"},
        timeout=60,
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
    runtime_project_id = data.get("runtime_project_id")
    if runtime_project_id not in {
        "lemon-screenplay-staging",
        "lemon-sp-dashboard-stg-493694",
        "lemon-screenplay-dashboard",
    }:
        raise BenchmarkSafetyError("Candidate preflight returned an invalid runtime project.")
    allowed_models = set(data.get("allowed_models") or [])
    if not SMOKE_MODELS.issubset(allowed_models):
        raise BenchmarkSafetyError("Candidate preflight omitted an approved smoke model.")
    if "claude-fable-5" in allowed_models:
        raise BenchmarkSafetyError("Candidate preflight incorrectly allows Reader Chat Fable.")
    if abs(float(data.get("cap_usd", -1)) - cap_usd) > 0.000001:
        raise BenchmarkSafetyError("Candidate preflight cap does not match --max-cost-usd.")
    release = data.get("release") if isinstance(data.get("release"), dict) else {}
    if release.get("source_clean") is not True:
        raise BenchmarkSafetyError("Candidate release was not built from clean source.")
    if not _is_lower_hex(release.get("deployment_config_sha256"), 64):
        raise BenchmarkSafetyError("Candidate deployment configuration hash is invalid.")
    if release.get("cloud_run_revision") in (None, "", "local"):
        raise BenchmarkSafetyError("Candidate preflight omitted its Cloud Run revision.")
    if release.get("git_sha") != expected_git_sha:
        raise BenchmarkSafetyError("Candidate Git SHA does not match the approved revision.")
    if release.get("catalog_sha256") != expected_catalog_sha256:
        raise BenchmarkSafetyError("Candidate catalog hash does not match the approved catalog.")
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
        expected_runtime_default = (
            production_default
            if runtime_project_id == "lemon-screenplay-dashboard"
            else staging_default
        )
        if expected_runtime_default != f"projects/{runtime_project_id}/databases/(default)":
            raise BenchmarkSafetyError("Candidate preflight confused staging and production Firestore.")
    return data


class LocalCostCap:
    def __init__(self, maximum_usd: float, catalog: Mapping[str, Any]):
        if maximum_usd <= 0:
            raise BenchmarkSafetyError("Paid execution requires a positive --max-cost-usd.")
        self.maximum_usd = maximum_usd
        self.catalog = catalog
        self.spent_usd = 0.0

    def call(self, original: Any, model_ids: Mapping[str, str], **kwargs: Any):
        model_id = model_ids.get(str(kwargs.get("model_key")))
        profile = self.catalog["modelProfiles"].get(model_id)
        if not profile:
            raise BenchmarkSafetyError(f"No benchmark pricing profile exists for {model_id}.")
        prompt_chars = len(_canonical_json([
            kwargs.get("system_blocks", []), kwargs.get("user_blocks", []), kwargs.get("tool"),
        ]))
        input_tokens = (prompt_chars + 2) // 3
        if model_id == "claude-sonnet-5":
            input_tokens = (input_tokens * 13 + 9) // 10
        max_output_tokens = int(kwargs.get("max_tokens", 4_000)) + int(
            kwargs.get("thinking_budget", 0)
        )
        ceiling_usd = (
            input_tokens * float(profile["inputUsdPerMillion"]) * 2
            + max_output_tokens * float(profile["outputUsdPerMillion"])
        ) / 1_000_000
        if self.spent_usd + ceiling_usd > self.maximum_usd:
            raise BenchmarkSafetyError(
                f"Next request ceiling ${ceiling_usd:.4f} exceeds the remaining local cap."
            )
        result = original(**kwargs)
        usage = result[2]
        actual_cost = usage.get("actual_cost_usd")
        if not isinstance(actual_cost, (int, float)) or actual_cost < 0:
            raise BenchmarkSafetyError("Proxy response omitted exact settled cost.")
        self.spent_usd += float(actual_cost)
        return result


def _contract_data(engine: Any) -> Dict[str, Any]:
    from execution.trust_manifest import benchmark_contract_fingerprints

    schemas = {
        "readers": engine.READER_TOOLS,
        "synthesis": engine.SYNTHESIS_TOOL,
    }
    return {
        **benchmark_contract_fingerprints(),
        "structured_output_schema_sha256": _sha256_json(schemas),
    }


def _load_engine(run_dir: Path):
    os.environ["LEMON_LOCAL_ARTIFACT_DIR"] = str(run_dir / "engine")
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
) -> None:
    parsed = engine.parse_pdf(
        Path(str(input_record["path"])),
        content_hash=str(input_record["content_sha256"]),
    )
    if not parsed:
        raise BenchmarkSafetyError(f"Parser rejected {input_record['filename']}.")
    engine.validate_parsed_source(parsed)

    original_ids = dict(engine.MODEL_IDS)
    original_call = engine.call_llm
    try:
        if run["route"] == "hybrid":
            engine.MODEL_IDS["sonnet"] = run["sonnet_model_id"]
            engine.MODEL_IDS["opus"] = run["opus_model_id"]
        else:
            engine.MODEL_IDS[run["route"]] = run["model_id"]
        engine.configure_benchmark_online_transport(
            {
                "run_id": run_id,
                "screenplay_sha256": input_record["content_sha256"],
                "route": run["route"],
                "generation": run["generation"],
                "prompt_bundle_sha256": contracts["prompt_bundle_sha256"],
                "structured_output_schema_sha256": contracts[
                    "structured_output_schema_sha256"
                ],
            },
            token_provider,
        )
        engine.call_llm = lambda **kwargs: cap.call(original_call, engine.MODEL_IDS, **kwargs)

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
        }
        if run["route"] == "hybrid":
            analysis, usage = engine.run_v9_hybrid(**common)
        else:
            analysis, usage = engine.run_v9_stable(
                **common,
                model_key=run["route"],
                pipeline_pass=f"benchmark-{run['generation']}-{run['route']}",
            )
        usage = engine.merge_usage(cold_usage, usage)
        engine.attach_verified_citation_quality(
            analysis,
            parsed.get("metadata") or {},
            parsed["page_count"],
        )
        run.update({
            "status": "complete",
            "analysis": analysis,
            "usage": usage,
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
) -> None:
    payload: Dict[str, Any] = {
        "model": run["model_id"],
        "messages": [{
            "role": "user",
            "content": "Reply with the single word READY.",
        }],
        "max_tokens": 16,
    }
    prompt_bundle_sha256 = _sha256_json(payload["messages"])
    structured_output_schema_sha256 = _sha256_json({"smoke_response": "READY"})
    benchmark = {
        "run_id": run_id,
        "screenplay_sha256": input_record["content_sha256"],
        "route": run["route"],
        "generation": run["generation"],
        "pipeline_stage": run["pipeline_stage"],
        "reader_name": run["reader_name"],
        "retry_number": 0,
        "boundary_run": 1,
        "prompt_bundle_sha256": prompt_bundle_sha256,
        "structured_output_schema_sha256": structured_output_schema_sha256,
        "request_sha256": _sha256_json(payload),
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
        )
        if response.status_code != 200:
            raise BenchmarkSafetyError(
                f"Candidate smoke call failed with HTTP {response.status_code}."
            )
        data = response.json()
        if data.get("model") != run["model_id"] or not data.get("response_id"):
            raise BenchmarkSafetyError("Candidate smoke response omitted exact provenance.")
        usage = data.get("usage")
        if not isinstance(usage, dict):
            raise BenchmarkSafetyError("Candidate smoke response omitted usage and cost.")
        run.update({
            "status": "complete",
            "response": data.get("text"),
            "usage": usage,
            "prompt_bundle_sha256": prompt_bundle_sha256,
            "structured_output_schema_sha256": structured_output_schema_sha256,
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


def build_manifest(args: argparse.Namespace) -> tuple[Path, Dict[str, Any]]:
    ARTIFACTS_ROOT.mkdir(parents=True, exist_ok=True)
    run_id = args.run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    if not run_id or len(run_id) > 120 or not all(
        char.isalnum() or char in "._-" for char in run_id
    ):
        raise BenchmarkSafetyError("--run-id contains unsafe characters.")
    run_dir = ARTIFACTS_ROOT / run_id
    run_dir.mkdir()
    engine = _load_engine(run_dir)
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
        catalog, args.route
    )
    contracts = _contract_data(engine)
    runs = [
        {
            **route,
            "input_sha256": input_record["content_sha256"],
            "input_filename": input_record["filename"],
            "status": "planned",
            "prompt_bundle_sha256": contracts["prompt_bundle_sha256"],
            "structured_output_schema_sha256": contracts["structured_output_schema_sha256"],
            "provenance": {"calls": [], "response_ids": []},
            "usage": _empty_usage(),
        }
        for input_record in inputs
        for route in route_configs
    ]
    manifest: Dict[str, Any] = {
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
        "calibration": {
            "applied": calibration_prompt is not None,
            "prompt_sha256": calibration_sha256,
            "prompt_stored": False,
        },
        "cost_cap_usd": args.max_cost_usd if args.execute else 0.0,
        "actual_cost_usd": 0.0,
        "candidate_preflight": None,
        "runs": runs,
    }
    artifact_path = run_dir / "benchmark-manifest.json"
    artifact_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.execute:
        if not args.i_understand_paid_inference:
            raise BenchmarkSafetyError("Paid execution requires --i-understand-paid-inference.")
        is_online = _validate_candidate_proxy(args.proxy_url)
        if not args.run_id:
            raise BenchmarkSafetyError("Paid execution requires an explicit immutable --run-id.")
        if is_online:
            if not args.caller_service_account:
                raise BenchmarkSafetyError(
                    "Online execution requires --caller-service-account."
                )
            if not args.verify_isolation:
                raise BenchmarkSafetyError(
                    "Online execution requires --verify-isolation before paid calls."
                )
            if not _is_lower_hex(args.expected_git_sha, 40):
                raise BenchmarkSafetyError(
                    "Online execution requires --expected-git-sha with the approved full SHA."
                )
            if not _is_lower_hex(args.expected_catalog_sha256, 64):
                raise BenchmarkSafetyError(
                    "Online execution requires --expected-catalog-sha256."
                )
            token_provider: Any = IdentityTokenProvider(
                args.proxy_url,
                args.caller_service_account,
            )
            manifest["candidate_preflight"] = _candidate_preflight(
                args.proxy_url,
                token_provider,
                run_id,
                args.max_cost_usd,
                args.verify_isolation,
                args.expected_git_sha,
                args.expected_catalog_sha256,
            )
        else:
            token_provider = lambda: "local-emulator"
        cap = LocalCostCap(args.max_cost_usd, catalog)
        for run in runs:
            input_record = next(
                item for item in inputs if item["content_sha256"] == run["input_sha256"]
            )
            try:
                if args.smoke:
                    _run_smoke(
                        run,
                        input_record,
                        args.proxy_url,
                        cap,
                        run_id,
                        token_provider,
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
                    )
            except Exception as error:
                run["status"] = "failed"
                run["error"] = type(error).__name__
                failure_usage = getattr(error, "usage", None)
                if isinstance(failure_usage, dict):
                    run["usage"] = failure_usage
                    run["provenance"] = {
                        "calls": failure_usage.get("calls", []),
                        "failed_calls": failure_usage.get("failed_calls", []),
                        "response_ids": [
                            call["response_id"]
                            for call in failure_usage.get("calls", [])
                            if isinstance(call, dict) and "response_id" in call
                        ],
                    }
                manifest["status"] = "failed"
                raise
            finally:
                manifest["actual_cost_usd"] = cap.spent_usd
                artifact_path.write_text(
                    json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
                )
        manifest["status"] = "complete"
        artifact_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return artifact_path, manifest


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", action="append", required=True, help="Explicit local screenplay PDF")
    parser.add_argument(
        "--approve-sha256", action="append", required=True,
        help="Exact SHA-256 approval for each input PDF",
    )
    parser.add_argument("--route", choices=["sonnet", "opus", "hybrid", "all"], default="all")
    parser.add_argument(
        "--smoke", action="store_true",
        help="Check Haiku 4.5, Sonnet 5, and Opus 5 once without sending screenplay text",
    )
    parser.add_argument("--calibration-prompt-file")
    parser.add_argument("--execute", action="store_true", help="Run paid inference through llmProxyCandidate")
    parser.add_argument("--i-understand-paid-inference", action="store_true")
    parser.add_argument("--run-id")
    parser.add_argument("--proxy-url", default="http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/llmProxyCandidate")
    parser.add_argument("--caller-service-account")
    parser.add_argument("--verify-isolation", action="store_true")
    parser.add_argument("--expected-git-sha")
    parser.add_argument("--expected-catalog-sha256")
    parser.add_argument("--max-cost-usd", type=float, default=0.0)
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
