#!/usr/bin/env python3
"""
lemon_ingest.py — Lemon Studios V9 Screenplay Ingest CLI

Uploads screenplay PDFs to Firebase Storage (ingest-queue/) and monitors
Firestore for real-time analysis progress from the VPS daemon.

This tool is a pure uploader. All analysis runs on the VPS daemon.
Firebase Firestore is the source of truth.

Usage:
    python lemon_ingest.py
    python lemon_ingest.py --folder /path/to/scripts --category LEMON
    python lemon_ingest.py --dry-run
"""

import argparse
import hashlib
import json
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
    from rich.progress import (
        BarColumn,
        Progress,
        SpinnerColumn,
        TaskProgressColumn,
        TextColumn,
        TimeElapsedColumn,
    )
    from rich.table import Table
    from rich.text import Text
    from rich import box
except ImportError as e:
    print(f"\n❌ Missing dependency: {e}")
    print("Install with:  pip install -r requirements.txt")
    sys.exit(1)

console = Console()

# ── Constants ─────────────────────────────────────────────────────────────────

INGEST_QUEUE_COLLECTION = "ingest-queue"
VALID_COLLECTIONS = {"LEMON", "BLACK_LIST", "ARCHIVE", "TEST"}
MAX_FILE_SIZE_MB = 50
MODEL_COSTS = {"haiku": 0.06, "sonnet": 0.22, "opus": 0.90, "auto": 0.22}

BANNER = """
[bold yellow]🍋 Lemon Ingest V9[/bold yellow]  [dim]— Screenplay Upload Tool[/dim]
[dim]All analysis runs on the VPS daemon. Firebase is the source of truth.[/dim]
"""

# ── Firebase init ──────────────────────────────────────────────────────────────


def init_firebase(service_account_path: Optional[str] = None) -> None:
    """Initialize Firebase Admin SDK. Uses ADC if no path given."""
    if firebase_admin._apps:
        return

    if service_account_path:
        cred = credentials.Certificate(service_account_path)
    else:
        # Try GOOGLE_APPLICATION_CREDENTIALS env var (service account JSON path)
        env_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if env_path and Path(env_path).exists():
            cred = credentials.Certificate(env_path)
        else:
            # Try the project-bundled service account
            local_sa = Path(__file__).parent.parent / "lemon-screenplay-dashboard-firebase-adminsdk-fbsvc-2037a834e2.json"
            if local_sa.exists():
                cred = credentials.Certificate(str(local_sa))
            else:
                # Fall back to Application Default Credentials
                cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred, {
        "storageBucket": "lemon-screenplay-dashboard.firebasestorage.app"
    })


def get_storage_bucket():
    return storage.bucket()


def get_firestore():
    return firestore.client()


# ── File discovery ────────────────────────────────────────────────────────────


def discover_pdfs(folder: Path) -> list[Path]:
    """Recursively find all PDFs in a folder."""
    return sorted(folder.rglob("*.pdf"))


def check_file_size(path: Path) -> float:
    """Return file size in MB."""
    return path.stat().st_size / (1024 * 1024)


def sha256_file(path: Path) -> str:
    """Compute SHA-256 of file content."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


# ── Upload ────────────────────────────────────────────────────────────────────


def upload_pdf(
    path: Path,
    collection_id: str,
    model: str = "auto",
    priority: int = 0,
) -> dict:
    """
    Upload a PDF to Firebase Storage at:
        ingest-queue/{collection_id}/{uuid}_{filename}.pdf

    Sets custom metadata so onScreenplayUploaded CF picks up model preference.

    Returns the storage path and a local content hash (for dedup detection).
    """
    bucket = get_storage_bucket()
    safe_name = path.name.replace(" ", "_")
    blob_name = f"ingest-queue/{collection_id}/{uuid.uuid4().hex}_{safe_name}"
    blob = bucket.blob(blob_name)

    blob.metadata = {
        "model": model,
        "priority": str(priority),
        "original_name": path.name,
    }

    blob.upload_from_filename(str(path), content_type="application/pdf")

    return {
        "storage_path": f"gs://{bucket.name}/{blob_name}",
        "blob_name": blob_name,
    }


# ── Firestore job monitoring ──────────────────────────────────────────────────


def find_job_by_storage_path(db, storage_path: str) -> Optional[dict]:
    """Query Firestore for a job doc matching this storage path."""
    docs = (
        db.collection(INGEST_QUEUE_COLLECTION)
        .where("storage_path", "==", storage_path)
        .limit(1)
        .get()
    )
    if docs:
        d = docs[0]
        data = d.to_dict()
        data["_id"] = d.id
        return data
    return None


def subscribe_to_job(db, job_id: str, on_update) -> None:
    """Firestore real-time listener for a single job document."""
    doc_ref = db.collection(INGEST_QUEUE_COLLECTION).document(job_id)

    def on_snapshot(doc_snapshot, changes, read_time):
        for doc in doc_snapshot:
            on_update(doc.to_dict())

    return doc_ref.on_snapshot(on_snapshot)


# ── Interactive prompts ───────────────────────────────────────────────────────


def prompt_folder() -> Path:
    console.print("\n[bold]📁 Folder path[/bold] (drag & drop or type):")
    raw = input("  > ").strip().strip("'\"").replace("\\ ", " ")
    folder = Path(raw).expanduser().resolve()
    if not folder.exists():
        console.print(f"[red]Path not found:[/red] {folder}")
        sys.exit(1)
    if not folder.is_dir():
        console.print(f"[red]Not a directory:[/red] {folder}")
        sys.exit(1)
    return folder


def prompt_category() -> str:
    console.print("\n[bold]🏷  Category override[/bold] (Enter to use folder name):")
    raw = input("  > ").strip().upper()
    return raw if raw else ""


def prompt_model() -> str:
    console.print("\n[bold]🤖 Analysis model:[/bold]")
    console.print("   [cyan]1.[/cyan] auto     — daemon chooses Haiku/Sonnet based on triage score (~$0.06–$0.22)")
    console.print("   [cyan]2.[/cyan] haiku    — fast & cheap (~$0.06/script)")
    console.print("   [cyan]3.[/cyan] sonnet   — best balance (~$0.22/script)")
    console.print("   [cyan]4.[/cyan] opus     — premium quality (~$0.90/script)")
    choice = input("  > ").strip()
    return {"1": "auto", "2": "haiku", "3": "sonnet", "4": "opus"}.get(choice, "auto")


def prompt_confirm(n: int, model: str, total_mb: float) -> bool:
    cost = MODEL_COSTS.get(model, 0.22)
    est = n * cost
    console.print(
        Panel(
            f"[bold]{n} PDFs[/bold] · {total_mb:.1f} MB total\n"
            f"Estimated cost: [yellow]~${est:.2f}[/yellow] ({model} @ ${cost}/script)\n\n"
            "[dim]All analysis runs on VPS daemon. Results appear in dashboard automatically.[/dim]",
            title="[bold yellow]Confirm Upload[/bold yellow]",
            border_style="yellow",
        )
    )
    choice = input("  Proceed? [Y/n] > ").strip().lower()
    return choice in ("", "y", "yes")


# ── Main ──────────────────────────────────────────────────────────────────────


def run_upload(
    folder: Path,
    category: str,
    model: str,
    dry_run: bool,
    sa_path: Optional[str],
) -> None:
    """Main upload flow."""

    # ── Discover PDFs
    pdfs = discover_pdfs(folder)
    if not pdfs:
        console.print("[yellow]No PDF files found in that folder.[/yellow]")
        return

    # ── Category
    if not category:
        category = folder.name.upper().replace(" ", "_").replace("-", "_")
    if category not in VALID_COLLECTIONS:
        console.print(
            f"[yellow]Warning:[/yellow] '{category}' is not a standard collection. "
            f"Valid: {', '.join(sorted(VALID_COLLECTIONS))}. Using as-is."
        )

    # ── Size check
    oversized = [(p, check_file_size(p)) for p in pdfs if check_file_size(p) > MAX_FILE_SIZE_MB]
    if oversized:
        console.print(f"\n[red]Skipping {len(oversized)} oversized files (>{MAX_FILE_SIZE_MB}MB):[/red]")
        for p, mb in oversized:
            console.print(f"  ✗ {p.name} ({mb:.1f} MB)")
        pdfs = [p for p in pdfs if check_file_size(p) <= MAX_FILE_SIZE_MB]

    total_mb = sum(check_file_size(p) for p in pdfs)

    # ── Confirm
    if not prompt_confirm(len(pdfs), model, total_mb):
        console.print("[dim]Aborted.[/dim]")
        return

    if dry_run:
        console.print(
            Panel("[bold green]DRY RUN[/bold green] — no files uploaded.", border_style="green")
        )
        for p in pdfs:
            console.print(f"  Would upload: [cyan]{p.name}[/cyan]")
        return

    # ── Init Firebase
    with console.status("[dim]Connecting to Firebase...[/dim]"):
        init_firebase(sa_path)

    # ── Upload loop
    results: list[dict] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        upload_task = progress.add_task("[cyan]Uploading PDFs...[/cyan]", total=len(pdfs))

        for pdf in pdfs:
            try:
                result = upload_pdf(pdf, category, model=model)
                result["filename"] = pdf.name
                result["status"] = "queued"
                results.append(result)
                progress.advance(upload_task)
            except Exception as e:
                results.append({
                    "filename": pdf.name,
                    "status": "upload_error",
                    "error": str(e),
                })
                progress.advance(upload_task)
                console.print(f"  [red]✗ Upload failed:[/red] {pdf.name} — {e}")

    # ── Summary table
    uploaded = [r for r in results if r["status"] == "queued"]
    failed = [r for r in results if r["status"] == "upload_error"]

    table = Table(
        title="\n[bold]Upload Summary[/bold]",
        box=box.ROUNDED,
        border_style="dim",
        header_style="bold cyan",
    )
    table.add_column("File", style="white", max_width=50)
    table.add_column("Status", justify="center")
    table.add_column("Storage Path", style="dim", max_width=60)

    for r in results:
        status_txt = (
            Text("✓ queued", style="green")
            if r["status"] == "queued"
            else Text("✗ failed", style="red")
        )
        table.add_row(
            r["filename"],
            status_txt,
            r.get("blob_name", r.get("error", "")),
        )

    console.print(table)
    console.print(
        f"\n[green]✓ {len(uploaded)} queued[/green] · "
        f"[red]{len(failed)} failed[/red]\n"
        f"[dim]VPS daemon will pick up queued scripts automatically.\n"
        f"Results appear in the Lemon Dashboard as they complete.[/dim]\n"
    )

    # Persist results to JSON for reference
    out_path = folder / f".lemon_ingest_{uuid.uuid4().hex[:8]}.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    console.print(f"[dim]Upload log saved: {out_path}[/dim]")


def main():
    parser = argparse.ArgumentParser(
        description="Lemon Studios V9 — Screenplay Upload CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--folder", "-f", type=str, help="Path to folder containing PDFs")
    parser.add_argument("--category", "-c", type=str, default="", help="Category override (e.g. LEMON)")
    parser.add_argument("--model", "-m", type=str, default="", help="Model: auto|haiku|sonnet|opus")
    parser.add_argument("--dry-run", action="store_true", help="Preview without uploading")
    parser.add_argument("--service-account", type=str, help="Path to Firebase service account JSON")
    args = parser.parse_args()

    console.print(BANNER)

    folder = Path(args.folder).expanduser().resolve() if args.folder else prompt_folder()
    category = args.category.upper() if args.category else prompt_category()
    model = args.model.lower() if args.model in MODEL_COSTS else (
        "" if not args.model else ""
    )
    if not model:
        model = prompt_model()

    run_upload(
        folder=folder,
        category=category,
        model=model,
        dry_run=args.dry_run,
        sa_path=args.service_account,
    )


if __name__ == "__main__":
    main()
