#!/usr/bin/env python3
"""
Batch TMDB Validation for Lemon Screenplay Dashboard

Scans all screenplay JSON files in public/data/ folders,
checks each against TMDB API to identify produced films,
and adds tmdb_status field to each JSON file.

Usage:
    python execution/validate_produced_films.py                    # Full run
    python execution/validate_produced_films.py --dry-run          # Preview only
    python execution/validate_produced_films.py --report-only      # Generate report without updating files
    python execution/validate_produced_films.py --collection 2007  # Only validate 2007 collection
"""

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from check_produced_film import (
    check_if_produced,
    normalize_title,
    load_cache,
    save_cache,
    load_overrides,
)
from dotenv import load_dotenv

load_dotenv()

# Configuration
DASHBOARD_DATA_PATH = Path(__file__).parent.parent / "lemon-dashboard" / "public" / "data"
NEW_DASHBOARD_PATH = Path("/Users/Vertigo/CODE/LEMON-SCREENPLAY-DASHBOARD/public/data")
REPORT_PATH = Path(__file__).parent.parent / ".tmp" / "tmdb_validation_report.csv"

# Collection to year context mapping
COLLECTION_YEAR_CONTEXT: Dict[str, Optional[int]] = {
    "analysis_v3_2005": 2005,
    "analysis_v3_2006": 2006,
    "analysis_v3_2007": 2007,
    "analysis_v3_2020": 2020,
    "analysis_v3_Randoms": None,  # No year context for randoms
}

# Rate limiting
API_DELAY_SECONDS = 2.0  # Delay between API calls


def find_data_path() -> Path:
    """Find the screenplay data path (check both locations)."""
    if NEW_DASHBOARD_PATH.exists():
        return NEW_DASHBOARD_PATH
    if DASHBOARD_DATA_PATH.exists():
        return DASHBOARD_DATA_PATH
    raise FileNotFoundError(
        f"Could not find data folder at {NEW_DASHBOARD_PATH} or {DASHBOARD_DATA_PATH}"
    )


def extract_title_from_json(json_data: Dict[str, Any]) -> str:
    """Extract screenplay title from analysis JSON."""
    return json_data.get("analysis", {}).get("title", "")


def get_all_screenplay_files(data_path: Path, collection_filter: Optional[str] = None) -> List[Tuple[Path, str]]:
    """
    Get all screenplay JSON files with their collection names.

    Returns:
        List of (file_path, collection_name) tuples
    """
    files = []

    for collection_name in COLLECTION_YEAR_CONTEXT.keys():
        # Apply collection filter if specified
        if collection_filter and collection_filter not in collection_name:
            continue

        collection_path = data_path / collection_name
        if not collection_path.exists():
            print(f"Warning: Collection folder not found: {collection_path}")
            continue

        for json_file in collection_path.glob("*_analysis_v3.json"):
            files.append((json_file, collection_name))

    return sorted(files, key=lambda x: (x[1], x[0].name))


def add_tmdb_status_to_json(
    json_path: Path,
    tmdb_result: Dict[str, Any],
    dry_run: bool = False
) -> bool:
    """
    Add tmdb_status field to screenplay JSON file.

    Args:
        json_path: Path to the JSON file
        tmdb_result: TMDB validation result dictionary
        dry_run: If True, don't actually modify the file

    Returns:
        True if file was (or would be) modified, False otherwise
    """
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Add tmdb_status field
        data["tmdb_status"] = {
            "is_produced": tmdb_result.get("is_produced", False),
            "tmdb_id": tmdb_result.get("tmdb_id"),
            "tmdb_title": tmdb_result.get("title"),
            "release_date": tmdb_result.get("release_date"),
            "status": tmdb_result.get("status"),
            "checked_at": tmdb_result.get("checked_at", datetime.now().isoformat()),
            "confidence": tmdb_result.get("confidence", "medium"),
        }

        if not dry_run:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

        return True

    except Exception as e:
        print(f"Error updating {json_path}: {e}")
        return False


def generate_report(
    results: List[Dict[str, Any]],
    report_path: Path
) -> None:
    """Generate CSV report of validation results."""
    report_path.parent.mkdir(parents=True, exist_ok=True)

    with open(report_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'collection',
            'title',
            'filename',
            'is_produced',
            'tmdb_title',
            'tmdb_id',
            'release_date',
            'status',
            'confidence',
            'reason'
        ])
        writer.writeheader()

        for result in results:
            writer.writerow({
                'collection': result.get('collection', ''),
                'title': result.get('title', ''),
                'filename': result.get('filename', ''),
                'is_produced': result.get('is_produced', False),
                'tmdb_title': result.get('tmdb_title', ''),
                'tmdb_id': result.get('tmdb_id', ''),
                'release_date': result.get('release_date', ''),
                'status': result.get('status', ''),
                'confidence': result.get('confidence', ''),
                'reason': result.get('reason', ''),
            })

    print(f"\nReport saved to: {report_path}")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Batch TMDB validation for screenplay JSON files'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying files'
    )
    parser.add_argument(
        '--report-only',
        action='store_true',
        help='Generate report without updating files'
    )
    parser.add_argument(
        '--collection',
        type=str,
        default=None,
        help='Only validate specific collection (e.g., "2007", "Randoms")'
    )
    parser.add_argument(
        '--no-delay',
        action='store_true',
        help='Skip delay between API calls (not recommended)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose output'
    )

    args = parser.parse_args()

    # Get API key
    api_key = os.environ.get('TMDB_API_KEY') or os.getenv('TMDB_API_KEY')
    if not api_key:
        print("ERROR: TMDB_API_KEY not found in environment or .env file")
        print("Get a free API key at: https://www.themoviedb.org/settings/api")
        return 2

    # Find data path
    try:
        data_path = find_data_path()
        print(f"Using data path: {data_path}")
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        return 1

    # Get all screenplay files
    files = get_all_screenplay_files(data_path, args.collection)
    total_files = len(files)

    if total_files == 0:
        print("No screenplay files found!")
        return 1

    print(f"\nFound {total_files} screenplay files to validate")
    if args.dry_run:
        print("DRY RUN MODE - No files will be modified")
    if args.report_only:
        print("REPORT ONLY MODE - No files will be modified")

    print("\n" + "=" * 60)

    # Load cache and overrides
    cache = load_cache()
    overrides = load_overrides()

    # Track results
    results: List[Dict[str, Any]] = []
    produced_count = 0
    not_produced_count = 0
    error_count = 0
    cached_count = 0

    # Process each file
    for idx, (json_path, collection_name) in enumerate(files, 1):
        # Read the JSON file
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
        except Exception as e:
            print(f"[{idx}/{total_files}] ERROR reading {json_path.name}: {e}")
            error_count += 1
            continue

        title = extract_title_from_json(json_data)
        if not title:
            print(f"[{idx}/{total_files}] WARNING: No title found in {json_path.name}")
            title = json_path.stem.split(" - ")[0]  # Fallback to filename

        # Get year context for this collection
        year_context = COLLECTION_YEAR_CONTEXT.get(collection_name)

        # Check if already has tmdb_status
        existing_status = json_data.get("tmdb_status")
        if existing_status and not args.verbose:
            # Already validated, use existing data
            result = {
                'collection': collection_name,
                'title': title,
                'filename': json_path.name,
                'is_produced': existing_status.get('is_produced', False),
                'tmdb_title': existing_status.get('tmdb_title', ''),
                'tmdb_id': existing_status.get('tmdb_id', ''),
                'release_date': existing_status.get('release_date', ''),
                'status': existing_status.get('status', ''),
                'confidence': existing_status.get('confidence', ''),
                'reason': 'EXISTING: Already validated',
            }
            results.append(result)
            if existing_status.get('is_produced'):
                produced_count += 1
            else:
                not_produced_count += 1
            cached_count += 1

            status_str = "PRODUCED" if existing_status.get('is_produced') else "NOT PRODUCED"
            print(f"[{idx}/{total_files}] {status_str} (cached): {title}")
            continue

        # Check TMDB
        print(f"[{idx}/{total_files}] Checking: {title} ({collection_name})")

        try:
            is_produced, reason, details = check_if_produced(
                title,
                api_key,
                year_context=year_context,
                cache=cache
            )

            # Determine if this was a cache hit
            was_cached = "CACHED" in reason
            if was_cached:
                cached_count += 1

            result = {
                'collection': collection_name,
                'title': title,
                'filename': json_path.name,
                'is_produced': is_produced,
                'tmdb_title': details.get('title', ''),
                'tmdb_id': details.get('tmdb_id', ''),
                'release_date': details.get('release_date', ''),
                'status': details.get('status', ''),
                'confidence': details.get('confidence', 'medium'),
                'reason': reason,
            }
            results.append(result)

            if is_produced:
                produced_count += 1
                print(f"    -> PRODUCED: {details.get('title', 'Unknown')} ({details.get('release_date', 'N/A')})")
            else:
                not_produced_count += 1
                if args.verbose:
                    print(f"    -> NOT PRODUCED: {reason}")

            # Update JSON file if not dry-run or report-only
            if not args.dry_run and not args.report_only:
                add_tmdb_status_to_json(json_path, details)

            # Rate limiting (skip for cached results)
            if not was_cached and not args.no_delay and idx < total_files:
                time.sleep(API_DELAY_SECONDS)

        except Exception as e:
            print(f"    -> ERROR: {e}")
            error_count += 1
            results.append({
                'collection': collection_name,
                'title': title,
                'filename': json_path.name,
                'is_produced': False,
                'reason': f'ERROR: {e}',
            })

    # Save cache
    save_cache(cache)

    # Generate report
    generate_report(results, REPORT_PATH)

    # Print summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    print(f"Total screenplays: {total_files}")
    print(f"Produced (to remove): {produced_count}")
    print(f"Not produced (keep): {not_produced_count}")
    print(f"Errors: {error_count}")
    print(f"Cache hits: {cached_count}")

    if produced_count > 0:
        print("\n" + "-" * 40)
        print("PRODUCED FILMS (candidates for removal):")
        print("-" * 40)
        for r in results:
            if r.get('is_produced'):
                tmdb_title = r.get('tmdb_title', r.get('title'))
                release = r.get('release_date', 'N/A')
                print(f"  - {r['title']} -> {tmdb_title} ({release})")

    if args.dry_run:
        print("\n[DRY RUN] No files were modified. Run without --dry-run to apply changes.")

    return 0


if __name__ == '__main__':
    sys.exit(main())
