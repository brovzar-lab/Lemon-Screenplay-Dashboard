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
    6. coverage_flat        — the engine's flat COVERAGE_TOOL
    7. coverage_flat_thinking — same + budget_tokens
    8. coverage_shallow     — flat schema minus lens/evidence citations
    9. coverage_minimal     — barebones fallback contract

Outcome legend: rejected_invalid_request = Anthropic refused the request
($0). accepted_by_provider_accounting_failed = Anthropic answered (a few
tokens WERE paid) but the deployed llmProxy predates the current
inference_geo/service_tier accounting contract — redeploy Cloud Functions.

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


def _coverage_shallow() -> Dict[str, Any]:
    """Engine schema minus lens/evidence citations — a step-down variant."""
    import copy

    tool = copy.deepcopy(coverage_v1.COVERAGE_TOOL)
    props = tool["input_schema"]["properties"]
    note = props["lens_notes"]["items"]
    for field in ("page", "excerpt"):
        note["properties"].pop(field, None)
    note["required"] = [r for r in note["required"] if r not in ("page", "excerpt")]
    contract = props["genre_contract"]
    contract["properties"].pop("evidence", None)
    contract["required"] = [r for r in contract["required"] if r != "evidence"]
    tool["name"] = "submit_coverage_v1_shallow"
    return tool


COVERAGE_MINIMAL: Dict[str, Any] = {
    "name": "submit_coverage_v1_minimal",
    "description": "Submit a minimal coverage report.",
    "input_schema": {
        "type": "object",
        "properties": {
            "logline": {"type": "string"},
            "synopsis": {"type": "string"},
            "protagonist": {"type": "string"},
            "ending": {"type": "string"},
            "verdict": {"type": "string", "enum": list(coverage_v1.VERDICTS)},
            "confidence": {"type": "string", "enum": list(coverage_v1.CONFIDENCES)},
            "strengths": {"type": "array", "items": {"type": "string"}},
            "concerns": {"type": "array", "items": {"type": "string"}},
            "development_priorities": {"type": "array", "items": {"type": "string"}},
            "genre_contract_met": {"type": "boolean"},
        },
        "required": [
            "logline", "synopsis", "protagonist", "ending", "verdict",
            "confidence", "strengths", "concerns", "development_priorities",
            "genre_contract_met",
        ],
    },
}


def build_probes() -> List[Dict[str, Any]]:
    return [
        {"id": "text_only", "tool": None, "thinking": 0},
        {"id": "thinking_only", "tool": None, "thinking": 1024},
        {"id": "tiny_tool", "tool": TINY_TOOL, "thinking": 0},
        {"id": "tiny_tool_thinking", "tool": TINY_TOOL, "thinking": 1024},
        {"id": "audit_tool_thinking", "tool": coverage_v1.AUDIT_TOOL, "thinking": 1024},
        {"id": "coverage_flat", "tool": coverage_v1.COVERAGE_TOOL, "thinking": 0},
        {
            "id": "coverage_flat_thinking",
            "tool": coverage_v1.COVERAGE_TOOL,
            "thinking": 1024,
        },
        {"id": "coverage_shallow", "tool": _coverage_shallow(), "thinking": 0},
        {"id": "coverage_minimal", "tool": COVERAGE_MINIMAL, "thinking": 0},
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
        except ingest_v9.LlmAccountingError as error:
            # Anthropic ACCEPTED the request and answered; the deployed proxy
            # returned a response our current accounting contract cannot
            # verify. The call was still paid server-side (a few tokens).
            record["outcome"] = "accepted_by_provider_accounting_failed"
            record["schema_compiled"] = True
            record["spent_unrecorded_estimate_usd"] = 0.01
            record["error"] = str(error)[:300]
        except Exception as error:  # noqa: BLE001 — diagnostic: record and continue
            record["outcome"] = f"failed_{type(error).__name__}"
            record["error"] = str(error)[:300]
        results.append(record)
        print(json.dumps(record, ensure_ascii=False))
    return results


def diagnose(results: List[Dict[str, Any]]) -> str:
    by_id = {r["id"]: r for r in results}

    def compiled(pid: str) -> bool:
        outcome = by_id.get(pid, {}).get("outcome", "")
        return outcome == "accepted" or outcome == "accepted_by_provider_accounting_failed"

    def rejected(pid: str) -> bool:
        return by_id.get(pid, {}).get("outcome") == "rejected_invalid_request"

    def accounting_failed(pid: str) -> bool:
        return (
            by_id.get(pid, {}).get("outcome")
            == "accepted_by_provider_accounting_failed"
        )

    lines: List[str] = []
    if any(accounting_failed(r["id"]) for r in results):
        lines.append(
            "STALE PROXY: Anthropic answered, but the deployed llmProxy does "
            "not return the pinned inference_geo/service_tier proof the "
            "current client contract requires. Redeploy Cloud Functions "
            "(npm run deploy:functions) — normal V9 daemon runs are broken "
            "against this proxy too."
        )
    if rejected("coverage_flat"):
        if compiled("coverage_shallow"):
            lines.append(
                "SCHEMA: the flat coverage schema is still rejected; the "
                "shallow variant (no lens/evidence citations) compiles — "
                "the boundary is between them."
            )
        elif compiled("coverage_minimal"):
            lines.append(
                "SCHEMA: only the minimal coverage schema compiles — the "
                "contract needs a substantial redesign."
            )
        else:
            lines.append(
                "SCHEMA: every coverage variant is rejected while tiny/audit "
                "tools compile — inspect for an unsupported construct rather "
                "than size."
            )
    elif compiled("coverage_flat"):
        lines.append(
            "SCHEMA OK: the engine's flat coverage schema compiles. "
        )
    if rejected("thinking_only"):
        lines.append(
            "THINKING: budget_tokens is no longer accepted on this route — "
            "V9 is affected too; move off thinking={enabled,budget_tokens}."
        )
    if not lines:
        lines.append(
            "All rungs behaved — if the canary still fails, the cause is "
            "input-size dependent (full screenplay + lens cards)."
        )
    return "\n".join(lines)


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
