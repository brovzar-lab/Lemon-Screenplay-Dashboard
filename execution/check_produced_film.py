#!/usr/bin/env python3
"""
Check if a screenplay has been produced as a film using TMDB API.

Purpose: Pre-screen screenplays before analysis to skip those already made into films.
This saves API costs and focuses analysis on "hidden gems" - unproduced scripts.

Exit codes:
    0 = Not produced (safe to analyze)
    1 = Produced (skip analysis)
    2 = Error (could not determine)

Usage:
    python execution/check_produced_film.py --title "JUNO"
    python execution/check_produced_film.py --title "HANNA" --year-context 2006
"""

import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

import httpx
from dotenv import load_dotenv
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log
)

load_dotenv()

# Configuration
TMDB_API_BASE = "https://api.themoviedb.org/3"
CACHE_FILE = Path(".tmp/produced_films_cache.json")
OVERRIDE_FILE = Path(".tmp/produced_overrides.json")
CACHE_EXPIRY_DAYS = 30

# TMDB statuses that indicate a film has been "produced"
PRODUCED_STATUSES = {"Released", "Post Production", "In Production"}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Retry configuration for network calls
RETRYABLE_EXCEPTIONS = (
    httpx.ConnectError,
    httpx.TimeoutException,
    httpx.HTTPStatusError,
    ConnectionError,
    TimeoutError,
)


def normalize_title(title: str) -> str:
    """
    Normalize a title for comparison.

    Handles:
    - Case: "JUNO" -> "juno"
    - Punctuation: "CHARLIE WILSON'S WAR" -> "charlie wilsons war"
    - Articles: "THE BUCKET LIST" -> "bucket list"
    - Year suffixes: "Juno (2007)" -> "juno"
    """
    if not title:
        return ""

    # Lowercase
    normalized = title.lower().strip()

    # Remove year in parentheses at end
    normalized = re.sub(r'\s*\(\d{4}\)\s*$', '', normalized)

    # Remove punctuation except spaces
    normalized = re.sub(r"[^\w\s]", '', normalized)

    # Remove leading "the ", "a ", "an "
    normalized = re.sub(r'^(the|a|an)\s+', '', normalized)

    # Collapse multiple spaces
    normalized = re.sub(r'\s+', ' ', normalized).strip()

    return normalized


def is_title_match(screenplay_title: str, tmdb_title: str, threshold: float = 0.85) -> bool:
    """
    Check if two titles match, accounting for variations.

    Args:
        screenplay_title: Title from the screenplay filename
        tmdb_title: Title from TMDB search result
        threshold: Minimum similarity ratio for fuzzy match

    Returns:
        True if titles are considered a match
    """
    norm1 = normalize_title(screenplay_title)
    norm2 = normalize_title(tmdb_title)

    if not norm1 or not norm2:
        return False

    # Exact match after normalization
    if norm1 == norm2:
        return True

    # One contains the other (handles partial titles)
    if norm1 in norm2 or norm2 in norm1:
        return True

    # Fuzzy match for typos/variations
    similarity = SequenceMatcher(None, norm1, norm2).ratio()
    return similarity >= threshold


def load_cache() -> Dict[str, Any]:
    """Load the produced films cache from disk."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to load cache: {e}")
    return {"version": 1, "entries": {}}


def save_cache(cache: Dict[str, Any]) -> None:
    """Save the produced films cache to disk."""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    cache["last_updated"] = datetime.now().isoformat()
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except IOError as e:
        logger.warning(f"Failed to save cache: {e}")


def load_overrides() -> Dict[str, List[str]]:
    """Load manual override file for force include/exclude."""
    if OVERRIDE_FILE.exists():
        try:
            with open(OVERRIDE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to load overrides: {e}")
    return {"force_analyze": [], "force_skip": []}


def get_cached_result(title: str, cache: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Get cached result for a title if it exists and hasn't expired.

    Args:
        title: Normalized title to look up
        cache: Cache dictionary

    Returns:
        Cached entry if valid, None otherwise
    """
    entries = cache.get("entries", {})
    normalized = normalize_title(title)

    if normalized not in entries:
        return None

    entry = entries[normalized]
    checked_at = entry.get("checked_at")

    if checked_at:
        checked_date = datetime.fromisoformat(checked_at)
        if datetime.now() - checked_date > timedelta(days=CACHE_EXPIRY_DAYS):
            logger.debug(f"Cache entry expired for: {title}")
            return None

    return entry


@retry(
    retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True
)
def search_tmdb(title: str, api_key: str) -> List[Dict[str, Any]]:
    """
    Search TMDB for movies matching the title.

    Args:
        title: Movie title to search for
        api_key: TMDB API key

    Returns:
        List of movie results from TMDB
    """
    url = f"{TMDB_API_BASE}/search/movie"
    params = {
        "api_key": api_key,
        "query": title,
        "include_adult": "false"
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("results", [])


@retry(
    retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True
)
def get_movie_details(movie_id: int, api_key: str) -> Dict[str, Any]:
    """
    Get detailed movie info including production status.

    Args:
        movie_id: TMDB movie ID
        api_key: TMDB API key

    Returns:
        Movie details including status
    """
    url = f"{TMDB_API_BASE}/movie/{movie_id}"
    params = {"api_key": api_key}

    with httpx.Client(timeout=30.0) as client:
        response = client.get(url, params=params)
        response.raise_for_status()
        return response.json()


def check_if_produced(
    title: str,
    api_key: str,
    year_context: Optional[int] = None,
    cache: Optional[Dict[str, Any]] = None
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Check if a screenplay has been produced as a film.

    Args:
        title: Screenplay title
        api_key: TMDB API key
        year_context: Black List year (to filter out films released before)
        cache: Cache dictionary (will be modified)

    Returns:
        Tuple of (is_produced, reason_string, details_dict)
    """
    if cache is None:
        cache = load_cache()

    # Check cache first
    cached = get_cached_result(title, cache)
    if cached:
        is_produced = cached.get("is_produced", False)
        reason = f"CACHED: {cached.get('title', 'Unknown')} ({cached.get('release_date', 'N/A')}) - {cached.get('status', 'Unknown')}"
        return (is_produced, reason, cached)

    # Search TMDB
    logger.info(f"Searching TMDB for: {title}")
    try:
        results = search_tmdb(title, api_key)
    except Exception as e:
        logger.error(f"TMDB search failed: {e}")
        return (False, f"ERROR: TMDB search failed - {e}", {"error": str(e)})

    if not results:
        # No matches found - not produced
        entry = {
            "is_produced": False,
            "tmdb_id": None,
            "title": None,
            "release_date": None,
            "status": None,
            "checked_at": datetime.now().isoformat(),
            "confidence": "high"
        }
        cache.setdefault("entries", {})[normalize_title(title)] = entry
        save_cache(cache)
        return (False, "NOT PRODUCED: No matching films found", entry)

    # Check each result for title match and production status
    for result in results:
        tmdb_title = result.get("title", "")
        release_date = result.get("release_date", "")
        movie_id = result.get("id")

        # Check if title matches
        if not is_title_match(title, tmdb_title):
            continue

        # If year_context provided, skip films released before that year
        if year_context and release_date:
            try:
                release_year = int(release_date.split("-")[0])
                if release_year < year_context:
                    logger.debug(f"Skipping {tmdb_title} ({release_year}) - released before context year {year_context}")
                    continue
            except (ValueError, IndexError):
                pass

        # Get detailed status
        try:
            details = get_movie_details(movie_id, api_key)
            status = details.get("status", "Unknown")
        except Exception as e:
            logger.warning(f"Failed to get details for {tmdb_title}: {e}")
            # If we have a release date, assume it's released
            status = "Released" if release_date else "Unknown"

        # Check if status indicates production
        if status in PRODUCED_STATUSES:
            entry = {
                "is_produced": True,
                "tmdb_id": movie_id,
                "title": tmdb_title,
                "release_date": release_date,
                "status": status,
                "checked_at": datetime.now().isoformat(),
                "confidence": "high"
            }
            cache.setdefault("entries", {})[normalize_title(title)] = entry
            save_cache(cache)
            return (True, f"PRODUCED: {tmdb_title} ({release_date or 'N/A'}) - {status}", entry)

    # No matching produced films found
    entry = {
        "is_produced": False,
        "tmdb_id": None,
        "title": None,
        "release_date": None,
        "status": None,
        "checked_at": datetime.now().isoformat(),
        "confidence": "medium",
        "note": f"Found {len(results)} results but none matched criteria"
    }
    cache.setdefault("entries", {})[normalize_title(title)] = entry
    save_cache(cache)
    return (False, f"NOT PRODUCED: No matching produced films (checked {len(results)} results)", entry)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Check if a screenplay has been produced as a film'
    )
    parser.add_argument(
        '--title',
        type=str,
        required=True,
        help='Screenplay title to check'
    )
    parser.add_argument(
        '--year-context',
        type=int,
        default=None,
        help='Black List year (ignore films released before this year)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose output'
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Get API key
    api_key = os.environ.get('TMDB_API_KEY') or os.getenv('TMDB_API_KEY')
    if not api_key:
        print("ERROR: TMDB_API_KEY not found in environment or .env file", file=sys.stderr)
        print("Get a free API key at: https://www.themoviedb.org/settings/api", file=sys.stderr)
        return 2

    # Check for manual overrides
    overrides = load_overrides()
    normalized_title = normalize_title(args.title)

    # Check force_analyze list
    for force_title in overrides.get("force_analyze", []):
        if normalize_title(force_title) == normalized_title:
            print(f"OVERRIDE: Force analyze - {args.title}")
            return 0

    # Check force_skip list
    for force_title in overrides.get("force_skip", []):
        if normalize_title(force_title) == normalized_title:
            print(f"OVERRIDE: Force skip - {args.title}")
            return 1

    # Check TMDB
    try:
        is_produced, reason, details = check_if_produced(
            args.title,
            api_key,
            year_context=args.year_context
        )

        print(reason)

        if is_produced:
            return 1  # Produced - skip
        else:
            return 0  # Not produced - analyze

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        logger.exception("Unexpected error")
        return 2  # Error - proceed with analysis as fallback


if __name__ == '__main__':
    sys.exit(main())
