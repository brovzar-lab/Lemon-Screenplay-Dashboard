#!/usr/bin/env python3
"""
Batch Process V6 - Parse PDFs and Run V6 Analysis (Core + Lenses)

This script:
1. Parses all PDFs from specified source folders
2. Pre-screens against TMDB to skip already-produced films (saves API costs)
3. Runs V6 analysis on each parsed screenplay with configurable lenses
4. Saves results to public/data/analysis_v6/

V6 Features:
- TMDB Pre-screening (skip produced films)
- Core Quality Score (execution-first, no market contamination)
- Optional Lenses: LatAm, Commercial, Budget, Distribution, Co-Production
- False Positive Trap Detection
- Configurable budget ceiling

Usage:
    source .env && python3 execution/batch_process_v6.py

    # With specific lenses
    source .env && python3 execution/batch_process_v6.py --lens latam --lens commercial

    # With all lenses and custom budget ceiling
    source .env && python3 execution/batch_process_v6.py --all-lenses --budget-ceiling 15

    # Re-analyze all (skip cache)
    source .env && python3 execution/batch_process_v6.py --force

    # Skip TMDB check (for re-analysis of known unproduced films)
    source .env && python3 execution/batch_process_v6.py --skip-tmdb --force
"""

import os
import sys
import json
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Tuple

# Configuration
SOURCE_FOLDERS = [
    ("/Users/Vertigo/My Drive/LEMON TOOLS/BLKLST/2005", "2005 Black List"),
    ("/Users/Vertigo/My Drive/LEMON TOOLS/BLKLST/2006", "2006 Black List"),
    ("/Users/Vertigo/My Drive/LEMON TOOLS/BLKLST/Randoms", "Randoms"),
]

PARSED_OUTPUT_DIR = Path(".tmp/parsed_v5")  # Reuse parsed files from V5
ANALYSIS_OUTPUT_DIR = Path("public/data/analysis_v6")
LOG_FILE = Path(".tmp/batch_v6.log")

# Default lenses for Lemon Productions (LatAm-focused company)
# Full assessment includes all lenses for comprehensive production evaluation
DEFAULT_LENSES = ["latam", "commercial", "budget", "production", "coproduction"]
DEFAULT_BUDGET_CEILING = 30.0  # $30M

# Year context for TMDB filtering - ignore films released before this year
COLLECTION_YEAR_CONTEXT = {
    "2005 Black List": 2005,
    "2006 Black List": 2006,
    "2007 Black List": 2007,
    "2020 Black List": 2020,
    "Randoms": None,  # No year filter for random scripts
}


def log(message: str):
    """Log to both console and file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    with open(LOG_FILE, 'a') as f:
        f.write(log_line + "\n")


def check_tmdb(title: str, year_context: Optional[int] = None) -> Tuple[bool, str]:
    """
    Check if screenplay has been produced via TMDB.

    Returns:
        Tuple of (is_produced, reason_string)
        - is_produced: True if the film has been made, False otherwise
        - reason: Description of the check result

    Exit codes from check_produced_film.py:
        0 = Not produced (safe to analyze)
        1 = Produced (skip analysis)
        2 = Error (could not determine, proceed with analysis)
    """
    check_script = Path(__file__).parent / "check_produced_film.py"

    cmd = ["python3", str(check_script), "--title", title]
    if year_context:
        cmd.extend(["--year-context", str(year_context)])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30  # 30 sec timeout for TMDB check
        )

        if result.returncode == 1:  # Produced
            return True, result.stdout.strip() or "PRODUCED"
        elif result.returncode == 2:  # Error
            return False, f"TMDB check error (proceeding anyway): {result.stderr.strip()}"
        else:  # Not produced (exit code 0)
            return False, result.stdout.strip() or "Not produced"

    except subprocess.TimeoutExpired:
        return False, "TMDB check timeout (proceeding anyway)"
    except Exception as e:
        return False, f"TMDB check failed (proceeding anyway): {e}"


def parse_pdf(pdf_path: Path, output_dir: Path) -> Optional[Path]:
    """Parse a single PDF and return path to parsed JSON"""
    output_path = output_dir / (pdf_path.stem + ".json")

    # Skip if already parsed
    if output_path.exists():
        log(f"  Already parsed: {pdf_path.name}")
        return output_path

    try:
        result = subprocess.run(
            ["python3", "execution/parse_screenplay_pdf_v2.py",
             "--input", str(pdf_path),
             "--output", str(output_dir)],
            capture_output=True,
            text=True,
            timeout=300  # 5 min timeout for OCR
        )

        if result.returncode == 0 and output_path.exists():
            log(f"  Parsed: {pdf_path.name}")
            return output_path
        else:
            log(f"  FAILED to parse: {pdf_path.name}")
            log(f"    stderr: {result.stderr[:500] if result.stderr else 'none'}")
            return None

    except subprocess.TimeoutExpired:
        log(f"  TIMEOUT parsing: {pdf_path.name}")
        return None
    except Exception as e:
        log(f"  ERROR parsing {pdf_path.name}: {e}")
        return None


def run_v6_analysis(
    parsed_path: Path,
    collection: str,
    lenses: List[str],
    budget_ceiling: float,
    force: bool = False,
    skip_tmdb: bool = False
) -> Optional[Path]:
    """Run V6 analysis on parsed screenplay

    Returns:
        Path to analysis file if successful, None if skipped/failed
        Returns "SKIPPED_PRODUCED" string if skipped due to TMDB check
    """
    title = parsed_path.stem
    output_filename = f"{title}_analysis_v6.json"
    output_path = ANALYSIS_OUTPUT_DIR / output_filename

    # Skip if already analyzed (unless force flag)
    if output_path.exists() and not force:
        log(f"  Already analyzed: {title}")
        return output_path

    # TMDB Pre-screening: Check if film has been produced
    tmdb_status = None
    if not skip_tmdb:
        year_context = COLLECTION_YEAR_CONTEXT.get(collection)
        is_produced, reason = check_tmdb(title, year_context)
        tmdb_status = {
            "checked": True,
            "is_produced": is_produced,
            "reason": reason,
            "checked_at": datetime.now().isoformat()
        }
        if is_produced:
            log(f"  SKIPPED (produced): {title}")
            log(f"    {reason}")
            return "SKIPPED_PRODUCED"  # Skip expensive AI analysis
    else:
        tmdb_status = {
            "checked": False,
            "is_produced": None,
            "reason": "TMDB check skipped via --skip-tmdb flag",
            "checked_at": datetime.now().isoformat()
        }

    try:
        # Read parsed content
        with open(parsed_path, 'r') as f:
            parsed = json.load(f)

        screenplay_text = parsed.get('text', '')
        if not screenplay_text or len(screenplay_text.split()) < 500:
            log(f"  SKIP - insufficient text: {title}")
            return None

        # Build command
        cmd = [
            "python3", "execution/analyze_screenplay_v6.py",
            "--input", str(parsed_path),
            "--output", str(ANALYSIS_OUTPUT_DIR)
        ]

        # Add lens flags
        for lens in lenses:
            cmd.extend(["--lens", lens])

        # Add budget ceiling if budget lens is enabled
        if "budget" in lenses:
            cmd.extend(["--budget-ceiling", str(budget_ceiling)])

        # Run V6 analysis
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=240  # 4 min timeout for analysis (longer due to potential lenses)
        )

        if result.returncode == 0 and output_path.exists():
            # Add collection info and TMDB status to the analysis
            with open(output_path, 'r') as f:
                analysis = json.load(f)
            analysis['collection'] = collection
            if tmdb_status:
                analysis['tmdb_status'] = tmdb_status
            with open(output_path, 'w') as f:
                json.dump(analysis, f, indent=2, ensure_ascii=False)

            # Extract verdict for logging
            verdict = "?"
            if 'analysis' in analysis and 'core_quality' in analysis['analysis']:
                verdict = analysis['analysis']['core_quality'].get('verdict', '?')

            log(f"  Analyzed: {title} [{collection}] -> {verdict}")
            return output_path
        else:
            log(f"  FAILED to analyze: {title}")
            log(f"    stderr: {result.stderr[:500] if result.stderr else 'none'}")
            return None

    except subprocess.TimeoutExpired:
        log(f"  TIMEOUT analyzing: {title}")
        return None
    except Exception as e:
        log(f"  ERROR analyzing {title}: {e}")
        return None


def update_index():
    """Update the index.json file"""
    json_files = sorted([f.name for f in ANALYSIS_OUTPUT_DIR.glob("*_analysis_v6.json")])
    index_path = ANALYSIS_OUTPUT_DIR / "index.json"

    with open(index_path, 'w') as f:
        json.dump(json_files, f, indent=2)

    log(f"Updated index.json with {len(json_files)} files")


def main():
    parser = argparse.ArgumentParser(
        description="Batch process screenplays with V6 analysis (Core + Lenses)"
    )
    parser.add_argument(
        "--lens",
        action="append",
        dest="lenses",
        choices=["latam", "commercial", "budget", "production", "coproduction"],
        help="Enable specific lens (can be used multiple times)"
    )
    parser.add_argument(
        "--all-lenses",
        action="store_true",
        help="Enable all available lenses"
    )
    parser.add_argument(
        "--budget-ceiling",
        type=float,
        default=DEFAULT_BUDGET_CEILING,
        help=f"Budget ceiling in millions (default: {DEFAULT_BUDGET_CEILING}M)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-analyze even if output already exists"
    )
    parser.add_argument(
        "--core-only",
        action="store_true",
        help="Run core quality analysis only (no lenses)"
    )
    parser.add_argument(
        "--skip-tmdb",
        action="store_true",
        help="Skip TMDB pre-screening (use for re-analysis of known unproduced films)"
    )

    args = parser.parse_args()

    # Determine which lenses to use
    if args.core_only:
        lenses = []
    elif args.all_lenses:
        lenses = ["latam", "commercial", "budget", "production", "coproduction"]
    elif args.lenses:
        lenses = args.lenses
    else:
        lenses = DEFAULT_LENSES

    # Ensure output directories exist
    PARSED_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ANALYSIS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Clear log
    if LOG_FILE.exists():
        LOG_FILE.unlink()

    log("=" * 60)
    log("BATCH V6 PROCESSING STARTED (Core + Lenses Architecture)")
    log("=" * 60)
    log(f"Lenses enabled: {lenses if lenses else 'None (Core Only)'}")
    if "budget" in lenses:
        log(f"Budget ceiling: ${args.budget_ceiling}M")
    log(f"Force re-analyze: {args.force}")
    log(f"TMDB pre-screening: {'Disabled' if args.skip_tmdb else 'Enabled'}")
    log("=" * 60)

    total_pdfs = 0
    parsed_count = 0
    analyzed_count = 0
    skipped_produced = 0
    verdict_counts = {"PASS": 0, "CONSIDER": 0, "RECOMMEND": 0, "FILM_NOW": 0}

    for source_folder, collection in SOURCE_FOLDERS:
        folder_path = Path(source_folder)

        if not folder_path.exists():
            log(f"WARNING: Folder not found: {source_folder}")
            continue

        pdf_files = sorted(folder_path.glob("*.pdf"))
        log(f"\n[{collection}] Found {len(pdf_files)} PDFs in {source_folder}")
        total_pdfs += len(pdf_files)

        for pdf_path in pdf_files:
            log(f"\nProcessing: {pdf_path.name}")

            # Step 1: Parse PDF (reuse V5 parsed files)
            parsed_path = parse_pdf(pdf_path, PARSED_OUTPUT_DIR)
            if not parsed_path:
                continue
            parsed_count += 1

            # Step 2: Run V6 analysis (with TMDB pre-screening)
            analysis_result = run_v6_analysis(
                parsed_path,
                collection,
                lenses,
                args.budget_ceiling,
                args.force,
                args.skip_tmdb
            )
            if analysis_result == "SKIPPED_PRODUCED":
                skipped_produced += 1
            elif analysis_result:
                analyzed_count += 1
                analysis_path = analysis_result

                # Count verdicts
                try:
                    with open(analysis_path, 'r') as f:
                        analysis = json.load(f)
                    verdict = analysis.get('analysis', {}).get('core_quality', {}).get('verdict', 'PASS')
                    if verdict in verdict_counts:
                        verdict_counts[verdict] += 1
                except:
                    pass

    # Update index
    update_index()

    log("\n" + "=" * 60)
    log("BATCH V6 PROCESSING COMPLETE")
    log("=" * 60)
    log(f"Total PDFs: {total_pdfs}")
    log(f"Successfully parsed: {parsed_count}")
    log(f"Skipped (already produced): {skipped_produced}")
    log(f"Successfully analyzed: {analyzed_count}")
    log(f"\nVerdict Distribution:")
    log(f"  FILM_NOW:  {verdict_counts['FILM_NOW']}")
    log(f"  RECOMMEND: {verdict_counts['RECOMMEND']}")
    log(f"  CONSIDER:  {verdict_counts['CONSIDER']}")
    log(f"  PASS:      {verdict_counts['PASS']}")
    log("=" * 60)

    return 0 if analyzed_count > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
