#!/usr/bin/env python3
"""
Add category field to existing V5 analysis files.
Tags all existing files with 'BLKLST' category since they all came from Black List.

Usage:
    python execution/add_category_to_existing.py --dry-run
    python execution/add_category_to_existing.py --execute
"""
import argparse
import json
import sys
from pathlib import Path
from datetime import datetime


ANALYSIS_DIR = Path("public/data/analysis_v5")
LOG_FILE = Path(".tmp/add_category_log.txt")


def log(message: str, log_file=None):
    """Log to console and optionally to file."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    if log_file:
        log_file.write(log_line + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Add category field to existing V5 analysis files"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying files"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute changes to files"
    )
    parser.add_argument(
        "--category",
        default="BLKLST",
        help="Category to assign (default: BLKLST)"
    )
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        print("ERROR: Must specify either --dry-run or --execute")
        return 1

    # Setup
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not ANALYSIS_DIR.exists():
        print(f"ERROR: Analysis directory not found: {ANALYSIS_DIR}")
        return 1

    analysis_files = sorted(ANALYSIS_DIR.glob("*_analysis_v5.json"))
    if not analysis_files:
        print(f"No analysis files found in {ANALYSIS_DIR}")
        return 0

    print("=" * 60)
    print(f"ADD CATEGORY TO V5 FILES - {'DRY RUN' if args.dry_run else 'EXECUTE'}")
    print("=" * 60)
    print(f"Category to assign: {args.category}")
    print(f"Files to process: {len(analysis_files)}")
    print()

    updated = 0
    skipped = 0
    errors = 0

    with open(LOG_FILE, "w", encoding="utf-8") as log_file:
        log(f"Category update started - Mode: {'DRY RUN' if args.dry_run else 'EXECUTE'}", log_file)
        log(f"Category: {args.category}", log_file)
        log(f"Total files: {len(analysis_files)}", log_file)
        log("", log_file)

        for analysis_path in analysis_files:
            try:
                with open(analysis_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # Check if category already exists
                if "category" in data:
                    log(f"SKIP (already has category): {analysis_path.name} -> {data['category']}", log_file)
                    skipped += 1
                    continue

                # Add category
                data["category"] = args.category

                if args.execute:
                    with open(analysis_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                    log(f"UPDATED: {analysis_path.name}", log_file)
                else:
                    log(f"WOULD UPDATE: {analysis_path.name}", log_file)

                updated += 1

            except json.JSONDecodeError as e:
                log(f"ERROR (invalid JSON): {analysis_path.name} - {e}", log_file)
                errors += 1
            except Exception as e:
                log(f"ERROR: {analysis_path.name} - {e}", log_file)
                errors += 1

        # Summary
        print()
        print("=" * 60)
        log("SUMMARY", log_file)
        log(f"Updated: {updated}", log_file)
        log(f"Skipped (already had category): {skipped}", log_file)
        log(f"Errors: {errors}", log_file)
        print("=" * 60)

        if args.dry_run:
            print()
            log("DRY RUN - No files were modified", log_file)
            log("Run with --execute to apply changes", log_file)

    print()
    print(f"Log saved to: {LOG_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
