"""Fail-closed containment for local screenplay-bearing artifacts."""

from __future__ import annotations

import os
from pathlib import Path


def secure_local_path(path: Path, trusted_root: Path) -> Path:
    root = Path(os.path.abspath(trusted_root))
    candidate = Path(os.path.abspath(path))
    try:
        relative = candidate.relative_to(root)
    except ValueError as error:
        raise ValueError("Local artifact path escapes its trusted root") from error
    if root.is_symlink() or (root.exists() and not root.is_dir()):
        raise ValueError("Local artifact root must be a real directory")
    current = root
    for part in relative.parts:
        current /= part
        if current.is_symlink():
            raise ValueError(f"Local artifact path contains a symlink: {current}")
        if current.exists() and current != candidate and not current.is_dir():
            raise ValueError(f"Local artifact ancestor is not a directory: {current}")
    return candidate
