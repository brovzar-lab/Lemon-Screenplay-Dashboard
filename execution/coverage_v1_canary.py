"""Coverage V1 canary and manifest-bound release qualification runner.

Runs a small batch of local screenplay PDFs through the staged Coverage V1
engine, sequentially, with hard spending caps and an induced
kill-and-resume drill, and writes a scorecard against the pass/fail bars in
docs/COVERAGE-V1.md.

Safety model (mirrors model_benchmark's discipline):
  - DRY RUN by default: hashing, parsing, lens resolution, schema checks and
    a cost plan — zero model calls.
  - Paid execution requires BOTH --execute and --i-authorize-paid-inference,
    plus PROXY_SERVICE_KEY in the environment (the same hard server-side
    reserve/settle budget applies to every call through llmProxy).
  - Hard caps enforced locally: per-script (default $1.50, engine-enforced)
    and per-batch (default $10.00, refused before a script starts if the
    remaining authorization cannot cover its cap).
  - A release manifest binds the approved audit ledger, every source hash,
    the ready threshold, critical scripts, monetary ceilings, and call cap.
  - The resume drill kills one script's run after the Senior Coverage stage
    checkpoints, then resumes it and PROVES the coverage call was not repaid.
  - All artifacts (reports contain screenplay-derived content) go to the
    gitignored benchmark-artifacts/ tree. Nothing is written to Firestore.

Usage (run where PROXY_SERVICE_KEY and the PDFs live — the VPS or a Mac):

    python3 -m execution.coverage_v1_canary --manifest canary.json          # dry run
    python3 -m execution.coverage_v1_canary --manifest canary.json \\
        --execute --i-authorize-paid-inference                              # paid

Manifest JSON: a list of entries:
    [{"pdf": "/path/Matadero.pdf", "title": "Matadero",
      "format": "feature", "genre_hint": "horror", "lenses": null}, ...]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).parent))

import coverage_v1  # noqa: E402
from content_identity import compute_content_hash  # noqa: E402

DEFAULT_MAX_TOTAL_USD = 10.00
DEFAULT_MAX_SCRIPT_USD = 1.50
DEFAULT_RESUME_DRILL_INDEX = 2  # 1-based: the second script proves resume
MAX_CANARY_CALLS_PER_SCRIPT = coverage_v1.DEFAULT_MAX_CALLS
QUALIFICATION_MANIFEST_VERSION = "coverage-v1.2-release-qualification-1"
ARTIFACTS_ROOT = Path(__file__).resolve().parents[1] / "benchmark-artifacts"


class CanaryError(RuntimeError):
    """Fail-closed canary error."""


class InducedKillError(RuntimeError):
    """Deliberate mid-run kill for the resume drill. Not a real failure."""

    proven_no_spend = True


class KillBeforeCall:
    """Transport wrapper that raises before the Nth call (1-based)."""

    def __init__(self, inner: Callable[..., Any], kill_before_call: int):
        self.inner = inner
        self.kill_before_call = kill_before_call
        self.calls_made = 0

    def __call__(self, **kwargs: Any) -> Any:
        if self.calls_made + 1 == self.kill_before_call:
            raise InducedKillError(
                "canary resume drill: induced failure before "
                f"call {self.kill_before_call}"
            )
        self.calls_made += 1
        return self.inner(**kwargs)


def _slug(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "untitled"


def _within_call_ceiling(
    rows: List[Dict[str, Any]],
    max_calls_per_script: int = MAX_CANARY_CALLS_PER_SCRIPT,
) -> bool:
    return all(
        int(row["cost"]["call_count"]) <= max_calls_per_script
        for row in rows
    )


def _report_quality(report: Dict[str, Any]) -> Dict[str, Any]:
    """Reduce one report to objective release gates."""
    fact_audit = report.get("fact_audit")
    fact_audit = fact_audit if isinstance(fact_audit, dict) else {}
    evidence = [
        row
        for group in (
            "existing_evidence_verdicts",
            "sequence_evidence",
            "citation_relevance",
        )
        for row in fact_audit.get(group, [])
        if isinstance(row, dict)
    ]
    unresolved = sum(
        row.get("classification") == "unclassified"
        or row.get("grounding_status") == "unresolved"
        or row.get("grounding_valid") is False
        for row in evidence
    )
    focused_contradictions = sum(
        str(row.get("note", "")).startswith(
            "FOCUSED_EVIDENCE_CONTRADICTION:"
        )
        for row in fact_audit.get("existing_evidence_verdicts", [])
        if isinstance(row, dict)
    )
    citations = report.get("citation_verification")
    citations = citations if isinstance(citations, dict) else {}
    return {
        "sealed": report.get("status") == "sealed",
        "central_failures": len(fact_audit.get("central_failures", [])),
        "unresolved_evidence": unresolved,
        "citation_integrity_verified": (
            citations.get("integrity_verified") is True
        ),
        "focused_evidence_contradictions": focused_contradictions,
    }


def _release_quality_bars(
    rows: List[Dict[str, Any]],
    qualification: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    reports = [row for row in rows if row.get("cost")]
    ready = [row for row in reports if row.get("status") == "sealed"]
    quality_population = ready if qualification is not None else reports
    bars: Dict[str, Any] = {
        "zero_unverified_citations": all(
            (row.get("citations_unverified") or 0) == 0
            for row in quality_population
        ),
        "every_report_sealed": bool(reports) and len(ready) == len(reports),
        "zero_central_failures": all(
            row["release_quality"]["central_failures"] == 0
            for row in quality_population
        ),
        "zero_unresolved_evidence": all(
            row["release_quality"]["unresolved_evidence"] == 0
            for row in quality_population
        ),
        "citation_integrity_verified": all(
            row["release_quality"]["citation_integrity_verified"]
            for row in quality_population
        ),
        "zero_focused_evidence_contradictions": all(
            row["release_quality"]["focused_evidence_contradictions"] == 0
            for row in quality_population
        ),
    }
    quality_passed = all(
        bars[name]
        for name in (
            "zero_unverified_citations",
            "zero_central_failures",
            "zero_unresolved_evidence",
            "citation_integrity_verified",
            "zero_focused_evidence_contradictions",
        )
    )
    if qualification is None:
        bars["release_quality_passed"] = bars["every_report_sealed"] and quality_passed
        return bars

    required_titles = set(qualification["required_ready_titles"])
    ready_titles = {str(row.get("title", "")) for row in ready}
    minimum_ready = int(qualification["minimum_ready"])
    bars.update({
        "ready_count": len(ready),
        "needs_review_count": sum(
            row.get("status") == "needs_review" for row in reports
        ),
        "minimum_ready": minimum_ready,
        "at_least_minimum_ready": len(ready) >= minimum_ready,
        "required_ready_titles": sorted(required_titles),
        "all_required_titles_ready": required_titles.issubset(ready_titles),
        "only_safe_terminal_states": (
            len(reports) == len(rows)
            and all(row.get("status") in {"sealed", "needs_review"} for row in rows)
        ),
    })
    bars["release_quality_passed"] = all((
        quality_passed,
        bars["at_least_minimum_ready"],
        bars["all_required_titles_ready"],
        bars["only_safe_terminal_states"],
    ))
    return bars


def load_manifest(
    path: Path,
) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    qualification: Optional[Dict[str, Any]] = None
    if isinstance(payload, dict):
        if payload.get("schema_version") != QUALIFICATION_MANIFEST_VERSION:
            raise CanaryError("Qualification manifest version is invalid")
        entries = payload.get("scripts")
        raw_qualification = payload.get("qualification")
        if not isinstance(raw_qualification, dict):
            raise CanaryError("Qualification manifest needs a qualification policy")
        qualification = dict(raw_qualification)
        ledger = qualification.get("approved_audit_ledger")
        if not isinstance(ledger, dict):
            raise CanaryError("Qualification manifest needs an approved audit ledger")
        ledger_path_value = ledger.get("path")
        ledger_sha256 = ledger.get("sha256")
        if not isinstance(ledger_path_value, str) or not re.fullmatch(
            r"[0-9a-f]{64}", str(ledger_sha256)
        ):
            raise CanaryError("Approved audit ledger binding is invalid")
        ledger_path = (path.parent / ledger_path_value).resolve()
        if not ledger_path.is_file() or compute_content_hash(ledger_path) != ledger_sha256:
            raise CanaryError("Approved audit ledger hash does not match")
        qualification["approved_audit_ledger"] = {
            "path": ledger_path_value,
            "sha256": ledger_sha256,
            "verified": True,
        }
    else:
        entries = payload
    if not isinstance(entries, list) or not entries:
        raise CanaryError("Manifest must be a non-empty JSON list")
    for i, entry in enumerate(entries):
        if not isinstance(entry, dict) or not entry.get("pdf"):
            raise CanaryError(f"Manifest entry {i} needs a 'pdf' path")
        expected_hash = entry.get("content_sha256")
        if expected_hash is not None and not re.fullmatch(
            r"[0-9a-f]{64}", str(expected_hash)
        ):
            raise CanaryError(f"Manifest entry {i} has an invalid content hash")
    if qualification is not None:
        titles = {str(entry.get("title") or "") for entry in entries}
        minimum_ready = qualification.get("minimum_ready")
        required_ready = qualification.get("required_ready_titles")
        max_calls = qualification.get("max_calls_per_script")
        max_total_usd = qualification.get("max_total_usd")
        max_script_usd = qualification.get("max_script_usd")
        if (
            type(minimum_ready) is not int
            or not 1 <= minimum_ready <= len(entries)
            or not isinstance(required_ready, list)
            or not required_ready
            or any(not isinstance(title, str) or title not in titles for title in required_ready)
            or len(set(required_ready)) != len(required_ready)
            or type(max_calls) is not int
            or not 1 <= max_calls <= MAX_CANARY_CALLS_PER_SCRIPT
            or not isinstance(max_total_usd, (int, float))
            or isinstance(max_total_usd, bool)
            or max_total_usd <= 0
            or not isinstance(max_script_usd, (int, float))
            or isinstance(max_script_usd, bool)
            or not 0 < max_script_usd <= max_total_usd
            or any("content_sha256" not in entry for entry in entries)
        ):
            raise CanaryError("Qualification policy is invalid")
    return entries, qualification


def _default_parse(pdf_path: Path, content_hash: str) -> Optional[Dict[str, Any]]:
    import ingest_v9

    return ingest_v9.parse_pdf(pdf_path, content_hash=content_hash)


def _parser_version() -> str:
    import ingest_v9

    return ingest_v9.PARSER_VERSION


def run_canary(
    entries: List[Dict[str, Any]],
    *,
    out_dir: Path,
    execute: bool = False,
    max_total_usd: float = DEFAULT_MAX_TOTAL_USD,
    max_script_usd: float = DEFAULT_MAX_SCRIPT_USD,
    resume_drill_index: int = DEFAULT_RESUME_DRILL_INDEX,
    proxy_url: Optional[str] = None,
    transport: Optional[Callable[..., Any]] = None,
    parse_fn: Optional[Callable[[Path, str], Optional[Dict[str, Any]]]] = None,
    parser_version: Optional[str] = None,
    max_calls_per_script: int = MAX_CANARY_CALLS_PER_SCRIPT,
    qualification: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Run the canary batch. Returns the scorecard dict (also written to disk).

    With execute=False this is a free dry run: no transport is ever invoked.
    """
    coverage_v1.assert_schemas_compiler_safe()
    if (
        type(max_calls_per_script) is not int
        or not 1 <= max_calls_per_script <= MAX_CANARY_CALLS_PER_SCRIPT
    ):
        raise CanaryError(
            f"max_calls_per_script must be between 1 and {MAX_CANARY_CALLS_PER_SCRIPT}"
        )
    preflight_hashes: Dict[str, str] = {}
    if execute and qualification is not None:
        failures = []
        for entry in entries:
            pdf_path = Path(entry["pdf"]).expanduser()
            expected_hash = entry.get("content_sha256")
            if not pdf_path.is_file():
                failures.append(f"{entry.get('title') or pdf_path.name}: PDF not found")
                continue
            actual_hash = compute_content_hash(pdf_path)
            preflight_hashes[str(pdf_path)] = actual_hash
            if actual_hash != expected_hash:
                failures.append(
                    f"{entry.get('title') or pdf_path.name}: source hash mismatch"
                )
        if failures:
            raise CanaryError(
                "Qualification source preflight failed before inference: "
                + "; ".join(failures)
            )
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "reports").mkdir(exist_ok=True)
    # The checkpoint store is SHARED across canary invocations (it lives
    # beside the per-run artifact dirs, not inside one), so a failed run's
    # validated coverage is never re-bought by the next attempt. Binding
    # hashes (content, prompts, schemas, models, engine version) already
    # guarantee stale work is never reused.
    checkpoints = coverage_v1.LocalCheckpointStore(
        out_dir.parent / "coverage-v1-checkpoints"
    )
    parse = parse_fn or _default_parse
    parser_ver = parser_version or _parser_version()

    if execute and transport is None:
        if not os.getenv("PROXY_SERVICE_KEY"):
            raise CanaryError(
                "Paid execution needs PROXY_SERVICE_KEY in the environment "
                "(run this on the VPS or a machine with the daemon key). "
                "No call was made."
            )
        transport = coverage_v1.default_transport

    registry = coverage_v1.load_lens_registry()
    scorecard: Dict[str, Any] = {
        "canary": "coverage_v1",
        "engine_version": coverage_v1.ENGINE_VERSION,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "mode": "paid" if execute else "dry_run",
        "max_total_usd": max_total_usd,
        "max_script_usd": max_script_usd,
        "configured_max_calls_per_script": max_calls_per_script,
        "qualification": qualification,
        "scripts": [],
        "totals": {
            "charged_usd": 0.0,
            "settled_usd": 0.0,
            "uncertain_usd": 0.0,
            "call_count": 0,
        },
        "hard_failures": [],
        "resume_drill": {"status": "not_run", "repaid_nothing": None},
    }

    charged_total = 0.0
    for index, entry in enumerate(entries, start=1):
        pdf_path = Path(entry["pdf"]).expanduser()
        title = entry.get("title") or pdf_path.stem.replace("_", " ").replace("-", " ")
        row: Dict[str, Any] = {"index": index, "title": title, "pdf": str(pdf_path)}
        scorecard["scripts"].append(row)

        if not pdf_path.is_file():
            row["status"] = "missing_pdf"
            scorecard["hard_failures"].append(f"#{index} {title}: PDF not found")
            continue

        content_hash = preflight_hashes.get(str(pdf_path)) or compute_content_hash(pdf_path)
        row["content_sha256"] = content_hash
        expected_hash = entry.get("content_sha256")
        if expected_hash is not None and content_hash != expected_hash:
            row["status"] = "source_hash_mismatch"
            scorecard["hard_failures"].append(
                f"#{index} {title}: source hash mismatch"
            )
            continue

        parsed = parse(pdf_path, content_hash)
        if not parsed or not parsed.get("text"):
            row["status"] = "parse_failed"
            scorecard["hard_failures"].append(f"#{index} {title}: parse failed")
            continue
        text = parsed["text"]
        page_count = int(parsed.get("page_count", 0))
        word_count = int(parsed.get("word_count", 0))
        row["page_count"] = page_count
        row["word_count"] = word_count

        fmt = entry.get("format") or "feature"
        genre_hint = entry.get("genre_hint") or None
        lenses = entry.get("lenses") or None
        lens_stack = coverage_v1.resolve_lens_stack(registry, fmt, genre_hint, lenses)
        row["lens_stack"] = lens_stack

        if not execute:
            row["status"] = "planned"
            continue

        # Batch cap: refuse to start a script the remaining authorization
        # cannot fully cover at its own per-script cap.
        if charged_total + max_script_usd > max_total_usd + 1e-9:
            row["status"] = "refused_batch_cap"
            scorecard["hard_failures"].append(
                f"#{index} {title}: refused — ${charged_total:.2f} charged, "
                f"per-script cap ${max_script_usd:.2f} would exceed the "
                f"${max_total_usd:.2f} batch authorization"
            )
            break

        run_kwargs = dict(
            text=text,
            title=title,
            page_count=page_count,
            word_count=word_count,
            content_sha256=content_hash,
            parser_version=parser_ver,
            checkpoint_store=checkpoints,
            fmt=fmt,
            genre_hint=genre_hint,
            lenses=lenses,
            proxy_url=proxy_url,
            # The proxy's budget reservation refuses job_ids that are not
            # live ingest-queue jobs in "processing" status (an anti-orphan
            # spend guard). The canary is queue-free by design, so it must
            # not pass one.
            job_id=None,
            max_cost_usd=max_script_usd,
            max_calls=max_calls_per_script,
        )

        def _charged_usd(sink: Dict[str, Any]) -> float:
            return int(sink.get("actual_cost_microusd", 0) or 0) / 1_000_000

        drill: Optional[Dict[str, Any]] = None
        kill_run_charged = 0.0
        kill_sink: Dict[str, Any] = {}
        run_sink: Dict[str, Any] = {}
        try:
            if index == resume_drill_index:
                # Resume drill: kill before the 2nd call (after Senior
                # Coverage validated and checkpointed), then resume.
                killer = KillBeforeCall(transport, kill_before_call=2)
                try:
                    coverage_v1.run_coverage_v1(
                        transport=killer, usage_sink=kill_sink, **run_kwargs
                    )
                    raise CanaryError(
                        "Resume drill did not trigger — engine made fewer "
                        "calls than expected"
                    )
                except InducedKillError:
                    pass
                kill_run_charged = _charged_usd(kill_sink)
                drill = {
                    "killed_after_calls": killer.calls_made,
                    "kill_run_charged_usd": round(kill_run_charged, 6),
                }
                report, usage = coverage_v1.run_coverage_v1(
                    transport=transport, usage_sink=run_sink, **run_kwargs
                )
                drill["resumed_coverage_replayed"] = report["replay"][
                    "coverage_replayed"
                ]
                drill["resume_run_call_count"] = int(usage.get("call_count", 0))
                drill["repaid_nothing"] = drill["resumed_coverage_replayed"]
                scorecard["resume_drill"] = {
                    "status": "completed", **drill, "script": title
                }
                if not drill["repaid_nothing"]:
                    scorecard["hard_failures"].append(
                        f"#{index} {title}: resume drill repaid work"
                    )
            else:
                report, usage = coverage_v1.run_coverage_v1(
                    transport=transport, usage_sink=run_sink, **run_kwargs
                )
        except Exception as error:  # noqa: BLE001
            # Ordinary script failures become scorecard rows. Unknown spend
            # additionally stops the batch because no later dispatch is safe.
            unresolved_reserve = int(
                getattr(error, "reserved_microusd", 0) or 0
            )
            unresolved_usage = (
                {
                    "call_count": 1,
                    "actual_cost_microusd": unresolved_reserve,
                    "calls": [{
                        "usage_accounting_state": (
                            "conservative_unresolved_request_reserve"
                        ),
                        "actual_cost_microusd": unresolved_reserve,
                    }],
                }
                if unresolved_reserve > 0
                else {}
            )
            failed_cost = coverage_v1._usage_cost_split(
                coverage_v1._merge_usage(
                    kill_sink, run_sink, unresolved_usage
                )
            )
            charged_total += failed_cost["charged_usd"]
            for field in ("charged_usd", "settled_usd", "uncertain_usd"):
                scorecard["totals"][field] = round(
                    scorecard["totals"][field] + failed_cost[field], 6
                )
            scorecard["totals"]["call_count"] += failed_cost["call_count"]
            row["status"] = "failed_closed"
            row["error"] = f"{type(error).__name__}: {error}"
            row["charged_usd_before_failure"] = failed_cost["charged_usd"]
            row["cost_before_failure"] = failed_cost
            scorecard["hard_failures"].append(f"#{index} {title}: {error}")
            if unresolved_reserve > 0:
                row["status"] = "failed_closed_unknown_spend"
                row["unresolved_reserve_usd"] = round(
                    unresolved_reserve / 1_000_000, 6
                )
                break
            continue

        # The engine's durable budget ledger already includes calls made by
        # the killed invocation, so the resumed report is the lifetime total.
        cost = dict(report["cost"])
        invocation_cost = coverage_v1._usage_cost_split(
            coverage_v1._merge_usage(kill_sink, run_sink)
        )
        quality = _report_quality(report)
        charged_total += float(cost["charged_usd"])
        row.update(
            {
                "status": report["status"],
                "verdict": report["verdict"],
                "confidence": report["confidence"],
                "film_now_nominated": report["film_now_nominated"],
                "human_review_recommended": report["human_review_recommended"],
                "review_reasons": report["review_reasons"],
                "fact_audit_support_rate": report["fact_audit"][
                    "support_rate"
                ],
                "central_failures": report["fact_audit"]["central_failures"],
                "citations_total": (report.get("citation_verification") or {}).get("total"),
                "citations_unverified": (report.get("citation_verification") or {}).get("unverified"),
                "cost": cost,
                "invocation_cost": invocation_cost,
                "resume_drill": drill,
                "spine": report["coverage"]["story_spine"],
                "development_priorities": report["coverage"][
                    "development_priorities"
                ],
                "release_quality": quality,
            }
        )
        scorecard["totals"]["charged_usd"] = round(
            scorecard["totals"]["charged_usd"] + cost["charged_usd"], 6
        )
        scorecard["totals"]["settled_usd"] = round(
            scorecard["totals"]["settled_usd"] + cost["settled_usd"], 6
        )
        scorecard["totals"]["uncertain_usd"] = round(
            scorecard["totals"]["uncertain_usd"] + cost["uncertain_usd"], 6
        )
        scorecard["totals"]["call_count"] += int(cost["call_count"])

        report_path = out_dir / "reports" / f"{index:02d}-{_slug(title)}.json"
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        row["report_path"] = str(report_path)

    # Automated bar checks (paid mode only; the human bars are printed below).
    if execute:
        bars = scorecard.setdefault("automated_bars", {})
        completed = [s for s in scorecard["scripts"] if s.get("cost")]
        bars["batch_within_authorization"] = (
            scorecard["totals"]["charged_usd"] <= max_total_usd + 1e-9
        )
        bars["every_script_within_cap"] = all(
            s["cost"]["charged_usd"] <= max_script_usd + 1e-9 for s in completed
        )
        # The configured cap is the only authoritative call ceiling.
        bars["within_configured_call_cap"] = _within_call_ceiling(
            completed, max_calls_per_script
        )
        bars.update(_release_quality_bars(scorecard["scripts"], qualification))
        bars["invocation_settled_cost_max_usd"] = max(
            (s["invocation_cost"]["settled_usd"] for s in completed),
            default=0.0,
        )
        bars["invocation_settled_cost_target_060"] = (
            bars["invocation_settled_cost_max_usd"] <= 0.60
        )
        drill_result = scorecard.get("resume_drill")
        bars["resume_repaid_nothing"] = (
            bool(drill_result.get("repaid_nothing"))
            if isinstance(drill_result, dict)
            and drill_result.get("status") == "completed"
            else None
        )
        if not bars["release_quality_passed"]:
            failed = [
                name for name, value in bars.items()
                if name in {
                    "every_report_sealed",
                    "zero_unverified_citations",
                    "zero_central_failures",
                    "zero_unresolved_evidence",
                    "citation_integrity_verified",
                    "zero_focused_evidence_contradictions",
                    "at_least_minimum_ready",
                    "all_required_titles_ready",
                    "only_safe_terminal_states",
                }
                and value is False
                and not (qualification is not None and name == "every_report_sealed")
            ]
            scorecard["hard_failures"].append(
                "release quality bars failed: " + ", ".join(failed)
            )

    scorecard["finished_at"] = datetime.now(timezone.utc).isoformat()
    (out_dir / "scorecard.json").write_text(
        json.dumps(scorecard, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    return scorecard


HUMAN_CHECKLIST = """\
APPROVED-AUDIT BAR (the runner cannot judge professional meaning):
  Compare every report with its Billy-approved audit. A Ready report must
  contain no approved factual, page, citation, counting, chronology, or
  cross-field consistency error. Human taste remains separate. One such
  defect in a Ready report blocks release even when every automated bar passes.
"""


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Coverage V1 canary — dry-run by default; paid mode is double-gated."
    )
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--max-total-usd", type=float, default=None)
    parser.add_argument("--max-script-usd", type=float, default=None)
    parser.add_argument(
        "--resume-drill-index", type=int, default=DEFAULT_RESUME_DRILL_INDEX
    )
    parser.add_argument("--proxy-url", default=None)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--i-authorize-paid-inference", action="store_true")
    args = parser.parse_args(argv)

    execute = args.execute and args.i_authorize_paid_inference
    if args.execute and not args.i_authorize_paid_inference:
        print(
            "Refusing paid mode: --execute also requires "
            "--i-authorize-paid-inference. Running nothing.",
            file=sys.stderr,
        )
        return 2

    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    out_dir = args.out or (ARTIFACTS_ROOT / f"coverage-v1-canary-{stamp}")

    entries, qualification = load_manifest(args.manifest)
    max_calls_per_script = (
        int(qualification["max_calls_per_script"])
        if qualification is not None
        else MAX_CANARY_CALLS_PER_SCRIPT
    )
    if qualification is not None:
        for supplied, field in (
            (args.max_total_usd, "max_total_usd"),
            (args.max_script_usd, "max_script_usd"),
        ):
            if supplied is not None and supplied != float(qualification[field]):
                raise CanaryError(
                    f"Qualification {field} is manifest-bound and cannot be overridden"
                )
        max_total_usd = float(qualification["max_total_usd"])
        max_script_usd = float(qualification["max_script_usd"])
    else:
        max_total_usd = args.max_total_usd or DEFAULT_MAX_TOTAL_USD
        max_script_usd = args.max_script_usd or DEFAULT_MAX_SCRIPT_USD
    scorecard = run_canary(
        entries,
        out_dir=out_dir,
        execute=execute,
        max_total_usd=max_total_usd,
        max_script_usd=max_script_usd,
        resume_drill_index=args.resume_drill_index,
        proxy_url=args.proxy_url,
        max_calls_per_script=max_calls_per_script,
        qualification=qualification,
    )

    print(json.dumps(scorecard, ensure_ascii=False, indent=1))
    print(f"\nArtifacts: {out_dir}")
    if execute:
        print(HUMAN_CHECKLIST)
    else:
        print(
            "\nDRY RUN complete — no model was called. To spend real money:\n"
            "  PROXY_SERVICE_KEY=... python3 -m execution.coverage_v1_canary \\\n"
            f"    --manifest {args.manifest} --execute --i-authorize-paid-inference"
        )
    return 1 if scorecard["hard_failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
