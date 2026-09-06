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
  PROXY_SERVICE_KEY               — shared secret for authenticated llmProxy calls

OPTIONAL ENV VARS
──────────────────
  FIREBASE_STORAGE_BUCKET — explicit bucket name (defaults to production bucket)
  TMDB_API_KEY          — for produced-film pre-screening
  DAEMON_CONCURRENCY    — parallel workers (default: 2; stay at 2 for Tier 1)
  DAEMON_POLL_INTERVAL  — seconds between Firestore polls (default: 10)
  DAEMON_WORK_DIR       — temp directory for PDF downloads (default: /tmp/lemon)
  DAILY_LLM_BUDGET_USD  — enforced by the llmProxy Cloud Function (default: $100/day)
  LLM_PROXY_URL         — override the production llmProxy URL
"""

import asyncio
import hashlib
import json
import logging
import logging.handlers
import os
import random
import re
import shutil
import signal
import sys
import tempfile
import threading
import time
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import requests

from execution.content_identity import (
    build_version_id,
    build_separate_project_id,
    compute_content_hash,
    queued_at_millis,
    verified_identity_fields,
)
from execution.firebase_config import resolve_storage_bucket
from execution.source_evidence import (
    SourceEvidenceError,
    attach_verified_citation_quality,
    validate_parsed_source,
)
from execution.trust_manifest import TRUST_MANIFEST_VERSION, attach_trust_manifest

DEFAULT_LLM_PROXY_URL = (
    "https://us-central1-lemon-screenplay-dashboard.cloudfunctions.net/llmProxy"
)
LLM_PROXY_TRUST_CONTRACT_VERSION = "lemon-trust-manifest-v1"

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


def verify_proxy_trust_capability(
    proxy_url: Optional[str] = None,
    service_key: Optional[str] = None,
) -> dict:
    """Fail before claiming work when the proxy cannot satisfy the trust contract."""
    url = proxy_url or os.getenv("LLM_PROXY_URL") or DEFAULT_LLM_PROXY_URL
    key = service_key or os.getenv("PROXY_SERVICE_KEY")
    if not key:
        raise RuntimeError(
            "PROXY_SERVICE_KEY is required; no queued work was claimed"
        )
    response = requests.get(
        url,
        headers={"X-Lemon-Service-Key": key},
        timeout=15,
    )
    response.raise_for_status()
    capability = response.json()

    if (
        capability.get("service") != "llmProxy"
        or capability.get("trust_contract_version") != LLM_PROXY_TRUST_CONTRACT_VERSION
        or capability.get("response_id_supported") is not True
    ):
        raise RuntimeError(
            "llmProxy is not compatible with "
            f"{LLM_PROXY_TRUST_CONTRACT_VERSION}; no queued work was claimed"
        )

    return capability

# ── Config from env ───────────────────────────────────────────────────────────

# Newer Firebase projects use {project}.firebasestorage.app; legacy ones use
# {project}.appspot.com. Default to the new domain; override via env if needed.
STORAGE_BUCKET    = resolve_storage_bucket()
CONCURRENCY       = int(os.getenv("DAEMON_CONCURRENCY", "2"))
POLL_INTERVAL     = int(os.getenv("DAEMON_POLL_INTERVAL", "10"))
WORK_DIR          = Path(os.getenv("DAEMON_WORK_DIR", "/tmp/lemon"))
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
VALID_JOB_ENGINES = {"v9", "coverage_v1"}


class TerminalJobError(ValueError):
    """A deterministic queue error that retrying cannot repair."""


def resolve_model_route(requested_model: Any) -> str:
    if not isinstance(requested_model, str):
        raise TerminalJobError(
            f"Unsupported analysis model route {requested_model!r}; refusing silent fallback"
        )
    if requested_model in {"sonnet", "opus", "hybrid"}:
        return requested_model
    if requested_model in {"haiku", "auto"}:
        return "sonnet"
    raise TerminalJobError(
        f"Unsupported analysis model route {requested_model!r}; refusing silent fallback"
    )


def resolve_engine_route(value: object) -> str:
    """Keep legacy jobs on V9 while refusing every unknown explicit route."""
    if value in (None, ""):
        return "v9"
    if isinstance(value, str) and value in VALID_JOB_ENGINES:
        return value
    raise TerminalJobError(
        f"Unsupported analysis engine {value!r}; refusing silent fallback"
    )


def coverage_v1_enabled() -> bool:
    return os.getenv("LEMON_ENGINE_COVERAGE_V1", "0") == "1"


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
    try:
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

        profile_version_id = data.get("activeVersionId")
        prompt_sha256 = data.get("promptSha256")
        assessment_set_sha256 = data.get("sourceAssessmentSetSha256")
        compiler_model_id = data.get("compilerModelId")
        if profile_version_id is not None:
            if (
                not isinstance(profile_version_id, str)
                or not profile_version_id
                or "/" in profile_version_id
            ):
                raise ValueError("Calibration activeVersionId is invalid")
            computed_prompt_sha256 = hashlib.sha256(
                prompt.encode("utf-8")
            ).hexdigest()
            if prompt_sha256 != computed_prompt_sha256:
                raise ValueError("Calibration prompt hash does not match active profile")
            if (
                not isinstance(assessment_set_sha256, str)
                or not re.fullmatch(r"[a-f0-9]{64}", assessment_set_sha256)
            ):
                raise ValueError("Calibration assessment-set hash is invalid")
            if not isinstance(compiler_model_id, str) or not compiler_model_id:
                raise ValueError("Calibration compiler model is missing")
    except ValueError as error:
        # A bad saved preference must not stall every screenplay three times.
        # The analysis continues without calibration and records the fallback.
        log.error(f"[calibration] Invalid admin profile; using uncalibrated fallback: {error}")
        return {
            "prompt": None,
            "profile_id": CALIBRATION_PROFILE_ID,
            "provenance": {
                "applied": False,
                "profile_id": CALIBRATION_PROFILE_ID,
                "fallback_reason": "invalid_profile",
                "validation_error": str(error),
            },
        }

    prompt_sha256 = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    provenance = {
        "applied": True,
        "profile_id": CALIBRATION_PROFILE_ID,
        "prompt_sha256": prompt_sha256,
        "last_calibrated": last_calibrated,
        "total_reviews": total_reviews,
    }
    if profile_version_id is not None:
        provenance.update({
            "profile_version_id": profile_version_id,
            "source_assessment_set_sha256": assessment_set_sha256,
            "compiler_model_id": compiler_model_id,
        })
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
        "profile_version_id": profile_version_id,
        "source_assessment_set_sha256": assessment_set_sha256,
        "compiler_model_id": compiler_model_id,
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

        paid_fields = (
            "llm_call_count",
            "llm_uncertain_call_count",
            "actual_cost_microusd",
            "uncertain_cost_microusd",
        )
        active_reservations = data.get("llm_active_reservations")
        active_reservation_ids = (
            sorted(active_reservations)
            if isinstance(active_reservations, dict)
            else []
        )
        active_reservation_count = data.get("llm_active_reservation_count", 0)
        has_active_reservation = (
            bool(active_reservation_ids)
            or type(active_reservation_count) is int
            and active_reservation_count > 0
        )
        if has_active_reservation or data.get("last_llm_call_at") is not None or any(
            data.get(field) not in (None, 0) for field in paid_fields
        ):
            transaction.update(reference, {
                "status": "needs_review",
                "review_reason": (
                    "A stale worker may have dispatched paid inference. "
                    "Manual reconciliation is required before retrying."
                ),
                "failure_kind": "orphaned_after_model_activity",
                "retryable": False,
                "worker_id": None,
                "last_heartbeat_at": None,
                "processing_started_at": None,
                "processing_completed_at": fb_firestore.SERVER_TIMESTAMP,
                "review_evidence": {
                    **{
                        field: data.get(field)
                        for field in (*paid_fields, "last_llm_call_at")
                    },
                    "active_reservation_count": active_reservation_count,
                    "active_reservation_ids": active_reservation_ids,
                },
            })
            return "needs_review"

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

# ── Budget preflight (the Cloud Function remains the authority) ───────────────

class BudgetExceededError(Exception):
    pass

def check_daily_budget_available(now: Optional[datetime] = None) -> None:
    """Avoid preparation when the authoritative server ledger is exhausted.

    This is deliberately read-only. Every individual model call still makes a
    transactional dollar reservation inside llmProxy, which is the hard gate.
    """
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    doc_id = f"llm-budget-{current.strftime('%Y-%m-%d')}"
    snapshot = _db.collection(SYSTEM_COLLECTION).document(doc_id).get()
    if not snapshot.exists:
        return
    data = snapshot.to_dict() or {}
    limit = data.get("limit_microusd", 0)
    spent = data.get("spent_microusd", 0)
    reserved = data.get("reserved_microusd", 0)
    if not all(isinstance(value, int) and value >= 0 for value in (limit, spent, reserved)):
        raise RuntimeError("Daily AI budget ledger is malformed; refusing unmetered work.")
    if limit > 0 and spent + reserved >= limit:
        raise BudgetExceededError(
            f"Daily AI budget of ${limit / 1_000_000:.2f} is exhausted."
        )

# ── Job claiming (atomic Firestore transaction) ───────────────────────────────

def claim_pending_job() -> Optional[dict]:
    """
    Find a pending job and atomically set it to 'processing'.
    Returns the job dict or None if queue is empty.
    Only claims status='pending' jobs — never touches 'complete' or 'failed'.
    """
    # Budget and disabled-engine waiters stay outside the claimable queue until
    # their prerequisite changes.
    try:
        resume_due_budget_jobs()
    except Exception as error:
        log.warning(f"[budget] Could not release due waiters: {error}")
    if coverage_v1_enabled():
        try:
            resume_waiting_for_engine_jobs()
        except Exception as error:
            log.warning(f"[engine] Could not release Coverage waiters: {error}")

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
        candidate = doc.to_dict() or {}
        try:
            engine = resolve_engine_route(candidate.get("engine"))
            if engine == "coverage_v1" and not coverage_v1_enabled():
                mark_waiting_for_engine(doc.id)
                continue
            dependency, reason = same_batch_dependency_state(candidate)
            if dependency == "waiting":
                continue
            if dependency == "failed":
                mark_needs_review(
                    doc.id,
                    reason or "The same-batch parent did not become Ready.",
                    failure_kind="parent_upload_not_ready",
                )
                continue
        except TerminalJobError as error:
            mark_terminal_failed(doc.id, error)
            continue

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


def same_batch_dependency_state(job: dict) -> tuple[str, Optional[str]]:
    """Return ready/waiting/failed for a same-batch revision parent."""
    depends_on = job.get("depends_on_upload_id")
    if depends_on in (None, ""):
        return "ready", None
    if (
        not isinstance(depends_on, str)
        or not re.fullmatch(r"[a-zA-Z0-9_-]{8,128}", depends_on)
        or depends_on == job.get("upload_id")
    ):
        raise TerminalJobError("depends_on_upload_id is invalid")

    parents = list(
        _db.collection(QUEUE_COLLECTION)
        .where("upload_id", "==", depends_on)
        .limit(5)
        .stream()
    )
    if not parents:
        return "waiting", None

    target_project_id = job.get("target_project_id")
    states = [parent.to_dict() or {} for parent in parents]
    for parent in states:
        if parent.get("status") != "complete" and not (
            parent.get("status") == "needs_review" and parent.get("coverage_v1_report_id")
        ):
            continue
        if (
            isinstance(target_project_id, str)
            and target_project_id
            and parent.get("screenplay_doc_id") != target_project_id
        ):
            return "failed", "The same-batch parent completed under a different project."
        return "ready", None

    terminal = {"failed", "skipped", "needs_review"}
    if states and all(parent.get("status") in terminal for parent in states):
        return "failed", "The same-batch parent did not become Ready."
    return "waiting", None

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
        destination_generation = str(
            getattr(destination, "generation", "") or ""
        ).strip()
        if not destination_generation.isdigit():
            raise RuntimeError(
                "Existing immutable PDF archive lacks generation provenance"
            )
        archived_bytes = destination.download_as_bytes(
            if_generation_match=int(destination_generation)
        )
        if hashlib.sha256(archived_bytes).hexdigest() != content_hash:
            raise RuntimeError(
                "Existing immutable PDF archive bytes do not match the content hash"
            )
        existing_metadata = destination.metadata or {}
        existing_hash = existing_metadata.get("content_hash")
        if existing_hash and existing_hash != content_hash:
            raise RuntimeError("Existing immutable PDF archive has a conflicting content hash")
        if any(existing_metadata.get(k) != v for k, v in metadata.items()):
            destination.metadata = {**existing_metadata, **metadata}
            destination.patch(if_generation_match=destination.generation)
        return f"gs://{bucket_name}/{destination_name}", destination_generation

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


def verify_archived_pdf_version(
    *,
    storage_path: object,
    storage_generation: object,
    project_id: str,
    version_id: str,
    content_hash: str,
) -> None:
    """Rehash the exact archived generation before trusting an existing version."""
    archive_path = str(storage_path or "")
    _bucket_name, object_name = parse_storage_path(archive_path)
    expected_name = f"screenplays/{project_id}/versions/{version_id}.pdf"
    if object_name != expected_name:
        raise RuntimeError(
            "Existing immutable version points to the wrong PDF archive path"
        )
    generation_text = str(storage_generation or "").strip()
    if not generation_text.isdigit() or int(generation_text) <= 0:
        raise RuntimeError(
            "Existing immutable version lacks archive generation provenance"
        )
    generation = int(generation_text)
    bucket = storage_bucket_for_path(archive_path)
    archived = bucket.blob(object_name, generation=generation)
    archived_bytes = archived.download_as_bytes(
        if_generation_match=generation
    )
    if hashlib.sha256(archived_bytes).hexdigest() != content_hash:
        raise RuntimeError(
            "Existing immutable version PDF bytes do not match its content hash"
        )


def is_already_complete(content_hash: str, validate_analysis) -> bool:
    """Trust a duplicate only when its immutable result and PDF still validate."""
    existing = (
        _db.collection(QUEUE_COLLECTION)
        .where("content_hash", "==", content_hash)
        .where("status", "==", "complete")
        .stream()
    )
    for snapshot in existing:
        data = snapshot.to_dict() or {}
        project_id = data.get("screenplay_doc_id")
        version_id = data.get("version_id")
        if not isinstance(project_id, str) or not isinstance(version_id, str):
            continue
        try:
            version = get_existing_version(project_id, version_id)
            if version is None:
                continue
            validate_analysis(version)
            verify_archived_pdf_version(
                storage_path=version.get("storage_path"),
                storage_generation=version.get("storage_generation"),
                project_id=project_id,
                version_id=version_id,
                content_hash=content_hash,
            )
        except Exception as error:
            log.warning(
                "[duplicate] Ignoring stale completion evidence for "
                f"{content_hash[:8]}… ({type(error).__name__})"
            )
            continue
        return True
    return False


def get_existing_version(project_id: str, version_id: str) -> Optional[dict]:
    """Return an already committed immutable version for retry idempotency."""
    if not project_id or "/" in project_id:
        raise TerminalJobError("project_id must be a Firestore document ID")
    if not version_id or "/" in version_id:
        raise TerminalJobError("version_id must be a Firestore document ID")

    parent_ref = _db.collection(OUTPUT_COLLECTION).document(project_id)
    snapshot = parent_ref.collection("versions").document(version_id).get()
    if snapshot.exists is not True:
        return None
    version = snapshot.to_dict() or {}
    authority_snapshot = (
        parent_ref.collection("version_authorities").document(version_id).get()
    )
    if authority_snapshot.exists is not True:
        raise RuntimeError("Existing immutable version has no server authority receipt")
    from execution.ingest_v9 import validate_version_authority_document

    validate_version_authority_document(
        version,
        authority_snapshot.to_dict() or {},
    )
    return version


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
        "analysis_llm_call_count": usage.get("call_count", 0),
        "anthropic_model": version.get("analysis_model"),
        "anthropic_finish_reason": usage.get("finish_reason", "end_turn"),
        "analysis_actual_cost_usd": usage.get(
            "actual_cost_usd",
            version.get("actual_cost_usd", version.get("estimated_cost_usd")),
        ),
        "estimated_cost_usd": usage.get(
            "actual_cost_usd",
            version.get("actual_cost_usd", version.get("estimated_cost_usd")),
        ),
        "prompt_version": version.get("prompt_version"),
        "analysis_version": version.get("analysis_version", "v9_archaeology"),
        "archived_storage_path": version.get("storage_path"),
        "archived_storage_generation": version.get("storage_generation"),
        "version_id": version_id,
        "idempotent_replay": True,
    }


def resolve_target_project_id(
    value: object,
    *,
    allow_coverage_parent: bool = False,
) -> Optional[str]:
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
    if parent.exists:
        return target_project_id
    if allow_coverage_parent:
        reports = (
            _db.collection(COVERAGE_V1_REPORTS_COLLECTION)
            .where("project_id", "==", target_project_id)
            .limit(10)
            .stream()
        )
        if any((snapshot.to_dict() or {}).get("status") in {"sealed", "needs_review"} for snapshot in reports):
            return target_project_id
    raise TerminalJobError(
        f"target_project_id does not exist: {target_project_id}"
    )


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
    - Screenplay structure markers (not a random PDF)
    Returns (is_valid, reason).
    """
    stripped = text.strip()

    if len(stripped) < 500:
        return False, "insufficient_text_extracted"   # Likely scanned image PDF

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

COVERAGE_V1_REPORTS_COLLECTION = "coverage_v1_reports"


def coverage_report_wrapper_matches(
    wrapper: dict,
    report: dict,
    *,
    screenplay_doc_id: str,
    version_id: str,
    content_hash: str,
    report_sha256: str,
) -> bool:
    return (
        report.get("analysis_version") == "coverage_v1"
        and report.get("content_sha256") == content_hash
        and wrapper.get("content_hash") == content_hash
        and wrapper.get("project_id") == screenplay_doc_id
        and wrapper.get("version_id") == version_id
        and wrapper.get("report_sha256") == report_sha256
    )


def is_coverage_already_reported(content_hash: str, except_report_id: str = "") -> bool:
    """Reuse existing private Coverage, including review drafts, before any new spend."""
    import coverage_v1
    for snapshot in (_db.collection(COVERAGE_V1_REPORTS_COLLECTION)
                     .where("content_hash", "==", content_hash).stream()):
        wrapper = snapshot.to_dict() or {}
        project_id, version_id = wrapper.get("project_id"), wrapper.get("version_id")
        if f"{project_id}__{version_id}" == except_report_id:
            continue  # Exact publication retry is reconciled by run_coverage_v1_job.
        try:
            report = json.loads(wrapper.get("report_json", ""))
            valid = isinstance(report, dict) and coverage_report_wrapper_matches(
                wrapper, report, screenplay_doc_id=project_id, version_id=version_id,
                content_hash=content_hash, report_sha256=coverage_v1.canonical_json_hash(report))
            if not valid or report.get("status") not in {"sealed", "needs_review"}:
                raise ValueError("Existing coverage identity could not be verified")
            verify_archived_pdf_version(storage_path=wrapper.get("storage_path"),
                storage_generation=wrapper.get("storage_generation"), project_id=project_id,
                version_id=version_id, content_hash=content_hash)
        except Exception as error:
            raise TerminalJobError("Existing Coverage for these PDF bytes requires review; refusing duplicate spend.") from error
        return True
    return False


def run_coverage_v1_job(
    *,
    job: dict,
    job_id: str,
    title: str,
    text: str,
    page_count: int,
    word_count: int,
    content_hash: str,
    parser_version: str,
    screenplay_doc_id: str,
    version_id: str,
    model_key: str,
    proxy_url: Optional[str],
    attempt_count: int,
    start_time: float,
    archive_storage_path: str,
    archive_storage_generation: Optional[int],
) -> None:
    """Run the lean coverage_v1 engine for one job and persist to staging.

    Writes ONLY to coverage_v1_reports / coverage_v1_checkpoints — never to
    the immutable uploaded_analyses store. Marks the job itself complete,
    waiting_for_budget, needs_review, or failed. Checkpoints make any retry
    resume-safe: validated stages are never repaid.
    """
    import coverage_v1  # execution/ is on sys.path by the time jobs run
    import coverage_reader
    import ingest_v9

    # coverage_v1 has no hybrid promotion; a hybrid request runs as sonnet.
    coverage_model = "sonnet" if model_key in ("hybrid", "auto") else model_key
    fmt = "tv_pilot" if str(job.get("format", "")).strip().lower() == "tv_pilot" else "feature"
    genre_hint = job.get("genre_hint") or None
    requested_lenses = job.get("lenses") or None
    try:
        max_cost_usd = float(job.get("max_cost_usd", coverage_v1.DEFAULT_MAX_COST_USD))
    except (TypeError, ValueError):
        max_cost_usd = coverage_v1.DEFAULT_MAX_COST_USD

    report_doc_id = f"{screenplay_doc_id}__{version_id}"
    report_ref = _db.collection(COVERAGE_V1_REPORTS_COLLECTION).document(report_doc_id)
    existing_snapshot = report_ref.get()
    if existing_snapshot.exists:
        wrapper = existing_snapshot.to_dict() or {}
        try:
            report = json.loads(wrapper.get("report_json", ""))
        except (TypeError, json.JSONDecodeError) as error:
            mark_needs_review(
                job_id,
                f"Existing Coverage report is unreadable: {error}",
                failure_kind="coverage_v1_existing_report_invalid",
            )
            return
        if not isinstance(report, dict) or not coverage_report_wrapper_matches(
            wrapper,
            report,
            screenplay_doc_id=screenplay_doc_id,
            version_id=version_id,
            content_hash=content_hash,
            report_sha256=coverage_v1.canonical_json_hash(report),
        ):
            mark_needs_review(
                job_id,
                "Existing Coverage report failed its identity or payload hash check.",
                failure_kind="coverage_v1_existing_report_invalid",
            )
            return
        finish_coverage_v1_job(
            job_id=job_id,
            screenplay_doc_id=screenplay_doc_id,
            version_id=version_id,
            report_doc_id=report_doc_id,
            report=report,
            usage={"call_count": 0, "actual_cost_microusd": 0},
            duration=round(time.time() - start_time),
            archive_storage_path=archive_storage_path,
            archive_storage_generation=archive_storage_generation,
            idempotent_replay=True,
        )
        return

    try:
        check_daily_budget_available()
    except BudgetExceededError as error:
        mark_waiting_for_budget(job_id, error, attempt_count)
        log.warning(f"[coverage_v1] Pausing for budget — {error}")
        return

    usage_sink: dict = {}
    try:
        report, usage = coverage_reader.run_coverage_v1(
            text=text,
            title=title,
            page_count=page_count,
            word_count=word_count,
            content_sha256=content_hash,
            parser_version=parser_version,
            checkpoint_store=coverage_v1.FirestoreCheckpointStore(_db),
            fmt=fmt,
            genre_hint=genre_hint,
            lenses=requested_lenses,
            model_key=coverage_model,
            proxy_url=proxy_url,
            job_id=job_id,
            max_cost_usd=max_cost_usd,
            usage_sink=usage_sink,
        )
    except ingest_v9.DailyBudgetExceededError as e:
        if stop_if_paid_failure(job_id, e, getattr(e, "usage", None) or usage_sink):
            log.error("[coverage_v1] Daily cap reached after paid work; manual review required.")
            return
        mark_waiting_for_budget(job_id, e, attempt_count)
        log.warning(f"[coverage_v1] Pausing for budget — {e}")
        return
    except (
        coverage_v1.CoverageBudgetExceededError,
        coverage_v1.CoverageContractError,
        coverage_v1.CheckpointTamperedError,
        coverage_v1.LensConfigurationError,
    ) as e:
        # Fail closed, never auto-retry a paid contract failure. Validated
        # checkpoints are preserved for a manually approved resume.
        mark_needs_review(
            job_id,
            f"coverage_v1: {e}",
            evidence={"usage": _analysis_usage_evidence(usage_sink)},
            failure_kind="coverage_v1_" + type(e).__name__,
        )
        return
    except Exception as e:
        usage_evidence = getattr(e, "usage", None) or usage_sink
        if stop_if_paid_failure(job_id, e, usage_evidence):
            return
        # No evidence of paid work — a retry is safe, and checkpoints make it
        # free through any stage that already validated.
        if not hasattr(e, "usage") and usage_sink:
            try:
                e.usage = usage_sink
            except Exception:
                pass
        mark_failed(job_id, e, attempt_count)
        return

    report_sha256 = coverage_v1.canonical_json_hash(report)
    report_wrapper = {
        "report_json": json.dumps(report, ensure_ascii=False, sort_keys=True),
        "report_sha256": report_sha256,
        "analysis_version": "coverage_v1",
        "project_id": screenplay_doc_id,
        "version_id": version_id,
        "job_id": job_id,
        "title": title,
        "source_file": f"coverage-v1/{title}",
        "status": report["status"],
        "verdict": report["verdict"],
        "confidence": report["confidence"],
        "film_now_nominated": report["film_now_nominated"],
        "human_review_recommended": report["human_review_recommended"],
        "content_hash": content_hash,
        "content_sha256": content_hash,
        "engine_version": report["engine_version"],
        "lens_stack": report["lens_stack"],
        "collection_id": job.get("collection_id", "OTHER"),
        "storage_path": archive_storage_path,
        "storage_generation": archive_storage_generation,
        "archived_storage_path": archive_storage_path,
        "archived_storage_generation": archive_storage_generation,
        "cost_settled_usd": report["cost"]["settled_usd"],
        "cost_uncertain_usd": report["cost"]["uncertain_usd"],
        "cost_charged_usd": report["cost"]["charged_usd"],
        "created_at": fb_firestore.SERVER_TIMESTAMP,
    }
    try:
        report_ref.create(report_wrapper)
    except Exception as error:
        try:
            snapshot = report_ref.get()
            stored = (snapshot.to_dict() or {}) if snapshot.exists else {}
            if snapshot.exists and coverage_report_wrapper_matches(
                stored,
                report,
                screenplay_doc_id=screenplay_doc_id,
                version_id=version_id,
                content_hash=content_hash,
                report_sha256=report_sha256,
            ):
                log.warning(
                    f"[coverage_v1] Recovered a lost report-write acknowledgement: {error}"
                )
            else:
                error.usage = usage
                mark_needs_review(
                    job_id,
                    "Coverage completed, but its staging write could not be verified. "
                    "Do not retry paid inference.",
                    evidence={"usage": _analysis_usage_evidence(usage)},
                    failure_kind="coverage_v1_report_write_unverified",
                )
                return
        except Exception:
            error.usage = usage
            raise error

    finish_coverage_v1_job(
        job_id=job_id,
        screenplay_doc_id=screenplay_doc_id,
        version_id=version_id,
        report_doc_id=report_doc_id,
        report=report,
        usage=usage,
        duration=round(time.time() - start_time),
        archive_storage_path=archive_storage_path,
        archive_storage_generation=archive_storage_generation,
    )


def finish_coverage_v1_job(
    *,
    job_id: str,
    screenplay_doc_id: str,
    version_id: str,
    report_doc_id: str,
    report: dict,
    usage: dict,
    duration: int,
    archive_storage_path: str,
    archive_storage_generation: Optional[int],
    idempotent_replay: bool = False,
) -> None:
    """Publish only sealed Coverage reports; park every other result for review."""
    report_cost = report.get("cost") if isinstance(report.get("cost"), dict) else {}
    actual_cost_microusd = int(
        usage.get("actual_cost_microusd")
        or round(float(report_cost.get("settled_usd", 0)) * 1_000_000)
    )
    call_count = int(usage.get("call_count") or report_cost.get("call_count", 0))
    telemetry = {
        "duration_seconds": duration,
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "analysis_llm_call_count": call_count,
        "analysis_actual_cost_microusd": actual_cost_microusd,
        "analysis_actual_cost_usd": actual_cost_microusd / 1_000_000,
        "estimated_cost_usd": actual_cost_microusd / 1_000_000,
        "analysis_version": "coverage_v1",
        "engine": "coverage_v1",
        "version_id": version_id,
        "coverage_v1_report_id": report_doc_id,
        "coverage_v1_status": report.get("status"),
        "archived_storage_path": archive_storage_path,
        "archived_storage_generation": archive_storage_generation,
        "idempotent_replay": idempotent_replay,
    }
    if report.get("status") == "sealed":
        mark_complete(job_id, screenplay_doc_id, telemetry)
        log.info(
            f"[coverage_v1] {report.get('title', screenplay_doc_id)!r} → "
            f"{report.get('verdict')} (sealed, {actual_cost_microusd / 1_000_000:.2f} "
            f"USD settled, {call_count} calls)"
        )
        return

    reasons = report.get("review_reasons")
    reason = "; ".join(str(item) for item in reasons) if isinstance(reasons, list) else ""
    mark_needs_review(
        job_id,
        reason or "Coverage V1.2 did not pass its publication gate.",
        failure_kind="coverage_v1_unsealed_report",
        extra={"screenplay_doc_id": screenplay_doc_id, **telemetry},
    )


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
    update = {
        "status": final_status,
        "last_error": str(error)[:2000],
        "worker_id": None if final_status == "pending" else WORKER_ID,
        "last_heartbeat_at": None,
        "processing_started_at": None,
    }
    usage_evidence = _analysis_usage_evidence(getattr(error, "usage", None))
    if usage_evidence is not None:
        update["failure_usage"] = usage_evidence
    _db.collection(QUEUE_COLLECTION).document(job_id).update(update)
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


_USAGE_EVIDENCE_FIELDS = (
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "call_count",
    "actual_cost_microusd",
    "actual_cost_usd",
    "finish_reason",
    "by_model",
    "calls",
    "failed_calls",
)


def _analysis_usage_evidence(usage: object) -> Optional[dict]:
    if not isinstance(usage, dict):
        return None
    evidence = {key: usage.get(key) for key in _USAGE_EVIDENCE_FIELDS}
    for key in ("finish_reason", "by_model", "calls", "failed_calls"):
        value = usage.get(key)
        if isinstance(value, (str, dict, list)):
            evidence[key] = value
    return evidence


def stop_if_paid_failure(job_id: str, error: Exception, usage: object) -> bool:
    """Never requeue a whole analysis after any model call may have happened."""
    evidence = _analysis_usage_evidence(usage)
    if evidence is None or not (
        int(evidence.get("call_count") or 0) > 0
        or int(evidence.get("actual_cost_microusd") or 0) > 0
        or bool(evidence.get("calls"))
        or bool(evidence.get("failed_calls"))
    ):
        return False
    error.usage = usage
    mark_needs_review(
        job_id,
        "A post-model application failure stopped the run. Manual review is required before retrying.",
        evidence={"usage": evidence},
        failure_kind="post_model_application_failure",
    )
    return True


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
    update = {
        "status": "waiting_for_budget",
        "attempt_count": attempts_before_claim,
        "last_error": str(error)[:2000],
        "failure_kind": "budget_wait",
        "retryable": True,
        "budget_resume_at": resume_at,
        "worker_id": None,
        "last_heartbeat_at": None,
        "processing_started_at": None,
    }
    usage_evidence = _analysis_usage_evidence(getattr(error, "usage", None))
    if usage_evidence is not None:
        update["failure_usage"] = usage_evidence
    _db.collection(QUEUE_COLLECTION).document(job_id).update(update)
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


def mark_waiting_for_engine(job_id: str, attempt_count: Optional[int] = None) -> None:
    """Park Coverage work without skipping it or silently converting it to V9."""
    update = {
        "status": "waiting_for_engine",
        "last_error": "Coverage V1.2 worker is disabled; the job remains safely queued.",
        "failure_kind": "engine_wait",
        "retryable": True,
        "worker_id": None,
        "last_heartbeat_at": None,
        "processing_started_at": None,
    }
    if attempt_count is not None:
        update["attempt_count"] = max(0, int(attempt_count) - 1)
    _db.collection(QUEUE_COLLECTION).document(job_id).update(update)


def resume_waiting_for_engine_jobs() -> int:
    """Release parked Coverage work only on an explicitly enabled worker."""
    if not coverage_v1_enabled():
        return 0
    candidates = (
        _db.collection(QUEUE_COLLECTION)
        .where("status", "==", "waiting_for_engine")
        .limit(50)
        .stream()
    )
    resumed = 0
    for snapshot in candidates:
        snapshot.reference.update({
            "status": "pending",
            "failure_kind": None,
            "last_error": None,
        })
        resumed += 1
    return resumed


def mark_terminal_failed(job_id: str, error: Exception) -> None:
    """Fail a deterministic job once; retrying cannot change this outcome."""
    update = {
        "status": "failed",
        "last_error": str(error)[:2000],
        "failure_kind": "terminal",
        "retryable": False,
        "worker_id": WORKER_ID,
        "last_heartbeat_at": None,
        "processing_started_at": None,
        "processing_completed_at": fb_firestore.SERVER_TIMESTAMP,
    }
    usage_evidence = _analysis_usage_evidence(getattr(error, "usage", None))
    if usage_evidence is not None:
        update["failure_usage"] = usage_evidence
    _db.collection(QUEUE_COLLECTION).document(job_id).update(update)
    log.error(f"[job] {job_id} → FAILED (terminal): {error}")


def mark_needs_review(
    job_id: str,
    reason: str,
    *,
    evidence: Optional[dict] = None,
    failure_kind: str = "evidence_review",
    extra: Optional[dict] = None,
) -> None:
    """Stop safely when source or model evidence cannot support a verdict."""
    update = {
        **(extra or {}),
        "status": "needs_review",
        "review_reason": str(reason)[:2000],
        "failure_kind": failure_kind,
        "retryable": False,
        "worker_id": WORKER_ID,
        "last_heartbeat_at": None,
        "processing_started_at": None,
        "processing_completed_at": fb_firestore.SERVER_TIMESTAMP,
    }
    if evidence:
        update["review_evidence"] = evidence
    _db.collection(QUEUE_COLLECTION).document(job_id).update(update)
    log.warning(f"[job] {job_id} → NEEDS REVIEW: {reason}")


def route_analysis_review_error(job_id: str, error: Exception) -> bool:
    """Move bounded quality failures to review instead of retrying whole runs."""
    if getattr(error, "review_required", False) is not True:
        return False
    evidence = getattr(error, "review_evidence", None)
    usage = getattr(error, "usage", None)
    if isinstance(usage, dict):
        evidence = dict(evidence) if isinstance(evidence, dict) else {}
        evidence["usage"] = _analysis_usage_evidence(usage)
    failure_kind = str(
        getattr(error, "review_kind", "analysis_quality_review")
    )
    mark_needs_review(
        job_id,
        str(error),
        evidence=evidence if isinstance(evidence, dict) else None,
        failure_kind=failure_kind,
    )
    return True


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
    text_character_count: int = 0,
    parser_metadata: Optional[dict] = None,
    effective_model_key: Optional[str] = None,
    model_ids: Optional[dict] = None,
    parser_version: Optional[str] = None,
    selection_request: Optional[str] = None,
) -> dict:
    """Build the daemon's V9 parent document using the shared identity contract."""
    if not isinstance(model_ids, dict) or not model_ids:
        raise ValueError("Permanent analysis requires the exact model ID map")
    effective_key = effective_model_key or model_key
    effective_model_id = model_ids.get(effective_key)
    if not isinstance(effective_model_id, str) or not effective_model_id:
        raise ValueError("Permanent analysis requires an exact effective model ID")
    if not isinstance(target_project_id, str) or not target_project_id:
        raise ValueError("Permanent daemon analysis requires target_project_id")
    project_id = target_project_id
    queued_at = queued_at_millis(queued_at_ms)
    version_id = build_version_id(content_hash, queued_at)
    parser_details = parser_metadata if isinstance(parser_metadata, dict) else {}
    raw_doc = {
        "source_file": filename,
        "project_id": project_id,
        "version_id": version_id,
        "analysis_model": effective_model_id,
        "analysis_version": "v9_archaeology",
        "parser_version": parser_version,
        "collection_id": collection_id,
        "collection": collection_id,
        "tmdb_status": tmdb_status,
        "metadata": {
            "filename": filename,
            "page_count": page_count,
            "word_count": word_count,
            "character_count": text_character_count,
            "extraction_method": parser_details.get("extraction_method"),
            "parser_extractor_version": parser_details.get("parser_version"),
            "page_evidence_version": parser_details.get("page_evidence_version"),
            "extraction_quality": parser_details.get("extraction_quality"),
            "page_diagnostics": parser_details.get("page_diagnostics"),
            "page_evidence_sha256": parser_details.get("page_evidence_sha256"),
            "page_content_signals": parser_details.get("page_content_signals"),
            "scene_count_evidence": parser_details.get("scene_count_evidence"),
            "extraction_attempts": parser_details.get("extraction_attempts"),
            "native_cross_check": parser_details.get("native_cross_check"),
        },
        "analysis": analysis,
        "usage": usage,
        "actual_cost_microusd": usage.get("actual_cost_microusd", 0),
        "actual_cost_usd": usage.get("actual_cost_usd", 0.0),
        "_ingest_job_id": job_id,
        "_worker_id": WORKER_ID,
        "queued_at_ms": queued_at,
        **verified_identity_fields(content_hash),
        "calibration_profile": calibration_provenance or {"applied": False},
    }
    if storage_path:
        raw_doc["storage_path"] = storage_path
        raw_doc["_storagePath"] = storage_path
        raw_doc["hasPdf"] = True
    if storage_generation:
        raw_doc["storage_generation"] = storage_generation
    return attach_trust_manifest(
        raw_doc,
        selection_request=selection_request or model_key,
        pipeline_model_tier=model_key,
        effective_model_tier=effective_key,
        model_ids=model_ids,
        origin_kind="daemon_queue",
        origin_id=job_id,
    )

# ── Core job processor ────────────────────────────────────────────────────────

def process_job(job: dict) -> None:
    """
    Full lifecycle for a single ingest job. Called in a thread pool.
    - Downloads PDF to isolated workdir
    - Validates content
    - Routes to Coverage V1.2 or the legacy V9 engine
    - Writes to the engine-specific Firestore collection
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
    paid_usage = None

    # Register locally before the watchdog can inspect this claimed job.
    register_active_job(job_id)
    heartbeat = HeartbeatTask(job_id)

    # Isolated work directory — auto-cleaned on exit even on crash
    workdir = WORK_DIR / job_id

    try:
        engine = resolve_engine_route(job.get("engine"))
        if engine == "coverage_v1" and not coverage_v1_enabled():
            mark_waiting_for_engine(job_id, attempt_count)
            return
        model_key = resolve_model_route(requested_model)
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

        # A renamed revision may only attach to a real existing project.
        target_project_id = (
            resolve_target_project_id(
                job.get("target_project_id"),
                allow_coverage_parent=True,
            )
            if engine == "coverage_v1"
            else resolve_target_project_id(job.get("target_project_id"))
        )

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
        existing_version = (
            get_existing_version(screenplay_doc_id, version_id)
            if engine == "v9"
            else None
        )
        if engine == "v9" and existing_version is not None:
            ingest_v9.validate_permanent_analysis(existing_version)
            verify_archived_pdf_version(
                storage_path=existing_version.get("storage_path"),
                storage_generation=existing_version.get("storage_generation"),
                project_id=screenplay_doc_id,
                version_id=version_id,
                content_hash=content_hash,
            )
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

        if (engine == "coverage_v1" and target_project_id is None
            and separate_project is not True and not job.get("bypass_duplicate", False)
            and is_coverage_already_reported(content_hash, f"{screenplay_doc_id}__{version_id}")):
            mark_skipped(job_id, "already_complete")
            return

        if (
            engine == "v9"
            and target_project_id is None
            and separate_project is not True
            and not job.get("bypass_duplicate", False)
            and is_already_complete(
                content_hash,
                ingest_v9.validate_permanent_analysis,
            )
        ):
            mark_skipped(job_id, "already_complete")
            log.info(
                f"[job] {job_id} → Skipped (validated duplicate: "
                f"{content_hash[:8]}…)"
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
        parser_metadata = (
            parsed.get("metadata")
            if isinstance(parsed.get("metadata"), dict)
            else {}
        )

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

        try:
            validate_parsed_source(parsed)
        except SourceEvidenceError as error:
            extraction_quality = (
                parser_metadata.get("extraction_quality")
            )
            mark_needs_review(
                job_id,
                str(error),
                evidence=(
                    {"extraction_quality": extraction_quality}
                    if isinstance(extraction_quality, dict)
                    else None
                ),
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

        # ── 5. Read-only budget preflight ─────────────────────────────────
        # The strict dollar reservation still happens inside llmProxy for
        # every model call. This read prevents known-exhausted jobs from doing
        # archive/calibration preparation before they pause.
        if engine == "v9":
            try:
                check_daily_budget_available()
            except BudgetExceededError as e:
                mark_waiting_for_budget(job_id, e, attempt_count)
                log.warning(f"[budget] Pausing — {e}")
                return

        calibration_profile = load_calibration_profile() if engine == "v9" else None
        archive_storage_path, archive_storage_generation = archive_pdf_version(
            storage_path=storage_path,
            storage_generation=storage_generation,
            project_id=screenplay_doc_id,
            version_id=version_id,
            content_hash=content_hash,
        )

        # ── 6. Model route was validated before download or archive writes ─
        title = Path(filename).stem.replace("_", " ").replace("-", " ")

        # ── 7. Run V9 Archaeology Engine analysis ─────────────────────────
        proxy_url = os.getenv("LLM_PROXY_URL")  # None = production proxy URL

        # ── Coverage V1 (lean two-call engine) — disabled by default ──────
        # Double opt-in: the daemon env flag AND the job's engine field must
        # both select it. Results go to a separate staging collection; the
        # immutable V9 store is never written by this route.
        if engine == "coverage_v1":
            run_coverage_v1_job(
                job=job,
                job_id=job_id,
                title=title,
                text=text,
                page_count=page_count,
                word_count=word_count,
                content_hash=content_hash,
                parser_version=ingest_v9.PARSER_VERSION,
                screenplay_doc_id=screenplay_doc_id,
                version_id=version_id,
                model_key=model_key,
                proxy_url=proxy_url,
                attempt_count=attempt_count,
                start_time=start_time,
                archive_storage_path=archive_storage_path,
                archive_storage_generation=archive_storage_generation,
            )
            return

        cold_read = None
        cold_read_usage = None
        def include_cold_read_usage(error: Exception) -> None:
            if cold_read_usage is not None:
                error.usage = ingest_v9.merge_usage(
                    cold_read_usage,
                    getattr(error, "usage", ingest_v9.empty_usage()),
                )

        try:
            try:
                cold_read, cold_read_usage = ingest_v9.run_nonbinding_cold_read(
                    text=text,
                    title=title,
                    page_count=page_count,
                    word_count=word_count,
                    proxy_url=proxy_url,
                    job_id=job_id,
                )
            except ingest_v9.LlmCallFailedError as error:
                error.usage = ingest_v9.failed_usage(error)
                raise
            except ingest_v9.V9RunError as error:
                cold_read_usage = error.usage
                log.warning(
                    f"[analyze] Non-binding cold read unavailable: {error}"
                )

            if model_key == "hybrid":
                log.info(f"[analyze] Running V9 HYBRID analysis: '{title}' (Sonnet → maybe Opus)")
                analysis, usage = ingest_v9.run_v9_hybrid(
                    text=text,
                    title=title,
                    page_count=page_count,
                    word_count=word_count,
                    proxy_url=proxy_url,
                    cold_read=cold_read,
                    calibration_prompt=(
                        calibration_profile["prompt"] if calibration_profile else None
                    ),
                    job_id=job_id,
                    page_content_signals=parser_metadata.get("page_content_signals"),
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
                    cold_read=cold_read,
                    calibration_prompt=(
                        calibration_profile["prompt"] if calibration_profile else None
                    ),
                    job_id=job_id,
                    page_content_signals=parser_metadata.get("page_content_signals"),
                )
            if cold_read_usage is not None:
                usage = ingest_v9.merge_usage(cold_read_usage, usage)
            paid_usage = usage
        except ingest_v9.DailyBudgetExceededError as e:
            include_cold_read_usage(e)
            if stop_if_paid_failure(job_id, e, getattr(e, "usage", None)):
                log.error(
                    "[budget] Daily cap was reached after paid work; "
                    "manual review is required before retrying."
                )
                return
            mark_waiting_for_budget(job_id, e, attempt_count)
            log.warning(f"[budget] Pausing — {e}")
            return
        except ingest_v9.BenchmarkCapExceededError as e:
            include_cold_read_usage(e)
            mark_terminal_failed(job_id, e)
            log.error(f"[budget] Benchmark cap blocked analysis: {e}")
            return
        except ingest_v9.LlmAccountingError as e:
            include_cold_read_usage(e)
            mark_terminal_failed(job_id, e)
            log.error(
                "[budget] Cost settlement failed after a possible paid call; "
                "manual review required before retrying."
            )
            return
        except ingest_v9.LlmProvenanceError as e:
            include_cold_read_usage(e)
            mark_terminal_failed(job_id, e)
            log.error(
                "[trust] Model response provenance was incomplete; "
                "manual review required before retrying."
            )
            return
        except ingest_v9.LlmRequestRejectedError as e:
            include_cold_read_usage(e)
            mark_terminal_failed(job_id, e)
            log.error(
                "[trust] Anthropic rejected the request before generation; "
                "deployment review required before retrying."
            )
            return
        except ingest_v9.LlmCallFailedError as e:
            if not isinstance(getattr(e, "usage", None), dict):
                e.usage = ingest_v9.failed_usage(e)
            usage_evidence = _analysis_usage_evidence(e.usage)
            mark_needs_review(
                job_id,
                "A model call may have completed but its response and cost could not "
                "be reconciled. Manual review is required before retrying.",
                evidence=(
                    {"usage": usage_evidence}
                    if usage_evidence is not None
                    else None
                ),
                failure_kind="ambiguous_paid_call",
            )
            log.error(
                "[trust] Ambiguous model transport stopped the workflow before "
                "any further paid analysis."
            )
            return
        except ingest_v9.V9RunError as e:
            include_cold_read_usage(e)
            if route_analysis_review_error(job_id, e):
                return
            usage_evidence = _analysis_usage_evidence(e.usage)
            mark_needs_review(
                job_id,
                str(e),
                evidence={"usage": usage_evidence} if usage_evidence else None,
                failure_kind="post_model_engine_failure",
            )
            return
        except SourceEvidenceError as e:
            mark_needs_review(job_id, str(e))
            return
        except Exception as e:
            include_cold_read_usage(e)
            if route_analysis_review_error(job_id, e):
                return
            raise

        # ── 8. Check finish reason (don't save truncated JSON) ────────────
        finish_reason = usage.get("finish_reason", "end_turn")
        if finish_reason == "max_tokens":
            raise RuntimeError(
                f"Anthropic output truncated (max_tokens) — JSON is incomplete. "
                f"Will retry on next attempt."
            )

        try:
            citation_quality = attach_verified_citation_quality(
                analysis,
                parsed.get("metadata") or {},
                page_count,
                text,
            )
        except SourceEvidenceError as error:
            citation_quality = analysis.get("_citation_quality")
            evidence = {"usage": _analysis_usage_evidence(usage)}
            if isinstance(citation_quality, dict):
                evidence["citation_quality"] = citation_quality
            mark_needs_review(
                job_id,
                str(error),
                evidence=evidence,
            )
            return

        final_model_key = model_key
        if model_key == "hybrid":
            hybrid_meta = analysis.get("_hybrid_mode") or {}
            final_model_key = hybrid_meta.get("final_model", "sonnet")
        boundary = analysis.get("_boundary_reruns")
        boundary_run = (
            boundary.get("selected_run_number", 1)
            if isinstance(boundary, dict)
            else 1
        )
        try:
            claim_verification, claim_usage = ingest_v9.run_claim_verification(
                text=text,
                analysis=analysis,
                model_key=final_model_key,
                proxy_url=proxy_url,
                pipeline_pass=final_model_key,
                boundary_run=boundary_run,
                job_id=job_id,
            )
            analysis["_claim_verification"] = claim_verification
            usage = ingest_v9.merge_usage(usage, claim_usage)
            paid_usage = usage
            attach_verified_citation_quality(
                analysis,
                parsed.get("metadata") or {},
                page_count,
                text,
            )
        except Exception as error:
            error.usage = ingest_v9.merge_usage(
                usage,
                getattr(error, "usage", ingest_v9.empty_usage()),
            )
            if route_analysis_review_error(job_id, error):
                return
            mark_needs_review(
                job_id,
                "Independent claim verification did not complete; no analysis was published.",
                evidence={"usage": _analysis_usage_evidence(error.usage)},
                failure_kind="claim_verification_incomplete",
            )
            return

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
            text_character_count=len(text),
            parser_metadata=parsed.get("metadata"),
            effective_model_key=final_model_key,
            model_ids=ingest_v9.MODEL_IDS,
            parser_version=ingest_v9.PARSER_VERSION,
            selection_request=(
                requested_model
                if isinstance(requested_model, str) and requested_model
                else "auto"
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

        actual_cost_microusd = int(usage.get("actual_cost_microusd", 0))
        actual_cost_usd = actual_cost_microusd / 1_000_000
        analysis_call_count = int(usage.get("call_count", 0))

        # For hybrid runs, report the model that actually produced the final
        # result (sonnet for no-promotion, opus for promoted scripts).
        mark_complete(job_id, screenplay_doc_id, {
            "duration_seconds": duration,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "analysis_llm_call_count": analysis_call_count,
            "analysis_actual_cost_microusd": actual_cost_microusd,
            "analysis_actual_cost_usd": actual_cost_usd,
            "anthropic_model": ingest_v9.MODEL_IDS.get(final_model_key, final_model_key),
            "anthropic_finish_reason": finish_reason,
            # Compatibility field for existing dashboard readers. It now holds
            # exact server-settled cost rather than a model-key estimate.
            "estimated_cost_usd": actual_cost_usd,
            "prompt_version": raw_doc["prompt_version"],
            "analysis_version": "v9_archaeology",
            "archived_storage_path": archive_storage_path,
            "archived_storage_generation": archive_storage_generation,
        })

        log.info(
            f"[job] ✅ {filename} → complete "
            f"({duration}s | {analysis_call_count} calls | "
            f"{input_tokens:,}+{output_tokens:,} tokens | ${actual_cost_usd:.4f})"
        )

    except TerminalJobError as e:
        log.error(f"[job] ❌ {filename} — terminal queue error: {e}")
        log.debug(traceback.format_exc())
        mark_terminal_failed(job_id, e)
    except Exception as e:
        if paid_usage is not None:
            e.usage = paid_usage
        log.error(f"[job] ❌ {filename} — {e}")
        log.debug(traceback.format_exc())
        if not stop_if_paid_failure(job_id, e, getattr(e, "usage", None)):
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
    log.info("    Daily budget: enforced as dollars by the llmProxy Cloud Function")
    log.info("═" * 70)

    if not os.getenv("PROXY_SERVICE_KEY"):
        log.error(
            "PROXY_SERVICE_KEY is unset; daemon cannot authenticate to llmProxy. "
            "Exiting before queue consumption."
        )
        sys.exit(1)

    try:
        verify_proxy_trust_capability()
    except Exception as exc:
        log.error(
            "[startup] llmProxy trust preflight failed; "
            f"no queue jobs will be claimed: {exc}"
        )
        sys.exit(1)
    log.info(
        "[startup] llmProxy supports response trust contract "
        f"{LLM_PROXY_TRUST_CONTRACT_VERSION}; permanent records use "
        f"{TRUST_MANIFEST_VERSION}"
    )

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
