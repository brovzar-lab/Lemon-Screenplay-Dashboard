#!/usr/bin/env python3
"""
Screenplay Ingestion Pipeline
=============================
Complete end-to-end workflow for adding new screenplays to the Lemon Dashboard.

This script:
1. Parses PDF screenplays to extract text
2. Pre-screens against TMDB to skip produced films
3. Runs AI analysis (V3 strict thresholds)
4. Copies results to the dashboard data folder
5. Regenerates index files for the dashboard

Usage:
    # From local PDF folder:
    python execution/ingest_screenplays.py --source /path/to/pdfs --collection "2024 Black List"

    # From Google Drive folder:
    python execution/ingest_screenplays.py --drive "https://drive.google.com/..." --collection "2024 Black List"

    # Single PDF file:
    python execution/ingest_screenplays.py --source /path/to/screenplay.pdf --collection "Randoms"

    # Options:
    --model claude-haiku     # Use cheaper model (default: claude)
    --skip-tmdb              # Skip TMDB pre-screening
    --dry-run                # Preview what would be processed
    --force                  # Re-analyze even if output exists
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

load_dotenv()

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent
EXECUTION_DIR = PROJECT_ROOT / "execution"
TMP_DIR = PROJECT_ROOT / ".tmp"
DASHBOARD_DATA_DIR = Path("/Users/Vertigo/CODE/LEMON-SCREENPLAY-DASHBOARD/public/data")

# Collection folder mapping
COLLECTION_FOLDERS = {
    "2005 Black List": "analysis_v3_2005",
    "2006 Black List": "analysis_v3_2006",
    "2007 Black List": "analysis_v3_2007",
    "2020 Black List": "analysis_v3_2020",
    "Randoms": "analysis_v3_Randoms",
    # Add new collections here
}

# Year context for TMDB filtering
COLLECTION_YEAR_CONTEXT = {
    "2005 Black List": 2005,
    "2006 Black List": 2006,
    "2007 Black List": 2007,
    "2020 Black List": 2020,
    "2024 Black List": 2024,
    "2025 Black List": 2025,
    "Randoms": None,
}


class ScreenplayIngester:
    """Main ingestion pipeline class."""

    def __init__(
        self,
        collection: str,
        model: str = "claude",
        skip_tmdb: bool = False,
        dry_run: bool = False,
        force: bool = False,
        verbose: bool = True
    ):
        self.collection = collection
        self.model = model
        self.skip_tmdb = skip_tmdb
        self.dry_run = dry_run
        self.force = force
        self.verbose = verbose

        # Determine output folder
        if collection in COLLECTION_FOLDERS:
            self.output_folder = COLLECTION_FOLDERS[collection]
        else:
            # Create new folder name from collection
            safe_name = collection.lower().replace(" ", "_").replace("-", "_")
            self.output_folder = f"analysis_v3_{safe_name}"
            COLLECTION_FOLDERS[collection] = self.output_folder

        self.year_context = COLLECTION_YEAR_CONTEXT.get(collection)

        # Working directories
        self.parsed_dir = TMP_DIR / f"parsed_{self.output_folder}"
        self.analysis_dir = TMP_DIR / self.output_folder

        # Statistics
        self.stats = {
            "total_pdfs": 0,
            "parsed": 0,
            "skipped_produced": 0,
            "analyzed": 0,
            "failed": 0,
            "already_exists": 0,
        }

        self.log(f"Ingestion Pipeline Initialized")
        self.log(f"  Collection: {collection}")
        self.log(f"  Output folder: {self.output_folder}")
        self.log(f"  Model: {model}")
        self.log(f"  TMDB pre-screening: {'Disabled' if skip_tmdb else 'Enabled'}")
        if self.year_context:
            self.log(f"  Year context: {self.year_context}")

    def log(self, message: str, level: str = "INFO"):
        """Print log message with timestamp."""
        if self.verbose or level == "ERROR":
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] {level}: {message}")

    def ensure_directories(self):
        """Create necessary directories."""
        self.parsed_dir.mkdir(parents=True, exist_ok=True)
        self.analysis_dir.mkdir(parents=True, exist_ok=True)

        # Ensure dashboard data directory exists
        dashboard_output = DASHBOARD_DATA_DIR / self.output_folder
        dashboard_output.mkdir(parents=True, exist_ok=True)

    def download_from_drive(self, drive_url: str) -> Path:
        """Download PDFs from Google Drive."""
        self.log(f"Downloading from Google Drive: {drive_url}")

        download_dir = TMP_DIR / "screenplays_download"
        download_dir.mkdir(parents=True, exist_ok=True)

        if self.dry_run:
            self.log("[DRY RUN] Would download from Google Drive")
            return download_dir

        # List files
        list_script = EXECUTION_DIR / "list_drive_pdfs.py"
        result = subprocess.run(
            [sys.executable, str(list_script), drive_url],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            self.log(f"Failed to list Drive files: {result.stderr}", "ERROR")
            raise RuntimeError("Google Drive listing failed")

        # Download files
        download_script = EXECUTION_DIR / "download_screenplay.py"
        result = subprocess.run(
            [sys.executable, str(download_script)],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            self.log(f"Failed to download files: {result.stderr}", "ERROR")
            raise RuntimeError("Google Drive download failed")

        self.log(f"Downloaded files to {download_dir}")
        return download_dir

    def parse_pdfs(self, source_path: Path) -> List[Path]:
        """Parse PDF files to extract text."""
        self.log(f"Parsing PDFs from: {source_path}")

        parse_script = EXECUTION_DIR / "parse_screenplay_pdf.py"

        if self.dry_run:
            # Count PDFs that would be processed
            if source_path.is_file():
                pdfs = [source_path] if source_path.suffix.lower() == ".pdf" else []
            else:
                pdfs = list(source_path.glob("*.pdf"))

            self.stats["total_pdfs"] = len(pdfs)
            self.log(f"[DRY RUN] Would parse {len(pdfs)} PDF files")
            return []

        # Run parser
        result = subprocess.run(
            [
                sys.executable, str(parse_script),
                "--input", str(source_path),
                "--output", str(self.parsed_dir)
            ],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            self.log(f"Parse errors: {result.stderr}", "ERROR")

        # Get list of parsed files
        parsed_files = list(self.parsed_dir.glob("*.json"))
        self.stats["parsed"] = len(parsed_files)
        self.log(f"Parsed {len(parsed_files)} screenplays")

        return parsed_files

    def check_tmdb(self, title: str) -> Tuple[bool, str]:
        """Check if screenplay has been produced."""
        if self.skip_tmdb:
            return False, "TMDB check skipped"

        check_script = EXECUTION_DIR / "check_produced_film.py"

        args = [sys.executable, str(check_script), title]
        if self.year_context:
            args.extend(["--year-context", str(self.year_context)])

        result = subprocess.run(args, capture_output=True, text=True)

        if result.returncode == 1:
            return True, result.stdout.strip()
        elif result.returncode == 2:
            return False, f"TMDB error: {result.stderr}"
        else:
            return False, "Not produced"

    def analyze_screenplay(self, parsed_json: Path) -> Optional[Path]:
        """Run V3 analysis on a parsed screenplay."""
        output_name = parsed_json.stem.replace("_parsed", "") + "_analysis_v3.json"
        output_path = self.analysis_dir / output_name

        # Check if already analyzed
        if output_path.exists() and not self.force:
            self.stats["already_exists"] += 1
            self.log(f"  Already analyzed: {parsed_json.stem}")
            return output_path

        analyze_script = EXECUTION_DIR / "analyze_screenplay_v3.py"

        if self.dry_run:
            self.log(f"  [DRY RUN] Would analyze: {parsed_json.stem}")
            return None

        # Read parsed JSON to get title for TMDB check
        with open(parsed_json, 'r', encoding='utf-8') as f:
            parsed_data = json.load(f)

        title = parsed_data.get("title") or parsed_json.stem.split(" - ")[0].replace("_", " ")

        # TMDB pre-screening
        is_produced, reason = self.check_tmdb(title)
        if is_produced:
            self.stats["skipped_produced"] += 1
            self.log(f"  SKIPPED (produced): {title} - {reason}")
            return None

        # Run analysis
        result = subprocess.run(
            [
                sys.executable, str(analyze_script),
                str(parsed_json),
                "--model", self.model,
                "--output", str(self.analysis_dir)
            ],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            self.stats["failed"] += 1
            self.log(f"  FAILED: {parsed_json.stem} - {result.stderr}", "ERROR")
            return None

        self.stats["analyzed"] += 1
        self.log(f"  Analyzed: {parsed_json.stem}")

        # Add TMDB status to output
        if output_path.exists():
            self._add_tmdb_status(output_path, is_produced=False)

        return output_path

    def _add_tmdb_status(self, json_path: Path, is_produced: bool):
        """Add tmdb_status field to analysis JSON."""
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            data["tmdb_status"] = {
                "is_produced": is_produced,
                "tmdb_id": None,
                "tmdb_title": None,
                "release_date": None,
                "status": None,
                "checked_at": datetime.now().isoformat(),
                "confidence": "high" if not is_produced else "medium"
            }

            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            self.log(f"Warning: Could not add TMDB status: {e}", "WARN")

    def copy_to_dashboard(self):
        """Copy analysis files to dashboard data folder."""
        dashboard_output = DASHBOARD_DATA_DIR / self.output_folder

        if self.dry_run:
            analysis_files = list(self.analysis_dir.glob("*_analysis_v3.json"))
            self.log(f"[DRY RUN] Would copy {len(analysis_files)} files to {dashboard_output}")
            return

        # Copy all analysis files
        copied = 0
        for analysis_file in self.analysis_dir.glob("*_analysis_v3.json"):
            dest = dashboard_output / analysis_file.name
            shutil.copy2(analysis_file, dest)
            copied += 1

        self.log(f"Copied {copied} files to dashboard: {dashboard_output}")

    def update_index(self):
        """Regenerate index.json for the collection."""
        dashboard_output = DASHBOARD_DATA_DIR / self.output_folder
        index_file = dashboard_output / "index.json"

        if self.dry_run:
            self.log(f"[DRY RUN] Would update index.json")
            return

        # Get list of all analysis JSON files
        analysis_files = sorted([
            f.name for f in dashboard_output.glob("*_analysis_v3.json")
        ])

        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(analysis_files, f, indent=2)

        self.log(f"Updated index.json with {len(analysis_files)} files")

    def run(self, source: Optional[str] = None, drive_url: Optional[str] = None):
        """Execute the full ingestion pipeline."""
        start_time = time.time()

        self.log("=" * 60)
        self.log("SCREENPLAY INGESTION PIPELINE")
        self.log("=" * 60)

        # Ensure directories exist
        self.ensure_directories()

        # Determine source
        if drive_url:
            source_path = self.download_from_drive(drive_url)
        elif source:
            source_path = Path(source)
            if not source_path.exists():
                self.log(f"Source path not found: {source_path}", "ERROR")
                return False
        else:
            self.log("No source specified. Use --source or --drive", "ERROR")
            return False

        # Parse PDFs
        parsed_files = self.parse_pdfs(source_path)

        if self.dry_run:
            self.log("\n" + "=" * 60)
            self.log("DRY RUN SUMMARY")
            self.log(f"  PDFs found: {self.stats['total_pdfs']}")
            self.log(f"  Would parse and analyze with model: {self.model}")
            self.log(f"  Output to: {DASHBOARD_DATA_DIR / self.output_folder}")
            return True

        # Analyze each screenplay
        self.log(f"\nAnalyzing {len(parsed_files)} screenplays...")
        for i, parsed_file in enumerate(parsed_files, 1):
            self.log(f"[{i}/{len(parsed_files)}] Processing: {parsed_file.stem}")
            self.analyze_screenplay(parsed_file)

            # Small delay to avoid rate limits
            if i < len(parsed_files):
                time.sleep(1)

        # Copy to dashboard
        self.copy_to_dashboard()

        # Update index
        self.update_index()

        # Final summary
        elapsed = time.time() - start_time
        self.log("\n" + "=" * 60)
        self.log("INGESTION COMPLETE")
        self.log("=" * 60)
        self.log(f"  Total PDFs: {self.stats['parsed']}")
        self.log(f"  Analyzed: {self.stats['analyzed']}")
        self.log(f"  Skipped (produced): {self.stats['skipped_produced']}")
        self.log(f"  Skipped (exists): {self.stats['already_exists']}")
        self.log(f"  Failed: {self.stats['failed']}")
        self.log(f"  Time: {elapsed:.1f} seconds")
        self.log(f"\nDashboard data: {DASHBOARD_DATA_DIR / self.output_folder}")
        self.log(f"Remember to rebuild and deploy the dashboard!")

        return True


def main():
    parser = argparse.ArgumentParser(
        description="Ingest screenplays into the Lemon Dashboard",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # From local folder:
  python execution/ingest_screenplays.py --source /path/to/pdfs --collection "2024 Black List"

  # From Google Drive:
  python execution/ingest_screenplays.py --drive "https://drive.google.com/..." --collection "2024 Black List"

  # Single file with cheaper model:
  python execution/ingest_screenplays.py --source screenplay.pdf --collection Randoms --model claude-haiku

  # Preview what would happen:
  python execution/ingest_screenplays.py --source /pdfs --collection Test --dry-run
        """
    )

    # Source options
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument(
        "--source", "-s",
        help="Local path to PDF file or directory"
    )
    source_group.add_argument(
        "--drive", "-d",
        help="Google Drive folder URL"
    )

    # Required options
    parser.add_argument(
        "--collection", "-c",
        required=True,
        help="Collection name (e.g., '2024 Black List', 'Randoms')"
    )

    # Optional settings
    parser.add_argument(
        "--model", "-m",
        choices=["claude", "claude-haiku", "claude-opus", "gpt"],
        default="claude",
        help="AI model to use (default: claude)"
    )
    parser.add_argument(
        "--skip-tmdb",
        action="store_true",
        help="Skip TMDB pre-screening"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be processed without making changes"
    )
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Re-analyze even if output already exists"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Reduce output verbosity"
    )

    args = parser.parse_args()

    # Create ingester and run
    ingester = ScreenplayIngester(
        collection=args.collection,
        model=args.model,
        skip_tmdb=args.skip_tmdb,
        dry_run=args.dry_run,
        force=args.force,
        verbose=not args.quiet
    )

    success = ingester.run(
        source=args.source,
        drive_url=args.drive
    )

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
