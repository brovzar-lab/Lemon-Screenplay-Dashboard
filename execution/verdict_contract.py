"""Pure, shared V9 verdict rules used by analysis and trust validation."""

from typing import Any, Dict, List


VERDICT_TIERS = ["PASS", "CONSIDER", "RECOMMEND", "FILM_NOW"]
READER_WEIGHTS = {
    "structure": 0.30,
    "character": 0.30,
    "craft_scene": 0.15,
    "concept": 0.15,
    "emotional_resonance": 0.10,
}
FAILURE_PENALTIES = {
    "minor": 0.3,
    "moderate": 0.5,
    "major": 0.8,
    "critical": 1.2,
}
MAX_FAILURE_PENALTY = 3.0
BOUNDARY_WINDOW = 0.5
VERDICT_BOUNDARIES = (5.5, 7.5, 8.5)


def near_verdict_boundary(
    score: float,
    window: float = BOUNDARY_WINDOW,
) -> bool:
    """Return whether a score is inside the mandatory stability window."""
    return any(abs(score - boundary) < window for boundary in VERDICT_BOUNDARIES)


def compute_failure_penalty(critical_failures: Any) -> float:
    """Sum severity penalties from the structured critical_failures list."""
    if not isinstance(critical_failures, list):
        return 0.0
    total = 0.0
    for item in critical_failures:
        if not isinstance(item, dict):
            continue
        severity = str(item.get("severity", "")).lower()
        total += FAILURE_PENALTIES.get(severity, 0.0)
    return round(min(total, MAX_FAILURE_PENALTY), 2)


def _score_to_tier(score: float) -> str:
    if score >= 8.5:
        return "FILM_NOW"
    if score >= 7.5:
        return "RECOMMEND"
    if score >= 5.5:
        return "CONSIDER"
    return "PASS"


def _cap_tier(tier: str, cap: str) -> str:
    return cap if VERDICT_TIERS.index(tier) > VERDICT_TIERS.index(cap) else tier


def derive_verdict(
    weighted_score: float,
    critical_failures: Any = None,
    situation_verdict: str = "",
    weighted_trap_score: float = 0.0,
    truncated: bool = False,
) -> Dict[str, Any]:
    """Derive the score-adjusted verdict and an exact adjustment trail."""
    adjustments: List[str] = []

    penalty = compute_failure_penalty(critical_failures)
    adjusted = round(max(0.0, weighted_score - penalty), 2)
    if penalty > 0:
        adjustments.append(
            f"critical_failure_penalty: -{penalty} "
            f"({weighted_score} → {adjusted})"
        )

    verdict = _score_to_tier(adjusted)
    base_verdict = verdict

    if str(situation_verdict).lower() == "situation":
        capped = _cap_tier(verdict, "CONSIDER")
        if capped != verdict:
            adjustments.append(f"story_vs_situation gate: {verdict} → {capped}")
        verdict = capped

    if weighted_trap_score >= 3.0:
        capped = _cap_tier(verdict, "CONSIDER")
        if capped != verdict:
            adjustments.append(
                f"trap score {weighted_trap_score} >= 3.0: {verdict} → {capped}"
            )
        verdict = capped
    elif weighted_trap_score >= 2.0:
        index = VERDICT_TIERS.index(verdict)
        if index > 0:
            downgraded = VERDICT_TIERS[index - 1]
            adjustments.append(
                f"trap score {weighted_trap_score} >= 2.0: "
                f"{verdict} → {downgraded}"
            )
            verdict = downgraded

    if truncated:
        capped = _cap_tier(verdict, "CONSIDER")
        if capped != verdict:
            adjustments.append(
                f"truncated script (Act 3 unread): {verdict} → {capped}"
            )
        verdict = capped

    return {
        "verdict": verdict,
        "verdict_before_gates": base_verdict,
        "adjusted_score": adjusted,
        "penalty": penalty,
        "adjustments": adjustments,
    }
