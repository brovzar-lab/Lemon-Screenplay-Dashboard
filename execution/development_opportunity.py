"""Deterministic, non-scoring Development Opportunity gate.

This module reads evidence already produced by the five V9 readers. It never
calls a model and never changes weighted_score, weighted_score_adjusted, or
verdict. Its only job is to prevent exceptional but repairable upside from
disappearing inside a low execution score.
"""

from __future__ import annotations

from typing import Any, Dict, List, Mapping


SCHEMA_VERSION = 1

SIGNALS = {
    "hook_clarity": ("high_concept", "High-concept hook"),
    "narrative_engine": ("narrative_engine", "Narrative engine"),
    "freshness": ("originality", "Originality"),
}


def _number(value: Any, default: float = 0.0) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return default
    return max(0.0, min(10.0, float(value)))


def _citations(metric: Mapping[str, Any]) -> List[int]:
    values = metric.get("page_citations")
    if not isinstance(values, list):
        return []
    return sorted({int(value) for value in values if isinstance(value, int) and value > 0})


def _pillar_score(analysis: Mapping[str, Any], name: str) -> float:
    pillars = analysis.get("pillar_scores")
    if not isinstance(pillars, Mapping):
        return 0.0
    pillar = pillars.get(name)
    if not isinstance(pillar, Mapping):
        return 0.0
    return _number(pillar.get("score"))


def _fixability(analysis: Mapping[str, Any], opportunity_score: float) -> str:
    execution_scores = [
        _pillar_score(analysis, "structure"),
        _pillar_score(analysis, "character"),
        _pillar_score(analysis, "craft_scene"),
    ]
    valid = [score for score in execution_scores if score > 0]
    if not valid:
        return "unknown"
    floor = min(valid)
    if opportunity_score >= 8.0 and floor >= 4.0:
        return "high"
    if opportunity_score >= 7.5 and floor >= 3.0:
        return "medium"
    return "low"


def derive_development_opportunity(
    analysis: Mapping[str, Any],
    reader_reports: Mapping[str, Any],
) -> Dict[str, Any]:
    """Return additive routing evidence without mutating ``analysis``."""

    concept = reader_reports.get("concept")
    if not isinstance(concept, Mapping):
        concept = {}
    sub_scores = concept.get("sub_scores")
    if not isinstance(sub_scores, Mapping):
        sub_scores = {}

    evidence: List[Dict[str, Any]] = []
    for metric_name, (signal, label) in SIGNALS.items():
        metric = sub_scores.get(metric_name)
        if not isinstance(metric, Mapping):
            continue
        score = _number(metric.get("score"))
        if score < 7.0:
            continue
        detail = str(
            metric.get("justification")
            or metric.get("one_sentence_pitch")
            or f"{label} scored {score:.1f}."
        ).strip()
        evidence.append({
            "signal": signal,
            "label": label,
            "score": round(score, 1),
            "detail": detail,
            "source": "structured_v9",
            "page_citations": _citations(metric),
        })

    evidence.sort(key=lambda item: item["score"], reverse=True)
    strongest = evidence[0] if evidence else None
    opportunity_score = float(strongest["score"]) if strongest else 0.0
    fixability = _fixability(analysis, opportunity_score)
    strong_count = sum(1 for item in evidence if item["score"] >= 7.5)
    corroborated = strong_count >= 2 or opportunity_score >= 8.8
    requires_producer_look = corroborated and fixability != "low"

    weaknesses = analysis.get("weaknesses")
    risks = [str(item) for item in weaknesses[:3]] if isinstance(weaknesses, list) else []
    if requires_producer_look and strongest:
        rationale = (
            f"{strongest['label']} is strong enough to warrant a producer look "
            "before this project is dismissed. The original score and verdict remain unchanged."
        )
    elif strongest:
        rationale = "The upside evidence is not yet strong or corroborated enough for Producer Look routing."
    else:
        rationale = "No exceptional, corroborated development opportunity was identified."

    return {
        "schema_version": SCHEMA_VERSION,
        "level": "producer_review" if requires_producer_look else ("watch" if evidence else "none"),
        "fixability": fixability,
        "evidence_confidence": "verified",
        "strongest_signal": strongest["signal"] if strongest else None,
        "rationale": rationale,
        "evidence": evidence,
        "risks": risks,
        "source": "structured_v9",
        "requires_producer_look": requires_producer_look,
        "opportunity_score": round(opportunity_score, 1),
    }
