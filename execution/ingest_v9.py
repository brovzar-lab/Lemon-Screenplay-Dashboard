#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║        LEMON SCREENPLAY INGESTION PIPELINE — V9 / FIREBASE EDITION          ║
╚══════════════════════════════════════════════════════════════════════════════╝

Rewrites ingest_screenplays.py for the current production stack:
  • V9 Archaeology Engine  (5-reader parallel → synthesis)
  • Firebase Firestore     (collection: uploaded_analyses)
  • Firebase Storage       (NOTE: docs get a _storagePath pointer to
    screenplays/{category}/{title}.pdf but no code uploads the PDF there —
    known gap, slated for the pipeline-safety work)
  • Live LLM Proxy         (Firebase Cloud Function → Anthropic)
  • TMDB pre-screening     (skip already-produced films)

Usage
─────
  # Batch a folder of PDFs into the LEMON collection:
  python execution/ingest_v9.py --source /path/to/pdfs --collection LEMON

  # Single screenplay:
  python execution/ingest_v9.py --source MyScript.pdf --collection SUBMISSION

  # Triage mode (fast, cheap — Haiku single-pass):
  python execution/ingest_v9.py --source /pdfs --collection LEMON --triage

  # Specific model:
  python execution/ingest_v9.py --source /pdfs --collection LEMON --model opus

  # Preview without spending any credits:
  python execution/ingest_v9.py --source /pdfs --collection LEMON --dry-run

  # Skip TMDB check (for scripts you know haven't been produced):
  python execution/ingest_v9.py --source /pdfs --collection LEMON --skip-tmdb

  # Re-analyze scripts already in Firestore:
  python execution/ingest_v9.py --source /pdfs --collection LEMON --force

  # Concurrency (default 3 — safe for API limits):
  python execution/ingest_v9.py --source /pdfs --collection LEMON --concurrency 5

Collections
───────────
  BLKLST     — Black List screenplays
  LEMON      — Lemon Studios acquisitions
  SUBMISSION — Submitted scripts
  CONTEST    — Competition entries
  OTHER      — Everything else

Required env vars (in .env at project root, or functions/.env):
  ANTHROPIC_API_KEY    — for direct API mode (bypasses proxy)
  FIREBASE_PROJECT_ID  — lemon-screenplay-dashboard
  GOOGLE_APPLICATION_CREDENTIALS — path to service account JSON (for Firestore writes)

Optional env vars:
  FIREBASE_STORAGE_BUCKET — explicit bucket name (defaults to production bucket)
  TMDB_API_KEY         — for TMDB pre-screening (skip with --skip-tmdb if absent)
  LLM_PROXY_URL        — override default Cloud Function URL
"""

import argparse
import json
import os
import re
import sys
import tempfile
import threading
import time
import uuid
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ── Dependency imports with helpful error messages ────────────────────────────

try:
    import requests
except ImportError:
    sys.exit("Missing: pip install requests")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # .env is optional if vars are already exported

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, storage as fb_storage
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("⚠ firebase-admin not installed — Firestore writes disabled.")
    print("  Install: pip install firebase-admin")

# Story Grid genre engine (lives next to this file).
sys.path.insert(0, str(Path(__file__).parent))
from firebase_config import resolve_storage_bucket  # noqa: E402
from content_identity import (  # noqa: E402
    build_version_id,
    compute_content_hash,
    queued_at_millis,
    verified_identity_fields,
    version_created_at,
)
from story_grid import (  # noqa: E402
    build_genre_detection_prompt,
    parse_detection,
    build_genre_card,
)

# ── Logging ───────────────────────────────────────────────────────────────────

LOG_DIR = Path(".tmp")
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / f"ingest_v9_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
log = logging.getLogger("lemon")

# ── Constants ─────────────────────────────────────────────────────────────────

# Firestore collection (must match src/lib/analysisStore.ts)
FIRESTORE_COLLECTION = "uploaded_analyses"

# Live Firebase Cloud Function URL (prod)
DEFAULT_PROXY_URL = "https://us-central1-lemon-screenplay-dashboard.cloudfunctions.net/llmProxy"

# Model IDs (must match src/lib/multiPassAnalysis.ts CLAUDE_MODELS)
MODEL_IDS = {
    "sonnet": "claude-sonnet-4-6",
    "haiku":  "claude-haiku-4-5-20251001",
    "opus":   "claude-opus-4-7",
}

# Max characters sent to AI. Raised from 150_000 → 195_000 so feature-length
# scripts (90-130 pages) fit without losing Act 3. Sonnet 4.6 / Opus 4.7 have
# 200K context windows; this leaves ~5K for system prompts + reader output.
MAX_CHARS = 195_000

# Min words for a valid screenplay
MIN_WORDS = 500

# Parsed screenplay cache. The parser version is part of the key so extraction
# changes cannot silently reuse output from an older parser implementation.
PARSER_VERSION = "v2"
PARSE_CACHE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
PARSE_CACHE_MAX_BYTES = 512 * 1024 * 1024
PARSE_CACHE_CLEANUP_INTERVAL_SECONDS = 60 * 60

_parse_cache_last_cleanup_at: Optional[float] = None
_parse_cache_size_bytes: Optional[int] = None
_parse_cache_state_lock = threading.Lock()

# Seconds between scripts in a batch (politeness buffer)
INTER_SCRIPT_DELAY = 2

# Default temperature for evaluation calls. Low but not zero — small jitter is
# tolerable; full 1.0 produces different verdicts on re-runs of the same script.
DEFAULT_TEMPERATURE = 0.1

# Extended-thinking budgets (Sonnet 4.6 / Opus 4.7).
# Readers: enough to log scenes + reason about sub-scores before committing.
# Synthesis: the cognitively hardest step — reader reconciliation, gate +
# trap evaluation, weighted score computation, executive summary.
THINKING_BUDGET_READER = 8_000
THINKING_BUDGET_SYNTHESIS = 16_000

# Output token budgets (separate from thinking budget; both contribute to
# total max_tokens passed to the API).
OUTPUT_BUDGET_READER = 4_000
OUTPUT_BUDGET_SYNTHESIS = 6_000

# Reader weights (must match src/lib/promptClient.v9.ts READER_WEIGHTS)
READER_WEIGHTS = {
    "structure":          0.30,  # Reduced from 0.40 — was acting as proxy for overall quality.
    "character":          0.30,  # Raised to match — audiences remember characters.
    "craft_scene":        0.15,
    "concept":            0.15,  # Raised — the marketable signal was underweighted.
    "emotional_resonance":0.10,
}

# ── Firebase Init ─────────────────────────────────────────────────────────────

_db = None
_bucket = None

def init_firebase() -> bool:
    """Initialise Firebase Admin SDK. Returns True if successful."""
    global _db, _bucket

    if not FIREBASE_AVAILABLE:
        return False

    if _db is not None:
        return True

    # Service account path
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    storage_bucket = resolve_storage_bucket()

    try:
        if not firebase_admin._apps:
            if cred_path and Path(cred_path).exists():
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred, {
                    "storageBucket": storage_bucket,
                })
                log.info(
                    f"Firebase initialised with service account: {cred_path}, "
                    f"bucket: {storage_bucket}"
                )
            else:
                # Try Application Default Credentials (gcloud auth)
                firebase_admin.initialize_app(options={
                    "storageBucket": storage_bucket,
                })
                log.info(
                    "Firebase initialised with Application Default Credentials, "
                    f"bucket: {storage_bucket}"
                )

        _db = firestore.client()
        try:
            _bucket = fb_storage.bucket(storage_bucket)
        except Exception:
            _bucket = None  # Storage is optional
            log.warning("Firebase Storage not initialised (PDF uploads will be skipped)")
        return True

    except Exception as e:
        log.error(f"Firebase init failed: {e}")
        log.error("Set GOOGLE_APPLICATION_CREDENTIALS to your service-account.json path")
        return False


# ── Firestore Write ───────────────────────────────────────────────────────────

def to_doc_id(source_file: str) -> str:
    """Sanitize filename into a Firestore document ID.
    Mirrors toDocId() in src/lib/analysisStore.ts.
    """
    return (
        re.sub(r"[/\\]", "_", source_file)
        .translate(str.maketrans("", "", "".join(c for c in map(chr, range(256))
                                                 if not re.match(r"[a-zA-Z0-9_\-. ]", c))))
        .strip()
        .replace(" ", "_")[:200]
        or f"doc_{int(time.time())}"
    )


def build_version_document(
    raw: Dict[str, Any],
    project_id: str,
    version_id: str,
    version_number: int,
    queued_at_ms: int,
) -> Dict[str, Any]:
    """Build an immutable analysis snapshot with Firestore-native field types."""
    identity = verified_identity_fields(str(raw.get("content_hash", "")))
    if raw.get("identity_status") != "verified":
        raise ValueError("Permanent V9 coverage requires verified identity")
    if type(version_number) is not int or version_number <= 0:
        raise ValueError("version_number must be a positive integer")

    created_at = version_created_at(queued_at_ms)
    return {
        **raw,
        **identity,
        "source_file": str(raw.get("source_file", "")),
        "project_id": project_id,
        "version_id": version_id,
        "version_number": version_number,
        "queued_at_ms": queued_at_millis(queued_at_ms),
        "created_at": created_at,
    }


def build_parent_document(
    raw: Dict[str, Any],
    project_id: str,
    version_id: str,
    version_number: int,
    queued_at_ms: int,
    existing_parent: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build the backward-compatible latest projection for one immutable version."""
    source_file = str(raw.get("source_file", ""))
    existing_source = (existing_parent or {}).get("source_file")
    canonical_source = existing_source if isinstance(existing_source, str) and existing_source else source_file
    saved_at = version_created_at(queued_at_ms).isoformat().replace("+00:00", "Z")
    return {
        **raw,
        "source_file": canonical_source,
        "latest_source_file": source_file,
        "project_id": project_id,
        "latest_version_id": version_id,
        "version_count": version_number,
        "queued_at_ms": queued_at_millis(queued_at_ms),
        "_savedAt": saved_at,
        "_docId": project_id,
    }


def write_analysis_transaction(
    transaction: Any,
    parent_ref: Any,
    version_ref: Any,
    raw: Dict[str, Any],
    project_id: str,
    version_id: str,
    queued_at_ms: int,
) -> int:
    """Create history and advance latest using one Firestore transaction."""
    parent_snapshot = parent_ref.get(transaction=transaction)
    version_snapshot = version_ref.get(transaction=transaction)

    if version_snapshot.exists:
        existing_version = version_snapshot.to_dict() or {}
        version_number = existing_version.get("version_number")
        if type(version_number) is not int or version_number <= 0:
            raise ValueError("Existing immutable version has an invalid version_number")
        return version_number

    existing_parent = parent_snapshot.to_dict() if parent_snapshot.exists else {}
    existing_version_count = (existing_parent or {}).get("version_count", 0)
    if type(existing_version_count) is not int or existing_version_count < 0:
        raise ValueError("Existing parent has an invalid version_count")
    version_number = existing_version_count + 1
    version_document = build_version_document(
        raw, project_id, version_id, version_number, queued_at_ms
    )
    parent_document = build_parent_document(
        raw,
        project_id,
        version_id,
        version_number,
        queued_at_ms,
        existing_parent,
    )

    transaction.create(version_ref, version_document)
    transaction.set(parent_ref, parent_document)
    return version_number


def write_to_firestore(raw: Dict[str, Any]) -> bool:
    """Atomically create an immutable version and advance its latest parent."""
    if _db is None:
        return False

    source_file = str(raw.get("source_file", ""))
    project_id_value = raw.get("project_id")
    project_id = (
        project_id_value
        if isinstance(project_id_value, str) and project_id_value.strip()
        else to_doc_id(source_file)
    )

    try:
        if not source_file:
            raise ValueError("Permanent analysis requires source_file")
        if "/" in project_id:
            raise ValueError("project_id must be a Firestore document ID")
        content_hash = verified_identity_fields(str(raw.get("content_hash", "")))["content_hash"]
        if raw.get("identity_status") != "verified":
            raise ValueError("Permanent V9 coverage requires verified identity")
        queued_at_ms = queued_at_millis(raw.get("queued_at_ms"))
        version_id = build_version_id(content_hash, queued_at_ms)

        parent_ref = _db.collection(FIRESTORE_COLLECTION).document(project_id)
        version_ref = parent_ref.collection("versions").document(version_id)

        @firestore.transactional
        def commit(transaction: Any) -> int:
            return write_analysis_transaction(
                transaction,
                parent_ref,
                version_ref,
                raw,
                project_id,
                version_id,
                queued_at_ms,
            )

        version_number = commit(_db.transaction())
        log.info(
            f"  ✓ Saved to Firestore: {project_id} "
            f"(version {version_number}, {version_id[:16]}…)"
        )
        return True
    except Exception as e:
        log.error(f"  ✗ Firestore write failed for {project_id}: {e}")
        return False


def check_already_in_firestore(source_file: str) -> bool:
    """Return True if this screenplay is already in Firestore (and not deleted)."""
    if _db is None:
        return False
    doc_id = to_doc_id(source_file)
    try:
        doc = _db.collection(FIRESTORE_COLLECTION).document(doc_id).get()
        if not doc.exists:
            return False
        data = doc.to_dict() or {}
        return "_deleted_at" not in data
    except Exception:
        return False


# ── PDF Parser ────────────────────────────────────────────────────────────────

def _cleanup_parse_cache(
    cache_dir: Path,
    *,
    now: Optional[float] = None,
    max_age_seconds: int = PARSE_CACHE_MAX_AGE_SECONDS,
    max_bytes: int = PARSE_CACHE_MAX_BYTES,
) -> int:
    """Remove expired parse entries, then oldest entries until under the cap."""
    if not cache_dir.exists():
        return 0

    cutoff_time = (time.time() if now is None else now) - max(0, max_age_seconds)
    entries: List[Tuple[Path, int, float]] = []
    removed_count = 0
    removed_bytes = 0

    for path in cache_dir.rglob("*.json"):
        is_content_addressed = re.fullmatch(r"[a-f0-9]{64}\.json", path.name) is not None
        is_unsafe_legacy_entry = path.parent == cache_dir and not is_content_addressed
        if not is_content_addressed and not is_unsafe_legacy_entry:
            continue
        try:
            stat = path.stat()
        except OSError:
            continue

        if is_unsafe_legacy_entry or stat.st_mtime < cutoff_time:
            try:
                path.unlink()
                removed_count += 1
                removed_bytes += stat.st_size
            except OSError:
                entries.append((path, stat.st_size, stat.st_mtime))
        else:
            entries.append((path, stat.st_size, stat.st_mtime))

    total_bytes = sum(size for _, size, _ in entries)
    if total_bytes > max(0, max_bytes):
        for path, size, _ in sorted(entries, key=lambda entry: (entry[2], entry[0].name)):
            if total_bytes <= max(0, max_bytes):
                break
            try:
                path.unlink()
                total_bytes -= size
                removed_count += 1
                removed_bytes += size
            except OSError:
                continue

    if removed_count:
        log.info(
            f"  Parse cache cleanup: removed {removed_count} file(s), "
            f"freed {removed_bytes / (1024 * 1024):.1f} MB"
        )
    return total_bytes


def _maybe_cleanup_parse_cache(cache_dir: Path, *, force: bool = False) -> int:
    """Run bounded cache cleanup at most hourly unless the size cap is crossed."""
    global _parse_cache_last_cleanup_at, _parse_cache_size_bytes

    monotonic_now = time.monotonic()
    with _parse_cache_state_lock:
        cleanup_due = (
            force
            or _parse_cache_last_cleanup_at is None
            or monotonic_now - _parse_cache_last_cleanup_at >= PARSE_CACHE_CLEANUP_INTERVAL_SECONDS
        )
        if cleanup_due:
            _parse_cache_size_bytes = _cleanup_parse_cache(cache_dir)
            _parse_cache_last_cleanup_at = monotonic_now
        return _parse_cache_size_bytes or 0


def _record_parse_cache_write(cache_dir: Path, previous_size: int, new_size: int) -> None:
    """Track a cache write and enforce the size cap when it is crossed."""
    global _parse_cache_size_bytes

    force_cleanup = False
    with _parse_cache_state_lock:
        if _parse_cache_size_bytes is None:
            force_cleanup = True
        else:
            _parse_cache_size_bytes += new_size - previous_size
            force_cleanup = _parse_cache_size_bytes > PARSE_CACHE_MAX_BYTES

    if force_cleanup:
        _maybe_cleanup_parse_cache(cache_dir, force=True)


def _read_valid_parse(path: Path) -> Optional[Dict[str, Any]]:
    try:
        with open(path, encoding="utf-8") as parsed_file:
            data = json.load(parsed_file)
    except (OSError, ValueError, TypeError):
        return None

    if not isinstance(data, dict) or data.get("word_count", 0) < MIN_WORDS:
        return None
    return data


def parse_pdf(pdf_path: Path, content_hash: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Parse a screenplay PDF using the existing parse_screenplay_pdf_v2.py.
    Cache identity is raw-byte SHA-256 plus PARSER_VERSION, never the filename.
    Returns the parsed JSON dict or None on failure.
    """
    parse_script = Path(__file__).parent / "parse_screenplay_pdf_v2.py"
    if not parse_script.exists():
        log.error(f"Parser not found: {parse_script}")
        return None

    import subprocess

    if content_hash is None:
        content_hash = compute_content_hash(pdf_path)
    content_hash = content_hash.lower()
    if not re.fullmatch(r"[a-f0-9]{64}", content_hash):
        log.error(f"Invalid PDF content hash for {pdf_path.name}")
        return None

    cache_root = LOG_DIR / "parsed_v9"
    cache_dir = cache_root / PARSER_VERSION
    cache_root.mkdir(parents=True, exist_ok=True)
    _maybe_cleanup_parse_cache(cache_root)
    cache_dir.mkdir(parents=True, exist_ok=True)
    output_path = cache_dir / f"{content_hash}.json"

    # Reuse cached parse result
    if output_path.exists():
        cached = _read_valid_parse(output_path)
        if cached is not None:
            word_count = cached.get("word_count", 0)
            log.info(f"  Reusing cached parse: {pdf_path.name} ({word_count:,} words)")
            return cached
        try:
            output_path.unlink()
        except OSError:
            pass

    with tempfile.TemporaryDirectory(prefix=".working-", dir=cache_root) as working_dir:
        result = subprocess.run(
            [sys.executable, str(parse_script),
             "--input", str(pdf_path),
             "--output", working_dir],
            capture_output=True, text=True, timeout=300,
        )
        parser_output = Path(working_dir) / (pdf_path.stem + ".json")

        if result.returncode != 0 or not parser_output.exists():
            log.error(f"  ✗ Parse failed: {pdf_path.name}")
            if result.stderr:
                log.debug(f"    stderr: {result.stderr[:300]}")
            return None

        data = _read_valid_parse(parser_output)
        if data is None:
            log.error(f"  ✗ Parse output invalid or insufficient: {pdf_path.name}")
            return None

        previous_size = output_path.stat().st_size if output_path.exists() else 0
        os.replace(parser_output, output_path)
        _record_parse_cache_write(cache_root, previous_size, output_path.stat().st_size)

    word_count = data.get("word_count", 0)
    log.info(f"  ✓ Parsed: {pdf_path.name} ({word_count:,} words, {data.get('page_count',0)} pages)")
    return data


# ── TMDB Pre-screening ────────────────────────────────────────────────────────

def check_tmdb(title: str, year_context: Optional[int] = None) -> Tuple[bool, str]:
    """Check TMDB to see if this script has already been produced.
    Delegates to the existing check_produced_film.py script.
    Returns (is_produced, reason).
    """
    tmdb_key = os.getenv("TMDB_API_KEY")
    if not tmdb_key:
        return False, "TMDB_API_KEY not set — skipping check"

    check_script = Path(__file__).parent / "check_produced_film.py"
    if not check_script.exists():
        return False, "check_produced_film.py not found — skipping"

    import subprocess
    cmd = [sys.executable, str(check_script), "--title", title]
    if year_context:
        cmd.extend(["--year-context", str(year_context)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 1:
            return True, result.stdout.strip() or "PRODUCED"
        elif result.returncode == 2:
            return False, f"TMDB error (proceeding): {result.stderr.strip()[:100]}"
        return False, result.stdout.strip() or "Not produced"
    except subprocess.TimeoutExpired:
        return False, "TMDB timeout (proceeding)"
    except Exception as e:
        return False, f"TMDB check error (proceeding): {e}"


# ── LLM Proxy ─────────────────────────────────────────────────────────────────

def call_llm(
    *,
    system_blocks: List[Dict[str, Any]],
    user_blocks: List[Dict[str, Any]],
    model_key: str,
    tool: Optional[Dict[str, Any]] = None,
    thinking_budget: int = 0,
    max_tokens: int = 4_000,
    temperature: float = DEFAULT_TEMPERATURE,
    retries: int = 3,
    proxy_url: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], str, Dict[str, int]]:
    """Block-aware LLM call via the Firebase proxy.

    Args:
      system_blocks: Anthropic system content blocks (e.g. cached text).
      user_blocks: user message content blocks (e.g. cached screenplay + instructions).
      model_key: 'sonnet' | 'haiku' | 'opus'.
      tool: optional tool definition; if set, tool_choice forces this tool and
            the model's structured output is returned in the first return value.
      thinking_budget: extended-thinking budget in tokens. 0 = disabled.
      max_tokens: output tokens (not including thinking budget).
      temperature: sampling temperature (default 0.1).
      retries: transport retry count.
      proxy_url: override the default Cloud Function URL.

    Returns:
      (tool_input, text, usage)
        tool_input: dict if tool was forced and call succeeded; else None
        text: first text block (if any) — useful for non-tool calls
        usage: {input_tokens, output_tokens, cache_creation_input_tokens,
                cache_read_input_tokens}
    """
    url = proxy_url or os.getenv("LLM_PROXY_URL") or DEFAULT_PROXY_URL
    model_id = MODEL_IDS.get(model_key, MODEL_IDS["sonnet"])

    # Combine thinking budget into total max_tokens.
    total_max_tokens = max_tokens + (thinking_budget if thinking_budget > 0 else 0)

    payload: Dict[str, Any] = {
        "model": model_id,
        "system": system_blocks,
        "messages": [{"role": "user", "content": user_blocks}],
        "max_tokens": total_max_tokens,
        "temperature": temperature,
    }
    if tool:
        payload["tools"] = [tool]
        # Anthropic restriction: tool_choice cannot FORCE a specific tool when
        # extended thinking is enabled (error: "Thinking may not be enabled
        # when tool_choice forces tool use"). When thinking is on, use
        # tool_choice="auto" and rely on the user-prompt instruction to call
        # the tool. When thinking is off, force the tool to guarantee output.
        if thinking_budget > 0:
            payload["tool_choice"] = {"type": "auto"}
        else:
            payload["tool_choice"] = {"type": "tool", "name": tool["name"]}
    if thinking_budget > 0:
        # Two thinking APIs depending on the model:
        #   • Opus 4.7+   → adaptive thinking (Anthropic decides effort)
        #   • Sonnet 4.6  → enabled with explicit budget_tokens
        # Using the wrong shape returns a 400 with a clear error message.
        if "opus" in model_id.lower():
            payload["thinking"] = {"type": "adaptive"}
        else:
            payload["thinking"] = {"type": "enabled", "budget_tokens": thinking_budget}
        # Anthropic requires temperature=1 when extended thinking is enabled.
        payload["temperature"] = 1.0

    # The proxy authenticates callers: the daemon presents a shared service
    # key (browsers present a Firebase ID token). Set PROXY_SERVICE_KEY in the
    # daemon's environment to match functions/.env. Absent → unauthenticated
    # (will 401 once the proxy gate is deployed).
    proxy_headers = {}
    service_key = os.getenv("PROXY_SERVICE_KEY")
    if service_key:
        proxy_headers["X-Lemon-Service-Key"] = service_key

    last_err: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            resp = requests.post(url, json=payload, headers=proxy_headers, timeout=540)
            if resp.status_code == 429:
                wait = 30 * attempt
                log.warning(f"    Rate limited — waiting {wait}s (attempt {attempt}/{retries})")
                time.sleep(wait)
                continue
            if resp.status_code in (401, 403):
                # Either the daemon's PROXY_SERVICE_KEY is missing/wrong, or the
                # upstream Anthropic key is invalid. Both are non-retryable.
                raise RuntimeError(
                    f"Proxy auth rejected ({resp.status_code}). Check PROXY_SERVICE_KEY "
                    f"matches functions/.env. Body: {resp.text[:200]}"
                )
            if resp.status_code == 400:
                raise RuntimeError(
                    f"Proxy rejected the request (400). Body: {resp.text[:500]}"
                )
            resp.raise_for_status()
            data = resp.json()

            text = data.get("text", "")
            tool_uses = data.get("tool_uses", []) or []
            tool_input = tool_uses[0]["input"] if tool_uses else None

            usage = {
                "input_tokens": data.get("usage", {}).get("input_tokens", 0),
                "output_tokens": data.get("usage", {}).get("output_tokens", 0),
                "cache_creation_input_tokens": data.get("usage", {}).get("cache_creation_input_tokens", 0),
                "cache_read_input_tokens": data.get("usage", {}).get("cache_read_input_tokens", 0),
            }
            return tool_input, text, usage

        except Exception as e:
            last_err = e
            if attempt < retries:
                wait = attempt * 5
                log.warning(f"    LLM call failed (attempt {attempt}/{retries}): {e} — retrying in {wait}s")
                time.sleep(wait)

    raise RuntimeError(f"LLM call failed after {retries} attempts: {last_err}")


def _screenplay_user_block(text: str, cached: bool = True) -> Dict[str, Any]:
    """Build a cacheable text block carrying the screenplay body.

    The same block is reused across all 5 readers + synthesis in one script's
    run. The first call writes the cache; subsequent calls read at 10% input
    cost. ~5-minute TTL on Anthropic's side, which comfortably covers a full
    parallel reader fan-out.
    """
    block: Dict[str, Any] = {
        "type": "text",
        "text": f"# SCREENPLAY TEXT\n\n{text}",
    }
    if cached:
        block["cache_control"] = {"type": "ephemeral"}
    return block


# ── JSON Extraction ───────────────────────────────────────────────────────────

def extract_json(text: str) -> Dict[str, Any]:
    """Robustly extract JSON from an LLM response (handles markdown fences)."""
    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()

    # Try full parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Find the largest {...} block
    stack, start = [], -1
    for i, ch in enumerate(cleaned):
        if ch == "{":
            if not stack:
                start = i
            stack.append(i)
        elif ch == "}" and stack:
            stack.pop()
            if not stack and start != -1:
                candidate = cleaned[start:i + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    pass

    raise ValueError(f"No valid JSON found in LLM response (first 200 chars): {text[:200]}")


# ── V9 Reader Prompts ─────────────────────────────────────────────────────────

def _truncate(text: str, max_chars: int = MAX_CHARS) -> str:
    """Truncate screenplay text to the character limit with a clear marker."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[SCREENPLAY TRUNCATED AT CHARACTER LIMIT]"


# ── Code-Side Verdict Derivation ─────────────────────────────────────────────
# The synthesis prompt instructs the model to apply the critical-failure
# penalty, the Story-vs-Situation cap, and the trap downgrades — but nothing
# enforced them, and _compute_weighted_score's pure-sum override silently
# discarded the model's penalty. The model proposes; this code disposes.

VERDICT_TIERS = ["PASS", "CONSIDER", "RECOMMEND", "FILM_NOW"]

# Must match the synthesis prompt (Step 5): MINOR -0.3, MODERATE -0.5,
# MAJOR -0.8, CRITICAL -1.2, total capped at -3.0.
FAILURE_PENALTIES = {"minor": 0.3, "moderate": 0.5, "major": 0.8, "critical": 1.2}
MAX_FAILURE_PENALTY = 3.0

def compute_failure_penalty(critical_failures: Any) -> float:
    """Sum severity penalties from the structured critical_failures list."""
    if not isinstance(critical_failures, list):
        return 0.0
    total = 0.0
    for item in critical_failures:
        if not isinstance(item, dict):
            continue
        severity = str(item.get("severity", "")).lower()
        total += FAILURE_PENALTIES.get(severity, 0.0)
    return round(min(total, MAX_FAILURE_PENALTY), 2)


def _score_to_tier(score: float) -> str:
    """Verdict thresholds (synthesis prompt Step 6)."""
    if score >= 8.5:
        return "FILM_NOW"
    if score >= 7.5:
        return "RECOMMEND"
    if score >= 5.5:
        return "CONSIDER"
    return "PASS"


def _cap_tier(tier: str, cap: str) -> str:
    return cap if VERDICT_TIERS.index(tier) > VERDICT_TIERS.index(cap) else tier


def derive_verdict(
    weighted_score: float,
    critical_failures: Any = None,
    situation_verdict: str = "",
    weighted_trap_score: float = 0.0,
    truncated: bool = False,
) -> Dict[str, Any]:
    """Derive the final verdict in code from the synthesis's structured outputs.

    Order of operations (mirrors the synthesis prompt Steps 4-6):
      1. Subtract critical-failure penalty from the weighted score.
      2. Map adjusted score to a tier.
      3. Story-vs-Situation gate: "situation" caps at CONSIDER.
      4. Trap gate: trap score >= 3.0 caps at CONSIDER; >= 2.0 downgrades one tier.
      5. Truncation gate: never RECOMMEND/FILM_NOW a script whose ending
         the readers did not see — cap at CONSIDER.

    Returns dict with verdict, adjusted_score, penalty, and a human-readable
    adjustments trail for the coverage document.
    """
    adjustments: List[str] = []

    penalty = compute_failure_penalty(critical_failures)
    adjusted = round(max(0.0, weighted_score - penalty), 2)
    if penalty > 0:
        adjustments.append(
            f"critical_failure_penalty: -{penalty} ({weighted_score} → {adjusted})"
        )

    verdict = _score_to_tier(adjusted)
    base_verdict = verdict

    if str(situation_verdict).lower() == "situation":
        capped = _cap_tier(verdict, "CONSIDER")
        if capped != verdict:
            adjustments.append(f"story_vs_situation gate: {verdict} → {capped}")
        verdict = capped

    if weighted_trap_score >= 3.0:
        capped = _cap_tier(verdict, "CONSIDER")
        if capped != verdict:
            adjustments.append(f"trap score {weighted_trap_score} >= 3.0: {verdict} → {capped}")
        verdict = capped
    elif weighted_trap_score >= 2.0:
        idx = VERDICT_TIERS.index(verdict)
        if idx > 0:
            downgraded = VERDICT_TIERS[idx - 1]
            adjustments.append(f"trap score {weighted_trap_score} >= 2.0: {verdict} → {downgraded}")
            verdict = downgraded

    if truncated:
        capped = _cap_tier(verdict, "CONSIDER")
        if capped != verdict:
            adjustments.append(f"truncated script (Act 3 unread): {verdict} → {capped}")
        verdict = capped

    return {
        "verdict": verdict,
        "verdict_before_gates": base_verdict,
        "adjusted_score": adjusted,
        "penalty": penalty,
        "adjustments": adjustments,
    }


# V9: Rigorous reader prompts + tool schemas + few-shot anchors.
# Methodology ported from agent/skills/screenplay-evaluator/references/
# (the aspirational SKILL.md spec), aligned with src/lib/promptClient.v9.ts
# (the rigorous browser-path implementation).
# ─────────────────────────────────────────────────────────────────────────────

# Sub-score schema fragment reused across all reader tool definitions.
# Page citations are optional per sub-score; they're REQUIRED in the prompt for
# scores ≥7 but enforcing that here would reject valid low-score reports.
SUB_SCORE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 10},
        "justification": {"type": "string"},
        "page_citations": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["score", "justification"],
}


def _sub_score_schema_with(extra: Dict[str, Any]) -> Dict[str, Any]:
    """Sub-score schema with reader-specific extra fields (e.g. arc_type)."""
    base = json.loads(json.dumps(SUB_SCORE_SCHEMA))  # deep copy
    base["properties"].update(extra)
    return base


# ─── FEW-SHOT ANCHOR (placeholder; REPLACE WITH ACTUAL LEMON EVALUATIONS) ────
# Shared across all readers. Concrete worked examples calibrate the model's
# score anchors far more reliably than abstract "Parasite=10" language alone.
# These are placeholder anchors built from public knowledge of canonical films.
# When Lemon's senior reader hand-evaluates 2-3 past scripts, drop those in
# here as the real anchors (the system prompts will pick them up
# automatically).
FEW_SHOT_ANCHORS = """\
## CALIBRATION ANCHORS (worked examples — same scale you'll be using)

These three anchors are reference points to keep your scoring consistent
across the script you're about to read.

### Anchor 1 — Parasite (Bong Joon-ho, 2019)
Structure 10 · Character 10 · Craft 10 · Concept 9 · Emotional 10
- The basement reveal (~p.55) is a textbook midpoint reversal: it doesn't add
  to the existing premise, it flips it. Reactive → proactive in one beat.
- The host family's blindness to the Kim family's class is the Lie. The
  climax confronts it through an active choice (the stone, the knife).
- Genre obligation (dark comedy → thriller → tragedy) lands all three
  registers; tonal shifts are intentional, not whiplash.

### Anchor 2 — Get Out (Jordan Peele, 2017)
Structure 9 · Character 9 · Craft 9 · Concept 10 · Emotional 9
- High-concept hook ("meet the parents, but they want your body") is a
  one-sentence pitch with intrinsic narrative engine.
- Active protagonist: Chris drives the investigation. Every escalation is
  caused by his choices, not coincidence.
- Genre obligation (horror): victim at the mercy of monster, repeatedly,
  with credible escalation.

### Anchor 3 — A median produced film
Structure 6 · Character 6 · Craft 6 · Concept 6 · Emotional 6
- Has all the beats but they're functional, not surprising.
- Protagonist is sympathetic but not specific. Lie is generic
  ("can't trust anyone"). Need is clear but doesn't cost anything to fulfill.
- Dialogue is competent. Voices are distinguishable but not distinct.
- You finish reading it. You don't remember it next week.

# REPLACE WITH ACTUAL LEMON EVALUATIONS WHEN YOU HAVE THEM.
"""


# ─── STRUCTURE READER ────────────────────────────────────────────────────────

STRUCTURE_SYSTEM = f"""\
You are a structural analyst evaluating a screenplay's architecture. You draw
from Story Grid (Shawn Coyne), Save the Cat (Blake Snyder), John Truby's 22
steps, and K.M. Weiland's structural percentages.

You are evaluating CRAFT QUALITY ONLY. Not commercial potential. Not cultural
fit. Not whether you personally like the story.

## SCOPE — what this reader DOES NOT score
- Genre obligatory scenes — that's the Concept reader's job.
- Dialogue voice and subtext — that's the Craft reader's job.
- Whether the climax FEELS earned emotionally — that's the Emotional Resonance
  reader's job. You score whether it mechanically delivers the genre's core
  event.
- Character psychology, Want vs Need, arc type — that's the Character reader.

## SCORE ANCHORS
10 = masterpiece structure (Parasite). 9 = exceptional (Get Out). 8 = excellent.
7 = genuinely good. 6 = median produced film. 5 = below average.
4 = needs structural rewrite. 1–3 = amateur.

Score each sub-criterion 1–10 with a one-sentence justification. Cite page
numbers for any score ≥7. Use the `submit_structure_report` tool.

{FEW_SHOT_ANCHORS}
"""

STRUCTURE_USER_INSTRUCTION = """\
Evaluate the structure of the screenplay above using these 13 sub-criteria:

FIRST TEN PAGES (standalone procurement gate):
0. first_ten_pages — Do pages 1–10 establish protagonist, world, and dramatic
   question compellingly? Does the inciting incident land by page 12–15?
   Score: 10 = immediate grip (Parasite, Get Out), 8 = solid engagement,
   6 = functional, 4 = slow/passive, 2 = nothing established yet.
   IMPORTANT: If this scores below 5, add "WEAK OPENING — procurement risk"
   to red_flags.

STORY GRID (Shawn Coyne):
1. beginning_hook — Does Act 1 (first 25%) establish world, character, stakes
   with an inciting incident?
2. middle_build — Does Act 2 (50%) deliver progressively escalating
   complications?
3. ending_payoff — Does Act 3 (25%) MECHANICALLY resolve through the genre's
   core event? (Affective payoff is the Emotional reader's call.)
4. inciting_incident — Clear event that upsets the balance by page 12–15?
5. progressive_complications — Do difficulties escalate? Ascending in severity?
6. crisis_quality — Best Bad Choice or Irreconcilable Goods dilemma?
7. climax_delivery — Active choice by protagonist delivering the genre's core
   event?

SAVE THE CAT (Blake Snyder):
8. beat_timing — Do the 15 beats land within expected page ranges?

WEILAND STRUCTURE (K.M. Weiland):
9. first_plot_point — Point of no return at 20–25%?
10. midpoint — Hero shifts reactive to proactive at 50%?
11. third_act_turning_point — Lie appears to have won completely at 75%?

SCENE ECONOMY:
12. scene_necessity — Does every scene earn its place?

Red-flag conditions to surface in `red_flags`:
- first_ten_pages < 5 → "WEAK OPENING — procurement risk"
- No inciting incident by page 15
- Middle build has no escalation (complications lateral, not ascending)
- Climax doesn't deliver the genre's obligatory core event
- Act 3 is < 15% of the script
- Midpoint doesn't shift protagonist reactive → proactive
- No genuine crisis dilemma (one option obviously better)

Call `submit_structure_report` once with your final scores.
"""

STRUCTURE_TOOL: Dict[str, Any] = {
    "name": "submit_structure_report",
    "description": "Submit the structural analysis report for the screenplay.",
    "input_schema": {
        "type": "object",
        "properties": {
            "reader": {"type": "string", "enum": ["structure"]},
            "pillar_score": {"type": "number", "minimum": 0, "maximum": 10},
            "sub_scores": {
                "type": "object",
                "properties": {
                    "first_ten_pages": SUB_SCORE_SCHEMA,
                    "beginning_hook": SUB_SCORE_SCHEMA,
                    "middle_build": SUB_SCORE_SCHEMA,
                    "ending_payoff": SUB_SCORE_SCHEMA,
                    "inciting_incident": SUB_SCORE_SCHEMA,
                    "progressive_complications": SUB_SCORE_SCHEMA,
                    "crisis_quality": SUB_SCORE_SCHEMA,
                    "climax_delivery": SUB_SCORE_SCHEMA,
                    "beat_timing": SUB_SCORE_SCHEMA,
                    "first_plot_point": SUB_SCORE_SCHEMA,
                    "midpoint": SUB_SCORE_SCHEMA,
                    "third_act_turning_point": SUB_SCORE_SCHEMA,
                    "scene_necessity": SUB_SCORE_SCHEMA,
                },
                "required": [
                    "first_ten_pages", "beginning_hook", "middle_build",
                    "ending_payoff", "inciting_incident", "progressive_complications",
                    "crisis_quality", "climax_delivery", "beat_timing",
                    "first_plot_point", "midpoint", "third_act_turning_point",
                    "scene_necessity",
                ],
            },
            "red_flags": {"type": "array", "items": {"type": "string"}},
            "one_sentence_verdict": {"type": "string"},
        },
        "required": [
            "reader", "pillar_score", "sub_scores", "red_flags",
            "one_sentence_verdict",
        ],
    },
}


# ─── CHARACTER READER ────────────────────────────────────────────────────────

CHARACTER_SYSTEM = f"""\
You are a character psychologist evaluating a screenplay's characters, arcs,
and relationship dynamics. You draw from K.M. Weiland (Creating Character
Arcs), Jeff Lyons (Rapid Story Development), and Enneagram psychology.

You are evaluating CHARACTER PSYCHOLOGY ONLY. Not structure. Not premise.

## SCOPE — what this reader DOES NOT score
- HOW characters speak (voice, subtext, tactic changes) — that's the Craft
  reader. You score WHAT they're driven to say, not how stylish it is.
- Macro-structure (act breaks, midpoint) — Structure reader.
- Genre obligatory scenes — Concept reader.

## SCORE ANCHORS
10 = masterpiece characterization (There Will Be Blood). 9 = exceptional
(Parasite). 8 = excellent. 7 = genuinely good. 6 = median produced film.
5 = below average. 4 = underdeveloped. 1–3 = amateur.

Score each sub-criterion 1–10. Cite page numbers for any score ≥7.

ALSO COMPLETE the Lyons 5-point Story-vs-Situation test (each Yes=1, No=0):
1. Does it reveal something about the human condition?
2. Does it test personal character to reveal deeper motivation?
3. Do plot twists open windows into character (not just raise stakes)?
4. Does it end in a different emotional space than it began?
5. Is it driven by a strong moral component through the middle?

Total 4–5 = Story. 2–3 = Borderline. 0–1 = Situation. If ≤2 this is a HARD
GATE that will cap the script's verdict at CONSIDER regardless of other scores.

Call `submit_character_report` once.

{FEW_SHOT_ANCHORS}
"""

CHARACTER_USER_INSTRUCTION = """\
Evaluate the characters of the screenplay above using these 11 sub-criteria:

KM WEILAND ARC PIPELINE:
1. ghost — Backstory wound. Score 0 if none identifiable.
2. lie — Articulate the protagonist's false belief in ONE sentence.
3. want_vs_need — Do they genuinely conflict? Would getting Want threaten Need?
4. arc_delivery — Is the Lie confronted at the climax through an ACTIVE CHOICE?

JEFF LYONS MORAL COMPONENT:
5. moral_blind_spot — Unconscious core belief that poisons relationships.
6. immoral_effect — Behavior that HURTS OTHER PEOPLE ON THE PAGE.
7. active_vs_passive — ACTIVE (Blind Spot → Immoral Effect → Problem → Choice)
   or PASSIVE (Problem finds them → Reactive Choice).

JEFF LYONS OPPONENT TRIANGLE:
8. opponent_design — Single person? Personal? Targets protagonist's specific
   psychological vulnerabilities?

ENNEAGRAM:
9. enneagram_consistency — Identify likely type. Do behaviors match?

SUPPORTING CAST:
10. supporting_cast_function — Mostly Messengers/Complications, or are there
    Reflection characters (windows into protagonist's moral dilemma)?

STAR APPEAL:
11. star_role_potential — Would a name actor want this part?

Red-flag conditions:
- Passive protagonist (Lyons active/passive test fails)
- No identifiable Lie
- Moral blind spot absent or vague
- Opponent is generic with no psychological mirror
- All supporting cast are Messengers/Complications (no Reflection characters)
- Story-vs-Situation score ≤2 (HARD GATE → caps at CONSIDER)

Call `submit_character_report` once.
"""

CHARACTER_TOOL: Dict[str, Any] = {
    "name": "submit_character_report",
    "description": "Submit the character analysis report.",
    "input_schema": {
        "type": "object",
        "properties": {
            "reader": {"type": "string", "enum": ["character"]},
            "pillar_score": {"type": "number", "minimum": 0, "maximum": 10},
            "sub_scores": {
                "type": "object",
                "properties": {
                    "ghost": SUB_SCORE_SCHEMA,
                    "lie": _sub_score_schema_with({"identified_lie": {"type": "string"}}),
                    "want_vs_need": _sub_score_schema_with({
                        "want": {"type": "string"},
                        "need": {"type": "string"},
                    }),
                    "arc_delivery": _sub_score_schema_with({
                        "arc_type": {
                            "type": "string",
                            "enum": [
                                "positive", "negative_fall", "negative_corruption",
                                "negative_disillusionment", "flat", "absent",
                            ],
                        },
                    }),
                    "moral_blind_spot": _sub_score_schema_with({
                        "identified_blind_spot": {"type": "string"}
                    }),
                    "immoral_effect": SUB_SCORE_SCHEMA,
                    "active_vs_passive": _sub_score_schema_with({
                        "verdict": {"type": "string", "enum": ["active", "passive"]}
                    }),
                    "opponent_design": SUB_SCORE_SCHEMA,
                    "enneagram_consistency": _sub_score_schema_with({
                        "likely_type": {"type": "string"},
                        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    }),
                    "supporting_cast_function": _sub_score_schema_with({
                        "reflection_characters_count": {"type": "integer", "minimum": 0}
                    }),
                    "star_role_potential": SUB_SCORE_SCHEMA,
                },
                "required": [
                    "ghost", "lie", "want_vs_need", "arc_delivery",
                    "moral_blind_spot", "immoral_effect", "active_vs_passive",
                    "opponent_design", "enneagram_consistency",
                    "supporting_cast_function", "star_role_potential",
                ],
            },
            "story_vs_situation": {
                "type": "object",
                "properties": {
                    "human_condition": {"type": "boolean"},
                    "tests_character": {"type": "boolean"},
                    "twists_reveal_character": {"type": "boolean"},
                    "emotional_shift": {"type": "boolean"},
                    "moral_component_driven": {"type": "boolean"},
                    "total": {"type": "integer", "minimum": 0, "maximum": 5},
                    "verdict": {"type": "string", "enum": ["story", "borderline", "situation"]},
                },
                "required": ["total", "verdict"],
            },
            "red_flags": {"type": "array", "items": {"type": "string"}},
            "one_sentence_verdict": {"type": "string"},
        },
        "required": [
            "reader", "pillar_score", "sub_scores", "story_vs_situation",
            "red_flags", "one_sentence_verdict",
        ],
    },
}


# ─── CRAFT & SCENE READER ────────────────────────────────────────────────────

CRAFT_SCENE_SYSTEM = f"""\
You are a scene-level craft analyst evaluating writing quality at the
micro-structural level. You draw from Peter Russell's BMOC (Beginning, Middle,
Obstacle, Climax) methodology, developed through 3,000+ screenplay reads.

You are evaluating SCENE CRAFT ONLY.

## SCOPE — what this reader DOES NOT score
- Macro-structure / act architecture — Structure reader.
- WHAT characters are driven to say — Character reader. You own HOW they say
  it (voice, subtext, tactic changes).
- Genre obligatory scenes — Concept reader.
- Emotional power of scenes — Emotional Resonance reader.

## METHOD
Sample 5 scenes across the script: one from Act 1, two from Act 2 (early and
late), one from Act 3, and the climax scene. Apply the full BMOC analysis to
each, then score globally.

## SCORE ANCHORS
10 = masterpiece scene craft (No Country for Old Men). 9 = exceptional
(Sicario). 8 = excellent. 7 = genuinely good. 6 = median produced film.
5 = below average. 4 = flat scene writing. 1–3 = amateur.

Call `submit_craft_scene_report` once.

{FEW_SHOT_ANCHORS}
"""

CRAFT_SCENE_USER_INSTRUCTION = """\
Evaluate the scene-level craft of the screenplay above using these 9
sub-criteria:

BMOC ARCHITECTURE (Peter Russell):
1. beat_question_clarity — Can you phrase each sampled scene's dramatic
   question as a binary Yes/No?
2. bmoc_architecture — Does each scene have Beginning + Middle + Obstacle +
   Climax?
3. power_shifts — Does control change hands during scenes?
4. suspense_tools — Ticking clocks, good-news/bad-news, escalating stakes
   present and organic?
5. dialogue_tactic_changes — Each volley uses a different tactic, or do
   characters talk AT each other in one register?

PURE CRAFT:
6. dialogue_voice_distinction — Cover the names. Can you still tell who's
   speaking?
7. dialogue_subtext — Saying one thing, meaning another?
8. visual_storytelling — Emotions/revelations through action and image, not
   exposition?
9. exposition_handling — When exposition is required, is it dramatized through
   conflict, broken across scenes, or dumped in monologue? Flag violations.

ALSO scan the 5 sampled scenes for 10 BMOC failure modes; report how many
scenes triggered each:
- mushy_beat_question, passive_antagonist, no_power_shift,
  missing_ticking_clock, stakes_dont_escalate, info_not_choices,
  split_beat_cheat, antagonist_too_weak, no_tactic_changes, random_surprise

If 3+ failure modes fire across the sampled scenes, set
`craft_warning: true` and add a red flag: "Writer lacks scene-level craft."

Call `submit_craft_scene_report` once.
"""

# Failure mode item: {mode, scenes_affected}
FAILURE_MODE_ITEM = {
    "type": "object",
    "properties": {
        "mode": {"type": "string"},
        "scenes_affected": {"type": "integer", "minimum": 0, "maximum": 8},
    },
    "required": ["mode", "scenes_affected"],
}

CRAFT_SCENE_TOOL: Dict[str, Any] = {
    "name": "submit_craft_scene_report",
    "description": "Submit the scene-level craft analysis report.",
    "input_schema": {
        "type": "object",
        "properties": {
            "reader": {"type": "string", "enum": ["craft_scene"]},
            "pillar_score": {"type": "number", "minimum": 0, "maximum": 10},
            "sub_scores": {
                "type": "object",
                "properties": {
                    "beat_question_clarity": SUB_SCORE_SCHEMA,
                    "bmoc_architecture": SUB_SCORE_SCHEMA,
                    "power_shifts": SUB_SCORE_SCHEMA,
                    "suspense_tools": SUB_SCORE_SCHEMA,
                    "dialogue_tactic_changes": SUB_SCORE_SCHEMA,
                    "dialogue_voice_distinction": SUB_SCORE_SCHEMA,
                    "dialogue_subtext": SUB_SCORE_SCHEMA,
                    "visual_storytelling": SUB_SCORE_SCHEMA,
                    "exposition_handling": SUB_SCORE_SCHEMA,
                },
                "required": [
                    "beat_question_clarity", "bmoc_architecture", "power_shifts",
                    "suspense_tools", "dialogue_tactic_changes",
                    "dialogue_voice_distinction", "dialogue_subtext",
                    "visual_storytelling", "exposition_handling",
                ],
            },
            "bmoc_failure_scan": {
                "type": "object",
                "properties": {
                    "scenes_sampled": {"type": "integer"},
                    "failure_modes_triggered": {
                        "type": "array",
                        "items": FAILURE_MODE_ITEM,
                    },
                    "total_failure_modes_active": {"type": "integer"},
                    "craft_warning": {"type": "boolean"},
                },
                "required": ["scenes_sampled", "failure_modes_triggered", "craft_warning"],
            },
            "red_flags": {"type": "array", "items": {"type": "string"}},
            "one_sentence_verdict": {"type": "string"},
        },
        "required": [
            "reader", "pillar_score", "sub_scores", "bmoc_failure_scan",
            "red_flags", "one_sentence_verdict",
        ],
    },
}


# ─── CONCEPT READER ──────────────────────────────────────────────────────────

CONCEPT_SYSTEM = f"""\
You are a concept analyst evaluating whether a screenplay's underlying idea is
worth making. You draw from Save the Cat (Blake Snyder's genre system), John
Truby (premise, designing principle), Jeff Lyons (story vs situation test,
4-clause premise line), and Story Grid (controlling idea, genre obligations).

You are evaluating THE IDEA, not the execution. A brilliant concept with
mediocre execution scores HIGH here. A mediocre concept with brilliant
execution scores LOW here.

## SCOPE — what this reader DOES NOT score
- Macro-structure / act timing — Structure reader.
- Character psychology — Character reader.
- Scene-level craft — Craft reader.
- Emotional impact — Emotional Resonance reader.
- This reader OWNS genre execution and obligatory scenes; Structure does NOT
  score them.

## SCORE ANCHORS
10 = masterpiece concept (The Matrix premise). 9 = exceptional (Get Out).
8 = excellent. 7 = genuinely good. 6 = median produced film. 5 = below
average. 4 = derivative. 1–3 = no concept.

Call `submit_concept_report` once.

{FEW_SHOT_ANCHORS}
"""

CONCEPT_USER_INSTRUCTION = """\
Evaluate the concept of the screenplay above using these 8 sub-criteria:

PREMISE POWER:
1. hook_clarity — Pitch in ONE compelling sentence. "I'd watch that"?
2. narrative_engine — Does the concept intrinsically generate conflict?
3. freshness — "Same but different"? Fresh take or retread?

GENRE (Story Grid):
4. genre_execution — Use the "STORY GRID — GENRE OBLIGATIONS FOR THIS SCRIPT"
   block above. Name which obligatory scenes are PRESENT (cite page) and which
   are MISSING. A missing Core Event is a red flag. For a comedy, BOTH the
   comedy set pieces AND the paired genre's obligatory scenes must be present.
5. genre_promise_delivery — Does the script deliver the emotional experience
   the genre promises (for comedy: the laughs AND the paired genre's payoff)?

THEME (Story Grid):
6. controlling_idea — State the argument about life in ONE sentence.
7. thematic_resonance — Does this say something true about the human
   condition? Arguable claim, not greeting-card sentiment.

PREMISE LINE (Lyons 4-clause):
8. premise_line — Write the 4-clause premise: Protagonist + Team/Goal +
   Opposition + Denouement (including emotional change). If you can't write
   Clause 4 with emotional change, the script probably doesn't have real
   character change.

Red-flag conditions:
- Can't pitch in one sentence (no hook)
- Genre confusion (marketed as one genre, executes as another)
- No identifiable audience
- Can't write Clause 4 with emotional change
- Controlling idea is a sentiment, not an arguable claim

Call `submit_concept_report` once.
"""

CONCEPT_TOOL: Dict[str, Any] = {
    "name": "submit_concept_report",
    "description": "Submit the concept and premise analysis report.",
    "input_schema": {
        "type": "object",
        "properties": {
            "reader": {"type": "string", "enum": ["concept"]},
            "pillar_score": {"type": "number", "minimum": 0, "maximum": 10},
            "sub_scores": {
                "type": "object",
                "properties": {
                    "hook_clarity": _sub_score_schema_with({
                        "one_sentence_pitch": {"type": "string"}
                    }),
                    "narrative_engine": SUB_SCORE_SCHEMA,
                    "freshness": SUB_SCORE_SCHEMA,
                    "genre_execution": _sub_score_schema_with({
                        "genre": {"type": "string"},
                        "obligatory_scenes_present": {"type": "array", "items": {"type": "string"}},
                        "obligatory_scenes_missing": {"type": "array", "items": {"type": "string"}},
                    }),
                    "genre_promise_delivery": SUB_SCORE_SCHEMA,
                    "controlling_idea": _sub_score_schema_with({
                        "stated_controlling_idea": {"type": "string"}
                    }),
                    "thematic_resonance": SUB_SCORE_SCHEMA,
                    "premise_line": _sub_score_schema_with({
                        "four_clause_premise": {"type": "string"}
                    }),
                },
                "required": [
                    "hook_clarity", "narrative_engine", "freshness",
                    "genre_execution", "genre_promise_delivery",
                    "controlling_idea", "thematic_resonance", "premise_line",
                ],
            },
            "red_flags": {"type": "array", "items": {"type": "string"}},
            "one_sentence_verdict": {"type": "string"},
        },
        "required": [
            "reader", "pillar_score", "sub_scores", "red_flags",
            "one_sentence_verdict",
        ],
    },
}


# ─── EMOTIONAL RESONANCE READER ──────────────────────────────────────────────

EMOTIONAL_RESONANCE_SYSTEM = f"""\
You are an emotional impact analyst evaluating whether a screenplay makes the
reader FEEL something. You draw from Peter Russell's BMOC (scene-level
emotional turns), K.M. Weiland (thematic truth), Jeff Lyons (catharsis via
moral component resolution), and Story Grid (value progressions).

You are evaluating EMOTIONAL POWER. A structurally imperfect script that
makes you cry scores HIGH here. A technically perfect script that leaves you
cold scores LOW.

## SCOPE — what this reader DOES NOT score
- Macro-structure — Structure reader (you both touch "ending payoff": Structure
  scores whether the climax mechanically delivers the genre's core event; YOU
  score whether the catharsis lands).
- Character psychology — Character reader.
- Scene-level craft — Craft reader.
- Concept / premise / genre — Concept reader.

## SCORE ANCHORS
10 = devastating emotional impact (Schindler's List). 9 = exceptional
(Moonlight). 8 = excellent. 7 = genuinely good. 6 = median produced film.
5 = below average. 4 = emotionally flat. 1–3 = no emotional engagement.

Call `submit_emotional_resonance_report` once.

{FEW_SHOT_ANCHORS}
"""

EMOTIONAL_RESONANCE_USER_INSTRUCTION = """\
Evaluate the emotional resonance of the screenplay above using these 7
sub-criteria:

EMOTIONAL ARCHITECTURE:
1. emotional_clarity — Can you name what the audience is supposed to feel at
   each major beat?
2. empathy_investment — By page 15, do you care what happens?
3. emotional_escalation — Do emotional stakes rise through the middle?
   Personal, painful, desperate?

CATHARSIS:
4. catharsis_quality — Does the ending deliver emotional satisfaction?
5. truth — Does it feel TRUE about life? Arguable truth, not greeting-card.

PEAK MOMENTS:
6. goosebumps_moments — Are there 2–3 scenes you'd describe to someone?
   Identify them with page + reason in `goosebumps_scenes`.

VALUE DYNAMICS:
7. value_turn_range — Story Grid: do scenes shift values (Life→Death,
   Love→Hate, Justice→Tyranny, Success→Selling Out)? Wider range = more power.

Red-flag conditions:
- No goosebumps moments (nothing memorable)
- Ending doesn't shift emotional register
- Script reads as intellectual exercise (cold, well-constructed)
- No empathy investment by page 15
- Value spectrum is narrow

Call `submit_emotional_resonance_report` once.
"""

GOOSEBUMP_ITEM = {
    "type": "object",
    "properties": {
        "page": {"type": "integer"},
        "description": {"type": "string"},
        "why_it_works": {"type": "string"},
    },
    "required": ["description", "why_it_works"],
}

EMOTIONAL_RESONANCE_TOOL: Dict[str, Any] = {
    "name": "submit_emotional_resonance_report",
    "description": "Submit the emotional resonance analysis report.",
    "input_schema": {
        "type": "object",
        "properties": {
            "reader": {"type": "string", "enum": ["emotional_resonance"]},
            "pillar_score": {"type": "number", "minimum": 0, "maximum": 10},
            "sub_scores": {
                "type": "object",
                "properties": {
                    "emotional_clarity": SUB_SCORE_SCHEMA,
                    "empathy_investment": SUB_SCORE_SCHEMA,
                    "emotional_escalation": SUB_SCORE_SCHEMA,
                    "catharsis_quality": SUB_SCORE_SCHEMA,
                    "truth": SUB_SCORE_SCHEMA,
                    "goosebumps_moments": _sub_score_schema_with({
                        "moments": {"type": "array", "items": {"type": "string"}}
                    }),
                    "value_turn_range": _sub_score_schema_with({
                        "value_spectrum": {"type": "string"}
                    }),
                },
                "required": [
                    "emotional_clarity", "empathy_investment",
                    "emotional_escalation", "catharsis_quality", "truth",
                    "goosebumps_moments", "value_turn_range",
                ],
            },
            "goosebumps_scenes": {"type": "array", "items": GOOSEBUMP_ITEM},
            "red_flags": {"type": "array", "items": {"type": "string"}},
            "one_sentence_verdict": {"type": "string"},
        },
        "required": [
            "reader", "pillar_score", "sub_scores", "goosebumps_scenes",
            "red_flags", "one_sentence_verdict",
        ],
    },
}


# ─── Reader registry ─────────────────────────────────────────────────────────

READER_TOOLS: Dict[str, Dict[str, Any]] = {
    "structure": STRUCTURE_TOOL,
    "character": CHARACTER_TOOL,
    "craft_scene": CRAFT_SCENE_TOOL,
    "concept": CONCEPT_TOOL,
    "emotional_resonance": EMOTIONAL_RESONANCE_TOOL,
}

READER_SYSTEM_PROMPTS: Dict[str, str] = {
    "structure": STRUCTURE_SYSTEM,
    "character": CHARACTER_SYSTEM,
    "craft_scene": CRAFT_SCENE_SYSTEM,
    "concept": CONCEPT_SYSTEM,
    "emotional_resonance": EMOTIONAL_RESONANCE_SYSTEM,
}

READER_USER_INSTRUCTIONS: Dict[str, str] = {
    "structure": STRUCTURE_USER_INSTRUCTION,
    "character": CHARACTER_USER_INSTRUCTION,
    "craft_scene": CRAFT_SCENE_USER_INSTRUCTION,
    "concept": CONCEPT_USER_INSTRUCTION,
    "emotional_resonance": EMOTIONAL_RESONANCE_USER_INSTRUCTION,
}


def _reader_system_blocks(reader: str) -> List[Dict[str, Any]]:
    """Build cacheable system content blocks for a reader."""
    return [
        {
            "type": "text",
            "text": READER_SYSTEM_PROMPTS[reader],
            "cache_control": {"type": "ephemeral"},
        }
    ]


# Readers that benefit from the genre card. Concept owns obligatory-scene
# scoring; Structure checks their act placement; Craft/Emotion apply comedy
# craft rules (set pieces, escalation, laughter-as-payload) when relevant.
_GENRE_AWARE_READERS = {"structure", "concept", "craft_scene", "emotional_resonance"}


def _reader_user_blocks(
    reader: str,
    screenplay_block: Dict[str, Any],
    title: str,
    page_count: int,
    genre_card: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Build user content blocks: cached screenplay + optional genre card +
    reader-specific instruction."""
    blocks: List[Dict[str, Any]] = [screenplay_block]  # cached, shared

    if genre_card and reader in _GENRE_AWARE_READERS:
        # Cached so it's written once and read cheaply by every genre-aware
        # reader within the cache TTL.
        blocks.append({
            "type": "text",
            "text": genre_card,
            "cache_control": {"type": "ephemeral"},
        })

    blocks.append({
        "type": "text",
        "text": (
            f"# METADATA\nTitle: {title}\nPages: {page_count}\n\n"
            f"# YOUR TASK\n{READER_USER_INSTRUCTIONS[reader]}"
        ),
    })
    return blocks


def run_genre_detection(
    screenplay_block: Dict[str, Any],
    proxy_url: Optional[str],
) -> Dict[str, Any]:
    """Cheap Haiku pass that classifies the script into the Five-Leaf Clover.
    Returns a normalised detection dict (never raises — falls back to a
    low-confidence Society/drama read so the pipeline always proceeds)."""
    try:
        _tool_input, text, _usage = call_llm(
            system_blocks=[{
                "type": "text",
                "text": "You are a Story Grid genre analyst. Classify precisely.",
            }],
            user_blocks=[
                screenplay_block,
                {"type": "text", "text": build_genre_detection_prompt()},
            ],
            model_key="haiku",
            max_tokens=400,
            proxy_url=proxy_url,
        )
        raw = extract_json(text)
        return parse_detection(raw)
    except Exception as e:
        log.warning(f"    Genre detection failed ({e}); defaulting to Society/drama.")
        return parse_detection({"external_genre": "Society", "confidence": "low"})


# ─── SYNTHESIS ───────────────────────────────────────────────────────────────

SYNTHESIS_SYSTEM = f"""\
You are the senior reader leading the roundtable. Five independent readers
have evaluated this screenplay. Your job is to synthesise their reports into
a single consensus verdict.

You are NOT adding new analysis. You are: resolving disagreements, applying
quality gates, computing the final score, and writing the executive summary.

## SYNTHESIS PROCESS

### Step 1: Agreement check
For each pillar score, check internal consistency with sub-scores. Flag and
recalculate if any pillar score doesn't match its sub-score average.

### Step 2: Disagreement resolution
When readers diverge ≥2 points on the same dimension, document the
disagreement and your resolution.

### Step 3: Story-vs-Situation gate (HARD CAP)
Read the Character reader's `story_vs_situation.verdict`:
- "situation" (total ≤2): **cap final verdict at CONSIDER** regardless of
  other scores. Set `story_vs_situation.gate_applied: true`.
- "borderline" (total 2–3): flag in executive_summary but do not cap.
- "story" (total 4–5): no gate applied.

### Step 4: 11 false-positive traps
Evaluate each trap using cross-reader data:

FUNDAMENTAL (weight 1.0):
1. character_vacuum — Character.star_role_potential<5 AND supporting_cast<5
2. complexity_theater — Structure.scene_necessity<5 AND progressive_complications<5
3. genre_confusion — Concept.genre_execution<5 AND genre_promise_delivery<5
4. ending_mirage — Structure.ending_payoff≥7 AND Emotional.catharsis_quality<5

ADDRESSABLE (weight 0.5):
5. premise_execution_gap — Concept.pillar − avg(Structure, Craft) ≥ 2.0
6. first_act_illusion — Structure.beginning_hook≥7 AND (middle_build<5 OR ending_payoff<5)
7. originality_inflation — Concept.freshness≥7 AND Craft.pillar<5
8. dialogue_disguise — Craft.dialogue_voice_distinction≥7 AND Structure.progressive_complications<5
9. tonal_whiplash — Emotional.emotional_clarity<5 AND Craft.exposition_handling≥6
10. sympathy_substitution — Emotional.empathy_investment≥7 AND Character.arc_delivery<5

WARNING (weight 0.0; informational only):
11. second_lead_syndrome — Character.supporting_cast_function≥7 AND star_role_potential<5

Sum weights of triggered traps:
- ≥2.0 → downgrade verdict ONE TIER (record `verdict_adjustment: "downgrade_one"`)
- ≥3.0 → cap verdict at CONSIDER (record `verdict_adjustment: "cap_consider"`)

### Step 5: Final weighted score
final_score = (structure × 0.30) + (character × 0.30) + (craft_scene × 0.15)
            + (concept × 0.15) + (emotional_resonance × 0.10)

Apply critical_failure_penalty (sum of severities, capped at -3.0):
MINOR=-0.3, MODERATE=-0.5, MAJOR=-0.8, CRITICAL=-1.2.

### Step 6: Verdict
PASS <5.5, CONSIDER 5.5–7.4, RECOMMEND 7.5–8.4, FILM NOW ≥8.5.
Apply Story-vs-Situation gate, then trap adjustment, then save final verdict.

### Step 7: Executive summary
ONE paragraph (4–6 sentences):
- What this script IS (genre, concept, world)
- What earned its verdict (strongest pillar)
- What holds it back (weakest pillar or critical red flag)
- Whether to go forward

NO development notes. NO prescriptions. This is a reader's report.

### Step 8: Comparable films
Three comps — tone, structure, market. Recognizable. Any era.

## CANONICAL OUTPUT
You will call `submit_synthesis_report` with:
- The reader pillar scores carried forward UNCHANGED. Do NOT invent your own
  parallel dimension scores. The pillar scores ARE the canonical truth.
- All 9 trap entries (triggered + not), with evidence strings.
- Story-vs-Situation block carried from Character reader, plus `gate_applied`.
- Both `verdict_before_adjustments` and final `verdict`.
- Reader disagreement log (only conflicts that diverged ≥2 points).
"""

SYNTHESIS_TOOL: Dict[str, Any] = {
    "name": "submit_synthesis_report",
    "description": "Submit the synthesised final analysis of the screenplay.",
    "input_schema": {
        "type": "object",
        "properties": {
            "analysis_version": {"type": "string", "enum": ["v9_archaeology"]},
            "title": {"type": "string"},
            "author": {"type": "string"},
            "genre": {"type": "string"},
            "subgenres": {"type": "array", "items": {"type": "string"}},
            "themes": {"type": "array", "items": {"type": "string"}},
            "tone": {"type": "string"},
            "logline": {"type": "string"},

            "pillar_scores": {
                "type": "object",
                "properties": {
                    "structure": {
                        "type": "object",
                        "properties": {
                            "score": {"type": "number"},
                            "weight": {"type": "number", "enum": [0.30]},
                        },
                        "required": ["score", "weight"],
                    },
                    "character": {
                        "type": "object",
                        "properties": {
                            "score": {"type": "number"},
                            "weight": {"type": "number", "enum": [0.30]},
                        },
                        "required": ["score", "weight"],
                    },
                    "craft_scene": {
                        "type": "object",
                        "properties": {
                            "score": {"type": "number"},
                            "weight": {"type": "number", "enum": [0.15]},
                        },
                        "required": ["score", "weight"],
                    },
                    "concept": {
                        "type": "object",
                        "properties": {
                            "score": {"type": "number"},
                            "weight": {"type": "number", "enum": [0.15]},
                        },
                        "required": ["score", "weight"],
                    },
                    "emotional_resonance": {
                        "type": "object",
                        "properties": {
                            "score": {"type": "number"},
                            "weight": {"type": "number", "enum": [0.10]},
                        },
                        "required": ["score", "weight"],
                    },
                },
                "required": ["structure", "character", "craft_scene", "concept", "emotional_resonance"],
            },

            "weighted_score": {"type": "number", "minimum": 0, "maximum": 10},

            "story_vs_situation": {
                "type": "object",
                "properties": {
                    "score": {"type": "integer", "minimum": 0, "maximum": 5},
                    "verdict": {"type": "string", "enum": ["story", "borderline", "situation"]},
                    "gate_applied": {"type": "boolean"},
                },
                "required": ["score", "verdict", "gate_applied"],
            },

            "false_positive_check": {
                "type": "object",
                "properties": {
                    "traps_evaluated": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "triggered": {"type": "boolean"},
                                "tier": {"type": "string", "enum": ["fundamental", "addressable", "warning"]},
                                "weight": {"type": "number"},
                                "evidence": {"type": "string"},
                            },
                            "required": ["name", "triggered", "tier", "weight", "evidence"],
                        },
                    },
                    "weighted_trap_score": {"type": "number"},
                    "verdict_adjustment": {
                        "type": "string",
                        "enum": ["none", "downgrade_one", "cap_consider"],
                    },
                },
                "required": ["traps_evaluated", "weighted_trap_score", "verdict_adjustment"],
            },

            "critical_failures": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "severity": {"type": "string", "enum": ["minor", "moderate", "major", "critical"]},
                        "penalty": {"type": "number"},
                    },
                    "required": ["description", "severity", "penalty"],
                },
            },
            "critical_failure_total_penalty": {"type": "number"},

            "verdict": {"type": "string", "enum": ["PASS", "CONSIDER", "RECOMMEND", "FILM_NOW"]},
            "verdict_before_adjustments": {"type": "string", "enum": ["PASS", "CONSIDER", "RECOMMEND", "FILM_NOW"]},

            "strengths": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 4,
                "description": "Minimum 4 specific, evidence-based strengths. NEVER empty.",
            },
            "weaknesses": {
                "type": "array",
                "items": {"type": "string"},
            },
            "development_notes": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional notes on how to develop this script further.",
            },
            "deliberate_ambiguities": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "structural_impact": {"type": "string"},
                        "franchise_potential": {"type": "string"},
                    },
                    "required": ["description"],
                },
                "description": "Open endings, unresolved mysteries, or sequel hooks.",
            },
            "executive_summary": {"type": "string"},

            "comparable_films": {
                "type": "object",
                "properties": {
                    "tone": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "similarity": {"type": "string"},
                        },
                        "required": ["title", "similarity"],
                    },
                    "structure": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "similarity": {"type": "string"},
                        },
                        "required": ["title", "similarity"],
                    },
                    "market": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "similarity": {"type": "string"},
                        },
                        "required": ["title", "similarity"],
                    },
                },
                "required": ["tone", "structure", "market"],
            },

            "characters": {
                "type": "object",
                "properties": {
                    "protagonist": {"type": "string"},
                    "protagonist_lie": {"type": "string"},
                    "protagonist_arc_type": {"type": "string"},
                    "antagonist": {"type": "string"},
                    "supporting": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["protagonist", "antagonist", "supporting"],
            },

            "reader_disagreements": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "topic": {"type": "string"},
                        "reader_a": {"type": "string"},
                        "reader_a_position": {"type": "string"},
                        "reader_b": {"type": "string"},
                        "reader_b_position": {"type": "string"},
                        "resolution": {"type": "string"},
                    },
                    "required": ["topic", "reader_a", "reader_b", "resolution"],
                },
            },

            "goosebumps_moments": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "page": {"type": "integer"},
                        "description": {"type": "string"},
                        "why_it_works": {"type": "string"},
                    },
                    "required": ["description", "why_it_works"],
                },
            },
        },
        "required": [
            "analysis_version", "title", "logline",
            "pillar_scores", "weighted_score",
            "story_vs_situation", "false_positive_check",
            "verdict", "verdict_before_adjustments",
            "executive_summary", "comparable_films",
        ],
    },
}


def _synthesis_system_blocks() -> List[Dict[str, Any]]:
    """Cached system blocks for synthesis."""
    return [
        {
            "type": "text",
            "text": SYNTHESIS_SYSTEM,
            "cache_control": {"type": "ephemeral"},
        }
    ]


def _synthesis_user_blocks(
    title: str,
    reader_reports: Dict[str, Any],
    triage_impression: Optional[Dict[str, Any]] = None,
    genre_detection: Optional[Dict[str, Any]] = None,
    calibration_prompt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Synthesis user blocks. Reader reports change per script — NOT cached.

    triage_impression, when provided, is injected as a Haiku cold-read data
    point before the 5 reader reports (mirrors TypeScript triageBlock logic
    in promptClient.v9.ts buildSynthesisPrompt).

    genre_detection, when provided, tells synthesis the Story Grid genre the
    readers evaluated against — so the output's genre/subgenres fields are
    consistent with the obligatory-scene analysis rather than re-guessed.
    """
    reports_json = json.dumps(reader_reports, indent=2)

    genre_block = ""
    if genre_detection:
        gd = genre_detection
        label = gd.get("external_genre", "?")
        if gd.get("is_comedy"):
            label = f"Comedy + {gd.get('comedy_paired_genre')}"
            if gd.get("comedy_subgenre"):
                label += f" ({gd['comedy_subgenre']})"
        genre_block = (
            f"# STORY GRID GENRE (readers evaluated obligatory scenes against this)\n"
            f"External: {label} | Internal: {gd.get('internal_genre') or '?'} "
            f"(confidence {gd.get('confidence')})\n"
            f"Use this for the genre/subgenres fields. If a reader's evidence "
            f"strongly contradicts it, note it in reader_disagreements.\n\n"
        )

    triage_block = ""
    if triage_impression:
        ts = triage_impression.get("triage_score", "?")
        verdict = triage_impression.get("verdict", "?")
        genre = triage_impression.get("genre", "?")
        logline = triage_impression.get("logline", "?")
        triage_block = (
            f"# TRIAGE IMPRESSION (Haiku cold-read, ~60s, before your 5 readers)\n"
            f"Score: {ts}/10 | Verdict: {verdict}\n"
            f"Genre read: {genre}\n"
            f"Logline attempt: {logline}\n\n"
            f"Use as a 'street-level reader' data point. If triage disagrees with "
            f"your 5 readers by 3+ points, note in reader_disagreements.\n\n"
        )

    calibration_block = ""
    if calibration_prompt and calibration_prompt.strip():
        calibration_block = (
            "# PRODUCER CALIBRATION\n"
            f"{calibration_prompt.strip()}\n\n"
            "Apply these biases to the synthesis without overriding the V9 "
            "methodology, evidence requirements, or code-enforced verdict gates.\n\n"
        )

    return [
        {
            "type": "text",
            "text": (
                f"# TITLE\n{title}\n\n"
                f"{genre_block}"
                f"{triage_block}"
                f"{calibration_block}"
                f"# READER REPORTS\n```json\n{reports_json}\n```\n\n"
                f"# YOUR TASK\nSynthesise these reports into a final verdict.\n"
                f"Call `submit_synthesis_report` exactly once.\n"
                f"The reader pillar scores are CANONICAL — carry them through to "
                f"pillar_scores unchanged. Do NOT invent your own dimension scores."
            ),
        }
    ]


# ─── Legacy compatibility shims (used by run_v9_triage and ingest helpers) ──

def _reader_system_prompts() -> Dict[str, str]:
    """Legacy accessor — returns the bare system prompt strings.
    Use _reader_system_blocks() in new code for cacheable blocks."""
    return {
        "structure": (
            "You are a structural analyst evaluating a screenplay's architecture. "
            "You draw from Story Grid (Shawn Coyne), Save the Cat (Blake Snyder), "
            "John Truby's 22 steps, and K.M. Weiland's structural percentages.\n\n"
            "You are evaluating CRAFT QUALITY ONLY. Not commercial potential. "
            "Not cultural fit. Not whether you personally like the story.\n\n"
            "Score anchors: 10=masterpiece (Parasite), 9=exceptional (Get Out), "
            "8=excellent, 7=genuinely good, 6=median produced film, "
            "5=below average, 4=needs structural rewrite, 1–3=amateur.\n\n"
            "Score each sub-criterion 1–10 with a one-sentence justification. "
            "Cite page numbers for any score >= 7."
        ),
        "character": (
            "You are a character analyst evaluating how the screenplay develops "
            "its characters using the Michael Hauge desire/need arc, the McKee "
            "change arc, and the Melanie Anne Phillips motivation-reaction unit.\n\n"
            "You are evaluating CRAFT QUALITY ONLY.\n\n"
            "Score anchors: 10=masterpiece (There Will Be Blood), 9=exceptional, "
            "8=excellent, 7=genuinely good, 6=median, 5=below average, "
            "4=needs character rewrite, 1–3=flat/undeveloped.\n\n"
            "Cite specific scenes or page numbers where possible."
        ),
        "craft_scene": (
            "You are a scene-level craft analyst evaluating dialogue, description, "
            "and scene construction. You draw from David Mamet's rules of drama, "
            "William Goldman's scene-building, and Lajos Egri's bone structure.\n\n"
            "You are evaluating CRAFT QUALITY ONLY.\n\n"
            "Score anchors: 10=masterpiece-level prose, 9=exceptional, "
            "8=excellent, 7=genuinely good, 6=median produced script, "
            "5=below average, 4=needs rewrite, 1–3=amateur."
        ),
        "concept": (
            "You are a concept and premise analyst. You evaluate the originality, "
            "clarity, and execution potential of the screenplay's core idea. "
            "You draw from Blake Snyder's logline analysis and Brian McDonald's "
            "'spine of the story' approach.\n\n"
            "You are evaluating CRAFT QUALITY ONLY — not market trends.\n\n"
            "Score anchors: 10=all-time high concept (The Matrix), 9=exceptional, "
            "8=excellent, 7=genuinely good, 6=median, 5=below average, "
            "4=concept needs development, 1–3=vague/confused."
        ),
        "emotional_resonance": (
            "You are an emotional resonance analyst evaluating whether this "
            "screenplay creates genuine emotional investment in its audience. "
            "You draw from Jonathan Gottschall's storytelling science, "
            "Lisa Cron's 'Story' framework, and Pixar's empathy-first approach.\n\n"
            "You are evaluating CRAFT QUALITY ONLY.\n\n"
            "Score anchors: 10=devastatingly resonant (Schindler's List), "
            "9=exceptional, 8=excellent, 7=genuinely moving, "
            "6=median, 5=below average, 4=emotionally flat, 1–3=no connection."
        ),
    }


def _reader_user_prompt(reader: str, text: str, title: str, page_count: int) -> str:
    """Return the user-turn prompt for a given reader."""
    reader_focus = {
        "structure": (
            "Analyze this screenplay's STRUCTURE.\n\n"
            "Return ONLY this JSON:\n"
            "{\n"
            '  "reader": "structure",\n'
            '  "overall_score": 0,\n'
            '  "justification": "",\n'
            '  "sub_scores": {\n'
            '    "opening_hook": {"score": 0, "note": ""},\n'
            '    "act_breaks": {"score": 0, "note": ""},\n'
            '    "midpoint": {"score": 0, "note": ""},\n'
            '    "escalation": {"score": 0, "note": ""},\n'
            '    "climax_resolution": {"score": 0, "note": ""}\n'
            "  },\n"
            '  "strengths": [],\n'
            '  "weaknesses": [],\n'
            '  "critical_issues": []\n'
            "}"
        ),
        "character": (
            "Analyze this screenplay's CHARACTERS.\n\n"
            "Return ONLY this JSON:\n"
            "{\n"
            '  "reader": "character",\n'
            '  "overall_score": 0,\n'
            '  "justification": "",\n'
            '  "sub_scores": {\n'
            '    "protagonist_arc": {"score": 0, "note": ""},\n'
            '    "motivation_clarity": {"score": 0, "note": ""},\n'
            '    "supporting_cast": {"score": 0, "note": ""},\n'
            '    "antagonist": {"score": 0, "note": ""},\n'
            '    "dialogue_voice": {"score": 0, "note": ""}\n'
            "  },\n"
            '  "strengths": [],\n'
            '  "weaknesses": [],\n'
            '  "critical_issues": []\n'
            "}"
        ),
        "craft_scene": (
            "Analyze this screenplay's SCENE-LEVEL CRAFT and DIALOGUE.\n\n"
            "Return ONLY this JSON:\n"
            "{\n"
            '  "reader": "craft_scene",\n'
            '  "overall_score": 0,\n'
            '  "justification": "",\n'
            '  "sub_scores": {\n'
            '    "dialogue_quality": {"score": 0, "note": ""},\n'
            '    "scene_economy": {"score": 0, "note": ""},\n'
            '    "description_clarity": {"score": 0, "note": ""},\n'
            '    "subtext": {"score": 0, "note": ""},\n'
            '    "pacing": {"score": 0, "note": ""}\n'
            "  },\n"
            '  "strengths": [],\n'
            '  "weaknesses": [],\n'
            '  "critical_issues": []\n'
            "}"
        ),
        "concept": (
            "Analyze this screenplay's CONCEPT and PREMISE.\n\n"
            "Return ONLY this JSON:\n"
            "{\n"
            '  "reader": "concept",\n'
            '  "overall_score": 0,\n'
            '  "justification": "",\n'
            '  "sub_scores": {\n'
            '    "originality": {"score": 0, "note": ""},\n'
            '    "premise_clarity": {"score": 0, "note": ""},\n'
            '    "thematic_depth": {"score": 0, "note": ""},\n'
            '    "genre_fit": {"score": 0, "note": ""},\n'
            '    "concept_execution": {"score": 0, "note": ""}\n'
            "  },\n"
            '  "strengths": [],\n'
            '  "weaknesses": [],\n'
            '  "critical_issues": []\n'
            "}"
        ),
        "emotional_resonance": (
            "Analyze this screenplay's EMOTIONAL RESONANCE.\n\n"
            "Return ONLY this JSON:\n"
            "{\n"
            '  "reader": "emotional_resonance",\n'
            '  "overall_score": 0,\n'
            '  "justification": "",\n'
            '  "sub_scores": {\n'
            '    "empathy": {"score": 0, "note": ""},\n'
            '    "stakes": {"score": 0, "note": ""},\n'
            '    "catharsis": {"score": 0, "note": ""},\n'
            '    "tonal_consistency": {"score": 0, "note": ""},\n'
            '    "emotional_truth": {"score": 0, "note": ""}\n'
            "  },\n"
            '  "strengths": [],\n'
            '  "weaknesses": [],\n'
            '  "critical_issues": []\n'
            "}"
        ),
    }

    return (
        f"Title: {title}\n"
        f"Pages: {page_count}\n\n"
        f"SCREENPLAY TEXT:\n{text}\n\n"
        + reader_focus[reader]
        + "\n\nReturn ONLY valid JSON. No markdown. No explanation."
    )


def _synthesis_system_prompt() -> str:
    return (
        "You are the Senior Reader at a production company. "
        "Five specialist readers have each evaluated a screenplay independently. "
        "Your job is to synthesise their reports into a single consensus verdict.\n\n"
        "Weights: Structure=40%, Character=25%, Craft=15%, Concept=10%, Emotion=10%.\n\n"
        "Verdicts:\n"
        "  film_now   — 8.5+: Production-ready. Exceptional. Acquire immediately.\n"
        "  recommend  — 7.0–8.4: Strong work. Worth acquiring or developing.\n"
        "  consider   — 5.5–6.9: Has merit but needs significant work.\n"
        "  pass       — <5.5: Not suitable for our slate.\n\n"
        "Be honest and direct. The studio depends on your accuracy."
    )


def _synthesis_user_prompt(title: str, reader_reports: Dict[str, Any]) -> str:
    reports_json = json.dumps(reader_reports, indent=2)
    return (
        f"Title: {title}\n\n"
        f"READER REPORTS:\n{reports_json}\n\n"
        "Synthesise these reports into a final verdict.\n\n"
        "Return ONLY this JSON:\n"
        "{\n"
        '  "title": "",\n'
        '  "logline": "",\n'
        '  "genre": "",\n'
        '  "author": "",\n'
        '  "executive_summary": "",\n'
        '  "weighted_score": 0.0,\n'
        '  "verdict": "pass|consider|recommend|film_now",\n'
        '  "is_film_now": false,\n'
        '  "budget_tier": "micro|low|medium|high",\n'
        '  "themes": [],\n'
        '  "subgenres": [],\n'
        '  "comparable_films": [],\n'
        '  "dimension_scores": {\n'
        '    "concept":       {"score": 0, "justification": ""},\n'
        '    "structure":     {"score": 0, "justification": ""},\n'
        '    "protagonist":   {"score": 0, "justification": ""},\n'
        '    "supporting_cast":{"score": 0, "justification": ""},\n'
        '    "dialogue":      {"score": 0, "justification": ""},\n'
        '    "genre_execution":{"score": 0, "justification": ""},\n'
        '    "originality":   {"score": 0, "justification": ""},\n'
        '    "weighted_score": 0.0\n'
        "  },\n"
        '  "commercial_viability": {\n'
        '    "target_audience": {"score": 0, "note": ""},\n'
        '    "high_concept":    {"score": 0, "note": ""},\n'
        '    "cast_attachability":{"score": 0, "note": ""},\n'
        '    "marketing_hook":  {"score": 0, "note": ""},\n'
        '    "budget_return_ratio":{"score": 0, "note": ""},\n'
        '    "comparable_success":{"score": 0, "note": ""},\n'
        '    "cvs_total": 0\n'
        "  },\n"
        '  "critical_failures": [],\n'
        '  "usp_strengths": [],\n'
        '  "film_now_assessment": {\n'
        '    "is_film_now": false,\n'
        '    "confidence": "low|medium|high",\n'
        '    "primary_reason": ""\n'
        "  }\n"
        "}\n\n"
        "Return ONLY valid JSON. No markdown. No explanation."
    )


# ── V9 Analysis Engine ────────────────────────────────────────────────────────

def run_v9_full(
    text: str,
    title: str,
    page_count: int,
    word_count: int,
    model_key: str,
    proxy_url: Optional[str],
    triage_impression: Optional[Dict[str, Any]] = None,
    calibration_prompt: Optional[str] = None,
) -> Tuple[Dict[str, Any], Dict[str, int]]:
    """Run the full 5-reader + synthesis V9 pipeline.

    - Tool_use forces schema-valid JSON output (no silent 5/10 fallback).
    - Screenplay body is a cached content block reused across all 6 calls.
    - Extended thinking on every step.
    - Pillar scores and weighted score are RECOMPUTED in Python after LLM returns
      (mirrors multiPassAnalysis.ts computePillarScoreFromReport and
      computeWeightedScoreFromSynthesis) to eliminate LLM arithmetic errors.
    - Synthesis is retried 3x on transport / schema failure.

    Returns (analysis_dict, total_usage).
    """
    truncated = _truncate(text)
    was_truncated = len(text) > MAX_CHARS
    if was_truncated:
        log.warning(
            f"    ⚠ Truncated screenplay {len(text):,} → {MAX_CHARS:,} chars "
            f"(~{(len(text) - MAX_CHARS) // 250} pages lost). Score may be biased "
            f"against late-act material."
        )

    # ONE cached screenplay block — shared across the 5 readers + synthesis.
    # First reader call writes the cache; subsequent calls read at 10% input cost.
    screenplay_block = _screenplay_user_block(truncated, cached=True)

    total_usage: Dict[str, int] = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
    }

    def _accumulate(usage: Dict[str, int]) -> None:
        for k in total_usage:
            total_usage[k] += usage.get(k, 0)

    # ── Genre detection (cheap Haiku pass) → the genre card the readers use ──
    genre_detection = run_genre_detection(screenplay_block, proxy_url)
    genre_card = build_genre_card(genre_detection)
    _gd = genre_detection
    _label = _gd["external_genre"]
    if _gd["is_comedy"]:
        _label = f"Comedy+{_gd.get('comedy_paired_genre')}"
        if _gd.get("comedy_subgenre"):
            _label += f" ({_gd['comedy_subgenre']})"
    log.info(f"    Genre: {_label} | internal: {_gd.get('internal_genre') or '?'} "
             f"(confidence {_gd.get('confidence')})")

    log.info(f"    Running 5 readers in parallel (model: {model_key}, tool_use + caching + thinking)…")
    reader_reports: Dict[str, Any] = {}
    reader_start = time.time()

    def run_reader(reader: str) -> Tuple[str, Any, Dict[str, int]]:
        system_blocks = _reader_system_blocks(reader)
        user_blocks = _reader_user_blocks(reader, screenplay_block, title, page_count, genre_card)
        tool = READER_TOOLS[reader]
        try:
            tool_input, _text, usage = call_llm(
                system_blocks=system_blocks,
                user_blocks=user_blocks,
                model_key=model_key,
                tool=tool,
                thinking_budget=THINKING_BUDGET_READER,
                max_tokens=OUTPUT_BUDGET_READER,
                proxy_url=proxy_url,
            )
        except Exception as e:
            log.error(f"      ✗ {reader} call failed: {e}")
            return reader, {"reader": reader, "pillar_score": 0, "error": str(e), "call_error": True}, {}

        if tool_input is None:
            log.warning(f"      ⚠ {reader} returned no tool_use block")
            return reader, {"reader": reader, "pillar_score": 0, "error": "no tool_use block", "parse_error": True}, usage

        # tool_use guarantees schema validity, so tool_input IS the report.
        return reader, tool_input, usage

    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(run_reader, r): r for r in READER_WEIGHTS}
        for fut in as_completed(futures):
            reader = futures[fut]
            try:
                r_name, report, usage = fut.result()
                reader_reports[r_name] = report
                _accumulate(usage)
                score = report.get("pillar_score", report.get("overall_score", "?"))
                log.info(f"      ✓ {r_name} (pillar_score: {score})")
            except Exception as e:
                log.error(f"      ✗ {reader} reader failed: {e}")
                reader_reports[reader] = {"reader": reader, "pillar_score": 0, "error": str(e)}

    reader_duration = time.time() - reader_start
    cache_hit_ratio = (
        total_usage["cache_read_input_tokens"]
        / max(1, total_usage["cache_read_input_tokens"] + total_usage["input_tokens"])
    )
    log.info(
        f"    Readers complete in {reader_duration:.1f}s. "
        f"Cache hit ratio: {cache_hit_ratio:.0%}. Running synthesis…"
    )

    failed_readers = [
        name for name, report in reader_reports.items()
        if report.get("call_error") or report.get("parse_error") or report.get("error")
    ]
    reader_errors = {
        name: str(reader_reports[name].get("error", "unknown reader failure"))
        for name in failed_readers
    }
    reader_reports = {
        name: report for name, report in reader_reports.items()
        if name not in failed_readers
    }
    if len(reader_reports) < 3:
        raise RuntimeError(
            f"Insufficient reader results: {len(reader_reports)}/5 completed; "
            f"failed: {', '.join(failed_readers)}"
        )
    if failed_readers:
        log.warning(
            f"    Partial analysis: {len(reader_reports)}/5 readers completed; "
            f"missing {', '.join(failed_readers)}. Scores will be reweighted."
        )

    # ── Synthesis (with retry) ──────────────────────────────────────────────
    syn_system_blocks = _synthesis_system_blocks()
    syn_user_blocks = _synthesis_user_blocks(
        title,
        reader_reports,
        triage_impression,
        genre_detection,
        calibration_prompt,
    )

    analysis: Optional[Dict[str, Any]] = None
    last_err: Optional[BaseException] = None
    for attempt in range(1, 4):  # 3 attempts
        try:
            tool_input, _text, syn_usage = call_llm(
                system_blocks=syn_system_blocks,
                user_blocks=syn_user_blocks,
                model_key=model_key,
                tool=SYNTHESIS_TOOL,
                thinking_budget=THINKING_BUDGET_SYNTHESIS,
                max_tokens=OUTPUT_BUDGET_SYNTHESIS,
                proxy_url=proxy_url,
            )
            _accumulate(syn_usage)
            if tool_input is not None:
                analysis = tool_input
                break
            last_err = RuntimeError("synthesis returned no tool_use block")
            log.warning(f"    Synthesis attempt {attempt}/3: no tool_use block")
        except Exception as e:
            last_err = e
            log.warning(f"    Synthesis attempt {attempt}/3 failed: {e}")
        if attempt < 3:
            wait = 5 * attempt
            log.info(f"    Retrying synthesis in {wait}s…")
            time.sleep(wait)

    if analysis is None:
        raise RuntimeError(f"Synthesis failed after 3 attempts: {last_err}") from last_err

    # ── Code-side score computation (mirrors TypeScript engine) ────────────────
    # Recompute every pillar score from its sub-scores so LLM arithmetic errors
    # cannot survive into the final document. This is the key safety difference
    # between V9 (code-computed) and earlier daemon versions (LLM-computed).

    def _compute_pillar_score(report: Dict[str, Any]) -> Optional[float]:
        """Average of all integer sub-scores in report['sub_scores'].
        Returns None if no valid sub-scores found (allows caller to log warning)."""
        sub_scores = report.get("sub_scores", {})
        values = [
            v["score"] for v in sub_scores.values()
            if isinstance(v, dict) and isinstance(v.get("score"), (int, float))
        ]
        return round(sum(values) / len(values), 2) if values else None

    def _compute_weighted_score(pillar_scores: Dict[str, Any]) -> float:
        """Reweighted average across completed readers only."""
        total = 0.0
        completed_weight = 0.0
        for reader_name, weight in READER_WEIGHTS.items():
            if reader_name not in reader_reports:
                continue
            ps = pillar_scores.get(reader_name, {})
            score = ps.get("score") if isinstance(ps, dict) else None
            if not isinstance(score, (int, float)):
                continue
            total += score * weight
            completed_weight += weight
        return round(total / completed_weight, 2) if completed_weight else 0.0

    # Override reader pillar_scores with code-computed values.
    for reader_name, report in reader_reports.items():
        if report.get("call_error") or report.get("parse_error"):
            continue
        computed = _compute_pillar_score(report)
        if computed is not None:
            llm_score = report.get("pillar_score")
            if llm_score is not None and abs(computed - llm_score) > 0.2:
                log.warning(
                    f"    ⚠ {reader_name}: LLM pillar_score={llm_score} "
                    f"vs code-computed={computed} (diff={abs(computed-llm_score):.2f}). "
                    f"Using code value."
                )
            report["pillar_score"] = computed
            # Also inject into synthesis pillar_scores if analysis references it.
            if "pillar_scores" in analysis and reader_name in analysis["pillar_scores"]:
                analysis["pillar_scores"][reader_name]["score"] = computed

    # Override synthesis weighted_score with code-computed value.
    if "pillar_scores" in analysis:
        computed_ws = _compute_weighted_score(analysis["pillar_scores"])
        llm_ws = analysis.get("weighted_score")
        if llm_ws is not None and abs(computed_ws - llm_ws) > 0.1:
            log.warning(
                f"    ⚠ weighted_score: LLM={llm_ws} vs code={computed_ws} "
                f"(diff={abs(computed_ws - llm_ws):.2f}). Using code value."
            )
        analysis["weighted_score"] = computed_ws

    # Derive the verdict in code from the structured synthesis outputs.
    # This restores the critical-failure penalty (which the pure-sum override
    # above was silently discarding) and enforces the situation/trap/truncation
    # gates that were previously prompt-only honor system.
    fp_check = analysis.get("false_positive_check") or {}
    svs = analysis.get("story_vs_situation") or {}
    derived = derive_verdict(
        weighted_score=float(analysis.get("weighted_score", 0) or 0),
        critical_failures=analysis.get("critical_failures"),
        situation_verdict=str(svs.get("verdict", "")),
        weighted_trap_score=float(fp_check.get("weighted_trap_score", 0) or 0),
        truncated=was_truncated,
    )
    model_verdict = str(analysis.get("verdict", ""))
    if model_verdict and model_verdict != derived["verdict"]:
        log.warning(
            f"    ⚠ verdict: LLM said {model_verdict}, code derived {derived['verdict']} "
            f"(adjusted score {derived['adjusted_score']}, gates: {derived['adjustments'] or 'none'}). "
            f"Using code value."
        )
    analysis["verdict_model"] = model_verdict
    analysis["verdict"] = derived["verdict"]
    analysis["weighted_score_adjusted"] = derived["adjusted_score"]
    analysis["critical_failure_penalty_applied"] = derived["penalty"]
    analysis["verdict_adjustments"] = derived["adjustments"]
    analysis["_truncation"] = {
        "truncated": was_truncated,
        "chars_lost": max(0, len(text) - MAX_CHARS),
        "approx_pages_lost": max(0, (len(text) - MAX_CHARS) // 250),
    }

    # Embed reader reports, genre detection, and lock version string.
    analysis["reader_reports"] = reader_reports
    analysis["analysis_quality"] = {
        "status": "partial" if failed_readers else "complete",
        "completed_readers": len(reader_reports),
        "expected_readers": len(READER_WEIGHTS),
        "failed_readers": failed_readers,
    }
    if failed_readers:
        analysis["failed_readers"] = failed_readers
        analysis["failed_reader_errors"] = reader_errors
    analysis["genre_detection"] = genre_detection
    analysis["_total_usage"] = total_usage
    analysis["analysis_version"] = "v9_archaeology"  # Always override — source of truth.
    return analysis, total_usage


# ── Boundary Re-Runs ─────────────────────────────────────────────────────────
# Measured run-to-run spread at temp 0.1 is ~0.75-0.8 points (see
# docs/audits/2026-07-02-variance-results.md) — a single-run verdict within
# half a point of a tier boundary is close to a coin flip. When the adjusted
# score lands near a boundary, run up to 2 more full passes and keep the
# median-score run with the majority verdict. Prompt caching makes the extra
# passes cheap when they run within the cache TTL.

BOUNDARY_WINDOW = 0.5
VERDICT_BOUNDARIES = (5.5, 7.5, 8.5)
MAX_BOUNDARY_RUNS = 3


def _near_boundary(score: float, window: float = BOUNDARY_WINDOW) -> bool:
    return any(abs(score - b) < window for b in VERDICT_BOUNDARIES)


def _adjusted_score(analysis: Dict[str, Any]) -> float:
    val = analysis.get("weighted_score_adjusted")
    if val is None:
        val = analysis.get("weighted_score", 0)
    return float(val or 0)


def select_stable_result(
    runs: List[Tuple[float, Dict[str, Any]]],
) -> Dict[str, Any]:
    """Pick the final analysis from boundary re-runs.

    The median-score run becomes the coverage document (its reader reports
    and prose are internally consistent). The verdict is the majority verdict
    across runs; with no majority, the median run's own verdict stands.
    """
    ordered = sorted(runs, key=lambda r: r[0])
    median_score, final = ordered[len(ordered) // 2]

    verdicts = [str(a.get("verdict", "")) for _, a in runs]
    counts: Dict[str, int] = {}
    for v in verdicts:
        counts[v] = counts.get(v, 0) + 1
    top_verdict, top_count = max(counts.items(), key=lambda kv: kv[1])
    final_verdict = top_verdict if top_count >= 2 else str(final.get("verdict", ""))

    if str(final.get("verdict", "")) != final_verdict:
        adjustments = final.setdefault("verdict_adjustments", [])
        adjustments.append(
            f"boundary re-run majority: {final.get('verdict')} → {final_verdict} "
            f"(verdicts across runs: {verdicts})"
        )
        final["verdict"] = final_verdict

    final["_boundary_reruns"] = {
        "triggered": True,
        "runs": [
            {"adjusted_score": s, "verdict": str(a.get("verdict", "")),
             "verdict_model": str(a.get("verdict_model", ""))}
            for s, a in runs
        ],
        "median_adjusted_score": median_score,
        "score_spread": round(ordered[-1][0] - ordered[0][0], 2),
        "final_verdict": final_verdict,
    }
    return final


def run_v9_stable(
    text: str,
    title: str,
    page_count: int,
    word_count: int,
    model_key: str,
    proxy_url: Optional[str],
    triage_impression: Optional[Dict[str, Any]] = None,
    calibration_prompt: Optional[str] = None,
) -> Tuple[Dict[str, Any], Dict[str, int]]:
    """run_v9_full with boundary re-runs. Drop-in replacement.

    Set LEMON_BOUNDARY_RERUNS=0 to disable (single-pass, e.g. cost-capped
    experiments).
    """
    analysis, usage = run_v9_full(
        text=text, title=title, page_count=page_count, word_count=word_count,
        model_key=model_key, proxy_url=proxy_url, triage_impression=triage_impression,
        calibration_prompt=calibration_prompt,
    )
    combined: Dict[str, Any] = dict(usage)

    score = _adjusted_score(analysis)
    if os.getenv("LEMON_BOUNDARY_RERUNS", "1") == "0" or not _near_boundary(score):
        return analysis, combined

    log.info(
        f"    Boundary re-run: adjusted score {score} is within {BOUNDARY_WINDOW} "
        f"of a verdict boundary — running {MAX_BOUNDARY_RUNS - 1} more passes…"
    )
    runs: List[Tuple[float, Dict[str, Any]]] = [(score, analysis)]
    for i in range(MAX_BOUNDARY_RUNS - 1):
        try:
            extra, extra_usage = run_v9_full(
                text=text, title=title, page_count=page_count, word_count=word_count,
                model_key=model_key, proxy_url=proxy_url, triage_impression=triage_impression,
                calibration_prompt=calibration_prompt,
            )
        except Exception as e:
            log.warning(f"    Boundary re-run {i + 2} failed (continuing with {len(runs)} run(s)): {e}")
            continue
        for k, v in extra_usage.items():
            if isinstance(v, int) and isinstance(combined.get(k), int):
                combined[k] = combined[k] + v
            elif isinstance(v, int) and k not in combined:
                combined[k] = v
            else:
                combined[k] = v
        runs.append((_adjusted_score(extra), extra))

    if len(runs) == 1:
        return analysis, combined

    final = select_stable_result(runs)
    reruns = final["_boundary_reruns"]
    log.info(
        f"    Boundary re-run result: scores {[r['adjusted_score'] for r in reruns['runs']]} "
        f"(spread {reruns['score_spread']}) → verdict {reruns['final_verdict']}"
    )
    return final, combined


def run_v9_hybrid(
    text: str,
    title: str,
    page_count: int,
    word_count: int,
    proxy_url: Optional[str],
    triage_impression: Optional[Dict[str, Any]] = None,
    calibration_prompt: Optional[str] = None,
) -> Tuple[Dict[str, Any], Dict[str, int]]:
    """Smart two-pass: Sonnet first; if verdict is RECOMMEND or FILM_NOW,
    re-run on Opus for deeper analysis.

    Matches the dashboard's 'Hybrid — Smart Two-Pass' description:
      "Sonnet first pass on all scripts. Recommend & Film Now scripts get a
       fresh Opus deep analysis automatically."

    Returns (analysis_dict, combined_usage). The analysis_dict carries a
    `_hybrid_mode` block with provenance: which model produced the final
    result, the Sonnet verdict that triggered (or didn't trigger) promotion,
    and the Sonnet usage for cost accounting.
    """
    log.info("    Hybrid mode: running Sonnet first pass…")
    sonnet_analysis, sonnet_usage = run_v9_stable(
        text=text,
        title=title,
        page_count=page_count,
        word_count=word_count,
        model_key="sonnet",
        proxy_url=proxy_url,
        triage_impression=triage_impression,
        calibration_prompt=calibration_prompt,
    )

    sonnet_verdict_raw = str(sonnet_analysis.get("verdict", ""))
    # Normalise: FILM_NOW / FILM NOW / film_now / film-now → FILM_NOW
    sonnet_verdict = (
        sonnet_verdict_raw.upper().replace(" ", "_").replace("-", "_")
    )
    needs_opus = sonnet_verdict in ("RECOMMEND", "FILM_NOW")

    if not needs_opus:
        log.info(
            f"    Sonnet verdict: {sonnet_verdict} — no Opus promotion needed. Hybrid complete."
        )
        sonnet_analysis["_hybrid_mode"] = {
            "promoted_to_opus": False,
            "sonnet_verdict": sonnet_verdict,
            "final_model": "sonnet",
        }
        return sonnet_analysis, sonnet_usage

    log.info(
        f"    Sonnet verdict: {sonnet_verdict} — promoting to Opus for deeper analysis…"
    )
    opus_analysis, opus_usage = run_v9_stable(
        text=text,
        title=title,
        page_count=page_count,
        word_count=word_count,
        model_key="opus",
        proxy_url=proxy_url,
        triage_impression=triage_impression,
        calibration_prompt=calibration_prompt,
    )

    # Combine usage across both passes (cost accounting).
    combined_usage: Dict[str, int] = {}
    for k in set(sonnet_usage) | set(opus_usage):
        combined_usage[k] = int(sonnet_usage.get(k, 0)) + int(opus_usage.get(k, 0))

    opus_analysis["_hybrid_mode"] = {
        "promoted_to_opus": True,
        "sonnet_verdict": sonnet_verdict,
        "sonnet_score": sonnet_analysis.get("weighted_score"),
        "opus_verdict": str(opus_analysis.get("verdict", "")),
        "opus_score": opus_analysis.get("weighted_score"),
        "final_model": "opus",
        "sonnet_usage": sonnet_usage,
        "opus_usage": opus_usage,
    }
    return opus_analysis, combined_usage


def run_v9_triage(
    text: str,
    title: str,
    page_count: int,
    word_count: int,
    proxy_url: Optional[str],
) -> Tuple[Dict[str, Any], Dict[str, int]]:
    """Run a fast single-pass triage (Haiku model).

    Returns (analysis_dict, usage).
    """
    truncated = _truncate(text)
    triage_prompt = (
        f"You are a script reader doing a QUICK ASSESSMENT of a screenplay.\n"
        f"Title: {title}\nPages: {page_count}\nWords: {word_count}\n\n"
        f"SCREENPLAY TEXT:\n{truncated}\n\n"
        f"Return ONLY this JSON:\n"
        f'{{"triage_score": 0, "verdict": "", "genre": "", "logline": "", "should_deep_analyze": false}}\n'
        f"Set should_deep_analyze true if triage_score >= 6.\n"
        f"Return ONLY valid JSON."
    )
    _tool_input, triage_text, usage = call_llm(
        system_blocks=[{
            "type": "text",
            "text": "You are an expert screenplay evaluator. Be direct and concise.",
        }],
        user_blocks=[{"type": "text", "text": triage_prompt}],
        model_key="haiku",
        max_tokens=500,
        proxy_url=proxy_url,
    )
    try:
        triage = extract_json(triage_text)
    except Exception as e:
        raise RuntimeError(f"Triage JSON parse failed: {e}") from e

    # Normalise to match the app's normalization expectations
    score = float(triage.get("triage_score", 0))
    raw_verdict = str(triage.get("verdict", "pass")).lower()

    if "film now" in raw_verdict or "film_now" in raw_verdict:
        verdict = "film_now"
    elif "recommend" in raw_verdict:
        verdict = "recommend"
    elif "consider" in raw_verdict:
        verdict = "consider"
    else:
        verdict = "pass"

    analysis = {
        "title": title,
        "logline": triage.get("logline", ""),
        "genre": triage.get("genre", ""),
        "weighted_score": score,
        "verdict": verdict,
        "is_film_now": verdict == "film_now",
        "should_deep_analyze": triage.get("should_deep_analyze", score >= 6),  # Must match triage prompt threshold
        "executive_summary": f"Triage score: {score}/10 — {triage.get('verdict', '')}",
        "dimension_scores": {
            "concept": {"score": score, "justification": "Triage mode — single pass"},
            "structure": {"score": score, "justification": "Triage mode — single pass"},
            "protagonist": {"score": score, "justification": "Triage mode — single pass"},
            "supporting_cast": {"score": score, "justification": "Triage mode — single pass"},
            "dialogue": {"score": score, "justification": "Triage mode — single pass"},
            "genre_execution": {"score": score, "justification": "Triage mode — single pass"},
            "originality": {"score": score, "justification": "Triage mode — single pass"},
            "weighted_score": score,
        },
        "commercial_viability": {
            "target_audience": {"score": 0, "note": "Not assessed in triage"},
            "high_concept": {"score": 0, "note": "Not assessed in triage"},
            "cast_attachability": {"score": 0, "note": "Not assessed in triage"},
            "marketing_hook": {"score": 0, "note": "Not assessed in triage"},
            "budget_return_ratio": {"score": 0, "note": "Not assessed in triage"},
            "comparable_success": {"score": 0, "note": "Not assessed in triage"},
            "cvs_total": 0,
        },
        "critical_failures": [],
        "themes": [],
        "subgenres": [],
        "comparable_films": [],
        "film_now_assessment": {
            "is_film_now": verdict == "film_now",
            "confidence": "low",
            "primary_reason": "Triage mode — single Haiku pass",
        },
    }
    return analysis, usage


# ── Raw V9 Document Builder ───────────────────────────────────────────────────

def build_raw_document(
    pdf_path: Path,
    parsed: Dict[str, Any],
    analysis: Dict[str, Any],
    collection: str,
    model_key: str,
    mode: str,
    total_usage: Dict[str, int],
    total_duration_ms: int,
    content_hash: str,
    queued_at_ms: int,
    tmdb_status: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build the raw document that saveAnalysis() writes to Firestore.
    Mirrors the structure in src/lib/analysisService.ts analyzeV9Path().
    """
    source_file = pdf_path.stem + ".pdf"
    safe_name = (
        re.sub(r"[^a-zA-Z0-9_\- ]", "", pdf_path.stem)
        .strip()
        .replace(" ", "_")
    )

    raw: Dict[str, Any] = {
        "source_file": source_file,
        "analysis_model": f"claude-{model_key}",
        "analysis_version": "v9_archaeology" if mode == "full" else "v9_triage",
        "lenses_enabled": ["commercial"],
        "collection": collection,
        "metadata": {
            "filename": source_file,
            "page_count": parsed.get("page_count", 0),
            "word_count": parsed.get("word_count", 0),
        },
        "analysis": analysis,
        "v9_meta": {
            "reader_count": 5 if mode == "full" else 1,
            "total_tokens": total_usage,
            "total_duration_ms": total_duration_ms,
            "mode": mode,
            "ingested_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "ingested_by": "ingest_v9.py",
        },
        "queued_at_ms": queued_at_millis(queued_at_ms),
        **verified_identity_fields(content_hash),
    }

    if tmdb_status:
        raw["tmdb_status"] = tmdb_status

    # Storage path (matches uploadScreenplayPdf in firebase.ts)
    raw["_storagePath"] = f"screenplays/{collection}/{safe_name}.pdf"

    return raw


# ── Single-Script Ingestion ───────────────────────────────────────────────────

COLLECTION_YEAR_CONTEXT = {
    "2005 Black List": 2005,
    "2006 Black List": 2006,
    "2007 Black List": 2007,
    "2020 Black List": 2020,
    "2024 Black List": 2024,
    "2025 Black List": 2025,
}


def ingest_one(
    pdf_path: Path,
    collection: str,
    model_key: str,
    mode: str,
    skip_tmdb: bool,
    force: bool,
    dry_run: bool,
    proxy_url: Optional[str],
) -> str:
    """Ingest a single PDF. Returns status string: 'ok', 'skip', 'fail', 'exists'."""
    title = pdf_path.stem
    queued_at_ms = int(time.time() * 1000)

    log.info(f"▶ {pdf_path.name}")

    # --- Already in Firestore? ---
    source_file = pdf_path.stem + ".pdf"
    if not force and check_already_in_firestore(source_file):
        log.info(f"  ↩ Already in Firestore — skipping (use --force to re-analyze)")
        return "exists"

    # --- Content identity + parse PDF ---
    content_hash = compute_content_hash(pdf_path)
    parsed = parse_pdf(pdf_path, content_hash=content_hash)
    if not parsed:
        return "fail"

    text = parsed.get("text", "")
    page_count = parsed.get("page_count", 0)
    word_count = parsed.get("word_count", 0)

    # --- TMDB check ---
    tmdb_status: Optional[Dict[str, Any]] = None
    if not skip_tmdb:
        year_context = COLLECTION_YEAR_CONTEXT.get(collection)
        is_produced, reason = check_tmdb(title, year_context)
        tmdb_status = {
            "checked": True,
            "is_produced": is_produced,
            "reason": reason,
            "checked_at": datetime.utcnow().isoformat() + "Z",
            "confidence": "high" if is_produced else "medium",
        }
        if is_produced:
            log.info(f"  ⊘ TMDB: already produced — {reason}")
            return "skip"
        else:
            log.info(f"  ✓ TMDB: not produced ({reason})")
    else:
        tmdb_status = {
            "checked": False,
            "is_produced": None,
            "reason": "skipped via --skip-tmdb",
            "checked_at": datetime.utcnow().isoformat() + "Z",
        }

    if dry_run:
        cost_est = estimate_cost(word_count, model_key, mode)
        log.info(f"  [DRY RUN] Would analyze {word_count:,} words — estimated cost: {cost_est}")
        return "ok"

    # --- Run V9 ---
    start = time.time()
    try:
        if mode == "triage":
            analysis, usage = run_v9_triage(text, title, page_count, word_count, proxy_url)
        else:
            # Run Haiku triage first to get a cold-read impression, then pass
            # it into the full synthesis as a 6th data point (mirrors TypeScript
            # multiPassAnalysis.ts triage→synthesis handoff).
            log.info("    Running pre-analysis triage (Haiku cold-read)...")
            try:
                triage_result, triage_usage = run_v9_triage(
                    text, title, page_count, word_count, proxy_url
                )
                triage_impression: Optional[Dict[str, Any]] = {
                    "triage_score": triage_result.get("triage_score", 0),
                    "verdict": triage_result.get("verdict", ""),
                    "genre": triage_result.get("genre", ""),
                    "logline": triage_result.get("logline", ""),
                }
                log.info(
                    f"    Triage cold-read: {triage_impression['triage_score']}/10 "
                    f"[{triage_impression['verdict']}]"
                )
            except Exception as e:
                log.warning(f"    Triage pre-pass failed (continuing without): {e}")
                triage_impression = None
            analysis, usage = run_v9_stable(
                text, title, page_count, word_count, model_key, proxy_url,
                triage_impression=triage_impression,
            )
    except Exception as e:
        log.error(f"  ✗ Analysis failed: {e}")
        log.debug(traceback.format_exc())
        return "fail"

    duration_ms = int((time.time() - start) * 1000)

    # --- Build raw document ---
    raw = build_raw_document(
        pdf_path=pdf_path,
        parsed=parsed,
        analysis=analysis,
        collection=collection,
        model_key=model_key,
        mode=mode,
        total_usage=usage,
        total_duration_ms=duration_ms,
        content_hash=content_hash,
        queued_at_ms=queued_at_ms,
        tmdb_status=tmdb_status,
    )

    # --- Write to Firestore ---
    verdict = analysis.get("verdict", "?")
    score = analysis.get("weighted_score", 0)
    log.info(f"  ✓ Analysis complete: {score:.1f}/10 [{verdict.upper()}] in {duration_ms/1000:.1f}s")
    log.info(f"    Tokens: {usage.get('input_tokens',0):,} in / {usage.get('output_tokens',0):,} out")

    if not write_to_firestore(raw):
        # Save locally as fallback
        fallback_path = LOG_DIR / "failed_writes" / (pdf_path.stem + ".json")
        fallback_path.parent.mkdir(exist_ok=True)
        with open(fallback_path, "w", encoding="utf-8") as f:
            json.dump(raw, f, indent=2, ensure_ascii=False)
        log.warning(f"  ⚠ Firestore write failed — saved locally: {fallback_path}")

    return "ok"


# ── Cost Estimation ───────────────────────────────────────────────────────────

def estimate_cost(word_count: int, model_key: str, mode: str) -> str:
    """Rough cost estimate per script based on token usage patterns."""
    # Rates per million tokens ($ USD)
    rates = {
        "haiku":  {"in": 0.80,  "out": 4.00},
        "sonnet": {"in": 3.00,  "out": 15.00},
        "opus":   {"in": 15.00, "out": 75.00},
    }
    r = rates.get(model_key, rates["sonnet"])
    chars = min(len(str(word_count) * 5), MAX_CHARS)

    if mode == "triage":
        in_tok = (chars / 4) + 200
        out_tok = 200
    else:
        # 5 readers × (chars/4 + prompt ~800) + synthesis (~3000 out)
        in_tok = 5 * (chars / 4 + 800) + 3000
        out_tok = 5 * 1500 + 4000

    cost = (in_tok * r["in"] + out_tok * r["out"]) / 1_000_000
    return f"~${cost:.2f}"


# ── Batch Runner ──────────────────────────────────────────────────────────────

def run_batch(
    pdf_files: List[Path],
    collection: str,
    model_key: str,
    mode: str,
    skip_tmdb: bool,
    force: bool,
    dry_run: bool,
    proxy_url: Optional[str],
    concurrency: int,
) -> Dict[str, int]:
    """Run ingestion for a list of PDFs. Returns stats dict."""
    stats = {"ok": 0, "skip": 0, "fail": 0, "exists": 0}
    total = len(pdf_files)

    log.info(f"\n{'='*60}")
    log.info(f"BATCH INGESTION — {total} script(s)")
    log.info(f"  Collection : {collection}")
    log.info(f"  Model      : {model_key} ({MODEL_IDS.get(model_key, '?')})")
    log.info(f"  Mode       : {mode}")
    log.info(f"  Concurrency: {concurrency}")
    log.info(f"  TMDB check : {'disabled' if skip_tmdb else 'enabled'}")
    log.info(f"  Dry run    : {dry_run}")
    log.info(f"  Log file   : {LOG_FILE}")
    log.info(f"{'='*60}\n")

    if dry_run:
        # Estimate total cost
        log.info("[DRY RUN MODE — no API calls will be made]\n")

    def process(args: Tuple[int, Path]) -> Tuple[int, str]:
        idx, pdf = args
        log.info(f"[{idx}/{total}] ", )
        status = ingest_one(pdf, collection, model_key, mode, skip_tmdb, force, dry_run, proxy_url)
        return idx, status

    if concurrency <= 1:
        for i, pdf in enumerate(pdf_files, 1):
            _, status = process((i, pdf))
            stats[status] += 1
            if i < total and not dry_run:
                time.sleep(INTER_SCRIPT_DELAY)
    else:
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {pool.submit(process, (i + 1, pdf)): pdf
                       for i, pdf in enumerate(pdf_files)}
            for fut in as_completed(futures):
                _, status = fut.result()
                stats[status] += 1

    return stats


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Lemon Studios — V9 Screenplay Ingestion Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Source
    src_grp = parser.add_mutually_exclusive_group(required=True)
    src_grp.add_argument("--source", "-s", help="Path to PDF file or folder")
    src_grp.add_argument("--drive", "-d", help="Google Drive folder URL (not implemented yet)")

    # Required
    parser.add_argument(
        "--collection", "-c", required=True,
        choices=["BLKLST", "LEMON", "SUBMISSION", "CONTEST", "OTHER"],
        help="Dashboard collection for these screenplays",
    )

    # Model & Mode
    parser.add_argument(
        "--model", "-m",
        choices=["sonnet", "haiku", "opus"],
        default="sonnet",
        help="AI model (default: sonnet — best quality/cost)",
    )
    parser.add_argument(
        "--triage", action="store_true",
        help="Fast triage mode (Haiku single-pass, ~$0.02/script)",
    )

    # Behaviour flags
    parser.add_argument("--skip-tmdb", action="store_true", help="Skip TMDB pre-screening")
    parser.add_argument("--force", "-f", action="store_true", help="Re-analyze even if already in Firestore")
    parser.add_argument("--dry-run", action="store_true", help="Preview — no API calls, no writes")
    parser.add_argument("--concurrency", type=int, default=3, help="Parallel scripts (default: 3)")

    # Proxy override
    parser.add_argument("--proxy-url", help=f"LLM proxy URL (default: {DEFAULT_PROXY_URL})")

    args = parser.parse_args()

    mode = "triage" if args.triage else "full"
    model_key = "haiku" if args.triage else args.model

    # --- Validate source ---
    if args.drive:
        log.error("Google Drive ingestion not implemented in this version. Download PDFs locally first.")
        return 1

    source_path = Path(args.source)
    if not source_path.exists():
        log.error(f"Source not found: {source_path}")
        return 1

    pdf_files = [source_path] if source_path.is_file() else sorted(source_path.glob("*.pdf"))
    if not pdf_files:
        log.error(f"No PDF files found in: {source_path}")
        return 1

    # --- Firebase ---
    if not args.dry_run:
        firebase_ok = init_firebase()
        if not firebase_ok:
            log.error(
                "\nFirebase not initialised. Firestore writes will be skipped.\n"
                "Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json\n"
                "See: https://firebase.google.com/docs/admin/setup#python"
            )
            if not args.dry_run:
                answer = input("\nContinue without Firestore? Results will be saved locally only. [y/N] ")
                if answer.lower() != "y":
                    return 1

    # --- Run ---
    stats = run_batch(
        pdf_files=pdf_files,
        collection=args.collection,
        model_key=model_key,
        mode=mode,
        skip_tmdb=args.skip_tmdb,
        force=args.force,
        dry_run=args.dry_run,
        proxy_url=args.proxy_url,
        concurrency=args.concurrency,
    )

    # --- Summary ---
    total = sum(stats.values())
    print(f"\n{'='*60}")
    print("INGESTION COMPLETE")
    print(f"{'='*60}")
    print(f"  ✓ Analyzed & saved : {stats['ok']}")
    print(f"  ↩ Already existed  : {stats['exists']}")
    print(f"  ⊘ Skipped (TMDB)   : {stats['skip']}")
    print(f"  ✗ Failed           : {stats['fail']}")
    print(f"  Total              : {total}")
    print(f"\n  Log: {LOG_FILE}")
    print(f"  Dashboard: https://lemon-screenplay-dashboard.web.app")

    if stats["fail"] > 0:
        print(f"\n⚠ {stats['fail']} script(s) failed — check the log for details.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
