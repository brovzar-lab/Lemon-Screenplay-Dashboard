"""Shared raw-byte identity for screenplay PDFs."""

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


MAX_SAFE_QUEUED_AT_MS = 9_007_199_254_740_991


def compute_content_hash(pdf_path: Path) -> str:
    """Return the daemon's SHA-256 idempotency key for a PDF's raw bytes."""
    sha256 = hashlib.sha256()
    with open(pdf_path, "rb") as pdf_file:
        for chunk in iter(lambda: pdf_file.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def verified_identity_fields(content_hash: str) -> Dict[str, str]:
    """Build the identity fields required on every permanent analysis writer."""
    if not re.fullmatch(r"[a-f0-9]{64}", content_hash):
        raise ValueError("content_hash must be a lowercase SHA-256 hex digest")
    return {
        "content_hash": content_hash,
        "identity_status": "verified",
    }


def queued_at_millis(value: Any) -> int:
    """Normalize a queue Timestamp or persisted integer to safe epoch millis."""
    if isinstance(value, bool):
        raise ValueError("queued_at must be a Firestore Timestamp or integer milliseconds")

    if isinstance(value, int):
        queued_at_ms = value
    elif isinstance(value, datetime):
        if value.tzinfo is None:
            raise ValueError("queued_at datetime must include a timezone")
        queued_at_ms = int(value.timestamp() * 1000)
    else:
        raise ValueError("queued_at must be a Firestore Timestamp or integer milliseconds")

    if queued_at_ms <= 0 or queued_at_ms > MAX_SAFE_QUEUED_AT_MS:
        raise ValueError("queued_at milliseconds must be a positive safe integer")
    return queued_at_ms


def build_version_id(content_hash: str, queued_at: Any) -> str:
    """Return the cross-runtime, retry-stable immutable version document ID."""
    verified_identity_fields(content_hash)
    return f"{content_hash}_{queued_at_millis(queued_at)}"


def version_created_at(queued_at: Any) -> datetime:
    """Return an aware datetime that the Admin SDK stores as a Firestore Timestamp."""
    queued_at_ms = queued_at_millis(queued_at)
    return datetime.fromtimestamp(queued_at_ms / 1000, tz=timezone.utc)
