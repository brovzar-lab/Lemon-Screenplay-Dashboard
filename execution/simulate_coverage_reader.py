"""Replay private saved coverage locally. No network/model transport exists here.

This tests parsing, bounded orchestration, persistence and replay, NOT fresh
provider quality. The simulated reviewer explicitly declines factual sign-off.
Run from the repo: .venv/bin/python execution/simulate_coverage_reader.py
"""
import copy
import argparse
import hashlib
import json
import logging
import tempfile
from pathlib import Path

import coverage_reader as reader
import coverage_v1 as cv
import ingest_v9


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulated-cap-usd', type=float, default=1.0,
                        help='Offline reservation simulation only, never an authorization to spend')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    packages = root / "benchmark-artifacts/coverage-v1-audit-packages"
    results = []
    logging.disable(logging.CRITICAL)
    with tempfile.TemporaryDirectory(prefix="lemon-coverage-offline-") as temporary:
        ingest_v9.LOG_DIR = Path(temporary)
        for folder in sorted(packages.iterdir()):
            pdf = folder / "SCREENPLAY.pdf"
            saved_path = folder / "COVERAGE-V1.json"
            if not pdf.is_file() or not saved_path.is_file() or folder.name.startswith("00-"):
                continue
            saved = json.loads(saved_path.read_text())
            digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
            if saved.get("content_sha256") != digest:
                raise ValueError(f"Source hash mismatch in {folder.name}; no simulation performed")
            parsed = ingest_v9.parse_pdf(pdf, content_hash=digest)
            if not parsed:
                raise ValueError(f"Parser failed for {folder.name}")
            coverage = reader._report_fields(saved["coverage"], reader.COVERAGE_TOOL["input_schema"])
            requests = []

            def offline_transport(**request):
                requests.append(request)
                if request["stage"].endswith("review"):
                    value = {**{key: False for key in reader.CHECKS}, "issues": [],
                             "summary": "OFFLINE SIMULATION: no independent model review took place."}
                else:
                    value = copy.deepcopy(coverage)
                usage = cv._empty_usage()
                usage.update(call_count=1, calls=[{"usage_accounting_state": "exact_settled_provider_usage", "actual_cost_microusd": 0}])
                return value, "", usage

            store = cv.LocalCheckpointStore(Path(temporary) / folder.name)
            arguments = dict(text=parsed["text"], title=saved["title"],
                page_count=parsed["page_count"], word_count=parsed["word_count"],
                content_sha256=digest, parser_version=ingest_v9.PARSER_VERSION,
                checkpoint_store=store, lenses=saved["lens_stack"], transport=offline_transport)
            arguments['max_cost_usd'] = args.simulated_cap_usd
            failure = None
            try:
                report, _ = reader.run_coverage_v1(**arguments)
                calls = len(requests)
                replay, usage = reader.run_coverage_v1(**arguments)
                assert len(requests) == calls and usage["call_count"] == 0
                assert report == replay and report["status"] == "needs_review"
                status = "saved_review_and_zero_call_replay"
            except cv.CoverageBudgetExceededError as error:
                status = "conservative_reserve_exceeds_cap"
                failure = str(error)
            results.append({"package": folder.name, "source_sha256": digest,
                "status": status, "simulated_calls": len(requests), "real_calls": 0,
                "preflight_failure": failure,
                "request_ceilings_usd": [round(cv._request_cost_ceiling_microusd(request) / 1e6, 6) for request in requests],
                "first_request_ceiling_usd": round(cv._request_cost_ceiling_microusd(requests[0]) / 1e6, 6) if requests else None})
    print(json.dumps({"engine_version": reader.ENGINE_VERSION, "real_calls": 0,
        "real_cost_usd": 0, "simulated_cap_usd": args.simulated_cap_usd,
        "provider_quality_proven": False, "cases": results}, indent=2))
    if len(results) != 20 or any(item["status"] != "saved_review_and_zero_call_replay" for item in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
