"""Shared Firebase configuration for the CLI and long-running daemon."""

import os
from typing import Mapping, Optional


DEFAULT_FIREBASE_PROJECT_ID = "lemon-screenplay-dashboard"


def resolve_storage_bucket(
    environ: Optional[Mapping[str, str]] = None,
) -> str:
    """Return the explicit bucket override or the project's modern default."""
    values = os.environ if environ is None else environ
    configured = values.get("FIREBASE_STORAGE_BUCKET", "").strip()
    if configured:
        return configured

    project_id = values.get(
        "FIREBASE_PROJECT_ID",
        DEFAULT_FIREBASE_PROJECT_ID,
    ).strip()
    if not project_id:
        project_id = DEFAULT_FIREBASE_PROJECT_ID
    return f"{project_id}.firebasestorage.app"
