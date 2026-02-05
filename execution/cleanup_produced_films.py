#!/usr/bin/env python3
"""
Delete V5 analysis files for screenplays that have been produced.
Uses existing check_produced_film.py for TMDB lookup.

Purpose: Clean up analysis files for films that were subsequently produced,
keeping only unproduced "hidden gem" screenplays in the dashboard.

Usage:
    # Preview what will be deleted (recommended first)
    python execution/cleanup_produced_films.py --dry-run

    # Execute deletion (creates backups)
    python execution/cleanup_produced_films.py --execute
"""
import argparse
import json
import shutil
import os
import sys
from pathlib import Path
from datetime import datetime

# Add execution directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))
from check_produced_film import check_if_produced, load_cache
from dotenv import load_dotenv

load_dotenv()

# Configuration
ANALYSIS_DIR = Path("public/data/analysis_v5")
BACKUP_DIR = Path(".tmp/deleted_produced")
LOG_FILE = Path(".tmp/cleanup_produced_log.txt")


def log(message: str, log_file=None):
    """Log to console and optionally to file."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    if log_file:
        log_file.write(log_line + "\n")


def extract_title_from_filename(filename: str) -> str:
    """Extract screenplay title from analysis filename."""
    # Remove _analysis_v5.json suffix
    title = filename.replace("_analysis_v5.json", "")
    return title


def main():
    parser = argparse.ArgumentParser(
        description="Delete analysis files for produced screenplays"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview deletions without actually deleting"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute deletions (creates backups first)"
    )
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        print("ERROR: Must specify either --dry-run or --execute")
        print("  --dry-run: Preview what will be deleted")
        print("  --execute: Actually delete files (with backups)")
        return 1

    # Get TMDB API key
    api_key = os.getenv("TMDB_API_KEY")
    if not api_key:
        print("ERROR: TMDB_API_KEY not found in environment")
        print("Make sure .env file exists with TMDB_API_KEY=your_key")
        return 1

    # Setup directories
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Get all analysis files
    if not ANALYSIS_DIR.exists():
        print(f"ERROR: Analysis directory not found: {ANALYSIS_DIR}")
        return 1

    analysis_files = sorted(ANALYSIS_DIR.glob("*_analysis_v5.json"))
    if not analysis_files:
        print(f"No analysis files found in {ANALYSIS_DIR}")
        return 0

    # Load TMDB cache
    cache = load_cache()
    to_delete = []
    checked = 0

    print("=" * 60)
    print(f"CLEANUP PRODUCED FILMS - {'DRY RUN' if args.dry_run else 'EXECUTE'}")
    print("=" * 60)
    print(f"Checking {len(analysis_files)} analysis files against TMDB...")
    print()

    with open(LOG_FILE, "w", encoding="utf-8") as log_file:
        log(f"Cleanup started - Mode: {'DRY RUN' if args.dry_run else 'EXECUTE'}", log_file)
        log(f"Total files to check: {len(analysis_files)}", log_file)
        log("", log_file)

        for analysis_path in analysis_files:
            title = extract_title_from_filename(analysis_path.name)
            checked += 1

            try:
                # Check TMDB for production status
                is_produced, reason, details = check_if_produced(
                    title=title,
                    api_key=api_key,
                    cache=cache
                )

                if is_produced:
                    log(f"PRODUCED: {title}", log_file)
                    log(f"  Reason: {reason}", log_file)
                    to_delete.append((analysis_path, title, reason))
                else:
                    # Only log details for non-produced in verbose mode
                    print(f"  OK: {title}")

            except Exception as e:
                log(f"ERROR checking {title}: {e}", log_file)

        # Summary
        print()
        print("=" * 60)
        log("SUMMARY", log_file)
        log(f"Total files checked: {checked}", log_file)
        log(f"Produced films found: {len(to_delete)}", log_file)
        log(f"Unproduced (keeping): {checked - len(to_delete)}", log_file)
        print("=" * 60)

        if to_delete:
            print()
            log("Files to delete:", log_file)
            for path, title, reason in to_delete:
                log(f"  - {path.name}", log_file)
                log(f"    ({reason})", log_file)

        # Execute deletion if requested
        if args.execute and to_delete:
            print()
            log("EXECUTING DELETION...", log_file)
            log(f"Backups will be saved to: {BACKUP_DIR}", log_file)
            print()

            deleted_count = 0
            for path, title, reason in to_delete:
                try:
                    # Create backup
                    backup_path = BACKUP_DIR / path.name
                    shutil.copy2(path, backup_path)

                    # Delete original
                    path.unlink()

                    log(f"Deleted: {path.name}", log_file)
                    deleted_count += 1

                except Exception as e:
                    log(f"ERROR deleting {path.name}: {e}", log_file)

            print()
            log(f"Successfully deleted {deleted_count} files", log_file)
            log(f"Backups saved to: {BACKUP_DIR}", log_file)

            # Update index.json
            remaining_files = sorted([f.name for f in ANALYSIS_DIR.glob("*_analysis_v5.json")])
            index_path = ANALYSIS_DIR / "index.json"
            with open(index_path, "w", encoding="utf-8") as f:
                json.dump(remaining_files, f, indent=2)
            log(f"Updated index.json with {len(remaining_files)} remaining files", log_file)

        elif args.dry_run:
            print()
            log("DRY RUN - No files were deleted", log_file)
            log("Run with --execute to perform deletion", log_file)

    print()
    print(f"Log saved to: {LOG_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
