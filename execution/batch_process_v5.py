#!/usr/bin/env python3
"""
Batch Process V5 - Parse PDFs and Run V5 Analysis

This script:
1. Parses all PDFs from specified source folders
2. Runs V5 analysis on each parsed screenplay
3. Saves results to public/data/analysis_v5/

Usage:
    source .env && python3 execution/batch_process_v5.py
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime

# Configuration
SOURCE_FOLDERS = [
    ("/Users/Vertigo/My Drive/LEMON TOOLS/BLKLST/2005", "2005 Black List"),
    ("/Users/Vertigo/My Drive/LEMON TOOLS/BLKLST/2006", "2006 Black List"),
    ("/Users/Vertigo/My Drive/LEMON TOOLS/BLKLST/Randoms", "Randoms"),
]

PARSED_OUTPUT_DIR = Path(".tmp/parsed_v5")
ANALYSIS_OUTPUT_DIR = Path("public/data/analysis_v5")
LOG_FILE = Path(".tmp/batch_v5.log")

def log(message: str):
    """Log to both console and file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    with open(LOG_FILE, 'a') as f:
        f.write(log_line + "\n")

def parse_pdf(pdf_path: Path, output_dir: Path) -> Path | None:
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

def run_v5_analysis(parsed_path: Path, collection: str) -> Path | None:
    """Run V5 analysis on parsed screenplay"""
    title = parsed_path.stem
    output_filename = f"{title}_analysis_v5.json"
    output_path = ANALYSIS_OUTPUT_DIR / output_filename

    # Skip if already analyzed
    if output_path.exists():
        log(f"  Already analyzed: {title}")
        return output_path

    try:
        # Read parsed content
        with open(parsed_path, 'r') as f:
            parsed = json.load(f)

        screenplay_text = parsed.get('text', '')
        if not screenplay_text or len(screenplay_text.split()) < 500:
            log(f"  SKIP - insufficient text: {title}")
            return None

        # Run V5 analysis
        result = subprocess.run(
            ["python3", "execution/analyze_screenplay_v5.py",
             "--input", str(parsed_path),
             "--output", str(ANALYSIS_OUTPUT_DIR)],
            capture_output=True,
            text=True,
            timeout=180  # 3 min timeout for analysis
        )

        if result.returncode == 0 and output_path.exists():
            # Add collection info to the analysis
            with open(output_path, 'r') as f:
                analysis = json.load(f)
            analysis['collection'] = collection
            with open(output_path, 'w') as f:
                json.dump(analysis, f, indent=2, ensure_ascii=False)
            log(f"  Analyzed: {title} [{collection}]")
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
    json_files = sorted([f.name for f in ANALYSIS_OUTPUT_DIR.glob("*_analysis_v5.json")])
    index_path = ANALYSIS_OUTPUT_DIR / "index.json"

    with open(index_path, 'w') as f:
        json.dump(json_files, f, indent=2)

    log(f"Updated index.json with {len(json_files)} files")

def main():
    # Ensure output directories exist
    PARSED_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ANALYSIS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Clear log
    if LOG_FILE.exists():
        LOG_FILE.unlink()

    log("=" * 60)
    log("BATCH V5 PROCESSING STARTED")
    log("=" * 60)

    total_pdfs = 0
    parsed_count = 0
    analyzed_count = 0

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

            # Step 1: Parse PDF
            parsed_path = parse_pdf(pdf_path, PARSED_OUTPUT_DIR)
            if not parsed_path:
                continue
            parsed_count += 1

            # Step 2: Run V5 analysis
            analysis_path = run_v5_analysis(parsed_path, collection)
            if analysis_path:
                analyzed_count += 1

    # Update index
    update_index()

    log("\n" + "=" * 60)
    log("BATCH V5 PROCESSING COMPLETE")
    log(f"Total PDFs: {total_pdfs}")
    log(f"Successfully parsed: {parsed_count}")
    log(f"Successfully analyzed: {analyzed_count}")
    log("=" * 60)

    return 0 if analyzed_count > 0 else 1

if __name__ == "__main__":
    sys.exit(main())
