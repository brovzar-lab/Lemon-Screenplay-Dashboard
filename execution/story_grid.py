"""
Story Grid genre engine — the "genre brain".

Turns the Story Grid methodology (docs/methodology/story-grid-for-screen.md,
structured in story_grid.json) into two things the V9 pipeline uses:

  1. A genre-DETECTION prompt (cheap Haiku pass) that classifies a screenplay
     into the Five-Leaf Clover: external genre, internal genre, comedy pairing,
     and subgenre.

  2. A genre CARD — a text block injected into the readers so they evaluate the
     script against the CANONICAL obligatory scenes for its actual genre,
     instead of whatever the model happens to remember. For comedies, the card
     carries BOTH the comedy obligatory scenes + craft rules AND the paired
     genre's spine (Coyne's rule: comedy always pairs with a second genre).

Feature altitude only — the TV/series layer of the methodology is intentionally
not wired in.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

_DATA_PATH = Path(__file__).parent / "story_grid.json"

with open(_DATA_PATH, encoding="utf-8") as _f:
    STORY_GRID: Dict[str, Any] = json.load(_f)

EXTERNAL_GENRES: Dict[str, Any] = STORY_GRID["external_genres"]
COMEDY_SUBGENRES: Dict[str, Any] = STORY_GRID["comedy_subgenres"]
INTERNAL_GENRES: Dict[str, Any] = STORY_GRID["internal_genres"]

# Canonical genre names, lowercased → canonical, for tolerant matching of
# whatever the detection pass returns.
_CANON = {g.lower(): g for g in EXTERNAL_GENRES}
_INTERNAL_CANON = {
    name.lower(): (family, name)
    for family, members in INTERNAL_GENRES.items()
    for name in members
}


def canonical_external(name: Optional[str]) -> Optional[str]:
    """Map a free-text genre to a canonical external genre, or None."""
    if not name:
        return None
    key = name.strip().lower()
    if key in _CANON:
        return _CANON[key]
    # Tolerate common synonyms / adjectival forms.
    synonyms = {
        "action/adventure": "Action", "adventure": "Action", "sci-fi": "Action",
        "science fiction": "Action", "fantasy": "Action", "romance": "Love",
        "romantic": "Love", "rom-com": "Comedy", "comedy-drama": "Comedy",
        "dramedy": "Comedy", "dark comedy": "Comedy", "satire": "Comedy",
        "mystery": "Crime", "noir": "Crime", "detective": "Crime",
        "suspense": "Thriller", "drama": "Society", "coming-of-age": "Performance",
        "sports": "Performance", "musical": "Performance",
    }
    return synonyms.get(key)


# ─── Genre Detection Prompt ──────────────────────────────────────────────────


def build_genre_detection_prompt() -> str:
    """User instruction for the cheap detection pass. Pairs with a cached
    screenplay block. Returns a JSON classification into the Five-Leaf Clover."""
    genre_list = ", ".join(EXTERNAL_GENRES.keys())
    comedy_subs = ", ".join(COMEDY_SUBGENRES.keys())
    internal_list = ", ".join(
        name for members in INTERNAL_GENRES.values() for name in members
    )
    return f"""\
Classify this screenplay using Shawn Coyne's Story Grid (Five-Leaf Clover).
Read for GENRE, not quality. Be decisive.

EXTERNAL GENRE (the surface story — what the hero chases): pick ONE primary
from: {genre_list}.

If the primary is Comedy, you MUST also name the PAIRED genre — comedy always
rides a second genre that carries the real stakes (e.g. Comedy+Love = rom-com,
Comedy+Action = buddy action-comedy). Pick the comedy SUBGENRE from:
{comedy_subs}.

If the primary is NOT Comedy but the script is comedic in tone, set
comedic_tone true and still name the primary dramatic genre.

INTERNAL GENRE (the hero's inner change): pick ONE from: {internal_list}.

Return ONLY this JSON:
{{
  "external_genre": "",
  "is_comedy": false,
  "comedy_paired_genre": "",
  "comedy_subgenre": "",
  "comedic_tone": false,
  "internal_genre": "",
  "confidence": "high|medium|low",
  "one_line_why": ""
}}
Return ONLY valid JSON."""


def parse_detection(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise a detection result to canonical genre names + resolved flags."""
    primary = canonical_external(raw.get("external_genre"))
    is_comedy = bool(raw.get("is_comedy")) or primary == "Comedy"
    paired = canonical_external(raw.get("comedy_paired_genre")) if is_comedy else None
    # A comedy that failed to name a valid pairing still needs one; default to
    # Love, the most common commercial pairing, so both spines get checked.
    if is_comedy and paired in (None, "Comedy"):
        paired = "Love"
    subgenre = raw.get("comedy_subgenre") if is_comedy else None
    if subgenre and subgenre not in COMEDY_SUBGENRES:
        subgenre = None
    return {
        "external_genre": primary or "Society",  # Society = "drama" fallback
        "is_comedy": is_comedy,
        "comedy_paired_genre": paired,
        "comedy_subgenre": subgenre,
        "comedic_tone": bool(raw.get("comedic_tone")) or is_comedy,
        "internal_genre": raw.get("internal_genre") or "",
        "confidence": raw.get("confidence") or "low",
        "one_line_why": raw.get("one_line_why") or "",
    }


# ─── Genre Card (injected into readers) ──────────────────────────────────────


def _genre_block(genre: str) -> str:
    g = EXTERNAL_GENRES[genre]
    lines = [
        f"### {genre} — value spectrum: {g['value_spectrum']}",
        f"Core Event (the one scene the genre must deliver): {g['core_event']}",
        f"Value progression: {g['value_progression']}",
        "Obligatory scenes (MUST be present, in roughly these positions):",
    ]
    for s in g["obligatory_scenes"]:
        lines.append(f"  - {s['scene']} — {s['placement']}")
    lines.append("Conventions (genre furniture the audience expects): " + "; ".join(g["conventions"]))
    return "\n".join(lines)


def _comedy_block(detection: Dict[str, Any]) -> str:
    c = EXTERNAL_GENRES["Comedy"]
    lines = [
        "### Comedy — value spectrum: Laughter / Humiliation",
        c["pairing_rule"],
        f"Value progression: {c['value_progression']}",
        "Comedy obligatory scenes:",
    ]
    for s in c["obligatory_scenes"]:
        lines.append(f"  - {s['scene']} — {s['placement']}")
    sub = detection.get("comedy_subgenre")
    if sub and sub in COMEDY_SUBGENRES:
        cs = COMEDY_SUBGENRES[sub]
        lines.append(f"Subgenre — {sub}: {cs['core_tension']}")
        lines.append(f"  {sub} obligatory scenes:")
        for s in cs["obligatory_scenes"]:
            lines.append(f"    - {s['scene']} — {s['placement']}")
    lines.append("Comedy craft rules (non-negotiable):")
    for r in c["craft_rules"]:
        lines.append(f"  - {r}")
    return "\n".join(lines)


def build_genre_card(detection: Dict[str, Any]) -> str:
    """The genre reference block injected into the readers.

    For a comedy: comedy scenes + craft rules FIRST, then the paired genre's
    spine (both must be delivered). For anything else: the single genre block.
    """
    det = parse_detection(detection) if "is_comedy" not in detection else detection
    parts: List[str] = ["## STORY GRID — GENRE OBLIGATIONS FOR THIS SCRIPT"]

    if det["is_comedy"]:
        parts.append(_comedy_block(det))
        paired = det.get("comedy_paired_genre")
        if paired and paired in EXTERNAL_GENRES:
            parts.append(
                f"PAIRED GENRE — this comedy also carries a full {paired} spine. "
                f"It must ALSO deliver these obligatory scenes:"
            )
            parts.append(_genre_block(paired))
    else:
        genre = det["external_genre"]
        if genre in EXTERNAL_GENRES:
            parts.append(_genre_block(genre))
        if det.get("comedic_tone"):
            parts.append(
                "NOTE: comedic tone present but the spine is the dramatic genre "
                "above — do not grade this as a comedy; credit humor as a craft asset."
            )

    internal = det.get("internal_genre")
    if internal:
        parts.append(f"Internal genre (the hero's inner arc to verify): {internal}")

    parts.append(
        "Score genre_execution against THESE obligatory scenes: name which are "
        "present (with page) and which are MISSING. A missing Core Event is a "
        "red flag."
    )
    return "\n\n".join(parts)
