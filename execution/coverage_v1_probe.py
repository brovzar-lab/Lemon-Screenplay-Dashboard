"""Bisection probe for the coverage_v1 UPSTREAM_INVALID_REQUEST rejection.

Anthropic rejected the canary's first Senior Coverage request before
generation (HTTP 400 invalid_request_error, $0 spent) and the proxy
deliberately strips the upstream detail. This probe isolates the cause by
sending a ladder of tiny requests through the same call_llm transport:

    1. text_only            — no tool, no thinking       (baseline)
    2. thinking_only        — no tool, budget_tokens     (is budget_tokens still accepted?)
    3. tiny_tool            — 2-property strict tool     (strict path baseline)
    4. tiny_tool_thinking   — same + budget_tokens
    5. audit_tool_thinking  — the real AUDIT_TOOL (small schema)
    6. coverage_tool        — the real COVERAGE_TOOL, no thinking
    7. coverage_tool_thinking — the real COVERAGE_TOOL + budget_tokens (the failing shape)

Rejected probes cost $0 (released before generation). Accepted probes
generate at most a few dozen tokens (~$0.01-0.02 each). Worst case for the
full ladder is well under $0.15. Requires PROXY_SERVICE_KEY plus BOTH
--execute and --i-authorize-paid-inference.

Run on the VPS:
    PROXY_SERVICE_KEY=... venv/bin/python -m execution.coverage_v1_probe \\
        --execute --i-authorize-paid-inference
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).parent))

import coverage_v1  # noqa: E402

PROBE_TEXT = (
    "PROBE: reply with the single word OK. This is a transport diagnostic, "
    "not a real task."
)

TINY_TOOL: Dict[str, Any] = {
    "name": "submit_probe_v1",
    "description": "Submit the probe acknowledgement.",
    "input_schema": {
        "type": "object",
        "properties": {
            "ack": {"type": "string", "enum": ["OK"]},
            "note": {"type": "string"},
        },
        "required": ["ack", "note"],
    },
}


def build_probes() -> List[Dict[str, Any]]:
    return [
        {"id": "text_only", "tool": None, "thinking": 0},
        {"id": "thinking_only", "tool": None, "thinking": 1024},
        {"id": "tiny_tool", "tool": TINY_TOOL, "thinking": 0},
        {"id": "tiny_tool_thinking", "tool": TINY_TOOL, "thinking": 1024},
        {"id": "audit_tool_thinking", "tool": coverage_v1.AUDIT_TOOL, "thinking": 1024},
        {"id": "coverage_tool", "tool": coverage_v1.COVERAGE_TOOL, "thinking": 0},
        {
            "id": "coverage_tool_thinking",
            "tool": coverage_v1.COVERAGE_TOOL,
            "thinking": 1024,
        },
    ]


def run_probes(
    *,
    model_key: str = "sonnet",
    proxy_url: Optional[str] = None,
    transport: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """Run the ladder. Never raises on a rejected probe; records everything."""
    import ingest_v9

    call = transport or ingest_v9.call_llm
    results: List[Dict[str, Any]] = []
    for probe in build_probes():
        record: Dict[str, Any] = {"id": probe["id"], "thinking": probe["thinking"]}
        try:
            tool_input, text, usage = call(
                system_blocks=[{"type": "text", "text": "You are a transport probe."}],
                user_blocks=[{"type": "text", "text": PROBE_TEXT}],
                model_key=model_key,
                tool=probe["tool"],
                thinking_budget=probe["thinking"],
                max_tokens=64,
                proxy_url=proxy_url,
                stage=f"coverage_v1.probe.{probe['id']}",
                pipeline_pass="coverage_v1_probe",
            )
            record["outcome"] = "accepted"
            record["got_tool_input"] = tool_input is not None
            record["cost_usd"] = round(
                int(usage.get("actual_cost_microusd", 0) or 0) / 1_000_000, 6
            )
        except ingest_v9.LlmRequestRejectedError as error:
            record["outcome"] = "rejected_invalid_request"
            record["error"] = str(error)[:300]
            record["cost_usd"] = 0.0
        except Exception as error:  # noqa: BLE001 — diagnostic: record and continue
            record["outcome"] = f"failed_{type(error).__name__}"
            record["error"] = str(error)[:300]
        results.append(record)
        print(json.dumps(record, ensure_ascii=False))
    return results


def diagnose(results: List[Dict[str, Any]]) -> str:
    by_id = {r["id"]: r for r in results}

    def ok(pid: str) -> bool:
        return by_id.get(pid, {}).get("outcome") == "accepted"

    def rejected(pid: str) -> bool:
        return by_id.get(pid, {}).get("outcome") == "rejected_invalid_request"

    if not ok("text_only"):
        return (
            "Baseline text request failed — the problem is transport-wide "
            "(model route, proxy contract, or account), not the coverage schema."
        )
    if rejected("thinking_only") and ok("text_only"):
        return (
            "DIAGNOSIS: budget_tokens extended thinking is no longer accepted "
            "on this model route. Fix: move coverage_v1 (and V9) off "
            "thinking={enabled,budget_tokens} — use adaptive thinking or no "
            "thinking. NOTE: this would mean every V9 analysis call is "
            "currently broken too."
        )
    if rejected("coverage_tool") and ok("audit_tool_thinking" if ok("thinking_only") else "tiny_tool"):
        return (
            "DIAGNOSIS: the COVERAGE_TOOL schema itself is rejected "
            "(grammar complexity or an unsupported construct that survives "
            "stripping). Fix: shrink/flatten the coverage schema."
        )
    if rejected("coverage_tool_thinking") and ok("coverage_tool"):
        return (
            "DIAGNOSIS: the coverage schema is fine; the combination with "
            "budget_tokens thinking is rejected. Fix: drop or change the "
            "thinking configuration on coverage_v1 calls."
        )
    if all(ok(p["id"]) for p in build_probes()):
        return (
            "All probes accepted — the rejection is input-size dependent "
            "(full screenplay + lens cards). Investigate token budgets and "
            "max_tokens interaction next."
        )
    return "Mixed results — read the ladder above; the first rejected rung is the cause."


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proxy-url", default=None)
    parser.add_argument("--model", default="sonnet")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--i-authorize-paid-inference", action="store_true")
    args = parser.parse_args(argv)

    if not (args.execute and args.i_authorize_paid_inference):
        print(
            "Dry description only. To run the ladder (rejections are $0, "
            "accepted probes ~$0.01-0.02 each, ladder worst case < $0.15):\n"
            "  PROXY_SERVICE_KEY=... venv/bin/python -m execution.coverage_v1_probe "
            "--execute --i-authorize-paid-inference"
        )
        for probe in build_probes():
            print(f"  planned: {probe['id']} (thinking={probe['thinking']})")
        return 0
    if not os.getenv("PROXY_SERVICE_KEY"):
        print("PROXY_SERVICE_KEY is not set — no call was made.", file=sys.stderr)
        return 2

    results = run_probes(model_key=args.model, proxy_url=args.proxy_url)
    total = round(sum(r.get("cost_usd", 0.0) or 0.0 for r in results), 6)
    print(f"\nTotal probe cost: ${total}")
    print("\n" + diagnose(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
