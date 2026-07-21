"""Shared raw-byte identity for screenplay PDFs."""

import hashlib
from pathlib import Path


def compute_content_hash(pdf_path: Path) -> str:
    """Return the daemon's SHA-256 idempotency key for a PDF's raw bytes."""
    sha256 = hashlib.sha256()
    with open(pdf_path, "rb") as pdf_file:
        for chunk in iter(lambda: pdf_file.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()
