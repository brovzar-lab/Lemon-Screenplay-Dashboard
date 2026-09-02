"""Coverage V1 canary runner — the first (and only) authorized paid test.

Runs a small batch of local screenplay PDFs through the lean two-call
coverage_v1 engine, sequentially, with hard spending caps and an induced
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
from typing import Any, Callable, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).parent))

import coverage_v1  # noqa: E402
from content_identity import compute_content_hash  # noqa: E402

DEFAULT_MAX_TOTAL_USD = 10.00
DEFAULT_MAX_SCRIPT_USD = 1.50
DEFAULT_RESUME_DRILL_INDEX = 2  # 1-based: the second script proves resume
ARTIFACTS_ROOT = Path(__file__).resolve().parents[1] / "benchmark-artifacts"


class CanaryError(RuntimeError):
    """Fail-closed canary error."""


class InducedKillError(RuntimeError):
    """Deliberate mid-run kill for the resume drill. Not a real failure."""


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


def load_manifest(path: Path) -> List[Dict[str, Any]]:
    entries = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(entries, list) or not entries:
        raise CanaryError("Manifest must be a non-empty JSON list")
    for i, entry in enumerate(entries):
        if not isinstance(entry, dict) or not entry.get("pdf"):
            raise CanaryError(f"Manifest entry {i} needs a 'pdf' path")
    return entries


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
) -> Dict[str, Any]:
    """Run the canary batch. Returns the scorecard dict (also written to disk).

    With execute=False this is a free dry run: no transport is ever invoked.
    """
    coverage_v1.assert_schemas_compiler_safe()
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
        "scripts": [],
        "totals": {
            "charged_usd": 0.0,
            "settled_usd": 0.0,
            "uncertain_usd": 0.0,
            "call_count": 0,
        },
        "hard_failures": [],
        "resume_drill": None,
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

        content_hash = compute_content_hash(pdf_path)
        row["content_sha256"] = content_hash

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
                # Resume may legitimately run audit + audit retry + fact
                # repair + re-audit (4 calls); repaying coverage would be 5+.
                drill["repaid_nothing"] = (
                    drill["resumed_coverage_replayed"]
                    and drill["resume_run_call_count"] <= 4
                )
                scorecard["resume_drill"] = {**drill, "script": title}
                if not drill["repaid_nothing"]:
                    scorecard["hard_failures"].append(
                        f"#{index} {title}: resume drill repaid work"
                    )
            else:
                report, usage = coverage_v1.run_coverage_v1(
                    transport=transport, usage_sink=run_sink, **run_kwargs
                )
        except Exception as error:  # noqa: BLE001 — one bad script must
            # never abort the batch or lose the spend record (a live
            # LlmOutputContractError killed a run scorecard-less on
            # 2026-09-01). Engine errors and transport errors alike become
            # a failed_closed row; money spent still counts.
            failed_cost = coverage_v1._usage_cost_split(
                coverage_v1._merge_usage(kill_sink, run_sink)
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
            continue

        cost = dict(report["cost"])
        if kill_run_charged:
            # The killed first run paid for the coverage call; the resumed
            # run replays (never re-charges) it, so fold the real spend in.
            kill_cost = coverage_v1._usage_cost_split(kill_sink)
            for field in ("charged_usd", "settled_usd", "uncertain_usd"):
                cost[field] = round(cost[field] + kill_cost[field], 6)
            cost["call_count"] += kill_cost["call_count"]
        charged_total += float(cost["charged_usd"])
        row.update(
            {
                "status": report["status"],
                "verdict": report["verdict"],
                "confidence": report["confidence"],
                "film_now_nominated": report["film_now_nominated"],
                "human_review_recommended": report["human_review_recommended"],
                "review_reasons": report["review_reasons"],
                "support_rate": report["fact_audit"]["support_rate"],
                "central_failures": report["fact_audit"]["central_failures"],
                "citations_total": (report.get("citation_verification") or {}).get("total"),
                "citations_unverified": (report.get("citation_verification") or {}).get("unverified"),
                "cost": cost,
                "resume_drill": drill,
                "spine": report["coverage"]["story_spine"],
                "development_priorities": report["coverage"][
                    "development_priorities"
                ],
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
        # 2 base calls + 1 structure/audit repair + fact repair + re-audit
        # (engine v1.1, calibration brief #3 governance stage).
        bars["max_five_calls_per_script"] = all(
            s["cost"]["call_count"] <= 5 for s in completed
        )
        bars["zero_unverified_citations"] = all(
            (s.get("citations_unverified") or 0) == 0 for s in completed
        )
        bars["settled_cost_max_usd"] = max(
            (s["cost"]["settled_usd"] for s in completed), default=0.0
        )
        bars["settled_cost_target_060"] = bars["settled_cost_max_usd"] <= 0.60
        drill_result = scorecard.get("resume_drill")
        bars["resume_repaid_nothing"] = bool(
            drill_result and drill_result.get("repaid_nothing")
        )

    scorecard["finished_at"] = datetime.now(timezone.utc).isoformat()
    (out_dir / "scorecard.json").write_text(
        json.dumps(scorecard, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    return scorecard


HUMAN_CHECKLIST = """\
HUMAN BARS (Billy / trusted reader — the runner cannot judge these):
  For each script, open reports/NN-title.json and check:
    1. story_spine — protagonist, relationships, major turns, climax, ENDING
       are what actually happens in the screenplay. One wrong ending = STOP.
    2. development_priorities — are at least 2 of 3 genuinely actionable?
       (Bar: actionable notes on >= 3 of 5 scripts.)
    3. Is the coverage at least as useful as the sealed V9 report for the
       three known scripts?
  Continue to the 20-script benchmark only if every automated bar passed AND
  the human bars hold. Otherwise: fix the contract, re-canary (<= $10 again).
"""


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Coverage V1 canary — dry-run by default; paid mode is double-gated."
    )
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--max-total-usd", type=float, default=DEFAULT_MAX_TOTAL_USD)
    parser.add_argument("--max-script-usd", type=float, default=DEFAULT_MAX_SCRIPT_USD)
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

    entries = load_manifest(args.manifest)
    scorecard = run_canary(
        entries,
        out_dir=out_dir,
        execute=execute,
        max_total_usd=args.max_total_usd,
        max_script_usd=args.max_script_usd,
        resume_drill_index=args.resume_drill_index,
        proxy_url=args.proxy_url,
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
