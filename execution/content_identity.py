"""Shared raw-byte identity for screenplay PDFs."""

import hashlib
import re
from pathlib import Path
from typing import Dict


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
