#!/usr/bin/env python3
"""Restart-safe folder uploader for the Lemon V9 production queue.

This program never runs analysis locally. It finds PDFs, performs free safety
checks, uploads accepted files to the current Firebase Storage queue, and then
lets the production VPS perform the authoritative V9 analysis.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
import uuid
from datetime import datetime, timezone
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Optional

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, storage
except ImportError:  # Pure helpers and their tests do not require Firebase.
    firebase_admin = None
    credentials = firestore = storage = None


VALID_COLLECTIONS = ("LEMON", "SUBMISSION", "BLKLST", "CONTEST", "OTHER")
VALID_MODELS = ("haiku", "sonnet", "opus", "hybrid")
PROJECT_ID = "lemon-screenplay-dashboard"
STORAGE_BUCKET = "lemon-screenplay-dashboard.firebasestorage.app"
MODEL_COST_RANGES_USD = {
    "haiku": (0.50, 1.50),
    "sonnet": (1.60, 4.50),
    "opus": (2.70, 7.50),
    "hybrid": (1.60, 12.00),
}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
MANIFEST_FILENAME = ".lemon_ingest_batch.json"
MANIFEST_VERSION = 1
OUTPUT_COLLECTION = "uploaded_analyses"
QUEUE_COLLECTION = "ingest-queue"
QUEUE_CONFIRM_TIMEOUT_SECONDS = 60
FIREBASE_REQUEST_TIMEOUT_SECONDS = 15
POSTER_COST_USD = 0.0336
LOCK_FILENAME = ".lemon_ingest_batch.lock"
MAY_HAVE_UPLOADED = {"uploading", "upload_error", "awaiting_queue", "queue_unconfirmed", "queued"}
VALID_STATUSES = {
    "ready",
    "uploading",
    "upload_error",
    "awaiting_queue",
    "queue_unconfirmed",
    "queued",
    "skipped_duplicate",
    "skipped_existing",
    "blocked_invalid",
    "blocked_title",
    "blocked_changed",
    "blocked_missing",
    "blocked_object_conflict",
}

ProgressCallback = Callable[[str, dict[str, Any]], None]


class BatchError(RuntimeError):
    """A safe, user-fixable batch configuration error."""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def discover_pdfs(folder: Path) -> list[Path]:
    """Find PDFs recursively, including files with an upper-case extension."""
    return sorted(
        (path for path in folder.rglob("*") if path.is_file() and path.suffix.lower() == ".pdf"),
        key=lambda path: str(path.relative_to(folder)).casefold(),
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def infer_title(filename: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[_-]", " ", re.sub(r"\.pdf$", "", filename, flags=re.I))).strip()


def normalized_title(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value)).strip().casefold()


def pdf_file_error(path: Path) -> Optional[str]:
    size = path.stat().st_size
    if size == 0:
        return "The PDF is empty."
    if size >= MAX_FILE_SIZE_BYTES:
        return "The PDF is 50 MB or larger."
    with path.open("rb") as source:
        if b"%PDF-" not in source.read(1024):
            return "The file does not have a valid PDF header."
    return None


def sanitize_for_storage_path(filename: str) -> str:
    """Mirror sanitizeForStoragePath() in src/lib/firebase.ts."""
    stem = re.sub(r"\.pdf$", "", filename, flags=re.IGNORECASE)
    stem = re.sub(r"[^a-zA-Z0-9_\- ]", "", stem).strip()
    return re.sub(r"\s+", "_", stem) or "screenplay"


def manifest_path(folder: Path) -> Path:
    return folder / MANIFEST_FILENAME


def archive_manifest(folder: Path) -> Optional[Path]:
    """Keep the old audit trail while allowing a fresh batch configuration."""
    path = manifest_path(folder.expanduser().resolve())
    if not path.exists():
        return None
    manifest = load_manifest(path)
    if manifest and any(item.get("status") in MAY_HAVE_UPLOADED for item in manifest["files"]):
        raise BatchError(
            "This batch may already exist in production. It cannot be replaced with --new-batch. "
            "Keep using the saved batch so it cannot create a second paid job."
        )
    archived = path.with_name(f"{path.stem}.{time.time_ns()}{path.suffix}")
    os.replace(path, archived)
    return archived


def load_manifest(path: Path) -> Optional[dict[str, Any]]:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BatchError(f"The saved batch file is damaged: {path.name}") from error
    if payload.get("version") != MANIFEST_VERSION or not isinstance(payload.get("files"), list):
        raise BatchError(f"The saved batch file has an unsupported format: {path.name}")
    validate_manifest(payload, path)
    return payload


def validate_manifest(manifest: dict[str, Any], path: Path) -> None:
    """Fail closed before a saved local path can reach Firebase Admin."""
    if manifest.get("version") != MANIFEST_VERSION or not isinstance(manifest.get("files"), list):
        raise BatchError("The saved batch has an unsupported format.")
    folder_text = manifest.get("folder")
    if not isinstance(folder_text, str) or not Path(folder_text).is_absolute():
        raise BatchError("The saved batch folder is invalid.")
    folder = Path(folder_text).expanduser().resolve()
    if path.expanduser().resolve() != manifest_path(folder):
        raise BatchError("The saved batch folder does not match its location.")
    category = manifest.get("category")
    model = manifest.get("model")
    if category not in VALID_COLLECTIONS or model not in VALID_MODELS:
        raise BatchError("The saved batch has an invalid category or reading route.")
    if not re.fullmatch(r"[0-9a-f]{32}", str(manifest.get("batch_id", ""))):
        raise BatchError("The saved batch ID is invalid.")

    for item in manifest.get("files", []):
        if not isinstance(item, dict):
            raise BatchError("The saved batch contains an invalid file record.")
        relative_text = item.get("relative_path")
        filename = item.get("filename")
        upload_id = str(item.get("upload_id", ""))
        status = item.get("status")
        if not isinstance(relative_text, str) or not relative_text:
            raise BatchError("The saved batch contains an invalid relative path.")
        relative = Path(relative_text)
        if relative.is_absolute() or ".." in relative.parts or "\\" in relative_text:
            raise BatchError(f"Unsafe saved path: {relative_text}")
        if (
            not isinstance(filename, str)
            or filename != relative.name
            or Path(filename).name != filename
            or len(filename) > 255
            or re.search(r"[\x00-\x1f\x7f]", filename)
            or not filename.lower().endswith(".pdf")
        ):
            raise BatchError(f"Invalid saved PDF name: {relative_text}")
        if not re.fullmatch(r"[0-9a-f]{32}", upload_id):
            raise BatchError(f"Invalid saved upload ID: {relative_text}")
        if status not in VALID_STATUSES:
            raise BatchError(f"Invalid saved file status: {relative_text}")
        if not isinstance(item.get("size_bytes"), int) or item["size_bytes"] < 0:
            raise BatchError(f"Invalid saved file size: {relative_text}")
        content_hash = item.get("sha256")
        if content_hash and not re.fullmatch(r"[0-9a-f]{64}", str(content_hash)):
            raise BatchError(f"Invalid saved file hash: {relative_text}")
        if status in MAY_HAVE_UPLOADED | {"ready"} and not content_hash:
            raise BatchError(f"Missing saved file hash: {relative_text}")
        expected_object = (
            f"ingest-queue/{category}/{upload_id}/"
            f"{sanitize_for_storage_path(filename)}.pdf"
        )
        if item.get("object_name") != expected_object:
            raise BatchError(f"Invalid saved Storage path: {relative_text}")


def save_manifest(path: Path, manifest: dict[str, Any]) -> None:
    """Write atomically so a power loss cannot leave a half-written manifest."""
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(temp_path, path)


@contextmanager
def folder_lock(folder: Path):
    """Prevent two launchers from changing the same batch manifest."""
    lock_path = folder.expanduser().resolve() / LOCK_FILENAME
    with lock_path.open("a+", encoding="utf-8") as lock_file:
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise BatchError("This folder is already open in another Lemon Ingest window.") from error
        try:
            yield
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def init_firebase(service_account_path: Optional[str] = None) -> None:
    """Use an explicit credential or this Mac's Application Default Credential."""
    if firebase_admin is None or credentials is None:
        raise BatchError("Firebase support is missing. Run: pip install -r ingest/requirements.txt")
    if firebase_admin._apps:
        return
    credential = (
        credentials.Certificate(service_account_path)
        if service_account_path
        else credentials.ApplicationDefault()
    )
    firebase_admin.initialize_app(
        credential,
        {"projectId": PROJECT_ID, "storageBucket": STORAGE_BUCKET},
    )


def get_firestore():
    if firestore is None:
        raise BatchError("Firebase support is missing.")
    client = firestore.client()
    if getattr(client, "project", None) != PROJECT_ID:
        raise BatchError(
            f"Firebase points to {getattr(client, 'project', 'an unknown project')}, "
            f"not {PROJECT_ID}. No files were scanned or uploaded."
        )
    return client


def get_storage_bucket():
    if storage is None:
        raise BatchError("Firebase support is missing.")
    return storage.bucket()


def load_archive_identity(db: Any) -> tuple[dict[str, str], dict[str, str]]:
    """Load only identity fields so renamed revisions are caught without full reports."""
    documents = db.collection(OUTPUT_COLLECTION).select(
        ["content_hash", "analysis.title", "source_file"]
    ).stream(timeout=FIREBASE_REQUEST_TIMEOUT_SECONDS, retry=None)
    hashes: dict[str, str] = {}
    titles: dict[str, str] = {}
    for document in documents:
        data = document.to_dict() or {}
        analysis = data.get("analysis") if isinstance(data.get("analysis"), dict) else {}
        title = str(analysis.get("title") or infer_title(str(data.get("source_file") or document.id)))
        content_hash = data.get("content_hash")
        if isinstance(content_hash, str):
            hashes.setdefault(content_hash, title)
        titles.setdefault(normalized_title(title), title)
    return hashes, titles


def find_queue_jobs(
    db: Any,
    expected_generations: dict[str, str],
    *,
    timeout_seconds: float = FIREBASE_REQUEST_TIMEOUT_SECONDS,
) -> dict[str, dict[str, str]]:
    """Fetch queue confirmations in Firestore's 30-value `in` query chunks."""
    found: dict[str, dict[str, str]] = {}
    storage_paths = list(expected_generations)
    for offset in range(0, len(storage_paths), 30):
        chunk = storage_paths[offset : offset + 30]
        for document in (
            db.collection(QUEUE_COLLECTION)
            .where("storage_path", "in", chunk)
            .get(timeout=timeout_seconds, retry=None)
        ):
            data = document.to_dict() or {}
            path = data.get("storage_path")
            generation = str(data.get("storage_generation") or "")
            if isinstance(path, str) and generation == expected_generations.get(path):
                found[path] = {
                    "job_id": str(document.id),
                    "storage_generation": generation,
                }
    return found


def wait_for_queue_jobs(
    db: Any,
    expected_generations: dict[str, str],
    *,
    timeout_seconds: float = QUEUE_CONFIRM_TIMEOUT_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, dict[str, str]]:
    """Use one bounded wait for the whole batch, not one minute per file."""
    unresolved = set(expected_generations)
    found: dict[str, dict[str, str]] = {}
    deadline = time.monotonic() + timeout_seconds
    while unresolved:
        remaining = deadline - time.monotonic()
        matches = find_queue_jobs(
            db,
            {path: expected_generations[path] for path in unresolved},
            timeout_seconds=max(0.1, min(FIREBASE_REQUEST_TIMEOUT_SECONDS, remaining)),
        )
        found.update(matches)
        unresolved.difference_update(matches)
        if not unresolved:
            break
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        sleep(min(2.0, remaining))
    return found


def prepare_batch(
    folder: Path,
    category: str,
    model: str,
    *,
    db: Any = None,
) -> tuple[dict[str, Any], Path]:
    """Create or refresh the restart manifest without starting paid work."""
    folder = folder.expanduser().resolve()
    category = category.upper()
    model = model.lower()
    if not folder.is_dir():
        raise BatchError(f"Folder not found: {folder}")
    if category not in VALID_COLLECTIONS:
        raise BatchError(f"Category must be one of: {', '.join(VALID_COLLECTIONS)}")
    if model not in VALID_MODELS:
        raise BatchError(f"Model must be one of: {', '.join(VALID_MODELS)}")

    path = manifest_path(folder)
    prior = load_manifest(path)
    if prior and (
        prior.get("folder") != str(folder)
        or prior.get("category") != category
        or prior.get("model") != model
    ):
        raise BatchError(
            f"This folder already has a saved batch for {prior.get('category')} / "
            f"{prior.get('model')}. Move {path.name} aside before starting a different batch."
        )

    manifest: dict[str, Any] = prior or {
        "version": MANIFEST_VERSION,
        "batch_id": uuid.uuid4().hex,
        "folder": str(folder),
        "category": category,
        "model": model,
        "created_at": now_iso(),
        "files": [],
    }
    prior_by_path = {
        item.get("relative_path"): item
        for item in manifest["files"]
        if isinstance(item, dict) and isinstance(item.get("relative_path"), str)
    }
    refreshed: list[dict[str, Any]] = []
    local_hashes: dict[str, str] = {}
    local_titles: dict[str, str] = {}
    discovered_paths: set[str] = set()
    archive_hashes, archive_titles = load_archive_identity(db) if db is not None else ({}, {})

    for item in manifest["files"]:
        if not isinstance(item, dict) or item.get("status") not in MAY_HAVE_UPLOADED:
            continue
        relative_path = str(item["relative_path"])
        content_hash = item.get("sha256")
        if isinstance(content_hash, str) and content_hash:
            local_hashes.setdefault(content_hash, relative_path)
        local_titles.setdefault(normalized_title(infer_title(str(item["filename"]))), relative_path)

    for pdf in discover_pdfs(folder):
        relative_path = str(pdf.relative_to(folder))
        discovered_paths.add(relative_path)
        size_bytes = pdf.stat().st_size
        file_error = pdf_file_error(pdf)
        content_hash = sha256_file(pdf) if file_error is None else ""
        prior_item = prior_by_path.get(relative_path)
        same_file = bool(prior_item and prior_item.get("sha256") == content_hash)
        if prior_item and prior_item.get("status") in MAY_HAVE_UPLOADED:
            item = dict(prior_item)
            item["source_present"] = True
            if not same_file:
                item["source_changed"] = True
            local_titles.setdefault(normalized_title(infer_title(pdf.name)), relative_path)
            refreshed.append(item)
            continue
        item: dict[str, Any] = {
            "relative_path": relative_path,
            "filename": pdf.name,
            "size_bytes": size_bytes,
            "sha256": content_hash,
            "upload_id": (
                prior_item.get("upload_id")
                if same_file and prior_item.get("upload_id")
                else uuid.uuid4().hex
            ),
            "status": prior_item.get("status", "ready") if same_file else "ready",
            "error": prior_item.get("error") if same_file else None,
        }
        item["object_name"] = (
            f"ingest-queue/{category}/{item['upload_id']}/"
            f"{sanitize_for_storage_path(pdf.name)}.pdf"
        )
        title_key = normalized_title(infer_title(pdf.name))
        if file_error:
            item.update(status="blocked_invalid", error=file_error)
        elif content_hash in local_hashes:
            item.update(
                status="skipped_duplicate",
                error=f"Exact copy of {local_hashes[content_hash]}",
            )
        elif title_key in local_titles:
            item.update(
                status="blocked_title",
                error=f"Same project name as {local_titles[title_key]}",
            )
        elif content_hash in archive_hashes:
            item.update(
                status="skipped_existing",
                error=f"Already analyzed as {archive_hashes[content_hash]}",
            )
        elif title_key in archive_titles:
            item.update(
                status="blocked_title",
                error=f"Possible revision of {archive_titles[title_key]}. Resolve it in Intake.",
            )
        elif item["status"] not in {
            "queued",
            "queue_unconfirmed",
            "skipped_existing",
            "blocked_title",
        }:
            item.update(status="ready", error=None)

        if content_hash:
            local_hashes.setdefault(content_hash, relative_path)
        local_titles.setdefault(title_key, relative_path)
        refreshed.append(item)

    for relative_path, prior_item in prior_by_path.items():
        if relative_path in discovered_paths:
            continue
        preserved = dict(prior_item)
        preserved["source_present"] = False
        if preserved.get("status") not in {
            "queued",
            "uploading",
            "upload_error",
            "awaiting_queue",
            "queue_unconfirmed",
            "skipped_existing",
            "skipped_duplicate",
            "blocked_invalid",
            "blocked_title",
            "blocked_changed",
            "blocked_object_conflict",
        }:
            preserved.update(status="blocked_missing", error="The source PDF is no longer in the folder.")
        refreshed.append(preserved)

    if not refreshed:
        raise BatchError("No PDF files were found in that folder.")

    manifest["files"] = refreshed
    manifest["updated_at"] = now_iso()
    save_manifest(path, manifest)
    return manifest, path


def batch_counts(manifest: dict[str, Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in manifest["files"]:
        status = str(item["status"])
        counts[status] = counts.get(status, 0) + 1
    return counts


def batch_cost_range(manifest: dict[str, Any]) -> tuple[float, float]:
    counts = batch_counts(manifest)
    chargeable = sum(counts.get(status, 0) for status in {"ready", "uploading", "upload_error"})
    minimum, maximum = MODEL_COST_RANGES_USD[manifest["model"]]
    return chargeable * minimum, chargeable * maximum


def actionable_count(manifest: dict[str, Any]) -> int:
    actionable = {"ready", "uploading", "upload_error", "awaiting_queue", "queue_unconfirmed"}
    return sum(1 for item in manifest["files"] if item.get("status") in actionable)


def existing_blob_error(blob: Any, item: dict[str, Any], manifest: dict[str, Any]) -> Optional[str]:
    blob.reload()
    metadata = blob.metadata or {}
    expected = {
        "uploadId": item["upload_id"],
        "contentHash": item["sha256"],
        "originalFilename": item["filename"],
        "category": manifest["category"],
        "model": manifest["model"],
    }
    mismatched = [key for key, value in expected.items() if metadata.get(key) != value]
    return f"Existing Storage object has different identity fields: {', '.join(mismatched)}." if mismatched else None


def upload_batch(
    manifest: dict[str, Any],
    path: Path,
    *,
    bucket: Any = None,
    db: Any = None,
    queue_timeout_seconds: float = QUEUE_CONFIRM_TIMEOUT_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
    progress: Optional[ProgressCallback] = None,
) -> dict[str, Any]:
    """Upload ready files and prove the production queue accepted each one."""
    validate_manifest(manifest, path)
    bucket = bucket or get_storage_bucket()
    db = db or get_firestore()
    folder = Path(manifest["folder"])

    for item in manifest["files"]:
        if item["status"] not in {
            "ready",
            "uploading",
            "upload_error",
            "awaiting_queue",
            "queue_unconfirmed",
        }:
            continue
        was_waiting_for_queue = item["status"] in {"awaiting_queue", "queue_unconfirmed"}
        blob = bucket.blob(item["object_name"])
        try:
            exists = blob.exists()
            if exists:
                identity_error = existing_blob_error(blob, item, manifest)
                if identity_error:
                    item.update(status="blocked_object_conflict", error=identity_error)
                    continue
            else:
                if was_waiting_for_queue:
                    item.update(
                        status="queue_unconfirmed",
                        error="The prior uploaded object is missing. Check the queue before any new upload.",
                    )
                    continue
                source_path = folder / item["relative_path"]
                if not source_path.is_file():
                    item.update(status="blocked_missing", error="The source PDF is no longer in the folder.")
                    continue
                file_error = pdf_file_error(source_path)
                current_hash = sha256_file(source_path) if file_error is None else None
                if (
                    file_error
                    or source_path.stat().st_size != item["size_bytes"]
                    or current_hash != item["sha256"]
                ):
                    item.update(
                        status="blocked_changed",
                        error=file_error or "The PDF changed after review. Start a fresh batch to review it again.",
                    )
                    continue
                item.update(status="uploading", error=None)
                manifest["updated_at"] = now_iso()
                save_manifest(path, manifest)
                blob.metadata = {
                    "model": manifest["model"],
                    "priority": "0",
                    "originalFilename": item["filename"],
                    "category": manifest["category"],
                    "uploadedAt": now_iso(),
                    "uploadId": item["upload_id"],
                    "contentHash": item["sha256"],
                }
                blob.upload_from_filename(
                    str(folder / item["relative_path"]),
                    content_type="application/pdf",
                    if_generation_match=0,
                )
                blob.reload()
            storage_generation = str(getattr(blob, "generation", "") or "").strip()
            if not storage_generation:
                raise BatchError("Storage did not return an object generation. Run this batch again.")
            storage_path = f"gs://{bucket.name}/{item['object_name']}"
            item.update(
                status="awaiting_queue",
                error=None,
                storage_path=storage_path,
                storage_generation=storage_generation,
            )
        except Exception as error:
            item.update(status="upload_error", error=str(error))
            if progress:
                progress("error", item)
        finally:
            manifest["updated_at"] = now_iso()
            save_manifest(path, manifest)

    awaiting = [item for item in manifest["files"] if item.get("status") == "awaiting_queue"]
    confirmations = wait_for_queue_jobs(
        db,
        {
            str(item["storage_path"]): str(item["storage_generation"])
            for item in awaiting
        },
        timeout_seconds=queue_timeout_seconds,
        sleep=sleep,
    )
    for item in awaiting:
        confirmation = confirmations.get(str(item["storage_path"]))
        if confirmation and confirmation["storage_generation"] == item["storage_generation"]:
            item.update(
                status="queued",
                error=None,
                queue_job_id=confirmation["job_id"],
                queued_at=now_iso(),
            )
            if progress:
                progress("queued", item)
        else:
            item.update(
                status="queue_unconfirmed",
                error=(
                    "Storage accepted the PDF, but production did not confirm the queue job. "
                    "Run this tool again to recheck it. The PDF will not upload twice."
                ),
            )
            if progress:
                progress("unconfirmed", item)
        manifest["updated_at"] = now_iso()
        save_manifest(path, manifest)
    return manifest


def print_manifest(manifest: dict[str, Any], path: Path) -> None:
    counts = batch_counts(manifest)
    minimum, maximum = batch_cost_range(manifest)
    print(f"\nFolder: {manifest['folder']}")
    print(f"Route: {manifest['category']} / {manifest['model']}")
    print(f"Ready: {counts.get('ready', 0)}")
    print(f"Already queued: {counts.get('queued', 0)}")
    print(f"Waiting for queue confirmation: {counts.get('queue_unconfirmed', 0)}")
    print(f"Duplicates skipped: {counts.get('skipped_duplicate', 0) + counts.get('skipped_existing', 0)}")
    print(f"Title conflicts blocked: {counts.get('blocked_title', 0)}")
    print(f"Invalid files blocked: {counts.get('blocked_invalid', 0)}")
    print(f"Changed or missing files blocked: {counts.get('blocked_changed', 0) + counts.get('blocked_missing', 0)}")
    print(f"Storage identity conflicts blocked: {counts.get('blocked_object_conflict', 0)}")
    print(f"Estimated analysis cost: ${minimum:.2f} to ${maximum:.2f}")
    chargeable = sum(counts.get(status, 0) for status in {"ready", "uploading", "upload_error"})
    print(
        "Automatic poster extra: up to "
        f"${chargeable * POSTER_COST_USD:.2f} if no chargeable script receives PASS "
        f"(${POSTER_COST_USD:.4f} each; separate $5/day poster limit)."
    )
    print(f"Resume file: {path}")
    for item in manifest["files"]:
        if item.get("error"):
            print(f"  {item['status']}: {item['relative_path']} ({item['error']})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Queue a complete folder for Lemon V9 analysis")
    parser.add_argument("--folder", "-f", help="Folder containing screenplay PDFs")
    parser.add_argument("--category", "-c", default="LEMON", choices=VALID_COLLECTIONS)
    parser.add_argument("--model", "-m", default="hybrid", choices=VALID_MODELS)
    parser.add_argument("--service-account", help="Optional Firebase service-account JSON")
    parser.add_argument("--dry-run", action="store_true", help="Run all free checks but upload nothing")
    parser.add_argument("--new-batch", action="store_true", help="Archive the prior manifest first")
    parser.add_argument("--yes", action="store_true", help="Skip the final upload confirmation")
    args = parser.parse_args()

    folder_text = args.folder
    if not folder_text:
        folder_text = input("Folder path (you can drag the folder here): ").strip().strip("'\"")

    try:
        folder = Path(folder_text).expanduser().resolve()
        if not folder.is_dir():
            raise BatchError(f"Folder not found: {folder}")
        with folder_lock(folder):
            if args.new_batch:
                archive_manifest(folder)
            init_firebase(args.service_account)
            db = get_firestore()
            manifest, path = prepare_batch(
                folder,
                args.category,
                args.model,
                db=db,
            )
            print_manifest(manifest, path)
            if args.dry_run or actionable_count(manifest) == 0:
                print("\nNo uploads started.")
                return 0
            needs_upload = any(
                item.get("status") in {"ready", "uploading", "upload_error"}
                for item in manifest["files"]
            )
            if needs_upload and not args.yes:
                answer = input("\nQueue the ready screenplays for paid V9 analysis? [y/N] ").strip().lower()
                if answer not in {"y", "yes"}:
                    print("No uploads started.")
                    return 0

            def report(event: str, item: dict[str, Any]) -> None:
                symbol = "queued" if event == "queued" else "needs recheck"
                print(f"  {symbol}: {item['relative_path']}")

            upload_batch(manifest, path, db=db, progress=report)
            print_manifest(manifest, path)
            counts = batch_counts(manifest)
            incomplete = sum(
                counts.get(status, 0)
                for status in {
                    "upload_error",
                    "queue_unconfirmed",
                    "blocked_changed",
                    "blocked_missing",
                    "blocked_object_conflict",
                }
            )
            if incomplete:
                print("\nThe batch is incomplete. Fix the listed files, then run the same batch again.")
            else:
                print("\nThe production VPS now owns every queued job. You may close this tool.")
            return 1 if incomplete else 0
    except (BatchError, OSError) as error:
        print(f"\nStopped safely: {error}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\nStopped safely. Run the same batch again when ready.", file=sys.stderr)
        return 130
    except Exception as error:
        print(f"\nStopped safely before completion: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
