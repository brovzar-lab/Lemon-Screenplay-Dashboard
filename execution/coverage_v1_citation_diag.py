#!/usr/bin/env python3
"""Offline diagnostic for unverified Coverage V1 citations.

For every citation a canary report marked ``citation_verified: false``, this
prints the model's excerpt next to the closest real passage in the screenplay
(best fuzzy window on the cited page, and the best anywhere in the document).
That is enough to adjudicate each failure as either a near-miss transcription
(high similarity somewhere) or a fabricated quote (no close match anywhere).

Read-only: reuses the cached PDF parse, makes zero network calls, spends $0.

Usage (from the repo root, e.g. /opt/lemon-ingest):
    python3 -m execution.coverage_v1_citation_diag --manifest canary.json
Optionally pin a run with --artifacts <dir>; default is the newest
benchmark-artifacts/coverage-v1-canary-*/ directory.
"""
from __future__ import annotations

import argparse
import copy
import difflib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from . import coverage_v1
from . import ingest_v9


def _best_window(page_text: str, excerpt: str) -> Tuple[float, str]:
    """Best fuzzy match of ``excerpt`` inside ``page_text`` (ratio, snippet)."""
    words = page_text.split()
    target = excerpt.split()
    if not words or not target:
        return 0.0, ""
    span = len(target)
    excerpt_lower = " ".join(target).lower()
    best_ratio, best_snippet = 0.0, ""
    step = max(1, span // 3)
    for start in range(0, max(1, len(words) - span + 1), step):
        window = " ".join(words[start : start + span + 2])
        ratio = difflib.SequenceMatcher(
            None, excerpt_lower, window.lower()
        ).ratio()
        if ratio > best_ratio:
            best_ratio, best_snippet = ratio, window
    return best_ratio, best_snippet


def _find_report(reports_dir: Path, content_sha256: str) -> Optional[Path]:
    for path in sorted(reports_dir.glob("*.json")):
        try:
            head = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if head.get("content_sha256") == content_sha256:
            return path
    return None


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True)
    parser.add_argument(
        "--artifacts",
        default=None,
        help="Canary artifacts dir; defaults to the newest coverage-v1-canary-*",
    )
    args = parser.parse_args(argv)

    if args.artifacts:
        artifacts = Path(args.artifacts)
    else:
        runs = sorted(Path("benchmark-artifacts").glob("coverage-v1-canary-*"))
        if not runs:
            print("No benchmark-artifacts/coverage-v1-canary-* directory found.")
            return 1
        artifacts = runs[-1]
    reports_dir = artifacts / "reports"
    print(f"Artifacts: {artifacts}")

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    total_unverified = 0
    for entry in manifest:
        pdf_path = Path(entry["pdf"])
        parsed = ingest_v9.parse_pdf(pdf_path)
        if parsed is None:
            print(f"\n=== {entry['title']}: PARSE FAILED ({pdf_path}) ===")
            continue
        content_sha = ingest_v9.compute_content_hash(pdf_path)
        report_path = _find_report(reports_dir, content_sha)
        if report_path is None:
            print(f"\n=== {entry['title']}: no report in {reports_dir} ===")
            continue
        report: Dict[str, Any] = json.loads(
            report_path.read_text(encoding="utf-8")
        )
        coverage = report.get("coverage") or {}
        _pages, page_texts = coverage_v1._marked_page_contents(parsed["text"])

        failures = [
            (owner, item)
            for owner, item in coverage_v1._iter_citations(coverage)
            if isinstance(item, dict) and not item.get("citation_verified")
        ]
        summary = report.get("citation_verification") or {}
        print(
            f"\n=== {report.get('title', entry['title'])} "
            f"({report_path.name}): "
            f"{summary.get('unverified', len(failures))} unverified, "
            f"{summary.get('relocated', 0)} relocated, "
            f"{summary.get('verified', '?')}/{summary.get('total', '?')} verified ==="
        )
        for owner, item in failures:
            total_unverified += 1
            page = item.get("page")
            excerpt = str(item.get("excerpt", ""))
            print(f"\n--- {owner}  (cited page {page}) ---")
            print(f"  MODEL EXCERPT: {excerpt!r}")
            on_page_ratio, on_page = _best_window(
                page_texts.get(page, ""), excerpt
            )
            print(f"  BEST ON CITED PAGE  ({on_page_ratio:.0%}): {on_page!r}")
            best_ratio, best_page, best_snippet = 0.0, None, ""
            for candidate_page, candidate_text in page_texts.items():
                ratio, snippet = _best_window(candidate_text, excerpt)
                if ratio > best_ratio:
                    best_ratio, best_page, best_snippet = (
                        ratio,
                        candidate_page,
                        snippet,
                    )
            print(
                f"  BEST ANYWHERE  (page {best_page}, {best_ratio:.0%}): "
                f"{best_snippet!r}"
            )
            if best_ratio >= 0.85:
                verdict = "NEAR-MISS (real passage, imperfect transcription)"
            elif best_ratio >= 0.6:
                verdict = "PARTIAL (some real overlap — judge by eye)"
            else:
                verdict = "LIKELY FABRICATED (no close match anywhere)"
            print(f"  DIAGNOSIS: {verdict}")

        recheck = coverage_v1.verify_citations(
            copy.deepcopy(coverage), parsed["text"]
        )
        print(
            f"  RECHECK with current verifier: "
            f"{recheck['verified']}/{recheck['total']} verified, "
            f"{recheck['relocated']} relocated, "
            f"{recheck['unverified']} unverified"
        )

    print(f"\nTotal unverified citations examined: {total_unverified}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
