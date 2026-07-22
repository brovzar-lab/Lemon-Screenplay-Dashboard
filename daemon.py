#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║        LEMON STUDIOS — VPS INGEST DAEMON                                    ║
║        Watches Firestore ingest-queue, processes PDFs unattended            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Run on Hostinger VPS (or any always-on machine).                           ║
║  Managed by systemd — auto-restarts on crash.                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

HOW IT WORKS
─────────────
1. Polls Firestore `ingest-queue` for docs with status='pending' every 10s
2. Atomically claims a job (Firestore transaction → status='processing')
3. Downloads PDF from Firebase Storage to an isolated temp directory
4. Computes SHA-256 content hash — skips if already processed (idempotency)
5. Validates PDF text (length, screenplay markers, not scanned)
6. Checks shared daily API budget counter (same doc used by Cloud Function)
7. Runs V9 Archaeology Engine analysis pipeline (ingest_v9.py)
8. Writes results to Firestore `uploaded_analyses`
9. Updates job: status='complete' + full telemetry
10. Heartbeat updates every 60s so the watchdog knows the job is alive

CRASH RECOVERY
───────────────
A separate watchdog Cloud Function (or daemon startup sweep) resets any
jobs stuck at 'processing' with a stale heartbeat (> 5 min) back to 'pending'.

SETUP (Hostinger VPS)
──────────────────────
  git clone <your-repo> /opt/lemon-ingest
  cd /opt/lemon-ingest
  pip install -r execution/requirements.txt
  cp .env.example .env          # Fill in your keys
  sudo cp deployment/lemon-daemon.service /etc/systemd/system/
  sudo systemctl enable lemon-daemon
  sudo systemctl start lemon-daemon
  journalctl -fu lemon-daemon   # Watch logs

REQUIRED ENV VARS
──────────────────
  GOOGLE_APPLICATION_CREDENTIALS  — path to Firebase service account JSON
  FIREBASE_PROJECT_ID             — lemon-screenplay-dashboard
  ANTHROPIC_API_KEY               — direct Anthropic key (bypasses Cloud Function)

OPTIONAL ENV VARS
──────────────────
  FIREBASE_STORAGE_BUCKET — explicit bucket name (defaults to production bucket)
  TMDB_API_KEY          — for produced-film pre-screening
  DAEMON_CONCURRENCY    — parallel workers (default: 2; stay at 2 for Tier 1)
  DAEMON_POLL_INTERVAL  — seconds between Firestore polls (default: 10)
  DAEMON_WORK_DIR       — temp directory for PDF downloads (default: /tmp/lemon)
  DAILY_BUDGET_LIMIT    — max Anthropic calls/day (default: 200, shared with Cloud Fn)
  LLM_PROXY_URL         — override if you want to route through Cloud Function instead
"""

import asyncio
import hashlib
import json
import logging
import logging.handlers
import os
import random
import shutil
import signal
import sys
import tempfile
import threading
import time
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from execution.content_identity import (
    build_version_id,
    build_separate_project_id,
    compute_content_hash,
    queued_at_millis,
    verified_identity_fields,
)
from execution.firebase_config import resolve_storage_bucket

# ── Dependency guard ──────────────────────────────────────────────────────────

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
    load_dotenv(Path(__file__).parent / "functions" / ".env")
except ImportError:
    pass  # dotenv optional

try:
    import firebase_admin
    from firebase_admin import credentials, firestore as fb_firestore, storage as fb_storage
except ImportError:
    sys.exit("❌  Missing: pip install firebase-admin")

# ── Logging ───────────────────────────────────────────────────────────────────

LOG_DIR = Path(os.getenv("DAEMON_LOG_DIR", "/var/log/lemon-daemon"))
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.handlers.RotatingFileHandler(
            LOG_DIR / "daemon.log",
            maxBytes=10 * 1024 * 1024,   # 10 MB per file
            backupCount=5,
            encoding="utf-8",
        ),
    ],
)

log = logging.getLogger("lemon.daemon")

# ── Config from env ───────────────────────────────────────────────────────────

# Newer Firebase projects use {project}.firebasestorage.app; legacy ones use
# {project}.appspot.com. Default to the new domain; override via env if needed.
STORAGE_BUCKET    = resolve_storage_bucket()
CONCURRENCY       = int(os.getenv("DAEMON_CONCURRENCY", "2"))
POLL_INTERVAL     = int(os.getenv("DAEMON_POLL_INTERVAL", "10"))
WORK_DIR          = Path(os.getenv("DAEMON_WORK_DIR", "/tmp/lemon"))
DAILY_BUDGET      = int(os.getenv("DAILY_BUDGET_LIMIT", "200"))
WORKER_ID         = f"hostinger-vps-{os.getenv('HOSTNAME', 'unknown')}-{os.getpid()}"
HEARTBEAT_SECS    = 60
ORPHAN_SWEEP_SECS = int(os.getenv("DAEMON_ORPHAN_SWEEP_INTERVAL", "300"))
MAX_ATTEMPTS      = 3

# Firestore collection names (must match ingestQueue.ts)
QUEUE_COLLECTION  = "ingest-queue"
SYSTEM_COLLECTION = "system"
OUTPUT_COLLECTION = "uploaded_analyses"
CALIBRATION_COLLECTION = "producer_profiles"
CALIBRATION_PROFILE_ID = "admin"
MAX_CALIBRATION_PROMPT_CHARS = 12_000


class TerminalJobError(ValueError):
    """A deterministic queue error that retrying cannot repair."""


_active_job_ids: set[str] = set()
_active_job_lock = threading.Lock()


def register_active_job(job_id: str) -> None:
    with _active_job_lock:
        _active_job_ids.add(job_id)


def unregister_active_job(job_id: str) -> None:
    with _active_job_lock:
        _active_job_ids.discard(job_id)


def is_active_job(job_id: str) -> bool:
    with _active_job_lock:
        return job_id in _active_job_ids

# ── Firebase init ─────────────────────────────────────────────────────────────

_db     = None
_bucket = None

def init_firebase() -> None:
    global _db, _bucket
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not firebase_admin._apps:
        if cred_path and Path(cred_path).exists():
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {
                "storageBucket": STORAGE_BUCKET,
            })
            log.info(f"Firebase initialised — service account: {cred_path}, bucket: {STORAGE_BUCKET}")
        else:
            firebase_admin.initialize_app(options={
                "storageBucket": STORAGE_BUCKET,
            })
            log.info(f"Firebase initialised — Application Default Credentials, bucket: {STORAGE_BUCKET}")

    _db = fb_firestore.client()
    try:
        _bucket = fb_storage.bucket(STORAGE_BUCKET)
        log.info(f"Firebase Storage connected: {STORAGE_BUCKET}")
    except Exception as e:
        log.warning(f"Storage init failed (PDF downloads disabled): {e}")


def load_calibration_profile() -> Optional[dict]:
    """Load the enabled Lemon calibration profile before any paid AI work."""
    snapshot = (
        _db.collection(CALIBRATION_COLLECTION)
        .document(CALIBRATION_PROFILE_ID)
        .get()
    )
    if not snapshot.exists:
        return None

    data = snapshot.to_dict() or {}
    enabled = data.get("enabled", False)
    if enabled is False:
        return None
    if enabled is not True:
        raise ValueError("Calibration profile enabled must be a boolean")

    prompt = data.get("calibrationPrompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("Enabled calibration profile requires calibrationPrompt")
    prompt = prompt.strip()
    if len(prompt) > MAX_CALIBRATION_PROMPT_CHARS:
        raise ValueError(
            f"calibrationPrompt exceeds {MAX_CALIBRATION_PROMPT_CHARS} characters"
        )

    total_reviews = data.get("totalReviews", 0)
    if type(total_reviews) is not int or total_reviews < 0:
        raise ValueError("Calibration profile totalReviews must be a non-negative integer")
    last_calibrated = data.get("lastCalibrated")
    if last_calibrated is not None and not isinstance(last_calibrated, str):
        raise ValueError("Calibration profile lastCalibrated must be a string")

    prompt_sha256 = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    provenance = {
        "applied": True,
        "profile_id": CALIBRATION_PROFILE_ID,
        "prompt_sha256": prompt_sha256,
        "last_calibrated": last_calibrated,
        "total_reviews": total_reviews,
    }
    log.info(
        f"[calibration] Applying {CALIBRATION_PROFILE_ID} profile "
        f"({total_reviews} reviews, {prompt_sha256[:8]}…)"
    )
    return {
        "prompt": prompt,
        "profile_id": CALIBRATION_PROFILE_ID,
        "prompt_sha256": prompt_sha256,
        "last_calibrated": last_calibrated,
        "total_reviews": total_reviews,
        "provenance": provenance,
    }

# ── Orphan sweep (startup crash recovery) ─────────────────────────────────────

def recover_orphaned_job(reference, stale_cutoff: datetime) -> str:
    """Recover one stale candidate after re-checking ownership transactionally."""

    @fb_firestore.transactional
    def recover_in_transaction(transaction, reference):
        fresh = reference.get(transaction=transaction)
        if not fresh.exists:
            return "unchanged"

        data = fresh.to_dict() or {}
        heartbeat = data.get("last_heartbeat_at")
        if data.get("status") != "processing":
            return "unchanged"
        if not isinstance(heartbeat, datetime) or heartbeat >= stale_cutoff:
            return "unchanged"

        # A delayed heartbeat must never let this daemon reclaim work that one
        # of its own threads is still actively processing.
        if data.get("worker_id") == WORKER_ID and is_active_job(reference.id):
            return "active"

        attempts = data.get("attempt_count", 0)
        if type(attempts) is not int or attempts < 0:
            attempts = 0
        if attempts >= MAX_ATTEMPTS:
            transaction.update(reference, {
                "status": "failed",
                "last_error": (
                    f"Exceeded max attempts ({MAX_ATTEMPTS}) — "
                    f"last known worker: {data.get('worker_id')}"
                ),
                "attempt_count": attempts,
            })
            return "failed"

        transaction.update(reference, {
            "status": "pending",
            "worker_id": None,
            "last_heartbeat_at": None,
            "processing_started_at": None,
            "attempt_count": attempts,
            "last_error": (
                "Reset by orphan sweep — orphaned from "
                f"{data.get('worker_id', 'unknown')}"
            ),
        })
        return "pending"

    return recover_in_transaction(_db.transaction(), reference)


def sweep_orphaned_jobs() -> None:
    """Recover jobs whose heartbeat remains stale after a transactional re-check."""
    stale_cutoff = datetime.now(timezone.utc).timestamp() - (HEARTBEAT_SECS * 5)
    stale_cutoff_dt = datetime.fromtimestamp(stale_cutoff, tz=timezone.utc)

    try:
        stuck_jobs = (
            _db.collection(QUEUE_COLLECTION)
            .where("status", "==", "processing")
            .where("last_heartbeat_at", "<", stale_cutoff_dt)
            .stream()
        )
        reset_count = 0
        for doc in stuck_jobs:
            try:
                result = recover_orphaned_job(doc.reference, stale_cutoff_dt)
            except Exception as error:
                log.warning(f"[sweep] Could not inspect {doc.id}: {error}")
                continue
            if result == "pending":
                reset_count += 1
                log.info(f"[sweep] Reset orphaned job: {doc.id}")
            elif result == "failed":
                log.warning(f"[sweep] Marked as FAILED (max attempts): {doc.id}")
            elif result == "active":
                log.info(f"[sweep] Kept live local job: {doc.id}")
        if reset_count:
            log.info(f"[sweep] Reset {reset_count} orphaned job(s)")
    except Exception as e:
        log.error(f"[sweep] Orphan sweep failed: {e}")


def run_orphan_watchdog(stop_event: "threading.Event") -> None:
    """Periodically recover stale processing jobs while the daemon is alive."""
    log.info(f"[watchdog] Started — orphan sweep every {ORPHAN_SWEEP_SECS}s")
    while not stop_event.wait(timeout=ORPHAN_SWEEP_SECS):
        sweep_orphaned_jobs()
    log.info("[watchdog] Stopped")

# ── Budget counter (mirrors budgetCounter.ts) ─────────────────────────────────

class BudgetExceededError(Exception):
    pass

def check_and_increment_budget(limit: int = DAILY_BUDGET) -> int:
    """
    Transactional daily budget check. Mirrors the TypeScript budgetCounter.ts
    so the VPS and Cloud Function share the same Firestore counter document.
    Raises BudgetExceededError if the limit is reached.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc_id = f"api-budget-{today}"
    ref = _db.collection(SYSTEM_COLLECTION).document(doc_id)

    @fb_firestore.transactional
    def update_in_transaction(transaction, ref):
        snap = ref.get(transaction=transaction)
        current = snap.get("count") if snap.exists else 0
        if current >= limit:
            raise BudgetExceededError(
                f"Daily limit of {limit} Anthropic calls reached. Try again tomorrow."
            )
        transaction.set(ref, {
            "count": fb_firestore.Increment(1),
            "date": today,
            "limit": limit,
        }, merge=True)
        return current + 1

    new_count = update_in_transaction(_db.transaction(), ref)
    log.info(f"[budget] Daily call count: {new_count}/{limit}")
    return new_count

# ── Job claiming (atomic Firestore transaction) ───────────────────────────────

def claim_pending_job() -> Optional[dict]:
    """
    Find a pending job and atomically set it to 'processing'.
    Returns the job dict or None if queue is empty.
    Only claims status='pending' jobs — never touches 'complete' or 'failed'.
    """
    # Budget waiters are outside the claimable queue until their UTC reset.
    try:
        resume_due_budget_jobs()
    except Exception as error:
        log.warning(f"[budget] Could not release due waiters: {error}")

    # Query: pending, ordered by priority desc then queued_at asc
    candidates = (
        _db.collection(QUEUE_COLLECTION)
        .where("status", "==", "pending")
        .order_by("priority", direction=fb_firestore.Query.DESCENDING)
        .order_by("queued_at")
        .limit(5)  # Read a few to reduce contention on the top doc
        .stream()
    )
    docs = list(candidates)
    if not docs:
        return None

    # Try to claim each candidate until one succeeds (handles concurrent workers)
    for doc in docs:
        ref = doc.reference

        @fb_firestore.transactional
        def try_claim(transaction, ref):
            fresh = ref.get(transaction=transaction)
            if not fresh.exists or fresh.get("status") != "pending":
                return None   # Already claimed by another worker
            current_attempts = fresh.get("attempt_count") or 0
            transaction.update(ref, {
                "status": "processing",
                "worker_id": WORKER_ID,
                "processing_started_at": fb_firestore.SERVER_TIMESTAMP,
                "last_heartbeat_at": fb_firestore.SERVER_TIMESTAMP,
                "attempt_count": fb_firestore.Increment(1),
            })
            return fresh.to_dict() | {
                "id": fresh.id,
                "attempt_count": current_attempts + 1,
            }

        try:
            job = try_claim(_db.transaction(), ref)
            if job:
                log.info(f"[claim] Claimed job: {job['id']} — {job.get('filename', '?')} ({job.get('collection_id', '?')})")
                return job
        except Exception as e:
            log.debug(f"[claim] Contention on {doc.id}: {e}")
            continue

    return None

# ── Heartbeat ─────────────────────────────────────────────────────────────────

class HeartbeatTask:
    """Updates last_heartbeat_at every HEARTBEAT_SECS so the watchdog knows we're alive."""

    def __init__(self, job_id: str):
        self.job_id = job_id
        self._stop = False
        self._thread = None

    def start(self):
        import threading
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop = True
        if self._thread:
            self._thread.join(timeout=5)

    def _loop(self):
        while not self._stop:
            time.sleep(HEARTBEAT_SECS)
            if self._stop:
                break
            try:
                reference = _db.collection(QUEUE_COLLECTION).document(self.job_id)

                @fb_firestore.transactional
                def refresh_in_transaction(transaction, reference):
                    fresh = reference.get(transaction=transaction)
                    data = fresh.to_dict() if fresh.exists else {}
                    if (
                        data.get("status") != "processing"
                        or data.get("worker_id") != WORKER_ID
                    ):
                        return False
                    transaction.update(reference, {
                        "last_heartbeat_at": fb_firestore.SERVER_TIMESTAMP,
                    })
                    return True

                if refresh_in_transaction(_db.transaction(), reference):
                    log.debug(f"[heartbeat] {self.job_id} ✓")
                else:
                    log.warning(
                        f"[heartbeat] Lost ownership of {self.job_id}; stopping heartbeat"
                    )
                    break
            except Exception as e:
                log.warning(f"[heartbeat] Failed for {self.job_id}: {e}")

# ── PDF download ──────────────────────────────────────────────────────────────

def download_pdf(
    storage_path: str,
    workdir: Path,
    storage_generation: object,
) -> Path:
    """
    Download a PDF from Firebase Storage to the job's work directory.
    storage_path format: gs://bucket-name/ingest-queue/COLLECTION/file.pdf
    Returns the local Path to the downloaded file.
    """
    generation_text = str(storage_generation or "").strip()
    if not generation_text.isdigit():
        raise TerminalJobError(
            "storage_generation is required to download the exact uploaded PDF"
        )

    _bucket_name, blob_path = parse_storage_path(storage_path)
    bucket = storage_bucket_for_path(storage_path)
    generation = int(generation_text)

    filename = Path(blob_path).name
    local_path = workdir / filename

    log.info(
        f"[download] Downloading: {blob_path} generation {generation} → {local_path}"
    )
    blob = bucket.blob(blob_path, generation=generation)
    blob.download_to_filename(
        str(local_path),
        if_generation_match=generation,
    )
    log.info(f"[download] ✓ {filename} ({local_path.stat().st_size / 1024:.1f} KB)")
    return local_path


def parse_storage_path(storage_path: str) -> tuple[str, str]:
    """Return the explicit bucket and object name for a gs:// Storage path."""
    if not isinstance(storage_path, str) or not storage_path.startswith("gs://"):
        raise ValueError("storage_path must be an explicit gs:// bucket/object path")
    without_scheme = storage_path[5:]
    bucket_name, separator, blob_path = without_scheme.partition("/")
    if not separator or not bucket_name or not blob_path:
        raise ValueError("storage_path must include both bucket and object name")
    return bucket_name, blob_path


def storage_bucket_for_path(storage_path: str):
    """Resolve the bucket named by the job instead of trusting Admin init order."""
    bucket_name, _ = parse_storage_path(storage_path)
    if _bucket is not None and getattr(_bucket, "name", None) == bucket_name:
        return _bucket
    return fb_storage.bucket(bucket_name)


def archive_pdf_version(
    *,
    storage_path: str,
    storage_generation: object,
    project_id: str,
    version_id: str,
    content_hash: str,
) -> tuple[str, str]:
    """Copy one verified source generation to its immutable project/version path."""
    if not project_id or "/" in project_id:
        raise ValueError("project_id must be a Firestore document ID")
    if not version_id or "/" in version_id:
        raise ValueError("version_id must be a safe Storage path component")
    if len(content_hash) != 64 or any(c not in "0123456789abcdef" for c in content_hash):
        raise ValueError("content_hash must be a lowercase SHA-256")
    generation_text = str(storage_generation or "").strip()
    if not generation_text.isdigit():
        raise ValueError("storage_generation is required to archive the exact PDF bytes")

    bucket_name, source_name = parse_storage_path(storage_path)
    bucket = storage_bucket_for_path(storage_path)
    destination_name = f"screenplays/{project_id}/versions/{version_id}.pdf"
    destination = bucket.blob(destination_name)
    metadata = {
        "content_hash": content_hash,
        "project_id": project_id,
        "version_id": version_id,
        "source_path": source_name,
        "source_generation": generation_text,
    }

    if destination.exists():
        destination.reload()
        existing_metadata = destination.metadata or {}
        existing_hash = existing_metadata.get("content_hash")
        if existing_hash and existing_hash != content_hash:
            raise RuntimeError("Existing immutable PDF archive has a conflicting content hash")
        if any(existing_metadata.get(k) != v for k, v in metadata.items()):
            destination.metadata = {**existing_metadata, **metadata}
            destination.patch(if_generation_match=destination.generation)
        return f"gs://{bucket_name}/{destination_name}", str(destination.generation)

    generation = int(generation_text)
    source = bucket.blob(source_name, generation=generation)
    archived = bucket.copy_blob(
        source,
        bucket,
        new_name=destination_name,
        source_generation=generation,
        if_generation_match=0,
        if_source_generation_match=generation,
    )
    archived.metadata = {**(archived.metadata or {}), **metadata}
    archived.patch(if_generation_match=archived.generation)
    log.info(f"[archive] Preserved PDF: gs://{bucket_name}/{destination_name}")
    return f"gs://{bucket_name}/{destination_name}", str(archived.generation)

def is_already_complete(content_hash: str) -> bool:
    """Return True if a job with this hash already completed successfully."""
    existing = (
        _db.collection(QUEUE_COLLECTION)
        .where("content_hash", "==", content_hash)
        .where("status", "==", "complete")
        .limit(1)
        .stream()
    )
    return any(True for _ in existing)


def get_existing_version(project_id: str, version_id: str) -> Optional[dict]:
    """Return an already committed immutable version for retry idempotency."""
    if not project_id or "/" in project_id:
        raise TerminalJobError("project_id must be a Firestore document ID")
    if not version_id or "/" in version_id:
        raise TerminalJobError("version_id must be a Firestore document ID")

    snapshot = (
        _db.collection(OUTPUT_COLLECTION)
        .document(project_id)
        .collection("versions")
        .document(version_id)
        .get()
    )
    if snapshot.exists is not True:
        return None
    return snapshot.to_dict() or {}


def existing_version_completion_telemetry(
    version: dict,
    version_id: str,
) -> dict:
    """Rebuild queue completion telemetry without repeating paid work."""
    usage = version.get("usage")
    if not isinstance(usage, dict):
        usage = {}
    return {
        "duration_seconds": 0,
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "llm_call_count": usage.get("call_count", 0),
        "anthropic_model": version.get("analysis_model"),
        "anthropic_finish_reason": usage.get("finish_reason", "end_turn"),
        "estimated_cost_usd": version.get(
            "actual_cost_usd",
            version.get("estimated_cost_usd"),
        ),
        "prompt_version": version.get("prompt_version"),
        "analysis_version": version.get("analysis_version", "v9_archaeology"),
        "archived_storage_path": version.get("storage_path"),
        "archived_storage_generation": version.get("storage_generation"),
        "version_id": version_id,
        "idempotent_replay": True,
    }


def resolve_target_project_id(value: object) -> Optional[str]:
    """Validate that an explicitly targeted revision parent already exists."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise TerminalJobError("target_project_id must be a Firestore document ID")

    target_project_id = value.strip()
    if (
        not target_project_id
        or len(target_project_id) > 200
        or "/" in target_project_id
    ):
        raise TerminalJobError("target_project_id must be a Firestore document ID")

    parent = _db.collection(OUTPUT_COLLECTION).document(target_project_id).get()
    if not parent.exists:
        raise TerminalJobError(
            f"target_project_id does not exist: {target_project_id}"
        )
    return target_project_id


def choose_output_project_id(
    *,
    filename_project_id: str,
    target_project_id: Optional[str],
    separate_project: object,
    upload_id: object,
) -> Optional[str]:
    """Resolve an explicit revision/separate choice before parsing or AI spend."""
    if not isinstance(separate_project, bool):
        raise ValueError("separate_project must be a boolean")
    if target_project_id and separate_project:
        raise ValueError("A job cannot be both a revision and a separate project")
    if target_project_id:
        return target_project_id
    if separate_project:
        return build_separate_project_id(filename_project_id, upload_id)
    return None

# ── PDF validation (pre-flight before calling Anthropic) ─────────────────────

def validate_screenplay_text(text: str, filename: str) -> tuple[bool, str]:
    """
    Checks before spending an Anthropic call:
    - Minimum length (scanned PDF check)
    - Maximum length (token budget guard)
    - Screenplay structure markers (not a random PDF)
    Returns (is_valid, reason).
    """
    stripped = text.strip()

    if len(stripped) < 500:
        return False, "insufficient_text_extracted"   # Likely scanned image PDF

    if len(stripped) > 195_000:
        log.warning(
            f"[validate] '{filename}' is {len(stripped):,} chars — "
            f"will be truncated to 195,000 by the analysis engine"
        )
        # Don't reject — the ingest_v9.py engine truncates gracefully

    has_structure = any(
        marker in stripped.upper()
        for marker in ["INT.", "EXT.", "FADE IN", "FADE OUT", "SMASH CUT", "CUT TO"]
    )
    if not has_structure:
        return False, "not_a_screenplay_format"

    return True, "ok"


# Skip reasons that indicate a bad-format PDF — these get moved out of the
# ingest queue into bad-formats/{collection}/ so they don't keep cycling.
BAD_FORMAT_SKIP_REASONS = {
    "insufficient_text_extracted",
    "not_a_screenplay_format",
    "exceeds_token_budget",
    "pdf_parse_failed",
}


def move_blob_to_bad_format(
    storage_path: str,
    collection_id: str,
    filename: str,
    reason: str,
    *,
    quarantine_id: str,
    storage_generation: object,
) -> str | None:
    """Idempotently move one exact source generation to its quarantine path."""
    try:
        bucket_name, src_blob_path = parse_storage_path(storage_path)
        generation_text = str(storage_generation or "").strip()
        if not generation_text.isdigit():
            raise ValueError("storage_generation is required for quarantine")
        if any(
            not isinstance(value, str) or not value or "/" in value
            for value in (collection_id, filename, quarantine_id)
        ):
            raise ValueError("Invalid quarantine path component")

        generation = int(generation_text)
        bucket = storage_bucket_for_path(storage_path)
        dst_blob_path = f"bad-formats/{collection_id}/{quarantine_id}/{filename}"
        src_blob = bucket.blob(src_blob_path, generation=generation)
        dst_blob = bucket.blob(dst_blob_path)
        new_path = f"gs://{bucket_name}/{dst_blob_path}"

        # A retry after the copy succeeded but the queue update was lost should
        # reuse the existing destination rather than 404 on the missing source.
        if dst_blob.exists():
            if src_blob.exists():
                src_blob.delete(if_generation_match=generation)
            log.info(f"[bad-format] destination already exists: {new_path}")
            return new_path
        if not src_blob.exists():
            log.info(f"[bad-format] source blob already gone: {src_blob_path}")
            return None

        copied_blob = bucket.copy_blob(
            src_blob,
            bucket,
            new_name=dst_blob_path,
            source_generation=generation,
            if_generation_match=0,
            if_source_generation_match=generation,
        )
        # Set metadata so the dashboard can show why it was quarantined
        copied_blob.metadata = {
            **(copied_blob.metadata or {}),
            "quarantine_reason": reason,
            "original_path": src_blob_path,
            "source_generation": generation_text,
        }
        copied_blob.patch(if_generation_match=copied_blob.generation)
        src_blob.delete(if_generation_match=generation)
        log.info(f"[bad-format] moved → {new_path} (reason: {reason})")
        return new_path
    except Exception as e:
        log.warning(f"[bad-format] move failed for {filename}: {e}")
        return None


def check_tmdb_for_job(title_hint: str) -> tuple[bool, str, dict | None]:
    """Run TMDB pre-screen. Returns (should_skip, reason, tmdb_status_dict).
    If TMDB_API_KEY is unset OR check fails, always returns (False, ...) so
    we don't block analysis on infrastructure flakiness.
    """
    try:
        ingest_dir = Path(__file__).parent / "execution"
        sys.path.insert(0, str(ingest_dir))
        import importlib
        if "ingest_v9" not in sys.modules:
            import ingest_v9  # noqa: F401
        ingest_v9 = sys.modules["ingest_v9"]
        is_produced, detail = ingest_v9.check_tmdb(title_hint)
        if is_produced:
            return True, "tmdb_already_produced", {
                "is_produced": True,
                "detail": detail,
                "checked_title": title_hint,
            }
        return False, "ok", {"is_produced": False, "detail": detail, "checked_title": title_hint}
    except Exception as e:
        log.warning(f"[tmdb] check failed (proceeding): {e}")
        return False, "tmdb_error_proceeding", None

# ── Job status updates ────────────────────────────────────────────────────────

def mark_complete(job_id: str, screenplay_doc_id: str, telemetry: dict) -> None:
    _db.collection(QUEUE_COLLECTION).document(job_id).update({
        "status": "complete",
        "screenplay_doc_id": screenplay_doc_id,
        "processing_completed_at": fb_firestore.SERVER_TIMESTAMP,
        "worker_id": WORKER_ID,
        **telemetry,
    })

def mark_failed(job_id: str, error: Exception, attempt_count: int) -> None:
    final_status = "failed" if attempt_count >= MAX_ATTEMPTS else "pending"
    _db.collection(QUEUE_COLLECTION).document(job_id).update({
        "status": final_status,
        "last_error": str(error)[:2000],
        "worker_id": None if final_status == "pending" else WORKER_ID,
        "last_heartbeat_at": None,
        "processing_started_at": None,
    })
    if final_status == "failed":
        log.error(f"[job] {job_id} → FAILED after {attempt_count} attempts: {error}")
    else:
        log.warning(f"[job] {job_id} → reset to PENDING for retry (attempt {attempt_count}): {error}")


def next_budget_resume_at(now: Optional[datetime] = None) -> datetime:
    """Return the next UTC midnight, when the daily server budget resets."""
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        raise ValueError("Budget timestamps must include a timezone")
    current_utc = current.astimezone(timezone.utc)
    return datetime(
        current_utc.year,
        current_utc.month,
        current_utc.day,
        tzinfo=timezone.utc,
    ) + timedelta(days=1)


def mark_waiting_for_budget(
    job_id: str,
    error: Exception,
    attempt_count: int,
    *,
    now: Optional[datetime] = None,
) -> None:
    """Pause outside the claimable queue without consuming an attempt."""
    attempts_before_claim = max(0, int(attempt_count or 0) - 1)
    resume_at = next_budget_resume_at(now)
    _db.collection(QUEUE_COLLECTION).document(job_id).update({
        "status": "waiting_for_budget",
        "attempt_count": attempts_before_claim,
        "last_error": str(error)[:2000],
        "failure_kind": "budget_wait",
        "retryable": True,
        "budget_resume_at": resume_at,
        "worker_id": None,
        "last_heartbeat_at": None,
        "processing_started_at": None,
    })
    log.warning(
        f"[budget] {job_id} waiting until {resume_at.isoformat()} without using an attempt"
    )


def resume_due_budget_jobs(now: Optional[datetime] = None) -> int:
    """Move only due budget waiters back to pending; never claim them early."""
    current = now or datetime.now(timezone.utc)
    candidates = (
        _db.collection(QUEUE_COLLECTION)
        .where("status", "==", "waiting_for_budget")
        .where("budget_resume_at", "<=", current)
        .limit(50)
        .stream()
    )
    resumed = 0
    for document in candidates:
        reference = document.reference

        @fb_firestore.transactional
        def resume_in_transaction(transaction, reference):
            fresh = reference.get(transaction=transaction)
            data = fresh.to_dict() if fresh.exists else {}
            resume_at = data.get("budget_resume_at")
            if (
                data.get("status") != "waiting_for_budget"
                or not isinstance(resume_at, datetime)
                or resume_at > current
            ):
                return False
            transaction.update(reference, {
                "status": "pending",
                "budget_resume_at": None,
                "failure_kind": None,
                "last_error": None,
            })
            return True

        if resume_in_transaction(_db.transaction(), reference):
            resumed += 1
    if resumed:
        log.info(f"[budget] Released {resumed} job(s) after the UTC budget reset")
    return resumed


def mark_terminal_failed(job_id: str, error: Exception) -> None:
    """Fail a deterministic job once; retrying cannot change this outcome."""
    _db.collection(QUEUE_COLLECTION).document(job_id).update({
        "status": "failed",
        "last_error": str(error)[:2000],
        "failure_kind": "terminal",
        "retryable": False,
        "worker_id": WORKER_ID,
        "last_heartbeat_at": None,
        "processing_started_at": None,
        "processing_completed_at": fb_firestore.SERVER_TIMESTAMP,
    })
    log.error(f"[job] {job_id} → FAILED (terminal): {error}")

def mark_skipped(
    job_id: str,
    reason: str,
    *,
    storage_path: str | None = None,
    storage_generation: object = None,
    collection_id: str | None = None,
    filename: str | None = None,
    extra: dict | None = None,
) -> None:
    update: dict = {
        "status": "skipped",
        "skip_reason": reason,
        "processing_completed_at": fb_firestore.SERVER_TIMESTAMP,
    }
    if extra:
        update.update(extra)

    should_quarantine = bool(
        reason in BAD_FORMAT_SKIP_REASONS
        and storage_path
        and collection_id
        and filename
    )
    if should_quarantine:
        update["quarantine_status"] = "pending"

    job_reference = _db.collection(QUEUE_COLLECTION).document(job_id)
    # Persist the terminal queue state before touching Storage. If a later
    # acknowledgement is lost, this job will not be reset and redownload a
    # source blob that has already moved.
    job_reference.update(update)

    if should_quarantine:
        new_path = move_blob_to_bad_format(
            storage_path,
            collection_id,
            filename,
            reason,
            quarantine_id=job_id,
            storage_generation=storage_generation,
        )
        quarantine_update = (
            {
                "storage_path": new_path,
                "quarantined": True,
                "quarantine_status": "complete",
            }
            if new_path
            else {
                "quarantined": False,
                "quarantine_status": "failed",
            }
        )
        try:
            job_reference.update(quarantine_update)
        except Exception as error:
            log.warning(
                f"[bad-format] queue follow-up failed for {job_id}; "
                f"skip status is already durable: {error}"
            )

    log.info(f"[job] {job_id} → SKIPPED: {reason}")

# ── Backoff with jitter ───────────────────────────────────────────────────────

def backoff_sleep(attempt: int, base: float = 2.0, cap: float = 60.0) -> None:
    """Exponential backoff with ±30% jitter. Prevents thundering herd on 429s."""
    sleep_time = min(cap, base * (2 ** attempt))
    jitter = random.uniform(-sleep_time * 0.3, sleep_time * 0.3)
    actual = max(1.0, sleep_time + jitter)
    log.info(f"[backoff] Sleeping {actual:.1f}s (attempt {attempt})")
    time.sleep(actual)

# ── Raw analysis document ─────────────────────────────────────────────────────

def build_raw_document(
    *,
    filename: str,
    model_key: str,
    collection_id: str,
    page_count: int,
    word_count: int,
    analysis: dict,
    usage: dict,
    job_id: str,
    content_hash: str,
    queued_at_ms: int,
    tmdb_status: Optional[dict],
    target_project_id: Optional[str] = None,
    storage_path: Optional[str] = None,
    storage_generation: Optional[str] = None,
    calibration_provenance: Optional[dict] = None,
) -> dict:
    """Build the daemon's V9 parent document using the shared identity contract."""
    raw_doc = {
        "source_file": filename,
        "analysis_model": f"claude-{model_key}",
        "analysis_version": "v9_archaeology",
        "collection_id": collection_id,
        "collection": collection_id,
        "tmdb_status": tmdb_status,
        "metadata": {
            "filename": filename,
            "page_count": page_count,
            "word_count": word_count,
        },
        "analysis": analysis,
        "usage": usage,
        "_ingest_job_id": job_id,
        "_worker_id": WORKER_ID,
        "queued_at_ms": queued_at_millis(queued_at_ms),
        **verified_identity_fields(content_hash),
        "calibration_profile": calibration_provenance or {"applied": False},
    }
    if target_project_id:
        raw_doc["project_id"] = target_project_id
    if storage_path:
        raw_doc["storage_path"] = storage_path
        raw_doc["_storagePath"] = storage_path
        raw_doc["hasPdf"] = True
    if storage_generation:
        raw_doc["storage_generation"] = storage_generation
    return raw_doc

# ── Core job processor ────────────────────────────────────────────────────────

def process_job(job: dict) -> None:
    """
    Full lifecycle for a single ingest job. Called in a thread pool.
    - Downloads PDF to isolated workdir
    - Validates content
    - Runs ingest_v9.py V9 Archaeology Engine analysis
    - Writes to Firestore
    - Updates job doc with telemetry
    """
    job_id   = job["id"]
    filename = job.get("filename", "unknown.pdf")
    collection_id = job.get("collection_id", "OTHER")
    storage_path  = job.get("storage_path", "")
    requested_model = job.get("requested_model", "auto")
    attempt_count = job.get("attempt_count", 1)
    storage_generation = job.get("storage_generation")

    log.info(f"━━━ Processing: {filename} [{collection_id}] (attempt {attempt_count}) ━━━")
    start_time = time.time()

    # Register locally before the watchdog can inspect this claimed job.
    register_active_job(job_id)
    heartbeat = HeartbeatTask(job_id)

    # Isolated work directory — auto-cleaned on exit even on crash
    workdir = WORK_DIR / job_id

    try:
        workdir.mkdir(parents=True, exist_ok=True)
        heartbeat.start()
        queued_at_ms = queued_at_millis(job.get("queued_at"))

        # ── 1. Download PDF ────────────────────────────────────────────────
        local_pdf = download_pdf(storage_path, workdir, storage_generation)

        # ── 2. Content hash + idempotency check ───────────────────────────
        content_hash = compute_content_hash(local_pdf)
        _db.collection(QUEUE_COLLECTION).document(job_id).update({
            "content_hash": content_hash,
        })

        if is_already_complete(content_hash) and not job.get("bypass_duplicate", False):
            mark_skipped(job_id, "already_complete")
            log.info(f"[job] {job_id} → Skipped (duplicate content hash: {content_hash[:8]}…)")
            return

        # A renamed revision may only attach to a real existing project.
        target_project_id = resolve_target_project_id(job.get("target_project_id"))

        # ── 3. Run analysis via V9 Archaeology Engine ──────────────────────
        # Import the V9 engine (runs in the same Python process)
        ingest_dir = Path(__file__).parent / "execution"
        sys.path.insert(0, str(ingest_dir))

        import importlib
        if "ingest_v9" not in sys.modules:
            import ingest_v9  # noqa: F401
        ingest_v9 = sys.modules["ingest_v9"]

        # Init Firebase in the ingest_v9 module context (shares _db from admin SDK)
        ingest_v9.init_firebase()

        # An explicit title collision gets a unique, retry-stable parent. Resolve
        # this before parsing or AI spend so malformed queue identity fails free.
        separate_project = job.get("separate_project", False)
        project_id = choose_output_project_id(
            filename_project_id=(
                ingest_v9.to_doc_id(filename) if separate_project is True else ""
            ),
            target_project_id=target_project_id,
            separate_project=separate_project,
            upload_id=job.get("upload_id"),
        )

        screenplay_doc_id = project_id or ingest_v9.to_doc_id(filename)
        version_id = build_version_id(content_hash, queued_at_ms)
        existing_version = get_existing_version(screenplay_doc_id, version_id)
        if existing_version is not None:
            mark_complete(
                job_id,
                screenplay_doc_id,
                existing_version_completion_telemetry(existing_version, version_id),
            )
            log.info(
                f"[job] {job_id} → complete from existing immutable version "
                f"{version_id[:16]}…; no paid work repeated"
            )
            return

        # Parse PDF
        parsed = ingest_v9.parse_pdf(local_pdf, content_hash=content_hash)
        if parsed is None:
            mark_skipped(
                job_id, "pdf_parse_failed",
                storage_path=storage_path,
                storage_generation=storage_generation,
                collection_id=collection_id,
                filename=filename,
            )
            return

        text       = parsed.get("text", "")
        page_count = parsed.get("page_count", 0)
        word_count = parsed.get("word_count", 0)

        # ── 4. Validate text before spending API call ─────────────────────
        is_valid, reason = validate_screenplay_text(text, filename)
        if not is_valid:
            mark_skipped(
                job_id, reason,
                storage_path=storage_path,
                storage_generation=storage_generation,
                collection_id=collection_id,
                filename=filename,
            )
            return

        # ── 4b. TMDB pre-screen — skip already-produced films ─────────────
        # Title hint comes from filename (stem with separators normalized).
        # If TMDB returns a hit, we mark skipped WITHOUT moving the PDF —
        # the script may have been produced but you might still want the
        # PDF on hand. Storage stays put.
        title_hint = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
        should_skip_tmdb, tmdb_reason, tmdb_status = check_tmdb_for_job(title_hint)
        if job.get("bypass_tmdb", False):
            should_skip_tmdb = False
        if should_skip_tmdb:
            mark_skipped(
                job_id, tmdb_reason,
                extra={"tmdb_status": tmdb_status} if tmdb_status else None,
            )
            return

        # ── 5. Budget check (shared counter with Cloud Function) ──────────
        try:
            check_and_increment_budget()
        except BudgetExceededError as e:
            mark_waiting_for_budget(job_id, e, attempt_count)
            log.warning(f"[budget] Pausing — {e}")
            return

        calibration_profile = load_calibration_profile()
        archive_storage_path, archive_storage_generation = archive_pdf_version(
            storage_path=storage_path,
            storage_generation=storage_generation,
            project_id=screenplay_doc_id,
            version_id=version_id,
            content_hash=content_hash,
        )

        # ── 6. Determine model ────────────────────────────────────────────
        # Valid: haiku | sonnet | opus | hybrid | auto.
        # Hybrid runs Sonnet first; RECOMMEND/FILM_NOW results re-run on Opus.
        # Auto maps to sonnet for full analysis (matches prior behavior).
        valid_models = {"haiku", "sonnet", "opus", "hybrid"}
        if requested_model in valid_models:
            model_key = requested_model
        elif requested_model == "auto":
            model_key = "sonnet"
        else:
            model_key = "sonnet"

        title = Path(filename).stem.replace("_", " ").replace("-", " ")

        # ── 7. Run V9 Archaeology Engine analysis ─────────────────────────
        proxy_url = os.getenv("LLM_PROXY_URL")  # None = call Anthropic directly

        if model_key == "hybrid":
            log.info(f"[analyze] Running V9 HYBRID analysis: '{title}' (Sonnet → maybe Opus)")
            analysis, usage = ingest_v9.run_v9_hybrid(
                text=text,
                title=title,
                page_count=page_count,
                word_count=word_count,
                proxy_url=proxy_url,
                calibration_prompt=(
                    calibration_profile["prompt"] if calibration_profile else None
                ),
            )
        else:
            log.info(f"[analyze] Running V9 full analysis: '{title}' (model: {model_key})")
            analysis, usage = ingest_v9.run_v9_stable(
                text=text,
                title=title,
                page_count=page_count,
                word_count=word_count,
                model_key=model_key,
                proxy_url=proxy_url,
                calibration_prompt=(
                    calibration_profile["prompt"] if calibration_profile else None
                ),
            )

        # ── 8. Check finish reason (don't save truncated JSON) ────────────
        finish_reason = usage.get("finish_reason", "end_turn")
        if finish_reason == "max_tokens":
            raise RuntimeError(
                f"Anthropic output truncated (max_tokens) — JSON is incomplete. "
                f"Will retry on next attempt."
            )

        # ── 9. Build full document and write to Firestore ─────────────────
        raw_doc = build_raw_document(
            filename=filename,
            model_key=model_key,
            collection_id=collection_id,
            page_count=page_count,
            word_count=word_count,
            analysis=analysis,
            usage=usage,
            job_id=job_id,
            content_hash=content_hash,
            queued_at_ms=queued_at_ms,
            tmdb_status=tmdb_status,
            target_project_id=screenplay_doc_id,
            storage_path=archive_storage_path,
            storage_generation=archive_storage_generation,
            calibration_provenance=(
                calibration_profile["provenance"] if calibration_profile else None
            ),
        )

        success = ingest_v9.write_to_firestore(raw_doc)
        if not success:
            raise RuntimeError("Firestore write failed — will retry")

        # Derive the doc ID the way write_to_firestore does
        # ── 10. Mark complete with telemetry ──────────────────────────────
        duration = round(time.time() - start_time)
        input_tokens  = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)

        # Rough cost estimate (Sonnet 4 pricing as of 2025)
        cost_per_input_mtok  = {"haiku": 0.25, "sonnet": 3.0, "opus": 15.0}.get(model_key, 3.0)
        cost_per_output_mtok = {"haiku": 1.25, "sonnet": 15.0, "opus": 75.0}.get(model_key, 15.0)
        estimated_cost = (
            (input_tokens / 1_000_000 * cost_per_input_mtok) +
            (output_tokens / 1_000_000 * cost_per_output_mtok)
        )

        # For hybrid runs, report the model that actually produced the final
        # result (sonnet for no-promotion, opus for promoted scripts).
        final_model_key = model_key
        if model_key == "hybrid":
            hybrid_meta = analysis.get("_hybrid_mode") or {}
            final_model_key = hybrid_meta.get("final_model", "sonnet")

        mark_complete(job_id, screenplay_doc_id, {
            "duration_seconds": duration,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "anthropic_model": ingest_v9.MODEL_IDS.get(final_model_key, final_model_key),
            "anthropic_finish_reason": finish_reason,
            "estimated_cost_usd": round(estimated_cost, 4),
            "prompt_version": None,   # TODO: pipe through from ingest_v9
            "analysis_version": "v9_archaeology",
            "archived_storage_path": archive_storage_path,
            "archived_storage_generation": archive_storage_generation,
        })

        log.info(
            f"[job] ✅ {filename} → complete "
            f"({duration}s | {input_tokens:,}+{output_tokens:,} tokens | ${estimated_cost:.3f})"
        )

    except TerminalJobError as e:
        log.error(f"[job] ❌ {filename} — terminal queue error: {e}")
        log.debug(traceback.format_exc())
        mark_terminal_failed(job_id, e)
    except Exception as e:
        log.error(f"[job] ❌ {filename} — {e}")
        log.debug(traceback.format_exc())
        mark_failed(job_id, e, attempt_count)

    finally:
        heartbeat.stop()
        unregister_active_job(job_id)
        # Clean up temp files
        try:
            shutil.rmtree(workdir, ignore_errors=True)
            log.debug(f"[cleanup] Removed workdir: {workdir}")
        except Exception:
            pass

# ── Worker pool ───────────────────────────────────────────────────────────────

def run_worker(worker_num: int, stop_event: "threading.Event") -> None:
    """Single worker thread — continuously claims and processes jobs."""
    import threading  # noqa (already imported at top level)
    log.info(f"[worker-{worker_num}] Started")

    while not stop_event.is_set():
        try:
            job = claim_pending_job()
            if job is None:
                # Nothing to do — sleep briefly then poll again
                stop_event.wait(timeout=POLL_INTERVAL)
                continue
            process_job(job)
        except Exception as e:
            log.error(f"[worker-{worker_num}] Unhandled error in main loop: {e}")
            log.debug(traceback.format_exc())
            time.sleep(5)  # Brief pause before retrying to avoid tight error loops

    log.info(f"[worker-{worker_num}] Stopped")

# ── Main entry point ──────────────────────────────────────────────────────────

def main() -> None:
    import threading

    log.info("═" * 70)
    log.info("🍋  LEMON INGEST DAEMON — Starting up")
    log.info(f"    Worker ID   : {WORKER_ID}")
    log.info(f"    Concurrency : {CONCURRENCY} workers")
    log.info(f"    Poll interval: {POLL_INTERVAL}s")
    log.info(f"    Orphan sweep : every {ORPHAN_SWEEP_SECS}s")
    log.info(f"    Work dir    : {WORK_DIR}")
    log.info(f"    Daily budget: {DAILY_BUDGET} API calls")
    log.info("═" * 70)

    if not os.getenv("ANTHROPIC_API_KEY") and not os.getenv("LLM_PROXY_URL"):
        log.error("ANTHROPIC_API_KEY and LLM_PROXY_URL are both unset — daemon cannot reach Claude. Exiting.")
        sys.exit(1)

    # Ensure work dir exists
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    # Connect Firebase
    init_firebase()

    # Startup crash recovery sweep
    log.info("[startup] Running orphan sweep...")
    sweep_orphaned_jobs()

    # Graceful shutdown handler
    stop_event = threading.Event()

    def shutdown(signum, frame):
        log.info(f"[daemon] Received signal {signum} — shutting down gracefully...")
        stop_event.set()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    # Launch worker threads
    workers = []
    for i in range(CONCURRENCY):
        t = threading.Thread(
            target=run_worker,
            args=(i + 1, stop_event),
            name=f"lemon-worker-{i + 1}",
            daemon=True,
        )
        t.start()
        workers.append(t)
        time.sleep(0.5)  # Stagger starts to reduce initial Firestore contention

    watchdog = threading.Thread(
        target=run_orphan_watchdog,
        args=(stop_event,),
        name="lemon-orphan-watchdog",
        daemon=True,
    )
    watchdog.start()

    log.info(f"[daemon] {CONCURRENCY} worker(s) running — waiting for jobs in '{QUEUE_COLLECTION}'")

    # Main thread waits for shutdown signal
    stop_event.wait()

    # Wait for workers to finish current jobs (up to 10 min)
    log.info("[daemon] Waiting for in-flight jobs to complete (max 10 min)...")
    for t in workers:
        t.join(timeout=600)
    watchdog.join(timeout=5)

    log.info("🍋  LEMON INGEST DAEMON — Stopped cleanly")


if __name__ == "__main__":
    main()
