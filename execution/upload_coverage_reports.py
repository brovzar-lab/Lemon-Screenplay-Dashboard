#!/usr/bin/env python3
"""Upload sealed Coverage V1 reports into the coverage_v1_reports STAGING
collection so the dashboard can display them.

Writes ONLY to coverage_v1_reports — never uploaded_analyses. Doc id is the
report's content_sha256, so re-uploading a newer report for the same
screenplay overwrites its staging doc (one card per script). Clients read
this collection; only this script (Admin SDK) writes it.

Usage (on the VPS, from /opt/lemon-ingest, with GOOGLE_APPLICATION_CREDENTIALS
and FIREBASE_PROJECT_ID exported, e.g. from the daemon's .env):

    venv/bin/python -m execution.upload_coverage_reports \
        benchmark-artifacts/coverage-v1-canary-<run>/reports/01-*.json ...

Free of model calls; Firestore writes only.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

STAGING_COLLECTION = "coverage_v1_reports"


def load_report(path: Path) -> Optional[Dict[str, Any]]:
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"SKIP {path}: unreadable ({error})")
        return None
    if report.get("analysis_version") != "coverage_v1":
        print(f"SKIP {path}: not a coverage_v1 report")
        return None
    if report.get("status") not in ("sealed", "needs_review"):
        print(f"SKIP {path}: status {report.get('status')!r}")
        return None
    if not report.get("content_sha256"):
        print(f"SKIP {path}: missing content_sha256")
        return None
    return report


def staging_doc(report: Dict[str, Any]) -> Dict[str, Any]:
    title = str(report.get("title", "")).strip() or "Untitled"
    return {
        # The dashboard normalizer resolves report_json into the full report.
        "report_json": json.dumps(report, ensure_ascii=False),
        "analysis_version": "coverage_v1",
        "engine_version": report.get("engine_version"),
        "status": report.get("status"),
        "verdict": report.get("verdict"),
        "title": title,
        # coverage-v1/ prefix keeps the derived dashboard identity distinct
        # from any sealed V9 analysis of the same screenplay, so both cards
        # can be compared side by side.
        "source_file": f"coverage-v1/{title}",
        "content_sha256": report.get("content_sha256"),
        "collection_id": "Analysis",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reports", nargs="+", help="Sealed report JSON paths")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    docs: List[Dict[str, Any]] = []
    for raw_path in args.reports:
        report = load_report(Path(raw_path))
        if report is not None:
            docs.append(staging_doc(report))
            print(
                f"OK   {raw_path}: {report['title']} "
                f"({report.get('engine_version')}, {report.get('verdict')})"
            )
    if not docs:
        print("Nothing to upload.")
        return 1
    if args.dry_run:
        print(f"Dry run: {len(docs)} report(s) would be uploaded.")
        return 0

    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        print(
            "GOOGLE_APPLICATION_CREDENTIALS is not set — no write attempted.",
            file=sys.stderr,
        )
        return 2

    import firebase_admin
    from firebase_admin import credentials, firestore

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    app = firebase_admin.initialize_app(
        credentials.ApplicationDefault(),
        {"projectId": project_id} if project_id else None,
    )
    db = firestore.client(app)
    for doc in docs:
        db.collection(STAGING_COLLECTION).document(doc["content_sha256"]).set(doc)
        print(f"UPLOADED {doc['title']} -> {STAGING_COLLECTION}/{doc['content_sha256']}")
    print(f"Done: {len(docs)} staging document(s) written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
