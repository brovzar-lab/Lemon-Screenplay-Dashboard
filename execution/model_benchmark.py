"""Local, persistence-free old-vs-candidate screenplay benchmark.

The default is a dry-run manifest. Paid execution requires an exact SHA-256
approval for every local PDF, an explicit paid flag, a local proxy URL, and a
hard request ceiling derived before each call. This module never imports the
Firebase Admin SDK and never calls the ingestion persistence functions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_ROOT = ROOT / "benchmark-artifacts"
CATALOG_PATH = ROOT / "src/config/anthropic-model-catalog.json"
LOCAL_PROXY_HOSTS = {"127.0.0.1", "localhost"}


class BenchmarkSafetyError(ValueError):
    pass


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


def _validate_local_proxy(proxy_url: str) -> None:
    parsed = urlparse(proxy_url)
    if parsed.scheme != "http" or parsed.hostname not in LOCAL_PROXY_HOSTS:
        raise BenchmarkSafetyError("Paid benchmark execution accepts only an http localhost proxy URL.")


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
    return ingest_v9


def _run_paid(
    engine: Any,
    run: Dict[str, Any],
    input_record: Mapping[str, Any],
    proxy_url: str,
    calibration_prompt: str | None,
    cap: LocalCostCap,
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
        engine.MODEL_IDS.clear()
        engine.MODEL_IDS.update(original_ids)
        engine.call_llm = original_call


def build_manifest(args: argparse.Namespace) -> tuple[Path, Dict[str, Any]]:
    ARTIFACTS_ROOT.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    run_dir = ARTIFACTS_ROOT / run_id
    run_dir.mkdir()
    engine = _load_engine(run_dir)
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    inputs = _validated_inputs(args.input, args.approve_sha256)
    calibration_prompt = None
    calibration_sha256 = None
    if args.calibration_prompt_file:
        prompt_path = Path(args.calibration_prompt_file).expanduser().resolve()
        calibration_prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not calibration_prompt:
            raise BenchmarkSafetyError("Calibration prompt file is empty.")
        calibration_sha256 = _sha256_bytes(calibration_prompt.encode("utf-8"))

    route_configs = _route_configs(catalog, args.route)
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
        "runs": runs,
    }
    artifact_path = run_dir / "benchmark-manifest.json"
    artifact_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.execute:
        if not args.i_understand_paid_inference:
            raise BenchmarkSafetyError("Paid execution requires --i-understand-paid-inference.")
        _validate_local_proxy(args.proxy_url)
        cap = LocalCostCap(args.max_cost_usd, catalog)
        for run in runs:
            input_record = next(
                item for item in inputs if item["content_sha256"] == run["input_sha256"]
            )
            try:
                _run_paid(engine, run, input_record, args.proxy_url, calibration_prompt, cap)
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
    parser.add_argument("--calibration-prompt-file")
    parser.add_argument("--execute", action="store_true", help="Run paid API inference through localhost")
    parser.add_argument("--i-understand-paid-inference", action="store_true")
    parser.add_argument("--proxy-url", default="http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/llmProxy")
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
