#!/usr/bin/env python3
"""
migrate_v6.py — Lemon Studios V6 → V9 Migration Tool

Does three things in one run:
  1. AUDIT   — Shows a breakdown of uploaded_analyses by collection, version, verdict
  2. STANDARDIZE — Fixes inconsistent 'collection' field values across all Firestore docs
  3. REQUEUE — Uploads CONSIDER/RECOMMEND v6_unified PDFs to ingest-queue for V9 re-analysis

Usage (from the project root or ingest/ directory):
    python ingest/migrate_v6.py
    python ingest/migrate_v6.py --dry-run          # preview only, no writes
    python ingest/migrate_v6.py --audit-only        # just the report
    python ingest/migrate_v6.py --skip-requeue      # standardize only, no re-upload
"""

import argparse
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    import firebase_admin
    from firebase_admin import credentials, firestore, storage
    from rich.console import Console
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TaskProgressColumn
    from rich.table import Table
    from rich.text import Text
    from rich import box
except ImportError as e:
    print(f"\n❌ Missing dependency: {e}")
    print("Run:  pip install -r ingest/requirements.txt")
    sys.exit(1)

console = Console()

import re


ANALYSES_COLLECTION = "uploaded_analyses"
INGEST_QUEUE_COLLECTION = "ingest-queue"

# Root folder containing all screenplay PDFs on this machine
PDF_ROOT = Path("/Users/quantumcode/Documents/GUIONES PAD/LEMON GUIONES")

# Map known messy collection values → standardized collection_id
COLLECTION_NORMALIZE_MAP = {
    # LEMON variants
    "lemon":        "LEMON",
    "a-d":          "LEMON",
    "a_d":          "LEMON",
    "e-l":          "LEMON",
    "e_l":          "LEMON",
    "m-r":          "LEMON",
    "m_r":          "LEMON",
    "s-z":          "LEMON",
    "s_z":          "LEMON",

    # Black List variants
    "black list":   "BLACK_LIST",
    "black_list":   "BLACK_LIST",
    "blacklist":    "BLACK_LIST",

    # Archive / misc
    "randoms":      "ARCHIVE",
    "archive":      "ARCHIVE",
    "analysis":     "UNKNOWN",
    "":             "UNKNOWN",
}

STANDARD_COLLECTIONS = {"LEMON", "BLACK_LIST", "ARCHIVE", "TEST", "UNKNOWN"}

# Verdicts that warrant V9 re-analysis
REQUEUE_VERDICTS = {"consider", "recommend", "film_now", "strong consider"}

# V6 analysis_version values to target
V6_VERSIONS = {"v6_unified", "v6", "v5", "v5_full"}


# ── Firebase init ─────────────────────────────────────────────────────────────

def init_firebase() -> None:
    if firebase_admin._apps:
        return
    # Try service account in project root first
    candidates = [
        Path(__file__).parent.parent / "lemon-screenplay-dashboard-firebase-adminsdk-fbsvc-2037a834e2.json",
    ]
    env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if env:
        candidates.insert(0, Path(env))

    for path in candidates:
        if path.exists():
            cred = credentials.Certificate(str(path))
            firebase_admin.initialize_app(cred, {
                "storageBucket": "lemon-screenplay-dashboard.firebasestorage.app"
            })
            console.print(f"[dim]✓ Firebase: {path.name}[/dim]")
            return

    # Fall back to ADC
    firebase_admin.initialize_app(credentials.ApplicationDefault(), {
        "storageBucket": "lemon-screenplay-dashboard.firebasestorage.app"
    })
    console.print("[dim]✓ Firebase: Application Default Credentials[/dim]")


# ── Firestore helpers ─────────────────────────────────────────────────────────

def fetch_all_analyses(db) -> list[dict]:
    """Fetch all documents from uploaded_analyses."""
    docs = db.collection(ANALYSES_COLLECTION).get()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data["_id"] = doc.id
        results.append(data)
    return results


def normalize_collection(raw: str) -> str:
    """Map a raw collection string to a standardized collection_id."""
    clean = str(raw or "").strip()
    clean_lower = clean.lower()

    # Year-prefixed Black List variants: "2005 Black List", "2006 BLACK LIST", etc.
    if re.match(r'^\d{4}\s+black\s*list$', clean_lower):
        return "BLACK_LIST"

    if clean_lower in COLLECTION_NORMALIZE_MAP:
        return COLLECTION_NORMALIZE_MAP[clean_lower]

    # Already a standard value
    if clean.upper() in STANDARD_COLLECTIONS:
        return clean.upper()

    return clean.upper() if clean else "UNKNOWN"


def get_recommendation(doc: dict) -> str:
    """
    Extract the recommendation/verdict from a raw Firestore document.
    Checks all known field paths across v5, v6_unified, and v7_archaeology formats.
    """
    version = normalize_version(doc.get("analysis_version", ""))
    analysis = doc.get("analysis") or {}
    if not isinstance(analysis, dict):
        analysis = {}

    # v7_archaeology: raw.analysis.verdict
    if "v7" in version or "v8" in version or "v9" in version:
        v = analysis.get("verdict") or analysis.get("recommendation") or ""
        if v:
            return str(v)

    # v6_unified: raw.analysis.core_quality.verdict
    if "v6" in version:
        cq = analysis.get("core_quality") or {}
        if isinstance(cq, dict):
            v = cq.get("verdict") or ""
            if v:
                return str(v)
        # fallback: raw.analysis.verdict
        v = analysis.get("verdict") or ""
        if v:
            return str(v)

    # v5: raw.analysis.assessment.recommendation
    if "v5" in version:
        assessment = analysis.get("assessment") or {}
        if isinstance(assessment, dict):
            v = assessment.get("recommendation") or ""
            if v:
                return str(v)

    # Generic fallbacks — try common top-level and nested paths
    for path in [
        lambda d: d.get("recommendation"),
        lambda d: d.get("verdict"),
        lambda d: (d.get("analysis") or {}).get("verdict"),
        lambda d: (d.get("analysis") or {}).get("recommendation"),
        lambda d: ((d.get("analysis") or {}).get("assessment") or {}).get("recommendation"),
        lambda d: ((d.get("analysis") or {}).get("core_quality") or {}).get("verdict"),
    ]:
        try:
            v = path(doc)
            if v:
                return str(v)
        except Exception:
            pass

    return "unknown"


def normalize_recommendation(raw: str) -> str:
    return str(raw or "").strip().lower().replace(" ", "_").replace("-", "_")


def normalize_version(raw: str) -> str:
    return str(raw or "").strip().lower()


# ── Step 1: Audit ─────────────────────────────────────────────────────────────

def run_audit(docs: list[dict]) -> None:
    console.print(Panel(
        f"[bold]{len(docs)} total documents[/bold] in [cyan]uploaded_analyses[/cyan]",
        title="[bold yellow]📊 Firestore Audit[/bold yellow]",
        border_style="yellow",
    ))

    # By collection
    by_collection: dict[str, int] = {}
    by_version: dict[str, int] = {}
    by_verdict: dict[str, int] = {}
    collection_needs_fix: list[str] = []

    for doc in docs:
        raw_coll = str(doc.get("collection", "") or "")
        norm = normalize_collection(raw_coll)
        by_collection[norm] = by_collection.get(norm, 0) + 1
        if norm != raw_coll.upper() and raw_coll.upper() not in STANDARD_COLLECTIONS:
            collection_needs_fix.append(doc["_id"])

        version = normalize_version(doc.get("analysis_version", "unknown"))
        by_version[version] = by_version.get(version, 0) + 1

        verdict = normalize_recommendation(get_recommendation(doc))
        by_verdict[verdict] = by_verdict.get(verdict, 0) + 1

    # Collections table
    t1 = Table(title="By Collection", box=box.SIMPLE, header_style="bold cyan")
    t1.add_column("Collection"); t1.add_column("Count", justify="right")
    for coll, count in sorted(by_collection.items(), key=lambda x: -x[1]):
        t1.add_row(coll, str(count))
    console.print(t1)

    # Versions table
    t2 = Table(title="By Analysis Version", box=box.SIMPLE, header_style="bold cyan")
    t2.add_column("Version"); t2.add_column("Count", justify="right")
    for ver, count in sorted(by_version.items(), key=lambda x: -x[1]):
        color = "red" if any(v in ver for v in ["v6", "v5"]) else "green"
        t2.add_row(f"[{color}]{ver}[/{color}]", str(count))
    console.print(t2)

    # Verdicts table
    t3 = Table(title="By Verdict", box=box.SIMPLE, header_style="bold cyan")
    t3.add_column("Verdict"); t3.add_column("Count", justify="right")
    for verdict, count in sorted(by_verdict.items(), key=lambda x: -x[1]):
        t3.add_row(verdict, str(count))
    console.print(t3)

    # V6 CONSIDER/RECOMMEND candidates
    candidates = [
        d for d in docs
        if normalize_version(d.get("analysis_version", "")) in V6_VERSIONS
        and normalize_recommendation(get_recommendation(d)) in REQUEUE_VERDICTS
    ]
    console.print(f"\n[bold yellow]V6 scripts worth re-analyzing:[/bold yellow] [bold]{len(candidates)}[/bold]")
    if candidates:
        ct = Table(box=box.SIMPLE, header_style="bold")
        ct.add_column("Title", max_width=50)
        ct.add_column("Verdict")
        ct.add_column("Version")
        ct.add_column("Source File", style="dim", max_width=40)
        for d in candidates:
            verdict = normalize_recommendation(get_recommendation(d))
            color = "green" if verdict in {"recommend", "film_now"} else "yellow"
            ct.add_row(
                str(d.get("title", "Unknown")),
                f"[{color}]{verdict.upper()}[/{color}]",
                str(d.get("analysis_version", "")),
                str(d.get("source_file", d.get("metadata", {}).get("filename", "—")) if isinstance(d.get("metadata"), dict) else d.get("source_file", "—")),
            )
        console.print(ct)

    if collection_needs_fix:
        console.print(f"\n[yellow]⚠  {len(collection_needs_fix)} documents have non-standard collection values → will be fixed in Step 2[/yellow]")


# ── Step 2: Standardize collection field ──────────────────────────────────────

def run_standardize(db, docs: list[dict], dry_run: bool) -> int:
    console.print(Panel(
        "Normalizing 'collection' field across all documents",
        title="[bold yellow]🔧 Standardize Collections[/bold yellow]",
        border_style="yellow",
    ))

    to_fix = []
    for doc in docs:
        raw = str(doc.get("collection", "") or "")
        norm = normalize_collection(raw)
        if norm != raw:  # needs update
            to_fix.append((doc["_id"], raw, norm))

    if not to_fix:
        console.print("[green]✓ All collection fields are already standardized.[/green]")
        return 0

    console.print(f"Updating [bold]{len(to_fix)}[/bold] documents:")
    for doc_id, old, new in to_fix[:10]:
        console.print(f"  [dim]{doc_id[:12]}…[/dim]  [red]{old or '(empty)'}[/red] → [green]{new}[/green]")
    if len(to_fix) > 10:
        console.print(f"  [dim]… and {len(to_fix) - 10} more[/dim]")

    if dry_run:
        console.print("\n[dim][DRY RUN] No changes written.[/dim]")
        return len(to_fix)

    # Firestore batch writes (max 500 per batch)
    updated = 0
    batch = db.batch()
    batch_count = 0
    for doc_id, _old, new in to_fix:
        ref = db.collection(ANALYSES_COLLECTION).document(doc_id)
        batch.update(ref, {"collection": new})
        batch_count += 1
        if batch_count >= 400:
            batch.commit()
            batch = db.batch()
            batch_count = 0
        updated += 1

    if batch_count > 0:
        batch.commit()

    console.print(f"\n[green]✓ Standardized {updated} documents.[/green]")
    return updated


# ── Step 3: Re-queue V6 CONSIDER/RECOMMEND scripts ───────────────────────────

def find_pdf(title: str, source_file: str) -> Optional[Path]:
    """
    Search for a PDF under PDF_ROOT matching by source_file name or title.
    Returns the first match found, or None.
    """
    if not PDF_ROOT.exists():
        return None

    # Candidates to search for
    candidates = []
    if source_file and source_file != "—":
        sf = Path(source_file).name  # just the filename part
        candidates.append(sf)
        # Without extension
        candidates.append(Path(sf).stem)

    if title:
        # Sanitize title to match likely filename
        safe = title.replace(" ", "_").replace("/", "_").replace(":", "")
        candidates.append(safe + ".pdf")
        candidates.append(safe)
        candidates.append(title)

    for pdf in PDF_ROOT.rglob("*.pdf"):
        pdf_lower = pdf.name.lower()
        stem_lower = pdf.stem.lower()
        for cand in candidates:
            cand_lower = str(cand).lower().replace(" ", "_")
            cand_stem = Path(cand_lower).stem
            if (pdf_lower == cand_lower or
                stem_lower == cand_stem or
                cand_stem in stem_lower or
                stem_lower in cand_stem):
                return pdf

    return None


def upload_to_ingest_queue(pdf_path: Path, collection_id: str, model: str = "sonnet") -> str:
    """Upload PDF to Firebase Storage ingest-queue/. Returns storage path."""
    bucket = storage.bucket()
    safe_name = pdf_path.name.replace(" ", "_")
    blob_name = f"ingest-queue/{collection_id}/{uuid.uuid4().hex}_{safe_name}"
    blob = bucket.blob(blob_name)
    blob.metadata = {
        "model": model,
        "priority": "1",  # migration jobs get priority 1 (normal)
        "original_name": pdf_path.name,
        "migration": "v6_to_v9",
    }
    blob.upload_from_filename(str(pdf_path), content_type="application/pdf")
    return f"gs://{bucket.name}/{blob_name}"


def run_requeue(docs: list[dict], dry_run: bool) -> None:
    console.print(Panel(
        "Finding and re-uploading V6 CONSIDER/RECOMMEND scripts for V9 re-analysis",
        title="[bold yellow]🔄 Re-queue V6 → V9[/bold yellow]",
        border_style="yellow",
    ))

    candidates = [
        d for d in docs
        if normalize_version(d.get("analysis_version", "")) in V6_VERSIONS
        and normalize_recommendation(get_recommendation(d)) in REQUEUE_VERDICTS
    ]

    if not candidates:
        console.print("[green]No V6 CONSIDER/RECOMMEND scripts found — nothing to re-queue.[/green]")
        return

    console.print(f"[bold]{len(candidates)}[/bold] candidates. Searching for PDFs in:\n  [dim]{PDF_ROOT}[/dim]\n")

    found = []
    not_found = []

    for doc in candidates:
        title = str(doc.get("title", ""))
        # Try multiple source file fields
        meta = doc.get("metadata", {})
        source_file = (
            doc.get("source_file") or
            (meta.get("filename") if isinstance(meta, dict) else None) or
            ""
        )
        pdf = find_pdf(title, source_file)
        if pdf:
            found.append((doc, pdf))
        else:
            not_found.append((doc, title, source_file))

    # Report
    console.print(f"[green]✓ Found:[/green]    {len(found)} PDFs matched on disk")
    console.print(f"[yellow]⚠  Not found:[/yellow] {len(not_found)} PDFs could not be located\n")

    if not_found:
        t = Table(title="Could Not Find (manual upload needed)", box=box.SIMPLE, header_style="bold yellow")
        t.add_column("Title", max_width=45)
        t.add_column("Verdict")
        t.add_column("Tried filename", style="dim", max_width=35)
        for doc, title, sf in not_found:
            t.add_row(
                title,
                normalize_recommendation(get_recommendation(doc)).upper(),
                sf or "(no filename field)",
            )
        console.print(t)

    if not found:
        console.print("[yellow]Nothing to upload.[/yellow]")
        return

    if dry_run:
        console.print("\n[dim][DRY RUN] Would upload:[/dim]")
        for doc, pdf in found:
            coll = normalize_collection(str(doc.get("collection", "")))
            console.print(f"  [dim]{pdf.name}[/dim] → [cyan]ingest-queue/{coll}/[/cyan]")
        console.print(f"\n[dim][DRY RUN] {len(found)} uploads skipped.[/dim]")
        return

    # Upload
    results = []
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        task = progress.add_task(f"[cyan]Uploading {len(found)} PDFs...[/cyan]", total=len(found))
        for doc, pdf in found:
            coll = normalize_collection(str(doc.get("collection", "")))
            if coll == "UNKNOWN":
                coll = "LEMON"  # default for unmapped collections
            try:
                path = upload_to_ingest_queue(pdf, coll, model="sonnet")
                results.append({"file": pdf.name, "status": "queued", "path": path})
            except Exception as e:
                results.append({"file": pdf.name, "status": "error", "error": str(e)})
            progress.advance(task)

    # Summary
    queued = [r for r in results if r["status"] == "queued"]
    errors = [r for r in results if r["status"] == "error"]

    console.print(f"\n[green]✓ {len(queued)} queued for V9 analysis[/green]")
    if errors:
        console.print(f"[red]✗ {len(errors)} failed:[/red]")
        for r in errors:
            console.print(f"  {r['file']}: {r.get('error')}")

    console.print(
        "\n[dim]VPS daemon will pick up the queued scripts automatically.\n"
        "Results will appear in the dashboard as V9 analyses complete.\n"
        "The original V6 documents remain in Firestore until you choose to delete them.[/dim]"
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Lemon V6→V9 Migration Tool")
    parser.add_argument("--dry-run", action="store_true", help="Preview all changes without writing anything")
    parser.add_argument("--audit-only", action="store_true", help="Show audit report only, no changes")
    parser.add_argument("--skip-requeue", action="store_true", help="Standardize only, skip PDF re-upload")
    args = parser.parse_args()

    console.print(Panel(
        "[bold yellow]🍋 Lemon V6 → V9 Migration[/bold yellow]\n"
        "[dim]Audit · Standardize · Re-queue[/dim]",
        border_style="yellow",
    ))

    if args.dry_run:
        console.print("[bold yellow]DRY RUN MODE — no writes will happen[/bold yellow]\n")

    # Init Firebase
    with console.status("[dim]Connecting to Firebase...[/dim]"):
        init_firebase()
        db = firestore.client()

    # Fetch all docs
    with console.status(f"[dim]Fetching all documents from {ANALYSES_COLLECTION}...[/dim]"):
        docs = fetch_all_analyses(db)

    console.print(f"[dim]Fetched {len(docs)} documents.[/dim]\n")

    # ── Step 1: Audit
    run_audit(docs)

    if args.audit_only:
        console.print("\n[dim]--audit-only flag set. Done.[/dim]")
        return

    console.print()

    # ── Step 2: Standardize
    run_standardize(db, docs, dry_run=args.dry_run)

    console.print()

    # ── Step 3: Re-queue
    if not args.skip_requeue:
        run_requeue(docs, dry_run=args.dry_run)
    else:
        console.print("[dim]--skip-requeue flag set. Skipping PDF upload step.[/dim]")

    console.print("\n[bold green]✓ Migration complete.[/bold green]\n")


if __name__ == "__main__":
    main()
